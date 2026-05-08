/**
 * Tests for POST /api/webhooks/contract-addendum
 *
 * Key invariant: when an existing project receives new addendums,
 * appendContractItems is called (not replaceContractItems) and
 * projectSelectedItems is never deleted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockDb, querySpy } from "./helpers/mockDb";

vi.mock("../../lib/db", () => ({ db: mockDb }));
vi.mock("next/server", async () => vi.importActual("next/server"));

const mockPreParseEml          = vi.fn();
const mockFindProjectByOrderNo = vi.fn();
const mockRunLinksFlow         = vi.fn();
const mockInsertContractItems  = vi.fn();
const mockAppendContractItems  = vi.fn();

vi.mock("../../lib/preParseEml", () => ({
  preParseEml: mockPreParseEml,
}));
vi.mock("../../lib/contractParseFlow", () => ({
  findProjectByOrderNo: mockFindProjectByOrderNo,
  runLinksFlow:         mockRunLinksFlow,
  insertContractItems:  mockInsertContractItems,
  appendContractItems:  mockAppendContractItems,
}));

const { POST } = await import("../../app/api/webhooks/contract-addendum/route");

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SECRET   = "test-secret-xyz";
const fakeEml  = Buffer.from("From: x\r\n\r\nBody").toString("base64");

const existingProject = { id: "existing-proj", name: "Smith Residence", orderNo: "7304" };
const newProject      = { id: "new-proj",      name: "1842 Canyon Ridge Dr | Smith", orderNo: "7304" };

const preParsed = {
  orderNo: "7304",
  clientName: "Stephanie Young",
  subject: "Addendum",
  hasOriginalContract: true,
  addendumCount: 1,
  originalContractUrl: "https://f1.prodbx.com/go/view/?7304.orig",
  addendumUrls: ["https://f1.prodbx.com/go/view/?7304.add1"],
  streetAddress: "1842 Canyon Ridge Dr",
  orderGrandTotal: "248600",
};

const existingItems = [
  { type: "item", productService: "Excavation", qty: 1, rate: 50000, amount: 50000 },
];
const newAddendumItems = [
  { type: "item", productService: "", qty: "", rate: "", amount: "", isBlankRow: true },
  { type: "maincategory", productService: "Addendum #1", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "1", addendumUrlId: "7304.add1" },
  { type: "item", productService: "Extra Plumbing", qty: 1, rate: 3000, amount: 3000 },
];
const allItems = [...existingItems, ...newAddendumItems];

const linksResultExisting = {
  location: { orderNo: "7304", streetAddress: "1842 Canyon Ridge Dr", clientName: "Stephanie Young" },
  items: allItems,
  newItems: newAddendumItems,
  mergeInfo: { existingItemCount: 1, newAddendumCount: 1, skippedDuplicateCount: 0, totalItemCount: 4 },
};

const linksResultNew = {
  location: { orderNo: "7304", streetAddress: "1842 Canyon Ridge Dr", clientName: "Stephanie Young", orderGrandTotal: 248600 },
  items: allItems,
  mergeInfo: undefined,
};

function req(body: unknown, secret = SECRET): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/contract-addendum", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockDb.__reset();
  vi.clearAllMocks();
  process.env.WEBHOOK_SECRET = SECRET;
  mockAppendContractItems.mockResolvedValue(undefined);
  mockInsertContractItems.mockResolvedValue(undefined);
});

// ── Auth ───────────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("401 when WEBHOOK_SECRET is not configured", async () => {
    delete process.env.WEBHOOK_SECRET;
    expect((await POST(req({ eml: fakeEml }))).status).toBe(401);
  });

  it("401 when secret is wrong", async () => {
    expect((await POST(req({ eml: fakeEml }, "bad-secret"))).status).toBe(401);
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe("validation", () => {
  it("400 when eml field is missing", async () => {
    const res = await POST(req({ other: "field" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/eml/i);
  });

  it("400 when orderNo cannot be extracted", async () => {
    mockPreParseEml.mockResolvedValueOnce({ ...preParsed, orderNo: null });
    expect((await POST(req({ eml: fakeEml }))).status).toBe(400);
  });

  it("400 when no addendum links found", async () => {
    mockPreParseEml.mockResolvedValueOnce({ ...preParsed, addendumCount: 0, addendumUrls: [] });
    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/addendum/i);
  });
});

// ── New project ────────────────────────────────────────────────────────────────

describe("new project", () => {
  it("returns action:'created' with projectId and itemCount", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultNew);
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("created");
    expect(body.projectId).toBe(newProject.id);
    expect(body.itemCount).toBe(allItems.length);
  });

  it("calls insertContractItems (not appendContractItems) for new projects", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(null);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultNew);
    querySpy.mockResolvedValueOnce([newProject]).mockResolvedValueOnce(undefined);

    await POST(req({ eml: fakeEml }));
    expect(mockInsertContractItems).toHaveBeenCalledOnce();
    expect(mockAppendContractItems).not.toHaveBeenCalled();
  });
});

// ── Existing project — new addendums ──────────────────────────────────────────

describe("existing project — new addendums", () => {
  it("returns action:'updated' with mergeInfo and newItems count", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultExisting);
    querySpy.mockResolvedValue([]);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("updated");
    expect(body.projectId).toBe(existingProject.id);
    expect(body.itemCount).toBe(newAddendumItems.length);
    expect(body.mergeInfo.newAddendumCount).toBe(1);
  });

  it("calls appendContractItems with only newItems — never replaceContractItems", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultExisting);
    querySpy.mockResolvedValue([]);

    await POST(req({ eml: fakeEml }));
    expect(mockAppendContractItems).toHaveBeenCalledOnce();
    expect(mockAppendContractItems).toHaveBeenCalledWith(existingProject.id, newAddendumItems);
    expect(mockInsertContractItems).not.toHaveBeenCalled();
  });

  it("never deletes projectSelectedItems", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultExisting);
    querySpy.mockResolvedValue([]);

    await POST(req({ eml: fakeEml }));

    // Verify no write functions were called
    expect(mockInsertContractItems).not.toHaveBeenCalled();
  });

  it("passes existingProjectId to runLinksFlow for dedup", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce(linksResultExisting);
    querySpy.mockResolvedValue([]);

    await POST(req({ eml: fakeEml }));
    expect(mockRunLinksFlow).toHaveBeenCalledWith(
      expect.objectContaining({ existingProjectId: existingProject.id })
    );
  });
});

// ── Existing project — all addendums already imported ─────────────────────────

describe("existing project — skipped (no new addendums)", () => {
  it("returns action:'skipped' and writes nothing to DB", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockResolvedValueOnce({
      ...linksResultExisting,
      newItems: [],
      mergeInfo: { existingItemCount: 1, newAddendumCount: 0, skippedDuplicateCount: 1, totalItemCount: 1 },
    });
    querySpy.mockResolvedValue([]);

    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("skipped");
    expect(mockAppendContractItems).not.toHaveBeenCalled();
    expect(mockInsertContractItems).not.toHaveBeenCalled();
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("500 when preParseEml throws", async () => {
    mockPreParseEml.mockRejectedValueOnce(new Error("EML decode failed"));
    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(500);
  });

  it("500 when runLinksFlow throws", async () => {
    mockPreParseEml.mockResolvedValueOnce(preParsed);
    mockFindProjectByOrderNo.mockResolvedValueOnce(existingProject);
    mockRunLinksFlow.mockRejectedValueOnce(new Error("ProDBX timed out"));
    const res = await POST(req({ eml: fakeEml }));
    expect(res.status).toBe(500);
    expect((await res.json()).details).toMatch(/prodbx timed out/i);
  });
});
