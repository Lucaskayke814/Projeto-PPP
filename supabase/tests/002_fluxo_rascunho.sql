-- Bateria de integração do fluxo inicial do PPP.
-- Execute contra desenvolvimento: cada cenário remove seus dados temporários ao final.

do $$
declare
  usuario_teste_id uuid;
  escola_teste_id uuid;
  ppp_teste_id uuid;
  versao_teste_id uuid;
  protocolo_teste text;
  revisao_atual bigint;
  retomada record;
  quantidade integer;
begin
  select vinculo.usuario_id, vinculo.escola_id
    into usuario_teste_id, escola_teste_id
  from public.vinculos_usuarios vinculo
  join public.perfis_usuarios perfil on perfil.id = vinculo.usuario_id and perfil.ativo
  join public.escolas escola on escola.id = vinculo.escola_id and escola.ativo
  where vinculo.papel = 'editor_escola'
    and vinculo.revogado_em is null
  order by vinculo.criado_em
  limit 1;

  if usuario_teste_id is null or escola_teste_id is null then
    raise exception 'A bateria requer um usuario editor_escola e uma escola ativa.';
  end if;
  perform set_config('request.jwt.claim.sub', usuario_teste_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Cenário 1: cria PPP e preenche automaticamente a identificação institucional.
  select criado.versao_ppp_id, criado.protocolo, criado.numero_revisao
    into versao_teste_id, protocolo_teste, revisao_atual
  from public.criar_rascunho_ppp(escola_teste_id, '{}'::jsonb) criado;
  select ppp_id into ppp_teste_id from public.versoes_ppp where id = versao_teste_id;

  if not exists (
    select 1 from public.identificacoes_ppp identificacao
    join public.revisoes_ppp revisao on revisao.id = identificacao.revisao_ppp_id
    where revisao.versao_ppp_id = versao_teste_id
      and identificacao.nome_escola <> ''
      and identificacao.codigo_inep <> ''
  ) then
    raise exception 'A criação não preencheu a identificação institucional.';
  end if;

  -- Cenário 2: salva campos, marcações, textos, indicadores e detalhes estruturados.
  select salvo.numero_revisao into revisao_atual
  from public.salvar_rascunho_ppp(
    versao_teste_id,
    revisao_atual,
    jsonb_build_object(
      'escola', 'Escola de teste automatizado',
      'inep', '12345678',
      'municipio', 'Municipio de teste',
      'sre', 'Regional de teste',
      'direcao', 'Direcao de teste',
      'especialista', 'Especialista de teste',
      'tDiagnostico', 'Texto de diagnóstico salvo pela bateria.',
      'selecoes', jsonb_build_object('etapas', jsonb_build_array('ei'), 'mods', jsonb_build_array('parcial'))::text,
      'indicadores', jsonb_build_object('ano', '2026', 'idebAI', '5.1', 'etapas', jsonb_build_object('ei', jsonb_build_object('mat', '30')))::text,
      'detalhes', jsonb_build_object('diagnostico', jsonb_build_object('prioridade', 'Aprendizagem'))::text
    ),
    't10',
    jsonb_build_object('t00_0', true, 't04_0', true)
  ) salvo;
  if revisao_atual <> 2 then raise exception 'A revisão esperada após salvar era 2, foi %.', revisao_atual; end if;

  -- Cenário 3: registra o ponto da navegação sem criar outra revisão.
  perform public.atualizar_tela_atual_ppp(versao_teste_id, 't12');
  if (select numero_revisao from public.progresso_ppp where versao_ppp_id = versao_teste_id) <> 1 then
    raise exception 'Atualizar a tela não pode criar uma revisão de formulário.';
  end if;

  -- Cenário 4: retoma todas as respostas e a última tela gravada.
  select * into retomada from public.obter_ppp_por_protocolo(protocolo_teste);
  if retomada.protocolo <> protocolo_teste then raise exception 'A retomada não encontrou o protocolo criado.'; end if;
  if retomada.tela_atual_chave <> 't12' then raise exception 'A retomada deveria abrir t12, abriu %.', retomada.tela_atual_chave; end if;
  if retomada.respostas->>'escola' <> 'Escola de teste automatizado' then raise exception 'A identificação não foi retomada.'; end if;
  if retomada.respostas->>'tDiagnostico' <> 'Texto de diagnóstico salvo pela bateria.' then raise exception 'O texto não foi retomado.'; end if;
  if (retomada.respostas->>'selecoes')::jsonb->'etapas' <> '["ei"]'::jsonb then raise exception 'As etapas não foram retomadas.'; end if;
  if (retomada.respostas->>'indicadores')::jsonb->>'idebAI' <> '5.1' then raise exception 'Os indicadores não foram retomados.'; end if;

  -- Cenário 5: uma conta sem vínculo não pode encontrar o PPP.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  select count(*) into quantidade from public.obter_ppp_por_protocolo(protocolo_teste);
  if quantidade <> 0 then raise exception 'Um usuário sem vínculo conseguiu retomar o PPP.'; end if;
  perform set_config('request.jwt.claim.sub', usuario_teste_id::text, true);

  -- Cenário 6: conclusão congela a versão e impede novo salvamento.
  perform public.concluir_ppp(versao_teste_id, revisao_atual);
  if (select situacao from public.versoes_ppp where id = versao_teste_id) <> 'em_assinatura' then
    raise exception 'A conclusão não mudou o status para em_assinatura.';
  end if;
  begin
    perform public.salvar_rascunho_ppp(versao_teste_id, revisao_atual, '{}'::jsonb, 't12', '{}'::jsonb);
    raise exception 'O salvamento deveria falhar após a conclusão.';
  exception when others then
    if sqlerrm !~ '^Sem permiss' then raise; end if;
  end;

  -- Cenário 7: RLS deve estar ativo em todas as tabelas expostas pelo cliente.
  select count(*) into quantidade
  from pg_tables tabela
  where tabela.schemaname = 'public'
    and tabela.tablename in (
      'arquivos_ppp', 'catalogos', 'configuracoes_redes', 'eventos_auditoria', 'eventos_ppp',
      'itens_catalogo', 'itens_publicacao_institucional', 'participantes_ppp',
      'provisionamentos_acesso', 'publicacoes_institucionais'
    ) and tabela.rowsecurity;
  if quantidade <> 10 then raise exception 'RLS deveria estar ativa nas 10 tabelas complementares, encontrou %.', quantidade; end if;

  -- Limpeza explícita. Se qualquer assertiva falhar, todo o DO é revertido pelo PostgreSQL.
  delete from public.eventos_auditoria where entidade = 'versoes_ppp' and entidade_id = versao_teste_id;
  delete from public.eventos_ppp where versao_ppp_id = versao_teste_id;
  delete from public.participantes_ppp where versao_ppp_id = versao_teste_id;
  delete from public.tarefas_progresso_ppp where versao_ppp_id = versao_teste_id;
  delete from public.progresso_ppp where versao_ppp_id = versao_teste_id;
  delete from public.tarefas_revisoes_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.textos_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.detalhes_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.indicadores_educacionais_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.opcoes_pedagogicas_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.ofertas_ensino_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  delete from public.identificacoes_ppp where revisao_ppp_id in (select id from public.revisoes_ppp where versao_ppp_id = versao_teste_id);
  update public.versoes_ppp set revisao_atual_id = null, revisao_congelada_id = null where id = versao_teste_id;
  delete from public.revisoes_ppp where versao_ppp_id = versao_teste_id;
  delete from public.versoes_ppp where id = versao_teste_id;
  delete from public.ppps where id = ppp_teste_id;
end;
$$;
-- Regressão do login Google: reaplicar a sincronização do mesmo usuário não
-- pode duplicar um vínculo ativo nem bloquear a sessão.
begin;

do $$
begin
  if to_regprocedure('app.sincronizar_acesso_usuario(uuid)') is null then
    raise exception 'Função de sincronização de acesso não foi instalada.';
  end if;
end $$;

rollback;
