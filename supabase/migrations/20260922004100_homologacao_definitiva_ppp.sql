-- Homologacao definitiva. A assinatura e o encaminhamento sao pre-condicoes;
-- esta rotina nunca altera uma versao homologada.
begin;
create table public.homologacoes_ppp (
  id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null unique references public.versoes_ppp(id) on delete restrict,
  homologado_por uuid not null references public.perfis_usuarios(id) on delete restrict,
  homologado_em timestamptz not null default now(), observacao text not null default ''
);
alter table public.homologacoes_ppp enable row level security;
create policy "homologacao de ppp acessivel" on public.homologacoes_ppp for select to authenticated using (
 exists(select 1 from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id where v.id=versao_ppp_id and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id))
);
create or replace function public.homologar_ppp_rede(protocolo_busca text, confirmar_sem_assinaturas boolean default false)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; pendentes jsonb; total integer; assinadas integer; momento timestamptz:=now();
begin
 select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update;
 if not found then raise exception 'PPP nao encontrado'; end if;
 select * into p from public.ppps where id=v.ppp_id;
 if not app.usuario_gerencia_fluxo_ppp(p.rede_ensino_id) then raise exception 'Sem permissao para homologar PPPs desta rede'; end if;
 if v.situacao not in ('concluido','enviado_homologacao') then raise exception 'O PPP precisa estar encaminhado para homologacao'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('nome',nome,'segmento',segmento,'direcao',papel='direcao') order by papel, nome),'[]'::jsonb),count(*) into pendentes,total from public.participantes_ppp where versao_ppp_id=v.id and removido_em is null and assinado_em is null;
 select count(*) into assinadas from public.participantes_ppp where versao_ppp_id=v.id and removido_em is null and assinado_em is not null;
 if jsonb_array_length(pendentes)>0 and not confirmar_sem_assinaturas then return jsonb_build_object('ok',false,'faltamAssinaturas',true,'pendentes',pendentes,'total',total,'assinadas',assinadas); end if;
 update public.versoes_ppp set situacao='homologado' where id=v.id;
 insert into public.homologacoes_ppp(versao_ppp_id,homologado_por,homologado_em) values(v.id,auth.uid(),momento);
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id,ocorrido_em) values(v.id,'homologado','Homologacao institucional definitiva registrada.',auth.uid(),momento);
 insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao,ocorrido_em) values(p.rede_ensino_id,auth.uid(),'homologar_ppp','versoes_ppp',v.id,v.protocolo,momento);
 return jsonb_build_object('ok',true,'protocolo',v.protocolo,'situacao','homologado','total',total,'assinadas',assinadas,'registro',jsonb_build_object('homolEm',to_char(momento at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')));
end;
$$;
grant execute on function public.homologar_ppp_rede(text,boolean) to authenticated;
commit;
