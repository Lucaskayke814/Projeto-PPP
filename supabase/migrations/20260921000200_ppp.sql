-- Documento, workflow e evidências. Narrativas e campos variáveis ficam em JSONB versionado.

create table public.ppps (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  school_id uuid not null,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id, network_id) references public.schools(id, network_id) on delete restrict,
  unique (id, network_id)
);

create table public.ppp_versions (
  id uuid primary key default gen_random_uuid(),
  ppp_id uuid not null references public.ppps(id) on delete restrict,
  network_id uuid not null references public.networks(id) on delete restrict,
  number integer not null check (number > 0),
  protocol text not null unique check (protocol ~ '^PPP-[0-9]{4}-[A-Z0-9-]+$'),
  predecessor_id uuid,
  status text not null default 'draft' check (status in ('draft', 'signature_collection', 'signed', 'completed', 'sent_for_homologation', 'homologated')),
  current_revision_id uuid,
  sealed_revision_id uuid,
  concluded_at timestamptz,
  review_due_on date,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ppp_id, network_id) references public.ppps(id, network_id) on delete restrict,
  unique (ppp_id, number),
  unique (id, ppp_id),
  unique (id, network_id)
);
create index ppp_versions_panel_idx on public.ppp_versions(network_id, status, updated_at desc);

create table public.ppp_revisions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.ppp_versions(id) on delete restrict,
  number bigint not null check (number > 0),
  content_release_id uuid not null references public.content_releases(id) on delete restrict,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (version_id, number),
  unique (id, version_id)
);
create index ppp_revisions_version_idx on public.ppp_revisions(version_id, number desc);

alter table public.ppp_versions
  add foreign key (current_revision_id, id) references public.ppp_revisions(id, version_id) deferrable initially deferred,
  add foreign key (sealed_revision_id, id) references public.ppp_revisions(id, version_id) deferrable initially deferred,
  add foreign key (predecessor_id, ppp_id) references public.ppp_versions(id, ppp_id) on delete restrict;

create table public.ppp_progress (
  version_id uuid primary key references public.ppp_versions(id) on delete restrict,
  screen_key text not null default 't00',
  tasks jsonb not null default '{}'::jsonb check (jsonb_typeof(tasks) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

-- Participante guarda convite, assinatura e ressalva. Não há dados de estudante individual.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.ppp_versions(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete restrict,
  role text not null check (role in ('direction', 'board_member')),
  segment text,
  name text not null default '',
  email text not null default '' check (email = lower(email)),
  masp text,
  invitation_token_hash text unique check (invitation_token_hash is null or invitation_token_hash ~ '^[a-f0-9]{64}$'),
  invitation_expires_at timestamptz,
  invited_at timestamptz,
  signed_at timestamptz,
  sealed_revision_id uuid references public.ppp_revisions(id) on delete restrict,
  reservation text check (reservation is null or length(trim(reservation)) between 3 and 10000),
  removed_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((signed_at is null and sealed_revision_id is null) or (signed_at is not null and sealed_revision_id is not null))
);
create unique index participants_direction_once on public.participants(version_id) where role = 'direction' and removed_at is null;
create unique index participants_active_email on public.participants(version_id, email) where email <> '' and removed_at is null;

-- Metadados somente; bytes vão para o bucket privado ppp-private.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.ppp_versions(id) on delete restrict,
  kind text not null check (kind in ('preview_pdf', 'sealed_html', 'sealed_pdf', 'signed_pdf', 'minutes', 'attachment', 'homologation_evidence')),
  object_key text not null unique,
  original_name text not null check (length(trim(original_name)) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index files_version_kind_idx on public.files(version_id, kind) where withdrawn_at is null;

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.ppp_versions(id) on delete restrict,
  type text not null check (type in ('created', 'concluded', 'direction_signed', 'member_invited', 'member_signed', 'reservation_registered', 'minutes_registered', 'attachment_registered', 'sent_for_homologation', 'homologated', 'new_version_started')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  actor_id uuid references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now()
);
create index workflow_events_version_idx on public.workflow_events(version_id, occurred_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);
create index audit_events_network_idx on public.audit_events(network_id, occurred_at desc);

create trigger ppps_touch before update on public.ppps for each row execute procedure app.touch_updated_at();
create trigger versions_touch before update on public.ppp_versions for each row execute procedure app.touch_updated_at();
create trigger progress_touch before update on public.ppp_progress for each row execute procedure app.touch_updated_at();
create trigger participants_touch before update on public.participants for each row execute procedure app.touch_updated_at();
