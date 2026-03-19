import { describe, it, expect } from "vitest";
import { getFallbackResponse, normalizeResponse } from "./route";

describe("getFallbackResponse", () => {
  it("returns a valid response with project name", () => {
    const r = getFallbackResponse("My Project");
    expect(r.project).toBe("My Project");
    expect(r.as_of_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.overall_progress).toBeNull();
    expect(r.confidence).toBe("unknown");
    expect(typeof r.image_coverage_note).toBe("string");
    expect(Array.isArray(r.sections)).toBe(true);
    expect(r.sections.length).toBeGreaterThan(0);
    expect(Array.isArray(r.key_actions)).toBe(true);
    expect(r.key_actions.length).toBeGreaterThanOrEqual(3);
  });

  it("each section has id, title, and rows", () => {
    const r = getFallbackResponse("Site");
    for (const s of r.sections) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.title).toBe("string");
      expect(Array.isArray(s.rows)).toBe(true);
      expect(s.rows.length).toBeGreaterThanOrEqual(1);
      for (const row of s.rows) {
        expect(typeof row.line_item).toBe("string");
        expect(typeof row.current_percent).toBe("string");
        expect(typeof row.suggested_percent).toBe("string");
        expect(typeof row.suggested_percent_range).toBe("string");
        expect(["yes", "no", "partial", "unclear"]).toContain(row.photo_supported);
        expect(["advance", "hold", "verify", "ok"]).toContain(row.status);
        expect(typeof row.notes).toBe("string");
      }
    }
  });

  it("each key_action has priority, label, action", () => {
    const r = getFallbackResponse("Site");
    for (const a of r.key_actions) {
      expect(["immediate", "this_week", "verify", "next_cycle"]).toContain(a.priority);
      expect(typeof a.label).toBe("string");
      expect(typeof a.action).toBe("string");
    }
  });
});

