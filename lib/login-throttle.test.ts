import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  attempts: [] as Array<{ scope: string; key_hash: string; success: boolean; at: number }>,
  users: new Set<string>(["ana@lar.org"]),
  passwords: new Map<string, string>([["ana@lar.org", "senha-correta-123"]]),
  audits: [] as Array<{ action: string; result?: string; entityId?: string }>,
  now: 0
}));

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ CRON_SECRET: "x".repeat(40) }) }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string; result?: string; entityId?: string }) => { state.audits.push(input); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) =>
        state.passwords.get(email) === password ? { error: null } : { error: new Error("Invalid login credentials") }
    }
  })
}));
vi.mock("@/lib/db", () => ({
  query: async (text: string, values: unknown[]) => {
    if (text.includes("from app.users")) return { rows: state.users.has(String(values[0])) ? [{ id: "user-1" }] : [] };
    if (text.startsWith("insert into app.auth_attempts")) {
      state.attempts.push({ scope: "email", key_hash: String(values[0]), success: Boolean(values[2]), at: state.now });
      state.attempts.push({ scope: "ip", key_hash: String(values[1]), success: Boolean(values[2]), at: state.now });
      return { rows: [] };
    }
    if (text.includes("from unnest")) {
      const [scope, key, windows] = values as [string, string, number[]];
      const rows = state.attempts.filter((row) => row.scope === scope && row.key_hash === key);
      const lastSuccess = Math.max(-Infinity, ...rows.filter((row) => row.success).map((row) => row.at));
      return {
        rows: windows.map((w) => ({
          window_minutes: w,
          failures: rows.filter((row) => !row.success && row.at > state.now - w && (scope !== "email" || row.at > lastSuccess)).length
        }))
      };
    }
    throw new Error(`SQL não simulado: ${text}`);
  }
}));

const { lockoutMinutes, attemptKey } = await import("@/lib/login-throttle");
const { POST: login } = await import("@/app/api/auth/login/route");

const attempt = (email: string, password: string, ip = "203.0.113.7") =>
  login(new Request("https://app.test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password })
  }));

beforeEach(() => {
  state.attempts = [];
  state.audits = [];
  state.now = 1_000;
});

describe("lockoutMinutes", () => {
  it("aplica a maior janela estourada", () => {
    expect(lockoutMinutes({ email: [{ windowMinutes: 15, failures: 4 }], ip: [] })).toBe(0);
    expect(lockoutMinutes({ email: [{ windowMinutes: 15, failures: 5 }], ip: [] })).toBe(15);
    expect(lockoutMinutes({ email: [{ windowMinutes: 15, failures: 10 }, { windowMinutes: 60, failures: 10 }], ip: [] })).toBe(60);
    expect(lockoutMinutes({ email: [], ip: [{ windowMinutes: 15, failures: 20 }] })).toBe(15);
  });

  it("não guarda e-mail/IP em claro", () => {
    const key = attemptKey("email", "ana@lar.org");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toBe(attemptKey("ip", "ana@lar.org"));
  });
});

describe("POST /api/auth/login", () => {
  it("responde igual para conta inexistente e senha errada", async () => {
    const wrong = await attempt("ana@lar.org", "errada-errada");
    const ghost = await attempt("ninguem@lar.org", "errada-errada");
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(await wrong.json()).toEqual(await ghost.json());
    expect(state.audits.map((a) => a.action)).toEqual(["Falha de login", "Falha de login"]);
  });

  it("bloqueia após 5 falhas no mesmo e-mail, mesmo com a senha correta", async () => {
    for (let i = 0; i < 5; i += 1) expect((await attempt("ana@lar.org", "errada", `198.51.100.${i}`)).status).toBe(401);
    const blocked = await attempt("ana@lar.org", "senha-correta-123", "198.51.100.99");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("900");
    expect(state.audits.at(-1)).toMatchObject({ action: "Login bloqueado por excesso de tentativas", result: "denied", entityId: "user-1" });
  });

  it("bloqueia e-mail inexistente do mesmo jeito (sem enumeração)", async () => {
    for (let i = 0; i < 5; i += 1) await attempt("ninguem@lar.org", "x", `198.51.100.${i}`);
    expect((await attempt("ninguem@lar.org", "x", "198.51.100.50")).status).toBe(429);
  });

  it("libera após a janela e zera contador do e-mail com login correto", async () => {
    for (let i = 0; i < 4; i += 1) await attempt("ana@lar.org", "errada");
    expect((await attempt("ana@lar.org", "senha-correta-123")).status).toBe(200);
    for (let i = 0; i < 4; i += 1) await attempt("ana@lar.org", "errada");
    expect((await attempt("ana@lar.org", "senha-correta-123")).status).toBe(200);
    for (let i = 0; i < 5; i += 1) await attempt("ana@lar.org", "errada", `192.0.2.${i}`);
    state.now += 16;
    expect((await attempt("ana@lar.org", "senha-correta-123", "192.0.2.200")).status).toBe(200);
  });

  it("bloqueia IP que testa muitos e-mails", async () => {
    for (let i = 0; i < 20; i += 1) await attempt(`alvo${i}@lar.org`, "x");
    expect((await attempt("ana@lar.org", "senha-correta-123")).status).toBe(429);
  });

  it("normaliza o e-mail antes de contar", async () => {
    for (let i = 0; i < 5; i += 1) await attempt(i % 2 ? " ANA@lar.org " : "ana@LAR.org", "x", `10.0.0.${i}`);
    expect((await attempt("ana@lar.org", "senha-correta-123", "10.0.0.99")).status).toBe(429);
  });
});
