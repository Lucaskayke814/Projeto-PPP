-- Consultas estáveis para o adaptador do HTML. O formulário continua flexível em JSONB.

create or replace function public.obter_contexto_usuario()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'nome', p.display_name,
    'vinculos', coalesce(jsonb_agg(jsonb_build_object(
      'papel', v.role,
      'redeId', v.network_id,
      'regionalId', v.regional_id,
      'regional', r.name,
      'escolaId', v.school_id,
      'revogadoEm', v.revoked_at
    ) order by v.created_at) filter (where v.id is not null), '[]'::jsonb)
  ) into result
  from public.perfis_usuario p
  left join public.vinculos_usuario v on v.user_id = p.id and v.revoked_at is null
  left join public.superintendencias_regionais r on r.id = v.regional_id
  where p.id = current_user_id
  group by p.id, p.email, p.display_name;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.obter_conteudo_institucional_ativo()
returns table(rede_id uuid, versao integer, conteudo jsonb)
language sql stable security invoker set search_path = public as $$
  select c.network_id, c.number, c.content
  from public.configuracoes_rede cfg
  join public.publicacoes_conteudo c on c.id = cfg.active_release_id
  order by c.published_at desc;
$$;

create or replace function public.obter_ppp_por_protocolo(protocolo_busca text)
returns table(
  versao_id uuid,
  protocolo text,
  numero_versao integer,
  situacao text,
  numero_revisao bigint,
  respostas jsonb,
  tela_atual text,
  tarefas jsonb,
  atualizado_em timestamptz
)
language sql stable security invoker set search_path = public as $$
  select v.id, v.protocol, v.number, v.status, r.number, r.answers, coalesce(p.screen_key, 't00'), coalesce(p.tasks, '{}'::jsonb), v.updated_at
  from public.versoes_ppp v
  join public.revisoes_ppp r on r.id = v.current_revision_id
  left join public.progresso_ppp p on p.version_id = v.id
  where upper(v.protocol) = upper(trim(protocolo_busca));
$$;

create or replace function public.listar_painel_ppp(filtros jsonb default '{}'::jsonb)
returns table(
  protocolo text,
  numero_versao integer,
  escola text,
  inep text,
  municipio text,
  regional text,
  situacao text,
  percentual_preenchimento integer,
  assinaturas_realizadas integer,
  assinaturas_previstas integer,
  ressalvas integer,
  ata_registrada boolean,
  revisao_vencida boolean,
  homologado_em timestamptz,
  atualizado_em timestamptz
)
language sql stable security invoker set search_path = public as $$
  with dados as (
    select
      v.id, v.protocol, v.number, v.status, v.review_due_on, v.updated_at,
      e.name as escola_nome, e.inep, e.municipality,
      sr.name as regional_nome,
      coalesce(pg.tasks, '{}'::jsonb) as tarefas
    from public.versoes_ppp v
    join public.projetos_politico_pedagogicos ppp on ppp.id = v.ppp_id
    join public.escolas e on e.id = ppp.school_id
    join public.superintendencias_regionais sr on sr.id = e.regional_id
    left join public.progresso_ppp pg on pg.version_id = v.id
    where (coalesce(filtros ->> 'regional', '') = '' or sr.name = filtros ->> 'regional')
      and (coalesce(filtros ->> 'situacao', '') = '' or v.status = filtros ->> 'situacao')
      and (not coalesce((filtros ->> 'somente_vencidos')::boolean, false) or (v.review_due_on is not null and v.review_due_on < current_date))
      and (
        coalesce(filtros ->> 'busca', '') = ''
        or concat_ws(' ', e.name, e.inep, e.municipality, v.protocol) ilike '%' || (filtros ->> 'busca') || '%'
      )
  )
  select
    d.protocol,
    d.number,
    d.escola_nome,
    d.inep,
    d.municipality,
    d.regional_nome,
    d.status,
    coalesce((select round(100.0 * count(*) filter (where value = 'true') / nullif(count(*), 0))::integer from jsonb_each_text(d.tarefas)), 0),
    (select count(*)::integer from public.participantes_ppp pp where pp.version_id = d.id and pp.signed_at is not null and pp.removed_at is null),
    (select count(*)::integer from public.participantes_ppp pp where pp.version_id = d.id and pp.removed_at is null),
    (select count(*)::integer from public.participantes_ppp pp where pp.version_id = d.id and pp.reservation is not null and pp.removed_at is null),
    exists (select 1 from public.arquivos_ppp a where a.version_id = d.id and a.kind = 'minutes' and a.withdrawn_at is null),
    d.review_due_on is not null and d.review_due_on < current_date,
    null::timestamptz,
    d.updated_at
  from dados d
  order by d.updated_at desc;
$$;

revoke all on function public.obter_contexto_usuario(), public.obter_conteudo_institucional_ativo(), public.obter_ppp_por_protocolo(text), public.listar_painel_ppp(jsonb) from public;
grant execute on function public.obter_contexto_usuario(), public.obter_conteudo_institucional_ativo(), public.obter_ppp_por_protocolo(text), public.listar_painel_ppp(jsonb) to authenticated;
