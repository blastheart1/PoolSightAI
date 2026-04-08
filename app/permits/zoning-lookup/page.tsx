"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { ZoningResult } from "@/types/permits";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

export default function ZoningLookupPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ZoningResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/permits/zoning-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
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
            Zoning & Parcel Lookup
          </h1>
          <span className={BADGE}>Phase 1</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Enter an LA address to pull zoning, setbacks, overlays, and lot coverage from ZIMAS.
        </p>

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Los Angeles, CA 90012"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Looking up…" : "Lookup"}
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
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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
          >
            <ResultCard title="Zoning Summary">
              <div className="space-y-5">
                {/* Key fields — single column table for long values */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { label: "Parcel", value: result.parcelNumber },
                      { label: "Zoning", value: result.zoningClassification },
                      { label: "Lot Size", value: result.lotSize },
                      { label: "Height Limit", value: result.heightLimit },
                      { label: "Max Lot Coverage", value: result.lotCoverageMax },
                    ].map(({ label, value }) => (
                      <tr key={label}>
                        <td className="w-40 shrink-0 py-2.5 pr-4 align-top text-xs font-medium text-slate-400">
                          {label}
                        </td>
                        <td className="py-2.5 text-slate-900">{value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Setbacks — simple table */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Setbacks
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-2 text-left text-xs font-medium text-slate-400">Side</th>
                        <th className="pb-2 text-left text-xs font-medium text-slate-400">Distance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { side: "Front", value: result.setbacks.front },
                        { side: "Rear", value: result.setbacks.rear },
                        { side: "Left", value: result.setbacks.sideLeft },
                        { side: "Right", value: result.setbacks.sideRight },
                      ].map(({ side, value }) => (
                        <tr key={side}>
                          <td className="w-24 py-2.5 pr-4 text-xs font-medium text-slate-500">{side}</td>
                          <td className="py-2.5 text-slate-900">{value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {result.allowedUses.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Allowed Uses
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700">
                      {result.allowedUses.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                )}

                {result.overlays.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Overlays
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.overlays.map((o, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ResultCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

