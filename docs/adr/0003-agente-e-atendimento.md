# ADR-0003: Ferramentas auditáveis e atendimento humano

- Status: Accepted
- Date: 2026-10-28

## Contexto

O desafio prioriza transparência e transferência sem respostas simultâneas do agente e analista.

## Decisão

Mastra usa ferramentas com schemas Zod e identidade capturada da sessão. Nenhuma ferramenta confirma chamados. Cada ferramenta registra ação, resultado e justificativa resumida. Segurança alta/média/baixa é qualitativa; baixa transfere. O servidor também transfere ao consultar chamado vencido ou preparar caso crítico. Pedido direto tem endpoint independente do LLM.

Respostas usam SSE; evento final substitui texto parcial. Estado persistente e revisão da conversa bloqueiam ferramentas e gravação de resposta após transferência. Um turno por conversa por processo. Espera e atendimento pausam o agente; assumir é uma transação exclusiva. Interface consulta novidades a cada 3 segundos.

Sessão de mensagens = conversa por dia de São Paulo, com até 30 mensagens enviadas pelo funcionário, inclusive durante atendimento humano. Respostas do agente, analista, eventos e confirmação por botão não contam. Retomar no dia seguinte renova a quota e preserva histórico. Nova conversa só é aberta após encerrar a anterior.

## Alternativas

WebSocket permitiria push bidirecional, mas adicionaria infraestrutura para o protótipo. Exibir cadeia de pensamento não é necessário para explicar ações e exporia conteúdo interno. Respostas roteirizadas não atendem ao requisito de agente real.

## Consequências

Limite de 5 passos, 900 tokens por geração, histórico de 24 mensagens e timeout de 45 segundos controlam consumo. A confirmação e o histórico completo persistem fora do contexto limitado. Histórico longo pode perder nuances para o modelo; resumo de longo prazo é melhoria futura. Interrupção lógica bloqueia efeitos tardios, mas a chamada ao provedor pode continuar até timeout. Execução distribuída exigiria lock compartilhado. Login aceita qualquer senha inclusive para contas de analista do seed: exclusivamente demonstração local, nunca produção.

Rascunhos preparados podem receber confirmação explícita do funcionário durante a pausa. A gravação gera evento de sistema, preserva o estado humano e não habilita ferramentas do agente. Métricas de duração e uso retornadas pelo provedor ficam nas decisões, sem estimar preço monetário.
