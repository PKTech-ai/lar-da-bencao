import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceStats, isValidAttendanceCell } from "@/lib/doutrina-attendance";
import {
  FREE_THEME, buildScale, canAddExtra, findConflicts, fixedKey, monthDays, parseFixedKey, parseSlotKey, roleOf, slotKey, studySequence, validateFixed,
  validateSlotValue, type ScaleWorker
} from "@/lib/doutrina-scale";

const ALL = ["Passista", "Psicofônico", "Dialogador", "Dirigente de Reunião", "Dirigente de Estudo", "Expositor de Estudo", "Palestrante", "Dirigente de Palestra", "Entrevistador", "Recepcionista"];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const team = (size: number, functions = ALL, days = [0, 1, 3, 4, 5, 6]): ScaleWorker[] =>
  Array.from({ length: size }, (_, i) => ({ id: uuid(i + 1), name: `Trabalhador ${String(i + 1).padStart(2, "0")}`, functions, days }));
const speakers = [{ id: uuid(900), name: "Externo A" }, { id: uuid(901), name: "Externo B" }];
const studies = [
  { id: uuid(800), type: "ESE", code: "ROT. 14", title: "Bem-aventurados os aflitos" },
  { id: uuid(801), type: "PALESTRA", code: "", title: "Perdão" },
  { id: uuid(802), type: "MEP", code: "R1", title: "Roteiro 1" }
];

describe("sequência de roteiros", () => {
  const rot = (n: number, code = `ROT. ${String(n).padStart(3, "0")}`) => ({ id: uuid(700 + n), type: "ESE", code, title: `Roteiro ${n}` });
  const ese = [rot(72), rot(70), rot(71), rot(74), rot(71, "ROT. 71"), { id: uuid(799), type: "ESE", code: "", title: "Sem número" }, { ...rot(73), type: "MEP" }];

  it("escolhido o 70, os próximos dias recebem 71, 72, 74 (pula números que faltam e repetidos)", () => {
    expect(studySequence(ese, uuid(770), 3).map((s) => s.code)).toEqual(["ROT. 071", "ROT. 072", "ROT. 074"]);
    expect(studySequence(ese, uuid(770), 1).map((s) => s.code)).toEqual(["ROT. 071"]);
  });

  it("no último número, sem número ou em tema de palestra não preenche nada", () => {
    expect(studySequence(ese, uuid(774), 3)).toEqual([]);
    expect(studySequence(ese, uuid(799), 3)).toEqual([]);
    expect(studySequence([{ id: uuid(1), type: "PALESTRA", code: "1", title: "a" }, { id: uuid(2), type: "PALESTRA", code: "2", title: "b" }], uuid(1), 3)).toEqual([]);
  });
});

describe("calendário", () => {
  it("lista os dias do mês por dia da semana", () => {
    expect(monthDays("2026-09", 3)).toEqual([2, 9, 16, 23, 30]);
    expect(monthDays("2026-02", 0)).toEqual([1, 8, 15, 22]);
  });

  it("valida chaves de posição", () => {
    expect(parseSlotKey("3|6|2|2|3")).toEqual({ dow: 3, si: 6, ri: 2, day: 2, pos: 3 });
    expect(parseSlotKey("2|0|0|1|0")).toBeNull();
    expect(parseSlotKey("3|99|0|1|0")).toBeNull();
    expect(parseSlotKey("3|0|0|1")).toBeNull();
  });
});

