import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { projects, projectTrelloLinks } from "../../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { id: projectId } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const links = await db
      .select()
      .from(projectTrelloLinks)
      .where(eq(projectTrelloLinks.projectId, projectId))
      .orderBy(projectTrelloLinks.createdAt);
    return NextResponse.json(links);
  } catch (err) {
    console.error("[GET /api/projects/[id]/trello-links]", err);
    return NextResponse.json({ error: "Failed to fetch Trello links" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { id: projectId } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const listId = typeof body.listId === "string" ? body.listId.trim() : "";
    if (!listId) {
      return NextResponse.json({ error: "listId is required" }, { status: 400 });
    }

    // Check for duplicate
    const [existing] = await db
      .select()
      .from(projectTrelloLinks)
      .where(
        and(
          eq(projectTrelloLinks.projectId, projectId),
          eq(projectTrelloLinks.listId, listId)
        )
      );
    if (existing) {
      return NextResponse.json(
        { error: "This Trello list is already linked to this project" },
        { status: 409 }
      );
    }

    const [link] = await db
      .insert(projectTrelloLinks)
      .values({
        projectId,
        listId,
        listName: typeof body.listName === "string" ? body.listName.trim() || null : null,
        boardId: typeof body.boardId === "string" ? body.boardId.trim() || null : null,
        boardName: typeof body.boardName === "string" ? body.boardName.trim() || null : null,
      })
      .returning();

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/[id]/trello-links]", err);
    return NextResponse.json({ error: "Failed to link Trello list" }, { status: 500 });
  }
}
