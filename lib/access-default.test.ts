import { describe, expect, it } from "vitest";
import { defaultAccess, levelToSave } from "./access-default";

const DEPT = ["infancia", "tesouraria"];

describe("defaultAccess", () => {
  it("Documentos e Organograma são consulta para todos", () => {
    expect(defaultAccess("brecho", "documentos", null, DEPT)).toEqual({ level: "read", text: "Consulta" });
    expect(defaultAccess("coordenador", "organograma", "full", DEPT).level).toBe("read");
  });

  it("concessão completa vale sempre", () => {
    expect(defaultAccess("coordenador", "infancia", "full", DEPT).level).toBe("full");
  });

  it("coordenação depende do departamento nas páginas ligadas a um", () => {
    expect(defaultAccess("coordenador", "infancia", null, DEPT)).toEqual({ level: null, text: "Completo só para quem é do departamento" });
    expect(defaultAccess("subcoordenador", "infancia", "read", DEPT).level).toBeNull();
    expect(defaultAccess("coordenador", "visaogeral", null, DEPT)).toEqual({ level: "none", text: "Sem acesso" });
  });

  it("trabalhador ganha consulta pelo departamento", () => {
    expect(defaultAccess("trabalhador", "infancia", null, DEPT).level).toBeNull();
    expect(defaultAccess("evangelizador", "infancia", "read", DEPT).level).toBe("read");
  });

  it("os demais perfis seguem só a concessão", () => {
    expect(defaultAccess("auditoria", "infancia", "read", DEPT).level).toBe("read");
    expect(defaultAccess("auditoria", "infancia", null, DEPT).level).toBe("none");
  });
});

describe("levelToSave", () => {
  const consulta = { level: "read" as const, text: "Consulta" };
  const porDepartamento = { level: null, text: "Completo só para quem é do departamento" };

  it("não grava o que já está valendo", () => {
    expect(levelToSave("read", null, consulta)).toBeNull();
    expect(levelToSave("none", "none", consulta)).toBeNull();
  });

  it("escolher o padrão apaga a exceção", () => {
    expect(levelToSave("read", "full", consulta)).toBe("default");
  });

  it("escolher outro nível grava exceção", () => {
    expect(levelToSave("full", null, consulta)).toBe("full");
    expect(levelToSave("read", null, porDepartamento)).toBe("read");
  });
});
