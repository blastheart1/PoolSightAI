"use client";

import { useState, useRef } from "react";
import { MicrophoneIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

const ACCEPTED_TYPES = ".mp3,.m4a,.wav,.ogg,.opus,.webm,.flac,.mpeg,.mpga,.mp4";
const MAX_MB = 25;

interface AudioTranscriberProps {
  onTranscriptChange: (transcript: string) => void;
  disabled?: boolean;
}

export function AudioTranscriber({ onTranscriptChange, disabled }: AudioTranscriberProps) {
  const [file, setFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
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
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setTranscribing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({})) as { transcript?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Transcription failed");
      }
      const text = data.transcript ?? "";
      setTranscript(text);
      onTranscriptChange(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
    onTranscriptChange(e.target.value);
  };

  const clearAll = () => {
    setFile(null);
    setTranscript("");
    setError("");
    onTranscriptChange("");
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

      {/* Transcript textarea — shown after transcription OR for manual entry */}
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
        {transcript && (
          <p className="text-right text-[11px] text-slate-400">
            {transcript.split(/\s+/).filter(Boolean).length} words
          </p>
        )}
      </div>
    </div>
  );
}
