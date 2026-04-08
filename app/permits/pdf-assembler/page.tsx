"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FileUpload from "@/components/permits/FileUpload";

const BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

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

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.5 2H3.5A1 1 0 002.5 3v8a1 1 0 001 1h7a1 1 0 001-1V5L8.5 2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M8.5 2v3H11.5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

export default function PdfAssemblerPage() {
  const [docs, setDocs] = useState<PdfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const handleFile = useCallback((file: File, base64: string) => {
    setDocs((prev) => [...prev, { fileName: file.name, documentType: "Other", base64 }]);
    setMergedUrl(null);
    setPageCount(null);
  }, []);

  function updateDocType(idx: number, type: string) {
    setDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, documentType: type } : d)));
  }

  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
    setMergedUrl(null);
    setPageCount(null);
  }

  async function handleMerge() {
    if (docs.length < 2) return;
    setLoading(true);
    setError(null);
    setMergedUrl(null);
    setPageCount(null);

    try {
      const res = await fetch("/api/permits/pdf-assembler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => ({ pdfBase64: d.base64, documentType: d.documentType })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unknown error");
      } else {
        const bytes = Uint8Array.from(atob(json.data.pdfBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        setMergedUrl(URL.createObjectURL(blob));
        setPageCount(json.data.pageCount ?? null);
      }
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
            PDF Document Assembler
          </h1>
          <span className={BADGE}>Phase 3</span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Upload individual PDFs, assign document types, and merge them into a single LADBS submission package.
        </p>

        <FileUpload
          accept="application/pdf"
          onFile={handleFile}
          label="Add a PDF"
          className="mb-4"
        />

        <AnimatePresence>
          {docs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 space-y-2"
            >
              {docs.map((d, i) => (
                <motion.div
                  key={`${d.fileName}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm"
                >
                  <span className="shrink-0 text-slate-400">
                    <IconFile />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">
                    {d.fileName}
                  </span>
                  <select
                    value={d.documentType}
                    onChange={(e) => updateDocType(i, e.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeDoc(i)}
                    className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label={`Remove ${d.fileName}`}
                  >
                    <IconX />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMerge}
            disabled={loading || docs.length < 2}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Merging…"
              : `Merge ${docs.length} PDF${docs.length !== 1 ? "s" : ""}`}
          </button>

          <AnimatePresence>
            {mergedUrl && (
              <motion.a
                key="download"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                href={mergedUrl}
                download="permit-package.pdf"
                className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <IconDownload />
                Download
                {pageCount !== null && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    {pageCount} {pageCount === 1 ? "page" : "pages"}
                  </span>
                )}
              </motion.a>
            )}
          </AnimatePresence>
        </div>

        {docs.length < 2 && docs.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">Add at least one more PDF to enable merging.</p>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
