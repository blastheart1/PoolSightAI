"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { lightboxTrialLabel } from "@/lib/permits/lightboxTrial";

const PHASE_BADGE = "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500";

function IconMap() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2C7.24 2 5 4.24 5 7c0 4.5 5 11 5 11s5-6.5 5-11c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="7" x2="5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8.5" y1="7" x2="8.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="7" x2="12" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15.5" y1="7" x2="15.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChecklist() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10l2.5 2.5L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13.5 3.5l3 3L7 16.5H4v-3L13.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12 3H5a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V7.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3v4.5H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="7" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="14" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const TOOLS = [
  {
    id: "zoning-lookup",
    Icon: IconMap,
    title: "LA Zoning Lookup",
    description:
      "Pull zoning classification, setbacks, height limits, overlays, and lot coverage from ZIMAS. City of Los Angeles addresses only.",
    phase: "Phase 1",
    href: "/permits/zoning-lookup",
    sample: '"4567 Melrose Ave, Los Angeles, CA 90029"',
    howTo: [
      'Type the **full street address** including city, state, and zip — e.g. "4567 Melrose Ave, Los Angeles, CA 90029".',
      "Click **Lookup**. The system geocodes your address, queries LA ZIMAS, and returns a structured summary.",
      "Review the results: **zoning classification**, **setbacks** (front, rear, left, right), **height limit**, **max lot coverage**, and **overlays**.",
      "Copy setback and coverage values into the **Lot Calculator** for instant compliance checks.",
    ],
    dos: [
      "Use the full address with city, state, and zip for best geocoding accuracy.",
      "Cross-reference results with your title report or survey for final confirmation.",
    ],
    donts: [
      "Don't rely on these results as a legal survey — they are public record lookups only.",
      "Don't abbreviate the address — it may not geocode correctly.",
    ],
  },
  {
    id: "lot-calculator",
    Icon: IconRuler,
    title: "Lot Coverage Calculator",
    description:
      "Check lot coverage, FAR, and setback compliance against zoning rules — instant math, no AI.",
    phase: "Phase 1",
    href: "/permits/lot-calculator",
    sample: "Lot 50×120 ft, 1,200 sq ft footprint, setbacks 15/5/5/5 ft",
    howTo: [
      "Enter your **lot width and depth** in feet — this determines total lot area.",
      "Enter the **ground footprint** (first floor only) and **total floor area** across all floors.",
      "Enter your **proposed setbacks** from each property line.",
      "Enter **zoning rules** (max coverage %, max FAR, min setbacks). Get these from **LA Zoning Lookup** or the Lightbox **Zoning Report**.",
      "Click **Calculate** — results show pass/fail/warning badges for every compliance check.",
    ],
    dos: [
      "Run LA Zoning Lookup (or Lightbox Zoning Report for non-LA addresses) first and paste those numbers here for accurate checks.",
      "Enter footprint (ground floor) separately from total floor area (used for FAR).",
    ],
    donts: [
      "Don't confuse FAR with lot coverage — FAR includes all floors, coverage is ground floor only.",
      "Don't skip the zoning rules section — without correct limits, pass/fail is meaningless.",
    ],
  },
  {
    id: "checklist-generator",
    Icon: IconChecklist,
    title: "Document Checklist Generator",
    description:
      "Select your project type and qualifiers to get the exact LADBS forms, plan sheets, and supporting documents required.",
    phase: "Phase 1",
    href: "/permits/checklist-generator",
    sample: 'Project type: "Pool" + qualifiers: Hillside, Fire zone',
    howTo: [
      "Select your **project type**: Pool, ADU, Addition, Remodel, or New Construction.",
      "Add **qualifiers** that apply to your site — Hillside, Coastal zone, Fire zone, etc.",
      "Click **Generate Checklist**. The AI returns: Required Forms (with LADBS form numbers), Required Plan Sheets, and Supporting Documents.",
      "Use this checklist as your submission prep guide before assembling the package in **PDF Assembler**.",
    ],
    dos: [
      "Select all applicable qualifiers — missing one could mean missing a required form.",
      "Re-generate if your project scope changes.",
    ],
    donts: [
      "Don't assume the checklist is exhaustive for edge cases — confirm with LADBS for unusual project types.",
      "Don't skip qualifiers — a pool in a fire zone has different requirements than one on flat land.",
    ],
  },
  {
    id: "redline-drafter",
    Icon: IconEdit,
    title: "Redline Response Drafter",
    description:
      "Paste LADBS correction comments and get a professional draft response with action items per sheet.",
    phase: "Phase 2",
    href: "/permits/redline-drafter",
    sample: '"Sheet A-2: Provide setback dimensions from property line to pool edge."',
    howTo: [
      "Paste the **full correction comments** exactly as received from LADBS.",
      "Click **Draft Response**. The AI parses each correction and returns a structured breakdown.",
      "For each correction: original text, plain-language summary, draft response, affected sheets, and action required.",
      "A **cover letter** is generated at the bottom for your resubmission package.",
      "**Review and edit every draft** before using — add specific sheet references and actual changes made.",
    ],
    dos: [
      "Paste the entire correction letter — the AI uses context across all items.",
      "Edit drafts to include specifics (e.g. sheet number, detail callout, dimension added).",
    ],
    donts: [
      "Don't submit AI drafts without engineer review — the AI doesn't know what you actually changed.",
      "Don't paste unrelated text (email headers, signatures) — keep it to correction items only.",
    ],
  },
  {
    id: "pdf-assembler",
    Icon: IconFile,
    title: "PDF Document Assembler",
    description:
      "Upload individual PDFs, assign document types, and merge them into a single LADBS submission package.",
    phase: "Phase 3",
    href: "/permits/pdf-assembler",
    sample: "Application form + Site plan + Structural calcs → merged PDF",
    howTo: [
      "Drag & drop or click to upload PDFs (max 10 MB each).",
      "Assign a **document type** to each file — Application Form, Site Plan, Structural Calcs, etc.",
      "Remove any file using the remove button next to it.",
      "When you have at least 2 PDFs, click **Merge**. The system combines them in the order listed.",
      "Click **Download** to save the combined file named permit-package.pdf.",
    ],
    dos: [
      "Assign the correct document type — this ensures the merged package follows LADBS ordering.",
      "Check page counts after merging by opening the downloaded PDF.",
    ],
    donts: [
      "Don't upload non-PDF files — the assembler only accepts PDF format.",
      "Don't upload password-protected PDFs — they can't be read or merged.",
    ],
  },
];

