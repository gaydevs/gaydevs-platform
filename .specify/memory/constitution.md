# Constitution — gaydevs-platform

Versão 1.2.0 · ratificada em 2026-09-30; fast-track trivial aprovado em 2026-10-20 pela Issue #46 e substituído pelo risk-based fast-track aprovado em 2026-10-28 pela Issue #83.

1. SDD é o processo padrão. Feature, Bug, Refactor e Tech Debt podem usar fast-track
   conforme o risco, sempre com classificação e aprovação humanas explícitas antes
   da implementação. Low Risk usa uma aprovação inicial e segue sem gates
   intermediários; Medium Risk gera `spec.md`, `plan.md` e `tasks.md` sucintos e
   exige um checkpoint humano adicional antes da implementação; High Risk usa o
   fluxo SDD normal. Priority e Risk são independentes. Mudanças de arquitetura
   relevante, autenticação/autorização sensível, segurança/privacidade, migrations
   destrutivas, contratos de alto impacto ou escopo incerto são High Risk por padrão.
   Team Access e entradas fora dos forms SDD ficam fora.
2. A Issue deve existir antes da branch/spec. Seu número, preenchido até cinco
   dígitos, é o ID central. Nunca reservar IDs ou renumerar por colisão.
3. Uma feature = uma spec, mesmo envolvendo frontend e backend.
4. Requisitos verificáveis e critérios de aceite são obrigatórios.
5. `spec.md` define o quê; decisões técnicas ficam em `plan.md`; `tasks.md`
   decompõe a execução, sem criar automaticamente novas Issues.
6. Alterações de escopo atualizam a spec e exigem nova aprovação do que mudou.
7. No fluxo normal, um gdev aprova a spec antes do plan e o plan antes das
   tasks/implementação. No fast-track Low, a aprovação inicial substitui apenas
   esses gates intermediários. No Medium, a aprovação inicial permite gerar os
   três artefatos sucintos, mas a implementação só começa após um checkpoint humano
   explícito sobre spec/plan e risco. Se o risco aumentar, o agente pausa o código,
   preserva branch/spec, move a Issue para Specifying e segue o fluxo do novo nível;
   High exige expansão dos artefatos e retomada dos gates normais. Agentes não
   aprovam seus próprios artefatos nem inventam evidência de aprovação.
8. O processo é agnóstico de agente e utilizável sem IA. GitHub real, consultado
   por gh, é a fonte de verdade para Issue, tipo, prioridade, dependências e Status.
9. Respeitar blocked by / blocking. Blockers abertos impedem normalmente Ready
   e In Progress; nossos scripts interrompem o início até sua resolução.
10. Agentes mantêm Issue, branch, spec e Project rastreáveis e sincronizados quando
    possuem permissão; falhas de acesso devem ser informadas, nunca ocultadas.
11. Revisão de outro gdev para PR → develop e aprovação/merge de admin para main
    são gates humanos. A implantação final das proteções/releases fica para a fase 2.
12. Done só após entrega em main/produção quando aplicável e encerramento da Issue.
    Rejected e Canceled encerram a Issue como Not planned: Rejected para demandas
    analisadas e recusadas, Canceled para demandas aceitas/iniciadas e depois
    interrompidas.

Governança: esta constitution prevalece sobre defaults do Spec Kit. Mudanças
exigem revisão humana; não atribuir aprovação com base apenas em execução de script.
