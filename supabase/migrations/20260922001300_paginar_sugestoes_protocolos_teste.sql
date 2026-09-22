drop function if exists public.listar_protocolos_para_teste(text);
create function public.listar_protocolos_para_teste(termo_busca text default '', pagina integer default 1)
returns table(protocolo text, nome_escola text, situacao text, atualizado_em timestamptz)
language sql security definer set search_path=public,app as $$
  select v.protocolo,e.nome,v.situacao,v.atualizado_em from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id
  where auth.uid() is not null and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id)
  and regexp_replace(upper(v.protocolo),'[^A-Z0-9]','','g') like regexp_replace(upper(coalesce(termo_busca,'')),'[^A-Z0-9]','','g')||'%'
  order by v.atualizado_em desc limit 10 offset (greatest(pagina,1)-1)*10;
$$;
grant execute on function public.listar_protocolos_para_teste(text,integer) to authenticated;
