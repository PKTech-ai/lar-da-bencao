import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { canEditDoutrina, requireDoutrina } from "@/lib/doutrina-data";
import { cultoEligible, cultoStatus, penultimateSaturday, type CultoRole } from "@/lib/doutrina-extras";
import { isValidMonth } from "@/lib/doutrina-scale";

const monthSchema = z.string().refine(isValidMonth, "Mês inválido.");
const putSchema = z.object({
  month: monthSchema,
  requester_id: z.string().uuid().nullable(),
  house: z.string().trim().max(200),
  leader_id: z.string().uuid().nullable(),
  speaker_id: z.string().uuid().nullable(),
  version: z.number().int().nonnegative()
});
const postSchema = z.object({ month: monthSchema, action: z.enum(["generate", "delete"]), version: z.number().int().nonnegative() });

type CultoRow = {
  id: string; year: number; month: number; culto_date: string; requester_id: string | null; house: string;
  leader_id: string | null; speaker_id: string | null; deleted_at: string | null; version: number;
};

async function load(ym: string, lock = false, db: { query: typeof query } = { query }) {
  const [y, m] = ym.split("-").map(Number);
  const rows = await db.query<CultoRow>(
    `select id, year, month, to_char(culto_date, 'YYYY-MM-DD') as culto_date, requester_id, house, leader_id, speaker_id, deleted_at, version
       from app.culto_lar_months where year=$1 and month=$2 ${lock ? "for update" : ""}`,
    [y, m]
  );
  return rows.rows[0] ?? null;
}

/** Trabalhadores aprovados da Doutrina com as funções exigidas por papel (mock `cultoWorkerOptions`). */
async function eligibleWorkers(db: { query: typeof query } = { query }) {
  const rows = await db.query<{ id: string; name: string; functions: string[] }>(
    `select w.id, w.full_name as name, w.functions from app.workers w
       join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina'
      where w.status = 'active' order by w.full_name`
  );
  return rows.rows;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read");
    const ym = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    const [row, workers] = await Promise.all([load(ym), eligibleWorkers()]);
    const culto = row ?? { id: null, culto_date: penultimateSaturday(ym), requester_id: null, house: "", leader_id: null, speaker_id: null, deleted_at: null, version: 0 };
    const options = (role: CultoRole) => workers.filter((w) => cultoEligible(role, w.functions)).map(({ id, name }) => ({ id, name }));
    return Response.json({
      culto: { ...culto, culto_date: penultimateSaturday(ym), status: cultoStatus(culto), saved: Boolean(row) },
      options: { requester: options("requester"), leader: options("leader"), speaker: options("speaker") },
      canEdit: await canEditDoutrina(actor)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Define anfitrião, lar, dirigente e expositor do mês (escolha manual pela Doutrina). */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = putSchema.parse(await request.json());
    const [year, month] = input.month.split("-").map(Number);
    const result = await transaction(async (client) => {
      const current = await load(input.month, true, client);
      if (current?.deleted_at) throw new AppError("A escala deste mês foi excluída. Gere a escala em branco para usar de novo.", 409, "CULTO_DELETED");
      if ((current?.version ?? 0) !== input.version) throw new AppError("O Culto no Lar foi alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      const workers = await eligibleWorkers(client);
      for (const [role, id] of [["requester", input.requester_id], ["leader", input.leader_id], ["speaker", input.speaker_id]] as const) {
        if (!id) continue;
        const worker = workers.find((w) => w.id === id);
        if (!worker || !cultoEligible(role, worker.functions)) {
          throw new AppError(role === "leader" ? "Dirigente sem função de dirigente ou sem aprovação." : role === "speaker" ? "Expositor sem função de expositor/palestrante ou sem aprovação." : "Anfitrião sem aprovação ou fora da Doutrina.", 409, "WORKER_NOT_ELIGIBLE");
        }
      }
      const saved = await client.query<{ id: string; version: number }>(
        `insert into app.culto_lar_months (year, month, culto_date, requester_id, house, leader_id, speaker_id, created_by, updated_by)
         values ($1,$2,$3::date,$4,$5,$6,$7,$8,$8)
         on conflict (year, month) do update set requester_id=excluded.requester_id, house=excluded.house, leader_id=excluded.leader_id,
           speaker_id=excluded.speaker_id, updated_by=excluded.updated_by, updated_at=now(), version=app.culto_lar_months.version+1
         returning id, version`,
        [year, month, penultimateSaturday(input.month), input.requester_id, input.house, input.leader_id, input.speaker_id, actor.id]
      );
      const status = cultoStatus({ house: input.house, leader_id: input.leader_id, speaker_id: input.speaker_id });
      await appendAudit(actor, {
        category: current ? "Edição" : "Inclusão", action: "Culto no Lar atualizado", module: "Doutrina", section: "Culto no Lar",
        entityType: "culto_lar_month", entityId: saved.rows[0].id, details: `${input.month} · ${status}`,
        before: current ? { house: current.house, leader_id: current.leader_id, speaker_id: current.speaker_id } : null,
        after: { house: input.house, leader_id: input.leader_id, speaker_id: input.speaker_id }
      }, client);
      return { version: saved.rows[0].version, status };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Gerar escala em branco (substitui o mês) ou excluir a escala do mês (exclusão lógica). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = postSchema.parse(await request.json());
    const [year, month] = input.month.split("-").map(Number);
    await transaction(async (client) => {
      const current = await load(input.month, true, client);
      if ((current?.version ?? 0) !== input.version) throw new AppError("O Culto no Lar foi alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      if (input.action === "delete" && (!current || current.deleted_at)) throw new AppError("Não há escala deste mês para excluir.", 404, "CULTO_NOT_FOUND");
      const deleted = input.action === "delete";
      const saved = await client.query<{ id: string }>(
        `insert into app.culto_lar_months (year, month, culto_date, deleted_at, deleted_by, created_by, updated_by)
         values ($1,$2,$3::date, case when $4 then now() end, case when $4 then $5::uuid end, $5, $5)
         on conflict (year, month) do update set requester_id=null, house='', leader_id=null, speaker_id=null,
           deleted_at=case when $4 then now() end, deleted_by=case when $4 then $5::uuid end,
           updated_by=$5, updated_at=now(), version=app.culto_lar_months.version+1
         returning id`,
        [year, month, penultimateSaturday(input.month), deleted, actor.id]
      );
      await appendAudit(actor, {
        category: deleted ? "Exclusão" : "Inclusão", action: deleted ? "Exclusão da escala do Culto no Lar" : "Escala do Culto no Lar gerada em branco",
        module: "Doutrina", section: "Culto no Lar", entityType: "culto_lar_month", entityId: saved.rows[0].id, details: input.month,
        before: current ? { house: current.house, leader_id: current.leader_id, speaker_id: current.speaker_id } : null
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
