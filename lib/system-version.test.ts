import { describe, expect, it } from "vitest";
import { SYSTEM_VERSION, SYSTEM_VERSION_NOTE, SYSTEM_VERSION_UPDATED } from "@/lib/system-version";

describe("versão do sistema", () => {
  it("começa em 0", () => {
    expect(SYSTEM_VERSION).toBe("0");
    expect(SYSTEM_VERSION_UPDATED).toBe("15/10/2026");
    expect(SYSTEM_VERSION_NOTE).toBe("Início do sistema institucional");
  });
});
