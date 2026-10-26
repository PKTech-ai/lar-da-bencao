import Link from "next/link";
import { query } from "@/lib/db";

type OpenOrder = { id: string; number: string; title: string; location: string; department_label: string; priority: string; status: "open" | "in_progress"; requested_at: string };

const STATUS = { open: "Aberta", in_progress: "Em andamento" } as const;
const day = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Painel do Patrimônio: OS em aberto; cada uma leva direto para a ordem de serviço. */
export async function PatrimonyOpenOrders() {
  const result = await query<OpenOrder>(
    `select o.id, o.number, o.title, o.location, d.label as department_label, o.priority, o.status, o.requested_at
       from app.service_orders o join app.departments d on d.key = o.department_key
      where o.status in ('open', 'in_progress')
      order by (o.priority = 'Urgente') desc, o.requested_at
      limit 50`
  );
  const orders = result.rows;
  const urgent = orders.filter((o) => o.priority === "Urgente").length;
  return (
    <section className="card os-dashboard" aria-label="Ordens de serviço em aberto">
      <div className="toolbar">
        <h2>Ordens de serviço em aberto ({orders.length}){urgent ? <span className="status blocked" style={{ marginLeft: 8 }}>{urgent} urgente(s)</span> : null}</h2>
        <Link className="button" href="/sistema/patrimonio/os">Ver todas</Link>
      </div>
      {orders.length ? (
        <ul className="os-dashboard-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/sistema/patrimonio/os?os=${o.id}`}>
                <span className="os-card-head">
                  <strong>{o.number}</strong>
                  <span>
                    {o.priority === "Urgente" ? <span className="status blocked">Urgente</span> : null}{" "}
                    <span className={`status ${o.status === "in_progress" ? "building" : ""}`}>{STATUS[o.status]}</span>
                  </span>
                </span>
                <span className="os-card-title">{o.title}</span>
                <span className="small muted">{o.location ? `${o.location} · ` : ""}{o.department_label} · aberta em {day(o.requested_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nenhuma ordem de serviço em aberto.</p>}
    </section>
  );
}
