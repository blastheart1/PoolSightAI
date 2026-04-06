export const runtime = "nodejs";

type AnalyzeImage = {
  b64: string;
  mimeType: string;
};

type AnalyzeRequest = {
  images?: AnalyzeImage[];
  pmUpdate?: string;
  projectName?: string;
  /** Optional contract line item labels to align report rows to */
  lineItemLabels?: string[];
  /** Optional PM voice note transcript — enables audio-only analysis when images is empty */
  audioTranscript?: string;
  /** When true, inject STRICT_OUTPUT_CONTRACT block into the prompt */
  strictMode?: boolean;
};

type RecoStatus = "advance" | "hold" | "verify" | "ok";
type PhotoSupported = "yes" | "no" | "partial" | "unclear" | "audio" | "verbal";

type RecoRow = {
  line_item: string;
  current_percent: string;
  suggested_percent: string;
  suggested_percent_range: string;
  status: RecoStatus;
  photo_supported: PhotoSupported;
  notes: string;
};

type RecoSection = {
  id: string;
  title: string;
  rows: RecoRow[];
};

type KeyAction = {
  priority: "immediate" | "this_week" | "verify" | "next_cycle";
  label: string;
  action: string;
};

type ReconciliationResponse = {
  project: string;
  as_of_date: string;
  overall_progress: number | null;
  confidence: string;
  image_coverage_note?: string;
  /** Optional narrative explaining how photos align with any architectural rendering/drawing included. */
  rendering_relation_note?: string;
  /** Optional narrative summary of the analysis for the user */
  summary?: string;
  sections: RecoSection[];
  key_actions: KeyAction[];
};

export type AnalyzeMeta = {
  ok: boolean;
  requestId: string;
  elapsedMs: number;
  model: string;
  errorCode?:
    | "anthropic_api_error"
    | "rate_limit"
    | "tool_missing"
    | "tool_incomplete"
    | "validation_failed"
    | "timeout"
    | "server_error";
  rawContent?: unknown;
};

const SECTION_TEMPLATES: Array<{ id: string; title: string }> = [
  { id: "pool_spa", title: "POOL & SPA" },
  { id: "walls_veneer", title: "WALLS, VENEER & BOND BEAM" },
  { id: "outdoor_kitchen", title: "OUTDOOR KITCHEN" },
  { id: "concrete_backyard", title: "CONCRETE — BACKYARD" },
  { id: "concrete_frontyard", title: "CONCRETE — FRONT YARD" },
  { id: "landscape_irrigation", title: "LANDSCAPE & IRRIGATION" },
  { id: "utilities", title: "GAS, PLUMBING & ELECTRICAL" },
];

const MAX_SECTIONS = 20;
const MAX_ROWS_PER_SECTION = 50;
const MAX_KEY_ACTIONS = 30;
const MAX_STRING_LENGTH = 2000;
/** Cap images per request; Sonnet handles larger context than Haiku. */
const MAX_IMAGES = 20;
/** Max line item labels sent in the prompt; each truncated to this length to limit tokens. */
const MAX_LINE_ITEM_LABEL_LENGTH = 150;
const MAX_LINE_ITEM_LABELS = 35;

const RECONCILE_BILLING_TOOL_NAME = "reconcile_billing";

const RECONCILE_BILLING_TOOL = {
  name: RECONCILE_BILLING_TOOL_NAME,
  description:
    "Submit the billing reconciliation result for the construction site. Include project, as_of_date, confidence (low|medium|high), image_coverage_note, optional rendering_relation_note, summary, sections (each with id, title, rows), and key_actions. For each row: line_item, current_percent, suggested_percent, suggested_percent_range, status (advance|hold|verify|ok), photo_supported (yes|no|partial|unclear), and notes that reference specific images. Priority for key_actions: immediate|this_week|verify|next_cycle.",
  input_schema: {
    type: "object" as const,
    properties: {
      project: { type: "string" as const, description: "Project or site name" },
      as_of_date: { type: "string" as const, description: "Date of analysis (YYYY-MM-DD)" },
      overall_progress: {
        type: "number" as const,
        description: "Overall completion 0-100, or omit if unknown",
      },
      confidence: {
        type: "string" as const,
        enum: ["low", "medium", "high"],
        description: "Confidence in the analysis",
      },
      image_coverage_note: {
        type: "string" as const,
        description:
          "Describe how many images were provided, what scopes they cover, and flag any scopes that are missing or unconfirmable.",
      },
      rendering_relation_note: {
        type: "string" as const,
        description:
          "Optional: If any provided image appears to be an architectural rendering/drawing (e.g., plan, elevation, sheet, BIM/detail drawing), compare the photos against that design intent and state alignment vs uncertainty, referencing the specific provided images by position or description. Omit if no rendering/drawing is present.",
      },
      summary: {
        type: "string" as const,
        description:
          "2-5 sentence narrative summarizing the site condition, what the photos show, and the main billing recommendations (current vs suggested progress, key items to advance or verify).",
      },
      sections: {
        type: "array" as const,
        description: "Billing sections with rows",
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const },
            title: { type: "string" as const },
            rows: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  line_item: { type: "string" as const },
                  current_percent: { type: "string" as const },
                  suggested_percent: { type: "string" as const },
                  suggested_percent_range: { type: "string" as const },
                  status: {
                    type: "string" as const,
                    enum: ["advance", "hold", "verify", "ok"],
                  },
                  photo_supported: {
                    type: "string" as const,
                    enum: ["yes", "no", "partial", "unclear"],
                  },
                  notes: { type: "string" as const },
                },
                required: [
                  "line_item",
                  "current_percent",
                  "suggested_percent",
                  "suggested_percent_range",
                  "status",
                  "photo_supported",
                  "notes",
                ],
              },
            },
          },
          required: ["id", "title", "rows"],
        },
      },
      key_actions: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            priority: {
              type: "string" as const,
              enum: ["immediate", "this_week", "verify", "next_cycle"],
            },
            label: { type: "string" as const },
            action: { type: "string" as const },
          },
          required: ["priority", "label", "action"],
        },
      },
    },
    required: ["project", "as_of_date", "confidence", "image_coverage_note", "summary", "sections", "key_actions"],
  },
};

