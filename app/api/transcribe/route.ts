import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/flac",
  "video/webm", // webm audio recorded via MediaRecorder has video/webm MIME
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper hard limit

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio field is required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.` },
      { status: 413 }
    );
  }

  // Determine file type from MIME or extension fallback
  const mimeType = file.type?.toLowerCase() ?? "";
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  const extMimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    opus: "audio/ogg", // .opus is ogg container
    webm: "audio/webm",
    flac: "audio/flac",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg",
  };
  const resolvedMime = mimeType && mimeType !== "application/octet-stream"
    ? mimeType
    : extMimeMap[ext] ?? mimeType;

  if (!ALLOWED_TYPES.has(resolvedMime) && !extMimeMap[ext]) {
    return NextResponse.json(
      { error: `Unsupported audio format: ${file.type || ext || "unknown"}. Use mp3, m4a, wav, ogg, opus, or webm.` },
      { status: 415 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Whisper needs the correct extension in the filename for format detection
    const whisperExt = extMimeMap[ext] ? ext : (ext || "mp3");
    const whisperFile = new File([await file.arrayBuffer()], `audio.${whisperExt}`, {
      type: resolvedMime || "audio/mpeg",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: whisperFile,
      model: "whisper-1",
      language: "en",
    });

    return NextResponse.json({ transcript: transcription.text });
  } catch (err) {
    console.error("[POST /api/transcribe]", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
