# Contrato — Notes API

Todos os endpoints exigem sessão Sanctum autenticada, usuário ativo e perfil admin. X-Notes-Actor deve coincidir com o ID da sessão (precondição, não credencial). Respostas privadas sem cache.

| Método | Caminho | Resultado |
|---|---|---|
| GET | /notes | members: id, name e preview apenas do autor da sessão |
| GET | /notes/{member} | member: id, name; content do autor da sessão ou vazio |
| PUT | /notes/{member} | recebe content, atualiza o par da sessão e retorna member/content |

- 401 visitante; 403 perfil não autorizado/inativo conforme contrato existente; 409 precondição de sessão ausente ou divergente; 404 membro inexistente; 422 conteúdo inválido ou campos de propriedade fornecidos.
- A identidade de autor não pode ser escolhida pelo cliente. Não retornar conteúdo, existência ou metadados de notas alheias.
- Nenhuma alteração ao mecanismo geral de autenticação.
