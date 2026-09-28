import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/csv";
import { safeInternalPath } from "@/lib/navigation";

describe("safeInternalPath", () => {
  it("preserva somente caminhos internos", () => {
    expect(safeInternalPath("/sistema?aba=1", "/sistema")).toBe("/sistema?aba=1");
    expect(safeInternalPath("//malicioso.test", "/sistema")).toBe("/sistema");
    expect(safeInternalPath("/\\malicioso.test", "/sistema")).toBe("/sistema");
    expect(safeInternalPath("https://malicioso.test", "/sistema")).toBe("/sistema");
  });
});

describe("csvCell", () => {
  it("neutraliza fórmulas e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(\"https://malicioso.test\")")).toBe("\"'=HYPERLINK(\"\"https://malicioso.test\"\")\"");
    expect(csvCell("texto")).toBe("\"texto\"");
  });
});
