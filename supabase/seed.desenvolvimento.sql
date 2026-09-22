-- Dados mínimos exclusivamente para desenvolvimento e testes.
insert into public.redes_ensino(codigo,nome) values ('demonstracao','Rede de Demonstracao') on conflict(codigo) do nothing;
insert into public.regionais_ensino(rede_ensino_id,codigo,nome)
select id,'divinopolis','Divinopolis' from public.redes_ensino where codigo='demonstracao' on conflict(rede_ensino_id,codigo) do nothing;
insert into public.escolas(rede_ensino_id,regional_ensino_id,codigo_inep,nome,municipio)
select r.id,rg.id,'31123456','Escola Estadual Horizonte do Saber','Divinopolis' from public.redes_ensino r join public.regionais_ensino rg on rg.rede_ensino_id=r.id and rg.codigo='divinopolis' where r.codigo='demonstracao' on conflict(rede_ensino_id,codigo_inep) do nothing;

insert into public.catalogos(codigo,nome,descricao) values
('etapas','Etapas de ensino','Etapas atendidas pela escola'),('modalidades','Modalidades','Modalidades e formas de oferta'),('infraestrutura','Infraestrutura','Recursos fisicos'),('temas','Temas','Temas pedagogicos'),('principios','Principios','Principios norteadores'),('metodos','Metodos','Metodologias')
on conflict(codigo) do nothing;
insert into public.itens_catalogo(catalogo_codigo,codigo,rotulo,ordem) values
('etapas','efai','Ensino Fundamental - Anos Iniciais',1),('etapas','efaf','Ensino Fundamental - Anos Finais',2),('modalidades','parcial','Ensino regular em tempo parcial',1),('modalidades','esp','Educacao Especial',2),('infraestrutura','salas','Salas de aula',1),('temas','digital','Cultura digital',1),('principios','inclusiva','Educacao inclusiva',1),('metodos','projetos','Projetos interdisciplinares',1)
on conflict(catalogo_codigo,codigo) do nothing;

insert into public.publicacoes_institucionais(rede_ensino_id,numero,versao_formulario)
select id,1,1 from public.redes_ensino where codigo='demonstracao' on conflict(rede_ensino_id,numero) do nothing;
insert into public.configuracoes_redes(rede_ensino_id,publicacao_institucional_ativa_id)
select r.id,p.id from public.redes_ensino r join public.publicacoes_institucionais p on p.rede_ensino_id=r.id and p.numero=1 where r.codigo='demonstracao' on conflict(rede_ensino_id) do nothing;

insert into public.perfis_usuarios(id,nome_exibicao,email)
select id,coalesce(raw_user_meta_data->>'display_name','Usuario de teste'),lower(email) from auth.users on conflict(id) do update set email=excluded.email;
insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,escola_id,papel)
select u.id,r.id,e.id,'editor_escola' from auth.users u join public.redes_ensino r on r.codigo='demonstracao' join public.escolas e on e.rede_ensino_id=r.id and e.codigo_inep='31123456' where lower(u.email)='lucas@gmail.com' on conflict do nothing;
