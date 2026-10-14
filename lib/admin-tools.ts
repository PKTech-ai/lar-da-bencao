/** Ferramentas do sistema: itens próprios da barra lateral, fora do grupo Diretoria. */
export type ToolCapabilities = {
  audit: boolean;
  attachments: boolean;
  users: boolean;
  moduleAdmin: boolean;
  modules: { href: string; label: string }[];
};

export function adminTools(c: ToolCapabilities) {
  return [
    { href: "/sistema/auditoria", label: "Dedo-duro / Histórico", shown: c.audit },
    { href: "/sistema/anexos", label: "Anexos no banco", shown: c.attachments },
    { href: "/sistema/usuarios", label: "Usuários e permissões", shown: c.users },
    { href: "/sistema/instituicao", label: "Dados da instituição", shown: c.users },
    { href: "/sistema/sugestoes", label: "Sugestões", shown: true },
    { href: "/sistema/modulos", label: "Módulos e ondas", shown: c.moduleAdmin },
    { href: "/sistema/importacao", label: "Importação v215", shown: c.moduleAdmin }
  ].filter((item) => !("shown" in item) || item.shown).map(({ href, label }) => ({ href, label }));
}
