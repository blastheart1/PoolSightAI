import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import {
  projects,
  aiAnalysisEntries,
  aiAnalysisResults,
} from "../../../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const { id: projectId, entryId } = await params;
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [entry] = await db
      .select()
      .from(aiAnalysisEntries)
      .where(
        and(
          eq(aiAnalysisEntries.id, entryId),
          eq(aiAnalysisEntries.projectId, projectId)
        )
      );
    if (!entry) {
      return NextResponse.json(
        { error: "Report entry not found" },
        { status: 404 }
      );
    }

    const [resultRow] = await db
      .select()
      .from(aiAnalysisResults)
      .where(eq(aiAnalysisResults.analysisId, entry.id));

    const reconciliationResult =
      resultRow?.reconciliationResult ?? null;

    return NextResponse.json({
      id: entry.id,
      projectId: entry.projectId,
      asOfDate: entry.asOfDate,
      pmUpdate: entry.pmUpdate,
      createdAt: entry.createdAt,
      reconciliationResult,
    });
  } catch (err) {
    console.error("[GET /api/projects/[id]/analyses/[entryId]]", err);
    return NextResponse.json(
      { error: "Failed to load report entry" },
      { status: 500 }
    );
  }
}
