import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { projects, projectTrelloLinks } from "../../../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { id: projectId, linkId } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [link] = await db
      .select()
      .from(projectTrelloLinks)
      .where(
        and(
          eq(projectTrelloLinks.id, linkId),
          eq(projectTrelloLinks.projectId, projectId)
        )
      );
    if (!link) {
      return NextResponse.json({ error: "Trello link not found" }, { status: 404 });
    }

    await db.delete(projectTrelloLinks).where(eq(projectTrelloLinks.id, linkId));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/projects/[id]/trello-links/[linkId]]", err);
    return NextResponse.json({ error: "Failed to remove Trello link" }, { status: 500 });
  }
}
