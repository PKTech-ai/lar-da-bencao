import { describe, expect, it } from "vitest";
import { defaultAccess, levelToSave } from "./access-default";

const DEPT = ["infancia", "tesouraria"];

describe("defaultAccess", () => {
  it("Documentos e Organograma são consulta para todos", () => {
    expect(defaultAccess("documentos", null, DEPT)).toEqual({ level: "read", text: "Consulta", byPerson: false });
    expect(defaultAccess("organograma", "full", DEPT).level).toBe("read");
  });

  it("segue a concessão do perfil", () => {
    expect(defaultAccess("infancia", "full", DEPT).level).toBe("full");
    expect(defaultAccess("infancia", "read", DEPT).level).toBe("read");
    expect(defaultAccess("visaogeral", null, DEPT)).toEqual({ level: "none", text: "Sem acesso", byPerson: false });
  });

  it("marca as páginas de departamento, em que vale também o acesso de cada pessoa", () => {
    expect(defaultAccess("infancia", null, DEPT)).toEqual({ level: "none", text: "Sem acesso", byPerson: true });
    expect(defaultAccess("visaogeral", "read", DEPT).byPerson).toBe(false);
  });
});

describe("levelToSave", () => {
  const consulta = { level: "read" as const, text: "Consulta", byPerson: false };

  it("não grava o que já está valendo", () => {
    expect(levelToSave("read", null, consulta)).toBeNull();
    expect(levelToSave("none", "none", consulta)).toBeNull();
  });

  it("escolher o padrão apaga a exceção", () => {
    expect(levelToSave("read", "full", consulta)).toBe("default");
  });

  it("escolher outro nível grava exceção", () => {
    expect(levelToSave("full", null, consulta)).toBe("full");
    expect(levelToSave("none", null, consulta)).toBe("none");
  });
});
