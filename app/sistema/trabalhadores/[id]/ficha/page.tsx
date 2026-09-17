import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { requireModulePage } from "@/lib/page-auth";
import { WEEKDAYS, workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";
import { departmentsWith } from "@/lib/workers";

type Ficha = {
  id: string; full_name: string; phone: string | null; email: string | null; birth_date: Date | null; naturality: string | null;
  marital_status: string | null; profession: string | null; address: string | null; filled_date: Date | null;
  volunteer_service: string; accepts_volunteer_law: boolean; image_authorization: boolean; functions: string[];
  available_days: number[]; status: WorkerStatus; approved_at: Date | null; departments: string[]; origin_label: string | null;
};

const br = (value: Date | null) => (value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Não informado");

/** Ficha impressa: somente trabalhador aprovado pela Diretoria (regra do mock). */
export default async function WorkerFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireModulePage("module_workers", { department: "any" });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const result = await query<Ficha>(
    `select w.*, o.label as origin_label,
            coalesce((select array_agg(d.label order by d.label) from app.worker_departments wd join app.departments d on d.key = wd.department_key where wd.worker_id = w.id), '{}') as departments,
            coalesce((select array_agg(wd.department_key) from app.worker_departments wd where wd.worker_id = w.id), '{}') as department_keys
       from app.workers w left join app.departments o on o.key = w.origin_department
      where w.id = $1`,
    [id.data]
  );
  const ficha = result.rows[0] as (Ficha & { department_keys: string[] }) | undefined;
  if (!ficha || (ficha.status !== "active" && ficha.status !== "inactive")) notFound();
  const scope = await departmentsWith(actor, "read");
  if (scope && !ficha.department_keys.some((d) => scope.includes(d))) notFound();
  const decision = await query<{ meeting_date: Date; minute_ref: string; decided_by_name: string }>(
    `select x.meeting_date, x.minute_ref, u.full_name as decided_by_name
       from app.worker_approval_decisions x join app.users u on u.id = x.decided_by
      where x.worker_id = $1 and x.decision = 'approved' order by x.decided_at desc limit 1`,
    [ficha.id]
  );
  await appendAudit(actor, { category: "Impressão", action: "Impressão de ficha de trabalhador", module: "Trabalhadores", entityType: "worker", entityId: ficha.id });
  const approval = decision.rows[0];
  const rows: [string, string][] = [
    ["Nome completo", ficha.full_name], ["Data de nascimento", br(ficha.birth_date)], ["Naturalidade", ficha.naturality ?? "Não informado"],
    ["Estado civil", ficha.marital_status ?? "Não informado"], ["Profissão", ficha.profession ?? "Não informado"],
    ["Endereço", ficha.address ?? "Não informado"], ["Contato", [ficha.phone, ficha.email].filter(Boolean).join(" · ") || "Não informado"],
    ["Preenchimento da ficha", br(ficha.filled_date)], ["Departamento solicitante", ficha.origin_label ?? "Não informado"],
    ["Departamentos vinculados", ficha.departments.join(", ")], ["Funções na Doutrina", ficha.functions.join(", ") || "—"],
    ["Dias disponíveis", ficha.available_days.map((d) => WEEKDAYS[d]).join(", ") || "—"],
    ["Serviço voluntário", ficha.volunteer_service || "Não informado"],
    ["Termo de voluntariado", ficha.accepts_volunteer_law ? "Aceite registrado" : "Aceite não registrado"],
    ["Autorização de imagem", ficha.image_authorization ? "Autorização registrada" : "Autorização não registrada"],
    ["Situação", workerStatusLabel[ficha.status]],
    ["Aprovação da Diretoria", approval ? `${br(approval.meeting_date)}${approval.minute_ref ? ` · ${approval.minute_ref}` : ""} · registro por ${approval.decided_by_name}` : br(ficha.approved_at)]
  ];
  return (
    <>
      <header className="page-heading">
        <div><p className="op-eyebrow">LAR DA BÊNÇÃO</p><h1>Ficha de trabalhador</h1><p>Emitida por {actor.name} em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>
        <div className="row-actions no-print"><Link className="button" href="/sistema/trabalhadores">Voltar</Link><PrintButton /></div>
      </header>
      <section className="card">
        <dl className="details-list">
          {rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </>
  );
}
