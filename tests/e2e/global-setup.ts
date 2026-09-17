import { execSync } from "node:child_process";

/** Recria o banco LOCAL do zero (migrações + login de runtime) antes da suíte. */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_RESET) return;
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  if (!/localhost|127\.0\.0\.1/.test(baseUrl)) throw new Error("E2E só roda contra ambiente local.");
  execSync("npx --yes supabase@2.117.0 db reset --local", { stdio: "inherit" });
  execSync(
    `docker exec -i supabase_db_lar-da-bencao psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "do \\$\\$ begin if not exists (select 1 from pg_roles where rolname='lar_runtime') then create role lar_runtime login password 'runtime_local_password'; end if; end \\$\\$;" -c "grant lar_app to lar_runtime" -c "alter role lar_runtime set search_path = \\"\\$user\\", public, extensions"`,
    { stdio: "inherit" }
  );
  await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" });
}
