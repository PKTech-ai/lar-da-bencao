import { describe, expect, it } from "vitest";
import { maskCnpjInput, maskPhoneInput } from "./input-masks";

describe("máscaras de telefone e CNPJ", () => {
  it("formata celular e telefone fixo com DDD", () => {
    expect(maskPhoneInput("51")).toBe("(51");
    expect(maskPhoneInput("5133330000")).toBe("(51) 3333-0000");
    expect(maskPhoneInput("51999876543")).toBe("(51) 99987-6543");
    expect(maskPhoneInput("+55 (51) 99987-6543")).toBe("(51) 99987-6543");
  });

  it("formata o CNPJ enquanto é digitado", () => {
    expect(maskCnpjInput("12345678000195")).toBe("12.345.678/0001-95");
  });
});