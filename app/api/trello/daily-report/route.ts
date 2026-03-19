import {
  getCurrentProjectBoard,
  getBoardCards,
  filterAttachmentsByDate,
  isTrelloConfigured,
  type TrelloAttachment,
} from "../../../../lib/trello";

type ImageAttachmentItem = {
  cardId: string;
  cardName: string;
  attachmentId: string;
  name: string;
  url: string;
  mimeType?: string;
  date: string;
};

function toYmd(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** GET: list image attachments for the given date (default today). */
export async function GET(request: Request) {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({ error: "Trello not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const board = await getCurrentProjectBoard();
  if (!board) {
    return new Response(
      JSON.stringify({ error: "Current Project board not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const dateYmd =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : toYmd(new Date());

  const cards = await getBoardCards(board.id);
  const imageAttachments: ImageAttachmentItem[] = [];

  for (const card of cards) {
    const onDate = filterAttachmentsByDate(card.attachments, dateYmd);
    for (const a of onDate) {
      imageAttachments.push({
        cardId: card.id,
        cardName: card.name,
        attachmentId: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        date: a.date,
      });
    }
  }

  return new Response(
    JSON.stringify({ date: dateYmd, imageAttachments }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

/** Fetch image at URL and return { b64, mimeType }. */
async function fetchImageAsBase64(
  url: string,
  fallbackMime: string = "image/jpeg"
): Promise<{ b64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const contentType = res.headers.get("content-type");
    const mimeType =
      contentType?.split(";")[0]?.trim() ||
      fallbackMime ||
      "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    return { b64, mimeType };
  } catch {
    return null;
  }
}

/** POST: run AI analysis on that day's Trello images (fetch server-side, call analyze). */
export async function POST(request: Request) {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({ error: "Trello not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const board = await getCurrentProjectBoard();
  if (!board) {
    return new Response(
      JSON.stringify({ error: "Current Project board not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { date?: string; projectName?: string; lineItemLabels?: string[] } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    // leave body empty
  }

  const dateYmd =
    body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : toYmd(new Date());
  const projectName = typeof body.projectName === "string" ? body.projectName : "Trello Daily Report";
  const lineItemLabels = Array.isArray(body.lineItemLabels)
    ? body.lineItemLabels.filter((l) => typeof l === "string")
    : [];

  const cards = await getBoardCards(board.id);
  const toFetch: ImageAttachmentItem[] = [];
  for (const card of cards) {
    const onDate = filterAttachmentsByDate(card.attachments, dateYmd);
    for (const a of onDate) {
      toFetch.push({
        cardId: card.id,
        cardName: card.name,
        attachmentId: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        date: a.date,
      });
    }
  }

  if (toFetch.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No images for this date",
        date: dateYmd,
        detail: "Upload images to Trello cards on the selected day, then run the report again.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cap to 10 images to match analyze route limit
  const capped = toFetch.slice(0, 10);
  const images: { b64: string; mimeType: string }[] = [];
  for (const item of capped) {
    const mime = item.mimeType && item.mimeType.startsWith("image/") ? item.mimeType : "image/jpeg";
    const encoded = await fetchImageAsBase64(item.url, mime);
    if (encoded) images.push(encoded);
  }

  if (images.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Could not fetch any images",
        date: dateYmd,
        detail: "Server could not download the image URLs. They may be private or expired.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Call internal analyze API (same origin)
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
  const analyzeUrl = `${base}/api/analyze`;
  const analyzeRes = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      projectName,
      lineItemLabels: lineItemLabels.length ? lineItemLabels : undefined,
    }),
  });

  const analyzeJson = await analyzeRes.json().catch(() => ({}));
  if (!analyzeRes.ok) {
    return new Response(
      JSON.stringify(analyzeJson.error ? analyzeJson : { error: "Analysis request failed" }),
      { status: analyzeRes.status >= 400 ? analyzeRes.status : 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(analyzeJson), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
