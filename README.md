# Gerador de PPP

Sistema de elaboração, versionamento e acompanhamento de Projetos Político-Pedagógicos. O protótipo funcional permanece em `Gerador de PPP V6.5/`; a nova persistência usa Supabase.

## Demonstração

Após a execução do workflow **Publicar GitHub Pages**, o protótipo pode ser aberto em `https://lucaskayke814.github.io/Projeto-PPP/`. A publicação usa o modo demonstração por padrão e não contém senha, token administrativo ou configuração local do Supabase.

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `Gerador de PPP V6.5/` | Protótipo HTML monolítico e modo demonstração atual |
| `apps/web/` | Cliente TypeScript e adaptador gradual do contrato v6.5 |
| `supabase/migrations/` | Schema PostgreSQL, RLS, RPCs e dados de domínio |
| `supabase/functions/` | Edge Functions para operações HTTP autorizadas |
| `supabase/tests/` | Testes de banco pgTAP |
| `docs/` | Decisões arquiteturais e operação local |

O banco é estruturado para usar Supabase Auth, PostgreSQL, Storage privado e RLS. A fonte de verdade de toda mudança de schema são as migrations. Consulte [a arquitetura do banco](docs/database-architecture.md) e [a operação local](docs/supabase-local.md) antes de vincular um projeto remoto.

O protótipo também possui uma [ponte opcional para o Supabase](docs/supabase-legacy-bridge.md). Ela mantém o modo demonstração e ativa persistência real de rascunhos somente após provisionamento e configuração local explícitos.
