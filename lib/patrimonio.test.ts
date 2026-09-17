import { describe, expect, it } from "vitest";
import {
  CLEANING_FEE_CENTS, assertPeriod, assetSnapshot, cleaningDateAllowed, cleaningSundays, isSunday,
  normalizePayment, recessEnd, validateCleaningEdit, validateDisposalDecision
} from "@/lib/patrimonio";

const decision = (over: object = {}) => ({ version: 1, decision: "approved" as const, decision_date: "2026-09-10", disposal_date: "2026-09-12", reference: "", notes: "", ...over });

describe("decisão de baixa patrimonial", () => {
  it("exige data entre o memorando e hoje, data da baixa e motivo na recusa", () => {
    expect(() => validateDisposalDecision(decision(), "2026-09-01", "2026-09-17")).not.toThrow();
    expect(() => validateDisposalDecision(decision({ decision_date: "2026-08-30" }), "2026-09-01", "2026-09-17")).toThrow(/data da decisão/);
    expect(() => validateDisposalDecision(decision({ decision_date: "2026-09-18" }), "2026-09-01", "2026-09-17")).toThrow(/data da decisão/);
    expect(() => validateDisposalDecision(decision({ disposal_date: "" }), "2026-09-01", "2026-09-17")).toThrow(/data da baixa/);
    expect(() => validateDisposalDecision(decision({ disposal_date: "2026-09-09" }), "2026-09-01", "2026-09-17")).toThrow(/data da baixa/);
    expect(() => validateDisposalDecision(decision({ decision: "rejected", disposal_date: "" }), "2026-09-01", "2026-09-17")).toThrow(/motivo da recusa/);
    expect(() => validateDisposalDecision(decision({ decision: "rejected", disposal_date: "", notes: "Bem ainda em uso." }), "2026-09-01", "2026-09-17")).not.toThrow();
  });

  it("retrato do bem guarda os campos conferidos na decisão", () => {
    const snapshot = assetSnapshot({ id: "a", tombamento: "PAT-1", description: "Cadeira", department_key: "patrimonio", entry_date: "2020-01-01", disposal_date: null, value_cents: "15000", condition: "Usado", location: "Salão", responsible: "Ana", notes: "não entra" });
    expect(snapshot).toEqual({ id: "a", tombamento: "PAT-1", description: "Cadeira", department_key: "patrimonio", entry_date: "2020-01-01", disposal_date: "", value_cents: "15000", condition: "Usado", location: "Salão", responsible: "Ana" });
  });
});

describe("calendário da escala de limpeza", () => {
  it("recesso até o primeiro domingo de março", () => {
    expect(recessEnd(2026)).toBe("2026-03-01");
    expect(recessEnd(2027)).toBe("2027-03-07");
    expect(isSunday("2026-03-01")).toBe(true);
    expect(isSunday("2026-03-02")).toBe(false);
    expect(cleaningDateAllowed("2026-02-01")).toBe(false);
    expect(cleaningDateAllowed("2026-03-08")).toBe(true);
  });

  it("lista os domingos permitidos e limita o período a 12 meses", () => {
    expect(cleaningSundays("2026-03", "2026-03")).toEqual(["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"]);
    expect(cleaningSundays("2026-01", "2026-02")).toEqual([]);
    expect(() => assertPeriod("2026-03", "2027-03")).toThrow(/até 12 meses/);
    expect(() => assertPeriod("2026-06", "2026-05")).toThrow(/igual ou posterior/);
  });
});

