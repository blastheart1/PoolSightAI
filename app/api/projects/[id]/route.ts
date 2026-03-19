import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import {
  projects,
  projectContractItems,
  projectSelectedItems,
} from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function toDec(s: number | string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return String(s);
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
  try {
    const { id } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const contractItems = await db
      .select()
      .from(projectContractItems)
      .where(eq(projectContractItems.projectId, id))
      .orderBy(projectContractItems.rowIndex);
    const selectedRows = await db
      .select({ contractItemId: projectSelectedItems.contractItemId })
      .from(projectSelectedItems)
      .where(eq(projectSelectedItems.projectId, id));
    const selectedLineItemIds = selectedRows.map((r) => r.contractItemId);

    return NextResponse.json({
      ...project,
      contractItems,
      selectedLineItemIds,
    });
  } catch (err) {
    console.error("[GET /api/projects/[id]]", err);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { id } = await params;
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string") updates.name = body.name;
    if (body.location) {
      const loc = body.location;
      if (loc.orderNo !== undefined) updates.orderNo = loc.orderNo ?? null;
      if (loc.streetAddress !== undefined) updates.streetAddress = loc.streetAddress ?? null;
      if (loc.city !== undefined) updates.city = loc.city ?? null;
      if (loc.state !== undefined) updates.state = loc.state ?? null;
      if (loc.zip !== undefined) updates.zip = loc.zip ?? null;
      if (loc.clientName !== undefined) updates.clientName = loc.clientName ?? null;
      if (loc.orderGrandTotal !== undefined)
        updates.orderGrandTotal = loc.orderGrandTotal != null ? toDec(loc.orderGrandTotal) : null;
      const street = loc.streetAddress != null && String(loc.streetAddress).trim() ? String(loc.streetAddress).trim() : "";
      const client = loc.clientName != null && String(loc.clientName).trim() ? String(loc.clientName).trim() : "";
      const autoName = [street, client].filter(Boolean).join(" | ");
      if (autoName) updates.name = autoName;
    }
    if (body.trelloLinks !== undefined)
      updates.trelloLinks = typeof body.trelloLinks === "string" ? body.trelloLinks.trim() || null : null;

    const newItems = Array.isArray(body.items) ? body.items : null;
    if (newItems) {
      await db.delete(projectSelectedItems).where(eq(projectSelectedItems.projectId, id));
      await db.delete(projectContractItems).where(eq(projectContractItems.projectId, id));
      for (let i = 0; i < newItems.length; i++) {
        const it = newItems[i];
        await db.insert(projectContractItems).values({
          projectId: id,
          rowIndex: i,
          itemType: it.type ?? "item",
          productService: it.productService ?? "",
          qty: it.qty != null ? toDec(it.qty) : null,
          rate: it.rate != null ? toDec(it.rate) : null,
          amount: it.amount != null ? toDec(it.amount) : null,
          mainCategory: it.mainCategory ?? null,
          subCategory: it.subCategory ?? null,
          progressOverallPct: it.progressOverallPct != null ? toDec(it.progressOverallPct) : null,
          completedAmount: it.completedAmount != null ? toDec(it.completedAmount) : null,
          previouslyInvoicedPct: it.previouslyInvoicedPct != null ? toDec(it.previouslyInvoicedPct) : null,
          previouslyInvoicedAmount: it.previouslyInvoicedAmount != null ? toDec(it.previouslyInvoicedAmount) : null,
          newProgressPct: it.newProgressPct != null ? toDec(it.newProgressPct) : null,
          thisBill: it.thisBill != null ? toDec(it.thisBill) : null,
          optionalPackageNumber:
            typeof it.optionalPackageNumber === "number" ? it.optionalPackageNumber : null,
        });
      }
      (updates as { parsedAt?: Date }).parsedAt = new Date();
    }

    if (Object.keys(updates).length > 1) {
      await db.update(projects).set(updates as Record<string, unknown>).where(eq(projects.id, id));
    }

    if (Array.isArray(body.selectedLineItemIds)) {
      await db.delete(projectSelectedItems).where(eq(projectSelectedItems.projectId, id));
      for (const contractItemId of body.selectedLineItemIds) {
        if (contractItemId) {
          await db.insert(projectSelectedItems).values({
            projectId: id,
            contractItemId,
          });
        }
      }
    }

    const [updated] = await db.select().from(projects).where(eq(projects.id, id));
    const contractItems = await db
      .select()
      .from(projectContractItems)
      .where(eq(projectContractItems.projectId, id))
      .orderBy(projectContractItems.rowIndex);
    const selectedRows = await db
      .select({ contractItemId: projectSelectedItems.contractItemId })
      .from(projectSelectedItems)
      .where(eq(projectSelectedItems.projectId, id));

    return NextResponse.json({
      ...updated,
      contractItems,
      selectedLineItemIds: selectedRows.map((r) => r.contractItemId),
    });
  } catch (err) {
    console.error("[PATCH /api/projects/[id]]", err);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const { id } = await params;
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await db.delete(projects).where(eq(projects.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/projects/[id]]", err);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