describe("normalizeResponse", () => {
  it("returns fallback for null/undefined", () => {
    const r1 = normalizeResponse(null);
    const r2 = normalizeResponse(undefined);
    expect(r1.project).toBe("Site Analysis");
    expect(r2.project).toBe("Site Analysis");
    expect(r1.sections.length).toBeGreaterThan(0);
    expect(r2.key_actions.length).toBeGreaterThanOrEqual(3);
  });

  it("returns fallback for non-object", () => {
    const r = normalizeResponse("not an object");
    expect(r.project).toBe("Site Analysis");
    expect(r.sections.length).toBeGreaterThan(0);
  });

  it("normalizes valid tool-like input", () => {
    const input = {
      project: "1041 Temple Terrace",
      as_of_date: "2025-03-13",
      overall_progress: 50,
      confidence: "medium",
      image_coverage_note: "3 images: shell + plumbing visible; decking not shown.",
      // Optional: rendering_relation_note should not be required for normalization.
      summary: "Shell appears complete. Plumbing rough-in visible. Recommend advancing shell items; verify decking.",
      sections: [
        {
          id: "pool_spa",
          title: "POOL & SPA",
          rows: [
            {
              line_item: "Shotcrete",
              current_percent: "50%",
              suggested_percent: "100%",
              suggested_percent_range: "95–100%",
              status: "advance",
              photo_supported: "yes",
              notes: "Shell complete.",
            },
          ],
        },
      ],
      key_actions: [
        { priority: "immediate", label: "Advance shotcrete", action: "Bill to 100%." },
      ],
    };
    const r = normalizeResponse(input);
    expect(r.project).toBe("1041 Temple Terrace");
    expect(r.as_of_date).toBe("2025-03-13");
    expect(r.overall_progress).toBe(50);
    expect(r.confidence).toBe("medium");
    expect(r.image_coverage_note).toContain("3 images");
    expect(r.rendering_relation_note).toBeUndefined();
    expect(r.sections.length).toBeGreaterThan(0);
    const poolSection = r.sections.find((s) => s.id === "pool_spa");
    expect(poolSection).toBeDefined();
    expect(poolSection?.rows.length).toBeGreaterThan(0);
    expect(poolSection?.rows[0].line_item).toBe("Shotcrete");
    expect(poolSection?.rows[0].status).toBe("advance");
    expect(poolSection?.rows[0].photo_supported).toBe("yes");
    expect(r.key_actions.length).toBeGreaterThanOrEqual(3);
    expect(r.key_actions[0].priority).toBe("immediate");
    expect(r.key_actions[0].label).toBe("Advance shotcrete");
  });

  it("coerces invalid status to verify", () => {
    const input = {
      project: "P",
      as_of_date: "2025-01-01",
      confidence: "low",
      image_coverage_note: "1 image. Limited coverage.",
      summary: "Limited coverage; verify most scopes.",
      sections: [
        {
          id: "pool_spa",
          title: "POOL & SPA",
          rows: [
            {
              line_item: "Item",
              current_percent: "0%",
              suggested_percent: "50%",
              suggested_percent_range: "50%",
              status: "invalid_status",
              photo_supported: "no",
              notes: "",
            },
          ],
        },
      ],
      key_actions: [{ priority: "verify", label: "L", action: "A" }],
    };
    const r = normalizeResponse(input);
    expect(r.sections.length).toBeGreaterThan(0);
    const row = r.sections[0].rows[0];
    expect(row.status).toBe("verify");
  });

  it("coerces invalid confidence to unknown", () => {
    const input = {
      project: "P",
      as_of_date: "2025-01-01",
      confidence: "super_high",
      image_coverage_note: "2 images.",
      summary: "Summary.",
      sections: [
        {
          id: "x",
          title: "X",
          rows: [
            {
              line_item: "L",
              current_percent: "0%",
              suggested_percent: "0%",
              suggested_percent_range: "0%",
              status: "hold",
              photo_supported: "unclear",
              notes: "",
            },
          ],
        },
      ],
      key_actions: [{ priority: "verify", label: "L", action: "A" }],
    };
    const r = normalizeResponse(input);
    expect(r.confidence).toBe("unknown");
  });

  it("bounds sections and key_actions", () => {
    const manySections = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      title: `Section ${i}`,
      rows: [
        {
          line_item: "L",
          current_percent: "0%",
          suggested_percent: "0%",
          suggested_percent_range: "0%",
          status: "hold" as const,
          photo_supported: "unclear" as const,
          notes: "",
        },
      ],
    }));
    const manyActions = Array.from({ length: 50 }, (_, i) => ({
      priority: "verify" as const,
      label: `Action ${i}`,
      action: `Do ${i}`,
    }));
    const input = {
      project: "P",
      as_of_date: "2025-01-01",
      confidence: "low",
      image_coverage_note: "Many images.",
      summary: "Summary.",
      sections: manySections,
      key_actions: manyActions,
    };
    const r = normalizeResponse(input);
    expect(r.sections.length).toBeLessThanOrEqual(20);
    expect(r.key_actions.length).toBeLessThanOrEqual(30);
  });

  it("truncates very long strings", () => {
    const long = "a".repeat(3000);
    const input = {
      project: long,
      as_of_date: "2025-01-01",
      confidence: "low",
      image_coverage_note: long,
      rendering_relation_note: long,
      summary: long,
      sections: [
        {
          id: "pool_spa",
          title: "POOL & SPA",
          rows: [
            {
              line_item: long,
              current_percent: "0%",
              suggested_percent: "0%",
              suggested_percent_range: "0%",
              status: "hold",
              photo_supported: "unclear",
              notes: long,
            },
          ],
        },
      ],
      key_actions: [{ priority: "verify", label: long, action: long }],
    };
    const r = normalizeResponse(input);
    expect(r.project.length).toBeLessThanOrEqual(2000);
    expect((r.image_coverage_note || "").length).toBeLessThanOrEqual(2000);
    expect((r.rendering_relation_note || "").length).toBeLessThanOrEqual(2000);
    expect(r.sections[0].rows[0].line_item.length).toBeLessThanOrEqual(2000);
    expect(r.sections[0].rows[0].notes.length).toBeLessThanOrEqual(2000);
    expect(r.key_actions[0].label.length).toBeLessThanOrEqual(2000);
  });
});
