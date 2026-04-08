"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { RedlineResult } from "@/types/permits";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

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
            Redline Response Drafter
          </h1>
          <span className={BADGE}>Phase 2</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Paste LADBS correction comments to get a professional draft response with action items per sheet.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Correction Comments
            </label>
            <textarea
              rows={9}
              value={corrections}
              onChange={(e) => setCorrections(e.target.value)}
              placeholder="Paste the correction comments from LADBS here…"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {corrections.length.toLocaleString()} / 20,000 characters
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !corrections.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Drafting…" : "Draft Response"}
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
            <p className="text-sm text-slate-500">
              {result.totalCorrections} correction{result.totalCorrections !== 1 ? "s" : ""} found
            </p>

            {result.corrections.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
              >
                <ResultCard title={`Correction ${i + 1}`}>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Original
                      </p>
                      <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {c.originalText}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Plain Language
                      </p>
                      <p className="text-sm text-slate-700">{c.plainLanguageSummary}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Draft Response
                      </p>
                      <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-900">
                        {c.draftResponse}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Affected Sheets
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.affectedSheets.length > 0 ? (
                            c.affectedSheets.map((s, si) => (
                              <span
                                key={si}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Action Required
                        </p>
                        <p className="text-sm text-slate-700">{c.actionRequired}</p>
                      </div>
                    </div>
                  </div>
                </ResultCard>
              </motion.div>
            ))}

            {result.coverLetter && (
              <ResultCard title="Cover Letter">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                  {result.coverLetter}
                </pre>
              </ResultCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
