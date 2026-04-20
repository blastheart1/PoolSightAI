import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, zoningCodeInferenceCache } from "@/lib/db";
import { LIGHTBOX_ZONING_INFERENCE_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import type { ZoningInferenceResult } from "@/types/lightbox";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

interface InferRequest {
  zoningCode?: string;
  jurisdiction?: string;
  description?: string | null;
  summary?: string | null;
  refresh?: boolean;
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InferRequest;
    const zoningCode = body.zoningCode?.trim();
    const jurisdiction = body.jurisdiction?.trim();

    if (!zoningCode) {
      return NextResponse.json(
        { success: false, error: "zoningCode is required" },
        { status: 400 },
      );
    }
    if (!jurisdiction) {
      return NextResponse.json(
        { success: false, error: "jurisdiction is required" },
        { status: 400 },
      );
    }

    const keyJurisdiction = normalizeKey(jurisdiction);
    const keyCode = normalizeKey(zoningCode);

    if (db && !body.refresh) {
      const cached = await db
        .select()
        .from(zoningCodeInferenceCache)
        .where(
          and(
            eq(zoningCodeInferenceCache.jurisdiction, keyJurisdiction),
            eq(zoningCodeInferenceCache.zoningCode, keyCode),
          ),
        )
        .limit(1);
      if (cached[0]) {
        return NextResponse.json({
          success: true,
          data: cached[0].inferenceData as ZoningInferenceResult,
          cached: true,
          fetchedAt: cached[0].fetchedAt.toISOString(),
        });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 },
      );
    }

    const userContent = [
      `Jurisdiction: ${jurisdiction}`,
      `Zoning code: ${zoningCode}`,
      body.description ? `Lightbox description: ${body.description}` : null,
      body.summary ? `Lightbox summary: ${body.summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");

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
        system:
          "You are a permit technician with expert knowledge of US municipal zoning codes. You always return valid JSON only — no markdown, no explanation, no preamble.",
        messages: [
          {
            role: "user",
            content: `${LIGHTBOX_ZONING_INFERENCE_PROMPT}\n\n${userContent}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (zoning inference):", errText);
      return NextResponse.json(
        { success: false, error: "AI inference failed" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const textBlock = data?.content?.find(
      (b: { type: string }) => b.type === "text",
    );
    if (!textBlock?.text) {
      return NextResponse.json(
        { success: false, error: "Empty response from AI" },
        { status: 502 },
      );
    }

    let result: ZoningInferenceResult;
    try {
      result = parseAiJson<ZoningInferenceResult>(textBlock.text);
    } catch {
      console.error(
        "Unparseable AI response (zoning inference):",
        textBlock.text.slice(0, 500),
      );
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 502 },
      );
    }

    if (db) {
      await db
        .insert(zoningCodeInferenceCache)
        .values({
          jurisdiction: keyJurisdiction,
          zoningCode: keyCode,
          inferenceData: result,
        })
        .onConflictDoUpdate({
          target: [
            zoningCodeInferenceCache.jurisdiction,
            zoningCodeInferenceCache.zoningCode,
          ],
          set: {
            inferenceData: result,
            fetchedAt: new Date(),
          },
        });
    }

    return NextResponse.json({
      success: true,
      data: result,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("lightbox-zoning infer error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
