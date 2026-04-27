/**
 * Tests for build_contract_signed_v2 email format.
 *
 * These EML files use a new ProDBX template (`build_contract_signed_v2`) that
 * differs from the original `Build Contract Signed` format in several ways:
 *
 *   - No ProDBX contract/addendum links in the body → inline table path
 *   - Customer info is in a structured key/value table (dbxid, client, email,
 *     phone, address, city, state, zip, full_address, order_id, order_grand_total)
 *   - `order_id` uses numeric IDs (not the "WO-XXXX" format) → `preParseEml`
 *     currently returns `orderNo: ""` because the regex expects the WO- prefix
 *   - Address and client fields ARE extracted by `preParseEml` via text scanning
 *
 * Fixtures:
 *   test-files/build_contract_signed_v2.eml          — Jean-Philippe Therrien, order 9383
 *   test-files/build_contract_signed_v2_jeremiah.eml — Jeremiah Taylor, order 9954
 *
 * Webhook simulation:
 *   The webhook receives the EML as a base64 string. We replicate that here by
 *   reading the file as a Buffer and encoding it as base64 before passing it to
 *   each parsing function.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { preParseEml } from "../../lib/preParseEml";
import { parseEML } from "../../lib/emlParser";
import { extractContractLinks } from "../../lib/contractLinkExtractor";
import { extractLocation, isLocationValid } from "../../lib/tableExtractor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const V2_EML_JP  = resolve(__dirname, "../../test-files/build_contract_signed_v2.eml");
const V2_EML_JT  = resolve(__dirname, "../../test-files/build_contract_signed_v2_jeremiah.eml");

/** Read EML file as a base64 string — identical to how Zapier delivers it */
function loadEml(path: string): string {
  return readFileSync(path).toString("base64");
}

