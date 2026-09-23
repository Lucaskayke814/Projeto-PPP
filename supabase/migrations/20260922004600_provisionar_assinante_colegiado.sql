begin;
create or replace function public.salvar_provisionamento_acesso(email_destino text,papel_destino text,rede_destino_id uuid,regional_destino_id uuid default null,escola_destino_id uuid default null,nome_destino text default '') returns uuid language plpgsql security definer set search_path=public,app,auth as $$
declare id_provisionamento uuid; usuario_existente_id uuid;
begin
 if not app.usuario_administra_acessos(rede_destino_id) then raise exception 'Sem permissao para administrar acessos desta rede'; end if;
 if lower(trim(email_destino)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-mail invalido'; end if;
 if papel_destino not in ('editor_escola','assinante_colegiado','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos','gestor_ppp_rede') then raise exception 'Papel invalido'; end if;
 if papel_destino='assinante_colegiado' and escola_destino_id is null then raise exception 'O assinante do Colegiado precisa estar vinculado a uma escola'; end if;
 if escola_destino_id is not null then regional_destino_id:=null; end if;
 insert into public.provisionamentos_acesso(email,nome_convidado,rede_ensino_id,regional_ensino_id,escola_id,papel,revogado_em,revogado_por) values(lower(trim(email_destino)),trim(coalesce(nome_destino,'')),rede_destino_id,regional_destino_id,escola_destino_id,papel_destino,null,null) on conflict (email,papel,rede_ensino_id,(coalesce(regional_ensino_id,'00000000-0000-0000-0000-000000000000'::uuid)),(coalesce(escola_id,'00000000-0000-0000-0000-000000000000'::uuid))) do update set nome_convidado=excluded.nome_convidado,revogado_em=null,revogado_por=null,atualizado_em=now() returning id into id_provisionamento;
 select id into usuario_existente_id from auth.users where lower(email)=lower(trim(email_destino)); if usuario_existente_id is not null then perform app.sincronizar_acesso_usuario(usuario_existente_id); end if;
 insert into public.eventos_auditoria(rede_ensino_id,responsavel_id,acao,entidade,entidade_id,descricao) values(rede_destino_id,auth.uid(),'acesso_provisionado','provisionamento_acesso',id_provisionamento,'Acesso provisionado para '||lower(trim(email_destino)));
 return id_provisionamento;
end; $$;
grant execute on function public.salvar_provisionamento_acesso(text,text,uuid,uuid,uuid,text) to authenticated;
commit;
