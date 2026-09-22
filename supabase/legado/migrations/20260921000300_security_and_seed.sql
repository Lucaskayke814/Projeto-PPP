-- Segurança, RPCs mínimas e catálogos iniciais do protótipo.

create or replace function app.can_access(target_network uuid, target_regional uuid default null, target_school uuid default null, editing boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.network_id = target_network and m.revoked_at is null
      and (
        (not editing and m.role in ('central_viewer', 'content_curator', 'access_admin'))
        or (not editing and m.role = 'regional_viewer' and (m.regional_id is null or m.regional_id = target_regional))
        or (m.role = 'school_editor' and (m.school_id = target_school or (m.school_id is null and m.regional_id = target_regional)))
      )
  );
$$;

-- Leitura de catálogos e publicações é permitida a qualquer membro ativo da rede.
create or replace function app.has_network_membership(target_network uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.network_id = target_network
      and m.revoked_at is null
  );
$$;

create or replace function app.prevent_history_change()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Registro histórico é imutável' using errcode = '55000'; end;
$$;

create or replace function app.validate_revision_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.ppp_versions v join public.content_releases r on r.id = new.content_release_id
    where v.id = new.version_id and v.network_id = r.network_id
  ) then raise exception 'Revisão e conteúdo pertencem a redes diferentes' using errcode = '23514'; end if;
  return new;
end;
$$;

create or replace function app.validate_participant_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sealed_revision_id is not null and not exists (
    select 1 from public.ppp_revisions r where r.id = new.sealed_revision_id and r.version_id = new.version_id
  ) then raise exception 'Assinatura deve referenciar a revisão selada da própria versão' using errcode = '23514'; end if;
  return new;
end;
$$;

create trigger revisions_are_immutable before update or delete on public.ppp_revisions for each row execute procedure app.prevent_history_change();
create trigger workflow_is_immutable before update or delete on public.workflow_events for each row execute procedure app.prevent_history_change();
create trigger audit_is_immutable before update or delete on public.audit_events for each row execute procedure app.prevent_history_change();
create trigger revision_scope before insert on public.ppp_revisions for each row execute procedure app.validate_revision_scope();
create trigger participant_scope before insert or update on public.participants for each row execute procedure app.validate_participant_scope();

alter table public.networks enable row level security;
alter table public.regionals enable row level security;
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.content_releases enable row level security;
alter table public.network_settings enable row level security;
alter table public.catalogs enable row level security;
alter table public.catalog_options enable row level security;
alter table public.ppps enable row level security;
alter table public.ppp_versions enable row level security;
alter table public.ppp_revisions enable row level security;
alter table public.ppp_progress enable row level security;
alter table public.participants enable row level security;
alter table public.files enable row level security;
alter table public.workflow_events enable row level security;
alter table public.audit_events enable row level security;

create policy "profile self" on public.profiles for select to authenticated using (id = auth.uid());
create policy "schools by scope" on public.schools for select to authenticated using (app.can_access(network_id, regional_id, id));
create policy "regionals by scope" on public.regionals for select to authenticated using (app.can_access(network_id, id));
create policy "networks by scope" on public.networks for select to authenticated using (app.can_access(id));
create policy "content by membership" on public.content_releases for select to authenticated using (app.has_network_membership(network_id));
create policy "settings by membership" on public.network_settings for select to authenticated using (app.has_network_membership(network_id));
create policy "catalog definitions" on public.catalogs for select to authenticated using (true);
create policy "catalog options" on public.catalog_options for select to authenticated using (true);
create policy "versions by scope" on public.ppp_versions for select to authenticated using (exists (select 1 from public.ppps p join public.schools s on s.id = p.school_id where p.id = ppp_versions.ppp_id and app.can_access(ppp_versions.network_id, s.regional_id, s.id)));
create policy "ppps by scope" on public.ppps for select to authenticated using (exists (select 1 from public.schools s where s.id = ppps.school_id and app.can_access(ppps.network_id, s.regional_id, s.id)));
create policy "revisions by scope" on public.ppp_revisions for select to authenticated using (exists (
  select 1 from public.ppp_versions v join public.ppps p on p.id = v.ppp_id join public.schools s on s.id = p.school_id
  where v.id = version_id and app.can_access(v.network_id, s.regional_id, s.id)
));
create policy "progress by scope" on public.ppp_progress for select to authenticated using (exists (
  select 1 from public.ppp_versions v join public.ppps p on p.id = v.ppp_id join public.schools s on s.id = p.school_id
  where v.id = version_id and app.can_access(v.network_id, s.regional_id, s.id)
));
create policy "participants by scope" on public.participants for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.ppp_versions v join public.ppps p on p.id = v.ppp_id join public.schools s on s.id = p.school_id
    where v.id = version_id and app.can_access(v.network_id, s.regional_id, s.id)
  )
);
create policy "files by scope" on public.files for select to authenticated using (exists (
  select 1 from public.ppp_versions v join public.ppps p on p.id = v.ppp_id join public.schools s on s.id = p.school_id
  where v.id = version_id and app.can_access(v.network_id, s.regional_id, s.id)
));
create policy "workflow by scope" on public.workflow_events for select to authenticated using (exists (
  select 1 from public.ppp_versions v join public.ppps p on p.id = v.ppp_id join public.schools s on s.id = p.school_id
  where v.id = version_id and app.can_access(v.network_id, s.regional_id, s.id)
));
create policy "audit central" on public.audit_events for select to authenticated using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.network_id = network_id and m.role in ('central_viewer', 'access_admin') and m.revoked_at is null));

