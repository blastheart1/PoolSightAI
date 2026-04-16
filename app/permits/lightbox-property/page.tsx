"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { LightboxParcelResult } from "@/types/lightbox";
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

export default function LightboxPropertyPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightboxParcelResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/permits/lightbox-property", {
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
            Property & Owner Lookup
          </h1>
          <span className={BADGE}>{lightboxTrialLabel()}</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Look up parcel details, owner info, land use, lot size, and recent
          transactions via Lightbox RE API. Works for any US address.
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
            {/* Property overview */}
            <ResultCard title="Property Overview">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["APN", result.apn],
                    ["Address", `${result.address}, ${result.city}, ${result.state} ${result.zip}`],
                    ["County", result.county],
                    ["Land Use", result.landUse],
                    ["Category", result.landUseCategory],
                    ["Property Type", result.propertyType],
                    ["Lot Size", `${fmtNum(result.lotSizeSqft, " sqft")} (${fmtNum(result.lotSizeSqm, " sqm")})`],
                    ["Year Built", result.yearBuilt ?? "—"],
                    ["Living Area", `${fmtNum(result.livingAreaSqft, " sqft")} (${fmtNum(result.livingAreaSqm, " sqm")})`],
                    ["Bed / Bath", `${result.bedrooms ?? "—"} / ${result.baths ?? "—"}`],
                    ["Stories", result.stories ?? "—"],
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

            {/* Owner */}
            <ResultCard title="Owner Information">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Owner", result.ownerName],
                    ["Mailing Address", result.ownerAddress],
                    ["Owner Occupied", result.ownerOccupied ? "Yes" : "No"],
                  ] as const).map(([label, value]) => (
                    <tr key={label}>
                      <td className="w-36 py-2.5 pr-4 text-xs font-medium text-slate-400">
                        {label}
                      </td>
                      <td className="py-2.5 text-slate-900">{value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>

            {/* Transaction */}
            <ResultCard title="Last Market Sale">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ["Sale Date", fmtDate(result.lastSaleDate)],
                    ["Sale Price", fmt$(result.lastSalePrice)],
                    ["Buyer", result.lastSaleBuyer ?? "—"],
                    ["Seller", result.lastSaleSeller ?? "—"],
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

            {/* Legal description */}
            {result.legalDescription.length > 0 && (
              <ResultCard title="Legal Description">
                <p className="text-sm text-slate-700">
                  {result.legalDescription.join("; ")}
                </p>
              </ResultCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
