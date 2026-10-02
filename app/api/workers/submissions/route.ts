import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";
import { submissionPayloadSchema, suggestMatches, type WorkerSummary } from "@/lib/worker-submissions";

type SubmissionRow = { id: string; created_at: Date; payload: unknown };

/** Fila de revisão dos cadastros online: somente o Administrador. */
export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag("module_workers");
    await assertPermission(actor, "modules", "admin");
    const [submissions, workers] = await Promise.all([
      query<SubmissionRow>("select id, created_at, payload from app.worker_submissions where status = 'received' order by created_at"),
      query<WorkerSummary>("select id, full_name, birth_date::text as birth_date, phone, status from app.workers order by full_name")
    ]);
    return Response.json({
      submissions: submissions.rows.map((row) => {
        const payload = submissionPayloadSchema.safeParse(row.payload);
        return {
          id: row.id,
          created_at: row.created_at,
          // Envio ilegível (não deveria existir): só pode ser descartado.
          payload: payload.success ? payload.data : null,
          suggestions: payload.success ? suggestMatches(payload.data, workers.rows) : []
        };
      }),
      workers: workers.rows
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
