# Candidaturas — operação e gates de release

Issue #113 · Spec 00113 · High Risk. Não autoriza ativação em produção.

## Configuração

Somente no ambiente persistente do backend. Não incluir credenciais, telefone ou destinatário no Git, bundle ou logs.

| Variável | Default / ação |
| --- | --- |
| APPLICATIONS_ENABLED | false até todos os gates |
| APPLICATION_TERMS_APPROVED_VERSION | versão final aprovada, não minuta |
| APPLICATION_PLATFORM_URL | URL HTTPS da plataforma, sem credenciais, query ou fragmento |
| APPLICATION_ADMIN_EMAIL | caixa autorizada de avisos |
| GDEV_SM_WHATSAPP | número internacional sem espaços |
| APPLICATION_TURNSTILE_TEST_MODE | false; somente local/testing |
| APPLICATION_TURNSTILE_SITEKEY / SECRET | credenciais do widget; só sitekey pública |
| APPLICATION_TURNSTILE_HOSTNAME / ACTION | hostname permitido / application_otp |
| APPLICATION_OTP_COOLDOWN | 60 segundos |
| APPLICATION_OTP_EMAIL_HOUR / IP_HOUR / DAY | 5 / 10 / 50 |
| APPLICATION_VERIFY_IP_HOUR / APPLICATION_OTP_ATTEMPTS | 20 / 5 |
| APPLICATION_MAIL_DAY | 100 (OTP + aviso) |
| APPLICATION_SESSION_IDLE_DAYS / ABSOLUTE_DAYS | 30 / 90 |

OTP: 6 dígitos, 10 minutos conforme passwordless. Cadastro e avisos não consomem a metade final das cotas globais horária e diária; falhas também consomem reserva. Cache compartilhado com locks atômicos, IP confiável, HTTPS e APP_KEY estável. Cookie candidato Secure/HttpOnly/SameSite=Lax independente da sessão de membro. Config pública expõe apenas enabled, sitekey, action, cooldown. Produção exige ApplicationTerms::FINALIZED, versão aprovada e transporte real.

## Turnstile e perfis

CSP: permitir script-src e frame-src de https://challenges.cloudflare.com sem ampliar outras diretivas. Usar [chaves dummy oficiais](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) somente em local/testing com modo de teste explícito. Siteverify continua obrigatório. Validar hostname/action reais em QA isolado, nunca usar chaves dummy em produção.

GitHub usa [REST Get a user](https://docs.github.com/en/rest/users/users#get-a-user) com DNS IPv4 público pinado, TLS, sem proxy/redirect, 3s de orçamento, corpo/cabeçalhos limitados e sem credenciais. 200 com login correspondente confirma perfil público, não identidade; 404 pode ser restrição, portanto inconclusivo; 410 inválido. LinkedIn/Instagram: validar sintaxe e revisar manualmente, sem consulta automatizada sem autorização. T015 exige decisão do gdev. Host precisa de cURL, PHP CLI compatível e proc_open; falhas de perfil são inconclusivas, Turnstile falha fechado.

## Migrations e recuperação

Backup restaurável e upgrade ensaiado com dados sintéticos em MySQL compatível com host e PHP 8.3. Conferir FK, generated column active_email UNIQUE, múltiplos NULL, privilégio TRIGGER, índices. CI MySQL 8.4 não comprova o host. DDL MySQL não é transacional: interromper release em falha, manter feature desativada, inspecionar schema/migrations/triggers; não repetir ALTER às cegas. Somente migrate --force no release aprovado. Nunca migrate:fresh/db:wipe em dados reais. Downgrade com histórico bloqueado; preferir correção progressiva. Restauração exige coordenação para preservar dados posteriores. Testes MySQL de upgrade/concorrência usam schemas descartáveis separados do banco de testes no GitHub Actions com CI=true, GITHUB_ACTIONS=true, APP_ENV=testing, host 127.0.0.1:3306 e banco testing; o marcador APPLICATION_MYSQL_CI é interno aos subprocessos descartáveis. Nunca usar banco real.

## Scheduler e avisos

applications:notifications a cada minuto, sem worker adicional; lock e claim condicional. Conferir schedule:list, cron e cache compartilhado. Uma intenção por candidatura na transação de submissão. Fila administrativa é fonte de verdade.

| Estado | Ação |
| --- | --- |
| pending | processamento automático; verificar cota/available_at |
| sending | aguardar; stale após 15min vira unknown |
| sent | não reenviar |
| failed | revisar configuração/cotas; falha pré-envio |
| unknown | entrega não comprovada; não reenviar automaticamente |

Admin consulta notification_status e fila. Verificar metadados autorizados do provedor. Se não confirmar entrega, atender manualmente pela fila; intervenção exige autorização, registro e backup. Não retornar unknown a pending sem prova de não entrega. Aviso contém somente link interno autenticado; MAIL_MAILER=log apenas em QA isolado.

## Privacidade e gates

Aprovar texto definitivo e versão; identificar controlador e canal efetivo; documentar finalidades, fornecedores, compartilhamentos, retenção proporcional e atendimento de direitos. Associação ao grupo pode revelar dados sensíveis. Preservar histórico não autoriza retenção irrestrita. Sem purge automático; pedidos excepcionais por processo humano. Revisar logs HTTP/proxy (Referer, query, cookies e bodies), backups, e-mail e permissões. Debug desativado. Não publicar minuta. Não é parecer jurídico. Validar CI, host, CSP, backup, QA HTTPS mobile/desktop, Turnstile e outbox com dados sintéticos. Resolver pendências T001/T002/T015/T029/T030/T032 e obter revisão de outro gdev. Merge e release humanos separados.
