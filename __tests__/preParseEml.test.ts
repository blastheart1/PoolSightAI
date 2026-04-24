import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { preParseEml } from "../lib/preParseEml";

const ADDENDUM_EML_PATH = resolve(__dirname, "../test-files/Build Addendum to Contract Signed.eml");

function loadEmlAsBase64(path: string): string {
  return readFileSync(path).toString("base64");
}

describe("preParseEml — Build Addendum to Contract Signed.eml", () => {
  it("extracts the correct Order ID", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.orderNo).toBe("9853");
  });

  it("extracts client name", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.clientName).toBeTruthy();
    expect(result.clientName.toLowerCase()).toContain("rodriguez");
  });

  it("detects the original contract link", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.hasOriginalContract).toBe(true);
    expect(result.originalContractUrl).not.toBeNull();
    expect(result.originalContractUrl).toContain("33047");
  });

  it("detects all 5 addendum links", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.addendumCount).toBe(5);
    expect(result.addendumUrls).toHaveLength(5);
  });

  it("addendum URLs contain expected addendum IDs", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    const allUrls = result.addendumUrls.join(" ");
    // These are the 5 addendum IDs visible in the EML
    expect(allUrls).toContain("35587");
    expect(allUrls).toContain("35279");
    expect(allUrls).toContain("35237");
    expect(allUrls).toContain("35098");
    expect(allUrls).toContain("34533");
  });

  it("extracts street address", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.streetAddress.toUpperCase()).toContain("PANAMA");
  });

  it("extracts city and state", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.city.toLowerCase()).toContain("los angeles");
    expect(result.state.toLowerCase()).toContain("california");
  });

  it("identifies email subject correctly", async () => {
    const eml = loadEmlAsBase64(ADDENDUM_EML_PATH);
    const result = await preParseEml(eml);
    expect(result.subject).toContain("Build Addendum to Contract Signed");
  });
});
