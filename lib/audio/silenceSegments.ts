"use client";

export interface TimeRange {
  start: number; // seconds
  end: number;   // seconds
}

/**
 * Returns a new AudioBuffer with the given time ranges zeroed out (silenced).
 * Does not mutate the original buffer.
 */
export function silenceSegments(source: AudioBuffer, ranges: TimeRange[]): AudioBuffer {
  const ctx = new OfflineAudioContext(
    source.numberOfChannels,
    source.length,
    source.sampleRate
  );

  const out = ctx.createBuffer(
    source.numberOfChannels,
    source.length,
    source.sampleRate
  );

  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const outData = out.getChannelData(ch);
    outData.set(srcData);

    for (const { start, end } of ranges) {
      const startSample = Math.floor(start * source.sampleRate);
      const endSample = Math.min(Math.ceil(end * source.sampleRate), source.length);
      outData.fill(0, startSample, endSample);
    }
  }

  return out;
}

/**
 * Returns a new, shorter AudioBuffer containing only the kept time ranges (concatenated).
 * Ranges must be sorted and non-overlapping. Does not mutate the source.
 */
export function cutSegments(source: AudioBuffer, keepRanges: TimeRange[]): AudioBuffer {
  if (keepRanges.length === 0) {
    throw new Error("All content would be removed. Deselect at least one segment to keep.");
  }

  const sr = source.sampleRate;
  const totalSamples = keepRanges.reduce((acc, { start, end }) => {
    const s = Math.floor(start * sr);
    const e = Math.min(Math.ceil(end * sr), source.length);
    return acc + Math.max(0, e - s);
  }, 0);

  const ctx = new OfflineAudioContext(source.numberOfChannels, totalSamples, sr);
  const out = ctx.createBuffer(source.numberOfChannels, totalSamples, sr);

  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const outData = out.getChannelData(ch);
    let writePos = 0;
    for (const { start, end } of keepRanges) {
      const s = Math.floor(start * sr);
      const e = Math.min(Math.ceil(end * sr), source.length);
      if (e > s) {
        outData.set(srcData.subarray(s, e), writePos);
        writePos += e - s;
      }
    }
  }

  return out;
}

/**
 * Decodes an audio File into an AudioBuffer.
 * Throws if the browser cannot decode the format.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close();
  }
}

/**
 * Encodes an AudioBuffer to a downloadable Blob.
 * Prefers Opus (ogg) — same format as WhatsApp voice notes.
 * Falls back to WAV if MediaRecorder doesn't support Opus.
 */
export async function encodeAudioBuffer(buffer: AudioBuffer): Promise<{ blob: Blob; ext: string }> {
  const opusMime = "audio/ogg; codecs=opus";
  const supportsOpus = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(opusMime);
  const mimeType = supportsOpus ? opusMime : "audio/wav";
  const ext = supportsOpus ? "opus" : "wav";

  if (!supportsOpus) {
    // WAV encode via raw PCM — works in all browsers without MediaRecorder
    const wavBlob = audioBufferToWav(buffer);
    return { blob: wavBlob, ext };
  }

  // Play buffer through a MediaStreamDestination and capture with MediaRecorder
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(dest.stream, { mimeType });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("MediaRecorder error"));
    recorder.start();
    source.start(0);
    source.onended = () => recorder.stop();
  });

  await ctx.close();
  return { blob: new Blob(chunks, { type: mimeType }), ext };
}

/** Minimal WAV encoder for PCM float32 data. Used as fallback when Opus unavailable. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);          // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert float32 → int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
