"use client";

import { useState, useCallback } from "react";
import { decodeAudioFile, cutSegments, encodeAudioBuffer } from "@/lib/audio/silenceSegments";
import type { FlaggedSegment } from "@/lib/sensitivity/types";
import type { TimeRange } from "@/lib/audio/silenceSegments";
import { invertRanges } from "@/lib/video/invertRanges";

// ─── Design tokens ────────────────────────────────────────────────────────────

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<FlaggedSegment["category"], string> = {
  safety_concern:   "Safety",
  schedule_issue:   "Schedule",
  cost_overrun:     "Cost",
  internal_dispute: "Internal",
  pm_venting:       "Tone",
  client_complaint: "Client",
  quality_issue:    "Quality",
};

const CATEGORY_COLORS: Record<FlaggedSegment["category"], string> = {
  safety_concern:   "bg-rose-100 text-rose-800",
  schedule_issue:   "bg-amber-100 text-amber-800",
  cost_overrun:     "bg-orange-100 text-orange-800",
  internal_dispute: "bg-purple-100 text-purple-800",
  pm_venting:       "bg-slate-100 text-slate-700",
  client_complaint: "bg-sky-100 text-sky-800",
  quality_issue:    "bg-yellow-100 text-yellow-800",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SensitivityPanelProps {
  flaggedSegments: FlaggedSegment[];
  /** Audio file for client-side audio export */
  audioFile?: File | null;
  /** Video file + project id for server-side video export */
  videoFile?: File | null;
  projectId?: string;
  /** Total duration of the recording in seconds — required for video export */
  videoDuration?: number;
  mediaType?: "audio" | "video";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SensitivityPanel({
  flaggedSegments,
  audioFile,
  videoFile,
  projectId,
  videoDuration,
  mediaType = "audio",
}: SensitivityPanelProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(flaggedSegments.map((s) => s.segmentId))
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const selectedCount = checked.size;
  const allChecked = checked.size === flaggedSegments.length;
  const noneChecked = checked.size === 0;

  const toggleSegment = useCallback((id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setChecked(
      allChecked
        ? new Set()
        : new Set(flaggedSegments.map((s) => s.segmentId))
    );
  }, [allChecked, flaggedSegments]);

  const handleAudioExport = useCallback(async () => {
    if (!audioFile || noneChecked) return;

    const audioBuffer = await decodeAudioFile(audioFile);
    const totalDuration = audioBuffer.duration;

    const removeRanges: TimeRange[] = flaggedSegments
      .filter((s) => checked.has(s.segmentId))
      .map(({ start, end }) => ({ start, end }));

    const keepRanges = invertRanges(totalDuration, removeRanges);
    const cut = cutSegments(audioBuffer, keepRanges);
    const { blob, ext } = await encodeAudioBuffer(cut);

    const baseName = audioFile.name.replace(/\.[^/.]+$/, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_clean.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioFile, flaggedSegments, checked, noneChecked]);

  const handleVideoExport = useCallback(async () => {
    if (!videoFile || !projectId || noneChecked) return;
    if (videoDuration === undefined) {
      throw new Error("Video duration not loaded yet. Wait for the preview to finish loading, then try again.");
    }

    const removeRanges: TimeRange[] = flaggedSegments
      .filter((s) => checked.has(s.segmentId))
      .map(({ start, end }) => ({ start, end }));

    const keepRanges = invertRanges(videoDuration, removeRanges);

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("ranges", JSON.stringify(keepRanges));

    const res = await fetch(`/api/projects/${projectId}/cut-video`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? "Video processing failed");
    }

    const blob = await res.blob();
    const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_clean.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }, [videoFile, projectId, flaggedSegments, checked, noneChecked, videoDuration]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError("");
    try {
      if (mediaType === "video") {
        await handleVideoExport();
      } else {
        await handleAudioExport();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setExportError(
        msg.toLowerCase().includes("decode") || msg.toLowerCase().includes("not supported")
          ? "Audio export is not supported for this file format in your browser. Use the timestamps above to manually trim the recording."
          : msg
      );
    } finally {
      setExporting(false);
    }
  }, [mediaType, handleAudioExport, handleVideoExport]);

  const hasSourceFile = mediaType === "video" ? !!videoFile : !!audioFile;
  const videoDurationMissing = mediaType === "video" && videoDuration === undefined && !!videoFile;

  if (flaggedSegments.length === 0) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
      >
        <p className="text-sm font-semibold text-emerald-800">No sensitive content detected</p>
        <p className="mt-0.5 text-xs text-emerald-700">
          This recording looks safe to share with the client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header banner */}
      <div
        role="alert"
        className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
      >
        <p className="text-sm font-semibold text-amber-900">
          {flaggedSegments.length} segment{flaggedSegments.length !== 1 ? "s" : ""} flagged for review
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          Checked segments will be cut from the exported {mediaType}. Uncheck any you are comfortable leaving in.
        </p>
      </div>

      {/* Select all toggle */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          {selectedCount} of {flaggedSegments.length} selected for removal
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className={`text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900 ${FOCUS_RING}`}
        >
          {allChecked ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Flagged segment list */}
      <ul className="space-y-2" aria-label="Flagged segments">
        {flaggedSegments.map((seg) => {
          const isChecked = checked.has(seg.segmentId);
          const checkboxId = `seg-${seg.segmentId}`;

          return (
            <li
              key={seg.segmentId}
              className={[
                "rounded-2xl border p-3 transition",
                isChecked
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSegment(seg.segmentId)}
                  className={[
                    "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900",
                    FOCUS_RING,
                  ].join(" ")}
                  aria-label={`Remove segment: ${seg.text}`}
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[seg.category]}`}
                    >
                      {CATEGORY_LABELS[seg.category]}
                    </span>
                  </div>

                  <label
                    htmlFor={checkboxId}
                    className="block cursor-pointer text-sm text-slate-900"
                  >
                    &ldquo;{seg.text}&rdquo;
                  </label>

                  <p className="text-xs text-slate-500">{seg.reason}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Export error */}
      {exportError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-rose-800">Export unavailable</p>
          <p className="mt-0.5 text-xs text-rose-700">{exportError}</p>
        </div>
      )}

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting || noneChecked || !hasSourceFile || videoDurationMissing}
        className={[
          "inline-flex w-full items-center justify-center rounded-full border transition",
          "h-10 px-4 text-sm font-semibold",
          "border-slate-950 bg-slate-950 text-white hover:bg-slate-800 active:bg-slate-900",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS_RING,
        ].join(" ")}
      >
        {exporting
          ? `Processing ${mediaType}…`
          : noneChecked
          ? "No segments selected"
          : !hasSourceFile
          ? `${mediaType === "video" ? "Video" : "Audio"} file unavailable for export`
          : videoDurationMissing
          ? "Waiting for video to load…"
          : `Export with ${selectedCount} segment${selectedCount !== 1 ? "s" : ""} removed`}
      </button>

      {!hasSourceFile && !exportError && (
        <p className="text-center text-xs text-slate-400">
          Re-upload the original file to enable export.
        </p>
      )}
    </div>
  );
}
