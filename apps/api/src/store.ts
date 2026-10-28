import { randomUUID } from 'node:crypto';
import type { Db } from './db.js';
import { transaction } from './db.js';
import { sessionDate } from './sla.js';
import type { Conversation, ConversationDetail, Decision, Draft, Message, Ticket, User } from '../../../packages/contracts/src/index.js';
export class AppError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export function required<T>(value: T | undefined | null, message = 'Registro não encontrado.'): T { if (value === undefined || value === null) throw new AppError(404, message); return value; }
export class Store {
  constructor(public db: Db, public now: () => Date = () => new Date()) {}
  user(id: string): User { return required(this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as User | undefined); }
  conversation(id: string): Conversation { const row = required(this.db.prepare('SELECT data FROM conversations WHERE id=?').get(id)); return JSON.parse(String(row.data)) as Conversation; }
  access(id: string, user: User): Conversation { const c = this.conversation(id); if (user.role !== 'analyst' && c.ownerId !== user.id) throw new AppError(404, 'Conversa não encontrada.'); return c; }
  saveConversation(c: Conversation) { c.updatedAt = this.now().toISOString(); this.db.prepare('UPDATE conversations SET data=? WHERE id=?').run(JSON.stringify(c), c.id); }
  createConversation(user: User): Conversation {
    return transaction(this.db, () => {
      const existing = this.conversations(user).find(c => c.state !== 'CLOSED');
      if (existing) return existing;
      const c: Conversation = { id: randomUUID(), ownerId: user.id, state: 'AGENT_ACTIVE', analystId: null, summary: null, revision: 0, userMessages: 0, sessionDate: sessionDate(this.now()), updatedAt: this.now().toISOString() };
      this.db.prepare('INSERT INTO conversations VALUES(?,?,?)').run(c.id, c.ownerId, JSON.stringify(c));
      this.addMessage(c.id, 'assistant', 'Olá! Sou o Nexo Assist. Como posso ajudar com TI hoje?');
      return c;
    });
  }
  conversations(user: User): Conversation[] {
    const rows = user.role === 'analyst' ? this.db.prepare('SELECT data FROM conversations ORDER BY rowid DESC').all() : this.db.prepare('SELECT data FROM conversations WHERE owner_id=? ORDER BY rowid DESC').all(user.id);
    return rows.map(row => JSON.parse(String(row.data)) as Conversation);
  }
  messages(id: string): Message[] { return this.db.prepare('SELECT data FROM messages WHERE conversation_id=? ORDER BY rowid').all(id).map(r => JSON.parse(String(r.data)) as Message); }
  addMessage(id: string, role: Message['role'], content: string, decisions: Decision[] = []): Message {
    const message: Message = { id: randomUUID(), role, content, createdAt: this.now().toISOString(), decisions };
    this.db.prepare('INSERT INTO messages VALUES(?,?,?)').run(message.id, id, JSON.stringify(message)); return message;
  }
  drafts(id: string): Draft[] { return this.db.prepare('SELECT data FROM drafts WHERE conversation_id=? ORDER BY rowid').all(id).map(r => JSON.parse(String(r.data)) as Draft); }
  draft(conversationId: string, id: string): Draft { return required(this.drafts(conversationId).find(d => d.id === id)); }
  saveDraft(d: Draft) { this.db.prepare('UPDATE drafts SET data=? WHERE id=?').run(JSON.stringify(d), d.id); }
  tickets(ownerId: string): Ticket[] { return this.db.prepare('SELECT data FROM tickets WHERE owner_id=? ORDER BY rowid').all(ownerId).map(r => { const t = JSON.parse(String(r.data)) as Ticket; return { ...t, overdue: t.status !== 'RESOLVED' && this.now().getTime() > Date.parse(t.dueAt) }; }); }
  ticket(ownerId: string, id: string): Ticket { return required(this.tickets(ownerId).find(t => t.id === id), 'Chamado não encontrado.'); }
  detail(id: string, user: User): ConversationDetail {
    const c = this.access(id, user);
    if (c.sessionDate !== sessionDate(this.now())) { c.userMessages = 0; c.sessionDate = sessionDate(this.now()); this.saveConversation(c); }
    return { conversation: c, messages: this.messages(id), drafts: this.drafts(id), tickets: this.tickets(c.ownerId) };
  }
  transfer(id: string, summary: string): Conversation {
    const c = this.conversation(id);
    if (c.state !== 'AGENT_ACTIVE') return c;
    c.state = 'WAITING_ANALYST'; c.summary = summary; c.revision++; this.saveConversation(c); return c;
  }
  analystAction(id: string, analyst: User, action: 'claim' | 'release' | 'close'): Conversation {
    if (analyst.role !== 'analyst') throw new AppError(403, 'Acesso restrito a analistas.');
    return transaction(this.db, () => {
      const c = this.conversation(id);
      if (action === 'claim') {
        if (c.state !== 'WAITING_ANALYST') throw new AppError(409, 'Conversa não está aguardando atendimento.');
        c.state = 'ANALYST_ACTIVE'; c.analystId = analyst.id;
      } else {
        if (c.state === 'CLOSED' || c.state === 'AGENT_ACTIVE') throw new AppError(409, 'Transição indisponível.');
        if (c.analystId && c.analystId !== analyst.id) throw new AppError(409, 'Outro analista está atendendo.');
        if (action === 'close' && c.state !== 'ANALYST_ACTIVE') throw new AppError(409, 'Assuma antes de encerrar.');
        c.state = action === 'release' ? 'AGENT_ACTIVE' : 'CLOSED'; c.analystId = null;
      }
      c.revision++; this.saveConversation(c);
      this.addMessage(id, 'system', `${analyst.name} ${action === 'claim' ? 'assumiu o atendimento. Agente pausado.' : action === 'release' ? 'devolveu a conversa ao agente.' : 'encerrou o atendimento.'}`);
      return c;
    });
  }
}
