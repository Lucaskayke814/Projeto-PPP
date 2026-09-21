-- Padronização dos nomes exibidos no Supabase. Preserva dados, chaves, RLS e histórico.

alter table public.networks rename to redes;
alter table public.regionals rename to superintendencias_regionais;
alter table public.schools rename to escolas;
alter table public.profiles rename to perfis_usuario;
alter table public.memberships rename to vinculos_usuario;
alter table public.content_releases rename to publicacoes_conteudo;
alter table public.network_settings rename to configuracoes_rede;
alter table public.catalogs rename to catalogos;
alter table public.catalog_options rename to opcoes_catalogo;
alter table public.ppps rename to projetos_politico_pedagogicos;
alter table public.ppp_versions rename to versoes_ppp;
alter table public.ppp_revisions rename to revisoes_ppp;
alter table public.ppp_progress rename to progresso_ppp;
alter table public.participants rename to participantes_ppp;
alter table public.files rename to arquivos_ppp;
alter table public.workflow_events rename to eventos_fluxo_ppp;
alter table public.audit_events rename to eventos_auditoria;

alter index public.schools_regional_idx rename to escolas_superintendencia_idx;
alter index public.memberships_active_scope_unique rename to vinculos_usuario_escopo_ativo_unico;
alter index public.catalog_options_catalog_idx rename to opcoes_catalogo_grupo_idx;
alter index public.ppp_versions_panel_idx rename to versoes_ppp_painel_idx;
alter index public.ppp_revisions_version_idx rename to revisoes_ppp_versao_idx;
alter index public.participants_direction_once rename to participantes_ppp_direcao_unica;
alter index public.participants_active_email rename to participantes_ppp_email_ativo_unico;
alter index public.files_version_kind_idx rename to arquivos_ppp_versao_tipo_idx;
alter index public.workflow_events_version_idx rename to eventos_fluxo_ppp_versao_idx;
alter index public.audit_events_network_idx rename to eventos_auditoria_rede_idx;

create or replace function app.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis_usuario (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), lower(coalesce(new.email, '')))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function app.can_access(target_network uuid, target_regional uuid default null, target_school uuid default null, editing boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculos_usuario v
    where v.user_id = auth.uid() and v.network_id = target_network and v.revoked_at is null
      and (
        (not editing and v.role in ('central_viewer', 'content_curator', 'access_admin'))
        or (not editing and v.role = 'regional_viewer' and (v.regional_id is null or v.regional_id = target_regional))
        or (v.role = 'school_editor' and (v.school_id = target_school or (v.school_id is null and v.regional_id = target_regional)))
      )
  );
$$;

create or replace function app.has_network_membership(target_network uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculos_usuario v
    where v.user_id = auth.uid() and v.network_id = target_network and v.revoked_at is null
  );
$$;

create or replace function app.validate_revision_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.versoes_ppp v join public.publicacoes_conteudo p on p.id = new.content_release_id
    where v.id = new.version_id and v.network_id = p.network_id
  ) then raise exception 'Revisão e conteúdo pertencem a redes diferentes' using errcode = '23514'; end if;
  return new;
end;
$$;

create or replace function app.validate_participant_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sealed_revision_id is not null and not exists (
    select 1 from public.revisoes_ppp r where r.id = new.sealed_revision_id and r.version_id = new.version_id
  ) then raise exception 'Assinatura deve referenciar a revisão selada da própria versão' using errcode = '23514'; end if;
  return new;
end;
$$;

