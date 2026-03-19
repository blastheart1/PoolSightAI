"use client";

import { useState } from "react";
import ResultCard from "@/components/permits/ResultCard";
import type { ChecklistResult, ProjectType } from "@/types/permits";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "pool", label: "Pool" },
  { value: "adu", label: "ADU" },
  { value: "addition", label: "Addition" },
  { value: "remodel", label: "Remodel" },
  { value: "new_construction", label: "New Construction" },
];

const QUALIFIER_OPTIONS = [
  "Hillside",
  "Historic district",
  "Coastal zone",
  "Fire zone",
  "HOA/CC&R",
  "Solar panels",
  "EV charger",
  "Grading required",
];

export default function ChecklistGeneratorPage() {
  const [projectType, setProjectType] = useState<ProjectType>("pool");
  const [qualifiers, setQualifiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChecklistResult | null>(null);

  function toggleQualifier(q: string) {
    setQualifiers((prev) =>
      prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/permits/checklist-generator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectType, qualifiers }),
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
        Document Checklist Generator
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Select your project type to get the exact LADBS forms, plan sheets,
        and supporting documents required.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Project Type
          </legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setProjectType(pt.value)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  projectType === pt.value
                    ? "border-sky-600 bg-sky-600/20 text-sky-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-300">
            Qualifiers (optional)
          </legend>
          <div className="flex flex-wrap gap-2">
            {QUALIFIER_OPTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => toggleQualifier(q)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  qualifiers.includes(q)
                    ? "border-sky-600 bg-sky-600/20 text-sky-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate Checklist"}
        </button>
      </form>

      {error && (
        <p className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <ResultCard title="Required Forms">
            {result.requiredForms.length === 0 ? (
              <p className="text-slate-500">None</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Form</th>
                    <th className="pb-2">Number</th>
                    <th className="pb-2">Required</th>
                    <th className="pb-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.requiredForms.map((f, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{f.name}</td>
                      <td className="py-2 text-slate-300">{f.formNumber ?? "—"}</td>
                      <td className="py-2">{f.required ? "✓" : "—"}</td>
                      <td className="py-2 text-slate-400">{f.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ResultCard>

          <ResultCard title="Required Plan Sheets">
            {result.requiredPlanSheets.length === 0 ? (
              <p className="text-slate-500">None</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-slate-300">
                {result.requiredPlanSheets.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </ResultCard>

          <ResultCard title="Supporting Documents">
            {result.supportingDocuments.length === 0 ? (
              <p className="text-slate-500">None</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Document</th>
                    <th className="pb-2">Required</th>
                    <th className="pb-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.supportingDocuments.map((d, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{d.name}</td>
                      <td className="py-2">{d.required ? "✓" : "—"}</td>
                      <td className="py-2 text-slate-400">{d.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ResultCard>

          {result.notes.length > 0 && (
            <ResultCard title="Notes">
              <ul className="list-inside list-disc space-y-1 text-slate-300">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </ResultCard>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 text-xs text-slate-500">
            Estimated review time: {result.estimatedReviewTime}
          </div>
        </div>
      )}
    </div>
  );
}
