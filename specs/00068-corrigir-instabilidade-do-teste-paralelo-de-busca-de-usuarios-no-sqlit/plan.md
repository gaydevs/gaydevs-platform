# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/68 · Spec: [spec.md](spec.md)
Fast-track risk: Low

## Diagnóstico

`SearchUsers::handle` retorna usuários ativos quando o termo é prefixo do nome, de uma palavra do nome **ou do e-mail**. No teste que espera somente `Roberto Souza` para `q=Ro`, o usuário ativo `Amaro Silva` era criado com e-mail aleatório da Factory/Faker: um prefixo `ro...` introduz um segundo resultado válido. O erro observado não comprova compartilhamento entre workers; o teste tinha dados não determinísticos.

## Abordagem

- Fornecer e-mails estáveis para todos os usuários com nomes fixos nesse arquivo de teste.
- Não alterar a lógica de `SearchUsers` nem a factory global, pois o problema é a expectativa do teste.
- Rodar teste focal, suíte paralela SQLite em várias ordens/seeds quando possível e validar CI integral com MySQL, lint e auditorias.
- Publicar um PR rastreado em `develop` com `Refs #68` e `Spec: 00068`, sujeito à revisão humana.

## Restrição

O sucesso em várias execuções aumenta a confiança, mas não prova ausência universal de instabilidade.


## Evidências locais — 2026-11-10

- Teste focal: 5 testes passaram, 64 asserções.
- Três execuções de `php artisan test --parallel --processes=4 --order-by=random`, com seeds `1793031055`, `987654321` e `20261110`: em cada uma, 164 testes passaram, 2 foram ignorados e 970 asserções foram executadas.
- `php vendor/bin/pint --test`: 167 arquivos aprovados.
- Suíte serial também retornou código zero e 970 asserções, mas a instalação PHP 8.4 isolada reportou avisos locais de `file_get_contents`; CI oficial usa PHP 8.3 e será a validação final.
- Nenhum ajuste de produto, factory compartilhada ou CI foi necessário.
