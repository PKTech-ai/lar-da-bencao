import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_KEY, buildPlan, isDemoPackage, isDemoPlan, readPackage } from "@/lib/legacy/v215";
import { listEntries, readEntry } from "@/lib/legacy/zip";

/** Monta um ZIP válido (DEFLATE) como o JSZip do mock. */
function makeZip(files: Record<string, string | Uint8Array>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content);
    const data = deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

const database = {
  workers: [
    { id: 1, name: "Maria Real", phone: "92 9", functions: ["Passista", "Inexistente"], days: [0, 5, 9], active: true, approvalStatus: "Aprovado", originDept: "Doutrina", departments: ["Doutrina", "Infância"], requestedAt: "2025-02-01T10:00:00Z", approvedAt: "2025-02-10" },
    { id: 2, name: "João Pendente", functions: ["Palestrante"], days: [5], active: false, approvalStatus: "Pendente", originDept: "Infância", departments: ["Infância"] },
    { id: 3, name: "Ana Reprovada", functions: [], days: [], active: false, approvalStatus: "Rejeitado", departments: ["Juventude"], approvalHistory: [{ status: "Rejeitado", meetingDate: "2025-03-01", by: "Presidente", reason: "Ficha incompleta" }] },
    { id: 4, name: "", departments: ["Doutrina"] }
  ],
  speakers: [{ id: 1001, name: "Palestrante Real", house: "Casa", city: "Manaus/AM", themes: ["Perdão"], active: true }],
  studyFolders: [{ id: "f-ese", name: "ESE", parentId: null, system: true }, { id: "sub", name: "Roteiros 2025", parentId: "f-ese" }],
  studies: [{ id: 1, type: "ESE", code: "ROT. 1", title: "Tema", ref: "Cap. I", folderId: "sub", file: "rot1.pdf" }],
  evangelizandos: [
    { id: 7, dept: "Infância", name: "Criança Real", birth: "2019-04-01", filledDate: "2025-03-02", group: "1º Ciclo", guardian: "Mãe", validThroughYear: 2026, photo: "data:image/png;base64,iVBORw0KGgo=" },
    { id: 8, dept: "Tesouraria", name: "Inválido", birth: "2019-04-01" }
  ],
  infanciaClassEvangelizers: { "1º Ciclo": [1, 2, 2, 99] },
  evangelizandoAttendance: { "2026-09": { 7: { "2026-09-06": "P", 13: "F", "2026-09-07": "X" } } },
  evangelizandoCronograma: { k: { dept: "Infância", ym: "2026-09", date: "2026-09-06", group: "1º Ciclo", theme: "Amor", responsible: "Maria" } },
  doctrineAttendance: { "2026-09": { "3|2|ese_g1": "12", "3|2|__total__": "12", "3|9|mediunica": "" } },
  scales: { "2026-09": { a: { "3|0|0|2|0": "w:1", "5|1|1|4|0": "s:1001" }, e: { "3|0|0|2|0": 1 }, status: "Aprovada", reviewed: true }, "2026-10": { a: {}, deletedAt: "x" } },
  doctrineContact: { phone: "(92) 90000-0000" },
  accessControl: { users: [{ id: 1, profile: "administrador" }] }
};

function makePackage(overrides: { data?: string; manifest?: object; binary?: Uint8Array } = {}) {
  const data = overrides.data ?? JSON.stringify({ database, databases: [] });
  const bin = new Uint8Array([1, 2, 3]);
  const manifest = {
    format: "lar-bencao-completo", formatVersion: 1, appVersion: 215, key: LEGACY_KEY, createdAt: "2026-09-01T12:00:00Z", createdBy: "Admin",
    sha256: sha(JSON.stringify({ database, databases: [] })), binary: [{ path: "anexos/000001.bin", sha256: sha(bin), size: 3 }],
    counts: { records: 0, files: 1, bytes: 3 }, ...overrides.manifest
  };
  return makeZip({ "manifesto.json": JSON.stringify(manifest), "dados.json": data, "anexos/000001.bin": overrides.binary ?? bin });
}

