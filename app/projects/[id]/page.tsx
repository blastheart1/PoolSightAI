"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowLeftIcon, DocumentTextIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ContractItemsTable } from "../../../components/ContractItemsTable";
import { TrelloListPicker, type TrelloLinkedList } from "../../../components/TrelloListPicker";
import { TrelloImagePicker, type SelectedTrelloImage } from "../../../components/TrelloImagePicker";
import { SuggestionReviewTable, type LineItemResult } from "../../../components/SuggestionReviewTable";
import { AudioTranscriber } from "../../../components/AudioTranscriber";
import type { OrderItem } from "../../../lib/contractTypes";

interface ContractItemRow {
  id: string;
  projectId: string;
  rowIndex: number;
  itemType: string;
  productService: string;
  qty: string | null;
  rate: string | null;
  amount: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  progressOverallPct: string | null;
  completedAmount: string | null;
  previouslyInvoicedPct: string | null;
  previouslyInvoicedAmount: string | null;
  newProgressPct: string | null;
  thisBill: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  orderNo: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  clientName: string | null;
  orderGrandTotal: string | null;
  trelloLinks: string | null;
  parsedAt: string | null;
  createdAt: string;
  contractItems: ContractItemRow[];
  selectedLineItemIds: string[];
  trelloLinkedLists: TrelloLinkedList[];
}

interface AnalysisSummary {
  id: string;
  asOfDate: string;
  createdAt: string;
  confidence: string | null;
  sectionCount?: number;
  overallProgress?: number | null;
  label?: string;
  imageSource?: string;
  trelloListId?: string | null;
  totalSuggestions?: number;
  appliedCount?: number;
}

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

// Hide rows that are placeholders (no billable evidence from images)
const HIDDEN_EVIDENCE_PATTERN =
  /no clear billable evidence|from current image set|no billable evidence/i;

function shouldHideResultRow(row: RecoRow): boolean {
  const notes = (row.notes || "").trim();
  const lineItem = (row.line_item || "").trim();
  return (
    HIDDEN_EVIDENCE_PATTERN.test(notes) || HIDDEN_EVIDENCE_PATTERN.test(lineItem)
  );
}

function statusPillClass(status: string): string {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "advance") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (status === "verify") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
}

