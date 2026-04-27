import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import {
  projects,
  projectContractItems,
  projectSelectedItems,
  projectTrelloLinks,
} from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { toDec } from "../../../../lib/db/utils";

export const runtime = "nodejs";

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
    const [contractItems, selectedRows, trelloLinkedLists] = await Promise.all([
      db.select().from(projectContractItems).where(eq(projectContractItems.projectId, id)).orderBy(projectContractItems.rowIndex),
      db.select({ contractItemId: projectSelectedItems.contractItemId }).from(projectSelectedItems).where(eq(projectSelectedItems.projectId, id)),
      db.select().from(projectTrelloLinks).where(eq(projectTrelloLinks.projectId, id)).orderBy(projectTrelloLinks.createdAt),
    ]);

    return NextResponse.json({
      ...project,
      contractItems,
      selectedLineItemIds: selectedRows.map((r) => r.contractItemId),
      trelloLinkedLists,
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
      if (newItems.length === 0) {
        const existingCount = await db
          .select({ id: projectContractItems.id })
          .from(projectContractItems)
          .where(eq(projectContractItems.projectId, id));
        if (existingCount.length > 0) {
          return NextResponse.json(
            { error: "Refusing to overwrite existing contract items with empty array. Send items or omit the items field." },
            { status: 400 }
          );
        }
      }

      // Snapshot progress fields from existing items keyed by rowIndex.
      // This preserves progress data when incoming items come from a fresh
      // inline-table parse that has no progress context (e.g. manual re-parse
      // of a base-contract EML). Items returned by runLinksFlow already carry
      // the merged progress values, so they take precedence via the null-check below.
      type ProgressSnapshot = {
        progressOverallPct: string | null;
        completedAmount: string | null;
        previouslyInvoicedPct: string | null;
        previouslyInvoicedAmount: string | null;
        newProgressPct: string | null;
        thisBill: string | null;
      };
      const existingRows = await db
        .select({
          rowIndex:               projectContractItems.rowIndex,
          progressOverallPct:     projectContractItems.progressOverallPct,
          completedAmount:        projectContractItems.completedAmount,
          previouslyInvoicedPct:  projectContractItems.previouslyInvoicedPct,
          previouslyInvoicedAmount: projectContractItems.previouslyInvoicedAmount,
          newProgressPct:         projectContractItems.newProgressPct,
          thisBill:               projectContractItems.thisBill,
        })
        .from(projectContractItems)
        .where(eq(projectContractItems.projectId, id));
      const progressByIndex = new Map<number, ProgressSnapshot>(
        existingRows.map((r) => [r.rowIndex, {
          progressOverallPct:     r.progressOverallPct,
          completedAmount:        r.completedAmount,
          previouslyInvoicedPct:  r.previouslyInvoicedPct,
          previouslyInvoicedAmount: r.previouslyInvoicedAmount,
          newProgressPct:         r.newProgressPct,
          thisBill:               r.thisBill,
        }])
      );

      await db.delete(projectSelectedItems).where(eq(projectSelectedItems.projectId, id));
      await db.delete(projectContractItems).where(eq(projectContractItems.projectId, id));
      if (newItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = newItems.map((it: any, i: number) => {
          const snap = progressByIndex.get(i);
          return {
            projectId: id,
            rowIndex: i,
            itemType: it.type ?? "item",
            productService: it.productService ?? "",
            qty: it.qty != null ? toDec(it.qty) : null,
            rate: it.rate != null ? toDec(it.rate) : null,
            amount: it.amount != null ? toDec(it.amount) : null,
            mainCategory: it.mainCategory ?? null,
            subCategory: it.subCategory ?? null,
            // Prefer progress from incoming item; fall back to snapshot from same position.
            progressOverallPct:       it.progressOverallPct != null       ? toDec(it.progressOverallPct)       : (snap?.progressOverallPct       ?? null),
            completedAmount:          it.completedAmount != null           ? toDec(it.completedAmount)          : (snap?.completedAmount          ?? null),
            previouslyInvoicedPct:    it.previouslyInvoicedPct != null     ? toDec(it.previouslyInvoicedPct)   : (snap?.previouslyInvoicedPct    ?? null),
            previouslyInvoicedAmount: it.previouslyInvoicedAmount != null  ? toDec(it.previouslyInvoicedAmount): (snap?.previouslyInvoicedAmount  ?? null),
            newProgressPct:           it.newProgressPct != null            ? toDec(it.newProgressPct)           : (snap?.newProgressPct           ?? null),
            thisBill:                 it.thisBill != null                  ? toDec(it.thisBill)                 : (snap?.thisBill                 ?? null),
            optionalPackageNumber:
              typeof it.optionalPackageNumber === "number" ? it.optionalPackageNumber : null,
            columnBLabel: it.columnBLabel ?? null,
            isAddendumHeader: it.isAddendumHeader === true,
            addendumNumber: it.addendumNumber ?? null,
            addendumUrlId: it.addendumUrlId ?? null,
            isBlankRow: it.isBlankRow === true,
          };
        });
        await db.insert(projectContractItems).values(rows);
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

    const [[updated], contractItems, selectedRows, trelloLinkedLists] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, id)),
      db.select().from(projectContractItems).where(eq(projectContractItems.projectId, id)).orderBy(projectContractItems.rowIndex),
      db.select({ contractItemId: projectSelectedItems.contractItemId }).from(projectSelectedItems).where(eq(projectSelectedItems.projectId, id)),
      db.select().from(projectTrelloLinks).where(eq(projectTrelloLinks.projectId, id)).orderBy(projectTrelloLinks.createdAt),
    ]);

    return NextResponse.json({
      ...updated,
      contractItems,
      selectedLineItemIds: selectedRows.map((r) => r.contractItemId),
      trelloLinkedLists,
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
