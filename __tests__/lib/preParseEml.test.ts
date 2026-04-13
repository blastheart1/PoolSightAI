import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { preParseEml } from "../../lib/preParseEml";

const TEST_FILES_DIR = join(process.cwd(), "test-files");

describe("preParseEml", () => {
  describe("Build Addendum to Contract Signed.eml (links-based addendum email)", () => {
    const emlBase64 = readFileSync(
      join(TEST_FILES_DIR, "Build Addendum to Contract Signed.eml")
    ).toString("base64");

    it("extracts Order ID and Client Name", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.orderNo).toBe("9853");
      expect(result.clientName).toBe("Andrea Rodriguez");
    });

    it("detects original contract URL", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.hasOriginalContract).toBe(true);
      expect(result.originalContractUrl).toContain("33047");
    });

    it("detects 5 addendum URLs", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.addendumCount).toBe(5);
      expect(result.addendumUrls).toHaveLength(5);
    });

    it("extracts address fields", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.streetAddress).toBe("12951 PANAMA ST");
      expect(result.city).toBe("Los Angeles");
      expect(result.state).toBe("California");
      expect(result.zip).toBe("90066");
    });

    it("extracts grand total", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.orderGrandTotal).toBe(262460.17);
    });

    it("extracts subject containing Addendum", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.subject).toContain("Addendum");
    });
  });

  describe("Build Contract Signed_Giuseppe Cesta.eml (inline table email)", () => {
    const emlBase64 = readFileSync(
      join(TEST_FILES_DIR, "Build Contract Signed_Giuseppe Cesta.eml")
    ).toString("base64");

    it("extracts Order ID and Client Name", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.orderNo).toBe("10480");
      expect(result.clientName).toBe("Giuseppe Cesta");
    });

    it("detects no ProDBX links", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.hasOriginalContract).toBe(false);
      expect(result.addendumCount).toBe(0);
      expect(result.originalContractUrl).toBeNull();
      expect(result.addendumUrls).toHaveLength(0);
    });

    it("extracts address fields", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.streetAddress).toBe("315 Signal Rd");
      expect(result.city).toBe("Newport Beach");
      expect(result.zip).toBe("92663");
    });

    it("extracts grand total", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.orderGrandTotal).toBe(301166.16);
    });

    it("subject does NOT contain Addendum", async () => {
      const result = await preParseEml(emlBase64);
      expect(result.subject).not.toContain("Addendum");
    });
  });

  describe("edge cases", () => {
    it("returns empty fields for garbage input", async () => {
      const result = await preParseEml(Buffer.from("not an eml file").toString("base64"));
      expect(result.orderNo).toBe("");
      expect(result.clientName).toBe("");
      expect(result.hasOriginalContract).toBe(false);
      expect(result.addendumCount).toBe(0);
    });
  });
});
