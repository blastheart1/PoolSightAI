/**
 * Real integration tests for the WhatsApp Video sensitivity pipeline.
 * Uses actual OpenAI Whisper + Anthropic Claude APIs — no mocks of external services.
 * DB is stubbed (same pattern as sensitivity-integration.test.ts).
 * Requires OPENAI_API_KEY and ANTHROPIC_API_KEY in .env.local.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import { resolve } from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { vi } from "vitest";
import { invertRanges } from "../../lib/video/invertRanges";

// ─── Load real env before importing routes ────────────────────────────────────

config({ path: resolve(process.cwd(), ".env.local") });

// ─── Stub DB so routes don't try to connect ───────────────────────────────────

vi.mock("../../lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (res: (v: unknown) => unknown) => res([{ id: "test-video-project" }]),
        }),
      }),
    }),
  },
}));

vi.mock("next/server", async () => vi.importActual("next/server"));

// ─── Import routes after stubs ────────────────────────────────────────────────

const { POST: transcribePost } = await import("../../app/api/transcribe/route");
const { POST: sensitivityPost } = await import(
  "../../app/api/projects/[id]/sensitivity-check/route"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_FILES_DIR = resolve(process.cwd(), "test-files");

const MP4_FILES = [
  "WhatsApp Video 2026-05-01 at 11.19.29.mp4",
  "WhatsApp Video 2026-05-01 at 12.26.35.mp4",
  "WhatsApp Video 2026-05-01 at 13.48.02.mp4",
  "WhatsApp Video 2026-05-01 at 15.44.52.mp4",
  "WhatsApp Video 2026-05-04 at 08.20.30.mp4",
];

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface FlaggedSegment {
  segmentId: number;
  start: number;
  end: number;
  text: string;
  category: string;
  reason: string;
}

function loadMp4(filename: string): File {
  const buffer = fs.readFileSync(resolve(TEST_FILES_DIR, filename));
  return new File([buffer], filename, { type: "video/mp4" });
}

function makeTranscribeRequest(file: File): NextRequest {
  const form = new FormData();
  form.append("audio", file);
  return new NextRequest("http://localhost/api/transcribe", {
    method: "POST",
    body: form,
  });
}

function makeSensitivityRequest(segments: TranscriptSegment[]): NextRequest {
  return new NextRequest(
    "http://localhost/api/projects/test-video-project/sensitivity-check",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
    }
  );
}

function makeSensitivityParams() {
  return { params: Promise.resolve({ id: "test-video-project" }) };
}

const VALID_CATEGORIES = [
  "safety_concern", "schedule_issue", "cost_overrun",
  "internal_dispute", "pm_venting", "client_complaint", "quality_issue",
];

// ─── Guards ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set in .env.local");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env.local");
  for (const f of MP4_FILES) {
    if (!fs.existsSync(resolve(TEST_FILES_DIR, f))) {
      throw new Error(`Test file missing: test-files/${f}`);
    }
  }
});

// ─── Transcription tests ──────────────────────────────────────────────────────

describe("Video transcription (Whisper accepts MP4)", () => {
  it.each(MP4_FILES)("transcribes %s", async (filename) => {
    const file = loadMp4(filename);
    const req = makeTranscribeRequest(file);
    const res = await transcribePost(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { transcript: string; segments: TranscriptSegment[] };
    expect(typeof body.transcript).toBe("string");
    expect(body.transcript.length).toBeGreaterThan(0);
    expect(Array.isArray(body.segments)).toBe(true);
    expect(body.segments.length).toBeGreaterThan(0);

    for (const seg of body.segments) {
      expect(typeof seg.id).toBe("number");
      expect(typeof seg.start).toBe("number");
      expect(typeof seg.end).toBe("number");
      expect(typeof seg.text).toBe("string");
      expect(seg.end).toBeGreaterThan(seg.start);
    }

    console.log(`\n[${filename}]`);
    console.log(`  Transcript (${body.segments.length} segs): ${body.transcript.slice(0, 200)}`);
  }, 60_000);
});

// ─── Full pipeline tests (Whisper → Claude) ──────────────────────────────────

describe("Video sensitivity pipeline (Whisper → Claude)", () => {
  it.each(MP4_FILES)("full pipeline on %s", async (filename) => {
    const file = loadMp4(filename);

    // Step 1: Transcribe
    const transcribeRes = await transcribePost(makeTranscribeRequest(file));
    expect(transcribeRes.status).toBe(200);
    const { transcript, segments } = await transcribeRes.json() as {
      transcript: string;
      segments: TranscriptSegment[];
    };
    expect(transcript.length).toBeGreaterThan(0);

    // Step 2: Sensitivity check
    const sensitivityRes = await sensitivityPost(
      makeSensitivityRequest(segments),
      makeSensitivityParams()
    );
    expect(sensitivityRes.status).toBe(200);
    const { flaggedSegments } = await sensitivityRes.json() as { flaggedSegments: FlaggedSegment[] };
    expect(Array.isArray(flaggedSegments)).toBe(true);

    for (const flag of flaggedSegments) {
      expect(typeof flag.segmentId).toBe("number");
      expect(VALID_CATEGORIES).toContain(flag.category);
      expect(typeof flag.reason).toBe("string");
      expect(flag.reason.length).toBeGreaterThan(0);
      expect(typeof flag.start).toBe("number");
      expect(typeof flag.end).toBe("number");
      expect(flag.end).toBeGreaterThan(flag.start);
    }

    // Step 3: Verify invertRanges produces valid keep-ranges from flagged
    if (flaggedSegments.length > 0) {
      const duration = segments[segments.length - 1].end;
      const removeRanges = flaggedSegments.map(({ start, end }) => ({ start, end }));
      const keepRanges = invertRanges(duration, removeRanges);
      expect(keepRanges.length).toBeGreaterThan(0);
      for (const r of keepRanges) {
        expect(r.end).toBeGreaterThan(r.start);
        expect(r.start).toBeGreaterThanOrEqual(0);
        expect(r.end).toBeLessThanOrEqual(duration + 0.1);
      }
    }

    console.log(`\n[${filename}]`);
    console.log(`  Transcript: ${transcript.slice(0, 200)}`);
    console.log(`  Flagged: ${flaggedSegments.length} segment(s)`);
    for (const f of flaggedSegments) {
      console.log(`    [${f.category}] ${f.start.toFixed(1)}s–${f.end.toFixed(1)}s: "${f.text.slice(0, 80)}" — ${f.reason}`);
    }
  }, 90_000);
});

// ─── invertRanges pure unit tests ────────────────────────────────────────────

describe("invertRanges (pure unit)", () => {
  it("returns full duration when no ranges removed", () => {
    expect(invertRanges(100, [])).toEqual([{ start: 0, end: 100 }]);
  });

  it("removes a middle segment", () => {
    expect(invertRanges(100, [{ start: 20, end: 40 }])).toEqual([
      { start: 0, end: 20 },
      { start: 40, end: 100 },
    ]);
  });

  it("handles multiple overlapping ranges", () => {
    expect(invertRanges(100, [{ start: 10, end: 30 }, { start: 25, end: 50 }])).toEqual([
      { start: 0, end: 10 },
      { start: 50, end: 100 },
    ]);
  });

  it("removes from start", () => {
    expect(invertRanges(60, [{ start: 0, end: 15 }])).toEqual([{ start: 15, end: 60 }]);
  });

  it("removes to end", () => {
    expect(invertRanges(60, [{ start: 45, end: 60 }])).toEqual([{ start: 0, end: 45 }]);
  });

  it("handles unsorted ranges", () => {
    const result = invertRanges(100, [{ start: 60, end: 80 }, { start: 10, end: 30 }]);
    expect(result).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 60 },
      { start: 80, end: 100 },
    ]);
  });

  it("returns empty when full recording is flagged", () => {
    const result = invertRanges(60, [{ start: 0, end: 60 }]);
    expect(result).toEqual([]);
  });
});
