begin;
create unique index if not exists participantes_ppp_colegiado_ativo_unico on public.participantes_ppp(versao_ppp_id,lower(email)) where papel='colegiado' and removido_em is null;
create or replace function public.assinar_ppp_como_colegiado(protocolo_busca text, aceite boolean)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; participante public.participantes_ppp%rowtype; agora timestamptz:=now();
begin
 if not aceite then raise exception 'O aceite e obrigatorio'; end if;
 select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update; if not found then raise exception 'PPP nao encontrado'; end if;
 select * into p from public.ppps where id=v.ppp_id;
 if v.situacao not in ('em_assinatura','enviado_homologacao') or not app.usuario_assina_colegiado(p.escola_id) then raise exception 'Sem permissao para assinar este PPP'; end if;
 select q.* into participante from public.participantes_ppp q join public.perfis_usuarios u on u.email=q.email where q.versao_ppp_id=v.id and q.papel='colegiado' and q.removido_em is null and u.id=auth.uid() for update;
 if not found then raise exception 'Sua presenca nao foi registrada para este PPP'; end if;
 if participante.assinado_em is not null then raise exception 'Este participante ja assinou'; end if;
 update public.participantes_ppp set assinado_em=agora,assinado_por=auth.uid() where id=participante.id;
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id,ocorrido_em) values(v.id,'assinado_pelo_colegiado','Membro do Colegiado assinou o PPP.',auth.uid(),agora);
 return jsonb_build_object('ok',true,'assinadoEm',to_char(agora at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'status',v.situacao);
end;
$$;
commit;
