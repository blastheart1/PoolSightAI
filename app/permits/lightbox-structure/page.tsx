"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { LightboxStructureResult } from "@/types/lightbox";
import { lightboxTrialLabel } from "@/lib/permits/lightboxTrial";

const BADGE =
  "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600";

function fmtNum(v: number | null, suffix = ""): string {
  return v != null ? `${v.toLocaleString()}${suffix}` : "—";
}

export default function LightboxStructurePage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightboxStructureResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/permits/lightbox-structure", {
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
            Structure Details
          </h1>
          <span className={BADGE}>{lightboxTrialLabel()}</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Get building footprint area, height measurements, stories, and
          elevation data via Lightbox RE API.
        </p>

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 1556 Geyser St, Upland CA 91784"
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
            className="space-y-4"
          >
            <ResultCard title="Building Footprint & Dimensions">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Address", `${result.address}, ${result.city}, ${result.state} ${result.zip}`],
                    ["Structure ID", result.structureId],
                    ["UBID", result.ubid ?? "—"],
                    ["Footprint", `${fmtNum(result.footprintAreaSqft, " sqft")} (${fmtNum(result.footprintAreaSqm, " sqm")})`],
                    ["Avg Height", `${fmtNum(result.heightAvgFt, " ft")} (${fmtNum(result.heightAvgM, " m")})`],
                    ["Max Height", `${fmtNum(result.heightMaxFt, " ft")} (${fmtNum(result.heightMaxM, " m")})`],
                    ["Stories", fmtNum(result.numberOfStories)],
                    ["Ground Elevation", `${fmtNum(result.groundElevationAvgFt, " ft")} (${fmtNum(result.groundElevationAvgM, " m")})`],
                    ["Primary Building", result.isPrimaryBuilding ? "Yes" : "No"],
                    ["Business", result.isBusiness ? "Yes" : "No"],
                  ] as const).map(([label, value]) => (
                    <tr key={label}>
                      <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">
                        {label}
                      </td>
                      <td className="py-2.5 text-slate-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
