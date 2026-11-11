# Plano técnico — Issue #107

Fast-track Low Risk aprovado pelo gdev. Spec: [spec.md](spec.md).

1. Fixar v0.1.0 estável no Composer com atualização estritamente localizada do lock.
2. Consumir os campos `UpdateResult::{errorCode,phase,httpStatus,attempts}` com allowlists e fases separadas no log; nunca propagar mensagens arbitrárias.
3. Manter atualização/validação integral das duas bases; só reprocessar após sucesso quando alguma for `updated` ou houver `--force-reprocess`.
4. Preservar agendamento existente às 04:00 sem a opção force; documentar operação.
5. Testar `updated`, `current`, status mistos, force, falhas e sanitização; executar validações possíveis; criar PR para develop, sem merge.

Risco: alteração localizada e reversível de dependência beta já validada em produção e lógica interna do comando. Não envolve banco, migrações ou contratos públicos.
