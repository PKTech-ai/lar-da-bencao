import { describe, expect, it } from "vitest";
import { activeTab } from "@/lib/module-tabs";

const tabs = [
  { href: "/sistema/doutrina", label: "Painel" },
  { href: "/sistema/doutrina/escalas", label: "Escala Mensal" },
  { href: "/sistema/doutrina/frequencia", label: "Frequência" }
];

describe("aba ativa", () => {
  it("marca o Painel só na raiz exata", () => {
    expect(activeTab("/sistema/doutrina", tabs)?.label).toBe("Painel");
    expect(activeTab("/sistema/doutrina/", tabs)?.label).toBe("Painel");
  });
  it("marca a aba pelo prefixo, inclusive em subpáginas", () => {
    expect(activeTab("/sistema/doutrina/escalas/imprimir", tabs)?.label).toBe("Escala Mensal");
  });
  it("não marca nada fora do módulo", () => {
    expect(activeTab("/sistema/infancia", tabs)).toBeUndefined();
  });
});
