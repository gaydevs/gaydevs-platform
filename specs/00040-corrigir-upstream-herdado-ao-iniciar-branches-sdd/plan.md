# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/40 · Spec: [spec.md](spec.md)
Aprovado por Luciano em 20/10/2026.

- criar a branch com `git switch --no-track -c <branch> origin/develop`;
- orientar o primeiro push com `git push -u origin HEAD` sem alterar o JSON de stdout;
- testar ausência de upstream antes do push e tracking correto depois;
- permitir push na sandbox somente para o bare remote local, validando o destino efetivo de push;
- atualizar `docs/development-workflow.md`.

## Validação

- testes direcionados: 5/5;
- ciclo Git real descartável: aprovado;
- suíte SDD: falha conhecida de `release-sync` reproduzida também em `origin/develop`; timeout adicional passou isoladamente.
