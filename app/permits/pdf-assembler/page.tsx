"use client";

import { useCallback, useState } from "react";
import FileUpload from "@/components/permits/FileUpload";

interface PdfEntry {
  fileName: string;
  documentType: string;
  base64: string;
}

const DOC_TYPES = [
  "Application Form",
  "Site Plan",
  "Floor Plan",
  "Elevation",
  "Structural Calcs",
  "Title 24",
  "Soils Report",
  "Plot Plan",
  "Other",
];

export default function PdfAssemblerPage() {
  const [docs, setDocs] = useState<PdfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File, base64: string) => {
      setDocs((prev) => [
        ...prev,
        { fileName: file.name, documentType: "Other", base64 },
      ]);
      setMergedUrl(null);
    },
    []
  );

  function updateDocType(idx: number, type: string) {
    setDocs((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, documentType: type } : d))
    );
  }

  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
    setMergedUrl(null);
  }

  async function handleMerge() {
    if (docs.length < 2) return;
    setLoading(true);
    setError(null);
    setMergedUrl(null);

    try {
      const res = await fetch("/api/permits/pdf-assembler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => ({
            pdfBase64: d.base64,
            documentType: d.documentType,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unknown error");
      } else {
        const bytes = Uint8Array.from(atob(json.data.pdfBase64), (c) =>
          c.charCodeAt(0)
        );
        const blob = new Blob([bytes], { type: "application/pdf" });
        setMergedUrl(URL.createObjectURL(blob));
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
        PDF Document Assembler
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Upload individual PDFs and merge them in the correct LADBS submission
        order into one package.
      </p>

      <FileUpload
        accept="application/pdf"
        onFile={handleFile}
        label="Add a PDF"
        className="mb-6"
      />

      {docs.length > 0 && (
        <div className="mb-6 space-y-2">
          {docs.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5"
            >
              <span className="flex-1 truncate text-sm text-white">
                {d.fileName}
              </span>
              <select
                value={d.documentType}
                onChange={(e) => updateDocType(i, e.target.value)}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={() => removeDoc(i)}
                className="text-xs text-slate-500 hover:text-red-400"
                aria-label={`Remove ${d.fileName}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleMerge}
          disabled={loading || docs.length < 2}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Merging…" : `Merge ${docs.length} PDF${docs.length !== 1 ? "s" : ""}`}
        </button>
        {mergedUrl && (
          <a
            href={mergedUrl}
            download="permit-package.pdf"
            className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-6 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-900/50"
          >
            Download Merged PDF
          </a>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
