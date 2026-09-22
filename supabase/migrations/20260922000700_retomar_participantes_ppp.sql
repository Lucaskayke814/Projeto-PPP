-- Inclui participantes da versao na retomada sem duplicar dados no cliente.
create or replace function public.obter_ppp_por_protocolo(protocolo_busca text)
returns table(versao_ppp_id uuid,protocolo text,numero_versao integer,situacao text,numero_revisao bigint,respostas jsonb,tela_atual_chave text,tarefas jsonb,atualizado_em timestamptz)
language plpgsql security definer set search_path=public,app as $$
declare versao public.versoes_ppp%rowtype; documento public.ppps%rowtype; escola public.escolas%rowtype; revisao public.revisoes_ppp%rowtype; identificacao public.identificacoes_ppp%rowtype; resposta jsonb; selecoes jsonb; indicadores jsonb; detalhes jsonb;
begin
  select v.* into versao from public.versoes_ppp v where upper(v.protocolo)=upper(trim(protocolo_busca));
  if not found then return; end if;
  select * into documento from public.ppps where id=versao.ppp_id;
  select * into escola from public.escolas where id=documento.escola_id;
  if not app.pode_acessar(documento.rede_ensino_id,escola.regional_ensino_id,escola.id) then return; end if;
  select * into revisao from public.revisoes_ppp where id=versao.revisao_atual_id;
  select * into identificacao from public.identificacoes_ppp where revisao_ppp_id=revisao.id;
  select jsonb_object_agg(case tipo when 'etapa' then 'etapas' else 'mods' end, itens) into selecoes from (
    select oferta.tipo, jsonb_agg(oferta.codigo_item order by oferta.codigo_item) itens from public.ofertas_ensino_ppp oferta where oferta.revisao_ppp_id=revisao.id group by oferta.tipo
  ) agrupadas;
  selecoes := coalesce(selecoes,'{}'::jsonb) || jsonb_build_object(
    'infra',coalesce((select jsonb_agg(opcao.codigo_item order by opcao.codigo_item) from public.opcoes_pedagogicas_ppp opcao where opcao.revisao_ppp_id=revisao.id and opcao.categoria='infraestrutura'),'[]'::jsonb),
    'temas',coalesce((select jsonb_agg(opcao.codigo_item order by opcao.codigo_item) from public.opcoes_pedagogicas_ppp opcao where opcao.revisao_ppp_id=revisao.id and opcao.categoria='tema'),'[]'::jsonb),
    'principios',coalesce((select jsonb_agg(opcao.codigo_item order by opcao.codigo_item) from public.opcoes_pedagogicas_ppp opcao where opcao.revisao_ppp_id=revisao.id and opcao.categoria='principio'),'[]'::jsonb),
    'metodos',coalesce((select jsonb_agg(opcao.codigo_item order by opcao.codigo_item) from public.opcoes_pedagogicas_ppp opcao where opcao.revisao_ppp_id=revisao.id and opcao.categoria='metodo'),'[]'::jsonb)
  );
  indicadores := jsonb_build_object(
    'etapas',coalesce((select jsonb_object_agg(etapa_codigo,medidas) from (
      select indicador.etapa_codigo,jsonb_object_agg(indicador.indicador_codigo,indicador.valor) medidas from public.indicadores_educacionais_ppp indicador where indicador.revisao_ppp_id=revisao.id and indicador.etapa_codigo<>'' group by indicador.etapa_codigo
    ) por_etapa),'{}'::jsonb)
  ) || coalesce((select jsonb_object_agg(indicador.indicador_codigo,indicador.valor) from public.indicadores_educacionais_ppp indicador where indicador.revisao_ppp_id=revisao.id and indicador.etapa_codigo=''),'{}'::jsonb);
  detalhes := app.montar_detalhes_formulario(revisao.id);
  resposta := jsonb_build_object(
    'escola',identificacao.nome_escola,'inep',identificacao.codigo_inep,'municipio',identificacao.municipio,'sre',identificacao.regional_nome,'direcao',identificacao.direcao_nome,'especialista',identificacao.especialista_nome,'endereco',identificacao.endereco,'ato',identificacao.ato_criacao,'turnos',identificacao.turnos,'estudantes',identificacao.quantidade_estudantes,'turmas',identificacao.quantidade_turmas,'colegiado',identificacao.colegiado_responsavel,'vigencia',identificacao.vigencia,'assembleia',identificacao.data_assembleia,'analiseSre',identificacao.data_analise_regional,'aprovacao',identificacao.aprovacao,'quorumPresentes',identificacao.quorum_presentes,'quorumTotal',identificacao.quorum_total,'homologacao',identificacao.destino_homologacao,'compartilhado',identificacao.informacao_compartilhada,
    'selecoes',selecoes::text,'indicadores',indicadores::text,'detalhes',detalhes::text,
    'objetivosAnteriores',coalesce(detalhes #>> '{balanco,objetivos_anteriores}',''),'indicadoresAnteriores',coalesce(detalhes #>> '{balanco,indicadores_anteriores}',''),'assinaturas',coalesce((select jsonb_agg(jsonb_build_object('papel',case participante.papel when 'direcao' then 'Direção Escolar' else 'Colegiado Escolar' end,'segmento',participante.segmento,'nome',participante.nome,'masp',participante.masp,'email',participante.email,'assinadoEm',coalesce(to_char(participante.assinado_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'')) order by participante.convidado_em nulls first) from public.participantes_ppp participante where participante.versao_ppp_id=versao.id and participante.removido_em is null),'[]'::jsonb)::text
  ) || coalesce((select jsonb_object_agg(texto.secao,texto.conteudo) from public.textos_ppp texto where texto.revisao_ppp_id=revisao.id),'{}'::jsonb);
  return query select versao.id,versao.protocolo,versao.numero,versao.situacao,revisao.numero::bigint,resposta,(select tela_atual from public.progresso_ppp progresso where progresso.versao_ppp_id=versao.id),coalesce((select jsonb_object_agg(tarefa.codigo_tarefa,tarefa.concluida) from public.tarefas_progresso_ppp tarefa where tarefa.versao_ppp_id=versao.id),'{}'::jsonb),versao.atualizado_em;
end; $$;

grant execute on function public.obter_ppp_por_protocolo(text) to authenticated;
