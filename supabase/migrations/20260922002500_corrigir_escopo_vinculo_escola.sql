-- O vínculo de uma escola é suficiente para delimitar a regional. A tabela
-- impede os dois escopos ao mesmo tempo, portanto o escopo regional deve ser
-- nulo quando a pessoa está vinculada a uma escola específica.
create or replace function app.sincronizar_acesso_usuario(usuario_destino_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare
  usuario auth.users%rowtype;
  provisionamento public.provisionamentos_acesso%rowtype;
  regional_destino uuid;
begin
  select * into usuario from auth.users where id=usuario_destino_id;
  if not found then return; end if;

  insert into public.perfis_usuarios(id,nome_exibicao,email)
  values(
    usuario.id,
    coalesce(usuario.raw_user_meta_data->>'full_name',usuario.raw_user_meta_data->>'display_name',''),
    lower(coalesce(usuario.email,''))
  )
  on conflict(id) do update
    set email=excluded.email,
        nome_exibicao=coalesce(nullif(excluded.nome_exibicao,''),public.perfis_usuarios.nome_exibicao);

  select * into provisionamento
    from public.provisionamentos_acesso
   where email=lower(coalesce(usuario.email,''));

  if found then
    regional_destino := case
      when provisionamento.escola_id is null then provisionamento.regional_ensino_id
      else null
    end;

    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(
      usuario.id,
      provisionamento.rede_ensino_id,
      regional_destino,
      provisionamento.escola_id,
      provisionamento.papel
    )
    on conflict do nothing;

    update public.provisionamentos_acesso
       set utilizado_em=coalesce(utilizado_em,now())
     where id=provisionamento.id;
  end if;
end;
$$;
