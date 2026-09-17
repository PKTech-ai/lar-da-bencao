import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeAccessToken, isRecentTotp, isSessionRevoked, lastTotpAt, sessionAuthenticatedAt, sessionIdFromClaims } from "@/lib/sessions";

const token = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("claims de sessão", () => {
  it("usa o login mais antigo do amr (estável no refresh)", () => {
    const claims = decodeAccessToken(token({ session_id: "abc", iat: 5000, amr: [{ method: "totp", timestamp: 1200 }, { method: "password", timestamp: 1000 }] }));
    expect(sessionIdFromClaims(claims)).toBe("abc");
    expect(sessionAuthenticatedAt(claims)).toBe(1000);
  });

  it("cai para iat sem amr e tolera token inválido", () => {
    expect(sessionAuthenticatedAt(decodeAccessToken(token({ iat: 42 })))).toBe(42);
    expect(decodeAccessToken("lixo")).toBeNull();
    expect(sessionAuthenticatedAt(null)).toBeNull();
  });

  it("reautenticação usa a última confirmação TOTP", () => {
    const claims = decodeAccessToken(token({ amr: [{ method: "password", timestamp: 100 }, { method: "totp", timestamp: 500 }, { method: "totp", timestamp: 900 }] }));
    expect(lastTotpAt(claims)).toBe(900);
    expect(lastTotpAt(decodeAccessToken(token({ amr: [{ method: "password", timestamp: 1 }] })))).toBeNull();
    expect(isRecentTotp(900, 900_000 + 300_000)).toBe(true);
    expect(isRecentTotp(900, 900_000 + 301_000)).toBe(false);
    expect(isRecentTotp(null)).toBe(false);
  });

  it("recusa sessões autenticadas antes da revogação", () => {
    const revokedAt = new Date(1_000_000);
    expect(isSessionRevoked(999, revokedAt)).toBe(true);
    expect(isSessionRevoked(1000, revokedAt)).toBe(false);
    expect(isSessionRevoked(null, revokedAt)).toBe(true);
    expect(isSessionRevoked(1, null)).toBe(false);
  });
});

const state = vi.hoisted(() => ({ sql: [] as string[], users: new Map<string, { auth_user_id: string; full_name: string }>(), audits: [] as string[], allowed: true }));
const admin = { id: "11111111-1111-4111-8111-111111111111", authUserId: "a", email: "a@x", name: "Admin", role: "administrador", status: "active" as const, departments: [], sessionId: null };

vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => admin }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string }) => { state.audits.push(input.action); } }));
vi.mock("@/lib/permissions", async () => {
  const { AuthorizationError } = await import("@/lib/errors");
  return { assertPermission: async () => { if (!state.allowed) throw new AuthorizationError(); } };
});
vi.mock("@/lib/db", () => ({
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({
    query: async (text: string, values: unknown[]) => {
      state.sql.push(text);
      if (text.startsWith("select auth_user_id")) {
        const row = state.users.get(String(values[0]));
        return { rows: row ? [row] : [] };
      }
      if (text.includes("revoke_auth_sessions")) return { rows: [{ count: 3 }] };
      return { rows: [], rowCount: 1 };
    }
  })
}));

const { POST: revoke } = await import("@/app/api/users/[id]/sessions/revoke/route");
const target = "22222222-2222-4222-8222-222222222222";
const call = (id: string) => revoke(new Request("https://app.test/x", { method: "POST" }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  state.sql = [];
  state.audits = [];
  state.allowed = true;
  state.users = new Map([[target, { auth_user_id: "auth-target", full_name: "Alvo" }], [admin.id, { auth_user_id: "a", full_name: "Admin" }]]);
});

describe("POST /api/users/[id]/sessions/revoke", () => {
  it("marca corte na aplicação, remove sessões no Auth e audita", async () => {
    const response = await call(target);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "revoked", removed: 3, self: false });
    expect(state.sql.some((sql) => sql.includes("sessions_valid_after"))).toBe(true);
    expect(state.sql.some((sql) => sql.includes("revoke_auth_sessions"))).toBe(true);
    expect(state.audits).toEqual(["Revogação de sessões"]);
  });

  it("sinaliza quando o admin encerra as próprias sessões", async () => {
    expect(await (await call(admin.id)).json()).toMatchObject({ self: true });
  });

  it("nega sem users.admin e registra a falha", async () => {
    state.allowed = false;
    const response = await call(target);
    expect(response.status).toBe(403);
    expect(state.sql).toHaveLength(0);
    expect(state.audits).toEqual(["Falha ao revogar sessões"]);
  });

  it("404 para usuário inexistente", async () => {
    const response = await call("33333333-3333-4333-8333-333333333333");
    expect(response.status).toBe(404);
  });
});
