import sharp from "sharp";
import { isTrelloConfigured } from "../../../../lib/trello";

const TRELLO_API_KEY = process.env.TRELLO_API_KEY?.trim();
const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN?.trim();

function isTrelloUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "api.trello.com" ||
      host === "trello.com" ||
      host.endsWith(".trello.com") ||
      host.includes("trello-attachments")
    );
  } catch {
    return false;
  }
}

/**
 * Rewrite trello.com attachment download URLs to api.trello.com so key/token auth works.
 * The API host accepts key and token as query params; trello.com often does not.
 */
function rewriteToApiTrelloUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if ((host === "trello.com" || host === "www.trello.com") && u.pathname.startsWith("/1/")) {
      u.hostname = "api.trello.com";
      return u.toString();
    }
  } catch {
    // ignore
  }
  return url;
}

/** Build fetch URL with optional query auth (fallback). Prefer Authorization header for api.trello.com. */
function buildFetchUrl(url: string): string {
  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("key", TRELLO_API_KEY);
    u.searchParams.set("token", TRELLO_API_TOKEN);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}key=${encodeURIComponent(TRELLO_API_KEY)}&token=${encodeURIComponent(TRELLO_API_TOKEN)}`;
  }
}

/** OAuth-style header required by Trello for attachment download (header over query). */
function trelloAuthHeaders(): Record<string, string> {
  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) return {};
  return {
    Authorization: `OAuth oauth_consumer_key="${TRELLO_API_KEY}", oauth_token="${TRELLO_API_TOKEN}"`,
  };
}

function sanitizeFilename(name: string): string {
  const raw = (name || "").trim();
  const safe = raw
    .replace(/[/\\]+/g, "_")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return safe || "image.jpg";
}

function hasImageLikeExtension(urlOrPath: string): boolean {
  const cleaned = urlOrPath.split("?")[0].toLowerCase();
  return (
    cleaned.endsWith(".jpg") ||
    cleaned.endsWith(".jpeg") ||
    cleaned.endsWith(".png") ||
    cleaned.endsWith(".gif") ||
    cleaned.endsWith(".webp") ||
    cleaned.endsWith(".bmp") ||
    cleaned.endsWith(".heic") ||
    cleaned.endsWith(".avif")
  );
}

/**
 * GET: proxy an image from a Trello attachment URL.
 * Adds TRELLO_API_KEY and TRELLO_API_TOKEN when the URL is from Trello so the server can fetch authenticated.
 * Query: url (required) – the attachment URL to fetch.
 */
export async function GET(request: Request) {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({ error: "Trello not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const download = searchParams.get("download") === "1";
  const thumb = searchParams.get("thumb") === "1";
  const filenameParam = searchParams.get("filename");
  if (!rawUrl || typeof rawUrl !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing url query parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // URLSearchParams.get() already returns a decoded value. Decoding again can
  // throw on legitimate Trello attachment URLs that include percent characters.
  const targetUrl = rawUrl.trim();

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return new Response(
      JSON.stringify({ error: "URL must be http or https" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Only allow Trello attachment URLs so we are not an open proxy.
  if (!isTrelloUrl(targetUrl)) {
    return new Response(
      JSON.stringify({ error: "Only Trello image URLs are allowed" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Use api.trello.com for download URLs; Trello requires OAuth header for attachment download.
  const rewrittenUrl = rewriteToApiTrelloUrl(targetUrl);
  const fetchUrl = buildFetchUrl(rewrittenUrl);
  const authHeaders = trelloAuthHeaders();

  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/*,*/*",
        ...authHeaders,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return new Response(
      JSON.stringify({ error: "Proxy fetch failed", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!res.ok) {
    return new Response(
      JSON.stringify({
        error: "Upstream returned error",
        status: res.status,
        statusText: res.statusText,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = res.headers.get("content-disposition") || "";
  const isImageContentType = contentType.startsWith("image/");
  const looksLikeImageByName =
    hasImageLikeExtension(targetUrl) || hasImageLikeExtension(contentDisposition);

  // Trello attachment downloads may return application/octet-stream for images.
  // Accept those when the URL/filename strongly suggests an image.
  if (!isImageContentType && !looksLikeImageByName) {
    return new Response(
      JSON.stringify({ error: "URL did not return an image", contentType }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rawBody = await res.arrayBuffer();

  // For thumbnail requests, resize to 240px wide at 60% quality to save bandwidth.
  // AI analysis always uses the original URL directly, so this only affects the picker UI.
  let responseBlob: Blob = new Blob([rawBody], { type: contentType });
  let responseContentType = contentType;
  if (thumb && !download) {
    try {
      const resized = await sharp(Buffer.from(rawBody))
        .resize({ width: 240, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      const ab = resized.buffer.slice(resized.byteOffset, resized.byteOffset + resized.byteLength) as ArrayBuffer;
      responseBlob = new Blob([ab], { type: "image/jpeg" });
      responseContentType = "image/jpeg";
    } catch {
      // Fall back to original if resize fails
    }
  }

  const filename = download ? sanitizeFilename(filenameParam || "image.jpg") : "";
  return new Response(responseBlob, {
    status: 200,
    headers: {
      "Content-Type": responseContentType,
      "Cache-Control": thumb ? "private, max-age=300" : "private, no-store",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
