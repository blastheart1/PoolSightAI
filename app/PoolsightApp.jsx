"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TrelloDashboard from "../components/TrelloDashboard";
import ProjectsPage from "./projects/page";

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const NAV = [
  { id: "welcome", label: "Welcome", icon: "🏊" },
  { id: "trello", label: "Trello", icon: "🗂️" },
  { id: "projects", label: "Projects", icon: "📁" },
  { id: "plan", label: "Project Plan", icon: "📋" },
  { id: "permits", label: "Permit Tools", icon: "📝", href: "/permits" },
];

const TAG_WIDTH_CLASS = "min-w-[88px]"; // shared fixed width for badges

const pLabel = {
  critical: "Critical",
  important: "Important",
  nice: "Nice to Have",
};

// Force a direct reference so eslint counts `motion` as used even
// when it's only referenced inside JSX member expressions (<motion.div />).
const MotionDiv = motion.div;

const PM_UPDATE_SUGGESTIONS = [
  { id: "tile_pickup", label: "Tile ready", text: "Tile is ready for pickup and installation is expected this week." },
  { id: "tile_schedule", label: "Tile schedule", text: "Tile work is scheduled for later this week or early next week." },
  { id: "debris_removal", label: "Debris removal", text: "Concrete debris removal was assigned and should be confirmed complete on site." },
  { id: "rough_in_done", label: "Rough-in complete", text: "Electrical/plumbing rough-in appears complete and ready for verification photos." },
  { id: "awaiting_finish", label: "Awaiting finish", text: "Finish-stage work should remain on hold until prerequisites are photo-verified complete." },
];

