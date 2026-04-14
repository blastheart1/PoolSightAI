import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { preParseEml, getCleanText } from "../../../../lib/preParseEml";
import { db } from "../../../../lib/db";
import { projects, projectContractItems, projectSelectedItems, webhookLogs } from "../../../../lib/db/schema";
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

type WebhookAction = "created" | "updated" | "skipped" | "error";

async function saveWebhookLog(data: {
  source: string;
  action: string;
  orderNo?: string;
  clientName?: string;
  projectId?: string;
  emailSubject?: string;
  itemCount?: number;
  payloadKeys?: string[];
  payloadSizes?: Record<string, unknown>;
  preParseResult?: Record<string, unknown> | null;
  parseResult?: Record<string, unknown> | null;
  errorMessage?: string;
  errorStack?: string;
}): Promise<void> {
  if (!db) return;
  try {
    await db.insert(webhookLogs).values({
      source: data.source,
      action: data.action,
      orderNo: data.orderNo ?? null,
      clientName: data.clientName ?? null,
      projectId: data.projectId ?? null,
      emailSubject: data.emailSubject ?? null,
      itemCount: data.itemCount ?? null,
      payloadKeys: data.payloadKeys ? JSON.stringify(data.payloadKeys) : null,
      payloadSizes: data.payloadSizes ? JSON.stringify(data.payloadSizes) : null,
      preParseResult: data.preParseResult ?? null,
      parseResult: data.parseResult ?? null,
      errorMessage: data.errorMessage ?? null,
      errorStack: data.errorStack ?? null,
    });
  } catch (logErr) {
    console.error("[webhook/contract-email] Failed to save webhook log:", logErr);
  }
}

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

  // Shared state for logging
  let logPayloadKeys: string[] = [];
  let logPayloadSizes: Record<string, unknown> = {};
  let logPreParse: Record<string, unknown> | null = null;
  let logEmailSubject: string | undefined;

  try {
    const body = await request.json();

    // Log full payload keys and sizes for debugging
    logPayloadKeys = Object.keys(body);
    logPayloadSizes = Object.fromEntries(
      logPayloadKeys.map((k) => [k, typeof body[k] === "string" ? body[k].length : typeof body[k]])
    );
    logEmailSubject = body.email_subject ?? undefined;
    console.log("[webhook/contract-email] Payload keys:", logPayloadKeys);
    console.log("[webhook/contract-email] Payload field sizes:", logPayloadSizes);
    if (body.email_subject) console.log("[webhook/contract-email] email_subject:", body.email_subject);
    if (body.email_from) console.log("[webhook/contract-email] email_from:", body.email_from);
    if (body.message_id) console.log("[webhook/contract-email] message_id:", body.message_id);

    const eml = body.eml;
    if (!eml || typeof eml !== "string" || !eml.trim()) {
      console.error("[webhook/contract-email] Missing eml field. Available fields:", logPayloadKeys);
      return NextResponse.json(
        { error: "Missing or empty 'eml' field (base64 EML)", availableFields: logPayloadKeys },
        { status: 400 }
      );
    }

    console.log("[webhook/contract-email] EML base64 length:", eml.length);

    // Pre-parse to extract identity and links
    const preParse = await preParseEml(eml);
    logPreParse = {
      orderNo: preParse.orderNo,
      clientName: preParse.clientName,
      subject: preParse.subject,
      hasOriginalContract: preParse.hasOriginalContract,
      addendumCount: preParse.addendumCount,
      streetAddress: preParse.streetAddress,
      orderGrandTotal: preParse.orderGrandTotal,
    };
    console.log("[webhook/contract-email] Pre-parse result:", logPreParse);

    if (!preParse.orderNo) {
      return NextResponse.json(
        { error: "Could not extract Order ID from email" },
        { status: 400 }
      );
    }

    // Check if project exists by orderNo
    const existingProject = await findProjectByOrderNo(preParse.orderNo);
    console.log("[webhook/contract-email] Existing project lookup:", existingProject ? { id: existingProject.id, name: existingProject.name } : "NOT FOUND");

    // Determine email type by presence of links
    const hasLinks = preParse.hasOriginalContract || preParse.addendumCount > 0;
    console.log("[webhook/contract-email] Flow:", { hasLinks, existingProject: !!existingProject });

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
      console.log("[webhook/contract-email] Using LINKS flow");
      const { location, items } = await runLinksFlow({
        originalContractUrl: preParse.originalContractUrl ?? "",
        addendumLinks: preParse.addendumUrls,
      });
      console.log("[webhook/contract-email] Links flow result:", items.length, "items");
      parsedItems = { location: location as unknown as Record<string, unknown>, items };
    } else {
      // Inline table mode: parse from EML HTML
      console.log("[webhook/contract-email] Using INLINE TABLE flow");
      const buffer = Buffer.from(eml, "base64");
      const parsed = await parseEML(buffer);
      console.log("[webhook/contract-email] mailparser result:", {
        htmlType: typeof parsed.html,
        htmlIsFalsy: !parsed.html,
        htmlLength: typeof parsed.html === "string" ? parsed.html.length : 0,
        textLength: parsed.text?.length ?? 0,
        textHasTable: /<table[\s>]/i.test(parsed.text ?? ""),
        textHasTablePos: /class="pos"/i.test(parsed.text ?? ""),
      });
      const cleanText = getCleanText(parsed);
      const location = extractLocation(cleanText);
      // Zapier-constructed EMLs may lack MIME Content-Type headers,
      // so mailparser puts HTML content into .text instead of .html.
      // Fall back to .text if .html is empty but .text contains HTML tags.
      let htmlContent = parsed.html;
      if (!htmlContent && parsed.text && /<table[\s>]/i.test(parsed.text)) {
        console.log("[webhook/contract-email] Falling back to parsed.text as HTML source");
        htmlContent = parsed.text;
      }
      if (!htmlContent) {
        return NextResponse.json(
          { error: "No HTML content found in email. Cannot extract order items table." },
          { status: 400 }
        );
      }
      console.log("[webhook/contract-email] HTML content length for table extraction:", htmlContent.length);
      const items = extractOrderItems(htmlContent);
      console.log("[webhook/contract-email] extractOrderItems result:", items.length, "items");
      items.forEach((item, i) => {
        console.log(`[webhook/contract-email] Item ${i}: type=${item.type} | ${(item.productService ?? "").substring(0, 60)} | qty=${item.qty} | amt=${item.amount}`);
      });
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

    // Log success with item details
    const itemSummary = typedItems.slice(0, 10).map((it, i) => ({
      idx: i, type: it.type, name: (it.productService ?? "").substring(0, 60), qty: it.qty, amt: it.amount,
    }));
    await saveWebhookLog({
      source: "zapier",
      action: "created",
      orderNo: preParse.orderNo,
      clientName: preParse.clientName,
      projectId: newProject.id,
      emailSubject: logEmailSubject,
      itemCount: typedItems.length,
      payloadKeys: logPayloadKeys,
      payloadSizes: logPayloadSizes,
      preParseResult: logPreParse,
      parseResult: { totalItems: typedItems.length, first10: itemSummary },
    });

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[webhook/contract-email]", err);
    await saveWebhookLog({
      source: "zapier",
      action: "error",
      orderNo: logPreParse?.orderNo as string | undefined,
      clientName: logPreParse?.clientName as string | undefined,
      emailSubject: logEmailSubject,
      payloadKeys: logPayloadKeys,
      payloadSizes: logPayloadSizes,
      preParseResult: logPreParse,
      errorMessage: message,
      errorStack: stack,
    });
    return NextResponse.json(
      { error: "Webhook processing failed", details: message },
      { status: 500 }
    );
  }
}
