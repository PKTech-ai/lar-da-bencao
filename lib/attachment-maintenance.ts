import type { PoolClient } from "pg";

/** Vínculos cujo registro dono guarda o id do anexo; anexo ativo sem referência vira órfão. */
export const ORPHAN_RULES = [
  { ownerPrefix: "study_material_", reference: "select 1 from app.studies s where s.attachment_id = a.id" },
  { ownerPrefix: "evangelizando_photo_", reference: "select 1 from app.evangelizandos e where e.photo_attachment_id = a.id" }
] as const;

export const QUARANTINE_BINARY_DAYS = 30;
export const ORPHAN_GRACE_HOURS = 24;

/**
 * Limpeza diária (cron de integridade): remove binários de anexos órfãos (substituídos ou de
 * cadastros excluídos) e de quarentenas antigas. Os metadados ficam para auditoria (status 'deleted').
 */
export async function sweepAttachments(client: PoolClient) {
  let orphans = 0;
  for (const rule of ORPHAN_RULES) {
    const found = await client.query<{ id: string }>(
      `select a.id from app.attachments a
        where a.owner_type like $1 and a.status = 'active'
          and a.activated_at < now() - make_interval(hours => $2)
          and not exists (${rule.reference})
        for update skip locked`,
      [`${rule.ownerPrefix}%`, ORPHAN_GRACE_HOURS]
    );
    orphans += await discard(client, found.rows.map((r) => r.id));
  }
  const quarantined = await client.query<{ id: string }>(
    `select a.id from app.attachments a
      where a.status = 'quarantined' and a.uploaded_at < now() - make_interval(days => $1)
        and exists (select 1 from app.attachment_chunks c where c.attachment_id = a.id)
      for update skip locked`,
    [QUARANTINE_BINARY_DAYS]
  );
  const purged = quarantined.rows.map((r) => r.id);
  if (purged.length) await client.query("delete from app.attachment_chunks where attachment_id = any($1::uuid[])", [purged]);
  return { orphans, quarantinePurged: purged.length };
}

export async function discard(client: Pick<PoolClient, "query">, ids: string[]) {
  if (!ids.length) return 0;
  await client.query("delete from app.attachment_chunks where attachment_id = any($1::uuid[])", [ids]);
  const updated = await client.query("update app.attachments set status='deleted', removed_at=now() where id = any($1::uuid[])", [ids]);
  return updated.rowCount ?? 0;
}
