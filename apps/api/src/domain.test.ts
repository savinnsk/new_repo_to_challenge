import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './db.js';
import { Store } from './store.js';
import { seed } from './seed.js';
import { classify, dueAt } from './sla.js';
import { TicketService } from './tickets.js';
import type { TicketInput } from '../../../packages/contracts/src/index.js';
const now = new Date('2026-10-28T15:00:00Z');
const input: TicketInput = { title: 'VPN erro 809 no notebook', description: 'A VPN não conecta no Windows 11 desde ontem.', type: 'INC', category: 'Rede e VPN', affected: 'individual', blocked: true, commitmentToday: true, workaround: false };
function setup() { const db = openDatabase(':memory:'); seed(db, now); const store = new Store(db, () => now); const c = store.createConversation(store.user('ana')); return { db, store, c, service: new TicketService(store, 0) }; }
test('SLA considera expediente, fim de semana, minutos e plantão crítico', () => {
  assert.equal(dueAt(new Date('2026-10-30T20:30:00Z'), 'Alta').toISOString(), '2026-11-02T14:30:00.000Z');
  assert.equal(dueAt(new Date('2026-10-30T20:30:00Z'), 'Crítica').toISOString(), '2026-10-30T21:30:00.000Z');
  assert.equal(dueAt(new Date('2026-10-28T11:00:00Z'), 'Média').toISOString(), '2026-10-30T21:00:00.000Z');
  assert.equal(dueAt(new Date('2026-10-31T15:00:00Z'), 'Baixa').toISOString(), '2026-11-06T21:00:00.000Z');
});
test('prioridade respeita impacto, bloqueio, urgência e requisição', () => {
  assert.equal(classify(input), 'Alta'); assert.equal(classify({ ...input, affected: 'team' }), 'Crítica');
  assert.equal(classify({ ...input, blocked: false, commitmentToday: false, workaround: true }), 'Média');
  assert.equal(classify({ ...input, type: 'REQ', blocked: false, commitmentToday: false }), 'Baixa');
});
test('rascunho não grava; confirmação idempotente; editar invalida versão anterior', async () => {
  const { db, store, c, service } = setup(); const before = store.tickets('ana').length;
  const d = service.prepare(c.id, input); assert.equal(store.tickets('ana').length, before);
  const edited = service.edit(c.id, d.id, 1, { ...input, title: 'VPN erro 809 persistente' });
  await assert.rejects(service.confirm(c.id, d.id, 1), /versão atual/);
  const a = await service.confirm(c.id, d.id, edited.version); const b = await service.confirm(c.id, d.id, edited.version);
  assert.equal(a.id, b.id); assert.equal(store.tickets('ana').length, before + 1); db.close();
});
test('duplicidade atualiza existente e complemento não reinicia SLA vencido', async () => {
  const { db, store, c, service } = setup();
  const d = service.prepare(c.id, { ...input, title: 'Notebook lento após atualização', category: 'Hardware' });
  assert.equal(d.operation, 'update'); const before = store.ticket('ana', 'INC-20311');
  const t = await service.confirm(c.id, d.id, 1); assert.equal(t.id, before.id); assert.equal(t.dueAt, before.dueAt);
  assert.equal(store.conversation(c.id).state, 'WAITING_ANALYST'); db.close();
});
test('reabertura permite até 7 dias e rejeita chamado antigo', async () => {
  const { db, c, service } = setup();
  const d = service.prepare(c.id, { ...input, title: 'Senha do SAP bloqueada', category: 'Acesso' }, 'INC-20150');
  assert.equal(d.operation, 'reopen'); const t = await service.confirm(c.id, d.id, 1); assert.equal(t.status, 'OPEN');
  assert.throws(() => service.prepare(c.id, { ...input, category: 'E-mail' }, 'INC-19877'), /mais de 7 dias/); db.close();
});
test('isolamento de chamados e conversas; transições exclusivas de analista', () => {
  const { db, store, c, service } = setup(); assert.throws(() => store.ticket('ana', 'INC-20998'), /não encontrado/);
  assert.throws(() => service.prepare(c.id, input, 'INC-20998'), /não encontrado/);
  assert.throws(() => store.access(c.id, store.user('carla')), /não encontrada/);
  assert.throws(() => store.analystAction(c.id, store.user('ana'), 'claim'), /restrito/);
  store.transfer(c.id, 'Pedido do funcionário'); store.analystAction(c.id, store.user('rafael'), 'claim');
  assert.throws(() => store.analystAction(c.id, store.user('bruno'), 'claim'), /aguardando/);
  assert.throws(() => store.analystAction(c.id, store.user('bruno'), 'release'), /Outro analista/);
  assert.throws(() => service.prepare(c.id, input), /pausado/);
  store.analystAction(c.id, store.user('rafael'), 'release'); assert.equal(store.conversation(c.id).state, 'AGENT_ACTIVE'); db.close();
});
test('SQLite preserva conversa, rascunho e estado humano após reabrir conexão', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nexo-')); const path = join(directory, 'test.sqlite');
  try { const db = openDatabase(path); seed(db, now); const store = new Store(db, () => now); const c = store.createConversation(store.user('ana')); const draft = new TicketService(store, 0).prepare(c.id, input); store.transfer(c.id, 'Teste persistente'); db.close();
    const reopened = openDatabase(path); const next = new Store(reopened, () => now); assert.equal(next.conversation(c.id).state, 'WAITING_ANALYST'); assert.equal(next.draft(c.id, draft.id).status, 'pending'); assert.ok(next.messages(c.id).length); reopened.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('legado indisponível falha sem criar chamado e recupera depois', async () => {
  const { db, store, c } = setup(); const service = new TicketService(store, 650); const d = service.prepare(c.id, input);
  await assert.rejects(service.confirm(c.id, d.id, 1), /indisponível/); assert.equal(store.draft(c.id, d.id).status, 'pending');
  await new Promise(r => setTimeout(r, 220)); await service.confirm(c.id, d.id, 1); db.close();
});
