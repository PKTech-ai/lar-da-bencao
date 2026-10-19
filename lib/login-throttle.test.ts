import { beforeEach, describe, expect, it, vi } from "vitest";

const ANA = "52998224725";

function makeCpf(seed: number) {
  const digits = String(seed).padStart(9, "0").slice(-9).split("").map(Number);
  const check = (length: number, source: number[]) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += source[index] * (length + 1 - index);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const first = check(9, digits);
  const second = check(10, [...digits, first]);
  return [...digits, first, second].join("");
}

const state = vi.hoisted(() => ({
  attempts: [] as Array<{ scope: string; key_hash: string; success: boolean; at: number }>,
  users: new Map<string, { id: string; email: string }>([["52998224725", { id: "user-1", email: "52998224725@acesso.lardabencao.org" }]]),
  passwords: new Map<string, string>([["52998224725@acesso.lardabencao.org", "senha-correta-123"]]),
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
    if (text.includes("from app.users")) {
      const user = state.users.get(String(values[0]));
      return { rows: user ? [{ id: user.id, email: user.email, must_reset_password: false }] : [] };
    }
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
    const wrong = await attempt(ANA, "errada-errada");
    const ghost = await attempt(makeCpf(111444777), "errada-errada");
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(await wrong.json()).toEqual(await ghost.json());
    expect(state.audits.map((a) => a.action)).toEqual(["Falha de login", "Falha de login"]);
  });

  it("bloqueia após 5 falhas no mesmo CPF, mesmo com a senha correta", async () => {
    for (let i = 0; i < 5; i += 1) expect((await attempt(ANA, "errada", `198.51.100.${i}`)).status).toBe(401);
    const blocked = await attempt(ANA, "senha-correta-123", "198.51.100.99");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("900");
    expect(state.audits.at(-1)).toMatchObject({ action: "Login bloqueado por excesso de tentativas", result: "denied", entityId: "user-1" });
  });

  it("bloqueia CPF inexistente do mesmo jeito (sem enumeração)", async () => {
    const ghost = makeCpf(111444777);
    for (let i = 0; i < 5; i += 1) await attempt(ghost, "x", `198.51.100.${i}`);
    expect((await attempt(ghost, "x", "198.51.100.50")).status).toBe(429);
  });

  it("libera após a janela e zera contador do CPF com login correto", async () => {
    for (let i = 0; i < 4; i += 1) await attempt(ANA, "errada");
    expect((await attempt(ANA, "senha-correta-123")).status).toBe(200);
    for (let i = 0; i < 4; i += 1) await attempt(ANA, "errada");
    expect((await attempt(ANA, "senha-correta-123")).status).toBe(200);
    for (let i = 0; i < 5; i += 1) await attempt(ANA, "errada", `192.0.2.${i}`);
    state.now += 16;
    expect((await attempt(ANA, "senha-correta-123", "192.0.2.200")).status).toBe(200);
  });

  it("bloqueia IP que testa muitos CPFs", async () => {
    for (let i = 0; i < 20; i += 1) await attempt(makeCpf(200000000 + i), "x");
    expect((await attempt(ANA, "senha-correta-123")).status).toBe(429);
  });

  it("trata o CPF com ou sem pontuação como o mesmo", async () => {
    for (let i = 0; i < 5; i += 1) await attempt(i % 2 ? "529.982.247-25" : ANA, "x", `10.0.0.${i}`);
    expect((await attempt(ANA, "senha-correta-123", "10.0.0.99")).status).toBe(429);
  });
});
