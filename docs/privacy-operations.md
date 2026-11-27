# Privacidade — procedimentos internos do GayDevs

Issue #113 / T029. Política pública: /privacy; fonte versionada: ApplicationTerms. Não registrar nomes civis, contatos particulares de candidatos, documentos ou solicitações de titulares neste repositório. Esta orientação operacional não é certificação de conformidade.

## Responsabilidade e contato

O controlador é a pessoa física responsável pela administração. O gdev solicitante aprovou não divulgar seu nome civil na página; usar os contatos da administração no rodapé. Antes de ativar o cadastro, confirmar que há canal que funciona sem login e que o titular consegue obter prontamente a identificação do controlador. Administradores autorizados atuam sob sua orientação. Não presumir dispensa de encarregado ou regime de pequeno porte: verificar enquadramento, inclusive alto risco.

## Registro simplificado do tratamento

| Dados | Finalidade | Fundamento a validar pelo controlador | Destino/acesso |
| --- | --- | --- | --- |
| E-mail, OTP, sessão e cookies necessários | Verificação e autenticação | Consentimento na candidatura; prevenção de fraude/segurança quando aplicável | Backend e provedor de e-mail |
| Identificação, WhatsApp, links, origem, colaboração | Análise de candidatura e gestão de membros | Consentimento específico/informado | Administração autorizada |
| Condição de participante e aceites (podem revelar orientação sexual) | Admissão, administração, evidência de aceite | Art. 11 I LGPD; outras hipóteses do art. 11 somente quando efetivamente aplicáveis | Administração autorizada |
| Identificador de perfil público | Validação de links e análise | Autorização específica; consulta GitHub REST, LinkedIn/Instagram manual | Provedor de perfil, administração |
| IP, visitor observations, logs técnicos, antispam | Segurança, prevenção de abuso, operação | Avaliar hipótese aplicável por categoria, minimização e retenção | Hospedagem, Turnstile, administração |
| Eventos, decisões, observações e histórico | Curadoria, evidência de fraude/abuso e defesa de direitos | Finalidade e base legal documentadas individualmente; dados sensíveis exigem art. 11 | Administração autorizada |

Não inferir orientação sexual de perfis nem coletar dados de terceiros. A autorização para dados não implementa scraping ou nova captura automatizada. Definir escopo e base legal antes de novas coletas; preferir estatísticas efetivamente anônimas. Não publicar candidaturas. Nenhum dado pessoal de candidatos deve constar em commits, issues, PRs ou logs de QA.

## Retenção

Preservar histórico enquanto necessário à finalidade e fundamento legal; sem exclusão automática nesta feature. Avaliar necessidade na mudança de finalidade, saída, recusa ou solicitação. Registrar justificativa para conservação excepcional conforme arts. 15–16 e 11 da LGPD, restringir acesso; eliminar ou anonimizar quando não houver fundamento. Considerar cópias, backups, OTP, logs, eventos, FKs e impacto sobre login. Não executar exclusão destrutiva diretamente em produção sem plano, autorização, backup e verificação. Não utilizar backup para restaurar dados cuja exclusão foi deferida.

## Atendimento aos titulares

Receber via contatos do rodapé; confirmar recebimento, verificar identidade proporcionalmente (preferir prova de controle do e-mail, sem pedir documentos desnecessários). Responder gratuitamente: confirmação/acesso, correção, bloqueio, anonimização/eliminação, compartilhamento, portabilidade conforme regulamentação, revogação e consequências, e demais direitos aplicáveis. Confirmação/acesso simplificado imediato ou declaração completa em até 15 dias conforme art. 19; verificar prazos legais dos demais pedidos. Registrar solicitação, avaliação, resposta e execução em armazenamento restrito, não no GitHub. Se negar total/parcialmente, informar motivo legal e direito de petição à ANPD. Revogar consentimento impede tratamento baseado nele, salvo fundamento independente demonstrado; interromper novos usos e avaliar efeito sobre participação.

## Segurança, incidentes e fornecedores

- Acesso administrativo mínimo, MFA nos provedores, segredos fora do repositório, HTTPS/cookies seguros, backups protegidos e restore ensaiado. Revisar permissões quando admins mudarem; não enviar dados de candidatos por grupos ou mensageria desnecessária.
- Confirmar quem opera hospedagem, SMTP, Cloudflare Turnstile, armazenamento/backup; verificar contratos, localização, dados enviados, subprocessadores, retenção e mecanismo de transferência internacional quando aplicável (Resolução ANPD 19/2024). Não afirmar que contrato ou mecanismo foi validado sem evidência. Avaliar também consulta pública ao GitHub e acesso manual aos outros perfis. Proibir capturas adicionais sem avaliação.
- Incidente: conter acesso, preservar evidência restrita, revogar credenciais quando necessário, apurar dados e titulares afetados, avaliar risco relevante (incluindo exposição da orientação sexual), registrar decisões e mitigação. Comunicar ANPD e titulares quando exigido, usando prazo geral de três dias úteis da ciência; não presumir prazo ampliado sem verificar enquadramento. Manter registro dos incidentes, inclusive não comunicados, por ao menos cinco anos conforme regulamento.
- Antes do release: confirmar canal real, identificação acessível, revisão de bases legais/fornecedores/transferências, política e versão aprovadas, logs/proxy, backups, incidentes e acessos; testar fluxo HTTPS isolado. Registrar evidências e responsável sem divulgar dados pessoais. Não ativar APPLICATIONS_ENABLED nem marcar FINALIZED antes dos gates.

Referências: [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [comunicação de incidentes — ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis), [Resolução 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024).
