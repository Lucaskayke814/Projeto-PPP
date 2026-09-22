-- As novas tabelas estruturadas seguem o mesmo isolamento por escola e rede.
alter table public.respostas_campos_ppp enable row level security;
alter table public.selecoes_resposta_ppp enable row level security;
alter table public.indicadores_resposta_ppp enable row level security;
alter table public.detalhes_resposta_ppp enable row level security;
alter table public.tarefas_revisao_ppp enable row level security;
alter table public.tarefas_progresso_ppp enable row level security;
alter table public.atributos_escola enable row level security;
alter table public.itens_publicacao_conteudo enable row level security;
alter table public.opcoes_configuracao_rede enable row level security;
alter table public.atributos_opcao_catalogo enable row level security;
alter table public.metadados_arquivo_ppp enable row level security;
alter table public.dados_evento_fluxo_ppp enable row level security;
alter table public.metadados_evento_auditoria enable row level security;

create policy "respostas estruturadas por escopo" on public.respostas_campos_ppp for select to authenticated using (exists (
  select 1 from public.revisoes_ppp r join public.versoes_ppp v on v.id = r.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where r.id = revisao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "selecoes estruturadas por escopo" on public.selecoes_resposta_ppp for select to authenticated using (exists (
  select 1 from public.revisoes_ppp r join public.versoes_ppp v on v.id = r.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where r.id = revisao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "indicadores estruturados por escopo" on public.indicadores_resposta_ppp for select to authenticated using (exists (
  select 1 from public.revisoes_ppp r join public.versoes_ppp v on v.id = r.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where r.id = revisao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "detalhes estruturados por escopo" on public.detalhes_resposta_ppp for select to authenticated using (exists (
  select 1 from public.revisoes_ppp r join public.versoes_ppp v on v.id = r.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where r.id = revisao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "tarefas da revisao por escopo" on public.tarefas_revisao_ppp for select to authenticated using (exists (
  select 1 from public.revisoes_ppp r join public.versoes_ppp v on v.id = r.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where r.id = revisao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "tarefas do progresso por escopo" on public.tarefas_progresso_ppp for select to authenticated using (exists (
  select 1 from public.versoes_ppp v join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where v.id = versao_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "atributos da escola por escopo" on public.atributos_escola for select to authenticated using (exists (
  select 1 from public.escolas e where e.id = escola_id and app.pode_acessar(e.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "conteudo publicado por vinculo" on public.itens_publicacao_conteudo for select to authenticated using (exists (
  select 1 from public.publicacoes_conteudo p where p.id = publicacao_conteudo_id and app.possui_vinculo_rede(p.rede_id)
));
create policy "configuracao da rede por vinculo" on public.opcoes_configuracao_rede for select to authenticated using (app.possui_vinculo_rede(rede_id));
create policy "atributos de catalogo autenticados" on public.atributos_opcao_catalogo for select to authenticated using (true);
create policy "metadados de arquivo por escopo" on public.metadados_arquivo_ppp for select to authenticated using (exists (
  select 1 from public.arquivos_ppp a join public.versoes_ppp v on v.id = a.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where a.id = arquivo_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "dados de fluxo por escopo" on public.dados_evento_fluxo_ppp for select to authenticated using (exists (
  select 1 from public.eventos_fluxo_ppp f join public.versoes_ppp v on v.id = f.versao_ppp_id join public.projetos_politico_pedagogicos p on p.id = v.projeto_ppp_id join public.escolas e on e.id = p.escola_id
  where f.id = evento_fluxo_ppp_id and app.pode_acessar(v.rede_id, e.superintendencia_regional_id, e.id)
));
create policy "metadados de auditoria central" on public.metadados_evento_auditoria for select to authenticated using (exists (
  select 1 from public.eventos_auditoria a join public.vinculos_usuario v on v.rede_id = a.rede_id
  where a.id = evento_auditoria_id and v.usuario_id = auth.uid() and v.revogado_em is null and v.papel in ('central_viewer', 'access_admin')
));
