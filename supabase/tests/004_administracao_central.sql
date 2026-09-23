-- Regressao estrutural da administracao central. Pode ser executado por supabase test db.
do $$
begin
  if to_regclass('public.lotes_importacao_escolas') is null then raise exception 'Tabela lotes_importacao_escolas ausente'; end if;
  if to_regclass('public.linhas_importacao_escolas') is null then raise exception 'Tabela linhas_importacao_escolas ausente'; end if;
  if to_regclass('public.rascunhos_conteudo_institucional') is null then raise exception 'Tabela rascunhos_conteudo_institucional ausente'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='provisionamentos_acesso' and column_name='revogado_em') then raise exception 'Ciclo de revogacao de provisionamentos ausente'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='provisionamentos_acesso' and column_name='ultimo_reenvio_em') then raise exception 'Registro de reenvio de convite ausente'; end if;
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='lotes_importacao_escolas' and rowsecurity) then raise exception 'RLS de lotes de importacao ausente'; end if;
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='linhas_importacao_escolas' and rowsecurity) then raise exception 'RLS de linhas de importacao ausente'; end if;
  if to_regprocedure('public.listar_provisionamentos_acesso(uuid)') is null then raise exception 'RPC de listagem de provisionamentos ausente'; end if;
  if to_regprocedure('public.revogar_provisionamento_acesso(uuid,text)') is null then raise exception 'RPC de revogacao de provisionamento ausente'; end if;
  if to_regprocedure('public.registrar_reenvio_convite_acesso(uuid)') is null then raise exception 'RPC de reenvio de convite ausente'; end if;
  if to_regprocedure('public.salvar_escola_rede(uuid,text,text,text,text,boolean)') is null then raise exception 'RPC de cadastro de escola ausente'; end if;
  if to_regprocedure('public.criar_lote_importacao_escolas(uuid,text,jsonb)') is null then raise exception 'RPC de validacao da importacao ausente'; end if;
  if to_regprocedure('public.aplicar_lote_importacao_escolas(uuid)') is null then raise exception 'RPC de aplicacao da importacao ausente'; end if;
  if to_regprocedure('public.listar_publicacoes_institucionais(uuid,integer,integer)') is null then raise exception 'RPC de historico de publicacoes ausente'; end if;
  if to_regprocedure('public.descartar_rascunhos_curadoria(uuid,text[])') is null then raise exception 'RPC de descarte de rascunhos ausente'; end if;
  if to_regprocedure('public.obter_conteudo_institucional_publicado(uuid)') is null then raise exception 'RPC de leitura de conteudo por rede ausente'; end if;
end;
$$;

-- A trigger impede que uma escola seja vinculada a regional de outra rede.
do $$
declare rede_a uuid := gen_random_uuid(); rede_b uuid := gen_random_uuid(); regional_a uuid := gen_random_uuid(); regional_b uuid := gen_random_uuid();
begin
  insert into public.redes_ensino(id,codigo,nome) values(rede_a,'teste-escopo-a','Rede de teste A'),(rede_b,'teste-escopo-b','Rede de teste B');
  insert into public.regionais_ensino(id,rede_ensino_id,codigo,nome) values(regional_a,rede_a,'a','Regional A'),(regional_b,rede_b,'b','Regional B');
  begin
    insert into public.escolas(rede_ensino_id,regional_ensino_id,codigo_inep,nome,municipio)
    values(rede_a,regional_b,'12345678','Escola de teste','Teste');
    raise exception 'A integridade de escopo aceitou uma regional de outra rede';
  exception when others then
    if sqlerrm <> 'A regional da escola nao pertence a rede de ensino' then raise; end if;
  end;
  delete from public.regionais_ensino where id in (regional_a,regional_b);
  delete from public.redes_ensino where id in (rede_a,rede_b);
end;
$$;
