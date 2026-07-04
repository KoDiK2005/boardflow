import { describe, expect, it } from "vitest";
import { formatFileSize } from "../format";

describe("formatFileSize", () => {
  it("formats bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 Б");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 КБ");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 МБ");
  });
});