/* ── Lightbox API (Trial) tools ── */

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="7.5" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7.5" y="13.5" width="5" height="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5v10M12.5 8c0-1.1-1.12-2-2.5-2s-2.5.9-2.5 2 1.12 2 2.5 2 2.5.9 2.5 2-1.12 2-2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCube() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L17.5 6.5v7L10 18l-7.5-4.5v-7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10v8M10 10l7.5-3.5M10 10L2.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const LIGHTBOX_TRIAL_BADGE = "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600";

const LIGHTBOX_TOOLS = [
  {
    id: "lightbox-property",
    Icon: IconBuilding,
    title: "Property & Owner Lookup",
    description: "Parcel details, owner info, land use, lot size, and recent transaction history.",
    href: "/permits/lightbox-property",
    sample: '"1556 Geyser St, Upland CA 91784"',
  },
  {
    id: "lightbox-zoning",
    Icon: IconMap,
    title: "Zoning Report",
    description: "Zoning code, setbacks, height limits, site coverage, and lot area minimums — nationwide.",
    href: "/permits/lightbox-zoning",
    sample: '"1556 Geyser St, Upland CA 91784"',
  },
  {
    id: "lightbox-assessment",
    Icon: IconDollar,
    title: "Assessment & Valuation",
    description: "Assessed values, AVM estimate, tax info, structure details, and loan history.",
    href: "/permits/lightbox-assessment",
    sample: '"1556 Geyser St, Upland CA 91784"',
  },
  {
    id: "lightbox-structure",
    Icon: IconCube,
    title: "Structure Details",
    description: "Building footprint area, height, stories, and ground elevation from Lightbox RE.",
    href: "/permits/lightbox-structure",
    sample: '"1556 Geyser St, Upland CA 91784"',
  },
];

const WORKFLOW = [
  {
    step: "1",
    title: "Start with an address",
    items: [
      "Use **Zoning Lookup** to pull parcel data, setbacks, overlays, and height limits from ZIMAS.",
      "Feed the zoning data into **Lot Calculator** to check coverage and FAR compliance.",
    ],
  },
  {
    step: "2",
    title: "Prepare your submission",
    items: [
      "Generate the exact LADBS **Document Checklist** for your project type — pool, ADU, addition, etc.",
    ],
  },
  {
    step: "3",
    title: "Handle corrections",
    items: [
      "Paste city correction comments into **Redline Drafter** to get professional response drafts per sheet.",
      "Merge all revised documents with **PDF Assembler** into a single resubmission package.",
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.07, ease: "easeOut" as const },
  }),
};