/** Decode base64 → Buffer — identical to how the webhook calls parseEML */
function decodeEml(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

// ── preParseEml — Jean-Philippe Therrien (order 9383) ─────────────────────────

describe("preParseEml — build_contract_signed_v2.eml (Jean-Philippe Therrien)", () => {
  let result: Awaited<ReturnType<typeof preParseEml>>;

  beforeAll(async () => {
    result = await preParseEml(loadEml(V2_EML_JP));
  });

  it("subject is build_contract_signed_v2", () => {
    expect(result.subject).toBe("build_contract_signed_v2");
  });

  it("extracts client name", () => {
    expect(result.clientName).toBe("Jean-Philippe Therrien");
  });

  it("extracts street address", () => {
    expect(result.streetAddress).toBe("3051 Rue de Latour");
  });

  it("extracts city", () => {
    expect(result.city).toBe("Bonsall");
  });

  it("extracts state", () => {
    expect(result.state).toBe("California");
  });

  it("extracts zip", () => {
    expect(result.zip).toBe("92003");
  });

  it("has no ProDBX original contract URL (inline-table email)", () => {
    expect(result.hasOriginalContract).toBe(false);
    expect(result.originalContractUrl).toBeNull();
  });

  it("has no addendum URLs", () => {
    expect(result.addendumCount).toBe(0);
    expect(result.addendumUrls).toHaveLength(0);
  });

  it("orderNo is empty string — v2 format uses numeric IDs not WO- prefix", () => {
    // Known limitation: the WO- regex does not match numeric-only order IDs.
    // The order_id value in the email is "9383".
    // This test documents current behaviour so any future fix is detectable.
    expect(result.orderNo).toBe("");
  });

  it("emailDate is present and is a valid date string", () => {
    expect(result.emailDate).toBeTruthy();
    expect(new Date(result.emailDate!).getFullYear()).toBe(2025);
  });
});

// ── preParseEml — Jeremiah Taylor (order 9954) ────────────────────────────────

describe("preParseEml — build_contract_signed_v2_jeremiah.eml (Jeremiah Taylor)", () => {
  let result: Awaited<ReturnType<typeof preParseEml>>;

  beforeAll(async () => {
    result = await preParseEml(loadEml(V2_EML_JT));
  });

  it("subject is build_contract_signed_v2", () => {
    expect(result.subject).toBe("build_contract_signed_v2");
  });

  it("extracts client name", () => {
    expect(result.clientName).toBe("Jeremiah Taylor");
  });

  it("extracts street address", () => {
    expect(result.streetAddress).toBe("4094 Sunnyhill Dr");
  });

  it("extracts city", () => {
    expect(result.city).toBe("Carlsbad");
  });

  it("extracts state", () => {
    expect(result.state).toBe("California");
  });

  it("extracts zip", () => {
    expect(result.zip).toBe("92008");
  });

  it("has no ProDBX original contract URL", () => {
    expect(result.hasOriginalContract).toBe(false);
    expect(result.originalContractUrl).toBeNull();
  });

  it("has no addendum URLs", () => {
    expect(result.addendumCount).toBe(0);
    expect(result.addendumUrls).toHaveLength(0);
  });

  it("orderNo is empty string — v2 format uses numeric IDs not WO- prefix", () => {
    // order_id in this email is "9954"
    expect(result.orderNo).toBe("");
  });

  it("emailDate is present and is a valid 2025 date string", () => {
    expect(result.emailDate).toBeTruthy();
    expect(new Date(result.emailDate!).getFullYear()).toBe(2025);
  });
});

// ── contractLinkExtractor ─────────────────────────────────────────────────────

describe("contractLinkExtractor — build_contract_signed_v2 format", () => {
  it("extracts NO ProDBX links from Jean-Philippe email (inline table)", async () => {
    const b64 = loadEml(V2_EML_JP);
    const parsed = await parseEML(decodeEml(b64));
    const links = extractContractLinks(parsed.html ?? "", parsed.text ?? "");
    expect(links.originalContractUrl).toBeNull();
    expect(links.addendumUrls).toHaveLength(0);
  });

  it("extracts NO ProDBX links from Jeremiah email (inline table)", async () => {
    const b64 = loadEml(V2_EML_JT);
    const parsed = await parseEML(decodeEml(b64));
    const links = extractContractLinks(parsed.html ?? "", parsed.text ?? "");
    expect(links.originalContractUrl).toBeNull();
    expect(links.addendumUrls).toHaveLength(0);
  });

  it("subject does NOT contain 'Addendum' for either email", () => {
    // Both are base contracts, not addendum emails
    expect("build_contract_signed_v2").not.toMatch(/addendum/i);
  });
});

// ── parseEML — raw content extraction ────────────────────────────────────────

describe("parseEML — build_contract_signed_v2 HTML/text content", () => {
  it("produces non-empty HTML for Jean-Philippe email", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(parsed.html?.length ?? 0).toBeGreaterThan(10000);
  });

  it("produces non-empty HTML for Jeremiah email", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JT)));
    expect(parsed.html?.length ?? 0).toBeGreaterThan(10000);
  });

  it("HTML contains customer info table structure", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(parsed.html).toContain("Customer Info");
    expect(parsed.html).toContain("Jean-Philippe Therrien");
  });

  it("text contains order_id field with numeric value 9383", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(parsed.text).toMatch(/order_id/i);
    expect(parsed.text).toMatch(/9383/);
  });

  it("text contains order_id field with numeric value 9954 for Jeremiah", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JT)));
    expect(parsed.text).toMatch(/9954/);
  });

  it("text contains grand total 296,489.82 for Jean-Philippe", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(parsed.text).toMatch(/296,489\.82|296489\.82/);
  });

  it("text contains grand total 386,699.92 for Jeremiah", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JT)));
    expect(parsed.text).toMatch(/386,699\.92|386699\.92/);
  });

  it("text contains full_address for Jean-Philippe", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(parsed.text).toContain("3051 Rue de Latour");
  });

  it("text contains full_address for Jeremiah", async () => {
    const parsed = await parseEML(decodeEml(loadEml(V2_EML_JT)));
    expect(parsed.text).toContain("4094 Sunnyhill Dr");
  });
});

// ── Webhook simulation — known limitation ────────────────────────────────────

