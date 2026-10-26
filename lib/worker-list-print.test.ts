import { describe, expect, it } from "vitest";
import { birthInfo, brDateOnly } from "@/lib/worker-list-print";

describe("lista impressa de trabalhadores", () => {
  it("calcula aniversário, ano e idade completa", () => {
    expect(birthInfo("1980-10-27", "2026-10-26")).toEqual({ birthday: "27/10", year: "1980", age: "45" });
    expect(birthInfo("1980-10-26", "2026-10-26")).toEqual({ birthday: "26/10", year: "1980", age: "46" });
    expect(birthInfo("2000-02-29", "2026-03-01")).toEqual({ birthday: "29/02", year: "2000", age: "26" });
    expect(birthInfo(null, "2026-10-26")).toEqual({ birthday: "—", year: "—", age: "—" });
  });

  it("formata a data de emissão da ficha", () => {
    expect(brDateOnly("2026-09-18")).toBe("18/09/2026");
    expect(brDateOnly(null)).toBe("—");
  });
});
