-- Operacoes complementares da curadoria: consulta de historico, descarte e primeira publicacao.
begin;

create or replace function public.listar_publicacoes_institucionais(rede_destino_id uuid, tamanho_pagina integer default 20, deslocamento integer default 0)
returns table(publicacao_id uuid,numero integer,versao_formulario integer,publicada_em timestamptz,nome_publicador text,ativa boolean,quantidade_itens bigint,total_registros bigint)
language sql stable security definer set search_path=public,app
as $$
  select p.id,p.numero,p.versao_formulario,p.publicada_em,coalesce(perfil.nome_exibicao,''),p.id=c.publicacao_institucional_ativa_id,
    count(item.id),count(*) over()
  from public.publicacoes_institucionais p
  join public.configuracoes_redes c on c.rede_ensino_id=p.rede_ensino_id
  left join public.perfis_usuarios perfil on perfil.id=p.publicada_por
  left join public.itens_publicacao_institucional item on item.publicacao_institucional_id=p.id
  where p.rede_ensino_id=rede_destino_id and app.usuario_cura_conteudo(rede_destino_id)
  group by p.id,p.numero,p.versao_formulario,p.publicada_em,perfil.nome_exibicao,c.publicacao_institucional_ativa_id
  order by p.numero desc
  limit least(greatest(coalesce(tamanho_pagina,20),1),100) offset greatest(coalesce(deslocamento,0),0);
$$;

create or replace function public.descartar_rascunhos_curadoria(rede_destino_id uuid, caminhos text[] default null)
returns integer
language plpgsql security definer set search_path=public,app
as $$
declare removidos integer;
begin
  if not app.usuario_cura_conteudo(rede_destino_id) then raise exception 'Sem permissao para editar o conteudo desta rede'; end if;
  delete from public.rascunhos_conteudo_institucional
  where rede_ensino_id=rede_destino_id and autor_id=auth.uid() and (caminhos is null or chave=any(caminhos));
  get diagnostics removidos = row_count;
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'rascunhos_conteudo_descartados','rede_ensino',rede_destino_id,removidos::text || ' itens');
  return removidos;
end;
$$;

create or replace function public.obter_conteudo_institucional_publicado(rede_destino_id uuid)
returns jsonb
language sql stable security definer set search_path=public,app
as $$
  select case when not app.usuario_possui_vinculo_na_rede(rede_destino_id) then
    jsonb_build_object('ok',false,'erro','Sem permissao para consultar o conteudo desta rede')
  else coalesce((
    select jsonb_build_object('ok',true,'versao',p.numero,
      'itens',coalesce(jsonb_object_agg(i.chave,i.valor) filter(where i.chave is not null),'{}'::jsonb),'padroes','{}'::jsonb)
    from public.configuracoes_redes c
    join public.publicacoes_institucionais p on p.id=c.publicacao_institucional_ativa_id
    left join public.itens_publicacao_institucional i on i.publicacao_institucional_id=p.id
    where c.rede_ensino_id=rede_destino_id
    group by p.id,p.numero
  ),jsonb_build_object('ok',true,'versao',0,'itens','{}'::jsonb,'padroes','{}'::jsonb)) end;
$$;

create or replace function public.obter_conteudo_institucional_publicado()
returns jsonb
language sql stable security definer set search_path=public
as $$
  select public.obter_conteudo_institucional_publicado(v.rede_ensino_id)
  from public.vinculos_usuarios v
  where v.usuario_id=auth.uid() and v.revogado_em is null
  order by case when v.papel in ('leitor_rede','curador_conteudo','administrador_acessos') then 0 else 1 end, v.criado_em
  limit 1;
$$;

create or replace function public.publicar_conteudo_institucional(rede_destino_id uuid, caminhos text[] default null)
returns jsonb
language plpgsql security definer set search_path=public,app
as $$
declare configuracao public.configuracoes_redes%rowtype; nova_publicacao uuid; proximo_numero integer; rascunho record; versao_destino integer:=1;
begin
  if not app.usuario_cura_conteudo(rede_destino_id) then raise exception 'Sem permissao para publicar o conteudo desta rede'; end if;
  select * into configuracao from public.configuracoes_redes where rede_ensino_id=rede_destino_id for update;
  select coalesce(max(numero),0)+1 into proximo_numero from public.publicacoes_institucionais where rede_ensino_id=rede_destino_id;
  if configuracao.publicacao_institucional_ativa_id is not null then
    select versao_formulario into versao_destino from public.publicacoes_institucionais where id=configuracao.publicacao_institucional_ativa_id;
  end if;
  insert into public.publicacoes_institucionais(rede_ensino_id,numero,versao_formulario,publicada_por)
  values(rede_destino_id,proximo_numero,versao_destino,auth.uid()) returning id into nova_publicacao;
  if configuracao.publicacao_institucional_ativa_id is not null then
    insert into public.itens_publicacao_institucional(publicacao_institucional_id,chave,texto,valor)
    select nova_publicacao,chave,texto,valor from public.itens_publicacao_institucional where publicacao_institucional_id=configuracao.publicacao_institucional_ativa_id;
  end if;
  for rascunho in select * from public.rascunhos_conteudo_institucional where rede_ensino_id=rede_destino_id and autor_id=auth.uid() and (caminhos is null or chave=any(caminhos)) loop
    if rascunho.valor='null'::jsonb then
      delete from public.itens_publicacao_institucional where publicacao_institucional_id=nova_publicacao and chave=rascunho.chave;
    else
      insert into public.itens_publicacao_institucional(publicacao_institucional_id,chave,texto,valor)
      values(nova_publicacao,rascunho.chave,coalesce(rascunho.valor #>> '{}',''),rascunho.valor)
      on conflict(publicacao_institucional_id,chave) do update set texto=excluded.texto,valor=excluded.valor;
    end if;
  end loop;
  insert into public.configuracoes_redes(rede_ensino_id,publicacao_institucional_ativa_id)
  values(rede_destino_id,nova_publicacao)
  on conflict(rede_ensino_id) do update set publicacao_institucional_ativa_id=excluded.publicacao_institucional_ativa_id,atualizado_em=now();
  delete from public.rascunhos_conteudo_institucional where rede_ensino_id=rede_destino_id and autor_id=auth.uid() and (caminhos is null or chave=any(caminhos));
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao)
  values(rede_destino_id,auth.uid(),'conteudo_publicado','publicacao_institucional',nova_publicacao,'Publicacao institucional ' || proximo_numero);
  return public.obter_conteudo_institucional_publicado(rede_destino_id);
end;
$$;

grant execute on function public.listar_publicacoes_institucionais(uuid,integer,integer),public.descartar_rascunhos_curadoria(uuid,text[]),public.obter_conteudo_institucional_publicado(uuid),public.obter_conteudo_institucional_publicado(),public.publicar_conteudo_institucional(uuid,text[]) to authenticated;

commit;
