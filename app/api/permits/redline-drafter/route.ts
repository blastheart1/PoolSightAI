import { NextResponse } from "next/server";
import { REDLINE_DRAFTER_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import type { RedlineResult } from "@/types/permits";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

export async function POST(req: Request) {
  try {
    const { corrections } = (await req.json()) as { corrections?: string };

    if (!corrections?.trim()) {
      return NextResponse.json(
        { success: false, error: "corrections text is required" },
        { status: 400 }
      );
    }

    if (corrections.length > 20000) {
      return NextResponse.json(
        { success: false, error: "Corrections text is too long (max 20,000 characters). Split into smaller batches." },
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0,
        system: "You are a licensed permit technician at Calimingo Pools in Los Angeles, responding to LADBS correction comments. You always return valid JSON only — no markdown, no explanation, no preamble.",
        messages: [
          {
            role: "user",
            content: `${REDLINE_DRAFTER_PROMPT}\n\nCorrection comments:\n${corrections}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (redline):", errText);
      return NextResponse.json(
        { success: false, error: "AI drafting failed" },
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

    let result: RedlineResult;
    try {
      result = parseAiJson<RedlineResult>(textBlock.text);
    } catch {
      console.error("Unparseable AI response (redline):", textBlock.text.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("redline-drafter error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
