import { cookies } from "next/headers";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { DEVICE_COOKIE, FLAG, SESSION_COOKIE, SESSION_HOURS, cookieOptions } from "@/lib/ingressos/acesso";
import { createPin, enterPin, openAccess } from "@/lib/ingressos/vendedor";
import { clientIp } from "@/lib/login-throttle";

/** Link de acesso do trabalhador (público; protegido por token + PIN + aparelho). */
type Context = { params: Promise<{ token: string }> };
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: Context) {
  try {
    await requireFlag(FLAG);
    const { token } = await params;
    const store = await cookies();
    return Response.json(await openAccess(token, store.get(DEVICE_COOKIE)?.value, clientIp(request)), { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    await requireFlag(FLAG);
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { action } = z.object({ action: z.enum(["criar_pin", "entrar"]) }).parse(body);
    const store = await cookies();
    const device = store.get(DEVICE_COOKIE)?.value;
    const result = action === "criar_pin"
      ? await createPin(token, device, body, clientIp(request))
      : await enterPin(token, device, body, clientIp(request));
    store.set(DEVICE_COOKIE, result.device, cookieOptions(400 * 24 * 3600));
    store.set(SESSION_COOKIE, result.session, cookieOptions(SESSION_HOURS * 3600));
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
