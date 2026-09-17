import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";
import {
  RECOVERY_MAX_FAILURES,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryLocked,
  normalizeRecoveryCode
} from "@/lib/mfa-recovery";

type CodeRow = { id: string; user_id: string; code_hash: string; used_at: Date | null };
type AuditRow = { action: string; result: string; actorId: string | null; reasonCode?: string };

const state = vi.hoisted(() => ({
  codes: [] as CodeRow[],
  audits: [] as AuditRow[],
  factors: new Map<string, string[]>(),
  signOuts: [] as Array<{ target: string; scope: string }>,
  aal: "aal2" as "aal1" | "aal2",
  totpAt: 0 as number | null,
  failAdmin: false,
  revokedUsers: [] as string[]
}));

const actor = { id: "11111111-1111-4111-8111-111111111111", authUserId: "auth-user", email: "u@x.org", name: "Usuária", role: "trabalhador", status: "active" as const, departments: [], sessionId: "s1" };
const otherUser = { id: "22222222-2222-4222-8222-222222222222", authUserId: "auth-other", full_name: "Outro" };

function fakeClient() {
  return {
    async query(text: string, values: unknown[] = []) {
      const sql = text.replace(/\s+/g, " ").trim();
      if (sql.startsWith("insert into app.mfa_recovery_codes")) {
        state.codes.push({ id: crypto.randomUUID(), user_id: String(values[0]), code_hash: String(values[1]), used_at: null });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("update app.mfa_recovery_codes set used_at=now() where user_id=$1")) {
        const rows = state.codes.filter((row) => row.user_id === values[0] && !row.used_at);
        rows.forEach((row) => { row.used_at = new Date(); });
        return { rows: [], rowCount: rows.length };
      }
      if (sql.startsWith("update app.mfa_recovery_codes set used_at=now() where id=$1")) {
        state.codes.filter((row) => row.id === values[0]).forEach((row) => { row.used_at = new Date(); });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("select id from app.mfa_recovery_codes")) {
        return { rows: state.codes.filter((row) => row.user_id === values[0] && row.code_hash === values[1] && !row.used_at).map(({ id }) => ({ id })) };
      }
      if (sql.startsWith("select count(*)::text as count from app.audit_events")) {
        const count = state.audits.filter((row) => row.actorId === values[0] && row.action === values[1] && ["failed", "denied"].includes(row.result)).length;
        return { rows: [{ count: String(count) }] };
      }
      if (sql.startsWith("update app.users set sessions_valid_after")) {
        state.revokedUsers.push(String(values[0]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("select app.revoke_auth_sessions")) {
        return { rows: [{ count: 2 }] };
      }
      if (sql.startsWith("select auth_user_id, full_name from app.users")) {
        return { rows: values[0] === otherUser.id ? [{ auth_user_id: otherUser.authUserId, full_name: otherUser.full_name }] : [] };
      }
      throw new Error(`SQL não simulado: ${sql}`);
    }
  };
}

async function inTransaction<T>(work: (client: ReturnType<typeof fakeClient>) => Promise<T>) {
  const snapshot = { codes: state.codes.map((row) => ({ ...row })), audits: [...state.audits] };
  try {
    return await work(fakeClient());
  } catch (error) {
    state.codes = snapshot.codes;
    state.audits = snapshot.audits;
    throw error;
  }
}

vi.mock("@/lib/db", () => ({
  query: (text: string, values?: unknown[]) => fakeClient().query(text, values),
  transaction: inTransaction
}));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/audit", () => ({
  appendAudit: async (who: typeof actor | null, input: { action: string; result?: string; reasonCode?: string }) => {
    state.audits.push({ action: input.action, result: input.result ?? "success", actorId: who?.id ?? null, reasonCode: input.reasonCode });
  }
}));
vi.mock("@/lib/permissions", () => ({ assertPermission: async () => undefined }));
vi.mock("@/lib/auth", () => ({
  requireActor: async (options: { requireMfa?: boolean } = {}) => {
    if (options.requireMfa !== false && state.aal !== "aal2") throw new AuthenticationError("Confirme o segundo fator para continuar.", "MFA_REQUIRED");
    return { ...actor, totpAt: state.totpAt };
  },
  assertRecentTotp: (a: { totpAt?: number | null }) => {
    if (!a.totpAt || Date.now() / 1000 - a.totpAt > 300) throw new AuthenticationError("Confirme o código do autenticador novamente para continuar.", "REAUTH_REQUIRED");
  }
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "jwt-atual" } } }) } })
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        signOut: async (target: string, scope: string) => {
          state.signOuts.push({ target, scope });
          return { error: null };
        },
        mfa: {
          listFactors: async ({ userId }: { userId: string }) => state.failAdmin
            ? { data: null, error: new Error("Auth indisponível") }
            : { data: { factors: (state.factors.get(userId) ?? []).map((id) => ({ id })) }, error: null },
          deleteFactor: async ({ id, userId }: { id: string; userId: string }) => {
            state.factors.set(userId, (state.factors.get(userId) ?? []).filter((item) => item !== id));
            return { data: { id }, error: null };
          }
        }
      }
    }
  })
}));

const { POST: issueCodes, PUT: consumeCode } = await import("@/app/api/mfa/recovery-codes/route");
const { POST: adminReset } = await import("@/app/api/users/[id]/mfa/reset/route");

