"use client";

import { useState } from "react";
import ResultCard from "@/components/permits/ResultCard";
import type { ZoningResult } from "@/types/permits";

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
        Zoning & Parcel Lookup
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Enter an LA address to pull zoning, setbacks, overlays, and lot
        coverage data from ZIMAS.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 123 Main St, Los Angeles, CA 90012"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        />
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </form>

      {error && (
        <p className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {result && (
        <ResultCard title="Zoning Summary">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Parcel" value={result.parcelNumber} />
              <Field label="Zoning" value={result.zoningClassification} />
              <Field label="Lot Size" value={result.lotSize} />
              <Field label="Height Limit" value={result.heightLimit} />
              <Field label="Max Lot Coverage" value={result.lotCoverageMax} />
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Setbacks
              </h4>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <Setback label="Front" value={result.setbacks.front} />
                <Setback label="Rear" value={result.setbacks.rear} />
                <Setback label="Left" value={result.setbacks.sideLeft} />
                <Setback label="Right" value={result.setbacks.sideRight} />
              </div>
            </div>

            {result.allowedUses.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Allowed Uses
                </h4>
                <ul className="list-inside list-disc text-sm text-slate-300">
                  {result.allowedUses.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.overlays.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Overlays
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.overlays.map((o, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ResultCard>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className="font-medium text-white">{value || "—"}</p>
    </div>
  );
}

function Setback({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2 text-center">
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="font-medium text-white">{value || "—"}</span>
    </div>
  );
}
