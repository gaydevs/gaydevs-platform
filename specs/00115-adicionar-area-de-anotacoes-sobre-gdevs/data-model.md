# Modelo de dados — notas privadas por autor

## user_notes
- id: UUIDv7, chave primária.
- author_id: UUID, FK users.id, obrigatório.
- user_id: UUID, FK users.id, obrigatório.
- content: text; até 10.000 caracteres pela validação da API.
- version: inteiro positivo (default 1), crescente em cada gravação aceita; limite seguro de JSON/JavaScript. Ausência da ficha corresponde à versão 0.
- created_at e updated_at.
- UNIQUE(author_id, user_id); índice para user_id.
- Autor e membro imutáveis após criação; cascata na exclusão do usuário.
- Ausência de par corresponde a conteúdo vazio. Limpar atualiza somente o par autenticado, sem remover o registro nem reiniciar a versão. Atualização condicional pela versão esperada; criação protegida pela unicidade do par. Sem histórico de versões.