function AnalysisResultDisplay({
  result,
  onSaveReport,
  savingReport,
  showSaveButton = true,
}: {
  result: AnalysisResultShape;
  onSaveReport: () => void;
  savingReport: boolean;
  showSaveButton?: boolean;
}) {
  const rawSections = Array.isArray(result.sections) ? result.sections : [];
  // Show all rows the API returns so the user always sees a table,
  // even when the model has low confidence or only fallback rows.
  const filteredSections = rawSections.filter(
    (section) => Array.isArray(section.rows) && section.rows.length > 0
  );

  const allRows = filteredSections.flatMap((s) => s.rows);
  const statusCounts = allRows.reduce(
    (acc, row) => {
      const key = (row.status || "hold") as keyof typeof acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { advance: 0, hold: 0, verify: 0, ok: 0 } as Record<string, number>
  );

  const confidenceLabel =
    result.confidence === "high"
      ? "high confidence"
      : result.confidence === "medium"
        ? "moderate confidence"
        : result.confidence === "low"
          ? "low confidence"
          : "unknown confidence";

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
          <p className="mt-1 text-amber-700">
            Showing fallback recommendations. You can try running the analysis again.
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
          <p className="mt-0.5 text-xs text-slate-500">
            Grouped by scope
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Key actions
          </h3>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {keyActions.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Prioritized items to review
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Project
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {result.project ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            As of {result.as_of_date ?? "—"}
          </p>
        </article>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          AI image analysis summary
        </h3>
        {result.summary && result.summary.trim() ? (
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
            {result.summary.trim()}
          </p>
        ) : null}
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
        <p className="mt-2 text-xs text-slate-600">
          The model analyzed the uploaded photos with {confidenceLabel} and
          generated normalized billing recommendations across{" "}
          {filteredSections.length} sections with {allRows.length} billable line
          items. Observed status: {statusCounts.advance} advance,{" "}
          {statusCounts.verify} verify, {statusCounts.hold} hold.
        </p>
        <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-4">
          {[
            ["Advance", statusCounts.advance, "bg-sky-50 text-sky-700 ring-1 ring-sky-200"],
            ["Hold", statusCounts.hold, "bg-slate-50 text-slate-700 ring-1 ring-slate-200"],
            ["Verify", statusCounts.verify, "bg-amber-50 text-amber-700 ring-1 ring-amber-200"],
            ["OK", statusCounts.ok, "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"],
          ].map(([label, count, style]) => (
            <div key={String(label)} className={`rounded-md px-3 py-2 text-xs ${style}`}>
              <p className="font-semibold">{label}</p>
              <p className="mt-0.5 text-[11px]">{count} items</p>
            </div>
          ))}
        </div>
      </section>

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
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[32%]" />
                  </colgroup>
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
                        <td className="px-3 py-2.5 text-slate-600">
                          {HIDDEN_EVIDENCE_PATTERN.test(row.notes || "") ? (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <span className="text-[11px] italic">
                                No clear billable evidence from current image set
                              </span>
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-600"
                                title={row.notes}
                                aria-label={row.notes}
                              >
                                i
                              </span>
                            </span>
                          ) : (
                            row.notes
                          )}
                        </td>
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
                  aria-hidden="true"
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

      {showSaveButton && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={onSaveReport}
            disabled={savingReport}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {savingReport ? "Saving…" : "Save as report entry"}
          </button>
        </div>
      )}
    </div>
  );
}

function toOrderItem(row: ContractItemRow): OrderItem & { id: string } {
  return {
    id: row.id,
    type: row.itemType as "maincategory" | "subcategory" | "item",
    productService: row.productService,
    qty: row.qty ?? "",
    rate: row.rate ?? "",
    amount: row.amount ?? "",
    mainCategory: row.mainCategory ?? undefined,
    subCategory: row.subCategory ?? undefined,
    progressOverallPct: row.progressOverallPct ?? undefined,
    completedAmount: row.completedAmount ?? undefined,
    previouslyInvoicedPct: row.previouslyInvoicedPct ?? undefined,
    previouslyInvoicedAmount: row.previouslyInvoicedAmount ?? undefined,
    newProgressPct: row.newProgressPct ?? undefined,
    thisBill: row.thisBill ?? undefined,
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSelection, setSavingSelection] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [savedLineItemResults, setSavedLineItemResults] = useState<LineItemResult[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pmUpdate, setPmUpdate] = useState("");
  const [imageSourceTab, setImageSourceTab] = useState<"upload" | "trello" | "voice">("upload");
  const [trelloImages, setTrelloImages] = useState<SelectedTrelloImage[]>([]);
  const [audioTranscript, setAudioTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseFile, setParseFile] = useState<File | null>(null);
  const [parseUrl, setParseUrl] = useState("");
  const [parseError, setParseError] = useState("");
  const [parseResult, setParseResult] = useState<{
    location: Record<string, unknown>;
    items: unknown[];
  } | null>(null);
  const [parsing, setParsing] = useState(false);
  const parseInputRef = useRef<HTMLInputElement>(null);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<AnalysisResultShape | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportLineItemResults, setReportLineItemResults] = useState<LineItemResult[]>([]);
  const [reportAudioTranscript, setReportAudioTranscript] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    orderNo: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    clientName: "",
    orderGrandTotal: "",
    trelloLinks: "",
  });

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load project");
      }
      const data = await res.json();
      setProject(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshTrelloLinks = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}/trello-links`);
      if (res.ok) {
        const data = await res.json();
        setProject((p) => p ? { ...p, trelloLinkedLists: data } : null);
      }
    } catch {
      // ignore — non-critical refresh
    }
  }, [id]);

  const loadAnalyses = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}/analyses`);
      if (res.ok) {
        const data = await res.json();
        setAnalyses(data);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleSelectionChange = async (selectedLineItemIds: string[]) => {
    if (!id || !project) return;
    setSavingSelection(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedLineItemIds }),
      });
      if (!res.ok) throw new Error("Failed to save selection");
      setProject((p) => (p ? { ...p, selectedLineItemIds } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save selection");
    } finally {
      setSavingSelection(false);
    }
  };

  const optimizeImage = (file: File): Promise<{ b64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_PX = 1568;
        let { width, height } = img;
        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) {
            height = Math.round((height * MAX_PX) / width);
            width = MAX_PX;
          } else {
            width = Math.round((width * MAX_PX) / height);
            height = MAX_PX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const b64 = dataUrl.split(",")[1];
        resolve({ b64, mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = url;
    });

  const runAnalysis = async () => {
    if (!id || !project || files.length === 0) {
      setAnalysisError("Upload at least one image.");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);
    try {
      const optimized = await Promise.all(files.map((f) => optimizeImage(f)));
      const selectedItems = project.contractItems.filter((c) =>
        project.selectedLineItemIds.includes(c.id)
      );
      const lineItemLabels = selectedItems.map((c) => c.productService).filter(Boolean);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: optimized,
          pmUpdate: pmUpdate || undefined,
          projectName: project.name,
          lineItemLabels: lineItemLabels.length > 0 ? lineItemLabels : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysisResult(data);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const onParseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseFile(file ?? null);
    setParseError("");
    setParseResult(null);
  };

  const runParseContract = async () => {
    if (!id || (!parseFile && !parseUrl.trim())) {
      setParseError("Provide an .eml file or a contract URL.");
      return;
    }
    setParseError("");
    setParseResult(null);
    setParsing(true);
    try {
      let body: Record<string, unknown> = { returnData: true };
      if (parseFile) {
        const buf = await parseFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = typeof btoa !== "undefined" ? btoa(binary) : "";
        if (!b64) throw new Error("Base64 encoding not available");
        body = { ...body, file: b64 };
      } else if (parseUrl.trim()) {
        body = { ...body, mode: "links", url: parseUrl.trim() };
      }

      const res = await fetch("/api/parse-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details ?? "Parse failed");
      if (!data.success || !data.data) throw new Error("Invalid response");
      const location = data.data.location ?? {};
      const items = data.data.items ?? [];
      setParseResult({ location, items });
      const patchRes = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, items }),
      });
      if (!patchRes.ok) throw new Error("Failed to update project with parsed data");
      await load();
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  };

  const openReport = useCallback(
    async (entryId: string) => {
      if (!id) return;
      setOpenReportId(entryId);
      setReportDetail(null);
      setReportDetailLoading(true);
      try {
        const res = await fetch(`/api/projects/${id}/analyses/${entryId}`);
        if (!res.ok) throw new Error("Failed to load report");
        const data = await res.json();
        const rec = data.reconciliationResult;
        if (rec && typeof rec === "object") {
          setReportDetail(rec as AnalysisResultShape);
        } else {
          setReportDetail(null);
        }
        setReportLineItemResults(Array.isArray(data.lineItemResults) ? data.lineItemResults : []);
        setReportAudioTranscript(typeof data.audioTranscript === "string" && data.audioTranscript ? data.audioTranscript : null);
      } catch {
        setReportDetail(null);
        setReportLineItemResults([]);
      } finally {
        setReportDetailLoading(false);
      }
    },
    [id]
  );

  const closeReport = useCallback(() => {
    setOpenReportId(null);
    setReportDetail(null);
    setReportLineItemResults([]);
    setReportAudioTranscript(null);
  }, []);

  const startEditingDetails = useCallback(() => {
    if (!project) return;
    setEditForm({
      name: project.name ?? "",
      orderNo: project.orderNo ?? "",
      streetAddress: project.streetAddress ?? "",
      city: project.city ?? "",
      state: project.state ?? "",
      zip: project.zip ?? "",
      clientName: project.clientName ?? "",
      orderGrandTotal: project.orderGrandTotal ?? "",
      trelloLinks: project.trelloLinks ?? "",
    });
    setEditingDetails(true);
  }, [project]);

  const cancelEditingDetails = useCallback(() => {
    setEditingDetails(false);
  }, []);

  const saveDetails = useCallback(async () => {
    if (!id) return;
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim() || "Unnamed Project",
          location: {
            orderNo: editForm.orderNo.trim() || null,
            streetAddress: editForm.streetAddress.trim() || null,
            city: editForm.city.trim() || null,
            state: editForm.state.trim() || null,
            zip: editForm.zip.trim() || null,
            clientName: editForm.clientName.trim() || null,
            orderGrandTotal: editForm.orderGrandTotal.trim() || null,
          },
          trelloLinks: editForm.trelloLinks.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save project details");
      await load();
      setEditingDetails(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  }, [id, editForm, load]);

  const saveReport = async () => {
    if (!id || !analysisResult || typeof analysisResult !== "object") return;
    setSavingReport(true);
    try {
      const res = await fetch(`/api/projects/${id}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asOfDate: (analysisResult as { as_of_date?: string }).as_of_date ?? new Date().toISOString().split("T")[0],
          pmUpdate: pmUpdate || undefined,
          reconciliationResult: analysisResult,
          imageSource: "upload",
          images: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to save report");
      const data = await res.json();
      setSavedEntryId(data.id ?? null);
      setSavedLineItemResults([]);
      setAnalysisResult(null);
      await loadAnalyses();
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingReport(false);
    }
  };

  const runTrelloAnalysis = async () => {
    if (!id || !project || trelloImages.length === 0) {
      setAnalysisError("Select at least one image from a Trello list.");
      return;
    }
    const linkedList = project.trelloLinkedLists[0];
    if (!linkedList) {
      setAnalysisError("No Trello list linked to this project.");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setSavedEntryId(null);
    setSavedLineItemResults([]);
    try {
      const res = await fetch(`/api/projects/${id}/trello-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trelloListId: linkedList.listId,
          imageUrls: trelloImages.map((i) => i.url),
          pmUpdate: pmUpdate || undefined,
          ecoMode: "balanced",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysisResult(data.analysisResult);
      setSavedEntryId(data.entryId ?? null);
      await loadAnalyses();
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runAudioAnalysis = async () => {
    if (!id || !audioTranscript.trim()) {
      setAnalysisError("Add a transcript or upload and transcribe an audio file first.");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setSavedEntryId(null);
    setSavedLineItemResults([]);
    try {
      const res = await fetch(`/api/projects/${id}/audio-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioTranscript: audioTranscript.trim(),
          pmUpdate: pmUpdate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysisResult(data.analysisResult);
      setSavedEntryId(data.entryId ?? null);
      await loadAnalyses();
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const projectName = project?.name ?? "Project";
  const trelloLinkedLists = project?.trelloLinkedLists ?? [];
  const trelloUrls = project?.trelloLinks
    ? project.trelloLinks
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`))
    : [];
  const pageHeader = (
    <header className="bg-slate-950 px-6 py-6 text-white sm:px-10">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
            Projects
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            {projectName}
          </h1>
          {project?.orderNo != null || project?.streetAddress != null || project?.city != null ? (
            <p className="mt-2 text-sm text-slate-300">
              {project?.orderNo != null ? `Order ${project.orderNo}` : ""}
              {project?.streetAddress != null ? ` · ${project.streetAddress}` : ""}
              {project?.city != null ? `, ${project.city}` : ""}
            </p>
          ) : null}
          {trelloLinkedLists.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-slate-400">Trello:</span>
              {trelloLinkedLists.map((link) => (
                <span
                  key={link.id}
                  className="inline-flex items-center rounded-full border border-sky-700/50 bg-sky-900/40 px-2.5 py-0.5 text-xs font-medium text-sky-300"
                >
                  {link.listName ?? link.listId}
                  {link.boardName ? ` · ${link.boardName}` : ""}
                </span>
              ))}
            </p>
          )}
          {trelloLinkedLists.length === 0 && trelloUrls.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-slate-400">Trello:</span>
              {trelloUrls.map((href, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 underline hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {trelloUrls.length > 1 ? `Board ${i + 1}` : "Open board"}
                </a>
              ))}
            </p>
          )}
        </div>
        {project != null && (
          <button
            type="button"
            onClick={startEditingDetails}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Edit project details"
          >
            <PencilSquareIcon className="h-5 w-5" aria-hidden />
            Edit
          </button>
        )}
      </div>
    </header>
  );

  if (!id || (loading && !project)) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
        {pageHeader}
        <main className="flex-1 bg-slate-50 px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
        {pageHeader}
        <main className="flex-1 bg-slate-50 px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm">
              {error}
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden />
              Back to projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const items = (project?.contractItems ?? []).map(toOrderItem);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      {pageHeader}

      <main className="flex-1 overflow-auto bg-slate-50 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-5xl space-y-8">
          {savingSelection && (
            <p className="text-sm text-slate-500">Saving selection…</p>
          )}
          {savingDetails && (
            <p className="text-sm text-slate-500">Saving project details…</p>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Parse contract
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload a new .eml contract file or paste a contract link to replace location and line items for this project.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  EML file
                </label>
                <input
                  ref={parseInputRef}
                  type="file"
                  accept=".eml"
                  onChange={onParseFileChange}
                  className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 file:font-medium"
                />
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Or contract URL
                </label>
                <input
                  type="url"
                  value={parseUrl}
                  onChange={(e) => setParseUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <button
                type="button"
                onClick={runParseContract}
                disabled={(!parseFile && !parseUrl.trim()) || parsing}
                className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 sm:mt-0"
              >
                {parsing ? "Parsing…" : "Parse"}
              </button>
            </div>
            {parseResult && (
              <p className="mt-2 text-sm text-emerald-700">
                Parsed and saved: {parseResult.items.length} items
                {parseResult.location?.orderNo != null
                  ? ` · Order ${String(parseResult.location.orderNo)}`
                  : ""}
              </p>
            )}
            {parseError && (
              <p className="mt-2 text-sm text-rose-600">{parseError}</p>
            )}
          </section>

          {items.length > 0 && (
            <section>
              <ContractItemsTable
                items={items}
                selectedIds={project?.selectedLineItemIds ?? []}
                onSelectionChange={handleSelectionChange}
                showCheckboxes
                showVisibilityToggles
              />
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold tracking-wide text-slate-900">AI Analysis</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload site photos, select from a linked Trello list, or transcribe a PM voice note. Select line items above to align the AI report.
            </p>

            {/* Image source tabs — always visible */}
            <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit flex-wrap">
              {(["upload", "trello", "voice"] as const)
                .filter((tab) => tab !== "trello" || trelloLinkedLists.length > 0)
                .map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setImageSourceTab(tab);
                      setAnalysisError("");
                    }}
                    className={[
                      "rounded-md px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                      imageSourceTab === tab
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    {tab === "upload" ? "Upload Photos" : tab === "trello" ? "From Trello" : "Voice Note"}
                  </button>
                ))}
            </div>

            {imageSourceTab === "upload" && (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Site photos
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700"
                />
                {files.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">{files.length} file(s) selected</p>
                )}
              </>
            )}

            {imageSourceTab === "trello" && trelloLinkedLists.length > 0 && (
              <div className="mt-4">
                <TrelloImagePicker
                  linkedLists={trelloLinkedLists}
                  selectedImages={trelloImages}
                  onSelectionChange={setTrelloImages}
                />
              </div>
            )}

            {imageSourceTab === "voice" && (
              <div className="mt-4">
                <AudioTranscriber
                  onTranscriptChange={setAudioTranscript}
                  disabled={analysisLoading}
                />
              </div>
            )}

            {imageSourceTab !== "voice" && (
              <>
                <label htmlFor="pm-update" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  PM update (optional)
                </label>
                <textarea
                  id="pm-update"
                  value={pmUpdate}
                  onChange={(e) => setPmUpdate(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  placeholder="e.g. Gunite cure complete, tile scheduled next week"
                />
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {imageSourceTab === "upload" && (
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={analysisLoading || files.length === 0}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  {analysisLoading ? "Analyzing…" : "Analyze"}
                </button>
              )}
              {imageSourceTab === "trello" && trelloLinkedLists.length > 0 && (
                <button
                  type="button"
                  onClick={runTrelloAnalysis}
                  disabled={analysisLoading || trelloImages.length === 0}
                  className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  {analysisLoading
                    ? "Analyzing…"
                    : `Analyze ${trelloImages.length} image${trelloImages.length !== 1 ? "s" : ""}`}
                </button>
              )}
              {imageSourceTab === "voice" && (
                <button
                  type="button"
                  onClick={runAudioAnalysis}
                  disabled={analysisLoading || !audioTranscript.trim()}
                  className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  {analysisLoading ? "Analyzing…" : "Analyze Voice Note"}
                </button>
              )}
            </div>
            {analysisError && (
              <p className="mt-2 text-sm text-red-600">{analysisError}</p>
            )}
            {analysisResult != null ? (
              <>
                <AnalysisResultDisplay
                  result={analysisResult as AnalysisResultShape}
                  onSaveReport={saveReport}
                  savingReport={savingReport}
                  showSaveButton={savedEntryId == null}
                />
                {savedEntryId != null && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Analysis saved automatically.
                  </p>
                )}
                <SuggestionReviewTable
                  projectId={id!}
                  contractItems={project?.contractItems ?? []}
                  analysisResult={analysisResult as AnalysisResultShape}
                  lineItemResults={savedLineItemResults.length > 0 ? savedLineItemResults : undefined}
                  onApplied={() => { load(); loadAnalyses(); }}
                />
              </>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold tracking-wide text-slate-900">Report entries</h2>
            <p className="mt-1 text-xs text-slate-500">
              Saved analysis runs. Click to open and view the full report.
            </p>
            {analyses.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No saved reports yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {analyses.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => openReport(a.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                      aria-label={`Open report: ${a.label ?? a.asOfDate}`}
                    >
                      <DocumentTextIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="block text-sm font-medium text-slate-900">
                          {a.label ?? `${a.asOfDate} · ${a.confidence ?? "—"}`}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {a.imageSource === "trello" ? (
                            <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                              Trello
                            </span>
                          ) : a.imageSource === "audio" ? (
                            <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                              Voice Note
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Upload
                            </span>
                          )}
                          {a.totalSuggestions != null && a.totalSuggestions > 0 && (
                            <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              {a.appliedCount ?? 0}/{a.totalSuggestions} applied
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">View</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Dialog
            open={editingDetails}
            onClose={cancelEditingDetails}
            className="relative z-50"
            aria-labelledby="edit-details-title"
          >
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="mx-auto max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <DialogTitle id="edit-details-title" as="h2" className="text-base font-semibold text-slate-900">
                    Edit project details
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={cancelEditingDetails}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4 space-y-4">
                  <div>
                    <label htmlFor="edit-name" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Project name</label>
                    <input id="edit-name" type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div>
                    <label htmlFor="edit-orderNo" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">DBX Order ID</label>
                    <input id="edit-orderNo" type="text" value={editForm.orderNo} onChange={(e) => setEditForm((f) => ({ ...f, orderNo: e.target.value }))} placeholder="e.g. 12345" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div>
                    <label htmlFor="edit-streetAddress" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Street address</label>
                    <input id="edit-streetAddress" type="text" value={editForm.streetAddress} onChange={(e) => setEditForm((f) => ({ ...f, streetAddress: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="edit-city" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">City</label>
                      <input id="edit-city" type="text" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                    </div>
                    <div>
                      <label htmlFor="edit-state" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">State</label>
                      <input id="edit-state" type="text" value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                    </div>
                    <div>
                      <label htmlFor="edit-zip" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">ZIP</label>
                      <input id="edit-zip" type="text" value={editForm.zip} onChange={(e) => setEditForm((f) => ({ ...f, zip: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-clientName" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Client name</label>
                    <input id="edit-clientName" type="text" value={editForm.clientName} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div>
                    <label htmlFor="edit-orderGrandTotal" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Order grand total</label>
                    <input id="edit-orderGrandTotal" type="text" value={editForm.orderGrandTotal} onChange={(e) => setEditForm((f) => ({ ...f, orderGrandTotal: e.target.value }))} placeholder="e.g. 43000" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Linked Trello lists
                    </label>
                    <div className="mt-1">
                      <TrelloListPicker
                        projectId={id!}
                        linkedLists={project?.trelloLinkedLists ?? []}
                        onLinksChange={refreshTrelloLinks}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-trelloLinks" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Legacy Trello URLs (deprecated)
                    </label>
                    <textarea id="edit-trelloLinks" value={editForm.trelloLinks} onChange={(e) => setEditForm((f) => ({ ...f, trelloLinks: e.target.value }))} rows={2} placeholder="One URL per line or comma-separated" className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" onClick={saveDetails} disabled={savingDetails} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                      {savingDetails ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={cancelEditingDetails} disabled={savingDetails} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </div>
          </Dialog>

          <Dialog
            open={openReportId != null}
            onClose={closeReport}
            className="relative z-50"
            aria-label="Saved report detail"
          >
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="mx-auto max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <DialogTitle as="h2" className="text-base font-semibold text-slate-900">
                    Saved report
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={closeReport}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4">
                  {reportDetailLoading ? (
                    <p className="text-sm text-slate-500">Loading report…</p>
                  ) : reportDetail ? (
                    <>
                      <AnalysisResultDisplay
                        result={reportDetail}
                        onSaveReport={() => {}}
                        savingReport={false}
                        showSaveButton={false}
                      />
                      {reportAudioTranscript && (
                        <details className="mt-4 rounded-lg border border-violet-200 bg-violet-50">
                          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-violet-700 select-none">
                            PM Voice Note Transcript
                          </summary>
                          <p className="whitespace-pre-wrap px-4 pb-4 pt-2 text-xs text-slate-700 leading-relaxed">
                            {reportAudioTranscript}
                          </p>
                        </details>
                      )}
                      <SuggestionReviewTable
                        projectId={id!}
                        contractItems={project?.contractItems ?? []}
                        analysisResult={reportDetail}
                        lineItemResults={reportLineItemResults.length > 0 ? reportLineItemResults : undefined}
                        onApplied={() => { load(); loadAnalyses(); }}
                      />
                    </>
                  ) : openReportId ? (
                    <p className="text-sm text-slate-500">Could not load this report.</p>
                  ) : null}
                </div>
              </DialogPanel>
            </div>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