describe("geração da escala", () => {
  it("preenche todas as posições com equipe suficiente e sem conflitos", () => {
    const scale = buildScale("2026-09", team(40), speakers, studies);
    // Só ficam vazias as posições de estudo sem roteiro cadastrado (ESDE e Obra neste cenário).
    const empty = [...scale].filter(([key, value]) => !value && roleOf(parseSlotKey(key)!).type !== "STUDY");
    expect(empty).toEqual([]);
    expect(findConflicts(scale)).toEqual([]);
    expect(scale.get(slotKey({ dow: 3, si: 6, ri: 2, day: 2, pos: 3 }))).toMatch(/^w:/);
  });

  it("só usa quem tem a função e o dia disponível", () => {
    const onlyPassistas = team(10, ["Passista"], [5]);
    const scale = buildScale("2026-09", onlyPassistas, [], []);
    for (const [key, value] of scale) {
      const slot = parseSlotKey(key)!;
      const { type } = roleOf(slot);
      if (value) {
        expect(type).toBe("Passista");
        expect(slot.dow).toBe(5);
      }
    }
  });

  it("respeita a folga quarta/sexta do psicofônico", () => {
    const scale = buildScale("2026-09", team(6, ["Psicofônico"]), [], []);
    expect(findConflicts(scale).filter((c) => c.type === "psych_pair")).toEqual([]);
  });

  it("alterna palestrante externo e interno", () => {
    const scale = buildScale("2026-09", team(3, ["Palestrante"]), speakers, studies);
    const values = [...scale].filter(([key]) => roleOf(parseSlotKey(key)!).type === "SPEAKER").map(([, value]) => value[0]);
    expect(values).toContain("s");
    expect(values).toContain("w");
  });

  it("usa só estudos do tipo da atividade", () => {
    const scale = buildScale("2026-09", [], [], studies);
    for (const [key, value] of scale) {
      const { type, section } = roleOf(parseSlotKey(key)!);
      if (type !== "STUDY" || !value) continue;
      expect(studies.find((s) => `t:${s.id}` === value)?.type).toBe(section.s);
    }
  });

  it("é determinística", () => {
    expect([...buildScale("2026-10", team(15), speakers, studies)]).toEqual([...buildScale("2026-10", team(15), speakers, studies)]);
  });
});

describe("conferência e edição manual", () => {
  const workers = team(5);
  const w1 = `w:${workers[0].id}`;

  it("aponta duplicidade no mesmo dia", () => {
    const assignments = new Map([["3|0|0|2|0", w1], ["3|1|0|2|0", w1], ["3|0|0|9|0", w1]]);
    const conflicts = findConflicts(assignments);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ type: "same_day", workerId: workers[0].id });
  });

  it("aponta psicofônico na quarta e na sexta da mesma semana", () => {
    const assignments = new Map([["3|7|2|2|0", w1], ["5|3|2|4|0", w1]]);
    expect(findConflicts(assignments).map((c) => c.type)).toEqual(["psych_pair"]);
  });

  it("bloqueia a escolha que quebra a folga, mas aceita duplicidade (vai para a conferência)", () => {
    const context = { assignments: new Map([["3|7|2|2|0", w1]]), workers, speakers, studies };
    expect(validateSlotValue(parseSlotKey("5|3|2|4|0")!, w1, context)).toMatch(/Folga obrigatória/);
    expect(validateSlotValue(parseSlotKey("3|7|0|2|0")!, w1, context)).toBeNull();
  });

  it("recusa trabalhador sem função, sem aprovação ou estudo de outro tipo", () => {
    const context = { assignments: new Map(), workers: team(1, ["Passista"]), speakers, studies };
    expect(validateSlotValue(parseSlotKey("3|0|0|2|0")!, w1, context)).toMatch(/sem a função Recepcionista/);
    expect(validateSlotValue(parseSlotKey("3|0|0|2|0")!, `w:${uuid(77)}`, context)).toMatch(/sem aprovação/);
    expect(validateSlotValue(parseSlotKey("3|2|2|2|0")!, `t:${uuid(802)}`, context)).toMatch(/incompatível/);
    expect(validateSlotValue(parseSlotKey("5|1|2|4|0")!, FREE_THEME, context)).toBeNull();
    expect(validateSlotValue(parseSlotKey("3|2|2|2|0")!, FREE_THEME, context)).toMatch(/incompatível/);
    expect(validateSlotValue(parseSlotKey("3|0|0|2|0")!, "", context)).toBeNull();
  });

  it("posições adicionais só onde o mock permite", () => {
    expect(canAddExtra({ dow: 5, si: 4, ri: 1 })).toBe(true); // GRUPO DO PASSE → PASSISTAS
    expect(canAddExtra({ dow: 5, si: 4, ri: 0 })).toBe(false); // COORD. (Passista)
    expect(canAddExtra({ dow: 5, si: 3, ri: 1 })).toBe(false); // MEDIÚNICA → PASSIT.
    expect(canAddExtra({ dow: 3, si: 0, ri: 0 })).toBe(true); // RECEPÇÃO
    expect(canAddExtra({ dow: 0, si: 1, ri: 2 })).toBe(true); // PSICOF.
    expect(canAddExtra({ dow: 3, si: 1, ri: 0 })).toBe(false); // ENTREVISTA
  });
});

