import { query } from "@/lib/db";
import { classSundays, groupNames, type EducationDepartment } from "@/lib/education";

type Row = { date: string; group: string; theme: string; responsible: string; objective: string; reference: string; resources: string; status: string };

/** Linhas do cronograma: uma por turma em cada domingo com aula; evangelizadores da turma como padrão. */
export async function scheduleRows(department: EducationDepartment, from: string, to: string, groups: string[] | null) {
  const [saved, links] = await Promise.all([
    query<Row>(
      `select to_char(class_date, 'YYYY-MM-DD') as date, class_group as group, theme, responsible, objective, reference, resources, status
         from app.education_schedule where department_key = $1 and class_date between $2::date and $3::date`,
      [department, from, to]
    ),
    query<{ class_group: string; names: string }>(
      `select g.class_group, string_agg(w.full_name, ' / ' order by g.position) as names
         from app.education_group_evangelizers g join app.workers w on w.id = g.worker_id
        where g.department_key = $1 group by g.class_group`,
      [department]
    )
  ]);
  const byKey = new Map(saved.rows.map((r) => [`${r.date}|${r.group}`, r]));
  const defaults = new Map(links.rows.map((l) => [l.class_group, l.names]));
  const months: string[] = [];
  for (let d = new Date(`${from.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 7));
  return months.flatMap((ym) => classSundays(ym)).flatMap((date) => groupNames(department)
    .filter((group) => !groups || groups.includes(group))
    .map((group) => {
      const row = byKey.get(`${date}|${group}`);
      return {
        date, group,
        theme: row?.theme ?? "", responsible: row?.responsible || defaults.get(group) || "",
        objective: row?.objective ?? "", reference: row?.reference ?? "", resources: row?.resources ?? "",
        status: row?.status ?? "Planejado", saved: Boolean(row)
      };
    }));
}

