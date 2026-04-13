import { NextRequest, NextResponse } from "next/server";
import { preParseEml } from "../../../lib/preParseEml";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const file = body.file;
    if (!file || typeof file !== "string" || !file.trim()) {
      return NextResponse.json(
        { error: "Missing or empty 'file' field (base64 EML)" },
        { status: 400 }
      );
    }

    const result = await preParseEml(file);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pre-parse failed";
    console.error("[pre-parse-eml]", err);
    return NextResponse.json(
      { error: "Pre-parse failed", details: message },
      { status: 500 }
    );
  }
}