const SLIDES = [
  {
    id: 1,
    section: "Cover",
    title: "AI-Assisted Permitting Strategy Report",
    subtitle: "Presentation 2",
    type: "cover",
    bullets: [],
    note:
      "Prepared for Jesse at Calimingo Pools. This presentation recommends the most practical AI strategy for streamlining permitting: augment the engineering team with tools and a lightweight internal system, rather than pursuing full automation.",
  },
  {
    id: 2,
    section: "Executive Summary",
    title: "The Best Strategy Is Augmentation",
    subtitle: "Build tools around the team, not around the fantasy of full automation",
    type: "bullets",
    bullets: [
      {
        icon: "⚡",
        head: "Highest return, lowest risk",
        body: "The most effective approach is to equip the existing engineering team with AI tools and a lightweight internal project management system.",
      },
      {
        icon: "🗓️",
        head: "Operational in weeks",
        body: "This path can be delivered in weeks rather than months or years, and it starts producing value immediately.",
      },
      {
        icon: "🧠",
        head: "Humans stay in the loop",
        body: "AI should speed up analysis, drafting, and organization, but licensed engineers still make the final calls.",
      },
      {
        icon: "🛠️",
        head: "Internal system wins",
        body: "A simple intake, tracking, prompt, and document hub becomes the durable operating advantage.",
      },
    ],
    note:
      "The core conclusion is straightforward: full automation is not the right bet right now, but AI-assisted workflows are immediately useful and economically sensible.",
  },
  {
    id: 3,
    section: "The Problem",
    title: "What We Set Out to Solve",
    subtitle: "Can AI streamline permitting from sketch to submittal?",
    type: "bullets",
    bullets: [
      {
        icon: "✍️",
        head: "Convert hand drawings into permit-ready plans",
        body: "The idea was to turn sketches and marked-up drawings into plan sets that can move through the permitting workflow faster.",
      },
      {
        icon: "🧾",
        head: "Automate form filling and lookups",
        body: "We evaluated whether AI could fill forms, pull ZIMAS zoning data, and reduce repetitive administrative work.",
      },
      {
        icon: "📤",
        head: "Submit directly to LADBS",
        body: "We also checked whether document submission to LADBS ePlan could be automated end-to-end.",
      },
      {
        icon: "📈",
        head: "Reduce time and cost at scale",
        body: "The goal was to see if the permitting process could become cheaper, faster, and less dependent on manual coordination.",
      },
    ],
    note:
      "This is the right question to ask. The answer, however, is that the hard parts of permitting are still dominated by judgment, liability, and process constraints that AI cannot remove.",
  },
  {
    id: 4,
    section: "Findings",
    title: "Why Full Automation Is Not Viable Right Now",
    subtitle: "The blockers are structural, not just technical",
    type: "bullets",
    bullets: [
      {
        icon: "🎯",
        head: "Reliability gap",
        body: "AI may read hand drawings at roughly 70–85% accuracy, but legal permitting documents require near-perfect reliability.",
      },
      {
        icon: "⚖️",
        head: "Human interpretation wins",
        body: "LADBS plan checkers apply judgment and discretion that AI cannot predict or replicate reliably.",
      },
      {
        icon: "🛡️",
        head: "Liability remains with licensed staff",
        body: "No insurance covers AI-generated construction documents, so engineers would still need to verify and stamp the output they stand behind.",
      },
      {
        icon: "🚫",
        head: "No public LADBS API",
        body: "The ePlan / ProjectDox workflow is not API-friendly, which makes true automation fragile and potentially out of policy.",
      },
      {
        icon: "📚",
        head: "Code interpretation changes case by case",
        body: "AI can read the rule, but it cannot reliably anticipate how a specific plan checker will interpret the rule on a specific project.",
      },
    ],
    note:
      "These limitations are why a direct drawing-to-permit automation product would be expensive to build, hard to trust, and difficult to maintain.",
  },
  {
    id: 5,
    section: "Findings",
    title: "The Market Confirms the Same Lesson",
    subtitle: "The closest examples all stopped short of full automation",
    type: "bullets",
    bullets: [
      {
        icon: "🏗️",
        head: "Existing companies have not cracked it",
        body: "Hypar, Maket.ai, Archistar, and Symbium all illustrate how hard the problem is when real permitting judgment is involved.",
      },
      {
        icon: "🔎",
        head: "The hard part is the ambiguity",
        body: "Permitting work requires interpreting messy sketches, spotting easement conflicts, and knowing when to ask a plan checker before submission.",
      },
      {
        icon: "🧩",
        head: "Symbium succeeded by narrowing scope",
        body: "Their strongest results came from restricted, pre-approved ADU plan sets, which removes much of the hard problem entirely.",
      },
    ],
    note:
      "The market signal matters: the winning approaches are constrained, scoped, and human-supervised, not fully autonomous from the start.",
  },
  {
    id: 6,
    section: "Recommendation",
    title: "Recommended Strategy",
    subtitle: "Equip the existing engineering team. Don’t replace them.",
    type: "bullets",
    bullets: [
      {
        icon: "👷",
        head: "Keep the engineering team central",
        body: "Calimingo Pools already has the right people. AI should make them faster, not try to work around them.",
      },
      {
        icon: "🤖",
        head: "Use AI as a co-pilot",
        body: "A skilled engineer using Claude or ChatGPT can handle 3–5x more projects than one working entirely manually.",
      },
      {
        icon: "📎",
        head: "Build a lightweight project hub",
        body: "The highest-value internal build is a simple system that tracks intake, status, prompts, documents, and corrections in one place.",
      },
    ],
    note:
      "This is the practical middle ground: the team keeps ownership of judgment and liability, while AI removes the repetitive work around it.",
  },
  {
    id: 7,
    section: "Stack",
    title: "Recommended AI Stack",
    subtitle: "Practical tools with a low monthly footprint",
    type: "table",
    tableData: {
      headers: ["Tool", "Purpose", "Cost"],
      rows: [
        ["Claude Pro", "Drawing interpretation, form drafting, code questions", "$20/user/mo"],
        ["ChatGPT Pro", "Additional analysis and live web lookups", "$20/user/mo"],
        ["Adobe Acrobat", "Filling and signing LADBS PDF forms", "$20/user/mo"],
        ["SketchUp Free", "Light site plan drawing and cleanup", "$0"],
        ["ZIMAS", "LA zoning lookups", "$0"],
        ["Airtable or Notion", "Project tracking and document organization", "$0–$10/user/mo"],
      ],
      highlight: 0,
    },
    oneTimeFees: [
      { item: "Setup and workflow definition", amount: "$0–low", note: "Mostly process design and team adoption" },
      { item: "Internal tool build", amount: "Limited", note: "A lightweight system is the only custom development worth prioritizing" },
    ],
    hosting: [
      { option: "Total team tools", cost: "~$60–$70/user/month", note: "Enough for serious augmentation without a big platform bet" },
      { option: "Local / lightweight backend", cost: "Low", note: "Keep infrastructure simple until real bottlenecks are proven" },
    ],
    devTools: [
      { name: "Prompt library", cost: "$0", benefit: "Reusable, team-specific prompts become the operational playbook" },
      { name: "Document hub", cost: "$0–low", benefit: "Centralizes files, notes, and status in one workflow" },
      { name: "Reminder automation", cost: "Low", benefit: "Helps nothing fall through the cracks" },
    ],
    note:
      "The goal is not to add dozens of tools. The goal is to give engineers a small, dependable stack that removes friction and keeps work moving.",
  },
  {
    id: 8,
    section: "Project Hub",
    title: "The One Thing Worth Building",
    subtitle: "A lightweight internal project management and document hub",
    type: "nextsteps",
    steps: [
      {
        num: "01",
        label: "Project intake portal",
        body: "Clients submit drawings, project details, and contacts in one place, with a checklist generated automatically by project type.",
      },
      {
        num: "02",
        label: "Pipeline status tracker",
        body: "Every project gets a clear stage view showing what is waiting on the engineer, client, or city, plus deadline reminders.",
      },
      {
        num: "03",
        label: "Internal prompt library",
        body: "The best Claude and ChatGPT prompts are saved and organized by task, so the team reuses what works instead of starting over.",
      },
      {
        num: "04",
        label: "Document assembly",
        body: "Once the engineer is done, the system packages files into the correct LADBS-ready format, names them correctly, and checks the submission bundle.",
      },
      {
        num: "05",
        label: "Redline and correction tracker",
        body: "Every city correction is logged so patterns emerge over time and the team builds a defensible internal knowledge base.",
      },
    ],
    note:
      "This hub is the highest-leverage build because it improves the work that already happens every day instead of trying to replace it.",
  },
  {
    id: 9,
    section: "Timeline",
    title: "Project Hub Build Timeline",
    subtitle: "Phased, sustainable, and realistic for a single developer",
    type: "roadmap",
    phases: [
      { num: "P1", title: "Foundation", timeline: "Months 1–2", tag: "Immediate value", color: "#1d4ed8" },
      { num: "P2", title: "Intelligence Layer", timeline: "Months 3–4", tag: "Workflow speed", color: "#059669" },
      { num: "P3", title: "Document & Submission Layer", timeline: "Months 5–6", tag: "Scale support", color: "#7c3aed" },
    ],
    note:
      "The timeline reflects real constraints: one developer, ongoing work, and a need to deliver value in the first month rather than waiting for the whole system to be complete.",
  },
  {
    id: 10,
    section: "Timeline",
    title: "What Each Phase Delivers",
    subtitle: "The system grows in useful layers, not as a giant all-at-once build",
    type: "bullets",
    bullets: [
      {
        icon: "1️⃣",
        head: "Phase 1: intake + status tracking",
        body: "Get the basics running first: intake form, project tracker, document structure, and parallel use of Claude Pro and Adobe Acrobat.",
      },
      {
        icon: "2️⃣",
        head: "Phase 2: prompt library + automation",
        body: "Add the reusable prompts, ZIMAS lookups, checklist generation, and reminder automation that make engineers faster.",
      },
      {
        icon: "3️⃣",
        head: "Phase 3: documents + redlines",
        body: "Finish the workflow with assembly, correction tracking, final submission checks, and refinement based on real usage.",
      },
    ],
    note:
      "Each phase is valuable on its own, which keeps the team moving even if the build takes longer than expected.",
  },
  {
    id: 11,
    section: "Cost Comparison",
    title: "Cost Comparison",
    subtitle: "The better strategy is also the cheaper one to start",
    type: "cost",
    tiers: [
      { label: "Full AI automation", ai: "$150K–$400K", infra: "High maintenance", total: "18–24 months" },
      { label: "Custom AI drawing tools", ai: "$50K–$100K", infra: "Medium", total: "6–12 months" },
      { label: "Equipped team + project hub", ai: "$5K–$20K", infra: "$60–$70/user", total: "4–8 weeks" },
    ],
    note:
      "This is the clearest decision point in the report: the recommended path is much faster to deploy, much cheaper to start, and much more reliable in real permitting work.",
  },
  {
    id: 12,
    section: "Why This Wins",
    title: "Why This Is the Right Move",
    subtitle: "The strategy is practical, defensible, and future-ready",
    type: "bullets",
    bullets: [
      { icon: "⏩", head: "Speed to value", body: "Operational in weeks, not years." },
      { icon: "🧯", head: "Low risk", body: "No large upfront technology bet. Start small and iterate from real friction." },
      { icon: "✅", head: "High reliability", body: "Human judgment stays in the loop where it matters most." },
      { icon: "📈", head: "Scalable", body: "Add engineers using the same system as volume grows." },
      { icon: "🏰", head: "Defensible", body: "The playbook, relationships, and institutional knowledge are harder to copy than software." },
      { icon: "🔭", head: "Future-ready", body: "Targeted automation can be added later when bottlenecks become clear from real data." },
    ],
    note:
      "This is not anti-AI. It is the smartest way to use AI today so the company can earn compounding benefits without overbuilding.",
  },
  {
    id: 13,
    section: "Not Recommended",
    title: "What We Do Not Recommend Right Now",
    subtitle: "Hold these ideas until workflow maturity and data justify them",
    type: "bullets",
    bullets: [
      {
        icon: "🧱",
        head: "Custom CAD / DXF generation tools",
        body: "These are expensive to build and too risky to automate before the underlying workflow is stable.",
      },
      {
        icon: "📝",
        head: "Automated LADBS form-filling pipelines",
        body: "Form filling can be assisted, but full automation is not justified yet.",
      },
      {
        icon: "🕷️",
        head: "ePlan submission via portal scraping",
        body: "Fragile, policy-sensitive, and likely to create more maintenance than value.",
      },
      {
        icon: "🔌",
        head: "AutoCAD / Revit API investment for AI-driven output",
        body: "Useful later, but not the right first investment for this stage of the business.",
      },
    ],
    note:
      "These ideas may matter in the future, but not before the team has better data and a smoother internal workflow.",
  },
  {
    id: 14,
    section: "Next Steps",
    title: "Immediate Next Steps",
    subtitle: "Simple actions for the next week",
    type: "nextsteps",
    steps: [
      {
        num: "01",
        label: "Subscribe the engineering team",
        body: "Give the team access to Claude Pro and Adobe Acrobat so they can start using the recommended workflow immediately.",
      },
      {
        num: "02",
        label: "Set up a tracker this week",
        body: "Use Airtable or Notion to create a basic project tracker and document hub right away.",
      },
      {
        num: "03",
        label: "Run real projects through the workflow",
        body: "Test the assisted process on 10–20 live projects to see where the friction and the value really are.",
      },
      {
        num: "04",
        label: "Document prompts and bottlenecks",
        body: "Capture every prompt that works, every correction pattern, and every step that slows the team down.",
      },
      {
        num: "05",
        label: "Revisit in 6 months",
        body: "Use actual project data to decide whether any specific automation deserves deeper investment.",
      },
    ],
    note:
      "The next steps are intentionally concrete so the team can start capturing value without waiting for a larger platform build.",
  },
  {
    id: 15,
    section: "Conclusion",
    title: "Conclusion",
    subtitle: "AI should make the team more capable, not disappear from the process",
    type: "bullets",
    bullets: [
      {
        icon: "🎯",
        head: "The goal was augmentation",
        body: "The point was never to remove engineers from permitting, but to make them more efficient and more effective.",
      },
      {
        icon: "🧩",
        head: "The right system already exists conceptually",
        body: "Claude, ChatGPT, Acrobat, a simple tracker, and an internal playbook can deliver a real advantage today.",
      },
      {
        icon: "🏆",
        head: "The engineers are the product",
        body: "With the right tools and workflow, the team itself becomes the differentiator Calimingo Pools can build around.",
      },
    ],
    note:
      "The final takeaway is that the best competitive advantage is not a risky automation bet — it is a disciplined, AI-assisted engineering workflow that compounds over time.",
  },
];

