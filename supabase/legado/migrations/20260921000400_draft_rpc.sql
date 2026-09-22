-- Escrita inicial do contrato legado: cria e salva rascunhos com revisão imutável.
-- As demais transições (assinatura, anexos e homologação) entram em migrations próprias.

create sequence public.ppp_protocol_sequence;

create or replace function app.next_ppp_protocol()
returns text language sql volatile set search_path = public as $$
  select 'PPP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.ppp_protocol_sequence')::text, 8, '0');
$$;

create or replace function public.create_ppp_draft(
  target_school_id uuid,
  initial_answers jsonb default '{}'::jsonb
)
returns table(version_id uuid, protocol text, revision_number bigint, progress_revision bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  current_user_id uuid := auth.uid();
  target_school public.schools%rowtype;
  release_id uuid;
  new_ppp_id uuid;
  new_version_id uuid;
  new_revision_id uuid;
  new_protocol text;
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória' using errcode = '28000';
  end if;
  if jsonb_typeof(initial_answers) <> 'object' then
    raise exception 'initial_answers deve ser um objeto JSON' using errcode = '22023';
  end if;

  select * into target_school from public.schools where id = target_school_id and archived_at is null;
  if not found then raise exception 'Escola não encontrada' using errcode = 'P0002'; end if;
  if not app.can_access(target_school.network_id, target_school.regional_id, target_school.id, true) then
    raise exception 'Sem permissão para criar PPP desta escola' using errcode = '42501';
  end if;
  select active_release_id into release_id from public.network_settings where network_id = target_school.network_id;
  if release_id is null then
    raise exception 'A rede ainda não publicou o conteúdo institucional ativo' using errcode = 'P0001';
  end if;

  insert into public.ppps (network_id, school_id, created_by)
  values (target_school.network_id, target_school.id, current_user_id)
  returning id into new_ppp_id;
  new_protocol := app.next_ppp_protocol();
  insert into public.ppp_versions (ppp_id, network_id, number, protocol, created_by)
  values (new_ppp_id, target_school.network_id, 1, new_protocol, current_user_id)
  returning id into new_version_id;
  insert into public.ppp_revisions (version_id, number, content_release_id, answers, created_by)
  values (new_version_id, 1, release_id, initial_answers, current_user_id)
  returning id into new_revision_id;
  update public.ppp_versions set current_revision_id = new_revision_id where id = new_version_id;
  insert into public.ppp_progress (version_id, updated_by) values (new_version_id, current_user_id);
  insert into public.workflow_events (version_id, type, actor_id) values (new_version_id, 'created', current_user_id);
  insert into public.audit_events (network_id, actor_id, action, entity_type, entity_id)
  values (target_school.network_id, current_user_id, 'ppp_draft_created', 'ppp_version', new_version_id);

  return query select new_version_id, new_protocol, 1::bigint, 0::bigint;
end;
$$;

create or replace function public.save_ppp_draft(
  target_version_id uuid,
  expected_revision bigint,
  next_answers jsonb,
  next_screen_key text,
  next_tasks jsonb default '{}'::jsonb
)
returns table(revision_number bigint, progress_revision bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  current_user_id uuid := auth.uid();
  target_version public.ppp_versions%rowtype;
  target_school public.schools%rowtype;
  previous_revision public.ppp_revisions%rowtype;
  next_revision_id uuid;
  next_revision_number bigint;
  next_progress_revision bigint;
begin
  if current_user_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(next_answers) <> 'object' or jsonb_typeof(next_tasks) <> 'object' then
    raise exception 'Respostas e tarefas devem ser objetos JSON' using errcode = '22023';
  end if;
  if coalesce(length(trim(next_screen_key)), 0) = 0 then raise exception 'Tela atual é obrigatória' using errcode = '22023'; end if;

  select v.* into target_version
  from public.ppp_versions v
  join public.ppps p on p.id = v.ppp_id
  where v.id = target_version_id
  for update of v;
  if not found then raise exception 'Versão de PPP não encontrada' using errcode = 'P0002'; end if;
  select s.* into target_school
  from public.ppps p join public.schools s on s.id = p.school_id
  where p.id = target_version.ppp_id and s.archived_at is null;
  if not found then raise exception 'Escola da versão não está disponível' using errcode = 'P0002'; end if;
  if target_version.status <> 'draft' then raise exception 'Somente rascunhos podem ser alterados' using errcode = '55000'; end if;
  if not app.can_access(target_version.network_id, target_school.regional_id, target_school.id, true) then
    raise exception 'Sem permissão para alterar este PPP' using errcode = '42501';
  end if;
  select * into previous_revision from public.ppp_revisions where id = target_version.current_revision_id;
  if not found or previous_revision.number <> expected_revision then
    raise exception 'O rascunho foi alterado por outra sessão; recarregue antes de salvar' using errcode = '40001';
  end if;

  next_revision_number := previous_revision.number + 1;
  insert into public.ppp_revisions (version_id, number, content_release_id, answers, created_by)
  values (target_version.id, next_revision_number, previous_revision.content_release_id, next_answers, current_user_id)
  returning id into next_revision_id;
  update public.ppp_versions set current_revision_id = next_revision_id where id = target_version.id;
  update public.ppp_progress
    set screen_key = next_screen_key, tasks = next_tasks, revision = revision + 1, updated_by = current_user_id
    where version_id = target_version.id
    returning revision into next_progress_revision;
  insert into public.audit_events (network_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_version.network_id, current_user_id, 'ppp_draft_saved', 'ppp_version', target_version.id,
          jsonb_build_object('revision', next_revision_number, 'screen_key', next_screen_key));

  return query select next_revision_number, next_progress_revision;
end;
$$;

revoke all on function public.create_ppp_draft(uuid, jsonb), public.save_ppp_draft(uuid, bigint, jsonb, text, jsonb) from public;
grant execute on function public.create_ppp_draft(uuid, jsonb), public.save_ppp_draft(uuid, bigint, jsonb, text, jsonb) to authenticated;
