"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { LightboxZoningResult } from "@/types/lightbox";
import { lightboxTrialLabel } from "@/lib/permits/lightboxTrial";

const BADGE =
  "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600";

export default function LightboxZoningPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightboxZoningResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/permits/lightbox-zoning", {
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
            Zoning Report
          </h1>
          <span className={BADGE}>{lightboxTrialLabel()}</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Pull zoning code, setbacks, height limits, site coverage, and lot area
          minimums from Lightbox RE. Works nationwide.
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
            <ResultCard title="Zoning Classification">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Jurisdiction", result.jurisdiction],
                    ["Zoning Code", result.zoningCode],
                    ["Category", result.zoningCategory],
                    ["Subcategory", result.zoningSubcategory],
                    ["Description", result.description ?? "—"],
                    ["Summary", result.summary ?? "—"],
                    ["Permitted Use", result.permittedUse ?? "—"],
                  ] as const).map(([label, value]) => (
                    <tr key={label}>
                      <td className="w-36 py-2.5 pr-4 text-xs font-medium text-slate-400">
                        {label}
                      </td>
                      <td className="py-2.5 text-slate-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>

            <ResultCard title="Dimensional Standards">
              {(() => {
                const standards = [
                  ["Front Setback", result.frontSetback],
                  ["Side Setback", result.sideSetback],
                  ["Rear Setback", result.rearSetback],
                  ["Max Building Height", result.maxBuildingHeight],
                  ["Max Stories", result.maxStories],
                  ["Max Site Coverage", result.maxSiteCoverage],
                  ["Min Lot Area", result.minLotArea],
                  ["Density / FAR", result.densityFloorArea],
                ] as const;
                const hasAnyStandard = standards.some(([, v]) => v != null && v !== "");
                const hasZoningCode = Boolean(result.zoningCode);

                if (!hasAnyStandard && hasZoningCode) {
                  return (
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3.5 text-sm">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                        No explicit dimensional standards returned
                      </p>
                      <p className="text-slate-900">
                        Based on:{" "}
                        <span className="font-semibold">{result.zoningCode}</span>
                        {result.zoningCategory && result.zoningCategory !== "UNKNOWN" && (
                          <span className="text-slate-500">
                            {" "}· {result.zoningCategory}
                          </span>
                        )}
                      </p>
                      {result.description && (
                        <p className="mt-2 text-slate-700">{result.description}</p>
                      )}
                      {result.summary && result.summary !== result.description && (
                        <p className="mt-2 text-slate-700">{result.summary}</p>
                      )}
                      {result.permittedUse && (
                        <p className="mt-2 text-slate-700">
                          <span className="font-medium text-slate-600">
                            Permitted use:
                          </span>{" "}
                          {result.permittedUse}
                        </p>
                      )}
                      {result.ordinanceUrl && (
                        <p className="mt-2">
                          <a
                            href={result.ordinanceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            Refer to the ordinance for exact setbacks →
                          </a>
                        </p>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {standards.map(([label, value]) => (
                          <tr key={label}>
                            <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">
                              {label}
                            </td>
                            <td className="py-2.5 text-slate-900">
                              {value ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasZoningCode && (
                      <p className="mt-3 text-xs text-slate-400">
                        Based on:{" "}
                        <span className="font-medium text-slate-500">
                          {result.zoningCode}
                        </span>
                        {result.zoningCategory && result.zoningCategory !== "UNKNOWN" && (
                          <span> · {result.zoningCategory}</span>
                        )}
                      </p>
                    )}
                  </>
                );
              })()}
            </ResultCard>

            {(result.ordinanceUrl || result.zoningVintage) && (
              <ResultCard title="Source">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {result.zoningVintage && (
                      <tr>
                        <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">
                          Data Vintage
                        </td>
                        <td className="py-2.5 text-slate-900">
                          {new Date(result.zoningVintage).toLocaleDateString(
                            "en-US",
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </td>
                      </tr>
                    )}
                    {result.ordinanceUrl && (
                      <tr>
                        <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">
                          Ordinance
                        </td>
                        <td className="py-2.5">
                          <a
                            href={result.ordinanceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            View ordinance
                          </a>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ResultCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
