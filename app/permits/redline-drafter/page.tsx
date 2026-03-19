"use client";

import { useState } from "react";
import ResultCard from "@/components/permits/ResultCard";
import type { RedlineResult } from "@/types/permits";

export default function RedlineDrafterPage() {
  const [corrections, setCorrections] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedlineResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!corrections.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/permits/redline-drafter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ corrections }),
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
        Redline Response Drafter
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Paste LADBS correction comments and get a professional draft response
        with action items per sheet.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-300">
            Correction Comments
          </span>
          <textarea
            rows={8}
            value={corrections}
            onChange={(e) => setCorrections(e.target.value)}
            placeholder="Paste the correction comments from LADBS here…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !corrections.trim()}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Draft Response"}
        </button>
      </form>

      {error && (
        <p className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <div className="text-sm text-slate-400">
            {result.totalCorrections} correction(s) found
          </div>

          {result.corrections.map((c, i) => (
            <ResultCard key={i} title={`Correction ${i + 1}`}>
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Original
                  </h4>
                  <p className="mt-1 text-slate-300">{c.originalText}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Plain Language
                  </h4>
                  <p className="mt-1 text-slate-300">
                    {c.plainLanguageSummary}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Draft Response
                  </h4>
                  <p className="mt-1 text-white">{c.draftResponse}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Affected Sheets: </span>
                    <span className="text-slate-300">
                      {c.affectedSheets.join(", ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Action Required: </span>
                    <span className="text-slate-300">{c.actionRequired}</span>
                  </div>
                </div>
              </div>
            </ResultCard>
          ))}

          {result.coverLetter && (
            <ResultCard title="Cover Letter">
              <pre className="whitespace-pre-wrap text-slate-300">
                {result.coverLetter}
              </pre>
            </ResultCard>
          )}
        </div>
      )}
    </div>
  );
}
