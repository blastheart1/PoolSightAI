import { describe, it, expect } from "vitest";
import {
  deduplicateUrls,
  getExistingAddendumIds,
  filterNewAddendums,
  mergeExistingWithNewAddendums,
  validateMergeSafety,
} from "../../lib/contractMerger";
import type { OrderItem } from "../../lib/contractTypes";
import type { AddendumData } from "../../lib/addendumParser";

// ---------------------------------------------------------------------------
// deduplicateUrls
// ---------------------------------------------------------------------------
describe("deduplicateUrls", () => {
  it("removes duplicate URLs", () => {
    const urls = [
      "https://l1.prodbx.com/go/view/?35587.426.20251112100816",
      "https://l1.prodbx.com/go/view/?35279.426.20251020095021",
      "https://l1.prodbx.com/go/view/?35587.426.20251112100816",
    ];
    const result = deduplicateUrls(urls);
    expect(result).toHaveLength(2);
    expect(result).toContain("https://l1.prodbx.com/go/view/?35587.426.20251112100816");
    expect(result).toContain("https://l1.prodbx.com/go/view/?35279.426.20251020095021");
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateUrls([])).toEqual([]);
  });

  it("trims whitespace and filters empty strings", () => {
    const result = deduplicateUrls(["  https://l1.prodbx.com/go/view/?123  ", "", "  "]);
    expect(result).toEqual(["https://l1.prodbx.com/go/view/?123"]);
  });
});

