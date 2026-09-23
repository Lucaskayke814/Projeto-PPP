-- Fluxo de validacao institucional do PPP. O papel gestor_ppp_rede e exclusivo
-- para atos pedagogicos; ele nao concede administracao de acessos ou curadoria.
begin;

alter table public.vinculos_usuarios drop constraint if exists vinculos_usuarios_papel_check;
alter table public.vinculos_usuarios add constraint vinculos_usuarios_papel_check
  check (papel in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos','gestor_ppp_rede'));
alter table public.provisionamentos_acesso drop constraint if exists provisionamentos_acesso_papel_check;
alter table public.provisionamentos_acesso add constraint provisionamentos_acesso_papel_check
  check (papel in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos','gestor_ppp_rede'));
alter table public.versoes_ppp drop constraint if exists versoes_ppp_situacao_check;
alter table public.versoes_ppp add constraint versoes_ppp_situacao_check
  check (situacao in ('rascunho','em_validacao','validado','em_assinatura','assinado','concluido','enviado_homologacao','homologado'));

create table public.pareceres_validacao_ppp (
  id uuid primary key default gen_random_uuid(),
  versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  tipo text not null check (tipo in ('validacao','devolucao')),
  texto text not null default '',
  registrado_por uuid not null references public.perfis_usuarios(id) on delete restrict,
  registrado_em timestamptz not null default now()
);
create index pareceres_validacao_ppp_versao_idx on public.pareceres_validacao_ppp(versao_ppp_id,registrado_em desc);
alter table public.pareceres_validacao_ppp enable row level security;
create policy "pareceres de ppp acessivel" on public.pareceres_validacao_ppp for select to authenticated using (
  exists (select 1 from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id
          where v.id=versao_ppp_id and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id))
);

create or replace function app.usuario_gerencia_fluxo_ppp(rede_destino_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists (
    select 1 from public.vinculos_usuarios v where v.usuario_id=auth.uid()
      and v.rede_ensino_id=rede_destino_id and v.revogado_em is null and v.papel='gestor_ppp_rede'
  );
$$;

create or replace function public.enviar_ppp_para_validacao(protocolo_busca text)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; e public.escolas%rowtype;
begin
  select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update;
  if not found then raise exception 'PPP nao encontrado'; end if;
  select * into p from public.ppps where id=v.ppp_id; select * into e from public.escolas where id=p.escola_id;
  if not app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id,true) then raise exception 'Sem permissao para enviar este PPP'; end if;
  if v.situacao <> 'rascunho' then raise exception 'Este PPP nao esta disponivel para validacao'; end if;
  update public.versoes_ppp set situacao='em_validacao' where id=v.id;
  insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id) values(v.id,'enviado_para_validacao','PPP enviado para validacao institucional.',auth.uid());
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao) values(p.rede_ensino_id,auth.uid(),'enviar_validacao','versoes_ppp',v.id,v.protocolo);
  return jsonb_build_object('ok',true,'protocolo',v.protocolo,'situacao','em_validacao');
end;
$$;

create or replace function public.validar_ppp_rede(protocolo_busca text, parecer text default '')
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype;
begin
  select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update;
  if not found then raise exception 'PPP nao encontrado'; end if;
  select * into p from public.ppps where id=v.ppp_id;
  if not app.usuario_gerencia_fluxo_ppp(p.rede_ensino_id) then raise exception 'Sem permissao para validar PPPs desta rede'; end if;
  if v.situacao <> 'em_validacao' then raise exception 'O PPP nao esta aguardando validacao'; end if;
  update public.versoes_ppp set situacao='validado' where id=v.id;
  insert into public.pareceres_validacao_ppp(versao_ppp_id,tipo,texto,registrado_por) values(v.id,'validacao',trim(coalesce(parecer,'')),auth.uid());
  insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id) values(v.id,'validado',case when trim(coalesce(parecer,''))='' then 'PPP validado institucionalmente.' else trim(parecer) end,auth.uid());
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao) values(p.rede_ensino_id,auth.uid(),'validar_ppp','versoes_ppp',v.id,v.protocolo);
  return jsonb_build_object('ok',true,'protocolo',v.protocolo,'situacao','validado');
