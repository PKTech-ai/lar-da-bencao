import { appendAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { MODULE, SECTION, requireUser } from "@/lib/ingressos/acesso";
import { exportCashbox } from "@/lib/ingressos/exportar";

/** Planilha .xlsx do caixa do evento (Coordenação). */
export async function GET(request: Request) {
  try {
    const op = await requireUser(request);
    const { buffer, filename, event } = await exportCashbox(op, new URL(request.url).searchParams.get("evento") ?? "");
    await appendAudit(op.actor, { category: "Impressão", action: "Exportação do caixa de ingressos", module: MODULE, section: SECTION, entityType: "ticket_event", entityId: event.id, details: event.name });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
