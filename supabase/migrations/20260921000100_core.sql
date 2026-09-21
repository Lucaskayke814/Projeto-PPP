-- Núcleo simples e extensível do Gerador de PPP.
-- Auth e senhas pertencem ao Supabase Auth; este schema não guarda credenciais.

create extension if not exists pgcrypto;
create schema if not exists app;
revoke all on schema app from public;

create table public.networks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,63}$'),
  name text not null check (length(trim(name)) >= 3),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.regionals (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_-]{2,63}$'),
  name text not null check (length(trim(name)) >= 3),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, code),
  unique (id, network_id)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  regional_id uuid not null,
  inep text not null check (inep ~ '^[0-9]{8}$'),
  name text not null check (length(trim(name)) >= 3),
  municipality text not null check (length(trim(municipality)) >= 2),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (regional_id, network_id) references public.regionals(id, network_id) on delete restrict,
  unique (network_id, inep),
  unique (id, network_id)
);
create index schools_regional_idx on public.schools(regional_id) where archived_at is null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '' check (email = lower(email)),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um vínculo pode ser da rede inteira, de uma regional ou de uma escola.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  network_id uuid not null references public.networks(id) on delete restrict,
  regional_id uuid,
  school_id uuid,
  role text not null check (role in ('school_editor', 'regional_viewer', 'central_viewer', 'content_curator', 'access_admin')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (regional_id, network_id) references public.regionals(id, network_id) on delete restrict,
  foreign key (school_id, network_id) references public.schools(id, network_id) on delete restrict,
  check (not (regional_id is not null and school_id is not null))
);
create unique index memberships_active_scope_unique on public.memberships(user_id, network_id, role, coalesce(regional_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)) where revoked_at is null;

-- Publicação é o snapshot institucional usado por uma versão de PPP.
create table public.content_releases (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  number integer not null check (number > 0),
  form_version integer not null default 1 check (form_version > 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (network_id, number),
  unique (id, network_id)
);

create table public.network_settings (
  network_id uuid primary key references public.networks(id) on delete restrict,
  active_release_id uuid not null,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now(),
  foreign key (active_release_id, network_id) references public.content_releases(id, network_id) on delete restrict
);

-- Catálogos são dados configuráveis; cada publicação grava o snapshot usado em content_releases.content.
create table public.catalogs (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  description text not null
);

create table public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null references public.catalogs(code) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null,
  position integer not null default 0 check (position >= 0),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  archived_at timestamptz,
  unique (catalog_code, key)
);
create index catalog_options_catalog_idx on public.catalog_options(catalog_code, position) where archived_at is null;

create or replace function app.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function app.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), lower(coalesce(new.email, '')))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users for each row execute procedure app.create_profile();
create trigger networks_touch before update on public.networks for each row execute procedure app.touch_updated_at();
create trigger regionals_touch before update on public.regionals for each row execute procedure app.touch_updated_at();
create trigger schools_touch before update on public.schools for each row execute procedure app.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute procedure app.touch_updated_at();