end;
$$;

create or replace function public.devolver_ppp_para_correcao(protocolo_busca text, parecer text)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; texto text:=trim(coalesce(parecer,''));
begin
  if length(texto) < 3 then raise exception 'Informe o parecer para devolver o PPP'; end if;
  select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update;
  if not found then raise exception 'PPP nao encontrado'; end if;
  select * into p from public.ppps where id=v.ppp_id;
  if not app.usuario_gerencia_fluxo_ppp(p.rede_ensino_id) then raise exception 'Sem permissao para devolver PPPs desta rede'; end if;
  if v.situacao not in ('em_validacao','validado') then raise exception 'O PPP nao pode ser devolvido nesta situacao'; end if;
  update public.versoes_ppp set situacao='rascunho' where id=v.id;
  insert into public.pareceres_validacao_ppp(versao_ppp_id,tipo,texto,registrado_por) values(v.id,'devolucao',texto,auth.uid());
  insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id) values(v.id,'devolvido_para_correcao',texto,auth.uid());
  insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao) values(p.rede_ensino_id,auth.uid(),'devolver_ppp','versoes_ppp',v.id,v.protocolo);
  return jsonb_build_object('ok',true,'protocolo',v.protocolo,'situacao','rascunho','parecer',texto);
end;
$$;

create or replace function public.concluir_ppp(versao_ppp_destino_id uuid,revisao_esperada bigint)
returns table(situacao text,revisao_congelada_id uuid,iniciado_assinatura_em timestamptz)
language plpgsql security definer set search_path=public,app as $$
declare usuario_id uuid:=auth.uid(); versao public.versoes_ppp%rowtype; documento public.ppps%rowtype; escola public.escolas%rowtype; revisao public.revisoes_ppp%rowtype; identificacao public.identificacoes_ppp%rowtype; momento timestamptz:=now();
begin
 if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
 select * into versao from public.versoes_ppp where id=versao_ppp_destino_id for update; if not found then raise exception 'PPP nao encontrado'; end if;
 if versao.situacao <> 'validado' then raise exception 'Este PPP precisa ser validado antes da conclusao'; end if;
 select * into documento from public.ppps where id=versao.ppp_id; select * into escola from public.escolas where id=documento.escola_id;
 if not app.pode_acessar(documento.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then raise exception 'Sem permissao para concluir este PPP'; end if;
 select * into revisao from public.revisoes_ppp where id=versao.revisao_atual_id; if revisao.numero<>revisao_esperada then raise exception 'O rascunho foi alterado por outra sessao'; end if;
 select * into identificacao from public.identificacoes_ppp where revisao_ppp_id=revisao.id;
 update public.versoes_ppp set situacao='em_assinatura',revisao_congelada_id=revisao.id,iniciado_assinatura_em=momento where id=versao.id;
 insert into public.participantes_ppp(versao_ppp_id,papel,segmento,nome) values(versao.id,'direcao','Direcao escolar',coalesce(identificacao.direcao_nome,'')) on conflict do nothing;
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id,ocorrido_em) values(versao.id,'concluido_para_assinatura','Revisao congelada e encaminhada para assinatura.',usuario_id,momento);
 insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao,ocorrido_em) values(documento.rede_ensino_id,usuario_id,'concluir_ppp','versoes_ppp',versao.id,'Revisao congelada para assinatura.',momento);
 return query select 'em_assinatura'::text,revisao.id,momento;
end;
$$;

grant execute on function app.usuario_gerencia_fluxo_ppp(uuid) to authenticated;
grant execute on function public.enviar_ppp_para_validacao(text),public.validar_ppp_rede(text,text),public.devolver_ppp_para_correcao(text,text) to authenticated;
commit;
