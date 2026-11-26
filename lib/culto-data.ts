/**
 * Culto no Lar dos Trabalhadores no banco: a programação do ano (app.culto_lar_months), lida pela tela do Culto,
 * pela Escala Mensal (folha de sábado) e pela impressão. Datas e regras puras em lib/monthly-saturdays.ts e
 * lib/doutrina-extras.ts.
 */
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { cultoEligible, type CultoRole } from "@/lib/doutrina-extras";
import { yearSaturdays, type MonthSaturdays } from "@/lib/monthly-saturdays";

type Db = Pick<PoolClient, "query">;
const pool: Db = { query: ((text: string, values?: unknown[]) => query(text, values)) as Db["query"] };

/** Um mês da programação: datas, trabalhador (nome digitado), dirigente e expositor escolhidos pela Doutrina. */
export type CultoMonth = MonthSaturdays & {
  host_name: string;
  leader_id: string | null;
  speaker_id: string | null;
  leader_name: string;
  speaker_name: string;
  /** Versão da linha (0 = mês ainda sem nada gravado). */
  version: number;
};

type Row = {
  month: number; host_name: string; leader_id: string | null; speaker_id: string | null;
  leader_name: string | null; speaker_name: string | null; deleted_at: string | null; version: number;
};

export async function loadCultoYear(year: number, db: Db = pool): Promise<CultoMonth[]> {
  const rows = await db.query<Row>(
    `select c.month, c.host_name, c.leader_id, c.speaker_id, l.full_name as leader_name, s.full_name as speaker_name, c.deleted_at, c.version
       from app.culto_lar_months c
       left join app.workers l on l.id = c.leader_id
       left join app.workers s on s.id = c.speaker_id
      where c.year = $1`,
    [year]
  );
  const saved = new Map(rows.rows.map((r) => [r.month, r]));
  return yearSaturdays(year).map((m) => {
    const row = saved.get(Number(m.month.slice(5)));
    const live = row && !row.deleted_at ? row : null;
    return {
      ...m,
      host_name: live?.host_name ?? "",
      leader_id: live?.leader_id ?? null,
      speaker_id: live?.speaker_id ?? null,
      leader_name: live?.leader_name ?? "",
      speaker_name: live?.speaker_name ?? "",
      version: row?.version ?? 0
    };
  });
}

export async function loadCultoMonth(ym: string, db: Db = pool): Promise<CultoMonth> {
  const months = await loadCultoYear(Number(ym.slice(0, 4)), db);
  return months.find((m) => m.month === ym)!;
}

export type CultoOption = { id: string; name: string };

/** Trabalhadores ativos da Doutrina que podem dirigir (funções de dirigente) e expor (expositor ou palestrante). */
export async function cultoOptions(db: Db = pool) {
  const rows = await db.query<{ id: string; name: string; functions: string[] }>(
    `select w.id, w.full_name as name, w.functions from app.workers w
       join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina'
      where w.status = 'active' order by w.full_name`
  );
  const pick = (role: CultoRole): CultoOption[] => rows.rows.filter((w) => cultoEligible(role, w.functions)).map(({ id, name }) => ({ id, name }));
  return { leader: pick("leader"), speaker: pick("speaker") };
}
