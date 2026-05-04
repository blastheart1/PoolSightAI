import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { preParseEml } from "../../../../lib/preParseEml";
import { db } from "../../../../lib/db";
import { projects, projectSelectedItems, webhookLogs } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  findProjectByOrderNo,
  runLinksFlow,
  insertContractItems,
  replaceContractItems,
} from "../../../../lib/contractParseFlow";

export const runtime = "nodejs";
export const maxDuration = 60;

type WebhookAction = "created" | "updated" | "skipped" | "error";

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
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : xHeader;
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

async function saveWebhookLog(data: {
  action: string;
  orderNo?: string;
  clientName?: string;
  projectId?: string;
  emailSubject?: string;
  itemCount?: number;
  payloadKeys?: string[];
  preParseResult?: Record<string, unknown> | null;
  parseResult?: Record<string, unknown> | null;
  errorMessage?: string;
  errorStack?: string;
}): Promise<void> {
  if (!db) return;
  try {
    await db.insert(webhookLogs).values({
      source: "zapier-addendum",
      action: data.action,
      orderNo: data.orderNo ?? null,
      clientName: data.clientName ?? null,
      projectId: data.projectId ?? null,
      emailSubject: data.emailSubject ?? null,
      itemCount: data.itemCount ?? null,
      payloadKeys: data.payloadKeys ? JSON.stringify(data.payloadKeys) : null,
      preParseResult: data.preParseResult ?? null,
      parseResult: data.parseResult ?? null,
      errorMessage: data.errorMessage ?? null,
      errorStack: data.errorStack ?? null,
    });
  } catch (logErr) {
    console.error("[webhook/contract-addendum] Failed to save webhook log:", logErr);
  }
}

function toDec(s: number | string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return String(s);
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let logPayloadKeys: string[] = [];
  let logPreParse: Record<string, unknown> | null = null;
  let logEmailSubject: string | undefined;

  try {
    const body = await request.json();
    logPayloadKeys = Object.keys(body);
    logEmailSubject = body.email_subject ?? undefined;

    const eml = body.eml;
    if (!eml || typeof eml !== "string" || !eml.trim()) {
      return NextResponse.json(
        { error: "Missing or empty 'eml' field (base64 EML)", availableFields: logPayloadKeys },
        { status: 400 }
      );
    }

    const preParse = await preParseEml(eml);
    logPreParse = {
      orderNo: preParse.orderNo,
      clientName: preParse.clientName,
      subject: preParse.subject,
      hasOriginalContract: preParse.hasOriginalContract,
      addendumCount: preParse.addendumCount,
    };
    console.log("[webhook/contract-addendum] Pre-parse:", logPreParse);

    if (!preParse.orderNo) {
      await saveWebhookLog({
        action: "error",
        emailSubject: logEmailSubject,
        payloadKeys: logPayloadKeys,
        preParseResult: logPreParse,
        errorMessage: "Could not extract Order ID from email",
      });
      return NextResponse.json(
        { error: "Could not extract Order ID from email" },
        { status: 400 }
      );
    }

    if (preParse.addendumCount === 0) {
      await saveWebhookLog({
        action: "skipped",
        orderNo: preParse.orderNo,
        clientName: preParse.clientName,
        emailSubject: logEmailSubject,
        payloadKeys: logPayloadKeys,
        preParseResult: logPreParse,
        errorMessage: "No addendum links found in email",
      });
      return NextResponse.json(
        { error: "No addendum links found in this email" },
        { status: 400 }
      );
    }

    const existingProject = await findProjectByOrderNo(preParse.orderNo);
    console.log(
      "[webhook/contract-addendum] Project lookup:",
      existingProject ? { id: existingProject.id, name: existingProject.name } : "NOT FOUND"
    );

    if (existingProject) {
      // --- EXISTING PROJECT: append new addendums only ---
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
          clientName: preParse.clientName,
          reason: `All ${mergeInfo.skippedDuplicateCount} addendum(s) already imported`,
          mergeInfo,
        };
        await saveWebhookLog({
          action: "skipped",
          orderNo: preParse.orderNo,
          clientName: preParse.clientName,
          projectId: existingProject.id,
          emailSubject: logEmailSubject,
          payloadKeys: logPayloadKeys,
          preParseResult: logPreParse,
          parseResult: mergeInfo as unknown as Record<string, unknown>,
        });
        return NextResponse.json(response);
      }

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
      await saveWebhookLog({
        action: "updated",
        orderNo: preParse.orderNo,
        clientName: preParse.clientName,
        projectId: existingProject.id,
        emailSubject: logEmailSubject,
        itemCount: items.length,
        payloadKeys: logPayloadKeys,
        preParseResult: logPreParse,
        parseResult: mergeInfo as unknown as Record<string, unknown>,
      });
      return NextResponse.json(response);
    }

    // --- NEW PROJECT: create from original contract + addendums ---
    // When the email has no original contract link, fall back to location data
    // already extracted from the email body by preParseEml (orderNo, address, etc.)
    // so the project is still created with correct metadata.
    const locationOverride = !preParse.hasOriginalContract
      ? {
          orderNo: preParse.orderNo,
          clientName: preParse.clientName || undefined,
          streetAddress: preParse.streetAddress ?? "",
          city: preParse.city ?? "",
          state: preParse.state ?? "",
          zip: preParse.zip ?? "",
          orderGrandTotal: preParse.orderGrandTotal,
        }
      : undefined;

    console.log(
      "[webhook/contract-addendum] New project — original contract present:",
      preParse.hasOriginalContract
    );
    const { location, items } = await runLinksFlow({
      originalContractUrl: preParse.originalContractUrl ?? "",
      addendumLinks: preParse.addendumUrls,
      locationOverride,
    });

    const street = location.streetAddress?.trim() ?? "";
    const client = location.clientName?.trim() ?? preParse.clientName?.trim() ?? "";
    const autoName = [street, client].filter(Boolean).join(" | ") || `Order ${preParse.orderNo}`;

    const [newProject] = await db
      .insert(projects)
      .values({
        name: autoName,
        orderNo: String(location.orderNo ?? preParse.orderNo),
        streetAddress: location.streetAddress ?? null,
        city: location.city ?? null,
        state: location.state ?? null,
        zip: location.zip ?? null,
        clientName: client || null,
        orderGrandTotal: location.orderGrandTotal != null ? toDec(location.orderGrandTotal) : null,
        parsedAt: new Date(),
      })
      .returning();

    if (!newProject) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    const typedItems = items as Array<{
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
      clientName: client || preParse.clientName,
      itemCount: typedItems.length,
    };
    await saveWebhookLog({
      action: "created",
      orderNo: preParse.orderNo,
      clientName: client || preParse.clientName,
      projectId: newProject.id,
      emailSubject: logEmailSubject,
      itemCount: typedItems.length,
      payloadKeys: logPayloadKeys,
      preParseResult: logPreParse,
      parseResult: { totalItems: typedItems.length },
    });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[webhook/contract-addendum]", err);
    await saveWebhookLog({
      action: "error",
      orderNo: logPreParse?.orderNo as string | undefined,
      clientName: logPreParse?.clientName as string | undefined,
      emailSubject: logEmailSubject,
      payloadKeys: logPayloadKeys,
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
