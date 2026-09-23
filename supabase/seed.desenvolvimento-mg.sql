-- Carga exclusiva de desenvolvimento. As SREs seguem denominacoes da SEE/MG;
-- as escolas e os codigos INEP abaixo sao FICTICIOS, apenas para testes.
do $$
declare rede_id uuid; registro record; regional_id uuid;
begin
  insert into public.redes_ensino(codigo,nome) values ('demonstracao','Rede de Demonstracao - ambiente de desenvolvimento') on conflict(codigo) do update set nome=excluded.nome returning id into rede_id;
  for registro in select * from (values
      ('almenara','Almenara','31280000'),
      ('aracuai','Aracuai','31280001'),
      ('barbacena','Barbacena','31280002'),
      ('campo-belo','Campo Belo','31280003'),
      ('carangola','Carangola','31280004'),
      ('caratinga','Caratinga','31280005'),
      ('caxambu','Caxambu','31280006'),
      ('conselheiro-lafaiete','Conselheiro Lafaiete','31280007'),
      ('coronel-fabriciano','Coronel Fabriciano','31280008'),
      ('curvelo','Curvelo','31280009'),
      ('diamantina','Diamantina','31280010'),
      ('divinopolis','Divinopolis','31280011'),
      ('governador-valadares','Governador Valadares','31280012'),
      ('guanhaes','Guanhaes','31280013'),
      ('itajuba','Itajuba','31280014'),
      ('ituiutaba','Ituiutaba','31280015'),
      ('janauba','Janauba','31280016'),
      ('januaria','Januaria','31280017'),
      ('juiz-de-fora','Juiz de Fora','31280018'),
      ('leopoldina','Leopoldina','31280019'),
      ('manhuacu','Manhuacu','31280020'),
      ('metropolitana-a','Metropolitana A','31280021'),
      ('metropolitana-b','Metropolitana B','31280022'),
      ('metropolitana-c','Metropolitana C','31280023'),
      ('montes-claros','Montes Claros','31280024'),
      ('muriae','Muriae','31280025'),
      ('nova-era','Nova Era','31280026'),
      ('ouro-preto','Ouro Preto','31280027'),
      ('para-de-minas','Para de Minas','31280028'),
      ('paracatu','Paracatu','31280029'),
      ('passos','Passos','31280030'),
      ('patos-de-minas','Patos de Minas','31280031'),
      ('patrocinio','Patrocinio','31280032'),
      ('pirapora','Pirapora','31280033'),
      ('pocos-de-caldas','Pocos de Caldas','31280034'),
      ('ponte-nova','Ponte Nova','31280035'),
      ('pouso-alegre','Pouso Alegre','31280036'),
      ('sao-joao-del-rei','Sao Joao del Rei','31280037'),
      ('sao-sebastiao-do-paraiso','Sao Sebastiao do Paraiso','31280038'),
      ('sete-lagoas','Sete Lagoas','31280039'),
      ('teofilo-otoni','Teofilo Otoni','31280040'),
      ('uba','Uba','31280041'),
      ('uberaba','Uberaba','31280042'),
      ('uberlandia','Uberlandia','31280043'),
      ('unai','Unai','31280044'),
      ('varginha','Varginha','31280045'),
      ('pouso-alto','Pouso Alto','31280046')
    ) as dados(codigo,nome,codigo_inep)
  loop
    insert into public.regionais_ensino(rede_ensino_id,codigo,nome,ativo) values(rede_id,registro.codigo,registro.nome,true) on conflict(rede_ensino_id,codigo) do update set nome=excluded.nome,ativo=true returning id into regional_id;
    insert into public.escolas(rede_ensino_id,regional_ensino_id,codigo_inep,nome,municipio,ativo) values(rede_id,regional_id,registro.codigo_inep,'Escola Estadual de Desenvolvimento - ' || registro.nome,registro.nome,true) on conflict(rede_ensino_id,codigo_inep) do update set regional_ensino_id=excluded.regional_ensino_id,nome=excluded.nome,municipio=excluded.municipio,ativo=true;
  end loop;
  insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,papel) values
    ('administrador.central@teste.invalid','Administrador Central de Teste',rede_id,'administrador_acessos'),
    ('gestor.ppp.central@teste.invalid','Gestor de PPP de Teste',rede_id,'gestor_ppp_rede'),
    ('curadoria.central@teste.invalid','Curador de Conteudo de Teste',rede_id,'curador_conteudo'),
    ('consulta.central@teste.invalid','Leitor Central de Teste',rede_id,'leitor_rede')
  on conflict do nothing;
  insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,regional_ensino_id,papel)
  select 'sre.' || r.codigo || '@teste.invalid','Equipe SRE ' || r.nome,rede_id,r.id,'leitor_regional' from public.regionais_ensino r where r.rede_ensino_id=rede_id on conflict do nothing;
  insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,escola_id,papel)
  select 'direcao.' || e.codigo_inep || '@teste.invalid','Direcao de Teste - ' || e.nome,rede_id,e.id,'editor_escola' from public.escolas e where e.rede_ensino_id=rede_id on conflict do nothing;
  insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,escola_id,papel)
  select 'colegiado.' || e.codigo_inep || '@teste.invalid','Colegiado de Teste - ' || e.nome,rede_id,e.id,'assinante_colegiado' from public.escolas e where e.rede_ensino_id=rede_id on conflict do nothing;
end;
$$;
