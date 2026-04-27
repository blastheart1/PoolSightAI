/**
 * Tests for POST /api/webhooks/contract-email
 * Covers: auth, validation, new project (links + inline), update existing, skip, errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockDb, querySpy } from "./helpers/mockDb";

vi.mock("../../lib/db", () => ({ db: mockDb }));
vi.mock("next/server", async () => vi.importActual("next/server"));

const mockPreParseEml         = vi.fn();
const mockFindProjectByOrderNo= vi.fn();
const mockRunLinksFlow        = vi.fn();
const mockInsertContractItems = vi.fn();
const mockReplaceContractItems= vi.fn();

vi.mock("../../lib/preParseEml", () => ({
  preParseEml:  mockPreParseEml,
  getCleanText: vi.fn().mockReturnValue("<table>...</table>"),
}));
vi.mock("../../lib/contractParseFlow", () => ({
  findProjectByOrderNo:  mockFindProjectByOrderNo,
  runLinksFlow:          mockRunLinksFlow,
  insertContractItems:   mockInsertContractItems,
  replaceContractItems:  mockReplaceContractItems,
}));
vi.mock("../../lib/emlParser", () => ({
  parseEML: vi.fn().mockResolvedValue({
    html: "<table class='pos'><tr><td>Excavation</td></tr></table>",
    text: "",
  }),
}));
vi.mock("../../lib/tableExtractor", () => ({
  extractOrderItems: vi.fn().mockReturnValue([
    { type: "item", productService: "Excavation", qty: 1, rate: 50000, amount: 50000 },
  ]),
  extractLocation: vi.fn().mockReturnValue({
    orderNo: "WO-1048", streetAddress: "1842 Canyon Ridge Dr",
    city: "Newport Beach", state: "CA", clientName: "Evan Smith", orderGrandTotal: 248600,
  }),
  isLocationValid: vi.fn().mockReturnValue(true),
}));
vi.mock("../../lib/addendumParser",       () => ({ validateAddendumUrl: vi.fn() }));
vi.mock("../../lib/contractLinkExtractor",() => ({ extractContractLinks: vi.fn().mockReturnValue([]) }));

const { POST } = await import("../../app/api/webhooks/contract-email/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-xyz";
const fakeEml = Buffer.from("From: x\r\n\r\nBody").toString("base64");

const newProject     = { id: "new-proj", name: "1842 Canyon Ridge Dr | Evan Smith", orderNo: "WO-1048" };
const existingProject= { id: "existing-proj", name: "Smith Residence", orderNo: "WO-1048" };

const preParsedLinks = {
  orderNo: "WO-1048", clientName: "Evan Smith", subject: "Contract",
  hasOriginalContract: true, addendumCount: 2,
  originalContractUrl: "https://l1.prodbx.com/go/view/?orig",
  addendumUrls: ["https://l1.prodbx.com/go/view/?add1"],
  streetAddress: "1842 Canyon Ridge Dr", orderGrandTotal: "248600",
};
const preParsedInline = {
  ...preParsedLinks, hasOriginalContract: false, addendumCount: 0,
  originalContractUrl: null, addendumUrls: [],
};
const linksResult = {
  location: { orderNo: "WO-1048", streetAddress: "1842 Canyon Ridge Dr", clientName: "Evan Smith", orderGrandTotal: 248600 },
  items: [
    { type: "item", productService: "Excavation", qty: 1, rate: 50000, amount: 50000 },
    { type: "item", productService: "Plumbing",   qty: 1, rate: 30000, amount: 30000 },
  ],
  mergeInfo: { existingItemCount: 0, newAddendumCount: 2, skippedDuplicateCount: 0, totalItemCount: 2 },
};

function req(body: unknown, secret = SECRET): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/contract-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockDb.__reset();
  vi.clearAllMocks();
  process.env.WEBHOOK_SECRET = SECRET;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("401 when no WEBHOOK_SECRET configured", async () => {
    delete process.env.WEBHOOK_SECRET;
    expect((await POST(req({ eml: fakeEml }))).status).toBe(401);
  });

  it("401 when secret is wrong", async () => {
    expect((await POST(req({ eml: fakeEml }, "bad-secret"))).status).toBe(401);
  });

  it("401 when Authorization header is missing", async () => {
    const r = new NextRequest("http://localhost/api/webhooks/contract-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eml: fakeEml }),
    });
    expect((await POST(r)).status).toBe(401);
  });

  it("200 when secret passed via X-Webhook-Secret header", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedInline);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockInsertContractItems.mockResolvedValueOnce(undefined);
    // project insert + webhook log
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    const r = new NextRequest("http://localhost/api/webhooks/contract-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": SECRET },
      body: JSON.stringify({ eml: fakeEml }),
    });
    expect((await POST(r)).status).toBe(200);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validation", () => {
  it("400 when eml field is missing", async () => {
    const res = await POST(req({ other: "field" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/eml/i);
  });

  it("400 when eml is empty string", async () => {
    expect((await POST(req({ eml: "" }))).status).toBe(400);
  });

  it("400 when orderNo cannot be extracted", async () => {
    mockPreParseEml.mockResolvedValueOnce({ ...preParsedInline, orderNo: null });
    expect((await POST(req({ eml: fakeEml }))).status).toBe(400);
  });
});

// ── New project — links flow ──────────────────────────────────────────────────

describe("new project via links flow", () => {
  it("returns action:'created' with projectId and itemCount", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockRunLinksFlow.mockResolvedValueOnce(linksResult);
    mockInsertContractItems.mockResolvedValueOnce(undefined);
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("created");
    expect(body.projectId).toBe(newProject.id);
    expect(body.itemCount).toBe(2);
  });

  it("calls runLinksFlow with originalContractUrl and addendumLinks", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockRunLinksFlow.mockResolvedValueOnce(linksResult);
    mockInsertContractItems.mockResolvedValueOnce(undefined);
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    await POST(req({ eml: fakeEml }));
    expect(mockRunLinksFlow).toHaveBeenCalledWith(expect.objectContaining({
      originalContractUrl: preParsedLinks.originalContractUrl,
      addendumLinks:       preParsedLinks.addendumUrls,
    }));
  });
});

// ── New project — inline table ────────────────────────────────────────────────

describe("new project via inline table flow", () => {
  it("creates project without calling runLinksFlow", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedInline);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockInsertContractItems.mockResolvedValueOnce(undefined);
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("created");
    expect(mockRunLinksFlow).not.toHaveBeenCalled();
  });
});

// ── Existing project — append addendums ───────────────────────────────────────

describe("existing project — append addendums", () => {
  it("returns action:'updated' with mergeInfo", async () => {
    const mergeInfo = { existingItemCount: 5, newAddendumCount: 2, skippedDuplicateCount: 0, totalItemCount: 7 };
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce({ ...linksResult, mergeInfo });
    mockReplaceContractItems.mockResolvedValueOnce(undefined);
    // delete selectedItems, update parsedAt, webhook log
    querySpy.mockResolvedValue([]);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("updated");
    expect(body.projectId).toBe(existingProject.id);
    expect(body.mergeInfo?.newAddendumCount).toBe(2);
  });

  it("passes existingProjectId to runLinksFlow for dedup", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce({ ...linksResult, mergeInfo: { ...linksResult.mergeInfo, newAddendumCount: 1 } });
    mockReplaceContractItems.mockResolvedValueOnce(undefined);
    querySpy.mockResolvedValue([]);

    await POST(req({ eml: fakeEml }));
    expect(mockRunLinksFlow).toHaveBeenCalledWith(expect.objectContaining({ existingProjectId: existingProject.id }));
  });

  it("returns action:'skipped' when newAddendumCount is 0", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce({
      ...linksResult,
      mergeInfo: { existingItemCount: 5, newAddendumCount: 0, skippedDuplicateCount: 2, totalItemCount: 5 },
    });

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("skipped");
    expect(mockReplaceContractItems).not.toHaveBeenCalled();
  });
});

// ── Existing project — inline table (already imported) ────────────────────────

describe("existing project — inline table (skip)", () => {
  it("returns action:'skipped' — base contract already exists", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedInline);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("skipped");
    expect(mockInsertContractItems).not.toHaveBeenCalled();
    expect(mockReplaceContractItems).not.toHaveBeenCalled();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("500 when preParseEml throws", async () => {
    mockPreParseEml.mockRejectedValueOnce(new Error("EML decode failed"));
    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/webhook processing failed/i);
  });

  it("500 when runLinksFlow throws", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedLinks);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockRunLinksFlow.mockRejectedValueOnce(new Error("ProDBX timed out"));

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(500);
    expect((await res.json()).details).toMatch(/prodbx timed out/i);
  });

  it("500 when db insert throws on new project", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsedInline);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    querySpy.mockRejectedValueOnce(new Error("unique constraint"));

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(500);
  });
});