const PHASES = [
  { id:1, num:"Phase 1", color:"#1a56db", title:"Drag & Drop → AI → Structured Output", timeline:"1–2 weeks", priority:"Critical",
    context:"Proves the core concept works. By the end of this phase, anyone on the team can upload photos from a job site and receive a structured billing report with phase progress, detected milestones, and actionable flags — all in under 30 seconds. No backend, no logins required. This is the demo you can put in front of a client.",
    outcomes:["Working drag & drop web tool","AI-generated phase progress table","Billing milestone detection","Actionable insights + safety flags"],
    items:[{label:"Multi-image drag & drop uploader",p:"critical"},{label:"Image preprocessing (resize + compress)",p:"critical"},{label:"Claude Haiku vision + structured JSON output",p:"critical"},{label:"Dynamic phase progress table",p:"critical"},{label:"Billing milestone summary",p:"critical"},{label:"Actionable insights + risk flags",p:"critical"},{label:"Export to PDF / copy report",p:"nice"}]},
  { id:2, num:"Phase 2", color:"#059669", title:"Trello Integration (Read-Only)", timeline:"1–2 weeks after P1", priority:"Critical",
    context:"Eliminates manual uploads entirely. Field teams continue using Trello as normal — PoolSight AI reads today's new photos automatically. A single button pull processes all submissions across all projects for the day. Trello access is strictly read-only at the API token level, so nothing can be modified or deleted.",
    outcomes:["Zero-friction field team workflow","One-click daily batch processing","Read-only Trello connection (no write risk)","Per-card results tied to source data"],
    items:[{label:"Trello API connection — scope=read only",p:"critical"},{label:"Board → List → Card → Project mapping",p:"critical"},{label:"Date-filtered attachment pull (today only)",p:"critical"},{label:"Manual 'Process Today's Submissions' trigger",p:"critical"},{label:"Image preview before AI processing",p:"important"},{label:"GET-only enforcement at code level",p:"critical"}]},
  { id:3, num:"Phase 3", color:"#7c3aed", title:"Contextual Memory & Project Tracking", timeline:"2–4 weeks after P2", priority:"Critical",
    context:"This is where PoolSight AI becomes truly intelligent. The system now remembers every prior submission per project, so each new analysis compares against history — telling you exactly what advanced, what regressed, and what billing milestones were newly reached. PMs get a single dashboard for all active projects with a full audit trail.",
    outcomes:["Per-project submission history & timeline","Delta reports: 'Gunite went from 50% → 85%'","Cumulative billing ledger per project","PM approval gate before any billing trigger"],
    items:[{label:"User accounts & authentication",p:"critical"},{label:"Per-project dashboard + submission history",p:"critical"},{label:"Persistent analysis storage (Supabase)",p:"critical"},{label:"Delta reports vs. previous submissions",p:"critical"},{label:"Cumulative billing tracker",p:"critical"},{label:"Submission approval & locking",p:"important"},{label:"Anomaly / regression detection",p:"important"}]},
  { id:4, num:"Phase 4", color:"#d97706", title:"Trello Automation & Scheduling", timeline:"3–5 weeks after P3", priority:"Important",
    context:"Removes the last manual step. Instead of someone clicking 'Process Today's Submissions', a scheduled job runs automatically at the end of each day. Zapier handles the automation glue — triggering analysis when a Trello attachment is added and routing billing alerts to Slack or email. PMs are notified when approval is needed.",
    outcomes:["Fully automated daily processing","Zapier-powered Trello → AI trigger","Email & Slack notifications for billing triggers","Zero manual intervention on normal days"],
    items:[{label:"Scheduled polling via cron job",p:"important"},{label:"Zapier trigger on new Trello attachment",p:"important"},{label:"Email / Slack notifications via Zapier",p:"important"},{label:"Admin override for re-processing",p:"important"}]},
  { id:5, num:"Phase 5", color:"#dc2626", title:"Reporting, Exports & Vendor Portal", timeline:"Ongoing", priority:"Important",
    context:"Turns AI output into client-ready deliverables. PMs can generate a polished PDF, export billing data to a spreadsheet, or share a read-only portal link directly with the vendor or homeowner. Zapier bridges approved milestones to QuickBooks for automated invoice creation — no native integration required.",
    outcomes:["One-click PDF progress reports","CSV/Excel billing export for accounting","Shareable vendor portal link","Zapier → QuickBooks invoice automation"],
    items:[{label:"PDF report generation",p:"important"},{label:"CSV / Excel billing export",p:"important"},{label:"PM approval workflow",p:"important"},{label:"Vendor read-only report portal",p:"nice"},{label:"Zapier → QuickBooks integration",p:"nice"},{label:"Analytics dashboard",p:"nice"}]},
  { id:6, num:"Phase 6", color:"#6b7280", title:"Advanced AI Features", timeline:"Future / TBD", priority:"Future",
    context:"Expands the platform beyond progress tracking into full project intelligence. Upload blueprints to compare planned vs. actual construction. Generate AI-powered cost estimates from site plans. Score job sites against OSHA safety checklists automatically. This positions PoolSight AI as an end-to-end construction intelligence platform.",
    outcomes:["Blueprint vs. site photo comparison","AI-generated design cost estimates","Automated OSHA safety scoring","Material quantity detection from photos"],
    items:[{label:"Site plan / blueprint analysis",p:"nice"},{label:"Design estimate generation",p:"nice"},{label:"OSHA safety compliance scoring",p:"nice"},{label:"Material quantity detection",p:"nice"},{label:"Progress time-lapse visualization",p:"nice"}]},
  { id:7, num:"Phase 7", color:"#0891b2", title:"Mobile PWA, Viber & Notifications", timeline:"Future / Optional", priority:"Future",
    context:"Brings PoolSight AI natively to the devices your field teams and executives already carry. A Progressive Web App installable on iPhone, Android, and iPad allows camera capture and on-site viewing. Viber integration delivers real-time billing alerts and PM approval requests to the messaging app your team already uses daily.",
    outcomes:["Installable PWA for iPhone, Android & iPad","On-site camera capture → instant upload","Viber alerts for billing milestones & flags","Push notifications for PM approval requests"],
    items:[{label:"PWA — iPhone 15 & modern iOS",p:"nice"},{label:"PWA — Android (Chrome-based)",p:"nice"},{label:"PWA — iPad / tablet optimized",p:"nice"},{label:"Camera capture on mobile",p:"nice"},{label:"Viber bot for billing alerts",p:"nice"},{label:"Viber PM approval requests",p:"nice"},{label:"Push notifications (web + mobile)",p:"nice"}]},
];

