# Supabase local e banco do Gerador de PPP

O repositório usa Supabase para PostgreSQL, Auth, RLS, Storage privado e Edge Functions. O HTML v6.5 continua sendo o protótipo e o modo demonstração continua ativo até que a integração por adaptador seja ligada.

## Pré-requisitos

Instale Docker Desktop e a CLI do Supabase. Não use o arquivo `Supabase pass.txt` como configuração de aplicação. Ele está ignorado pelo Git e não deve ser copiado para `.env` nem para código.

Crie `.env` a partir de `.env.example`. A chave `service_role` só é permitida em secrets de Edge Functions ou automação protegida; nunca em `apps/web` ou HTML.

## Banco local

Na raiz do projeto:

```powershell
supabase start
supabase db reset
supabase test db
```

`db reset` recria somente o banco local do Supabase. Não aponte `SUPABASE_DB_URL` para produção ao executar esse comando.

Para aplicar migrations em um projeto Supabase remoto já vinculado:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Antes de `db push`, faça backup, revise o plano gerado e confirme que o projeto é o ambiente correto. O processo não inclui criação automática de escolas, usuários ou conteúdo pedagógico publicado.

## Provisionamento inicial

As migrations criam estados, papéis, permissões, grupos de catálogo, blueprints de opções atuais e o schema do formulário. A rede, as regionais, as escolas e a primeira publicação pedagógica são deliberadamente provisionadas por administrador após validar a origem normativa. Isso evita publicar como dado oficial as listas e referências que o protótipo ainda marca como provisórias.

Ordem operacional:

1. Criar rede e regionais com códigos estáveis.
2. Importar escolas com INEP validado e regional conferida.
3. Criar usuários no Supabase Auth e conceder `vinculos_usuario` com o menor escopo necessário.
4. Criar a primeira `publicacoes_conteudo`, revisar as `opcoes_catalogo` e gravar o ponteiro em `configuracoes_rede`.
5. Testar RLS com uma conta de escola, uma regional e uma central antes de abrir o frontend.

## Arquivos

| Caminho | Uso |
| --- | --- |
| `supabase/migrations` | Fonte de verdade do schema, na ordem do timestamp |
| `supabase/tests` | Testes pgTAP executados por `supabase test db` |
| `supabase/functions/ppp-api` | Fachada HTTP mínima para RPCs já implementadas |
| `apps/web/src/lib/legacy-adapter.ts` | Conversão do estado v6.5 em respostas versionadas |

As próximas migrations devem ser novas e aditivas. Não reescreva uma migration que já tenha sido aplicada a qualquer ambiente compartilhado.
