import { test, expect, type Page } from "@playwright/test";
import { openDatabase } from "../../apps/api/src/db";
import { Store } from "../../apps/api/src/store";
import { TicketService } from "../../apps/api/src/tickets";
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("funcionário revisa rascunho, confirma, consulta decisões e retoma após reload", async ({
  page,
}) => {
  await login(page, "ana.souza@nexo.com.br");
  await expect(
    page.getByText("O agente aguarda configuração", { exact: false }),
  ).toBeVisible();
  const response = await page.request.get("/api/conversations");
  const data = await response.json();
  const id = data.conversations[0].id as string;
  const db = openDatabase(process.env.NEXO_E2E_DB!);
  const store = new Store(db);
  const service = new TicketService(store, 0);
  service.prepare(id, {
    title: "Editor de texto fecha inesperadamente",
    description:
      "O editor fecha ao abrir documentos. Posso usar a versão web por enquanto.",
    type: "INC",
    category: "Software",
    affected: "individual",
    blocked: false,
    commitmentToday: false,
    workaround: true,
  });
  db.close();
  await expect(
    page.getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Editor de texto fecha ao abrir documento");
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText("Rascunho v2", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText(/criado após sua confirmação/)).toBeVisible();
  await page.getByText("Ver detalhes das decisões").last().click();
  await expect(
    page.getByText("Confirmação explícita da versão atual", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/criado após sua confirmação/)).toBeVisible();
  await page.getByRole("button", { name: "Meu perfil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  await expect(
    page.getByText("Conta de demonstração.", { exact: false }),
  ).toBeVisible();
});
test("transferência pausa agente, analista assume, responde, devolve e encerra", async ({
  browser,
}) => {
  const employeeContext = await browser.newContext();
  const analystContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  const analyst = await analystContext.newPage();
  try {
    await login(employee, "carla.mendes@nexo.com.br");
    await employee.getByRole("button", { name: "Falar com analista" }).click();
    await expect(
      employee.getByText("Aguardando atendente", { exact: true }),
    ).toBeVisible();
    await login(analyst, "rafael.lima@nexo.com.br");
    await expect(
      analyst.getByRole("button", { name: "Assumir atendimento" }),
    ).toBeVisible();
    await expect(analyst.getByLabel("Mensagem do analista")).toBeDisabled();
    await analyst.getByRole("button", { name: "Assumir atendimento" }).click();
    await expect(analyst.getByLabel("Mensagem do analista")).toBeEnabled();
    await analyst
      .getByLabel("Mensagem do analista")
      .fill("Olá Carla, vou acompanhar seu problema de VPN.");
    await analyst.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(
      employee.getByText("Olá Carla, vou acompanhar seu problema de VPN."),
    ).toBeVisible();
    await employee
      .getByLabel("Mensagem para o atendimento")
      .fill("Obrigada, posso testar agora.");
    await employee.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      analyst.getByText("Obrigada, posso testar agora."),
    ).toBeVisible();
    await analyst.getByRole("button", { name: "Devolver ao agente" }).click();
    await expect(
      employee.getByText("Assistente online", { exact: true }),
    ).toBeVisible();
    await employee.getByRole("button", { name: "Falar com analista" }).click();
    await analyst.getByRole("button", { name: "Assumir atendimento" }).click();
    await analyst
      .getByRole("button", { name: "Encerrar", exact: true })
      .click();
    await expect(
      employee.getByText("Atendimento encerrado", { exact: true }),
    ).toBeVisible();
    await expect(
      employee.getByRole("button", { name: "Nova conversa", exact: true }),
    ).toBeVisible();
    await employee
      .getByRole("button", { name: "Nova conversa", exact: true })
      .click();
    await expect(
      employee.getByText("Assistente online", { exact: true }),
    ).toBeVisible();
  } finally {
    await employeeContext.close();
    await analystContext.close();
  }
});
test("layout móvel mantém login e chat sem rolagem horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "ana.souza@nexo.com.br");
  await expect(page.getByLabel("Mensagem para o atendimento")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "data/mobile-chat.png", fullPage: true });
});
