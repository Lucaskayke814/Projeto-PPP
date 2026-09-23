-- Curadoria versionada do Órgão Central. Publicações são imutáveis; rascunhos
-- pertencem ao curador até serem incorporados em uma nova publicação.
begin;

alter table public.itens_publicacao_institucional
  add column if not exists valor jsonb;

update public.itens_publicacao_institucional
   set valor = to_jsonb(texto)
 where valor is null;

alter table public.itens_publicacao_institucional
  alter column valor set not null;

create table if not exists public.rascunhos_conteudo_institucional (
  rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  chave text not null check(length(trim(chave)) > 0),
  autor_id uuid not null references public.perfis_usuarios(id) on delete restrict,
  valor jsonb,
  rotulo text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key(rede_ensino_id,chave,autor_id)
);

create index if not exists rascunhos_conteudo_rede_atualizado_idx
  on public.rascunhos_conteudo_institucional(rede_ensino_id,atualizado_em desc);

alter table public.rascunhos_conteudo_institucional enable row level security;

create or replace function public.obter_conteudo_institucional_publicado()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with rede_autorizada as (
    select vinculo.rede_ensino_id
    from public.vinculos_usuarios vinculo
    where vinculo.usuario_id = auth.uid()
      and vinculo.revogado_em is null
    order by vinculo.criado_em
    limit 1
  ), publicacao_ativa as (
    select publicacao.id, publicacao.numero
    from rede_autorizada rede
    join public.configuracoes_redes configuracao on configuracao.rede_ensino_id = rede.rede_ensino_id
    join public.publicacoes_institucionais publicacao on publicacao.id = configuracao.publicacao_institucional_ativa_id
  )
  select coalesce((
    select jsonb_build_object(
      'ok', true,
      'versao', publicacao.numero,
      'itens', coalesce(jsonb_object_agg(item.chave,item.valor), '{}'::jsonb),
      'padroes', '{}'::jsonb
    )
    from publicacao_ativa publicacao
    left join public.itens_publicacao_institucional item on item.publicacao_institucional_id = publicacao.id
    group by publicacao.id, publicacao.numero
  ), jsonb_build_object('ok',true,'versao',0,'itens','{}'::jsonb,'padroes','{}'::jsonb));
$$;

