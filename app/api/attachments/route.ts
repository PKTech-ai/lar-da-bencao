import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { authorizeAttachment } from "@/lib/attachments";
import { dbPool } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

const listSchema = z.object({
  ownerType: z.string().regex(/^[a-z_]+$/),
  ownerId: z.string().trim().min(1).max(160),
  includeRemoved: z.enum(["1"]).optional()
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    await authorizeAttachment(actor, params.ownerType, "read");
    const result = await dbPool().query(
      `select a.id, a.kind, a.filename, a.mime_type, a.size_bytes, a.sha256, a.status, a.scan_result, a.uploaded_at, a.activated_at, a.removed_at,
              u.full_name as uploaded_by_name
         from app.attachments a join app.users u on u.id = a.uploaded_by
        where a.owner_type=$1 and a.owner_id=$2
          and (a.status in ('active','pending_scan','quarantined') or ($3 and a.status = 'deleted'
               and exists (select 1 from app.attachment_chunks c where c.attachment_id = a.id)))
        order by a.uploaded_at desc`,
      [params.ownerType, params.ownerId, params.includeRemoved === "1"]
    );
    return Response.json({ attachments: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
