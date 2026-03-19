import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { projects, aiAnalysisEntries, aiAnalysisResults } from "../../../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

function formatReportDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  const database = db;
  try {
    const { id: projectId } = await params;
    const [project] = await database.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const entries = await database
      .select()
      .from(aiAnalysisEntries)
      .where(eq(aiAnalysisEntries.projectId, projectId))
      .orderBy(desc(aiAnalysisEntries.createdAt));

    const list = await Promise.all(
      entries.map(async (entry) => {
        const [res] = await database
          .select()
          .from(aiAnalysisResults)
          .where(eq(aiAnalysisResults.analysisId, entry.id));
        const rec = res?.reconciliationResult as {
          confidence?: string;
          overall_progress?: number | null;
          sections?: unknown[];
          project?: string;
        } | null;
        const confidence = rec?.confidence ?? null;
        const sectionCount = Array.isArray(rec?.sections) ? rec.sections.length : 0;
        const overallProgress =
          rec?.overall_progress != null ? rec.overall_progress : null;
        const projectName = rec?.project?.trim() || project.name;
        const dateLabel = formatReportDate(entry.asOfDate);
        const parts: string[] = [projectName, dateLabel];
        if (sectionCount > 0) parts.push(`${sectionCount} section${sectionCount !== 1 ? "s" : ""}`);
        if (overallProgress != null) parts.push(`${overallProgress}%`);
        if (confidence) parts.push(confidence);
        const label = parts.join(" · ");

        return {
          id: entry.id,
          asOfDate: entry.asOfDate,
          createdAt: entry.createdAt,
          confidence,
          sectionCount,
          overallProgress,
          label,
        };
      })
    );

    return NextResponse.json(list);
  } catch (err) {
    console.error("[GET /api/projects/[id]/analyses]", err);
    return NextResponse.json(
      { error: "Failed to list analyses" },
      { status: 500 }
    );
  }
}
