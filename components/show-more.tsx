"use client";

import { useState, type ReactNode } from "react";

/**
 * Listas longas no celular: mostra os primeiros N e um botão "Mostrar mais". As linhas de fora recebem `data-extra`
 * e só somem na tela do celular (CSS); no notebook e na impressão aparecem todas.
 * `resetKey` (busca e filtros) volta a lista para o começo quando muda.
 */
export const SHOW_MORE_STEP = 20;

export function useShowMore(total: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, limit: SHOW_MORE_STEP });
  const limit = state.key === resetKey ? state.limit : SHOW_MORE_STEP;
  return {
    extra: (index: number) => (index >= limit ? { "data-extra": "" } : {}),
    button: total > limit ? (
      <button type="button" className="button show-more no-print" onClick={() => setState({ key: resetKey, limit: limit + SHOW_MORE_STEP })}>
        Mostrar mais ({Math.min(SHOW_MORE_STEP, total - limit)} de {total - limit} restantes)
      </button>
    ) : null
  };
}

/** Para telas do servidor: corpo de tabela com "Mostrar mais" no celular (as células vêm prontas do servidor). */
export function ShowMoreRows({ rows, empty, columns }: { rows: { key: string; cells: ReactNode[] }[]; empty: string; columns: number }) {
  const more = useShowMore(rows.length, "");
  return (
    <>
      <tbody>
        {rows.map((row, i) => <tr key={row.key} {...more.extra(i)}>{row.cells.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}
        {!rows.length ? <tr><td colSpan={columns}>{empty}</td></tr> : null}
      </tbody>
      {more.button ? <tfoot className="no-print"><tr><td colSpan={columns}>{more.button}</td></tr></tfoot> : null}
    </>
  );
}
