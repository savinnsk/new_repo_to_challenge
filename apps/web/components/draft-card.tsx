"use client";
import { useState } from "react";
import { slaLabel } from "./shared";
import { categories, type Draft, type TicketInput } from "@nexo/contracts";
export function DraftCard({
  draft,
  disabled,
  onAction,
}: {
  draft: Draft;
  disabled: boolean;
  onAction: (
    action: "confirm" | "cancel" | "edit",
    input?: TicketInput,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(draft.input);
  const label =
    draft.operation === "create"
      ? "Novo chamado"
      : draft.operation === "update"
        ? `Atualizar ${draft.ticketId}`
        : `Reabrir ${draft.ticketId}`;
  return (
    <section className="ticket-card draft">
      <div className="card-kicker">
        <span>
          {label} · Rascunho v{draft.version}
        </span>
        <span className="warning">● Aguardando confirmação</span>
      </div>
      {editing ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onAction("edit", input);
            setEditing(false);
          }}
          className="edit-form"
        >
          <label>
            Título
            <input
              required
              minLength={4}
              maxLength={160}
              value={input.title}
              onChange={(e) => setInput({ ...input, title: e.target.value })}
            />
          </label>
          <label>
            Descrição
            <textarea
              required
              minLength={10}
              maxLength={4000}
              value={input.description}
              onChange={(e) =>
                setInput({ ...input, description: e.target.value })
              }
            />
          </label>
          <div className="form-grid">
            <label>
              Tipo
              <select
                value={input.type}
                onChange={(e) =>
                  setInput({
                    ...input,
                    type: e.target.value as TicketInput["type"],
                  })
                }
              >
                <option value="INC">Incidente</option>
                <option value="REQ">Requisição</option>
              </select>
            </label>
            <label>
              Categoria
              <select
                value={input.category}
                onChange={(e) =>
                  setInput({
                    ...input,
                    category: e.target.value as TicketInput["category"],
                  })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Afetados
              <select
                value={input.affected}
                onChange={(e) =>
                  setInput({
                    ...input,
                    affected: e.target.value as TicketInput["affected"],
                  })
                }
              >
                <option value="individual">Só eu</option>
                <option value="team">Minha equipe</option>
                <option value="company">Toda a empresa</option>
              </select>
            </label>
          </div>
          {(["blocked", "commitmentToday", "workaround"] as const).map(
            (key, i) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={input[key]}
                  onChange={(e) =>
                    setInput({ ...input, [key]: e.target.checked })
                  }
                />
                {
                  [
                    "Impede trabalhar / serviço parado",
                    "Compromisso no mesmo dia",
                    "Existe alternativa",
                  ][i]
                }
              </label>
            ),
          )}
          <div className="actions">
            <button className="primary" disabled={disabled}>
              Salvar nova versão
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Voltar
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3>{draft.input.title}</h3>
          <p>{draft.input.description}</p>
          <div className="ticket-fields">
            <div>
              <small>Categoria · Tipo</small>
              {draft.input.category} · {draft.input.type}
            </div>
            <div>
              <small>Prioridade</small>
              {draft.priority} · até {slaLabel[draft.priority]}
            </div>
            <div>
              <small>Afetados</small>
              {
                {
                  individual: "Somente você",
                  team: "Sua equipe",
                  company: "Toda a empresa",
                }[draft.input.affected]
              }
            </div>
          </div>
          <footer className="actions">
            <button
              disabled={disabled}
              className="primary"
              onClick={() => void onAction("confirm")}
            >
              Confirmar
            </button>
            <button disabled={disabled} onClick={() => setEditing(true)}>
              Editar
            </button>
            <button
              disabled={disabled}
              className="text-button"
              onClick={() => void onAction("cancel")}
            >
              Cancelar
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