create or replace function public.create_ppp_draft(target_school_id uuid, initial_answers jsonb default '{}'::jsonb)
returns table(version_id uuid, protocol text, revision_number bigint, progress_revision bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  current_user_id uuid := auth.uid();
  target_school public.escolas%rowtype;
  release_id uuid;
  new_ppp_id uuid;
  new_version_id uuid;
  new_revision_id uuid;
  new_protocol text;
begin
  if current_user_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(initial_answers) <> 'object' then raise exception 'initial_answers deve ser um objeto JSON' using errcode = '22023'; end if;
  select * into target_school from public.escolas where id = target_school_id and archived_at is null;
  if not found then raise exception 'Escola não encontrada' using errcode = 'P0002'; end if;
  if not app.can_access(target_school.network_id, target_school.regional_id, target_school.id, true) then raise exception 'Sem permissão para criar PPP desta escola' using errcode = '42501'; end if;
  select active_release_id into release_id from public.configuracoes_rede where network_id = target_school.network_id;
  if release_id is null then raise exception 'A rede ainda não publicou o conteúdo institucional ativo' using errcode = 'P0001'; end if;
  insert into public.projetos_politico_pedagogicos (network_id, school_id, created_by) values (target_school.network_id, target_school.id, current_user_id) returning id into new_ppp_id;
  new_protocol := app.next_ppp_protocol();
  insert into public.versoes_ppp (ppp_id, network_id, number, protocol, created_by) values (new_ppp_id, target_school.network_id, 1, new_protocol, current_user_id) returning id into new_version_id;
  insert into public.revisoes_ppp (version_id, number, content_release_id, answers, created_by) values (new_version_id, 1, release_id, initial_answers, current_user_id) returning id into new_revision_id;
  update public.versoes_ppp set current_revision_id = new_revision_id where id = new_version_id;
  insert into public.progresso_ppp (version_id, updated_by) values (new_version_id, current_user_id);
  insert into public.eventos_fluxo_ppp (version_id, type, actor_id) values (new_version_id, 'created', current_user_id);
  insert into public.eventos_auditoria (network_id, actor_id, action, entity_type, entity_id) values (target_school.network_id, current_user_id, 'ppp_draft_created', 'ppp_version', new_version_id);
  return query select new_version_id, new_protocol, 1::bigint, 0::bigint;
end;
$$;

create or replace function public.save_ppp_draft(target_version_id uuid, expected_revision bigint, next_answers jsonb, next_screen_key text, next_tasks jsonb default '{}'::jsonb)
returns table(revision_number bigint, progress_revision bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  current_user_id uuid := auth.uid();
  target_version public.versoes_ppp%rowtype;
  target_school public.escolas%rowtype;
  previous_revision public.revisoes_ppp%rowtype;
  next_revision_id uuid;
  next_revision_number bigint;
  next_progress_revision bigint;
begin
  if current_user_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(next_answers) <> 'object' or jsonb_typeof(next_tasks) <> 'object' then raise exception 'Respostas e tarefas devem ser objetos JSON' using errcode = '22023'; end if;
  if coalesce(length(trim(next_screen_key)), 0) = 0 then raise exception 'Tela atual é obrigatória' using errcode = '22023'; end if;
  select v.* into target_version from public.versoes_ppp v join public.projetos_politico_pedagogicos p on p.id = v.ppp_id where v.id = target_version_id for update of v;
  if not found then raise exception 'Versão de PPP não encontrada' using errcode = 'P0002'; end if;
  select e.* into target_school from public.projetos_politico_pedagogicos p join public.escolas e on e.id = p.school_id where p.id = target_version.ppp_id and e.archived_at is null;
  if not found then raise exception 'Escola da versão não está disponível' using errcode = 'P0002'; end if;
  if target_version.status <> 'draft' then raise exception 'Somente rascunhos podem ser alterados' using errcode = '55000'; end if;
  if not app.can_access(target_version.network_id, target_school.regional_id, target_school.id, true) then raise exception 'Sem permissão para alterar este PPP' using errcode = '42501'; end if;
  select * into previous_revision from public.revisoes_ppp where id = target_version.current_revision_id;
  if not found or previous_revision.number <> expected_revision then raise exception 'O rascunho foi alterado por outra sessão; recarregue antes de salvar' using errcode = '40001'; end if;
  next_revision_number := previous_revision.number + 1;
  insert into public.revisoes_ppp (version_id, number, content_release_id, answers, created_by) values (target_version.id, next_revision_number, previous_revision.content_release_id, next_answers, current_user_id) returning id into next_revision_id;
  update public.versoes_ppp set current_revision_id = next_revision_id where id = target_version.id;
  update public.progresso_ppp set screen_key = next_screen_key, tasks = next_tasks, revision = revision + 1, updated_by = current_user_id where version_id = target_version.id returning revision into next_progress_revision;
  insert into public.eventos_auditoria (network_id, actor_id, action, entity_type, entity_id, metadata) values (target_version.network_id, current_user_id, 'ppp_draft_saved', 'ppp_version', target_version.id, jsonb_build_object('revision', next_revision_number, 'screen_key', next_screen_key));
  return query select next_revision_number, next_progress_revision;
end;
$$;
