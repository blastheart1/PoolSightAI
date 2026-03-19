import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { projects, projectContractItems, projectSelectedItems } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

function toDec(s: number | string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return String(s);
}

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

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.insert(projectContractItems).values({
        projectId: project.id,
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

    return NextResponse.json(project);
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
