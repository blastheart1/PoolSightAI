"use client";

import { useState } from "react";
import ResultCard from "@/components/permits/ResultCard";
import ComplianceStatus from "@/components/permits/ComplianceStatus";
import type { LotCalculatorResult } from "@/types/permits";

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
      if (!json.success) {
        setError(json.error ?? "Unknown error");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        Lot Coverage Calculator
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Check lot coverage, FAR, and setback compliance against zoning rules.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Lot Dimensions
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Width (ft)" value={form.lotWidth} onChange={(v) => update("lotWidth", v)} />
            <NumField label="Depth (ft)" value={form.lotDepth} onChange={(v) => update("lotDepth", v)} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Proposed Structure
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Footprint (sq ft)" value={form.structureFootprint} onChange={(v) => update("structureFootprint", v)} />
            <NumField label="FAR" value={form.proposedFAR} onChange={(v) => update("proposedFAR", v)} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Proposed Setbacks (ft)
          </legend>
          <div className="grid grid-cols-4 gap-4">
            <NumField label="Front" value={form.front} onChange={(v) => update("front", v)} />
            <NumField label="Rear" value={form.rear} onChange={(v) => update("rear", v)} />
            <NumField label="Left" value={form.sideLeft} onChange={(v) => update("sideLeft", v)} />
            <NumField label="Right" value={form.sideRight} onChange={(v) => update("sideRight", v)} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Zoning Rules
          </legend>
          <div className="grid grid-cols-3 gap-4">
            <NumField label="Max Coverage (%)" value={form.maxLotCoverage} onChange={(v) => update("maxLotCoverage", v)} />
            <NumField label="Max FAR" value={form.maxFAR} onChange={(v) => update("maxFAR", v)} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <NumField label="Min Front (ft)" value={form.minFront} onChange={(v) => update("minFront", v)} />
            <NumField label="Min Rear (ft)" value={form.minRear} onChange={(v) => update("minRear", v)} />
            <NumField label="Min Side (ft)" value={form.minSide} onChange={(v) => update("minSide", v)} />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {error && (
        <p className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {result && (
        <ResultCard title="Calculation Results">
          <div className="space-y-4">
            <p className="text-slate-200">{result.summary}</p>

            <div className="grid grid-cols-2 gap-4">
              <Metric
                label="Lot Area"
                value={`${result.lotArea.toLocaleString()} sq ft`}
              />
              <Metric
                label="Lot Coverage"
                value={`${result.lotCoveragePercent}%`}
                status={result.lotCoverageStatus}
              />
              <Metric
                label="FAR"
                value={String(result.farCalculated)}
                status={result.farStatus}
              />
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Setback Compliance
              </h4>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Proposed</th>
                    <th className="pb-2">Required</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.setbackResults.map((s) => (
                    <tr key={s.side} className="border-b border-slate-800/50">
                      <td className="py-2 text-slate-300">{s.side}</td>
                      <td className="py-2 text-white">{s.proposed} ft</td>
                      <td className="py-2 text-white">{s.required} ft</td>
                      <td className="py-2">
                        <ComplianceStatus status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ResultCard>
      )}
    </div>
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
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
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
    <div className="rounded-lg border border-slate-800 bg-slate-800/50 px-4 py-3">
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="text-lg font-semibold text-white">{value}</span>
      {status && (
        <span className="ml-2">
          <ComplianceStatus status={status} />
        </span>
      )}
    </div>
  );
}
