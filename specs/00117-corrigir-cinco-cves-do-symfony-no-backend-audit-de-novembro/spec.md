# 00117 — Corrigir cinco CVEs do Symfony no Backend Audit de novembro

Issue: https://github.com/gaydevs/gaydevs-platform/issues/117
Estado: fast-track Low Risk aprovado para implementação.
Fast-track risk: Low

## Problema e objetivo

A auditoria do backend falha em develop e no PR #116 devido a cinco advisories publicados em 25/11/2026 para dependências Symfony já presentes no lockfile. O objetivo é eliminar as vulnerabilidades sem regressão de comportamento nem flexibilização da auditoria.

## Escopo e comportamento

Atualizar http-kernel (7.4.23), mailer (7.4.22) e routing (7.4.23) para releases corrigidas da série 7.4, no mínimo 7.4.24. Preservar PHP 8.3.30, Laravel, constraints existentes, autenticação, contratos e migrations. Permitir somente atualizações transitivas indispensáveis. Não alterar a política de audit nem ignorar advisories. A mudança permanece separada da landing #114.

## Requisitos verificáveis

- REQ-001: eliminar CVE-2026-133743, CVE-2026-133751, CVE-2026-133755, CVE-2026-133746 e CVE-2026-133754.
- REQ-002: lockfile gerado pelo Composer e instalação reproduzível dentro das restrições atuais.
- REQ-003: não alterar funcionalidade, major versions ou configuração de segurança.
- REQ-004: manter CI Required, auditoria, lint e testes do backend passando.

## Critérios de aceite

- Composer validate e audit --locked passam sem advisories não tratados.
- Composer install funciona com PHP 8.3, sem flags de bypass de plataforma ou segurança.
- Lint, testes SQLite e MySQL e CI Required passam.
- Depois de integrar a correção a develop, sincronizar o PR #116 e verificar novamente o audit.

## Dependências e questões abertas

Nenhum blocker nativo registrado na criação. A issue #98 corresponde a um ciclo anterior de atualização e aparece como Done no Project. A execução exige ambiente com PHP/Composer; o usuário isolado do Survivor possui PHP 8.4 e Composer fora do PATH; a resolução respeita platform.php 8.3.30. O CI verifica PHP 8.3 real.

## Aprovação humana

Fast-track solicitado pelo gdev em 27/11/2026, após diagnóstico. Classificação Low restrita ao patch mecânico de lockfile, seguindo precedente #98; qualquer mudança de aplicação, constraints ou política de segurança exige parar e reclassificar.
