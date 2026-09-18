import { describe, expect, it } from "vitest";
import { attachmentPermission } from "@/lib/attachments";
import { RESOURCES, RESOURCE_LIST } from "@/lib/resources/registry";
import { inputSchema, resourceDDL } from "@/lib/resources/schema";

describe("catálogo de cadastros das ondas 2 e 3", () => {
  it("cada cadastro tem chave única, tabela própria ou escopo fixo, e ordenação", () => {
    const keys = RESOURCE_LIST.map((def) => def.key);
    expect(new Set(keys).size).toBe(keys.length);
    const byTable = new Map<string, number>();
    for (const def of RESOURCE_LIST) byTable.set(def.table, (byTable.get(def.table) ?? 0) + 1);
    for (const [table, count] of byTable) {
      // Duas definições na mesma tabela só valem com escopo fixo (Brechó e Clube de Mães).
      if (count > 1) expect(RESOURCE_LIST.filter((d) => d.table === table).every((d) => d.fixed)).toBe(true);
    }
    for (const def of RESOURCE_LIST) {
      expect(def.orderBy, def.key).toBeTruthy();
      expect(def.fields.length, def.key).toBeGreaterThan(0);
      expect(RESOURCES[def.key]).toBe(def);
    }
  });

  it("todo anexo declarado tem permissão mapeada e tipos de arquivo conferidos", () => {
    for (const def of RESOURCE_LIST) {
      if (!def.attachments) continue;
      expect(() => attachmentPermission(def.attachments!.ownerType), def.key).not.toThrow();
      expect(def.attachments.kinds.length, def.key).toBeGreaterThan(0);
      for (const kind of def.attachments.kinds) expect(kind.mimes.length, `${def.key}/${kind.key}`).toBeGreaterThan(0);
      expect(def.attachments.maxPerRecord, def.key).toBeGreaterThan(0);
    }
  });

  it("filtros e busca apontam para campos existentes", () => {
    for (const def of RESOURCE_LIST) {
      const names = new Set(def.fields.map((f) => f.name));
      for (const filter of def.filters ?? []) expect(names.has(filter.name), `${def.key}: filtro ${filter.name}`).toBe(true);
      for (const column of def.search) expect(names.has(column), `${def.key}: busca ${column}`).toBe(true);
    }
  });

  it("o DDL de referência e o schema de entrada saem para todos os cadastros", () => {
    for (const def of RESOURCE_LIST) {
      expect(resourceDDL(def), def.key).toContain(`create table if not exists app.${def.table}`);
      expect(() => inputSchema(def), def.key).not.toThrow();
    }
  });
});
