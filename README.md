# gaydevs-platform

Plataforma da comunidade gaydevs. Para começar, leia [CONTRIBUTING.md](CONTRIBUTING.md)
e o [fluxo de trabalho](docs/development-workflow.md).

## Estrutura

```text
frontend/  aplicação React/Vite
backend/   API Laravel
```

Antes de instalar ou mover a API para outro servidor, consulte os
[requisitos de hospedagem do backend](docs/backend-hosting-requirements.md).

## Executar o frontend

```sh
cd frontend
npm ci
npm run dev
```

## Validar o frontend

```sh
cd frontend
npm run lint
npm run typecheck
npm run build
```
