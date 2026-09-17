import { afterEach, describe, expect, it, vi } from "vitest";
import { ORPHAN_RULES, discard, sweepAttachments } from "@/lib/attachment-maintenance";

const checks = vi.hoisted(() => ({ calls: [] as Array<[string, string, string?]> }));
vi.mock("@/lib/permissions", () => ({
  assertPermission: async (_: unknown, resource: string, action: string, department?: string) => { checks.calls.push([resource, action, department]); }
}));

const { attachmentPermission, authorizeAttachment } = await import("@/lib/attachments");
const { serverEnv } = await import("@/lib/env");

describe("vínculos de anexos da onda 1", () => {
  it("material de estudo e foto seguem a permissão do departamento; download vira leitura", async () => {
    expect(attachmentPermission("study_material_doutrina")).toEqual({ resource: "department", department: "doutrina" });
    expect(attachmentPermission("evangelizando_photo_juventude")).toEqual({ resource: "department", department: "juventude" });
    checks.calls = [];
    await authorizeAttachment({} as never, "study_material_infancia", "download");
    await authorizeAttachment({} as never, "study_material_infancia", "create");
    await authorizeAttachment({} as never, "bank_statement", "download");
    expect(checks.calls).toEqual([
      ["department", "read", "infancia"],
      ["department", "create", "infancia"],
      ["tesouraria", "read", undefined]
    ]);
  });
});

describe("limpeza diária de anexos", () => {
  it("descarta órfãos de cada regra e remove binário de quarentena antiga", async () => {
    const sql: [string, unknown[]][] = [];
    const client = {
      query: async (text: string, values: unknown[] = []) => {
        sql.push([text, values]);
        if (text.includes("a.status = 'active'")) return { rows: values[0] === "study_material_%" ? [{ id: "s1" }, { id: "s2" }] : [{ id: "p1" }] };
        if (text.includes("a.status = 'quarantined'")) return { rows: [{ id: "q1" }] };
        if (text.startsWith("update app.attachments")) return { rowCount: (values[0] as string[]).length, rows: [] };
        return { rows: [], rowCount: 0 };
      }
    };
    const result = await sweepAttachments(client as never);
    expect(result).toEqual({ orphans: 3, quarantinePurged: 1 });
    expect(ORPHAN_RULES).toHaveLength(2);
    const chunkDeletes = sql.filter(([text]) => text.startsWith("delete from app.attachment_chunks")).map(([, v]) => v[0]);
    expect(chunkDeletes).toEqual([["s1", "s2"], ["p1"], ["q1"]]);
    // Quarentena mantém metadados: não muda status.
    expect(sql.filter(([text]) => text.startsWith("update app.attachments")).map(([, v]) => v[0])).toEqual([["s1", "s2"], ["p1"]]);
  });

  it("não faz nada sem ids", async () => {
    const client = { query: vi.fn() };
    expect(await discard(client, [])).toBe(0);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe("ambiente de produção", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k".repeat(30), SUPABASE_SERVICE_ROLE_KEY: "s".repeat(30),
    DATABASE_URL: "postgresql://user:pass@host:5432/db", CRON_SECRET: "c".repeat(40), BOOTSTRAP_SECRET: "b".repeat(50),
    ANTIMALWARE_API_TOKEN: "t".repeat(30), APP_URL: "https://sistema.lardabencao.org"
  };
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; vi.resetModules(); });

  it("recusa scanner local em produção e aceita em desenvolvimento", async () => {
    Object.assign(process.env, base, { ANTIMALWARE_API_URL: "http://127.0.0.1:8787/scan", VERCEL_ENV: "production" });
    const prod = await import("@/lib/env");
    expect(() => prod.serverEnv()).toThrow(/scanner HTTPS externo/);
    vi.resetModules();
    process.env.VERCEL_ENV = "development";
    const dev = await import("@/lib/env");
    expect(dev.serverEnv().ANTIMALWARE_API_URL).toBe("http://127.0.0.1:8787/scan");
    expect(typeof serverEnv).toBe("function");
  });
});
