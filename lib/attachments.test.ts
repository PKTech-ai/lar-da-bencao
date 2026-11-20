import { describe, expect, it } from "vitest";
import { attachmentPermission, safeFilename, sha256, validateSignature, verifyImageStructure } from "@/lib/attachments";

describe("attachments", () => {
  it("normaliza nomes perigosos sem preservar separadores", () => {
    expect(safeFilename("  extrato/ago:2026.pdf  ")).toBe("extrato_ago_2026.pdf");
    expect(() => safeFilename(".." )).toThrow("Nome de arquivo inválido");
  });

  it("calcula SHA-256 estável", () => {
    expect(sha256("lar-da-bencao")).toBe("3e6ad6c834b600b130d46f665091952524430620321bfcea79d2ac0af9df0895");
  });

  it("confere assinatura real do PDF e rejeita conteúdo disfarçado", () => {
    expect(() => validateSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).not.toThrow();
    expect(() => validateSignature("application/pdf", new TextEncoder().encode("<html>"))).toThrow("não corresponde");
  });

  it("vincula anexos financeiros à página da Tesouraria", () => {
    expect(attachmentPermission("bank_statement")).toEqual({ resource: "tesouraria" });
    expect(() => attachmentPermission("unknown")).toThrow("não permitido");
  });

  it("conferência interna aceita só foto JPG/PNG completa (antivírus fora do ar)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    expect(() => verifyImageStructure("image/jpeg", jpeg)).not.toThrow();
    expect(() => verifyImageStructure("image/jpeg", new Uint8Array([...jpeg, 0, 0]))).not.toThrow();
    expect(() => verifyImageStructure("image/png", png)).not.toThrow();
    expect(() => verifyImageStructure("image/jpeg", jpeg.slice(0, -2))).toThrow("incompleta");
    expect(() => verifyImageStructure("image/png", new TextEncoder().encode("<html><script>"))).toThrow("não corresponde");
    expect(() => verifyImageStructure("application/pdf", new TextEncoder().encode("%PDF-1.7 ... %%EOF"))).toThrow("incompleta");
  });
});
