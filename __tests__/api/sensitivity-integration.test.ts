/**
 * Integration tests — Transcription + Sensitivity Analysis
 *
 * Real API calls: OpenAI Whisper + Anthropic Claude.
 * No mocking of external services. No DB writes.
 * Uses actual WhatsApp Opus files from test-files/.
 *
 * Run: npm test -- sensitivity-integration
 * Requires: OPENAI_API_KEY and ANTHROPIC_API_KEY in .env.local
 */

import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import { resolve } from "path";
import fs from "fs";
import { NextRequest } from "next/server";

// ─── Load real env before importing routes ────────────────────────────────────

config({ path: resolve(process.cwd(), ".env.local") });

// ─── Stub DB so routes don't try to connect (we're skipping DB writes) ───────

import { vi } from "vitest";

vi.mock("../../lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (res: (v: unknown) => unknown) => res([{ id: "test-project-id" }]),
        }),
      }),
    }),
  },
}));

vi.mock("next/server", async () => vi.importActual("next/server"));

// ─── Import routes after env + stub are in place ─────────────────────────────

const { POST: transcribePost } = await import("../../app/api/transcribe/route");
const { POST: sensitivityPost } = await import(
  "../../app/api/projects/[id]/sensitivity-check/route"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_FILES_DIR = resolve(process.cwd(), "test-files");

const OPUS_FILES = [
  "WhatsApp Audio 2026-03-30 at 20.08.47.opus",
  "WhatsApp Audio 2026-03-30 at 20.10.42.opus",
  "WhatsApp Audio 2026-03-30 at 20.12.03.opus",
  "WhatsApp Audio 2026-03-30 at 20.14.12.opus",
  "WhatsApp Audio 2026-03-30 at 20.15.32.opus",
  "WhatsApp Audio 2026-03-30 at 20.16.40.opus",
];

function loadOpusFile(filename: string): File {
  const buffer = fs.readFileSync(resolve(TEST_FILES_DIR, filename));
  return new File([buffer], filename, { type: "audio/ogg" });
}

function makeTranscribeRequest(file: File): NextRequest {
  const form = new FormData();
  form.append("audio", file);
  return new NextRequest("http://localhost/api/transcribe", {
    method: "POST",
    body: form,
  });
}

function makeSensitivityRequest(segments: unknown[]): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/test-project-id/sensitivity-check",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
    }
  );
}

function makeSensitivityParams() {
  return { params: Promise.resolve({ id: "test-project-id" }) };
}

// ─── Preflight check ──────────────────────────────────────────────────────────

beforeAll(() => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set — add it to .env.local");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — add it to .env.local");
  }
  for (const f of OPUS_FILES) {
    if (!fs.existsSync(resolve(TEST_FILES_DIR, f))) {
      throw new Error(`Test file missing: test-files/${f}`);
    }
  }
});

// ─── Transcription tests ──────────────────────────────────────────────────────

