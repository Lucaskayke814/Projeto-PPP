-- Completa a gravação relacional de indicadores por etapa e detalhes condicionais.
create or replace function app.gravar_formulario(revisao_id_destino uuid, formulario jsonb, tarefas jsonb default '{}'::jsonb)
returns void language plpgsql set search_path=public,app as $$
declare dados jsonb:=coalesce(formulario,'{}'); selecoes jsonb:=app.json_texto(dados->>'selecoes'); indicadores jsonb:=app.json_texto(dados->>'indicadores'); detalhes jsonb:=app.json_texto(dados->>'detalhes'); par record; filho record; neto record;
begin
 insert into public.identificacoes_ppp select revisao_id_destino,coalesce(dados->>'escola',''),coalesce(dados->>'inep',''),coalesce(dados->>'municipio',''),coalesce(dados->>'sre',''),coalesce(dados->>'direcao',''),coalesce(dados->>'especialista',''),coalesce(dados->>'endereco',''),coalesce(dados->>'ato',''),coalesce(dados->>'turnos',''),coalesce(dados->>'estudantes',''),coalesce(dados->>'turmas',''),coalesce(dados->>'colegiado',''),coalesce(dados->>'vigencia',''),coalesce(dados->>'assembleia',''),coalesce(dados->>'analiseSre',''),coalesce(dados->>'aprovacao',''),coalesce(dados->>'quorumPresentes',''),coalesce(dados->>'quorumTotal',''),coalesce(dados->>'homologacao','');
 insert into public.textos_ppp(revisao_ppp_id,secao,conteudo) select revisao_id_destino,key,value#>>'{}' from jsonb_each(dados) where key ~ '^t[A-Z]' and jsonb_typeof(value)='string';
 insert into public.ofertas_ensino_ppp select revisao_id_destino,case when g.key='etapas' then 'etapa' else 'modalidade' end,x.value#>>'{}' from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('etapas','mods');
 insert into public.opcoes_pedagogicas_ppp select revisao_id_destino,case g.key when 'infra' then 'infraestrutura' when 'temas' then 'tema' when 'principios' then 'principio' else 'metodo' end,x.value#>>'{}' from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('infra','temas','principios','metodos');
 for par in select key,value from jsonb_each(indicadores) loop
   if par.key <> 'etapas' and jsonb_typeof(par.value) in ('string','number','boolean') then insert into public.indicadores_educacionais_ppp values(revisao_id_destino,'',par.key,par.value#>>'{}',coalesce(indicadores->>'ano','')) on conflict do nothing; end if;
 end loop;
 for par in select key,value from jsonb_each(coalesce(indicadores->'etapas','{}')) loop
   for filho in select key,value from jsonb_each(par.value) loop
     insert into public.indicadores_educacionais_ppp values(revisao_id_destino,par.key,filho.key,filho.value#>>'{}',coalesce(indicadores->>'ano','')) on conflict do nothing;
   end loop;
 end loop;
 for par in select key,value from jsonb_each(detalhes) loop
   if jsonb_typeof(par.value) in ('string','number','boolean') then insert into public.detalhes_ppp values(revisao_id_destino,'formulario',par.key,par.value#>>'{}') on conflict do nothing;
   elsif jsonb_typeof(par.value)='object' then
     for filho in select key,value from jsonb_each(par.value) loop
       if jsonb_typeof(filho.value) in ('string','number','boolean') then insert into public.detalhes_ppp values(revisao_id_destino,par.key,filho.key,filho.value#>>'{}') on conflict do nothing;
       elsif jsonb_typeof(filho.value)='object' then
         for neto in select key,value from jsonb_each(filho.value) loop insert into public.detalhes_ppp values(revisao_id_destino,par.key,filho.key||'.'||neto.key,neto.value#>>'{}') on conflict do nothing; end loop;
       end if;
     end loop;
   end if;
 end loop;
 if dados ? 'objetivosAnteriores' then insert into public.detalhes_ppp values(revisao_id_destino,'balanco','objetivos_anteriores',coalesce(dados->>'objetivosAnteriores','')) on conflict do nothing; end if;
 if dados ? 'indicadoresAnteriores' then insert into public.detalhes_ppp values(revisao_id_destino,'balanco','indicadores_anteriores',coalesce(dados->>'indicadoresAnteriores','')) on conflict do nothing; end if;
 insert into public.tarefas_revisoes_ppp select revisao_id_destino,key,(value#>>'{}')::boolean from jsonb_each(tarefas) where jsonb_typeof(value)='boolean';
end; $$;
