begin;

create or replace function app.validar_limite_acessos_regionais(
  rede_destino_id uuid,
  regional_destino_id uuid,
  origem_ignorada text default null,
  id_ignorado uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quantidade integer;
begin
  if regional_destino_id is null then return; end if;

  select count(*) into quantidade
  from (
    select v.id
    from public.vinculos_usuarios v
    where v.rede_ensino_id = rede_destino_id
      and v.regional_ensino_id = regional_destino_id
      and v.escola_id is null
      and v.papel = 'leitor_regional'
      and v.revogado_em is null
      and not (coalesce(origem_ignorada, '') = 'vinculo' and v.id = id_ignorado)
    union all
    select p.id
    from public.provisionamentos_acesso p
    where p.rede_ensino_id = rede_destino_id
      and p.regional_ensino_id = regional_destino_id
      and p.escola_id is null
      and p.papel = 'leitor_regional'
      and p.revogado_em is null
      and not (coalesce(origem_ignorada, '') = 'provisionamento' and p.id = id_ignorado)
  ) acessos_ativos;

  if quantidade >= 2 then
    raise exception 'Esta SRE ja possui o limite de dois superintendentes ativos';
  end if;
end;
$$;

create or replace function app.validar_limite_acessos_regionais_linha()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if new.papel = 'leitor_regional' and new.revogado_em is null then
    perform app.validar_limite_acessos_regionais(
      new.rede_ensino_id,
      new.regional_ensino_id,
      case when tg_table_name = 'vinculos_usuarios' then 'vinculo' else 'provisionamento' end,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists limitar_superintendentes_vinculo on public.vinculos_usuarios;
create trigger limitar_superintendentes_vinculo
before insert or update of rede_ensino_id, regional_ensino_id, papel, revogado_em
on public.vinculos_usuarios
for each row execute procedure app.validar_limite_acessos_regionais_linha();

drop trigger if exists limitar_superintendentes_provisionamento on public.provisionamentos_acesso;
create trigger limitar_superintendentes_provisionamento
before insert or update of rede_ensino_id, regional_ensino_id, papel, revogado_em
on public.provisionamentos_acesso
for each row execute procedure app.validar_limite_acessos_regionais_linha();

create or replace function public.atualizar_acesso_institucional(
  origem_destino text,
  acesso_destino_id uuid,
  email_destino text,
  nome_destino text,
  situacao_destino text default 'ativo'
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth
as $$
declare
  provisionamento public.provisionamentos_acesso%rowtype;
  vinculo public.vinculos_usuarios%rowtype;
  novo_id uuid;
  usuario_existente_id uuid;
begin
  if origem_destino not in ('provisionamento', 'vinculo') then
    raise exception 'Origem de acesso invalida';
  end if;
  if lower(trim(email_destino)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail invalido';
  end if;
  if length(trim(nome_destino)) < 3 then
    raise exception 'Nome invalido';
  end if;
  if situacao_destino not in ('ativo', 'inativo') then
    raise exception 'Situacao invalida';
  end if;

  if origem_destino = 'provisionamento' then
    select * into provisionamento from public.provisionamentos_acesso where id = acesso_destino_id for update;
    if not found then raise exception 'Convite de acesso nao encontrado'; end if;
    if not app.usuario_administra_acessos(provisionamento.rede_ensino_id) then raise exception 'Sem permissao para administrar acessos desta rede'; end if;
    if situacao_destino = 'ativo' and provisionamento.papel = 'leitor_regional' then
      perform app.validar_limite_acessos_regionais(provisionamento.rede_ensino_id, provisionamento.regional_ensino_id, 'provisionamento', provisionamento.id);
    end if;
    update public.provisionamentos_acesso
    set email = lower(trim(email_destino)), nome_convidado = trim(nome_destino),
        revogado_em = case when situacao_destino = 'ativo' then null else coalesce(revogado_em, now()) end,
        revogado_por = case when situacao_destino = 'ativo' then null else coalesce(revogado_por, auth.uid()) end,
        atualizado_em = now()
    where id = provisionamento.id
    returning id into novo_id;
  else
    select * into vinculo from public.vinculos_usuarios where id = acesso_destino_id for update;
    if not found then raise exception 'Vinculo de acesso nao encontrado'; end if;
    if not app.usuario_administra_acessos(vinculo.rede_ensino_id) then raise exception 'Sem permissao para administrar acessos desta rede'; end if;
    if lower(trim(email_destino)) = (select email from public.perfis_usuarios where id = vinculo.usuario_id) then
      if situacao_destino = 'ativo' and vinculo.papel = 'leitor_regional' then
        perform app.validar_limite_acessos_regionais(vinculo.rede_ensino_id, vinculo.regional_ensino_id, 'vinculo', vinculo.id);
      end if;
      update public.perfis_usuarios set nome_exibicao = trim(nome_destino), atualizado_em = now() where id = vinculo.usuario_id;
      update public.vinculos_usuarios set revogado_em = case when situacao_destino = 'ativo' then null else coalesce(revogado_em, now()) end where id = vinculo.id returning id into novo_id;
    else
      update public.vinculos_usuarios set revogado_em = coalesce(revogado_em, now()) where id = vinculo.id;
      if situacao_destino = 'ativo' and vinculo.papel = 'leitor_regional' then
        perform app.validar_limite_acessos_regionais(vinculo.rede_ensino_id, vinculo.regional_ensino_id, 'vinculo', vinculo.id);
      end if;
      insert into public.provisionamentos_acesso(email, nome_convidado, rede_ensino_id, regional_ensino_id, escola_id, papel, revogado_em, revogado_por)
      values (lower(trim(email_destino)), trim(nome_destino), vinculo.rede_ensino_id, vinculo.regional_ensino_id, vinculo.escola_id, vinculo.papel,
        case when situacao_destino = 'ativo' then null else now() end,
        case when situacao_destino = 'ativo' then null else auth.uid() end)
      on conflict (email, papel, rede_ensino_id, (coalesce(regional_ensino_id, '00000000-0000-0000-0000-000000000000'::uuid)), (coalesce(escola_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      do update set nome_convidado = excluded.nome_convidado, revogado_em = excluded.revogado_em, revogado_por = excluded.revogado_por, atualizado_em = now()
      returning id into novo_id;
      select id into usuario_existente_id from auth.users where lower(email) = lower(trim(email_destino));
      if usuario_existente_id is not null and situacao_destino = 'ativo' then perform app.sincronizar_acesso_usuario(usuario_existente_id); end if;
    end if;
  end if;

  insert into public.eventos_auditoria(rede_ensino_id, responsavel_id, acao, entidade, entidade_id, descricao)
  values (
    coalesce(provisionamento.rede_ensino_id, vinculo.rede_ensino_id), auth.uid(), 'acesso_atualizado', origem_destino, novo_id,
    'Acesso atualizado para ' || lower(trim(email_destino))
  );
  return novo_id;
end;
$$;

create or replace function public.listar_historico_acessos_institucionais(
  rede_destino_id uuid,
  regional_destino_id uuid default null,
  incluir_central boolean default false
)
returns table(nome text, email text, papel text, inicio text, fim text, vigente boolean, registrado_por text, encerrado_por text, motivo text)
language sql
stable
security definer
set search_path = public, app
as $$
  select coalesce(perfil.nome_exibicao, ''), perfil.email, v.papel,
         to_char(v.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
         case when v.revogado_em is null then '' else to_char(v.revogado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') end,
         v.revogado_em is null, '', '', ''
  from public.vinculos_usuarios v
  join public.perfis_usuarios perfil on perfil.id = v.usuario_id
  where v.rede_ensino_id = rede_destino_id
    and app.usuario_administra_acessos(rede_destino_id)
    and ((incluir_central and v.regional_ensino_id is null and v.escola_id is null) or (not incluir_central and v.regional_ensino_id = regional_destino_id))
  union all
  select p.nome_convidado, p.email, p.papel,
         to_char(p.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
         case when p.revogado_em is null then '' else to_char(p.revogado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') end,
         p.revogado_em is null, '', '', ''
  from public.provisionamentos_acesso p
  where p.rede_ensino_id = rede_destino_id
    and app.usuario_administra_acessos(rede_destino_id)
    and ((incluir_central and p.regional_ensino_id is null and p.escola_id is null) or (not incluir_central and p.regional_ensino_id = regional_destino_id))
  order by 4 desc, 1;
$$;

grant execute on function public.atualizar_acesso_institucional(text, uuid, text, text, text), public.listar_historico_acessos_institucionais(uuid, uuid, boolean) to authenticated;

commit;
