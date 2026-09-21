# Ponte do HTML v6.5 para o Supabase

O protótipo continua funcional em demonstração. A ponte é opcional e só substitui os mocks de contexto, conteúdo publicado, login institucional, salvar/retomar rascunho e painel quando uma configuração pública do Supabase estiver presente.

## Ativação local

Copie `Gerador de PPP V6.5/supabase-config.js.example` para `Gerador de PPP V6.5/supabase-config.js`. Preencha `url` e `anonKey` com os valores públicos do projeto. O arquivo está no `.gitignore`; nunca inclua `service_role`, senha de banco ou token administrativo.

Abra o HTML por um servidor estático local. O usuário entra pela porta institucional usando uma conta criada no Supabase Auth e precisa ter um registro ativo em `vinculos_usuario`.

Sem essa configuração, o HTML permanece no modo demonstração, inclusive com `REGISTROS_DEMO` e `ACESSOS_DEMO`.

## Dados que já passam a ser reais

- O login usa Supabase Auth.
- O contexto vem de `perfis_usuario` e `vinculos_usuario`.
- A escola é resolvida pelo INEP em `escolas`, respeitando RLS.
- Cada salvamento cria uma nova linha em `revisoes_ppp`; o payload do formulário v6.5 é preservado em `answers.legacy_payload`.
- A retomada usa o protocolo e a revisão atual autorizada.
- O painel consulta `versoes_ppp`, escola, regional, participantes, arquivos e progresso por meio de RPCs com RLS.
- Conteúdo ativo vem de `publicacoes_conteudo` apontada por `configuracoes_rede`.

## Provisionamento necessário

Antes de testar uma escola real, um administrador deve criar a rede, a regional, a escola, uma publicação institucional ativa e o vínculo do usuário. A migration não cria escolas, pessoas nem conteúdo pedagógico fictício.

## Próximas operações

Assinaturas, convites, atas, anexos, homologação, curadoria e administração de acessos continuam no caminho de demonstração até cada uma possuir sua própria transação, autorização e, para arquivos, integração segura com Storage. Elas não escrevem dados simulados no Supabase.
