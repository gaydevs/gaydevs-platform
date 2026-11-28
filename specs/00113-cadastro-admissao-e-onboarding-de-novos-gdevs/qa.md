# Matriz de validação — 00113

Revisão de implementação, não aprovação humana. Evidência automatizada em SQLite/PHP 8.4 e React/Vitest; MySQL específico passou no CI; smoke HTTPS integrado executado no Survivor em 2026-11-27. Os nomes abaixo identificam os arquivos de testes, não resultados de produção.

| REQ | Evidência / limite |
| --- | --- |
| 001 | AppApplications, ApplicationPage: CTA, proposta e gate |
| 002 | ApplicationAuth: OTP, antispam, quotas e unverified |
| 003 | ApplicationPage, ApplicationWorkflow: progresso, etapas, revisão e retomada; smoke Chromium responsivo com API simulada e posteriormente HTTPS/backend real |
| 004 | ApplicationProfile, ApplicationWorkflow, ApplicationPage: handles, origem livre e ausência GitHub |
| 005 | ApplicationProfile: allowlist, SSRF, API GitHub; LinkedIn/Instagram inconclusivos e conferência manual conforme ajuste aprovado; T015 concluída |
| 006 | ApplicationAuth, ApplicationPage: contato após OTP e redes |
| 007 | ApplicationWorkflow, ApplicationPage, ApplicationOnboarding: aceites versionados, aviso, página pública, cinco checks e consentimento antes do OTP; bloqueio de ativação enquanto minuta |
| 008 | ApplicationWorkflow: intenção única e falhas SMTP simuladas; ApplicationPage: pending |
| 009 | ApplicationWorkflow, AdminApplications: ordenação, autorização, notas e decisão |
| 010 | ApplicantLifecycle, ApplicantConcurrency, ApplicationWorkflow: atomicidade e unicidade |
| 011 | ApplicationAuth, ApplicantLifecycle: histórico, retomada, reentrada e membro existente |
| 012 | ApplicationOnboarding, OnboardingPage, AppApplications: preferência e menu |
| 013 | ApplicantFoundation, ApplicantLifecycle, ApplicationWorkflow: eventos, dados e histórico; sem dashboard/purge |
| 014 | ApplicationAuth, ApplicationSecurity, ApplicantConcurrency, regressão OTP/polls: isolamento e segurança; cookies Secure/HttpOnly e acesso negado confirmados em HTTPS local |

## Cenários de aceite na ordem da spec

| # | Evidência automatizada | Estado/limite |
| --- | --- | --- |
| 1 | CTA e apresentação (AppApplications, ApplicationPage) | Testado |
| 2 | Turnstile/cotas inválidas (ApplicationAuth) | Simulado |
| 3 | Unverified, OTP e draft (ApplicationAuth) | Testado |
| 4 | Expiração, replay e finalidade (ApplicationAuth) | Testado |
| 5 | Sessão, persistência e retomada (ApplicationAuth/Workflow/Page) | Testado por componentes e refresh no navegador |
| 6 | Confirmação GitHub ausente (ApplicationWorkflow/Page) | Testado |
| 7 | Origem livre, busca sem acento e obrigatoriedade (ApplicationWorkflow/Page) | Testado |
| 8 | Formato, SSRF, classificação (ApplicationProfile) | Testado conforme escopo ajustado: GitHub automático, LinkedIn/Instagram manual |
| 9 | Submissão incompleta/aceites (ApplicationWorkflow/Page) | Testado |
| 10 | Submissão, intenção única, WhatsApp (ApplicationWorkflow/Page) | HTTPS real, transporte log; dois avisos, nenhum reenvio |
| 11 | Pending somente leitura e retomada (ApplicationAuth/Workflow/Page) | Testado |
| 12 | Bloqueio de acesso alheio/admin (ApplicationAuth/Workflow/AdminApplications) | Testado |
| 13 | Fila, notas e decisões (ApplicationWorkflow/AdminApplications) | Testado; aprovação/recusa também no navegador |
| 14 | Aprovação e membro único (ApplicantLifecycle/Concurrency/Workflow) | SQLite e MySQL CI aprovados |
| 15 | Recusa e nova candidatura com histórico (ApplicationAuth/Workflow) | Testado |
| 16 | E-mail de membro existente (ApplicationAuth) | Testado |
| 17 | Onboarding e inclusão manual (ApplicationOnboarding/OnboardingPage) | Testado; novo membro autenticado e onboarding automático no navegador |
| 18 | Login e funcionalidades legadas (suítes OTP/polls) | Regressão automatizada |
| 19 | Eventos e aceites preservados (ApplicantFoundation/Lifecycle/Workflow) | Testado |

