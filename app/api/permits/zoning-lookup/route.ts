import { NextResponse } from "next/server";
import { geocodeAddress, fetchZimasParcel } from "@/lib/permits/zimas";
import { ZONING_SUMMARY_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import type { ZoningResult } from "@/types/permits";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

export async function POST(req: Request) {
  try {
    const { address } = (await req.json()) as { address?: string };

    if (!address?.trim()) {
      return NextResponse.json(
        { success: false, error: "address is required" },
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

    const geo = await geocodeAddress(address);
    if (!geo) {
      return NextResponse.json(
        { success: false, error: "Could not geocode address. Check the address and try again." },
        { status: 404 }
      );
    }

    const parcel = await fetchZimasParcel(geo.lat, geo.lon);
    if (!parcel) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No zoning data found for this address. This tool covers City of Los Angeles parcels only. Addresses in unincorporated LA County (e.g. View Park, Ladera Heights, East LA) or other cities (Culver City, Beverly Hills, etc.) are not supported.",
        },
        { status: 404 }
      );
    }

    const rawJson = JSON.stringify(
      { matchedAddress: geo.matchedAddress, ...parcel },
      null,
      2
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
        system: "You are a permit technician assistant for a pool construction company in Los Angeles. You always return valid JSON only — no markdown, no explanation, no preamble.",
        messages: [
          {
            role: "user",
            content: `${ZONING_SUMMARY_PROMPT}\n\nRaw ZIMAS data:\n${rawJson}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error (zoning):", errText);
      return NextResponse.json(
        { success: false, error: "AI summary failed" },
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

    let result: ZoningResult;
    try {
      result = parseAiJson<ZoningResult>(textBlock.text);
    } catch {
      console.error("Unparseable AI response (zoning):", textBlock.text.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 502 }
      );
    }

    result.matchedAddress = geo.matchedAddress;
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("zoning-lookup error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
