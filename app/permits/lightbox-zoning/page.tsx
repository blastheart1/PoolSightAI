"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResultCard from "@/components/permits/ResultCard";
import type {
  LightboxZoningResult,
  ZoningInferenceResult,
} from "@/types/lightbox";
import { lightboxTrialLabel } from "@/lib/permits/lightboxTrial";

const BADGE =
  "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600";

interface LookupMeta {
  cached: boolean;
  normalizedAddress: string;
  fetchedAt: string | null;
}

interface InferMeta {
  cached: boolean;
  fetchedAt: string | null;
}

export default function LightboxZoningPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightboxZoningResult | null>(null);
  const [meta, setMeta] = useState<LookupMeta | null>(null);

  async function runLookup(opts: { refresh: boolean }) {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    try {
      const res = await fetch("/api/permits/lightbox-zoning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, refresh: opts.refresh }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unknown error");
      } else {
        setResult(json.data);
        setMeta({
          cached: Boolean(json.cached),
          normalizedAddress: json.normalizedAddress ?? "",
          fetchedAt: json.fetchedAt ?? null,
        });
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runLookup({ refresh: false });
  }

  function handleSearchAgain() {
    setResult(null);
    setMeta(null);
    setError(null);
  }

  async function handleRefresh() {
    await runLookup({ refresh: true });
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
            {meta && (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Matched
                  </p>
                  <p className="truncate text-slate-900">
                    {result.parcelId ? (
                      <>
                        Parcel{" "}
                        <span className="font-mono text-xs text-slate-700">
                          {result.parcelId}
                        </span>
                      </>
                    ) : (
                      "No parcel ID returned"
                    )}
                    {result.jurisdiction && (
                      <span className="text-slate-500">
                        {" "}· {result.jurisdiction}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {meta.cached ? (
                      <>
                        Cached lookup · no new API call
                        {meta.fetchedAt &&
                          ` · first fetched ${new Date(meta.fetchedAt).toLocaleString()}`}
                      </>
                    ) : (
                      <>Fresh from Lightbox · saved to cache</>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleSearchAgain}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                  >
                    Wrong address? Search again
                  </button>
                  {meta.cached && (
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={loading}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Refresh from API
                    </button>
                  )}
                </div>
              </div>
            )}

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

            <DimensionalStandardsCard
              key={`${result.jurisdiction}-${result.zoningCode}`}
              result={result}
            />

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

function DimensionalStandardsCard({
  result,
}: {
  result: LightboxZoningResult;
}) {
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
  const shouldInfer = !hasAnyStandard && hasZoningCode;

  const [inference, setInference] = useState<ZoningInferenceResult | null>(
    null,
  );
  const [inferLoading, setInferLoading] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [inferMeta, setInferMeta] = useState<InferMeta | null>(null);

  const runInfer = useCallback(
    async (refresh: boolean) => {
      if (!result.zoningCode || !result.jurisdiction) return;
      setInferLoading(true);
      setInferError(null);
      try {
        const res = await fetch("/api/permits/lightbox-zoning/infer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            zoningCode: result.zoningCode,
            jurisdiction: result.jurisdiction,
            description: result.description,
            summary: result.summary,
            refresh,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setInferError(json.error ?? "AI inference failed");
        } else {
          setInference(json.data);
          setInferMeta({
            cached: Boolean(json.cached),
            fetchedAt: json.fetchedAt ?? null,
          });
        }
      } catch {
        setInferError("Network error running AI inference.");
      } finally {
        setInferLoading(false);
      }
    },
    [
      result.zoningCode,
      result.jurisdiction,
      result.description,
      result.summary,
    ],
  );

  useEffect(() => {
    if (shouldInfer) {
      void runInfer(false);
    }
  }, [shouldInfer, runInfer]);

  return (
    <ResultCard title="Dimensional Standards">
      {shouldInfer ? (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3.5 text-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">
              No explicit dimensional standards returned
            </p>
            <p className="text-slate-900">
              Based on:{" "}
              <span className="font-semibold">{result.zoningCode}</span>
              {result.zoningCategory &&
                result.zoningCategory !== "UNKNOWN" && (
                  <span className="text-slate-500">
                    {" "}
                    · {result.zoningCategory}
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

          <InferenceBlock
            inference={inference}
            loading={inferLoading}
            error={inferError}
            meta={inferMeta}
            onReload={() => runInfer(true)}
          />
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {standards.map(([label, value]) => (
                <tr key={label}>
                  <td className="w-40 py-2.5 pr-4 text-xs font-medium text-slate-400">
                    {label}
                  </td>
                  <td className="py-2.5 text-slate-900">{value ?? "—"}</td>
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
              {result.zoningCategory &&
                result.zoningCategory !== "UNKNOWN" && (
                  <span> · {result.zoningCategory}</span>
                )}
            </p>
          )}
        </>
      )}
    </ResultCard>
  );
}

const CONFIDENCE_STYLE: Record<ZoningInferenceResult["confidence"], string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-rose-200 bg-rose-50 text-rose-700",
};

function InferenceBlock({
  inference,
  loading,
  error,
  meta,
  onReload,
}: {
  inference: ZoningInferenceResult | null;
  loading: boolean;
  error: string | null;
  meta: InferMeta | null;
  onReload: () => void;
}) {
  if (loading && !inference) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-3.5 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Inferring typical standards from the zoning code with AI…
        </span>
      </div>
    );
  }

  if (error && !inference) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
        <p className="mb-2 font-medium">AI inference failed</p>
        <p className="text-xs">{error}</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!inference) return null;

  const rows = [
    ["Front Setback", inference.frontSetback],
    ["Side Setback", inference.sideSetback],
    ["Rear Setback", inference.rearSetback],
    ["Max Building Height", inference.maxBuildingHeight],
    ["Max Stories", inference.maxStories],
    ["Max Site Coverage", inference.maxSiteCoverage],
    ["Min Lot Area", inference.minLotArea],
    ["Density / FAR", inference.densityFloorArea],
  ] as const;

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3.5 text-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            AI-inferred dimensional standards
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Not from Lightbox · verify against the ordinance before use
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[inference.confidence]}`}
          >
            {inference.confidence} confidence
          </span>
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Reloading…" : "Reload AI analysis"}
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-blue-100">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="w-40 py-2 pr-4 text-xs font-medium text-slate-500">
                {label}
              </td>
              <td className="py-2 text-slate-900">
                {value ?? (
                  <span className="text-slate-400">Not inferred</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {inference.sourceNote && (
        <p className="mt-3 text-xs text-slate-600">{inference.sourceNote}</p>
      )}
      {inference.caveats && inference.caveats.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-slate-600">
          {inference.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {meta && (
        <p className="mt-2 text-xs text-slate-400">
          {meta.cached ? "Cached inference · no new AI call" : "Fresh AI call · saved to cache"}
          {meta.fetchedAt && ` · ${new Date(meta.fetchedAt).toLocaleString()}`}
        </p>
      )}
    </div>
  );
}
