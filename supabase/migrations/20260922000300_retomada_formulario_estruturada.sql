-- Completa a retomada do formulário sem manter respostas persistentes em JSONB.
alter table public.identificacoes_ppp
  add column if not exists informacao_compartilhada text not null default '';

create or replace function app.definir_caminho_json(objeto jsonb, caminho text[], valor text)
returns jsonb language plpgsql immutable as $$
declare chave text;
begin
  if coalesce(array_length(caminho, 1), 0) = 0 then return coalesce(objeto, '{}'::jsonb); end if;
  chave := caminho[1];
  if array_length(caminho, 1) = 1 then
    return jsonb_set(coalesce(objeto, '{}'::jsonb), array[chave], to_jsonb(valor), true);
  end if;
  return jsonb_set(
    coalesce(objeto, '{}'::jsonb),
    array[chave],
    app.definir_caminho_json(coalesce(objeto -> chave, '{}'::jsonb), caminho[2:array_length(caminho, 1)], valor),
    true
  );
end; $$;

create or replace function app.montar_detalhes_formulario(revisao_id_origem uuid)
returns jsonb language plpgsql stable security definer set search_path=public,app as $$
declare resultado jsonb := '{}'::jsonb; linha record;
begin
  for linha in
    select grupo, campo, valor
    from public.detalhes_ppp
    where revisao_ppp_id = revisao_id_origem
    order by grupo, campo
  loop
    if linha.grupo = 'formulario' then
      resultado := app.definir_caminho_json(resultado, array[linha.campo], linha.valor);
    else
      resultado := jsonb_set(
        resultado,
        array[linha.grupo],
        app.definir_caminho_json(coalesce(resultado -> linha.grupo, '{}'::jsonb), string_to_array(linha.campo, '.'), linha.valor),
        true
      );
    end if;
  end loop;
  return resultado;
end; $$;

