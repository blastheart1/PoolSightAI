import { parseEML } from "./emlParser";
import { extractLocation } from "./tableExtractor";
import { extractContractLinks } from "./contractLinkExtractor";

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
  const location = extractLocation(parsed.text);
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