Smoke automatizado Chromium 390x844 e 1366x900 com API simulada: seis telas por resolução, sem overflow horizontal ou erros JS. CI do código 42fb0a8: [execução verde](https://github.com/gaydevs/gaydevs-platform/actions/runs/46012469208); upgrades e concorrência aprovados em SQLite e MySQL. Smoke integrado posterior comprovou HTTPS local, deep links, cookies/CSRF, Turnstile de teste, transporte log, aprovação/recusa e login/onboarding. Inspeção visual humana e compatibilidade do host de produção ainda pendentes. Não utilizar dados reais. Ver docs/applications-operations.md.

## T029 — ajuste de privacidade

- Testar acesso direto a /privacy e link no rodapé (inclusive usuário com onboarding pendente), aceite antes do OTP, recusa de versão obsoleta, ausência de gravação de dados sem aceite vigente, cinco checks que enviam sete chaves e links para as seções.
- Verificar manualmente canal efetivo, identificação do controlador via atendimento, fornecedores/transferência internacional, configuração e textos finais antes de release. T032 mantém inspeção visual humana e verificação do host.


## Evidência integrada — 2026-11-27

Código e8dffcd, CI Required, SQLite, MySQL, lint/audits e SonarCloud aprovados. Chromium 159 com frontend buildado, proxy HTTPS restrito a loopback (certificado autoassinado aceito pelo navegador de teste), Laravel real, SQLite em diretório descartável, sessões/cookies reais, chaves públicas dummy e Siteverify real da Cloudflare, transporte de e-mail log (sem envio externo). Duas candidaturas sintéticas em 390x844 e 1366x900. Verificado: página de privacidade pública e rodapé, envio sem aceite recusado (422), OTP válido, cookie candidato Secure/HttpOnly, acesso administrativo negado (401), identificação, refresh de draft, perfis, origem, cinco checks, submissão e refresh de pending. Admin autenticado via OTP e API de login, decisões de aprovação e recusa pela UI. Banco confirma um aprovado, um recusado e apenas um novo membro. Worker processou dois avisos, segunda execução zero. Novo membro autenticado via OTP, onboarding automático e admin negado (403). Cinco screenshots sintéticos, sem overflow nos pontos capturados. Matriz confrontada com 14 REQs e 19 cenários da spec; cenários negativos e regressões restantes cobertos pelas suítes, não todos repetidos no navegador.

Jobs Survivor: job_01M8FCQK2600P5M2AQEDFRDHA3 (limite de 160s atingido após aprovação/recusa; evidência parcial em log e banco), job_01M8FCXMWW00AH9R0W5F1E54BY (notificações e onboarding, sucesso). Inspeção visual humana e compatibilidade com HTTPS/CSP/SMTP/MySQL do host real não realizadas. Não equivalem a teste de produção. T032 segue aberta somente para essas verificações e inspeção. T029 segue aberta para validação operacional de privacidade e gate FINALIZED.

- Regressão de rollback: ApplicantUpgradeTest (SQLite, 22 assertions) comprova upgrade/rollback/reupgrade com OTP e tentativas legados, preservação das FKs e bloqueio de destinatário histórico divergente ou registro de candidatura. MySQL será validado no CI.
