# Validação
`cd frontend && npm ci && npm run lint && npm run typecheck && npm run check:content && npm audit --omit=dev && npm test && npm run build`

Depois do push, confirmar Frontend Lint/Audit/Test no PR e o bloqueio de merge quando um deles falhar.
