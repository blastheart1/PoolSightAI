import { NextResponse } from "next/server";
import { CHECKLIST_GENERATOR_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import type { ChecklistResult, ProjectType } from "@/types/permits";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-20250514";

const VALID_TYPES: ProjectType[] = [
  "pool",
  "adu",
  "addition",
  "remodel",
  "new_construction",
];

export async function POST(req: Request) {
  try {
    const { projectType, qualifiers } = (await req.json()) as {
      projectType?: string;
      qualifiers?: string[];
    };

    if (!projectType || !VALID_TYPES.includes(projectType as ProjectType)) {
      return NextResponse.json(
        {
          success: false,
          error: `projectType must be one of: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const prompt = CHECKLIST_GENERATOR_PROMPT(
      projectType,
      qualifiers ?? []
    );

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (checklist):", errText);
      return NextResponse.json(
        { success: false, error: "AI checklist generation failed" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const textBlock = data?.content?.find(
      (b: { type: string }) => b.type === "text"
    );
    if (!textBlock?.text) {
      return NextResponse.json(
        { success: false, error: "Empty response from AI" },
        { status: 502 }
      );
    }

    let result: ChecklistResult;
    try {
      result = parseAiJson<ChecklistResult>(textBlock.text);
    } catch {
      console.error("Unparseable AI response (checklist):", textBlock.text.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("checklist-generator error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
