"use client";

import type { TimeRange } from "@/lib/audio/silenceSegments";

/**
 * Cuts a video File client-side by recording only the kept time ranges.
 * Uses HTMLVideoElement.captureStream() + MediaRecorder — no server upload needed.
 * Runs in real-time (takes as long as the kept content).
 */
export async function cutVideoClientSide(
  videoFile: File,
  keepRanges: TimeRange[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (keepRanges.length === 0) {
    throw new Error("All content would be removed. Deselect at least one segment to keep.");
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = false;
    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    video.onloadedmetadata = async () => {
      try {
        const captureStream: (() => MediaStream) | undefined =
          (video as unknown as { captureStream?: () => MediaStream }).captureStream ??
          (video as unknown as { mozCaptureStream?: () => MediaStream }).mozCaptureStream;

        if (!captureStream) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Your browser does not support video capture. Try Chrome or Edge."));
          return;
        }

        const stream = captureStream.call(video);

        const mimeType = MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : MediaRecorder.isTypeSupported("video/webm; codecs=vp9,opus")
          ? "video/webm; codecs=vp9,opus"
          : "video/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.onerror = () => reject(new Error("MediaRecorder error during video export"));

        recorder.start();

        const totalKeptSeconds = keepRanges.reduce((acc, { start, end }) => acc + (end - start), 0);
        let keptSoFar = 0;

        for (const { start, end } of keepRanges) {
          const rangeDuration = end - start;
          const rangeStart = keptSoFar;

          video.currentTime = start;
          await new Promise<void>((res) => { video.onseeked = () => res(); });

          await video.play();

          await new Promise<void>((res) => {
            const check = () => {
              if (video.currentTime >= end) {
                video.pause();
                video.ontimeupdate = null;
                res();
              } else if (onProgress && totalKeptSeconds > 0) {
                const elapsed = video.currentTime - start;
                onProgress(Math.min(99, ((rangeStart + elapsed) / totalKeptSeconds) * 100));
              }
            };
            video.ontimeupdate = check;
          });

          keptSoFar += rangeDuration;
        }

        recorder.stop();
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load video for export"));
    };
  });
}
