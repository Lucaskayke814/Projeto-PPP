-- Base relacional para ata e assinatura da direcao. O arquivo permanece no Storage.
begin;
alter table public.participantes_ppp add column if not exists assinado_por uuid references public.perfis_usuarios(id) on delete restrict;
create table public.atas_reunioes_aprovacao_ppp (
 id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
 arquivo_ppp_id uuid not null references public.arquivos_ppp(id) on delete restrict, data_reuniao date not null,
 identificacao text not null default '', substitui_ata_id uuid references public.atas_reunioes_aprovacao_ppp(id) on delete restrict,
 registrada_por uuid not null references public.perfis_usuarios(id) on delete restrict, registrada_em timestamptz not null default now(), substituida_em timestamptz
);
create unique index atas_reunioes_aprovacao_ppp_ativa_unica on public.atas_reunioes_aprovacao_ppp(versao_ppp_id) where substituida_em is null;
alter table public.atas_reunioes_aprovacao_ppp enable row level security;
create policy "ata de ppp acessivel" on public.atas_reunioes_aprovacao_ppp for select to authenticated using (exists(select 1 from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id where v.id=versao_ppp_id and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id)));

create or replace function public.assinar_direcao_ppp(protocolo_busca text, atesto boolean)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; e public.escolas%rowtype; direcao public.participantes_ppp%rowtype; ata_existe boolean; membros integer; agora timestamptz:=now();
begin
 if not atesto then raise exception 'O atesto de veracidade e obrigatorio'; end if;
 select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update; if not found then raise exception 'PPP nao encontrado'; end if;
 select * into p from public.ppps where id=v.ppp_id; select * into e from public.escolas where id=p.escola_id;
 if not app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id,true) then raise exception 'Sem permissao para assinar este PPP'; end if;
 if v.situacao <> 'em_assinatura' then raise exception 'O PPP nao esta em coleta de assinaturas'; end if;
 select exists(select 1 from public.atas_reunioes_aprovacao_ppp where versao_ppp_id=v.id and substituida_em is null) into ata_existe;
 if not ata_existe then raise exception 'Anexe a ata da reuniao antes de assinar'; end if;
 select count(*) into membros from public.participantes_ppp where versao_ppp_id=v.id and papel='colegiado' and removido_em is null;
 if membros=0 then raise exception 'Registre os membros presentes antes de assinar'; end if;
 select * into direcao from public.participantes_ppp where versao_ppp_id=v.id and papel='direcao' and removido_em is null for update;
 if not found then raise exception 'Participante da direcao nao encontrado'; end if;
 if direcao.assinado_em is not null then raise exception 'A direcao ja assinou este PPP'; end if;
 update public.participantes_ppp set assinado_em=agora,assinado_por=auth.uid() where id=direcao.id;
 update public.versoes_ppp set situacao='enviado_homologacao' where id=v.id;
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id,ocorrido_em) values(v.id,'assinado_pela_direcao','Direcao assinou e encaminhou o PPP para homologacao.',auth.uid(),agora);
 insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao,ocorrido_em) values(p.rede_ensino_id,auth.uid(),'assinar_direcao_ppp','versoes_ppp',v.id,v.protocolo,agora);
 return jsonb_build_object('ok',true,'protocolo',v.protocolo,'situacao','enviado_homologacao','assinadoEm',to_char(agora at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'));
end;
$$;
grant execute on function public.assinar_direcao_ppp(text,boolean) to authenticated;
commit;
