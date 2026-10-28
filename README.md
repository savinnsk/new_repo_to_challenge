# Nexo Assist

Service desk de TI conversacional do desafio técnico Nexo. Backend **Node.js + Fastify + Mastra**, frontend **Next.js + React**, TypeScript estrito e SQLite persistente.

## Executar localmente

Requer Node.js **22.13+** (preferencialmente 22 LTS) e npm 10+.

```sh
npm install
cp .env.example .env
# Preencha OPENAI_API_KEY no .env para habilitar o agente.
npm run seed
npm run dev
```

Abra http://localhost:3000. Health check: http://localhost:3001/api/health. O schema é inicializado automaticamente; seeds inserem somente registros ausentes e preservam dados existentes. Sem chave, login, cards e atendimento humano continuam disponíveis; o chat informa a pendência, sem simular respostas de IA.

| Variável | Função |
| --- | --- |
| `OPENAI_API_KEY` | Credencial do provedor, somente no backend |
| `LLM_MODEL` | Modelo Mastra; padrão `openai/gpt-4.1-mini` |
| `DATABASE_PATH` | Arquivo SQLite; padrão `../../data/nexo.sqlite`, relativo a `apps/api` |
| `API_PORT` | Porta da API; padrão 3001 |
| `API_ORIGIN` | Destino do proxy Next.js; padrão `http://localhost:3001` |
| `WEB_ORIGIN` | Origem aceita para mutações; padrão `http://localhost:3000` |
| `COOKIE_SECURE` | `true` em ambiente HTTPS; `false` no desenvolvimento HTTP |
| `LEGACY_FAILURE_MS` | Indisponibilidade simulada a partir do início da API; 0 desliga |

Ambos os projetos carregam o `.env` da raiz. Mudanças de ambiente exigem reiniciar os processos. O destino do proxy também é usado no build do frontend.

Para executar o build local:

```sh
npm run build
# Em dois terminais:
npm run start -w @nexo/api
npm run start -w @nexo/web
```

## Contas e roteiro de demonstração

Todas aceitam qualquer senha **não vazia**, conforme o login simulado do desafio. Isso inclui os analistas: não é autenticação para produção.

| Pessoa | E-mail | Perfil |
| --- | --- | --- |
| Ana Souza | `ana.souza@nexo.com.br` | Funcionária |
| Carla Mendes | `carla.mendes@nexo.com.br` | Funcionária |
| Rafael Lima | `rafael.lima@nexo.com.br` | Analista |
| Bruno Tavares | `bruno.tavares@nexo.com.br` | Analista |

1. Entre como Ana e pergunte o horário do service desk. O agente deve buscar o artigo e responder sem criar chamado.
2. Relate VPN com erro 809. Informe a versão do Windows e o impacto quando perguntado: Windows 10 admite orientação do artigo; Windows 11 exige chamado.
3. Revise o rascunho, edite se necessário e confirme. Abra os detalhes das decisões e recarregue para verificar persistência.
4. Consulte `INC-20311`, sem atualização há oito dias no seed inicial. O atraso deve encaminhar a conversa ao analista.
5. Em uma janela anônima, entre como Rafael, assuma o atendimento, responda e devolva ao agente ou encerre. A fila e as mensagens atualizam a cada três segundos.
6. Como Ana, tente consultar `INC-20998`, de Carla. O servidor deve impedir acesso.
7. Relate novamente o SAP bloqueado: `INC-20150` foi resolvido há quatro dias e pode ser reaberto com confirmação.
8. Para simular o legado indisponível, configure `LEGACY_FAILURE_MS=10000`, reinicie a API e consulte chamados logo após iniciar. A tentativa deve falhar de forma recuperável, sem inventar resultado.

Datas dos seeds são relativas à primeira inserção. Para repetir os cenários após muitos dias, faça backup e remova manualmente o banco de demonstração antes de recriar o seed. Não apague um banco com dados que precise preservar.

## O que está implementado

- Login simulado, sessão por cookie e isolamento entre funcionários.
- Chat com streaming SSE, histórico persistente, cards, opções rápidas, perfil e limite de mensagens.
- Agente real Mastra com busca em seis artigos, consulta de chamados e ferramentas com contratos Zod.
- Rascunhos de criação, atualização e reabertura, edição versionada, cancelamento e confirmação idempotente.
- Prioridade e SLA determinísticos, prevenção de duplicidade por títulos e transferência com resumo.
- Detalhes persistentes das ações, evidências, segurança qualitativa e métricas de geração.
- Console com busca, filtros, histórico, painel de chamados, assumir, responder, devolver e encerrar.
- Bloqueio de respostas e ferramentas tardias após transferência e exclusividade de atendimento.
- Falha controlável do serviço legado, retries limitados e testes com SQLite real.

As seis capturas em `props/` são a referência visual disponível: login em duas colunas, chat claro com cards e console em três painéis. Não foi fornecida a URL original do Pencil. Números de desempenho ilustrativos das capturas não são apresentados como métricas reais.

## Arquitetura

```text
apps/web             Next.js App Router, componentes e proxy /api
apps/api/src/app.ts  API Fastify, autenticação e autorização HTTP
apps/api/src/agent.ts Mastra e ferramentas auditadas
apps/api/src/chat.ts Orquestração de turnos e proteção de respostas tardias
apps/api/src/tickets.ts Serviço legado simulado e mutações confirmadas
apps/api/src/sla.ts  Prioridade e calendário determinísticos
apps/api/src/store.ts Persistência e transições de atendimento
apps/api/src/db.ts   Schema inicial e controle de versão de migrations
packages/contracts  Schemas Zod e tipos compartilhados
```

