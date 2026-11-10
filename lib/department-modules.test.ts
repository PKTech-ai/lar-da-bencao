import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_MODULE, CALL_MODULE, DEPARTMENT_MODULES, PAGE_DEPARTMENT, levelFromMarks, marksFromLevel, resolveModuleLevel, workerModuleOf
} from "@/lib/department-modules";
import { MODULE_PAGES, moduleOfResource, SHARED_RESOURCES } from "@/lib/module-pages";
import { RESOURCES } from "@/lib/resources/registry";

const everything = (department: string) => DEPARTMENT_MODULES[department].map((m) => ({ module: m.key, edit: !m.viewOnly }));

describe("catálogo de módulos", () => {
  it("tem os 12 departamentos e cada aba de módulo tem a sua caixinha", () => {
    expect(Object.keys(DEPARTMENT_MODULES)).toHaveLength(12);
    for (const page of MODULE_PAGES) {
      const department = PAGE_DEPARTMENT[page.slug];
      expect(department, page.slug).toBeTruthy();
      const keys = DEPARTMENT_MODULES[department].map((m) => m.key);
      for (const section of page.sections) expect(keys, `${page.slug}/${section.slug}`).toContain(section.slug || "painel");
      expect(keys.length).toBe(page.sections.length);
    }
  });

  it("todo cadastro pertence a um módulo existente", () => {
    for (const key of Object.keys(RESOURCES)) {
      const target = moduleOfResource(key);
      expect(target, key).not.toBeNull();
      expect(DEPARTMENT_MODULES[target!.department].map((m) => m.key), key).toContain(target!.module);
    }
  });

  it("cadastros compartilhados apontam para módulos do mesmo departamento", () => {
    for (const [key, shared] of Object.entries(SHARED_RESOURCES)) {
      const target = moduleOfResource(key)!;
      for (const item of shared.modules) expect(DEPARTMENT_MODULES[target.department].map((m) => m.key), key).toContain(item);
    }
  });

  it("fichas: Evangelização usa Evangelizadores, os demais Trabalhadores", () => {
    expect(workerModuleOf("infancia")).toBe("evangelizadores");
    expect(workerModuleOf("doutrina")).toBe("trabalhadores");
  });
});

describe("resumo do acesso por departamento", () => {
  it("nada marcado apaga o resumo", () => {
    expect(levelFromMarks("doutrina", [])).toBeNull();
  });

  it("só a chamada, com Alterar, continua Chamada (página do departamento fechada)", () => {
    expect(levelFromMarks("infancia", [{ module: CALL_MODULE, edit: true }])).toBe("chamada");
  });

  it("chamada só para consultar não ganha direito de lançar", () => {
    expect(levelFromMarks("infancia", [{ module: CALL_MODULE, edit: false }])).toBe("consulta");
  });

  it("Coordenação só com tudo marcado e tudo alterável", () => {
    expect(levelFromMarks("tesouraria", everything("tesouraria"))).toBe("coordenacao");
    const [first, ...rest] = everything("tesouraria").filter((m) => m.edit);
    expect(levelFromMarks("tesouraria", [{ ...first, edit: false }, ...rest, ...everything("tesouraria").filter((m) => !m.edit)])).toBe("consulta");
    expect(levelFromMarks("tesouraria", [{ module: "caixa", edit: true }])).toBe("consulta");
  });

  it("converter o nível antigo em marcas e voltar dá o mesmo nível", () => {
    for (const department of Object.keys(DEPARTMENT_MODULES)) {
      expect(levelFromMarks(department, marksFromLevel(department, "consulta"))).toBe("consulta");
      expect(levelFromMarks(department, marksFromLevel(department, "coordenacao"))).toBe("coordenacao");
    }
    expect(levelFromMarks("infancia", marksFromLevel("infancia", "chamada"))).toBe("chamada");
    expect(marksFromLevel("doutrina", "chamada")).toEqual([]);
  });
});

describe("nível do módulo", () => {
  const level = (module: string, input: Partial<Parameters<typeof resolveModuleLevel>[0]>) =>
    resolveModuleLevel({ module, floor: null, level: null, marks: {}, ...input });

  it("sem marcas, vale o nível antigo", () => {
    expect(level("caixa", { level: "coordenacao" })).toBe("full");
    expect(level("caixa", { level: "consulta" })).toBe("read");
    expect(level("caixa", { level: "chamada" })).toBeNull();
    expect(level(CALL_MODULE, { level: "chamada" })).toBe("full");
    expect(level(ATTENDANCE_MODULE, { level: "chamada" })).toBeNull();
  });

  it("com marcas, só o que foi marcado", () => {
    const marks = { caixa: true, extrato: false };
    expect(level("caixa", { level: "consulta", marks })).toBe("full");
    expect(level("extrato", { level: "consulta", marks })).toBe("read");
    expect(level("lancamentos", { level: "consulta", marks })).toBeNull();
  });

  it("o perfil soma: nunca tira o que o perfil já dá", () => {
    expect(level("lancamentos", { floor: "full", marks: { caixa: false } })).toBe("full");
    expect(level("lancamentos", { floor: "read", marks: { caixa: false } })).toBe("read");
    expect(level("caixa", { floor: "read", marks: { caixa: true } })).toBe("full");
  });
});
