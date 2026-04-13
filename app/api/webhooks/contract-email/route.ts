import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { preParseEml } from "../../../../lib/preParseEml";
import { db } from "../../../../lib/db";
import { projects, projectContractItems, projectSelectedItems } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  extractOrderItems,
  extractLocation,
  isLocationValid,
} from "../../../../lib/tableExtractor";
import { parseEML } from "../../../../lib/emlParser";
import { validateAddendumUrl } from "../../../../lib/addendumParser";
import { extractContractLinks } from "../../../../lib/contractLinkExtractor";
import {
  findProjectByOrderNo,
  runLinksFlow,
  insertContractItems,
  replaceContractItems,
} from "../../../../lib/contractParseFlow";

export const runtime = "nodejs";

type WebhookAction = "created" | "updated" | "skipped";

interface WebhookResponse {
  action: WebhookAction;
  projectId?: string;
  orderNo?: string;
  clientName?: string;
  itemCount?: number;
  mergeInfo?: {
    existingItemCount: number;
    newAddendumCount: number;
    skippedDuplicateCount: number;
    totalItemCount: number;
  };
  reason?: string;
}

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const xHeader = request.headers.get("x-webhook-secret") ?? "";

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : xHeader;

  if (!token) return false;

  try {
    const a = Buffer.from(secret, "utf-8");
    const b = Buffer.from(token, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function toDec(s: number | string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return String(s);
}

export async function POST(request: NextRequest) {
  // Auth
  if (!verifySecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const eml = body.eml;
    if (!eml || typeof eml !== "string" || !eml.trim()) {
      return NextResponse.json(
        { error: "Missing or empty 'eml' field (base64 EML)" },
        { status: 400 }
      );
    }

    // Pre-parse to extract identity and links
    const preParse = await preParseEml(eml);
    if (!preParse.orderNo) {
      return NextResponse.json(
        { error: "Could not extract Order ID from email" },
        { status: 400 }
      );
    }

    // Check if project exists by orderNo
    const existingProject = await findProjectByOrderNo(preParse.orderNo);

    // Determine email type by presence of links
    const hasLinks = preParse.hasOriginalContract || preParse.addendumCount > 0;

    if (existingProject && hasLinks) {
      // --- EXISTING PROJECT + LINKS: append addendums ---
      const { items, mergeInfo } = await runLinksFlow({
        originalContractUrl: preParse.originalContractUrl ?? "",
        addendumLinks: preParse.addendumUrls,
        existingProjectId: existingProject.id,
      });

      if (mergeInfo && mergeInfo.newAddendumCount === 0) {
        const response: WebhookResponse = {
          action: "skipped",
          projectId: existingProject.id,
          orderNo: preParse.orderNo,
          reason: "No new addendums to import",
        };
        return NextResponse.json(response);
      }

      // Replace items with merged set
      await db
        .delete(projectSelectedItems)
        .where(eq(projectSelectedItems.projectId, existingProject.id));
      await replaceContractItems(existingProject.id, items);
      await db
        .update(projects)
        .set({ parsedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, existingProject.id));

      const response: WebhookResponse = {
        action: "updated",
        projectId: existingProject.id,
        orderNo: preParse.orderNo,
        clientName: preParse.clientName,
        itemCount: items.length,
        mergeInfo: mergeInfo ?? undefined,
      };
      return NextResponse.json(response);
    }

    if (existingProject && !hasLinks) {
      // --- EXISTING PROJECT + INLINE TABLE: skip (already imported) ---
      const response: WebhookResponse = {
        action: "skipped",
        projectId: existingProject.id,
        orderNo: preParse.orderNo,
        reason: "Base contract already exists, no new addendum links detected",
      };
      return NextResponse.json(response);
    }

    // --- NEW PROJECT ---
    let parsedItems: { location: Record<string, unknown>; items: unknown[] };

    if (hasLinks) {
      // Links mode: fetch original contract + addendums from ProDBX
      const { location, items } = await runLinksFlow({
        originalContractUrl: preParse.originalContractUrl ?? "",
        addendumLinks: preParse.addendumUrls,
      });
      parsedItems = { location: location as unknown as Record<string, unknown>, items };
    } else {
      // Inline table mode: parse from EML HTML
      const buffer = Buffer.from(eml, "base64");
      const parsed = await parseEML(buffer);
      const location = extractLocation(parsed.text);
      // Zapier-constructed EMLs may lack MIME Content-Type headers,
      // so mailparser puts HTML content into .text instead of .html.
      // Fall back to .text if .html is empty but .text contains HTML tags.
      let htmlContent = parsed.html;
      if (!htmlContent && parsed.text && /<table[\s>]/i.test(parsed.text)) {
        htmlContent = parsed.text;
      }
      if (!htmlContent) {
        return NextResponse.json(
          { error: "No HTML content found in email. Cannot extract order items table." },
          { status: 400 }
        );
      }
      const items = extractOrderItems(htmlContent);
      parsedItems = { location: location as unknown as Record<string, unknown>, items };
    }

    const loc = parsedItems.location;
    const street = loc.streetAddress ? String(loc.streetAddress).trim() : "";
    const client = loc.clientName ? String(loc.clientName).trim() : "";
    const autoName = [street, client].filter(Boolean).join(" | ") || `Order ${preParse.orderNo}`;

    const [newProject] = await db
      .insert(projects)
      .values({
        name: autoName,
        orderNo: String(loc.orderNo ?? preParse.orderNo),
        streetAddress: loc.streetAddress ? String(loc.streetAddress) : null,
        city: loc.city ? String(loc.city) : null,
        state: loc.state ? String(loc.state) : null,
        zip: loc.zip ? String(loc.zip) : null,
        clientName: loc.clientName ? String(loc.clientName) : null,
        orderGrandTotal: loc.orderGrandTotal != null ? toDec(loc.orderGrandTotal as number) : null,
        parsedAt: new Date(),
      })
      .returning();

    if (!newProject) {
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }

    // Type-safe cast for insertContractItems
    const typedItems = parsedItems.items as Array<{
      type?: string;
      productService?: string;
      qty?: number | string;
      rate?: number | string;
      amount?: number | string;
      mainCategory?: string | null;
      subCategory?: string | null;
      columnBLabel?: string;
      isAddendumHeader?: boolean;
      addendumNumber?: string;
      addendumUrlId?: string;
      isBlankRow?: boolean;
      optionalPackageNumber?: number;
      [key: string]: unknown;
    }>;

    await insertContractItems(
      newProject.id,
      typedItems.map((it) => ({
        type: (it.type as "maincategory" | "subcategory" | "item") ?? "item",
        productService: it.productService ?? "",
        qty: it.qty ?? "",
        rate: it.rate ?? "",
        amount: it.amount ?? "",
        mainCategory: it.mainCategory ?? null,
        subCategory: it.subCategory ?? null,
        columnBLabel: it.columnBLabel,
        isAddendumHeader: it.isAddendumHeader,
        addendumNumber: it.addendumNumber,
        addendumUrlId: it.addendumUrlId,
        isBlankRow: it.isBlankRow,
        optionalPackageNumber: it.optionalPackageNumber,
      }))
    );

    const response: WebhookResponse = {
      action: "created",
      projectId: newProject.id,
      orderNo: preParse.orderNo,
      clientName: preParse.clientName,
      itemCount: typedItems.length,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    console.error("[webhook/contract-email]", err);
    return NextResponse.json(
      { error: "Webhook processing failed", details: message },
      { status: 500 }
    );
  }
}
