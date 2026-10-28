import { randomUUID } from "node:crypto";
import {
  ticketInput,
  type Draft,
  type Ticket,
  type TicketInput,
} from "../../../packages/contracts/src/index.js";
import { Store, AppError } from "./store.js";
import { transaction } from "./db.js";
import { classify, dueAt } from "./sla.js";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function related(a: TicketInput, b: TicketInput) {
  if (a.category !== b.category || a.type !== b.type) return false;
  const words = (s: string) =>
    normalize(s)
      .split(/\W+/)
      .filter(
        (w) =>
          w.length > 3 &&
          ![
            "para",
            "como",
            "apos",
            "desde",
            "esta",
            "meu",
            "minha",
            "problema",
            "chamado",
          ].includes(w),
      );
  const left = new Set(words(a.title));
  const right = new Set(words(b.title));
  const common = [...left].filter((w) => right.has(w)).length;
  return (
    common >= 2 && common / Math.max(1, Math.min(left.size, right.size)) >= 0.5
  );
}
export class TicketService {
  private failureUntil: number;
  constructor(
    public store: Store,
    failureMs = Number(process.env.LEGACY_FAILURE_MS ?? 0),
  ) {
    this.failureUntil = Date.now() + failureMs;
  }
  async request<T>(work: () => T): Promise<T> {
    // Cada operação é local e síncrona; retries limitados não mantêm transação aberta durante espera.
    for (let attempt = 0; ; attempt++) {
      if (Date.now() >= this.failureUntil) return work();
      if (attempt >= 2)
        throw new AppError(
          503,
          "Sistema de chamados temporariamente indisponível. Tente novamente em instantes.",
        );
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
    }
  }
  list(ownerId: string) {
    return this.request(() => this.store.tickets(ownerId));
  }
  prepare(conversationId: string, raw: TicketInput, targetId?: string): Draft {
    const input = ticketInput.parse(raw);
    const c = this.store.conversation(conversationId);
    if (c.state !== "AGENT_ACTIVE") throw new AppError(409, "Agente pausado.");
    const now = this.store.now();
    const candidates = this.store.tickets(c.ownerId);
    const explicit = targetId
      ? this.store.ticket(c.ownerId, targetId)
      : undefined;
    const existing =
      explicit ??
      candidates.find((t) => t.status === "OPEN" && related(input, t)) ??
      candidates.find(
        (t) =>
          t.status === "RESOLVED" &&
          this.reopenable(t, now) &&
          related(input, t),
      );
    if (existing?.status === "RESOLVED" && !this.reopenable(existing, now))
      throw new AppError(
        409,
        "Este chamado foi resolvido há mais de 7 dias. Prepare um novo chamado.",
      );
    const previous = this.store
      .drafts(conversationId)
      .filter((d) => d.status === "pending");
    for (const d of previous) {
      d.status = "cancelled";
      this.store.saveDraft(d);
    }
    const draft: Draft = {
      id: randomUUID(),
      version: 1,
      operation: existing
        ? existing.status === "RESOLVED"
          ? "reopen"
          : "update"
        : "create",
      ticketId: existing?.id ?? null,
      input,
      priority: classify(input),
      status: "pending",
      resultId: null,
    };
    this.store.db
      .prepare("INSERT INTO drafts VALUES(?,?,?)")
      .run(draft.id, conversationId, JSON.stringify(draft));
    return draft;
  }
  edit(
    conversationId: string,
    id: string,
    version: number,
    input: TicketInput,
  ): Draft {
    return transaction(this.store.db, () => {
      const c = this.store.conversation(conversationId);
      if (c.state === "CLOSED")
        throw new AppError(409, "Atendimento encerrado.");
      const d = this.store.draft(conversationId, id);
      if (d.status !== "pending" || d.version !== version)
        throw new AppError(409, "Rascunho alterado ou indisponível.");
      d.input = ticketInput.parse(input);
      d.priority = classify(d.input);
      d.version++;
      this.store.saveDraft(d);
      if (d.priority === "Crítica")
        this.store.transfer(
          conversationId,
          `Caso crítico no rascunho ${d.id}: ${d.input.title}. ${d.input.description}. Ainda não confirmado.`,
        );
      return d;
    });
  }
  cancel(conversationId: string, id: string, version: number) {
    const d = this.store.draft(conversationId, id);
    if (d.status !== "pending" || d.version !== version)
      throw new AppError(409, "Rascunho indisponível.");
    d.status = "cancelled";
    this.store.saveDraft(d);
  }
  private reopenable(t: Ticket, now: Date) {
    return (
      t.resolvedAt !== null &&
      now.getTime() - Date.parse(t.resolvedAt) <= 7 * 86400000
    );
  }
  confirm(
    conversationId: string,
    id: string,
    version: number,
  ): Promise<Ticket> {
    return this.request(() =>
      transaction(this.store.db, () => {
        const c = this.store.conversation(conversationId);
        const d = this.store.draft(conversationId, id);
        if (d.version !== version)
          throw new AppError(
            409,
            "Confira e confirme a versão atual do rascunho.",
          );
        if (d.status === "confirmed" && d.resultId)
          return this.store.ticket(c.ownerId, d.resultId);
        if (c.state === "CLOSED" || d.status !== "pending")
          throw new AppError(409, "Confirmação indisponível.");
        const now = this.store.now();
        const existing = d.ticketId
          ? this.store.ticket(c.ownerId, d.ticketId)
          : this.store
              .tickets(c.ownerId)
              .find((t) => t.status === "OPEN" && related(d.input, t));
        // Se outro chamado surgiu depois do rascunho, exigir revisão da operação proposta.
        if (!d.ticketId && existing)
          throw new AppError(
            409,
            "Já existe um chamado equivalente. Peça ao agente um rascunho de atualização.",
          );
        if (existing?.status === "RESOLVED" && !this.reopenable(existing, now))
          throw new AppError(
            409,
            "Prazo de reabertura expirado. Prepare um novo chamado.",
          );
        const at = now.toISOString();
        const slaStartedAt =
          existing && d.operation === "update" ? existing.slaStartedAt : at;
        const ticket: Ticket = {
          ...d.input,
          id:
            existing?.id ??
            `${d.input.type}-${randomUUID().slice(0, 8).toUpperCase()}`,
          ownerId: c.ownerId,
          priority: d.priority,
          status: "OPEN",
          createdAt: existing?.createdAt ?? at,
          description: existing
            ? `${existing.description}\n\nComplemento do funcionário (${at}): ${d.input.description}`
            : d.input.description,
          supportUpdatedAt: existing?.supportUpdatedAt ?? at,
          slaStartedAt,
          resolvedAt: null,
          // Complemento do funcionário não reinicia SLA; reabertura inicia novo ciclo.
          dueAt: dueAt(new Date(slaStartedAt), d.priority).toISOString(),
          overdue: false,
        };
        this.store.db
          .prepare(
            "INSERT INTO tickets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
          )
          .run(ticket.id, c.ownerId, JSON.stringify(ticket));
        d.status = "confirmed";
        d.resultId = ticket.id;
        this.store.saveDraft(d);
        const result = this.store.ticket(c.ownerId, ticket.id);
        this.store.addMessage(
          conversationId,
          c.state === "AGENT_ACTIVE" ? "assistant" : "system",
          `Chamado ${ticket.id} ${d.operation === "create" ? "criado" : d.operation === "reopen" ? "reaberto" : "atualizado"} após sua confirmação.`,
          [
            {
              action: "gravou chamado confirmado",
              intent: d.operation,
              confidence: "alta",
              reason:
                "Confirmação explícita da versão atual, autorização e idempotência validadas no servidor.",
              result: { id: ticket.id, version },
            },
          ],
        );
        if (result.priority === "Crítica" || result.overdue) {
          this.store.transfer(
            conversationId,
            `${ticket.id}: ${ticket.title}. ${ticket.description}. Transferência por ${result.overdue ? "prazo vencido" : "criticidade"}.`,
          );
          this.store.addMessage(
            conversationId,
            "system",
            "Conversa encaminhada a um analista. Agente pausado.",
          );
        }
        return result;
      }),
    );
  }
}
