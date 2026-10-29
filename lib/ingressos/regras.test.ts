import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET, accessState, addDays, chargeMessage, codeFromBytes, crc16, dueLabel, formatBRL, formatCnpj, formatWhatsapp,
  inHandsCents, inviteMessage, isValidCnpj, manausDateTime, normalizeBuyerName, normalizeTypedCode, normalizeWhatsapp, parseBRL,
  paymentStatus, pixKeyError, pixPayload, reminderMessage, ticketTokenFromQr, ticketsMessage, todayManaus, waLink, weekday,
  type EventForMessage
} from "@/lib/ingressos/regras";

const EVENT: EventForMessage = {
  name: "Feijoada Solidária", kind: "feijoada", event_date: "2026-11-15", event_time: "12:00",
  purpose: "brinquedos das crianças no fim de ano", organizer_name: "Lar da Bênção", pix_key_type: "cnpj", pix_key: "11.222.333/0001-81"
};

describe("dinheiro em centavos", () => {
  it("formata em reais", () => {
    expect(formatBRL(3000)).toBe("R$ 30,00");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });
  it("lê o valor digitado", () => {
    expect(parseBRL("30")).toBe(3000);
    expect(parseBRL("30,5")).toBe(3050);
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,234")).toBeNull();
  });
});

describe("situação do pagamento (RN-03)", () => {
  const today = "2026-11-10";
  it("pago, parcial, a pagar e vencido", () => {
    expect(paymentStatus({ totalCents: 6000, paidCents: 6000, dueDate: null, today })).toBe("pago");
    expect(paymentStatus({ totalCents: 9000, paidCents: 3000, dueDate: "2026-12-10", today })).toBe("parcial");
    expect(paymentStatus({ totalCents: 9000, paidCents: 0, dueDate: "2026-12-10", today })).toBe("a_pagar");
    expect(paymentStatus({ totalCents: 9000, paidCents: 3000, dueDate: "2026-11-09", today })).toBe("vencido");
    expect(paymentStatus({ totalCents: 9000, paidCents: 9000, dueDate: "2026-11-09", today })).toBe("pago");
  });
  it("vencimento por extenso", () => {
    expect(dueLabel("2026-11-09", today)).toBe("vencido há 1 dia");
    expect(dueLabel("2026-11-07", today)).toBe("vencido há 3 dias");
    expect(dueLabel("2026-11-10", today)).toBe("vence hoje");
    expect(dueLabel("2026-11-28", today)).toBe("vence 28/11");
  });
  it("dinheiro em mãos nunca negativo", () => {
    expect(inHandsCents(6000, 2000)).toBe(4000);
    expect(inHandsCents(2000, 6000)).toBe(0);
  });
});

describe("datas em Manaus (RN-09)", () => {
  it("hoje no fuso de Manaus (UTC-4)", () => {
    expect(todayManaus(new Date("2026-11-16T03:30:00Z"))).toBe("2026-11-15");
    expect(todayManaus(new Date("2026-11-16T04:30:00Z"))).toBe("2026-11-16");
  });
  it("soma dias e dia da semana", () => {
    expect(addDays("2026-10-29", 30)).toBe("2026-11-28");
    expect(addDays("2026-10-29", 90)).toBe("2027-01-27");
    expect(weekday("2026-11-15")).toBe("domingo");
  });
  it("hora local da entrega", () => {
    expect(manausDateTime("2026-11-15T16:14:00Z")).toMatchObject({ date: "15/11", time: "12:14" });
  });
});

describe("WhatsApp e nome do comprador", () => {
  it("aceita celular com 9 dígitos e fixo que não começa por 9", () => {
    expect(normalizeWhatsapp("(92) 99123-4567")).toBe("5592991234567");
    expect(normalizeWhatsapp("5592991234567")).toBe("5592991234567");
    expect(normalizeWhatsapp("92 3234-5678")).toBe("559232345678");
    expect(normalizeWhatsapp("92 9123-4567")).toBeNull();
    expect(normalizeWhatsapp("92 89123-4567")).toBeNull();
    expect(normalizeWhatsapp("9912345")).toBeNull();
    expect(formatWhatsapp("5592991234567")).toBe("(92) 99123-4567");
  });
  it("pede nome e sobrenome", () => {
    expect(normalizeBuyerName("rosa")).toBeNull();
    expect(normalizeBuyerName("  ROSA   LIMA ")).toBe("Rosa Lima");
    expect(normalizeBuyerName("dona rosa")).toBe("Dona Rosa");
    expect(normalizeBuyerName("maria da silva")).toBe("Maria da Silva");
  });
});

