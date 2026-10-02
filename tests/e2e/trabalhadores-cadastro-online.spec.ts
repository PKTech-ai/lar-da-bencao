import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { BOOTSTRAP_SECRET, PASSWORD, login, sql } from "./support";

test.describe.configure({ mode: "serial" });

const ADMIN = "admin.e2e@lar.local";
const NAME = `Trabalhadora Online ${Date.now()}`;
let adminContext: BrowserContext;
let admin: Page;

/** Celular sem sessão: é assim que o trabalhador abre o link ou o QR code. */
async function phone(browser: Browser, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ ...devices["Pixel 7"], colorScheme, locale: "pt-BR" });
  return { context, page: await context.newPage() };
}

async function fillForm(page: Page, departments: string[]) {
  await page.getByLabel(/Nome completo/).fill(NAME);
  await page.getByLabel(/Telefone/).fill("(51) 99876-5432");
  await page.getByLabel(/Data de nascimento/).fill("1980-03-15");
  await page.getByLabel("Profissão").fill("Professora");
  for (const department of departments) await page.getByRole("checkbox", { name: department, exact: true }).check();
  await page.getByRole("checkbox", { name: "Passista" }).check();
  await page.getByRole("checkbox", { name: "Quarta" }).check();
  await page.getByRole("checkbox", { name: /termo de voluntariado/ }).check();
  await page.getByRole("checkbox", { name: /aviso de privacidade/ }).check();
}

test.beforeAll(async ({ browser, request }) => {
  // Funciona sozinho ou depois da suíte da fundação (que já cria o administrador).
  const boot = await request.post("/api/bootstrap", {
    headers: { "X-Bootstrap-Secret": BOOTSTRAP_SECRET },
    data: { email: ADMIN, name: "Administrador E2E", password: PASSWORD }
  });
  expect([201, 409]).toContain(boot.status());
  await sql("update app.feature_flags set enabled = true, uat_reference = coalesce(uat_reference, 'UAT E2E local') where key in ('business_modules','module_workers')");
  await sql("update app.feature_flags set enabled = false where key = 'public_worker_form'");
  await sql("delete from app.worker_submissions");

  adminContext = await browser.newContext();
  admin = await adminContext.newPage();
  admin.on("dialog", (d) => void d.accept(d.type() === "prompt" ? "UAT E2E cadastro online" : undefined));
  await login(admin, ADMIN);
  await admin.waitForURL(/\/(sistema|termos)$/);
  if (admin.url().endsWith("/termos")) await admin.getByRole("button", { name: "Li e aceito" }).click();
  await expect(admin).toHaveURL(/\/sistema$/);
});
test.afterAll(async () => { await adminContext.close(); });

test("formulário nasce fechado e não pede login", async ({ browser, request }) => {
  const { context, page } = await phone(browser, "light");
  await page.goto("/cadastro/trabalhador");
  await expect(page).toHaveURL(/\/cadastro\/trabalhador$/);
  await expect(page.getByText("Formulário fechado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar cadastro" })).toHaveCount(0);
  const closed = await request.post("/api/public/worker-submissions", { headers: { Origin: new URL(page.url()).origin }, data: {} });
  expect(closed.status()).toBe(404);
  await context.close();
});

