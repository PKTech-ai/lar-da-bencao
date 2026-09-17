import { query } from "@/lib/db";
import { EDUCATION_LABEL, GROUPS, firstSundayOfMarch, type EducationDepartment } from "@/lib/education";
import { activeForYear } from "@/lib/education-data";
import { scheduleRows } from "@/lib/education-schedule";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Relatório anual consolidado do Postgres: matrículas por turma, frequência mensal, aulas e atividades planejadas × realizadas. */
export async function AnnualReport({ department, year, groups }: { department: EducationDepartment; year: number; groups: string[] | null }) {
  const students = (await activeForYear(department, year)).filter((s) => !groups || groups.includes(s.current_group));
  const ids = students.map((s) => s.id);
  const [attendance, plan, lessons] = await Promise.all([
    query<{ month: number; present: number; absent: number }>(
      `select extract(month from class_date)::int as month,
              count(*) filter (where mark = 'P')::int as present, count(*) filter (where mark = 'F')::int as absent
         from app.evangelizando_attendance where evangelizando_id = any($1::uuid[]) and extract(year from class_date) = $2
        group by 1 order by 1`,
      [ids, year]
    ),
    query<{ kind: string; status: string; total: number }>(
      `select i.kind, i.status, count(*)::int as total from app.education_plan_items i
         join app.education_plans p on p.id = i.plan_id where p.department_key = $1 and p.year = $2 group by 1, 2`,
      [department, year]
    ),
    scheduleRows(department, `${year}-03-01`, `${year}-12-31`, groups)
  ]);
  const byStatus = (kind: string, status?: string) => plan.rows.filter((r) => r.kind === kind && (!status || r.status === status)).reduce((s, r) => s + r.total, 0);
  const totalP = attendance.rows.reduce((s, r) => s + r.present, 0);
  const totalF = attendance.rows.reduce((s, r) => s + r.absent, 0);
  const label = department === "infancia" ? "Turma" : "Grupo";
  return (
    <section className="card">
      <div className="sheet-title" style={{ textAlign: "center", fontWeight: 800 }}>CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
      <h2 style={{ textAlign: "center" }}>Relatório Anual {year} — Departamento da {EDUCATION_LABEL[department]}</h2>
      <p className="small">Atividades aos domingos a partir de {firstSundayOfMarch(year).split("-").reverse().join("/")} (recesso em janeiro e fevereiro).</p>
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Matrículas vigentes no ano</span><b>{students.length}</b></article>
        <article className="card kpi"><span className="small muted">Frequência geral</span><b>{totalP + totalF ? `${Math.round((totalP / (totalP + totalF)) * 100)}%` : "—"}</b></article>
        <article className="card kpi"><span className="small muted">Aulas realizadas / previstas</span><b>{lessons.filter((l) => l.status === "Realizado").length} / {lessons.length}</b></article>
        <article className="card kpi"><span className="small muted">Atividades especiais realizadas</span><b>{byStatus("special", "Realizado")} / {byStatus("special")}</b></article>
        <article className="card kpi"><span className="small muted">Ações de organização concluídas</span><b>{byStatus("management", "Realizado")} / {byStatus("management")}</b></article>
      </div>
      <h3>Matrículas por {label.toLowerCase()}</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>{label}</th><th>Faixa etária</th><th>Evangelizandos</th></tr></thead>
        <tbody>{GROUPS[department].filter((g) => !groups || groups.includes(g.name)).map((g) => (
          <tr key={g.name}><td>{g.name}</td><td>{g.ages}</td><td>{students.filter((s) => s.current_group === g.name).length}</td></tr>
        ))}</tbody>
      </table></div>
      <h3>Frequência mensal</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Mês</th><th>Presenças</th><th>Faltas</th><th>Frequência</th></tr></thead>
        <tbody>{attendance.rows.map((r) => (
          <tr key={r.month}><td>{MONTHS[r.month - 1]}</td><td>{r.present}</td><td>{r.absent}</td><td>{r.present + r.absent ? `${Math.round((r.present / (r.present + r.absent)) * 100)}%` : "—"}</td></tr>
        ))}{!attendance.rowCount ? <tr><td colSpan={4}>Nenhuma chamada registrada no ano.</td></tr> : null}</tbody>
      </table></div>
      <p className="small muted">Emitido a partir dos registros do sistema (Postgres). Presença e falta consideram apenas chamadas registradas.</p>
    </section>
  );
}
