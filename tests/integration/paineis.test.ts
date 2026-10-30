import { afterAll, describe, expect, it } from "vitest";
import { createActor, enabled, owner } from "./setup";

/** Painéis dos departamentos: as consultas rodam no Postgres real e devolvem o formato que a tela espera. */
describe.skipIf(!enabled)("Painéis (Postgres real)", async () => {
  const { dbPool } = await import("@/lib/db");
  const paineis = await import("@/lib/paineis");
  afterAll(async () => { await dbPool().end(); });

  const check = (painel: Awaited<ReturnType<typeof paineis.painelTesouraria>>) => {
    expect(painel.kpis).toHaveLength(4);
    expect(painel.acoes.length).toBeGreaterThanOrEqual(1);
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

  it("Secretaria, Conselho Fiscal, Jurídico, Eventos e Livraria", async () => {
    const admin = await createActor("administrador");
    check(await paineis.painelSecretaria());
    check(await paineis.painelConselho());
    check(await paineis.painelJuridico());
    check(await paineis.painelEventos(admin));
    check(await paineis.painelDivulgacao());
  });

  it("os alertas novos seguem os dados: ata em rascunho, caixa sem parecer e prazo da eleição", async () => {
    const before = await paineis.painelSecretaria();
    await owner(async (c) => {
      await c.query("insert into app.meetings (title, meeting_date, status) values ('Reunião de teste', current_date - 3, 'Rascunho')");
      await c.query("insert into app.treasury_months (reference_month, status) values ('2001-03', 'Fechado') on conflict (reference_month) do update set status = 'Fechado'");
      await c.query("update app.elections set archived_at = now() where archived_at is null");
      await c.query("insert into app.elections (title, year, stage, vote_date) values ('Eleição de teste', 2099, 'Inscrições', current_date + 3)");
    });
    expect(Number((await paineis.painelSecretaria()).kpis[1].value)).toBe(Number(before.kpis[1].value) + 1);
    const conselho = await paineis.painelConselho();
    expect(conselho.alertas.some((a) => a.label.includes("mar/2001"))).toBe(true);
    const juridico = await paineis.painelJuridico();
    expect(juridico.kpis[0].value).toBe("Inscrições");
    expect(juridico.kpis[1].hint).toContain("Votação");
    expect(juridico.alertas).toHaveLength(1);
    await owner(async (c) => {
      await c.query("insert into app.fiscal_reviews (reference_month, status, review_date) values ('2001-03', 'Deferido', current_date)");
    });
    expect((await paineis.painelConselho()).alertas.some((a) => a.label.includes("mar/2001"))).toBe(false);
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
