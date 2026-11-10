import { adminTools, type ToolCapabilities } from "@/lib/admin-tools";

export type NavEntry = { href: string; label: string; tone: string };
export type NavGroup = { key: "diretoria" | "departamentos" | "ajustes"; label: string; items: NavEntry[] };

const TONES: Record<string, string> = {
  "/sistema/presidencia": "c3", "/sistema/secretaria": "c6", "/sistema/tesouraria": "c1", "/sistema/conselhofiscal": "c8",
  "/sistema/documentos": "c7", "/sistema/organograma": "c5", "/sistema/doutrina": "c7", "/sistema/infancia": "c5",
  "/sistema/juventude": "c3", "/sistema/assistencia": "c4", "/sistema/patrimonio": "c2", "/sistema/eventos": "c6",
  "/sistema/divulgacao": "c8", "/sistema/juridico": "c1", "/sistema/admissoes": "c6", "/sistema/ordens-servico": "c2",
  "/sistema/sugestoes": "c4", "/visual": "c6", "/sistema/acesso": "c7", "/sistema/usuarios": "c3", "/sistema/auditoria": "c2",
  "/sistema/anexos": "c6", "/sistema/modulos": "c8", "/sistema/instituicao": "c1", "/sistema/importacao": "c5"
};

/** A cor acompanha o módulo em toda parte: menu, Visão Geral e busca. */
export function navTone(href: string) {
  const base = Object.keys(TONES).find((key) => href === key || href.startsWith(`${key}/`));
  return base ? TONES[base] : "c3";
}

const entry = (href: string, label: string): NavEntry => ({ href, label, tone: navTone(href) });

const DIRETORIA = ["/sistema/presidencia", "/sistema/secretaria", "/sistema/tesouraria", "/sistema/conselhofiscal", "/sistema/documentos"];
// Trabalhadores fica dentro da Secretaria (aba própria); a tela /sistema/trabalhadores continua para os atalhos.
const PLACED = new Set(["/sistema/trabalhadores", ...DIRETORIA]);
// Admissões também é aba da Secretaria; quem não vê a Secretaria (acesso só à admissão) continua com o item no menu.
const IN_SECRETARIA = "/sistema/admissoes";
const CONFIG_TOOLS = new Set(["/sistema/auditoria", "/sistema/anexos", "/sistema/usuarios", "/sistema/instituicao", "/sistema/modulos", "/sistema/importacao"]);
const DEPARTMENT_ORDER = [
  "/sistema/doutrina", "/sistema/infancia", "/sistema/juventude", "/sistema/assistencia",
  "/sistema/patrimonio", "/sistema/eventos", "/sistema/divulgacao", "/sistema/juridico"
];
const order = (href: string) => {
  const index = DEPARTMENT_ORDER.indexOf(href);
  return index === -1 ? 99 : index;
};

/** O que cada pessoa vê no menu do alto. Área sem nenhum item não aparece. */
export function navGroups(capabilities: ToolCapabilities): NavGroup[] {
  const byHref = new Map(capabilities.modules.map((mod) => [mod.href, mod]));
  const tools = adminTools(capabilities);
  const diretoria = [
    ...DIRETORIA.flatMap((href) => {
      const mod = byHref.get(href);
      return mod ? [entry(mod.href, mod.label)] : [];
    }),
    entry("/sistema/organograma", "Organograma")
  ];
  const departamentos = capabilities.modules
    .filter((mod) => !PLACED.has(mod.href) && !(mod.href === IN_SECRETARIA && byHref.has("/sistema/secretaria")))
    .sort((a, b) => order(a.href) - order(b.href))
    .map((mod) => entry(mod.href, mod.label));
  const ajustes = [
    ...(capabilities.users ? [entry("/sistema/acesso", "Controle de Acesso")] : []),
    ...tools.filter((tool) => CONFIG_TOOLS.has(tool.href)).map((tool) => entry(tool.href, tool.label))
  ];
  const others = tools.filter((tool) => !CONFIG_TOOLS.has(tool.href)).map((tool) => entry(tool.href, tool.label));
  const groups: NavGroup[] = [
    { key: "diretoria", label: "Diretoria", items: diretoria },
    { key: "departamentos", label: "Departamentos", items: [...departamentos, ...others.filter((tool) => tool.href === "/sistema/ordens-servico")] },
    { key: "ajustes", label: "Ajustes", items: [...ajustes, ...others.filter((tool) => tool.href !== "/sistema/ordens-servico"), entry("/visual", "Demonstração")] }
  ];
  return groups.filter((group) => group.items.length > 0);
}
