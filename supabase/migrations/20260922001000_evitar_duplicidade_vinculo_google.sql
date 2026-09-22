-- Evita duplicar vínculo quando a sessão é restaurada mais de uma vez.
create or replace function app.sincronizar_acesso_usuario(usuario_destino_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare usuario auth.users%rowtype; provisionamento public.provisionamentos_acesso%rowtype;
begin
  select * into usuario from auth.users where id=usuario_destino_id;
  if not found then return; end if;
  insert into public.perfis_usuarios(id,nome_exibicao,email)
  values(usuario.id,coalesce(usuario.raw_user_meta_data->>'full_name',usuario.raw_user_meta_data->>'display_name',''),lower(coalesce(usuario.email,'')))
  on conflict(id) do update set email=excluded.email,nome_exibicao=coalesce(nullif(excluded.nome_exibicao,''),public.perfis_usuarios.nome_exibicao);
  select * into provisionamento from public.provisionamentos_acesso where email=lower(coalesce(usuario.email,''));
  if found and not exists (select 1 from public.vinculos_usuarios v where v.usuario_id=usuario.id and v.rede_ensino_id=provisionamento.rede_ensino_id and v.escola_id is not distinct from provisionamento.escola_id and v.papel=provisionamento.papel and v.revogado_em is null) then
    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(usuario.id,provisionamento.rede_ensino_id,provisionamento.regional_ensino_id,provisionamento.escola_id,provisionamento.papel);
  end if;
  if found then update public.provisionamentos_acesso set utilizado_em=now() where id=provisionamento.id; end if;
end; $$;
