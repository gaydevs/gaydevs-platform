# 00113 — 🌈 Cadastro, admissão e onboarding de novos gdevs

Issue: https://github.com/gaydevs/gaydevs-platform/issues/113
Estado: aprovada — 2026-11-27 (gdev solicitante).
Fluxo: SDD normal (High Risk por autenticação, autorização, segurança e dados sensíveis).

## Problema e objetivo

Oferecer uma porta de entrada pública para a comunidade GayDevs, com candidatura progressiva, curadoria humana e orientação pós-admissão. Reduzir trabalho operacional sem conceder acesso de membro antes da aprovação.

## Escopo e comportamento

### Jornada 1 — candidatura (visitante e candidato)

1. A landing page oferece o CTA `quero ser um gdev`, distinto do login de membros. Apresenta brevemente a comunidade no WhatsApp, plataforma e Instagram, com convite para ler a landing page, sem duplicar toda a apresentação.
2. O visitante informa o e-mail. Após validação antispam, é criada ou recuperada a candidatura apropriada e enviado OTP. Antes de confirmar o e-mail não é permitido preencher outros dados, consultar candidatura existente ou obter o telefone do scrum master.
3. Após OTP válido, o candidato pode acessar somente a própria candidatura. O contato do scrum master fica disponível em todas as etapas seguintes, inclusive tela final. O número é configurável no ambiente e não integra conteúdo público do frontend.
4. O wizard é mobile-first, com progresso não linear (avanço inicial mais rápido), navegação por etapas e salvamento persistente. Retomar por novo OTP restaura a etapa e os dados já registrados.
5. Dados obrigatórios: nome, sobrenome, WhatsApp e LinkedIn, além do e-mail validado. GitHub e Instagram são opcionais. Se GitHub estiver vazio ao avançar, explicar sua importância e pedir confirmação para continuar sem ele. Registrar interesse em colaborar com a plataforma, sem acionar nenhuma automação de colaboração. Perguntar obrigatoriamente como conheceu o GayDevs, em campo de texto livre com autocomplete: App de relacionamento (Tinder, Scruff, Grindr etc.), Rede social (Instagram, Facebook, TikTok etc.), Amigos, Trabalho, Evento de tecnologia e Pesquisa na internet. A busca deve corresponder a qualquer parte das sugestões, inclusive palavras nos exemplos, ignorando caixa e acentos. Permitir resposta personalizada sem exigir seleção; não incluir opções “Outro gdev” ou “Outro”.
6. Validar formato e domínio dos perfis LinkedIn, GitHub e Instagram. Consultar disponibilidade automaticamente apenas no GitHub via API oficial. LinkedIn e Instagram têm disponibilidade inconclusiva por padrão, com conferência manual pelo administrador; não realizar consultas automatizadas nessas redes. Bloquear links sintaticamente inválidos ou comprovadamente inexistentes pelo verificador automático; não bloquear resultados inconclusivos. Ajuste aprovado pelo gdev solicitante em 2026-11-27 (conversa ChatGPT).
7. Incentivar seguir Instagram e GitHub do GayDevs e do luvittor, sem verificação automática de seguidores.
8. Exibir termos e confirmações diretas. Registrar individualmente as versões e timestamps dos aceites exigidos:
   - Ser gay e dev; conhecer a proposta de uma comunidade engajada e coesa, não necessariamente grande.
   - Compreender o caráter progressista, de esquerda, inclusivo e seguro; não exigir declaração de preferência partidária.
   - Ler e aceitar termos básicos e regras do grupo principal SFW, primeiro grupo de ingresso.
   - Respeitar a restrição de conteúdo adulto e flerte ao único grupo NSFW, `/gdevs/off-topic-nsfw`, no contexto dos grupos.
   - Autorizar especificamente o tratamento de dados pessoais e sensíveis para análise e administração da candidatura/comunidade, e separadamente a consulta aos perfis externos informados.
   - Disponibilizar aviso breve e link à política pública antes da coleta do e-mail; exigir autorização específica de dados pessoais/sensíveis antes de solicitar OTP e registrar aceite vigente após prova de controle do e-mail. Exigir autorização de perfis antes da consulta. Na etapa final, agrupar os sete aceites persistidos em cinco checks curtos, com links ao conteúdo completo. Política pública /privacy no rodapé, controlador pessoa física identificável pelos canais de contato da administração, sem publicação do nome civil. Retenção proporcional sem exclusão automática e atendimento manual aos titulares. Não acrescentar captura automática de perfis nesta feature.
