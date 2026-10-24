# Frontend

Aplicação web React/Vite do gaydevs-platform.

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

Para validar o conteúdo e otimizar imagens, use os scripts opcionais:

```powershell
npm run check:content
npm run images
```

## Configuração

O frontend não precisa de uma variável de ambiente para descobrir a API durante
o desenvolvimento: a base é derivada de `import.meta.env.BASE_URL`. Em produção,
sirva a aplicação no caminho `/gaydevs/platform/` e disponibilize a API em
`/gaydevs/api/` na mesma origem.
