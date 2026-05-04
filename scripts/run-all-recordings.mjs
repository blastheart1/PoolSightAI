/**
 * Runs all 6 WhatsApp Opus test files through Whisper + Claude sensitivity
 * and prints full results. Run with: node --env-file=.env.local scripts/run-all-recordings.mjs
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
  console.error("Missing OPENAI_API_KEY or ANTHROPIC_API_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const FILES = [
  "WhatsApp Audio 2026-03-30 at 20.08.47.opus",
  "WhatsApp Audio 2026-03-30 at 20.10.42.opus",
  "WhatsApp Audio 2026-03-30 at 20.12.03.opus",
  "WhatsApp Audio 2026-03-30 at 20.14.12.opus",
  "WhatsApp Audio 2026-03-30 at 20.15.32.opus",
  "WhatsApp Audio 2026-03-30 at 20.16.40.opus",
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
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

for (const filename of FILES) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`FILE: ${filename}`);
  console.log("=".repeat(72));

  // Transcribe
  const buffer = fs.readFileSync(path.join(TEST_FILES, filename));
  const whisperFile = new File([buffer], filename.replace(".opus", ".ogg"), { type: "audio/ogg" });

  const transcription = await openai.audio.transcriptions.create({
    file: whisperFile,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  const segments = (transcription.segments ?? []).map(s => ({
    id: s.id, start: s.start, end: s.end, text: s.text.trim(),
  }));

  console.log(`\nDURATION: ${formatTime(segments.at(-1)?.end ?? 0)} (${segments.length} segments)`);
  console.log(`\nFULL TRANSCRIPT:\n${transcription.text}`);
  console.log(`\nSEGMENTS:`);
  for (const seg of segments) {
    console.log(`  [${seg.id}] ${formatTime(seg.start)}–${formatTime(seg.end)}: ${seg.text}`);
  }

  // Sensitivity check
  const userPrompt = segments.map(s => `[${s.id}] (${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s): ${s.text}`).join("\n");

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

  console.log(`\nSENSITIVITY RESULT: ${flagged.length === 0 ? "✓ No sensitive content detected" : `${flagged.length} segment(s) flagged`}`);
  for (const seg of flagged) {
    console.log(`\n  [${seg.segmentId}] ${seg.category.toUpperCase()} @ ${formatTime(seg.start)}–${formatTime(seg.end)}`);
    console.log(`  Text: "${seg.text}"`);
    console.log(`  Reason: ${seg.reason}`);
  }
}

console.log(`\n${"=".repeat(72)}\nDone.\n`);