describe("leitor de ZIP", () => {
  it("lista e descompacta entradas", async () => {
    const zip = makeZip({ "a.txt": "olá mundo", "b/c.json": "{}" });
    const entries = listEntries(zip);
    expect([...entries.keys()]).toEqual(["a.txt", "b/c.json"]);
    expect(new TextDecoder().decode(await readEntry(zip, entries.get("a.txt")!))).toBe("olá mundo");
  });

  it("recusa arquivo que não é ZIP e caminhos perigosos", () => {
    expect(() => listEntries(new Uint8Array(100))).toThrow("ZIP inválido");
    expect(() => listEntries(makeZip({ "../x": "1" }))).toThrow("Caminho inválido");
  });
});

describe("pacote v215", () => {
  it("aceita pacote íntegro", async () => {
    const result = await readPackage(makePackage());
    expect(result.manifest.appVersion).toBe(215);
    expect(Array.isArray(result.database.workers)).toBe(true);
  });

  it("recusa dados alterados, anexo alterado e manifesto de outro sistema", async () => {
    await expect(readPackage(makePackage({ data: JSON.stringify({ database: { workers: [] } }) }))).rejects.toThrow("alterado");
    await expect(readPackage(makePackage({ binary: new Uint8Array([9, 9, 9]) }))).rejects.toThrow("Anexo alterado");
    await expect(readPackage(makePackage({ manifest: { key: "outro" } }))).rejects.toThrow("Manifesto incompatível");
  });

  it("mapeia a onda 1 com avisos e relatório de origem", () => {
    const { plan, photos, warnings, origin } = buildPlan(database);
    expect(plan.workers.map((w) => [w.full_name, w.status])).toEqual([["Maria Real", "active"], ["João Pendente", "pending"], ["Ana Reprovada", "rejected"]]);
    expect(plan.workers[0]).toMatchObject({ functions: ["Passista"], available_days: [0, 5], departments: ["doutrina", "infancia"], origin_department: "doutrina" });
    expect(plan.workers[0].decisions).toEqual([expect.objectContaining({ decision: "approved", meeting_date: "2025-02-10" })]);
    expect(plan.workers[1].functions).toEqual([]);
    expect(plan.workers[2].decisions[0]).toMatchObject({ decision: "rejected", reason: "Ficha incompleta", recorded_by: "Presidente" });
    expect(plan.folders.map((f) => f.legacy_id)).toEqual(["doutrina:f-ese", "doutrina:sub"]);
    expect(plan.studies[0]).toMatchObject({ study_type: "ESE", folder_legacy_id: "doutrina:sub" });
    expect(plan.evangelizandos).toHaveLength(1);
    expect(photos).toHaveLength(1);
    expect(plan.group_evangelizers.map((g) => [g.worker_legacy_id, g.position])).toEqual([["1", 0], ["2", 1]]);
    expect([...plan.attendance].sort((a, b) => a.date.localeCompare(b.date))).toEqual([
      { evangelizando_legacy_id: "7", date: "2026-09-06", mark: "P" },
      { evangelizando_legacy_id: "7", date: "2026-09-13", mark: "F" }
    ]);
    expect(plan.doctrine_attendance).toEqual([{ date: "2026-09-02", row_id: "ese_g1", value: 12 }]);
    expect(plan.scales).toEqual([{ month: "2026-09", status: "approved", reviewed: true, slots: [["3|0|0|2|0", "w:1", true], ["5|1|1|4|0", "s:1001", false]] }]);
    expect(plan.doctrine_phone).toBe("(92) 90000-0000");
    expect(warnings.some((w) => w.includes("rot1.pdf"))).toBe(true);
    expect(warnings.some((w) => w.includes("Evangelizando 8"))).toBe(true);
    expect(origin).toMatchObject({ workers: 4, evangelizandos: 2, users_not_imported: 1 });
  });

  it("detecta a semente fictícia do mock", () => {
    const demo = { workers: ["André Almeida", "Beatriz Barbosa", "Carlos Cardoso", "Daniela Dias", "Eduardo Esteves"].map((name, id) => ({ id, name })) };
    expect(isDemoPackage(demo)).toBe(true);
    expect(isDemoPackage(database)).toBe(false);
    expect(isDemoPlan({ workers: demo.workers.map((w) => ({ full_name: w.name })), speakers: [] })).toBe(true);
  });
});

