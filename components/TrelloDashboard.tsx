"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PhotoIcon,
  CalendarDaysIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";

type Board = { id: string; name: string; url: string };
type Attachment = { id: string; name: string; url: string; mimeType?: string; date: string };
type Card = {
  id: string;
  name: string;
  shortUrl: string;
  dateLastActivity: string;
  attachments: Attachment[];
};
type TrelloList = { id: string; name: string; cards: Card[] };
type DailyImage = {
  cardId: string;
  cardName: string;
  attachmentId: string;
  name: string;
  url: string;
  mimeType?: string;
  date: string;
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

function isSeparatorListName(name: string): boolean {
  const s = (name || "").trim();
  if (!s) return false;
  // A separator list is an arrow-like marker with at least 2 adjacent dashes
  // attached to either '<' or '>' (e.g. "<-----", "--->", "----->").
  return /<-{2,}/.test(s) || /-{2,}>/.test(s);
}

function isSeparatorEndName(name: string): boolean {
  const s = (name || "").trim();
  if (!s) return false;
  // The "closing" sandwich list is usually the left-arrow form like "<----- CITY".
  return /^<-{2,}/.test(s);
}

function formatSeparatorTitle(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  // Strip leading "<----" or trailing "---->" decorations and normalize whitespace.
  const stripped = raw
    .replace(/^\s*<-{2,}\s*/g, "")
    .replace(/\s*-{2,}>\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || raw;
}

function statusPillClass(status: string): string {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "advance") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (status === "verify") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
}

function DailyReportResult({ result }: { result: AnalysisResultShape }) {
  const rawSections = Array.isArray(result.sections) ? result.sections : [];
  const filteredSections = rawSections.filter((s) => Array.isArray(s.rows) && s.rows.length > 0);
  const keyActions = Array.isArray(result.key_actions) ? result.key_actions : [];
  const isDegraded = result.meta && result.meta.ok === false;

  return (
    <div className="mt-4 space-y-5">
      {isDegraded && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <p className="font-medium">Low confidence — analysis could not be fully completed.</p>
          <p className="mt-1 text-amber-700">Showing fallback recommendations. You can try running the report again.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Overall progress</h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {result.overall_progress != null ? `${result.overall_progress}%` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Confidence: {result.confidence ?? "unknown"}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sections</h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">{filteredSections.length}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Key actions</h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">{keyActions.length}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">As of</h3>
          <p className="mt-1 text-sm font-semibold text-slate-900">{result.as_of_date ?? "—"}</p>
        </article>
      </div>

      {result.summary && result.summary.trim() && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">AI image analysis summary</h3>
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{result.summary.trim()}</p>
          {result.image_coverage_note && result.image_coverage_note.trim() ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Image coverage</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{result.image_coverage_note.trim()}</p>
            </div>
          ) : null}
          {result.rendering_relation_note && result.rendering_relation_note.trim() ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rendering alignment</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{result.rendering_relation_note.trim()}</p>
            </div>
          ) : null}
        </section>
      )}

      {filteredSections.length > 0 && (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-300 bg-slate-200 px-4 py-2.5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{section.title}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {["Line Item", "Current %", "Suggested %", "Status", "Notes"].map((h) => (
                        <th
                          key={h}
                          className="border-b border-slate-300 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, idx) => (
                      <tr key={`${row.line_item}-${idx}`} className="odd:bg-white even:bg-slate-100">
                        <td className="px-3 py-2.5 font-medium text-slate-900">{row.line_item}</td>
                        <td className="px-3 py-2.5 text-slate-800">{row.current_percent}</td>
                        <td className="px-3 py-2.5 text-slate-800">
                          <div className="text-slate-800">
                            {row.suggested_percent}
                            {row.suggested_percent_range && row.suggested_percent_range !== row.suggested_percent ? (
                              <span className="ml-1 text-xs text-slate-500">({row.suggested_percent_range})</span>
                            ) : null}
                            {row.photo_supported ? <span className="ml-2 text-xs text-slate-500">[{row.photo_supported}]</span> : null}
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
          <h3 className="text-sm font-semibold text-slate-900">Key action items</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
            {keyActions.map((ka, idx) => (
              <li key={`${ka.label}-${idx}`} className="flex gap-2">
                <span className="mt-[3px] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                <span>
                  <span className="font-semibold text-slate-900">{ka.label}</span>
                  {ka.action && ` — ${ka.action}`}
                  {ka.priority && <span className="ml-1 text-slate-500">({ka.priority})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function toYmd(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function TrelloDashboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateYmd, setDateYmd] = useState(() => toYmd(new Date()));
  const [dailyImages, setDailyImages] = useState<DailyImage[]>([]);
  const [dailyImagesLoading, setDailyImagesLoading] = useState(false);
  const [reportResult, setReportResult] = useState<AnalysisResultShape | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trello/board");
      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.error || "Trello not configured. Set TRELLO_API_KEY and TRELLO_API_TOKEN in .env.local, then restart the dev server.");
        setBoard(null);
        setLists([]);
        return;
      }
      if (res.status === 404) {
        const data404 = await res.json().catch(() => ({}));
        setError(data404.detail || data404.error || "Board not found. Set TRELLO_BOARD_ID in .env.local to your board id (e.g. vsMJZfDD from the board URL), then restart the dev server.");
        setBoard(null);
        setLists([]);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load Trello board");
        setBoard(null);
        setLists([]);
        return;
      }
      const data = await res.json();
      setBoard(data.board);
      setLists(data.lists ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setBoard(null);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const loadDailyImages = async () => {
    setDailyImagesLoading(true);
    setDailyImages([]);
    try {
      const res = await fetch(`/api/trello/daily-report?date=${encodeURIComponent(dateYmd)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDailyImages([]);
        return;
      }
      const data = await res.json();
      setDailyImages(data.imageAttachments ?? []);
    } catch {
      setDailyImages([]);
    } finally {
      setDailyImagesLoading(false);
    }
  };

  const runDailyReport = async () => {
    setReportLoading(true);
    setReportError("");
    setReportResult(null);
    try {
      const res = await fetch("/api/trello/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateYmd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(data.error ?? data.detail ?? "Report failed");
        return;
      }
      setReportResult(data);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="bg-slate-950 px-6 py-6 text-white sm:px-10">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
                Back to PoolSightAI
              </Link>
              <Link
                href="/projects"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Projects
              </Link>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Trello</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Trello – <span className="text-sky-400">Current Project</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              View cards and image attachments from your Current Project board; run a daily report with AI analysis on images uploaded that day.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-slate-50 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm"
            >
              <p className="font-medium">{error}</p>
              {(error.includes("not configured") || error.includes("TRELLO")) && (
                <p className="mt-2 text-xs text-rose-800">
                  Add TRELLO_API_KEY and TRELLO_API_TOKEN to your .env file. Get them from the Trello Power-Up admin page (API Key tab, then Token link).
                </p>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading board…</p>
          ) : board && (
            <>
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Board</h2>
                <a
                  href={board.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {board.name}
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                </a>
              </section>

              {lists.length > 0 && (
                <section aria-labelledby="lists-heading">
                  <h2 id="lists-heading" className="text-lg font-semibold text-slate-900">Lists – customer overview</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Each list has an overview page with daily photos, documents &amp; renderings, and AI analysis (read-only; nothing is written to Trello).
                  </p>
                  <ul className="mt-4 space-y-3">
                    {lists.map((list) => (
                      <li key={list.id}>
                        {isSeparatorListName(list.name) ? (
                          isSeparatorEndName(list.name) ? (
                            <div className="py-5" aria-hidden />
                          ) : (
                            <div className="px-1 py-2">
                              <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
                                {formatSeparatorTitle(list.name)}
                              </h3>
                            </div>
                          )
                        ) : (
                          <Link
                            href={`/trello/lists/${list.id}`}
                            className="flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            <span className="font-semibold text-slate-900">{list.name}</span>
                            <span className="mt-1 text-xs text-slate-500">
                              {list.cards.length} card{list.cards.length !== 1 ? "s" : ""}
                            </span>
                            <span className="mt-2 text-xs font-medium text-sky-600">View overview →</span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Daily report</h2>
                <p className="mt-1 text-sm text-slate-600">Load images uploaded on a specific day, then run AI analysis on them.</p>

                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                    <input
                      type="date"
                      value={dateYmd}
                      onChange={(e) => setDateYmd(e.target.value)}
                      className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={loadDailyImages}
                    disabled={dailyImagesLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <CalendarDaysIcon className="h-4 w-4" aria-hidden />
                    {dailyImagesLoading ? "Loading…" : "Load images for this day"}
                  </button>

                  <button
                    type="button"
                    onClick={runDailyReport}
                    disabled={reportLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  >
                    <PlayIcon className="h-4 w-4" aria-hidden />
                    {reportLoading ? "Running…" : "Run daily report"}
                  </button>
                </div>

                {dailyImages.length > 0 && <p className="mt-3 text-sm text-slate-600">{dailyImages.length} image(s) for {dateYmd}.</p>}

                {reportError && (
                  <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {reportError}
                  </div>
                )}

                {reportResult && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <DailyReportResult result={reportResult} />
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