9. Ao submeter, validar todos os dados e aceites; registrar a submissão e notificar o admin por e-mail com acesso à análise. A tela final informa que deve aguardar avaliação e convida a chamar o scrum master no WhatsApp.
10. Em nova autenticação: candidatura incompleta retoma do ponto salvo; pendente exibe a mesma tela final sem reenviar notificação; recusada permite iniciar nova candidatura preservando o registro anterior; e-mail de membro existente é direcionado ao login, sem nova candidatura. Mensagens pré-OTP não devem revelar associação de terceiros à comunidade.

### Jornada 2 — admissão (administrador)

- Área administrativa exclusiva para admins ativos, com fila de candidaturas pendentes por data de submissão ascendente (não data de início).
- Consultar dados (incluindo como conheceu o GayDevs) e aceites, abrir perfis externos e WhatsApp, registrar observações internas, aprovar ou recusar. Não há edição administrativa dos dados cadastrais.
- Registrar responsável e data da decisão. Aprovar cria usuário ativo vinculado à candidatura em operação atômica; recusar mantém histórico sem criar usuário. A decisão só é aplicável a candidatura pendente.
- Inclusão nos grupos WhatsApp continua manual. A liberação da plataforma ocorre na aprovação, sem depender de confirmação de inclusão no WhatsApp.

### Jornada 3 — onboarding (novo membro)

- Após admissão, apresentar instruções para ingresso no grupo principal SFW e apresentação: como conheceu a comunidade, stack, experiência, desafios atuais, LinkedIn, Instagram e GitHub.
- Explicar os demais espaços e iniciativas conforme a landing page vigente: off-topic-nsfw (único NSFW, opcional), talks de internacionalização de carreira, summit e demais iniciativas publicadas.
- O interesse em colaboração já registrado fica disponível ao admin; o encaminhamento do formulário de ingresso no gdevs-team continua manual.

### Ciclo de vida e dados

- `applicants`: unverified (e-mail submetido), draft (e-mail confirmado), pending (submetido), approved ou rejected (decisão).
- Uma candidatura em andamento por e-mail normalizado; múltiplos registros históricos são permitidos após recusa. Nova candidatura tem identidade própria, sem sobrescrever dados ou decisões anteriores.
- Registrar a resposta livre de origem da candidatura em `applicants.referral_source`, sem enum, para consulta administrativa e análise futura.
- Cada OTP de candidatura é associado ao applicant desde a solicitação; distinguir finalidade login/candidatura e registrar destinatário. A relação com user é opcional para OTP de candidatura.
- Usuário criado no novo fluxo referencia o applicant aprovado de forma única; membros existentes permanecem compatíveis sem vínculo. Não criar referências circulares.
- Registrar estado, etapas concluídas, timestamps de transições, submissão, aceites e análise, suficientes para futura avaliação de funil. Não implementar métricas ou dashboard.
- Preservar histórico, inclusive recusas. Não implementar expiração ou exclusão automática de registros nesta feature. A preservação de evidências de abuso, fraude e homofobia deverá observar a LGPD; não equivale a autorização irrestrita para retenção ou acesso.

### Segurança e falhas

