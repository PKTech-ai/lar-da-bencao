import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayInSaoPaulo } from "@/lib/home-dashboard";
import { workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";

/** Minha área (visual v215): próximas escalas da pessoa. Módulo puro. */
export function upcoming<T extends { date: string }>(scales: T[], today: string) {
  return scales
    .filter((s) => !s.date || s.date >= today)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .slice(0, 10);
}

/** Situação do mês de contribuição, iguais às frases do visual v215. */
export function contributionStatus(expected: number | null | undefined, paid: number) {
  if (expected === null || expected === undefined) return "Valor previsto não informado";
  if (expected === 0) return paid ? "Recebido" : "Sem valor previsto";
  if (paid >= expected) return "Pago";
  if (paid > 0) return "Parcial";
  return "Pendente";
}

const CLEANING: Record<string, string> = {
  scheduled: "Programada",
  done: "Realizada",
  fee: "Taxa de serviço"
};

export type MyAreaContribution = {
  month: string;
  status: string;
  amount_cents: number;
  expected_cents: number;
  paid_date: string | null;
};

export type MyAreaScale = {
  date: string;
  activity: string;
  role: string;
  place: string;
  status: string;
};

export type MyAreaWorker = {
  name: string;
  departments: string[];
  phone: string;
  status: string;
};

export type MyArea = {
  profile: { name: string; roleLabel: string };
  worker: MyAreaWorker | null;
  contributions: MyAreaContribution[];
  scales: MyAreaScale[];
};

/** Dados da Minha área: só a ficha, as contribuições e as escalas da própria pessoa. */
export async function loadMyArea(actor: Actor): Promise<MyArea> {
  const [role, linked] = await Promise.all([
    query<{ label: string }>("select label from app.roles where key = $1", [actor.role]),
    query<{ worker_id: string | null }>("select worker_id from app.users where id = $1", [actor.id])
  ]);
  const profile = { name: actor.name, roleLabel: role.rows[0]?.label ?? actor.role };
  const workerId = linked.rows[0]?.worker_id;
  if (!workerId) return { profile, worker: null, contributions: [], scales: [] };

  const today = todayInSaoPaulo();
  const [worker, departments, contributions, cleaning, events, doctrine, culto] = await Promise.all([
    query<{ full_name: string; phone: string | null; status: WorkerStatus }>(
      "select full_name, phone, status from app.workers where id = $1",
      [workerId]
    ),
    query<{ label: string }>(
      `select d.label from app.worker_departments wd join app.departments d on d.key = wd.department_key
        where wd.worker_id = $1 order by d.label`,
      [workerId]
    ),
    query<{ reference_month: string; expected_cents: string; paid_cents: string; paid_date: string | null }>(
      `select reference_month, expected_cents::text, paid_cents::text, to_char(paid_date,'YYYY-MM-DD') as paid_date
         from app.treasury_contributions
        where worker_id = $1 and reference_month >= to_char((current_date - interval '12 months'), 'YYYY-MM')
        order by reference_month desc`,
      [workerId]
    ),
    query<{ clean_date: string; status: string }>(
      `select to_char(clean_date,'YYYY-MM-DD') as clean_date, status
         from app.cleaning_roster where worker_id = $1 and status <> 'cancelled' and clean_date >= $2::date
        order by clean_date`,
      [workerId, today]
    ),
    query<{ event_date: string | null; name: string; place: string; status: string }>(
      `select to_char(e.event_date,'YYYY-MM-DD') as event_date, e.name, s.place, e.status
         from app.event_shifts s join app.events e on e.id = s.event_id
        where s.worker_id = $1 and s.archived_at is null and e.status <> 'Cancelado'
          and (e.event_date is null or e.event_date >= $2::date)
        order by e.event_date nulls last`,
      [workerId, today]
    ),
    query<{ work_date: string; role_label: string; department: string }>(
      `select to_char(a.work_date,'YYYY-MM-DD') as work_date, a.role_label, d.label as department
         from app.scale_assignments a
         join app.scale_months m on m.id = a.scale_month_id
         join app.departments d on d.key = m.department_key
        where a.worker_id = $1 and a.work_date >= $2::date
        order by a.work_date`,
      [workerId, today]
    ),
    query<{ culto_date: string; house: string; role: string }>(
      `select to_char(culto_date,'YYYY-MM-DD') as culto_date, house,
              case when requester_id = $1 then 'Anfitrião' when leader_id = $1 then 'Dirigente' else 'Expositor' end as role
         from app.culto_lar_months
        where deleted_at is null and culto_date >= $2::date
          and (requester_id = $1 or leader_id = $1 or speaker_id = $1)
        order by culto_date`,
      [workerId, today]
    )
  ]);

  const row = worker.rows[0];
  const scales: MyAreaScale[] = [
    ...cleaning.rows.map((r) => ({
      date: r.clean_date, activity: "Limpeza da Casa", role: "Escala de limpeza",
      place: "Lar da Bênção", status: CLEANING[r.status] ?? r.status
    })),
    ...events.rows.map((r) => ({
      date: r.event_date ?? "", activity: r.name, role: "Escala de evento",
      place: r.place || "Local a definir", status: r.status || "Programada"
    })),
    ...doctrine.rows.map((r) => ({
      date: r.work_date, activity: r.department, role: r.role_label, place: "", status: "Programada"
    })),
    ...culto.rows.map((r) => ({
      date: r.culto_date, activity: "Culto no Lar", role: r.role,
      place: r.house || "Local a definir", status: "Programada"
    }))
  ];

  return {
    profile,
    worker: row
      ? {
          name: row.full_name,
          departments: departments.rows.map((d) => d.label),
          phone: row.phone || "",
          status: workerStatusLabel[row.status] ?? row.status
        }
      : null,
    contributions: contributions.rows.map((r) => {
      const expected = Number(r.expected_cents);
      const paid = Number(r.paid_cents);
      return {
        month: r.reference_month,
        status: contributionStatus(expected, paid),
        amount_cents: paid,
        expected_cents: expected,
        paid_date: r.paid_date
      };
    }),
    scales: upcoming(scales, today)
  };
}