const MOCK_RESULT = {
  project: "Demo Site — Smith Residence",
  submission_date: new Date().toISOString().split("T")[0],
  overall_progress: 42,
  confidence: "high",
  phases: [
    {
      name: "Excavation",
      status: "complete",
      pct: 100,
      delta: 0,
      billed: true,
      amount: 8500,
      obs: "Fully complete. Site graded and leveled.",
      flags: [],
    },
    {
      name: "Steel / Rebar",
      status: "complete",
      pct: 100,
      delta: 0,
      billed: true,
      amount: 4200,
      obs: "Full rebar cage installed and inspected.",
      flags: [],
    },
    {
      name: "Gunite / Shotcrete",
      status: "in_progress",
      pct: 65,
      delta: 15,
      billed: false,
      amount: 6800,
      obs: "Applied to walls and floor. Shallow end incomplete.",
      flags: ["Shallow end incomplete — schedule follow-up pour"],
    },
    {
      name: "Plumbing Rough-in",
      status: "pending",
      pct: 0,
      delta: 0,
      billed: false,
      amount: 3200,
      obs: "Not yet started. Should begin after gunite cure.",
      flags: ["Blocked — waiting on gunite completion"],
    },
  ],
  comparison_summary:
    "Progress has advanced 15% since Mar 5. Gunite is now 65% (up from 50%). No regressions detected.",
  insights: [
    "Plumbing rough-in should begin before next gunite pour",
    "Safety fencing missing on east perimeter",
    "Gunite cure (~7 days) required before load-bearing work",
    "Project tracking on schedule based on current completion",
  ],
  billing: {
    prev_billed: 12700,
    newly_triggered: 0,
    total_to_date: 12700,
    pending: 30300,
    contract_total: 43000,
  },
};

// ─── SMALL PRIMITIVES ────────────────────────────────────────────────────

