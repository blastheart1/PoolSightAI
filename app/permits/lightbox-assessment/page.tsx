"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { LightboxAssessmentResult } from "@/types/lightbox";
import { lightboxTrialLabel } from "@/lib/permits/lightboxTrial";

const BADGE =
  "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600";

function fmt$(v: number | null): string {
  return v != null ? `$${v.toLocaleString()}` : "—";
}

function fmtNum(v: number | null, suffix = ""): string {
  return v != null ? `${v.toLocaleString()}${suffix}` : "—";
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LightboxAssessmentPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightboxAssessmentResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/permits/lightbox-assessment", {
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
            Assessment & Valuation
          </h1>
          <span className={BADGE}>{lightboxTrialLabel()}</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Pull assessed values, AVM estimate, tax info, structure details, and
          transaction history via Lightbox RE API.
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
            {/* Valuation */}
            <ResultCard title="Valuation">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["APN", result.apn],
                    ["Assessed Total", fmt$(result.assessedValueTotal)],
                    ["  Land", fmt$(result.assessedValueLand)],
                    ["  Improvements", fmt$(result.assessedValueImprovements)],
                    ["Improvement %", result.improvementPercent != null ? `${result.improvementPercent}%` : "—"],
                    ["Assessed Year", result.assessedYear ?? "—"],
                    ["AVM (Est. Market)", fmt$(result.avm)],
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

            {/* Tax */}
            <ResultCard title="Tax">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Tax Year", result.taxYear ?? "—"],
                    ["Tax Amount", fmt$(result.taxAmount)],
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

            {/* Structure */}
            <ResultCard title="Structure Details">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Year Built", result.yearBuilt ?? "—"],
                    ["Stories", result.stories ?? "—"],
                    ["Style", result.style ?? "—"],
                    ["Living Area", `${fmtNum(result.livingAreaSqft, " sqft")} (${fmtNum(result.livingAreaSqm, " sqm")})`],
                    ["Lot Size", `${fmtNum(result.lotSizeSqft, " sqft")} (${fmtNum(result.lotSizeSqm, " sqm")})`],
                    ["Rooms / Bed / Bath", `${result.rooms ?? "—"} / ${result.bedrooms ?? "—"} / ${result.baths ?? "—"}`],
                    ["Parking", fmtNum(result.parkingSpaces, " spaces")],
                    ["Construction", result.constructionType ?? "—"],
                    ["Roof", result.roofType ?? "—"],
                    ["Heating", result.heatingType ?? "—"],
                    ["A/C", result.acType ?? "—"],
                    ["Garage", result.garageType ?? "—"],
                    ["Pool", result.poolIndicator ?? "—"],
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

            {/* Transactions */}
            <ResultCard title="Transaction History">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Last Sale Date", fmtDate(result.lastSaleDate)],
                    ["Last Sale Price", fmt$(result.lastSalePrice)],
                    ["Buyer", result.lastSaleBuyer ?? "—"],
                    ["Seller", result.lastSaleSeller ?? "—"],
                    ["Prior Sale Price", fmt$(result.priorSalePrice)],
                    ["Prior Seller", result.priorSaleSeller ?? "—"],
                    ["Last Loan", fmt$(result.lastLoanAmount)],
                    ["Lender", result.lastLoanLender ?? "—"],
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
