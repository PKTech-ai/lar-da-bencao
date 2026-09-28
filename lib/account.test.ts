import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  invited: [] as string[],
  lastSignIn: null as string | null,
  userStatus: "active"
}));
const actor = { id: "11111111-1111-4111-8111-111111111111", authUserId: "auth-1", email: "a@x", name: "Titular", role: "trabalhador", status: "active" as const, departments: [], sessionId: "s" };

vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ APP_URL: "https://app.test" }) }));
vi.mock("@/lib/permissions", () => ({ assertPermission: async () => undefined }));
vi.mock("@/lib/audit", () => ({ appendAudit: async () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => actor }));
vi.mock("@/lib/db", () => ({
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({ query: async () => ({ rows: [] }) }),
  query: async () => ({ rows: [{ auth_user_id: "auth-2", email: "novo@lar.org", full_name: "Novo", status: state.userStatus }] })
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { last_sign_in_at: state.lastSignIn } }, error: null }),
        inviteUserByEmail: async (email: string) => { state.invited.push(email); return { data: {}, error: null }; }
      }
    }
  })
}));

const invite = await import("@/app/api/users/[id]/invite/route");
const post = () => new Request("https://app.test/x", { method: "POST" });
const params = { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) };

beforeEach(() => {
  state.invited = [];
  state.lastSignIn = null;
  state.userStatus = "active";
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
