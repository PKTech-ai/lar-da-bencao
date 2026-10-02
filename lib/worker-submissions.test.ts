import { beforeEach, describe, expect, it, vi } from "vitest";

type Worker = {
  id: string; full_name: string; status: string; version: number; functions: string[]; departments: string[];
  phone: string | null; birth_date: string | null; email: string | null; notes: string; contribution_cents: string;
};
type Submission = { id: string; payload: Record<string, unknown>; status: string; ip_hash: string; matched_worker_id: string | null; review_note: string };
type Audit = { action: string; details?: string; result?: string; entityId?: string };

const state = vi.hoisted(() => ({
  flags: new Map<string, boolean>(),
  workers: new Map<string, Worker>(),
  submissions: [] as Submission[],
  audits: [] as Audit[],
  admin: true,
  seq: 0
}));

const uuid = () => `00000000-0000-4000-8000-${String(++state.seq).padStart(12, "0")}`;

function fakeQuery(text: string, values: unknown[] = []): { rows: unknown[]; rowCount?: number } {
  const sql = text.replace(/\s+/g, " ").trim();
  if (sql.includes("from app.feature_flags")) {
    return { rows: (values[0] as string[]).filter((key) => state.flags.has(key)).map((key) => ({ key, enabled: state.flags.get(key) })) };
  }
  if (sql.startsWith("select key from app.departments")) {
    return { rows: (values[0] as string[]).filter((key) => ["doutrina", "infancia", "juventude"].includes(key)).map((key) => ({ key })) };
  }
  if (sql.startsWith("select count(*)::int as count from app.worker_submissions where ip_hash")) {
    return { rows: [{ count: state.submissions.filter((s) => s.ip_hash === values[0]).length }] };
  }
  if (sql.startsWith("insert into app.worker_submissions")) {
    const id = uuid();
    state.submissions.push({ id, payload: JSON.parse(String(values[0])), status: "received", ip_hash: String(values[1]), matched_worker_id: null, review_note: "" });
    return { rows: [{ id }] };
  }
  if (sql.startsWith("select id, created_at, payload from app.worker_submissions")) {
    return { rows: state.submissions.filter((s) => s.status === "received").map((s) => ({ id: s.id, created_at: new Date(0), payload: s.payload })) };
  }
  if (sql.startsWith("select id, full_name, birth_date::text as birth_date, phone, status from app.workers")) {
    return { rows: [...state.workers.values()] };
  }
  if (sql.startsWith("select status, payload from app.worker_submissions")) {
    return { rows: state.submissions.filter((s) => s.id === values[0]) };
  }
  if (sql.startsWith("update app.worker_submissions set status='discarded'")) {
    Object.assign(state.submissions.find((s) => s.id === values[0])!, { status: "discarded", review_note: String(values[1]) });
    return { rows: [] };
  }
  if (sql.startsWith("update app.worker_submissions set status='applied'")) {
    Object.assign(state.submissions.find((s) => s.id === values[0])!, { status: "applied", matched_worker_id: String(values[1]) });
    return { rows: [] };
  }
  if (sql.startsWith("insert into app.workers")) {
    const id = uuid();
    state.workers.set(id, {
      id, full_name: String(values[0]), email: values[1] as string | null, phone: values[2] as string | null, birth_date: String(values[3]),
      status: sql.includes("'pending'") ? "pending" : "??", version: 1, functions: values[13] as string[], departments: [],
      notes: String(values[16]), contribution_cents: String(values[18])
    });
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
  if (sql.startsWith("select w.id, w.status, w.version, w.full_name")) {
    const w = state.workers.get(String(values[0]));
    return {
      rows: w ? [{
        ...w, departments: [...w.departments].sort(), naturality: null, marital_status: null, profession: "Professora", address: null,
        filled_date: "2026-01-10", volunteer_service: "", accepts_volunteer_law: false, image_authorization: false,
        available_days: [1, 3], contribution_due_day: 10
      }] : []
    };
  }
  if (sql.startsWith("update app.workers set full_name")) {
    const w = state.workers.get(String(values[0]))!;
    Object.assign(w, {
      full_name: String(values[1]), email: values[2], phone: values[3], functions: values[13], notes: String(values[15]),
      status: String(values[16]), contribution_cents: String(values[19]), version: w.version + 1
    });
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`SQL não simulado: ${sql}`);
}

vi.mock("@/lib/db", () => ({
  query: async (text: string, values?: unknown[]) => fakeQuery(text, values),
  transaction: async (work: (client: unknown) => Promise<unknown>) => {
    const workers = new Map([...state.workers].map(([k, v]) => [k, { ...v, departments: [...v.departments] }]));
    const submissions = state.submissions.map((s) => ({ ...s }));
    try {
      return await work({ query: async (text: string, values?: unknown[]) => fakeQuery(text, values) });
    } catch (error) {
      state.workers = workers;
      state.submissions = submissions;
      throw error;
    }
  }
}));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ CRON_SECRET: "x".repeat(40) }) }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({
  requireActor: async () => ({ id: "11111111-1111-4111-8111-111111111111", authUserId: "a", email: "a@x", name: "Ator", role: "x", status: "active", departments: [], sessionId: null })
}));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: Audit) => { state.audits.push(input); } }));
vi.mock("@/lib/permissions", async () => {
  const { AuthorizationError } = await import("@/lib/errors");
  const allowed = (resource: string, action: string) => state.admin && resource === "modules" && action === "admin";
  return {
    hasPermission: async (_: unknown, resource: string, action: string) => allowed(resource, action),
    assertPermission: async (_: unknown, resource: string, action: string) => { if (!allowed(resource, action)) throw new AuthorizationError(); },
    departmentsWithPermission: async () => []
  };
});

