# Banco Supabase: operacao local e homologacao

O banco do Gerador de PPP usa PostgreSQL, Supabase Auth, Row Level Security (RLS) e Storage privado. As migrations em `supabase/migrations` sao a fonte de verdade do schema. Nunca altere uma migration aplicada; crie outra migration aditiva.

## Ambiente local

1. Instale Docker Desktop e a CLI do Supabase.
2. Copie `.env.example` para `.env.local` e informe apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para a aplicacao web.
3. Na raiz, execute:

```powershell
supabase start
supabase db reset
supabase test db
```

`supabase db reset` remove somente os dados do banco local. Nunca use esse comando apontado ao projeto remoto.

## Homologacao

O projeto remoto deve estar vinculado por referencia, sem senha salva em codigo:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Antes de aplicar migrations: gere um backup, confira o projeto exibido pela CLI e revise as migrations pendentes. A chave `service_role`, a senha PostgreSQL e qualquer token administrativo ficam apenas em secrets de Edge Functions ou em automacao protegida. Eles nunca entram em HTML, JavaScript ou Git.

## Banco criado

- Organizacao: `redes_ensino`, `regionais_ensino`, `escolas`.
- Identidade e escopo: `perfis_usuarios`, `vinculos_usuarios`, `provisionamentos_acesso`.
- PPP: documento, versao, revisao, respostas relacionais, progresso, participantes, arquivos e eventos.
- Conteudo institucional: publicacoes imutaveis, itens publicados e rascunhos por curador.
- Administracao central: consulta paginada, auditoria, cadastro/importacao de escolas e ciclo de provisionamento.

As respostas do PPP sao persistidas em tabelas relacionais. JSONB aparece somente na entrada e saida das RPCs e nos valores flexiveis de conteudo institucional; nao existe JSONB persistente em revisoes do PPP.

## Backup e restauracao

Para homologacao e producao, habilite os backups gerenciados no painel Supabase e teste a restauracao em um projeto separado. Antes de uma mudanca relevante, gere tambem um dump logico protegido em maquina administrativa:

```powershell
pg_dump --format=custom --no-owner --file .\backup-ppp.dump "postgresql://postgres:SENHA@db.SEUPROJETO.supabase.co:5432/postgres"
pg_restore --list .\backup-ppp.dump
```

Restaure somente em ambiente isolado e validado. O restore completo nao deve ser usado para sobrescrever producao durante o funcionamento normal.

## Testes de banco

`supabase/tests/001_estrutura_base.sql` verifica o schema e as RPCs essenciais. `002_fluxo_rascunho.sql` cobre criacao, salvamento, retomada e RLS do PPP. `003_fundacao_orgao_central_remoto.sql` valida a fundacao central com uma conta real de desenvolvimento. `004_administracao_central.sql` verifica importacao, convites, curadoria e integridade de escopo.

Os testes que criam registros temporarios devem ser executados em desenvolvimento ou homologacao, nunca em producao.
