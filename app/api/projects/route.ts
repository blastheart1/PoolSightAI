import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { projects, projectContractItems, projectSelectedItems } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { toDec } from "../../../lib/db/utils";

export const runtime = "nodejs";

export async function GET() {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const list = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const location = body.location ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    const street = location.streetAddress != null && String(location.streetAddress).trim() ? String(location.streetAddress).trim() : "";
    const client = location.clientName != null && String(location.clientName).trim() ? String(location.clientName).trim() : "";
    const autoName = [street, client].filter(Boolean).join(" | ");
    const name = autoName || body.name || "New Project";

    const [project] = await db
      .insert(projects)
      .values({
        name,
        orderNo: location.orderNo ?? null,
        streetAddress: location.streetAddress ?? null,
        city: location.city ?? null,
        state: location.state ?? null,
        zip: location.zip ?? null,
        clientName: location.clientName ?? null,
        orderGrandTotal: location.orderGrandTotal != null ? toDec(location.orderGrandTotal) : null,
        parsedAt: items.length > 0 ? new Date() : null,
      })
      .returning();

    if (!project) {
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }

    if (items.length > 0) {
      const rows = items.map((it: Record<string, unknown>, i: number) => ({
        projectId: project.id,
        rowIndex: i,
        itemType: (it.type as string) ?? "item",
        productService: (it.productService as string) ?? "",
        qty: it.qty != null ? toDec(it.qty as string | number) : null,
        rate: it.rate != null ? toDec(it.rate as string | number) : null,
        amount: it.amount != null ? toDec(it.amount as string | number) : null,
        mainCategory: (it.mainCategory as string) ?? null,
        subCategory: (it.subCategory as string) ?? null,
        progressOverallPct: it.progressOverallPct != null ? toDec(it.progressOverallPct as string | number) : null,
        completedAmount: it.completedAmount != null ? toDec(it.completedAmount as string | number) : null,
        previouslyInvoicedPct: it.previouslyInvoicedPct != null ? toDec(it.previouslyInvoicedPct as string | number) : null,
        previouslyInvoicedAmount: it.previouslyInvoicedAmount != null ? toDec(it.previouslyInvoicedAmount as string | number) : null,
        newProgressPct: it.newProgressPct != null ? toDec(it.newProgressPct as string | number) : null,
        thisBill: it.thisBill != null ? toDec(it.thisBill as string | number) : null,
        optionalPackageNumber:
          typeof it.optionalPackageNumber === "number" ? it.optionalPackageNumber : null,
        columnBLabel: (it.columnBLabel as string) ?? null,
        isAddendumHeader: it.isAddendumHeader === true,
        addendumNumber: (it.addendumNumber as string) ?? null,
        addendumUrlId: (it.addendumUrlId as string) ?? null,
        isBlankRow: it.isBlankRow === true,
      }));
      await db.insert(projectContractItems).values(rows);
    }

    return NextResponse.json(project);
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
