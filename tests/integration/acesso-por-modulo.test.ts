import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createActor, enabled, owner } from "./setup";

type Actor = Awaited<ReturnType<typeof createActor>>;
const current = vi.hoisted(() => ({ actor: null as unknown }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => current.actor }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));

const json = (method: string, body?: object) =>
  new Request("https://app.test/x", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const person = (id: string) => ({ params: Promise.resolve({ id }) });
const resource = (key: string) => ({ params: Promise.resolve({ resource: key }) });

describe.skipIf(!enabled)("Acesso por módulo (Postgres real)", async () => {
  const { dbPool } = await import("@/lib/db");
  const { ATTENDANCE_MODULE, CALL_MODULE, DEPARTMENT_MODULES } = await import("@/lib/department-modules");
  const { departmentModuleAccess, departmentsWithModule, hasPermission, pageLevel } = await import("@/lib/permissions");
  const { requireTreasury } = await import("@/lib/treasury");
  const { allowedGroups, canOpenAttendance, requireClassWrite } = await import("@/lib/education-data");
  const access = await import("@/app/api/users/[id]/access/route");
  const records = await import("@/app/api/r/[resource]/route");
  let admin: Actor;

  beforeAll(async () => {
    admin = await createActor("administrador");
    await owner((client) => client.query(
      "update app.feature_flags set enabled = true, uat_reference = 'teste de integração' where key like 'module\\_%' or key in ('business_modules','legacy_import')"
    ));
  });
  afterAll(async () => { await dbPool().end(); });

  const save = async (target: Actor, marks: object, copiedFrom?: string) => {
    current.actor = admin;
    return access.PUT(json("PUT", { marks, copiedFrom }), person(target.id));
  };
  const summary = (target: Actor, department: string) => owner(async (client) =>
    (await client.query<{ access_level: string }>("select access_level from app.user_departments where user_id=$1 and department_key=$2", [target.id, department])).rows[0]?.access_level ?? null);

  it("quem não foi marcado continua exatamente com o acesso de antes, em todo perfil e nível", async () => {
    const { roles, pages } = await owner(async (client) => ({
      roles: (await client.query<{ key: string }>("select key from app.roles")).rows.map((r) => r.key),
      pages: (await client.query<{ key: string; page_key: string }>("select key, page_key from app.departments where active")).rows
    }));
    expect(roles.length).toBeGreaterThan(3);
    const departments = Object.keys(DEPARTMENT_MODULES);
    for (const role of roles) {
      for (const level of ["chamada", "consulta", "coordenacao", null] as const) {
        const actor = await createActor(role, level ? departments : [], level ?? undefined);
        for (const department of departments) {
          const pageKey = pages.find((p) => p.key === department)?.page_key;
          expect(pageKey, department).toBeTruthy();
          const [moduleAccess, page] = await Promise.all([departmentModuleAccess(actor, department), pageLevel(actor, pageKey!)]);
          expect(moduleAccess.fine).toBe(false);
          for (const item of DEPARTMENT_MODULES[department]) {
            const expected = item.key === CALL_MODULE && level === "chamada" ? "full" : page;
            expect(moduleAccess.levelOf(item.key), `${role}/${level}/${department}/${item.key}`).toBe(expected);
            if (item.key !== CALL_MODULE) {
              for (const action of ["read", "print", "export", "download", "create", "update", "delete", "approve", "admin"] as const) {
                expect(moduleAccess.can(item.key, action), `${role}/${level}/${department}/${item.key}/${action}`).toBe(page === "full" || (page === "read" && ["read", "print", "export", "download"].includes(action)));
              }
            }
          }
        }
      }
    }
  }, 240_000);

  it("só abre o que foi marcado, e só altera onde foi marcado Alterar", async () => {
    const target = await createActor("trabalhador");
    const response = await save(target, { tesouraria: [{ module: "caixa", edit: true }, { module: "extrato", edit: false }] });
    expect(response.status).toBe(200);
    expect(await summary(target, "tesouraria")).toBe("consulta");

    const moduleAccess = await departmentModuleAccess(target, "tesouraria");
    expect(moduleAccess.can("caixa", "update")).toBe(true);
    expect(moduleAccess.can("extrato", "read")).toBe(true);
    expect(moduleAccess.can("extrato", "update")).toBe(false);
    expect(moduleAccess.can("lancamentos", "read")).toBe(false);

    await expect(requireTreasury(target as never, "update", "caixa")).resolves.toBeUndefined();
    await expect(requireTreasury(target as never, "update", "extrato")).rejects.toMatchObject({ status: 403 });
    await expect(requireTreasury(target as never, "read", "lancamentos")).rejects.toMatchObject({ status: 403 });
    // Departamento não marcado continua fechado.
    expect(await departmentsWithModule(target, "caixa", "read")).toEqual(["tesouraria"]);
  });

  it("nos cadastros, consultar abre a leitura e não a gravação; o que não foi marcado responde 403", async () => {
    const target = await createActor("trabalhador");
    expect((await save(target, { patrimonio: [{ module: "bens", edit: false }], secretaria: [{ module: "painel", edit: false }] })).status).toBe(200);
    current.actor = target;
    expect((await records.GET(new Request("https://app.test/x"), resource("patrimonio-bens"))).status).toBe(200);
    const denied = await records.POST(json("POST", { tombamento: "X", condition: "Usado", description: "Teste", department_key: "patrimonio", entry_date: "2020-05-10", value_cents: 1, location: "x", responsible: "x", notes: "" }), resource("patrimonio-bens"));
    expect(denied.status).toBe(403);
    expect((await records.GET(new Request("https://app.test/x"), resource("secretaria-reunioes"))).status).toBe(403);

    expect((await save(target, { patrimonio: [{ module: "bens", edit: true }] })).status).toBe(200);
    current.actor = target;
    const allowed = await records.POST(json("POST", { tombamento: `T-${target.id.slice(0, 8)}`, condition: "Usado", description: "Teste", department_key: "patrimonio", entry_date: "2020-05-10", value_cents: 1, location: "x", responsible: "x", notes: "" }), resource("patrimonio-bens"));
    expect(allowed.status).toBe(201);
  });

  it("chamada: só a própria turma; frequência: todas; planejamento grava o cronograma de todas", async () => {
    const target = await createActor("trabalhador");
    expect((await save(target, { infancia: [{ module: "chamada", edit: true }] })).status).toBe(200);
    expect(await summary(target, "infancia")).toBe("chamada");
    expect(await canOpenAttendance(target as never, "infancia")).toBe(true);
    expect(await hasPermission(target as never, "department", "read", "infancia")).toBe(false);
    expect((await requireClassWrite(target as never, "infancia", { attendance: true })).groups).toEqual([]);
    // Ler a frequência também fica só nas próprias turmas (nenhuma, aqui), mesmo com perfil que não é Evangelizador.
    expect(await allowedGroups(target as never, "infancia", ATTENDANCE_MODULE)).toEqual([]);
    await expect(requireClassWrite(target as never, "infancia")).rejects.toMatchObject({ status: 403 });

    expect((await save(target, { infancia: [{ module: "frequencia", edit: true }, { module: "planejamento", edit: true }] })).status).toBe(200);
    expect((await requireClassWrite(target as never, "infancia", { attendance: true })).groups).toBeNull();
    expect((await requireClassWrite(target as never, "infancia")).groups).toBeNull();
    expect(await allowedGroups(target as never, "infancia", ATTENDANCE_MODULE)).toBeNull();
  });

  it("o perfil soma: desmarcar não tira o que o perfil já dá", async () => {
    const target = await createActor("trabalhador");
    const pages = await owner(async (client) => (await client.query<{ key: string; page_key: string }>("select key, page_key from app.departments where active")).rows);
    await save(target, { doutrina: [{ module: "escalas", edit: false }] });
    for (const { key } of pages) {
      const floor = await owner(async (client) => (await client.query<{ level: string | null }>("select app.page_level_links('trabalhador','{}','{}',$1) as level", [pages.find((p) => p.key === key)!.page_key])).rows[0].level);
      const moduleAccess = await departmentModuleAccess(target, key);
      if (floor) for (const item of DEPARTMENT_MODULES[key] ?? []) expect(moduleAccess.levelOf(item.key)).not.toBeNull();
    }
  });

  it("tirar tudo apaga o resumo e fecha; a tela devolve as marcas; repetir não grava de novo", async () => {
    const target = await createActor("trabalhador", ["doutrina"], "consulta");
    current.actor = admin;
    const before = await (await access.GET(new Request("https://app.test/x"), person(target.id))).json();
    expect(before.marks.doutrina).toHaveLength(DEPARTMENT_MODULES.doutrina.length);
    expect(before.marks.doutrina.every((m: { edit: boolean }) => !m.edit)).toBe(true);

    // Salvar igual ao que já vale não transforma a pessoa em "marcada".
    const same = await save(target, { doutrina: before.marks.doutrina });
    expect((await same.json()).status).toBe("unchanged");
    expect((await departmentModuleAccess(target, "doutrina")).fine).toBe(false);

    expect((await (await save(target, { doutrina: [] })).json()).status).toBe("updated");
    expect(await summary(target, "doutrina")).toBeNull();
  });

  it("recusa o que não pode: alterar em módulo só de consulta, módulo inventado e quem não é Administrador", async () => {
    const target = await createActor("trabalhador");
    expect((await save(target, { doutrina: [{ module: "painel", edit: true }] })).status).toBe(400);
    expect((await save(target, { doutrina: [{ module: "nao-existe", edit: false }] })).status).toBe(400);
    expect((await save(target, { nao_existe: [] })).status).toBe(400);
    const intruder = await createActor("coordenador", ["doutrina"]);
    current.actor = intruder;
    expect((await access.PUT(json("PUT", { marks: { doutrina: [{ module: "escalas", edit: true }] } }), person(intruder.id))).status).toBe(403);
    expect((await access.GET(new Request("https://app.test/x"), person(target.id))).status).toBe(403);
  });

  it("fica registrado no Dedo-duro, inclusive de quem foi copiado", async () => {
    const source = await createActor("trabalhador", ["doutrina"], "consulta");
    const target = await createActor("trabalhador");
    expect((await save(target, { doutrina: [{ module: "escalas", edit: true }] }, source.id)).status).toBe(200);
    const audit = await owner(async (client) => (await client.query<{ details: string }>(
      "select details from app.audit_events where entity_id = $1 and action = 'Alteração de acesso por módulo'", [target.id]
    )).rows);
    expect(audit).toHaveLength(1);
    expect(audit[0].details).toContain("copiado de Teste trabalhador");
    expect(audit[0].details).toContain("Escala Mensal (altera)");
  });
});
