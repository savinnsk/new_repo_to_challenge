import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "./db.js";
import { seed } from "./seed.js";
import { Store } from "./store.js";
import { ChatService } from "./chat.js";
function setup() {
  const db = openDatabase(":memory:");
  seed(db);
  const store = new Store(db);
  const user = store.user("ana");
  const c = store.createConversation(user);
  return { db, store, user, c };
}
test("transferência durante geração impede resposta tardia e preserva evento", async () => {
  const { db, store, user, c } = setup();
  const events: string[] = [];
  const chat = new ChatService(
    store,
    async (_id, _revision, _decisions, emit) => {
      emit("Parcial");
      store.transfer(c.id, "Pedido humano");
      return "Resposta tardia que não pode ser salva";
    },
  );
  await chat.message(user, c.id, "Quero um analista", (event) =>
    events.push(event),
  );
  assert.equal(store.conversation(c.id).state, "WAITING_ANALYST");
  assert.ok(events.includes("done"));
  assert.ok(
    !store.messages(c.id).some((m) => m.content.includes("Resposta tardia")),
  );
  db.close();
});
test("agente não executa durante espera ou atendimento humano", async () => {
  const { db, store, user, c } = setup();
  let calls = 0;
  const chat = new ChatService(store, async () => {
    calls++;
    return "oi";
  });
  store.transfer(c.id, "Pedido humano");
  await chat.message(user, c.id, "Nova informação", () => {});
  store.analystAction(c.id, store.user("rafael"), "claim");
  await chat.message(user, c.id, "Mais contexto", () => {});
  assert.equal(calls, 0);
  assert.equal(store.messages(c.id).filter((m) => m.role === "user").length, 2);
  db.close();
});
test("limite servidor, sessão diária e retomada preservam histórico", async () => {
  const { db, store, user, c } = setup();
  const chat = new ChatService(store, async () => "Resposta controlada");
  c.userMessages = 30;
  store.saveConversation(c);
  await assert.rejects(
    chat.message(user, c.id, "Mais uma", () => {}),
    /Limite/,
  );
  store.now = () => new Date(Date.now() + 86400000);
  await chat.message(user, c.id, "Voltei", () => {});
  assert.equal(store.conversation(c.id).userMessages, 1);
  assert.ok(store.messages(c.id).some((m) => m.content === "Voltei"));
  db.close();
});
test("erro do modelo aparece sem alegar sucesso e libera próximo turno", async () => {
  const { db, store, user, c } = setup();
  const chat = new ChatService(store, async () => {
    throw new Error("upstream secret");
  });
  await chat.message(user, c.id, "Preciso de ajuda", () => {});
  await chat.message(user, c.id, "Tentar novamente", () => {});
  const messages = store.messages(c.id);
  assert.ok(!JSON.stringify(messages).includes("upstream secret"));
  assert.ok(messages.at(-1)?.decisions.some((d) => d.action.includes("falha")));
  db.close();
});
