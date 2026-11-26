import { describe, expect, it } from "vitest";
import { cultoHostName } from "@/lib/doutrina-extras";
import { brDate, lastSaturday, penultimateSaturday, programYear, yearSaturdays } from "@/lib/monthly-saturdays";

const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const plus7 = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
};

describe("Culto no Lar (penúltimo sábado) e Caravana do Amor (último sábado)", () => {
  it("de 2026 a 2030 as duas datas são sábados do mesmo mês e nunca coincidem", () => {
    for (let year = 2026; year <= 2030; year += 1) {
      for (const m of yearSaturdays(year)) {
        expect(dow(m.culto), m.month).toBe(6);
        expect(dow(m.caravana), m.month).toBe(6);
        expect(m.culto.slice(0, 7)).toBe(m.month);
        expect(m.caravana.slice(0, 7)).toBe(m.month);
        expect(m.culto).not.toBe(m.caravana);
        expect(plus7(m.culto)).toBe(m.caravana); // o culto é exatamente a semana antes da Caravana
        expect(plus7(m.caravana).slice(0, 7)).not.toBe(m.month); // a Caravana é mesmo o último sábado
      }
    }
  });

  it("2027 conferido no calendário", () => {
    const y = yearSaturdays(2027);
    expect(y).toHaveLength(12);
    expect([y[0].culto, y[0].caravana]).toEqual(["2027-01-23", "2027-01-30"]);
    expect([y[4].culto, y[4].caravana]).toEqual(["2027-05-22", "2027-05-29"]);
    expect([y[6].culto, y[6].caravana]).toEqual(["2027-07-24", "2027-07-31"]);
    expect([y[11].culto, y[11].caravana]).toEqual(["2027-12-18", "2027-12-25"]);
    expect(penultimateSaturday("2027-10")).toBe("2027-10-23");
    expect(lastSaturday("2027-10")).toBe("2027-10-30");
  });

  it("em novembro e dezembro a tela já abre no ano seguinte", () => {
    expect(programYear("2026-11-26")).toBe(2027);
    expect(programYear("2026-12-31")).toBe(2027);
    expect(programYear("2027-01-02")).toBe(2027);
    expect(programYear("2027-10-31")).toBe(2027);
    expect(brDate("2027-01-23")).toBe("23/01/2027");
  });

  it("nome digitado: limpa espaços, vazio libera, curto ou com caractere de controle recusa", () => {
    expect(cultoHostName("  Maria   da  Silva ")).toBe("Maria da Silva");
    expect(cultoHostName("   ")).toBe("");
    expect(cultoHostName("A")).toBeNull();
    expect(cultoHostName("x".repeat(121))).toBeNull();
    expect(cultoHostName(`Ana${String.fromCharCode(7)}`)).toBeNull();
  });
});