describe("taxa de serviço da limpeza", () => {
  it("só guarda pagamento quando a situação é taxa e exige data e forma no recebido", () => {
    expect(normalizePayment("done", { payment_status: "paid" }, "2026-09-17")).toEqual({ payment_status: null, payment_date: null, payment_method: null, payment_reference: "" });
    expect(normalizePayment("fee", {}, "2026-09-17")).toEqual({ payment_status: "pending", payment_date: null, payment_method: null, payment_reference: "" });
    expect(() => normalizePayment("fee", { payment_status: "paid", payment_date: "2026-09-18", payment_method: "PIX" }, "2026-09-17")).toThrow(/até hoje/);
    expect(() => normalizePayment("fee", { payment_status: "paid", payment_date: "2026-09-10" }, "2026-09-17")).toThrow(/forma de pagamento/);
    expect(normalizePayment("fee", { payment_status: "paid", payment_date: "2026-09-10", payment_method: "PIX", payment_reference: "e2e" }, "2026-09-17"))
      .toEqual({ payment_status: "paid", payment_date: "2026-09-10", payment_method: "PIX", payment_reference: "e2e" });
    expect(CLEANING_FEE_CENTS).toBe(5000);
  });
});

describe("edição de um registro da escala", () => {
  const base = {
    id: "r1", clean_date: "2026-03-08", worker_id: "w1", worker_snapshot: { id: "w1", name: "Ana", departments: [] },
    status: "fee" as const, payment_status: "paid" as const, payment_date: "2026-03-09", payment_method: "PIX",
    payment_reference: "", notes: "", version: 1
  };
  const input = (over: object = {}) => ({
    version: 1, clean_date: "2026-03-08", worker_id: "w1", status: "fee" as const, notes: "", reason: "",
    keep_repeats: false, payment_status: "paid" as const, payment_date: "2026-03-09", payment_method: "PIX" as const, payment_reference: "", ...over
  });
  const paid = { payment_status: "paid" as const, payment_date: "2026-03-09", payment_method: "PIX", payment_reference: "" };

  it("recusa domingo fora do calendário, limpeza futura e cancelamento sem motivo", () => {
    expect(() => validateCleaningEdit(base, input({ clean_date: "2026-03-09" }), paid, "2026-09-17")).toThrow(/somente aos domingos/);
    expect(() => validateCleaningEdit({ ...base, clean_date: "2026-02-01", payment_status: null }, input({ clean_date: "2026-02-01", status: "scheduled" }), { payment_status: null, payment_date: null, payment_method: null, payment_reference: "" }, "2026-09-17")).toThrow(/Recesso/);
    expect(() => validateCleaningEdit({ ...base, status: "scheduled", payment_status: null }, input({ clean_date: "2026-12-06", status: "done" }), paid, "2026-09-17")).toThrow(/futura/);
    expect(() => validateCleaningEdit({ ...base, payment_status: null }, input({ status: "cancelled", payment_status: undefined }), { payment_status: null, payment_date: null, payment_method: null, payment_reference: "" }, "2026-09-17")).toThrow(/motivo do cancelamento/);
  });

  it("recebimento pago trava alteração da escala e correção exige motivo", () => {
    expect(() => validateCleaningEdit(base, input({ status: "done" }), paid, "2026-09-17")).toThrow(/Corrija primeiro o recebimento/);
    expect(() => validateCleaningEdit(base, input({ payment_status: "pending" }), { payment_status: "pending", payment_date: null, payment_method: null, payment_reference: "" }, "2026-09-17")).toThrow(/motivo da correção/);
    expect(() => validateCleaningEdit(base, input({ payment_status: "pending", reason: "Estorno do PIX." }), { payment_status: "pending", payment_date: null, payment_method: null, payment_reference: "" }, "2026-09-17")).not.toThrow();
    expect(() => validateCleaningEdit(base, input(), paid, "2026-09-17")).not.toThrow();
  });

  it("registro histórico em recesso pode ser cancelado ou mantido", () => {
    const legacy = { ...base, clean_date: "2026-01-04", status: "done" as const, payment_status: null };
    const none = { payment_status: null, payment_date: null, payment_method: null, payment_reference: "" };
    expect(() => validateCleaningEdit(legacy, input({ clean_date: "2026-01-04", status: "cancelled", reason: "Erro de digitação." }), none, "2026-09-17")).not.toThrow();
    expect(() => validateCleaningEdit(legacy, input({ clean_date: "2026-01-04", status: "done" }), none, "2026-09-17")).not.toThrow();
  });
});
