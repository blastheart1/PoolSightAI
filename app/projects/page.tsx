"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface ProjectRow {
  id: string;
  name: string;
  orderNo: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  clientName: string | null;
  orderGrandTotal: string | null;
  parsedAt: string | null;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addStep, setAddStep] = useState<"name" | "parse" | "saving">("name");
  const [parseFile, setParseFile] = useState<File | null>(null);
  const [parseUrl, setParseUrl] = useState("");
  const [addendumUrlsText, setAddendumUrlsText] = useState("");
  const [parseError, setParseError] = useState("");
  const [parseResult, setParseResult] = useState<{
    location: Record<string, unknown>;
    items: unknown[];
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load projects");
      }
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseFile(file ?? null);
    setParseError("");
    setParseResult(null);
  };

  const isProDbxUrl = (url: string) =>
    /prodbx\.com\/go\/view/i.test(url.trim());

  const runParse = async () => {
    if (!parseFile && !parseUrl.trim()) {
      setParseError("Provide an .eml file or a contract URL.");
      return;
    }
    setParseError("");
    setParseResult(null);
    try {
      const body: Record<string, unknown> = { returnData: true };
      if (parseFile) {
        const buf = await parseFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = typeof btoa !== "undefined" ? btoa(binary) : "";
        if (!b64) throw new Error("Base64 encoding not available");
        body.file = b64;
      } else if (parseUrl.trim()) {
        if (isProDbxUrl(parseUrl)) {
          body.mode = "links";
          body.originalContractUrl = parseUrl.trim();
          const addendumLines = addendumUrlsText
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          body.addendumLinks = addendumLines;
        } else {
          body.url = parseUrl.trim();
        }
      }

      const res = await fetch("/api/parse-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details ?? "Parse failed");
      if (!data.success || !data.data) throw new Error("Invalid response");
      setParseResult({
        location: data.data.location ?? {},
        items: data.data.items ?? [],
      });
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("Delete this project? Contract data and analyses will be removed.")) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const createProject = async () => {
    const name = addName.trim() || "New Project";
    setAddStep("saving");
    setParseError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          location: parseResult?.location ?? {},
          items: parseResult?.items ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      setAddOpen(false);
      setAddName("");
      setParseFile(null);
      setParseResult(null);
      setAddStep("name");
      await load();
      if (data.id) {
        window.location.href = `/projects/${data.id}`;
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to create");
      setAddStep("parse");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="bg-slate-950 px-6 py-6 text-white sm:px-10">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
                Back to PoolSightAI
              </Link>
              <Link
                href="/trello"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Trello
              </Link>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Projects
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Calimingo <span className="text-sky-400">Projects</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Create projects, parse contract EML files, and run AI progress billing analysis.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-slate-50 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setAddOpen(true);
                setAddStep("name");
                setParseFile(null);
                setParseUrl("");
                setAddendumUrlsText("");
                setParseResult(null);
                setParseError("");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Add Project
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading projects…</p>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-600">
                No projects yet. Click <span className="font-semibold text-slate-800">Add Project</span> to create one and parse a contract.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  >
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    {(p.streetAddress || p.orderNo) && (
                      <span className="ml-2 text-sm text-slate-500">
                        {[p.orderNo, p.streetAddress, p.city].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      deleteProject(p.id);
                    }}
                    disabled={deletingId === p.id}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:opacity-50"
                    aria-label={`Delete project ${p.name}`}
                  >
                    <TrashIcon className="h-5 w-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-project-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="add-project-title" className="text-lg font-semibold text-slate-900">
              Add Project
            </h2>
            {addStep === "name" && (
              <>
                <label htmlFor="project-name" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Project name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Smith Residence"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddStep("parse")}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Next: Parse contract
                  </button>
                </div>
              </>
            )}
            {addStep === "parse" && (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Upload an .eml contract file or paste a contract link to parse location and line items.
                </p>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  EML file
                </label>
                <input
                  type="file"
                  accept=".eml"
                  onChange={onFileChange}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 file:font-medium"
                />
                <label htmlFor="contract-url" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Or contract URL
                </label>
                <input
                  id="contract-url"
                  type="url"
                  value={parseUrl}
                  onChange={(e) => {
                    setParseUrl(e.target.value);
                    setParseError("");
                    setParseResult(null);
                  }}
                  placeholder="https://l1.prodbx.com/go/view/?… or any EML URL"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  aria-describedby={parseUrl.trim() && isProDbxUrl(parseUrl) ? "addendum-urls-hint" : undefined}
                />
                {parseUrl.trim() && isProDbxUrl(parseUrl) && (
                  <>
                    <label id="addendum-urls-hint" htmlFor="addendum-urls" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Addendum URLs (optional, one per line or comma-separated)
                    </label>
                    <textarea
                      id="addendum-urls"
                      value={addendumUrlsText}
                      onChange={(e) => {
                        setAddendumUrlsText(e.target.value);
                        setParseError("");
                        setParseResult(null);
                      }}
                      placeholder="https://l1.prodbx.com/go/view/?…"
                      rows={2}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                    />
                  </>
                )}
                {parseResult && (
                  <p className="mt-2 text-sm text-emerald-700">
                    Parsed: {parseResult.items.length} items
                    {parseResult.location?.orderNo != null
                      ? ` · Order ${String(parseResult.location.orderNo)}`
                      : ""}
                  </p>
                )}
                {parseError && (
                  <p className="mt-2 text-sm text-red-600">{parseError}</p>
                )}
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddStep("name")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={runParse}
                    disabled={!parseFile && !parseUrl.trim()}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Parse
                  </button>
                  <button
                    type="button"
                    onClick={createProject}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Create project
                  </button>
                </div>
              </>
            )}
            {addStep === "saving" && (
              <p className="mt-4 text-sm text-slate-600">Creating project…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
