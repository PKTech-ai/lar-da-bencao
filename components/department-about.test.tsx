import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DepartmentAbout } from "@/components/department-about";
import { SuggestionsBox } from "@/components/suggestions-box";
import { DEPARTMENT_INFO } from "@/lib/department-info";

describe("quadro Sobre o departamento", () => {
  it("nasce fechado, com o título, a base normativa e as atividades", () => {
    const html = renderToStaticMarkup(<DepartmentAbout info={DEPARTMENT_INFO.doutrina} coordinators={["Ana Souza"]} />);
    expect(html).toMatch(/^<details class="op-department">/);
    expect(html).toContain("Sobre o departamento — Dpto de Doutrina");
    expect(html).toContain("Regimento Interno — arts. 39 a 49");
    expect(html).toContain("Ana Souza");
    for (const activity of DEPARTMENT_INFO.doutrina.activities) expect(html).toContain(activity);
  });

  it("avisa quando não há coordenador vinculado", () => {
    const html = renderToStaticMarkup(<DepartmentAbout info={DEPARTMENT_INFO.eventos} coordinators={[]} />);
    expect(html).toContain("Sem coordenador vinculado");
  });
});

describe("caixa de sugestões", () => {
  it("leva para a central de sugestões", () => {
    const html = renderToStaticMarkup(<SuggestionsBox />);
    expect(html).toContain("Sugestões e melhorias");
    expect(html).toContain('href="/sistema/sugestoes"');
  });
});
