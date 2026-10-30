"use client";

import { useState } from "react";
import type { Grafico } from "@/lib/paineis";
import { formatMoney } from "@/lib/resources/types";

/**
 * Gráfico de barras dos painéis: um eixo só, barras finas com ponta arredondada, até 2 séries (azul e laranja,
 * validadas para daltonismo), legenda quando há 2 séries, valor na dica ao passar o dedo/mouse e tabela "Ver números".
 */
const fmt = (format: Grafico["format"], value: number | null) =>
  value === null ? "—" : format === "money" ? formatMoney(value) : format === "percent" ? `${value}%` : value.toLocaleString("pt-BR");

const short = (format: Grafico["format"], value: number) => {
  if (format === "percent") return `${value}%`;
  const reais = format === "money" ? value / 100 : value;
  if (Math.abs(reais) >= 1000) return `${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

export function GraficoBarras({ grafico }: { grafico: Grafico }) {
  const [hover, setHover] = useState<number | null>(null);
  const { labels, series, format } = grafico;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = format === "percent" ? 100 : Math.max(1, ...all);
  const W = 640, H = 200, top = 8, bottom = 0, left = 0, right = 0;
  const plotH = H - top - bottom;
  const slot = (W - left - right) / labels.length;
  const gap = 2;
  const barW = Math.min(28, (slot * 0.62 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const hasData = all.some((v) => v > 0);

  return (
    <figure className="pn-chart">
      <figcaption>
        <strong>{grafico.title}</strong>
        {series.length > 1 ? (
          <span className="pn-legend">{series.map((s, i) => <span key={s.name}><i className={`pn-sw s${i + 1}`} />{s.name}</span>)}</span>
        ) : null}
      </figcaption>
      <div className="pn-plot">
        {hover !== null ? (
          <div className="pn-tip" style={{ left: `${((left + slot * hover + slot / 2) / W) * 100}%` }} role="status">
            <b>{labels[hover]}</b>
            {series.map((s) => <span key={s.name}>{series.length > 1 ? `${s.name}: ` : ""}{fmt(format, s.values[hover])}</span>)}
          </div>
        ) : null}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${grafico.title}. Valores na tabela Ver números.`} preserveAspectRatio="none">
          {[0.5, 1].map((f) => <line key={f} className="pn-grid" x1={left} x2={W - right} y1={y(max * f)} y2={y(max * f)} />)}
          <line className="pn-axis" x1={left} x2={W - right} y1={top + plotH} y2={top + plotH} />
          {labels.map((label, i) => {
            const x0 = left + slot * i + (slot - groupW) / 2;
            return (
              <g key={label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
                <rect className="pn-hit" x={left + slot * i} y={0} width={slot} height={H} />
                {series.map((s, k) => {
                  const v = s.values[i];
                  if (v === null || v <= 0) return null;
                  const h = Math.max(2, top + plotH - y(v));
                  const x = x0 + k * (barW + gap);
                  const r = Math.min(4, barW / 2, h);
                  return <path key={s.name} className={`pn-bar s${k + 1}${hover === i ? " on" : ""}`}
                    d={`M${x},${top + plotH} V${top + plotH - h + r} Q${x},${top + plotH - h} ${x + r},${top + plotH - h} H${x + barW - r} Q${x + barW},${top + plotH - h} ${x + barW},${top + plotH - h + r} V${top + plotH} Z`} />;
                })}
              </g>
            );
          })}
        </svg>
        {hasData ? <span className="pn-max">{short(format, max)}</span> : null}
        <div className="pn-labels" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {labels.map((label, i) => <span key={label + i} className={hover === i ? "on" : undefined}>{label}</span>)}
        </div>
        {!hasData ? <p className="pn-empty">Ainda sem dados neste período.</p> : null}
      </div>
      <details className="pn-table">
        <summary>Ver números</summary>
        <table data-grid="">
          <thead><tr><th>Mês</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
          <tbody>{labels.map((label, i) => <tr key={label + i}><td>{label}</td>{series.map((s) => <td key={s.name}>{fmt(format, s.values[i])}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
