"use client";

import { useState, useRef } from "react";
import { FilmIcon, DocumentTextIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { SensitivityPanel } from "./SensitivityPanel";
import { decodeAudioFile, encodeAudioBuffer } from "@/lib/audio/silenceSegments";
import type { TranscriptSegment, FlaggedSegment } from "@/lib/sensitivity/types";

const ACCEPTED_TYPES = ".mp4,.mov,.webm";
const MAX_MB = 200; // client-side audio extraction removes the Vercel payload limit concern

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

export interface VideoTranscriberProps {
  projectId: string;
  onTranscriptChange: (transcript: string, segments: TranscriptSegment[]) => void;
  /** Called automatically after transcription + sensitivity check complete */
  onComplete?: () => void;
  disabled?: boolean;
}

type Stage =
  | "idle"
  | "extracting"   // decoding audio track client-side
  | "transcribing" // uploading audio blob + waiting for Whisper
  | "checking"     // Claude sensitivity check
  | "ready";

type SensitivityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "done"; flaggedSegments: FlaggedSegment[] }
  | { status: "error"; message: string };

const STAGE_LABELS: Record<Stage, string> = {
  idle:         "",
  extracting:   "Extracting audio track…",
  transcribing: "Transcribing with Whisper…",
  checking:     "Checking for sensitive content…",
  ready:        "",
};

export function VideoTranscriber({
  projectId,
  onTranscriptChange,
  onComplete,
  disabled,
}: VideoTranscriberProps) {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sensitivity, setSensitivity] = useState<SensitivityState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(selected);
    setFile(selected);
    setObjectUrl(url);
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });
    setStage("idle");
    setTranscript("");
    setSegments([]);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) setVideoDuration(videoRef.current.duration);
  };

  const saveSensitivityReport = (
    fileName: string,
    text: string,
    segs: TranscriptSegment[],
    flags: FlaggedSegment[]
  ) => {
    fetch(`/api/projects/${projectId}/sensitivity-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: "video",
        fileName,
        transcript: text,
        segments: segs,
        flags,
      }),
    }).catch(() => {/* non-blocking */});
  };

  const runSensitivityCheck = async (segs: TranscriptSegment[], text: string, fileName: string) => {
    if (segs.length === 0) {
      setSensitivity({ status: "done", flaggedSegments: [] });
      setStage("ready");
      onComplete?.();
      return;
    }
    setStage("checking");
    setSensitivity({ status: "checking" });
    try {
      const res = await fetch(`/api/projects/${projectId}/sensitivity-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segs }),
      });
      const data = await res.json() as { flaggedSegments?: FlaggedSegment[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sensitivity check failed");
      const flags = data.flaggedSegments ?? [];
      setSensitivity({ status: "done", flaggedSegments: flags });
      saveSensitivityReport(fileName, text, segs, flags);
    } catch (e) {
      setSensitivity({
        status: "error",
        message: e instanceof Error ? e.message : "Sensitivity check failed",
      });
    } finally {
      setStage("ready");
      onComplete?.();
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });

    try {
      // Extract the audio track client-side — avoids sending the full MP4 over the
      // network and keeps the payload well under Vercel's function body limit.
      setStage("extracting");
      const audioBuffer = await decodeAudioFile(file);
      const { blob: audioBlob, ext } = await encodeAudioBuffer(audioBuffer);
      const audioFile = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type });

      setStage("transcribing");
      const formData = new FormData();
      formData.append("audio", audioFile);
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({})) as {
        transcript?: string;
        segments?: TranscriptSegment[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");

      const text = data.transcript ?? "";
      const segs = data.segments ?? [];
      setTranscript(text);
      setSegments(segs);
      onTranscriptChange(text, segs);

      await runSensitivityCheck(segs, text, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
      setStage("idle");
    }
  };

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setSaving(true);
    setError("");
    try {
      const label = file ? file.name.replace(/\.[^/.]+$/, "") : undefined;
      const res = await fetch(`/api/projects/${projectId}/voice-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, label, segments }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to save");
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTranscript(text);
    setSaved(false);
    setSensitivity({ status: "idle" });
    onTranscriptChange(text, segments);
  };

  const clearAll = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setFile(null);
    setObjectUrl(null);
    setVideoDuration(undefined);
    setTranscript("");
    setSegments([]);
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });
    setStage("idle");
    onTranscriptChange("", []);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = stage !== "idle" && stage !== "ready";

  return (
    <div className="space-y-3">
      {/* File picker row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition focus-within:ring-2 focus-within:ring-sky-500">
          <FilmIcon className="h-4 w-4 text-slate-500 flex-shrink-0" aria-hidden />
          {file ? file.name : "Choose video file"}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={disabled || isProcessing}
            className="sr-only"
          />
        </label>

        {file && !isProcessing && stage !== "ready" && (
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={disabled}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition"
          >
            Transcribe
          </button>
        )}

        {(file || transcript) && !isProcessing && (
          <button
            type="button"
            onClick={clearAll}
            className={`text-xs text-slate-400 underline hover:text-slate-600 ${FOCUS_RING}`}
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">Supported: mp4, mov, webm</p>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* Video preview */}
      {objectUrl && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
          <video
            ref={videoRef}
            src={objectUrl}
            controls
            autoPlay={false}
            onLoadedMetadata={handleVideoLoaded}
            className="w-full max-h-64 object-contain"
            aria-label="Video preview"
          />
        </div>
      )}

      {/* Stage progress indicator */}
      {isProcessing && (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent shrink-0" aria-hidden />
          <p className="text-sm text-sky-800">{STAGE_LABELS[stage]}</p>
        </div>
      )}

      {/* Transcript */}
      {transcript && (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <DocumentTextIcon className="h-3.5 w-3.5" aria-hidden />
            Transcript
            <span className="font-normal text-slate-400 normal-case tracking-normal">(auto-filled or type manually)</span>
          </label>
          <textarea
            value={transcript}
            onChange={handleTextChange}
            disabled={disabled || isProcessing}
            rows={5}
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:opacity-60"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              {transcript.split(/\s+/).filter(Boolean).length} words
            </p>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden />
                  Saved
                </span>
              )}
              {!saved && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || disabled}
                  className={`rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition ${FOCUS_RING}`}
                >
                  {saving ? "Saving…" : "Save voice note"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sensitivity panel */}
      {sensitivity.status === "error" && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-semibold text-rose-800">Sensitivity check failed</p>
          <p className="mt-0.5 text-xs text-rose-700">{sensitivity.message}</p>
        </div>
      )}

      {sensitivity.status === "done" && (
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Client Sensitivity Review
          </p>
          <SensitivityPanel
            flaggedSegments={sensitivity.flaggedSegments}
            videoFile={file}
            projectId={projectId}
            videoDuration={videoDuration}
            mediaType="video"
          />
        </div>
      )}
    </div>
  );
}
