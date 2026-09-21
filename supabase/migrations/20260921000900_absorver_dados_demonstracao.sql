-- Move a demonstração para o mesmo modelo relacional usado pelo sistema.
do $$
declare
  rede_id uuid;
  publicacao_id uuid;
  formulario jsonb;
  acessos jsonb;
  registro jsonb;
  regional_id uuid;
  escola_id uuid;
  ppp_id uuid;
  versao_id uuid;
  revisao_id uuid;
  total_assinaturas integer;
  assinadas integer;
  i integer;
begin
  select conteudo into formulario from public.dados_demonstracao where chave = 'formulario_exemplo';
  select conteudo into acessos from public.dados_demonstracao where chave = 'acessos_exemplo';

  insert into public.redes (code, name) values ('demonstracao', 'Rede de Demonstração') returning id into rede_id;
  insert into public.superintendencias_regionais (network_id, code, name) values
    (rede_id, 'divinopolis', 'Divinópolis'), (rede_id, 'metropolitana_a', 'Metropolitana A'),
    (rede_id, 'uberlandia', 'Uberlândia'), (rede_id, 'montes_claros', 'Montes Claros');
  insert into public.publicacoes_conteudo (network_id, number, content, checksum)
  values (rede_id, 1, jsonb_build_object('demonstracao', formulario), repeat('0', 64)) returning id into publicacao_id;
  insert into public.configuracoes_rede (network_id, active_release_id, settings)
  values (rede_id, publicacao_id, jsonb_build_object('acessos_demonstracao', acessos));

  for registro in select value from jsonb_array_elements((select conteudo from public.dados_demonstracao where chave = 'registros_painel')) loop
    select id into regional_id from public.superintendencias_regionais where network_id = rede_id and name = registro ->> 'sre';
    insert into public.escolas (network_id, regional_id, inep, name, municipality, data)
    values (rede_id, regional_id, registro ->> 'inep', registro ->> 'escola', registro ->> 'municipio', jsonb_build_object('demonstracao', true))
    returning id into escola_id;
    insert into public.projetos_politico_pedagogicos (network_id, school_id) values (rede_id, escola_id) returning id into ppp_id;
    insert into public.versoes_ppp (ppp_id, network_id, number, protocol, status, review_due_on)
    values (ppp_id, rede_id, coalesce((registro ->> 'versao')::integer, 1), registro ->> 'protocolo',
      case registro ->> 'status' when 'Em assinatura' then 'signature_collection' when 'Assinado' then 'signed' when 'Concluído' then 'completed' when 'Enviado para homologação' then 'sent_for_homologation' else 'draft' end,
      case when coalesce((registro ->> 'revisaoVencida')::boolean, false) then current_date - 1 else null end)
    returning id into versao_id;
    insert into public.revisoes_ppp (version_id, number, content_release_id, answers)
    values (versao_id, 1, publicacao_id, jsonb_build_object('legacy_contract','v6.5','demonstracao',registro,'legacy_payload',jsonb_build_object('escola',registro ->> 'escola','inep',registro ->> 'inep','municipio',registro ->> 'municipio','sre',registro ->> 'sre')))
    returning id into revisao_id;
    update public.versoes_ppp set current_revision_id = revisao_id where id = versao_id;
    insert into public.progresso_ppp (version_id, tasks) values (versao_id, jsonb_build_object('demonstracao_concluida', (registro ->> 'pct')::integer = 100));
    total_assinaturas := coalesce((registro ->> 'totalAssin')::integer, 0); assinadas := coalesce((registro ->> 'assinadas')::integer, 0);
    for i in 1..total_assinaturas loop
      insert into public.participantes_ppp (version_id, role, name, signed_at, sealed_revision_id, reservation)
      values (versao_id, case when i = 1 then 'direction' else 'board_member' end, 'Participante de demonstração ' || i,
              case when i <= assinadas then now() else null end, case when i <= assinadas then revisao_id else null end,
              case when i <= coalesce((registro ->> 'ressalvas')::integer, 0) then 'Ressalva de demonstração' else null end);
    end loop;
    if coalesce((registro ->> 'ata')::boolean, false) then
      insert into public.arquivos_ppp (version_id, kind, object_key, original_name, mime_type, size_bytes, sha256, metadata)
      values (versao_id, 'minutes', 'demonstracao/' || (registro ->> 'protocolo') || '/ata.txt', 'ata-demonstracao.txt', 'text/plain', 1, repeat('0',64), jsonb_build_object('demonstracao',true));
    end if;
  end loop;
end $$;

drop table public.dados_demonstracao;
