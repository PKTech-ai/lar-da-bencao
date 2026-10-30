"use client";

import { useId, useState } from "react";

/**
 * Grades por dia (escala, chamada, frequência) no celular: botões com as datas e só a coluna do dia escolhido
 * fica à mostra. No notebook e na impressão a grade continua inteira. As células levam `data-day`.
 */
export type DayOption = { key: string; label: string };

export function pickDefaultDay(days: readonly DayOption[], today: string) {
  const past = days.filter((d) => d.key <= today);
  return (past[past.length - 1] ?? days[0])?.key ?? "";
}

export function useMobileDay(days: readonly DayOption[], today: string) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [chosen, setChosen] = useState<string | null>(null);
  const day = chosen && days.some((d) => d.key === chosen) ? chosen : pickDefaultDay(days, today);
  const scope = `mdc-${id}`;
  const picker = days.length > 1 ? (
    <>
      <style>{`@media screen and (max-width: 720px) { .${scope} [data-day]:not([data-day="${day}"]) { display: none !important; } .${scope} table[data-grid] { min-width: 0 !important; } }`}</style>
      <div className="day-picker mobile-flex no-print" role="group" aria-label="Escolher o dia">
        {days.map((d) => (
          <button key={d.key} type="button" aria-pressed={d.key === day} onClick={() => setChosen(d.key)}>{d.label}</button>
        ))}
      </div>
    </>
  ) : null;
  return { day, scope, picker };
}