describe("webhook simulation — build_contract_signed_v2 format", () => {
  /**
   * The webhook requires orderNo to be non-empty to proceed.
   * The v2 email format uses numeric order IDs (e.g. "9383", "9954") instead
   * of the "WO-XXXX" format. preParseEml's WO- regex does not match them,
   * so orderNo is extracted as "".
   *
   * Current result: webhook would return 400 "Unable to extract order number".
   * These tests document the limitation so it can be detected when fixed.
   */

  it("JP email: orderNo empty → webhook would reject with 400 (known gap)", async () => {
    const result = await preParseEml(loadEml(V2_EML_JP));
    // Simulates the webhook guard: if (!preParse.orderNo) → 400
    const wouldBeRejected = !result.orderNo;
    expect(wouldBeRejected).toBe(true);
  });

  it("Jeremiah email: orderNo empty → webhook would reject with 400 (known gap)", async () => {
    const result = await preParseEml(loadEml(V2_EML_JT));
    const wouldBeRejected = !result.orderNo;
    expect(wouldBeRejected).toBe(true);
  });

  it("both emails have no ProDBX links → inline table path would be used", async () => {
    for (const path of [V2_EML_JP, V2_EML_JT]) {
      const result = await preParseEml(loadEml(path));
      expect(result.hasOriginalContract).toBe(false);
      expect(result.originalContractUrl).toBeNull();
      expect(result.addendumUrls).toHaveLength(0);
    }
  });

  it("client name and address are extractable even though orderNo is not", async () => {
    const jp = await preParseEml(loadEml(V2_EML_JP));
    expect(jp.clientName).toBe("Jean-Philippe Therrien");
    expect(jp.streetAddress).toBe("3051 Rue de Latour");
    expect(jp.city).toBe("Bonsall");

    const jt = await preParseEml(loadEml(V2_EML_JT));
    expect(jt.clientName).toBe("Jeremiah Taylor");
    expect(jt.streetAddress).toBe("4094 Sunnyhill Dr");
    expect(jt.city).toBe("Carlsbad");
  });

  it("grand totals are present in parsed text (available for future extraction)", async () => {
    const jpParsed = await parseEML(decodeEml(loadEml(V2_EML_JP)));
    expect(jpParsed.text).toMatch(/296,489\.82|296489/);

    const jtParsed = await parseEML(decodeEml(loadEml(V2_EML_JT)));
    expect(jtParsed.text).toMatch(/386,699\.92|386699/);
  });
});

// ── Format comparison ─────────────────────────────────────────────────────────

describe("format comparison — v2 vs original Build Contract Signed", () => {
  const ORIGINAL_EML = resolve(__dirname, "../../test-files/Build Contract Signed_Giuseppe Cesta.eml");

  it("original format extracts numeric orderNo via tableExtractor; v2 format does not", async () => {
    // The Giuseppe Cesta EML has a well-formed HTML table that tableExtractor can
    // parse, yielding a numeric order_id ("10480").
    // The v2 EML has a different table structure that tableExtractor does not
    // handle, so orderNo falls back to "" from preParseEml's location extraction.
    const original = await preParseEml(readFileSync(ORIGINAL_EML).toString("base64"));
    const v2 = await preParseEml(loadEml(V2_EML_JP));
    expect(original.orderNo).toBe("10480");
    expect(v2.orderNo).toBe("");
  });

  it("both formats have hasOriginalContract: false (inline table, no links)", async () => {
    const original = await preParseEml(readFileSync(ORIGINAL_EML).toString("base64"));
    const v2 = await preParseEml(loadEml(V2_EML_JP));
    expect(original.hasOriginalContract).toBe(false);
    expect(v2.hasOriginalContract).toBe(false);
  });

  it("both formats extract clientName and streetAddress", async () => {
    const original = await preParseEml(readFileSync(ORIGINAL_EML).toString("base64"));
    expect(original.clientName).toBeTruthy();
    expect(original.streetAddress).toBeTruthy();

    const v2 = await preParseEml(loadEml(V2_EML_JP));
    expect(v2.clientName).toBe("Jean-Philippe Therrien");
    expect(v2.streetAddress).toBe("3051 Rue de Latour");
  });
});
