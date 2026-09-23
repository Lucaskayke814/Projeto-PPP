# Gerador de PPP

Sistema de elabora??o, versionamento e acompanhamento de Projetos Pol?tico-Pedag?gicos, baseado na refer?ncia funcional v10.2 e integrado ao Supabase.

## Estrutura

| Diret?rio | Responsabilidade |
| --- | --- |
| `Gerador de PPP V6.5/Gerador de PPP v10.2/` | Refer?ncia v10.2 imut?vel, usada para compara??o e gera??o de dados iniciais. |
| `apps/web/` | Aplica??o Vite, c?pia de trabalho v10.2 e adaptador Supabase. |
| `supabase/migrations/` | Schema PostgreSQL, RLS, RPCs e dados versionados. |
| `supabase/functions/` | Edge Functions autorizadas, quando necess?rias. |
| `supabase/tests/` | Testes SQL da camada de dados. |
| `docs/` | Arquitetura, migra??o e opera??o local. |

Os arquivos hist?ricos v6.5 permanecem somente como registro e n?o participam do build, das rotas ou da persist?ncia atual.

## Executar

Crie `.env.local` a partir de `.env.example`, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

```powershell
npm --prefix apps/web run dev
```

Abra `http://127.0.0.1:5173/`. A rota principal abre a c?pia de trabalho v10.2 conectada ao Supabase.

Para reconstruir a c?pia de trabalho e os cat?logos da refer?ncia:

```powershell
npm --prefix apps/web run prepare:reference
npm --prefix apps/web run prepare:catalogs:v102
```

Consulte [a arquitetura do banco](docs/database-architecture.md), [a migra??o v10.2](docs/migracao-v10.2.md) e [a opera??o local](docs/supabase-local.md).
