# Sandbox de validação SDD

Na raiz do checkout:

```sh
node scripts/sdd/test.mjs
```

Use Node.js, Git e PowerShell 7 instalados. A execução atual da Rodada 2C passou
com **81 testes, 81 pass, 0 fail, 0 skipped**. Foi validada no Windows
com Node 24.15.0 e PowerShell 7.6.6. Não exige gh instalado, login, token,
dependência npm, Pester ou conexão com GitHub. No Windows, o harness usa os
caminhos padrão de Git e PowerShell 7; `PWSH_BIN` permite selecionar o PowerShell.
Em Linux/macOS, procura Git e pwsh no PATH; esses sistemas ainda não foram
executados nesta auditoria.

Os helpers e o launcher emitem UTF-8 explicitamente. Uma regressão simula
páginas de código 437/850/1252/65001 e confere o conteúdo Unicode completo,
incluindo acentos, setas e emoji, sem sanitizar ou reparar o JSON recebido.

## Cobertura

| Área | Exercício real na sandbox |
| --- | --- |
| Git / branches | Repositório e remoto bare locais, develop, quatro prefixos, origem em origin/develop, ID acima de 99999, checkout sujo, branches local/remota e spec já existentes, remote incorreto e base sem infraestrutura |
| Isolamento | Alternância de features, worktrees simultâneos, detached HEAD, branch inválida, spec ausente/ambígua e override efêmero |
| Estado persistente | Resíduos legados envenenados e inalterados, bloqueio de leitura/escrita/probe por Node, auditoria AST dos helpers, snapshots dos arquivos compartilhados e ausência de cache substituto |
| Issue / blockers | Tipos elegíveis, fechada, sem tipo/marcador, Team Access, Task, PR, paginação de comentários/campos e ambas as direções de dependência, blocker aberto/fechado |
| Priority / dependências | High/Medium/Low no campo nativo, add/remove com ID nativo, releitura, repetição idempotente, erros e chamadas com método/endpoint/body verificados |
| Project / gates | Status ativos desta fase, encerramento Not planned, transições assistidas Review/Ready for Release/Done, opção/campo/Project inválidos, indisponibilidade explícita, erros HTTP/GraphQL/JSON, declaração humana obrigatória e blockers |
| PR / release | Parser `Refs`/`Spec`, closing keywords proibidas, check read-only, PR manual válido, PR aberto/fechado/mergeado para develop, release develop → main com body vazio, descoberta por `merge_commit_sha`, múltiplas Issues, deduplicação, estados terminais e idempotência |
| Fluxo integrado | Consulta → blockers → from-issue --start → branch/spec → Specifying → decisões externas fictícias → plan → tasks → In Progress |
| Segurança / limpeza | gh real, subprocessos não permitidos e rede bloqueados; teste deliberadamente falho comprova remoção de checkout, remoto bare e worktree |

Scripts executados: `issue.mjs`, `from-issue.mjs`, `status.mjs`,
`priority.mjs`, `dependency.mjs`, `pr-check.mjs`, `pr-sync.mjs`,
`release-sync.mjs` e funções compartilhadas de `core.mjs`
(diretamente e por seus consumidores).

Helpers PowerShell executados: `common.ps1`, `check-prerequisites.ps1`,
`setup-plan.ps1`, `setup-tasks.ps1`, `create-new-feature.ps1` e
`resolve-template.ps1`. Os contratos consumidos por plan, tasks, implement,
analyze, clarify, checklist e converge são exercitados com seus argumentos e
artefatos. Os comandos Markdown não são agentes autônomos executados pelo teste.

Os 22 testes anteriores cobriam identidade/entrada (5), CLI com Git simulado (8)
e resolução de contexto com Git/PowerShell reais (9). As lacunas eram Git real
no fluxo completo, os CLIs de Priority/dependências, erros e paginação mais
amplos, validação dos corpos de escrita, proteção obrigatória contra rede e
limpeza em falhas. Os testes CLI foram substituídos pela sandbox compartilhada;
os demais foram preservados e migrados para a mesma fronteira protegida.

## Fronteira externa e ciclo de vida

`scripts/sdd/sandbox/` contém somente infraestrutura de teste. Cada fixture
tem diretório temporário exclusivo, repo, remoto bare, estado do fake e logs
de chamadas. Hooks Git, assinatura e configurações globais são isolados;
variáveis de credenciais e overrides herdados são retiradas do ambiente filho.
O registro de limpeza é feito antes da preparação; `t.after` remove tudo,
inclusive quando setup, comando ou asserção falha. Encerramento forçado do
processo/SO não permite prometer a execução de hooks de limpeza.

O fake gh é obrigatório: não há fallback ao executável real. Chamadas inesperadas
falham com diagnóstico. O guard de Node bloqueia subprocessos não autorizados
e APIs de rede; Git só pode transportar arquivos locais. A URL canônica do repo
é mantida como metadado para testar o preflight, mas fetch/ls-remote são
redirecionados para o bare temporário. PowerShell executa os helpers reais
com descoberta de comandos controlada e inspeção AST de acessos proibidos.
Tentativas de rede/gh real são testadas como falhas esperadas, antes da operação.

Esses controles verificam regressões nos scripts instalados; não são um
isolamento de segurança do sistema operacional contra código hostil que tente
deliberadamente remover os guards. Extensões opcionais e novos executáveis
exigem revisão explícita da fronteira antes de serem aceitos na suíte.

## O que continua dependendo de validação real

- API simulada não comprova permissões, schema remoto vigente, auto-add assíncrono,
  disponibilidade do GitHub ou efeito real das proteções/CODEOWNERS.
- `--human-approved` é uma declaração do operador; não autentica a identidade
  nem comprova a aprovação. Os helpers também não interpretam a aprovação de
  um gdev no texto dos documentos. A fixture usa decisões fictícias explícitas
  para exercitar a sequência, sem conceder aprovação real.
- O origin/develop da sandbox é local. O uso a partir do origin/develop real
  após integração do PR #12 continua pendente do review/merge humano.
- Promoção develop → main, bootstrap do CODEOWNERS na base main, reviews reais
  e deploy continuam dependendo dos gates e da infraestrutura reais.
- Review / Ready for Release / Done seguem recusados pelo CLI manual
  `status.mjs`; essas transições são exercitadas apenas pelos comandos
  assistidos `pr-sync.mjs` e `release-sync.mjs`.
- O E2E final de infraestrutura deve usar fixture técnica SDD, nunca Feature
  real de produto.

A suíte faz **zero leituras e zero escritas reais no GitHub**. Publicar o
checkpoint e atualizar a descrição do PR são operações separadas de manutenção,
fora da sandbox, autorizadas pelo gdev.
