"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { FlaggedSegment } from "@/lib/sensitivity/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportSummary {
  id: string;
  mediaType: string;
  fileName: string;
  flagCount: number;
  wordCount: number;
  createdAt: string;
}

interface ReportDetail extends ReportSummary {
  transcript: string;
  flags: FlaggedSegment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

// ─── Report detail modal ──────────────────────────────────────────────────────

function ReportDetailModal({
  projectId,
  reportId,
  onClose,
}: {
  projectId: string;
  reportId: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/sensitivity-reports/${reportId}`)
      .then((r) => r.json())
      .then((d: ReportDetail) => setReport(d))
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  }, [projectId, reportId]);

  return (
    <Dialog open onClose={onClose} className="relative z-50" aria-labelledby="sr-detail-title">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle id="sr-detail-title" as="h2" className="text-base font-semibold text-slate-900">
              {report ? report.fileName : "Sensitivity Report"}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 ${FOCUS_RING}`}
            >
              <XMarkIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}

            {report && (
              <>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{formatDate(report.createdAt)}</span>
                  <span>{report.wordCount} words</span>
                  {report.flagCount > 0 ? (
                    <span className="font-semibold text-amber-700">{report.flagCount} flag{report.flagCount !== 1 ? "s" : ""}</span>
                  ) : (
                    <span className="font-semibold text-emerald-700">No flags</span>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Transcript</p>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed">
                    {report.transcript}
                  </div>
                </div>

                {report.flags.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Flagged segments</p>
                    <ul className="space-y-2">
                      {report.flags.map((seg) => (
                        <li key={seg.segmentId} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                              {formatTime(seg.start)} – {formatTime(seg.end)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[seg.category]}`}>
                              {CATEGORY_LABELS[seg.category]}
                            </span>
                          </div>
                          <p className="text-sm text-slate-900">&ldquo;{seg.text}&rdquo;</p>
                          <p className="mt-0.5 text-xs text-slate-500">{seg.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.flags.length === 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-800">No sensitive content detected</p>
                    <p className="mt-0.5 text-xs text-emerald-700">This recording was safe to share with the client.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SensitivityReportList({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<"audio" | "video">("audio");
  const [audioReports, setAudioReports] = useState<ReportSummary[]>([]);
  const [videoReports, setVideoReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [audioRes, videoRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/sensitivity-reports?type=audio`),
        fetch(`/api/projects/${projectId}/sensitivity-reports?type=video`),
      ]);
      const [audio, video] = await Promise.all([
        audioRes.json() as Promise<ReportSummary[]>,
        videoRes.json() as Promise<ReportSummary[]>,
      ]);
      setAudioReports(Array.isArray(audio) ? audio : []);
      setVideoReports(Array.isArray(video) ? video : []);
    } catch {
      // leave lists empty on error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const totalCount = audioReports.length + videoReports.length;
  if (!loading && totalCount === 0) return null;

  const activeReports = tab === "audio" ? audioReports : videoReports;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-slate-900">Sensitivity Reports</h2>
      <p className="mt-1 text-xs text-slate-500">Saved sensitivity checks from audio and video recordings.</p>

      {/* Tabs */}
      <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
        {(["audio", "video"] as const).map((t) => {
          const count = t === "audio" ? audioReports.length : videoReports.length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition",
                tab === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
                FOCUS_RING,
              ].join(" ")}
            >
              {t === "audio" ? "Audio" : "Video"}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === t ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-3 text-sm text-slate-500">Loading…</p>}

      {!loading && activeReports.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No {tab} sensitivity reports saved yet.</p>
      )}

      {!loading && activeReports.length > 0 && (
        <ul className="mt-3 space-y-2">
          {activeReports.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenReportId(r.id)}
                className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100 ${FOCUS_RING}`}
                aria-label={`Open sensitivity report: ${r.fileName}`}
              >
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate text-sm font-medium text-slate-900">{r.fileName}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">{formatDate(r.createdAt)}</span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-500">{r.wordCount} words</span>
                    {r.flagCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {r.flagCount} flag{r.flagCount !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Clean
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">View</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openReportId && (
        <ReportDetailModal
          projectId={projectId}
          reportId={openReportId}
          onClose={() => setOpenReportId(null)}
        />
      )}
    </section>
  );
}
