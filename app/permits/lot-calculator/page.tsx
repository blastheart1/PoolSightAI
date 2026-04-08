"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import ComplianceStatus from "@/components/permits/ComplianceStatus";
import type { LotCalculatorResult } from "@/types/permits";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

const INITIAL = {
  lotWidth: "",
  lotDepth: "",
  structureFootprint: "",
  proposedFAR: "",
  front: "",
  rear: "",
  sideLeft: "",
  sideRight: "",
  maxLotCoverage: "",
  maxFAR: "",
  minFront: "",
  minRear: "",
  minSide: "",
};

export default function LotCalculatorPage() {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LotCalculatorResult | null>(null);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const body = {
      lotWidth: Number(form.lotWidth),
      lotDepth: Number(form.lotDepth),
      structureFootprint: Number(form.structureFootprint),
      proposedFAR: Number(form.proposedFAR),
      setbacks: {
        front: Number(form.front),
        rear: Number(form.rear),
        sideLeft: Number(form.sideLeft),
        sideRight: Number(form.sideRight),
      },
      zoningRules: {
        maxLotCoverage: Number(form.maxLotCoverage),
        maxFAR: Number(form.maxFAR),
        minSetbacks: {
          front: Number(form.minFront),
          rear: Number(form.minRear),
          side: Number(form.minSide),
        },
      },
    };

    try {
      const res = await fetch("/api/permits/lot-calculator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Unknown error");
      else setResult(json.data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Lot Coverage Calculator
          </h1>
          <span className={BADGE}>Phase 1</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Check lot coverage, FAR, and setback compliance against your zoning rules.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Fieldset legend="Lot Dimensions">
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Width (ft)" value={form.lotWidth} onChange={(v) => update("lotWidth", v)} />
              <NumField label="Depth (ft)" value={form.lotDepth} onChange={(v) => update("lotDepth", v)} />
            </div>
          </Fieldset>

          <Fieldset legend="Proposed Structure">
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Ground Footprint (sq ft)" value={form.structureFootprint} onChange={(v) => update("structureFootprint", v)} />
              <NumField label="Total Floor Area (sq ft)" value={form.proposedFAR} onChange={(v) => update("proposedFAR", v)} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Ground footprint = first floor only. Total floor area = all floors (used to calculate FAR).
            </p>
          </Fieldset>

          <Fieldset legend="Proposed Setbacks (ft)">
            <div className="grid grid-cols-4 gap-4">
              <NumField label="Front" value={form.front} onChange={(v) => update("front", v)} />
              <NumField label="Rear" value={form.rear} onChange={(v) => update("rear", v)} />
              <NumField label="Left" value={form.sideLeft} onChange={(v) => update("sideLeft", v)} />
              <NumField label="Right" value={form.sideRight} onChange={(v) => update("sideRight", v)} />
            </div>
          </Fieldset>

          <Fieldset legend="Zoning Rules">
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Max Coverage (%)" value={form.maxLotCoverage} onChange={(v) => update("maxLotCoverage", v)} />
              <NumField label="Max FAR" value={form.maxFAR} onChange={(v) => update("maxFAR", v)} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <NumField label="Min Front (ft)" value={form.minFront} onChange={(v) => update("minFront", v)} />
              <NumField label="Min Rear (ft)" value={form.minRear} onChange={(v) => update("minRear", v)} />
              <NumField label="Min Side (ft)" value={form.minSide} onChange={(v) => update("minSide", v)} />
            </div>
          </Fieldset>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <ResultCard title="Calculation Results">
              <div className="space-y-5">
                <p className="text-sm text-slate-700">{result.summary}</p>

                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Lot Area" value={`${result.lotArea.toLocaleString()} sq ft`} />
                  <Metric
                    label="Lot Coverage"
                    value={`${result.lotCoveragePercent}%`}
                    status={result.lotCoverageStatus}
                  />
                  <Metric
                    label="FAR (calculated)"
                    value={String(result.farCalculated)}
                    status={result.farStatus}
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Setback Compliance
                  </p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-400">
                        <th className="pb-2 font-medium">Side</th>
                        <th className="pb-2 font-medium">Proposed</th>
                        <th className="pb-2 font-medium">Required</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.setbackResults.map((s) => (
                        <tr key={s.side}>
                          <td className="py-2.5 text-slate-600">{s.side}</td>
                          <td className="py-2.5 font-medium text-slate-900">{s.proposed} ft</td>
                          <td className="py-2.5 text-slate-600">{s.required} ft</td>
                          <td className="py-2.5">
                            <ComplianceStatus status={s.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ResultCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {legend}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "pass" | "fail" | "warning";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-900">{value}</p>
      {status && <div className="mt-1.5"><ComplianceStatus status={status} /></div>}
    </div>
  );
}
