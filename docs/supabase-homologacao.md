# Supabase: migração para homologação

Use um projeto Supabase separado e vazio para homologação. O schema é controlado exclusivamente por `supabase/migrations/`.

1. Instale e autentique a CLI do Supabase.
2. Vincule o projeto: `supabase link --project-ref <referencia-do-projeto>`.
3. Confira: `supabase db push --dry-run`.
4. Aplique: `supabase db push`.
5. Crie os usuários de homologação no Supabase Auth e crie seus vínculos em `vinculos_usuarios`.

Não use `--include-seed` em homologação. `supabase/seed.desenvolvimento.sql` cria apenas a rede, escola e vínculo de teste locais.

## Atenção à primeira migration

`20260922000100_base_inicial.sql` começa com `drop schema public cascade` para estabelecer uma base limpa. Ela é apropriada somente para um projeto novo e vazio. Em qualquer banco com dados, faça backup e prepare uma estratégia de migração específica; nunca aplique esse arquivo diretamente.

## Dados que não podem ir para Git ou homologação

`.env.local`, `Supabase pass.txt`, senha PostgreSQL, `service_role` e tokens pessoais. A aplicação web usa apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, com RLS habilitada.

## Backup e restauração

Antes de qualquer migration em homologação, gere um backup no painel do Supabase. Teste restauração em outro projeto. Backups do banco não incluem automaticamente objetos do Storage; exporte também os objetos privados e valide os hashes gravados em `arquivos_ppp`.
