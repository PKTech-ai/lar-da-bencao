import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/csv";
import { safeInternalPath } from "@/lib/navigation";

describe("safeInternalPath", () => {
  it("preserva somente caminhos internos", () => {
    expect(safeInternalPath("/sistema?aba=1", "/mfa")).toBe("/sistema?aba=1");
    expect(safeInternalPath("//malicioso.test", "/mfa")).toBe("/mfa");
    expect(safeInternalPath("/\\malicioso.test", "/mfa")).toBe("/mfa");
    expect(safeInternalPath("https://malicioso.test", "/mfa")).toBe("/mfa");
  });
});

describe("csvCell", () => {
  it("neutraliza fórmulas e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(\"https://malicioso.test\")")).toBe("\"'=HYPERLINK(\"\"https://malicioso.test\"\")\"");
    expect(csvCell("texto")).toBe("\"texto\"");
  });
});