function truncate(s: string, max: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function normalizePercent(value: unknown): string {
  if (typeof value === "number") {
    return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
  }
  if (typeof value !== "string") return "0%";
  const trimmed = value.trim();
  const rangeMatch = trimmed.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
  if (rangeMatch) {
    const a = Math.max(0, Math.min(100, Number(rangeMatch[1])));
    const b = Math.max(0, Math.min(100, Number(rangeMatch[2])));
    return `${a}\u2013${b}%`;
  }
  const single = trimmed.match(/(\d{1,3})/);
  if (!single) return "0%";
  const n = Math.max(0, Math.min(100, Number(single[1])));
  return `${n}%`;
}

function normalizePriority(value: unknown): KeyAction["priority"] {
  if (
    value === "immediate" ||
    value === "this_week" ||
    value === "verify" ||
    value === "next_cycle"
  ) {
    return value;
  }
  if (value === "high") return "immediate";
  if (value === "medium" || value === "low") return "this_week";
  return "this_week";
}

function normalizeConfidence(value: unknown): string {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "unknown";
}

function normalizePhotoSupported(value: unknown): PhotoSupported {
  if (
    value === "yes" || value === "no" || value === "partial" || value === "unclear" ||
    value === "audio" || value === "verbal"
  ) return value;
  return "unclear";
}

function makeId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Build a safe fallback response for UI to render when analysis fails. */
export function getFallbackResponse(projectName: string): ReconciliationResponse {
  const today = new Date().toISOString().split("T")[0];
  return {
    project: projectName,
    as_of_date: today,
    overall_progress: null,
    confidence: "unknown",
    image_coverage_note:
      "Image coverage could not be determined. Provide additional photos covering all major scopes.",
    summary:
      "Analysis could not be completed. Provide additional photos or PM notes and try again.",
    sections: SECTION_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      rows: [
        {
          line_item: "No clear billable evidence from current image set",
          current_percent: "0%",
          suggested_percent: "0%",
          suggested_percent_range: "0%",
          status: "verify" as RecoStatus,
          photo_supported: "unclear" as PhotoSupported,
          notes:
            "Provide additional dated photos or PM notes to improve confidence for this section.",
        },
      ],
    })),
    key_actions: [
      {
        priority: "verify",
        label: "Confirm dated photo coverage",
        action:
          "Ensure each major scope has at least one recent, clear image before weekly billing reconciliation.",
      },
      {
        priority: "this_week",
        label: "Cross-check partially billed items",
        action:
          "Prioritize partially billed line items first and only advance when visible completion is clear.",
      },
      {
        priority: "next_cycle",
        label: "Capture prerequisite milestones",
        action:
          "Collect photos that prove prerequisite stages are complete before billing finish trades.",
      },
    ],
  };
}

/**
 * Normalize and validate tool/parsed input into ReconciliationResponse.
 * Applies bounds, enum coercion, and string truncation.
 */
