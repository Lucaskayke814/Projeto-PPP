-- Provisiona acessos de desenvolvimento antes da primeira entrada pelo Supabase Auth.
create table public.provisionamentos_acesso (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check(email = lower(email)),
  rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  regional_ensino_id uuid references public.regionais_ensino(id) on delete restrict,
  escola_id uuid references public.escolas(id) on delete restrict,
  papel text not null check(papel in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos')),
  criado_em timestamptz not null default now(),
  utilizado_em timestamptz
);

create or replace function app.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path=public as $$
declare provisionamento public.provisionamentos_acesso%rowtype;
begin
  insert into public.perfis_usuarios(id,nome_exibicao,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'display_name',''),lower(coalesce(new.email,'')))
  on conflict(id) do update set email=excluded.email, nome_exibicao=coalesce(nullif(excluded.nome_exibicao,''),public.perfis_usuarios.nome_exibicao);

  select * into provisionamento from public.provisionamentos_acesso where email=lower(coalesce(new.email,''));
  if found then
    insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
    values(new.id,provisionamento.rede_ensino_id,provisionamento.regional_ensino_id,provisionamento.escola_id,provisionamento.papel)
    on conflict do nothing;
    update public.provisionamentos_acesso set utilizado_em=now() where id=provisionamento.id;
  end if;
  return new;
end; $$;

insert into public.provisionamentos_acesso(email,rede_ensino_id,regional_ensino_id,escola_id,papel)
select 'lucaskayke06@gmail.com', r.id, rg.id, e.id, 'editor_escola'
from public.redes_ensino r
join public.regionais_ensino rg on rg.rede_ensino_id=r.id and rg.codigo='divinopolis'
join public.escolas e on e.rede_ensino_id=r.id and e.regional_ensino_id=rg.id and e.codigo_inep='31123456'
where r.codigo='demonstracao'
on conflict(email) do update set rede_ensino_id=excluded.rede_ensino_id,regional_ensino_id=excluded.regional_ensino_id,escola_id=excluded.escola_id,papel=excluded.papel;

-- Se a conta já existir, aplica o vínculo imediatamente.
insert into public.perfis_usuarios(id,nome_exibicao,email)
select id,coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'display_name',''),lower(email)
from auth.users where lower(email)='lucaskayke06@gmail.com'
on conflict(id) do update set email=excluded.email;
insert into public.vinculos_usuarios(usuario_id,rede_ensino_id,regional_ensino_id,escola_id,papel)
select u.id,p.rede_ensino_id,p.regional_ensino_id,p.escola_id,p.papel
from auth.users u join public.provisionamentos_acesso p on p.email=lower(u.email)
where lower(u.email)='lucaskayke06@gmail.com'
on conflict do nothing;