describe("frequência da Doutrina", () => {
  it("aceita só atividades do dia da semana dentro do mês", () => {
    expect(isValidAttendanceCell("2026-09", "2026-09-02", "rec_primeira")).toBe(true);
    expect(isValidAttendanceCell("2026-09", "2026-09-02", "mep")).toBe(false);
    expect(isValidAttendanceCell("2026-09", "2026-09-01", "mediunica")).toBe(false);
    expect(isValidAttendanceCell("2026-09", "2026-10-07", "mediunica")).toBe(false);
  });

  it("calcula total, média por encontro e maior público", () => {
    const stats = attendanceStats([
      { date: "2026-09-02", row_id: "ese_g1", value: 10 },
      { date: "2026-09-02", row_id: "mediunica", value: 5 },
      { date: "2026-09-04", row_id: "palestra", value: 40 },
      { date: "2026-09-09", row_id: "ese_g1", value: 0 }
    ]);
    expect(stats).toMatchObject({ encounters: 2, total: 55, average: 28, max: { date: "2026-09-04", total: 40 } });
  });
});

const route = vi.hoisted(() => ({
  month: null as null | { id: string; status: string; reviewed: boolean; version: number },
  assignments: new Map<string, string>(),
  inserted: [] as [string, string][],
  statusUpdates: [] as string[],
  audits: [] as string[],
  canEdit: true,
  fixed: [] as { id: string; key: string; worker_id: string; worker_name: string; section_name: string; role_label: string; created_at: string; created_by_name: string }[]
}));

vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => ({ id: uuid(1), name: "Coord", departments: ["doutrina"] }) }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string }) => { route.audits.push(input.action); } }));
vi.mock("@/lib/db", () => ({
  transaction: async (work: (client: unknown) => Promise<unknown>) => work({
    query: async (text: string, values: unknown[]) => {
      if (text.includes("insert into app.scale_months")) {
        route.month = { id: "m1", status: "generated", reviewed: false, version: (route.month?.version ?? 0) + 1 };
        return { rows: [{ id: "m1" }] };
      }
      if (text.startsWith("delete from app.scale_assignments")) {
        const count = route.assignments.size;
        route.assignments = new Map();
        return { rowCount: count, rows: [] };
      }
      if (text.includes("update app.scale_months")) {
        const status = text.includes("status='in_review'") ? "in_review" : text.includes("status='deleted'") ? "deleted" : String(values[1]);
        route.statusUpdates.push(status);
        route.month = { ...route.month!, status, version: route.month!.version + 1 };
        return { rows: [{ version: route.month.version }] };
      }
      throw new Error(`SQL não simulado: ${text}`);
    }
  })
}));
vi.mock("@/lib/doutrina-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/doutrina-data")>();
  const { AuthorizationError } = await import("@/lib/errors");
  return {
    ...actual,
    requireDoutrina: async (_: unknown, action: string) => { if (action === "update" && !route.canEdit) throw new AuthorizationError(); },
    canEditDoutrina: async () => route.canEdit,
    loadScaleOptions: async () => ({ workers: team(40), speakers, studies }),
    loadFixed: async () => route.fixed,
    loadScale: async () => ({ month: route.month, assignments: route.assignments, edited: new Set(), extras: new Set() }),
    insertSlots: async (_: unknown, __: string, ___: string, slots: [string, string][]) => {
      for (const [key, value] of slots) route.assignments.set(key, value);
      route.inserted.push(...slots);
    }
  };
});

const scaleRoute = await import("@/app/api/doutrina/scale/route");
const post = (body: object) => scaleRoute.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify({ month: "2026-09", ...body }) }));
const patch = (body: object) => scaleRoute.PATCH(new Request("https://app.test/x", { method: "PATCH", body: JSON.stringify({ month: "2026-09", ...body }) }));

