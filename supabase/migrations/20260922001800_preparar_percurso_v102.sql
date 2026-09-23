-- v10.2: o código usado no Censo Escolar pertence ao cadastro da escola e é
-- copiado para cada revisão, preservando o valor que constou no documento.
-- O valor vazio permanece aceito durante a carga progressiva da base escolar;
-- a importação oficial deverá preencher os oito dígitos antes da produção.
alter table public.escolas
  add column if not exists codigo_inep_censo text not null default ''
  check (codigo_inep_censo = '' or codigo_inep_censo ~ '^[0-9]{8}$');

alter table public.identificacoes_ppp
  add column if not exists codigo_inep_censo text not null default ''
  check (codigo_inep_censo = '' or codigo_inep_censo ~ '^[0-9]{8}$');

-- A RPC recebe JSON apenas como transporte HTTP e persiste cada grupo em suas
-- tabelas relacionais. A coluna adicional faz parte do snapshot identificador.
create or replace function app.gravar_formulario(revisao_id_destino uuid, formulario jsonb, tarefas jsonb default '{}'::jsonb)
returns void language plpgsql set search_path=public,app as $$
declare dados jsonb := coalesce(formulario,'{}'); selecoes jsonb := app.json_texto(dados->>'selecoes'); indicadores jsonb := app.json_texto(dados->>'indicadores'); detalhes jsonb := app.json_texto(dados->>'detalhes'); par record; filho record; neto record;
begin
  insert into public.identificacoes_ppp (
    revisao_ppp_id,nome_escola,codigo_inep,codigo_inep_censo,municipio,regional_nome,direcao_nome,especialista_nome,endereco,ato_criacao,turnos,quantidade_estudantes,quantidade_turmas,colegiado_responsavel,vigencia,data_assembleia,data_analise_regional,aprovacao,quorum_presentes,quorum_total,destino_homologacao,informacao_compartilhada
  ) values (
    revisao_id_destino,coalesce(dados->>'escola',''),coalesce(dados->>'inep',''),coalesce(dados->>'censo',''),coalesce(dados->>'municipio',''),coalesce(dados->>'sre',''),coalesce(dados->>'direcao',''),coalesce(dados->>'especialista',''),coalesce(dados->>'endereco',''),coalesce(dados->>'ato',''),coalesce(dados->>'turnos',''),coalesce(dados->>'estudantes',''),coalesce(dados->>'turmas',''),coalesce(dados->>'colegiado',''),coalesce(dados->>'vigencia',''),coalesce(dados->>'assembleia',''),coalesce(dados->>'analiseSre',''),coalesce(dados->>'aprovacao',''),coalesce(dados->>'quorumPresentes',''),coalesce(dados->>'quorumTotal',''),coalesce(dados->>'homologacao',''),coalesce(dados->>'compartilhado','')
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
  indicadores := jsonb_build_object('etapas',coalesce((select jsonb_object_agg(etapa_codigo,medidas) from (
    select etapa_codigo,jsonb_object_agg(indicador_codigo,valor) medidas from public.indicadores_educacionais_ppp where revisao_ppp_id=revisao.id and etapa_codigo<>'' group by etapa_codigo
  ) por_etapa),'{}'::jsonb)) || coalesce((select jsonb_object_agg(indicador_codigo,valor) from public.indicadores_educacionais_ppp where revisao_ppp_id=revisao.id and etapa_codigo=''),'{}'::jsonb);
  detalhes := app.montar_detalhes_formulario(revisao.id);
  resposta := jsonb_build_object(
    'escola',identificacao.nome_escola,'inep',identificacao.codigo_inep,'censo',identificacao.codigo_inep_censo,'municipio',identificacao.municipio,'sre',identificacao.regional_nome,'direcao',identificacao.direcao_nome,'especialista',identificacao.especialista_nome,'endereco',identificacao.endereco,'ato',identificacao.ato_criacao,'turnos',identificacao.turnos,'estudantes',identificacao.quantidade_estudantes,'turmas',identificacao.quantidade_turmas,'colegiado',identificacao.colegiado_responsavel,'vigencia',identificacao.vigencia,'assembleia',identificacao.data_assembleia,'analiseSre',identificacao.data_analise_regional,'aprovacao',identificacao.aprovacao,'quorumPresentes',identificacao.quorum_presentes,'quorumTotal',identificacao.quorum_total,'homologacao',identificacao.destino_homologacao,'compartilhado',identificacao.informacao_compartilhada,
    'selecoes',selecoes::text,'indicadores',indicadores::text,'detalhes',detalhes::text,
    'objetivosAnteriores',coalesce(detalhes #>> '{balanco,objetivos_anteriores}',''),'indicadoresAnteriores',coalesce(detalhes #>> '{balanco,indicadores_anteriores}','')
  ) || coalesce((select jsonb_object_agg(secao,conteudo) from public.textos_ppp where revisao_ppp_id=revisao.id),'{}'::jsonb);
  return query select versao.id,versao.protocolo,versao.numero,versao.situacao,revisao.numero,resposta,(select tela_atual from public.progresso_ppp where versao_ppp_id=versao.id),coalesce((select jsonb_object_agg(codigo_tarefa,concluida) from public.tarefas_progresso_ppp where versao_ppp_id=versao.id),'{}'::jsonb),versao.atualizado_em;
end; $$;

-- As chaves de tela são contratos do frontend, não enumerações de banco. A
-- v10.2 acrescenta t00b e telas com nomes, portanto a validação só limita
-- tamanho e impede valor vazio.
create or replace function public.atualizar_tela_atual_ppp(versao_ppp_destino_id uuid, proxima_tela_atual_chave text)
returns void language plpgsql security definer set search_path=public,app as $$
declare usuario_id uuid := auth.uid(); versao public.versoes_ppp%rowtype; documento public.ppps%rowtype; escola public.escolas%rowtype;
begin
  if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
  if nullif(trim(proxima_tela_atual_chave),'') is null or length(proxima_tela_atual_chave) > 64 then raise exception 'Tela de retomada invalida'; end if;
  select * into versao from public.versoes_ppp where id=versao_ppp_destino_id for update;
  if not found or versao.situacao <> 'rascunho' then raise exception 'PPP indisponivel para alteracao'; end if;
  select * into documento from public.ppps where id=versao.ppp_id;
  select * into escola from public.escolas where id=documento.escola_id;
  if not app.pode_acessar(documento.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then raise exception 'Sem permissao para alterar este PPP'; end if;
  update public.progresso_ppp set tela_atual=proxima_tela_atual_chave,atualizado_por=usuario_id,atualizado_em=now() where versao_ppp_id=versao.id;
end; $$;

grant execute on function public.obter_ppp_por_protocolo(text), public.atualizar_tela_atual_ppp(uuid,text) to authenticated;
