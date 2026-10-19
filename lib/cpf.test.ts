import { describe, expect, it } from "vitest";
import { cpfDigits, formatCpf, isValidCpf, maskCpf } from "./cpf";

describe("cpf", () => {
  it("aceita um CPF com dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(cpfDigits("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("recusa tamanho errado, sequência repetida e dígito errado", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("mascara deixando só o fim", () => {
    expect(maskCpf("52998224725")).toBe("***.***.***-25");
  });
});
