import { timingSafeEqual } from "node:crypto";
import { appendAudit } from "@/lib/audit";
import { dbPool, transaction } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { sweepAttachments } from "@/lib/attachment-maintenance";

function validSecret(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!validSecret(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const integrity = await dbPool().query<{ valid: boolean; event_count: string; broken_sequence: string | null }>("select * from app.verify_audit_chain()");
  const result = integrity.rows[0];
  if (!result?.valid) {
    console.error("AUDIT_CHAIN_BROKEN", result);
    return Response.json({ status: "failed", code: "AUDIT_CHAIN_BROKEN", brokenSequence: result?.broken_sequence }, { status: 500 });
  }
  const sweep = await transaction((client) => sweepAttachments(client));
  const removed = await transaction(async (client) => {
    const stale = await client.query<{ id: string }>("select id from app.attachments where status='uploading' and uploaded_at < now() - interval '24 hours' for update");
    if (stale.rowCount) {
      const ids = stale.rows.map((row) => row.id);
      await client.query("delete from app.attachment_chunks where attachment_id = any($1::uuid[])", [ids]);
      await client.query("delete from app.attachments where id = any($1::uuid[])", [ids]);
    }
    // BL-005: tentativas de login só servem para a janela de bloqueio (máx. 24 h).
    await client.query("delete from app.auth_attempts where created_at < now() - interval '2 days'");
    return stale.rowCount ?? 0;
  });
  await appendAudit(null, { category: "Segurança", action: "Verificação diária de integridade", module: "Sistema", section: "Auditoria e anexos", result: "success", details: `${result.event_count} evento(s) íntegros; ${removed} upload(s) incompleto(s) removido(s); ${sweep.orphans} anexo(s) órfão(s) descartado(s); ${sweep.quarantinePurged} quarentena(s) antiga(s) sem binário.` });
  return Response.json({ status: "ok", auditEvents: Number(result.event_count), staleUploadsRemoved: removed, ...sweep });
}
