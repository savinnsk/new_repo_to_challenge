import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { Store } from './store.js';
import { TicketService } from './tickets.js';
import { createAgentTools } from './agent.js';
import type { Decision } from '../../../packages/contracts/src/index.js';
const meta = { intent: 'consultar', reason: 'Funcionário pediu informações de TI.', confidence: 'alta' as const };
test('API autentica, isola dados, restringe console e transmite SSE', async () => {
  const db = openDatabase(':memory:'); const app = await createApp({ db, runner: async (_id, _rev, decisions, emit) => { emit('Olá'); decisions.push({ action: 'teste controlado', ...meta, result: {} }); return 'Olá'; } });
  try {
    assert.equal((await app.inject('/api/conversations')).statusCode, 401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ana.souza@nexo.com.br', password: 'qualquer' } });
    assert.equal(login.statusCode, 200); const cookie = login.cookies.map(c => `${c.name}=${c.value}`).join(';'); const headers = { cookie };
    const created = await app.inject({ method: 'POST', url: '/api/conversations', headers }); assert.equal(created.statusCode, 200); const id = created.json().conversation.id as string;
    const response = await app.inject({ method: 'POST', url: `/api/conversations/${id}/messages`, headers, payload: { content: 'Olá' } });
    assert.ok(response.body.includes('event: done')); assert.ok(response.body.includes('event: delta'));
    assert.equal((await app.inject({ url: '/api/tickets/INC-20998', headers })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: `/api/analyst/conversations/${id}/claim`, headers })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: `/api/conversations/${id}/transfer`, headers: { ...headers, origin: 'https://evil.example' } })).statusCode, 403);
    const other = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'carla.mendes@nexo.com.br', password: 'x' } });
    const otherCookie = other.cookies.map(c => `${c.name}=${c.value}`).join(';');
    assert.equal((await app.inject({ url: `/api/conversations/${id}`, headers: { cookie: otherCookie } })).statusCode, 404);
  } finally { await app.close(); db.close(); }
});
test('ferramenta real consulta artigos aplicáveis sem gravar chamado e registra evidência', async () => {
  const db = openDatabase(':memory:'); const app = await createApp({ db });
  try { const store = new Store(db); const c = store.createConversation(store.user('ana')); const decisions: Decision[] = []; const tools = createAgentTools(store, new TicketService(store, 0), c.id, decisions, c.revision);
    const result = await tools.buscarCentral.execute!({ ...meta, query: 'VPN 809' }, {} as never);
    assert.ok(JSON.stringify(result).includes('Windows 10')); assert.ok(JSON.stringify(result).includes('Windows 11')); assert.equal(store.drafts(c.id).length, 0); assert.equal(decisions[0]?.action, 'buscou na central de ajuda');
    await tools.consultarChamados.execute!({ ...meta, ticketId: 'INC-20311' }, {} as never); assert.equal(store.conversation(c.id).state, 'WAITING_ANALYST');
  } finally { await app.close(); db.close(); }
});
test('baixa segurança transfere e impede execução da ferramenta solicitada', async () => {
  const db = openDatabase(':memory:'); const app = await createApp({ db });
  try { const store = new Store(db); const c = store.createConversation(store.user('ana')); const decisions: Decision[] = []; const tools = createAgentTools(store, new TicketService(store, 0), c.id, decisions, 0);
    await assert.rejects(async () => tools.buscarCentral.execute!({ ...meta, confidence: 'baixa', query: 'ambígua' }, {} as never));
    assert.equal(store.conversation(c.id).state, 'WAITING_ANALYST'); assert.ok(decisions[0]?.result); assert.ok(store.conversation(c.id).summary);
  } finally { await app.close(); db.close(); }
});
