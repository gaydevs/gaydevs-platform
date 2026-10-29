# Frontend

Aplicação web React/Vite do gaydevs-platform.

## Versão do Node

O arquivo `.nvmrc` registra a versão de referência usada no CI; com nvm, execute
`nvm use` dentro de `frontend/` antes de instalar as dependências.

## Desenvolvimento

```powershell
cd frontend
npm ci
npm run dev
```

O Vite escuta na LAN por padrão. Abra no navegador a URL `Local` ou `Network`
exibida no terminal, normalmente:

```text
http://localhost:5173/gaydevs/platform/
http://<ip-do-computador>:5173/gaydevs/platform/
```

O proxy de desenvolvimento encaminha `/gaydevs/api` para o backend em
`http://localhost:8000`. Inicie a API conforme o [README do backend](../backend/README.md).

## Verificações

```powershell
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

`npm run test:coverage` gera o relatório em `coverage/`, que não é versionado.
`npm run build` executa o typecheck antes de criar a build de produção.

Os workflows usam Node.js 24.15.0 e os mesmos comandos: `frontend-test` executa
`npm test`; `frontend-lint` executa lint, typecheck e verificação de conteúdo.

Para validar o conteúdo e otimizar imagens, use os scripts opcionais:

```powershell
npm run check:content
npm run images
```

## Configuração

O frontend não precisa de uma variável de ambiente para descobrir a API durante
o desenvolvimento: a base é derivada de `import.meta.env.BASE_URL` usando
`../api/`. Em produção, a topologia atual publica `platform/` e `api/` como
diretórios irmãos na mesma origem.

O `.htaccess` é uma exceção: no DreamHost Shared Hosting, crawlers sociais são
redirecionados com `302` para a URL absoluta do endpoint de social preview. O
rewrite interno entre os diretórios irmãos foi validado retornando `404` nesse
ambiente.

Antes de migrar a API para outro path, origem ou hospedagem, consulte
[`docs/backend-hosting-requirements.md`](../docs/backend-hosting-requirements.md):
revise o caminho relativo usado pelo React, as URLs absolutas do `.htaccess` e
o proxy local do Vite.
