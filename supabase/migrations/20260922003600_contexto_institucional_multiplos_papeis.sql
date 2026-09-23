-- Retorna um contexto seguro para escola, regional ou Orgao Central sem expor tabelas organizacionais ao navegador.
begin;

create or replace function public.obter_contexto_institucional()
returns jsonb
language sql stable security definer set search_path=public
as $$
  with vinculos as (
    select v.id,v.papel,v.rede_ensino_id,v.regional_ensino_id,v.escola_id,v.criado_em,
      p.email,p.nome_exibicao,rede.nome as rede,regional.nome as regional,
      escola.nome as escola,escola.codigo_inep,escola.codigo_inep_censo
    from public.perfis_usuarios p
    join public.vinculos_usuarios v on v.usuario_id=p.id and v.revogado_em is null
    join public.redes_ensino rede on rede.id=v.rede_ensino_id and rede.ativo
    left join public.regionais_ensino regional on regional.id=v.regional_ensino_id and regional.ativo
    left join public.escolas escola on escola.id=v.escola_id and escola.ativo
    where p.id=auth.uid() and p.ativo
  ), preferido as (
    select * from vinculos
    order by case
      when papel='administrador_acessos' then 1
      when papel='curador_conteudo' then 2
      when papel='leitor_rede' then 3
      when papel='leitor_regional' then 4
      when papel='editor_escola' then 5
      else 99 end, criado_em
    limit 1
  )
  select coalesce((
    select jsonb_build_object(
      'email',email,'nome',nome_exibicao,'vinculoId',id,'papelBanco',papel,
      'perfil',case when papel in ('leitor_rede','curador_conteudo','administrador_acessos') then 'central'
                    when papel='leitor_regional' then 'regional' else 'escola' end,
      'papel',case when papel in ('leitor_rede','curador_conteudo','administrador_acessos') then 'central'
                   when papel='leitor_regional' then 'superintendente' else 'diretor_escolar' end,
      'papelNome',case papel when 'administrador_acessos' then 'Administrador de acessos'
                              when 'curador_conteudo' then 'Curador de conteudo'
                              when 'leitor_rede' then 'Orgao Central'
                              when 'leitor_regional' then 'Superintendencia Regional de Ensino'
                              else 'Direcao Escolar' end,
      'redeId',rede_ensino_id,'rede',rede,'regionalId',regional_ensino_id,'regional',coalesce(regional,''),
      'escolaId',escola_id,'escola',coalesce(escola,''),'codigoInep',coalesce(codigo_inep,''),'codigoInepCenso',coalesce(codigo_inep_censo,''),
      'podeConsultarRede',papel in ('leitor_rede','curador_conteudo','administrador_acessos'),
      'podeAdministrarAcessos',papel='administrador_acessos',
      'podeEditarConteudo',papel in ('curador_conteudo','administrador_acessos')
    ) from preferido
  ),'{}'::jsonb);
$$;

grant execute on function public.obter_contexto_institucional() to authenticated;

commit;
