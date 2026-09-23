-- Fundação do Órgão Central: acessos múltiplos, contexto de papéis,
-- cobertura da rede e administração segura de vínculos.
begin;

alter table public.provisionamentos_acesso
  drop constraint if exists provisionamentos_acesso_email_key;

create unique index if not exists provisionamentos_acesso_ativos_unicos
  on public.provisionamentos_acesso(
    email,
    papel,
    rede_ensino_id,
    coalesce(regional_ensino_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(escola_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create or replace function app.usuario_administra_acessos(rede_destino_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.vinculos_usuarios vinculo
       where vinculo.usuario_id = auth.uid()
         and vinculo.rede_ensino_id = rede_destino_id
         and vinculo.papel = 'administrador_acessos'
         and vinculo.revogado_em is null
     );
$$;

create or replace function app.usuario_cura_conteudo(rede_destino_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.vinculos_usuarios vinculo
       where vinculo.usuario_id = auth.uid()
         and vinculo.rede_ensino_id = rede_destino_id
         and vinculo.papel in ('curador_conteudo','administrador_acessos')
         and vinculo.revogado_em is null
     );
$$;

create or replace function app.sincronizar_acesso_usuario(usuario_destino_id uuid)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  usuario auth.users%rowtype;
  provisionamento public.provisionamentos_acesso%rowtype;
  regional_destino uuid;
begin
  select * into usuario from auth.users where id = usuario_destino_id;
  if not found then return; end if;

  insert into public.perfis_usuarios(id,nome_exibicao,email)
  values(
    usuario.id,
    coalesce(usuario.raw_user_meta_data->>'full_name', usuario.raw_user_meta_data->>'display_name',''),
    lower(coalesce(usuario.email,''))
  )
  on conflict(id) do update
    set email = excluded.email,
        nome_exibicao = coalesce(nullif(excluded.nome_exibicao,''), public.perfis_usuarios.nome_exibicao);

  for provisionamento in
    select *
      from public.provisionamentos_acesso
     where email = lower(coalesce(usuario.email,''))
  loop
    regional_destino := case
      when provisionamento.escola_id is null then provisionamento.regional_ensino_id
      else null
    end;

    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(usuario.id, provisionamento.rede_ensino_id, regional_destino, provisionamento.escola_id, provisionamento.papel)
    on conflict do nothing;

    update public.provisionamentos_acesso
       set utilizado_em = coalesce(utilizado_em, now())
     where id = provisionamento.id;
  end loop;
end;
$$;

create or replace function public.obter_meus_acessos_institucionais()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'vinculoId', vinculo.id,
    'papel', vinculo.papel,
    'redeId', rede.id,
    'rede', rede.nome,
    'regionalId', regional.id,
    'regional', regional.nome,
    'escolaId', escola.id,
    'escola', escola.nome,
    'codigoInep', escola.codigo_inep,
    'codigoInepCenso', escola.codigo_inep_censo
  ) order by case when vinculo.escola_id is null then 0 else 1 end, vinculo.criado_em), '[]'::jsonb)
  from public.vinculos_usuarios vinculo
  join public.redes_ensino rede on rede.id = vinculo.rede_ensino_id and rede.ativo
  left join public.regionais_ensino regional on regional.id = vinculo.regional_ensino_id and regional.ativo
  left join public.escolas escola on escola.id = vinculo.escola_id and escola.ativo
  where vinculo.usuario_id = auth.uid()
    and vinculo.revogado_em is null;
$$;

create or replace function public.obter_cobertura_rede_ppps()
returns table(
  regional_ensino_id uuid,
  codigo_regional text,
  nome_regional text,
  escolas_ativas integer,
  escolas_com_ppp integer,
  ppps_em_andamento integer,
  ppps_em_validacao integer,
  ppps_em_assinatura integer,
  ppps_homologados integer
)
language sql
stable
security definer
set search_path=public,app
as $$
  with regionais_autorizadas as (
    select regional.id, regional.codigo, regional.nome, regional.rede_ensino_id
    from public.regionais_ensino regional
    where regional.ativo
      and exists (
        select 1 from public.vinculos_usuarios vinculo
        where vinculo.usuario_id = auth.uid()
          and vinculo.rede_ensino_id = regional.rede_ensino_id
          and vinculo.papel in ('leitor_rede','curador_conteudo','administrador_acessos')
          and vinculo.revogado_em is null
      )
  ), ultimas_versoes as (
    select distinct on (documento.id)
      documento.id as ppp_id, escola.regional_ensino_id, versao.situacao
    from public.ppps documento
    join public.escolas escola on escola.id = documento.escola_id and escola.ativo
    join public.versoes_ppp versao on versao.ppp_id = documento.id
    where documento.arquivado_em is null
    order by documento.id, versao.numero desc
  )
  select regional.id, regional.codigo, regional.nome,
    count(distinct escola.id)::integer,
    count(distinct versao.ppp_id)::integer,
    count(*) filter (where versao.situacao = 'rascunho')::integer,
    count(*) filter (where versao.situacao in ('em_validacao','validado'))::integer,
    count(*) filter (where versao.situacao in ('em_assinatura','assinado','concluido','enviado_homologacao'))::integer,
    count(*) filter (where versao.situacao = 'homologado')::integer
  from regionais_autorizadas regional
  left join public.escolas escola on escola.regional_ensino_id = regional.id and escola.ativo
  left join ultimas_versoes versao on versao.regional_ensino_id = regional.id
  group by regional.id, regional.codigo, regional.nome
  order by regional.nome;
