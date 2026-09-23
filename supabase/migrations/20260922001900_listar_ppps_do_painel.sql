-- Lista paginada para os painéis. O escopo vem de app.pode_acessar; o cliente
-- nunca informa escola, regional ou rede como critério de autorização.
create or replace function public.listar_ppps_do_painel(
  termo_busca text default '',
  tamanho_pagina integer default 20,
  deslocamento integer default 0
)
returns table(
  versao_ppp_id uuid,
  protocolo text,
  numero_versao integer,
  situacao text,
  nome_escola text,
  codigo_inep text,
  percentual_preenchimento integer,
  tarefas_concluidas integer,
  tarefas_total integer,
  atualizado_em timestamptz
)
language sql
security definer
set search_path=public,app
as $$
  with versoes_autorizadas as (
    select v.id,v.protocolo,v.numero,v.situacao,e.nome as nome_escola,e.codigo_inep,v.atualizado_em
    from public.versoes_ppp v
    join public.ppps p on p.id=v.ppp_id and p.arquivado_em is null
    join public.escolas e on e.id=p.escola_id
    where auth.uid() is not null
      and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id)
      and regexp_replace(upper(v.protocolo),'[^A-Z0-9]','','g') like
          regexp_replace(upper(coalesce(termo_busca,'')),'[^A-Z0-9]','','g') || '%'
  ), tarefas as (
    select t.versao_ppp_id,count(*)::integer as total,count(*) filter(where t.concluida)::integer as concluidas
    from public.tarefas_progresso_ppp t
    group by t.versao_ppp_id
  )
  select v.id,v.protocolo,v.numero,v.situacao,v.nome_escola,v.codigo_inep,
    case when coalesce(t.total,0)=0 then 0 else round((100.0*t.concluidas)/t.total)::integer end,
    coalesce(t.concluidas,0),coalesce(t.total,0),v.atualizado_em
  from versoes_autorizadas v
  left join tarefas t on t.versao_ppp_id=v.id
  order by v.atualizado_em desc,v.protocolo desc
  limit least(greatest(coalesce(tamanho_pagina,20),1),100)
  offset greatest(coalesce(deslocamento,0),0);
$$;

grant execute on function public.listar_ppps_do_painel(text,integer,integer) to authenticated;
