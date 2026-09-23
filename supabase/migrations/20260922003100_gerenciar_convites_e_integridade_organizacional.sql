-- Ciclo de vida de acessos administrativos e validacao de escopo organizacional.
begin;

alter table public.provisionamentos_acesso
  add column if not exists nome_convidado text not null default '',
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists revogado_em timestamptz,
  add column if not exists revogado_por uuid references public.perfis_usuarios(id) on delete restrict,
  add column if not exists ultimo_reenvio_em timestamptz;

create index if not exists provisionamentos_acesso_rede_pendentes_idx
  on public.provisionamentos_acesso(rede_ensino_id, criado_em desc)
  where revogado_em is null;

create or replace function app.validar_escopo_organizacional()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare rede_da_regional uuid; rede_da_escola uuid; regional_da_escola uuid;
begin
  if tg_table_name = 'regionais_ensino' then
    return new;
  end if;

  if new.regional_ensino_id is not null then
    select rede_ensino_id into rede_da_regional
    from public.regionais_ensino where id = new.regional_ensino_id;
    if rede_da_regional is null or rede_da_regional <> new.rede_ensino_id then
      raise exception 'A regional informada nao pertence a rede de ensino';
    end if;
  end if;

  if new.escola_id is not null then
    select rede_ensino_id, regional_ensino_id into rede_da_escola, regional_da_escola
    from public.escolas where id = new.escola_id;
    if rede_da_escola is null or rede_da_escola <> new.rede_ensino_id then
      raise exception 'A escola informada nao pertence a rede de ensino';
    end if;
    if new.regional_ensino_id is not null and regional_da_escola <> new.regional_ensino_id then
      raise exception 'A escola informada nao pertence a regional informada';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app.validar_escola_regional()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare rede_da_regional uuid;
begin
  select rede_ensino_id into rede_da_regional from public.regionais_ensino where id = new.regional_ensino_id;
  if rede_da_regional is null or rede_da_regional <> new.rede_ensino_id then
    raise exception 'A regional da escola nao pertence a rede de ensino';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_escola_regional on public.escolas;
create trigger validar_escola_regional
before insert or update of rede_ensino_id, regional_ensino_id on public.escolas
for each row execute procedure app.validar_escola_regional();

drop trigger if exists validar_vinculo_organizacional on public.vinculos_usuarios;
create trigger validar_vinculo_organizacional
before insert or update of rede_ensino_id, regional_ensino_id, escola_id on public.vinculos_usuarios
for each row execute procedure app.validar_escopo_organizacional();

drop trigger if exists validar_provisionamento_organizacional on public.provisionamentos_acesso;
create trigger validar_provisionamento_organizacional
before insert or update of rede_ensino_id, regional_ensino_id, escola_id on public.provisionamentos_acesso
for each row execute procedure app.validar_escopo_organizacional();

create or replace function public.listar_provisionamentos_acesso(rede_destino_id uuid)
returns table(
  provisionamento_id uuid, nome_convidado text, email text, papel text,
  regional text, escola text, situacao text, criado_em timestamptz,
  utilizado_em timestamptz, ultimo_reenvio_em timestamptz
)
language sql stable security definer set search_path=public,app
as $$
  select p.id, p.nome_convidado, p.email, p.papel,
    coalesce(r.nome,''), coalesce(e.nome,''),
    case when p.revogado_em is not null then 'revogado'
         when p.utilizado_em is not null then 'utilizado'
         else 'pendente' end,
    p.criado_em, p.utilizado_em, p.ultimo_reenvio_em
  from public.provisionamentos_acesso p
  left join public.regionais_ensino r on r.id=p.regional_ensino_id
  left join public.escolas e on e.id=p.escola_id
  where p.rede_ensino_id=rede_destino_id
    and app.usuario_administra_acessos(rede_destino_id)
  order by p.revogado_em nulls first, p.utilizado_em nulls first, p.criado_em desc;
$$;

drop function if exists public.salvar_provisionamento_acesso(text,text,uuid,uuid,uuid);

