import { describe, expect, it } from "vitest";
import { isOverdue } from "../dates";

describe("isOverdue", () => {
  it("returns false for null due date", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("returns true for a date in the past", () => {
    expect(isOverdue("2020-01-01T00:00:00.000Z")).toBe(true);
  });

  it("returns false for a date in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isOverdue(future.toISOString())).toBe(false);
  });

  it("returns false for today's date", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(isOverdue(today.toISOString())).toBe(false);
  });
});
