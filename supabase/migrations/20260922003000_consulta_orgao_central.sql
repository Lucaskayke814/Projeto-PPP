-- Consultas do painel do Órgão Central. Todos os filtros são dados; o escopo
-- continua derivado exclusivamente dos vínculos da sessão.
begin;

create or replace function app.usuario_consulta_rede(rede_destino_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.vinculos_usuarios v
    where v.usuario_id=auth.uid() and v.rede_ensino_id=rede_destino_id
      and v.revogado_em is null
      and v.papel in ('leitor_rede','curador_conteudo','administrador_acessos')
  );
$$;

create or replace function public.listar_ppps_orgao_central(
  filtros jsonb default '{}'::jsonb,
  tamanho_pagina integer default 20,
  deslocamento integer default 0
)
returns table(
  versao_ppp_id uuid, protocolo text, numero_versao integer, situacao text,
  nome_escola text, codigo_inep text, municipio text, nome_regional text,
  tela_atual text, atualizado_em timestamptz, total_registros bigint
)
language sql stable security definer set search_path=public,app
as $$
  with autorizadas as (
    select v.id,v.protocolo,v.numero,v.situacao,v.atualizado_em,p.id as documento_id,
      e.nome as nome_escola,e.codigo_inep,e.municipio,r.nome as nome_regional,pr.tela_atual
    from public.versoes_ppp v
    join public.ppps p on p.id=v.ppp_id and p.arquivado_em is null
    join public.escolas e on e.id=p.escola_id
    join public.regionais_ensino r on r.id=e.regional_ensino_id
    join public.progresso_ppp pr on pr.versao_ppp_id=v.id
    where app.usuario_consulta_rede(p.rede_ensino_id)
      and (coalesce(filtros->>'busca','')='' or concat_ws(' ',v.protocolo,e.nome,e.codigo_inep,e.municipio,r.nome) ilike '%' || trim(filtros->>'busca') || '%')
      and (coalesce(filtros->>'situacao','')='' or v.situacao=filtros->>'situacao')
      and (coalesce(filtros->>'regional','')='' or r.id::text=filtros->>'regional')
      and (coalesce(filtros->>'municipio','')='' or lower(e.municipio)=lower(filtros->>'municipio'))
  )
  select id,protocolo,numero,situacao,nome_escola,codigo_inep,municipio,nome_regional,tela_atual,atualizado_em,count(*) over()
  from autorizadas
  order by atualizado_em desc,protocolo desc
  limit least(greatest(coalesce(tamanho_pagina,20),1),100)
  offset greatest(coalesce(deslocamento,0),0);
$$;

create or replace function public.consultar_ppp_orgao_central(protocolo_busca text)
returns jsonb
language sql stable security definer set search_path=public,app
as $$
  select coalesce((
    select jsonb_build_object(
      'ok',true,'versaoPppId',v.id,'protocolo',v.protocolo,'numeroVersao',v.numero,
      'situacao',v.situacao,'criadoEm',v.criado_em,'atualizadoEm',v.atualizado_em,
      'escola',jsonb_build_object('nome',e.nome,'inep',e.codigo_inep,'municipio',e.municipio,'regional',r.nome),
      'progresso',jsonb_build_object('telaAtual',pr.tela_atual,'atualizadoEm',pr.atualizado_em),
      'respostas',coalesce((select respostas from public.obter_ppp_por_protocolo(v.protocolo) limit 1),'{}'::jsonb),
      'arquivos',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'tipo',a.tipo,'nome',a.nome_original,'mime',a.tipo_mime,'tamanho',a.tamanho_bytes,'criadoEm',a.criado_em) order by a.criado_em desc) from public.arquivos_ppp a where a.versao_ppp_id=v.id and a.removido_em is null),'[]'::jsonb),
      'eventos',coalesce((select jsonb_agg(jsonb_build_object('tipo',ev.tipo,'descricao',ev.descricao,'ocorridoEm',ev.ocorrido_em,'responsavel',coalesce(perfil.nome_exibicao,'')) order by ev.ocorrido_em desc) from public.eventos_ppp ev left join public.perfis_usuarios perfil on perfil.id=ev.responsavel_id where ev.versao_ppp_id=v.id),'[]'::jsonb)
    )
    from public.versoes_ppp v
    join public.ppps p on p.id=v.ppp_id
    join public.escolas e on e.id=p.escola_id
    join public.regionais_ensino r on r.id=e.regional_ensino_id
    join public.progresso_ppp pr on pr.versao_ppp_id=v.id
    where upper(v.protocolo)=upper(trim(protocolo_busca)) and app.usuario_consulta_rede(p.rede_ensino_id)
    limit 1
  ),jsonb_build_object('ok',false,'erro','PPP nao encontrado ou indisponivel'));
$$;

create or replace function public.registrar_exportacao_orgao_central(rede_destino_id uuid, tipo_exportacao text, filtros jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path=public,app
as $$
begin
  if not app.usuario_consulta_rede(rede_destino_id) then raise exception 'Sem permissao para exportar dados desta rede'; end if;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'exportacao_realizada','rede_ensino',rede_destino_id,coalesce(tipo_exportacao,'') || ' ' || coalesce(filtros::text,'{}'));
end;
$$;

grant execute on function app.usuario_consulta_rede(uuid) to authenticated;
grant execute on function public.listar_ppps_orgao_central(jsonb,integer,integer), public.consultar_ppp_orgao_central(text), public.registrar_exportacao_orgao_central(uuid,text,jsonb) to authenticated;
commit;
