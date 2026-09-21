-- Conta exclusivamente para testes no ambiente de desenvolvimento.
do $$
declare
  usuario_id uuid;
  rede_id uuid;
  escola_id uuid;
begin
  select id into usuario_id from auth.users where email = 'lucas@gmail.com';
  if usuario_id is null then raise exception 'Usuário de teste não foi criado no Supabase Auth'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = usuario_id;
  select id into rede_id from public.redes where code = 'demonstracao';
  select id into escola_id from public.escolas where network_id = rede_id and inep = '31123456';
  if not exists (select 1 from public.perfis_usuario where id = usuario_id) then
    raise exception 'Perfil de aplicação não foi criado para o usuário de teste';
  end if;
  insert into public.vinculos_usuario (user_id, network_id, school_id, role)
  values (usuario_id, rede_id, escola_id, 'school_editor')
  on conflict do nothing;
end $$;
