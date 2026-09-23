-- Cadastro e importacao rastreavel de escolas pela administracao central.
begin;

create table public.lotes_importacao_escolas (
  id uuid primary key default gen_random_uuid(),
  rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  nome_arquivo text not null default '',
  total_linhas integer not null default 0 check(total_linhas >= 0),
  linhas_validas integer not null default 0 check(linhas_validas >= 0),
  linhas_com_erro integer not null default 0 check(linhas_com_erro >= 0),
  situacao text not null default 'em_validacao' check(situacao in ('em_validacao','validado','aplicado','aplicado_com_erros','cancelado')),
  criado_por uuid not null references public.perfis_usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  aplicado_por uuid references public.perfis_usuarios(id) on delete restrict,
  aplicado_em timestamptz,
  check(linhas_validas + linhas_com_erro <= total_linhas)
);

create table public.linhas_importacao_escolas (
  id uuid primary key default gen_random_uuid(),
  lote_importacao_escolas_id uuid not null references public.lotes_importacao_escolas(id) on delete restrict,
  numero_linha integer not null check(numero_linha > 0),
  codigo_inep text not null default '',
  nome_escola text not null default '',
  municipio text not null default '',
  codigo_regional text not null default '',
  escola_id uuid references public.escolas(id) on delete restrict,
  operacao text not null check(operacao in ('criar','atualizar','ignorar')),
  situacao text not null check(situacao in ('valida','erro','aplicada','ignorada')),
  mensagem_erro text not null default '',
  criado_em timestamptz not null default now(),
  unique(lote_importacao_escolas_id,numero_linha)
);

create index lotes_importacao_escolas_rede_criado_idx on public.lotes_importacao_escolas(rede_ensino_id,criado_em desc);
create index linhas_importacao_escolas_lote_situacao_idx on public.linhas_importacao_escolas(lote_importacao_escolas_id,situacao,numero_linha);

alter table public.lotes_importacao_escolas enable row level security;
alter table public.linhas_importacao_escolas enable row level security;

create or replace function public.salvar_escola_rede(
  rede_destino_id uuid,
  codigo_inep_destino text,
  nome_destino text,
  municipio_destino text,
  codigo_regional_destino text,
  ativa_destino boolean default true
)
returns uuid
language plpgsql security definer set search_path=public,app
as $$
declare regional_destino_id uuid; escola_destino_id uuid;
begin
  if not app.usuario_administra_acessos(rede_destino_id) then
    raise exception 'Sem permissao para administrar escolas desta rede';
  end if;
  if trim(codigo_inep_destino) !~ '^[0-9]{8}$' then raise exception 'Codigo INEP invalido'; end if;
  if length(trim(nome_destino)) < 3 then raise exception 'Nome da escola invalido'; end if;
  if length(trim(municipio_destino)) < 2 then raise exception 'Municipio invalido'; end if;
  select id into regional_destino_id
  from public.regionais_ensino
  where rede_ensino_id=rede_destino_id and lower(codigo)=lower(trim(codigo_regional_destino));
  if regional_destino_id is null then raise exception 'Regional nao encontrada para esta rede'; end if;

  insert into public.escolas(rede_ensino_id,regional_ensino_id,codigo_inep,nome,municipio,ativo)
  values(rede_destino_id,regional_destino_id,trim(codigo_inep_destino),trim(nome_destino),trim(municipio_destino),coalesce(ativa_destino,true))
  on conflict(rede_ensino_id,codigo_inep) do update
    set regional_ensino_id=excluded.regional_ensino_id,nome=excluded.nome,municipio=excluded.municipio,ativo=excluded.ativo
  returning id into escola_destino_id;

  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'escola_salva','escola',escola_destino_id,trim(codigo_inep_destino));
  return escola_destino_id;
end;
$$;

create or replace function public.criar_lote_importacao_escolas(
  rede_destino_id uuid,
  nome_arquivo_destino text,
  linhas_destino jsonb
)
returns jsonb
language plpgsql security definer set search_path=public,app
as $$
declare lote_id uuid; linha record; numero integer := 0; erros integer := 0; validas integer := 0;
  inep text; nome text; municipio text; codigo_regional text; operacao_destino text; mensagem text; escola_existente uuid; regional_existente uuid;
