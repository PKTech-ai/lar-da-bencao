import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { navGroups, navTone } from "@/lib/nav-groups";

vi.mock("next/navigation", () => ({ usePathname: () => "/sistema", useRouter: () => ({ replace: () => undefined, refresh: () => undefined }) }));

const capabilities = {
  audit: true, attachments: true, users: true, moduleAdmin: true,
  modules: [
    { href: "/sistema/doutrina", label: "Doutrina" },
    { href: "/sistema/trabalhadores", label: "Trabalhadores" },
    { href: "/sistema/admissoes", label: "Admissões" }
  ]
};
const labels = (caps: Parameters<typeof navGroups>[0], key: string) => navGroups(caps).find((group) => group.key === key)?.items.map((item) => item.label) ?? [];
const all = (caps: Parameters<typeof navGroups>[0]) => navGroups(caps).flatMap((group) => group.items.map((item) => item.label));

describe("menu do alto", () => {
  it("a Diretoria reúne a gestão da Casa, na ordem certa", () => {
    const diretoria = labels({
      ...capabilities,
      modules: [
        ...capabilities.modules,
        { href: "/sistema/tesouraria", label: "Tesouraria" },
        { href: "/sistema/secretaria", label: "Secretaria" },
        { href: "/sistema/presidencia", label: "Presidência" },
        { href: "/sistema/conselhofiscal", label: "Conselho Fiscal" },
        { href: "/sistema/documentos", label: "Estatuto e Regimento" }
      ]
    }, "diretoria");
    expect(diretoria).toEqual(["Presidência", "Secretaria", "Tesouraria", "Conselho Fiscal", "Estatuto e Regimento", "Organograma"]);
  });
  it("Trabalhadores nunca aparece solto; Admissões some quando a Secretaria está no menu", () => {
    const withSecretaria = { ...capabilities, modules: [...capabilities.modules, { href: "/sistema/secretaria", label: "Secretaria" }] };
    expect(all(withSecretaria)).not.toContain("Trabalhadores");
    expect(all(withSecretaria)).not.toContain("Admissões");
  });
  it("sem a Secretaria, quem tem acesso à admissão continua vendo Admissões", () => {
    expect(labels(capabilities, "departamentos")).toContain("Admissões");
  });
  it("departamentos seguem a ordem da Casa, e o atalho da chamada entra para quem só faz chamada", () => {
    const items = labels({
      ...capabilities,
      modules: [
        { href: "/sistema/juridico", label: "Jurídico" },
        { href: "/sistema/doutrina", label: "Doutrina" },
        { href: "/sistema/infancia/frequencia", label: "Chamada · Infância" }
      ]
    }, "departamentos");
    expect(items).toEqual(["Doutrina", "Jurídico", "Chamada · Infância"]);
  });
  it("as ferramentas de administração ficam em Ajustes, para quem pode", () => {
    const ajustes = labels(capabilities, "ajustes");
    for (const label of ["Controle de Acesso", "Dedo-duro / Histórico", "Anexos no banco", "Usuários e permissões", "Módulos e ondas", "Importação v215", "Sugestões", "Demonstração"]) {
      expect(ajustes).toContain(label);
    }
  });
  it("Ordens de Serviço fica com os departamentos, só para quem tem acesso", () => {
    expect(labels({ ...capabilities, serviceOrders: true }, "departamentos")).toContain("Ordens de Serviço");
    expect(all(capabilities)).not.toContain("Ordens de Serviço");
  });
  it("quem não administra vê só o que pode abrir, e área vazia não aparece", () => {
    const caps = { audit: false, attachments: false, users: false, moduleAdmin: false, modules: [] };
    expect(navGroups(caps).map((group) => group.key)).toEqual(["diretoria", "ajustes"]);
    expect(all(caps)).toEqual(["Organograma", "Sugestões", "Demonstração"]);
  });
  it("a cor acompanha o módulo, inclusive nos atalhos internos", () => {
    expect(navTone("/sistema/infancia/frequencia")).toBe(navTone("/sistema/infancia"));
  });
});

describe("topo do sistema", () => {
  it("mostra a marca, as áreas e as ferramentas, sem menu lateral", async () => {
    const { TopNav } = await import("@/components/top-nav");
    const html = renderToStaticMarkup(<TopNav actor={{ name: "Administrador do Sistema", role: "administrador", email: "a@x" }} roleLabel="Administrador" capabilities={capabilities} />);
    expect(html).toContain("Lar da Bênção");
    for (const label of ["Início", "Diretoria", "Departamentos", "Ajustes"]) expect(html).toContain(label);
    expect(html).toContain('aria-label="Encontrar módulo"');
    expect(html).toContain(">AS<");
    expect(html).not.toContain("Recolher");
  });
  it("a Início marca a tela atual e mantém o gancho da barra de carregamento", async () => {
    const { TopNav } = await import("@/components/top-nav");
    const html = renderToStaticMarkup(<TopNav actor={{ name: "Ana", role: "administrador", email: "a@x" }} roleLabel="Administrador" capabilities={capabilities} />);
    expect(html).toMatch(/class="nav-link tn-tab"[^>]*data-current="true"/);
  });
});
