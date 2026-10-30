"use client";

import { useEffect } from "react";

/**
 * Celular: as tabelas do sistema viram cartões (CSS em globals.css, `table[data-cards]`). Aqui só marcamos cada
 * célula com o título da coluna (`data-label`). Tabelas que são grades de edição (escala, chamada, matriz de acesso,
 * relatórios por mês) levam `data-grid` e continuam como tabela. Só escreve atributos `data-*`; não mexe na árvore.
 */
export function labelTables(root: ParentNode) {
  for (const table of root.querySelectorAll<HTMLTableElement>("table")) {
    if (table.hasAttribute("data-grid")) continue;
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!headRow || headRow.cells.length < 2) continue;
    const heads: string[] = [];
    for (const cell of headRow.cells) for (let i = 0; i < (cell.colSpan || 1); i++) heads.push(cell.textContent?.trim() ?? "");
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    // Grade de botões (chamada com um botão por dia): fica como tabela.
    if (rows.some((row) => row.querySelectorAll("button").length > 4)) continue;
    if (!table.hasAttribute("data-cards")) table.setAttribute("data-cards", "");
    for (const row of rows) {
      let column = 0;
      for (const cell of row.cells) {
        const label = cell.colSpan > 1 ? "" : heads[column] ?? "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        column += cell.colSpan || 1;
      }
    }
  }
}

export function ResponsiveTables() {
  useEffect(() => {
    const root = document.querySelector(".app-main") ?? document.body;
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => labelTables(root)); };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
