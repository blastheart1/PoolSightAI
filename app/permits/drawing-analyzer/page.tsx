"use client";

import { useState } from "react";
import FileUpload from "@/components/permits/FileUpload";
import ResultCard from "@/components/permits/ResultCard";
import ConfidenceBadge from "@/components/permits/ConfidenceBadge";
import type { DrawingAnalysisResult } from "@/types/permits";

export default function DrawingAnalyzerPage() {
  const [file, setFile] = useState<{ name: string; base64: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrawingAnalysisResult | null>(null);

  function handleFile(f: File, base64: string) {
    setFile({ name: f.name, base64, mime: f.type });
    setResult(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/permits/analyze-drawing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: file.base64, mimeType: file.mime }),
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
        Drawing Analyzer
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Upload a plan sheet or hand sketch. The AI extracts dimensions, room
        areas, setbacks, and flags unclear items.
      </p>

      <FileUpload
        accept="image/jpeg,image/png,application/pdf"
        onFile={handleFile}
        label="Upload drawing (JPEG, PNG, or PDF)"
        className="mb-4"
      />

      {file && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm text-slate-300">{file.name}</span>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      )}

      {error && (
        <p className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          {result.dimensions.length > 0 && (
            <ResultCard title="Dimensions">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Label</th>
                    <th className="pb-2">Value</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.dimensions.map((d, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{d.label}</td>
                      <td className="py-2 text-slate-300">{d.value}</td>
                      <td className="py-2 text-slate-400">{d.unit}</td>
                      <td className="py-2">
                        <ConfidenceBadge level={d.confidence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>
          )}

          {result.rooms.length > 0 && (
            <ResultCard title="Rooms">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Room</th>
                    <th className="pb-2">Sq Ft</th>
                    <th className="pb-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rooms.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{r.label}</td>
                      <td className="py-2 text-slate-300">{r.squareFootage}</td>
                      <td className="py-2">
                        <ConfidenceBadge level={r.confidence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>
          )}

          {result.setbacks.length > 0 && (
            <ResultCard title="Setbacks">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Distance</th>
                    <th className="pb-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.setbacks.map((s, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{s.side}</td>
                      <td className="py-2 text-slate-300">{s.distance}</td>
                      <td className="py-2">
                        <ConfidenceBadge level={s.confidence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultCard>
          )}

          {result.flagged.length > 0 && (
            <ResultCard title="Flagged Items">
              <ul className="list-inside list-disc space-y-1 text-amber-300">
                {result.flagged.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </ResultCard>
          )}

          {result.notes.length > 0 && (
            <ResultCard title="Notes">
              <ul className="list-inside list-disc space-y-1 text-slate-300">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </ResultCard>
          )}
        </div>
      )}
    </div>
  );
}
