import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { vi } from "vitest";

/**
 * TEST_DATABASE_URL: login de runtime (membro de lar_app) — o código roda com os mesmos privilégios de produção.
 * TEST_OWNER_URL: owner, só para montar dados de apoio (auth.users e usuários institucionais).
 */
export const runtimeUrl = process.env.TEST_DATABASE_URL;
export const ownerUrl = process.env.TEST_OWNER_URL;
export const enabled = Boolean(runtimeUrl && ownerUrl);

// Na CI, banco ausente é erro (não pode virar teste “pulado” silenciosamente).
if (process.env.CI && !enabled) throw new Error("TEST_DATABASE_URL e TEST_OWNER_URL são obrigatórios na CI.");

if (enabled) {
  Object.assign(process.env, {
    DATABASE_URL: runtimeUrl,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_integration_000000",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_integration_000000",
    CRON_SECRET: "cron_integration_0000000000000000000000",
    BOOTSTRAP_SECRET: "bootstrap_integration_000000000000000000000000",
    ANTIMALWARE_API_URL: "https://scanner.example.test/scan",
    ANTIMALWARE_API_TOKEN: "scanner_integration_000000",
    APP_URL: "https://app.example.test"
  });
}

vi.mock("@/lib/request-context", () => ({
  requestContext: async () => ({ requestId: "integration", maskedIp: "127.0.0.0", userAgent: "vitest", appVersion: "test" })
}));

export async function owner<T>(work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const DIRECTOR_ROLES = new Set(["presidente", "vice_presidente", "secretario", "tesoureiro", "conselheiro_fiscal"]);

/**
 * Cria um usuário institucional real (auth.users + app.users) para ser o ator das operações.
 * Cargos da Diretoria só acessam com biênio vigente: recebem um biênio do ano corrente.
 */
export async function createActor(role = "administrador", departments: string[] = []) {
  const authId = randomUUID();
  const email = `${role}-${authId.slice(0, 8)}@teste.local`;
  const id = await owner(async (client) => {
    await client.query("insert into auth.users (id) values ($1)", [authId]);
    const inserted = await client.query<{ id: string }>(
      "insert into app.users (auth_user_id, email, full_name, role_key, status) values ($1,$2,$3,$4,'active') returning id",
      [authId, email, `Teste ${role}`, role]
    );
    if (DIRECTOR_ROLES.has(role)) {
      const biennium = await client.query<{ id: string }>(
        "insert into app.bienniums (label, starts_on, ends_on) values ($1, current_date - 30, current_date + 700) returning id",
        [`Integração ${authId.slice(0, 8)}`]
      );
      await client.query("update app.users set biennium_id = $1 where id = $2", [biennium.rows[0].id, inserted.rows[0].id]);
    }
    for (const d of departments) await client.query("insert into app.user_departments (user_id, department_key) values ($1,$2)", [inserted.rows[0].id, d]);
    return inserted.rows[0].id;
  });
  return { id, authUserId: authId, email, name: `Teste ${role}`, role, status: "active" as const, departments, sessionId: null };
}
