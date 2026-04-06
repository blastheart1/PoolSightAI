import sharp from "sharp";

export type EcoMode = "off" | "balanced" | "aggressive";

export function parseEcoMode(value: unknown): EcoMode {
  if (value === "balanced" || value === "aggressive" || value === "off") return value;
  return "balanced";
}

/**
 * Fetch an image via our same-origin proxy so Trello attachment URLs
 * get key/token authentication injected server-side.
 */
export async function fetchImageViaProxy(
  baseOrigin: string,
  imageUrl: string,
  fallbackMime = "image/jpeg",
  debugRunId = "n/a"
): Promise<{ buf: Buffer; mimeType: string } | null> {
  try {
    const proxyUrl = `${baseOrigin}/api/trello/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    // #region agent log
    fetch("http://127.0.0.1:7691/ingest/b1e0d930-3f83-42f8-9729-85202135bc15", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1e0c6e" },
      body: JSON.stringify({
        sessionId: "1e0c6e",
        runId: debugRunId,
        hypothesisId: "H1",
        location: "lib/trello-images.ts:20",
        message: "fetching image via proxy",
        data: {
          baseOrigin,
          imageHost: (() => {
            try {
              return new URL(imageUrl).hostname;
            } catch {
              return "invalid";
            }
          })(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const res = await fetch(proxyUrl, {
      cache: "no-store",
      headers: {
        "X-Debug-Run-Id": debugRunId,
      },
    });
    // #region agent log
    fetch("http://127.0.0.1:7691/ingest/b1e0d930-3f83-42f8-9729-85202135bc15", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1e0c6e" },
      body: JSON.stringify({
        sessionId: "1e0c6e",
        runId: debugRunId,
        hypothesisId: "H3",
        location: "lib/trello-images.ts:23",
        message: "proxy response status",
        data: {
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get("content-type"),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    const contentType = res.headers.get("content-type");
    const parsedMime = contentType?.split(";")[0]?.trim() || "";
    // Some Trello image downloads are served as application/octet-stream.
    // In those cases keep the bytes and fall back to the expected image mime.
    const mimeType = parsedMime.startsWith("image/") ? parsedMime : fallbackMime;
    if (!buf.byteLength) return null;
    return { buf, mimeType };
  } catch {
    return null;
  }
}

/**
 * Resize and compress an image buffer according to the ecoMode setting.
 * "off" skips optimization; "balanced" = 1024px / q60; "aggressive" = 768px / q45.
 */
export async function optimizeImageIfNeeded(
  buf: Buffer,
  ecoMode: EcoMode
): Promise<{ buf: Buffer; mimeType: string; optimized: boolean }> {
  if (ecoMode === "off") return { buf, mimeType: "image/jpeg", optimized: false };
  const maxDim = ecoMode === "aggressive" ? 768 : 1024;
  const quality = ecoMode === "aggressive" ? 45 : 60;
  try {
    const out = await sharp(buf)
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { buf: out, mimeType: "image/jpeg", optimized: true };
  } catch {
    return { buf, mimeType: "image/jpeg", optimized: false };
  }
}

/**
 * Derive the base origin from a Request URL, with fallbacks for
 * Vercel and local dev.
 */
export function getBaseOrigin(requestUrl: string): string {
  try {
    return new URL(requestUrl).origin;
  } catch {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  }
}

/**
 * Fetch + optimize a list of image URLs via the proxy.
 * Returns base64-encoded images ready for the /api/analyze payload.
 */
export async function fetchAndOptimizeImages(
  imageAttachments: { url: string; mimeType?: string }[],
  baseOrigin: string,
  ecoMode: EcoMode,
  maxImages: number,
  debugRunId = "n/a"
): Promise<{
  images: { b64: string; mimeType: string }[];
  totalOriginalBytes: number;
  totalFinalBytes: number;
}> {
  const toFetch = imageAttachments.slice(0, maxImages);
  const images: { b64: string; mimeType: string }[] = [];
  let totalOriginalBytes = 0;
  let totalFinalBytes = 0;

  for (const item of toFetch) {
    const mime =
      item.mimeType && item.mimeType.startsWith("image/") ? item.mimeType : "image/jpeg";
    const fetched = await fetchImageViaProxy(baseOrigin, item.url, mime, debugRunId);
    if (!fetched) continue;
    totalOriginalBytes += fetched.buf.byteLength;
    const optimized = await optimizeImageIfNeeded(fetched.buf, ecoMode);
    totalFinalBytes += optimized.buf.byteLength;
    images.push({ b64: optimized.buf.toString("base64"), mimeType: optimized.mimeType });
  }

  return { images, totalOriginalBytes, totalFinalBytes };
}
