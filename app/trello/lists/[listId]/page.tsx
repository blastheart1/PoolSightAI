"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PhotoIcon,
  DocumentTextIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

type List = { id: string; name: string };
type Attachment = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  date: string;
  isImage: boolean;
};
type Card = {
  id: string;
  name: string;
  desc: string;
  shortUrl: string;
  url: string;
  dateLastActivity: string;
  attachments: Attachment[];
};

type RecoRow = {
  line_item: string;
  current_percent: string;
  suggested_percent: string;
  suggested_percent_range?: string;
  photo_supported?: "yes" | "no" | "partial" | "unclear";
  status: string;
  notes: string;
};
type RecoSection = { id: string; title: string; rows: RecoRow[] };
type KeyAction = { priority?: string; label: string; action?: string };
type AnalysisResultShape = {
  project?: string;
  as_of_date?: string;
  overall_progress?: number | null;
  confidence?: string;
  image_coverage_note?: string;
  rendering_relation_note?: string;
  summary?: string;
  sections?: RecoSection[];
  key_actions?: KeyAction[];
  meta?: { ok?: boolean; errorCode?: string };
};

function statusPillClass(status: string): string {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "advance") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (status === "verify") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
}

function isDailyPhotosCard(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("daily") && (n.includes("photo") || n.includes("photos"));
}

function isDocumentsCard(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("document") ||
    n.includes("rendering") ||
    n.includes("renderings") ||
    (n.includes("construction") && (n.includes("final") || n.includes("doc")))
  );
}

/** Sort attachments by date descending (latest first). Empty date last. */
function sortByDateDesc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = (a.date || "").trim();
    const db = (b.date || "").trim();
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da > db ? -1 : da < db ? 1 : 0;
  });
}

type PhotoSortKey = "date_desc" | "date_asc" | "name_asc" | "name_desc";
type EcoMode = "off" | "balanced" | "aggressive";

function sortPhotos(attachments: Attachment[], key: PhotoSortKey): Attachment[] {
  const list = [...attachments];
  switch (key) {
    case "date_desc":
      return list.sort((a, b) => {
        const da = (a.date || "").trim();
        const db = (b.date || "").trim();
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da > db ? -1 : da < db ? 1 : 0;
      });
    case "date_asc":
      return list.sort((a, b) => {
        const da = (a.date || "").trim();
        const db = (b.date || "").trim();
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      });
    case "name_asc":
      return list.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );
    case "name_desc":
      return list.sort((a, b) =>
        (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" })
      );
    default:
      return sortByDateDesc(list);
  }
}

const DAILY_PHOTOS_PAGE_SIZE = 10;

