import { NextResponse } from "next/server";
import { SITE_PLAN_GENERATOR_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import { generateSitePlanSvg } from "@/lib/permits/sitePlanSvg";
import { generateSitePlanDxf } from "@/lib/permits/sitePlanDxf";
import type { SitePlanInputs, SitePlanDataSheet } from "@/types/permits";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-20250514";

const LIVING_TYPES = new Set([
  "lounge_area", "seating_area", "dining_area", "fire_pit", "fire_table",
  "outdoor_kitchen", "bbq_grill", "outdoor_bar", "bar_counter", "bar_seating",
  "tv_area", "speaker_system", "projector_screen", "beverage_station",
  "serving_counter", "outdoor_refrigerator", "sink", "daybed", "chaise_lounge",
  "hammock", "changing_room", "outdoor_bathroom", "outdoor_shower", "pizza_oven",
  "fireplace",
]);

const POOL_DECK_TYPES = new Set(["wood_deck", "composite_deck", "tile_deck"]);

function enrichSpatialRelationships(raw: SitePlanInputs): SitePlanInputs {
  const features = raw.confirmedFeatures;
  const enriched = features.map((f) => ({ ...f }));

  const concreteId = enriched.find((f) => f.type === "concrete_deck")?.id;
  const patioId = enriched.find((f) => f.type === "covered_patio")?.id;

  return {
    ...raw,
    confirmedFeatures: enriched.map((f) => {
      if (LIVING_TYPES.has(f.type) && !f.containedIn) {
        return { ...f, containedIn: concreteId ?? patioId ?? undefined };
      }
      if (POOL_DECK_TYPES.has(f.type) && !f.deckWrap) {
        return { ...f, deckWrap: "surround" as const };
      }
      return f;
    }),
  };
}

export async function POST(req: Request) {
  try {
    const inputs = (await req.json()) as SitePlanInputs;

    // Step 1 — Engineer gate
    const unconfirmed = inputs.confirmedFeatures.filter(
      (f) => !f.engineerConfirmed,
    );
    if (unconfirmed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "All features must be confirmed by the engineer before generating.",
        },
        { status: 400 },
      );
    }

    const enrichedInputs = enrichSpatialRelationships(inputs);

    // Step 3 — SVG generation
    const svgContent = generateSitePlanSvg(enrichedInputs);

    // Step 4 — DXF generation
    const dxfContent = generateSitePlanDxf(enrichedInputs);

    // Step 5 — Data sheet via Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 },
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
        max_tokens: 2000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: SITE_PLAN_GENERATOR_PROMPT(JSON.stringify(enrichedInputs)),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (generate):", errText);
      let detail = "AI data sheet generation failed";
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || detail;
      } catch { /* ignore */ }
      return NextResponse.json(
        { success: false, error: detail },
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

    let dataSheet: SitePlanDataSheet;
    try {
      dataSheet = parseAiJson<SitePlanDataSheet>(textBlock.text);
    } catch {
      console.error("Unparseable AI response (generate):", textBlock.text.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI data sheet response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { svgContent, dxfContent, dataSheet },
    });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