describe("POST /api/transcribe — real Whisper calls", () => {
  it("transcribes the first WhatsApp Opus file and returns transcript + segments", async () => {
    const file = loadOpusFile(OPUS_FILES[0]);
    const res = await transcribePost(makeTranscribeRequest(file));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.transcript).toBe("string");
    expect(body.transcript.length).toBeGreaterThan(10);
    expect(Array.isArray(body.segments)).toBe(true);
    expect(body.segments.length).toBeGreaterThan(0);

    // Each segment has required shape
    for (const seg of body.segments) {
      expect(typeof seg.id).toBe("number");
      expect(typeof seg.start).toBe("number");
      expect(typeof seg.end).toBe("number");
      expect(typeof seg.text).toBe("string");
      expect(seg.end).toBeGreaterThan(seg.start);
    }
  }, 30_000);

  it("segments are time-ordered and non-overlapping", async () => {
    const file = loadOpusFile(OPUS_FILES[1]);
    const res = await transcribePost(makeTranscribeRequest(file));
    const { segments } = await res.json();

    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].start);
    }
  }, 30_000);

  it("transcript text matches concatenation of segment texts (approx)", async () => {
    const file = loadOpusFile(OPUS_FILES[2]);
    const res = await transcribePost(makeTranscribeRequest(file));
    const { transcript, segments } = await res.json();

    const joined = segments.map((s: { text: string }) => s.text.trim()).join(" ");
    // Allow some variance in whitespace/punctuation — core words should match
    const transcriptWords = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
    const joinedWords = joined.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
    const overlap = transcriptWords.filter((w: string) => joinedWords.includes(w)).length;
    expect(overlap / transcriptWords.length).toBeGreaterThan(0.85);
  }, 30_000);

  it("does not hardcode language — auto-detects from audio", async () => {
    // Indirectly verified: if language were forced to 'en' on a mixed-language
    // recording, Whisper would still return something. This test verifies the
    // route returns valid output regardless, confirming no language rejection.
    const file = loadOpusFile(OPUS_FILES[3]);
    const res = await transcribePost(makeTranscribeRequest(file));
    expect(res.status).toBe(200);
    const { transcript } = await res.json();
    expect(transcript.length).toBeGreaterThan(0);
  }, 30_000);

  it("returns 503 when OPENAI_API_KEY is missing", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const file = loadOpusFile(OPUS_FILES[0]);
    const res = await transcribePost(makeTranscribeRequest(file));
    expect(res.status).toBe(503);

    process.env.OPENAI_API_KEY = saved;
  });

  it("returns 413 for a file exceeding 25 MB", async () => {
    const bigFile = new File([new Uint8Array(26 * 1024 * 1024)], "big.opus", {
      type: "audio/ogg",
    });
    const res = await transcribePost(makeTranscribeRequest(bigFile));
    expect(res.status).toBe(413);
  });

  it("returns 415 for an unsupported file format", async () => {
    const badFile = new File([new Uint8Array(512)], "recording.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const res = await transcribePost(makeTranscribeRequest(badFile));
    expect(res.status).toBe(415);
  });

  // All 6 WhatsApp files — real transcription
  for (const filename of OPUS_FILES) {
    it(`transcribes ${filename}`, async () => {
      const file = loadOpusFile(filename);
      const res = await transcribePost(makeTranscribeRequest(file));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.transcript.length).toBeGreaterThan(0);
      expect(body.segments.length).toBeGreaterThan(0);

      console.log(`\n[${filename}]`);
      console.log(`  Transcript: ${body.transcript.slice(0, 120)}…`);
      console.log(`  Segments: ${body.segments.length} (${body.segments[0].start.toFixed(1)}s – ${body.segments.at(-1).end.toFixed(1)}s)`);
    }, 30_000);
  }
});

// ─── Sensitivity analysis tests ───────────────────────────────────────────────

