begin;

do $$
begin
  if to_regclass('public.identificacoes_ppp') is null then raise exception 'Tabela identificacoes_ppp ausente'; end if;
  if to_regclass('public.textos_ppp') is null then raise exception 'Tabela textos_ppp ausente'; end if;
  if to_regclass('public.indicadores_educacionais_ppp') is null then raise exception 'Tabela indicadores_educacionais_ppp ausente'; end if;
  if to_regclass('public.detalhes_ppp') is null then raise exception 'Tabela detalhes_ppp ausente'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='revisoes_ppp' and data_type='jsonb') then raise exception 'Revisoes PPP nao podem manter JSONB persistente'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='versoes_ppp') then raise exception 'RLS de versoes_ppp ausente'; end if;
  if to_regprocedure('public.criar_rascunho_ppp(uuid,jsonb)') is null then raise exception 'RPC de criacao ausente'; end if;
  if to_regprocedure('public.salvar_rascunho_ppp(uuid,bigint,jsonb,text,jsonb)') is null then raise exception 'RPC de salvamento ausente'; end if;
  if to_regprocedure('public.obter_ppp_por_protocolo(text)') is null then raise exception 'RPC de retomada ausente'; end if;
  if to_regprocedure('public.concluir_ppp(uuid,bigint)') is null then raise exception 'RPC de conclusao ausente'; end if;
end $$;

rollback;
