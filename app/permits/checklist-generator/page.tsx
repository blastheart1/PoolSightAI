"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { ChecklistResult, ProjectType } from "@/types/permits";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

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
            Document Checklist Generator
          </h1>
          <span className={BADGE}>Phase 1</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Select your project type to get the exact LADBS forms, plan sheets, and supporting documents required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Project Type
            </p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setProjectType(pt.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    projectType === pt.value
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Qualifiers <span className="font-normal normal-case text-slate-400">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {QUALIFIER_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => toggleQualifier(q)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    qualifiers.includes(q)
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate Checklist"}
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
            className="mt-6 space-y-4"
          >
            <ResultCard title="Required Forms">
              {result.requiredForms.length === 0 ? (
                <p className="text-slate-400">None</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="pb-2 font-medium">Form</th>
                      <th className="pb-2 font-medium">Number</th>
                      <th className="pb-2 font-medium">Required</th>
                      <th className="pb-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.requiredForms.map((f, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-900">{f.name}</td>
                        <td className="py-2.5 text-slate-500">{f.formNumber ?? "—"}</td>
                        <td className="py-2.5">
                          {f.required ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500">{f.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ResultCard>

            <ResultCard title="Required Plan Sheets">
              {result.requiredPlanSheets.length === 0 ? (
                <p className="text-slate-400">None</p>
              ) : (
                <ul className="space-y-1.5">
                  {result.requiredPlanSheets.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </ResultCard>

            <ResultCard title="Supporting Documents">
              {result.supportingDocuments.length === 0 ? (
                <p className="text-slate-400">None</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="pb-2 font-medium">Document</th>
                      <th className="pb-2 font-medium">Required</th>
                      <th className="pb-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.supportingDocuments.map((d, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-900">{d.name}</td>
                        <td className="py-2.5">
                          {d.required ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500">{d.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ResultCard>

            {result.notes.length > 0 && (
              <ResultCard title="Notes">
                <ul className="space-y-1.5">
                  {result.notes.map((n, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      {n}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-600">Estimated review time:</span>{" "}
                {result.estimatedReviewTime}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
