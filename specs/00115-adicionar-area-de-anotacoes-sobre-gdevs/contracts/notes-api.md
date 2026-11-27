# Contrato — Notes API

Todos os endpoints exigem sessão Sanctum autenticada, usuário ativo e perfil admin. X-Notes-Actor deve coincidir com o ID da sessão (precondição, não credencial). Respostas privadas sem cache.

| Método | Caminho | Resultado |
|---|---|---|
| GET | /notes | members: id, name e preview apenas do autor da sessão |
| GET | /notes/{member} | member: id, name; content e version do autor da sessão (vazio e 0 se ausente) |
| PUT | /notes/{member} | recebe content e expected_version, grava atomicamente o par da sessão e retorna member/content/version |

- 401 visitante; 403 perfil não autorizado/inativo conforme contrato existente; 409 precondição de sessão ausente ou divergente (sem snapshot); 409 reason note_version_conflict com note: {member, content, version} quando a revisão diverge; 404 membro inexistente; 422 conteúdo/revisão inválidos ou campos de propriedade/version fornecidos.
- A identidade de autor não pode ser escolhida pelo cliente. Não retornar conteúdo, existência ou metadados de notas alheias.
- Nenhuma alteração ao mecanismo geral de autenticação.

- expected_version é inteiro JSON obrigatório, de 0 a 9007199254740990. Em sucesso version = expected_version + 1; versão 0 cria o par exclusivamente se ausente. Conteúdo preservado exatamente (inclusive espaços e quebras de linha). O conflito retorna snapshot privado da ficha autenticada e não grava; nova tentativa de sobrescrita também exige versão.
