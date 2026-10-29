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
`../api/`. O `.htaccess` usa o mesmo contrato relativo para encaminhar crawlers
sociais ao backend. Em produção, a topologia atual publica `platform/` e `api/`
como diretórios irmãos na mesma origem.

Antes de migrar a API para outro path ou origem, consulte
[`docs/backend-hosting-requirements.md`](../docs/backend-hosting-requirements.md):
o React e o `.htaccess` precisam ser alterados juntos, e o proxy local do Vite
também deve ser revisado.
