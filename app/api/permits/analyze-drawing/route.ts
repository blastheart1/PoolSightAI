import { NextResponse } from "next/server";
import { DRAWING_ANALYZER_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import type { DrawingAnalysisResult } from "@/types/permits";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-20250514";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = (await req.json()) as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { success: false, error: "imageBase64 and mimeType are required" },
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
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              { type: "text", text: DRAWING_ANALYZER_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (drawing analyzer):", errText);
      let detail = "AI analysis failed";
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || detail;
      } catch { /* ignore */ }
      return NextResponse.json(
        { success: false, error: detail },
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

    let result: DrawingAnalysisResult;
    try {
      result = parseAiJson<DrawingAnalysisResult>(textBlock.text);
    } catch {
      console.error("Unparseable AI response (drawing):", textBlock.text.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("analyze-drawing error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
