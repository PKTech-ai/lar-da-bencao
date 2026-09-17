import { beforeEach, describe, expect, it, vi } from "vitest";
import { birthdaysInRange } from "@/lib/birthdays";
import {
  ageAtJune30, attendanceSummary, classSundays, classify, enrollmentStatus, firstSundayOfMarch, guardianRequired,
  isClassSunday, renewalTargetYear
} from "@/lib/education";

describe("enquadramento pela idade em 30 de junho", () => {
  it("conta aniversário até 30/06", () => {
    expect(ageAtJune30("2020-06-30", 2026)).toBe(6);
    expect(ageAtJune30("2020-07-01", 2026)).toBe(5);
    expect(ageAtJune30("bad", 2026)).toBeNull();
  });

  it("classifica turmas da Infância e grupos da Juventude", () => {
    expect(classify("2022-01-10", "infancia", 2026)).toMatchObject({ group: "Maternal", valid: true, age: 4 });
    expect(classify("2014-06-30", "infancia", 2026)).toMatchObject({ group: "3º Ciclo", valid: true, age: 12 });
    expect(classify("2014-06-30", "juventude", 2026)).toMatchObject({ group: "3º Ciclo", valid: false });
    expect(classify("2013-06-30", "juventude", 2026)).toMatchObject({ group: "Pré-Juventude", valid: true });
    expect(classify("2005-01-01", "juventude", 2026)).toMatchObject({ group: "Juventude", valid: true, age: 21 });
    expect(classify("2004-01-01", "juventude", 2026)).toMatchObject({ valid: false });
    expect(classify("2024-01-01", "infancia", 2026)).toMatchObject({ valid: false });
  });

  it("responsável: sempre na Infância; na Juventude só para menor de 18", () => {
    expect(guardianRequired("infancia", "2018-01-01", "2026-09-16")).toBe(true);
    expect(guardianRequired("juventude", "2009-09-17", "2026-09-16")).toBe(true);
    expect(guardianRequired("juventude", "2008-09-16", "2026-09-16")).toBe(false);
  });
});

describe("matrícula anual", () => {
  it("vence em 31/12 do ano de validade e pode ser inativada à mão", () => {
    expect(enrollmentStatus({ manual_inactive: false, valid_through_year: 2026 }, 2026)).toMatchObject({ active: true });
    expect(enrollmentStatus({ manual_inactive: false, valid_through_year: 2025 }, 2026)).toMatchObject({ active: false, reason: "Renovação anual pendente" });
    expect(enrollmentStatus({ manual_inactive: true, valid_through_year: 2030 }, 2026)).toMatchObject({ active: false, reason: "Inativação manual" });
  });

  it("renova para o ano corrente se vencida, senão para o próximo", () => {
    expect(renewalTargetYear({ manual_inactive: false, valid_through_year: 2024 }, 2026)).toBe(2026);
    expect(renewalTargetYear({ manual_inactive: false, valid_through_year: 2026 }, 2026)).toBe(2027);
  });
});

