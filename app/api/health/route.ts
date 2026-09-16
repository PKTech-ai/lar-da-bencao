import { dbPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbPool().query("select 1 from app.roles limit 1");
    return Response.json({ status: "ok", version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
