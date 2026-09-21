begin;
select plan(14);

select has_table('public', 'ppp_versions', 'Versões de PPP existem');
select has_table('public', 'ppp_revisions', 'Revisões imutáveis existem');
select has_table('public', 'content_releases', 'Publicações institucionais existem');
select has_table('public', 'audit_events', 'Auditoria existe');
select has_table('public', 'catalog_options', 'Catálogos configuráveis existem');
select has_column('public', 'ppp_revisions', 'answers', 'Respostas JSONB existem');
select col_type_is('public', 'ppp_revisions', 'answers', 'jsonb', 'Respostas usam JSONB');
select col_type_is('public', 'schools', 'data', 'jsonb', 'Dados variáveis da escola usam JSONB');
select policies_are('public', 'ppp_versions', array['versions by scope'], 'Versões têm somente leitura direta por escopo');
select policies_are('public', 'ppp_revisions', array['revisions by scope'], 'Revisões seguem o escopo da versão');
select has_function('public', 'create_ppp_draft', array['uuid', 'jsonb'], 'RPC cria rascunho sem escrita direta');
select has_function('public', 'save_ppp_draft', array['uuid', 'bigint', 'jsonb', 'text', 'jsonb'], 'RPC salva nova revisão');
select is((select count(*) from public.catalog_options), 75::bigint, 'Seed contém as 75 opções de catálogo do protótipo');
select is((select public from storage.buckets where id = 'ppp-private'), false, 'Bucket de PPP é privado');

select * from finish();
rollback;
