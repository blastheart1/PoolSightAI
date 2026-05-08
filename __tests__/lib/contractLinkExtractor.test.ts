import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractContractLinks } from "../../lib/contractLinkExtractor";
import { parseEML } from "../../lib/emlParser";
import { extractLocation } from "../../lib/tableExtractor";

const TEST_FILES_DIR = join(process.cwd(), "test-files");

// ---------------------------------------------------------------------------
// Build Addendum to Contract Signed.eml — Andrea Rodriguez, Order 9853
// Contains: Original Contract link + 5 Addendum links (no inline table)
// ---------------------------------------------------------------------------
describe("Build Addendum to Contract Signed.eml", () => {
  const emlBuffer = readFileSync(
    join(TEST_FILES_DIR, "Build Addendum to Contract Signed.eml")
  );

  it("extracts original contract URL", async () => {
    const parsed = await parseEML(emlBuffer);
    const links = extractContractLinks(parsed);

    expect(links.originalContractUrl).not.toBeNull();
    expect(links.originalContractUrl).toContain("33047.426.20250801132906");
  });

  it("extracts all 5 addendum URLs", async () => {
    const parsed = await parseEML(emlBuffer);
    const links = extractContractLinks(parsed);

    expect(links.addendumUrls).toHaveLength(5);

    // Expected addendum URL IDs from the EML
    const expectedIds = ["35587", "35279", "35237", "35098", "34533"];
    for (const id of expectedIds) {
      const found = links.addendumUrls.some((url) => url.includes(id));
      expect(found, `Expected addendum URL containing ${id}`).toBe(true);
    }
  });

  it("deduplicates URLs (no duplicates from HTML + text)", async () => {
    const parsed = await parseEML(emlBuffer);
    const links = extractContractLinks(parsed);

    const uniqueUrls = new Set(links.addendumUrls);
    expect(uniqueUrls.size).toBe(links.addendumUrls.length);
  });

  it("does not include original contract URL in addendum list", async () => {
    const parsed = await parseEML(emlBuffer);
    const links = extractContractLinks(parsed);

    expect(links.originalContractUrl).not.toBeNull();
    const originalInAddendums = links.addendumUrls.some(
      (url) => url === links.originalContractUrl
    );
    expect(originalInAddendums).toBe(false);
  });

  it("extracts location from email text", async () => {
    const parsed = await parseEML(emlBuffer);
    const location = extractLocation(parsed.text);

    expect(location.orderNo).toBe("9853");
    expect(location.clientName).toBe("Andrea Rodriguez");
    expect(location.streetAddress).toBe("12951 PANAMA ST");
    expect(location.city).toBe("Los Angeles");
    expect(location.state).toBe("California");
    expect(location.zip).toBe("90066");
    expect(location.orderGrandTotal).toBe(262460.17);
  });
});

// ---------------------------------------------------------------------------
// Build Contract Signed_Giuseppe Cesta.eml — Order 10480
// Contains: Inline Order Items Table (no addendum links)
// ---------------------------------------------------------------------------
describe("Build Contract Signed_Giuseppe Cesta.eml", () => {
  const emlBuffer = readFileSync(
    join(TEST_FILES_DIR, "Build Contract Signed_Giuseppe Cesta.eml")
  );

  it("extracts NO ProDBX links (inline table email)", async () => {
    const parsed = await parseEML(emlBuffer);
    const links = extractContractLinks(parsed);

    expect(links.originalContractUrl).toBeNull();
    expect(links.addendumUrls).toHaveLength(0);
  });

  it("extracts location from email text", async () => {
    const parsed = await parseEML(emlBuffer);
    const location = extractLocation(parsed.text);

    expect(location.orderNo).toBe("10480");
    expect(location.clientName).toBe("Giuseppe Cesta");
    expect(location.streetAddress).toBe("315 Signal Rd");
    expect(location.city).toBe("Newport Beach");
    expect(location.state).toBe("California");
    expect(location.zip).toBe("92663");
    expect(location.orderGrandTotal).toBe(301166.16);
  });

  it("subject indicates base contract (not addendum)", async () => {
    const parsed = await parseEML(emlBuffer);
    expect(parsed.subject).toContain("Build Contract Signed");
    expect(parsed.subject).not.toContain("Addendum");
  });
});

