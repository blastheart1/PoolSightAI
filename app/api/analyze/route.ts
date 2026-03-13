export const runtime = "nodejs";

type AnalyzeImage = {
  b64: string;
  mimeType: string;
};

type AnalyzeRequest = {
  images?: AnalyzeImage[];
  pmUpdate?: string;
  projectName?: string;
};

type RecoStatus = "advance" | "hold" | "verify" | "ok";

type RecoRow = {
  line_item: string;
  current_percent: string;
  suggested_percent: string;
  status: RecoStatus;
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
  sections: RecoSection[];
  key_actions: KeyAction[];
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

function makeId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readBalancedJSONObject(input: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;
  let best: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === "\\") {
        escaping = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        best = input.slice(start, i + 1);
      }
    }
  }

  return best;
}

function parseModelJson(textContent: string): unknown {
  const cleaned = textContent.replace(/```json|```/g, "").trim();
  const attempts: string[] = [];
  attempts.push(cleaned);

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  const balanced = readBalancedJSONObject(cleaned);
  if (balanced) attempts.push(balanced);

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Unable to parse model JSON.");
}

function normalizeResponse(parsed: unknown): ReconciliationResponse {
  const fallback: ReconciliationResponse = {
    project: "Site Analysis",
    as_of_date: new Date().toISOString().split("T")[0],
    overall_progress: null,
    confidence: "unknown",
    sections: [],
    key_actions: [],
  };

  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const obj = parsed as Record<string, unknown>;

  const project = typeof obj.project === "string" ? obj.project : fallback.project;
  const asOf = typeof obj.as_of_date === "string" ? obj.as_of_date : fallback.as_of_date;

  const overall =
    typeof obj.overall_progress === "number"
      ? Math.max(0, Math.min(100, Math.round(obj.overall_progress)))
      : typeof obj.overall_progress === "string"
        ? Number.parseInt(obj.overall_progress, 10) || null
        : null;

  const confidence =
    typeof obj.confidence === "string"
      ? obj.confidence
      : fallback.confidence;

  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const sections: RecoSection[] = rawSections
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const so = s as Record<string, unknown>;
      const id = typeof so.id === "string" ? so.id : "";
      const title = typeof so.title === "string" ? so.title : id || "Section";
      const rawRows = Array.isArray(so.rows) ? so.rows : [];
      const rows: RecoRow[] = rawRows
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const ro = r as Record<string, unknown>;
          const line_item = typeof ro.line_item === "string" ? ro.line_item : "";
          const current_percent = normalizePercent(ro.current_percent);
          const suggested_percent = normalizePercent(ro.suggested_percent);
          const status =
            ro.status === "advance" ||
            ro.status === "hold" ||
            ro.status === "verify" ||
            ro.status === "ok"
              ? (ro.status as RecoStatus)
              : "hold";
          const notes = typeof ro.notes === "string" ? ro.notes : "";
          if (!line_item) return null;
          return { line_item, current_percent, suggested_percent, status, notes };
        })
        .filter(Boolean) as RecoRow[];
      if (!rows.length) return null;
      return { id: id || title.toLowerCase().replace(/\s+/g, "_"), title, rows };
    })
    .filter(Boolean) as RecoSection[];

  const rawActions = Array.isArray(obj.key_actions) ? obj.key_actions : [];
  const key_actions: KeyAction[] = rawActions
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const ao = a as Record<string, unknown>;
      const label = typeof ao.label === "string" ? ao.label : "";
      const action = typeof ao.action === "string" ? ao.action : label;
      const priority = normalizePriority(ao.priority);
      if (!label && !action) return null;
      return { priority, label: label || action, action: action || label };
    })
    .filter(Boolean) as KeyAction[];

  const templateSections: RecoSection[] = SECTION_TEMPLATES.map((template) => {
    const found = sections.find(
      (s) =>
        s.id === template.id ||
        makeId(s.title) === template.id ||
        template.id.includes(makeId(s.title)) ||
        makeId(s.title).includes(template.id)
    );
    if (found) {
      return { ...found, id: template.id, title: template.title };
    }
    return {
      id: template.id,
      title: template.title,
      rows: [
        {
          line_item: "No clear billable evidence from current image set",
          current_percent: "0%",
          suggested_percent: "0%",
          status: "verify",
          notes:
            "Provide additional dated photos or PM notes to improve confidence for this section.",
        },
      ],
    };
  });

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
    sections: templateSections,
    key_actions: normalizedActions,
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as AnalyzeRequest;
    const images = body.images ?? [];
    const pmUpdate = body.pmUpdate ?? "";
    const projectName = body.projectName ?? "Site Analysis";

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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

    const prompt = `
You are a senior pool construction billing analyst.

Using the site photos and (if provided) the PM update text, produce a billing reconciliation JSON object.

Keep construction logic in mind:
- Do not bill finishes before prerequisites (e.g., plaster after tile, tile after shell, etc.).
- Suggest advancing partially billed items when work is clearly complete.
- Mark uncertain or possibly overbilled items as "verify" with a short note.

Return JSON in this shape and nothing else (no markdown, no prose):
{
  "project": "${projectName}",
  "as_of_date": "${today}",
  "overall_progress": 0,
  "confidence": "low|medium|high",
  "sections": [
    {
      "id": "pool_spa",
      "title": "POOL & SPA",
      "rows": [
        {
          "line_item": "Shotcrete Per Cubic Yard",
          "current_percent": "50%",
          "suggested_percent": "100%",
          "status": "advance",
          "notes": "Shell fully formed and cured in photos."
        }
      ]
    }
  ],
  "key_actions": [
    {
      "priority": "immediate",
      "label": "Advance shotcrete to 100%",
      "action": "Shell is complete; safe to bill to 100% pending on-site confirmation."
    }
  ]
}

Status must be one of: "advance", "hold", "verify", "ok".
Percentages should be concise strings like "0%", "50%", "75–100%".
Group related items into a small number of clear sections (POOL & SPA, WALLS/VENEER, OUTDOOR KITCHEN, CONCRETE, LANDSCAPE/IRRIGATION, UTILITIES) when applicable.
Always return at least one section with several rows and at least three key_actions, even if the PM update is empty.

PM UPDATE (optional, may be empty):
${pmUpdate || "<none provided>"}
`.trim();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [...imgsForClaude, { type: "text", text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error:", errText);
      return new Response(
        JSON.stringify({ error: "Anthropic API error", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };

    const textContent = (data.content ?? [])
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    let parsed: unknown;
    try {
      parsed = parseModelJson(textContent);
    } catch (e) {
      console.error("JSON parse error:", e);
      return new Response(
        JSON.stringify({
          error: "Failed to parse JSON from model.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalized = normalizeResponse(parsed);

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const error = e as Error;
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