describe("trabalhadores fixos", () => {
  const workers = team(40);
  const ana = workers[29];

  it("fixo fica na mesma posição em todas as semanas e já conta na divisão do mês", () => {
    const mep = fixedKey({ dow: 4, si: 0, ri: 0, pos: 0 });
    const scale = buildScale("2026-10", workers, speakers, studies, new Map([[mep, ana.id]]));
    for (const day of monthDays("2026-10", 4)) expect(scale.get(slotKey({ dow: 4, si: 0, ri: 0, day, pos: 0 }))).toBe(`w:${ana.id}`);
    // Sem fixo, Ana teria mais escalas em outros dias do que tem agora.
    const count = (m: Map<string, string>) => [...m.values()].filter((v) => v === `w:${ana.id}`).length;
    expect(count(scale)).toBeLessThanOrEqual(count(buildScale("2026-10", workers, speakers, studies)) + monthDays("2026-10", 4).length);
    expect(findConflicts(scale)).toEqual([]);
  });

  it("sem fixos o resultado é o mesmo de antes", () => {
    expect([...buildScale("2026-10", workers, speakers, studies, new Map())]).toEqual([...buildScale("2026-10", workers, speakers, studies)]);
  });

  it("psicofônico fixo na quarta folga na sexta da mesma semana", () => {
    const wed = fixedKey({ dow: 3, si: 7, ri: 2, pos: 0 });
    const scale = buildScale("2026-10", workers, speakers, studies, new Map([[wed, ana.id]]));
    // 02/10 fica de fora: a quarta daquela semana (30/09) é do mês anterior.
    const friday = [...scale].filter(([k, v]) => v === `w:${ana.id}` && parseSlotKey(k)!.dow === 5 && parseSlotKey(k)!.day > 2 && roleOf(parseSlotKey(k)!).type === "Psicofônico");
    expect(friday).toEqual([]);
  });

  it("valida a marcação do fixo", () => {
    const only = { ...ana, functions: ["Passista"], days: [1] };
    expect(parseFixedKey("1|0|1|0")).toEqual({ dow: 1, si: 0, ri: 1, pos: 0 });
    expect(parseFixedKey("1|0|1")).toBeNull();
    expect(validateFixed({ dow: 1, si: 0, ri: 1, pos: 0 }, only, new Map())).toBeNull();
    expect(validateFixed({ dow: 1, si: 0, ri: 2, pos: 0 }, only, new Map())).toMatch(/não tem a função Psicofônico/);
    expect(validateFixed({ dow: 3, si: 6, ri: 2, pos: 0 }, only, new Map())).toMatch(/dia disponível/);
    expect(validateFixed({ dow: 4, si: 0, ri: 2, pos: 0 }, ana, new Map())).toMatch(/não podem ser fixos/);
    expect(validateFixed({ dow: 1, si: 0, ri: 1, pos: 5 }, only, new Map())).toMatch(/Posição inválida/);
    expect(validateFixed({ dow: 1, si: 0, ri: 1, pos: 0 }, undefined, new Map())).toMatch(/fora da Doutrina/);
    expect(validateFixed({ dow: 1, si: 0, ri: 2, pos: 0 }, ana, new Map([["1|0|0|0", ana.id]]))).toMatch(/já está fixo/);
    expect(validateFixed({ dow: 5, si: 3, ri: 2, pos: 0 }, ana, new Map([["3|7|2|0", ana.id]]))).toMatch(/Folga obrigatória/);
  });

  it("fixo em posição adicional (recepção) entra em todas as semanas; onde não aceita adicional, recusa", () => {
    expect(validateFixed({ dow: 3, si: 0, ri: 0, pos: 2 }, ana, new Map())).toBeNull();
    expect(validateFixed({ dow: 3, si: 1, ri: 0, pos: 2 }, ana, new Map())).toMatch(/Posição inválida/);
    const scale = buildScale("2026-10", workers, speakers, studies, new Map([[fixedKey({ dow: 3, si: 0, ri: 0, pos: 2 }), ana.id]]));
    for (const day of monthDays("2026-10", 3)) expect(scale.get(slotKey({ dow: 3, si: 0, ri: 0, day, pos: 2 }))).toBe(`w:${ana.id}`);
  });
});

