import { NextResponse } from "next/server";
import { fetchZoning } from "@/lib/permits/lightbox";
import {
  deleteCachedZoning,
  getCachedZoning,
  normalizeAddress,
  upsertCachedZoning,
} from "@/lib/permits/lightboxCache";

export const runtime = "nodejs";

interface LightboxZoningRequest {
  address?: string;
  refresh?: boolean;
}

export async function POST(req: Request) {
  try {
    const { address, refresh } = (await req.json()) as LightboxZoningRequest;
    if (!address?.trim()) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 },
      );
    }

    const raw = address.trim();
    const normalized = normalizeAddress(raw);

    if (refresh) {
      await deleteCachedZoning(normalized);
    } else {
      const cached = await getCachedZoning(normalized);
      if (cached) {
        if (cached.httpStatus === 404) {
          return NextResponse.json(
            {
              success: false,
              error: "No zoning data found for this address.",
              cached: true,
              normalizedAddress: cached.normalizedAddress,
            },
            { status: 404 },
          );
        }
        return NextResponse.json({
          success: true,
          data: cached.data,
          cached: true,
          normalizedAddress: cached.normalizedAddress,
          fetchedAt: cached.fetchedAt.toISOString(),
        });
      }
    }

    const data = await fetchZoning(raw);
    if (!data) {
      await upsertCachedZoning({
        rawAddress: raw,
        normalizedAddress: normalized,
        data: null,
        httpStatus: 404,
      });
      return NextResponse.json(
        {
          success: false,
          error: "No zoning data found for this address.",
          cached: false,
          normalizedAddress: normalized,
        },
        { status: 404 },
      );
    }

    await upsertCachedZoning({
      rawAddress: raw,
      normalizedAddress: normalized,
      data,
      httpStatus: 200,
    });

    return NextResponse.json({
      success: true,
      data,
      cached: false,
      normalizedAddress: normalized,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("lightbox-zoning error:", err);
    const message =
      err instanceof Error && err.message.includes("401")
        ? "Lightbox API authorization failed — check your API key."
        : "Lightbox API request failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }
}
