"use client";

const TOOLS = [
  {
    id: "zoning-lookup",
    icon: "🗺️",
    title: "Zoning & Parcel Lookup",
    description:
      "Enter an LA address to pull zoning classification, setbacks, height limits, overlays, and lot coverage from ZIMAS.",
    phase: "Phase 1",
    sample: {
      label: "Sample input",
      value: '"4567 Melrose Ave, Los Angeles, CA 90029"',
    },
    howTo: [
      "Open **Zoning Lookup** from the sidebar.",
      'In the address field, type the **full street address** including city, state, and zip — for example: "4567 Melrose Ave, Los Angeles, CA 90029".',
      "Click **Lookup**. The system geocodes your address, queries the LA ZIMAS database, and returns a structured summary.",
      "Review the results: **zoning classification** (e.g. R1, C2), **setbacks** (front, rear, left, right), **height limit**, **max lot coverage**, **overlays** (hillside, coastal, etc.), and **allowed uses**.",
      "All data comes from live LA GeoHub/ZIMAS records. Use these values as a starting point for the **Lot Calculator** or to verify your plan's compliance.",
    ],
    dos: [
      "Use the full address with city, state, and zip for best geocoding accuracy.",
      "Cross-reference results with your own title report or survey for final confirmation.",
      "Copy setback and coverage values into the Lot Calculator for instant compliance checks.",
    ],
    donts: [
      "Don't rely on these results as a legal survey — they are public record lookups, not a substitute for a licensed surveyor.",
      "Don't abbreviate the address (e.g. avoid \"4567 Melrose\" without the city) — it may not geocode correctly.",
    ],
  },
  {
    id: "lot-calculator",
    icon: "📏",
    title: "Lot Coverage Calculator",
    description:
      "Input lot dimensions and proposed structure to check lot coverage, FAR, and setback compliance against zoning rules.",
    phase: "Phase 1",
    sample: {
      label: "Sample input",
      value: "Lot 50×120 ft, 1,200 sq ft footprint, FAR 0.45, setbacks 15/5/5/5 ft",
    },
    howTo: [
      "Open **Lot Calculator** from the sidebar.",
      "Under **Lot Dimensions**, enter your lot width and depth in feet (e.g. 50 × 120). This determines total lot area.",
      "Under **Proposed Structure**, enter the building footprint in square feet and the proposed **FAR** (Floor Area Ratio). If you're unsure of the FAR, divide total floor area by lot area.",
      "Under **Proposed Setbacks**, enter how far your structure sits from each property line: front, rear, left side, and right side (in feet).",
      "Under **Zoning Rules**, enter the maximums and minimums from your zoning report: max lot coverage %, max FAR, and minimum setback distances. You can get these from the **Zoning Lookup** tool.",
      "Click **Calculate**. Results appear instantly with **pass/fail/warning** badges for lot coverage, FAR, and each setback. A summary sentence explains the overall compliance status.",
    ],
    dos: [
      "Get zoning rules from the Zoning Lookup tool first — then paste those numbers here for accurate compliance checks.",
      "Double-check that you're entering the structure footprint (ground floor only), not total floor area, for lot coverage.",
      "Use this tool early in design to catch setback violations before drafting plans.",
    ],
    donts: [
      "Don't confuse FAR with lot coverage — FAR includes all floors, lot coverage is ground floor footprint only.",
      "Don't skip the zoning rules section — without correct maximums/minimums, the pass/fail results won't be meaningful.",
    ],
  },
  {
    id: "checklist-generator",
    icon: "✅",
    title: "Document Checklist Generator",
    description:
      "Select your project type and get the exact LADBS forms, plan sheets, and supporting documents required.",
    phase: "Phase 1",
    sample: {
      label: "Sample input",
      value: 'Project type: "Pool" + qualifiers: Hillside, Fire zone',
    },
    howTo: [
      "Open **Checklist Generator** from the sidebar.",
      "Select your **project type** by clicking one of the options: Pool, ADU, Addition, Remodel, or New Construction. The selected type highlights in blue.",
      "Optionally add **qualifiers** that apply to your site — such as Hillside, Historic district, Coastal zone, Fire zone, HOA/CC&R, Solar panels, EV charger, or Grading required. Select as many as apply; each one may add specific forms or requirements.",
      "Click **Generate Checklist**. The AI produces a full breakdown organized into three sections: **Required Forms** (with LADBS form numbers), **Required Plan Sheets** (site plan, floor plan, elevations, etc.), and **Supporting Documents** (soils report, Title 24, structural calcs, etc.).",
      "Each item shows whether it's required or optional, plus any notes. At the bottom you'll see an **estimated review time** from LADBS.",
      "Use this checklist as your submission prep guide — check off each item as you complete it before assembling the final package in the **PDF Assembler**.",
    ],
    dos: [
      "Select all applicable qualifiers — missing one (e.g. Hillside) could mean missing a required form.",
      "Save or screenshot the checklist so your team has a reference while preparing documents.",
      "Re-generate if your project scope changes (e.g. adding solar panels to a pool project).",
    ],
    donts: [
      "Don't assume the checklist is exhaustive for edge cases — always confirm with LADBS for unusual project types.",
      "Don't skip the qualifiers step — a pool in a fire zone has different requirements than a pool on flat land.",
    ],
  },
  {
    id: "drawing-analyzer",
    icon: "📐",
    title: "Drawing Analyzer",
    description:
      "Upload a plan sheet, rendering, or hand sketch. The AI extracts dimensions, room areas, setbacks, and flags unclear items.",
    phase: "Phase 2",
    sample: {
      label: "Sample input",
      value: "JPEG/PNG of a site plan, floor plan, or VIP3D rendering",
    },
    howTo: [
      "Open **Drawing Analyzer** from the sidebar.",
      "Click the upload area or drag & drop a file. Accepted formats are **JPEG** and **PNG** (max 10 MB). This can be a scan of a plan sheet, a VIP3D rendering, a CAD export, or even a photo of a hand sketch.",
      "Once the file appears, click **Analyze**. The AI reads the image and extracts structured data.",
      "Review the results organized into tables: **Dimensions** (label, value, unit), **Rooms** (name, square footage), and **Setbacks** (side, distance). Each row has a **confidence badge** — green for high, yellow for medium, red for low.",
      "Check the **Flagged Items** section — these are items the AI could not read clearly or is less than 70% confident about. These need manual verification before you rely on them.",
      "The **Notes** section contains general observations the AI made about the drawing (scale, orientation, missing information, etc.).",
    ],
    dos: [
      "Use clear, high-resolution images — 300 DPI scans or crisp screenshots work best.",
      "Include the scale bar or scale note in your image so the AI can interpret dimensions correctly.",
      "Review every flagged item manually — if a dimension is flagged low-confidence, measure it yourself.",
    ],
    donts: [
      "Don't upload blurry photos or low-resolution screenshots — the AI can't extract what it can't read.",
      "Don't treat AI-extracted dimensions as final — always verify against the original drawing before submitting to LADBS.",
      "Don't upload PDFs directly — convert to PNG or JPEG first (the image block only supports raster formats).",
    ],
  },
  {
    id: "redline-drafter",
    icon: "🔴",
    title: "Redline Response Drafter",
    description:
      "Paste LADBS correction comments and get a professional draft response with action items per sheet.",
    phase: "Phase 2",
    sample: {
      label: "Sample input",
      value:
        '"Sheet A-2: Provide setback dimensions from property line to pool edge."',
    },
    howTo: [
      "Open **Redline Drafter** from the sidebar.",
      "In the text box, **paste the full correction comments** exactly as received from LADBS. Include all correction items — the AI handles parsing and separating them automatically.",
      "Click **Draft Response**. The AI processes each correction and returns a structured breakdown.",
      "For each correction you'll see: the **original text** from LADBS, a **plain-language summary** explaining what they're asking for, a **draft professional response**, the **affected sheets** (e.g. Sheet A-2, Sheet S-1), and the **action required** (what your team needs to do).",
      "At the bottom, a **cover letter** is generated that you can include with your resubmission package.",
      "**Review and edit every draft** before using it. Adjust the language, add specifics about what was changed, and confirm the affected sheets are correct.",
    ],
    dos: [
      "Paste the entire correction letter — don't cherry-pick items, as the AI uses context across corrections.",
      "Edit the draft responses to include specifics (e.g. \"Setback dimension of 5'-0\" added to Sheet A-2, Detail 3\").",
      "Use the cover letter as a starting point and personalize it with your project name, permit number, and date.",
    ],
    donts: [
      "Don't submit AI-drafted responses without engineer review — the AI doesn't know what changes you actually made to the plans.",
      "Don't leave generic language in the responses — LADBS reviewers expect specific sheet/detail references.",
      "Don't paste unrelated text (emails, headers, signatures) — keep it to the correction items only for best results.",
    ],
  },
  {
    id: "site-plan-generator",
    icon: "✏️",
    title: "Rendering to Site Plan",
    description:
      "Upload a client rendering or sketch. AI interprets features, engineer confirms, then generates SVG diagram, DXF file, and drafting brief.",
    phase: "Phase 2",
    sample: {
      label: "Sample input",
      value: "JPEG/PNG of a pool rendering or concept sketch (VIP3D, hand drawing, etc.)",
    },
    howTo: [
      "Open **Rendering to Site Plan** from the sidebar.",
      "Click the upload area or drag & drop a file. Accepted formats: **JPEG**, **PNG**, or **PDF** (up to 20 MB). This should be a client rendering, concept sketch, or photo of a hand drawing showing the proposed pool project.",
      "The AI analyzes the image and extracts every visible feature — pool shape, spa, decking, equipment pads, fencing, retaining walls, water features, and more. Each feature gets a **confidence badge** and estimated dimensions based on visual references.",
      "You enter **Stage 1 — Review**. Go through each detected feature: click **Confirm** to approve it, **Edit** to change the type, label, or dimensions, or **Remove** to delete it. You can also click **Add Feature Manually** to add anything the AI missed.",
      "All features must show a green **Confirmed** badge before you can proceed. The progress bar shows \"{confirmed} of {total} features confirmed\".",
      "Click **Proceed to Dimensions** to enter **Stage 2**. Here you input known lot dimensions (width, depth), house footprint, setbacks, and north orientation. You can also enter exact dimensions for each feature — these override the AI estimates.",
      "The **live SVG preview** on the right updates as you type. It shows the property boundary, house footprint, setback lines, and all confirmed features to scale.",
      "Click **Generate Site Plan**. The system produces three outputs: an **SVG diagram** (top-down site plan), a **DXF file** (AutoCAD-compatible), and a **data sheet** (materials schedule, action items, and drafting brief).",
      "Download all three files using the buttons at the bottom. The SVG and DXF include a watermark: \"AI-GENERATED DRAFT — ENGINEER REVIEW REQUIRED\".",
    ],
    dos: [
      "Use clear, detailed renderings — the more visible features, the better the AI interpretation.",
      "Confirm or correct every feature before generating — the output only includes confirmed items.",
      "Enter exact dimensions when you have them — the AI estimates are approximate and based on visual references only.",
      "Review the data sheet action items — they flag missing info and things to verify before submitting.",
    ],
    donts: [
      "Don't skip the review stage — the AI may misidentify features or miss items entirely.",
      "Don't treat the SVG/DXF output as permit-ready — it's a draft for the engineer to refine in CAD.",
      "Don't upload blurry or low-resolution images — the AI needs clear visual detail to detect features.",
      "Don't submit AI-generated files to LADBS — they must be reviewed, refined, and stamped by a licensed professional.",
    ],
  },
  {
    id: "pdf-assembler",
    icon: "📄",
    title: "PDF Document Assembler",
    description:
      "Upload individual PDFs and merge them in the correct LADBS submission order into one package.",
    phase: "Phase 3",
    sample: {
      label: "Sample input",
      value: "Application form PDF + Site plan PDF + Structural calcs PDF → merged",
    },
    howTo: [
      "Open **PDF Assembler** from the sidebar.",
      "Click the upload area or drag & drop to add a PDF (max 10 MB each). Repeat to add as many PDFs as you need — each appears in a list below the upload area.",
      "For each uploaded file, use the **dropdown** to assign a document type: Application Form, Site Plan, Floor Plan, Elevation, Structural Calcs, Title 24, Soils Report, Plot Plan, or Other. This helps organize the final package in the correct LADBS submission order.",
      "Remove any file by clicking the **✕** button next to it.",
      "When you have at least 2 PDFs, click **Merge**. The system combines them into a single PDF in the order listed.",
      "Click **Download Merged PDF** to save the combined file to your computer. The file is named \"permit-package.pdf\" by default.",
    ],
    dos: [
      "Assign the correct document type to each PDF — this ensures the merged package follows LADBS ordering expectations.",
      "Double-check page counts after merging by opening the downloaded PDF — make sure no pages were lost.",
      "Use this as the final step after preparing all documents with the other tools.",
    ],
    donts: [
      "Don't upload non-PDF files — the assembler only accepts PDF format.",
      "Don't merge before all documents are finalized — if you update a plan sheet later, you'll need to re-merge.",
      "Don't upload password-protected PDFs — they can't be read or merged.",
    ],
  },
];

