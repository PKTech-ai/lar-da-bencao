import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createActor, enabled, owner } from "./setup";

/** Casos de aceitação do módulo de Ingressos (PRD seção 13) contra Postgres real. */
type Actor = Awaited<ReturnType<typeof createActor>>;
const current = vi.hoisted(() => ({ actor: null as unknown, cookies: new Map<string, string>() }));
vi.mock("@/lib/auth", () => ({ requireActor: async () => current.actor }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (current.cookies.has(name) ? { name, value: current.cookies.get(name) } : undefined),
    set: (name: string, value: string) => { current.cookies.set(name, value); },
    delete: (name: string) => { current.cookies.delete(name); }
  })
}));

const req = (method: string, body?: object, seller = false, url = "https://app.example.test/x") =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1", ...(seller ? { "x-ingressos-modo": "vendedor" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });

describe.skipIf(!enabled)("Ingressos (Postgres real)", async () => {
  const { query, dbPool } = await import("@/lib/db");
  const vendas = await import("@/app/api/ingressos/vendas/route");
  const venda = await import("@/app/api/ingressos/vendas/[id]/route");
  const eventos = await import("@/app/api/ingressos/eventos/route");
  const evento = await import("@/app/api/ingressos/eventos/[id]/route");
  const organizadores = await import("@/app/api/ingressos/organizadores/route");
  const validar = await import("@/app/api/ingressos/validar/route");
  const tickets = await import("@/app/api/ingressos/tickets/[id]/route");
  const caixa = await import("@/app/api/ingressos/caixa/route");
  const pagamentos = await import("@/app/api/ingressos/pagamentos/[id]/route");
  const compradores = await import("@/app/api/ingressos/compradores/route");
  const metas = await import("@/app/api/ingressos/metas/[evento]/route");
  const vendedor = await import("@/app/api/ingressos/metas/[evento]/[vendedor]/route");
  const acesso = await import("@/app/api/ingressos/acesso/[token]/route");
  const { publicTickets } = await import("@/lib/ingressos/publico");

  let coord: Actor;
  let equipe: Actor;
  let diretoria: Actor;
  let organizerId: string;
  let eventId: string;
  let otherEventId: string;

  const as = (actor: Actor) => { current.actor = actor; };
  const call = async <T = Record<string, unknown>,>(response: Response | Promise<Response>) => {
    const res = await response;
    return { status: res.status, body: (await res.json()) as T & { error?: string; code?: string } };
  };
  const sell = (body: object, seller = false) => call<{ sale_id: string; codes: string[]; wa_url: string | null; link: string; message: string }>(
    vendas.POST(req("POST", body, seller), ctx({})));

  const eventBody = (overrides: object = {}) => ({
    organizer_id: organizerId, kind: "feijoada", name: "Feijoada Solidária", purpose: "Angariar fundos para os brinquedos das crianças",
    event_date: "2026-12-12", event_time: "12:00", place: "Salão", price_cents: 3000, pix_key_type: "cnpj", pix_key: "11.222.333/0001-81",
    ...overrides
  });

  beforeAll(async () => {
    coord = await createActor("coordenador", ["eventos"]);
    equipe = await createActor("trabalhador", ["eventos"]);
    diretoria = await createActor("secretario");
    await owner((client) => client.query("update app.feature_flags set enabled = true where key in ('business_modules','module_eventos')"));
    as(coord);
    const org = await call<{ id: string }>(organizadores.POST(req("POST", { name: "Lar da Bênção", cnpj: "11.222.333/0001-81", whatsapp: "92 99999-0000" }), ctx({})));
    expect(org.status).toBe(201);
    organizerId = org.body.id;
    const other = await call<{ id: string }>(eventos.POST(req("POST", eventBody({ name: "Café Antigo", kind: "cafe_da_manha", event_date: "2026-10-01" })), ctx({})));
    otherEventId = other.body.id;
    await evento.POST(req("POST", { action: "ativar" }), ctx({ id: otherEventId }));
    const created = await call<{ id: string }>(eventos.POST(req("POST", eventBody()), ctx({})));
    eventId = created.body.id;
  });
  afterAll(async () => { await dbPool().end(); });

  it("caso 15: CNPJ inválido é recusado", async () => {
    as(coord);
    const res = await call(organizadores.POST(req("POST", { name: "Outra", cnpj: "11.222.333/0001-82" }), ctx({})));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CNPJ inválido. Confira os números.");
  });

  it("um evento ativo por vez; o anterior sem vendas volta a rascunho", async () => {
    as(coord);
    expect((await evento.POST(req("POST", { action: "ativar" }), ctx({ id: eventId }))).status).toBe(200);
    const rows = await query<{ id: string; status: string }>("select id, status from app.ticket_events where id = any($1)", [[eventId, otherEventId]]);
    expect(Object.fromEntries(rows.rows.map((r) => [r.id, r.status]))).toEqual({ [eventId]: "active", [otherEventId]: "draft" });
  });

  it("casos 1, 20 e 35: venda paga no Pix, códigos distintos, WhatsApp com mensagem e link", async () => {
    as(equipe);
    const res = await sell({ quantity: 2, payment: "pix", whatsapp: "92991110001", name: "rosa lima" });
    expect(res.status).toBe(201);
    expect(new Set(res.body.codes).size).toBe(2);
    expect(res.body.wa_url).toMatch(/^https:\/\/wa\.me\/5592991110001\?text=/);
    expect(decodeURIComponent(res.body.wa_url!.split("text=")[1])).toContain(`Ticket 1: *${res.body.codes[0]}*`);
    expect(res.body.message).toContain(res.body.link);
    const detail = await call<{ sale: { status: string; buyer_name: string } }>(venda.GET(req("GET"), ctx({ id: res.body.sale_id })));
    expect(detail.body.sale).toMatchObject({ status: "pago", buyer_name: "Rosa Lima" });
    const recent = await call<{ recent: { id: string; name: string }[] }>(compradores.GET(req("GET"), ctx({})));
    expect(recent.body.recent[0].name).toBe("Rosa Lima");
    // 3 toques com comprador conhecido: quantidade, pagamento, nome da lista.
    const again = await sell({ quantity: 1, payment: "dinheiro", buyer_id: recent.body.recent[0].id });
    expect(again.status).toBe(201);
  });

  it("casos 2, 3, 4 e 13: a prazo, baixa parcial, saldo, valor acima do saldo e estorno", async () => {
    as(equipe);
    const res = await sell({ quantity: 3, payment: "prazo", whatsapp: "92991110002", name: "Maria Souza" });
    const id = res.body.sale_id;
    expect(decodeURIComponent(res.body.wa_url!)).toContain("Valor em aberto: R$ 90,00");
    expect((await call(venda.POST(req("POST", { action: "pagamento", amount_cents: 3000, method: "pix" }), ctx({ id })))).status).toBe(200);
    let detail = await call<{ sale: { status: string; balance_cents: number; due_date: string }; payments: { id: string }[] }>(venda.GET(req("GET"), ctx({ id })));
    expect(detail.body.sale).toMatchObject({ status: "parcial", balance_cents: 6000 });
    const { todayManaus, addDays } = await import("@/lib/ingressos/regras");
    expect(detail.body.sale.due_date).toBe(addDays(todayManaus(), 30));
    const over = await call(venda.POST(req("POST", { action: "pagamento", amount_cents: 7000, method: "pix" }), ctx({ id })));
    expect(over.body.error).toBe("O valor é maior que o saldo de R$ 60,00.");
    const card = await call(venda.POST(req("POST", { action: "pagamento", amount_cents: 1000, method: "cartao" }), ctx({ id })));
    expect(card.status).toBe(400);
    await venda.POST(req("POST", { action: "pagamento", amount_cents: 6000, method: "dinheiro" }), ctx({ id }));
    detail = await call(venda.GET(req("GET"), ctx({ id })));
    expect(detail.body.sale.status).toBe("pago");
    // Estorno só pela Coordenação.
    const denied = await call(pagamentos.POST(req("POST", { reason: "lançado errado" }), ctx({ id: detail.body.payments[1].id })));
    expect(denied.status).toBe(403);
    as(coord);
    expect((await pagamentos.POST(req("POST", { reason: "lançado errado" }), ctx({ id: detail.body.payments[1].id }))).status).toBe(200);
    detail = await call(venda.GET(req("GET"), ctx({ id })));
    expect(detail.body.sale).toMatchObject({ status: "parcial", balance_cents: 6000 });
  });

  it("casos 5 e 6: vencido no topo do A receber; entrega com pendência mostra saldo e funciona", async () => {
    as(equipe);
    const res = await sell({ quantity: 1, payment: "prazo", whatsapp: "92991110003", name: "Ana Pereira" });
    await owner((client) => client.query("update app.ticket_sales set due_date = (now() at time zone 'America/Manaus')::date - 1 where id = $1", [res.body.sale_id]));
    const box = await call<{ receivable: { id: string; status: string }[]; totals: Record<string, number> }>(caixa.GET(req("GET"), ctx({})));
    expect(box.body.receivable[0]).toMatchObject({ id: res.body.sale_id, status: "vencido" });
    expect(box.body.totals.overdue).toBe(1);
    expect(box.body.totals.received_cents + box.body.totals.receivable_cents).toBe(box.body.totals.total_cents);
    const look = await call<{ panel: { state: string; balance_cents: number; overdue: boolean; ticket_id: string } }>(
      validar.GET(req("GET", undefined, false, `https://app.example.test/x?q=${res.body.codes[0].toLowerCase()}`), ctx({})));
    expect(look.body.panel).toMatchObject({ state: "pendente", balance_cents: 3000, overdue: true });
    const done = await call<{ delivered: boolean }>(tickets.POST(req("POST"), ctx({ id: look.body.panel.ticket_id })));
    expect(done.body.delivered).toBe(true);
  });

  it("casos 7, 8 e 11: uso duplo, entrega concorrente única e entregar mais um", async () => {
    as(equipe);
    const res = await sell({ quantity: 3, payment: "pix", whatsapp: "92991110004", name: "Pedro Alves" });
    const look = await call<{ panel: { ticket_id: string } }>(validar.GET(req("GET", undefined, false, `https://app.example.test/x?q=${res.body.codes[0]}`), ctx({})));
    const id = look.body.panel.ticket_id;
    const results = await Promise.all(Array.from({ length: 5 }, () => call<{ delivered: boolean; next_ticket_id: string | null; panel: { state: string } }>(tickets.POST(req("POST"), ctx({ id })))));
    expect(results.filter((r) => r.body.delivered)).toHaveLength(1);
    const winner = results.find((r) => r.body.delivered)!;
    expect(winner.body.next_ticket_id).toBeTruthy();
    const again = await call<{ panel: { state: string; delivered_by_name: string } }>(validar.GET(req("GET", undefined, false, `https://app.example.test/x?q=${res.body.codes[0]}`), ctx({})));
    expect(again.body.panel).toMatchObject({ state: "utilizado", delivered_by_name: equipe.name });
    const next = await call<{ delivered: boolean; panel: { remaining: number } }>(tickets.POST(req("POST"), ctx({ id: winner.body.next_ticket_id! })));
    expect(next.body).toMatchObject({ delivered: true, panel: { remaining: 1 } });
    // Desfazer entrega só pela Coordenação.
    expect((await tickets.DELETE(req("DELETE"), ctx({ id }))).status).toBe(403);
    as(coord);
    expect((await tickets.DELETE(req("DELETE"), ctx({ id }))).status).toBe(200);
  });

  it("casos 9 e 10: código inexistente e ticket de outro evento", async () => {
    as(equipe);
    const none = await call<{ panel: { state: string } }>(validar.GET(req("GET", undefined, false, "https://app.example.test/x?q=7777"), ctx({})));
    expect(none.body.panel.state).toBe("nao_encontrado");
    const otherTicket = await owner(async (client) => {
      const buyer = await client.query<{ id: string }>("insert into app.ticket_buyers (name) values ('Outro Comprador') returning id");
      const seller = await client.query<{ id: string }>("select id from app.ticket_sellers limit 1");
      const sale = await client.query<{ id: string }>(
        `insert into app.ticket_sales (event_id, buyer_id, seller_id, quantity, unit_price_cents, total_cents, registered_by_user)
         values ($1,$2,$3,1,3000,3000,$4) returning id`, [otherEventId, buyer.rows[0].id, seller.rows[0].id, coord.id]);
      const token = `outroEvento_${Date.now()}_000000`;
      await client.query("insert into app.ticket_tickets (sale_id, event_id, number, code, token) values ($1,$2,1,'AAAA',$3)", [sale.rows[0].id, otherEventId, token]);
      return token;
    });
    const other = await call<{ panel: { state: string; event_name: string } }>(validar.GET(req("GET", undefined, false, `https://app.example.test/x?q=TKT:${otherTicket}`), ctx({})));
    expect(other.body.panel).toMatchObject({ state: "outro_evento", event_name: "Café Antigo" });
  });

  it("casos 12 e 14: cancelamento sai dos totais; preço novo não altera vendas antigas", async () => {
    as(equipe);
    const old = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110005", name: "Lucas Rocha" });
    as(coord);
    const before = await call<{ totals: { total_cents: number } }>(caixa.GET(req("GET"), ctx({})));
    expect((await call(venda.POST(req("POST", { action: "cancelar", reason: "desistiu" }), ctx({ id: old.body.sale_id })))).status).toBe(200);
    const after = await call<{ totals: { total_cents: number; received_cents: number; receivable_cents: number } }>(caixa.GET(req("GET"), ctx({})));
    expect(after.body.totals.total_cents).toBe(before.body.totals.total_cents - 3000);
    expect(after.body.totals.received_cents + after.body.totals.receivable_cents).toBe(after.body.totals.total_cents);
    const look = await call<{ panel: { state: string } }>(validar.GET(req("GET", undefined, false, `https://app.example.test/x?q=${old.body.codes[0]}`), ctx({})));
    expect(look.body.panel.state).toBe("cancelado");
    const { event } = (await call<{ event: { version: number } }>(evento.GET(req("GET"), ctx({ id: eventId })))).body;
    await evento.PUT(req("PUT", { ...eventBody({ price_cents: 3500 }), version: event.version }), ctx({ id: eventId }));
    as(equipe);
    const fresh = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110006", name: "Carla Dias" });
    const prices = await query<{ id: string; unit_price_cents: number }>("select id, unit_price_cents from app.ticket_sales where id = any($1)", [[old.body.sale_id, fresh.body.sale_id]]);
    expect(Object.fromEntries(prices.rows.map((r) => [r.id, r.unit_price_cents]))).toEqual({ [old.body.sale_id]: 3000, [fresh.body.sale_id]: 3500 });
    as(coord);
    await evento.PUT(req("PUT", { ...eventBody(), version: event.version + 1 }), ctx({ id: eventId }));
  });

  it("caso 18: Equipe não cancela venda; Diretoria sem vínculo só consulta o caixa", async () => {
    as(equipe);
    const res = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110007", name: "Bia Melo" });
    expect((await venda.POST(req("POST", { action: "cancelar", reason: "teste" }), ctx({ id: res.body.sale_id }))).status).toBe(403);
    as(diretoria);
    expect((await caixa.GET(req("GET"), ctx({}))).status).toBe(200);
    expect((await vendas.POST(req("POST", { quantity: 1, payment: "pix", whatsapp: "92991110008", name: "X Y" }), ctx({}))).status).toBe(403);
    expect((await tickets.POST(req("POST"), ctx({ id: "00000000-0000-4000-8000-000000000000" }))).status).toBe(403);
  });

  it("casos 36, 37 e 38: comprador novo, reconhecido pelo número e Sem WhatsApp", async () => {
    as(equipe);
    const short = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110009", name: "Rosa" });
    expect(short.body.error).toBe("Escreva o nome e o sobrenome. Ex.: Rosa Lima.");
    const badPhone = await sell({ quantity: 1, payment: "pix", whatsapp: "9299111000", name: "Rosa Lima" });
    expect(badPhone.body.error).toBe("Confira o WhatsApp: são 9 números depois do (92).");
    as(coord);
    const found = await call<{ buyer: { name: string } | null }>(compradores.GET(req("GET", undefined, false, "https://app.example.test/x?whatsapp=92991110001"), ctx({})));
    expect(found.body.buyer?.name).toBe("Rosa Lima");
    const second = await sell({ quantity: 1, payment: "pix", whatsapp: "(92) 99111-0001", name: "Rosa Maria" });
    expect(second.status).toBe(201);
    const count = await query<{ n: number }>("select count(*)::int as n from app.ticket_buyers where whatsapp = '5592991110001'");
    expect(count.rows[0].n).toBe(1);
    const noWa = await sell({ quantity: 2, payment: "dinheiro", no_whatsapp: true, name: "Seu Antônio Lima" });
    expect(noWa.body.wa_url).toBeNull();
    expect(noWa.body.codes).toHaveLength(2);
    const credit = await sell({ quantity: 1, payment: "prazo", no_whatsapp: true, name: "Seu Antônio Lima" });
    expect(credit.status).toBe(400);
    as(equipe);
    const byName = await call<{ kind: string; sales: { buyer_name: string }[] }>(validar.GET(req("GET", undefined, false, "https://app.example.test/x?q=antonio"), ctx({})));
    expect(byName.body.kind).toBe("names");
    expect(byName.body.sales[0].buyer_name).toBe("Seu Antônio Lima");
  });

  it("casos 39 e 40: desfazer em 2 minutos e página pública dos ingressos", async () => {
    as(equipe);
    const res = await sell({ quantity: 2, payment: "pix", whatsapp: "92991110010", name: "Júlia Neves" });
    const token = res.body.link.split("/i/")[1];
    const page = await publicTickets(token, "10.0.0.9");
    expect(page).toMatchObject({ state: "ok", first_name: "Júlia" });
    expect(JSON.stringify(page)).not.toMatch(/3000|5592|price|total|saldo/);
    expect((await call(venda.POST(req("POST", { action: "desfazer" }), ctx({ id: res.body.sale_id })))).status).toBe(200);
    expect(await publicTickets(token, "10.0.0.9")).toMatchObject({ state: "cancelado" });
    expect(await publicTickets("tokenQueNaoExiste_00000000", "10.0.0.9")).toEqual({ state: "invalido" });
    // Depois de 2 minutos, só a Coordenação cancela.
    const late = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110011", name: "Rui Barros" });
    await owner((client) => client.query("update app.ticket_sales set created_at = now() - interval '3 minutes' where id = $1", [late.body.sale_id]));
    const refused = await call(venda.POST(req("POST", { action: "desfazer" }), ctx({ id: late.body.sale_id })));
    expect(refused.body.code).toBe("UNDO_EXPIRED");
    // Outro vendedor não desfaz a venda de quem vendeu.
    as(coord);
    const fresh = await sell({ quantity: 1, payment: "pix", whatsapp: "92991110012", name: "Rita Prado" });
    as(equipe);
    expect((await venda.POST(req("POST", { action: "desfazer" }), ctx({ id: fresh.body.sale_id }))).status).toBe(403);
  });

  describe("metas, acesso do trabalhador e acerto", () => {
    let joaoId: string;
    let link: string;

    it("casos 21 e 22: metas distribuídas e convite padrão de 90 dias", async () => {
      as(coord);
      await metas.PUT(req("PUT", { goal_tickets: 300 }), ctx({ evento: eventId }));
      const ids: string[] = [];
      for (const [name, phone, goal] of [["João Pereira", "92992220001", 20], ["Paula Reis", "92992220002", 15], ["Caio Lins", "92992220003", 10]] as const) {
        const added = await call<{ seller_id: string }>(metas.POST(req("POST", { name, whatsapp: phone, goal }), ctx({ evento: eventId })));
        expect(added.status).toBe(201);
        ids.push(added.body.seller_id);
      }
      joaoId = ids[0];
      const panel = await call<{ distributed: number; sellers: { seller_id: string; access_state: string }[] }>(metas.GET(req("GET"), ctx({ evento: eventId })));
      expect(panel.body.distributed).toBe(45);
      expect(panel.body.sellers.find((s) => s.seller_id === joaoId)?.access_state).toBe("nao_enviado");
      const sent = await call<{ link: string; wa_url: string; valid_until: string }>(vendedor.POST(req("POST", { action: "enviar" }), ctx({ evento: eventId, vendedor: joaoId })));
      const { addDays, todayManaus } = await import("@/lib/ingressos/regras");
      expect(sent.body.valid_until).toBe(addDays(todayManaus(), 90));
      expect(sent.body.wa_url).toMatch(/^https:\/\/wa\.me\/5592992220001\?text=/);
      link = sent.body.link;
    });

    it("casos 24, 25 e 26: primeiro acesso cria PIN, outro aparelho é recusado, 5 PINs errados bloqueiam", async () => {
      const token = link.split("/ingressos/acesso/")[1];
      current.cookies.clear();
      const open = await call<{ state: string; seller_name: string }>(acesso.GET(req("GET"), ctx({ token })));
      expect(open.body).toMatchObject({ state: "criar_pin", seller_name: "João Pereira" });
      expect((await call(acesso.POST(req("POST", { action: "criar_pin", pin: "4821", confirm: "4821" }), ctx({ token })))).status).toBe(200);
      const myCookies = new Map(current.cookies);
      // Mesmo aparelho: pede só o PIN.
      current.cookies.delete("lar_ing_ses");
      expect((await call<{ state: string }>(acesso.GET(req("GET"), ctx({ token })))).body.state).toBe("pin");
      // Outro aparelho: não cria sessão.
      current.cookies.clear();
      expect((await call<{ state: string }>(acesso.GET(req("GET"), ctx({ token })))).body.state).toBe("outro_aparelho");
      expect((await call(acesso.POST(req("POST", { action: "criar_pin", pin: "1111", confirm: "1111" }), ctx({ token })))).body.code).toBe("OTHER_DEVICE");
      // PIN errado 5 vezes.
      current.cookies = new Map(myCookies);
      current.cookies.delete("lar_ing_ses");
      for (let i = 0; i < 4; i++) expect((await call(acesso.POST(req("POST", { action: "entrar", pin: "0000" }), ctx({ token })))).body.code).toBe("WRONG_PIN");
      expect((await call(acesso.POST(req("POST", { action: "entrar", pin: "0000" }), ctx({ token })))).body.code).toBe("PIN_LOCKED");
      expect((await call(acesso.POST(req("POST", { action: "entrar", pin: "4821" }), ctx({ token })))).body.code).toBe("PIN_LOCKED");
      await owner((client) => client.query("update app.ticket_access set locked_until = null where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')", [token]));
      expect((await call(acesso.POST(req("POST", { action: "entrar", pin: "4821" }), ctx({ token })))).status).toBe(200);
    });

    it("casos 29 e 30: trabalhador vende em dinheiro (em mãos), não vê vendas alheias nem o caixa", async () => {
      await owner((client) => client.query(
        `insert into app.ticket_sales (event_id, buyer_id, seller_id, quantity, unit_price_cents, total_cents, registered_by_user)
         select $1, b.id, $2, 3, 3000, 9000, $3 from app.ticket_buyers b limit 1`, [eventId, joaoId, coord.id]));
      const sold = await sell({ quantity: 2, payment: "dinheiro", whatsapp: "92993330001", name: "Dona Rosa" }, true);
      expect(sold.status).toBe(201);
      const mine = await call<{ sold: number; goal: number; totals: { cash_cents: number }; sales: { id: string }[] }>(vendas.GET(req("GET", undefined, true), ctx({})));
      expect(mine.body).toMatchObject({ sold: 5, goal: 20, totals: { cash_cents: 6000 } });
      // Escopo (RN-19): venda de outro vendedor, Validar e Caixa.
      const others = await query<{ id: string }>("select id from app.ticket_sales where seller_id <> $1 limit 1", [joaoId]);
      expect((await venda.GET(req("GET", undefined, true), ctx({ id: others.rows[0].id }))).status).toBe(404);
      expect((await validar.GET(req("GET", undefined, true, "https://app.example.test/x?q=AAAA"), ctx({}))).status).toBe(403);
      expect((await caixa.GET(req("GET", undefined, true), ctx({}))).status).toBe(403);
      expect((await call(venda.POST(req("POST", { action: "cancelar", reason: "x x x" }, true), ctx({ id: sold.body.sale_id })))).status).toBe(403);
      // Coordenação vê a venda no painel.
      as(coord);
      const panel = await call<{ sellers: { seller_id: string; sold: number; in_hands_cents: number }[] }>(metas.GET(req("GET"), ctx({ evento: eventId })));
      expect(panel.body.sellers.find((s) => s.seller_id === joaoId)).toMatchObject({ sold: 5, in_hands_cents: 6000 });
    });

    it("caso 31: venda lançada pela coordenação em nome do trabalhador conta na meta dele", async () => {
      as(coord);
      const paula = (await query<{ id: string }>("select id from app.ticket_sellers where name = 'Paula Reis'")).rows[0].id;
      const res = await sell({ quantity: 4, payment: "pix", whatsapp: "92993330002", name: "Tião Costa", seller_id: paula });
      expect(res.status).toBe(201);
      const panel = await call<{ sellers: { seller_id: string; sold: number }[] }>(metas.GET(req("GET"), ctx({ evento: eventId })));
      expect(panel.body.sellers.find((s) => s.seller_id === paula)?.sold).toBe(4);
    });

    it("caso 32: acerto reduz o dinheiro em mãos; acima do valor é recusado", async () => {
      as(coord);
      const over = await call(vendedor.POST(req("POST", { action: "acerto", amount_cents: 7000 }), ctx({ evento: eventId, vendedor: joaoId })));
      expect(over.status).toBe(400);
      expect((await vendedor.POST(req("POST", { action: "acerto", amount_cents: 6000 }), ctx({ evento: eventId, vendedor: joaoId }))).status).toBe(200);
      const detail = await call<{ totals: { cash_cents: number } }>(vendedor.GET(req("GET"), ctx({ evento: eventId, vendedor: joaoId })));
      expect(detail.body.totals.cash_cents).toBe(0);
    });

    it("casos 27, 28, 23 e 33: reenviar invalida o link antigo; bloquear derruba a sessão; acesso encerrado marca o A receber", async () => {
      // Venda a prazo do João, ainda logado.
      const credit = await sell({ quantity: 1, payment: "prazo", whatsapp: "92993330003", name: "Zé Lopes" }, true);
      expect(credit.status).toBe(201);
      as(coord);
      expect((await vendedor.POST(req("POST", { action: "bloquear" }), ctx({ evento: eventId, vendedor: joaoId }))).status).toBe(200);
      const blocked = await call(vendas.GET(req("GET", undefined, true), ctx({})));
      expect(blocked.body.code).toBe("ACCESS_ENDED");
      const box = await call<{ receivable: { id: string; access_ended: boolean }[] }>(caixa.GET(req("GET"), ctx({})));
      expect(box.body.receivable.find((s) => s.id === credit.body.sale_id)?.access_ended).toBe(true);
      // Reenviar: novo link pede novo PIN; o antigo mostra encerrado.
      const oldToken = link.split("/ingressos/acesso/")[1];
      const resent = await call<{ link: string }>(vendedor.POST(req("POST", { action: "enviar", valid_until: (await import("@/lib/ingressos/regras")).todayManaus() }), ctx({ evento: eventId, vendedor: joaoId })));
      const newToken = resent.body.link.split("/ingressos/acesso/")[1];
      expect((await call<{ state: string }>(acesso.GET(req("GET"), ctx({ token: oldToken })))).body.state).toBe("encerrado");
      expect((await call<{ state: string }>(acesso.GET(req("GET"), ctx({ token: newToken })))).body.state).toBe("criar_pin");
      // Validade de hoje vale até 23:59 de Manaus; no dia seguinte, encerrado.
      await owner((client) => client.query("update app.ticket_access set valid_until = (now() at time zone 'America/Manaus')::date - 1 where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')", [newToken]));
      expect((await call<{ state: string }>(acesso.GET(req("GET"), ctx({ token: newToken })))).body.state).toBe("encerrado");
      const { logExpiredAccesses } = await import("@/lib/ingressos/metas");
      expect(await logExpiredAccesses()).toBeGreaterThanOrEqual(1);
    });
  });

  it("Recebido + A receber = total; encerrado não vende mas aceita baixa", async () => {
    as(equipe);
    const credit = await sell({ quantity: 2, payment: "prazo", whatsapp: "92994440001", name: "Nina Torres" });
    as(coord);
    const box = await call<{ totals: { total_cents: number; received_cents: number; receivable_cents: number } }>(caixa.GET(req("GET"), ctx({})));
    expect(box.body.totals.received_cents + box.body.totals.receivable_cents).toBe(box.body.totals.total_cents);
    await evento.POST(req("POST", { action: "encerrar" }), ctx({ id: eventId }));
    as(equipe);
    expect((await sell({ quantity: 1, payment: "pix", whatsapp: "92994440002", name: "Teo Ramos" })).status).toBe(409);
    expect((await venda.POST(req("POST", { action: "pagamento", amount_cents: 3000, method: "pix" }), ctx({ id: credit.body.sale_id }))).status).toBe(200);
    as(coord);
    expect((await call(evento.POST(req("POST", { action: "excluir" }), ctx({ id: eventId })))).body.code).toBe("HAS_SALES");
    const chain = await query<{ valid: boolean }>("select * from app.verify_audit_chain()");
    expect(chain.rows[0].valid).toBe(true);
  });
});
