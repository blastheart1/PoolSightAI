"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

interface ContractItemRow {
  id: string;
  productService: string;
  progressOverallPct: string | null;
  amount: string | null;
}

interface RecoRow {
  line_item: string;
  current_percent: string;
  suggested_percent: string;
  suggested_percent_range?: string;
  status: string;
  photo_supported?: string;
  notes: string;
}

interface RecoSection {
  id: string;
  title: string;
  rows: RecoRow[];
}

export interface LineItemResult {
  id: string;
  contractItemId: string | null;
  lineItem: string;
  suggestedPercent: string | null;
  status: string | null;
  notes: string | null;
  progressBefore: string | null;
  appliedAt: string | null;
  appliedProgressPct: string | null;
}

interface AnalysisResultShape {
  sections?: RecoSection[];
}

interface SuggestionReviewTableProps {
  projectId: string;
  contractItems: ContractItemRow[];
  analysisResult: AnalysisResultShape;
  lineItemResults?: LineItemResult[];
  onApplied: () => void;
}

function parsePercent(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace("%", "").trim());
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

function statusPillClass(status: string): string {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "advance") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (status === "verify") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
}

type SuggestionRow = {
  lineItem: string;
  contractItemId: string | null;
  lineItemResultId: string | null;
  currentPct: number | null;
  suggestedPct: number | null;
  status: string;
  notes: string;
  amount: number | null;
  alreadyApplied: boolean;
};

export function SuggestionReviewTable({
  projectId,
  contractItems,
  analysisResult,
  lineItemResults,
  onApplied,
}: SuggestionReviewTableProps) {
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);

  // Build a map from productService label to contract item
  const byLabel = new Map(
    contractItems.map((c) => [c.productService?.toLowerCase().trim() ?? "", c])
  );

  // Build suggestion rows from analysisResult sections (or from lineItemResults if available)
  const rows: SuggestionRow[] = [];

  if (lineItemResults && lineItemResults.length > 0) {
    for (const li of lineItemResults) {
      const contractItem = li.contractItemId
        ? contractItems.find((c) => c.id === li.contractItemId)
        : byLabel.get(li.lineItem.toLowerCase().trim());

      rows.push({
        lineItem: li.lineItem,
        contractItemId: contractItem?.id ?? null,
        lineItemResultId: li.id,
        currentPct: parsePercent(contractItem?.progressOverallPct),
        suggestedPct: parsePercent(li.suggestedPercent),
        status: li.status ?? "hold",
        notes: li.notes ?? "",
        amount: contractItem?.amount != null ? parseFloat(String(contractItem.amount)) : null,
        alreadyApplied: li.appliedAt != null,
      });
    }
  } else {
    const sections = Array.isArray(analysisResult.sections) ? analysisResult.sections : [];
    for (const section of sections) {
      for (const row of section.rows ?? []) {
        const contractItem = byLabel.get(row.line_item.toLowerCase().trim());
        rows.push({
          lineItem: row.line_item,
          contractItemId: contractItem?.id ?? null,
          lineItemResultId: null,
          currentPct: parsePercent(row.current_percent) ?? parsePercent(contractItem?.progressOverallPct),
          suggestedPct: parsePercent(row.suggested_percent),
          status: row.status ?? "hold",
          notes: row.notes ?? "",
          amount: contractItem?.amount != null ? parseFloat(String(contractItem.amount)) : null,
          alreadyApplied: false,
        });
      }
    }
  }

  // Only rows with a matched contract item can be applied
  const applyableRows = rows.filter((r) => r.contractItemId != null && r.suggestedPct != null);

  // Default: pre-check rows where status === "advance" and there's a contract match
  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const r of applyableRows) {
      if (r.status === "advance" && !r.alreadyApplied) {
        initial.add(r.contractItemId!);
      }
    }
    return initial;
  });

  const toggleRow = (contractItemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(contractItemId)) next.delete(contractItemId);
      else next.add(contractItemId);
      return next;
    });
  };

  const selectedRows = applyableRows.filter((r) => checked.has(r.contractItemId!));

  // Calculate estimated billing impact
  const billingImpact = selectedRows.reduce((sum, r) => {
    if (r.amount == null || r.suggestedPct == null || r.currentPct == null) return sum;
    const delta = ((r.suggestedPct - r.currentPct) / 100) * r.amount;
    return sum + delta;
  }, 0);

  const handleApply = async () => {
    if (selectedRows.length === 0) return;
    setApplying(true);
    setApplyError("");
    setApplySuccess(false);
    try {
      const updates = selectedRows.map((r) => ({
        contractItemId: r.contractItemId!,
        newProgressPct: r.suggestedPct!,
        analysisResultLineItemId: r.lineItemResultId ?? undefined,
      }));
      const res = await fetch(`/api/projects/${projectId}/contract-items/bulk-progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to apply suggestions");
      }
      setApplySuccess(true);
      setChecked(new Set());
      onApplied();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Apply suggestions to order items
        </h3>
        {applySuccess && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircleIcon className="h-4 w-4" aria-hidden />
            Applied
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span>
          <span className="font-semibold text-slate-900">{selectedRows.length}</span>
          {" of "}
          <span className="font-semibold text-slate-900">{applyableRows.length}</span>
          {" suggestions selected"}
        </span>
        {billingImpact !== 0 && (
          <span>
            Est. impact:{" "}
            <span className={billingImpact >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {billingImpact >= 0 ? "+" : ""}
              {billingImpact.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            </span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Apply
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Line item
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Current
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Suggested
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Delta
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Rationale
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, idx) => {
              const canApply = row.contractItemId != null && row.suggestedPct != null;
              const isChecked = canApply && checked.has(row.contractItemId!);
              const delta =
                row.suggestedPct != null && row.currentPct != null
                  ? row.suggestedPct - row.currentPct
                  : null;

              return (
                <tr
                  key={idx}
                  className={[
                    row.alreadyApplied ? "bg-emerald-50/40" : "",
                    isChecked ? "bg-sky-50/40" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 text-center">
                    {canApply && !row.alreadyApplied ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(row.contractItemId!)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        aria-label={`Apply suggestion for ${row.lineItem}`}
                      />
                    ) : row.alreadyApplied ? (
                      <CheckCircleIcon className="mx-auto h-4 w-4 text-emerald-500" aria-label="Already applied" />
                    ) : (
                      <span className="text-slate-300" title="No matching contract item">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    <span className="block truncate font-medium text-slate-900" title={row.lineItem}>
                      {row.lineItem}
                    </span>
                    {!canApply && (
                      <span className="text-[10px] text-slate-400">No contract match</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {row.currentPct != null ? `${row.currentPct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                    {row.suggestedPct != null ? `${row.suggestedPct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {delta != null ? (
                      <span className={delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-600" : "text-slate-500"}>
                        {delta > 0 ? `+${delta}%` : `${delta}%`}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPillClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-[300px] px-3 py-2">
                    <p className="line-clamp-2 text-xs text-slate-600" title={row.notes}>
                      {row.notes || "—"}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {applyError && (
        <p className="text-sm text-rose-600">{applyError}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleApply}
          disabled={applying || selectedRows.length === 0}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          {applying
            ? "Applying…"
            : `Apply ${selectedRows.length} suggestion${selectedRows.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
