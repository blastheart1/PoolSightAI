import { parseEML } from "./emlParser";
import { extractLocation } from "./tableExtractor";
import { extractContractLinks } from "./contractLinkExtractor";

/**
 * Strip HTML tags and decode common entities to produce clean plain text.
 * Used when mailparser returns HTML in .text due to missing MIME headers
 * (common with Zapier-constructed EMLs).
 */
export function stripHtmlToText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Get clean plain text from a parsed EML, handling Zapier EMLs
 * that put HTML content into .text due to missing MIME headers.
 */
export function getCleanText(parsed: { text: string; html: string }): string {
  // If .text contains HTML tags, strip them
  if (parsed.text && /<[a-z][\s\S]*>/i.test(parsed.text)) {
    return stripHtmlToText(parsed.text);
  }
  return parsed.text ?? "";
}

export interface PreParseResult {
  orderNo: string;
  clientName: string;
  subject: string | undefined;
  emailDate: string | undefined;
  hasOriginalContract: boolean;
  addendumCount: number;
  originalContractUrl: string | null;
  addendumUrls: string[];
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  orderGrandTotal: number | undefined;
}

/**
 * Lightweight pre-parse of an EML file.
 * Extracts identity fields and link metadata WITHOUT fetching any ProDBX URLs.
 * Designed to be fast (<200ms) for UI duplicate detection and webhook triage.
 */
export async function preParseEml(emlBase64: string): Promise<PreParseResult> {
  const buffer = Buffer.from(emlBase64, "base64");
  const parsed = await parseEML(buffer);
  const cleanText = getCleanText(parsed);
  const location = extractLocation(cleanText);
  const links = extractContractLinks(parsed);

  return {
    orderNo: location.orderNo ?? "",
    clientName: location.clientName ?? "",
    subject: parsed.subject ?? undefined,
    emailDate: parsed.date ? String(parsed.date) : undefined,
    hasOriginalContract: links.originalContractUrl !== null,
    addendumCount: links.addendumUrls.length,
    originalContractUrl: links.originalContractUrl,
    addendumUrls: links.addendumUrls,
    streetAddress: location.streetAddress ?? "",
    city: location.city ?? "",
    state: location.state ?? "",
    zip: location.zip ?? "",
    orderGrandTotal: location.orderGrandTotal,
  };
}
