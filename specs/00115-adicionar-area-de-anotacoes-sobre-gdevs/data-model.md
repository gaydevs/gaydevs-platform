# Modelo de dados — notas privadas por autor

## user_notes
- id: UUIDv7, chave primária.
- author_id: UUID, FK users.id, obrigatório.
- user_id: UUID, FK users.id, obrigatório.
- content: text; até 10.000 caracteres pela validação da API.
- created_at e updated_at.
- UNIQUE(author_id, user_id); índice para user_id.
- Autor e membro imutáveis após criação; cascata na exclusão do usuário.
- Ausência de par corresponde a conteúdo vazio. Limpar atualiza somente o par autenticado.
