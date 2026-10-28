"use client";
import { Check, ChevronDown, Clock3, ExternalLink } from "lucide-react";
import type { Message, Ticket, ConversationState } from "@nexo/contracts";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <svg width="25" height="27" viewBox="0 0 25 27" aria-hidden="true">
        <path d="M2 23V5l5-3 11 10V3l5 3v18l-5 2L7 16v9z" fill="currentColor" />
      </svg>
      {!compact && <strong>Nexo Assist</strong>}
    </div>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar">
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export const stateLabel: Record<ConversationState, string> = {
  AGENT_ACTIVE: "Assistente online",
  WAITING_ANALYST: "Aguardando atendente",
  ANALYST_ACTIVE: "Analista atendendo",
  CLOSED: "Atendimento encerrado",
};
export function Badge({ state }: { state: ConversationState }) {
  return (
    <span
      className={`badge ${state === "AGENT_ACTIVE" ? "green" : state === "CLOSED" ? "gray" : "amber"}`}
    >
      <i />
      {stateLabel[state]}
    </span>
  );
}
export function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function MessageBubble({ message }: { message: Message }) {
  return (
    <article className={`message ${message.role}`}>
      {message.role !== "user" && message.role !== "system" && (
        <div className="message-meta">
          <strong>
            {message.role === "analyst"
              ? "Analista do service desk"
              : "Nexo Assist"}
          </strong>
          {message.decisions.map((d, i) => (
            <span key={i}>
              <Check size={12} /> {d.action}
            </span>
          ))}
        </div>
      )}
      <div className="bubble">{message.content}</div>
      <time className="message-time">{date(message.createdAt)}</time>
      {message.decisions.length > 0 && (
        <details className="decisions">
          <summary>
            <ChevronDown size={13} /> Ver detalhes das decisões
          </summary>
          {message.decisions.map((d, i) => (
            <div className="decision" key={i}>
              <strong>{d.action}</strong>
              <p>
                Intenção: {d.intent} · Segurança: {d.confidence}
              </p>
              <p>{d.reason}</p>
              <details>
                <summary>Resultado da ação</summary>
                <pre>{JSON.stringify(d.result, null, 2)}</pre>
              </details>
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
export function TicketCard({
  ticket,
  onSelect,
}: {
  ticket: Ticket;
  onSelect?: () => void;
}) {
  return (
    <article className="ticket-card">
      <div className="card-kicker">
        <span>Chamado · {ticket.id}</span>
        <span className={ticket.overdue ? "warning" : ""}>
          ●{" "}
          {ticket.status === "RESOLVED"
            ? "Resolvido"
            : ticket.overdue
              ? "Prazo vencido"
              : "Aguardando analista"}
        </span>
      </div>
      <h3>{ticket.title}</h3>
      <p>{ticket.description}</p>
      <div className="ticket-fields">
        <div>
          <small>Categoria</small>
          {ticket.category}
        </div>
        <div>
          <small>Prioridade</small>
          {ticket.priority}
        </div>
        <div>
          <small>
            <Clock3 size={12} /> Prazo · São Paulo
          </small>
          {date(ticket.dueAt)}
        </div>
      </div>
      {onSelect && (
        <button className="text-button" onClick={onSelect}>
          Consultar ou complementar <ExternalLink size={13} />
        </button>
      )}
    </article>
  );
}

export const slaLabel = {
  Crítica: "1 hora corrida",
  Alta: "4 horas úteis",
  Média: "3 dias úteis",
  Baixa: "5 dias úteis",
} as const;