describe("API da escala", () => {
  beforeEach(() => {
    route.month = null;
    route.assignments = new Map();
    route.inserted = [];
    route.statusUpdates = [];
    route.audits = [];
    route.canEdit = true;
    route.fixed = [];
  });

  it("gera, recusa gerar duas vezes sem confirmação e regenera", async () => {
    const first = await post({ action: "generate" });
    expect(first.status).toBe(200);
    expect(route.assignments.size).toBeGreaterThan(100);
    expect((await post({ action: "generate" })).status).toBe(409);
    expect((await post({ action: "regenerate", version: route.month!.version })).status).toBe(200);
    expect(route.audits).toEqual(["Geração de escala", "Falha em operação de escala", "Exclusão e nova geração de escala"]);
  });

  it("gerar de novo mantém os fixos e ignora quem não vale mais", async () => {
    const [a, b] = team(40);
    route.fixed = [
      { id: "f1", key: "4|0|0|0", worker_id: a.id, worker_name: a.name, section_name: "ESTUDO DO MEP", role_label: "DIRIG.", created_at: "", created_by_name: "" },
      { id: "f2", key: "1|0|0|0", worker_id: uuid(999), worker_name: "Afastado", section_name: "MEDIÚNICA", role_label: "DIRIG.", created_at: "", created_by_name: "" },
      { id: "f3", key: "4|0|1|0", worker_id: b.id, worker_name: b.name, section_name: "ESTUDO DO MEP", role_label: "EXP.", created_at: "", created_by_name: "" }
    ];
    const res = await post({ action: "generate" });
    expect(await res.json()).toMatchObject({ fixed: 2, skipped: ["Afastado (MEDIÚNICA → DIRIG.)"] });
    for (const day of monthDays("2026-09", 4)) {
      expect(route.assignments.get(`4|0|0|${day}|0`)).toBe(`w:${a.id}`);
      expect(route.assignments.get(`4|0|1|${day}|0`)).toBe(`w:${b.id}`);
    }
  });

  it("perfil só de leitura não gera", async () => {
    route.canEdit = false;
    expect((await post({ action: "generate" })).status).toBe(403);
    expect(route.assignments.size).toBe(0);
  });

  it("aprovação com conflito fica em pendências; publicar exige aprovada", async () => {
    await post({ action: "generate" });
    expect((await post({ action: "publish", version: route.month!.version })).status).toBe(409);
    const [first] = [...route.assignments].find(([key]) => key.startsWith("3|0|0|2|")) ?? [];
    const w = route.assignments.get(first!)!;
    route.assignments.set("3|1|0|2|0", w);
    const denied = await post({ action: "approve", version: route.month!.version });
    expect(await denied.json()).toMatchObject({ status: "pending_issues", approved: false });
    route.assignments.set("3|1|0|2|0", "");
    const approved = await post({ action: "approve", version: route.month!.version });
    expect(await approved.json()).toMatchObject({ status: "approved", approved: true });
    expect((await post({ action: "publish", version: route.month!.version })).status).toBe(200);
    expect(route.month!.status).toBe("published");
  });

  it("recusa operação com versão desatualizada", async () => {
    await post({ action: "generate" });
    expect((await post({ action: "check", version: 999 })).status).toBe(409);
  });

  it("edição manual valida a escolha e volta para conferência", async () => {
    await post({ action: "generate" });
    const version = route.month!.version;
    const bad = await patch({ key: "3|2|2|2|0", value: `t:${uuid(802)}`, version });
    expect(bad.status).toBe(409);
    const good = await patch({ key: "3|2|2|2|0", value: `t:${uuid(800)}`, version });
    expect(good.status).toBe(200);
    expect(route.month!.status).toBe("in_review");
  });

  it("adicional: o trabalhador escolhido segue para as semanas seguintes do mês", async () => {
    await post({ action: "generate" });
    const [first, ...rest] = monthDays("2026-09", 3);
    route.assignments.set(`3|0|0|${first}|2`, "");
    const chosen = `w:${uuid(40)}`;
    const res = await patch({ key: `3|0|0|${first}|2`, value: chosen, version: route.month!.version, series: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Segue para cada semana seguinte, menos onde já está escalado em outra atividade no dia.
    for (const day of rest) {
      const keys = [...route.assignments].filter(([k, v]) => k.startsWith(`3|0|0|${day}|`) && v === chosen);
      expect(keys.length).toBe(body.busyDays.includes(day) ? 0 : 1);
    }
    expect(body.followed + body.busyDays.length).toBe(rest.length);
    expect(body.followed).toBeGreaterThan(0);
    // Posição normal (não adicional) não se repete.
    const normal = await patch({ key: `3|1|0|${first}|0`, value: `w:${uuid(39)}`, version: route.month!.version, series: true });
    expect((await normal.json()).followed).toBe(0);
  });

  it("exclusão lógica mantém o mês e remove as posições", async () => {
    await post({ action: "generate" });
    expect((await post({ action: "delete", version: route.month!.version })).status).toBe(200);
    expect(route.month!.status).toBe("deleted");
    expect(route.assignments.size).toBe(0);
    expect((await post({ action: "check" })).status).toBe(404);
  });
});
