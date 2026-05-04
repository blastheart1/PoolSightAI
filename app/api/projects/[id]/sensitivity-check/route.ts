import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { projects } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { SENSITIVITY_TOOL } from "@/lib/sensitivity/tool";
import { SENSITIVITY_SYSTEM_PROMPT, buildSensitivityUserPrompt } from "@/lib/sensitivity/prompt";
import type { TranscriptSegment, FlaggedSegment, SensitivityCheckResponse } from "@/lib/sensitivity/types";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const MIN_SEGMENTS = 1;

interface ClaudeToolUseBlock {
  type: "tool_use";
  name: string;
  input: { flaggedSegments: FlaggedSegment[] };
}

interface ClaudeResponse {
  content: Array<{ type: string } | ClaudeToolUseBlock>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 503 }
    );
  }

  if (db) {
    const { id: projectId } = await params;
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const body = await request.json() as { segments?: unknown };
  const segments = Array.isArray(body.segments)
    ? (body.segments as TranscriptSegment[])
    : [];

  if (segments.length < MIN_SEGMENTS) {
    const empty: SensitivityCheckResponse = { flaggedSegments: [] };
    return NextResponse.json(empty);
  }

  const userPrompt = buildSensitivityUserPrompt(segments);

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: SENSITIVITY_SYSTEM_PROMPT,
      tools: [SENSITIVITY_TOOL],
      tool_choice: { type: "tool", name: SENSITIVITY_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!claudeRes.ok) {
    const text = await claudeRes.text();
    console.error("[sensitivity-check] Claude error", claudeRes.status, text);
    return NextResponse.json(
      { error: "Sensitivity analysis failed. Please try again." },
      { status: 502 }
    );
  }

  const claudeData = (await claudeRes.json()) as ClaudeResponse;
  const toolBlock = claudeData.content.find(
    (b): b is ClaudeToolUseBlock =>
      b.type === "tool_use" && (b as ClaudeToolUseBlock).name === SENSITIVITY_TOOL.name
  );

  if (!toolBlock) {
    console.error("[sensitivity-check] Tool block missing from Claude response");
    const empty: SensitivityCheckResponse = { flaggedSegments: [] };
    return NextResponse.json(empty);
  }

  const response: SensitivityCheckResponse = {
    flaggedSegments: toolBlock.input.flaggedSegments ?? [],
  };

  return NextResponse.json(response);
}
