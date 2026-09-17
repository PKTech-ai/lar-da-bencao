import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  BOOTSTRAP_SECRET, CRON_SECRET, PASSWORD, acceptTerms, enrollMfa, expectHealthyPage, freshTotp, latestMail, linkFrom, login,
  loginWithMfa, sql
} from "./support";

test.describe.configure({ mode: "serial" });

const ADMIN = "admin.e2e@lar.local";
const COORD = "coord.e2e@lar.local";
const used = new Set<string>();
const state = { adminSecret: "", adminCodes: [] as string[], coordSecret: "" };
let adminContext: BrowserContext;
let admin: Page;
let coordContext: BrowserContext;
let coord: Page;

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.beforeAll(async ({ browser }) => {
  ({ context: adminContext, page: admin } = await newPage(browser));
  ({ context: coordContext, page: coord } = await newPage(browser));
  admin.on("dialog", (d) => void d.accept(d.type() === "prompt" ? "UAT E2E local" : undefined));
  coord.on("dialog", (d) => void d.accept());
});
test.afterAll(async () => { await adminContext.close(); await coordContext.close(); });

test("health e bootstrap do primeiro administrador", async ({ request }) => {
  expect((await request.get("/api/health")).status()).toBeLessThan(600);
  const denied = await request.post("/api/bootstrap", { headers: { "X-Bootstrap-Secret": "errado" }, data: {} });
  expect(denied.status()).toBe(401);
  const created = await request.post("/api/bootstrap", {
    headers: { "X-Bootstrap-Secret": BOOTSTRAP_SECRET },
    data: { email: ADMIN, name: "Administrador E2E", password: PASSWORD }
  });
  expect(created.status()).toBe(201);
  expect((await request.post("/api/bootstrap", { headers: { "X-Bootstrap-Secret": BOOTSTRAP_SECRET }, data: { email: "x@lar.local", name: "Outro", password: PASSWORD } })).status()).toBe(409);
  expect((await request.get("/api/maintenance/integrity", { maxRedirects: 0 })).status()).toBe(401);
  const cron = await request.get("/api/maintenance/integrity", { headers: { Authorization: `Bearer ${CRON_SECRET}` }, maxRedirects: 0 });
  expect(cron.status()).toBe(200);
  expect(await cron.json()).toMatchObject({ status: "ok" });
  expect(await (await request.get("/api/health")).json()).toMatchObject({ status: "ok", checks: { schema: true, integrity: true } });
});

test("rotas protegidas exigem login", async ({ page, request }) => {
  expect((await request.get("/api/users", { maxRedirects: 0 })).status()).toBe(401);
  await page.goto("/sistema/usuarios");
  await expect(page).toHaveURL(/\/login\?next=%2Fsistema%2Fusuarios/);
});

test("administrador: login, MFA com códigos de recuperação e termos", async () => {
  await login(admin, ADMIN, "senha-errada-123456");
  await expect(admin.locator(".error[role=alert]")).toHaveText("E-mail ou senha inválidos.");
  await login(admin, ADMIN);
  await expect(admin).toHaveURL(/\/mfa/);
  const { secret, codes } = await enrollMfa(admin, used);
  state.adminSecret = secret;
  state.adminCodes = codes;
  await acceptTerms(admin);
  await expect(admin.getByText("Ambiente local — somente dados sintéticos").first()).toBeVisible();
  const mail = await latestMail(ADMIN, "Novo autenticador");
  expect(mail.HTML).toContain("Um novo autenticador foi cadastrado");
});

test("módulos nascem desligados e só liberam com UAT", async () => {
  expect((await admin.goto("/sistema/trabalhadores"))?.status()).toBe(404);
  expect((await admin.request.get("/api/workers")).status()).toBe(404);
  await admin.goto("/sistema/modulos");
  await expect(admin.getByRole("heading", { name: "Módulos e ondas" })).toBeVisible();
  for (const key of ["business_modules", "module_workers", "module_doutrina", "module_infancia", "module_juventude", "module_documentos", "module_home_ops"]) {
    const row = admin.locator("tr", { hasText: key });
    await row.getByRole("button", { name: "Liberar" }).click();
    await expect(row.getByText("Ligado", { exact: true })).toBeVisible();
  }
  const flags = await sql<{ key: string; uat_reference: string }>("select key, uat_reference from app.feature_flags where key = 'module_workers'");
  expect(flags[0].uat_reference).toBe("UAT E2E local");
});