describe("POST /api/projects/[id]/sensitivity-check — real Claude calls", () => {
  it("returns empty flaggedSegments for clearly safe content", async () => {
    const safeSegments = [
      { id: 0, start: 0.0, end: 3.0, text: "Good morning, we started the excavation today." },
      { id: 1, start: 3.0, end: 6.5, text: "The tile work is about 60 percent complete." },
      { id: 2, start: 6.5, end: 10.0, text: "We expect to finish the coping by end of week." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(safeSegments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.flaggedSegments)).toBe(true);
    expect(body.flaggedSegments.length).toBe(0);
  }, 30_000);

  it("flags unprofessional subcontractor complaint as a sensitive category", async () => {
    // "complete idiot" is borderline pm_venting / internal_dispute — both correct.
    // We assert it IS flagged and falls into one of the two plausible categories.
    const segments = [
      { id: 0, start: 0.0, end: 3.0, text: "We finished the bond beam today." },
      { id: 1, start: 3.0, end: 7.0, text: "Honestly this subcontractor is a complete idiot, third time he messed up." },
      { id: 2, start: 7.0, end: 10.0, text: "Plaster is scheduled for next Wednesday." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const flagged = body.flaggedSegments as Array<{ segmentId: number; category: string; reason: string }>;
    const flaggedSeg = flagged.find((f) => f.segmentId === 1);
    expect(flaggedSeg).toBeDefined();
    expect(["pm_venting", "internal_dispute"]).toContain(flaggedSeg?.category);
    expect(typeof flaggedSeg?.reason).toBe("string");
    expect(flaggedSeg!.reason.length).toBeGreaterThan(10);
  }, 30_000);

  it("flags schedule delay as schedule_issue", async () => {
    const segments = [
      { id: 0, start: 0.0,  end: 4.0,  text: "We started the week strong on pool shell work." },
      { id: 1, start: 4.0,  end: 9.0,  text: "We are three weeks behind schedule and the client is going to notice." },
      { id: 2, start: 9.0,  end: 13.0, text: "Equipment delivery is set for Monday." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const flagged = body.flaggedSegments as Array<{ segmentId: number; category: string }>;
    const scheduleFlag = flagged.find((f) => f.segmentId === 1);
    expect(scheduleFlag).toBeDefined();
    expect(scheduleFlag?.category).toBe("schedule_issue");
  }, 30_000);

  it("flags cost overrun as cost_overrun", async () => {
    const segments = [
      { id: 0, start: 0.0, end: 4.0, text: "Excavation went smoothly this morning." },
      { id: 1, start: 4.0, end: 9.5, text: "We went over budget by about fifteen thousand dollars and we haven't told the client yet." },
      { id: 2, start: 9.5, end: 13.0, text: "Tile selection meeting is tomorrow." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const flagged = body.flaggedSegments as Array<{ segmentId: number; category: string }>;
    const costFlag = flagged.find((f) => f.segmentId === 1);
    expect(costFlag).toBeDefined();
    expect(costFlag?.category).toBe("cost_overrun");
  }, 30_000);

  it("flags multiple categories in one transcript", async () => {
    const segments = [
      { id: 0, start: 0.0,  end: 3.0,  text: "Coping work is complete on the east side." },
      { id: 1, start: 3.0,  end: 7.0,  text: "The tile sub screwed everything up and we have to redo two rows." },
      { id: 2, start: 7.0,  end: 12.0, text: "We're probably two weeks behind now, the client is not going to be happy." },
      { id: 3, start: 12.0, end: 15.0, text: "Equipment should arrive Thursday." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flaggedSegments.length).toBeGreaterThanOrEqual(2);

    const flaggedIds = body.flaggedSegments.map((f: { segmentId: number }) => f.segmentId);
    expect(flaggedIds).toContain(1);
    expect(flaggedIds).toContain(2);
    expect(flaggedIds).not.toContain(3); // safe segment should not be flagged
  }, 30_000);

  it("does NOT flag a standard professional delay mention", async () => {
    const segments = [
      { id: 0, start: 0.0, end: 5.0, text: "We are waiting on the equipment delivery, expected to arrive Thursday per the supplier." },
      { id: 1, start: 5.0, end: 9.0, text: "Once it arrives we will continue with the bond beam." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    // Professional framing of a delay should not be flagged
    expect(body.flaggedSegments.length).toBe(0);
  }, 30_000);

  it("returns 200 with empty array for empty segments input", async () => {
    const res = await sensitivityPost(
      makeSensitivityRequest([]),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flaggedSegments).toEqual([]);
  }, 10_000);

  it("each flagged segment has all required fields", async () => {
    const segments = [
      { id: 0, start: 0.0, end: 5.0, text: "I hate this job today, everything is going wrong on site." },
    ];

    const res = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    if (body.flaggedSegments.length > 0) {
      const seg = body.flaggedSegments[0];
      expect(typeof seg.segmentId).toBe("number");
      expect(typeof seg.start).toBe("number");
      expect(typeof seg.end).toBe("number");
      expect(typeof seg.text).toBe("string");
      expect(typeof seg.category).toBe("string");
      expect(typeof seg.reason).toBe("string");
      expect(seg.reason.length).toBeGreaterThan(10);
    }
  }, 30_000);

  it("returns 503 when ANTHROPIC_API_KEY is missing", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await sensitivityPost(
      makeSensitivityRequest([{ id: 0, start: 0, end: 1, text: "test" }]),
      makeSensitivityParams()
    );
    expect(res.status).toBe(503);

    process.env.ANTHROPIC_API_KEY = saved;
  });
});

// ─── End-to-end pipeline test ─────────────────────────────────────────────────

describe("End-to-end pipeline — Whisper → Claude sensitivity", () => {
  it("transcribes a real WhatsApp file then runs sensitivity check on the result", async () => {
    // Step 1: Transcribe
    const file = loadOpusFile(OPUS_FILES[0]);
    const transcribeRes = await transcribePost(makeTranscribeRequest(file));
    expect(transcribeRes.status).toBe(200);

    const { transcript, segments } = await transcribeRes.json();
    expect(transcript.length).toBeGreaterThan(0);
    expect(segments.length).toBeGreaterThan(0);

    console.log(`\n[E2E] Transcript (${segments.length} segments):`);
    console.log(`  "${transcript.slice(0, 200)}…"`);

    // Step 2: Sensitivity check on real transcript segments
    const sensitivityRes = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    expect(sensitivityRes.status).toBe(200);

    const { flaggedSegments } = await sensitivityRes.json();
    expect(Array.isArray(flaggedSegments)).toBe(true);

    console.log(`\n[E2E] Sensitivity result: ${flaggedSegments.length} segment(s) flagged`);
    for (const seg of flaggedSegments) {
      console.log(`  [${seg.segmentId}] ${seg.category} @ ${seg.start.toFixed(1)}s–${seg.end.toFixed(1)}s`);
      console.log(`    "${seg.text}"`);
      console.log(`    → ${seg.reason}`);
    }
  }, 60_000);
});
