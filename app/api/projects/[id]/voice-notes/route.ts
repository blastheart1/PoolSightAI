import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { projects, projectVoiceNotes } from "../../../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: projectId } = await params;
  const notes = await db
    .select({
      id: projectVoiceNotes.id,
      label: projectVoiceNotes.label,
      wordCount: projectVoiceNotes.wordCount,
      transcript: projectVoiceNotes.transcript,
      createdAt: projectVoiceNotes.createdAt,
    })
    .from(projectVoiceNotes)
    .where(eq(projectVoiceNotes.projectId, projectId))
    .orderBy(desc(projectVoiceNotes.createdAt));
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: projectId } = await params;

  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json();
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const [note] = await db
    .insert(projectVoiceNotes)
    .values({ projectId, transcript, label, wordCount })
    .returning();

  return NextResponse.json(note, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId is required" }, { status: 400 });

  await db
    .delete(projectVoiceNotes)
    .where(eq(projectVoiceNotes.id, noteId));

  return NextResponse.json({ ok: true });
}