test("convite do coordenador chega por e-mail e completa senha, MFA e termos", async () => {
  await admin.goto("/sistema/usuarios");
  const form = admin.locator("form", { hasText: "Enviar convite" });
  await form.getByLabel("Nome completo").fill("Coordenadora E2E");
  await form.getByLabel("E-mail").fill(COORD);
  await form.getByLabel("Perfil").selectOption("coordenador");
  await form.getByLabel("Doutrina").check();
  await form.getByLabel("Infância").check();
  await form.getByRole("button", { name: "Enviar convite" }).click();
  await expect(admin.getByText("Convite enviado")).toBeVisible();
  await expect(admin.locator("tr", { hasText: COORD }).getByText("Convite pendente")).toBeVisible();

  const mail = await latestMail(COORD, "Convite");
  await coord.goto(linkFrom(mail.HTML));
  await expect(coord.getByRole("heading", { name: "Defina sua senha" })).toBeVisible();
  await coord.getByLabel("Nova senha").fill(PASSWORD);
  await coord.getByLabel("Confirme a senha").fill(PASSWORD);
  await coord.getByRole("button", { name: "Salvar e ativar MFA" }).click();
  state.coordSecret = (await enrollMfa(coord, used)).secret;
  await acceptTerms(coord);
  const nav = coord.getByRole("navigation", { name: "Módulos principais" });
  await expect(nav.getByRole("link", { name: "Doutrina" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Juventude" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Usuários e permissões" })).toHaveCount(0);
});

test("coordenador não acessa telas de administração", async () => {
  await coord.goto("/sistema/usuarios");
  await expect(coord).toHaveURL(/\/sistema$/);
  expect((await coord.request.get("/api/users")).status()).toBe(403);
  expect((await coord.request.get("/api/feature-flags")).status()).toBe(403);
  expect((await coord.goto("/sistema/juventude"))?.status()).toBe(404);
});

test("ficha de trabalhador: coordenador cadastra, Diretoria aprova", async () => {
  await coord.goto("/sistema/trabalhadores");
  await coord.getByRole("button", { name: "Nova ficha" }).click();
  const form = coord.locator("form", { hasText: "Enviar para aprovação" });
  await form.getByLabel("Nome completo *").fill("Passista E2E");
  await form.getByLabel("Passista").check();
  await form.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(coord.getByText("PENDENTE — AGUARDANDO DIRETORIA").first()).toBeVisible();
  await expect(coord.locator("tr", { hasText: "Passista E2E" }).getByText("Pendente — aguardando Diretoria")).toBeVisible();

  await admin.goto("/sistema/admissoes");
  const row = admin.locator("tr", { hasText: "Passista E2E" });
  await row.getByRole("button", { name: "Aprovar" }).click();
  await admin.getByLabel("Referência da ata ou reunião").fill("Ata E2E 01/2026");
  await admin.getByRole("button", { name: "Salvar decisão da Diretoria" }).click();
  await expect(admin.getByText("aprovado e liberado para atuação")).toBeVisible();
  const status = await sql<{ status: string }>("select status from app.workers where full_name = 'Passista E2E'");
  expect(status[0].status).toBe("active");
});

test("Doutrina: gera, confere e imprime a escala do mês", async () => {
  await coord.goto("/sistema/doutrina/escalas");
  await coord.getByRole("button", { name: "Gerar escala" }).click();
  await expect(coord.getByText(/Escala gerada: \d+ posição/)).toBeVisible();
  await expect(coord.getByText("CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO")).toBeVisible();
  await coord.getByRole("button", { name: "Conferir" }).click();
  await expect(coord.getByText(/Conferência concluída|conferida sem conflitos/)).toBeVisible();
  await coord.getByRole("link", { name: "⎙ Mês consolidado" }).click();
  await expect(coord.getByRole("heading", { name: "Impressão da escala" })).toBeVisible();
});

