import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { cutVideoRanges } from "@/lib/video/cutRanges";
import type { TimeRange } from "@/lib/audio/silenceSegments";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 26 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // id not needed for the cut operation itself

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const videoFile = formData.get("video");
  if (!(videoFile instanceof File)) {
    return NextResponse.json({ error: "video field is required" }, { status: 400 });
  }

  if (videoFile.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(videoFile.size / 1024 / 1024).toFixed(1)} MB). Maximum is 26 MB.` },
      { status: 413 }
    );
  }

  const rangesRaw = formData.get("ranges");
  if (typeof rangesRaw !== "string") {
    return NextResponse.json({ error: "ranges field is required" }, { status: 400 });
  }

  let keepRanges: TimeRange[];
  try {
    keepRanges = JSON.parse(rangesRaw);
    if (!Array.isArray(keepRanges) || keepRanges.some((r) => typeof r.start !== "number" || typeof r.end !== "number")) {
      throw new Error("invalid shape");
    }
  } catch {
    return NextResponse.json({ error: "ranges must be a JSON array of {start, end} objects" }, { status: 400 });
  }

  const hasInvalidValues = keepRanges.some(
    (r) => !Number.isFinite(r.start) || !Number.isFinite(r.end) || r.start < 0 || r.end <= r.start
  );
  if (hasInvalidValues) {
    return NextResponse.json({ error: "ranges contain invalid values (must be finite, non-negative, start < end)" }, { status: 400 });
  }

  if (keepRanges.length === 0) {
    return NextResponse.json({ error: "keepRanges is empty — all content would be removed" }, { status: 422 });
  }

  const id = randomUUID();
  const inputPath = join(tmpdir(), `poolsight-input-${id}.mp4`);
  const outputPath = join(tmpdir(), `poolsight-output-${id}.mp4`);

  try {
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(inputPath, buffer);

    await cutVideoRanges(inputPath, outputPath, keepRanges);

    const outputBuffer = await readFile(outputPath);
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="clean-${videoFile.name}"`,
        "Content-Length": String(outputBuffer.length),
      },
    });
  } catch (err) {
    console.error("[POST /api/projects/[id]/cut-video]", err);
    const message = err instanceof Error ? err.message : "Video processing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
