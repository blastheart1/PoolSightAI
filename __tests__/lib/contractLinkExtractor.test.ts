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
