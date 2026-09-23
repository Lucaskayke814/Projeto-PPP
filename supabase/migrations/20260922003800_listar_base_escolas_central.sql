-- Leitura paginada da base escolar para administracao central.
begin;
create or replace function public.listar_escolas_rede(rede_destino_id uuid, tamanho_pagina integer default 1000, deslocamento integer default 0)
returns table(escola_id uuid,codigo_inep text,codigo_inep_censo text,nome_escola text,municipio text,nome_regional text,ativa boolean,total_registros bigint)
language sql stable security definer set search_path=public,app
as $$
  select e.id,e.codigo_inep,coalesce(e.codigo_inep_censo,''),e.nome,e.municipio,r.nome,e.ativo,count(*) over()
  from public.escolas e join public.regionais_ensino r on r.id=e.regional_ensino_id
  where e.rede_ensino_id=rede_destino_id and app.usuario_administra_acessos(rede_destino_id)
  order by r.nome,e.nome
  limit least(greatest(coalesce(tamanho_pagina,1000),1),2000) offset greatest(coalesce(deslocamento,0),0);
$$;
grant execute on function public.listar_escolas_rede(uuid,integer,integer) to authenticated;
commit;
