import { headers } from "next/headers";

export async function requestContext() {
  const h = await headers();
  const requestId = h.get("x-vercel-id") ?? h.get("x-request-id") ?? crypto.randomUUID();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const maskedIp = forwarded.includes(":")
    ? forwarded.split(":").slice(0, 4).join(":") + "::"
    : forwarded.split(".").slice(0, 3).concat("0").join(".");
  return {
    requestId,
    maskedIp: maskedIp || null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local"
  };
}
