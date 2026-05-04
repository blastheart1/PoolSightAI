/**
 * Runs all 5 WhatsApp MP4 test files through Whisper + Claude sensitivity
 * and prints full per-recording results. No DB touched.
 * Run with: node --env-file=.env.local scripts/run-all-video-recordings.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TEST_FILES = path.join(ROOT, "test-files");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!OPENAI_KEY || !ANTHROPIC_KEY) {
  console.error("Missing OPENAI_API_KEY or ANTHROPIC_API_KEY in environment");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const FILES = [
  "WhatsApp Video 2026-05-01 at 11.19.29.mp4",
  "WhatsApp Video 2026-05-01 at 12.26.35.mp4",
  "WhatsApp Video 2026-05-01 at 13.48.02.mp4",
  "WhatsApp Video 2026-05-01 at 15.44.52.mp4",
  "WhatsApp Video 2026-05-04 at 08.20.30.mp4",
];

const SENSITIVITY_TOOL = {
  name: "flag_sensitive_segments",
  description: "Identify transcript segments that contain content a client should not hear.",
  input_schema: {
    type: "object",
    properties: {
      flaggedSegments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            segmentId: { type: "number" },
            start: { type: "number" },
            end: { type: "number" },
            text: { type: "string" },
            category: {
              type: "string",
              enum: ["safety_concern","schedule_issue","cost_overrun","internal_dispute","pm_venting","client_complaint","quality_issue"],
            },
            reason: { type: "string" },
          },
          required: ["segmentId","start","end","text","category","reason"],
        },
      },
    },
    required: ["flaggedSegments"],
  },
};

const SYSTEM_PROMPT = `You are a quality-control assistant for Calimingo, a pool construction company. Review PM voice note transcripts and identify segments that could damage the client relationship if heard in a shared daily report.

Categories: safety_concern, schedule_issue, cost_overrun, internal_dispute, pm_venting, client_complaint, quality_issue.

Do NOT flag: normal progress updates, professional delay explanations with supplier context, routine scope descriptions.

Call flag_sensitive_segments. Return empty array if nothing is sensitive. No commentary outside the tool call.`;

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

let totalFlagged = 0;

for (const filename of FILES) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`FILE: ${filename}`);
  console.log("=".repeat(72));

  const buffer = fs.readFileSync(path.join(TEST_FILES, filename));
  const whisperFile = new File([buffer], filename, { type: "video/mp4" });

  console.log(`  Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Transcribing via Whisper…`);

  const transcription = await openai.audio.transcriptions.create({
    file: whisperFile,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  const segments = (transcription.segments ?? []).map(s => ({
    id: s.id, start: s.start, end: s.end, text: s.text.trim(),
  }));

  const duration = segments.at(-1)?.end ?? 0;
  console.log(`  Duration: ${formatTime(duration)} | Segments: ${segments.length}`);
  console.log(`\nFULL TRANSCRIPT:\n${transcription.text}`);
  console.log(`\nSEGMENTS:`);
  for (const seg of segments) {
    console.log(`  [${seg.id}] ${formatTime(seg.start)}–${formatTime(seg.end)}: ${seg.text}`);
  }

  console.log(`\n  Running sensitivity check via Claude…`);

  const userPrompt = segments
    .map(s => `[${s.id}] (${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s): ${s.text}`)
    .join("\n");

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools: [SENSITIVITY_TOOL],
      tool_choice: { type: "tool", name: "flag_sensitive_segments" },
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const claudeData = await claudeRes.json();
  const toolBlock = claudeData.content?.find(b => b.type === "tool_use");
  const flagged = toolBlock?.input?.flaggedSegments ?? [];

  totalFlagged += flagged.length;

  console.log(`\nSENSITIVITY RESULT: ${
    flagged.length === 0
      ? "✓ No sensitive content detected"
      : `⚠  ${flagged.length} segment(s) flagged`
  }`);

  for (const seg of flagged) {
    console.log(`\n  ► [Seg ${seg.segmentId}] ${seg.category.toUpperCase()} @ ${formatTime(seg.start)}–${formatTime(seg.end)}`);
    console.log(`    Text: "${seg.text}"`);
    console.log(`    Reason: ${seg.reason}`);
  }
}

console.log(`\n${"=".repeat(72)}`);
console.log(`SUMMARY: ${FILES.length} recordings processed | ${totalFlagged} total flagged segments`);
console.log("=".repeat(72));
