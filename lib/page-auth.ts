import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { AuthenticationError } from "@/lib/errors";

export async function requirePageActor() {
  try {
    return await requireActor();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect(error.code === "MFA_REQUIRED" ? "/mfa" : "/login");
    throw error;
  }
}
