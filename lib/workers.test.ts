import { beforeEach, describe, expect, it, vi } from "vitest";

type Worker = { id: string; full_name: string; status: string; version: number; functions: string[]; departments: string[] };

const state = vi.hoisted(() => ({
  workers: new Map<string, Worker>(),
  decisions: [] as Array<{ worker_id: string; decision: string; reason: string }>,
  audits: [] as string[],
  /** permissões do ator: "recurso:ação" ou "department:ação:departamento" */
  grants: new Set<string>(),
  actorDepartments: [] as string[],
  seq: 0
}));

const actor = () => ({ id: "11111111-1111-4111-8111-111111111111", authUserId: "a", email: "a@x", name: "Ator", role: "x", status: "active" as const, departments: state.actorDepartments, sessionId: null });

function fakeQuery(text: string, values: unknown[] = []): { rows: unknown[]; rowCount?: number } {
  const sql = text.replace(/\s+/g, " ").trim();
  if (sql.startsWith("select enabled") || sql.includes("from app.feature_flags")) {
    return { rows: [{ key: "module_workers", enabled: true }, { key: "business_modules", enabled: true }] };
  }
  if (sql.startsWith("insert into app.workers")) {
    const id = `00000000-0000-4000-8000-${String(++state.seq).padStart(12, "0")}`;
    state.workers.set(id, { id, full_name: String(values[0]), status: sql.includes("'pending'") ? "pending" : "??", version: 1, functions: values[13] as string[], departments: [] });
    return { rows: [{ id }] };
  }
  if (sql.startsWith("insert into app.worker_departments")) {
    state.workers.get(String(values[0]))!.departments.push(String(values[1]));
    return { rows: [] };
  }
  if (sql.startsWith("delete from app.worker_departments")) {
    state.workers.get(String(values[0]))!.departments = [];
    return { rows: [] };
  }
  if (sql.startsWith("select w.id, w.full_name, w.status, w.version, w.functions") || sql.startsWith("select w.full_name, w.status, w.version, w.functions")) {
    const w = state.workers.get(String(values[0]));
    return { rows: w ? [{ ...w, departments: [...w.departments].sort() }] : [] };
  }
  if (sql.startsWith("update app.workers set full_name")) {
    const w = state.workers.get(String(values[0]))!;
    w.status = String(values[16]);
    w.functions = values[13] as string[];
    w.version += 1;
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith("update app.workers set status")) {
    const w = state.workers.get(String(values[0]))!;
    w.status = String(values[1]);
    w.version += 1;
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith("insert into app.worker_approval_decisions")) {
    state.decisions.push({ worker_id: String(values[0]), decision: String(values[1]), reason: String(values[4]) });
    return { rows: [] };
  }
  if (sql.startsWith("select w.functions from app.workers w join app.worker_departments")) {
    const w = state.workers.get(String(values[0]));
    return { rows: w && w.status === "active" && w.departments.includes(String(values[1])) ? [{ functions: w.functions }] : [] };
  }
  throw new Error(`SQL não simulado: ${sql}`);
}

vi.mock("@/lib/db", () => ({
  query: async (text: string, values?: unknown[]) => fakeQuery(text, values),
  transaction: async (work: (client: unknown) => Promise<unknown>) => {
    const snapshot = new Map([...state.workers].map(([k, v]) => [k, { ...v, departments: [...v.departments] }]));
    try {
      return await work({ query: async (text: string, values?: unknown[]) => fakeQuery(text, values) });
    } catch (error) {
      state.workers = snapshot;
      throw error;
    }
  }
}));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => actor() }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string }) => { state.audits.push(input.action); } }));
vi.mock("@/lib/permissions", () => ({
  hasPermission: async (_: unknown, resource: string, action: string, department?: string) =>
    state.grants.has(`${resource}:${action}`) || (department ? state.grants.has(`${resource}:${action}:${department}`) : false),
  assertPermission: async () => undefined
}));