// ---------------------------------------------------------------------------
// Zapier-constructed EML — HTML body but NO Content-Type: text/html MIME header.
// mailparser routes the HTML into .text, leaving .html empty. The extractor
// must detect the HTML markup in .text and route it through the cheerio path
// so the strong-tag-anchored selectors can find Original Contract / Addendums.
// ---------------------------------------------------------------------------
describe("Zapier-constructed EML (HTML body, no Content-Type header)", () => {
  function buildZapierEml(): Buffer {
    const headers =
      `From: do-not-reply@tx.clientimagedbx.com\r\n` +
      `To: Zapier@calimingo.com\r\n` +
      `Subject: Build Addendum to Contract Signed\r\n` +
      `Date: Wed, 06 May 2026 17:51:05 +0000\r\n` +
      `Message-ID: <19dfe6a31107c244>\r\n\r\n`;

    const ocB64 = Buffer.from(
      "https://f1.prodbx.com/go/view/?25364.426.20240809135502"
    ).toString("base64");

    const ids = [
      "39726.426.20260506105037",
      "39624.426.20260504154533",
      "38197.426.20260311192156",
    ];
    const addendumHtml = ids
      .map((id) => {
        const b64 = Buffer.from(
          `https://f1.prodbx.com/go/view/?${id}`
        ).toString("base64");
        return (
          `<br><a href="https://l2605a.prodbx.com/go?l=426-466953-${b64}" rel="nofollow" target="_blank" data-pm-no-track=""></a>` +
          `<a href="https://l2605a.prodbx.com/go?l=426-466953-${b64}" target="_blank" data-pm-no-track="">https://f1.prodbx.com/go/view/?${id}</a>.`
        );
      })
      .join("\n");

    const body =
      `<!DOCTYPE html>\n<html>\n<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>\n<body>\n` +
      `<div><strong>Order Id:</strong>7304</div>\n` +
      `<div><strong>Original Contract:&nbsp;</strong></div>\n` +
      `<div>\n` +
      `<br><a href="https://l2605a.prodbx.com/go?l=426-466953-${ocB64}" rel="nofollow" target="_blank" data-pm-no-track=""></a>` +
      `<a href="https://l2605a.prodbx.com/go?l=426-466953-${ocB64}" target="_blank" data-pm-no-track="">https://f1.prodbx.com/go/view/?25364.426.20240809135502</a>.</div>\n` +
      `<div><strong>Addendums:&nbsp;</strong></div>\n` +
      `<div>\n${addendumHtml}\n</div>\n` +
      `</body>\n</html>`;

    return Buffer.from(headers + body);
  }

  it("places HTML body into .text (not .html) when Content-Type header is missing", async () => {
    const parsed = await parseEML(buildZapierEml());
    expect(parsed.html.length).toBe(0);
    expect(parsed.text.length).toBeGreaterThan(0);
    expect(parsed.text).toContain("<strong>Original Contract");
  });

  it("extracts the original contract URL from HTML markup that mailparser put into .text", async () => {
    const parsed = await parseEML(buildZapierEml());
    const links = extractContractLinks(parsed);
    expect(links.originalContractUrl).toBe(
      "https://f1.prodbx.com/go/view/?25364.426.20240809135502"
    );
  });

  it("extracts all addendum URLs in DOM (email) order", async () => {
    const parsed = await parseEML(buildZapierEml());
    const links = extractContractLinks(parsed);
    expect(links.addendumUrls).toEqual([
      "https://f1.prodbx.com/go/view/?39726.426.20260506105037",
      "https://f1.prodbx.com/go/view/?39624.426.20260504154533",
      "https://f1.prodbx.com/go/view/?38197.426.20260311192156",
    ]);
  });

  it("does not include the original contract URL in the addendum list", async () => {
    const parsed = await parseEML(buildZapierEml());
    const links = extractContractLinks(parsed);
    expect(links.addendumUrls).not.toContain(links.originalContractUrl);
  });
});

// ---------------------------------------------------------------------------
// EML type detection — distinguish base contract from addendum emails
// ---------------------------------------------------------------------------
describe("EML type detection", () => {
  it("addendum email subject contains 'Addendum'", async () => {
    const emlBuffer = readFileSync(
      join(TEST_FILES_DIR, "Build Addendum to Contract Signed.eml")
    );
    const parsed = await parseEML(emlBuffer);
    expect(parsed.subject?.toLowerCase()).toContain("addendum");
  });

  it("base contract email subject does not contain 'Addendum'", async () => {
    const emlBuffer = readFileSync(
      join(TEST_FILES_DIR, "Build Contract Signed_Giuseppe Cesta.eml")
    );
    const parsed = await parseEML(emlBuffer);
    expect(parsed.subject?.toLowerCase()).not.toContain("addendum");
  });
});