create or replace function public.abrir_curadoria_conteudo(rede_destino_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public,app
as $$
  with autorizado as (
    select app.usuario_cura_conteudo(rede_destino_id) as permitido
  ), publicacao_ativa as (
    select publicacao.id, publicacao.numero
    from public.configuracoes_redes configuracao
    join public.publicacoes_institucionais publicacao on publicacao.id = configuracao.publicacao_institucional_ativa_id
    where configuracao.rede_ensino_id = rede_destino_id
  )
  select case when not (select permitido from autorizado) then
    jsonb_build_object('ok',false,'erro','Sem permissao para editar o conteudo desta rede')
  else jsonb_build_object(
    'ok',true,
    'versao',coalesce((select numero from publicacao_ativa),0),
    'itens',coalesce((select jsonb_object_agg(item.chave,item.valor) from publicacao_ativa publicacao join public.itens_publicacao_institucional item on item.publicacao_institucional_id=publicacao.id),'{}'::jsonb),
    'rascunhos',coalesce((select jsonb_object_agg(rascunho.chave,rascunho.valor) from public.rascunhos_conteudo_institucional rascunho where rascunho.rede_ensino_id=rede_destino_id and rascunho.autor_id=auth.uid()),'{}'::jsonb),
    'pendentes',coalesce((select count(*) from public.rascunhos_conteudo_institucional rascunho where rascunho.rede_ensino_id=rede_destino_id),0),
    'deOutros',coalesce((select jsonb_agg(jsonb_build_object('caminho',rascunho.chave,'autor',perfil.nome_exibicao) order by rascunho.atualizado_em desc) from public.rascunhos_conteudo_institucional rascunho join public.perfis_usuarios perfil on perfil.id=rascunho.autor_id where rascunho.rede_ensino_id=rede_destino_id and rascunho.autor_id<>auth.uid()),'[]'::jsonb)
  ) end;
$$;

create or replace function public.salvar_rascunhos_curadoria(rede_destino_id uuid, alteracoes jsonb)
returns integer
language plpgsql
security definer
set search_path=public,app
as $$
declare alteracao record; quantidade integer;
begin
  if not app.usuario_cura_conteudo(rede_destino_id) then
    raise exception 'Sem permissao para editar o conteudo desta rede';
  end if;
  if jsonb_typeof(coalesce(alteracoes,'[]'::jsonb)) <> 'array' then
    raise exception 'Alteracoes invalidas';
  end if;

  for alteracao in
    select item->>'p' as chave, item->'valor' as valor, coalesce(item->>'rot','') as rotulo
    from jsonb_array_elements(alteracoes) item
  loop
    if coalesce(trim(alteracao.chave),'') = '' then
      raise exception 'Chave de conteudo invalida';
    end if;
    insert into public.rascunhos_conteudo_institucional(rede_ensino_id,chave,autor_id,valor,rotulo)
    values(rede_destino_id,alteracao.chave,auth.uid(),alteracao.valor,alteracao.rotulo)
    on conflict(rede_ensino_id,chave,autor_id) do update
      set valor=excluded.valor,rotulo=excluded.rotulo,atualizado_em=now();
  end loop;

  select count(*) into quantidade
  from public.rascunhos_conteudo_institucional
  where rede_ensino_id=rede_destino_id;
  return quantidade;
end;
$$;

create or replace function public.publicar_conteudo_institucional(rede_destino_id uuid, caminhos text[] default null)
returns jsonb
language plpgsql
security definer
set search_path=public,app
as $$
declare configuracao public.configuracoes_redes%rowtype; nova_publicacao uuid; proximo_numero integer; rascunho record;
begin
  if not app.usuario_cura_conteudo(rede_destino_id) then
    raise exception 'Sem permissao para publicar o conteudo desta rede';
  end if;

  select * into configuracao from public.configuracoes_redes where rede_ensino_id=rede_destino_id for update;
  if not found then raise exception 'Configuracao institucional nao encontrada'; end if;
  select coalesce(max(numero),0)+1 into proximo_numero from public.publicacoes_institucionais where rede_ensino_id=rede_destino_id;

  insert into public.publicacoes_institucionais(rede_ensino_id,numero,versao_formulario,publicada_por)
  select rede_destino_id,proximo_numero,versao_formulario,auth.uid()
  from public.publicacoes_institucionais where id=configuracao.publicacao_institucional_ativa_id
  returning id into nova_publicacao;

  insert into public.itens_publicacao_institucional(publicacao_institucional_id,chave,texto,valor)
  select nova_publicacao,chave,texto,valor
  from public.itens_publicacao_institucional
  where publicacao_institucional_id=configuracao.publicacao_institucional_ativa_id;

  for rascunho in
    select * from public.rascunhos_conteudo_institucional
    where rede_ensino_id=rede_destino_id
      and autor_id=auth.uid()
      and (caminhos is null or chave = any(caminhos))
  loop
    if rascunho.valor = 'null'::jsonb then
      delete from public.itens_publicacao_institucional where publicacao_institucional_id=nova_publicacao and chave=rascunho.chave;
    else
      insert into public.itens_publicacao_institucional(publicacao_institucional_id,chave,texto,valor)
      values(nova_publicacao,rascunho.chave,coalesce(rascunho.valor #>> '{}',''),rascunho.valor)
      on conflict(publicacao_institucional_id,chave) do update set texto=excluded.texto,valor=excluded.valor;
    end if;
  end loop;

  update public.configuracoes_redes set publicacao_institucional_ativa_id=nova_publicacao where rede_ensino_id=rede_destino_id;
  delete from public.rascunhos_conteudo_institucional
  where rede_ensino_id=rede_destino_id and autor_id=auth.uid() and (caminhos is null or chave=any(caminhos));

  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'conteudo_publicado','publicacao_institucional',nova_publicacao,'Publicacao institucional ' || proximo_numero);

  return public.obter_conteudo_institucional_publicado();
end;
$$;

grant execute on function public.obter_conteudo_institucional_publicado(), public.abrir_curadoria_conteudo(uuid), public.salvar_rascunhos_curadoria(uuid,jsonb), public.publicar_conteudo_institucional(uuid,text[]) to authenticated;

commit;