- Turnstile validado no servidor antes da criação de registro ou envio inicial/reenvio de OTP de candidatura; limitação por e-mail, IP e global; limites de reenvio e de verificação. Cotas lógicas separadas de login e candidatura, respeitando a capacidade total do transporte.
- OTP expirado, incorreto, usado ou de finalidade diferente não autoriza operação; sessão de candidato não confere privilégios de membro ou admin e não acessa candidatura alheia. A sessão expira independentemente da retenção do registro.
- Validar URLs externas sem permitir acesso a destinos arbitrários, privados ou redirecionamentos inseguros (SSRF). Não registrar segredos, códigos ou dados sensíveis desnecessários em logs/notificações.
- Submissões e decisões repetidas ou concorrentes não duplicam registros, usuários ou eventos de notificação. Falhas de envio, salvamento ou aprovação devem ser tratadas sem conceder acesso indevido; permitir recuperação do fluxo.
- Manter funcionamento do login de membros existentes e das rotas privadas.

### Fora do escopo

Dashboard/indicadores de funil; exclusão automática de candidaturas; edição administrativa de dados; integração automática com WhatsApp ou gdevs-team; verificação automática de seguidores; publicação de dados de candidatos.

## Requisitos verificáveis

- REQ-001: CTA público e apresentação breve com link para a landing page.
- REQ-002: OTP inicial, controles antispam e candidatura persistida antes da confirmação; nenhum acesso privilegiado antes da validação.
- REQ-003: Wizard responsivo, progresso não linear, persistência de etapas e retomada autenticada.
- REQ-004: Campos obrigatórios/opcionais, confirmação explícita da ausência de GitHub, interesse de colaboração registrado e origem obrigatória em texto livre com autocomplete.
- REQ-005: Validação segura de formato/domínio nas três redes, disponibilidade automática no GitHub com distinção entre inexistência e resultado inconclusivo, e conferência manual de existência no LinkedIn e Instagram.
- REQ-006: Contato do scrum master fornecido exclusivamente após verificação e links de redes sociais.
- REQ-007: Termos e autorizações individuais, cinco checks resumidos com links a conteúdo integral, política pública no rodapé, consentimento específico antes de solicitar OTP e antes de consultar perfis; versões e datas persistidas.
- REQ-008: Submissão idempotente, estado pending, notificação administrativa e tela final com WhatsApp.
- REQ-009: Fila administrativa por submissão, consulta (incluindo origem da candidatura), observações e decisões exclusivas de admin.
- REQ-010: Aprovação atômica com vínculo único applicant/user, recusa sem usuário e histórico preservado.
- REQ-011: Retomada conforme estado, nova candidatura após recusa e impedimento de candidatura de membros existentes.
- REQ-012: Onboarding pós-aprovação e operações externas manuais.
- REQ-013: Dados de etapas e histórico consultáveis para futura análise, sem painel nem exclusão automática.
- REQ-014: Separação de finalidades e sessões OTP, proteção de dados, rate limits, controle de concorrência e regressão do login existente.

## Critérios de aceite

