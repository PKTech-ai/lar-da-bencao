import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { insertSlots, loadFixed, loadScale, loadScaleOptions, requireDoutrina } from "@/lib/doutrina-data";
import { TEMPLATES, isValidMonth, monthDays, parseFixedKey, parseSlotKey, slotKey, supersededFixed, validateFixed, validateSlotValue } from "@/lib/doutrina-scale";

/** `month`: escala aberta na tela; o fixo já entra em todas as semanas dela. */
const markSchema = z.object({ key: z.string().max(20), worker_id: z.string().uuid(), month: z.string().refine(isValidMonth).optional() });
const unmarkSchema = z.object({ key: z.string().max(20) });
const audit = { module: "Doutrina", section: "Trabalhadores fixos", entityType: "scale_fixed" };

/** Marca (ou troca) o trabalhador fixo de uma posição. Vale para todas as escalas geradas daqui em diante. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update", "escalas");
    const input = markSchema.parse(await request.json());
    const pattern = parseFixedKey(input.key);
    if (!pattern) throw new AppError("Posição inválida.");
    const result = await transaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext('scale_fixed:doutrina'))");
      const [options, rows] = [await loadScaleOptions(client), await loadFixed(client)];
      const scale = input.month ? await loadScale(input.month, client, true) : null;
      const sheet = input.month && scale?.month && scale.month.status !== "deleted" ? { ym: input.month, assignments: scale.assignments } : undefined;
      const current = new Map(rows.filter((r) => r.key !== input.key).map((r) => [r.key, r.worker_id]));
      const worker = options.workers.find((w) => w.id === input.worker_id);
      // Fixo antigo que não está valendo não bloqueia: dá lugar ao novo.
      const supersededKeys = new Set(supersededFixed(pattern, worker, current, sheet));
      const superseded = rows.filter((r) => supersededKeys.has(r.key));
      for (const key of supersededKeys) current.delete(key);
      const problem = validateFixed(pattern, worker, current);
      if (problem) throw new AppError(problem, 409, "FIXED_INVALID");
      const section = TEMPLATES[pattern.dow][pattern.si];
      const label = section.r[pattern.ri][0];
      const before = rows.find((r) => r.key === input.key);
      if (superseded.length) await client.query("delete from app.scale_fixed_assignments where id = any($1::uuid[])", [superseded.map((r) => r.id)]);
      await client.query(
        "delete from app.scale_fixed_assignments where department_key='doutrina' and dow=$1 and section_index=$2 and role_index=$3 and position=$4",
        [pattern.dow, pattern.si, pattern.ri, pattern.pos]
      );
      const inserted = await client.query<{ id: string }>(
        `insert into app.scale_fixed_assignments (dow, section_index, role_index, position, section_name, role_label, worker_id, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [pattern.dow, pattern.si, pattern.ri, pattern.pos, section.n, label, worker!.id, actor.id]
      );
      // Já coloca o fixo em todas as semanas da escala aberta (na linha toda), sem esperar "Gerar novamente".
      // O fixo tem prioridade, como na geração: se no dia ele estava em outra atividade, sai de lá e a posição fica livre.
      // Só a falta de função/dia na ficha deixa a semana como está.
      const applied: number[] = [];
      const busyDays: number[] = [];
      const movedDays: number[] = [];
      if (input.month && scale?.month && scale.month.status !== "deleted") {
        const value = `w:${worker!.id}`;
        const current = new Map(scale.assignments);
        const regular: [string, string][] = [];
        const extra: [string, string][] = [];
        const freed: [string, string][] = [];
        const removedExtras: string[] = [];
        for (const day of monthDays(input.month, pattern.dow)) {
          const prefix = `${pattern.dow}|${pattern.si}|${pattern.ri}|${day}|`;
          if (![...current.keys()].some((k) => k.startsWith(prefix))) continue;
          const target = slotKey({ ...pattern, day });
          if (current.get(target) === value) continue;
          if (validateSlotValue(parseSlotKey(target)!, value, { ...options, assignments: current })) {
            busyDays.push(day);
            continue;
          }
          const elsewhere = [...current.keys()].filter((k) => current.get(k) === value && k !== target && k.startsWith(`${pattern.dow}|`) && k.split("|")[3] === String(day));
          for (const k of elsewhere) {
            if (scale.extras.has(k)) {
              removedExtras.push(k);
              current.delete(k);
            } else {
              freed.push([k, ""]);
              current.set(k, "");
            }
          }
          if (elsewhere.length) movedDays.push(day);
          (current.has(target) ? regular : extra).push([target, value]);
          current.set(target, value);
          applied.push(day);
        }
        if (removedExtras.length) {
          await client.query("delete from app.scale_assignments where scale_month_id=$1 and slot_key = any($2::text[])", [scale.month.id, removedExtras]);
        }
        await insertSlots(client, scale.month.id, input.month, freed, { edited: true });
        await insertSlots(client, scale.month.id, input.month, regular, { edited: true });
        await insertSlots(client, scale.month.id, input.month, extra, { edited: true, extra: true });
        if (applied.length) {
          await client.query(
            `update app.scale_months set status='in_review', reviewed=false, published_at=null, updated_by=$2, updated_at=now(), version=version+1 where id=$1`,
            [scale.month.id, actor.id]
          );
        }
      }
      await appendAudit(actor, {
        category: before ? "Edição" : "Inclusão", action: "Trabalhador marcado como fixo na escala", ...audit, entityId: inserted.rows[0].id,
        details: `${worker!.name} · ${section.n} → ${label}${applied.length ? ` · aplicado em ${input.month}: dias ${applied.join(", ")}` : ""}${movedDays.length ? ` · retirado de outra atividade nos dias ${movedDays.join(", ")}` : ""}${superseded.length ? ` · deixou de ser fixo em ${superseded.map((r) => r.section_name).join(", ")}` : ""}`,
        before: before ? { worker: before.worker_name } : null, after: { worker: worker!.name }
      }, client);
      return { id: inserted.rows[0].id, applied: applied.length, busyDays, movedDays, replaced: superseded.map((r) => r.section_name) };
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
    await requireDoutrina(actor, "update", "escalas");
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