const route = vi.hoisted(() => ({ committed: [] as string[], rolledBack: false, audits: [] as string[], existing: false }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => ({ id: "00000000-0000-4000-8000-000000000001", name: "Admin" }) }));
vi.mock("@/lib/permissions", () => ({ assertPermission: async () => undefined }));
vi.mock("@/lib/feature-flags", () => ({ requireFlag: async () => undefined }));
vi.mock("@/lib/audit", () => ({ appendAudit: async (_: unknown, input: { action: string }) => { route.audits.push(input.action); } }));
vi.mock("@/lib/legacy/importer", () => ({
  applyPlan: async (client: { query: (t: string) => Promise<unknown> }) => {
    await client.query("insert fake data");
    return { report: { worker: { created: 3, skipped: 0 } }, warnings: [], students: { 7: "new-id" } };
  }
}));
vi.mock("@/lib/db", () => ({
  query: async () => ({ rowCount: route.existing ? 1 : 0, rows: [] }),
  transaction: async (work: (client: unknown) => Promise<unknown>) => {
    const writes: string[] = [];
    const client = {
      query: async (text: string) => {
        if (text.includes("insert into app.legacy_imports") && route.existing && !text.includes("validating")) {
          throw Object.assign(new Error("dup"), { code: "23505" });
        }
        if (text.includes("rollback_legacy_import")) { route.rolledBack = true; return { rows: [{ counts: { worker: 3 } }] }; }
        writes.push(text);
        return { rows: [{ id: "import-1" }], rowCount: 1 };
      }
    };
    const result = await work(client);
    route.committed.push(...writes);
    return result;
  }
}));

const api = await import("@/app/api/legacy-import/route");
const plan = buildPlan(database).plan;
const body = (action: string, extra: object = {}) => new Request("https://app.test/x", {
  method: "POST",
  body: JSON.stringify({ action, manifest: { sha256: "a".repeat(64), appVersion: 215, createdAt: "2026-09-01", counts: { records: 0, files: 0, bytes: 0 } }, origin: {}, plan, ...extra })
});

describe("API de importação", () => {
  beforeEach(() => {
    route.committed = [];
    route.rolledBack = false;
    route.audits = [];
    route.existing = false;
    delete process.env.VERCEL_ENV;
  });

  it("simulação não grava nada", async () => {
    const response = await api.POST(body("dry-run"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "dry-run", report: { worker: { created: 3 } } });
    expect(route.committed).toEqual([]);
    expect(route.audits).toEqual(["Simulação de importação v215"]);
  });

  it("importação grava, conclui e devolve os novos evangelizandos", async () => {
    const response = await api.POST(body("commit"));
    expect(await response.json()).toMatchObject({ mode: "commit", importId: "import-1", students: { 7: "new-id" } });
    expect(route.committed.some((sql) => sql.includes("status='completed'"))).toBe(true);
  });

  it("recusa importar o mesmo pacote duas vezes", async () => {
    route.existing = true;
    const response = await api.POST(body("commit"));
    expect(response.status).toBe(409);
    expect(route.audits).toContain("Falha na importação v215");
  });

  it("bloqueia pacote de demonstração em produção", async () => {
    process.env.VERCEL_ENV = "production";
    const demoPlan = { ...plan, workers: ["André Almeida", "Beatriz Barbosa", "Carlos Cardoso", "Daniela Dias", "Eduardo Esteves"].map((full_name, i) => ({ ...plan.workers[0], legacy_id: String(i), full_name })) };
    const response = await api.POST(body("commit", { plan: demoPlan }));
    expect(response.status).toBe(422);
    expect(route.committed).toEqual([]);
  });

  it("reverte uma importação", async () => {
    const response = await api.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify({ action: "rollback", import_id: "00000000-0000-4000-8000-000000000009" }) }));
    expect(await response.json()).toEqual({ status: "rolled_back", counts: { worker: 3 } });
    expect(route.rolledBack).toBe(true);
  });
});
