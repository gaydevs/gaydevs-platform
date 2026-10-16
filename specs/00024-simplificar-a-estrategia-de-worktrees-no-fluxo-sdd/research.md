# Pesquisa — 00024

## Decisão: mudança documental, sem automação

**Racional:** a spec limita o escopo a esclarecer o uso de worktrees e a limpeza
segura. Remoção automática poderia descartar trabalho local e está fora do
escopo.

**Alternativas consideradas:** alterar helpers SDD ou criar uma rotina de limpeza
automática. Ambas ampliam o contrato e foram descartadas.

## Decisão: worktree apenas para concorrência real

**Racional:** o checkout existente atende um único trabalho; checkouts separados
evitam conflito de HEAD quando branches precisam permanecer abertas ao mesmo
tempo.

**Alternativa considerada:** worktree para toda Issue. Descartada por criar
diretórios auxiliares sem necessidade.