export default function PermitsDashboard() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 pb-16">
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="border-b border-slate-200 pb-8 pt-2"
      >
        <div className="flex items-center gap-3">
          <img src="/Calimingo.png" alt="Calimingo" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pool<span className="text-blue-600">Sight</span>AI — Permit Tools
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              AI-assisted tools for the LA permitting workflow — zoning lookups to correction response drafts.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tool grid */}
      <section aria-labelledby="tools-heading">
        <motion.h2
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          id="tools-heading"
          className="mb-6 text-lg font-semibold text-slate-900"
        >
          Tools
        </motion.h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.id}
              initial="hidden"
              animate="visible"
              custom={i}
              variants={fadeUp}
            >
              <Link
                href={t.href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                    <t.Icon />
                  </span>
                  <span className={PHASE_BADGE}>{t.phase}</span>
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                    {t.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500">{t.description}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sample input
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                    {t.sample}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Lightbox API (Trial) */}
      <section aria-labelledby="lightbox-heading">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={6}
          className="mb-6 flex items-center gap-3"
        >
          <h2 id="lightbox-heading" className="text-lg font-semibold text-slate-900">
            Lightbox API
          </h2>
          <span className={LIGHTBOX_TRIAL_BADGE}>{lightboxTrialLabel()}</span>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {LIGHTBOX_TOOLS.map((t, i) => (
            <motion.div
              key={t.id}
              initial="hidden"
              animate="visible"
              custom={i + 7}
              variants={fadeUp}
            >
              <Link
                href={t.href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-amber-200/60 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-600 transition-colors group-hover:bg-amber-100">
                    <t.Icon />
                  </span>
                  <span className={LIGHTBOX_TRIAL_BADGE}>{lightboxTrialLabel()}</span>
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900 group-hover:text-amber-700">
                    {t.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500">{t.description}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sample input
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                    {t.sample}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={6}
        aria-labelledby="workflow-heading"
        className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h2 id="workflow-heading" className="mb-6 text-lg font-semibold text-slate-900">
          How it works
        </h2>
        <ol className="space-y-6">
          {WORKFLOW.map((step) => (
            <li key={step.step} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {step.step}
              </span>
              <div className="pt-0.5">
                <p className="mb-1.5 text-sm font-semibold text-slate-900">{step.title}</p>
                <ul className="space-y-1">
                  {step.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-600"
                      dangerouslySetInnerHTML={{
                        __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium text-slate-900">$1</strong>'),
                      }}
                    />
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Per-tool how-to */}
      <section aria-labelledby="guides-heading">
        <motion.h2
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={7}
          id="guides-heading"
          className="mb-6 text-lg font-semibold text-slate-900"
        >
          Step-by-step guides
        </motion.h2>
        <div className="space-y-4">
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.id}
              id={`guide-${t.id}`}
              initial="hidden"
              animate="visible"
              custom={i + 8}
              variants={fadeUp}
              className="rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <span className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600">
                  <t.Icon />
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{t.title}</h3>
                </div>
                <span className={PHASE_BADGE}>{t.phase}</span>
              </div>

              <div className="px-6 py-5">
                <p className="mb-4 text-sm text-slate-600">{t.description}</p>

                <ol className="mb-5 space-y-2">
                  {t.howTo.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                        {idx + 1}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: step.replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium text-slate-900">$1</strong>'),
                        }}
                      />
                    </li>
                  ))}
                </ol>

                <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sample input
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-700">{t.sample}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Do</p>
                    <ul className="space-y-1.5">
                      {t.dos.map((d, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-slate-600">
                          <span className="mt-0.5 shrink-0 text-emerald-600">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-700">Don't</p>
                    <ul className="space-y-1.5">
                      {t.donts.map((d, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-slate-600">
                          <span className="mt-0.5 shrink-0 text-red-500">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={14}
        className="rounded-xl border border-blue-100 bg-blue-50 px-6 py-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Notes</h2>
        <ul className="space-y-2">
          {[
            "All AI outputs are drafts for engineer review — nothing is auto-submitted to LADBS.",
            "Zoning Lookup queries live LA GeoHub/ZIMAS data — results reflect the most recent public records.",
            "The Lot Calculator is pure math with no AI — enter your own zoning rules for instant compliance checks.",
            "If AI tools fail repeatedly, wait a moment and retry, or reduce the input size.",
          ].map((note, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              {note}
            </li>
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
