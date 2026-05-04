"use client";

import { useState, useCallback } from "react";
import { decodeAudioFile, cutSegments, encodeAudioBuffer } from "@/lib/audio/silenceSegments";
import type { FlaggedSegment } from "@/lib/sensitivity/types";
import type { TimeRange } from "@/lib/audio/silenceSegments";
import { invertRanges } from "@/lib/video/invertRanges";
import { cutVideoClientSide } from "@/lib/video/cutVideoClient";

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

/**
 * Merges flagged segments that are adjacent or overlapping into single items.
 * Keeps the category/reason of the first segment in each merged group.
 */
function mergeAdjacentSegments(segments: FlaggedSegment[]): FlaggedSegment[] {
  if (segments.length === 0) return segments;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: FlaggedSegment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= last.end) {
      merged[merged.length - 1] = {
        ...last,
        end: Math.max(last.end, curr.end),
        text: last.text + " " + curr.text,
      };
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SensitivityPanelProps {
  flaggedSegments: FlaggedSegment[];
  audioFile?: File | null;
  videoFile?: File | null;
  projectId?: string;
  videoDuration?: number;
  mediaType?: "audio" | "video";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SensitivityPanel({
  flaggedSegments,
  audioFile,
  videoFile,
  projectId: _projectId,
  videoDuration,
  mediaType = "audio",
}: SensitivityPanelProps) {
  // Merge adjacent/overlapping segments so contiguous flags appear as one item
  const displaySegments = mergeAdjacentSegments(flaggedSegments);

  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(displaySegments.map((s) => s.segmentId))
  );
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");

  const selectedCount = checked.size;
  const allChecked = checked.size === displaySegments.length;
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
        : new Set(displaySegments.map((s) => s.segmentId))
    );
  }, [allChecked, displaySegments]);

  const handleAudioExport = useCallback(async () => {
    if (!audioFile || noneChecked) return;

    const audioBuffer = await decodeAudioFile(audioFile);
    const totalDuration = audioBuffer.duration;

    const removeRanges: TimeRange[] = displaySegments
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
  }, [audioFile, displaySegments, checked, noneChecked]);

  const handleVideoExport = useCallback(async () => {
    if (!videoFile || noneChecked) return;
    if (videoDuration === undefined) {
      throw new Error("Video duration not loaded yet. Wait for the preview to finish loading, then try again.");
    }

    const removeRanges: TimeRange[] = displaySegments
      .filter((s) => checked.has(s.segmentId))
      .map(({ start, end }) => ({ start, end }));

    const keepRanges = invertRanges(videoDuration, removeRanges);

    // Client-side export — no server upload, avoids payload limits
    setExportProgress(0);
    const blob = await cutVideoClientSide(videoFile, keepRanges, setExportProgress);
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_clean.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [videoFile, displaySegments, checked, noneChecked, videoDuration]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError("");
    try {
      if (mediaType === "video") {
        await handleVideoExport();
      } else {
        await handleAudioExport();
      }
    setExportProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setExportError(
        msg.toLowerCase().includes("decode") || msg.toLowerCase().includes("not supported")
          ? "Audio export is not supported for this file format in your browser. Use the timestamps above to manually trim the recording."
          : msg
      );
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [mediaType, handleAudioExport, handleVideoExport]);

  const hasSourceFile = mediaType === "video" ? !!videoFile : !!audioFile;
  const videoDurationMissing = mediaType === "video" && videoDuration === undefined && !!videoFile;

  if (displaySegments.length === 0) {
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
          {displaySegments.length} segment{displaySegments.length !== 1 ? "s" : ""} flagged for review
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          Checked segments will be cut from the exported {mediaType}. Uncheck any you are comfortable leaving in.
        </p>
      </div>

      {/* Select all toggle */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          {selectedCount} of {displaySegments.length} selected for removal
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
        {displaySegments.map((seg) => {
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
          ? mediaType === "video"
            ? `Processing video… ${exportProgress < 100 ? Math.round(exportProgress) + "%" : "Finishing…"}`
            : `Processing ${mediaType}…`
          : noneChecked
          ? "No segments selected"
          : !hasSourceFile
          ? `${mediaType === "video" ? "Video" : "Audio"} file unavailable for export`
          : videoDurationMissing
          ? "Waiting for video to load…"
          : `Export with ${selectedCount} segment${selectedCount !== 1 ? "s" : ""} removed`}
      </button>

      {/* Video export progress bar */}
      {exporting && mediaType === "video" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-200"
            style={{ width: `${exportProgress}%` }}
          />
        </div>
      )}

      {!hasSourceFile && !exportError && (
        <p className="text-center text-xs text-slate-400">
          Re-upload the original file to enable export.
        </p>
      )}
    </div>
  );
}
