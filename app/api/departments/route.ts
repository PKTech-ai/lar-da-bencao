import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

/** Lista de departamentos ativos (dado institucional, não sensível) para formulários. */
export async function GET() {
  try {
    await requireActor();
    const result = await query<{ key: string; label: string }>("select key, label from app.departments where active order by label");
    return Response.json({ departments: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
