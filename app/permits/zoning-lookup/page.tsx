"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { ZoningResult } from "@/types/permits";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";
const AI_BADGE = "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700";
const VERIFIED_BADGE = "inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700";

const NON_RESIDENTIAL_WARNINGS: Record<string, { title: string; body: string; color: string }> = {
  commercial: {
    title: "Commercial zone",
    body: "Pool permits on commercial parcels are possible but typically require discretionary review. Verify applicability with LADBS before proceeding.",
    color: "amber",
  },
  industrial: {
    title: "Industrial / Manufacturing zone",
    body: "Pool permits are rarely applicable on industrial or manufacturing parcels. This lookup may not be relevant — verify with LADBS.",
    color: "red",
  },
  public_facilities: {
    title: "Public Facilities zone",
    body: "This parcel is designated for public use (government, schools, utilities). Pool permits for private construction are unlikely to apply here.",
    color: "red",
  },
  open_space: {
    title: "Open Space / Greenbelt zone",
    body: "This parcel is zoned open space, greenbelt, or agricultural. Private pool construction is not a permitted use on this parcel type.",
    color: "red",
  },
};

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
            LA Zoning Lookup
          </h1>
          <span className={BADGE}>Phase 1</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Enter an LA address to pull zoning, setbacks, overlays, and lot coverage from ZIMAS.
        </p>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">City of Los Angeles only</p>
          <p className="mt-0.5 text-xs text-amber-700">
            This tool queries ZIMAS, which covers City of LA parcels only.
            Addresses in unincorporated LA County (e.g. View Park, Ladera
            Heights, East LA) or other cities (Culver City, Beverly Hills,
            Upland, etc.) will not return results — use the Lightbox{" "}
            <a
              href="/permits/lightbox-zoning"
              className="underline hover:text-amber-900"
            >
              Zoning Report
            </a>{" "}
            for nationwide coverage.
          </p>
        </div>

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
                {/* Non-residential zone warning */}
                {result.zoneType && NON_RESIDENTIAL_WARNINGS[result.zoneType] && (() => {
                  const w = NON_RESIDENTIAL_WARNINGS[result.zoneType!]!;
                  const isRed = w.color === "red";
                  return (
                    <div className={`rounded-md border px-3 py-2.5 text-xs leading-relaxed ${isRed ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                      <p className="font-semibold">{w.title}</p>
                      <p className="mt-0.5">{w.body}</p>
                    </div>
                  );
                })()}

                {/* Matched address warning */}
                {result.matchedAddress && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Geocoded as: </span>
                    {result.matchedAddress}
                    {result.matchedAddress.toLowerCase() !== address.trim().toLowerCase() && (
                      <span className="ml-1.5 font-medium text-amber-700">— differs from your input, verify the parcel is correct</span>
                    )}
                  </div>
                )}

                {/* Key fields — single column table for long values */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { label: "Parcel", value: result.parcelNumber, ai: false },
                      { label: "Zoning", value: result.zoningClassification, ai: false },
                      { label: "Lot Size", value: result.lotSize, ai: false },
                      { label: "Height Limit", value: result.heightLimit, ai: true },
                      { label: "Max Lot Coverage", value: result.lotCoverageMax, ai: true },
                    ].map(({ label, value, ai }) => (
                      <tr key={label}>
                        <td className="w-40 shrink-0 py-2.5 pr-4 align-top text-xs font-medium text-slate-400">
                          <span>{label}</span>
                          {ai && <span className={`ml-1.5 ${AI_BADGE}`}>AI est.</span>}
                        </td>
                        <td className="py-2.5 text-slate-900">{value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Setbacks — AI estimated */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Setbacks
                    </p>
                    <span className={AI_BADGE}>
                      ✦ AI Estimated
                    </span>
                  </div>
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
                  {/* Disclaimer */}
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold">How these were determined:</span> ZIMAS returns only the zoning code ({result.zoningClassification}) and land use category — it does not include dimensional standards. These setback values are LAMC Title 22 typical defaults for the {result.zoningClassification} base zone, inferred by AI. They may be modified by Q conditions, specific plans, hillside ordinances, or overlay districts. <span className="font-semibold">Do not use for permit submission — verify with LADBS or a licensed professional.</span>
                  </p>
                </div>

                {/* Pool Setbacks — hardcoded from LAMC 12.21-A,4(k), not AI */}
                {result.poolSetbacks && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Pool Setbacks
                      </p>
                      <span className={VERIFIED_BADGE}>
                        ✓ LAMC 12.21
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 text-left text-xs font-medium text-slate-400">Requirement</th>
                          <th className="pb-2 text-left text-xs font-medium text-slate-400">Distance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { label: "From property line", value: result.poolSetbacks.fromPropertyLine },
                          { label: "From dwelling / structures", value: result.poolSetbacks.fromDwelling },
                          { label: "Front yard", value: result.poolSetbacks.frontYard },
                          { label: "Equipment pad", value: result.poolSetbacks.equipmentPad },
                        ].map(({ label, value }) => (
                          <tr key={label}>
                            <td className="w-48 py-2.5 pr-4 text-xs font-medium text-slate-500">{label}</td>
                            <td className="py-2.5 text-slate-900">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.poolSetbacks.caveats.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {result.poolSetbacks.caveats.map((c, i) => (
                          <p key={i} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                            {c}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

