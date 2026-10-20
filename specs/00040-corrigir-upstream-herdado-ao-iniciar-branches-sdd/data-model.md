# Modelo de estado — tracking da branch SDD

A correção não introduz entidades de aplicação nem persistência. O único estado relevante é o relacionamento Git entre branch local, commit base e branch remota.

## Branch SDD local

Campos observáveis:

- `name`: nome derivado da Issue, por exemplo `fix/00040-corrigir-upstream-herdado-ao-iniciar-branches-sdd`;
- `HEAD`: inicialmente igual a `origin/develop`;
- `upstream`: ausente antes da primeira publicação; depois `origin/<name>`.

## Referência base

- `origin/develop`: referência usada apenas para selecionar o commit inicial da branch.
- Não deve se tornar upstream da branch SDD.

## Transições

1. **Antes do start:** branch SDD não existe.
2. **Após `from-issue --start`:** branch existe, `HEAD == origin/develop`, `upstream == none`.
3. **Após `git push -u origin HEAD`:** branch remota de mesmo nome existe e `upstream == origin/<name>`.

Estado proibido após o start: `upstream == origin/develop`.
