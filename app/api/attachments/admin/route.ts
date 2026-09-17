import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { discard } from "@/lib/attachment-maintenance";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const discardSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(300) });

/** Visão do administrador: volume por situação e por vínculo, quarentena e uploads parados. */
export async function GET() {
  try {
    const actor = await requireActor();
    await assertPermission(actor, "attachments", "admin");
    const [byStatus, byOwner, attention, database] = await Promise.all([
      query("select status, count(*)::int as files, coalesce(sum(size_bytes), 0)::bigint::text as bytes from app.attachments group by status order by status"),
      query(
        `select owner_type, count(*)::int as files, coalesce(sum(size_bytes), 0)::bigint::text as bytes
           from app.attachments where status = 'active' group by owner_type order by sum(size_bytes) desc`
      ),
      query(
        `select a.id, a.owner_type, a.owner_id, a.filename, a.mime_type, a.size_bytes::text, a.status, a.scan_result, a.scan_engine,
                a.uploaded_at, u.full_name as uploaded_by_name,
                exists (select 1 from app.attachment_chunks c where c.attachment_id = a.id) as has_binary
           from app.attachments a join app.users u on u.id = a.uploaded_by
          where a.status = 'quarantined' or (a.status in ('uploading', 'pending_scan') and a.uploaded_at < now() - interval '1 hour')
          order by a.uploaded_at desc limit 200`
      ),
      query("select pg_total_relation_size('app.attachment_chunks')::bigint::text as chunk_bytes, pg_database_size(current_database())::bigint::text as database_bytes")
    ]);
    return Response.json(
      { byStatus: byStatus.rows, byOwner: byOwner.rows, attention: attention.rows, storage: database.rows[0] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Descarta binário em quarentena ou upload parado (metadados ficam para auditoria). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "attachments", "admin");
    const input = discardSchema.parse(await request.json());
    await transaction(async (client) => {
      const found = await client.query<{ status: string; filename: string; owner_type: string }>(
        "select status, filename, owner_type from app.attachments where id=$1 for update", [input.id]
      );
      const file = found.rows[0];
      if (!file) throw new AppError("Anexo não encontrado.", 404, "NOT_FOUND");
      if (!["quarantined", "uploading", "pending_scan"].includes(file.status)) {
        throw new AppError("Somente anexos em quarentena ou com upload interrompido podem ser descartados aqui.", 409, "INVALID_ATTACHMENT_STATUS");
      }
      await discard(client, [input.id]);
      await appendAudit(actor, {
        category: "Exclusão", action: "Descarte de anexo", module: "Anexos", section: file.owner_type,
        entityType: "attachment", entityId: input.id, details: `${file.filename} · ${input.reason}`, before: { status: file.status }, after: { status: "deleted" }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