describe("CNPJ (RF-01)", () => {
  it("confere os dígitos", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("códigos dos tickets (RF-05)", () => {
  it("usa só o alfabeto sem caracteres que confundem", () => {
    for (const forbidden of "BILOSZ01258") expect(CODE_ALPHABET).not.toContain(forbidden);
    expect(CODE_ALPHABET).toHaveLength(25);
  });
  it("gera 4 caracteres e descarta bytes com viés", () => {
    expect(codeFromBytes(new Uint8Array([0, 1, 2, 3]))).toBe("ACDE");
    expect(codeFromBytes(new Uint8Array([250, 255, 0, 24, 25, 49]))).toBe("A9A9");
    expect(codeFromBytes(new Uint8Array([251, 252]))).toBeNull();
  });
  it("normaliza o código digitado e o QR", () => {
    expect(normalizeTypedCode(" k7q-3 ")).toBe("K7Q3");
    expect(ticketTokenFromQr("TKT:abcDEF_123-xyz")).toBe("abcDEF_123-xyz");
    expect(ticketTokenFromQr("qualquer coisa")).toBeNull();
  });
});

describe("acesso do trabalhador (RF-12)", () => {
  const today = "2026-11-10";
  it("situação exibida na lista de metas", () => {
    expect(accessState(null, today)).toBe("nao_enviado");
    expect(accessState({ valid_until: "2027-01-01", first_access_at: null, revoked_at: null, revoke_reason: null }, today)).toBe("enviado");
    expect(accessState({ valid_until: "2027-01-01", first_access_at: "2026-11-01", revoked_at: null, revoke_reason: null }, today)).toBe("ativo");
    expect(accessState({ valid_until: "2026-11-10", first_access_at: "2026-11-01", revoked_at: null, revoke_reason: null }, today)).toBe("ativo");
    expect(accessState({ valid_until: "2026-11-09", first_access_at: "2026-11-01", revoked_at: null, revoke_reason: null }, today)).toBe("expirado");
    expect(accessState({ valid_until: "2027-01-01", first_access_at: null, revoked_at: "2026-11-02", revoke_reason: "bloqueado" }, today)).toBe("bloqueado");
  });
});

describe("mensagens do WhatsApp (seção 10)", () => {
  it("envio de tickets pagos, com códigos e link", () => {
    const text = ticketsMessage({ event: EVENT, buyerName: "Rosa Lima", codes: ["K7Q3", "4MXA"], link: "https://x.test/i/abc", balanceCents: 0, dueDate: null });
    expect(text).toBe([
      "Olá, Rosa! Seus 2 ingressos para a *Feijoada Solidária* do Lar da Bênção (domingo, 15/11, às 12:00):",
      "",
      "Ticket 1: *K7Q3*",
      "Ticket 2: *4MXA*",
      "",
      "Veja os ingressos com QR code: https://x.test/i/abc",
      "",
      "É só mostrar na hora de retirar a feijoada.",
      "Renda revertida para: brinquedos das crianças no fim de ano."
    ].join("\n"));
  });
  it("um ingresso e saldo em aberto", () => {
    const text = ticketsMessage({ event: { ...EVENT, kind: "cafe_da_manha", event_time: "" }, buyerName: "Rosa Lima", codes: ["K7Q3"], link: "L", balanceCents: 3000, dueDate: "2026-11-28" });
    expect(text).toContain("Seu ingresso para a *Feijoada Solidária* do Lar da Bênção (domingo, 15/11):");
    expect(text).toContain("retirar o café da manhã.");
    expect(text).toContain("Valor em aberto: R$ 30,00, com vencimento em 28/11/2026.");
    expect(text).toContain("Pix (CNPJ): 11.222.333/0001-81");
  });
  it("cobrança, convite e lembrete", () => {
    expect(chargeMessage({ event: EVENT, buyerName: "Maria Souza", quantity: 3, balanceCents: 6000, dueDate: "2026-11-28" }))
      .toContain("valor de R$ 60,00 referente aos 3 tickets da Feijoada Solidária, com vencimento em 28/11/2026.");
    expect(inviteMessage({ sellerName: "João Pereira", eventName: "Feijoada Solidária", organizerName: "Lar da Bênção", goal: 10, link: "L", validUntil: "2027-01-27" }))
      .toContain("Sua meta: *10 ingressos*.");
    expect(reminderMessage({ sellerName: "João Pereira", eventName: "Feijoada Solidária", sold: 3, goal: 10 })).toContain("Você está com 3 de 10.");
  });
  it("link wa.me com o texto codificado", () => {
    expect(waLink("5592991234567", "Olá, *Rosa*!\nTicket")).toBe("https://wa.me/5592991234567?text=Ol%C3%A1%2C%20*Rosa*!%0ATicket");
  });
});

describe("QR Pix estático (seção 11)", () => {
  it("CRC16-CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("monta o BR Code sem valor e com CRC que confere", () => {
    const payload = pixPayload({ keyType: "cnpj", key: "11.222.333/0001-81", receiver: "Lar da Bênção", city: "Manaus" });
    expect(payload).toBe(
      "00020126360014BR.GOV.BCB.PIX0114112223330001815204000053039865802BR5913LAR DA BENCAO6006MANAUS62070503***6304" + payload.slice(-4)
    );
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });
  it("chave de telefone com +55 e e-mail em minúsculas", () => {
    expect(pixPayload({ keyType: "telefone", key: "(92) 99999-0000", receiver: "X", city: "Manaus" })).toContain("0114+5592999990000");
    expect(pixPayload({ keyType: "email", key: "Casa@Lar.ORG", receiver: "X", city: "Manaus" })).toContain("0112casa@lar.org");
    expect(pixKeyError("cnpj", "11.222.333/0001-82")).not.toBeNull();
    expect(pixKeyError("email", "casa@lar.org")).toBeNull();
  });
});