export default function PermitsDashboard() {
  return (
    <div
      className="-m-8 h-[calc(100%+4rem)] overflow-y-auto overflow-x-hidden snap-y snap-mandatory"
      role="region"
      aria-label="Permit Tools"
    >
      {/* Hero */}
      <section className="relative flex min-h-full snap-start flex-col items-center justify-center bg-slate-950 px-8 py-12 text-center text-white">
        <img
          src="/Calimingo.png"
          alt="Calimingo"
          className="mb-4 h-20 w-20 object-contain"
        />
        <h1 className="mb-2 text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
          Pool<span className="text-sky-400">Sight</span>AI
        </h1>
        <p className="mb-1 text-lg text-slate-300">
          Permit Tools
        </p>
        <p className="max-w-xl text-sm text-slate-500">
          AI-assisted tools for the LA permitting workflow — from zoning
          lookups to correction response drafts.
        </p>

        <div
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-xs text-slate-200">
            Scroll down <span>↓</span>
          </span>
        </div>
      </section>

      {/* How it works */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-900 px-8 py-8 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <div className="max-w-2xl text-left text-slate-200">
          <ol className="ml-4 list-decimal space-y-3 text-sm leading-snug">
            <li>
              <strong className="text-white">Start with an address</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                <li>Use <strong className="text-white">Zoning Lookup</strong> to pull parcel data, setbacks, overlays, and height limits from ZIMAS.</li>
                <li>Feed the zoning data into the <strong className="text-white">Lot Calculator</strong> to check coverage and FAR compliance.</li>
              </ul>
            </li>
            <li>
              <strong className="text-white">Prepare your submission</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                <li>Generate the exact LADBS <strong className="text-white">Document Checklist</strong> for your project type (pool, ADU, addition, etc.).</li>
                <li>Upload plan sheets to the <strong className="text-white">Drawing Analyzer</strong> to extract dimensions and flag unclear items before submission.</li>
              </ul>
            </li>
            <li>
              <strong className="text-white">Handle corrections</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                <li>Paste city correction comments into the <strong className="text-white">Redline Drafter</strong> to get professional response drafts with action items per sheet.</li>
                <li>Merge all revised documents with the <strong className="text-white">PDF Assembler</strong> into a single resubmission package.</li>
              </ul>
            </li>
          </ol>
        </div>
      </section>

      {/* Tool cards — anchor to how-to sections below */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-950 px-8 py-12 text-white">
        <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
          Tools
        </h2>
        <div className="grid w-full max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <a
              key={t.id}
              href={`#howto-${t.id}`}
              className="group relative flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-all hover:border-sky-700 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {t.phase}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-sky-400">
                {t.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                {t.description}
              </p>
              <div className="mt-auto rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t.sample.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-300">
                  {t.sample.value}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Per-tool how-to sections */}
      {TOOLS.map((t) => (
        <section
          key={t.id}
          id={`howto-${t.id}`}
          className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-900 px-8 py-10 text-white"
        >
          <div className="w-full max-w-2xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">{t.icon}</span>
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {t.title}
                </h2>
                <span className="text-xs text-slate-500">{t.phase}</span>
              </div>
            </div>

            <p className="mb-4 text-sm text-slate-300">{t.description}</p>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Step-by-step
            </h3>
            <ol className="ml-4 list-decimal space-y-1.5 text-sm leading-relaxed text-slate-200">
              {t.howTo.map((step, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
              ))}
            </ol>

            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t.sample.label}
              </span>
              <span className="mt-1 block text-sm text-slate-300">
                {t.sample.value}
              </span>
            </div>

            {/* Do's and Don'ts */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded border border-emerald-900/50 bg-emerald-950/20 px-3 py-2">
                <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-600">Do&apos;s</h4>
                <ul className="space-y-0.5 text-[11px] leading-snug text-slate-400">
                  {t.dos.map((d, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="text-emerald-600">✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2">
                <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-red-600">Don&apos;ts</h4>
                <ul className="space-y-0.5 text-[11px] leading-snug text-slate-400">
                  {t.donts.map((d, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="text-red-600">✗</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Tips & notes */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-950 px-8 py-12 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Tips & notes
        </h2>
        <div className="max-w-2xl">
          <ul className="space-y-3 text-left text-sm text-slate-200" role="list">
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                All AI outputs are <strong>drafts for engineer review</strong> — nothing is auto-submitted to LADBS.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                The <strong>Drawing Analyzer</strong> works best with clear, high-resolution images. Low-confidence items are automatically flagged in yellow/red.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                <strong>Zoning Lookup</strong> queries live LA GeoHub/ZIMAS data — results reflect the most recent public records.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                The <strong>Lot Calculator</strong> is pure math (no AI) — enter your own zoning rules for instant compliance checks.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-amber-400">•</span>
              <span>
                <strong>Large images</strong> may take longer to analyze. For best results, keep uploads under 10 MB.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-amber-400">•</span>
              <span>
                <strong>Rate limits</strong> — If AI tools fail repeatedly, wait a moment and retry, or reduce the input size.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* About */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-900 px-8 py-12 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          About Permit Tools
        </h2>
        <div className="max-w-2xl space-y-4 text-center text-slate-300">
          <p>
            The Permit Tools module streamlines the LA permitting workflow for pool and residential construction projects.
            From initial zoning research to correction resubmission, each tool targets a specific bottleneck in the process.
          </p>
          <p className="text-sm text-slate-500">
            Built on the same AI infrastructure as PoolSightAI&apos;s construction progress analysis — Anthropic Claude vision for drawings, structured JSON output for every tool, and engineer-reviewed results at every step.
          </p>
        </div>
      </section>
    </div>
  );
}
