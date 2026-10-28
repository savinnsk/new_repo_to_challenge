import type { AgentRunner } from './agent.js';
import { Store, AppError } from './store.js';
import { transaction } from './db.js';
import { sessionDate } from './sla.js';
import type { Decision, User } from '../../../packages/contracts/src/index.js';
export class ChatService {
  private busy = new Set<string>();
  constructor(public store: Store, public run: AgentRunner) {}
  async message(user: User, id: string, content: string, emit: (event: string, data: unknown) => void) {
    const c = this.store.access(id, user);
    if (user.role !== 'employee') throw new AppError(403, 'Use o console do analista.');
    if (c.state === 'CLOSED') throw new AppError(409, 'Atendimento encerrado. Inicie uma nova conversa.');
    if (this.busy.has(id)) throw new AppError(409, 'Aguarde a resposta em andamento.');
    this.busy.add(id);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
    const decisions: Decision[] = [];
    try {
      transaction(this.store.db, () => {
        if (c.sessionDate !== sessionDate(this.store.now())) { c.sessionDate = sessionDate(this.store.now()); c.userMessages = 0; }
        if (c.userMessages >= 30) throw new AppError(429, 'Limite de 30 mensagens atingido hoje nesta conversa. O histórico continua disponível.');
        c.userMessages++; this.store.saveConversation(c); this.store.addMessage(id, 'user', content);
      });
      emit('accepted', {});
      if (c.state !== 'AGENT_ACTIVE') { emit('done', this.store.detail(id, user)); return; }
      let answer: string;
      try {
        answer = await this.run(id, c.revision, decisions, delta => emit('delta', { text: delta }), controller.signal);
        if (!answer.trim() && this.store.conversation(id).state === 'AGENT_ACTIVE') throw new AppError(502, 'O modelo não retornou uma resposta.');
      } catch (error) {
        if (this.store.conversation(id).state !== 'AGENT_ACTIVE') answer = '';
        else {
          answer = error instanceof AppError ? error.message : 'Não consegui concluir a resposta agora. Tente novamente ou fale com um analista.';
          decisions.push({ action: 'registrou falha do atendimento', intent: 'responder', confidence: 'baixa', reason: controller.signal.aborted ? 'Limite de 45 segundos excedido.' : 'Serviço do modelo indisponível ou resposta inválida.', result: { failed: true } });
        }
      }
      const current = this.store.conversation(id);
      if (current.state === 'AGENT_ACTIVE' && current.revision === c.revision) {
        if (!decisions.length) decisions.push({ action: 'gerou resposta sem ferramenta', intent: 'conversa', confidence: 'média', reason: 'Nenhuma ferramenta executada neste turno; resposta sem evidência externa registrada.', result: {} });
        this.store.addMessage(id, 'assistant', answer, decisions);
      } else if (current.state === 'WAITING_ANALYST') {
        this.store.addMessage(id, 'system', 'Conversa encaminhada a um analista com o contexto. O Nexo Assist está pausado.', decisions);
      }
      emit('done', this.store.detail(id, user));
    } finally { clearTimeout(timer); this.busy.delete(id); }
  }
}