begin
  if not app.usuario_administra_acessos(rede_destino_id) then raise exception 'Sem permissao para importar escolas desta rede'; end if;
  if jsonb_typeof(coalesce(linhas_destino,'[]'::jsonb)) <> 'array' then raise exception 'Linhas de importacao invalidas'; end if;
  if jsonb_array_length(linhas_destino) > 10000 then raise exception 'O lote excede o limite de 10000 linhas'; end if;

  insert into public.lotes_importacao_escolas(rede_ensino_id,nome_arquivo,criado_por)
  values(rede_destino_id,trim(coalesce(nome_arquivo_destino,'')),auth.uid()) returning id into lote_id;

  for linha in select value as dados from jsonb_array_elements(linhas_destino) loop
    numero := numero + 1;
    inep := trim(coalesce(linha.dados->>'codigoInep',linha.dados->>'codigo_inep',''));
    nome := trim(coalesce(linha.dados->>'nome',linha.dados->>'nomeEscola',''));
    municipio := trim(coalesce(linha.dados->>'municipio',''));
    codigo_regional := trim(coalesce(linha.dados->>'codigoRegional',linha.dados->>'codigo_regional',''));
    mensagem := '';
    select id into regional_existente from public.regionais_ensino where rede_ensino_id=rede_destino_id and lower(codigo)=lower(codigo_regional);
    select id into escola_existente from public.escolas where rede_ensino_id=rede_destino_id and codigo_inep=inep;
    if inep !~ '^[0-9]{8}$' then mensagem := 'Codigo INEP deve conter 8 digitos';
    elsif length(nome) < 3 then mensagem := 'Nome da escola invalido';
    elsif length(municipio) < 2 then mensagem := 'Municipio invalido';
    elsif regional_existente is null then mensagem := 'Regional inexistente nesta rede';
    end if;
    operacao_destino := case when escola_existente is null then 'criar' else 'atualizar' end;
    if mensagem='' then validas := validas+1; else erros := erros+1; end if;
    insert into public.linhas_importacao_escolas(lote_importacao_escolas_id,numero_linha,codigo_inep,nome_escola,municipio,codigo_regional,escola_id,operacao,situacao,mensagem_erro)
    values(lote_id,numero,inep,nome,municipio,codigo_regional,escola_existente,operacao_destino,case when mensagem='' then 'valida' else 'erro' end,mensagem);
  end loop;

  update public.lotes_importacao_escolas
  set total_linhas=numero,linhas_validas=validas,linhas_com_erro=erros,situacao=case when erros=0 then 'validado' else 'em_validacao' end
  where id=lote_id;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'importacao_escolas_validada','lote_importacao_escolas',lote_id,numero::text || ' linhas');
  return jsonb_build_object('id',lote_id,'totalLinhas',numero,'linhasValidas',validas,'linhasComErro',erros,'situacao',case when erros=0 then 'validado' else 'em_validacao' end);
end;
$$;

create or replace function public.aplicar_lote_importacao_escolas(lote_destino_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,app
as $$
declare lote public.lotes_importacao_escolas%rowtype; linha public.linhas_importacao_escolas%rowtype; escola_destino_id uuid; aplicadas integer:=0;
begin
  select * into lote from public.lotes_importacao_escolas where id=lote_destino_id for update;
  if not found then raise exception 'Lote de importacao nao encontrado'; end if;
  if not app.usuario_administra_acessos(lote.rede_ensino_id) then raise exception 'Sem permissao para aplicar este lote'; end if;
  if lote.situacao <> 'validado' then raise exception 'O lote precisa estar validado e sem erros'; end if;

  for linha in select * from public.linhas_importacao_escolas where lote_importacao_escolas_id=lote.id and situacao='valida' order by numero_linha loop
    escola_destino_id := public.salvar_escola_rede(lote.rede_ensino_id,linha.codigo_inep,linha.nome_escola,linha.municipio,linha.codigo_regional,true);
    update public.linhas_importacao_escolas set escola_id=escola_destino_id,situacao='aplicada' where id=linha.id;
    aplicadas:=aplicadas+1;
  end loop;
  update public.lotes_importacao_escolas set situacao='aplicado',aplicado_por=auth.uid(),aplicado_em=now() where id=lote.id;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(lote.rede_ensino_id,auth.uid(),'importacao_escolas_aplicada','lote_importacao_escolas',lote.id,aplicadas::text || ' escolas');
  return jsonb_build_object('ok',true,'escolasAplicadas',aplicadas);
end;
$$;

create or replace function public.listar_lotes_importacao_escolas(rede_destino_id uuid, tamanho_pagina integer default 20, deslocamento integer default 0)
returns table(lote_id uuid,nome_arquivo text,total_linhas integer,linhas_validas integer,linhas_com_erro integer,situacao text,criado_em timestamptz,aplicado_em timestamptz,total_registros bigint)
language sql stable security definer set search_path=public,app
as $$
  select l.id,l.nome_arquivo,l.total_linhas,l.linhas_validas,l.linhas_com_erro,l.situacao,l.criado_em,l.aplicado_em,count(*) over()
  from public.lotes_importacao_escolas l
  where l.rede_ensino_id=rede_destino_id and app.usuario_administra_acessos(rede_destino_id)
  order by l.criado_em desc
  limit least(greatest(coalesce(tamanho_pagina,20),1),100) offset greatest(coalesce(deslocamento,0),0);
$$;

create or replace function public.listar_linhas_lote_importacao_escolas(lote_destino_id uuid, tamanho_pagina integer default 100, deslocamento integer default 0)
returns table(numero_linha integer,codigo_inep text,nome_escola text,municipio text,codigo_regional text,operacao text,situacao text,mensagem_erro text,total_registros bigint)
language sql stable security definer set search_path=public,app
as $$
  select li.numero_linha,li.codigo_inep,li.nome_escola,li.municipio,li.codigo_regional,li.operacao,li.situacao,li.mensagem_erro,count(*) over()
  from public.linhas_importacao_escolas li
  join public.lotes_importacao_escolas l on l.id=li.lote_importacao_escolas_id
  where li.lote_importacao_escolas_id=lote_destino_id and app.usuario_administra_acessos(l.rede_ensino_id)
  order by li.numero_linha
  limit least(greatest(coalesce(tamanho_pagina,100),1),500) offset greatest(coalesce(deslocamento,0),0);
$$;

grant execute on function public.salvar_escola_rede(uuid,text,text,text,text,boolean),public.criar_lote_importacao_escolas(uuid,text,jsonb),public.aplicar_lote_importacao_escolas(uuid),public.listar_lotes_importacao_escolas(uuid,integer,integer),public.listar_linhas_lote_importacao_escolas(uuid,integer,integer) to authenticated;

commit;