export function normalizeResponse(parsed: unknown): ReconciliationResponse {
  const fallback = getFallbackResponse("Site Analysis");

  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const obj = parsed as Record<string, unknown>;

  const project = truncate(
    typeof obj.project === "string" ? obj.project : fallback.project,
    MAX_STRING_LENGTH
  ) || fallback.project;
  const asOf =
    typeof obj.as_of_date === "string"
      ? truncate(obj.as_of_date, 32)
      : new Date().toISOString().split("T")[0];

  const overall =
    typeof obj.overall_progress === "number"
      ? Math.max(0, Math.min(100, Math.round(obj.overall_progress)))
      : typeof obj.overall_progress === "string"
        ? Number.parseInt(obj.overall_progress, 10) || null
        : null;

  const confidence = normalizeConfidence(obj.confidence);

  const image_coverage_note =
    typeof obj.image_coverage_note === "string" && obj.image_coverage_note.trim()
      ? truncate(obj.image_coverage_note.trim(), MAX_STRING_LENGTH)
      : undefined;

  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? truncate(obj.summary.trim(), MAX_STRING_LENGTH)
      : undefined;

  const rendering_relation_note =
    typeof obj.rendering_relation_note === "string" && obj.rendering_relation_note.trim()
      ? truncate(obj.rendering_relation_note.trim(), MAX_STRING_LENGTH)
      : undefined;

  const rawSections = Array.isArray(obj.sections) ? obj.sections.slice(0, MAX_SECTIONS) : [];
  const sections: RecoSection[] = rawSections
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const so = s as Record<string, unknown>;
      const id = typeof so.id === "string" ? truncate(so.id, 64) : "";
      const title =
        typeof so.title === "string" ? truncate(so.title, 128) : id || "Section";
      const rawRows = Array.isArray(so.rows) ? so.rows.slice(0, MAX_ROWS_PER_SECTION) : [];
      const rows: RecoRow[] = rawRows
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const ro = r as Record<string, unknown>;
          const line_item =
            typeof ro.line_item === "string" ? truncate(ro.line_item, MAX_STRING_LENGTH) : "";
          const current_percent = normalizePercent(ro.current_percent);
          const suggested_percent = normalizePercent(ro.suggested_percent);
          const suggested_percent_range = normalizePercent(
            typeof ro.suggested_percent_range === "string" && ro.suggested_percent_range.trim()
              ? ro.suggested_percent_range
              : suggested_percent
          );
          const status =
            ro.status === "advance" ||
            ro.status === "hold" ||
            ro.status === "verify" ||
            ro.status === "ok"
              ? (ro.status as RecoStatus)
              : "verify";
          const photo_supported = normalizePhotoSupported(ro.photo_supported);
          const notes =
            typeof ro.notes === "string" ? truncate(ro.notes, MAX_STRING_LENGTH) : "";
          if (!line_item) return null;
          return {
            line_item,
            current_percent,
            suggested_percent,
            suggested_percent_range,
            status,
            photo_supported,
            notes,
          };
        })
        .filter(Boolean) as RecoRow[];
      if (!rows.length) return null;
      return { id: id || makeId(title), title, rows };
    })
    .filter(Boolean) as RecoSection[];

  const rawActions = Array.isArray(obj.key_actions)
    ? obj.key_actions.slice(0, MAX_KEY_ACTIONS)
    : [];
  const key_actions: KeyAction[] = rawActions
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const ao = a as Record<string, unknown>;
      const label =
        typeof ao.label === "string" ? truncate(ao.label, MAX_STRING_LENGTH) : "";
      const action =
        typeof ao.action === "string" ? truncate(ao.action, MAX_STRING_LENGTH) : label;
      const priority = normalizePriority(ao.priority);
      if (!label && !action) return null;
      return { priority, label: label || action, action: action || label };
    })
    .filter(Boolean) as KeyAction[];

  // If the model produced no sections at all, fall back to generic template sections.
  // Otherwise, only include sections that the model actually returned; do NOT fabricate
  // extra "no clear billable evidence" rows, since those are not helpful to the user.
  const templateSections: RecoSection[] =
    sections.length === 0
      ? fallback.sections
      : SECTION_TEMPLATES.map((template) => {
          const found = sections.find(
            (s) =>
              s.id === template.id ||
              makeId(s.title) === template.id ||
              template.id.includes(makeId(s.title)) ||
              makeId(s.title).includes(template.id)
          );
          if (!found) return null;
          return { ...found, id: template.id, title: template.title };
        }).filter(Boolean) as RecoSection[];

  const normalizedActions = [...key_actions];
  if (normalizedActions.length < 3) {
    const filler: KeyAction[] = [
      {
        priority: "verify",
        label: "Confirm dated photo coverage",
        action:
          "Ensure each major scope has at least one recent, clear image before weekly billing reconciliation.",
      },
      {
        priority: "this_week",
        label: "Cross-check partially billed items",
        action:
          "Prioritize partially billed line items first and only advance when visible completion is clear.",
      },
      {
        priority: "next_cycle",
        label: "Capture prerequisite milestones",
        action:
          "Collect photos that prove prerequisite stages are complete before billing finish trades.",
      },
    ];
    for (const item of filler) {
      if (normalizedActions.length >= 3) break;
      normalizedActions.push(item);
    }
  }

  return {
    project,
    as_of_date: asOf,
    overall_progress: overall,
    confidence,
    image_coverage_note,
    rendering_relation_note,
    summary,
    sections: templateSections,
    key_actions: normalizedActions,
  };
}

type ContentBlock = { type: string; text?: string; name?: string; input?: unknown };

/** Extract the first tool_use block's input for the given tool name. */
function extractToolInput(
  content: unknown[] | undefined,
  toolName: string
): Record<string, unknown> | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const b = block as ContentBlock;
    if (b.type === "tool_use" && b.name === toolName && b.input != null && typeof b.input === "object") {
      return b.input as Record<string, unknown>;
    }
  }
  return null;
}

const MODEL = "claude-sonnet-4-20250514";
const RETRY_PROMPT_SUFFIX_TOOL_MISSING =
  "\n\nIMPORTANT: You must respond by calling the reconcile_billing tool with your analysis. Do not respond with plain text or JSON in the message body.";
const RETRY_PROMPT_SUFFIX_INCOMPLETE =
  "\n\nIMPORTANT: Your previous response called the tool but omitted required fields. You MUST call reconcile_billing again with a COMPLETE object including ALL required top-level fields (project, as_of_date, confidence, image_coverage_note, summary, sections, key_actions). Each row MUST include: line_item, current_percent, suggested_percent, suggested_percent_range, status, photo_supported, and notes. Include at least three key_actions. If contract line items were provided above, you MUST produce exactly one row per contract line item using the exact label text. Do not omit any contract line items.";

