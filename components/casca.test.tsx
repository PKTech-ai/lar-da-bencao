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
  it("a Diretoria lista só Presidência, Secretaria e Tesouraria", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }} capabilities={{
      ...capabilities,
      modules: [
        ...capabilities.modules,
        { href: "/sistema/presidencia", label: "Presidência" },
        { href: "/sistema/secretaria", label: "Secretaria" },
        { href: "/sistema/tesouraria", label: "Tesouraria" },
        { href: "/sistema/conselhofiscal", label: "Conselho Fiscal" }
      ]
    }} />);
    const group = html.slice(html.indexOf("Diretoria"), html.indexOf("Conselho Fiscal"));
    expect(group).toContain("Presidência");
    expect(group).toContain("Secretaria");
    expect(group).toContain("Tesouraria");
    for (const label of ["Trabalhadores", "Admissões", "Dedo-duro / Histórico", "Sugestões"]) {
      expect(group).not.toContain(label);
    }
    const after = html.slice(html.indexOf("Dpto de Doutrina"));
    // Trabalhadores e Admissões são abas da Secretaria: não aparecem soltos no menu.
    expect(html).not.toContain('data-nav-label="Trabalhadores"');
    expect(html).not.toContain('data-nav-label="Admissões"');
    expect(after.indexOf("Dedo-duro / Histórico")).toBeGreaterThan(0);
    expect(after.indexOf("Sair deste aparelho")).toBeGreaterThan(after.indexOf("Importação v215"));
  });
  it("sem a Secretaria, quem tem acesso à admissão continua vendo Admissões no menu", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "coordenador", email: "a@x" }} capabilities={capabilities} />);
    expect(html).toContain('data-nav-label="Admissões"');
  });
  it("o grupo Diretoria nasce aberto, como no visual", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    const html = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }}
      capabilities={{ ...capabilities, modules: [...capabilities.modules, { href: "/sistema/presidencia", label: "Presidência" }] }} />);
    expect(html).toContain("Demonstração");
    expect(html).toContain("Recolher");
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
  it("sair e o tema ficam no fim da barra lateral, fora do topo", async () => {
    const { SystemBar } = await import("@/components/system-bar");
    const { Sidebar } = await import("@/components/sidebar");
    const bar = renderToStaticMarkup(<SystemBar actor={{ name: "Ana", role: "administrador" }} roleLabel="Administrador do Sistema" capabilities={capabilities} />);
    const side = renderToStaticMarkup(<Sidebar actor={{ name: "Ana", role: "administrador", email: "a@x" }} capabilities={capabilities} />);
    expect(bar).not.toContain("Opções do sistema");
    expect(bar).not.toContain("Sair deste aparelho");
    expect(bar).not.toContain("Tema escuro");
    const session = side.slice(side.indexOf("sidebar-session"));
    expect(session).toContain("Sair deste aparelho");
    expect(session).toContain("Sair de todos os aparelhos");
    expect(session).toContain("Tema escuro");
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
