# Guia de validação — Issue #40

## Pré-requisitos

- checkout na branch da Issue #40;
- Node.js 20+ e Git disponíveis;
- PowerShell 7 disponível para a sandbox SDD.

## Validação automatizada

```sh
node scripts/sdd/test.mjs
```

Resultado esperado: suíte completa SDD concluída com sucesso, incluindo a regressão de upstream.

## Cenário essencial da sandbox

O teste de criação de branch deve provar a sequência:

```sh
git rev-parse HEAD
git rev-parse origin/develop
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
```

Os dois primeiros valores devem ser iguais e o terceiro comando deve falhar porque ainda não há upstream.

Depois da primeira publicação:

```sh
git push -u origin HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
```

O segundo comando deve retornar `origin/<nome-da-branch-atual>`.

## Validação no checkout real

Antes do primeiro push da #40, confirmar que a branch não possui upstream. Depois de todos os testes e aprovação do plan, publicar com `git push -u origin HEAD` e verificar que o tracking aponta para a própria branch remota, nunca para `origin/develop`.
