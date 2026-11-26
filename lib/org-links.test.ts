import { describe, expect, it } from "vitest";
import { isDepartmentSeat, ORG_DEPARTMENTS, seatDepartments, seatLabel, seatLevel, unlinkEffect } from "./org-links";

const active = ["diretoria", "secretaria", "tesouraria", "patrimonio", "doutrina", "infancia", "conselho_fiscal"];

describe("Organograma de Vinculação", () => {
  it("Secretaria e Tesouraria ficam na Diretoria, fora do quadro de departamentos", () => {
    expect(ORG_DEPARTMENTS).not.toContain("secretaria");
    expect(ORG_DEPARTMENTS).not.toContain("tesouraria");
    expect(seatDepartments("secretario", null, active)).toEqual(["secretaria"]);
    expect(seatDepartments("tesoureiro", null, active)).toEqual(["tesouraria"]);
  });

  it("Subcoordenador(a) tem acesso total no próprio departamento, como o Coordenador(a)", () => {
    expect(isDepartmentSeat("subcoordenacao")).toBe(true);
    expect(isDepartmentSeat("secretario")).toBe(false);
    expect(seatLabel("subcoordenacao", "Doutrina")).toBe("Subcoordenação — Doutrina");
    expect(seatDepartments("subcoordenacao", "doutrina", active)).toEqual(["doutrina"]);
    expect(seatLevel("subcoordenacao")).toBe("coordenacao");
  });

  it("ao sair da Subcoordenação, perde o acesso só onde nenhum outro vínculo dá", () => {
    const sub = { seat: "subcoordenacao" as const, granted: ["infancia"] };
    expect(unlinkEffect(sub, [])).toEqual({ revoke: ["infancia"], downgrade: [] });
    expect(unlinkEffect(sub, [{ seat: "presidente", granted: ["infancia", "doutrina"] }])).toEqual({ revoke: [], downgrade: [] });
  });
});
