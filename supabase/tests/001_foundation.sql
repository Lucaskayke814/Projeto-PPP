begin;
select plan(14);

select has_table('public', 'versoes_ppp', 'Versões de PPP existem');
select has_table('public', 'revisoes_ppp', 'Revisões imutáveis existem');
select has_table('public', 'publicacoes_conteudo', 'Publicações institucionais existem');
select has_table('public', 'eventos_auditoria', 'Auditoria existe');
select has_table('public', 'opcoes_catalogo', 'Catálogos configuráveis existem');
select has_column('public', 'revisoes_ppp', 'answers', 'Respostas JSONB existem');
select col_type_is('public', 'revisoes_ppp', 'answers', 'jsonb', 'Respostas usam JSONB');
select col_type_is('public', 'escolas', 'data', 'jsonb', 'Dados variáveis da escola usam JSONB');
select policies_are('public', 'versoes_ppp', array['versions by scope'], 'Versões têm somente leitura direta por escopo');
select policies_are('public', 'revisoes_ppp', array['revisions by scope'], 'Revisões seguem o escopo da versão');
select has_function('public', 'create_ppp_draft', array['uuid', 'jsonb'], 'RPC cria rascunho sem escrita direta');
select has_function('public', 'save_ppp_draft', array['uuid', 'bigint', 'jsonb', 'text', 'jsonb'], 'RPC salva nova revisão');
select is((select count(*) from public.opcoes_catalogo), 75::bigint, 'Seed contém as 75 opções de catálogo do protótipo');
select is((select public from storage.buckets where id = 'ppp-private'), false, 'Bucket de PPP é privado');

select * from finish();
rollback;
