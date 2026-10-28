# ADR-0002: Regras determinísticas, confirmação e calendário

- Status: Accepted
- Date: 2026-10-28

## Contexto

O modelo não pode garantir integridade, privacidade ou prazos por texto. O PRD não define feriados, duração do dia útil ou contagem da sessão.

## Decisão

Servidor calcula prioridade e SLA. Expediente 8h–18h em São Paulo, segunda a sexta, sem feriados no protótipo; dia útil equivale a 10 horas de expediente. Crítica usa 1 hora corrida. Datas são UTC. Complementos do funcionário não renovam o início do ciclo de SLA; mudanças de prioridade recalculam o vencimento a partir desse mesmo início, persistido separadamente da última atualização do suporte; reabertura inicia novo ciclo. Reabertura permitida até 168 horas inclusive.

Rascunhos persistentes e versionados exigem confirmação por endpoint exclusivo, inacessível ao modelo. Alterações invalidam a versão anterior. ID do rascunho é a chave de idempotência da gravação transacional. Correspondência de categoria, tipo e termos do título evita duplicações óbvias; ambiguidade exige seleção pelo usuário. Nenhuma heurística garante similaridade semântica perfeita.

## Alternativas

Delegar regras ao modelo seria menos código, porém permitiria inconsistências e efeitos não autorizados. Calendário nacional completo exige regras adicionais não fornecidas.

## Consequências

Comportamento testável com relógio injetável. Calendário deve ser ampliado antes de uso real. Persistência SQLite limita escrita a um processo, suficiente para demonstração local.
