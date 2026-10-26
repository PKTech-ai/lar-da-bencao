import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { loadFixed, loadScaleOptions, requireDoutrina } from "@/lib/doutrina-data";
import { TEMPLATES, parseFixedKey, validateFixed } from "@/lib/doutrina-scale";

const markSchema = z.object({ key: z.string().max(20), worker_id: z.string().uuid() });
const unmarkSchema = z.object({ key: z.string().max(20) });
const audit = { module: "Doutrina", section: "Trabalhadores fixos", entityType: "scale_fixed" };

/** Marca (ou troca) o trabalhador fixo de uma posição. Vale para todas as escalas geradas daqui em diante. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = markSchema.parse(await request.json());
    const pattern = parseFixedKey(input.key);
    if (!pattern) throw new AppError("Posição inválida.");
    const result = await transaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext('scale_fixed:doutrina'))");
      const [options, rows] = [await loadScaleOptions(client), await loadFixed(client)];
      const current = new Map(rows.filter((r) => r.key !== input.key).map((r) => [r.key, r.worker_id]));
      const worker = options.workers.find((w) => w.id === input.worker_id);
      const problem = validateFixed(pattern, worker, current);
      if (problem) throw new AppError(problem, 409, "FIXED_INVALID");
      const section = TEMPLATES[pattern.dow][pattern.si];
      const label = section.r[pattern.ri][0];
      const before = rows.find((r) => r.key === input.key);
      await client.query(
        "delete from app.scale_fixed_assignments where department_key='doutrina' and dow=$1 and section_index=$2 and role_index=$3 and position=$4",
        [pattern.dow, pattern.si, pattern.ri, pattern.pos]
      );
      const inserted = await client.query<{ id: string }>(
        `insert into app.scale_fixed_assignments (dow, section_index, role_index, position, section_name, role_label, worker_id, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [pattern.dow, pattern.si, pattern.ri, pattern.pos, section.n, label, worker!.id, actor.id]
      );
      await appendAudit(actor, {
        category: before ? "Edição" : "Inclusão", action: "Trabalhador marcado como fixo na escala", ...audit, entityId: inserted.rows[0].id,
        details: `${worker!.name} · ${section.n} → ${label}`, before: before ? { worker: before.worker_name } : null, after: { worker: worker!.name }
      }, client);
      return { id: inserted.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Desmarca o fixo: a posição volta a ser preenchida pela regra normal na próxima geração. */
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = unmarkSchema.parse(await request.json());
    const pattern = parseFixedKey(input.key);
    if (!pattern) throw new AppError("Posição inválida.");
    await transaction(async (client) => {
      const removed = await client.query<{ id: string; worker_id: string; section_name: string; role_label: string }>(
        `delete from app.scale_fixed_assignments where department_key='doutrina' and dow=$1 and section_index=$2 and role_index=$3 and position=$4
         returning id, worker_id, section_name, role_label`,
        [pattern.dow, pattern.si, pattern.ri, pattern.pos]
      );
      const row = removed.rows[0];
      if (!row) throw new AppError("Esta posição não tem trabalhador fixo.", 404, "NOT_FOUND");
      const name = await client.query<{ full_name: string }>("select full_name from app.workers where id=$1", [row.worker_id]);
      await appendAudit(actor, {
        category: "Exclusão", action: "Trabalhador desmarcado como fixo na escala", ...audit, entityId: row.id,
        details: `${name.rows[0]?.full_name ?? ""} · ${row.section_name} → ${row.role_label}`
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
