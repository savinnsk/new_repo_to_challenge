# ADR-0004: Containers de desenvolvimento e produção

- Status: Accepted
- Date: 2026-10-28

## Contexto

A aplicação já roda com Node.js no host. O usuário solicitou Docker para desenvolvimento e produção, preservando a separação entre API e frontend e a persistência do SQLite.

## Decisão

Usar um Dockerfile multi-stage com Node.js 22 em Debian slim e dois arquivos Compose independentes. Desenvolvimento usa dependências completas e bind mounts somente das pastas de código e configuração relevantes. `node_modules`, caches e artefatos Linux ficam nos containers, separados dos arquivos do host. Alterações nos manifests e lockfile exigem rebuild.

Produção usa uma imagem de API com dependências de execução e outra de frontend com output standalone do Next.js. O tracing inclui a raiz do monorepo. O destino do proxy é fixado no build como `http://api:3001`, resolvido pela rede Compose. A API passa a aceitar `API_HOST`, mantendo loopback como padrão no host e usando `0.0.0.0` dentro dos containers.

Os serviços rodam como usuário `node`, com init, health checks e encerramento gracioso. Produção usa restart `unless-stopped`. Chaves são fornecidas exclusivamente no ambiente da API; `.env`, bancos, dependências do host e artefatos são excluídos do contexto pelo `.dockerignore`.

Volumes nomeados separados preservam o SQLite de desenvolvimento e produção em `/data`. As portas publicadas usam loopback por padrão; em produção somente a interface é publicada. A API permanece na rede interna. Não são criadas réplicas da API porque SQLite e locks de turno pressupõem um processo.

## Alternativas

Uma única imagem com os dois processos reutilizaria o supervisor local, mas dificultaria health checks e isolamento das dependências. Montar o checkout inteiro no dev exigiria mascarar `node_modules` e caches para evitar incompatibilidades entre host e Linux. Compose Watch permitiria sincronização mais seletiva, mas bind mounts das pastas necessárias funcionam sem exigir modo watch adicional.

## Consequências

Docker permite executar a aplicação sem Node.js instalado no host. A primeira criação baixa imagens e instala dependências. O frontend standalone é habilitado apenas na imagem, preservando os scripts locais com `next start`. Alterar o destino interno da API exige rebuild do frontend. `docker compose down` preserva dados; `down --volumes` remove o banco daquele ambiente. Os containers usam a autenticação demonstrativa do desafio; o modo de execução não modifica as regras de login.