$$;

create or replace function public.listar_vinculos_rede(rede_destino_id uuid)
returns table(
  vinculo_id uuid,
  nome text,
  email text,
  papel text,
  regional text,
  escola text,
  codigo_inep text,
  ativo boolean,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path=public,app
as $$
  select vinculo.id, perfil.nome_exibicao, perfil.email, vinculo.papel,
    coalesce(regional.nome,''), coalesce(escola.nome,''), coalesce(escola.codigo_inep,''),
    vinculo.revogado_em is null, vinculo.criado_em
  from public.vinculos_usuarios vinculo
  join public.perfis_usuarios perfil on perfil.id = vinculo.usuario_id
  left join public.regionais_ensino regional on regional.id = vinculo.regional_ensino_id
  left join public.escolas escola on escola.id = vinculo.escola_id
  where vinculo.rede_ensino_id = rede_destino_id
    and app.usuario_administra_acessos(rede_destino_id)
  order by perfil.nome_exibicao, perfil.email, vinculo.criado_em desc;
$$;

create or replace function public.salvar_provisionamento_acesso(
  email_destino text,
  papel_destino text,
  rede_destino_id uuid,
  regional_destino_id uuid default null,
  escola_destino_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public,app
as $$
declare id_provisionamento uuid;
begin
  if not app.usuario_administra_acessos(rede_destino_id) then
    raise exception 'Sem permissao para administrar acessos desta rede';
  end if;
  if lower(trim(email_destino)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail invalido';
  end if;
  if papel_destino not in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos') then
    raise exception 'Papel invalido';
  end if;
  if escola_destino_id is not null then regional_destino_id := null; end if;

  insert into public.provisionamentos_acesso(email,rede_ensino_id,regional_ensino_id,escola_id,papel)
  values(lower(trim(email_destino)), rede_destino_id, regional_destino_id, escola_destino_id, papel_destino)
  on conflict do nothing
  returning id into id_provisionamento;

  if id_provisionamento is null then
    select id into id_provisionamento
    from public.provisionamentos_acesso
    where email = lower(trim(email_destino))
      and papel = papel_destino
      and rede_ensino_id = rede_destino_id
      and regional_ensino_id is not distinct from regional_destino_id
      and escola_id is not distinct from escola_destino_id;
  end if;

  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'acesso_provisionado','provisionamento_acesso',id_provisionamento,'Acesso provisionado para ' || lower(trim(email_destino)));
  return id_provisionamento;
end;
$$;

create or replace function public.revogar_vinculo_rede(vinculo_destino_id uuid, motivo text default '')
returns void
language plpgsql
security definer
set search_path=public,app
as $$
declare vinculo public.vinculos_usuarios%rowtype;
begin
  select * into vinculo from public.vinculos_usuarios where id = vinculo_destino_id for update;
  if not found then raise exception 'Vinculo nao encontrado'; end if;
  if not app.usuario_administra_acessos(vinculo.rede_ensino_id) then
    raise exception 'Sem permissao para administrar acessos desta rede';
  end if;
  update public.vinculos_usuarios set revogado_em = coalesce(revogado_em,now()) where id = vinculo.id;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(vinculo.rede_ensino_id,auth.uid(),'acesso_revogado','vinculo_usuario',vinculo.id,coalesce(motivo,''));
end;
$$;

grant execute on function app.usuario_administra_acessos(uuid), app.usuario_cura_conteudo(uuid) to authenticated;
grant execute on function public.obter_meus_acessos_institucionais(), public.obter_cobertura_rede_ppps(), public.listar_vinculos_rede(uuid), public.salvar_provisionamento_acesso(text,text,uuid,uuid,uuid), public.revogar_vinculo_rede(uuid,text) to authenticated;

commit;