function formatDate(isoOrDate: string): string {
  const s = (isoOrDate || "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AttachmentsTable({
  attachments,
  columns,
  emptyMessage,
  renderRow,
  preSorted = false,
  sortableColumns,
  activeSortKey,
  onToggleColumnSort,
}: {
  attachments: Attachment[];
  columns: string[];
  emptyMessage: string;
  renderRow: (att: Attachment) => React.ReactNode;
  /** When true, attachments are shown in the order given (no internal sort). */
  preSorted?: boolean;
  sortableColumns?: Record<string, { asc: PhotoSortKey; desc: PhotoSortKey }>;
  activeSortKey?: PhotoSortKey;
  onToggleColumnSort?: (column: string) => void;
}) {
  const sorted = preSorted ? attachments : sortByDateDesc(attachments);
  if (sorted.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 ${
                    col === "Use for AI"
                      ? "w-[110px] min-w-[130px] max-w-[130px] whitespace-nowrap text-center"
                      : col === "Name"
                      ? "md:w-[580px] md:min-w-[580px] whitespace-nowrap"
                      : col === "Date"
                        ? "w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap"
                        : ""
                  }`}
                >
                  {sortableColumns && sortableColumns[col] && onToggleColumnSort && activeSortKey ? (
                    <button
                      type="button"
                      onClick={() => onToggleColumnSort(col)}
                      className="group inline-flex w-full cursor-pointer items-center gap-1 text-left hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      aria-label={`Sort by ${col}`}
                    >
                      <span className="truncate">{col}</span>
                      {(() => {
                        const cfg = sortableColumns[col];
                        const isAsc = activeSortKey === cfg.asc;
                        const isDesc = activeSortKey === cfg.desc;

                        return (
                          <span className="inline-flex items-center">
                            <ChevronUpIcon
                              className={`h-4 w-4 ${
                                isAsc ? "text-sky-600" : "text-slate-400 opacity-60"
                              }`}
                              aria-hidden
                            />
                            <ChevronDownIcon
                              className={`h-4 w-4 ${
                                isDesc ? "text-sky-600" : "text-slate-400 opacity-60"
                              } -ml-0.5`}
                              aria-hidden
                            />
                          </span>
                        );
                      })()}
                    </button>
                  ) : (
                    col
                  )}
                </th>
              ))}
              <th className="w-[96px] min-w-[96px] max-w-[96px] whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map((att) => (
              <tr key={att.id} className="bg-white hover:bg-slate-50/50">
                {renderRow(att)}
                <td className="w-[96px] min-w-[96px] max-w-[96px] whitespace-nowrap px-4 py-3 text-right">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex whitespace-nowrap items-center gap-1 font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-label={`Open ${att.name || "attachment"}`}
                  >
                    Open
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalysisResult({ result }: { result: AnalysisResultShape }) {
  const rawSections = Array.isArray(result.sections) ? result.sections : [];
  const filteredSections = rawSections.filter(
    (s) => Array.isArray(s.rows) && s.rows.length > 0
  );
  const keyActions = Array.isArray(result.key_actions) ? result.key_actions : [];
  const isDegraded = result.meta && result.meta.ok === false;

  return (
    <div className="mt-4 space-y-5">
      {isDegraded && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <p className="font-medium">
            {result.meta?.errorCode === "rate_limit"
              ? "Rate limit exceeded"
              : "Low confidence — analysis could not be fully completed."}
          </p>
          <p className="mt-1 text-amber-700">
            Use fewer photos (up to 10) or try again in a minute.
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Overall progress
          </h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {result.overall_progress != null ? `${result.overall_progress}%` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Confidence: {result.confidence ?? "unknown"}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {filteredSections.length}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Key actions
          </h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {keyActions.length}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            As of
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {result.as_of_date ?? "—"}
          </p>
        </article>
      </div>

      {result.summary && result.summary.trim() && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            AI image analysis summary
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {result.summary.trim()}
          </p>
          {result.image_coverage_note && result.image_coverage_note.trim() ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Image coverage
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                {result.image_coverage_note.trim()}
              </p>
            </div>
          ) : null}

          {result.rendering_relation_note && result.rendering_relation_note.trim() ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Rendering alignment
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                {result.rendering_relation_note.trim()}
              </p>
            </div>
          ) : null}
        </section>
      )}

      {filteredSections.length > 0 && (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div
              key={section.id}
              className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
            >
              <div className="border-b border-slate-300 bg-slate-200 px-4 py-2.5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                  {section.title}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {["Line Item", "Current %", "Suggested %", "Status", "Notes"].map(
                        (h) => (
                          <th
                            key={h}
                            className="border-b border-slate-300 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, idx) => (
                      <tr
                        key={`${row.line_item}-${idx}`}
                        className="odd:bg-white even:bg-slate-100"
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.line_item}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">
                          {row.current_percent}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">
                          <div className="text-slate-800">
                            {row.suggested_percent}
                            {row.suggested_percent_range &&
                            row.suggested_percent_range !== row.suggested_percent ? (
                              <span className="ml-1 text-xs text-slate-500">
                                ({row.suggested_percent_range})
                              </span>
                            ) : null}
                            {row.photo_supported ? (
                              <span className="ml-2 text-xs text-slate-500">
                                [{row.photo_supported}]
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex min-w-[74px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(
                              row.status || "hold"
                            )}`}
                          >
                            {row.status === "advance"
                              ? "Advance"
                              : row.status === "hold"
                                ? "Hold"
                                : row.status === "verify"
                                  ? "Verify"
                                  : row.status === "ok"
                                    ? "OK"
                                    : row.status || "Hold"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {keyActions.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Key action items
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
            {keyActions.map((ka, idx) => (
              <li key={`${ka.label}-${idx}`} className="flex gap-2">
                <span
                  className="mt-[3px] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-slate-900">{ka.label}</span>
                  {ka.action && ` — ${ka.action}`}
                  {ka.priority && (
                    <span className="ml-1 text-slate-500">({ka.priority})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ListOverviewPage({
  params,
}: {
  // Some Next.js versions type/hand `params` to client pages as a Promise.
  params: { listId: string } | Promise<{ listId: string }>;
}) {
  const [listId, setListId] = useState<string | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultShape | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());
  const [photoSort, setPhotoSort] = useState<PhotoSortKey>("date_desc");
  const [photoPage, setPhotoPage] = useState(1);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [saveProjectId, setSaveProjectId] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [saveReportError, setSaveReportError] = useState("");
  const [pmUpdate, setPmUpdate] = useState("");
  const ecoMode: EcoMode = "aggressive";
  const [downloadError, setDownloadError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadThrottleHint, setDownloadThrottleHint] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const CREATE_NEW_PROJECT_ID = "__create_new_project__";

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(params as { listId: string })
      .then((p) => {
        if (cancelled) return;
        setListId(p?.listId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setListId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const loadList = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/trello/lists/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load list");
        setList(null);
        setCards([]);
        return;
      }
      const data = await res.json();
      setList(data.list);
      setCards(data.cards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setList(null);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listId) loadList(listId);
  }, [listId, loadList]);

  const dailyPhotosCards = cards.filter((c) => isDailyPhotosCard(c.name));
  const documentsCards = cards.filter((c) => isDocumentsCard(c.name));
  const dailyPhotosAttachments = dailyPhotosCards.length > 0
    ? dailyPhotosCards.flatMap((c) => c.attachments.filter((a) => a.isImage))
    : cards.flatMap((c) => c.attachments.filter((a) => a.isImage));
  const documentsAttachments = documentsCards.length > 0
    ? documentsCards.flatMap((c) => c.attachments)
    : cards.flatMap((c) => c.attachments.filter((a) => !a.isImage));

  const sortedDailyPhotos = useMemo(
    () => sortPhotos(dailyPhotosAttachments, photoSort),
    [dailyPhotosAttachments, photoSort]
  );
  const totalPhotoPages = Math.max(
    1,
    Math.ceil(sortedDailyPhotos.length / DAILY_PHOTOS_PAGE_SIZE)
  );
  const clampedPhotoPage = Math.min(photoPage, totalPhotoPages);
  const paginatedDailyPhotos = useMemo(
    () =>
      sortedDailyPhotos.slice(
        (clampedPhotoPage - 1) * DAILY_PHOTOS_PAGE_SIZE,
        clampedPhotoPage * DAILY_PHOTOS_PAGE_SIZE
      ),
    [sortedDailyPhotos, clampedPhotoPage]
  );

  const runAnalysis = async () => {
    if (!listId) return;
    // Require at least one selected photo (no "use all" when none selected)
    const urlsToUse =
      selectedImageUrls.size > 0
        ? Array.from(selectedImageUrls)
        : dailyPhotosAttachments.map((a) => a.url);
    if (urlsToUse.length === 0) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setSaveReportError("");
    try {
      const res = await fetch("/api/trello/analyze-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId,
          projectName: list?.name,
          ...(pmUpdate.trim() ? { pmUpdate: pmUpdate.trim() } : {}),
          ...(selectedImageUrls.size > 0 ? { imageUrls: urlsToUse } : {}),
          ecoMode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalysisError(data.error ?? data.detail ?? "Analysis failed");
        return;
      }
      setAnalysisResult(data);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const togglePhotoSelection = (url: string) => {
    setSelectedImageUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };
  const selectAllPhotos = () => {
    setSelectedImageUrls(new Set(dailyPhotosAttachments.map((a) => a.url)));
  };
  const clearPhotoSelection = () => setSelectedImageUrls(new Set());
  const selectedCount = selectedImageUrls.size;

  const togglePhotoSortByColumn = (column: string) => {
    setPhotoPage(1);
    setPhotoSort((prev) => {
      if (column === "Date") {
        return prev === "date_desc" ? "date_asc" : "date_desc";
      }
      if (column === "Name") {
        return prev === "name_asc" ? "name_desc" : "name_asc";
      }
      return prev;
    });
  };

  const downloadSelectedPhotos = async () => {
    if (selectedImageUrls.size === 0) return;
    setDownloadError("");
    setDownloadLoading(true);
    setDownloadThrottleHint(selectedImageUrls.size > 1);
    try {
      // Best-effort: browsers may throttle/block multiple downloads.
      const urls = Array.from(selectedImageUrls);
      const byUrl = new Map(dailyPhotosAttachments.map((a) => [a.url, a]));
      for (const url of urls) {
        const att = byUrl.get(url);
        const base =
          (att?.name?.trim() || "image")
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/[^\w\s.-]+/g, "_")
            .trim()
            .slice(0, 80) || "image";
        const date = att?.date ? new Date(att.date) : null;
        const dateStamp =
          date && !Number.isNaN(date.getTime())
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                date.getDate()
              ).padStart(2, "0")}`
            : "";
        const filename = `${base}${dateStamp ? `_${dateStamp}` : ""}.jpg`;
        const href = `/api/trello/proxy-image?url=${encodeURIComponent(url)}&download=1&filename=${encodeURIComponent(
          filename
        )}`;

        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Small delay to reduce browser throttling.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadLoading(false);
      setDownloadThrottleHint(false);
    }
  };

  const onUploadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) =>
      (f.type || "").toLowerCase().startsWith("image/")
    );
    setUploadFiles(picked.slice(0, 10));
    setUploadError("");
  };

  const optimizeUploadImage = (file: File) =>
    new Promise<{ b64: string; mimeType: string }>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxPx = ecoMode === "aggressive" ? 768 : ecoMode === "balanced" ? 1024 : 1568;
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round((height * maxPx) / width);
            width = maxPx;
          } else {
            width = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const minQ = ecoMode === "aggressive" ? 0.25 : ecoMode === "balanced" ? 0.35 : 0.45;
        const startQ = ecoMode === "aggressive" ? 0.55 : ecoMode === "balanced" ? 0.7 : 0.82;
        const maxBytes =
          ecoMode === "aggressive"
            ? 1.2 * 1024 * 1024
            : ecoMode === "balanced"
              ? 2.0 * 1024 * 1024
              : 3.8 * 1024 * 1024;

        const tryQuality = (q: number) => {
          const dataUrl = canvas.toDataURL("image/jpeg", q);
          const b64 = dataUrl.split(",")[1] || "";
          const bytes = (b64.length * 3) / 4;
          if (bytes <= maxBytes || q <= minQ) {
            resolve({ b64, mimeType: "image/jpeg" });
          } else {
            tryQuality(Math.max(q - 0.1, minQ));
          }
        };

        tryQuality(startQ);
      };
      img.onerror = () => reject(new Error("Failed to read image"));
      img.src = url;
    });

  const runUploadAnalysis = async () => {
    if (!uploadFiles.length) return;
    setUploadLoading(true);
    setUploadError("");
    setAnalysisError("");
    setAnalysisResult(null);
    setSaveReportError("");
    try {
      const optimized = await Promise.all(uploadFiles.map((f) => optimizeUploadImage(f)));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: optimized,
          projectName: list?.name,
          ...(pmUpdate.trim() ? { pmUpdate: pmUpdate.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? data.detail ?? "Upload analysis failed");
        return;
      }
      setAnalysisResult(data);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload analysis failed");
    } finally {
      setUploadLoading(false);
    }
  };

  // Load projects when we have a result (for Save as report entry)
  useEffect(() => {
    if (!analysisResult) return;
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => {
        if (cancelled || !Array.isArray(list)) return;
        setProjectsList(list);
        // Default to placeholder \"Select Project\" until user chooses,
        // so we can also surface the \"Create New Project\" option.
        if (!saveProjectId) setSaveProjectId("");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [analysisResult]);

  const saveAsReportEntry = async () => {
    if (!analysisResult || typeof analysisResult !== "object") return;
    if (!saveProjectId) {
      setSaveReportError("Select a project or choose Create New Project.");
      return;
    }
    setSavingReport(true);
    setSaveReportError("");
    try {
      let targetProjectId = saveProjectId;

      if (saveProjectId === CREATE_NEW_PROJECT_ID) {
        const projectName = list?.name?.trim() || "New Project from Trello";
        const createRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            location: {},
            items: [],
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !createData.id) {
          throw new Error(createData.error ?? "Failed to create project");
        }
        targetProjectId = String(createData.id);
        setProjectsList((prev) => [{ id: targetProjectId, name: projectName }, ...prev]);
        setSaveProjectId(targetProjectId);
      }

      const res = await fetch(`/api/projects/${encodeURIComponent(targetProjectId)}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asOfDate:
            (analysisResult as AnalysisResultShape).as_of_date ??
            new Date().toISOString().split("T")[0],
          reconciliationResult: analysisResult,
          images: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save report");
      }
      setAnalysisResult(null);
    } catch (e) {
      setSaveReportError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-slate-950 px-6 py-6 text-white sm:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-4">
            <Link
              href="/trello"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
              Back to Trello
            </Link>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            List overview
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {list ? list.name : (listId ? "Loading…" : "List")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Daily photos, documents & renderings, and AI analysis from this list. Read-only; nothing is written to Trello.
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-slate-50 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm"
            >
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading list…</p>
          ) : list && (
            <>
              <section aria-labelledby="daily-photos-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2
                  id="daily-photos-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-slate-900"
                >
                  <PhotoIcon className="h-5 w-5 text-slate-600" aria-hidden />
                  Daily Photos
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Image attachments from cards in this list. Select which photos to use for AI analysis below.
                </p>
                {dailyPhotosAttachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllPhotos}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Select all
                      </button>
                      <span className="group relative inline-flex">
                        <button
                          type="button"
                          onClick={clearPhotoSelection}
                          disabled={selectedCount === 0}
                          aria-label="Clear selection"
                          className="flex w-10 items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <XMarkIcon className="h-5 w-5" aria-hidden />
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-75 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {selectedCount === 0 ? "No photos selected" : "Clear selection"}
                        </span>
                      </span>
                      <span className="group relative inline-flex">
                        <button
                          type="button"
                          onClick={downloadSelectedPhotos}
                          disabled={selectedCount === 0 || downloadLoading}
                          className="flex w-10 items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-700 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          aria-label={
                            selectedCount > 0
                              ? `Download ${selectedCount} selected photos`
                              : "Select photos to download"
                          }
                        >
                          <span className="sr-only">{downloadLoading ? "Downloading" : "Download selected"}</span>
                          {downloadLoading ? (
                            <svg
                              className="h-5 w-5 animate-spin text-sky-700"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeOpacity="0.25"
                              />
                              <path
                                d="M22 12a10 10 0 0 0-10-10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : (
                            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden />
                          )}
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-75 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {downloadLoading
                            ? "Downloading selected photos..."
                            : selectedCount > 0
                              ? `Download ${selectedCount} selected`
                              : "Select photos to download"}
                        </span>
                      </span>
                      {selectedCount > 0 && (
                        <span className="text-xs text-slate-500">
                          {selectedCount} selected
                        </span>
                      )}
                    </div>
                    {downloadThrottleHint && (
                      <p className="text-xs text-slate-500">
                        Some browsers throttle multiple downloads. If you don&apos;t get all files, try selecting fewer photos and download again.
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <AttachmentsTable
                    attachments={paginatedDailyPhotos}
                    columns={["Use for AI", "Name", "Date"]}
                    emptyMessage="No image attachments in this list."
                    preSorted
                    sortableColumns={{
                      Name: { asc: "name_asc", desc: "name_desc" },
                      Date: { asc: "date_asc", desc: "date_desc" },
                    }}
                    activeSortKey={photoSort}
                    onToggleColumnSort={togglePhotoSortByColumn}
                    renderRow={(att) => (
                      <>
                        <td className="w-[130px] min-w-[130px] max-w-[130px] px-4 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedImageUrls.has(att.url)}
                            onChange={() => togglePhotoSelection(att.url)}
                            aria-label={`Use ${att.name || "image"} for AI analysis`}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[220px] sm:max-w-[340px] md:max-w-none md:w-[580px] md:min-w-[580px] md:whitespace-normal md:overflow-visible md:text-clip">
                          {att.name || "Image"}
                        </td>
                        <td className="w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">
                          {formatDate(att.date)}
                        </td>
                      </>
                    )}
                  />
                </div>
                {downloadError && (
                  <div
                    role="alert"
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                  >
                    {downloadError}
                  </div>
                )}
                {dailyPhotosAttachments.length > DAILY_PHOTOS_PAGE_SIZE && (
                  <nav
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"
                    aria-label="Daily photos pagination"
                  >
                    <span className="text-sm text-slate-600">
                      Page {clampedPhotoPage} of {totalPhotoPages}
                      <span className="ml-1 text-slate-500">
                        ({sortedDailyPhotos.length} photos)
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPhotoPage((p) => Math.max(1, p - 1))}
                        disabled={clampedPhotoPage <= 1}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        aria-label="Previous page"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoPage((p) => Math.min(totalPhotoPages, p + 1))
                        }
                        disabled={clampedPhotoPage >= totalPhotoPages}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        aria-label="Next page"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
                )}
              </section>

              <section aria-labelledby="documents-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2
                  id="documents-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-slate-900"
                >
                  <DocumentTextIcon className="h-5 w-5 text-slate-600" aria-hidden />
                  Documents & renderings
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Attachments from cards like “FINAL CONSTRUCTION DOCUMENTS AND RENDERINGS”. Sorted by latest upload.
                </p>
                <div className="mt-3">
                  <AttachmentsTable
                    attachments={documentsAttachments}
                    columns={["Name", "Date"]}
                    emptyMessage="No document attachments in this list."
                    renderRow={(att) => (
                      <>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {att.name || "Attachment"}
                        </td>
                        <td className="w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">
                          {formatDate(att.date)}
                        </td>
                      </>
                    )}
                  />
                </div>
              </section>

              <section
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                aria-labelledby="ai-analysis-heading"
              >
                <h2
                  id="ai-analysis-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-slate-900"
                >
                  <PlayIcon className="h-5 w-5 text-slate-600" aria-hidden />
                  AI analysis
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Select at least one photo in the Daily Photos table above, then run billing reconciliation (up to 10 photos). Read-only; nothing is written to Trello.
                </p>
                <label
                  htmlFor="trello-pm-update"
                  className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Helper context (optional)
                </label>
                <textarea
                  id="trello-pm-update"
                  value={pmUpdate}
                  onChange={(e) => setPmUpdate(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. Gunite cure complete, tile scheduled next week"
                  aria-describedby="trello-pm-update-desc"
                />
                <p id="trello-pm-update-desc" className="mt-1 text-xs text-slate-500">
                  Extra context for the AI (progress notes, schedule, scope) to improve the analysis.
                </p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Upload & analyze (optional)</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Upload images from your computer. They will be compressed client-side (same approach as the demo uploader) before running analysis.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-500">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onUploadFilesChange}
                        className="sr-only"
                        aria-label="Upload images for analysis"
                      />
                      Choose images
                    </label>
                    <button
                      type="button"
                      onClick={runUploadAnalysis}
                      disabled={uploadLoading || uploadFiles.length === 0}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                    >
                      {uploadLoading
                        ? "Uploading…"
                        : uploadFiles.length > 0
                          ? `Analyze uploads (${uploadFiles.length})`
                          : "Analyze uploads"}
                    </button>
                    {uploadFiles.length > 0 && (
                      <span className="text-xs text-slate-500">{uploadFiles.length} queued</span>
                    )}
                  </div>
                  {uploadError && (
                    <div
                      role="alert"
                      className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                    >
                      {uploadError}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={runAnalysis}
                    disabled={
                      analysisLoading ||
                      dailyPhotosAttachments.length === 0 ||
                      selectedImageUrls.size === 0
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    aria-label={
                      analysisLoading
                        ? "Running analysis"
                        : selectedCount > 0
                          ? `Run AI analysis with ${selectedCount} selected photos`
                          : "Select at least one photo to run analysis"
                    }
                  >
                    <PlayIcon className="h-4 w-4" aria-hidden />
                    {analysisLoading
                      ? "Running…"
                      : selectedCount > 0
                        ? `Run AI analysis (${selectedCount} selected)`
                        : "Run AI analysis"}
                  </button>
                  {dailyPhotosAttachments.length === 0 && (
                    <p className="text-xs text-slate-500">
                      Add image attachments to cards in this list to enable analysis.
                    </p>
                  )}
                  {dailyPhotosAttachments.length > 0 && selectedImageUrls.size === 0 && (
                    <p className="text-xs text-slate-500">
                      Select at least one photo above to run analysis.
                    </p>
                  )}
                </div>
                {analysisError && (
                  <div
                    role="alert"
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                  >
                    {analysisError}
                  </div>
                )}
                {analysisResult && (
                  <div className="mt-6 border-t border-slate-200 pt-6 space-y-4">
                    <AnalysisResult result={analysisResult} />
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Save as report entry
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        Save this analysis to a project so it appears under Report entries on the project page.
                      </p>
                      {projectsList.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <span>Project:</span>
                            <select
                              value={saveProjectId}
                              onChange={(e) => setSaveProjectId(e.target.value)}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              aria-label="Choose project to save report to"
                            >
                              <option value="">
                                Select Project
                              </option>
                              <option value={CREATE_NEW_PROJECT_ID}>
                                Create New Project
                              </option>
                              {projectsList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={saveAsReportEntry}
                            disabled={savingReport}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          >
                            {savingReport ? "Saving…" : "Save entry"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          No projects yet. Create a project under{" "}
                          <Link
                            href="/projects"
                            className="font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            Projects
                          </Link>{" "}
                          to save report entries.
                        </p>
                      )}
                      {saveReportError && (
                        <p className="mt-2 text-sm text-rose-600" role="alert">
                          {saveReportError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