describe("calendário dominical com recesso", () => {
  it("começa no primeiro domingo de março", () => {
    expect(firstSundayOfMarch(2026)).toBe("2026-03-01");
    expect(firstSundayOfMarch(2027)).toBe("2027-03-07");
    expect(classSundays("2026-02")).toEqual([]);
    expect(classSundays("2026-09")).toEqual(["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
    expect(isClassSunday("2026-09-06")).toBe(true);
    expect(isClassSunday("2026-09-07")).toBe(false);
    expect(isClassSunday("2026-01-04")).toBe(false);
  });

  it("resume presenças e faltas", () => {
    expect(attendanceSummary([{ evangelizando_id: "a", mark: "P" }, { evangelizando_id: "a", mark: "F" }, { evangelizando_id: "b", mark: "P" }]))
      .toEqual({ present: 2, absent: 1, marked: 3, rate: 67 });
    expect(attendanceSummary([]).rate).toBeNull();
  });
});

describe("aniversariantes", () => {
  const people = [
    { id: "1", name: "Bia", birth_date: "2018-03-15", kind: "Evangelizando", link: "Jardim" },
    { id: "2", name: "Ana", birth_date: "2017-03-02", kind: "Evangelizando", link: "1º Ciclo" },
    { id: "3", name: "Caio", birth_date: "1990-11-20", kind: "Evangelizador(a)", link: "Jardim" }
  ];
  it("filtra por período e ordena por dia", () => {
    expect(birthdaysInRange(people, 2026, 3, 3).map((p) => p.name)).toEqual(["Ana", "Bia"]);
    expect(birthdaysInRange(people, 2026, 12, 1)).toHaveLength(3);
    expect(birthdaysInRange(people, 2026, 11, 11)[0]).toMatchObject({ name: "Caio", age: 36 });
  });
});

type Student = { id: string; department_key: "infancia" | "juventude"; full_name: string; birth_date: string; filled_date: string; class_group: string; valid_through_year: number; manual_inactive: boolean; version: number; age_reference: number };

const state = vi.hoisted(() => ({
  role: "coordenador",
  students: new Map<string, Student>(),
  links: [] as { class_group: string; email: string }[],
  marks: new Map<string, string>(),
  renewals: [] as unknown[],
  audits: [] as string[],
  seq: 0
}));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fake(text: string, values: unknown[] = []): { rows: unknown[]; rowCount?: number } {
  const sql = text.replace(/\s+/g, " ").trim();
  if (sql.includes("from app.feature_flags")) return { rows: [{ key: "module_infancia", enabled: true }, { key: "business_modules", enabled: true }] };
  if (sql.startsWith("select distinct g.class_group")) return { rows: state.links.filter((l) => l.email === values[1]).map((l) => ({ class_group: l.class_group })) };
  if (sql.startsWith("insert into app.evangelizandos")) {
    const id = uuid(++state.seq);
    state.students.set(id, { id, department_key: values[16] as "infancia", full_name: String(values[0]), birth_date: String(values[1]), filled_date: String(values[17]), class_group: String(values[18]), age_reference: Number(values[19]), valid_through_year: Number(values[20]), manual_inactive: false, version: 1 });
    return { rows: [{ id }] };
  }
  if (sql.includes("from app.evangelizandos e where e.id=$1 for update")) {
    const s = state.students.get(String(values[0]));
    return { rows: s ? [{ ...s }] : [] };
  }
  if (sql.endsWith("from app.evangelizandos e where e.department_key = $1 order by e.full_name")) {
    return { rows: [...state.students.values()] };
  }
  if (sql.includes("from app.evangelizandos e where e.department_key = $1 and not e.manual_inactive")) {
    return { rows: [...state.students.values()].filter((s) => !s.manual_inactive && s.valid_through_year >= Number(values[1])) };
  }
  if (sql.startsWith("update app.evangelizandos set valid_through_year")) {
    const s = state.students.get(String(values[0]))!;
    s.valid_through_year = Number(values[1]);
    s.version += 1;
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith("insert into app.evangelizando_renewals")) { state.renewals.push(values); return { rows: [], rowCount: 1 }; }
  if (sql.startsWith("select a.evangelizando_id")) return { rows: [...state.marks].map(([key, mark]) => ({ evangelizando_id: key.split("|")[0], date: key.split("|")[1], mark })) };
  if (sql.startsWith("insert into app.evangelizando_attendance")) {
    for (const e of JSON.parse(String(values[0]))) state.marks.set(`${e.evangelizando_id}|${e.date}`, e.mark);
    return { rows: [] };
  }
  if (sql.startsWith("delete from app.evangelizando_attendance a")) {
    for (const e of JSON.parse(String(values[0]))) state.marks.delete(`${e.evangelizando_id}|${e.date}`);
    return { rows: [] };
  }
  throw new Error(`SQL não simulado: ${sql}`);
}

vi.mock("@/lib/db", () => ({
  query: async (text: string, values?: unknown[]) => fake(text, values),
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({ query: async (text: string, values?: unknown[]) => fake(text, values) })
}));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/workers", () => ({ todayInSaoPaulo: () => "2026-09-16" }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string }) => { state.audits.push(input.action); } }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => ({ id: uuid(999), email: "evang@lar.org", name: "Ator", role: state.role, departments: ["infancia"], status: "active", authUserId: "x", sessionId: null }) }));
vi.mock("@/lib/permissions", async () => {
  const { AuthorizationError } = await import("@/lib/errors");
  const allowed = (resource: string, action: string) =>
    state.role === "coordenador" || (state.role === "evangelizador" && (action === "read" || resource === "education_class"));
  return {
    hasPermission: async (_: unknown, resource: string, action: string) => allowed(resource, action),
    assertPermission: async (_: unknown, resource: string, action: string) => { if (!allowed(resource, action)) throw new AuthorizationError(); }
  };
});

const students = await import("@/app/api/evangelizandos/route");
const student = await import("@/app/api/evangelizandos/[id]/route");
const attendance = await import("@/app/api/education/[department]/attendance/route");

const req = (method: string, body?: object, url = "https://app.test/x") => new Request(url, { method, body: body ? JSON.stringify(body) : undefined });
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

async function enroll(body: object) {
  state.role = "coordenador";
  return students.POST(req("POST", { department_key: "infancia", full_name: "Criança Teste", guardian_name: "Mãe", ...body }));
}

describe("rotas da Infância", () => {
  beforeEach(() => {
    state.students = new Map();
    state.links = [];
    state.marks = new Map();
    state.renewals = [];
    state.audits = [];
    state.role = "coordenador";
  });

  it("matricula com turma calculada e recusa idade fora da faixa ou sem responsável", async () => {
    const ok = await enroll({ birth_date: "2019-05-10" });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ group: "1º Ciclo" });
    expect((await enroll({ birth_date: "2012-01-01" })).status).toBe(400);
    expect((await enroll({ birth_date: "2019-05-10", guardian_name: "" })).status).toBe(400);
    expect((await enroll({ birth_date: "2019-05-10", guardian_name: "", rancho_requested: true })).status).toBe(400);
  });

  it("evangelizador só vê e lança chamada nas próprias turmas", async () => {
    const a = (await (await enroll({ birth_date: "2019-05-10", full_name: "Aluno Ciclo 1" })).json()).id;
    const b = (await (await enroll({ birth_date: "2022-02-02", full_name: "Aluno Maternal" })).json()).id;
    state.role = "evangelizador";
    state.links = [{ class_group: "1º Ciclo", email: "evang@lar.org" }];
    const list = await (await students.GET(req("GET", undefined, "https://app.test/api?department=infancia"))).json();
    expect(list.evangelizandos.map((s: { id: string }) => s.id)).toEqual([a]);
    const sheet = await (await attendance.GET(req("GET", undefined, "https://app.test/x?month=2026-09"), params({ department: "infancia" }))).json();
    expect(sheet.students.map((s: { id: string }) => s.id)).toEqual([a]);

    const put = (entries: object[]) => attendance.PUT(req("PUT", { month: "2026-09", entries }), params({ department: "infancia" }));
    expect((await put([{ evangelizando_id: a, date: "2026-09-06", mark: "P" }])).status).toBe(200);
    expect(state.marks.get(`${a}|2026-09-06`)).toBe("P");
    expect((await put([{ evangelizando_id: b, date: "2026-09-06", mark: "P" }])).status).toBe(403);
    expect((await put([{ evangelizando_id: a, date: "2026-09-07", mark: "P" }])).status).toBe(400);
    expect((await put([{ evangelizando_id: a, date: "2026-09-06", mark: null }])).status).toBe(200);
    expect(state.marks.has(`${a}|2026-09-06`)).toBe(false);

    const edit = await student.PATCH(req("PATCH", { op: "renew", version: 1 }), params({ id: a }));
    expect(edit.status).toBe(403);
  });

  it("renova matrícula com histórico e controle de versão", async () => {
    const id = (await (await enroll({ birth_date: "2019-05-10" })).json()).id;
    expect((await student.PATCH(req("PATCH", { op: "renew", version: 9 }), params({ id }))).status).toBe(409);
    const renewed = await student.PATCH(req("PATCH", { op: "renew", version: 1 }), params({ id }));
    expect(await renewed.json()).toMatchObject({ valid_through_year: 2027, group: "1º Ciclo" });
    expect(state.renewals).toHaveLength(1);
    expect(state.audits).toContain("Renovação de matrícula");
  });

  it("não renova quando a idade do próximo ano sai da faixa", async () => {
    const id = (await (await enroll({ birth_date: "2014-03-01" })).json()).id;
    const response = await student.PATCH(req("PATCH", { op: "renew", version: 1 }), params({ id }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Pré-Juventude/);
  });
});
