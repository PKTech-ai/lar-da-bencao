import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";

const state = vi.hoisted(() => ({
  totpAt: 0 as number | null,
  audits: [] as Array<{ action: string; result?: string }>,
  deleted: 0,
  signOuts: [] as string[],
  invited: [] as string[],
  lastSignIn: null as string | null,
  userStatus: "active"
}));
const actor = { id: "11111111-1111-4111-8111-111111111111", authUserId: "auth-1", email: "a@x", name: "Titular", role: "trabalhador", status: "active" as const, departments: [], sessionId: "s" };

vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ APP_URL: "https://app.test" }) }));
vi.mock("@/lib/permissions", () => ({ assertPermission: async () => undefined }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string; result?: string }) => { state.audits.push(input); } }));
vi.mock("@/lib/auth", () => ({
  requireActor: async () => ({ ...actor, totpAt: state.totpAt }),
  assertRecentTotp: (a: { totpAt?: number | null }) => {
    if (!a.totpAt || Date.now() / 1000 - a.totpAt > 300) throw new AuthenticationError("Confirme o código do autenticador novamente para continuar.", "REAUTH_REQUIRED");
  }
}));
vi.mock("@/lib/mfa-reset", () => ({
  deleteAllMfaFactors: async () => { state.deleted += 1; return 1; },
  invalidateRecoveryCodes: async () => 4
}));
vi.mock("@/lib/db", () => ({
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({ query: async () => ({ rows: [] }) }),
  query: async () => ({ rows: [{ auth_user_id: "auth-2", email: "novo@lar.org", full_name: "Novo", status: state.userStatus }] })
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "jwt" } } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        signOut: async (jwt: string, scope: string) => { state.signOuts.push(`${jwt}:${scope}`); return { error: null }; },
        getUserById: async () => ({ data: { user: { last_sign_in_at: state.lastSignIn } }, error: null }),
        inviteUserByEmail: async (email: string) => { state.invited.push(email); return { data: {}, error: null }; }
      }
    }
  })
}));

const replace = await import("@/app/api/account/mfa/replace/route");
const invite = await import("@/app/api/users/[id]/invite/route");
const post = () => new Request("https://app.test/x", { method: "POST" });
const params = { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) };

beforeEach(() => {
  state.totpAt = Math.floor(Date.now() / 1000);
  state.audits = [];
  state.deleted = 0;
  state.signOuts = [];
  state.invited = [];
  state.lastSignIn = null;
  state.userStatus = "active";
});

describe("troca de autenticador pelo titular", () => {
  it("exige código TOTP recente e audita a recusa", async () => {
    state.totpAt = Math.floor(Date.now() / 1000) - 3600;
    const response = await replace.POST(post());
    expect(response.status).toBe(401);
    expect(state.deleted).toBe(0);
    expect(state.audits).toEqual([expect.objectContaining({ action: "Troca de autenticador recusada", result: "denied" })]);
  });

  it("remove o fator, encerra as outras sessões e manda recadastrar", async () => {
    const response = await replace.POST(post());
    expect(await response.json()).toEqual({ ok: true, removed: 1, next: "/mfa" });
    expect(state.deleted).toBe(1);
    expect(state.signOuts).toEqual(["jwt:others"]);
    expect(state.audits.map((a) => a.action)).toEqual(["Troca de autenticador pelo titular"]);
  });
});

describe("reenvio de convite", () => {
  it("reenvia para quem ainda não acessou", async () => {
    const response = await invite.POST(post(), params);
    expect(response.status).toBe(200);
    expect(state.invited).toEqual(["novo@lar.org"]);
  });

  it("recusa para quem já acessou ou está suspenso", async () => {
    state.lastSignIn = "2026-09-01T00:00:00Z";
    expect((await invite.POST(post(), params)).status).toBe(409);
    state.lastSignIn = null;
    state.userStatus = "suspended";
    expect((await invite.POST(post(), params)).status).toBe(409);
    expect(state.invited).toEqual([]);
  });
});