A API roda em processo separado do Next.js. O legado é um módulo separado do agente, com contratos e falha própria; não exige outro servidor. SQLite persiste em `data/`, fora do Git. Tabelas: usuários, sessões (token com hash), chamados, artigos, conversas, mensagens, rascunhos e migrations. O agente não possui ferramenta de confirmação nem recebe identidade arbitrária do cliente.

Estados: `AGENT_ACTIVE → WAITING_ANALYST → ANALYST_ACTIVE → AGENT_ACTIVE/CLOSED`. Espera e atendimento humano pausam o agente. Rascunhos já preparados podem ser confirmados explicitamente pelo funcionário durante a pausa; isso gera evento do sistema e não reativa o agente. Uma nova conversa só é criada após encerrar a anterior.

Decisões e alternativas estão no [índice de ADRs](docs/adr/README.md). [Changelog](CHANGELOG.md), [prompt de implementação](prompt.md) e [orientações dos agentes](AGENTS.md).

## Como o agente decide

Mastra interpreta a mensagem e usa ferramentas para obter fatos, buscar ajuda, preparar rascunho ou transferir. Schemas Zod validam entrada e saída; autorização, SLA, versão da confirmação, idempotência e transições são verificadas pelo servidor. Resultados e mensagens são dados não confiáveis, não instruções para ultrapassar permissões.

Cada ação registra intenção, justificativa resumida, resultado e segurança qualitativa. Segurança baixa transfere; ela é autodeclarada pelo modelo e **não representa probabilidade calibrada**. O servidor também transfere ao consultar chamado selecionado vencido ou preparar um caso crítico. O botão de transferência funciona sem modelo. Não há exposição de cadeia de pensamento ou prompts internos.

`openai/gpt-4.1-mini` é uma escolha inicial para equilibrar custo e latência na triagem com ferramentas, configurável por ambiente. Não foi realizado benchmark comparativo. Limites: 5 passos por turno, 900 tokens por geração, 24 mensagens de contexto e timeout de 45 segundos. Uso de tokens retornado pelo provedor e duração ficam nos detalhes; preço monetário depende da tabela contratada. O histórico completo continua no banco.

## Premissas e trade-offs

- SLA: segunda a sexta, 8h–18h em São Paulo, sem feriados; dia útil equivale a 10 horas. Crítica = 1 hora corrida, com plantão 24h. Horários persistidos em UTC.
- Complemento do funcionário não reinicia SLA do suporte; mudança de prioridade recalcula o prazo a partir do mesmo início de ciclo. Reabertura inicia novo ciclo e é permitida até 168 horas após resolução, inclusive.
- Sessão = conversa por dia de São Paulo. Até 30 mensagens do funcionário; respostas, eventos e confirmação por botão não contam. No dia seguinte a quota renova, preservando histórico.
- Deduplicação compara tipo, categoria e termos do título; não garante equivalência semântica perfeita. Ambiguidade deve ser esclarecida pelo agente e funcionário.
- SQLite e lock de turno em memória atendem um processo local. Escala horizontal exigiria banco e coordenação compartilhados.
- O legado local usa falha temporal controlada e três tentativas com backoff. Não simula uma conexão remota travada; o turno tem timeout global.
- Revisão persistente bloqueia efeitos tardios do agente; a requisição ao provedor pode consumir tokens até terminar ou atingir timeout.
- Histórico do modelo é limitado, sem resumo de longo prazo automático. Anexos e notificações externas não fazem parte desta entrega.
- Segurança: cookies HttpOnly/SameSite, validação de origem, rate limit e limite de corpo. Chaves ficam no servidor. Identidade não vem do corpo da requisição. Autenticação real, retenção e auditoria operacional exigiriam trabalho antes de produção.

## Verificação

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
# Primeira execução de navegador, se necessário:
npx playwright install chromium
npm run test:e2e
```

Os testes de domínio e HTTP usam SQLite real e modelo controlado, sem custo externo. Os testes Playwright iniciam API e frontend isolados nas portas 3101/3100 e usam banco próprio em `data/`. Não rode outro `next dev` no mesmo checkout durante os testes, pois o Next.js usa lock do diretório `.next`.

A suíte cobre SLA, confirmação, idempotência, edição, reabertura e sua fronteira de 7 dias, privacidade, indisponibilidade, persistência, estados humanos, respostas tardias e limite de mensagens. Os testes de navegador cobrem revisão de rascunho, retomada, transferência entre duas sessões, atendimento humano e viewport móvel. Veja [cenários de avaliação](docs/evaluation.md).

A integração com o provedor real precisa ser exercitada com uma chave válida; testes controlados não atestam a qualidade linguística ou de decisão do modelo em produção. O repositório não inclui chave nem deploy.

## Com mais tempo

Avaliações repetidas com o provedor real, conjunto maior de paráfrases e ataques de prompt injection, calibração de encaminhamento, calendário de feriados, similaridade semântica para duplicidade, resumo de contexto longo, notificações por push, autenticação corporativa e implantação com armazenamento persistente e orçamento de consumo.

Verificação local em 28/10/2026, com Node.js 26.8.2: **19 testes de domínio/HTTP e 3 testes Playwright aprovados**, além de tipos, lint, formatação e build. O backend compilado também iniciou e respondeu ao health check. Chamadas ao provedor real não foram executadas por falta de chave configurada.
