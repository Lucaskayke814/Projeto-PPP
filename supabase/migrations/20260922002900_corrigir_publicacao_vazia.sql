-- Publicações vazias são válidas no início da implantação. A leitura deve
-- retornar itens vazios, e não falhar por uma chave nula da junção externa.
create or replace function public.obter_conteudo_institucional_publicado()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with rede_autorizada as (
    select vinculo.rede_ensino_id
    from public.vinculos_usuarios vinculo
    where vinculo.usuario_id = auth.uid()
      and vinculo.revogado_em is null
    order by vinculo.criado_em
    limit 1
  ), publicacao_ativa as (
    select publicacao.id, publicacao.numero
    from rede_autorizada rede
    join public.configuracoes_redes configuracao on configuracao.rede_ensino_id = rede.rede_ensino_id
    join public.publicacoes_institucionais publicacao on publicacao.id = configuracao.publicacao_institucional_ativa_id
  )
  select coalesce((
    select jsonb_build_object(
      'ok', true,
      'versao', publicacao.numero,
      'itens', coalesce(jsonb_object_agg(item.chave,item.valor) filter (where item.chave is not null), '{}'::jsonb),
      'padroes', '{}'::jsonb
    )
    from publicacao_ativa publicacao
    left join public.itens_publicacao_institucional item on item.publicacao_institucional_id = publicacao.id
    group by publicacao.id, publicacao.numero
  ), jsonb_build_object('ok',true,'versao',0,'itens','{}'::jsonb,'padroes','{}'::jsonb));
$$;
