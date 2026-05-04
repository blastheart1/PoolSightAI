import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { projects, projectSensitivityReports } from "../../../../../lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { TranscriptSegment, FlaggedSegment } from "@/lib/sensitivity/types";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("type");

  const conditions = mediaType
    ? and(
        eq(projectSensitivityReports.projectId, projectId),
        eq(projectSensitivityReports.mediaType, mediaType)
      )
    : eq(projectSensitivityReports.projectId, projectId);

  const reports = await db
    .select({
      id: projectSensitivityReports.id,
      mediaType: projectSensitivityReports.mediaType,
      fileName: projectSensitivityReports.fileName,
      flagCount: projectSensitivityReports.flagCount,
      wordCount: projectSensitivityReports.wordCount,
      createdAt: projectSensitivityReports.createdAt,
    })
    .from(projectSensitivityReports)
    .where(conditions)
    .orderBy(desc(projectSensitivityReports.createdAt));

  return NextResponse.json(reports);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: projectId } = await params;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json() as {
    mediaType?: unknown;
    fileName?: unknown;
    transcript?: unknown;
    segments?: TranscriptSegment[];
    flags?: FlaggedSegment[];
  };

  const mediaType = body.mediaType === "video" ? "video" : "audio";
  const fileName = typeof body.fileName === "string" && body.fileName.trim()
    ? body.fileName.trim()
    : "unknown";
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

  const segments = Array.isArray(body.segments) ? body.segments : [];
  const flags = Array.isArray(body.flags) ? body.flags : [];
  const flagCount = flags.length;
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const [report] = await db
    .insert(projectSensitivityReports)
    .values({ projectId, mediaType, fileName, transcript, segments, flags, flagCount, wordCount })
    .returning();

  return NextResponse.json({ id: report.id }, { status: 201 });
}
