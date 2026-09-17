import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag("module_home_ops");
    await assertPermission(actor, "dashboard", "read");
    const [workers, admissions, evangelizandos, scales] = await Promise.all([
      query<{ count: string }>("select count(*)::text as count from app.workers where status='active'"),
      query<{ count: string }>("select count(*)::text as count from app.workers where status='pending'"),
      query<{ count: string }>("select count(*)::text as count from app.evangelizandos where status='active'"),
      query<{ count: string }>(
        `select count(*)::text as count from app.scale_months
          where year = extract(year from current_date)::int
            and month = extract(month from current_date)::int`
      )
    ]);
    return Response.json({
      workersActive: Number(workers.rows[0]?.count ?? 0),
      admissionsPending: Number(admissions.rows[0]?.count ?? 0),
      evangelizandosActive: Number(evangelizandos.rows[0]?.count ?? 0),
      scalesThisMonth: Number(scales.rows[0]?.count ?? 0)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