create or replace function app.gravar_formulario(revisao_id_destino uuid, formulario jsonb, tarefas jsonb default '{}'::jsonb)
returns void language plpgsql set search_path=public,app as $$
declare dados jsonb := coalesce(formulario,'{}'); selecoes jsonb := app.json_texto(dados->>'selecoes'); indicadores jsonb := app.json_texto(dados->>'indicadores'); detalhes jsonb := app.json_texto(dados->>'detalhes'); par record; filho record; neto record;
begin
  insert into public.identificacoes_ppp (
    revisao_ppp_id,nome_escola,codigo_inep,municipio,regional_nome,direcao_nome,especialista_nome,endereco,ato_criacao,turnos,quantidade_estudantes,quantidade_turmas,colegiado_responsavel,vigencia,data_assembleia,data_analise_regional,aprovacao,quorum_presentes,quorum_total,destino_homologacao,informacao_compartilhada
  ) values (
    revisao_id_destino,coalesce(dados->>'escola',''),coalesce(dados->>'inep',''),coalesce(dados->>'municipio',''),coalesce(dados->>'sre',''),coalesce(dados->>'direcao',''),coalesce(dados->>'especialista',''),coalesce(dados->>'endereco',''),coalesce(dados->>'ato',''),coalesce(dados->>'turnos',''),coalesce(dados->>'estudantes',''),coalesce(dados->>'turmas',''),coalesce(dados->>'colegiado',''),coalesce(dados->>'vigencia',''),coalesce(dados->>'assembleia',''),coalesce(dados->>'analiseSre',''),coalesce(dados->>'aprovacao',''),coalesce(dados->>'quorumPresentes',''),coalesce(dados->>'quorumTotal',''),coalesce(dados->>'homologacao',''),coalesce(dados->>'compartilhado','')
  );
  insert into public.textos_ppp(revisao_ppp_id,secao,conteudo)
    select revisao_id_destino,key,value#>>'{}' from jsonb_each(dados) where key ~ '^t[A-Z]' and jsonb_typeof(value)='string';
  insert into public.ofertas_ensino_ppp
    select revisao_id_destino,case when g.key='etapas' then 'etapa' else 'modalidade' end,x.value#>>'{}'
    from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('etapas','mods');
  insert into public.opcoes_pedagogicas_ppp
    select revisao_id_destino,case g.key when 'infra' then 'infraestrutura' when 'temas' then 'tema' when 'principios' then 'principio' else 'metodo' end,x.value#>>'{}'
    from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('infra','temas','principios','metodos');
  for par in select key,value from jsonb_each(indicadores) loop
    if par.key <> 'etapas' and jsonb_typeof(par.value) in ('string','number','boolean') then
      insert into public.indicadores_educacionais_ppp values(revisao_id_destino,'',par.key,par.value#>>'{}',coalesce(indicadores->>'ano','')) on conflict do nothing;
    end if;
  end loop;
  for par in select key,value from jsonb_each(coalesce(indicadores->'etapas','{}')) loop
    for filho in select key,value from jsonb_each(par.value) loop
      insert into public.indicadores_educacionais_ppp values(revisao_id_destino,par.key,filho.key,filho.value#>>'{}',coalesce(indicadores->>'ano','')) on conflict do nothing;
    end loop;
  end loop;
  for par in select key,value from jsonb_each(detalhes) loop
    if jsonb_typeof(par.value) in ('string','number','boolean') then
      insert into public.detalhes_ppp values(revisao_id_destino,'formulario',par.key,par.value#>>'{}') on conflict do nothing;
    elsif jsonb_typeof(par.value)='object' then
      for filho in select key,value from jsonb_each(par.value) loop
        if jsonb_typeof(filho.value) in ('string','number','boolean') then
          insert into public.detalhes_ppp values(revisao_id_destino,par.key,filho.key,filho.value#>>'{}') on conflict do nothing;
        elsif jsonb_typeof(filho.value)='object' then
          for neto in select key,value from jsonb_each(filho.value) loop
            insert into public.detalhes_ppp values(revisao_id_destino,par.key,filho.key||'.'||neto.key,neto.value#>>'{}') on conflict do nothing;
          end loop;
        end if;
      end loop;
    end if;
  end loop;
  if dados ? 'objetivosAnteriores' then insert into public.detalhes_ppp values(revisao_id_destino,'balanco','objetivos_anteriores',coalesce(dados->>'objetivosAnteriores','')) on conflict do nothing; end if;
  if dados ? 'indicadoresAnteriores' then insert into public.detalhes_ppp values(revisao_id_destino,'balanco','indicadores_anteriores',coalesce(dados->>'indicadoresAnteriores','')) on conflict do nothing; end if;
  insert into public.tarefas_revisoes_ppp select revisao_id_destino,key,(value#>>'{}')::boolean from jsonb_each(tarefas) where jsonb_typeof(value)='boolean';
end; $$;

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
    select tipo, jsonb_agg(codigo_item order by codigo_item) itens from public.ofertas_ensino_ppp where revisao_ppp_id=revisao.id group by tipo
  ) agrupadas;
  selecoes := coalesce(selecoes,'{}'::jsonb) || jsonb_build_object(
    'infra',coalesce((select jsonb_agg(codigo_item order by codigo_item) from public.opcoes_pedagogicas_ppp where revisao_ppp_id=revisao.id and categoria='infraestrutura'),'[]'::jsonb),
    'temas',coalesce((select jsonb_agg(codigo_item order by codigo_item) from public.opcoes_pedagogicas_ppp where revisao_ppp_id=revisao.id and categoria='tema'),'[]'::jsonb),
    'principios',coalesce((select jsonb_agg(codigo_item order by codigo_item) from public.opcoes_pedagogicas_ppp where revisao_ppp_id=revisao.id and categoria='principio'),'[]'::jsonb),
    'metodos',coalesce((select jsonb_agg(codigo_item order by codigo_item) from public.opcoes_pedagogicas_ppp where revisao_ppp_id=revisao.id and categoria='metodo'),'[]'::jsonb)
  );
  indicadores := jsonb_build_object(
    'etapas',coalesce((select jsonb_object_agg(etapa_codigo,medidas) from (
      select etapa_codigo,jsonb_object_agg(indicador_codigo,valor) medidas from public.indicadores_educacionais_ppp where revisao_ppp_id=revisao.id and etapa_codigo<>'' group by etapa_codigo
    ) por_etapa),'{}'::jsonb)
  ) || coalesce((select jsonb_object_agg(indicador_codigo,valor) from public.indicadores_educacionais_ppp where revisao_ppp_id=revisao.id and etapa_codigo=''),'{}'::jsonb);
  detalhes := app.montar_detalhes_formulario(revisao.id);
  resposta := jsonb_build_object(
    'escola',identificacao.nome_escola,'inep',identificacao.codigo_inep,'municipio',identificacao.municipio,'sre',identificacao.regional_nome,'direcao',identificacao.direcao_nome,'especialista',identificacao.especialista_nome,'endereco',identificacao.endereco,'ato',identificacao.ato_criacao,'turnos',identificacao.turnos,'estudantes',identificacao.quantidade_estudantes,'turmas',identificacao.quantidade_turmas,'colegiado',identificacao.colegiado_responsavel,'vigencia',identificacao.vigencia,'assembleia',identificacao.data_assembleia,'analiseSre',identificacao.data_analise_regional,'aprovacao',identificacao.aprovacao,'quorumPresentes',identificacao.quorum_presentes,'quorumTotal',identificacao.quorum_total,'homologacao',identificacao.destino_homologacao,'compartilhado',identificacao.informacao_compartilhada,
    'selecoes',selecoes::text,'indicadores',indicadores::text,'detalhes',detalhes::text,
    'objetivosAnteriores',coalesce(detalhes #>> '{balanco,objetivos_anteriores}',''),'indicadoresAnteriores',coalesce(detalhes #>> '{balanco,indicadores_anteriores}','')
  ) || coalesce((select jsonb_object_agg(secao,conteudo) from public.textos_ppp where revisao_ppp_id=revisao.id),'{}'::jsonb);
  return query select versao.id,versao.protocolo,versao.numero,versao.situacao,revisao.numero,resposta,(select tela_atual from public.progresso_ppp where versao_ppp_id=versao.id),coalesce((select jsonb_object_agg(codigo_tarefa,concluida) from public.tarefas_progresso_ppp where versao_ppp_id=versao.id),'{}'::jsonb),versao.atualizado_em;
end; $$;

grant execute on function public.obter_ppp_por_protocolo(text) to authenticated;
