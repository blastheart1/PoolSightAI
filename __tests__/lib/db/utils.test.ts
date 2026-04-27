import { describe, it, expect } from "vitest";
import { toDec } from "../../../lib/db/utils";

describe("toDec", () => {
  it("returns null for null", () => expect(toDec(null)).toBeNull());
  it("returns null for undefined", () => expect(toDec(undefined)).toBeNull());
  it("returns null for empty string", () => expect(toDec("")).toBeNull());
  it("converts 0 to '0'", () => expect(toDec(0)).toBe("0"));
  it("converts positive number to string", () => expect(toDec(12345)).toBe("12345"));
  it("converts negative number to string", () => expect(toDec(-99)).toBe("-99"));
  it("converts decimal number to string", () => expect(toDec(99.5)).toBe("99.5"));
  it("passes through a numeric string unchanged", () => expect(toDec("248600")).toBe("248600"));
  it("passes through a decimal string unchanged", () => expect(toDec("33.33")).toBe("33.33"));
  it("passes through large numeric string", () => expect(toDec("1000000")).toBe("1000000"));
});