test("Infância: matrícula com turma pela idade e chamada dominical", async () => {
  await coord.goto("/sistema/infancia/evangelizandos");
  await coord.getByRole("button", { name: "+ Matricular" }).click();
  await coord.getByLabel("Nome completo *").fill("Criança E2E");
  await coord.getByLabel("Data de nascimento *").fill("2012-01-10");
  await expect(coord.getByText(/fora da faixa do Departamento da Infância/)).toBeVisible();
  await coord.getByLabel("Data de nascimento *").fill("2019-05-10");
  await expect(coord.getByText(/Enquadramento automático: 1º Ciclo/)).toBeVisible();
  await coord.getByLabel("Responsável *").fill("Mãe E2E");
  await coord.getByRole("button", { name: "Salvar matrícula" }).click();
  await expect(coord.getByText("Matrícula salva — 1º Ciclo.")).toBeVisible();

  await coord.goto("/sistema/infancia/frequencia");
  await coord.getByLabel("Mês").fill("2026-09");
  const cell = coord.getByRole("button", { name: /Criança E2E em 2026-09-06/ });
  await cell.click();
  await expect(cell).toHaveText("P");
  await coord.getByRole("button", { name: /Salvar 1 marcação/ }).click();
  await expect(coord.getByText("Chamada salva")).toBeVisible();
});

test("todas as telas da fundação e da onda 1 abrem sem erro", async () => {
  const pages: [string, RegExp][] = [
    ["/sistema", /Ao Lar da Bênção/], ["/sistema/conta", /Minha conta/], ["/sistema/usuarios", /Usuários e permissões/],
    ["/sistema/modulos", /Módulos e ondas/], ["/sistema/auditoria", /Dedo-duro/], ["/sistema/anexos", /Anexos/],
    ["/sistema/importacao", /Importação do backup v215/], ["/sistema/documentos", /Estatuto e Regimento/],
    ["/sistema/trabalhadores", /Trabalhadores/], ["/sistema/admissoes", /Aprovação de Trabalhadores/],
    ["/sistema/doutrina", /Doutrina/], ["/sistema/doutrina/trabalhadores", /Trabalhadores da Doutrina/],
    ["/sistema/doutrina/palestrantes", /Palestrantes Externos/], ["/sistema/doutrina/estudos", /Biblioteca de Estudos/],
    ["/sistema/doutrina/escalas", /Escala Mensal/], ["/sistema/doutrina/frequencia", /Frequência/],
    ["/sistema/infancia", /Infância/], ["/sistema/infancia/evangelizandos", /Evangelizandos/],
    ["/sistema/infancia/aniversariantes", /Aniversariantes/], ["/sistema/infancia/estudos", /Biblioteca/],
    ["/sistema/infancia/frequencia", /Chamada/], ["/sistema/infancia/cronograma", /Cronograma/],
    ["/sistema/infancia/planejamento", /Planejamento/], ["/sistema/infancia/relatorio", /Relatório Anual/],
    ["/sistema/juventude", /Juventude/], ["/sistema/juventude/evangelizandos", /Evangelizandos/]
  ];
  for (const [path, heading] of pages) await expectHealthyPage(admin, path, heading);
});

