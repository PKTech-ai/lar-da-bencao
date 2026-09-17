import { beforeEach, describe, expect, it, vi } from "vitest";

type FlagRow = { key: string; enabled: boolean; wave: string | null; uat_reference: string | null };

const state = vi.hoisted(() => ({
  flags: new Map<string, FlagRow>(),
  audits: [] as Array<{ action: string; result?: string }>,
  allowed: true
}));

const actor = { id: "11111111-1111-4111-8111-111111111111", authUserId: "a", email: "a@x", name: "Admin", role: "administrador", status: "active" as const, departments: [], sessionId: null };

function fakeQuery(text: string, values: unknown[] = []) {
  if (text.includes("from app.feature_flags where key = any")) {
    const keys = values[0] as string[];
    return { rows: keys.filter((key) => state.flags.has(key)).map((key) => ({ key, enabled: state.flags.get(key)!.enabled })) };
  }
  if (text.includes("from app.feature_flags where key=$1 for update")) {
    const row = state.flags.get(String(values[0]));
    return { rows: row ? [row] : [] };
  }
  if (text.includes("update app.feature_flags")) {
    const row = state.flags.get(String(values[0]))!;
    row.enabled = Boolean(values[1]);
    if (values[1] && values[2]) row.uat_reference = String(values[2]);
    return { rows: [], rowCount: 1 };
  }
  if (text.includes("from app.workers")) return { rows: [{ id: "w1" }] };
  throw new Error(`SQL não simulado: ${text}`);
}

vi.mock("@/lib/db", () => ({
  query: async (text: string, values?: unknown[]) => fakeQuery(text, values),
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({ query: async (text: string, values?: unknown[]) => fakeQuery(text, values) })
}));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => actor }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string; result?: string }) => { state.audits.push(input); } }));
vi.mock("@/lib/permissions", async () => {
  const { AuthorizationError } = await import("@/lib/errors");
  const check = async () => { if (!state.allowed) throw new AuthorizationError(); };
  return { assertPermission: check, assertAnyDepartmentPermission: check, hasPermission: async () => state.allowed, hasAnyDepartmentPermission: async () => state.allowed };
});

const { effectiveFlag, flagForDepartment, isFlagEnabled } = await import("@/lib/feature-flags");
const flagsRoute = await import("@/app/api/feature-flags/route");
const workersRoute = await import("@/app/api/workers/route");

const patch = (body: object) => flagsRoute.PATCH(new Request("https://app.test/api/feature-flags", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  state.audits = [];
  state.allowed = true;
  state.flags = new Map([
    ["audit", { key: "audit", enabled: true, wave: "fundacao", uat_reference: null }],
    ["attachments", { key: "attachments", enabled: true, wave: "fundacao", uat_reference: null }],
    ["business_modules", { key: "business_modules", enabled: false, wave: "fundacao", uat_reference: null }],
    ["module_workers", { key: "module_workers", enabled: false, wave: "1", uat_reference: null }]
  ]);
});

describe("regras de flag", () => {
  it("módulo só vale com a chave-mestra ligada", () => {
    expect(effectiveFlag("module_x", new Map([["module_x", true]]))).toBe(false);
    expect(effectiveFlag("module_x", new Map([["module_x", true], ["business_modules", true]]))).toBe(true);
    expect(effectiveFlag("module_x", new Map([["module_x", false], ["business_modules", true]]))).toBe(false);
    expect(effectiveFlag("attachments", new Map([["attachments", true]]))).toBe(true);
  });

  it("departamento sem módulo migrado responde 404", () => {
    expect(flagForDepartment("doutrina")).toBe("module_doutrina");
    expect(() => flagForDepartment("tesouraria")).toThrow("ainda não está liberado");
  });

  it("consulta o banco considerando a chave-mestra", async () => {
    state.flags.get("module_workers")!.enabled = true;
    expect(await isFlagEnabled("module_workers")).toBe(false);
    state.flags.get("business_modules")!.enabled = true;
    expect(await isFlagEnabled("module_workers")).toBe(true);
  });
});

describe("rotas de negócio com flag desligada", () => {
  it("GET /api/workers responde 404 com módulo desligado e 200 quando liberado", async () => {
    expect((await workersRoute.GET(new Request("https://app.test/api/workers"))).status).toBe(404);
    state.flags.get("business_modules")!.enabled = true;
    expect((await workersRoute.GET(new Request("https://app.test/api/workers"))).status).toBe(404);
    state.flags.get("module_workers")!.enabled = true;
    expect((await workersRoute.GET(new Request("https://app.test/api/workers"))).status).toBe(200);
  });

  it("POST /api/workers não grava com módulo desligado", async () => {
    const response = await workersRoute.POST(new Request("https://app.test/api/workers", { method: "POST", body: JSON.stringify({ full_name: "Teste" }) }));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/feature-flags", () => {
  it("exige referência de UAT para liberar módulo de negócio", async () => {
    const response = await patch({ key: "module_workers", enabled: true });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("UAT_REQUIRED");
    expect(state.flags.get("module_workers")!.enabled).toBe(false);
  });

  it("libera com UAT e audita antes/depois", async () => {
    const response = await patch({ key: "module_workers", enabled: true, uat_reference: "Ata UAT 2026-09-20 — Presidência" });
    expect(response.status).toBe(200);
    expect(state.flags.get("module_workers")).toMatchObject({ enabled: true, uat_reference: "Ata UAT 2026-09-20 — Presidência" });
    expect(state.audits).toEqual([expect.objectContaining({ action: "Liberação de módulo" })]);
  });

  it("desliga sem UAT", async () => {
    state.flags.get("module_workers")!.enabled = true;
    expect((await patch({ key: "module_workers", enabled: false })).status).toBe(200);
    expect(state.flags.get("module_workers")!.enabled).toBe(false);
  });

  it("não permite desligar o Dedo-duro", async () => {
    const response = await patch({ key: "audit", enabled: false });
    expect(response.status).toBe(409);
    expect(state.flags.get("audit")!.enabled).toBe(true);
  });

  it("nega para quem não é administrador", async () => {
    state.allowed = false;
    expect((await patch({ key: "attachments", enabled: false })).status).toBe(403);
    expect((await flagsRoute.GET()).status).toBe(403);
  });
});
