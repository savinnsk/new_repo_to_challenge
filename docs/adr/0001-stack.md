# ADR-0001: Node.js, Next.js, Mastra e SQLite

- Status: Accepted
- Date: 2026-10-28

## Contexto

O desafio pede TypeScript estrito, agente Mastra ou LangGraph.js e persistência. O usuário definiu backend Node.js e frontend Next.js.

## Decisão

Usar npm workspaces, API Fastify separada do Next.js, contratos Zod compartilhados e Mastra para chamadas reais ao modelo. SQLite via `node:sqlite` reduz configuração e preserva dados em disco; exigir Node 22.13+. Proxy do Next.js mantém cookies no mesmo domínio. O serviço legado será um módulo isolado com autorização própria, sem criar um microserviço adicional.

## Alternativas

PostgreSQL permitiria maior concorrência, mas exige serviço extra para execução local. API dentro do Next.js simplificaria processos, mas a API separada torna clara a divisão solicitada. LangGraph.js é permitido, porém Mastra é a preferência do PRD.

## Consequências

Dois processos locais e um banco de nó único. Adequado à demonstração, não à replicação horizontal. Migrations explícitas e testes sobre SQLite real. O uso de `node:sqlite` pode emitir aviso experimental em versões 22. Implantação futura precisará volume persistente ou migração de banco.
