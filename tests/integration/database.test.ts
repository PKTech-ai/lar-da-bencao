import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createActor, enabled, owner } from "./setup";

type Actor = Awaited<ReturnType<typeof createActor>>;
const current = vi.hoisted(() => ({ actor: null as unknown }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => current.actor }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));

const json = (method: string, body?: object, url = "https://app.test/x") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

describe.skipIf(!enabled)("Postgres real (papel de runtime lar_app)", async () => {
  const { query, transaction, dbPool } = await import("@/lib/db");
  const { appendAudit } = await import("@/lib/audit");
  const { hasPermission } = await import("@/lib/permissions");
  let admin: Actor;
  let president: Actor;
  let coordinator: Actor;
  let worker: Actor;

  beforeAll(async () => {
    admin = await createActor("administrador");
    president = await createActor("presidente");
    coordinator = await createActor("coordenador", ["doutrina", "infancia"]);
    worker = await createActor("trabalhador", ["doutrina"]);
    await owner((client) => client.query(
      "update app.feature_flags set enabled = true, uat_reference = 'teste de integração' where key like 'module\\_%' or key in ('business_modules','legacy_import')"
    ));
  });
  afterAll(async () => { await dbPool().end(); });

  it("grava no Dedo-duro com cadeia íntegra (pgcrypto via search_path)", async () => {
    await appendAudit(admin, { category: "Segurança", action: "Teste de integração", module: "Sistema" });
    await appendAudit(admin, { category: "Segurança", action: "Teste de integração 2", module: "Sistema" });
    const chain = await query<{ valid: boolean; event_count: string }>("select * from app.verify_audit_chain()");
    expect(chain.rows[0].valid).toBe(true);
    expect(Number(chain.rows[0].event_count)).toBeGreaterThanOrEqual(2);
  });

  it("runtime não altera auditoria nem exclui cadastros", async () => {
    await expect(query("delete from app.audit_events")).rejects.toThrow(/permission denied/);
    await expect(query("update app.audit_events set action = 'x'")).rejects.toThrow(/permission denied/);
    await expect(query("delete from app.workers")).rejects.toThrow(/permission denied/);
    await expect(query("update app.feature_flags set wave = '3'")).rejects.toThrow(/permission denied/);
  });

  it("matriz de permissões do seed", async () => {
    expect(await hasPermission(admin, "tesouraria", "delete")).toBe(true);
    expect(await hasPermission(coordinator, "department", "update", "doutrina")).toBe(true);
    expect(await hasPermission(coordinator, "department", "update", "juventude")).toBe(false);
    expect(await hasPermission(coordinator, "department", "update")).toBe(false);
    expect(await hasPermission(worker, "department", "read", "doutrina")).toBe(true);
    expect(await hasPermission(worker, "department", "update", "doutrina")).toBe(false);
    expect(await hasPermission(worker, "users", "admin")).toBe(false);
    expect(await hasPermission(president, "presidencia", "approve")).toBe(true);
    expect(await hasPermission(coordinator, "presidencia", "approve")).toBe(false);
    expect(await hasPermission(coordinator, "education_class", "update", "infancia")).toBe(true);
  });

  it.each([
    // [perfil, departamentos, recurso, ação, departamento, esperado]
    ["trabalhador", ["doutrina"], "department", "create", "doutrina", false],
    ["trabalhador", ["doutrina"], "audit", "read", null, false],
    ["trabalhador", ["doutrina"], "attachments", "admin", null, false],
    ["evangelizador", ["infancia"], "department", "update", "infancia", false],
    ["evangelizador", ["infancia"], "education_class", "update", "infancia", true],
    ["evangelizador", ["infancia"], "education_class", "update", "juventude", false],
    ["tesoureiro", [], "department", "read", "doutrina", false],
    ["tesoureiro", [], "tesouraria", "update", null, true],
    ["conselheiro_fiscal", [], "tesouraria", "update", null, false],
    ["conselheiro_fiscal", [], "tesouraria", "read", null, true],
    ["secretario", [], "users", "admin", null, false],
    ["secretario", [], "secretaria", "read", null, true],
    ["auditor", [], "audit", "export", null, true],
    ["auditor", [], "department", "read", "doutrina", false],
    ["vice_presidente", [], "presidencia", "approve", null, false],
    ["presidente", [], "modules", "admin", null, false],
    ["presidente", [], "users", "admin", null, false],
    ["brecho", ["assistencia_social"], "department", "read", "doutrina", false],
    ["coordenador", ["doutrina"], "attachments", "admin", null, false],
    ["coordenador", ["doutrina"], "legacy_import", "admin", null, false]
  ] as const)("autorização: %s %j %s:%s@%s → %s", async (role, departments, resource, action, department, expected) => {
    const actor = await createActor(role, [...departments]);
    expect(await hasPermission(actor, resource, action, department)).toBe(expected);
  });

  it("perfil suspenso perde todas as permissões", async () => {
    const actor = await createActor("coordenador", ["doutrina"]);
    await owner((client) => client.query("update app.users set status = 'suspended' where id = $1", [actor.id]));
    expect(await hasPermission(actor, "department", "read", "doutrina")).toBe(false);
  });

  it("revoga sessões no Auth e marca o corte na aplicação", async () => {
    const target = await createActor("trabalhador");
    await owner((client) => client.query("insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1), (gen_random_uuid(), $1)", [target.authUserId]));
    const { revokeAllSessions } = await import("@/lib/sessions");
    const removed = await transaction((client) => revokeAllSessions(client, target.id, target.authUserId));
    expect(Number(removed)).toBe(2);
    const marker = await query<{ sessions_valid_after: Date }>("select sessions_valid_after from app.users where id=$1", [target.id]);
    expect(marker.rows[0].sessions_valid_after).toBeInstanceOf(Date);
  });

  it("login registra tentativas e bloqueia após 5 falhas", async () => {
    const { attemptKey, loginLockout, recordAttempt } = await import("@/lib/login-throttle");
    const keys = { email: attemptKey("email", `x-${randomUUID()}@t.local`), ip: attemptKey("ip", randomUUID()) };
    for (let i = 0; i < 5; i += 1) await recordAttempt(keys, false);
    expect(await loginLockout(keys)).toBe(15);
    await recordAttempt(keys, true);
    const other = { ...keys, ip: attemptKey("ip", randomUUID()) };
    expect(await loginLockout(other)).toBe(0);
  });

  it("fluxo de admissão completo com escopo e decisão da Diretoria", async () => {
    const workers = await import("@/app/api/workers/route");
    const decision = await import("@/app/api/workers/[id]/decision/route");
    current.actor = coordinator;
    const created = await workers.POST(json("POST", { full_name: "Integração Passista", departments: ["doutrina"], functions: ["Passista", "Psicofônico"], available_days: [0, 3, 5] }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    current.actor = worker;
    const list = await (await workers.GET(json("GET", undefined, "https://app.test/api/workers?status=pending"))).json();
    expect(list.workers.some((w: { id: string }) => w.id === id)).toBe(true);
    current.actor = coordinator;
    expect((await decision.POST(json("POST", { decision: "approved", meeting_date: "2026-09-01", version: 1 }), { params: Promise.resolve({ id }) })).status).toBe(403);
    current.actor = president;
    const approved = await decision.POST(json("POST", { decision: "approved", meeting_date: "2026-09-01", minute_ref: "Ata teste", version: 1 }), { params: Promise.resolve({ id }) });
    expect(approved.status).toBe(200);
    const row = await query<{ status: string }>("select status from app.workers where id=$1", [id]);
    expect(row.rows[0].status).toBe("active");
  });

  it("gera, confere, aprova e publica a escala da Doutrina", async () => {
    const scale = await import("@/app/api/doutrina/scale/route");
    await owner(async (client) => {
      for (let i = 0; i < 30; i += 1) {
        const w = await client.query<{ id: string }>(
          `insert into app.workers (full_name, status, functions, available_days) values ($1, 'active',
             array['Passista','Psicofônico','Dialogador','Dirigente de Reunião','Dirigente de Estudo','Expositor de Estudo','Palestrante','Dirigente de Palestra','Entrevistador','Recepcionista'], '{0,1,3,4,5,6}') returning id`,
          [`Escala ${String(i).padStart(2, "0")}`]
        );
        await client.query("insert into app.worker_departments values ($1, 'doutrina')", [w.rows[0].id]);
      }
    });
    current.actor = coordinator;
    // Ano aleatório: o teste pode rodar de novo no mesmo banco.
    const year = 2040 + Math.floor(Math.random() * 50);
    const ym = `${year}-03`;
    await owner((client) => client.query("delete from app.scale_months where department_key = 'doutrina' and year = $1 and month = 3", [year]));
    const post = (body: object) => scale.POST(json("POST", { month: ym, ...body }));
    const generated = await post({ action: "generate" });
    expect(generated.status).toBe(200);
    expect((await generated.json()).missing).toBeGreaterThanOrEqual(0);
    const state = await (await scale.GET(json("GET", undefined, `https://app.test/x?month=${ym}`))).json();
    expect(Object.keys(state.assignments).length).toBeGreaterThan(100);
    const extra = await scale.PUT(json("PUT", { month: ym, op: "add", key: `5|4|1|${(await import("@/lib/doutrina-scale")).monthDays(ym, 5)[0]}`, version: state.month.version }));
    expect(extra.status).toBe(200);
    const { version } = await extra.json();
    const approved = await post({ action: "approve", version });
    expect(await approved.json()).toMatchObject({ status: "approved" });
    const month = await query<{ version: number }>("select version from app.scale_months where year=$1 and month=3", [year]);
    expect((await post({ action: "publish", version: month.rows[0].version })).status).toBe(200);
    current.actor = worker;
    expect((await post({ action: "regenerate" })).status).toBe(403);
  });

  it("Infância: matrícula, turma, chamada e cronograma", async () => {
    const students = await import("@/app/api/evangelizandos/route");
    const attendance = await import("@/app/api/education/[department]/attendance/route");
    const schedule = await import("@/app/api/education/[department]/schedule/route");
    const plan = await import("@/app/api/education/[department]/plan/route");
    current.actor = coordinator;
    const created = await students.POST(json("POST", { department_key: "infancia", full_name: "Criança Integração", birth_date: "2019-05-10", guardian_name: "Responsável" }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    const params = { params: Promise.resolve({ department: "infancia" }) };
    const put = await attendance.PUT(json("PUT", { month: "2026-09", entries: [{ evangelizando_id: id, date: "2026-09-06", mark: "P" }] }), params);
    expect(put.status).toBe(200);
    expect((await put.json()).marks.filter((m: { evangelizando_id: string }) => m.evangelizando_id === id)).toEqual([{ evangelizando_id: id, date: "2026-09-06", mark: "P" }]);
    expect((await schedule.PUT(json("PUT", { entries: [{ date: "2026-09-06", group: "1º Ciclo", theme: "Amor ao próximo" }] }), params)).status).toBe(200);
    expect((await schedule.PUT(json("PUT", { entries: [{ date: "2026-09-06", group: "1º Ciclo", objective: "Reconhecer gestos de amor", status: "Realizado" }] }), params)).status).toBe(200);
    const rows = await (await schedule.GET(json("GET", undefined, "https://app.test/x?month=2026-09"), params)).json();
    expect(rows.rows.find((r: { date: string; group: string }) => r.date === "2026-09-06" && r.group === "1º Ciclo")).toMatchObject({ theme: "Amor ao próximo", objective: "Reconhecer gestos de amor", status: "Realizado" });
    const planYear = 2040 + Math.floor(Math.random() * 50);
    expect((await plan.PUT(json("PUT", { year: planYear, objective: "o", priorities: "p", expected: "e", notes: "n", version: 0 }), params)).status).toBe(200);
    const saved = await (await plan.GET(json("GET", undefined, `https://app.test/x?year=${planYear}`), params)).json();
    expect(saved.saved).toBe(true);
    expect(saved.items.length).toBeGreaterThanOrEqual(6);
  });

  it("importação v215: simulação, importação idempotente e reversão", async () => {
    const { applyPlan } = await import("@/lib/legacy/importer");
    const { buildPlan } = await import("@/lib/legacy/v215");
    const legacyYear = 2040 + Math.floor(Math.random() * 50);
    const legacyMonth = `${legacyYear}-04`;
    const { monthDays } = await import("@/lib/doutrina-scale");
    const firstFriday = monthDays(legacyMonth, 5)[0];
    await owner((client) => client.query("delete from app.scale_months where department_key = 'doutrina' and year = $1 and month = 4", [legacyYear]));
    // IDs e nomes únicos por rodada: o teste pode rodar de novo no mesmo banco.
    const n = Math.floor(Math.random() * 1e9);
    const workerName = `Legado Um ${n}`;
    const { plan } = buildPlan({
      workers: [{ id: n, name: workerName, functions: ["Passista"], days: [5], active: true, approvalStatus: "Aprovado", departments: ["Doutrina", "Infância"], approvedAt: "2025-01-10" }],
      speakers: [{ id: n + 1, name: `Legado Palestrante ${n}`, active: true }],
      studyFolders: [{ id: "f-ese", name: "ESE", system: true }, { id: `novo-${n}`, name: `Pasta Legado ${n}`, parentId: "f-ese" }],
      studies: [{ id: n + 2, type: "ESE", title: `Estudo Legado ${n}`, folderId: `novo-${n}` }],
      evangelizandos: [{ id: n + 3, dept: "Infância", name: `Criança Legado ${n}`, birth: "2019-02-02", filledDate: "2026-03-01", group: "1º Ciclo", guardian: "Mãe", validThroughYear: 2026 }],
      infanciaClassEvangelizers: { "2º Ciclo": [n] },
      evangelizandoAttendance: { "2026-09": { [n + 3]: { "2026-09-13": "P" } } },
      scales: { [legacyMonth]: { a: { [`5|4|1|${firstFriday}|0`]: `w:${n}`, [`5|1|1|${firstFriday}|0`]: `s:${n + 1}` }, e: {}, status: "Publicada", reviewed: true } }
    });
    const create = (sha: string) => owner((client) => client.query<{ id: string }>(
      "insert into app.legacy_imports (source_version, source_sha256, status, created_by) values (215, $1, 'importing', $2) returning id", [sha, admin.id]
    ));

    // Simulação: executa e desfaz.
    await expect(transaction(async (client) => {
      const importId = (await client.query<{ id: string }>("insert into app.legacy_imports (source_version, source_sha256, status, created_by) values (215, 'dry', 'validating', $1) returning id", [admin.id])).rows[0].id;
      const result = await applyPlan(client, importId, plan, admin);
      expect(result.report.worker).toEqual({ created: 1, skipped: 0 });
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect((await query("select 1 from app.workers where full_name = $1", [workerName])).rowCount).toBe(0);

    const importId = (await create(randomUUID().replaceAll("-", "").padEnd(64, "0"))).rows[0].id;
    const first = await transaction((client) => applyPlan(client, importId, plan, admin));
    expect(first.report).toMatchObject({
      worker: { created: 1 }, speaker: { created: 1 }, study: { created: 1 }, evangelizando: { created: 1 },
      group_evangelizer: { created: 1 }, evangelizando_attendance: { created: 1 }, scale_month: { created: 1 }
    });
    expect(first.report.study_folder).toEqual({ created: 1, skipped: 1 });
    await owner((client) => client.query("update app.legacy_imports set status='completed' where id=$1", [importId]));

    const second = await transaction((client) => applyPlan(client, importId, plan, admin));
    expect(second.report.worker).toEqual({ created: 0, skipped: 1 });
    expect(second.report.evangelizando).toEqual({ created: 0, skipped: 1 });

    const slot = await query<{ slot_value: string }>(
      "select a.slot_value from app.scale_assignments a join app.scale_months m on m.id = a.scale_month_id where m.year = $1 and m.month = 4 and a.slot_key = $2", [legacyYear, `5|4|1|${firstFriday}|0`]
    );
    expect(slot.rows[0].slot_value).toMatch(/^w:[0-9a-f-]{36}$/);

    const counts = await transaction((client) => client.query<{ counts: Record<string, number> }>("select app.rollback_legacy_import($1, $2) as counts", [importId, admin.id]));
    expect(counts.rows[0].counts).toMatchObject({ worker: 1, speaker: 1, study: 1, evangelizando: 1, scale_month: 1, study_folder: 1 });
    expect((await query("select 1 from app.workers where full_name = $1", [workerName])).rowCount).toBe(0);
    expect((await query("select 1 from app.study_folders where title = 'ESE' and department_key = 'doutrina'")).rowCount).toBe(1);
    expect((await query("select status from app.legacy_imports where id=$1", [importId])).rows[0]).toEqual({ status: "rolled_back" });
  });

  it("limpeza de anexos órfãos e descarte", async () => {
    const { sweepAttachments } = await import("@/lib/attachment-maintenance");
    const fileId = await owner(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into app.attachments (owner_type, owner_id, department_key, filename, mime_type, size_bytes, sha256, chunk_count, status, upload_token_hash, uploaded_by, activated_at)
         values ('study_material_doutrina', $1, null, 'orfao.pdf', 'application/pdf', 5, repeat('a', 64), 1, 'active', '\\x00', $2, now() - interval '2 days') returning id`,
        [randomUUID(), admin.id]
      );
      await client.query("insert into app.attachment_chunks (attachment_id, part_no, size_bytes, sha256, data) values ($1, 0, 5, repeat('b', 64), '\\x0102030405')", [inserted.rows[0].id]);
      return inserted.rows[0].id;
    });
    const result = await transaction((client) => sweepAttachments(client));
    expect(result.orphans).toBeGreaterThanOrEqual(1);
    const row = await query<{ status: string }>("select status from app.attachments where id=$1", [fileId]);
    expect(row.rows[0].status).toBe("deleted");
    expect((await query("select 1 from app.attachment_chunks where attachment_id=$1", [fileId])).rowCount).toBe(0);
  });
  it("acesso por página: biênio vencido corta o diretor e a exceção da matriz vale", async () => {
    const effective = await createActor("membro_efetivo");
    expect(await hasPermission(effective, "department", "read", "patrimonio")).toBe(false);
    await owner((client) => client.query("insert into app.page_grant_overrides (role_key, page_key, level) values ('membro_efetivo','patrimonio','read')"));
    try {
      expect(await hasPermission(effective, "department", "read", "patrimonio")).toBe(true);
      expect(await hasPermission(effective, "department", "update", "patrimonio")).toBe(false);
    } finally {
      await owner((client) => client.query("delete from app.page_grant_overrides where role_key='membro_efetivo'"));
    }
    // Presidente sem biênio vigente perde o acesso (15 dias de tolerância após o fim).
    const outgoing = await createActor("presidente");
    expect(await hasPermission(outgoing, "presidencia", "approve")).toBe(true);
    await owner((client) => client.query(
      "update app.bienniums set starts_on = current_date - 800, ends_on = current_date - 20 where id = (select biennium_id from app.users where id = $1)", [outgoing.id]
    ));
    expect(await hasPermission(outgoing, "presidencia", "approve")).toBe(false);
    expect(await query<{ allowed: boolean }>("select app.user_access_allowed($1) as allowed", [outgoing.id]).then((r) => r.rows[0].allowed)).toBe(false);
  });

  it("patrimônio: cadastro, memorando de baixa e decisão da Diretoria", async () => {
    const list = await import("@/app/api/r/[resource]/route");
    const disposals = await import("@/app/api/patrimonio/baixas/route");
    const decide = await import("@/app/api/patrimonio/baixas/[id]/route");
    const patrimony = await createActor("coordenador", ["patrimonio"]);
    current.actor = patrimony;
    const resource = { params: Promise.resolve({ resource: "patrimonio-bens" }) };
    const tombamento = `PAT-${randomUUID().slice(0, 8)}`;
    const ficha = { tombamento, condition: "Usado", description: "Cadeira do salão", department_key: "patrimonio", entry_date: "2020-05-10", value_cents: 15000, location: "Salão", responsible: "Ana", notes: "" };
    const created = await list.POST(json("POST", ficha), resource);
    expect(created.status).toBe(201);
    const assetId = (await created.json()).id as string;
    // Tombamento repetido (com espaços e caixa diferente) é recusado.
    const duplicated = await list.POST(json("POST", { ...ficha, tombamento: ` ${tombamento.toLowerCase()} ` }), resource);
    expect(duplicated.status).toBe(409);

    const version = (await query<{ version: number }>("select version from app.patrimony_assets where id=$1", [assetId])).rows[0].version;
    const memo = await disposals.POST(json("POST", { asset_id: assetId, asset_version: version, request_date: "2026-09-10", reason: "Assento quebrado.", destination: "Descarte" }));
    expect(memo.status).toBe(201);
    const { id: memoId, number } = await memo.json();
    expect(number).toMatch(/^PAT-BAIXA-2026-\d{4}$/);
    // Um pendente por bem.
    expect((await disposals.POST(json("POST", { asset_id: assetId, asset_version: version, request_date: "2026-09-11", reason: "Outro" }))).status).toBe(409);

    // Coordenador do Patrimônio não decide.
    const memoParams = { params: Promise.resolve({ id: memoId }) };
    expect((await decide.POST(json("POST", { action: "decide", version: 1, decision: "approved", decision_date: "2026-09-12", disposal_date: "2026-09-12" }), memoParams)).status).toBe(403);

    current.actor = president;
    const approved = await decide.POST(json("POST", { action: "decide", version: 1, decision: "approved", decision_date: "2026-09-12", disposal_date: "2026-09-12", reference: "Ata 5/2026", notes: "" }), memoParams);
    expect(approved.status).toBe(200);
    const asset = await query<{ disposal_date: string }>("select to_char(disposal_date,'YYYY-MM-DD') as disposal_date from app.patrimony_assets where id=$1", [assetId]);
    expect(asset.rows[0].disposal_date).toBe("2026-09-12");
    expect((await query("select 1 from app.audit_events where entity_id=$1 and action like 'Diretoria autorizou%'", [memoId])).rowCount).toBe(1);
    // Decisão repetida não passa.
    expect((await decide.POST(json("POST", { action: "decide", version: 2, decision: "rejected", decision_date: "2026-09-13", notes: "x" }), memoParams)).status).toBe(409);
  });

  it("escala de limpeza: domingo, repetição no ano e taxa de serviço", async () => {
    const roster = await import("@/app/api/patrimonio/limpeza/route");
    const item = await import("@/app/api/patrimonio/limpeza/[id]/route");
    const patrimony = await createActor("coordenador", ["patrimonio"]);
    current.actor = patrimony;
    const workerId = await owner(async (client) => {
      const inserted = await client.query<{ id: string }>("insert into app.workers (full_name, status) values ($1,'active') returning id", [`Limpeza ${randomUUID().slice(0, 6)}`]);
      await client.query("insert into app.worker_departments (worker_id, department_key) values ($1,'patrimonio')", [inserted.rows[0].id]);
      return inserted.rows[0].id;
    });
    // Sábado é recusado; domingo de recesso também.
    expect((await roster.POST(json("POST", { clean_date: "2026-03-07", worker_ids: [workerId], status: "scheduled" }))).status).toBe(400);
    expect((await roster.POST(json("POST", { clean_date: "2026-01-04", worker_ids: [workerId], status: "scheduled" }))).status).toBe(400);
    const first = await roster.POST(json("POST", { clean_date: "2026-03-08", worker_ids: [workerId], status: "scheduled" }));
    expect(first.status).toBe(201);
    const rosterId = (await first.json()).ids[0] as string;
    // Mesmo trabalhador no mesmo domingo: recusado.
    expect((await roster.POST(json("POST", { clean_date: "2026-03-08", worker_ids: [workerId], status: "scheduled" }))).status).toBe(409);
    // Repetição no mesmo ano pede confirmação e depois é registrada.
    const repeat = await roster.POST(json("POST", { clean_date: "2026-03-15", worker_ids: [workerId], status: "scheduled" }));
    expect(repeat.status).toBe(409);
    expect((await repeat.json()).code).toBe("CLEANING_REPEAT");
    const kept = await roster.POST(json("POST", { clean_date: "2026-03-15", worker_ids: [workerId], status: "scheduled", keep_repeats: true }));
    expect(kept.status).toBe(201);
    expect((await query("select 1 from app.cleaning_conflict_decisions where worker_id=$1 and year=2026", [workerId])).rowCount).toBe(1);

    // Taxa de serviço: R$ 50,00 e recebimento com data e forma.
    const itemParams = { params: Promise.resolve({ id: rosterId }) };
    const base = { clean_date: "2026-03-08", worker_id: workerId, status: "fee", keep_repeats: true };
    expect((await item.PATCH(json("PATCH", { ...base, version: 1, payment_status: "paid", payment_date: "2026-03-09" }), itemParams)).status).toBe(400);
    expect((await item.PATCH(json("PATCH", { ...base, version: 1, payment_status: "paid", payment_date: "2026-03-09", payment_method: "PIX", payment_reference: "e2e" }), itemParams)).status).toBe(200);
    const row = await query<{ fee_cents: number; payment_status: string }>("select fee_cents, payment_status from app.cleaning_roster where id=$1", [rosterId]);
    expect(row.rows[0]).toEqual({ fee_cents: 5000, payment_status: "paid" });
    // Recebido trava alteração da escala até voltar para pendente com motivo.
    expect((await item.PATCH(json("PATCH", { ...base, version: 2, status: "done", payment_status: "paid" }), itemParams)).status).toBe(400);
    expect((await item.PATCH(json("PATCH", { ...base, version: 2, payment_status: "pending" }), itemParams)).status).toBe(400);
    expect((await item.PATCH(json("PATCH", { ...base, version: 2, payment_status: "pending", reason: "Estorno do PIX." }), itemParams)).status).toBe(200);
  });
});