function Badge({ label, variant }) {
  const map = {
    Critical: "bg-rose-100 text-rose-800",
    Important: "bg-amber-100 text-amber-800",
    "Nice to Have": "bg-emerald-100 text-emerald-800",
    Future: "bg-sky-100 text-sky-800",
    Optional: "bg-violet-100 text-violet-800",
  };
  const cls =
    map[variant || label] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex ${TAG_WIDTH_CLASS} items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function WelcomeTab() {
  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory"
      role="region"
      aria-label="Welcome"
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
        <p className="max-w-xl text-lg text-slate-300">
          Construction progress intelligence & billing reconciliation
        </p>

        {/* Scroll hint */}
        <div
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-xs text-slate-200">
            Scroll down <span>↓</span>
          </span>
        </div>
      </section>

      {/* How to use */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-900 px-8 py-8 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          How to use
        </h2>
        <div className="max-w-2xl text-left text-slate-200">
          <ol className="ml-4 list-decimal space-y-3 text-sm leading-snug">
            <li>
              <strong className="text-white">Using Trello</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                <li>Open Trello from the sidebar and select your board.</li>
                <li>Open a list (e.g. a list that holds your weekly or daily photos).</li>
                <li>
                  Choose photos for analysis — check the boxes next to images already attached to cards,
                  or use the upload option to add photos from your computer. Both can be analyzed.
                </li>
                <li>
                  Add a PM update (optional) — notes like “tile ready for pickup” or “rough-in complete”.
                </li>
                <li>
                  Run AI analysis — results show line-item progress, status badges (Advance/Hold/Verify/OK),
                  and key actions.
                </li>
              </ul>
            </li>
            <li>
              <strong className="text-white">Saving analysis to a project</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                <li>After the AI finishes, use “Save as report entry”.</li>
                <li>
                  Choose an existing project (to add a new entry) or “Create New Project”.
                </li>
                <li>
                  You can save to a project that already has report entries — each save adds another entry.
                </li>
                <li>Click Save entry. The report appears under Report entries on the project page.</li>
              </ul>
            </li>
            <li>
              <strong className="text-white">Projects & line items</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                <li>Create a project — go to Projects and add a new project.</li>
                <li>
                  Import line items — upload a contract file (EML) to parse and import your billing items.
                </li>
                <li>Select line items — choose which items to include in analyses.</li>
                <li>
                  Run AI analysis — with photos and selected line items, the AI aligns results to your contract items.
                </li>
              </ul>
            </li>
          </ol>
        </div>
      </section>

      {/* Guides, tips & known issues */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-950 px-8 py-12 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Guides, tips & known issues
        </h2>
        <div className="max-w-2xl">
          <ul className="space-y-3 text-left text-sm text-slate-200" role="list">
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                Use <strong>clear, well-lit photos</strong>. If you have renderings/drawings, include them in the
                Documents cards so the AI can match what “done” should look like.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                Add a <strong>PM update</strong> (optional) for context, like “tile ready for pickup” or “rough-in complete”.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                Provide <strong>contract line-item labels</strong> when available so the AI aligns results to your contract items.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-sky-400">•</span>
              <span>
                <strong>Trello is read-only</strong> — nothing is written back to your boards.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-amber-400">•</span>
              <span>
                <strong>Too many photos</strong> — If you hit an error, run again with fewer images (up to 10) or shorten the PM update.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-amber-400">•</span>
              <span>
                <strong>Rate limits</strong> — If analyses fail repeatedly, wait a bit and try again, or use fewer photos per run.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* About the project */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-950 px-8 py-12 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          About the project
        </h2>
        <div className="max-w-2xl space-y-4 text-center text-slate-200">
          <p>
            PoolSightAI turns construction site photos into billing-ready reconciliation reports. The AI analyzes images, extracts progress by line item, and produces standardized tables with <strong>status badges</strong> (Advance, Hold, Verify, OK) and <strong>key actions</strong>.
          </p>
        </div>
      </section>

      {/* Key features */}
      <section className="flex min-h-full snap-start flex-col items-center justify-center bg-slate-900 px-8 py-12 text-white">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Key features
        </h2>
        <ul className="max-w-2xl space-y-4 text-left text-slate-200" role="list">
          <li className="flex gap-3">
            <span className="font-bold text-sky-400">•</span>
            <span><strong>Trello</strong> — Connect boards, analyze list photos, save to projects.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-sky-400">•</span>
            <span><strong>Projects</strong> — Parse contracts, select line items, run and save analyses.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-sky-400">•</span>
            <span><strong>Project Plan</strong> — Phased rollout (P1–P7) and roadmap.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-sky-400">•</span>
            <span><strong>AI analysis</strong> — Analyzes photos for scope, completion %, and billing recommendations. Enforces construction sequencing (excavation → shell → tile → decking → plaster).</span>
          </li>
        </ul>
      </section>

    </div>
  );
}

// ─── PRESENTATION TAB ────────────────────────────────────────────────────
const sectionColor = {
  Cover: "bg-slate-800",
  "Executive Summary": "bg-blue-700",
  "The Problem": "bg-red-600",
  Findings: "bg-rose-600",
  Recommendation: "bg-emerald-600",
  Stack: "bg-amber-600",
  "Project Hub": "bg-cyan-700",
  Timeline: "bg-violet-600",
  "Cost Comparison": "bg-orange-500",
  "Why This Wins": "bg-sky-700",
  "Not Recommended": "bg-slate-600",
  "Next Steps": "bg-blue-700",
  Conclusion: "bg-emerald-700",
};

const slideTransition = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const staggerItem = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

function PresentationTab() {
  const [index, setIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [direction, setDirection] = useState(1);
  const slide = SLIDES[index];
  const sections = [...new Set(SLIDES.map((s) => s.section))];
  const go = (d) => {
    setDirection(d);
    setIndex((i) => Math.max(0, Math.min(SLIDES.length - 1, i + d)));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="flex h-full flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-6 py-3">
        <nav className="flex flex-wrap gap-2" aria-label="Presentation sections">
          {sections.map((sec) => {
            const fi = SLIDES.findIndex((s) => s.section === sec);
            const active = slide.section === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setIndex(fi)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  active ? `${sectionColor[sec] || "bg-blue-700"} text-white` : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {sec}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNote((n) => !n)}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            {showNote ? "Hide Notes" : "Speaker Notes"}
          </button>
          <p className="text-sm text-slate-400" aria-live="polite">
            {index + 1}/{SLIDES.length}
          </p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto px-10 py-8">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={slide.id}
              initial={{ x: direction * 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -direction * 48, opacity: 0 }}
              transition={slideTransition}
              className="min-h-full"
            >
          {slide.type === "cover" && (
            <motion.div
              className="flex min-h-[60vh] flex-col items-center justify-center text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              {slide.id !== 1 ? (
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
                  Executive Proposal · March 2026
                </p>
              ) : null}
              <h1 className="mb-3 text-6xl font-extrabold tracking-tight text-white sm:text-7xl">Pool<span className="text-sky-400">Sight</span> AI</h1>
              {slide.id !== 1 ? (
                <p className="mb-10 max-w-xl text-base text-slate-300 sm:text-lg">{slide.subtitle}</p>
              ) : null}
            </motion.div>
          )}

          {slide.type !== "cover" && (
            <motion.article
              className="mx-auto flex max-w-6xl flex-col gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.25 }}
            >
              <header>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">{slide.section}</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{slide.title}</h2>
                <p className="mt-1 text-base text-slate-300">{slide.subtitle}</p>
              </header>

              {slide.type === "bullets" && (
                <motion.ul
                  className={`grid gap-4 ${slide.bullets.length > 3 ? "md:grid-cols-2" : ""}`}
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {slide.bullets.map((b) => (
                    <motion.li key={b.head} variants={staggerItem} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <span className="mt-1 text-2xl" aria-hidden="true">{b.icon}</span>
                      <div>
                        <h3 className="text-base font-semibold text-white">{b.head}</h3>
                        <p className="mt-1 text-base text-slate-300">{b.body}</p>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}

              {slide.type === "flow" && (
                <motion.div
                  className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {slide.steps.map((st, i) => (
                    <motion.div key={st.num} variants={staggerItem} className="flex w-full flex-col items-center gap-2">
                      <div className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-center">
                        <p className="text-2xl font-extrabold text-sky-400">{st.num}</p>
                        <p className="mt-1 text-base font-semibold text-white">{st.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{st.sub}</p>
                      </div>
                      {i < slide.steps.length - 1 && <span className="text-2xl text-slate-500">↓</span>}
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {slide.type === "table" && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-slate-700">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          {slide.tableData.headers.map((h) => (
                            <th key={h} className="px-3 py-2 text-sm uppercase tracking-wide text-slate-300">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.tableData.rows.map((row, i) => (
                          <tr key={`${row[0]}-${i}`} className={i === slide.tableData.highlight ? "bg-blue-900/30" : "bg-slate-900/40"}>
                            {row.map((cell, j) => (
                              <td key={`${cell}-${j}`} className="border-t border-slate-800 px-3 py-2 text-slate-200">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(slide.oneTimeFees || slide.hosting || slide.devTools) && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {slide.oneTimeFees && slide.oneTimeFees.length > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-400">One-time fees</h4>
                          <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                            {slide.oneTimeFees.map((f) => (
                              <li key={f.item}>
                                <div className="flex justify-between gap-2">
                                  <span>{f.item}</span>
                                  <span className="font-semibold text-sky-300">{f.amount}</span>
                                </div>
                                {f.note && <p className="mt-0.5 text-xs text-slate-400">{f.note}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {slide.hosting && slide.hosting.length > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-400">Hosting (e.g. Vercel)</h4>
                          <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                            {slide.hosting.map((h) => (
                              <li key={h.option}>
                                <div className="flex justify-between gap-2">
                                  <span>{h.option}</span>
                                  <span className="font-semibold text-sky-300">{h.cost}</span>
                                </div>
                                {h.note && <p className="mt-0.5 text-xs text-slate-400">{h.note}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {slide.devTools && slide.devTools.length > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-400">Dev & maintenance (optional)</h4>
                          <ul className="mt-2 space-y-2 text-sm text-slate-200">
                            {slide.devTools.map((t) => (
                              <li key={t.name}>
                                <span className="font-semibold text-white">{t.name}</span>
                                <span className="ml-1.5 text-sky-300">{t.cost}</span>
                                <p className="mt-0.5 text-xs text-slate-400">{t.benefit}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {slide.note && (
                    <p className="rounded-md border border-sky-900 bg-sky-950/40 px-3 py-2 text-base text-slate-200">
                      💡 {slide.note}
                    </p>
                  )}
                </div>
              )}

              {slide.type === "roadmap" && (
                <motion.div
                  className="grid gap-3 md:grid-cols-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {slide.phases.map((ph) => (
                    <motion.div key={ph.num} variants={staggerItem} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                      <p className="text-sm font-bold uppercase tracking-wide text-sky-400">{ph.num}</p>
                      <p className="mt-1 text-base font-semibold text-white">{ph.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{ph.timeline}</p>
                      <p className="mt-2 inline-block rounded px-2 py-0.5 text-sm font-semibold text-slate-900" style={{ backgroundColor: ph.color }}>
                        {ph.tag}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {slide.type === "cost" && (
                <div>
                  <motion.div
                    className="grid gap-3 md:grid-cols-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {slide.tiers.map((t) => (
                      <motion.div key={t.label} variants={staggerItem} className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 text-center">
                        <p className="text-sm uppercase tracking-wide text-slate-400">{t.label}</p>
                        <p className="mt-2 text-4xl font-bold text-white">{t.total}</p>
                        <p className="mt-2 text-sm text-slate-300">AI: {t.ai}</p>
                        <p className="text-sm text-slate-300">Infra: {t.infra}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                  {slide.note && (
                    <p className="mt-3 rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-base text-slate-200">
                      💡 {slide.note}
                    </p>
                  )}
                </div>
              )}

              {slide.type === "nextsteps" && (
                <motion.div
                  className="space-y-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {slide.steps.map((st, i) => (
                    <motion.div key={st.num} variants={staggerItem} className="flex gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold">{i + 1}</div>
                      <div>
                        <p className="text-base font-semibold text-white">{st.label}</p>
                        <p className="text-base text-slate-300">{st.body}</p>
                        {st.bullets && (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-300">
                            {st.bullets.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {slide.type === "additionally" && (
                <motion.div
                  className="grid gap-3 md:grid-cols-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {slide.items.map((item) => (
                    <motion.div key={item.head} variants={staggerItem} className="flex gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                      <div className="text-2xl">{item.icon}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{item.head}</p>
                          <span className="rounded bg-sky-900 px-2 py-0.5 text-sm text-sky-200">{item.tag}</span>
                        </div>
                        <p className="mt-1 text-base text-slate-300">{item.body}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.article>
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {showNote && (
          <aside className="w-72 shrink-0 overflow-auto border-l border-slate-800 bg-slate-900 px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Speaker Notes</p>
            <p className="mt-2 text-base text-slate-300">{slide.note}</p>
          </aside>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-800 px-6 py-3">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-40">← Prev</button>
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full ${i === index ? "w-5 bg-blue-500" : "w-1.5 bg-slate-700"}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} disabled={index === SLIDES.length - 1} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-40">Next →</button>
      </footer>
    </section>
  );
}

// ─── PLAN TAB ─────────────────────────────────────────────────────────────

function PlanTab() {
  const [checks, setChecks] = useState({});

  const toggle = (pid, i) => {
    const key = `${pid}-${i}`;
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const phasePct = (ph) =>
    Math.round(
      (ph.items.filter((_, i) => checks[`${ph.id}-${i}`]).length /
        ph.items.length) *
        100
    );

  const totalItems = PHASES.flatMap((p) => p.items).length;
  const totalDone = PHASES.flatMap((p) =>
    p.items.map((_, i) => checks[`${p.id}-${i}`])
  ).filter(Boolean).length;
  const overallPct = Math.round((totalDone / totalItems) * 100);

  return (
    <section className="flex h-full flex-col">
      <header className="bg-slate-950 px-10 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Project Plan Tracker
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
          PoolSight <span className="text-sky-400">AI</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Track phase completion across the full implementation
          roadmap.
        </p>
        <dl className="mt-6 grid max-w-xl grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {[
            ["Overall progress", `${overallPct}%`],
            ["Items done", `${totalDone}/${totalItems}`],
            ["Total phases", `${PHASES.length}`],
            ["Timeline", "3–5 mo"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <main className="flex-1 overflow-auto bg-slate-50 px-6 py-8 sm:px-10">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Roadmap
        </h3>
        <p className="mt-1 text-xl font-bold text-slate-900">
          Phased Implementation Tracker
        </p>
        <div className="mt-1 h-1 w-10 rounded-full bg-sky-600" />

        <div className="mt-6 space-y-6">
          {PHASES.map((ph) => {
            const pct = phasePct(ph);
            return (
              <section
                key={ph.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                      {ph.num} · {ph.timeline}
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900">
                      {ph.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-sky-700">
                        {pct}%
                      </p>
                      <p className="text-[11px] font-medium text-slate-500">
                        complete
                      </p>
                    </div>
                    <div
                      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"
                      aria-hidden="true"
                    >
                      <div
                        className="absolute inset-0 rounded-full border-4 border-sky-600"
                        style={{ clipPath: "inset(0 0 0 0 round 999px)" }}
                      />
                    </div>
                    <Badge label={ph.priority} variant={ph.priority} />
                  </div>
                </header>

                <div className="grid gap-0 border-t border-slate-200 md:grid-cols-2">
                  <div className="border-r border-slate-200 px-5 py-4">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Feature Checklist
                    </h5>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {ph.items.map((item, i) => {
                        const key = `${ph.id}-${i}`;
                        const checked = !!checks[key];
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => toggle(ph.id, i)}
                              className="flex w-full items-start gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                                  checked
                                    ? "border-sky-600 bg-sky-600 text-white"
                                    : "border-slate-400 bg-white text-transparent"
                                }`}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              <span
                                className={`flex-1 text-sm ${
                                  checked
                                    ? "text-slate-400 line-through"
                                    : "text-slate-900"
                                }`}
                              >
                                {item.label}
                              </span>
                              <Badge
                                label={pLabel[item.p]}
                                variant={pLabel[item.p]}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="bg-slate-50 px-5 py-4">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      What this phase achieves
                    </h5>
                    <p className="mt-2 text-sm text-slate-700">
                      {ph.context}
                    </p>
                    <h6 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Key outcomes
                    </h6>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
                      {ph.outcomes.map((o) => (
                        <li key={o} className="flex items-center gap-2">
                          <span
                            className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold leading-none text-sky-700"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="h-1 bg-slate-100">
                  <div
                    className="h-full rounded-r-full bg-sky-600"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </section>
  );
}

// ─── DEMO TAB ─────────────────────────────────────────────────────────────

function DemoTab() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [optInfo, setOptInfo] = useState([]);
  const [pmUpdate, setPmUpdate] = useState("");
  const [pmSuggestions, setPmSuggestions] = useState(PM_UPDATE_SUGGESTIONS);
  const fileInputRef = useRef(null);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(
      e.dataTransfer?.files || e.target.files || []
    ).filter((f) => f.type.startsWith("image/"));
    setFiles(dropped.slice(0, 5));
    setResult(null);
    setError("");
  }, []);

  const optimizeImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_PX = 1568;
        let { width, height } = img;

        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) {
            height = Math.round((height * MAX_PX) / width);
            width = MAX_PX;
          } else {
            width = Math.round((width * MAX_PX) / height);
            height = MAX_PX;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const tryQuality = (q) => {
          const dataUrl = canvas.toDataURL("image/jpeg", q);
          const b64 = dataUrl.split(",")[1];
          const bytes = (b64.length * 3) / 4;
          if (bytes <= 3.8 * 1024 * 1024 || q <= 0.35) {
            resolve({
              b64,
              mimeType: "image/jpeg",
              origSize: file.size,
              finalSize: bytes,
              width,
              height,
              quality: Math.round(q * 100),
            });
          } else {
            tryQuality(Math.max(q - 0.1, 0.35));
          }
        };

        tryQuality(0.82);
      };
      img.onerror = reject;
      img.src = url;
    });

  const runReal = async () => {
    if (!files.length) {
      setError("Please upload at least one image.");
      return;
    }
    setLoading(true);
    setError("");
    setOptInfo([]);

    try {
      const optimized = await Promise.all(
        files.map((f) => optimizeImage(f))
      );

      setOptInfo(
        optimized.map((o, i) => ({
          name: files[i].name,
          orig: (files[i].size / 1024 / 1024).toFixed(2),
          final: (o.finalSize / 1024 / 1024).toFixed(2),
          dims: `${o.width}×${o.height}`,
          quality: o.quality,
        }))
      );

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: optimized.map((o) => ({
            b64: o.b64,
            mimeType: o.mimeType,
          })),
          pmUpdate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      setResult(data);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPmSuggestion = (suggestion) => {
    setPmUpdate((prev) => {
      const base = prev.trim();
      return base ? `${base}\n${suggestion.text}` : suggestion.text;
    });
    setPmSuggestions((prev) =>
      prev.filter((item) => item.id !== suggestion.id)
    );
  };

  const resetPmSuggestions = () => {
    setPmSuggestions(PM_UPDATE_SUGGESTIONS);
  };

  const hiddenEvidencePattern = /no clear billable evidence/i;
  const filteredSections = Array.isArray(result?.sections)
    ? result.sections
        .map((section) => ({
          ...section,
          rows: (section.rows || []).filter(
            (row) => !hiddenEvidencePattern.test(row.line_item || "")
          ),
        }))
        .filter((section) => section.rows.length > 0)
    : [];

  const allRows = filteredSections.flatMap((section) => section.rows);
  const statusCounts = allRows.reduce(
    (acc, row) => {
      const key = row.status || "hold";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { advance: 0, hold: 0, verify: 0, ok: 0 }
  );

  const blindSpotFlags = allRows
    .filter((row) => row.status === "verify")
    .map((row) => row.notes)
    .filter(Boolean)
    .slice(0, 4);

  const confidenceLabel =
    result?.confidence === "high"
      ? "high confidence"
      : result?.confidence === "medium"
      ? "moderate confidence"
      : result?.confidence === "low"
      ? "low confidence"
      : "unknown confidence";

  const prerequisiteWarnings = allRows
    .filter((row) =>
      /prerequisite|cannot|until|before|defer|inspection/i.test(row.notes || "")
    )
    .map((row) => row.line_item)
    .slice(0, 3);

  const earlyWarningItems = [
    {
      title: "Sequence risk detection",
      detail:
        prerequisiteWarnings.length > 0
          ? `Possible prerequisite dependencies were found in: ${prerequisiteWarnings.join(", ")}. Confirm predecessor scopes are complete before approving billing jumps.`
          : "No obvious sequence violations were detected, but finish-stage billing should still be gated by prerequisite completion.",
    },
    {
      title: "Coverage and angle gaps",
      detail:
        blindSpotFlags.length > 0
          ? `The model flagged ambiguity in current visuals. Top checks: ${blindSpotFlags.slice(0, 2).join(" ")}`
          : "Current photos show fewer ambiguous areas, but off-frame progress and hidden work remain common blind spots.",
    },
    {
      title: "Early overbilling prevention",
      detail:
        statusCounts.verify + statusCounts.hold > 0
          ? `${statusCounts.verify + statusCounts.hold} line items are still hold/verify. Prioritize these checks first to prevent billing ahead of actual field completion.`
          : "No major hold/verify pressure points are currently detected from this image set.",
    },
  ];

  const imageCount = files.length;
  const pmUpdateTokens = Math.ceil((pmUpdate?.trim().length || 0) / 4);
  const estimatedInputTokens = imageCount * 1500 + pmUpdateTokens + 500;
  const estimatedOutputTokens = Math.max(700, allRows.length * 70 + 350);
  const tokenTotal = estimatedInputTokens + estimatedOutputTokens;

  // Claude Haiku pricing approximation (per 1M tokens): $0.80 input, $4.00 output
  const estimatedCostUsd =
    (estimatedInputTokens / 1_000_000) * 0.8 +
    (estimatedOutputTokens / 1_000_000) * 4.0;

  const statusPillClass = (status) => {
    if (status === "ok") {
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (status === "advance") {
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    }
    if (status === "verify") {
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  };

  const priorityPillClass = (priority) => {
    if (priority === "immediate") {
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    }
    if (priority === "verify") {
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    if (priority === "next_cycle") {
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  };

  return (
    <section className="flex h-full flex-col bg-slate-50">
      <header className="bg-slate-950 px-10 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Live Demo
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
          Construction <span className="text-sky-400">Analyzer</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Upload site photos and get a structured billing report
          with AI-powered insights.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold tracking-wide text-slate-900">Demo Overview</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Upload 1-5 recent site photos (clear, well-lit, and phase-relevant), then click{" "}
              <span className="font-semibold text-slate-800">Analyze Site Photos</span>.
              The system will optimize each image, run AI analysis, and return a structured report.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li>• Overall progress and confidence score</li>
              <li>• Phase-by-phase status and progress deltas</li>
              <li>• Actionable field insights and risk signals</li>
              <li>• Billing summary: previously billed, pending, and milestone readiness for PM review</li>
            </ul>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Est. input tokens
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {estimatedInputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Est. output tokens
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {estimatedOutputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Est. total / run
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {tokenTotal.toLocaleString()} tokens
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Est. analysis cost
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  ${estimatedCostUsd.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Images selected: {imageCount}</span>
              <span>Sections detected: {filteredSections.length}</span>
              <span>Billable rows: {allRows.length}</span>
              <span>Actions generated: {Array.isArray(result?.key_actions) ? result.key_actions.length : 0}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="pm-update"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600"
            >
              PM update (optional)
              <span id="pm-update-help" className="mt-1 block text-[11px] font-normal text-slate-600">
                Paste a short weekly update from the project manager to provide additional context for billing suggestions.
              </span>
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Suggested PM update snippets">
              {pmSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => applyPmSuggestion(suggestion)}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1"
                >
                  + {suggestion.label}
                </button>
              ))}
              {pmSuggestions.length < PM_UPDATE_SUGGESTIONS.length && (
                <button
                  type="button"
                  onClick={resetPmSuggestions}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1"
                >
                  Reset suggestions
                </button>
              )}
            </div>
            <textarea
              id="pm-update"
              aria-describedby="pm-update-help pm-update-count"
              className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
              rows={3}
              value={pmUpdate}
              onChange={(e) => setPmUpdate(e.target.value)}
              placeholder="Example: Tile ready for pickup, concrete deck complete, electrical rough-in completed..."
            />
            <p id="pm-update-count" className="mt-1 text-[11px] text-slate-600">
              {pmUpdate.trim().length} characters
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              dragging
                ? "border-sky-500 bg-sky-50"
                : "border-slate-300 bg-white hover:border-sky-400"
            }`}
            aria-label="Upload site photos"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={onDrop}
              className="hidden"
            />
            <span className="mb-2 text-3xl" aria-hidden="true">
              🏗️
            </span>
            <p className="font-semibold text-slate-900">
              Drop site photos here
            </p>
            <p className="mt-1 text-xs text-slate-500">
              or click to browse · up to 5 images
            </p>
            {files.length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {files.map((f) => (
                  <li
                    key={f.name}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  >
                    📷{" "}
                    <span className="ml-1">
                      {f.name.length > 22
                        ? `${f.name.slice(0, 20)}…`
                        : f.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {optInfo.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="border-b border-emerald-100 bg-emerald-100/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                ✅ Images optimized before sending
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      {[
                        "File",
                        "Original",
                        "Optimized",
                        "Savings",
                        "Dimensions",
                        "Quality",
                      ].map((h) => (
                        <th
                          key={h}
                          className="border-b border-emerald-100 px-3 py-2.5 font-semibold text-emerald-800"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {optInfo.map((o) => {
                      const saved = Math.round(
                        (1 - o.final / o.orig) * 100
                      );
                      return (
                        <tr key={o.name} className="bg-white">
                          <td className="px-3 py-2.5 font-medium text-emerald-900">
                            {o.name.length > 20
                              ? `${o.name.slice(0, 18)}…`
                              : o.name}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {o.orig} MB
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-emerald-700">
                            {o.final} MB
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {saved > 0 ? `-${saved}%` : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {o.dims}px
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            JPEG {o.quality}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={runReal}
              disabled={loading || !files.length}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {loading ? "⏳ Analyzing…" : "🔍 Analyze Site Photos"}
            </button>
          </div>

          {result && (
            <section aria-label="Analysis results" className="space-y-5">
              {result.meta && result.meta.ok === false && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                  <p className="font-medium">
                    {result.meta.errorCode === "rate_limit"
                      ? "Rate limit exceeded"
                      : "Low confidence — analysis could not be fully completed."}
                  </p>
                  <p className="mt-1 text-amber-700">
                    {result.details
                      ? result.details
                      : result.meta.errorCode === "rate_limit"
                        ? "Use fewer photos (up to 10) or try again in a minute."
                        : "Showing fallback recommendations. You can try running the analysis again."}
                  </p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-4">
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Overall progress
                  </h3>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {result.overall_progress != null ? `${result.overall_progress}%` : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Confidence: {result.confidence || "unknown"}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Sections
                  </h3>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {filteredSections.length}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Grouped by scope (pool, walls, landscape, etc.)
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Key actions
                  </h3>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {Array.isArray(result.key_actions) ? result.key_actions.length : 0}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Prioritized items to review this week
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Project
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result.project}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    As of {result.as_of_date}
                  </p>
                </article>
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  🔎 AI image analysis summary
                </h3>
                {result.summary && result.summary.trim() ? (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {result.summary.trim()}
                  </p>
                ) : null}
                {result.image_coverage_note && String(result.image_coverage_note).trim() ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Image coverage
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                      {String(result.image_coverage_note).trim()}
                    </p>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-slate-600">
                  The model analyzed the uploaded photos with
                  {` ${confidenceLabel} `}
                  and generated normalized billing recommendations across
                  {` ${filteredSections.length} `}
                  sections with
                  {` ${allRows.length} `}
                  billable line items. Observed status mix indicates
                  {` ${statusCounts.advance} `}
                  likely advances,
                  {` ${statusCounts.verify} `}
                  verification-required checks, and
                  {` ${statusCounts.hold} `}
                  items that should remain on hold pending stronger evidence.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    ["Advance", statusCounts.advance, "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"],
                    ["Hold", statusCounts.hold, "bg-slate-50 text-slate-700 ring-1 ring-slate-200"],
                    ["Verify", statusCounts.verify, "bg-amber-50 text-amber-700 ring-1 ring-amber-200"],
                    ["OK", statusCounts.ok, "bg-sky-50 text-sky-700 ring-1 ring-sky-200"],
                  ].map(([label, count, style]) => (
                    <div key={label} className={`rounded-md px-3 py-2 text-xs ${style}`}>
                      <p className="font-semibold">{label}</p>
                      <p className="mt-0.5 text-[11px]">{count} items</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    AI early-warning checks (things humans often miss)
                  </h4>
                  <div className="mt-2 space-y-2">
                    {earlyWarningItems.map((item) => (
                      <div key={item.title} className="rounded-md border border-slate-200 bg-white p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {filteredSections.length > 0 && (
                <div className="space-y-4">
                  {filteredSections.map((section) => (
                    <div key={section.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                          {section.title}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-[30%]" />
                            <col className="w-[12%]" />
                            <col className="w-[14%]" />
                            <col className="w-[12%]" />
                            <col className="w-[32%]" />
                          </colgroup>
                          <thead className="bg-slate-50">
                            <tr>
                              {["Line Item", "Current %", "Suggested %", "Status", "Notes"].map((h) => (
                                <th
                                  key={h}
                                  className="border-b border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row) => (
                              <tr key={row.line_item} className="odd:bg-white even:bg-slate-50">
                                <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">
                                  {row.line_item}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-800">
                                  {row.current_percent}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-800">
                                  <div className="text-slate-800">
                                    {row.suggested_percent}
                                    {row.suggested_percent_range &&
                                    row.suggested_percent_range !== row.suggested_percent ? (
                                      <span className="ml-1 text-xs text-slate-500">
                                        ({row.suggested_percent_range})
                                      </span>
                                    ) : null}
                                    {row.photo_supported ? (
                                      <span className="ml-2 text-xs text-slate-500">
                                        [{row.photo_supported}]
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-sm">
                                  <span
                                    className={`inline-flex min-w-[74px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(
                                      row.status
                                    )}`}
                                  >
                                    {row.status === "advance" && "Advance"}
                                    {row.status === "hold" && "Hold"}
                                    {row.status === "verify" && "Verify"}
                                    {row.status === "ok" && "OK"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-600">
                                  {/no clear billable evidence/i.test(row.notes || "") ? (
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                      <span className="text-[11px] italic">
                                        No clear billable evidence from current image set
                                      </span>
                                      <span
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-600"
                                        title={row.notes}
                                        aria-label={row.notes}
                                      >
                                        i
                                      </span>
                                    </span>
                                  ) : (
                                    row.notes
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(result.key_actions) && result.key_actions.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    📋 Key action items
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                    {result.key_actions.map((ka, idx) => (
                      <li key={`${ka.label}-${idx}`} className="flex gap-2">
                        <span
                          className="mt-[3px] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="font-semibold text-slate-900">
                            {ka.label}
                          </span>
                          {ka.action && ` — ${ka.action}`}
                          {ka.priority && (
                            <span
                              className={`ml-1 inline-flex min-w-[92px] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${priorityPillClass(
                                ka.priority
                              )}`}
                            >
                              {ka.priority.replace("_", " ")}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </section>
          )}
        </div>
      </main>
    </section>
  );
}

// ─── COST TAB (simplified) ───────────────────────────────────────────────

function CostTab() {
  const [projects, setProjects] = useState(10);
  const [imgsPerSub, setImgsPerSub] = useState(5);
  const [subsPerWeek, setSubsPerWeek] = useState(2);
  const [model, setModel] = useState("haiku");

  const MODELS = {
    haiku: {
      name: "Claude Haiku",
      inCost: 0.8,
      outCost: 4.0,
      color: "text-sky-700",
    },
    gpt4omini: {
      name: "GPT-4o mini",
      inCost: 0.15,
      outCost: 0.6,
      color: "text-emerald-700",
    },
  };

  const m = MODELS[model];
  const totalImgs = projects * imgsPerSub * subsPerWeek * 4;
  const reqs = Math.ceil(totalImgs / imgsPerSub);
  const tokIn = (imgsPerSub * 1500 + 500) * reqs;
  const tokOut = 1200 * reqs;
  const aiCost = (tokIn / 1_000_000) * m.inCost + (tokOut / 1_000_000) * m.outCost;
  const infraCost = projects <= 5 ? 0 : projects <= 30 ? 25 : 45;
  const total = aiCost + infraCost;

  const Slider = ({ label, val, min, max, onChange, fmt = (v) => v }) => (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">
          {fmt(val)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );

  return (
    <section className="flex h-full flex-col bg-slate-50">
      <header className="bg-slate-950 px-10 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Cost Calculator
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
          Estimate your <span className="text-sky-400">AI costs</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Adjust sliders to model your usage and see a live cost
          breakdown.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-8 sm:px-10">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Configuration
              </h3>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                Usage parameters
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                AI model
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MODELS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setModel(k)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      model === k
                        ? "border-sky-600 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              label="Active projects"
              val={projects}
              min={1}
              max={100}
              onChange={setProjects}
            />
            <Slider
              label="Images per submission"
              val={imgsPerSub}
              min={1}
              max={10}
              onChange={setImgsPerSub}
            />
            <Slider
              label="Submissions per project / week"
              val={subsPerWeek}
              min={1}
              max={7}
              onChange={setSubsPerWeek}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Monthly estimate
              </h3>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                Cost breakdown
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["Images / month", totalImgs.toLocaleString()],
                ["API requests", reqs.toLocaleString()],
                ["Input tokens", `${(tokIn / 1000).toFixed(0)}K`],
                ["Output tokens", `${(tokOut / 1000).toFixed(0)}K`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800">
                    AI cost ({m.name})
                  </span>
                  <span className="font-semibold text-slate-900">
                    ${aiCost.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  ${m.inCost}/MTok in · ${m.outCost}/MTok out
                </p>
              </div>
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800">Infrastructure</span>
                  <span className="font-semibold text-slate-900">
                    {infraCost === 0 ? "Free" : `~$${infraCost}/mo`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {projects <= 5
                    ? "Within free tier"
                    : "Estimated paid tier"}
                </p>
              </div>
              <div className="flex items-center justify-between bg-sky-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-900">
                  Total / month
                </span>
                <span className="text-2xl font-extrabold text-sky-700">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-sm">
              <strong>Per image:</strong>{" "}
              ~${(aiCost / totalImgs).toFixed(4)} ·{" "}
              <strong>Per request:</strong>{" "}
              ~${(aiCost / reqs).toFixed(4)}. Batching{" "}
              {imgsPerSub} images per call is significantly cheaper
              than single-image calls.
            </p>

            <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <h4 className="font-semibold text-slate-900">When Contextual Memory Is Enabled</h4>
              <p className="mt-2 text-slate-600">
                Phase 3+ introduces persistent memory, which adds database and retrieval overhead beyond AI token costs.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
                <li>Store each submission, analysis JSON, deltas, approval history, and audit metadata.</li>
                <li>Account for storage growth (images/metadata), indexed queries, and dashboard read traffic.</li>
                <li>Include retention policy, backups, and secure access controls as operational requirements.</li>
                <li>Expect additional monthly infrastructure spend as project count and submission frequency increase.</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </section>
  );
}

// ─── ROOT APP SHELL ──────────────────────────────────────────────────────

/**
 * @param {{ initialTab?: string }} props
 */
export default function PoolsightApp({ initialTab } = {}) {
  const [tab, setTab] = useState(initialTab ?? "present");

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-56 flex-col bg-slate-950 text-slate-100">
        <div className="border-b border-slate-800 px-5 py-4">
          <img
            src="/Calimingo.png"
            alt="Calimingo"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <h1 className="mt-2 text-sm font-extrabold tracking-tight">
            Pool<span className="text-sky-400">Sight</span>AI
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Construction progress intelligence
          </p>
        </div>
        <nav
          className="flex-1 space-y-0.5 px-1 py-3 text-sm"
          aria-label="Main navigation"
        >
          {NAV.map((item) => {
            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-[13px] font-medium text-slate-300 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            }
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <footer className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
          March 2026 · Confidential
        </footer>
      </aside>

      <main className="flex-1 overflow-hidden">
        {tab === "welcome" && <WelcomeTab />}
        {tab === "present" && <PresentationTab />}
        {tab === "plan" && <PlanTab />}
        {tab === "trello" && <TrelloDashboard />}
        {tab === "projects" && <ProjectsPage />}
      </main>
    </div>
  );
}