const STRICT_OUTPUT_CONTRACT = (labels: string[]) => `

STRICT OUTPUT CONTRACT (REQUIRED):
You are given EXACT_SELECTED_LINE_ITEMS below — these are the ONLY items to analyze.
Return EXACTLY one row per item listed, in the SAME ORDER as listed.
Copy the line_item text EXACTLY as given — do not paraphrase, truncate, or reorder.
suggested_percent is REQUIRED on every row — provide a best-supported value even if uncertain, then set status to "verify".
Do not add rows, omit rows, merge rows, or split rows.

EXACT_SELECTED_LINE_ITEMS:
${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}
`;

const STRICT_RETRY_SUFFIX = (missingLabels: string[]) => `

PARTIAL RETRY — You are being called again because some items were missing from your previous output.
Return ONLY rows for these missing items (do not repeat already-correct rows):
${missingLabels.map((l, i) => `${i + 1}. ${l}`).join("\n")}
Each row must have suggested_percent filled in. Use "verify" status if uncertain.
`;

/** Tool output is valid for display only if it has non-empty sections and key_actions. */
function isToolInputComplete(input: Record<string, unknown>): boolean {
  const sections = input.sections;
  const keyActions = input.key_actions;
  if (!Array.isArray(sections) || sections.length === 0) return false;
  if (!Array.isArray(keyActions) || keyActions.length === 0) return false;

  for (const section of sections) {
    if (!section || typeof section !== "object") return false;
    const s = section as Record<string, unknown>;
    if (!Array.isArray(s.rows) || s.rows.length === 0) return false;
    for (const row of s.rows as unknown[]) {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      const required = [
        "line_item",
        "current_percent",
        "suggested_percent",
        "suggested_percent_range",
        "status",
        "photo_supported",
        "notes",
      ];
      for (const k of required) {
        if (typeof r[k] !== "string" || !(r[k] as string).trim()) return false;
      }
    }
  }

  const topRequired = ["project", "as_of_date", "confidence", "image_coverage_note", "summary"];
  for (const k of topRequired) {
    if (typeof input[k] !== "string" || !(input[k] as string).trim()) return false;
  }
  return true;
}

