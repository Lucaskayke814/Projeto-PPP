do $$
begin
  if to_regclass('public.identificacoes_ppp') is null then raise exception 'Tabela identificacoes_ppp ausente'; end if;
  if to_regclass('public.textos_ppp') is null then raise exception 'Tabela textos_ppp ausente'; end if;
  if to_regclass('public.indicadores_educacionais_ppp') is null then raise exception 'Tabela indicadores_educacionais_ppp ausente'; end if;
  if to_regclass('public.detalhes_ppp') is null then raise exception 'Tabela detalhes_ppp ausente'; end if;
  if to_regclass('public.orientacoes_itens_catalogo') is null then raise exception 'Tabela de orientacoes dos catalogos ausente'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='escolas' and column_name='codigo_inep_censo') then raise exception 'Codigo INEP do Censo ausente no cadastro da escola'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='identificacoes_ppp' and column_name='codigo_inep_censo') then raise exception 'Snapshot do Codigo INEP do Censo ausente no PPP'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='revisoes_ppp' and data_type='jsonb') then raise exception 'Revisoes PPP nao podem manter JSONB persistente'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='versoes_ppp') then raise exception 'RLS de versoes_ppp ausente'; end if;
  if to_regprocedure('public.criar_rascunho_ppp(uuid,jsonb)') is null then raise exception 'RPC de criacao ausente'; end if;
  if to_regprocedure('public.salvar_rascunho_ppp(uuid,bigint,jsonb,text,jsonb)') is null then raise exception 'RPC de salvamento ausente'; end if;
  if to_regprocedure('public.obter_ppp_por_protocolo(text)') is null then raise exception 'RPC de retomada ausente'; end if;
  if to_regprocedure('public.concluir_ppp(uuid,bigint)') is null then raise exception 'RPC de conclusao ausente'; end if;
  if to_regprocedure('public.atualizar_tela_atual_ppp(uuid,text)') is null then raise exception 'RPC de retomada por tela ausente'; end if;
  if to_regprocedure('public.listar_ppps_do_painel(text,integer,integer)') is null then raise exception 'RPC do painel de PPPs ausente'; end if;
  if to_regprocedure('public.registrar_previa_pdf_ppp(uuid,text,text,bigint,text)') is null then raise exception 'RPC de registro de previa ausente'; end if;
  if to_regprocedure('app.pode_ler_arquivo_ppp(text)') is null then raise exception 'Verificacao de leitura do Storage ausente'; end if;
  if not exists(select 1 from storage.buckets where id='ppp-private' and public=false) then raise exception 'Bucket privado de PPP ausente'; end if;
end $$;