// ---------------------------------------------------------------------------
// getExistingAddendumIds
// ---------------------------------------------------------------------------
describe("getExistingAddendumIds", () => {
  it("collects addendumUrlId from header rows", () => {
    const items: OrderItem[] = [
      { type: "item", productService: "Pool Shell", qty: 1, rate: 100, amount: 100 },
      {
        type: "maincategory",
        productService: "Addendum #7 (35587)",
        qty: "",
        rate: "",
        amount: "",
        isAddendumHeader: true,
        addendumUrlId: "35587",
        addendumNumber: "7",
      },
      { type: "item", productService: "Extra work", qty: 1, rate: 500, amount: 500, columnBLabel: "Addendum" },
      {
        type: "maincategory",
        productService: "Addendum #8 (35279)",
        qty: "",
        rate: "",
        amount: "",
        isAddendumHeader: true,
        addendumUrlId: "35279",
        addendumNumber: "8",
      },
    ];
    const ids = getExistingAddendumIds(items);
    expect(ids.size).toBe(2);
    expect(ids.has("35587")).toBe(true);
    expect(ids.has("35279")).toBe(true);
  });

  it("returns empty set when no addendum headers exist", () => {
    const items: OrderItem[] = [
      { type: "item", productService: "Pool Shell", qty: 1, rate: 100, amount: 100 },
    ];
    expect(getExistingAddendumIds(items).size).toBe(0);
  });

  it("returns empty set for empty array", () => {
    expect(getExistingAddendumIds([]).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterNewAddendums
// ---------------------------------------------------------------------------
describe("filterNewAddendums", () => {
  const addendum35587: AddendumData = {
    addendumNumber: "7",
    items: [{ type: "item", productService: "Extra plumbing", qty: 1, rate: "", amount: 500 }],
    url: "https://l1.prodbx.com/go/view/?35587.426.20251112100816",
    urlId: "35587",
  };
  const addendum35279: AddendumData = {
    addendumNumber: "8",
    items: [{ type: "item", productService: "Electrical", qty: 1, rate: "", amount: 300 }],
    url: "https://l1.prodbx.com/go/view/?35279.426.20251020095021",
    urlId: "35279",
  };
  const addendumNew: AddendumData = {
    addendumNumber: "9",
    items: [{ type: "item", productService: "Landscaping", qty: 1, rate: "", amount: 800 }],
    url: "https://l1.prodbx.com/go/view/?36000.426.20260101120000",
    urlId: "36000",
  };

  it("filters out all addendums when all are already imported", () => {
    const existingIds = new Set(["35587", "35279"]);
    const result = filterNewAddendums([addendum35587, addendum35279], existingIds);
    expect(result).toHaveLength(0);
  });

  it("keeps only new addendums", () => {
    const existingIds = new Set(["35587", "35279"]);
    const result = filterNewAddendums([addendum35587, addendum35279, addendumNew], existingIds);
    expect(result).toHaveLength(1);
    expect(result[0].urlId).toBe("36000");
  });

  it("keeps all when none are duplicates", () => {
    const existingIds = new Set<string>();
    const result = filterNewAddendums([addendum35587, addendumNew], existingIds);
    expect(result).toHaveLength(2);
  });

  it("uses addendumNumber as fallback when urlId is missing", () => {
    const noUrlId: AddendumData = {
      addendumNumber: "7",
      items: [],
      url: "https://example.com",
    };
    const existingIds = new Set(["7"]);
    const result = filterNewAddendums([noUrlId], existingIds);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mergeExistingWithNewAddendums
// ---------------------------------------------------------------------------
describe("mergeExistingWithNewAddendums", () => {
  const existingItems: OrderItem[] = [
    {
      type: "maincategory",
      productService: "0020 Calimingo - Pools:",
      qty: 1,
      rate: "",
      amount: 97849.39,
      mainCategory: "0020 Calimingo - Pools:",
      progressOverallPct: 45,
      completedAmount: 44031.73,
      thisBill: 10000,
    },
    {
      type: "item",
      productService: "Excavation",
      qty: 331,
      rate: 33,
      amount: 10923,
      mainCategory: "0020 Calimingo - Pools:",
      subCategory: "EXCAVATION",
      progressOverallPct: 100,
      completedAmount: 10923,
      thisBill: 0,
    },
  ];

  const newAddendum: AddendumData = {
    addendumNumber: "7",
    items: [
      { type: "item", productService: "Additional plumbing", qty: 1, rate: "", amount: 1500 },
    ],
    url: "https://l1.prodbx.com/go/view/?35587.426",
    urlId: "35587",
  };

  it("returns deep copy of existing when no new addendums", () => {
    const result = mergeExistingWithNewAddendums(existingItems, []);
    expect(result).toHaveLength(2);
    expect(result[0].progressOverallPct).toBe(45);
    expect(result[0].thisBill).toBe(10000);
    // Verify it's a copy, not the same reference
    expect(result[0]).not.toBe(existingItems[0]);
    expect(result[0]).toEqual(existingItems[0]);
  });

  it("preserves all progress fields on existing items after merge", () => {
    const result = mergeExistingWithNewAddendums(existingItems, [newAddendum]);

    // First 2 items should be copies of existing with progress intact
    expect(result[0].progressOverallPct).toBe(45);
    expect(result[0].completedAmount).toBe(44031.73);
    expect(result[0].thisBill).toBe(10000);
    expect(result[1].progressOverallPct).toBe(100);
    expect(result[1].completedAmount).toBe(10923);
  });

  it("appends blank separator, header, and addendum items", () => {
    const result = mergeExistingWithNewAddendums(existingItems, [newAddendum]);

    // existing(2) + blank(1) + header(1) + addendum items(1) = 5
    expect(result).toHaveLength(5);

    // Blank separator
    expect(result[2].isBlankRow).toBe(true);
    expect(result[2].productService).toBe("");

    // Addendum header
    expect(result[3].isAddendumHeader).toBe(true);
    expect(result[3].addendumNumber).toBe("7");
    expect(result[3].addendumUrlId).toBe("35587");
    expect(result[3].type).toBe("maincategory");
    expect(result[3].columnBLabel).toBe("Addendum");

    // Addendum item
    expect(result[4].productService).toBe("Additional plumbing");
    expect(result[4].columnBLabel).toBe("Addendum");
    expect(result[4].amount).toBe(1500);
  });

  it("handles fresh parse (empty existing + addendums)", () => {
    const result = mergeExistingWithNewAddendums([], [newAddendum]);
    // blank(1) + header(1) + item(1) = 3
    expect(result).toHaveLength(3);
    expect(result[0].isBlankRow).toBe(true);
    expect(result[1].isAddendumHeader).toBe(true);
  });

  it("handles multiple addendums in correct order", () => {
    const addendum2: AddendumData = {
      addendumNumber: "8",
      items: [
        { type: "item", productService: "Electrical upgrade", qty: 1, rate: "", amount: 2000 },
      ],
      url: "https://l1.prodbx.com/go/view/?35279.426",
      urlId: "35279",
    };

    const result = mergeExistingWithNewAddendums(existingItems, [newAddendum, addendum2]);
    // existing(2) + blank(1) + header1(1) + items1(1) + header2(1) + items2(1) = 7
    expect(result).toHaveLength(7);
    expect(result[3].addendumNumber).toBe("7");
    expect(result[5].addendumNumber).toBe("8");
  });
});

// ---------------------------------------------------------------------------
// validateMergeSafety
// ---------------------------------------------------------------------------
describe("validateMergeSafety", () => {
  it("returns unsafe when parsed is empty but existing has data", () => {
    const existing: OrderItem[] = [
      { type: "item", productService: "Pool", qty: 1, rate: 100, amount: 100 },
    ];
    const result = validateMergeSafety(existing, [], "project-uuid-123");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("0 items");
  });

  it("returns safe when no existingProjectId is provided", () => {
    const result = validateMergeSafety([], [], undefined);
    expect(result.safe).toBe(true);
  });

  it("returns safe when both existing and parsed have items", () => {
    const existing: OrderItem[] = [
      { type: "item", productService: "Pool", qty: 1, rate: 100, amount: 100 },
    ];
    const parsed: OrderItem[] = [
      { type: "item", productService: "Pool", qty: 1, rate: 100, amount: 100 },
      { type: "item", productService: "New item", qty: 1, rate: 50, amount: 50 },
    ];
    const result = validateMergeSafety(existing, parsed, "project-uuid-123");
    expect(result.safe).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end duplicate addendum scenario
// ---------------------------------------------------------------------------
describe("duplicate addendum prevention (full flow)", () => {
  it("simulates re-upload of same email: all addendums skipped", () => {
    // Existing project already has 5 addendums imported
    const existingItems: OrderItem[] = [
      { type: "item", productService: "Pool Shell", qty: 1, rate: "", amount: 97849 },
      { type: "item", productService: "", qty: "", rate: "", amount: "", isBlankRow: true },
      { type: "maincategory", productService: "Addendum #7 (35587)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "7", addendumUrlId: "35587" },
      { type: "item", productService: "Extra plumbing", qty: 1, rate: "", amount: 500, columnBLabel: "Addendum" },
      { type: "maincategory", productService: "Addendum #6 (35279)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "6", addendumUrlId: "35279" },
      { type: "item", productService: "Electrical", qty: 1, rate: "", amount: 300, columnBLabel: "Addendum" },
      { type: "maincategory", productService: "Addendum #5 (35237)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "5", addendumUrlId: "35237" },
      { type: "item", productService: "Tile work", qty: 1, rate: "", amount: 400, columnBLabel: "Addendum" },
      { type: "maincategory", productService: "Addendum #4 (35098)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "4", addendumUrlId: "35098" },
      { type: "item", productService: "Drainage", qty: 1, rate: "", amount: 600, columnBLabel: "Addendum" },
      { type: "maincategory", productService: "Addendum #3 (34533)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "3", addendumUrlId: "34533" },
      { type: "item", productService: "Permits", qty: 1, rate: "", amount: 200, columnBLabel: "Addendum" },
    ];

    // Same 5 addendums from a re-uploaded email
    const parsedAddendums: AddendumData[] = [
      { addendumNumber: "7", items: [{ type: "item", productService: "Extra plumbing", qty: 1, rate: "", amount: 500 }], url: "url1", urlId: "35587" },
      { addendumNumber: "6", items: [{ type: "item", productService: "Electrical", qty: 1, rate: "", amount: 300 }], url: "url2", urlId: "35279" },
      { addendumNumber: "5", items: [{ type: "item", productService: "Tile work", qty: 1, rate: "", amount: 400 }], url: "url3", urlId: "35237" },
      { addendumNumber: "4", items: [{ type: "item", productService: "Drainage", qty: 1, rate: "", amount: 600 }], url: "url4", urlId: "35098" },
      { addendumNumber: "3", items: [{ type: "item", productService: "Permits", qty: 1, rate: "", amount: 200 }], url: "url5", urlId: "34533" },
    ];

    const existingIds = getExistingAddendumIds(existingItems);
    const newAddendums = filterNewAddendums(parsedAddendums, existingIds);

    // All 5 should be filtered out
    expect(newAddendums).toHaveLength(0);

    // Merge should return existing unchanged (no blank row appended)
    const merged = mergeExistingWithNewAddendums(existingItems, newAddendums);
    expect(merged).toHaveLength(existingItems.length);
  });

  it("simulates newer email with 1 additional addendum: only new one appended", () => {
    // Existing project has 5 addendums
    const existingItems: OrderItem[] = [
      { type: "item", productService: "Pool Shell", qty: 1, rate: "", amount: 97849 },
      { type: "item", productService: "", qty: "", rate: "", amount: "", isBlankRow: true },
      { type: "maincategory", productService: "Addendum #7 (35587)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "7", addendumUrlId: "35587" },
      { type: "item", productService: "Extra plumbing", qty: 1, rate: "", amount: 500, columnBLabel: "Addendum" },
      { type: "maincategory", productService: "Addendum #6 (35279)", qty: "", rate: "", amount: "", isAddendumHeader: true, addendumNumber: "6", addendumUrlId: "35279" },
      { type: "item", productService: "Electrical", qty: 1, rate: "", amount: 300, columnBLabel: "Addendum" },
    ];

    // Newer email now has 6 addendums (the same 5 + 1 new)
    const parsedAddendums: AddendumData[] = [
      { addendumNumber: "7", items: [{ type: "item", productService: "Extra plumbing", qty: 1, rate: "", amount: 500 }], url: "url1", urlId: "35587" },
      { addendumNumber: "6", items: [{ type: "item", productService: "Electrical", qty: 1, rate: "", amount: 300 }], url: "url2", urlId: "35279" },
      { addendumNumber: "9", items: [{ type: "item", productService: "New landscaping", qty: 1, rate: "", amount: 1200 }], url: "url-new", urlId: "36000" },
    ];

    const existingIds = getExistingAddendumIds(existingItems);
    const newAddendums = filterNewAddendums(parsedAddendums, existingIds);

    // Only the new addendum should pass
    expect(newAddendums).toHaveLength(1);
    expect(newAddendums[0].urlId).toBe("36000");
    expect(newAddendums[0].addendumNumber).toBe("9");

    // Merge should append only the new addendum
    const merged = mergeExistingWithNewAddendums(existingItems, newAddendums);

    // existing(6) + blank(1) + header(1) + item(1) = 9
    expect(merged).toHaveLength(9);

    // Verify existing items preserved (first item unchanged)
    expect(merged[0].productService).toBe("Pool Shell");
    expect(merged[0].amount).toBe(97849);

    // New addendum at the end
    const newHeader = merged.find(
      (i) => i.isAddendumHeader && i.addendumUrlId === "36000"
    );
    expect(newHeader).toBeDefined();
    expect(newHeader!.addendumNumber).toBe("9");
  });
});
