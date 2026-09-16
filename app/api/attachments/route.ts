import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { authorizeAttachment } from "@/lib/attachments";
import { dbPool } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

const listSchema = z.object({
  ownerType: z.string().regex(/^[a-z_]+$/),
  ownerId: z.string().trim().min(1).max(160)
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    await authorizeAttachment(actor, params.ownerType, "read");
    const result = await dbPool().query(
      `select id, filename, mime_type, size_bytes, sha256, status, scan_result, uploaded_at, activated_at
         from app.attachments
        where owner_type=$1 and owner_id=$2 and status <> 'deleted'
        order by uploaded_at desc`,
      [params.ownerType, params.ownerId]
    );
    return Response.json({ attachments: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