const jsonRequest = (method: string, body: unknown) => new Request("https://app.test/api", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function issue() {
  const response = await issueCodes(jsonRequest("POST", {}));
  expect(response.status).toBe(200);
  return ((await response.json()) as { codes: string[] }).codes;
}

beforeEach(() => {
  state.codes = [];
  state.audits = [];
  state.factors = new Map([[actor.authUserId, ["totp-1"]], [otherUser.authUserId, ["totp-2"]]]);
  state.signOuts = [];
  state.aal = "aal2";
  state.totpAt = Math.floor(Date.now() / 1000);
  state.failAdmin = false;
  state.revokedUsers = [];
});

describe("mfa-recovery (lógica pura)", () => {
  it("gera códigos únicos de 80 bits e hash insensível a formatação", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[0-9A-F]{5}(-[0-9A-F]{5}){3}$/);
    expect(hashRecoveryCode(` ${codes[0].toLowerCase().replaceAll("-", " ")} `)).toBe(hashRecoveryCode(codes[0]));
    expect(normalizeRecoveryCode("ab-12 c")).toBe("AB12C");
  });

  it("bloqueia após o limite de falhas", () => {
    expect(isRecoveryLocked(RECOVERY_MAX_FAILURES - 1)).toBe(false);
    expect(isRecoveryLocked(RECOVERY_MAX_FAILURES)).toBe(true);
  });
});

describe("POST /api/mfa/recovery-codes", () => {
  it("exige MFA aal2 para emitir", async () => {
    state.aal = "aal1";
    const response = await issueCodes(jsonRequest("POST", {}));
    expect(response.status).toBe(401);
    expect(state.codes).toHaveLength(0);
  });

  it("exige código TOTP recente (reautenticação)", async () => {
    state.totpAt = Math.floor(Date.now() / 1000) - 600;
    const response = await issueCodes(jsonRequest("POST", {}));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("REAUTH_REQUIRED");
  });

  it("armazena só hashes e invalida emissão anterior", async () => {
    const first = await issue();
    const second = await issue();
    expect(state.codes.some((row) => first.includes(row.code_hash) || second.includes(row.code_hash))).toBe(false);
    expect(state.codes.filter((row) => !row.used_at)).toHaveLength(10);
    expect(state.codes.filter((row) => !row.used_at).every((row) => second.map(hashRecoveryCode).includes(row.code_hash))).toBe(true);
  });
});

describe("PUT /api/mfa/recovery-codes", () => {
  it("consome o código uma única vez, invalida os demais, remove o fator e encerra outras sessões", async () => {
    const codes = await issue();
    state.aal = "aal1";
    const response = await consumeCode(jsonRequest("PUT", { code: codes[3].toLowerCase() }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, reenrollRequired: true });
    expect(state.codes.every((row) => row.used_at)).toBe(true);
    expect(state.factors.get(actor.authUserId)).toEqual([]);
    expect(state.signOuts).toEqual([{ target: "jwt-atual", scope: "others" }]);
    expect(state.audits.at(-1)).toMatchObject({ action: "Uso de código de recuperação MFA", result: "success" });

    const reuse = await consumeCode(jsonRequest("PUT", { code: codes[3] }));
    expect(reuse.status).toBe(401);
    const sibling = await consumeCode(jsonRequest("PUT", { code: codes[4] }));
    expect(sibling.status).toBe(401);
  });

  it("audita falhas e bloqueia após o limite, mesmo com código válido", async () => {
    const codes = await issue();
    state.aal = "aal1";
    for (let i = 0; i < RECOVERY_MAX_FAILURES; i += 1) {
      const response = await consumeCode(jsonRequest("PUT", { code: "00000-00000-00000-00000" }));
      expect(response.status).toBe(401);
    }
    expect(state.audits.filter((row) => row.result === "failed")).toHaveLength(RECOVERY_MAX_FAILURES);
    const locked = await consumeCode(jsonRequest("PUT", { code: codes[0] }));
    expect(locked.status).toBe(429);
    expect(state.audits.at(-1)).toMatchObject({ result: "denied", reasonCode: "RECOVERY_LOCKED" });
    expect(state.codes.filter((row) => !row.used_at)).toHaveLength(10);
    expect(state.factors.get(actor.authUserId)).toEqual(["totp-1"]);
  });

  it("não consome o código se a remoção do fator falhar", async () => {
    const codes = await issue();
    state.failAdmin = true;
    const response = await consumeCode(jsonRequest("PUT", { code: codes[0] }));
    expect(response.status).toBe(500);
    expect(state.codes.filter((row) => !row.used_at)).toHaveLength(10);
  });

  it("rejeita corpo vazio sem registrar tentativa", async () => {
    const response = await consumeCode(jsonRequest("PUT", { code: " - " }));
    expect(response.status).toBe(400);
    expect(state.audits).toHaveLength(0);
  });
});

describe("POST /api/users/[id]/mfa/reset", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("admin redefine MFA de outro usuário sem receber códigos", async () => {
    state.codes.push({ id: "c1", user_id: otherUser.id, code_hash: "a".repeat(64), used_at: null });
    const response = await adminReset(jsonRequest("POST", {}), params(otherUser.id));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "reset", name: otherUser.full_name });
    expect(state.codes.every((row) => row.used_at)).toBe(true);
    expect(state.factors.get(otherUser.authUserId)).toEqual([]);
    expect(state.revokedUsers).toEqual([otherUser.id]);
    expect(state.audits.at(-1)).toMatchObject({ action: "Redefinição de MFA pelo administrador", result: "success" });
  });

  it("não permite redefinir o próprio MFA por esta rota", async () => {
    const response = await adminReset(jsonRequest("POST", {}), params(actor.id));
    expect(response.status).toBe(409);
    expect(state.factors.get(actor.authUserId)).toEqual(["totp-1"]);
  });

  it("exige MFA aal2 do administrador", async () => {
    state.aal = "aal1";
    const response = await adminReset(jsonRequest("POST", {}), params(otherUser.id));
    expect(response.status).toBe(401);
    expect(state.factors.get(otherUser.authUserId)).toEqual(["totp-2"]);
  });
});
