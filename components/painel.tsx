import Link from "next/link";
import { GraficoBarras } from "@/components/grafico-barras";
import type { DepartmentCard, Painel } from "@/lib/paineis";

/** Painel de departamento: 4 números, "Precisa de atenção", gráfico de tendência e 2 ações rápidas. */
export function PainelView({ painel, departamentos }: { painel: Painel; departamentos?: DepartmentCard[] }) {
  return (
    <div className="pn">
      {painel.resumo ? <p className="pn-say">Neste mês entraram <mark className="c3">{painel.resumo.entradas}</mark> e saíram <mark className="c2">{painel.resumo.saidas}</mark>. O saldo do caixa está em <mark className="c1">{painel.resumo.saldo}</mark>.</p> : null}
      <div className="pn-kpis">
        {painel.kpis.map((k) => {
          const body = <><span>{k.label}</span><b className={/\d/.test(String(k.value)) || String(k.value).length <= 14 ? undefined : "long"}>{k.value}</b>{k.hint ? <small>{k.hint}</small> : null}</>;
          return k.href ? <Link key={k.label} href={k.href} className="pn-kpi">{body}</Link> : <div key={k.label} className="pn-kpi">{body}</div>;
        })}
      </div>
      <div className="pn-cols">
        <section className="pn-card pn-attention" aria-label="Precisa de atenção">
          <h3>Precisa de atenção</h3>
          {painel.alertas.length ? (
            <ul>
              {painel.alertas.map((a) => (
                <li key={a.label}>
                  <Link href={a.href}>
                    {a.count !== undefined ? <span className="pn-count">{a.count}</span> : <span className="pn-dot" aria-hidden="true" />}
                    <span className="pn-line">{a.count !== undefined ? a.label.charAt(0).toUpperCase() + a.label.slice(1) : a.label}</span>
                    <span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="pn-ok">Tudo em dia.</p>}
          <div className="pn-actions">
            {painel.acoes.map((a, i) => <Link key={a.href} className={`button${i === 0 ? " primary" : ""}`} href={a.href}>{a.label}</Link>)}
          </div>
        </section>
        {painel.grafico ? <section className="pn-card"><GraficoBarras grafico={painel.grafico} /></section> : null}
      </div>
      {departamentos?.length ? (
        <section className="pn-card">
          <h3>Departamentos</h3>
          <div className="pn-depts">
            {departamentos.map((d) => <Link key={d.label} href={d.href} className="pn-kpi"><span>{d.label}</span><b>{d.value}</b><small>{d.hint}</small></Link>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
