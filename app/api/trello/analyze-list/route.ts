import {
  getList,
  getListCardsWithAllAttachments,
  isTrelloConfigured,
  isImageAttachment,
} from "../../../../lib/trello";
import {
  parseEcoMode,
  fetchAndOptimizeImages,
  getBaseOrigin,
  type EcoMode,
} from "../../../../lib/trello-images";

const MAX_IMAGES = 20;

/**
 * POST: run AI analysis on images from a Trello list.
 * Fetches image attachments from the list's cards (read-only), then calls /api/analyze.
 * No data is written back to Trello.
 */
export async function POST(request: Request) {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({ error: "Trello not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    listId?: string;
    projectName?: string;
    pmUpdate?: string;
    lineItemLabels?: string[];
    ecoMode?: EcoMode;
    /** When provided, use only these image URLs (from Trello) for analysis. Otherwise use all list images. */
    imageUrls?: string[];
  } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    // leave body empty
  }

  const listId = typeof body.listId === "string" ? body.listId.trim() : "";
  if (!listId) {
    return new Response(
      JSON.stringify({ error: "listId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [list, cards] = await Promise.all([
    getList(listId),
    getListCardsWithAllAttachments(listId),
  ]);

  if (!list) {
    return new Response(
      JSON.stringify({ error: "List not found", listId }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const projectName =
    typeof body.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim()
      : list.name;
  const pmUpdate = typeof body.pmUpdate === "string" ? body.pmUpdate : "";
  const lineItemLabels = Array.isArray(body.lineItemLabels)
    ? body.lineItemLabels.filter((l) => typeof l === "string")
    : [];
  const ecoMode = parseEcoMode(body.ecoMode);

  let imageAttachments: { url: string; mimeType?: string }[] = [];

  const selectedUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u) => typeof u === "string" && u.trim())
    : null;

  if (selectedUrls != null && selectedUrls.length > 0) {
    imageAttachments = selectedUrls.map((url) => ({ url }));
  } else {
    for (const card of cards) {
      for (const a of card.attachments) {
        if (isImageAttachment(a)) imageAttachments.push({ url: a.url, mimeType: a.mimeType });
      }
    }
  }

  if (imageAttachments.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No images in this list",
        listId,
        listName: list.name,
        detail: "Add image attachments to cards in this list, then run analysis again.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const base = getBaseOrigin(request.url);

  const { images, totalOriginalBytes, totalFinalBytes } = await fetchAndOptimizeImages(
    imageAttachments,
    base,
    ecoMode,
    MAX_IMAGES
  );

  if (images.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Could not fetch any images",
        errorCode: "image_fetch_failed",
        listId,
        detail: "Images were fetched via proxy with Trello auth. If this still fails, check that attachment URLs are valid and TRELLO_API_KEY / TRELLO_API_TOKEN have access to the board.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const analyzeUrl = `${base}/api/analyze`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  let analyzeRes: Response;
  let analyzeJson: Record<string, unknown> = {};
  try {
    console.log(
      JSON.stringify({
        event: "trello_analyze_list_images_prepared",
        listId,
        ecoMode,
        imageCount: images.length,
        totalOriginalBytes,
        totalFinalBytes,
      })
    );
    analyzeRes = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        projectName,
        pmUpdate: pmUpdate || undefined,
        lineItemLabels: lineItemLabels.length ? lineItemLabels : undefined,
      }),
      signal: controller.signal,
    });
    analyzeJson = (await analyzeRes.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : "Request failed";
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return new Response(
      JSON.stringify({
        error: isTimeout ? "Analysis timed out" : "Analysis request failed",
        errorCode: isTimeout ? "timeout" : "analyze_request_failed",
        detail: message,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  clearTimeout(timeoutId);

  if (!analyzeRes.ok) {
    return new Response(
      JSON.stringify(
        analyzeJson.error
          ? { error: analyzeJson.error, ...analyzeJson }
          : { error: "Analysis request failed", errorCode: "analyze_error" }
      ),
      {
        status: analyzeRes.status >= 400 ? analyzeRes.status : 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify(analyzeJson as Record<string, unknown>), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
