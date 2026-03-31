import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import {
  projects,
  projectContractItems,
  projectSelectedItems,
  aiAnalysisEntries,
  aiAnalysisResults,
  aiAnalysisResultLineItems,
} from "../../../../../lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(
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
    const audioTranscript = typeof body.audioTranscript === "string" ? body.audioTranscript.trim() : "";
    if (!audioTranscript) {
      return NextResponse.json({ error: "audioTranscript is required" }, { status: 400 });
    }

    const pmUpdate = typeof body.pmUpdate === "string" ? body.pmUpdate.trim() : "";
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

    // Determine base URL for internal API calls
    const url = new URL(request.url);
    const base = `${url.protocol}//${url.host}`;

    console.log(
      JSON.stringify({
        event: "project_audio_analysis_start",
        projectId,
        transcriptLength: audioTranscript.length,
        lineItemCount: lineItemLabels.length,
        pmUpdateLength: pmUpdate.length,
      })
    );

    // Call the AI analysis endpoint with transcript only (no images)
    const analyzeUrl = `${base}/api/analyze`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    let analyzeJson: Record<string, unknown> = {};
    try {
      const analyzeRes = await fetch(analyzeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [],
          audioTranscript,
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
        imageSource: "audio",
        audioTranscript,
      })
      .returning();

    if (!entry) {
      return NextResponse.json({ error: "Failed to create analysis entry" }, { status: 500 });
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
      imageSource: "audio",
      analysisResult: reconciliationResult,
    });
  } catch (err) {
    console.error("[POST /api/projects/[id]/audio-analysis]", err);
    return NextResponse.json({ error: "Failed to run audio analysis" }, { status: 500 });
  }
}
