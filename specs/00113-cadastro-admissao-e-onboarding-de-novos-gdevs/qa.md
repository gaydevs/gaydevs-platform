# Matriz de validação — 00113

Revisão de implementação, não aprovação humana. Evidência automatizada em SQLite/PHP 8.4 e React/Vitest; MySQL específico passou no CI; QA integrado segue pendente. Os nomes abaixo identificam os arquivos de testes, não resultados de produção.

| REQ | Evidência / limite |
| --- | --- |
| 001 | AppApplications, ApplicationPage: CTA, proposta e gate |
| 002 | ApplicationAuth: OTP, antispam, quotas e unverified |
| 003 | ApplicationPage, ApplicationWorkflow: progresso, etapas, revisão e retomada; smoke Chromium responsivo com API simulada; QA integrado pendente |
| 004 | ApplicationProfile, ApplicationWorkflow, ApplicationPage: handles, origem livre e ausência GitHub |
| 005 | ApplicationProfile: allowlist, SSRF, API GitHub; LinkedIn/Instagram inconclusivos e conferência manual conforme ajuste aprovado; T015 concluída |
| 006 | ApplicationAuth, ApplicationPage: contato após OTP e redes |
| 007 | ApplicationWorkflow, ApplicationPage, ApplicationOnboarding: aceites versionados, aviso, bloqueio da minuta; conteúdo final pendente |
| 008 | ApplicationWorkflow: intenção única e falhas SMTP simuladas; ApplicationPage: pending |
| 009 | ApplicationWorkflow, AdminApplications: ordenação, autorização, notas e decisão |
| 010 | ApplicantLifecycle, ApplicantConcurrency, ApplicationWorkflow: atomicidade e unicidade |
| 011 | ApplicationAuth, ApplicantLifecycle: histórico, retomada, reentrada e membro existente |
| 012 | ApplicationOnboarding, OnboardingPage, AppApplications: preferência e menu |
| 013 | ApplicantFoundation, ApplicantLifecycle, ApplicationWorkflow: eventos, dados e histórico; sem dashboard/purge |
| 014 | ApplicationAuth, ApplicationSecurity, ApplicantConcurrency, regressão OTP/polls: isolamento e segurança; integração real pendente |

## Cenários de aceite na ordem da spec

| # | Evidência automatizada | Estado/limite |
| --- | --- | --- |
| 1 | CTA e apresentação (AppApplications, ApplicationPage) | Testado |
| 2 | Turnstile/cotas inválidas (ApplicationAuth) | Simulado |
| 3 | Unverified, OTP e draft (ApplicationAuth) | Testado |
| 4 | Expiração, replay e finalidade (ApplicationAuth) | Testado |
| 5 | Sessão, persistência e retomada (ApplicationAuth/Workflow/Page) | Testado por componentes |
| 6 | Confirmação GitHub ausente (ApplicationWorkflow/Page) | Testado |
| 7 | Origem livre, busca sem acento e obrigatoriedade (ApplicationWorkflow/Page) | Testado |
| 8 | Formato, SSRF, classificação (ApplicationProfile) | Testado conforme escopo ajustado: GitHub automático, LinkedIn/Instagram manual |
| 9 | Submissão incompleta/aceites (ApplicationWorkflow/Page) | Testado |
| 10 | Submissão, intenção única, WhatsApp (ApplicationWorkflow/Page) | SMTP simulado |
| 11 | Pending somente leitura e retomada (ApplicationAuth/Workflow/Page) | Testado |
| 12 | Bloqueio de acesso alheio/admin (ApplicationAuth/Workflow/AdminApplications) | Testado |
| 13 | Fila, notas e decisões (ApplicationWorkflow/AdminApplications) | Testado |
| 14 | Aprovação e membro único (ApplicantLifecycle/Concurrency/Workflow) | SQLite e MySQL CI aprovados |
| 15 | Recusa e nova candidatura com histórico (ApplicationAuth/Workflow) | Testado |
| 16 | E-mail de membro existente (ApplicationAuth) | Testado |
| 17 | Onboarding e inclusão manual (ApplicationOnboarding/OnboardingPage) | Testado |
| 18 | Login e funcionalidades legadas (suítes OTP/polls) | Regressão automatizada |
| 19 | Eventos e aceites preservados (ApplicantFoundation/Lifecycle/Workflow) | Testado |

Smoke automatizado Chromium 390x844 e 1366x900 com API simulada: seis telas por resolução, sem overflow horizontal ou erros JS. CI do código 42fb0a8: [execução verde](https://github.com/gaydevs/gaydevs-platform/actions/runs/46012469208); upgrades e concorrência aprovados em SQLite e MySQL. QA final ainda precisa de inspeção visual humana, integração HTTPS, deep links, cookies/CSRF reais, Turnstile com chaves de teste e mail fake, aprovação/login/onboarding ponta a ponta e compatibilidade do host. Não utilizar dados reais. Ver docs/applications-operations.md.

## T029 — ajuste de privacidade

- Testar acesso direto a /privacy e link no rodapé (inclusive usuário com onboarding pendente), aceite antes do OTP, recusa de versão obsoleta, ausência de gravação de dados sem aceite vigente, cinco checks que enviam sete chaves e links para as seções.
- Verificar manualmente canal efetivo, identificação do controlador via atendimento, fornecedores/transferência internacional, configuração e textos finais antes de release. T032 mantém QA integrado.
