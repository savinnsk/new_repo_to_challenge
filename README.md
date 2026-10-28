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

## Agente e API

Mastra com `openai/gpt-4.1-mini` configurável por `LLM_MODEL`: escolha inicial por latência/custo para triagem com ferramentas; não há benchmark de qualidade real ainda. Até 5 passos, 900 tokens por geração e 24 mensagens de contexto, com timeout de 45 segundos. Detalhes das ações são persistidos; confiança qualitativa não é probabilidade calibrada. Consulte [documentação oficial de ferramentas Mastra](https://mastra.ai/docs/agents/tools).

Sessão = conversa por dia de São Paulo, até 30 mensagens do funcionário; respostas, eventos e confirmações por botão não contam. Dia seguinte renova quota e mantém histórico. Cookies HttpOnly/SameSite, token armazenado como hash, validação de origem e rate limit protegem o protótipo; login é simulado e não deve ser usado em produção.

O serviço legado permite falha reproduzível por `LEGACY_FAILURE_MS`, espera com backoff e no máximo três tentativas; gravações confirmadas são idempotentes por rascunho. Consulte a API através de `/api` no Next.js para manter cookies no mesmo domínio.

## Demonstração

Use qualquer senha não vazia para `ana.souza@nexo.com.br` ou `carla.mendes@nexo.com.br`. O perfil mostra a identidade autenticada. No chat, consulte cards, selecione um chamado, converse para preparar um rascunho, revise os campos e confirme. Ações e evidências ficam em “Ver detalhes das decisões”. Sem chave do modelo é possível ver os chamados e solicitar transferência.
