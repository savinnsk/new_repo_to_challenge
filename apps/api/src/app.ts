import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  ticketInput,
  type User,
} from "../../../packages/contracts/src/index.js";
import { openDatabase, type Db } from "./db.js";
import { seed } from "./seed.js";
import { Store, AppError, required } from "./store.js";
import { TicketService } from "./tickets.js";
import { ChatService } from "./chat.js";
import { mastraRunner, type AgentRunner } from "./agent.js";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const idParams = z.object({ id: z.string().min(1).max(100) });
const draftParams = idParams.extend({ draftId: z.string().uuid() });
const versionInput = z.object({ version: z.number().int().positive() });
export async function createApp(
  options: { db?: Db; runner?: AgentRunner; logger?: boolean } = {},
) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 16000 });
  const db = options.db ?? openDatabase();
  seed(db);
  const store = new Store(db);
  const tickets = new TicketService(store);
  const chat = new ChatService(
    store,
    options.runner ?? mastraRunner(store, tickets),
  );
  await app.register(cookie);
  await app.register(rateLimit, { max: 90, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request) => {
    if (["POST", "PATCH", "DELETE"].includes(request.method)) {
      const allowed = [
        process.env.WEB_ORIGIN ?? "http://localhost:3000",
        "http://localhost:3001",
      ];
      if (request.headers.origin && !allowed.includes(request.headers.origin))
        throw new AppError(403, "Origem não autorizada.");
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .status(400)
        .send({ error: "Dados inválidos. Revise os campos enviados." });
    const status =
      error instanceof AppError
        ? error.statusCode
        : typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 500;
    return reply.status(status >= 400 && status < 600 ? status : 500).send({
      error:
        error instanceof AppError
          ? error.message
          : status === 429
            ? "Muitas solicitações. Aguarde um minuto."
            : "Não foi possível concluir a solicitação.",
    });
  });
  function user(request: FastifyRequest): User {
    const token = request.cookies.nexo_session;
    if (!token) throw new AppError(401, "Entre com seu e-mail corporativo.");
    const session = db
      .prepare("SELECT user_id FROM sessions WHERE token=? AND expires_at>?")
      .get(hash(token), store.now().toISOString());
    if (!session) throw new AppError(401, "Sessão expirada. Entre novamente.");
    return store.user(String(session.user_id));
  }
  function analyst(request: FastifyRequest): User {
    const u = user(request);
    if (u.role !== "analyst")
      throw new AppError(403, "Acesso restrito a analistas.");
    return u;
  }
  app.get("/api/health", async () => ({ status: "ok" }));
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = z
        .object({
          email: z.string().email().max(200),
          password: z.string().min(1).max(200),
        })
        .parse(request.body);
      const u = db
        .prepare("SELECT * FROM users WHERE email=?")
        .get(body.email.toLowerCase().trim()) as User | undefined;
      if (!u)
        throw new AppError(
          401,
          "Funcionário não encontrado nos dados de demonstração.",
        );
      const token = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires_at<?").run(
        store.now().toISOString(),
      );
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        hash(token),
        u.id,
        new Date(store.now().getTime() + 7 * 86400000).toISOString(),
      );
      reply.setCookie("nexo_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 7 * 86400,
      });
      return { user: u };
    },
  );
  app.get("/api/auth/me", async (request) => ({
    user: user(request),
    agentConfigured: Boolean(process.env.OPENAI_API_KEY),
  }));
  app.post("/api/auth/logout", async (request, reply) => {
    if (request.cookies.nexo_session)
      db.prepare("DELETE FROM sessions WHERE token=?").run(
        hash(request.cookies.nexo_session),
      );
    reply.clearCookie("nexo_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/conversations", async (request) => {
    const u = user(request);
    return {
      conversations: store.conversations(u).map((c) => ({
        ...c,
        owner: store.user(c.ownerId),
        lastMessage: store.messages(c.id).at(-1)?.content ?? "",
      })),
    };
  });
  app.post("/api/conversations", async (request) => {
    const u = user(request);
    if (u.role !== "employee")
      throw new AppError(403, "Use o console do analista.");
    return store.detail(store.createConversation(u).id, u);
  });
  app.get("/api/conversations/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return store.detail(id, user(request));
  });
  app.get("/api/tickets", async (request) => {
    const u = user(request);
    return { tickets: await tickets.list(u.id) };
  });
  app.get("/api/tickets/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return tickets.request(() => store.ticket(user(request).id, id));
  });
  app.post("/api/conversations/:id/messages", async (request, reply) => {
    const u = user(request);
    const { id } = idParams.parse(request.params);
    const { content } = z
      .object({ content: z.string().trim().min(1).max(4000) })
      .parse(request.body);
    store.access(id, u);
    // ReadableStream evita hijack e permite testes da rota; eventos finais substituem texto parcial.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;
        const emit = (event: string, data: unknown) => {
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
            } catch {
              closed = true;
            }
          }
        };
        void chat
          .message(u, id, content, emit)
          .catch((error) =>
            emit("error", {
              error:
                error instanceof AppError
                  ? error.message
                  : "Erro no atendimento.",
            }),
          )
          .finally(() => {
            if (!closed) {
              closed = true;
              controller.close();
            }
          });
      },
    });
    return reply
      .type("text/event-stream")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no")
      .send(stream);
  });
  app.post("/api/conversations/:id/transfer", async (request) => {
    const u = user(request);
    const { id } = idParams.parse(request.params);
    const c = store.access(id, u);
    if (c.state === "CLOSED") throw new AppError(409, "Atendimento encerrado.");
    store.transfer(
      id,
      `Pedido explícito de ${u.name}.\n${store
        .messages(id)
        .slice(-12)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}`,
    );
    store.addMessage(
      id,
      "system",
      "Transferência solicitada. Aguardando analista; agente pausado.",
    );
    return store.detail(id, u);
  });
  app.patch("/api/conversations/:id/drafts/:draftId", async (request) => {
    const u = user(request);
    const { id, draftId } = draftParams.parse(request.params);
    store.access(id, u);
    if (u.role !== "employee")
      throw new AppError(403, "A confirmação pertence ao funcionário.");
    const body = versionInput
      .extend({ input: ticketInput })
      .parse(request.body);
    tickets.edit(id, draftId, body.version, body.input);
    return store.detail(id, u);
  });
  app.post(
    "/api/conversations/:id/drafts/:draftId/:action",
    async (request) => {
      const u = user(request);
      const { id, draftId, action } = draftParams
        .extend({ action: z.enum(["confirm", "cancel"]) })
        .parse(request.params);
      store.access(id, u);
      if (u.role !== "employee")
        throw new AppError(403, "A confirmação pertence ao funcionário.");
      const { version } = versionInput.parse(request.body);
      if (action === "confirm") await tickets.confirm(id, draftId, version);
      else tickets.cancel(id, draftId, version);
      return store.detail(id, u);
    },
  );
  app.post("/api/analyst/conversations/:id/:action", async (request) => {
    const u = analyst(request);
    const { id, action } = idParams
      .extend({ action: z.enum(["claim", "release", "close"]) })
      .parse(request.params);
    store.analystAction(id, u, action);
    return store.detail(id, u);
  });
  app.post("/api/analyst/conversations/:id/messages", async (request) => {
    const u = analyst(request);
    const { id } = idParams.parse(request.params);
    const c = store.access(id, u);
    if (c.state !== "ANALYST_ACTIVE" || c.analystId !== u.id)
      throw new AppError(409, "Assuma o atendimento antes de responder.");
    const { content } = z
      .object({ content: z.string().trim().min(1).max(4000) })
      .parse(request.body);
    store.addMessage(id, "analyst", content);
    return store.detail(id, u);
  });
  app.get("/api/analyst/users/:id/tickets", async (request) => {
    analyst(request);
    const { id } = idParams.parse(request.params);
    required(db.prepare("SELECT id FROM users WHERE id=?").get(id));
    return { tickets: await tickets.list(id) };
  });
  app.addHook("onClose", async () => {
    if (!options.db) db.close();
  });
  return app;
}
