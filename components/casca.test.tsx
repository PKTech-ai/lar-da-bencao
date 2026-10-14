import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/sistema", useRouter: () => ({ replace: () => undefined, refresh: () => undefined }) }));

const capabilities = {
  audit: true, attachments: true, users: true, moduleAdmin: true,
  modules: [
    { href: "/sistema/doutrina", label: "Doutrina" },
    { href: "/sistema/trabalhadores", label: "Trabalhadores" },
    { href: "/sistema/admissoes", label: "Admissões" }
  ]
};

describe("menu lateral como no visual", () => {
  it("reúne as opções do sistema dentro do grupo Diretoria", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }} capabilities={capabilities} />);
    const group = html.slice(html.indexOf("Diretoria"), html.indexOf("Dpto de Doutrina"));
    for (const label of ["Trabalhadores", "Admissões", "Dedo-duro / Histórico", "Anexos no banco", "Usuários e permissões", "Dados da instituição", "Sugestões", "Módulos e ondas", "Importação v215"]) {
      expect(group).toContain(label);
    }
  });
  it("o grupo Diretoria nasce aberto, como no visual", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }}
      capabilities={{ ...capabilities, modules: [...capabilities.modules, { href: "/sistema/presidencia", label: "Presidência" }] }} />);
    expect(html).toContain('<details class="nav-group" open="">');
  });
  it("subtítulo da marca igual ao visual", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }} capabilities={capabilities} />);
    expect(html).toContain("Sistema Integrado — Demonstração Funcional com Dados Fictícios");
  });
});

describe("topo como no visual", () => {
  it("o chip mostra só o nome e, para quem administra, abre o Controle de Acesso", async () => {
    const { SystemBar } = await import("@/components/system-bar");
    const html = renderToStaticMarkup(<SystemBar actor={{ name: "Administrador do Sistema", role: "administrador" }} roleLabel="Administrador do Sistema" capabilities={capabilities} />);
    expect(html).toMatch(/<a[^>]*href="\/sistema\/acesso"[^>]*class="session-chip"|<a[^>]*class="session-chip"[^>]*href="\/sistema\/acesso"/);
    expect(html).toContain(">AS<");
    expect(html).not.toContain("<small>");
  });
  it("Opções do sistema fica só com sair e o tema", async () => {
    const { SystemBar } = await import("@/components/system-bar");
    const html = renderToStaticMarkup(<SystemBar actor={{ name: "Ana", role: "administrador" }} roleLabel="Administrador do Sistema" capabilities={capabilities} />);
    const menu = html.slice(html.indexOf("system-menu"));
    expect(menu).toContain("Sair deste aparelho");
    expect(menu).toContain("Tema escuro");
    for (const label of ["Trabalhadores", "Dedo-duro", "Usuários e permissões", "Sugestões"]) {
      expect(menu).not.toContain(label);
    }
  });
  it("quem não administra vê só o que pode abrir e o chip leva à Minha área", async () => {
    const { SystemBar } = await import("@/components/system-bar");
    const { Sidebar } = await import("@/components/sidebar");
    const caps = { audit: false, attachments: false, users: false, moduleAdmin: false, modules: [] };
    const bar = renderToStaticMarkup(<SystemBar actor={{ name: "Bia", role: "trabalhador" }} roleLabel="Trabalhador" capabilities={caps} />);
    const side = renderToStaticMarkup(<Sidebar actor={{ name: "Bia", role: "trabalhador", email: "b@x" }} capabilities={caps} />);
    expect(bar).toMatch(/href="\/sistema\/conta"[^>]*class="session-chip"|class="session-chip"[^>]*href="\/sistema\/conta"/);
    expect(side).not.toContain("Dedo-duro");
    expect(side).toContain("Sugestões");
  });
});
