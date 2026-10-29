import { errorResponse } from "@/lib/errors";
import { organizerLogo } from "@/lib/ingressos/eventos";

/** Logo do organizador: informação pública (vai na arte e na página dos ingressos). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const logo = await organizerLogo((await params).id);
    if (!logo) return new Response("Não encontrado.", { status: 404 });
    return new Response(new Uint8Array(logo.bytes), {
      headers: { "Content-Type": logo.mime, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
