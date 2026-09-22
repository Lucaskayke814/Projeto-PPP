-- A criação de conta no Auth não pode falhar por provisionamento complementar.
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
  if found then
    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(usuario.id,provisionamento.rede_ensino_id,provisionamento.regional_ensino_id,provisionamento.escola_id,provisionamento.papel);
    update public.provisionamentos_acesso set utilizado_em=now() where id=provisionamento.id;
  end if;
end; $$;

create or replace function app.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path=public,app as $$
begin
  begin
    perform app.sincronizar_acesso_usuario(new.id);
  exception when others then
    -- O Auth deve concluir a conta mesmo se o provisionamento precisar de reparo.
    raise warning 'Não foi possível provisionar o usuário %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

create or replace function public.sincronizar_meu_acesso()
returns void language plpgsql security definer set search_path=public,app as $$
begin
  if auth.uid() is null then raise exception 'Autenticacao obrigatoria'; end if;
  perform app.sincronizar_acesso_usuario(auth.uid());
end; $$;
grant execute on function public.sincronizar_meu_acesso() to authenticated;
