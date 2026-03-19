import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import {
  projects,
  aiAnalysisEntries,
  aiAnalysisImages,
  aiAnalysisResults,
  aiAnalysisResultLineItems,
  projectContractItems,
} from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const { id: projectId } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const asOfDate =
      typeof body.asOfDate === "string" && body.asOfDate
        ? body.asOfDate
        : new Date().toISOString().split("T")[0];
    const pmUpdate = typeof body.pmUpdate === "string" ? body.pmUpdate : null;
    const reconciliationResult = body.reconciliationResult ?? null;
    if (!reconciliationResult || typeof reconciliationResult !== "object") {
      return NextResponse.json(
        { error: "reconciliationResult is required" },
        { status: 400 }
      );
    }
    const images = Array.isArray(body.images) ? body.images : [];

    const [entry] = await db
      .insert(aiAnalysisEntries)
      .values({
        projectId,
        asOfDate,
        pmUpdate,
      })
      .returning();
    if (!entry) {
      return NextResponse.json(
        { error: "Failed to create analysis entry" },
        { status: 500 }
      );
    }

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      await db.insert(aiAnalysisImages).values({
        analysisId: entry.id,
        storageKey: img.storageKey ?? img.b64 ? `data:${i}` : null,
        contentType: img.contentType ?? "image/jpeg",
        sequence: i,
      });
    }

    const [result] = await db
      .insert(aiAnalysisResults)
      .values({
        analysisId: entry.id,
        reconciliationResult,
      })
      .returning();
    if (!result) {
      return NextResponse.json(
        { error: "Failed to save analysis result" },
        { status: 500 }
      );
    }

    const sections = reconciliationResult.sections;
    if (Array.isArray(sections)) {
      const contractItemRows = await db
        .select({ id: projectContractItems.id, productService: projectContractItems.productService })
        .from(projectContractItems)
        .where(eq(projectContractItems.projectId, projectId));
      const byProductService = new Map(
        contractItemRows.map((r) => [r.productService?.toLowerCase().trim() ?? "", r.id])
      );
      for (const section of sections) {
        const sectionId = section.id ?? "";
        const rows = section.rows ?? [];
        for (const row of rows) {
          const lineItem = row.line_item ?? "";
          const contractItemId = byProductService.get(lineItem.toLowerCase().trim()) ?? null;
          await db.insert(aiAnalysisResultLineItems).values({
            analysisResultId: result.id,
            contractItemId,
            sectionId,
            lineItem,
            currentPercent: row.current_percent ?? null,
            suggestedPercent: row.suggested_percent ?? null,
            status: row.status ?? null,
            notes: row.notes ?? null,
          });
        }
      }
    }

    return NextResponse.json({
      id: entry.id,
      projectId,
      asOfDate,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    console.error("[POST /api/projects/[id]/analysis]", err);
    return NextResponse.json(
      { error: "Failed to save analysis" },
      { status: 500 }
    );
  }
}