test("Minha conta: códigos novos e troca de senha exigem o código atual", async () => {
  await coord.goto("/sistema/conta");
  await coord.getByRole("button", { name: "Gerar novos códigos de recuperação" }).click();
  await coord.getByLabel("Código atual do autenticador").fill("000000");
  await coord.getByRole("button", { name: "Confirmar" }).click();
  await expect(coord.locator(".error[role=alert]")).toContainText("inválido");
  await coord.getByLabel("Código atual do autenticador").fill(await freshTotp(state.coordSecret, used));
  await coord.getByRole("button", { name: "Confirmar" }).click();
  await expect(coord.getByText("Novos códigos emitidos")).toBeVisible();
  await expect(coord.locator("ul li code")).toHaveCount(10);

  await coord.getByRole("button", { name: "Alterar senha" }).click();
  await coord.getByLabel("Nova senha").fill(`${PASSWORD}X`);
  await coord.getByLabel("Confirme a nova senha").fill(`${PASSWORD}X`);
  await coord.getByLabel("Código atual do autenticador").fill(await freshTotp(state.coordSecret, used));
  await coord.getByRole("button", { name: "Confirmar" }).click();
  const nonceField = coord.getByLabel("Código recebido por e-mail");
  await expect(coord.getByText("Senha alterada.").or(nonceField)).toBeVisible();
  if (await nonceField.isVisible()) {
    const mail = await latestMail(COORD, "Código de confirmação");
    await nonceField.fill(mail.Text.match(/\b\d{6}\b/)![0]);
    await coord.getByLabel("Código atual do autenticador").fill(await freshTotp(state.coordSecret, used));
    await coord.getByRole("button", { name: "Confirmar" }).click();
    await expect(coord.getByText("Senha alterada.")).toBeVisible();
  }
  expect((await latestMail(COORD, "Sua senha foi alterada")).HTML).toContain("Sua senha foi alterada");
  await sql("select 1");
});

test("Encerrar sessões derruba o coordenador na hora", async () => {
  await admin.goto("/sistema/usuarios");
  await admin.locator("tr", { hasText: COORD }).getByRole("button", { name: "Encerrar sessões" }).click();
  await expect(admin.getByText("Sessões encerradas")).toBeVisible();
  await coord.goto("/sistema/doutrina");
  await expect(coord).toHaveURL(/\/login/);
  const revoked = await sql<{ count: string }>(
    "select count(*)::text as count from auth.sessions s join auth.users u on u.id = s.user_id where u.email = $1", [COORD]
  );
  expect(revoked[0].count).toBe("0");
});

test("código de recuperação substitui o autenticador perdido", async () => {
  const context = await adminContext.browser()!.newContext();
  const page = await context.newPage();
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/mfa/);
  await page.getByLabel("Código de recuperação").fill(state.adminCodes[0].toLowerCase());
  await page.getByRole("button", { name: "Usar código de recuperação" }).click();
  await expect(page.getByText("Código aceito. Cadastre agora o novo autenticador")).toBeVisible();
  const { secret } = await enrollMfa(page, used);
  state.adminSecret = secret;
  await expect(page).toHaveURL(/\/sistema$/);
  const events = await sql<{ action: string }>("select action from app.audit_events where action = 'Uso de código de recuperação MFA' and result = 'success'");
  expect(events).toHaveLength(1);
  await context.close();
});

test("login bloqueia após 5 tentativas sem revelar se a conta existe", async ({ page }) => {
  for (let i = 0; i < 5; i += 1) {
    await login(page, "ninguem.e2e@lar.local", `errada-${i}-000000`);
    await expect(page.locator(".error[role=alert]")).toHaveText("E-mail ou senha inválidos.");
  }
  await login(page, "ninguem.e2e@lar.local", "errada-final-00000");
  await expect(page.locator(".error[role=alert]")).toHaveText("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
});

test("Dedo-duro registra as jornadas e a cadeia continua íntegra", async () => {
  const actions = await sql<{ action: string }>("select distinct action from app.audit_events");
  const names = actions.map((a) => a.action);
  for (const expected of ["Inicialização do Administrador", "Login concluído com MFA", "Convite de usuário", "Liberação de módulo",
    "Ficha de trabalhador enviada para aprovação", "Aprovação de trabalhador", "Geração de escala", "Matrícula de evangelizando",
    "Chamada dominical", "Revogação de sessões", "Falha de login", "Login bloqueado por excesso de tentativas"]) {
    expect(names, expected).toContain(expected);
  }
  const chain = await sql<{ valid: boolean }>("select valid from app.verify_audit_chain()");
  expect(chain[0].valid).toBe(true);
});
