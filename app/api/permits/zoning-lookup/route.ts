import { NextResponse } from "next/server";
import { geocodeAddress, fetchZimasParcel } from "@/lib/permits/zimas";
import { ZONING_SUMMARY_PROMPT } from "@/lib/permits/prompts";
import { parseAiJson } from "@/lib/permits/parseAiJson";
import { classifyZone, derivePoolSetbacks } from "@/lib/permits/zoningUtils";
import type { ZoningResult, OwnerInfo, PermitRecord } from "@/types/permits";

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
    result.lat = geo.lat;
    result.lon = geo.lon;
    result.zoneType = classifyZone(result.zoningClassification);
    result.poolSetbacks = derivePoolSetbacks(result.zoningClassification, result.overlays);

    // Fetch owner info and permit history in parallel — failures are non-fatal
    const [ownerInfo, permitHistory] = await Promise.allSettled([
      fetchOwnerInfo(address),
      fetchPermitHistory(geo.matchedAddress),
    ]);
    if (ownerInfo.status === "fulfilled") result.ownerInfo = ownerInfo.value;
    if (permitHistory.status === "fulfilled") result.permitHistory = permitHistory.value;

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("zoning-lookup error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fetchOwnerInfo(address: string): Promise<OwnerInfo | undefined> {
  const lightboxKey = process.env.LIGHTBOX_API_KEY;
  if (!lightboxKey) return undefined;

  const res = await fetch(
    `https://api.lightboxre.com/v1/parcels/address?address=${encodeURIComponent(address)}`,
    {
      headers: { "x-api-key": lightboxKey },
      cache: "no-store",
    }
  );
  if (!res.ok) return undefined;

  const json = await res.json();
  const parcel = json?.parcels?.[0] ?? json?.data?.[0];
  if (!parcel) return undefined;

  return {
    ownerName: parcel.ownerName ?? parcel.owner?.name,
    mailingAddress: parcel.ownerMailingAddress ?? parcel.owner?.mailingAddress,
    ownerOccupied: parcel.ownerOccupied,
  };
}

async function fetchPermitHistory(matchedAddress: string): Promise<PermitRecord[]> {
  // Parse street number and name from matched address (e.g. "123 MAIN ST, LOS ANGELES, CA 90012")
  const parts = matchedAddress.split(",")[0].trim().split(" ");
  if (parts.length < 2) return [];

  const streetNum = parts[0];
  const streetName = parts.slice(1).join(" ");

  const params = new URLSearchParams({
    $where: `address_start='${streetNum}' AND street_name='${streetName}'`,
    $order: "issue_date DESC",
    $limit: "10",
  });

  const res = await fetch(
    `https://data.lacity.org/resource/xnhu-aczu.json?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];

  const json: Record<string, string>[] = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((p) => ({
    permitNumber: p.permit_nbr ?? p.permit_number ?? "",
    permitType: p.permit_type ?? "",
    status: p.status ?? "",
    issueDate: p.issue_date?.split("T")[0],
    description: p.work_description ?? p.description,
    address: `${p.address_start ?? ""} ${p.street_name ?? ""}`.trim(),
  }));
}