function buildPrompt(opts: {
  projectName: string;
  today: string;
  pmUpdate: string;
  lineItemLabels: string[];
  audioTranscript?: string;
  hasImages?: boolean;
  isRetry?: boolean;
  retryReason?: "tool_missing" | "incomplete";
  strictMode?: boolean;
  retryMissingLabels?: string[];
}): string {
  const { projectName, today, pmUpdate, lineItemLabels, audioTranscript, hasImages = true, isRetry, retryReason, strictMode, retryMissingLabels } = opts;

  const hasContractItems = lineItemLabels.length > 0;
  const audioOnly = !hasImages && !!audioTranscript;
  const hasBoth = hasImages && !!audioTranscript;

  const contractSection = hasContractItems
    ? `
CONTRACT LINE ITEMS (from the signed contract)

The following are the exact contract line items for this project. You MUST produce exactly one row per item, using the exact label text as the line_item value. Do not rename, merge, split, or omit any of these items. Do not invent additional rows beyond these items.

${lineItemLabels.map((label, i) => `${i + 1}. ${label}`).join("\n")}

---
`
    : "";

  const effectiveContractSection = strictMode && lineItemLabels.length > 0
    ? STRICT_OUTPUT_CONTRACT(lineItemLabels)
    : contractSection;

  const strictRetrySection = strictMode && isRetry && retryMissingLabels && retryMissingLabels.length > 0
    ? STRICT_RETRY_SUFFIX(retryMissingLabels)
    : "";

  const noContractFallback = !hasContractItems
    ? `
WHEN NO CONTRACT LINE ITEMS ARE PROVIDED

Still produce a full analysis. Create sections and rows for every scope of work ${audioOnly ? "described in the transcript" : "visible in the photos"} (shell, plumbing, electrical, decking, tile, equipment, etc.). Apply the sequencing rules to infer what is likely complete even if not directly described, and flag all inferences explicitly in the notes using the INFERRED prefix.

---
`
    : "";

  // ── Audio-only analysis path ─────────────────────────────────────────────
  if (audioOnly) {
    return `
You are a senior pool construction billing analyst. Your output will be used to update progress billing for contract line items. Provide full, detailed analysis so the project manager can justify each billing change.

Project: ${projectName}
Analysis date: ${today}
Source: PM voice note transcript (no site photos provided)

Using the PM's verbal site update transcript below, produce a billing reconciliation by calling the reconcile_billing tool.

---
${effectiveContractSection}
STEP 1 — TRANSCRIPT ANALYSIS (internal reasoning)

Before producing any billing output, carefully read the full transcript. For each statement:
- Identify which scope of work is mentioned (e.g., excavation, shell, plumbing, decking, tile, equipment).
- Assess the completion state based on the PM's language:
  - "Complete", "done", "finished", "wrapped up" → substantially or fully complete
  - "In progress", "working on", "started" → partially complete (estimate %)
  - "Scheduled", "next week", "upcoming" → not yet started or early stage
- Note the specificity: does the PM give dates, quantities, sub-task details, or is the statement vague?
- Flag any contradictions or ambiguities in the transcript.
- Note scopes NOT mentioned — these cannot be reliably suggested from audio alone.

---

STEP 1.5 — TRANSCRIPT-TO-SCOPE MAPPING (internal reasoning)

Before producing billing rows, map each transcript statement to the contract line items it informs. For each statement note:
- Which contract line item(s) it addresses
- What the PM said (verbatim or close paraphrase)
- Confidence level: high (explicit completion claim) | medium (partial or in-progress) | low (vague or indirect)

Complete this mapping before Step 2 to ensure every billing row references specific transcript statements.

---

STEP 2 — BILLING RECONCILIATION

Call the reconcile_billing tool with the full object.

Tool call schema:
{
  project: string,
  as_of_date: string (YYYY-MM-DD),
  confidence: "high" | "medium" | "low",
  image_coverage_note: string,
  summary: string,
  sections: [
    {
      id: string,
      title: string,
      rows: [
        {
          line_item: string,
          current_percent: string,
          suggested_percent: string,
          suggested_percent_range: string,
          status: "advance" | "hold" | "verify" | "ok",
          photo_supported: "audio" | "verbal" | "unclear",
          notes: string
        }
      ]
    }
  ],
  key_actions: [
    {
      priority: "immediate" | "this_week" | "verify" | "next_cycle",
      label: string,
      action: string
    }
  ]
}

---

FIELD DEFINITIONS

current_percent: The percentage previously billed and approved. Assess actual completion from the transcript, then set suggested_percent accordingly.

image_coverage_note: Since no photos were provided, describe what the transcript covers and what scopes are unmentioned or unclear from audio alone.

summary: 2–5 sentences describing what the PM reported, current vs. suggested progress, and the main billing recommendations based on verbal evidence.

suggested_percent: A single recommended billing value (e.g., "75%") — not a range.

suggested_percent_range: If uncertainty exists, provide a range here (e.g., "70–80%"). Otherwise use the same value as suggested_percent.

photo_supported:
- "audio" = PM explicitly and clearly states work is complete or at a specific % (high confidence verbal evidence)
- "verbal" = PM mentions work but is vague, uses future tense, or lacks specific detail (lower confidence)
- "unclear" = scope not mentioned in transcript or statement is contradictory

status:
- "advance" = PM clearly and specifically states work is done, provides details (dates, sub-tasks, quantities)
- "verify" = PM mentions work but is vague, ambiguous, or the claim needs photo confirmation
- "hold" = evidence contradicts advancing, or PM statement raises concerns
- "ok" = current % aligns with PM description, no change needed

key_actions: Minimum three entries. Prioritize verification requests for items that are audio-claimed but unconfirmed.

---

NOTES FIELD REQUIREMENTS

Each row's notes field must:
1. State the photo_supported value and what it means in this context ("audio" = clearly stated, "verbal" = vague mention, "unclear" = not mentioned).
2. Quote or closely paraphrase the PM's exact words from the transcript that support the suggested %.
3. Explain why the suggested_percent is appropriate given the verbal evidence.
4. If the scope is not mentioned in the transcript, explicitly state: "This scope is not mentioned in the PM transcript. Percentage based on [construction sequence logic / prior billing — specify which]."
5. If suggesting "advance" status, explain what specific claim the PM made that justifies billing.
6. If suggesting "verify", explain what additional confirmation is needed before billing.

Do NOT write generic notes. Every note must reference specific transcript statements and be defensible for billing purposes.

---

CONSTRUCTION SEQUENCING RULES

Do not bill a later phase before earlier phases are substantially complete. Enforce this order:

1. Excavation
2. Steel / rebar
3. Shell / gunite / shotcrete
4. Rough plumbing & electrical
5. Equipment pad / equipment set
6. Waterline tile & coping
7. Decking / concrete flatwork
8. Interior finish / plaster
9. Startup / fill / chemical balance

If the transcript describes a later phase, you may infer earlier phases are complete — but explicitly note this inference.

---

INFERENCE TRANSPARENCY

Any suggested_percent for a scope NOT explicitly mentioned in the transcript must be flagged: "INFERRED: [reason]." For example: "INFERRED: Plumbing rough-in not mentioned. Inferred from PM's statement that shell is complete (construction sequencing logic)."

---

CONFIDENCE RULES (audio-only)

- "high": Transcript explicitly covers most contract line items with specific completion claims and details.
- "medium": Transcript covers some items clearly but others are vague or not mentioned. Maximum confidence for audio-only is "medium" unless transcript is highly detailed.
- "low": Transcript is brief, vague, or covers only a small portion of the work.

NOTE: Audio-only analyses carry inherent uncertainty. Use "verify" status generously and recommend photo confirmation for high-value line items.

---
${noContractFallback}
PM UPDATE (optional):
${pmUpdate || "<none provided>"}

---

PM VOICE NOTE TRANSCRIPT:
${audioTranscript.trim()}
${strictRetrySection}${isRetry && retryReason === "incomplete" ? RETRY_PROMPT_SUFFIX_INCOMPLETE : isRetry ? RETRY_PROMPT_SUFFIX_TOOL_MISSING : ""}
`.trim();
  }

  // ── Photo-based analysis path (with optional transcript cross-reference) ──
  return `
You are a senior pool construction billing analyst. Your output will be used to update progress billing for contract line items. Provide full, detailed analysis so the project manager can justify each billing change.

Project: ${projectName}
Analysis date: ${today}

Using the site photos${hasBoth ? " and PM voice note transcript" : ""} and (if provided) the PM update text, produce a billing reconciliation by calling the reconcile_billing tool.

---
${effectiveContractSection}
STEP 1 — IMAGE ANALYSIS (internal reasoning)

Before producing any billing output, carefully examine every provided photo. For each image:
- First determine the image type:
  - Construction progress photo (field/site capture)
  - Architectural rendering/drawing (e.g., elevation, plan sheet, detail drawing, BIM sheet)
- If it is a rendering/drawing, treat it as "design intent" context only (do not infer completion without photo evidence).
- Identify what scope of work is visible (e.g., excavation, shell, plumbing, decking, tile, equipment).
- Note the completion state: not started / in progress (estimate %) / substantially complete / fully complete.
- If a rendering/drawing is present, note the specific design intent for the relevant scopes (what the drawings expect to be true visually).
- Flag any image quality issues: blurry, poor lighting, wrong angle, too far away, or scope not visible.
- Note what is NOT visible or cannot be confirmed from the images.

Do not assume work is complete if it is not clearly visible. If a scope is partially visible, note what portion can be confirmed.

---

STEP 1.5 — PHOTO-TO-SCOPE MAPPING (internal reasoning)

Before producing billing rows, explicitly map each provided image to the contract line items it provides evidence for. For each image, note:
- Image position (e.g., "Image 1", "Image 3")
- Which contract line item(s) it informs
- What evidence it provides (completion state, quality, visible scope)

Complete this mapping internally before Step 2. It ensures every billing row's notes field can reference specific images accurately.

---
${hasBoth ? `
STEP 1.6 — TRANSCRIPT CROSS-REFERENCE (internal reasoning)

A PM voice note transcript is also provided. After analyzing photos:
- Compare what the photos show against what the PM claims in the transcript.
- For each contract line item, note whether the photo evidence SUPPORTS, CONTRADICTS, or is SILENT on the PM's verbal claim.
- If the PM claims work is complete but photos do not confirm it: set status to "verify" and note the discrepancy.
- If the PM claims work is complete AND photos confirm it: this strengthens confidence — you may set "advance" with higher confidence.
- If photos show progress but the PM did not mention it: note the observation and base billing on visual evidence.

---
` : ""}
STEP 2 — BILLING RECONCILIATION

Call the reconcile_billing tool with the full object. All required billing fields are required; rendering_relation_note is optional (omit if no rendering/drawing is present).

Tool call schema:
{
  project: string,
  as_of_date: string (YYYY-MM-DD),
  confidence: "high" | "medium" | "low",
  image_coverage_note: string,
  rendering_relation_note?: string,
  summary: string,
  sections: [
    {
      id: string,
      title: string,
      rows: [
        {
          line_item: string,
          current_percent: string,
          suggested_percent: string,
          suggested_percent_range: string,
          status: "advance" | "hold" | "verify" | "ok",
          photo_supported: "yes" | "no" | "partial" | "unclear",
          notes: string
        }
      ]
    }
  ],
  key_actions: [
    {
      priority: "immediate" | "this_week" | "verify" | "next_cycle",
      label: string,
      action: string
    }
  ]
}

---

FIELD DEFINITIONS

current_percent: The percentage previously billed and approved in the billing system. This is provided as context only — it represents what has already been invoiced. Do not assume this value is correct. Assess actual completion from photos and PM input, then set suggested_percent accordingly. If current_percent exceeds what the photos support, set status to "hold" or "verify" and explain in notes.

image_coverage_note: Describe how many images were provided, what scopes they cover, and flag any scopes that are missing or unconfirmable.${hasBoth ? " Also note where the transcript aligned with or contradicted photo evidence." : ""}

rendering_relation_note: Optional 2–5 sentences. Only if at least one provided image appears to be an architectural rendering/drawing: compare field photo progress vs the rendering's design intent, and explicitly state where they align and where matching is uncertain. Reference the provided images by position or description (e.g., "Image 1", "third drawing sheet", etc.). If no rendering/drawing is present, omit the field.

summary: 2–5 sentences describing what the photos show overall, current vs. suggested progress, and the main billing recommendations.

suggested_percent: A single recommended billing value (e.g., "75%") — not a range.

suggested_percent_range: If uncertainty exists, provide a range here (e.g., "70–80%"). Otherwise use the same value as suggested_percent.

photo_supported: "yes" = clearly visible in photos | "partial" = some evidence visible | "no" = not visible in photos | "unclear" = ambiguous.

status: "advance" = recommend increasing % | "hold" = do not increase, evidence missing or contradictory | "verify" = needs site visit or more photos | "ok" = current % is appropriate.

key_actions: Minimum three entries. Each must have a specific, actionable label and action. Priority: "immediate" | "this_week" | "verify" | "next_cycle".

---

NOTES FIELD REQUIREMENTS

Each row's notes field must:
1. State whether this line item is directly supported by the photos (yes / partial / no / unclear).
2. Reference specific images by position or description (e.g., "Image 1 shows...", "Third photo shows...").
3. Describe what specific visual evidence supports or contradicts the suggested percentage.
4. If the scope is not visible in any image, explicitly state: "This scope is not visible in the provided images. Percentage based on [PM update / construction sequence logic / prior billing — specify which]."
5. Explain why the suggested_percent is appropriate given the evidence — not just what was seen.
6. If holding or downgrading a percentage, explain what evidence is missing or contradictory.${hasBoth ? "\n7. If the PM transcript mentioned this scope, note whether it aligned with or contradicted the photo evidence." : ""}

Do NOT write generic notes like "work appears to be in progress." Every note must be specific and defensible for billing purposes.

---

CONSTRUCTION SEQUENCING RULES

Do not bill a later phase before earlier phases are substantially complete. Enforce this order:

1. Excavation
2. Steel / rebar
3. Shell / gunite / shotcrete
4. Rough plumbing & electrical
5. Equipment pad / equipment set
6. Waterline tile & coping
7. Decking / concrete flatwork
8. Interior finish / plaster
9. Startup / fill / chemical balance

If images show a later phase, you may infer earlier phases are complete — but explicitly note this inference in the notes field.

---

INFERENCE TRANSPARENCY

Any suggested_percent for a scope that is NOT directly visible in the provided photos must be explicitly flagged in the notes field as an inference. Use this format: "INFERRED: [reason]." For example: "INFERRED: Plumbing rough-in is not visible in any photo. Percentage inferred from shell completion visible in Image 2 and construction sequencing logic." This applies to all sequencing-based inferences and PM-update-only claims.

---

CONFIDENCE RULES

Set confidence based on how well the photos cover the billable scopes:
- "high": Photos clearly show the relevant scope for most line items.${hasBoth ? " Transcript confirms photo evidence with no contradictions." : ""}
- "medium": 1–2 key scopes are unclear, partially visible, or not shown.${hasBoth ? " Or transcript partially confirms/contradicts photos." : ""}
- "low": Photos are limited, blurry, or cover only a small portion of the work.

---
${noContractFallback}
PM UPDATE (optional):
${pmUpdate || "<none provided>"}
${hasBoth ? `
---

PM VOICE NOTE TRANSCRIPT:
${audioTranscript.trim()}
` : ""}
${strictRetrySection}${isRetry && retryReason === "incomplete" ? RETRY_PROMPT_SUFFIX_INCOMPLETE : isRetry ? RETRY_PROMPT_SUFFIX_TOOL_MISSING : ""}
`.trim();
}

