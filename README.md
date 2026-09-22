# Gerador de PPP

Sistema de elaboração, versionamento e acompanhamento de Projetos Político-Pedagógicos. O protótipo funcional permanece em `Gerador de PPP V6.5/`; a nova persistência usa Supabase.

## Demonstração

Após a execução do workflow **Publicar GitHub Pages**, a cópia de trabalho pode ser aberta em `https://lucaskayke814.github.io/Projeto-PPP/`. Configure as variáveis de repositório `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` antes de publicar a integração. Elas contêm apenas dados públicos do cliente; senhas, tokens administrativos e `service_role` não são usados no frontend.

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

O protótipo em `Gerador de PPP V6.5/` é uma referência imutável. A integração com Supabase e a nova interface serão implementadas exclusivamente em `apps/web/`.

## Executar a cópia de trabalho

O **Live Server** abre o `index.html` da raiz e, por segurança, esse arquivo continua levando ao protótipo de referência em modo demonstração. Para executar a cópia conectada ao Supabase, use o Vite:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
npm --prefix apps/web run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173/`. O Vite lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do `.env.local` na raiz; esse arquivo permanece ignorado pelo Git.
