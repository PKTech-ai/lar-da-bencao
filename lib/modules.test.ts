import { describe, expect, it } from "vitest";
import { moduleCatalog } from "@/lib/modules";

describe("modules catalog", () => {
  it("expõe módulos da onda 1 com rotas e flags", () => {
    expect(moduleCatalog.some((m) => m.key === "doutrina")).toBe(true);
    expect(moduleCatalog.every((m) => m.href.startsWith("/sistema"))).toBe(true);
  });
});
