import { describe, expect, it } from "vitest";
import { serviceOrderActionSchema, serviceOrderCreateSchema, validateServiceOrderAction } from "@/lib/ordens-servico";

const executor = { executor: true, requester: false };
const requester = { executor: false, requester: true };
const outsider = { executor: false, requester: false };
const act = (body: object) => serviceOrderActionSchema.parse({ version: 1, ...body });

describe("situação da ordem de serviço", () => {
  it("só o Patrimônio muda a situação, com posição para concluir ou recusar", () => {
    expect(validateServiceOrderAction("open", act({ action: "status", status: "in_progress" }), executor)).toBe("in_progress");
    expect(validateServiceOrderAction("in_progress", act({ action: "status", status: "done", note: "Lâmpada trocada." }), executor)).toBe("done");
    expect(() => validateServiceOrderAction("open", act({ action: "status", status: "in_progress" }), requester)).toThrow(/Somente o Patrimônio/);
    expect(() => validateServiceOrderAction("in_progress", act({ action: "status", status: "done" }), executor)).toThrow(/o que foi feito/);
    expect(() => validateServiceOrderAction("open", act({ action: "status", status: "rejected" }), executor)).toThrow(/motivo da recusa/);
    expect(() => validateServiceOrderAction("in_progress", act({ action: "status", status: "in_progress" }), executor)).toThrow(/já está/);
  });

  it("OS encerrada não recebe mais nada", () => {
    for (const closed of ["done", "rejected", "cancelled"] as const) {
      expect(() => validateServiceOrderAction(closed, act({ action: "note", note: "Ainda pinga." }), executor)).toThrow(/encerrada/);
    }
  });

  it("posição vem do Patrimônio ou do departamento que abriu, sem mudar a situação", () => {
    expect(validateServiceOrderAction("in_progress", act({ action: "note", note: "Peça encomendada." }), executor)).toBe("in_progress");
    expect(validateServiceOrderAction("open", act({ action: "note", note: "Pode ser depois das 18h." }), requester)).toBe("open");
    expect(() => validateServiceOrderAction("open", act({ action: "note", note: "Oi" }), outsider)).toThrow();
    expect(() => act({ action: "note", note: " " })).toThrow();
  });

  it("o departamento cancela só enquanto o Patrimônio não começou", () => {
    expect(validateServiceOrderAction("open", act({ action: "cancel", note: "Já resolvemos." }), requester)).toBe("cancelled");
    expect(() => validateServiceOrderAction("in_progress", act({ action: "cancel", note: "Já resolvemos." }), requester)).toThrow(/já está com o Patrimônio/);
    expect(() => validateServiceOrderAction("open", act({ action: "cancel", note: "Já resolvemos." }), executor)).toThrow(/departamento que abriu/);
  });
});

describe("abertura da ordem de serviço", () => {
  it("exige departamento, tipo, o que fazer e descrição; urgência padrão Normal", () => {
    const ok = serviceOrderCreateSchema.parse({ department_key: "doutrina", kind: "Conserto", title: "Trocar lâmpada", description: "Sala 2 sem luz." });
    expect(ok).toMatchObject({ priority: "Normal", location: "", asset_id: "" });
    expect(() => serviceOrderCreateSchema.parse({ department_key: "doutrina", kind: "Pintura", title: "x", description: "y" })).toThrow();
    expect(() => serviceOrderCreateSchema.parse({ department_key: "doutrina", kind: "Conserto", title: "", description: "y" })).toThrow();
    expect(() => serviceOrderCreateSchema.parse({ department_key: "doutrina", kind: "Conserto", title: "x", description: "y", asset_id: "abc" })).toThrow();
  });
});