const {
  fichaFromSubmission, isHoneypotFilled, normalizeName, normalizeSubmission, publicSubmissionSchema, submissionDiff,
  submissionPayloadSchema, suggestMatches, SUBMISSION_LIMIT
} = await import("@/lib/worker-submissions");
const publicRoute = await import("@/app/api/public/worker-submissions/route");
const listRoute = await import("@/app/api/workers/submissions/route");
const reviewRoute = await import("@/app/api/workers/submissions/[id]/route");

const form = (overrides: object = {}) => ({
  full_name: "José da Silva", phone: "(51) 99876-5432", email: "", birth_date: "1980-03-15", departments: ["doutrina"],
  functions: ["Passista"], available_days: [3], accepts_volunteer_law: true, image_authorization: false, privacy_acknowledged: true,
  ...overrides
});
const send = (body: object, ip = "203.0.113.7") =>
  publicRoute.POST(new Request("https://app.test/api/public/worker-submissions", { method: "POST", headers: { "x-real-ip": ip }, body: JSON.stringify(body) }));
const review = (id: string, body: object) =>
  reviewRoute.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

function seedWorker(overrides: Partial<Worker> = {}) {
  const id = uuid();
  state.workers.set(id, {
    id, full_name: "Jose da Silva", status: "active", version: 3, functions: ["Passista"], departments: ["doutrina"],
    phone: "51 9876-5432", birth_date: "1980-03-15", email: "jose@lar.org", notes: "Observação interna", contribution_cents: "5000", ...overrides
  });
  return id;
}
async function submitted(overrides: object = {}) {
  expect((await send(form(overrides))).status).toBe(201);
  return state.submissions.at(-1)!;
}

beforeEach(() => {
  state.flags = new Map([["public_worker_form", true], ["module_workers", true], ["business_modules", true]]);
  state.workers = new Map();
  state.submissions = [];
  state.audits = [];
  state.admin = true;
  state.seq = 0;
});

