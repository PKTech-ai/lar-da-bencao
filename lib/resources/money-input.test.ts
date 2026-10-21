import { describe, expect, it } from "vitest";
import { completeMoneyInput, maskMoneyInput, parseMoney } from "@/lib/resources/types";

describe("máscara de valor", () => {
  it("agrupa milhar enquanto a pessoa digita e completa os centavos ao sair", () => {
    expect(maskMoneyInput("1000")).toBe("1.000");
    expect(maskMoneyInput("1.000,5")).toBe("1.000,5");
    expect(completeMoneyInput("1.000")).toBe("1.000,00");
    expect(parseMoney(completeMoneyInput("1.000"))).toBe(100000);
  });

  it("zero continua zero e abaixo de 1 centavo", () => {
    expect(maskMoneyInput("0")).toBe("0");
    expect(completeMoneyInput("0")).toBe("0,00");
    expect(parseMoney(completeMoneyInput("0"))).toBe(0);
    expect(maskMoneyInput("0,01")).toBe("0,01");
  });
});
