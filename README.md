# Nexo Assist

Service desk de TI conversacional do desafio técnico Nexo. Backend Node.js com Fastify e Mastra; frontend Next.js/React; TypeScript estrito nos dois projetos.

## Desenvolvimento

Requer Node.js 22.13+ (preferencialmente 22 LTS) e npm 10+.

```sh
npm install
cp .env.example .env
npm run seed
npm run dev
```

Interface: http://localhost:3000. API: http://localhost:3001/api/health.
Preencha `OPENAI_API_KEY` no `.env` para habilitar o agente real. Sem chave não há simulação silenciosa de IA.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Arquitetura

- `apps/web`: Next.js App Router, interface e proxy da API no mesmo domínio.
- `apps/api`: Node.js/Fastify, agente Mastra, domínio e serviço legado simulado.
- `packages/contracts`: contratos Zod e tipos compartilhados.
- SQLite persistente em `data/`, fora do Git; migrations versionadas no backend.
- `props/`: capturas do protótipo fornecidas pelo usuário; referência visual local.

Decisões: [ADRs](docs/adr/README.md). Requisitos e sequência: [prompt.md](prompt.md).

Estado inicial: estrutura de desenvolvimento criada. Funcionalidades serão registradas conforme forem implementadas.

## Regras implementadas no domínio

Prioridades e prazos do Anexo A; calendário segunda a sexta, 8h–18h, São Paulo, sem feriados. Dia útil = 10 horas de expediente; crítica = 1 hora corrida. Complemento de funcionário não renova prazo do suporte. Reabertura até 168 horas inclusive. Rascunho confirmado grava uma única vez, mesmo com repetição da requisição; editar exige nova confirmação. Semelhança de títulos auxilia a deduplicação, mas ambiguidades precisam de seleção explícita.

Seeds preservam dados existentes e calculam datas relativas apenas na primeira inserção. Para recriar uma demonstração envelhecida, faça backup e remova manualmente o banco local antes do seed.
