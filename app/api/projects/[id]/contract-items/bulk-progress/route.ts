import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import {
  projects,
  projectContractItems,
  aiAnalysisResultLineItems,
} from "../../../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

type ProgressUpdate = {
  contractItemId: string;
  newProgressPct: number;
  analysisResultLineItemId?: string;
};

export async function PATCH(
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
    const updates: ProgressUpdate[] = Array.isArray(body.updates) ? body.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "updates array is required and must not be empty" }, { status: 400 });
    }

    const results: {
      contractItemId: string;
      newProgressPct: number;
      completedAmount: string | null;
    }[] = [];

    for (const update of updates) {
      const { contractItemId, newProgressPct, analysisResultLineItemId } = update;

      if (typeof contractItemId !== "string" || !contractItemId) continue;
      if (typeof newProgressPct !== "number" || newProgressPct < 0 || newProgressPct > 100) {
        return NextResponse.json(
          { error: `Invalid newProgressPct for item ${contractItemId}: must be 0–100` },
          { status: 400 }
        );
      }

      // Verify item belongs to this project
      const [item] = await db
        .select()
        .from(projectContractItems)
        .where(
          and(
            eq(projectContractItems.id, contractItemId),
            eq(projectContractItems.projectId, projectId)
          )
        );
      if (!item) continue;

      // Recalculate completedAmount
      const amount = item.amount != null ? parseFloat(String(item.amount)) : null;
      const completedAmount =
        amount != null ? String((amount * newProgressPct) / 100) : null;

      await db
        .update(projectContractItems)
        .set({
          progressOverallPct: String(newProgressPct),
          completedAmount,
          updatedAt: new Date(),
        })
        .where(eq(projectContractItems.id, contractItemId));

      // Mark the AI result line item as applied
      if (analysisResultLineItemId) {
        await db
          .update(aiAnalysisResultLineItems)
          .set({
            appliedAt: new Date(),
            appliedProgressPct: String(newProgressPct),
          })
          .where(eq(aiAnalysisResultLineItems.id, analysisResultLineItemId));
      }

      results.push({ contractItemId, newProgressPct, completedAmount });
    }

    return NextResponse.json({ updated: results });
  } catch (err) {
    console.error("[PATCH /api/projects/[id]/contract-items/bulk-progress]", err);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
