# Contrato do `from-issue --start` relacionado à publicação

## Entrada

`node scripts/sdd/from-issue.mjs NUMERO --start`

## Git

- busca `origin/develop`;
- cria a branch SDD com HEAD no mesmo commit de `origin/develop`;
- não configura upstream para a nova branch;
- não publica a branch automaticamente.

## Saída

- stdout continua contendo exclusivamente o JSON de trabalho já existente;
- stderr pode conter orientação operacional humana e deve informar `git push -u origin HEAD` para a primeira publicação.

## GitHub

O comentário inicial da Issue deve informar que branch/spec ainda não foram publicadas e indicar `git push -u origin HEAD` como primeiro push.

## Pós-condição da primeira publicação

Após o gdev executar `git push -u origin HEAD`, o upstream local deve ser `origin/<mesmo-nome-da-branch>`.
