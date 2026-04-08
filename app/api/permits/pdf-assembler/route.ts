import { NextResponse } from "next/server";
import { mergePdfs } from "@/lib/permits/pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { documents } = (await req.json()) as {
      documents?: { pdfBase64: string; documentType: string }[];
    };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "documents array is required with at least one PDF" },
        { status: 400 }
      );
    }

    for (const doc of documents) {
      if (!doc.pdfBase64 || !doc.documentType) {
        return NextResponse.json(
          {
            success: false,
            error: "Each document must have pdfBase64 and documentType",
          },
          { status: 400 }
        );
      }
    }

    const { pdfBase64: mergedBase64, pageCount } = await mergePdfs(documents);

    return NextResponse.json({
      success: true,
      data: { pdfBase64: mergedBase64, pageCount },
    });
  } catch (err) {
    console.error("pdf-assembler error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to merge PDFs" },
      { status: 500 }
    );
  }
}