export async function POST(request: Request) {
  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startMs = Date.now();

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const fallback = getFallbackResponse("Site Analysis");
      return new Response(
        JSON.stringify({
          ...fallback,
          meta: {
            ok: false,
            requestId,
            elapsedMs: Date.now() - startMs,
            model: MODEL,
            errorCode: "anthropic_api_error" as const,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as AnalyzeRequest;
    const rawImages = body.images ?? [];
    const pmUpdate = body.pmUpdate ?? "";
    const projectName = body.projectName ?? "Site Analysis";
    const audioTranscript = typeof body.audioTranscript === "string" ? body.audioTranscript.slice(0, 8000).trim() : "";
    const lineItemLabels = Array.isArray(body.lineItemLabels)
      ? body.lineItemLabels
          .slice(0, MAX_LINE_ITEM_LABELS)
          .filter((l) => typeof l === "string" && l.trim())
          .map((l) =>
            l.length > MAX_LINE_ITEM_LABEL_LENGTH
              ? l.slice(0, MAX_LINE_ITEM_LABEL_LENGTH - 3).trim() + "..."
              : l
          )
      : [];

    if ((!Array.isArray(rawImages) || rawImages.length === 0) && !audioTranscript) {
      return new Response(JSON.stringify({ error: "Provide at least one image or an audio transcript." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const images = rawImages.slice(0, MAX_IMAGES);
    if (rawImages.length > MAX_IMAGES) {
      console.warn(
        JSON.stringify({
          event: "analyze_images_capped",
          requestId,
          requested: rawImages.length,
          capped: MAX_IMAGES,
        })
      );
    }

    const imgsForClaude = images.map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.b64,
      },
    }));

    const today = new Date().toISOString().split("T")[0];
    const hasImages = images.length > 0;

    const strictMode = body.strictMode === true;
    const retryMissingLabels: string[] = [];
    const promptForAttempt = (isRetry: boolean, retryReason?: "tool_missing" | "incomplete") =>
      buildPrompt({ projectName, today, pmUpdate, lineItemLabels, audioTranscript: audioTranscript || undefined, hasImages, isRetry, retryReason, strictMode, retryMissingLabels: isRetry ? retryMissingLabels : [] });

    // Log what we send to the AI (no base64 — images omitted from log)
    console.log(
      JSON.stringify({
        event: "analyze_request",
        requestId,
        imageCount: images.length,
        projectName,
        pmUpdateLength: pmUpdate.length,
        hasAudioTranscript: !!audioTranscript,
        lineItemLabels,
        prompt: promptForAttempt(false),
      })
    );

    let toolInput: Record<string, unknown> | null = null;
    let lastContent: unknown = null;
    let anthropicOk = true;
    let lastRes: Response | null = null;
    let retryReason: "tool_missing" | "incomplete" = "tool_missing";

    for (let attempt = 0; attempt < 2; attempt++) {
      const payload = {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0,
        tools: [RECONCILE_BILLING_TOOL],
        tool_choice: { type: "tool" as const, name: RECONCILE_BILLING_TOOL_NAME },
        messages: [
          {
            role: "user" as const,
            content: [
              ...imgsForClaude,
              {
                type: "text" as const,
                text: promptForAttempt(attempt === 1, retryReason),
              },
            ],
          },
        ],
      };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      lastRes = res;

      if (!res.ok) {
        anthropicOk = false;
        const errText = await res.text();
        console.error("Anthropic error:", errText);
        try {
          const errJson = JSON.parse(errText) as { error?: { type?: string }; type?: string };
          const rateLimit =
            errJson?.error?.type === "rate_limit_error" || errJson?.type === "rate_limit_error";
          if (rateLimit) {
            lastContent = { rateLimit: true, raw: errText };
          }
        } catch {
          // ignore parse failure
        }
        break;
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
      };
      lastContent = data.content ?? null;
      const nextInput = extractToolInput(data.content ?? [], RECONCILE_BILLING_TOOL_NAME);
      if (nextInput != null) {
        toolInput = nextInput;
        if (!isToolInputComplete(nextInput) && attempt === 0) {
          retryReason = "incomplete";
        }
      }
      if (toolInput != null && isToolInputComplete(toolInput)) break;
    }

    const elapsedMs = Date.now() - startMs;

    if (!anthropicOk || lastRes?.ok === false) {
      const fallback = getFallbackResponse(projectName);
      const isRateLimit =
        lastContent != null &&
        typeof lastContent === "object" &&
        "rateLimit" in (lastContent as Record<string, unknown>) &&
        (lastContent as Record<string, unknown>).rateLimit === true;
      const meta: AnalyzeMeta = {
        ok: false,
        requestId,
        elapsedMs,
        model: MODEL,
        errorCode: isRateLimit ? "rate_limit" : "anthropic_api_error",
      };
      if (process.env.NODE_ENV !== "production" && lastContent != null) {
        meta.rawContent = lastContent;
      }
      console.error(
        JSON.stringify({
          event: "analyze_failed",
          errorCode: meta.errorCode,
          requestId,
          elapsedMs,
          model: MODEL,
          imageCount: images.length,
          hasPmUpdate: Boolean(pmUpdate?.trim()),
        })
      );
      return new Response(
        JSON.stringify({
          ...fallback,
          meta,
          ...(isRateLimit && {
            error: "Rate limit exceeded",
            details:
              "Too many input tokens. Use fewer photos (up to 10) or try again in a minute.",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (toolInput == null) {
      const fallback = getFallbackResponse(projectName);
      const meta: AnalyzeMeta = {
        ok: false,
        requestId,
        elapsedMs,
        model: MODEL,
        errorCode: "tool_missing",
      };
      if (process.env.NODE_ENV !== "production" && lastContent != null) {
        meta.rawContent = lastContent;
      }
      console.error(
        JSON.stringify({
          event: "analyze_failed",
          errorCode: meta.errorCode,
          requestId,
          elapsedMs,
          model: MODEL,
          imageCount: images.length,
          hasPmUpdate: Boolean(pmUpdate?.trim()),
        })
      );
      console.log(
        JSON.stringify({
          event: "analyze_response",
          requestId,
          status: "tool_missing",
          rawContent: lastContent,
        })
      );
      return new Response(
        JSON.stringify({ ...fallback, meta }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isToolInputComplete(toolInput)) {
      const fallback = getFallbackResponse(projectName);
      const meta: AnalyzeMeta = {
        ok: false,
        requestId,
        elapsedMs,
        model: MODEL,
        errorCode: "tool_incomplete",
      };
      if (process.env.NODE_ENV !== "production") {
        meta.rawContent = toolInput;
      }
      console.error(
        JSON.stringify({
          event: "analyze_failed",
          errorCode: meta.errorCode,
          requestId,
          elapsedMs,
          model: MODEL,
          imageCount: images.length,
          hasPmUpdate: Boolean(pmUpdate?.trim()),
        })
      );
      return new Response(
        JSON.stringify({ ...fallback, meta }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Log raw AI tool output for debugging
    console.log(
      JSON.stringify({
        event: "analyze_response",
        requestId,
        status: "ok",
        rawToolInput: toolInput,
      })
    );

    let normalized: ReconciliationResponse;
    try {
      normalized = normalizeResponse(toolInput);
    } catch (e) {
      const fallback = getFallbackResponse(projectName);
      const meta: AnalyzeMeta = {
        ok: false,
        requestId,
        elapsedMs,
        model: MODEL,
        errorCode: "validation_failed",
      };
      if (process.env.NODE_ENV !== "production") {
        meta.rawContent = toolInput;
      }
      console.error(
        JSON.stringify({
          event: "analyze_failed",
          errorCode: meta.errorCode,
          requestId,
          elapsedMs,
          model: MODEL,
          imageCount: images.length,
          hasPmUpdate: Boolean(pmUpdate?.trim()),
        })
      );
      return new Response(
        JSON.stringify({ ...fallback, meta }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ...normalized,
        meta: {
          ok: true,
          requestId,
          elapsedMs,
          model: MODEL,
        } satisfies AnalyzeMeta,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const error = e as Error;
    const elapsedMs = Date.now() - startMs;
    console.error("Server error:", error);
    console.error(
      JSON.stringify({
        event: "analyze_failed",
        errorCode: "server_error",
        requestId,
        elapsedMs,
        model: MODEL,
      })
    );
    const fallback = getFallbackResponse("Site Analysis");
    return new Response(
      JSON.stringify({
        ...fallback,
        meta: {
          ok: false,
          requestId,
          elapsedMs,
          model: MODEL,
          errorCode: "server_error",
        } satisfies AnalyzeMeta,
        error: "Server error",
        details: error.message,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
