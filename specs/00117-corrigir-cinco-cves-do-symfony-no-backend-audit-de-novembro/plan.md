# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/117 · Spec: [spec.md](spec.md)
Fast-track risk: Low

## Abordagem

Resolver somente os três pacotes Symfony afetados, na série 7.4, via Composer instalado no Survivor, preservando platform.php 8.3.30 e composer.json. Permitir dependências indispensáveis; revisar diff. Não ignorar advisories.

## Validação

Composer validate --strict e audit --locked; CI PHP 8.3 (lint e testes SQLite/MySQL). Publicar PR para develop, sem merge automático.

## Aprovação

Fast-track solicitado em 27/11/2026; escopo mecânico Low conforme #98.

## Resultado local

Composer atualizou http-foundation (dependência transitiva), http-kernel, mailer e routing para 7.4.24. Sem mudança de composer.json ou de outros pacotes. Validate --strict e audit --locked passaram (zero advisories). PHP 8.4 local com platform.php 8.3.30; testes e instalação com PHP 8.3 real pelo CI.