create function public.salvar_provisionamento_acesso(
  email_destino text,
  papel_destino text,
  rede_destino_id uuid,
  regional_destino_id uuid default null,
  escola_destino_id uuid default null,
  nome_destino text default ''
)
returns uuid
language plpgsql security definer set search_path=public,app
as $$
declare id_provisionamento uuid;
begin
  if not app.usuario_administra_acessos(rede_destino_id) then
    raise exception 'Sem permissao para administrar acessos desta rede';
  end if;
  if lower(trim(email_destino)) !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' then
    raise exception 'E-mail invalido';
  end if;
  if papel_destino not in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos') then
    raise exception 'Papel invalido';
  end if;
  if escola_destino_id is not null then regional_destino_id := null; end if;

  insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,regional_ensino_id,escola_id,papel,revogado_em,revogado_por)
  values(lower(trim(email_destino)),trim(coalesce(nome_destino,'')),rede_destino_id,regional_destino_id,escola_destino_id,papel_destino,null,null)
  on conflict (email,papel,rede_ensino_id,(coalesce(regional_ensino_id,'00000000-0000-0000-0000-000000000000'::uuid)),(coalesce(escola_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  do update set nome_convidado=excluded.nome_convidado, revogado_em=null, revogado_por=null, atualizado_em=now()
  returning id into id_provisionamento;

  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'acesso_provisionado','provisionamento_acesso',id_provisionamento,'Acesso provisionado para ' || lower(trim(email_destino)));
  return id_provisionamento;
end;
$$;

create or replace function public.revogar_provisionamento_acesso(provisionamento_destino_id uuid, motivo text default '')
returns void
language plpgsql security definer set search_path=public,app
as $$
declare provisionamento public.provisionamentos_acesso%rowtype;
begin
  select * into provisionamento from public.provisionamentos_acesso where id=provisionamento_destino_id for update;
  if not found then raise exception 'Provisionamento nao encontrado'; end if;
  if not app.usuario_administra_acessos(provisionamento.rede_ensino_id) then raise exception 'Sem permissao para administrar acessos desta rede'; end if;
  update public.provisionamentos_acesso
     set revogado_em=coalesce(revogado_em,now()), revogado_por=auth.uid(), atualizado_em=now()
   where id=provisionamento.id;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(provisionamento.rede_ensino_id,auth.uid(),'provisionamento_revogado','provisionamento_acesso',provisionamento.id,coalesce(motivo,''));
end;
$$;

create or replace function public.registrar_reenvio_convite_acesso(provisionamento_destino_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,app
as $$
declare provisionamento public.provisionamentos_acesso%rowtype;
begin
  select * into provisionamento from public.provisionamentos_acesso where id=provisionamento_destino_id for update;
  if not found then raise exception 'Provisionamento nao encontrado'; end if;
  if not app.usuario_administra_acessos(provisionamento.rede_ensino_id) then raise exception 'Sem permissao para administrar acessos desta rede'; end if;
  if provisionamento.revogado_em is not null then raise exception 'O provisionamento esta revogado'; end if;
  update public.provisionamentos_acesso set ultimo_reenvio_em=now(), atualizado_em=now() where id=provisionamento.id;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(provisionamento.rede_ensino_id,auth.uid(),'convite_reenvio_solicitado','provisionamento_acesso',provisionamento.id,provisionamento.email);
  return jsonb_build_object('ok',true,'email',provisionamento.email,'entrega','pendente_de_integracao');
end;
$$;

create or replace function app.sincronizar_acesso_usuario(usuario_destino_id uuid)
returns void
language plpgsql security definer set search_path=public,auth
as $$
declare usuario auth.users%rowtype; provisionamento public.provisionamentos_acesso%rowtype; regional_destino uuid;
begin
  select * into usuario from auth.users where id=usuario_destino_id;
  if not found then return; end if;
  insert into public.perfis_usuarios(id,nome_exibicao,email)
  values(usuario.id,coalesce(usuario.raw_user_meta_data->>'full_name',usuario.raw_user_meta_data->>'display_name',''),lower(coalesce(usuario.email,'')))
  on conflict(id) do update set email=excluded.email,nome_exibicao=coalesce(nullif(excluded.nome_exibicao,''),public.perfis_usuarios.nome_exibicao),atualizado_em=now();
  for provisionamento in select * from public.provisionamentos_acesso where email=lower(coalesce(usuario.email,'')) and revogado_em is null loop
    regional_destino := case when provisionamento.escola_id is null then provisionamento.regional_ensino_id else null end;
    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(usuario.id,provisionamento.rede_ensino_id,regional_destino,provisionamento.escola_id,provisionamento.papel)
    on conflict do nothing;
    update public.provisionamentos_acesso set utilizado_em=coalesce(utilizado_em,now()), atualizado_em=now() where id=provisionamento.id;
  end loop;
end;
$$;

grant execute on function app.validar_escopo_organizacional(),app.validar_escola_regional() to authenticated;
grant execute on function public.listar_provisionamentos_acesso(uuid),public.salvar_provisionamento_acesso(text,text,uuid,uuid,uuid,text),public.revogar_provisionamento_acesso(uuid,text),public.registrar_reenvio_convite_acesso(uuid) to authenticated;

commit;