const { statusAfterEdit, normalizeFicha, validateDecision, fichaSchema, decisionSchema, assertSchedulableWorker } = await import("@/lib/workers");
const workersRoute = await import("@/app/api/workers/route");
const workerRoute = await import("@/app/api/workers/[id]/route");
const decisionRoute = await import("@/app/api/workers/[id]/decision/route");

const json = (method: string, body: object) => new Request("https://app.test/x", { method, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const coordinator = (department: string) => {
  state.grants = new Set([`department:read:${department}`, `department:create:${department}`, `department:update:${department}`]);
  state.actorDepartments = [department];
};
const president = () => {
  state.grants = new Set(["presidencia:read", "presidencia:approve"]);
  state.actorDepartments = [];
};
const ficha = (overrides: object = {}) => ({ full_name: "Maria Teste", departments: ["doutrina"], functions: ["Passista"], ...overrides });

async function createAs(department: string, body: object = {}) {
  coordinator(department);
  const response = await workersRoute.POST(json("POST", ficha(body)));
  return { response, id: (await response.json()).id as string };
}

async function decide(id: string, body: object) {
  president();
  const version = state.workers.get(id)!.version;
  return decisionRoute.POST(json("POST", { meeting_date: "2026-09-10", version, ...body }), params(id));
}

beforeEach(() => {
  state.workers = new Map();
  state.decisions = [];
  state.audits = [];
  state.seq = 0;
});

describe("regras puras da ficha", () => {
  it("funções só valem para quem atua na Doutrina", () => {
    const parsed = fichaSchema.parse(ficha({ departments: ["infancia"] }));
    expect(normalizeFicha(parsed).functions).toEqual([]);
    expect(normalizeFicha(fichaSchema.parse(ficha())).functions).toEqual(["Passista"]);
  });

  it("exige ao menos um departamento e funções válidas", () => {
    expect(() => fichaSchema.parse(ficha({ departments: [] }))).toThrow();
    expect(() => fichaSchema.parse(ficha({ functions: ["Tesoureiro"] }))).toThrow();
  });

  it("volta para análise ao mudar departamentos/funções ou reenviar reprovada", () => {
    const base = { departments: ["doutrina"], functions: ["Passista"] };
    expect(statusAfterEdit("active", base, base)).toEqual({ status: "active", resubmitted: false });
    expect(statusAfterEdit("active", base, { ...base, departments: ["doutrina", "infancia"] })).toEqual({ status: "pending", resubmitted: true });
    expect(statusAfterEdit("inactive", base, { ...base, functions: ["Palestrante"] })).toEqual({ status: "pending", resubmitted: true });
    expect(statusAfterEdit("rejected", base, base)).toEqual({ status: "pending", resubmitted: true });
    expect(statusAfterEdit("pending", base, { ...base, functions: [] })).toEqual({ status: "pending", resubmitted: false });
  });

  it("decisão: data até hoje e motivo obrigatório na reprovação", () => {
    const decision = (body: object) => decisionSchema.parse({ decision: "approved", meeting_date: "2026-09-10", version: 1, ...body });
    expect(() => validateDecision(decision({ meeting_date: "2026-09-17" }), "2026-09-16")).toThrow("data de deliberação");
    expect(() => validateDecision(decision({ decision: "rejected" }), "2026-09-16")).toThrow("motivo");
    expect(() => validateDecision(decision({}), "2026-09-16")).not.toThrow();
  });
});

describe("fluxo de admissão", () => {
  it("ficha nova nasce pendente mesmo se o cliente pedir outro estado", async () => {
    const { response, id } = await createAs("doutrina", { status: "active" });
    expect(response.status).toBe(201);
    expect(state.workers.get(id)?.status).toBe("pending");
    expect(state.audits).toContain("Ficha de trabalhador enviada para aprovação");
  });

  it("coordenador não cadastra em departamento alheio", async () => {
    coordinator("infancia");
    const response = await workersRoute.POST(json("POST", ficha({ origin_department: "doutrina" })));
    expect(response.status).toBe(403);
    expect(state.workers.size).toBe(0);
  });

  it("coordenador não decide; Presidente aprova com histórico", async () => {
    const { id } = await createAs("doutrina");
    coordinator("doutrina");
    const denied = await decisionRoute.POST(json("POST", { decision: "approved", meeting_date: "2026-09-10", version: 1 }), params(id));
    expect(denied.status).toBe(403);
    expect(state.workers.get(id)?.status).toBe("pending");

    const approved = await decide(id, { decision: "approved", minute_ref: "Ata 08/2026" });
    expect(approved.status).toBe(200);
    expect(state.workers.get(id)?.status).toBe("active");
    expect(state.decisions).toEqual([expect.objectContaining({ worker_id: id, decision: "approved" })]);
  });

  it("reprovação exige motivo; ficha decidida não é decidida de novo", async () => {
    const { id } = await createAs("doutrina");
    expect((await decide(id, { decision: "rejected" })).status).toBe(400);
    expect((await decide(id, { decision: "rejected", reason: "Ficha incompleta" })).status).toBe(200);
    expect(state.workers.get(id)?.status).toBe("rejected");
    expect((await decide(id, { decision: "approved" })).status).toBe(409);
  });

  it("recusa decisão sobre ficha alterada durante a análise", async () => {
    const { id } = await createAs("doutrina");
    president();
    const stale = await decisionRoute.POST(json("POST", { decision: "approved", meeting_date: "2026-09-10", version: 99 }), params(id));
    expect(stale.status).toBe(409);
  });

  it("editar funções de aprovado devolve para a Diretoria; reprovado reenviado também", async () => {
    const { id } = await createAs("doutrina");
    await decide(id, { decision: "approved" });
    coordinator("doutrina");
    const edited = await workerRoute.PATCH(json("PATCH", ficha({ functions: ["Palestrante"], version: state.workers.get(id)!.version })), params(id));
    expect(await edited.json()).toMatchObject({ status: "pending", resubmitted: true });

    await decide(id, { decision: "rejected", reason: "Rever funções" });
    coordinator("doutrina");
    const resent = await workerRoute.PATCH(json("PATCH", ficha({ version: state.workers.get(id)!.version })), params(id));
    expect(await resent.json()).toMatchObject({ status: "pending", resubmitted: true });
  });

  it("não ativa ficha pendente pela edição", async () => {
    const { id } = await createAs("doutrina");
    const response = await workerRoute.PATCH(json("PATCH", ficha({ active: true, version: 1 })), params(id));
    expect(response.status).toBe(409);
    expect(state.workers.get(id)?.status).toBe("pending");
  });

  it("coordenador de outro departamento não edita a ficha", async () => {
    const { id } = await createAs("doutrina");
    coordinator("juventude");
    const response = await workerRoute.PATCH(json("PATCH", ficha({ version: 1 })), params(id));
    expect(response.status).toBe(403);
  });
});

describe("escala só com trabalhador aprovado", () => {
  it("recusa pendente, fora do departamento ou sem a função", async () => {
    const { id } = await createAs("doutrina");
    const db = { query: async (text: string, values?: unknown[]) => fakeQuery(text, values) };
    await expect(assertSchedulableWorker(db, id, "doutrina")).rejects.toThrow("sem aprovação");
    await decide(id, { decision: "approved" });
    await expect(assertSchedulableWorker(db, id, "doutrina", "Passista")).resolves.toBeUndefined();
    await expect(assertSchedulableWorker(db, id, "doutrina", "Palestrante")).rejects.toThrow("sem a função");
    await expect(assertSchedulableWorker(db, id, "infancia")).rejects.toThrow("fora deste departamento");
  });
});
