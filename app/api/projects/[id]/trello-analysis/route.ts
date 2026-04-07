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

function mergeAnalysisRows(
  firstData: Record<string, unknown>,
  retryData: Record<string, unknown>,
  orderedItems: Array<{ id: string; label: string; progressBefore: string | null }>
): unknown[] {
  const firstSections = Array.isArray(firstData.sections) ? (firstData.sections as Array<Record<string, unknown>>) : [];
  const retrySections = Array.isArray(retryData.sections) ? (retryData.sections as Array<Record<string, unknown>>) : [];

  // Collect all retry rows into a map by label
  const retryRowByLabel = new Map<string, Record<string, unknown>>();
  for (const section of retrySections) {
    const rows = Array.isArray(section.rows) ? (section.rows as Array<Record<string, unknown>>) : [];
    for (const row of rows) {
      const label = typeof row.line_item === "string" ? row.line_item.toLowerCase().trim() : "";
      if (label) retryRowByLabel.set(label, row);
    }
  }

  // Build ordered item label set for quick lookup
  const orderedLabelSet = new Set(orderedItems.map((i) => i.label.toLowerCase().trim()));

  // Rebuild sections: keep first-call rows for valid items, substitute retry rows for failed items
  const mergedSections: Array<Record<string, unknown>> = firstSections.map((section) => {
    const rows = Array.isArray(section.rows) ? (section.rows as Array<Record<string, unknown>>) : [];
    const mergedRows = rows.map((row) => {
      const label = typeof row.line_item === "string" ? row.line_item.toLowerCase().trim() : "";
      const retryRow = retryRowByLabel.get(label);
      return retryRow ?? row;
    });
    return { ...section, rows: mergedRows };
  });

  // Append any retry rows whose items weren't in any first-call section
  const firstSectionLabels = new Set(
    firstSections.flatMap((s) =>
      Array.isArray(s.rows)
        ? (s.rows as Array<Record<string, unknown>>).map((r) =>
            typeof r.line_item === "string" ? r.line_item.toLowerCase().trim() : ""
          )
        : []
    )
  );

  const newRows: Array<Record<string, unknown>> = [];
  for (const [label, row] of retryRowByLabel.entries()) {
    if (!firstSectionLabels.has(label) && orderedLabelSet.has(label)) {
      newRows.push(row);
    }
  }

  if (newRows.length > 0) {
    mergedSections.push({ id: "strict_pb_retry", title: "Strict PB Retry", rows: newRows });
  }

  return mergedSections;
}

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
    const debugRunId = `proj-${projectId}-${Date.now()}`;

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
    // #region agent log
    fetch("http://127.0.0.1:7691/ingest/b1e0d930-3f83-42f8-9729-85202135bc15", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1e0c6e" },
      body: JSON.stringify({
        sessionId: "1e0c6e",
        runId: debugRunId,
        hypothesisId: "H2",
        location: "app/api/projects/[id]/trello-analysis/route.ts:49",
        message: "incoming selected image URLs",
        data: {
          count: imageUrls.length,
          hosts: imageUrls.slice(0, 5).map((u) => {
            try {
              return new URL(u).hostname;
            } catch {
              return "invalid";
            }
          }),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "imageUrls must be a non-empty array" }, { status: 400 });
    }

    const pmUpdate = typeof body.pmUpdate === "string" ? body.pmUpdate.trim() : "";
    const ecoMode = parseEcoMode(body.ecoMode);
    const selectedItemIds: string[] = Array.isArray(body.selectedItemIds)
      ? body.selectedItemIds.filter((s: unknown) => typeof s === "string")
      : [];

    const strictPBMode = body.strictPBMode === true;

    // Build contract line item labels for the prompt
    let contractItemRows: { id: string; productService: string; progressOverallPct: string | null }[] = [];

    if (selectedItemIds.length > 0) {
      const rows = await db
        .select({
          id: projectContractItems.id,
          productService: projectContractItems.productService,
          progressOverallPct: projectContractItems.progressOverallPct,
        })
        .from(projectContractItems)
        .where(inArray(projectContractItems.id, selectedItemIds));

      if (strictPBMode) {
        // Preserve caller-specified order
        const rowById = new Map(rows.map((r) => [r.id, r]));
        contractItemRows = selectedItemIds.map((sid) => rowById.get(sid)).filter(Boolean) as typeof rows;
      } else {
        contractItemRows = rows;
      }
    } else if (!strictPBMode) {
      // Fall back to saved selections only in normal mode
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
    } else {
      // strictPBMode=true but no selectedItemIds
      return NextResponse.json({ error: "selectedItemIds is required in Strict PB Mode" }, { status: 400 });
    }

    // Must match the truncation applied in analyze/route.ts (MAX_LINE_ITEM_LABEL_LENGTH = 150)
    const MAX_LABEL_LENGTH = 150;
    const truncateLabel = (s: string) =>
      s.length > MAX_LABEL_LENGTH ? s.slice(0, MAX_LABEL_LENGTH - 3).trim() + "..." : s;

    const lineItemLabels = contractItemRows
      .map((r) => r.productService)
      .filter(Boolean)
      .map(truncateLabel);

    // Strict PB Mode: build canonical ordered map using truncated labels (same as what AI sees)
    type CanonicalItem = { id: string; label: string; progressBefore: string | null };
    const orderedItems: CanonicalItem[] = strictPBMode
      ? contractItemRows.map((r) => ({ id: r.id, label: truncateLabel(r.productService), progressBefore: r.progressOverallPct }))
      : [];
    const labelToId = new Map(orderedItems.map((i) => [i.label.toLowerCase().trim(), i.id]));

    // Prefix length for fuzzy label matching — handles AI rephrasing of long truncated labels
    const LABEL_PREFIX_LEN = 80;

    function labelsMatch(canonical: string, aiLabel: string): boolean {
      const a = canonical.toLowerCase().trim();
      const b = aiLabel.toLowerCase().trim();
      if (a === b) return true;
      // For long labels, match on shared prefix to tolerate AI punctuation/phrasing differences
      if (a.length >= LABEL_PREFIX_LEN && b.length >= LABEL_PREFIX_LEN) {
        return a.slice(0, LABEL_PREFIX_LEN) === b.slice(0, LABEL_PREFIX_LEN);
      }
      return false;
    }

    function findIdByLabel(aiLabel: string): string | undefined {
      // Exact match first
      const exact = labelToId.get(aiLabel.toLowerCase().trim());
      if (exact) return exact;
      // Prefix fallback
      for (const item of orderedItems) {
        if (labelsMatch(item.label, aiLabel)) return item.id;
      }
      return undefined;
    }

    type RecoRow = { line_item: string; suggested_percent?: string; [key: string]: unknown };

    function validateStrictRows(
      items: CanonicalItem[],
      aiRows: RecoRow[]
    ): { valid: Set<string>; failed: CanonicalItem[] } {
      const valid = new Set<string>();
      const failed: CanonicalItem[] = [];
      for (const item of items) {
        const matchingRow = aiRows.find((r) => labelsMatch(item.label, r.line_item));
        const hasPct = matchingRow && typeof matchingRow.suggested_percent === "string" && matchingRow.suggested_percent.trim() !== "";
        if (hasPct) valid.add(item.label.toLowerCase().trim());
        else failed.push(item);
      }
      return { valid, failed };
    }

    function flattenRows(analyzeJson: Record<string, unknown>): RecoRow[] {
      // Prefer rawSections (pre-normalization) — normalizeResponse filters through
      // SECTION_TEMPLATES and drops sections with unrecognised ids (e.g. "excavation_grading")
      const sections = analyzeJson.rawSections ?? analyzeJson.sections;
      if (!Array.isArray(sections)) return [];
      return sections.flatMap((s) => {
        const rows = (s as Record<string, unknown>).rows;
        return Array.isArray(rows) ? (rows as RecoRow[]) : [];
      });
    }

    // Fetch and optimize images via the proxy
    const base = getBaseOrigin(request.url);
    const imageAttachments = imageUrls.map((url) => ({ url }));
    const { images, totalOriginalBytes, totalFinalBytes } = await fetchAndOptimizeImages(
      imageAttachments,
      base,
      ecoMode,
      MAX_IMAGES,
      debugRunId
    );
    // #region agent log
    fetch("http://127.0.0.1:7691/ingest/b1e0d930-3f83-42f8-9729-85202135bc15", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1e0c6e" },
      body: JSON.stringify({
        sessionId: "1e0c6e",
        runId: debugRunId,
        hypothesisId: "H1",
        location: "app/api/projects/[id]/trello-analysis/route.ts:101",
        message: "post image fetch+optimize summary",
        data: {
          base,
          requestedCount: imageAttachments.length,
          fetchedCount: images.length,
          totalOriginalBytes,
          totalFinalBytes,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (images.length === 0) {
      const probeResults: Array<{
        host: string;
        status: number | null;
        contentType: string | null;
        bodyPreview: string | null;
      }> = [];

      for (const url of imageUrls.slice(0, 3)) {
        let host = "invalid";
        try {
          host = new URL(url).hostname;
        } catch {
          // keep invalid
        }

        try {
          const probe = await fetch(
            `${base}/api/trello/proxy-image?url=${encodeURIComponent(url)}`,
            {
              cache: "no-store",
            }
          );
          const contentType = probe.headers.get("content-type");
          const bodyPreview = !probe.ok
            ? (await probe.text().catch(() => "")).slice(0, 300)
            : null;
          probeResults.push({
            host,
            status: probe.status,
            contentType,
            bodyPreview,
          });
        } catch (err) {
          probeResults.push({
            host,
            status: null,
            contentType: null,
            bodyPreview: err instanceof Error ? err.message : "probe_failed",
          });
        }
      }

      return NextResponse.json(
        {
          error: "Could not fetch any images from the provided URLs",
          errorCode: "image_fetch_failed",
          debug: {
            requestedCount: imageUrls.length,
            selectedHosts: imageUrls.slice(0, 5).map((u) => {
              try {
                return new URL(u).hostname;
              } catch {
                return "invalid";
              }
            }),
            probeResults,
          },
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
    const callAnalyze = async (
      payloadExtra: Record<string, unknown>
    ): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180_000);
      try {
        const analyzeRes = await fetch(analyzeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadExtra),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = (await analyzeRes.json().catch(() => ({}))) as Record<string, unknown>;
        return { ok: analyzeRes.ok, data, status: analyzeRes.status };
      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          data: {
            error: isTimeout ? "Analysis timed out" : "Analysis request failed",
            errorCode: isTimeout ? "timeout" : "analyze_request_failed",
          },
          status: 502,
        };
      }
    };

    if (strictPBMode) {
      console.log(JSON.stringify({
        event: "strict_pb_payload_labels",
        projectId,
        lineItemLabels: lineItemLabels.map((l) => ({ label: l, len: l.length })),
      }));
    }

    const basePayload = {
      images,
      projectName: project.name,
      pmUpdate: pmUpdate || undefined,
      lineItemLabels: lineItemLabels.length ? lineItemLabels : undefined,
      strictMode: strictPBMode,
    };

    let analyzeJson: Record<string, unknown> = {};
    let validRowLabels = new Set<string>();

    if (strictPBMode && orderedItems.length > 0) {
      // First call
      const first = await callAnalyze(basePayload);
      if (!first.ok) {
        return NextResponse.json(
          first.data.error
            ? { error: first.data.error, ...first.data }
            : { error: "AI analysis failed", errorCode: "analyze_error" },
          { status: first.status >= 400 ? first.status : 502 }
        );
      }

      const firstRows = flattenRows(first.data);

      // Debug: log canonical labels vs AI output labels for matching diagnosis
      console.log(JSON.stringify({
        event: "strict_pb_label_match_debug",
        projectId,
        canonicalLabels: orderedItems.map((i) => ({ id: i.id, label: i.label, len: i.label.length })),
        aiOutputLabels: firstRows.map((r) => ({ line_item: r.line_item, len: r.line_item.length, has_pct: !!r.suggested_percent })),
        rawSections: JSON.stringify(first.data.sections).slice(0, 500),
        confidence: first.data.confidence,
      }));

      const { valid, failed } = validateStrictRows(orderedItems, firstRows);
      validRowLabels = valid;

      if (failed.length === 0) {
        // All good first try
        analyzeJson = first.data;
      } else {
        // Partial retry: only send failed items
        const retryLabels = failed.map((i) => i.label);
        const retryPayload = {
          ...basePayload,
          lineItemLabels: retryLabels,
          retryMissingLabels: retryLabels,
        };
        const retry = await callAnalyze(retryPayload);

        if (!retry.ok) {
          // Return whatever we got from first call as partial results on retry network failure
          return NextResponse.json(
            {
              error: "AI retry failed",
              errorCode: "line_item_mapping_mismatch",
              detail: {
                expectedCount: orderedItems.length,
                resolvedCount: valid.size,
                missingLabels: retryLabels,
                rowsWithoutSuggestedPercent: [],
                extraLabels: [],
                partialResults: first.data.analysisResult ?? first.data,
              },
            },
            { status: 422 }
          );
        }

        const retryRows = flattenRows(retry.data);
        const retryValidation = validateStrictRows(failed, retryRows);

        if (retryValidation.failed.length > 0) {
          const stillMissing = retryValidation.failed.map((i) => i.label);
          return NextResponse.json(
            {
              error: "AI output did not match selected line items after retry",
              errorCode: "line_item_mapping_mismatch",
              detail: {
                expectedCount: orderedItems.length,
                resolvedCount: valid.size + retryValidation.valid.size,
                missingLabels: stillMissing,
                rowsWithoutSuggestedPercent: [],
                extraLabels: [],
                partialResults: first.data,
              },
            },
            { status: 422 }
          );
        }

        // Merge: take original sections from first call, then inject retry rows for failed items
        const mergedSections = mergeAnalysisRows(first.data, retry.data, orderedItems);
        analyzeJson = { ...first.data, sections: mergedSections };

        // Update valid set
        for (const item of failed) {
          validRowLabels.add(item.label.toLowerCase().trim());
        }
      }
    } else {
      // Normal mode
      const result = await callAnalyze(basePayload);
      if (!result.ok) {
        return NextResponse.json(
          result.data.error
            ? { error: result.data.error, ...result.data }
            : { error: "AI analysis failed", errorCode: "analyze_error" },
          { status: result.status >= 400 ? result.status : 502 }
        );
      }
      analyzeJson = result.data;
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
          const matchKey = lineItem.toLowerCase().trim();
          const matchId = strictPBMode ? findIdByLabel(lineItem) : undefined;
          const match = matchId
            ? { id: matchId, progressBefore: contractItemRows.find((r) => r.id === matchId)?.progressOverallPct ?? null }
            : byProductService.get(matchKey);
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
