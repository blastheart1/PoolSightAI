"use client";

import { useState, useRef } from "react";
import { MicrophoneIcon, DocumentTextIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { SensitivityPanel } from "./SensitivityPanel";
import type { TranscriptSegment, FlaggedSegment } from "@/lib/sensitivity/types";

const ACCEPTED_TYPES = ".mp3,.m4a,.wav,.ogg,.opus,.webm,.flac,.mpeg,.mpga,.mp4";
const MAX_MB = 25;

export interface AudioTranscriberProps {
  projectId: string;
  onTranscriptChange: (transcript: string, segments: TranscriptSegment[]) => void;
  disabled?: boolean;
}

type SensitivityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "done"; flaggedSegments: FlaggedSegment[] }
  | { status: "error"; message: string };

export function AudioTranscriber({ projectId, onTranscriptChange, disabled }: AudioTranscriberProps) {
  const [file, setFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sensitivity, setSensitivity] = useState<SensitivityState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    if (selected.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_MB} MB.`);
      return;
    }
    setFile(selected);
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });
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
        mediaType: "audio",
        fileName,
        transcript: text,
        segments: segs,
        flags,
      }),
    }).catch(() => {/* non-blocking; failure doesn't affect PM workflow */});
  };

  const runSensitivityCheck = async (segs: TranscriptSegment[], text: string, fileName: string) => {
    if (segs.length === 0) return;
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
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setTranscribing(true);
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });

    try {
      const formData = new FormData();
      formData.append("audio", file);
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
    } finally {
      setTranscribing(false);
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
      setError(e instanceof Error ? e.message : "Failed to save voice note");
    } finally {
      setSaving(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTranscript(text);
    setSaved(false);
    // Clear sensitivity results when transcript is manually edited
    setSensitivity({ status: "idle" });
    onTranscriptChange(text, segments);
  };

  const clearAll = () => {
    setFile(null);
    setTranscript("");
    setSegments([]);
    setError("");
    setSaved(false);
    setSensitivity({ status: "idle" });
    onTranscriptChange("", []);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {/* File picker row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition focus-within:ring-2 focus-within:ring-sky-500">
          <MicrophoneIcon className="h-4 w-4 text-slate-500 flex-shrink-0" aria-hidden />
          {file ? file.name : "Choose audio file"}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={disabled || transcribing}
            className="sr-only"
          />
        </label>

        {file && !transcribing && (
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={disabled}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition"
          >
            Transcribe
          </button>
        )}

        {transcribing && (
          <span className="text-sm text-slate-500 animate-pulse">Transcribing…</span>
        )}

        {(file || transcript) && !transcribing && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-slate-400 underline hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Supported: mp3, m4a, wav, ogg, opus, webm · Max {MAX_MB} MB
      </p>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* Transcript textarea */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <DocumentTextIcon className="h-3.5 w-3.5" aria-hidden />
          Transcript
          <span className="font-normal text-slate-400 normal-case tracking-normal">(auto-filled or type manually)</span>
        </label>
        <textarea
          value={transcript}
          onChange={handleTextChange}
          disabled={disabled || transcribing}
          rows={5}
          placeholder="Upload an audio file and click Transcribe, or type/paste a PM note here…"
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:opacity-60"
        />
        <div className="flex items-center justify-between">
          {transcript ? (
            <p className="text-[11px] text-slate-400">
              {transcript.split(/\s+/).filter(Boolean).length} words
            </p>
          ) : <span />}
          {transcript && (
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
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition"
                >
                  {saving ? "Saving…" : "Save voice note"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sensitivity analysis panel */}
      {sensitivity.status === "checking" && (
        <p className="text-xs text-slate-500 animate-pulse">Checking for sensitive content…</p>
      )}

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
            audioFile={file}
          />
        </div>
      )}
    </div>
  );
}