- Dado um visitante, quando acessa o CTA, então vê a proposta breve e pode iniciar candidatura por e-mail.
- Dado Turnstile inválido ou cota excedida, quando solicita OTP, então não é criado novo applicant nem enviado e-mail.
- Dado e-mail novo e controles válidos, quando solicita OTP, então existe applicant unverified vinculado ao OTP; quando confirma, passa a draft e o contato do scrum master fica disponível.
- Dado OTP inválido, expirado, reutilizado ou de outra finalidade, quando tenta acessar a candidatura ou área de membro, então não obtém autorização.
- Dado candidato draft, quando salva etapas e retorna mediante novo OTP, então dados, etapa e progresso são recuperados.
- Dado candidato sem GitHub, quando tenta avançar, então confirma explicitamente a ausência antes de prosseguir.
- Dado candidato preenchendo a origem, quando digita qualquer palavra das sugestões (ex.: Grindr ou instagram), então vê correspondências sem distinção de caixa ou acentos; pode selecionar uma sugestão ou salvar texto próprio, que fica disponível ao admin. Campo vazio impede submissão.
- Dado link sintaticamente inválido ou perfil GitHub comprovadamente inexistente, quando informa o link, então recebe orientação para corrigir; resultado inconclusivo não bloqueia a etapa. A existência dos perfis LinkedIn e Instagram é conferida pelo administrador.
- Dado dado obrigatório ou aceite ausente, quando tenta submeter, então permanece draft e nenhuma notificação é disparada.
- Dada candidatura completa, quando submete, então fica pending, registra aceites/submissão e notifica admin; a tela final orienta contato via WhatsApp. Submissões duplicadas não criam outra candidatura nem outra notificação.
- Dada candidatura pending, quando retorna por OTP, então vê a mesma tela final; não altera dados submetidos.
- Dado candidato ou membro comum, quando tenta acessar a fila ou candidatura de terceiro, então o acesso é negado.
- Dado admin ativo, quando acessa a fila, então vê pendentes por ordem de submissão, consulta dados/links, adiciona observações e decide, sem editar dados cadastrais.
- Dada candidatura pending, quando admin aprova, então é criado exatamente um user ativo com applicant_id e o estado muda para approved; falha parcial não deixa aprovação incompleta. O novo membro pode entrar pelo login existente.
- Dada candidatura pending, quando admin recusa, então fica rejected com responsável/data, sem user; novo cadastro pelo mesmo e-mail verificado cria outra candidatura, preservando histórico.
- Dado e-mail já existente em users, quando tenta candidatar-se, então não é criado applicant novo e, após prova de controle do e-mail, é orientado ao login.
- Dado membro aprovado, quando acessa onboarding, então encontra orientações de ingresso, apresentação e demais grupos; não há inclusão automática em WhatsApp ou gdevs-team.
- Dado membro preexistente, quando usa login OTP e funcionalidades atuais, então o comportamento continua compatível.
- Dadas transições de candidatura, quando consultados seus registros, então etapas, datas, aceites e decisões estão presentes, sem dashboard nem exclusão automática.

## Dependências e questões abertas

- Nenhum blocked by/blocking registrado na consulta GitHub da issue em 2026-11-27.
- Dependências operacionais: transporte de e-mail existente e configuração Turnstile; telefone do scrum master no ambiente.
- Decisões para o plan: pesos exatos da barra e etapas, configuração dos limites e validade de OTP/sessões, persistência de aceites/eventos, validação externa e tratamento de falhas de notificação.
- Questões a validar no gate de spec: texto final e finalidades do aviso de privacidade/consentimentos; forma de disponibilizar o onboarding ao membro aprovado (primeiro acesso e/ou revisita). Não presumir aprovação legal da retenção por prazo indeterminado.
- A política de retenção e resposta a pedidos de titulares exige avaliação própria; exclusão automática está fora do escopo, sem afastar obrigações legais.

## Ajuste aprovado de privacidade (T029)

Em 2026-11-27, o gdev solicitante aprovou na conversa ChatGPT: política pública no rodapé; cinco checks resumidos e links para textos integrais; contato pela administração sem publicar nome civil (identidade do controlador acessível pelo atendimento); retenção justificada sem exclusão automática; procedimentos internos LGPD. Em seguida autorizou a execução com “prossiga”. Não equivale a parecer jurídico ou aprovação de release.

## Aprovação humana

Aprovada integralmente pelo gdev solicitante (2026-11-27, conversa ChatGPT da issue #113, revisão em três blocos): REQ-001 a REQ-014 aprovados, incluindo complemento de REQ-004 (origem em texto livre com autocomplete). A aprovação autoriza elaborar o plan, não implementar. Textos finais de privacidade e forma de apresentação do onboarding continuam sujeitos à revisão do plan.
