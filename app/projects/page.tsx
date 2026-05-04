"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface PreParseData {
  orderNo: string;
  clientName: string;
  subject?: string;
  hasOriginalContract: boolean;
  addendumCount: number;
}

interface ParseResult {
  location: Record<string, unknown>;
  items: unknown[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function isProDbxUrl(url: string) {
  return /prodbx\.com\/go\/view/i.test(url.trim());
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

const INPUT_CLS =
  `h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/15`;

const TEXTAREA_CLS =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/15";

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "warning";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:  "border-slate-950 bg-slate-950 text-white hover:bg-slate-800 active:bg-slate-900",
  secondary:"border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100",
  warning:  "border-amber-700 bg-amber-700 text-white hover:bg-amber-800 active:bg-amber-900",
  danger:   "border-rose-200 bg-white text-rose-700 hover:bg-rose-50 active:bg-rose-100",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-10 min-w-32 px-4 text-sm font-semibold",
  sm: "h-8  min-w-24 px-3 text-xs font-semibold",
};

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  type?: "button" | "submit";
}

function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  ariaLabel,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center rounded-full border transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── SquareButton ─────────────────────────────────────────────────────────────

const SQUARE_BUTTON_VARIANTS: Record<"default" | "danger", string> = {
  default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  danger:  "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700",
};

interface SquareButtonProps {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

function SquareButton({
  children,
  ariaLabel,
  onClick,
  disabled = false,
  variant = "default",
}: SquareButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
        SQUARE_BUTTON_VARIANTS[variant],
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

interface FieldLabelProps {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}

function FieldLabel({ htmlFor, children, optional }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-900">
      {children}
      {optional && <span className="ml-1 font-normal text-slate-500">Optional</span>}
    </label>
  );
}

// ─── StatusBanner ─────────────────────────────────────────────────────────────

type BannerVariant = "error" | "success" | "warning" | "info";

const BANNER_STYLES: Record<BannerVariant, { wrap: string; head: string; body: string }> = {
  error:   { wrap: "border-rose-200 bg-rose-50",   head: "text-rose-800",   body: "text-rose-700"   },
  success: { wrap: "border-emerald-200 bg-emerald-50", head: "text-emerald-800", body: "text-emerald-700" },
  warning: { wrap: "border-amber-300 bg-amber-50",  head: "text-amber-900",  body: "text-amber-800"  },
  info:    { wrap: "border-slate-200 bg-slate-50",  head: "text-slate-800",  body: "text-slate-600"  },
};

interface StatusBannerProps {
  variant: BannerVariant;
  heading: string;
  body?: string;
  role?: "alert" | "status";
  children?: React.ReactNode;
}

function StatusBanner({ variant, heading, body, role = "alert", children }: StatusBannerProps) {
  const s = BANNER_STYLES[variant];
  return (
    <div role={role} className={`rounded-2xl border px-4 py-3 ${s.wrap}`}>
      <p className={`text-sm font-semibold ${s.head}`}>{heading}</p>
      {body && <p className={`mt-0.5 text-xs ${s.body}`}>{body}</p>}
      {children}
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconClose() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 4 4 12M4 4l8 8" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M5.333 4V2.667a.667.667 0 0 1 .667-.667h4a.667.667 0 0 1 .667.667V4m1 0v9.333a.667.667 0 0 1-.667.667H4a.667.667 0 0 1-.667-.667V4h9.334Z" />
    </svg>
  );
}

// ─── ProjectListRow ───────────────────────────────────────────────────────────

interface ProjectListRowProps {
  project: ProjectRow;
  deleting: boolean;
  onDelete: (id: string) => void;
}

function ProjectListRow({ project, deleting, onDelete }: ProjectListRowProps) {
  const meta = [project.orderNo, project.streetAddress, project.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <Link
        href={`/projects/${project.id}`}
        className={`min-w-0 rounded-xl ${FOCUS_RING} focus-visible:ring-offset-4`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base font-semibold text-slate-950">{project.name}</span>
          {project.orderNo && (
            <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {project.orderNo}
            </span>
          )}
        </div>
        {meta && <p className="mt-1 truncate text-sm text-slate-600">{meta}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {project.clientName      && <span>Client: {project.clientName}</span>}
          {project.orderGrandTotal && <span>Contract: {project.orderGrandTotal}</span>}
          {project.parsedAt        && <span>Parsed: {project.parsedAt}</span>}
        </div>
      </Link>

      <SquareButton
        ariaLabel={`Delete ${project.name}`}
        variant="danger"
        disabled={deleting}
        onClick={() => onDelete(project.id)}
      >
        <IconTrash />
      </SquareButton>
    </li>
  );
}

// ─── DuplicateAlert ───────────────────────────────────────────────────────────

interface DuplicateAlertProps {
  duplicate: ProjectRow;
  addendumCount?: number;
  onAppend: () => void;
  onCreateNew: () => void;
}

function DuplicateAlert({ duplicate, addendumCount, onAppend, onCreateNew }: DuplicateAlertProps) {
  const addendumNote = addendumCount
    ? ` — ${addendumCount} addendum${addendumCount > 1 ? "s" : ""} detected`
    : "";

  return (
    <StatusBanner
      variant="warning"
      heading={`This contract matches "${duplicate.name}"${addendumNote}`}
      body="Append the new addendums to the existing project, or create a separate project."
    >
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="warning" onClick={onAppend}>
          Append to existing
        </Button>
        <Button size="sm" variant="secondary" onClick={onCreateNew}>
          Create as new project
        </Button>
      </div>
    </StatusBanner>
  );
}

// ─── AddProjectDialog ─────────────────────────────────────────────────────────

type ContractSource = "file" | "url";

const DIALOG_INITIAL = {
  source: "file" as ContractSource,
  parseFile: null as File | null,
  parseUrl: "",
  addendumUrlsText: "",
  parseResult: null as ParseResult | null,
  parseError: "",
  parsing: false,
  saving: false,
  preParsing: false,
  preParseData: null as PreParseData | null,
  duplicateMatch: null as ProjectRow | null,
  existingProjectId: null as string | null,
};

interface AddProjectDialogProps {
  open: boolean;
  projects: ProjectRow[];
  onClose: () => void;
  onSuccess: (projectId: string) => void;
}

function AddProjectDialog({ open, projects, onClose, onSuccess }: AddProjectDialogProps) {
  const [state, setState] = useState(DIALOG_INITIAL);

  const patch = (partial: Partial<typeof DIALOG_INITIAL>) =>
    setState((prev) => ({ ...prev, ...partial }));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    setState(DIALOG_INITIAL);
    onClose();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    patch({ parseFile: file, parseError: "", parseResult: null, preParseData: null, duplicateMatch: null, existingProjectId: null });
    if (!file) return;

    patch({ preParsing: true });
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch("/api/pre-parse-eml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: b64 }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const preParseData: PreParseData = data.data;
        const duplicateMatch = preParseData.orderNo
          ? projects.find(
              (p) => p.orderNo?.trim().toLowerCase() === preParseData.orderNo.trim().toLowerCase()
            ) ?? null
          : null;
        patch({ preParseData, duplicateMatch });
      }
    } catch {
      // Non-blocking — user can still proceed manually
    } finally {
      patch({ preParsing: false });
    }
  };

  const runParse = async () => {
    if (state.source === "file" && !state.parseFile) {
      patch({ parseError: "Select an .eml file before parsing." });
      return;
    }
    if (state.source === "url" && !state.parseUrl.trim()) {
      patch({ parseError: "Paste a contract URL before parsing." });
      return;
    }

    patch({ parseError: "", parseResult: null, parsing: true });
    try {
      const body: Record<string, unknown> = { returnData: true };
      if (state.existingProjectId) body.existingProjectId = state.existingProjectId;

      if (state.source === "file" && state.parseFile) {
        body.file = await fileToBase64(state.parseFile);
      } else if (state.source === "url" && state.parseUrl.trim()) {
        if (isProDbxUrl(state.parseUrl)) {
          body.mode = "links";
          body.originalContractUrl = state.parseUrl.trim();
          body.addendumLinks = state.addendumUrlsText
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          body.url = state.parseUrl.trim();
        }
      }

      const res = await fetch("/api/parse-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details ?? "Parse failed.");
      if (!data.success || !data.data) throw new Error("Unexpected response from server.");
      patch({
        parseResult: { location: data.data.location ?? {}, items: data.data.items ?? [] },
      });
    } catch (e) {
      patch({
        parseError:
          e instanceof Error
            ? e.message
            : "Could not parse this contract. Check the file or URL and try again.",
      });
    } finally {
      patch({ parsing: false });
    }
  };

  const saveProject = async () => {
    const name = "New Project";
    patch({ saving: true, parseError: "" });
    try {
      let targetId: string;
      if (state.existingProjectId) {
        const res = await fetch(`/api/projects/${state.existingProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: state.parseResult?.location ?? {},
            items: state.parseResult?.items ?? [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not update the project.");
        targetId = state.existingProjectId;
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            location: state.parseResult?.location ?? {},
            items: state.parseResult?.items ?? [],
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          throw new Error(`This contract already exists as "${data.existingProjectName}". Open that project to append addendums.`);
        }
        if (!res.ok) throw new Error(data.error ?? "Could not create the project.");
        targetId = data.id;
      }
      setState(DIALOG_INITIAL);
      onClose();
      onSuccess(targetId);
    } catch (e) {
      patch({
        saving: false,
        parseError: e instanceof Error ? e.message : "Something went wrong. Try again.",
      });
    }
  };

  if (!open) return null;

  const canParse =
    (state.source === "file" && !!state.parseFile) ||
    (state.source === "url" && !!state.parseUrl.trim());

  const saveLabel = state.existingProjectId ? "Update project" : "Create project";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-project-title"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="add-project-title" className="text-lg font-semibold text-slate-950">
              Add project
            </h2>
          </div>
          <SquareButton ariaLabel="Close dialog" onClick={handleClose}>
            <IconClose />
          </SquareButton>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="space-y-5">
              {/* Source toggle */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Contract source</p>
                <div className="flex gap-2" role="group" aria-label="Select contract source">
                  {(["file", "url"] as ContractSource[]).map((src) => (
                    <Button
                      key={src}
                      variant={state.source === src ? "primary" : "secondary"}
                      onClick={() => patch({
                        source: src,
                        parseFile: null,
                        parseUrl: "",
                        parseResult: null,
                        parseError: "",
                        preParseData: null,
                        duplicateMatch: null,
                      })}
                    >
                      {src === "file" ? "Upload file" : "Paste URL"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* File */}
              {state.source === "file" && (
                <div className="space-y-2">
                  <FieldLabel htmlFor="eml-file">.eml contract file</FieldLabel>
                  <input
                    id="eml-file"
                    type="file"
                    accept=".eml"
                    onChange={onFileChange}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:transition file:hover:bg-slate-50"
                  />
                  {state.preParsing && (
                    <p className="text-xs text-slate-500">Checking for existing contract…</p>
                  )}
                  {state.preParseData && !state.duplicateMatch && !state.preParsing && (
                    <p className="text-xs text-slate-500">
                      Detected: Order {state.preParseData.orderNo || "unknown"}
                      {state.preParseData.clientName ? ` · ${state.preParseData.clientName}` : ""}
                      {state.preParseData.addendumCount > 0
                        ? ` · ${state.preParseData.addendumCount} addendum${state.preParseData.addendumCount > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  )}
                  {state.duplicateMatch && !state.preParsing && (
                    <DuplicateAlert
                      duplicate={state.duplicateMatch}
                      addendumCount={state.preParseData?.addendumCount}
                      onAppend={() =>
                        patch({
                          existingProjectId: state.duplicateMatch!.id,
                          duplicateMatch: null,
                        })
                      }
                      onCreateNew={() => patch({ duplicateMatch: null, existingProjectId: null })}
                    />
                  )}
                  {state.existingProjectId && !state.duplicateMatch && (
                    <p className="text-xs font-medium text-amber-700">
                      Appending to existing project — only new addendums will be added.
                    </p>
                  )}
                </div>
              )}

              {/* URL */}
              {state.source === "url" && (
                <div className="space-y-4">
                  <div>
                    <FieldLabel htmlFor="contract-url">Contract URL</FieldLabel>
                    <input
                      id="contract-url"
                      type="url"
                      value={state.parseUrl}
                      onChange={(e) => patch({ parseUrl: e.target.value, parseError: "", parseResult: null })}
                      placeholder="https://l1.prodbx.com/go/view/… or any contract URL"
                      className={`mt-2 ${INPUT_CLS}`}
                    />
                  </div>
                  {state.parseUrl.trim() && isProDbxUrl(state.parseUrl) && (
                    <div>
                      <FieldLabel htmlFor="addendum-urls" optional>
                        Addendum URLs
                      </FieldLabel>
                      <p className="mb-2 text-xs text-slate-500">One per line or comma-separated</p>
                      <textarea
                        id="addendum-urls"
                        value={state.addendumUrlsText}
                        onChange={(e) => patch({ addendumUrlsText: e.target.value, parseError: "", parseResult: null })}
                        placeholder="https://l1.prodbx.com/go/view/…"
                        rows={3}
                        className={TEXTAREA_CLS}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Parse result */}
              {state.parseResult && (
                <StatusBanner
                  role="status"
                  variant="success"
                  heading="Contract parsed"
                  body={[
                    `${state.parseResult.items.length} line item${state.parseResult.items.length !== 1 ? "s" : ""}`,
                    state.parseResult.location?.orderNo != null
                      ? `Order ${String(state.parseResult.location.orderNo)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}

              {/* Parse / save error */}
              {state.parseError && (
                <StatusBanner variant="error" heading="Parse failed" body={state.parseError} />
              )}

              {/* Saving indicator */}
              {state.saving && (
                <p className="text-sm text-slate-500">
                  {state.existingProjectId ? "Updating project…" : "Creating project…"}
                </p>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            variant="secondary"
            disabled={!canParse || state.parsing}
            onClick={runParse}
          >
            {state.parsing ? "Parsing…" : "Parse contract"}
          </Button>
          <Button
            disabled={!state.parseResult || state.saving}
            onClick={saveProject}
          >
            {state.saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not load projects.");
      }
      setProjects(await res.json());
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteProject = async (projectId: string) => {
    if (!confirm("Delete this project? Contract data and analyses will be removed permanently.")) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not delete the project.");
      }
      await load();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not delete the project.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSuccess = useCallback(
    async (projectId: string) => {
      await load();
      window.location.href = `/projects/${projectId}`;
    },
    [load]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.orderNo?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.streetAddress?.toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 ${FOCUS_RING}`}
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
            Back to PoolSightAI
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create projects, parse contract files, and run AI progress billing analysis.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        {pageError && (
          <StatusBanner variant="error" heading={pageError} role="alert" />
        )}

        <div className="flex items-center gap-3">
          <label htmlFor="search-projects" className="sr-only">Search projects</label>
          <input
            id="search-projects"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, order, or client…"
            className={`flex-1 ${INPUT_CLS}`}
          />
          <Button onClick={() => setDialogOpen(true)}>Add project</Button>
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading projects…</p>
          ) : filtered.length === 0 && query ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                No projects match &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try a different name, order number, or client.
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Select <span className="font-semibold text-slate-800">Add project</span> to create
                your first project and parse a contract.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((p) => (
                <ProjectListRow
                  key={p.id}
                  project={p}
                  deleting={deletingId === p.id}
                  onDelete={deleteProject}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      <AddProjectDialog
        open={dialogOpen}
        projects={projects}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
