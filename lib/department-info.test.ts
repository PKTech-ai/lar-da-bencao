import { describe, expect, it } from "vitest";
import { DEPARTMENT_INFO, departmentInfoFor } from "@/lib/department-info";

describe("quadro dos departamentos", () => {
  it("tem os 12 departamentos do visual, todos preenchidos", () => {
    expect(Object.keys(DEPARTMENT_INFO)).toHaveLength(12);
    for (const info of Object.values(DEPARTMENT_INFO)) {
      expect(info.title).not.toBe("");
      expect(info.purpose).not.toBe("");
      expect(info.activities.length).toBeGreaterThan(0);
    }
  });

  it("traz a base normativa da Doutrina igual ao visual", () => {
    expect(DEPARTMENT_INFO.doutrina.basis).toBe("Regimento Interno — arts. 39 a 49");
    expect(DEPARTMENT_INFO.doutrina.title).toBe("Dpto de Doutrina");
  });

  it("acha o quadro pelo slug do módulo e devolve null para página sem departamento", () => {
    expect(departmentInfoFor("assistencia")?.title).toContain("Assist");
    expect(departmentInfoFor("presidencia")).toBe(DEPARTMENT_INFO.presidencia);
    expect(departmentInfoFor("documentos")).toBeNull();
  });
});