grant usage on schema public, app to authenticated;
grant select on public.networks, public.regionals, public.schools, public.profiles, public.content_releases, public.network_settings, public.catalogs, public.catalog_options, public.ppps, public.ppp_versions, public.ppp_revisions, public.ppp_progress, public.participants, public.files, public.workflow_events, public.audit_events to authenticated;
revoke all on function app.can_access(uuid, uuid, uuid, boolean) from public;
revoke all on function app.has_network_membership(uuid) from public;
grant execute on function app.can_access(uuid, uuid, uuid, boolean), app.has_network_membership(uuid) to authenticated;

insert into public.catalogs (code, description) values
 ('stages','Etapas de ensino'),('modalities','Modalidades e formas de oferta'),('infrastructure','Infraestrutura'),('themes','Temas contemporâneos'),('principles','Princípios norteadores'),('methods','Metodologias'),('school_board_segments','Segmentos do Colegiado'),('indicator_metrics','Indicadores educacionais')
on conflict (code) do update set description = excluded.description;

with options(catalog_code,key,label,position) as (values
 ('stages','ei','Educação Infantil',1),('stages','efai','Ensino Fundamental — Anos Iniciais',2),('stages','efaf','Ensino Fundamental — Anos Finais',3),('stages','em','Ensino Médio',4),
 ('modalities','parcial','Ensino regular em tempo parcial',1),('modalities','efti','Ensino Fundamental em Tempo Integral (EFTI)',2),('modalities','emti','Ensino Médio em Tempo Integral (EMTI)',3),('modalities','ept','Educação Profissional Técnica de Nível Médio (EPT)',4),('modalities','esp','Educação Especial',5),('modalities','bilingue','Educação Bilíngue de Surdos',6),('modalities','campo','Educação Escolar do Campo',7),('modalities','ind','Educação Escolar Indígena',8),('modalities','qui','Educação Escolar Quilombola',9),('modalities','eja','Educação de Jovens e Adultos (EJA)',10),('modalities','cesec','Centro Estadual de Educação Continuada (CESEC)',11),('modalities','prisional','Escola no Sistema Prisional',12),('modalities','socio','Escola no Sistema Socioeducativo',13),
 ('infrastructure','salas','Salas de aula',1),('infrastructure','biblio','Biblioteca ou sala de leitura',2),('infrastructure','labinf','Laboratório de informática',3),('infrastructure','labcien','Laboratório de ciências',4),('infrastructure','quadra','Quadra poliesportiva',5),('infrastructure','srm','Sala de recursos multifuncionais',6),('infrastructure','refeit','Refeitório e cozinha',7),('infrastructure','tec','Recursos tecnológicos e internet',8),('infrastructure','acess','Acessibilidade arquitetônica',9),('infrastructure','area','Área verde, horta ou pátio externo',10),('infrastructure','auditorio','Auditório ou espaço de eventos',11),('infrastructure','profs','Sala de professores e de planejamento',12),
 ('themes','ambiental','Educação ambiental e sustentabilidade',1),('themes','financeira','Educação financeira',2),('themes','dh','Direitos humanos',3),('themes','etnico','Relações étnico-raciais e diversidade cultural',4),('themes','digital','Cultura digital e uso responsável das tecnologias',5),('themes','saude','Saúde e qualidade de vida',6),('themes','cidadania','Cidadania e participação social',7),('themes','paz','Prevenção às violências e cultura de paz',8),('themes','vida','Projeto de vida',9),('themes','transito','Educação para o trânsito',10),('themes','etica','Ética, respeito e convivência democrática',11),
 ('principles','integral','Formação integral dos estudantes',1),('principles','inclusiva','Educação inclusiva',2),('principles','equidade','Equidade e justiça social',3),('principles','democratica','Gestão democrática e participativa',4),('principles','diversidade','Valorização da diversidade',5),('principles','antirracista','Educação antirracista',6),('principles','ddhh','Promoção dos direitos humanos',7),('principles','sustentabilidade','Sustentabilidade socioambiental',8),('principles','protagonismo','Protagonismo estudantil',9),('principles','escuta','Diálogo e cultura da escuta',10),('principles','locais','Valorização das culturas locais e regionais',11),('principles','acessibilidade','Acessibilidade',12),('principles','etica2','Ética e responsabilidade',13),('principles','cidada','Educação para a cidadania e convivência democrática',14),
 ('methods','projetos','Projetos interdisciplinares',1),('methods','pesquisa','Pesquisa e práticas investigativas',2),('methods','problemas','Resolução de problemas',3),('methods','oficinas','Oficinas pedagógicas',4),('methods','seminarios','Seminários e apresentações',5),('methods','colaborativa','Aprendizagem colaborativa',6),('methods','casos','Estudos de caso',7),('methods','rodas','Rodas de conversa',8),('methods','ativas','Metodologias ativas',9),('methods','tdic','Uso pedagógico das tecnologias digitais',10),('methods','culturais','Atividades culturais, artísticas e esportivas',11),
 ('school_board_segments','docente','Docente',1),('school_board_segments','administrativo','Servidor administrativo',2),('school_board_segments','responsavel','Pai, mãe ou responsável',3),('school_board_segments','estudante','Estudante',4),('school_board_segments','comunidade','Comunidade',5),
 ('indicator_metrics','mat','Matrículas',1),('indicator_metrics','apr','Aprovação',2),('indicator_metrics','rep','Reprovação',3),('indicator_metrics','aba','Abandono',4),('indicator_metrics','dis','Distorção idade/ano',5)
)
insert into public.catalog_options (catalog_code,key,label,position)
select * from options on conflict (catalog_code,key) do update set label=excluded.label,position=excluded.position;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ppp-private','ppp-private',false,12582912,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "private PPP files" on storage.objects for all to authenticated using (false) with check (false);
