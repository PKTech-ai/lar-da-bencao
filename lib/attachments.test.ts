import { describe, expect, it } from "vitest";
import { attachmentPermission, safeFilename, sha256, validateSignature } from "@/lib/attachments";

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
});
