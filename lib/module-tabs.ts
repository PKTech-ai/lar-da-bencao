/** Abas dos módulos: qual aba está ativa para um caminho. Módulo puro. */
export type Tab = { href: string; label: string };

export function activeTab(pathname: string, tabs: readonly Tab[]): Tab | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const root = tabs.reduce((a, b) => (a.href.length <= b.href.length ? a : b), tabs[0]);
  let best: Tab | undefined;
  for (const tab of tabs) {
    const hit = tab === root ? path === tab.href : path === tab.href || path.startsWith(`${tab.href}/`);
    if (hit && (!best || tab.href.length > best.href.length)) best = tab;
  }
  return best;
}

/** Barra de baixo do celular: até 4 lugares; com mais abas, 3 à mostra (sempre com a atual) e o resto em "Mais". */
export function bottomTabs(tabs: readonly Tab[], current: string | undefined) {
  if (tabs.length <= 4) return { visible: [...tabs], more: [] as Tab[] };
  const visible = tabs.slice(0, 3);
  const active = tabs.find((tab) => tab.href === current);
  if (active && !visible.includes(active)) visible[2] = active;
  return { visible, more: tabs.filter((tab) => !visible.includes(tab)) };
}

/** Rótulo curto para a barra de baixo: "Clube de Mães — Livro Caixa" → "Clube de Mães". */
export function shortTabLabel(label: string) {
  const SHORT: Record<string, string> = {
    "Rancho dos Evangelizandos": "Rancho", "Cadastro de Voluntários": "Voluntários", "Mantenedores da Cesta Básica": "Mantenedores",
    "Doadores do Café das Crianças": "Café", "Controle de Atividades": "Atividades", "Planejamento Anual": "Planejamento",
    "Kits de Higiene": "Kits", "Cadastro de Bens": "Bens", "Autorização de Baixa": "Baixas", "Escala de Limpeza": "Limpeza",
    "Ordens de Serviço": "OS", "Relatório Anual": "Relatório", "Agenda de Eventos": "Agenda", "Itens do Evento": "Itens",
    "Avaliação do Evento": "Avaliação", "Escala de Trabalho": "Escala", "Reuniões e Atas": "Reuniões", "Painel da Livraria": "Painel",
    "Plano de Contas": "Contas", "Caixa Mensal": "Caixa", "Extrato Bancário": "Extrato", "Doações recebidas": "Doações",
    "Análises e Pareceres": "Análises", "Aprovação de Trabalhadores": "Aprovações", "Autorizações de Baixa": "Baixas",
    "Palestrantes Externos": "Palestrantes", "Biblioteca de Estudos": "Estudos", "Escala Mensal": "Escala"
  };
  return SHORT[label] ?? label.split(" — ")[0];
}
