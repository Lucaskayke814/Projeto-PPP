-- O cliente não recebe acesso direto às tabelas organizacionais. Esta RPC
-- retorna somente o contexto mínimo da própria sessão autenticada.
create or replace function public.obter_contexto_institucional()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select jsonb_build_object(
      'email', p.email,
      'nome', p.nome_exibicao,
      'papel', v.papel,
      'escolaId', e.id,
      'escola', e.nome,
      'codigoInep', e.codigo_inep,
      'codigoInepCenso', e.codigo_inep_censo,
      'regional', r.nome
    )
    from public.perfis_usuarios p
    join public.vinculos_usuarios v
      on v.usuario_id = p.id
     and v.revogado_em is null
     and v.papel = 'editor_escola'
     and v.escola_id is not null
    join public.escolas e on e.id = v.escola_id and e.ativo
    join public.regionais_ensino r on r.id = e.regional_ensino_id and r.ativo
    where p.id = auth.uid()
    order by v.criado_em
    limit 1
  ), '{}'::jsonb);
$$;

grant execute on function public.obter_contexto_institucional() to authenticated;