test("administrador abre o formulário em Módulos e ondas", async () => {
  await admin.goto("/sistema/modulos");
  const row = admin.locator("tr", { hasText: "public_worker_form" });
  await row.getByRole("button", { name: "Liberar" }).click();
  await expect(row.getByText("Ligado", { exact: true })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`envio anônimo pelo celular (tema ${colorScheme === "light" ? "claro" : "escuro"})`, async ({ browser }, testInfo) => {
    const { context, page } = await phone(browser, colorScheme);
    await page.goto("/cadastro/trabalhador");
    await expect(page.getByRole("heading", { name: "Cadastro de trabalhador" })).toBeVisible();
    // Sem rolagem horizontal na largura do celular.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Enviar cadastro" })).toBeDisabled();
    // O primeiro envio marca só a Doutrina; o segundo acrescenta a Infância (atualização da ficha).
    await fillForm(page, colorScheme === "light" ? ["Doutrina"] : ["Doutrina", "Infância"]);
    await page.screenshot({ path: testInfo.outputPath(`cadastro-${colorScheme}.png`), fullPage: true });
    await page.getByRole("button", { name: "Enviar cadastro" }).click();
    await expect(page.getByText("Cadastro enviado.")).toBeVisible();
    // A confirmação não devolve nenhum dado informado.
    await expect(page.getByText(NAME)).toHaveCount(0);
    await context.close();
  });
}

test("envios ficam na fila e não criam ficha sozinhos", async () => {
  const queue = await sql<{ count: number }>("select count(*)::int as count from app.worker_submissions where status = 'received' and payload->>'full_name' = $1", [NAME]);
  expect(queue[0].count).toBe(2);
  expect(await sql("select 1 from app.workers where full_name = $1", [NAME])).toHaveLength(0);
});

test("administrador cria a ficha a partir do primeiro envio", async () => {
  await admin.goto("/sistema/trabalhadores");
  await admin.getByRole("link", { name: /Cadastros online \(\d+\)/ }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Cadastros online");
  const card = admin.locator("section.card", { hasText: NAME }).first();
  await expect(card.getByText("Nenhuma ficha parecida encontrada.")).toBeVisible();
  await card.getByRole("button", { name: "Criar nova ficha" }).click();
  await expect(admin.getByText("Ficha criada. O trabalhador fica PENDENTE")).toBeVisible();
  const worker = await sql<{ status: string; contribution_cents: string }>("select status, contribution_cents::text from app.workers where full_name = $1", [NAME]);
  expect(worker).toEqual([{ status: "pending", contribution_cents: "0" }]);
});

test("segundo envio é vinculado à ficha existente e atualiza os dados", async () => {
  await sql("update app.workers set status = 'active' where full_name = $1", [NAME]);
  await admin.goto("/sistema/trabalhadores/cadastros-online");
  const card = admin.locator("section.card", { hasText: NAME }).first();
  await expect(card.getByText("1 ficha(s) parecida(s) encontrada(s).")).toBeVisible();
  const workerId = (await sql<{ id: string }>("select id from app.workers where full_name = $1", [NAME]))[0].id;
  await card.getByLabel(/Vincular a/).selectOption(workerId);
  await expect(card.getByRole("row", { name: /Departamentos/ }).last()).toContainText("Doutrina, Infância");
  await expect(card.getByText("a ficha volta para PENDENTE")).toBeVisible();
  await card.getByRole("button", { name: "Atualizar esta ficha" }).click();
  await expect(admin.getByText("Ficha atualizada e encaminhada para nova análise da Diretoria.")).toBeVisible();
  await expect(admin.getByText("Nenhum envio aguardando conferência.")).toBeVisible();

  const row = await sql<{ status: string; version: number; departments: string[] }>(
    `select w.status, w.version, array(select department_key from app.worker_departments where worker_id = w.id order by 1) as departments
       from app.workers w where w.id = $1`,
    [workerId]
  );
  expect(row[0]).toEqual({ status: "pending", version: 2, departments: ["doutrina", "infancia"] });
  const audits = await sql<{ action: string }>("select action from app.audit_events where entity_type = 'worker' and entity_id = $1 order by sequence", [workerId]);
  expect(audits.map((a) => a.action)).toEqual([
    "Ficha de trabalhador criada a partir do cadastro online",
    "Ficha atualizada pelo cadastro online e reenviada para a Diretoria"
  ]);
  // O Dedo-duro registra os envios anônimos sem dados pessoais.
  const anonymous = await sql<{ details: string | null }>("select details from app.audit_events where action = 'Envio de cadastro online de trabalhador' order by sequence desc limit 2");
  expect(anonymous).toEqual([{ details: null }, { details: null }]);
});

test("QR code aponta para o endereço configurado em APP_URL", async () => {
  await admin.goto("/sistema/trabalhadores");
  await admin.getByRole("link", { name: "QR code do cadastro online" }).click();
  await expect(admin.getByRole("img", { name: /QR code para .*\/cadastro\/trabalhador/ })).toBeVisible();
  await expect(admin.getByText(/Confira antes de imprimir/)).toBeVisible();
});

test("quem não é administrador não vê a fila", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sistema/trabalhadores/cadastros-online");
  await expect(page).toHaveURL(/\/login/);
  expect((await context.request.get("/api/workers/submissions", { maxRedirects: 0 })).status()).toBe(401);
  await context.close();
});