describe("regras do formulário público", () => {
  it("exige nome, telefone com DDD, nascimento válido, departamento e os aceites", () => {
    const fails = (overrides: object) => expect(publicSubmissionSchema.safeParse(form(overrides)).success).toBe(false);
    expect(publicSubmissionSchema.safeParse(form()).success).toBe(true);
    fails({ full_name: "J" });
    fails({ phone: "9876-5432" });
    fails({ birth_date: "" });
    fails({ birth_date: "1980-02-31" });
    fails({ birth_date: "2999-01-01" });
    fails({ departments: [] });
    fails({ functions: ["Tesoureiro"] });
    fails({ accepts_volunteer_law: false });
    fails({ privacy_acknowledged: false });
  });

  it("descarta campos que o trabalhador não pode informar", () => {
    const parsed = normalizeSubmission(publicSubmissionSchema.parse(form({ contribution_cents: 99, contribution_due_day: 5, notes: "x", status: "active" })));
    expect(Object.keys(parsed)).not.toEqual(expect.arrayContaining(["contribution_cents", "contribution_due_day", "notes", "status", "privacy_acknowledged"]));
  });

  it("funções só valem para quem marcou Doutrina", () => {
    expect(normalizeSubmission(submissionPayloadSchema.parse(form({ departments: ["infancia"] }))).functions).toEqual([]);
    expect(normalizeSubmission(submissionPayloadSchema.parse(form())).functions).toEqual(["Passista"]);
  });

  it("reconhece o campo-isca preenchido", () => {
    expect(isHoneypotFilled({ website: "http://spam" })).toBe(true);
    expect(isHoneypotFilled({ website: "  " })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
  });
});

describe("sugestão de vínculo", () => {
  const workers = [
    { id: "a", full_name: "José da Silva", birth_date: null, phone: null, status: "active" },
    { id: "b", full_name: "J. Silva", birth_date: "1980-03-15", phone: "+55 (51) 9876-5432", status: "active" },
    { id: "c", full_name: "Maria Souza", birth_date: "1980-03-15", phone: "51 3333-0000", status: "active" },
    { id: "d", full_name: "JOSE  DA SILVA", birth_date: "1980-03-15", phone: "51998765432", status: "inactive" }
  ];

  it("normaliza nome sem acento, caixa e espaços", () => {
    expect(normalizeName("  JOSÉ  da Silva ")).toBe("jose da silva");
  });

  it("sugere por nome igual ou por nascimento + telefone, com o mais forte primeiro", () => {
    const found = suggestMatches({ full_name: "Jose da Silva", birth_date: "1980-03-15", phone: "(51) 99876-5432" }, workers);
    expect(found.map((item) => item.worker_id)).toEqual(["d", "a", "b"]);
    expect(found[0].reasons).toEqual(["mesmo nome", "mesmo nascimento e telefone"]);
    expect(found[2].reasons).toEqual(["mesmo nascimento e telefone"]);
  });

  it("nascimento igual sozinho não é sugestão", () => {
    expect(suggestMatches({ full_name: "Outra Pessoa", birth_date: "1980-03-15", phone: "(51) 91111-2222" }, workers)).toEqual([]);
  });
});

describe("aplicação sobre ficha existente", () => {
  const existing = {
    full_name: "Jose Silva", email: "jose@lar.org", phone: "51 3333-0000", birth_date: "1980-03-15", naturality: "Porto Alegre",
    marital_status: null, profession: "Professor", address: null, filled_date: "2026-01-10", volunteer_service: "Passes às quartas",
    accepts_volunteer_law: false, image_authorization: true, functions: ["Passista"], available_days: [1, 3], departments: ["doutrina"],
    notes: "Observação interna", contribution_cents: "5000", contribution_due_day: 10
  };
  const payload = normalizeSubmission(submissionPayloadSchema.parse(form({ profession: "Diretor", available_days: [] })));

  it("campo em branco não apaga o que já existe; dados internos ficam intactos", () => {
    const next = fichaFromSubmission(payload, existing);
    expect(next).toMatchObject({
      full_name: "José da Silva", email: "jose@lar.org", naturality: "Porto Alegre", profession: "Diretor", volunteer_service: "Passes às quartas",
      available_days: [1, 3], notes: "Observação interna", contribution_cents: 5000, contribution_due_day: 10, filled_date: "2026-01-10",
      accepts_volunteer_law: true, image_authorization: false
    });
  });

  it("ficha nova nasce sem contribuição nem observações", () => {
    expect(fichaFromSubmission(payload)).toMatchObject({ notes: "", contribution_cents: 0, contribution_due_day: null, filled_date: "", available_days: [] });
  });

  it("mostra só os campos que mudam", () => {
    expect(submissionDiff(existing, payload).map((row) => row.field)).toEqual(["full_name", "phone", "profession", "accepts_volunteer_law", "image_authorization"]);
  });
});

describe("envio público", () => {
  it("grava só na fila, sem tocar em app.workers, e audita sem dados pessoais", async () => {
    const response = await send(form({ contribution_cents: 99999, status: "active" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "received" });
    expect(state.workers.size).toBe(0);
    expect(state.submissions).toHaveLength(1);
    expect(state.submissions[0].payload).not.toHaveProperty("contribution_cents");
    expect(state.submissions[0].ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.audits).toEqual([expect.objectContaining({ action: "Envio de cadastro online de trabalhador", entityId: state.submissions[0].id })]);
    expect(JSON.stringify(state.audits)).not.toMatch(/Silva|99876/);
  });

  it("formulário fechado recusa o envio", async () => {
    state.flags.set("public_worker_form", false);
    const response = await send(form());
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("FORM_CLOSED");
    expect(state.submissions).toHaveLength(0);
  });

  it("campo-isca preenchido recebe a resposta normal, mas nada é gravado", async () => {
    const response = await send(form({ website: "http://spam.example" }));
    expect(response.status).toBe(201);
    expect(state.submissions).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it("dados inválidos e departamento desconhecido são recusados", async () => {
    expect((await send(form({ phone: "" }))).status).toBe(400);
    expect((await send(form({ departments: ["inexistente"] }))).status).toBe(400);
    expect(state.submissions).toHaveLength(0);
  });

  it("limita os envios por IP na janela", async () => {
    for (let i = 0; i < SUBMISSION_LIMIT.max; i += 1) expect((await send(form())).status).toBe(201);
    const blocked = await send(form());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe(String(SUBMISSION_LIMIT.windowMinutes * 60));
    expect(state.submissions).toHaveLength(SUBMISSION_LIMIT.max);
    expect(state.audits.at(-1)).toMatchObject({ result: "denied", reasonCode: "SUBMISSION_THROTTLED" });
    expect((await send(form(), "198.51.100.9")).status).toBe(201);
  });
});

describe("revisão pelo Administrador", () => {
  it("quem não é Administrador não lista nem trata envios", async () => {
    const submission = await submitted();
    state.admin = false;
    expect((await listRoute.GET()).status).toBe(403);
    expect((await review(submission.id, { action: "create" })).status).toBe(403);
    expect((await review(submission.id, { action: "discard", note: "duplicado" })).status).toBe(403);
    expect(submission.status).toBe("received");
    expect(state.workers.size).toBe(0);
  });

  it("lista os envios pendentes com as fichas parecidas", async () => {
    const workerId = seedWorker();
    await submitted();
    const body = await (await listRoute.GET()).json();
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].suggestions).toEqual([{ worker_id: workerId, reasons: ["mesmo nome", "mesmo nascimento e telefone"] }]);
  });

  it("criar ficha nova: nasce pendente e o envio fica aplicado", async () => {
    const submission = await submitted({ departments: ["infancia", "doutrina"] });
    const response = await review(submission.id, { action: "create", origin_department: "infancia" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ result: "created", status: "pending" });
    expect(state.workers.get(body.worker_id)).toMatchObject({ status: "pending", departments: ["doutrina", "infancia"], contribution_cents: "0", notes: "" });
    expect(state.submissions[0]).toMatchObject({ status: "applied", matched_worker_id: body.worker_id });
    expect(state.audits.map((a) => a.action)).toContain("Ficha de trabalhador criada a partir do cadastro online");
  });

  it("departamento solicitante precisa estar no envio", async () => {
    const submission = await submitted();
    expect((await review(submission.id, { action: "create", origin_department: "juventude" })).status).toBe(400);
    expect(state.workers.size).toBe(0);
    expect(submission.status).toBe("received");
  });

  it("atualizar ficha aprovada sem mudar departamentos/funções mantém a aprovação", async () => {
    const workerId = seedWorker();
    const submission = await submitted();
    const response = await review(submission.id, { action: "apply", worker_id: workerId, version: 3 });
    expect(await response.json()).toMatchObject({ result: "updated", status: "active", resubmitted: false });
    expect(state.workers.get(workerId)).toMatchObject({
      full_name: "José da Silva", phone: "(51) 99876-5432", email: "jose@lar.org", status: "active", version: 4,
      notes: "Observação interna", contribution_cents: "5000"
    });
    expect(state.submissions[0].status).toBe("applied");
  });

  it("mudar departamentos de ficha aprovada devolve para a Diretoria", async () => {
    const workerId = seedWorker();
    const submission = await submitted({ departments: ["doutrina", "infancia"] });
    const response = await review(submission.id, { action: "apply", worker_id: workerId, version: 3 });
    expect(await response.json()).toMatchObject({ status: "pending", resubmitted: true });
    expect(state.workers.get(workerId)).toMatchObject({ status: "pending", departments: ["doutrina", "infancia"] });
    expect(state.audits.map((a) => a.action)).toContain("Ficha atualizada pelo cadastro online e reenviada para a Diretoria");
  });

  it("ficha alterada por outra sessão não é sobrescrita", async () => {
    const workerId = seedWorker();
    const submission = await submitted();
    const response = await review(submission.id, { action: "apply", worker_id: workerId, version: 2 });
    expect(response.status).toBe(409);
    expect(state.workers.get(workerId)).toMatchObject({ full_name: "Jose da Silva", version: 3 });
    expect(submission.status).toBe("received");
  });

  it("descartar exige motivo; envio tratado não é tratado de novo", async () => {
    const submission = await submitted();
    expect((await review(submission.id, { action: "discard", note: "" })).status).toBe(400);
    expect((await review(submission.id, { action: "discard", note: "Envio de teste" })).status).toBe(200);
    expect(state.submissions[0]).toMatchObject({ status: "discarded", review_note: "Envio de teste" });
    expect((await review(submission.id, { action: "create" })).status).toBe(409);
    expect(state.workers.size).toBe(0);
  });
});
