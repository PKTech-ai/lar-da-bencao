import { afterAll, describe, expect, it } from "vitest";
import { createActor, enabled } from "./setup";

/** Painéis dos departamentos: as consultas rodam no Postgres real e devolvem o formato que a tela espera. */
describe.skipIf(!enabled)("Painéis (Postgres real)", async () => {
  const { dbPool } = await import("@/lib/db");
  const paineis = await import("@/lib/paineis");
  afterAll(async () => { await dbPool().end(); });

  const check = (painel: Awaited<ReturnType<typeof paineis.painelTesouraria>>) => {
    expect(painel.kpis).toHaveLength(4);
    expect(painel.acoes).toHaveLength(2);
    if (painel.grafico) {
      expect(painel.grafico.labels.length).toBeGreaterThan(0);
      for (const serie of painel.grafico.series) expect(serie.values).toHaveLength(painel.grafico.labels.length);
    }
  };

  it("Tesouraria, Patrimônio, Assistência, Doutrina, Infância e Juventude", async () => {
    check(await paineis.painelTesouraria());
    check(await paineis.painelPatrimonio());
    check(await paineis.painelAssistencia());
    check(await paineis.painelDoutrina());
    check(await paineis.painelEvangelizacao("infancia"));
    check(await paineis.painelEvangelizacao("juventude"));
    expect((await paineis.painelTesouraria()).grafico?.labels).toHaveLength(12);
  });

  it("Presidência mostra só os departamentos que a pessoa pode abrir", async () => {
    const president = await createActor("presidente");
    const full = await paineis.painelPresidencia(president);
    expect(full.departamentos.map((d) => d.label)).toEqual(expect.arrayContaining(["Tesouraria", "Doutrina", "Patrimônio"]));
    const secretary = await createActor("secretario");
    const cards = await paineis.departmentCards(secretary);
    expect(cards.map((d) => d.label)).not.toContain("Tesouraria");
    const worker = await createActor("trabalhador", ["doutrina"]);
    expect((await paineis.departmentCards(worker)).map((d) => d.label)).toEqual(["Doutrina"]);
  });
});
