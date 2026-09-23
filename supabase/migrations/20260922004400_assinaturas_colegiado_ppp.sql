-- Participacao e assinatura do Colegiado Escolar, sempre restritas a escola vinculada.
begin;
alter table public.vinculos_usuarios drop constraint if exists vinculos_usuarios_papel_check;
alter table public.vinculos_usuarios add constraint vinculos_usuarios_papel_check check (papel in ('editor_escola','assinante_colegiado','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos','gestor_ppp_rede'));
alter table public.provisionamentos_acesso drop constraint if exists provisionamentos_acesso_papel_check;
alter table public.provisionamentos_acesso add constraint provisionamentos_acesso_papel_check check (papel in ('editor_escola','assinante_colegiado','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos','gestor_ppp_rede'));
create or replace function app.usuario_assina_colegiado(escola_destino_id uuid)
returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null and exists(select 1 from public.vinculos_usuarios v where v.usuario_id=auth.uid() and v.escola_id=escola_destino_id and v.papel='assinante_colegiado' and v.revogado_em is null); $$;
create or replace function public.listar_colegiado_da_folha(protocolo_busca text)
returns jsonb language sql stable security definer set search_path=public,app as $$
 select coalesce((select jsonb_build_object('ok',true,'membros',coalesce(jsonb_agg(jsonb_build_object('email',perfil.email,'nome',perfil.nome_exibicao,'segmento',coalesce(participante.segmento,''),'masp',coalesce(participante.masp,''),'presente',participante.id is not null,'assinadoEm',case when participante.assinado_em is null then '' else to_char(participante.assinado_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') end) order by perfil.nome_exibicao),'[]'::jsonb)) from public.versoes_ppp v join public.ppps p on p.id=v.ppp_id join public.escolas e on e.id=p.escola_id join public.vinculos_usuarios vinculo on vinculo.escola_id=e.id and vinculo.papel='assinante_colegiado' and vinculo.revogado_em is null join public.perfis_usuarios perfil on perfil.id=vinculo.usuario_id left join public.participantes_ppp participante on participante.versao_ppp_id=v.id and lower(participante.email)=perfil.email and participante.papel='colegiado' and participante.removido_em is null where upper(v.protocolo)=upper(trim(protocolo_busca)) and app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id)),'{}'::jsonb); $$;
create or replace function public.registrar_presenca_colegiado(protocolo_busca text, emails_presentes text[])
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; e public.escolas%rowtype; email_item text; quantidade integer;
begin
 select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update; if not found then raise exception 'PPP nao encontrado'; end if; select * into p from public.ppps where id=v.ppp_id; select * into e from public.escolas where id=p.escola_id;
 if v.situacao<>'em_assinatura' or not app.pode_acessar(p.rede_ensino_id,e.regional_ensino_id,e.id,true) then raise exception 'Sem permissao para registrar presenca'; end if;
 if coalesce(array_length(emails_presentes,1),0)=0 then raise exception 'Marque ao menos um membro presente'; end if;
 foreach email_item in array emails_presentes loop
  if not exists(select 1 from public.vinculos_usuarios x join public.perfis_usuarios u on u.id=x.usuario_id where x.escola_id=e.id and x.papel='assinante_colegiado' and x.revogado_em is null and u.email=lower(trim(email_item))) then raise exception 'Membro do Colegiado invalido'; end if;
  insert into public.participantes_ppp(versao_ppp_id,papel,segmento,nome,email) select v.id,'colegiado','Colegiado Escolar',u.nome_exibicao,u.email from public.vinculos_usuarios x join public.perfis_usuarios u on u.id=x.usuario_id where x.escola_id=e.id and x.papel='assinante_colegiado' and x.revogado_em is null and u.email=lower(trim(email_item)) on conflict do nothing;
 end loop;
 update public.participantes_ppp set removido_em=now() where versao_ppp_id=v.id and papel='colegiado' and removido_em is null and assinado_em is null and not(lower(email)=any(select lower(unnest(emails_presentes))));
 select count(*) into quantidade from public.participantes_ppp where versao_ppp_id=v.id and papel='colegiado' and removido_em is null;
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id) values(v.id,'presenca_colegiado_registrada',quantidade::text || ' membro(s) presente(s).',auth.uid());
 return jsonb_build_object('ok',true,'presentes',quantidade);
end;
$$;
create or replace function public.assinar_ppp_como_colegiado(protocolo_busca text, aceite boolean)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v public.versoes_ppp%rowtype; p public.ppps%rowtype; participante public.participantes_ppp%rowtype; agora timestamptz:=now();
begin
 if not aceite then raise exception 'O aceite e obrigatorio'; end if; select * into v from public.versoes_ppp where upper(protocolo)=upper(trim(protocolo_busca)) for update; if not found then raise exception 'PPP nao encontrado'; end if; select * into p from public.ppps where id=v.ppp_id;
 if v.situacao not in ('em_assinatura','enviado_homologacao') or not app.usuario_assina_colegiado(p.escola_id) then raise exception 'Sem permissao para assinar este PPP'; end if;
 select * into participante from public.participantes_ppp q join public.perfis_usuarios u on u.email=q.email where q.versao_ppp_id=v.id and q.papel='colegiado' and q.removido_em is null and u.id=auth.uid() for update;
 if not found then raise exception 'Sua presenca nao foi registrada para este PPP'; end if; if participante.assinado_em is not null then raise exception 'Este participante ja assinou'; end if;
 update public.participantes_ppp set assinado_em=agora,assinado_por=auth.uid() where id=participante.id;
 insert into public.eventos_ppp(versao_ppp_id,tipo,descricao,responsavel_id,ocorrido_em) values(v.id,'assinado_pelo_colegiado','Membro do Colegiado assinou o PPP.',auth.uid(),agora);
 return jsonb_build_object('ok',true,'assinadoEm',to_char(agora at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'status',v.situacao);
end;
$$;
grant execute on function app.usuario_assina_colegiado(uuid) to authenticated;
grant execute on function public.listar_colegiado_da_folha(text),public.registrar_presenca_colegiado(text,text[]),public.assinar_ppp_como_colegiado(text,boolean) to authenticated;
commit;
