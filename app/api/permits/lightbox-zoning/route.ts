import { NextResponse } from "next/server";
import { fetchZoning } from "@/lib/permits/lightbox";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address?.trim()) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 },
      );
    }

    const data = await fetchZoning(address);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "No zoning data found for this address." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data });
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
