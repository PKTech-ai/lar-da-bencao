import { describe, expect, it } from "vitest";
import { MODULE_PAGES, SECTOR_ROLE_RESOURCE } from "@/lib/module-pages";
import { moduleCatalog } from "@/lib/modules";

describe("modules catalog", () => {
  it("expõe módulos da onda 1 com rotas e flags", () => {
    expect(moduleCatalog.some((m) => m.key === "doutrina")).toBe(true);
    expect(moduleCatalog.every((m) => m.href.startsWith("/sistema"))).toBe(true);
  });
});

describe("abas na ordem do visual", () => {
  it("todo módulo de departamento tem o Painel na raiz", () => {
    for (const slug of ["patrimonio", "eventos", "assistencia", "secretaria", "tesouraria", "conselhofiscal", "juridico", "presidencia"]) {
      const painel = MODULE_PAGES.find((p) => p.slug === slug)!.sections.find((s) => s.slug === "")!;
      expect(painel.label).toBe("Painel");
      expect(["painel", "presidencia-painel"]).toContain(painel.panel);
    }
  });
  it("a Secretaria mostra Reuniões e Atas antes do Painel, como no visual", () => {
    const sec = MODULE_PAGES.find((p) => p.slug === "secretaria")!;
    expect(sec.sections.slice(0, 2).map((s) => s.label)).toEqual(["Reuniões e Atas", "Painel"]);
  });
  it("Painel não tem acesso de setor, então perfil de setor não o vê", () => {
    const sectorResources = new Set(Object.values(SECTOR_ROLE_RESOURCE));
    const painel = MODULE_PAGES.find((p) => p.slug === "assistencia")!.sections.find((s) => s.slug === "")!;
    expect(sectorResources.has(painel.access?.resource ?? "")).toBe(false);
  });
  it("as abas antigas da raiz ganham endereço próprio", () => {
    const slugs = (s: string) => MODULE_PAGES.find((p) => p.slug === s)!.sections.map((x) => x.slug);
    expect(slugs("tesouraria")).toContain("caixa");
    expect(slugs("eventos")).toContain("agenda");
    expect(slugs("secretaria")).toContain("reunioes");
    expect(slugs("patrimonio")).toContain("bens");
    expect(slugs("conselhofiscal")).toContain("analises");
  });
});
