import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  attachmentPermission, DOCX_MIME, internalPdfCheckAllowed, safeFilename, sha256, validateSignature, verifyImageStructure, verifyPdfStructure
} from "@/lib/attachments";

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

  describe("conferência interna de PDF (só Biblioteca de Estudos)", () => {
    const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.7\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
    const objStm = (content: string, filter = "/Filter /FlateDecode") => {
      const packed = deflateSync(Buffer.from(content, "latin1")).toString("latin1");
      return Uint8Array.from(Buffer.from(`%PDF-1.7\n5 0 obj << /Type /ObjStm /N 1 /First 4 ${filter} /Length ${packed.length} >>stream\n${packed}\nendstream endobj\n%%EOF\n`, "latin1"));
    };

    it("vale só para PDF de material de estudo", () => {
      expect(internalPdfCheckAllowed("study_material_doutrina", "application/pdf")).toBe(true);
      expect(internalPdfCheckAllowed("study_material_infancia", "application/pdf")).toBe(true);
      expect(internalPdfCheckAllowed("treasury_proof", "application/pdf")).toBe(false);
      expect(internalPdfCheckAllowed("study_material_doutrina", DOCX_MIME)).toBe(false);
    });

    it("aceita PDF simples com links internos e conteúdo compactado", () => {
      const content = deflateSync(Buffer.from("BT /F1 12 Tf (JS JavaScript) Tj ET")).toString("latin1");
      const file = `1 0 obj << /Type /Catalog /Pages 2 0 R /OpenAction [3 0 R /Fit] >> endobj
3 0 obj << /Type /Page /Annots [<< /Subtype /Link /A << /S /GoTo /D [3 0 R /Fit] >> >>] >> endobj
4 0 obj << /Length ${content.length} /Filter /FlateDecode >>stream\n${content}\nendstream endobj`;
      expect(() => verifyPdfStructure(Uint8Array.from(Buffer.from(pdf(file))))).not.toThrow();
      expect(() => verifyPdfStructure(objStm("3 0 << /Type /Page >>"))).not.toThrow();
    });

    it("recusa JavaScript, abrir programa, arquivo embutido e criptografia", () => {
      expect(() => verifyPdfStructure(pdf("1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj"))).toThrow("/JavaScript");
      expect(() => verifyPdfStructure(pdf("1 0 obj << /AA << /O << /S /Launch /F (cmd.exe) >> >> >> endobj"))).toThrow("/Launch");
      expect(() => verifyPdfStructure(pdf("1 0 obj << /Names << /EmbeddedFiles 2 0 R >> >> endobj"))).toThrow("/EmbeddedFiles");
      expect(() => verifyPdfStructure(pdf("1 0 obj << /S /J#61vaScript >> endobj"))).toThrow("/JavaScript");
      expect(() => verifyPdfStructure(pdf("trailer << /Encrypt 9 0 R >>"))).toThrow("/Encrypt");
    });

    it("descompacta o fluxo de objetos e recusa o que estiver escondido nele", () => {
      expect(() => verifyPdfStructure(objStm("3 0 << /S /JavaScript /JS (x) >>"))).toThrow("/JavaScript");
      expect(() => verifyPdfStructure(objStm("3 0 << >>", "/Filter /LZWDecode"))).toThrow("sem compressão conhecida");
    });

    it("recusa arquivo incompleto ou que não é PDF", () => {
      expect(() => verifyPdfStructure(new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj"))).toThrow("incompleto");
      expect(() => verifyPdfStructure(new TextEncoder().encode("<html>%%EOF"))).toThrow("não corresponde");
    });
  });
});
