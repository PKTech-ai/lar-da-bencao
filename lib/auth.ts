import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/db";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

export type Actor = {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: string;
  status: "active";
  departments: string[];
  sessionId: string | null;
};

type ActorRow = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role_key: string;
  status: string;
  departments: string[] | null;
};

function sessionId(accessToken?: string) {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

export async function requireActor(options: { requireMfa?: boolean } = {}): Promise<Actor> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthenticationError();
  const currentSession = await supabase.auth.getSession();

  if (options.requireMfa !== false) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      throw new AuthenticationError("Confirme o segundo fator para continuar.", "MFA_REQUIRED");
    }
  }

  const result = await query<ActorRow>(
    `select u.id, u.auth_user_id, u.email, u.full_name, u.role_key, u.status,
            coalesce(array_agg(ud.department_key) filter (where ud.department_key is not null), '{}') as departments
       from app.users u
       left join app.user_departments ud on ud.user_id = u.id
      where u.auth_user_id = $1
      group by u.id`,
    [data.user.id]
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") throw new AuthorizationError("Conta institucional inativa ou sem vínculo.");

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    name: row.full_name,
    role: row.role_key,
    status: "active",
    departments: row.departments ?? [],
    sessionId: sessionId(currentSession.data.session?.access_token)
  };
}
