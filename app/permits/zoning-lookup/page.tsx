"use client";

import { useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type { ZoningResult } from "@/types/permits";

const ParcelMap = lazy(() => import("@/components/permits/ParcelMap"));

// ── Badge variants ──────────────────────────────────────────────────────────
// Each badge is a small circle with an icon; tooltip appears on hover.

type BadgeVariant = "ai" | "verified" | "info" | "source";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  ai:       "border-amber-300 bg-amber-50 text-amber-600",
  verified: "border-green-300 bg-green-50 text-green-600",
  info:     "border-slate-300 bg-slate-100 text-slate-500",
  source:   "border-blue-200 bg-blue-50 text-blue-500",
};

const BADGE_ICONS: Record<BadgeVariant, React.ReactNode> = {
  ai: (
    // Sparkle / wand
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M8 1l1.2 3.8L13 6l-3.8 1.2L8 11l-1.2-3.8L3 6l3.8-1.2z"/>
      <path d="M13 10l.6 1.9L15.5 13l-1.9.6L13 15.5l-.6-1.9L10.5 13l1.9-.6z" opacity=".6"/>
    </svg>
  ),
  verified: (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 8.5 6.5 12 13 5"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
      <circle cx="8" cy="5" r="1.1"/>
      <rect x="7.1" y="7.2" width="1.8" height="5" rx=".9"/>
    </svg>
  ),
  source: (
    // Database stack
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
      <ellipse cx="8" cy="4" rx="5" ry="1.8"/>
      <path d="M3 4v3c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4"/>
      <path d="M3 7v3c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V7" opacity=".6"/>
    </svg>
  ),
};

function IconBadge({ variant, tooltip }: { variant: BadgeVariant; tooltip: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${BADGE_STYLES[variant]}`}
        aria-label={tooltip}
      >
        {BADGE_ICONS[variant]}
      </span>
      {/* Tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {tooltip}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}

// ── Phase badge (non-interactive) ────────────────────────────────────────────
const PHASE_BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

// ── Non-residential warnings ─────────────────────────────────────────────────
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
          <span className={PHASE_BADGE}>Phase 1</span>
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

                {/* Map */}
                {result.lat && result.lon && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Location
                    </p>
                    <Suspense fallback={<div className="h-60 rounded-md border border-slate-200 bg-slate-50 animate-pulse" />}>
                      <ParcelMap lat={result.lat} lon={result.lon} address={result.matchedAddress} />
                    </Suspense>
                  </div>
                )}

                {/* Owner Info */}
                {result.ownerInfo && (result.ownerInfo.ownerName || result.ownerInfo.mailingAddress) && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Owner Info</p>
                      <IconBadge variant="source" tooltip="Source: Lightbox RE parcel API" />
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {result.ownerInfo.ownerName && (
                          <tr>
                            <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">Owner</td>
                            <td className="py-2.5 text-slate-900">{result.ownerInfo.ownerName}</td>
                          </tr>
                        )}
                        {result.ownerInfo.mailingAddress && (
                          <tr>
                            <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">Mailing</td>
                            <td className="py-2.5 text-slate-900">{result.ownerInfo.mailingAddress}</td>
                          </tr>
                        )}
                        {result.ownerInfo.ownerOccupied !== undefined && (
                          <tr>
                            <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">Owner-Occupied</td>
                            <td className="py-2.5 text-slate-900">{result.ownerInfo.ownerOccupied ? "Yes" : "No"}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Key fields */}
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
                          <span className="inline-flex items-center gap-1.5">
                            {label}
                            {ai && <IconBadge variant="ai" tooltip="AI-estimated from LAMC Title 22 defaults — not from authoritative records" />}
                          </span>
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
                    <IconBadge variant="ai" tooltip="AI-estimated from LAMC Title 22 defaults — may be modified by Q conditions, specific plans, or BHO" />
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
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold">How these were determined:</span> ZIMAS returns only the zoning code ({result.zoningClassification}) and land use category — it does not include dimensional standards. These setback values are LAMC Title 22 typical defaults for the {result.zoningClassification} base zone, inferred by AI. They may be modified by Q conditions, specific plans, hillside ordinances, or overlay districts. <span className="font-semibold">Do not use for permit submission — verify with LADBS or a licensed professional.</span>
                  </p>
                </div>

                {/* Pool Setbacks — hardcoded from LAMC 12.21-A,4(k) */}
                {result.poolSetbacks && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Pool Setbacks
                      </p>
                      <IconBadge variant="verified" tooltip="Hardcoded from LAMC 12.21-A,4(k) — not AI-inferred" />
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

                {/* Permit History */}
                {result.permitHistory && result.permitHistory.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Permit History</p>
                      <IconBadge variant="info" tooltip="Source: LA City open data (SODA) — building permits issued by LADBS" />
                    </div>
                    <div className="space-y-2">
                      {result.permitHistory.map((p, i) => (
                        <div key={i} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-700">{p.permitType || "Permit"}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.status?.toLowerCase().includes("issued") || p.status?.toLowerCase().includes("final")
                                ? "bg-green-100 text-green-700"
                                : p.status?.toLowerCase().includes("expired") || p.status?.toLowerCase().includes("void")
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-200 text-slate-600"
                            }`}>{p.status}</span>
                          </div>
                          {p.description && <p className="mt-0.5 text-slate-500">{p.description}</p>}
                          <p className="mt-1 text-slate-400">
                            {p.permitNumber && <span className="mr-3">#{p.permitNumber}</span>}
                            {p.issueDate && <span>{p.issueDate}</span>}
                          </p>
                        </div>
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
