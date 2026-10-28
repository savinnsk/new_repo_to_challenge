"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Headphones,
  LogOut,
  MessageSquare,
  Plus,
  UserRound,
} from "lucide-react";
import type {
  Conversation,
  ConversationDetail,
  TicketInput,
  User,
} from "@nexo/contracts";
import { api, streamMessage } from "../lib/api";
import { Avatar, Badge, Logo, MessageBubble, TicketCard } from "./shared";
import { DraftCard } from "./draft-card";
export function EmployeeChat({
  user,
  configured,
  onLogout,
  globalError,
}: {
  user: User;
  configured: boolean;
  onLogout: () => Promise<void>;
  globalError: string;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [profile, setProfile] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const id = detail?.conversation.id;
  async function loadHistory() {
    const data = await api<{ conversations: Conversation[] }>("/conversations");
    setHistory(data.conversations);
    return data.conversations;
  }
  useEffect(() => {
    let alive = true;
    void loadHistory()
      .then(async (list) => {
        const active = list.find((c) => c.state !== "CLOSED") ?? list[0];
        const data = active
          ? await api<ConversationDetail>(`/conversations/${active.id}`)
          : await api<ConversationDetail>("/conversations", "POST");
        if (alive) setDetail(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!id || busy) return;
    const timer = setInterval(() => {
      void api<ConversationDetail>(`/conversations/${id}`)
        .then(setDetail)
        .catch((e) => setError(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [id, busy]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length, partial]);
  async function send(value = text) {
    if (!id || busy || !value.trim()) return;
    setError("");
    setBusy(true);
    setPending(value);
    setPartial("");
    setText("");
    try {
      await streamMessage(
        id,
        value,
        (delta) => setPartial((s) => s + delta),
        (data) => setDetail(data as ConversationDetail),
      );
    } catch (e) {
      setError((e as Error).message);
      try {
        setDetail(await api<ConversationDetail>(`/conversations/${id}`));
      } catch {
        /* Mantém o erro original quando a recuperação também falha. */
      }
    } finally {
      setBusy(false);
      setPartial("");
      setPending("");
    }
  }
  async function transfer() {
    if (!id) return;
    setError("");
    try {
      setDetail(
        await api<ConversationDetail>(`/conversations/${id}/transfer`, "POST"),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function draftAction(
    draftId: string,
    version: number,
    action: "confirm" | "cancel" | "edit",
    input?: TicketInput,
  ) {
    setBusy(true);
    setError("");
    try {
      setDetail(
        await api<ConversationDetail>(
          `/conversations/${id}/drafts/${draftId}${action === "edit" ? "" : `/${action}`}`,
          action === "edit" ? "PATCH" : "POST",
          { version, ...(input ? { input } : {}) },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const state = detail?.conversation.state ?? "AGENT_ACTIVE";
  const count = detail?.conversation.userMessages ?? 0;
  const lastAssistant =
    detail?.messages.filter((m) => m.role === "assistant").at(-1)?.content ??
    "";
  const suggestions = !lastAssistant.includes("?")
    ? []
    : /afetad|impacto|quantas pessoas/i.test(lastAssistant)
      ? ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"]
      : /windows|sistema operacional|versão/i.test(lastAssistant)
        ? ["Windows 10", "Windows 11", "Não sei a versão"]
        : /alternativa|impede|urgência|compromisso/i.test(lastAssistant)
          ? [
              "Estou impedido de trabalhar",
              "Tenho uma alternativa",
              "Tenho compromisso hoje",
            ]
          : [];
  return (
    <main className="employee-shell">
      <aside className="employee-sidebar">
        <Logo />
        <nav>
          <button
            className={!profile ? "selected" : ""}
            onClick={() => setProfile(false)}
          >
            <MessageSquare size={17} />
            Atendimento
          </button>
          <button
            className={profile ? "selected" : ""}
            onClick={() => setProfile(true)}
          >
            <UserRound size={17} />
            Meu perfil
          </button>
        </nav>
        <div className="history">
          <small>SUAS CONVERSAS</small>
          {history.map((c) => (
            <button
              key={c.id}
              className={c.id === id ? "active-history" : ""}
              disabled={busy}
              onClick={() => {
                void api<ConversationDetail>(`/conversations/${c.id}`)
                  .then((data) => {
                    setDetail(data);
                    setProfile(false);
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              Atendimento · {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
              <small>
                {c.state === "CLOSED" ? "Encerrado" : "Em andamento"}
              </small>
            </button>
          ))}
          {state === "CLOSED" && (
            <button
              onClick={() => {
                void api<ConversationDetail>("/conversations", "POST")
                  .then((data) => {
                    setDetail(data);
                    void loadHistory();
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              <Plus size={15} />
              Nova conversa
            </button>
          )}
        </div>
        <div className="sidebar-user">
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <button className="text-button logout" onClick={() => void onLogout()}>
          <LogOut size={16} />
          Sair
        </button>
      </aside>
      <section className="employee-main">
        <header className="topbar">
          <span>
            Service desk de TI <ChevronRight size={15} />
            <strong>{profile ? "Meu perfil" : "Atendimento"}</strong>
          </span>
          {!profile && <Badge state={state} />}
        </header>
        {profile ? (
          <div className="profile">
            <h2>Meu perfil</h2>
            <p>Seus dados de acesso ao service desk de TI.</p>
            <div className="ticket-card">
              <p>
                Nome <strong>{user.name}</strong>
              </p>
              <p>
                E-mail corporativo <strong>{user.email}</strong>
              </p>
              <p>
                Conta de demonstração. O login aceita qualquer senha não vazia.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-scroll">
              <div className="chat-content">
                {!configured && (
                  <div className="notice">
                    O agente aguarda configuração da chave do modelo no
                    servidor. Você pode consultar seus chamados abaixo ou falar
                    com um analista.
                  </div>
                )}
                {detail?.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {pending && (
                  <article className="message user">
                    <div className="bubble">{pending}</div>
                  </article>
                )}
                {busy && (
                  <article className="message assistant">
                    <div className="message-meta">
                      <strong>Nexo Assist</strong>
                      <span>Processando sua solicitação…</span>
                    </div>
                    <div className="bubble" aria-live="polite">
                      {partial || "Consultando o contexto…"}
                    </div>
                  </article>
                )}
                {state === "AGENT_ACTIVE" &&
                  !busy &&
                  suggestions.length > 0 && (
                    <div
                      className="quick-actions"
                      aria-label="Opções de resposta rápida"
                    >
                      {suggestions.map((option) => (
                        <button
                          key={option}
                          disabled={count >= 30}
                          onClick={() => void send(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                {detail?.drafts
                  .filter((d) => d.status === "pending")
                  .map((d) => (
                    <DraftCard
                      key={`${d.id}-${d.version}`}
                      draft={d}
                      disabled={busy || state === "CLOSED"}
                      onAction={(action, input) =>
                        draftAction(d.id, d.version, action, input)
                      }
                    />
                  ))}
                <details
                  className="ticket-list"
                  open={!configured || undefined}
                >
                  <summary>
                    Seus chamados <span>{detail?.tickets.length ?? 0}</span>
                  </summary>
                  {detail?.tickets.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      onSelect={
                        configured && state === "AGENT_ACTIVE"
                          ? () =>
                              void send(
                                `Quero consultar o chamado ${t.id}: ${t.title}`,
                              )
                          : undefined
                      }
                    />
                  ))}
                </details>
                <div ref={end} />
              </div>
            </div>
            <div className="composer-wrap">
              {(error || globalError) && (
                <div role="alert" className="error">
                  {error || globalError}
                </div>
              )}
              {state !== "AGENT_ACTIVE" && (
                <div className="notice">
                  {state === "CLOSED"
                    ? "Conversa encerrada. Inicie um novo atendimento no menu."
                    : "Agente pausado. Suas mensagens serão recebidas pelo analista."}
                </div>
              )}
              <div className="quick-actions">
                {state === "AGENT_ACTIVE" && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void send("Qual o status dos meus chamados?")
                      }
                    >
                      Consultar meus chamados
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void send("Preciso abrir um chamado de TI")
                      }
                    >
                      Abrir chamado
                    </button>
                    <button onClick={() => void transfer()}>
                      <Headphones size={14} />
                      Falar com analista
                    </button>
                  </>
                )}
              </div>
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <input
                  aria-label="Mensagem para o atendimento"
                  placeholder={
                    state === "AGENT_ACTIVE"
                      ? "Escreva para o Nexo…"
                      : "Mensagem para o analista…"
                  }
                  value={text}
                  maxLength={4000}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy || state === "CLOSED" || count >= 30}
                />
                <button
                  className="primary"
                  disabled={
                    busy || !text.trim() || state === "CLOSED" || count >= 30
                  }
                >
                  <ArrowUp size={17} />
                  Enviar
                </button>
              </form>
              <small className="message-count">
                {count}/30 mensagens nesta sessão · Horários de São Paulo
              </small>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
