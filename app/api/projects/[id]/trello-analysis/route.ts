import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import {
  projects,
  projectContractItems,
  projectSelectedItems,
  aiAnalysisEntries,
  aiAnalysisImages,
  aiAnalysisResults,
  aiAnalysisResultLineItems,
} from "../../../../../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isTrelloConfigured } from "../../../../../lib/trello";
import {
  parseEcoMode,
  fetchAndOptimizeImages,
  getBaseOrigin,
} from "../../../../../lib/trello-images";

export const runtime = "nodejs";

const MAX_IMAGES = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!isTrelloConfigured()) {
    return NextResponse.json({ error: "Trello not configured" }, { status: 503 });
  }

  try {
    const { id: projectId } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const trelloListId = typeof body.trelloListId === "string" ? body.trelloListId.trim() : "";
    if (!trelloListId) {
      return NextResponse.json({ error: "trelloListId is required" }, { status: 400 });
    }

    const imageUrls: string[] = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u: unknown) => typeof u === "string" && (u as string).trim())
      : [];
    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "imageUrls must be a non-empty array" }, { status: 400 });
    }

    const pmUpdate = typeof body.pmUpdate === "string" ? body.pmUpdate.trim() : "";
    const ecoMode = parseEcoMode(body.ecoMode);
    const selectedItemIds: string[] = Array.isArray(body.selectedItemIds)
      ? body.selectedItemIds.filter((s: unknown) => typeof s === "string")
      : [];

    // Build contract line item labels for the prompt
    let contractItemRows: { id: string; productService: string; progressOverallPct: string | null }[] = [];

    if (selectedItemIds.length > 0) {
      contractItemRows = await db
        .select({
          id: projectContractItems.id,
          productService: projectContractItems.productService,
          progressOverallPct: projectContractItems.progressOverallPct,
        })
        .from(projectContractItems)
        .where(inArray(projectContractItems.id, selectedItemIds));
    } else {
      // Fall back to the project's saved selected items
      const selectedRows = await db
        .select({ contractItemId: projectSelectedItems.contractItemId })
        .from(projectSelectedItems)
        .where(eq(projectSelectedItems.projectId, projectId));

      const ids = selectedRows.map((r) => r.contractItemId);
      if (ids.length > 0) {
        contractItemRows = await db
          .select({
            id: projectContractItems.id,
            productService: projectContractItems.productService,
            progressOverallPct: projectContractItems.progressOverallPct,
          })
          .from(projectContractItems)
          .where(inArray(projectContractItems.id, ids));
      }
    }

    const lineItemLabels = contractItemRows.map((r) => r.productService).filter(Boolean);

    // Fetch and optimize images via the proxy
    const base = getBaseOrigin(request.url);
    const imageAttachments = imageUrls.map((url) => ({ url }));
    const { images, totalOriginalBytes, totalFinalBytes } = await fetchAndOptimizeImages(
      imageAttachments,
      base,
      ecoMode,
      MAX_IMAGES
    );

    if (images.length === 0) {
      return NextResponse.json(
        {
          error: "Could not fetch any images from the provided URLs",
          errorCode: "image_fetch_failed",
        },
        { status: 502 }
      );
    }

    console.log(
      JSON.stringify({
        event: "project_trello_analysis_images_prepared",
        projectId,
        trelloListId,
        ecoMode,
        imageCount: images.length,
        lineItemCount: lineItemLabels.length,
        totalOriginalBytes,
        totalFinalBytes,
      })
    );

    // Call the AI analysis endpoint
    const analyzeUrl = `${base}/api/analyze`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000);

    let analyzeJson: Record<string, unknown> = {};
    try {
      const analyzeRes = await fetch(analyzeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          projectName: project.name,
          pmUpdate: pmUpdate || undefined,
          lineItemLabels: lineItemLabels.length ? lineItemLabels : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      analyzeJson = (await analyzeRes.json().catch(() => ({}))) as Record<string, unknown>;

      if (!analyzeRes.ok) {
        return NextResponse.json(
          analyzeJson.error
            ? { error: analyzeJson.error, ...analyzeJson }
            : { error: "AI analysis failed", errorCode: "analyze_error" },
          { status: analyzeRes.status >= 400 ? analyzeRes.status : 502 }
        );
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return NextResponse.json(
        {
          error: isTimeout ? "Analysis timed out" : "Analysis request failed",
          errorCode: isTimeout ? "timeout" : "analyze_request_failed",
        },
        { status: 502 }
      );
    }

    const reconciliationResult = analyzeJson as Record<string, unknown>;
    const asOfDate =
      typeof reconciliationResult.as_of_date === "string" && reconciliationResult.as_of_date
        ? reconciliationResult.as_of_date
        : new Date().toISOString().split("T")[0];

    // Persist to DB
    const [entry] = await db
      .insert(aiAnalysisEntries)
      .values({
        projectId,
        asOfDate,
        pmUpdate: pmUpdate || null,
        trelloListId,
        imageSource: "trello",
      })
      .returning();

    if (!entry) {
      return NextResponse.json({ error: "Failed to create analysis entry" }, { status: 500 });
    }

    // Save image records
    for (let i = 0; i < images.length; i++) {
      await db.insert(aiAnalysisImages).values({
        analysisId: entry.id,
        storageKey: imageUrls[i] ?? null,
        contentType: images[i].mimeType,
        sequence: i,
      });
    }

    const [result] = await db
      .insert(aiAnalysisResults)
      .values({ analysisId: entry.id, reconciliationResult })
      .returning();

    if (!result) {
      return NextResponse.json({ error: "Failed to save analysis result" }, { status: 500 });
    }

    // Save per-row line items with progressBefore snapshot
    const byProductService = new Map(
      contractItemRows.map((r) => [
        r.productService?.toLowerCase().trim() ?? "",
        { id: r.id, progressBefore: r.progressOverallPct },
      ])
    );

    const sections = reconciliationResult.sections;
    if (Array.isArray(sections)) {
      for (const section of sections) {
        const sectionId = (section as Record<string, unknown>).id ?? "";
        const rows = (section as Record<string, unknown>).rows;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const r = row as Record<string, unknown>;
          const lineItem = typeof r.line_item === "string" ? r.line_item : "";
          const match = byProductService.get(lineItem.toLowerCase().trim());
          await db.insert(aiAnalysisResultLineItems).values({
            analysisResultId: result.id,
            contractItemId: match?.id ?? null,
            sectionId: String(sectionId),
            lineItem,
            currentPercent: typeof r.current_percent === "string" ? r.current_percent : null,
            suggestedPercent: typeof r.suggested_percent === "string" ? r.suggested_percent : null,
            status: typeof r.status === "string" ? r.status : null,
            notes: typeof r.notes === "string" ? r.notes : null,
            progressBefore: match?.progressBefore ?? null,
          });
        }
      }
    }

    return NextResponse.json({
      entryId: entry.id,
      projectId,
      asOfDate,
      createdAt: entry.createdAt,
      imageSource: "trello",
      trelloListId,
      analysisResult: reconciliationResult,
    });
  } catch (err) {
    console.error("[POST /api/projects/[id]/trello-analysis]", err);
    return NextResponse.json({ error: "Failed to run Trello analysis" }, { status: 500 });
  }
}
