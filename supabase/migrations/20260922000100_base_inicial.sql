-- Base limpa do Gerador de PPP. Dados persistidos são relacionais; não há colunas JSONB.
-- O reset do schema público foi autorizado para o ambiente de desenvolvimento.
drop schema public cascade;
create schema public;
grant all on schema public to postgres, service_role;
grant usage on schema public to anon, authenticated;
drop schema if exists app cascade;
create schema app;
create extension if not exists pgcrypto;
revoke all on schema app from public;

create table public.redes_ensino (
  id uuid primary key default gen_random_uuid(), codigo text not null unique check (codigo ~ '^[a-z0-9_-]{2,63}$'),
  nome text not null check (length(trim(nome)) >= 3), ativo boolean not null default true,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table public.regionais_ensino (
  id uuid primary key default gen_random_uuid(), rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  codigo text not null, nome text not null, ativo boolean not null default true,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(rede_ensino_id,codigo)
);
create table public.escolas (
  id uuid primary key default gen_random_uuid(), rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  regional_ensino_id uuid not null references public.regionais_ensino(id) on delete restrict,
  codigo_inep text not null check (codigo_inep ~ '^[0-9]{8}$'), nome text not null, municipio text not null,
  ativo boolean not null default true, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique(rede_ensino_id,codigo_inep)
);
create index escolas_regional_idx on public.escolas(regional_ensino_id) where ativo;

create table public.perfis_usuarios (
  id uuid primary key references auth.users(id) on delete cascade, nome_exibicao text not null default '',
  email text not null default '' check (email = lower(email)), ativo boolean not null default true,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table public.vinculos_usuarios (
  id uuid primary key default gen_random_uuid(), usuario_id uuid not null references public.perfis_usuarios(id) on delete restrict,
  rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  regional_ensino_id uuid references public.regionais_ensino(id) on delete restrict,
  escola_id uuid references public.escolas(id) on delete restrict,
  papel text not null check (papel in ('editor_escola','leitor_regional','leitor_rede','curador_conteudo','administrador_acessos')),
  revogado_em timestamptz, criado_em timestamptz not null default now(),
  check (not (regional_ensino_id is not null and escola_id is not null))
);
create unique index vinculos_usuarios_ativos_unicos on public.vinculos_usuarios(usuario_id,rede_ensino_id,papel,coalesce(regional_ensino_id,'00000000-0000-0000-0000-000000000000'),coalesce(escola_id,'00000000-0000-0000-0000-000000000000')) where revogado_em is null;

create table public.catalogos (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]{1,62}$'), nome text not null, descricao text not null default ''
);
create table public.itens_catalogo (
  id uuid primary key default gen_random_uuid(), catalogo_codigo text not null references public.catalogos(codigo) on delete cascade,
  codigo text not null check (codigo ~ '^[a-z0-9_]{1,62}$'), rotulo text not null, ordem integer not null default 0,
  ativo boolean not null default true, unique(catalogo_codigo,codigo)
);

create table public.publicacoes_institucionais (
  id uuid primary key default gen_random_uuid(), rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  numero integer not null check(numero > 0), versao_formulario integer not null default 1, publicada_por uuid references public.perfis_usuarios(id),
  publicada_em timestamptz not null default now(), unique(rede_ensino_id,numero)
);
create table public.itens_publicacao_institucional (
  id uuid primary key default gen_random_uuid(), publicacao_institucional_id uuid not null references public.publicacoes_institucionais(id) on delete restrict,
  chave text not null, texto text not null, unique(publicacao_institucional_id,chave)
);
create table public.configuracoes_redes (
  rede_ensino_id uuid primary key references public.redes_ensino(id) on delete restrict,
  publicacao_institucional_ativa_id uuid not null references public.publicacoes_institucionais(id) on delete restrict,
  atualizado_em timestamptz not null default now()
);

create table public.ppps (
  id uuid primary key default gen_random_uuid(), rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  escola_id uuid not null references public.escolas(id) on delete restrict, criado_por uuid references public.perfis_usuarios(id),
  arquivado_em timestamptz, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table public.versoes_ppp (
  id uuid primary key default gen_random_uuid(), ppp_id uuid not null references public.ppps(id) on delete restrict,
  numero integer not null check(numero>0), protocolo text not null unique check(protocolo ~ '^PPP-[0-9]{4}-[A-Z0-9-]+$'),
  situacao text not null default 'rascunho' check(situacao in ('rascunho','em_assinatura','assinado','concluido','enviado_homologacao','homologado')),
  versao_anterior_id uuid references public.versoes_ppp(id) on delete restrict,
  revisao_atual_id uuid, revisao_congelada_id uuid, criado_por uuid references public.perfis_usuarios(id),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(ppp_id,numero)
);
create table public.revisoes_ppp (
  id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  numero integer not null check(numero>0), publicacao_institucional_id uuid not null references public.publicacoes_institucionais(id),
  criado_por uuid references public.perfis_usuarios(id), criado_em timestamptz not null default now(), unique(versao_ppp_id,numero)
);
alter table public.versoes_ppp add foreign key(revisao_atual_id) references public.revisoes_ppp(id) deferrable initially deferred;
alter table public.versoes_ppp add foreign key(revisao_congelada_id) references public.revisoes_ppp(id) deferrable initially deferred;

create table public.identificacoes_ppp (
  revisao_ppp_id uuid primary key references public.revisoes_ppp(id) on delete restrict,
  nome_escola text not null default '', codigo_inep text not null default '', municipio text not null default '', regional_nome text not null default '',
  direcao_nome text not null default '', especialista_nome text not null default '', endereco text not null default '', ato_criacao text not null default '',
  turnos text not null default '', quantidade_estudantes text not null default '', quantidade_turmas text not null default '', colegiado_responsavel text not null default '',
  vigencia text not null default '', data_assembleia text not null default '', data_analise_regional text not null default '', aprovacao text not null default '',
  quorum_presentes text not null default '', quorum_total text not null default '', destino_homologacao text not null default ''
);
create table public.textos_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  secao text not null check(secao ~ '^t[A-Z][A-Za-z0-9_]*$'), conteudo text not null default '', primary key(revisao_ppp_id,secao)
);
create table public.ofertas_ensino_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  tipo text not null check(tipo in ('etapa','modalidade')), codigo_item text not null, primary key(revisao_ppp_id,tipo,codigo_item)
);
create table public.opcoes_pedagogicas_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  categoria text not null check(categoria in ('infraestrutura','tema','principio','metodo')), codigo_item text not null,
  primary key(revisao_ppp_id,categoria,codigo_item)
);
create table public.indicadores_educacionais_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  etapa_codigo text not null default '', indicador_codigo text not null, valor text not null default '', ano_referencia text not null default '',
  primary key(revisao_ppp_id,etapa_codigo,indicador_codigo)
);
create table public.detalhes_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  grupo text not null, campo text not null, valor text not null default '', primary key(revisao_ppp_id,grupo,campo)
);
create table public.tarefas_revisoes_ppp (
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  codigo_tarefa text not null, concluida boolean not null, primary key(revisao_ppp_id,codigo_tarefa)
);
create table public.progresso_ppp (
  versao_ppp_id uuid primary key references public.versoes_ppp(id) on delete restrict,
  tela_atual text not null default 't00', numero_revisao integer not null default 0, atualizado_por uuid references public.perfis_usuarios(id), atualizado_em timestamptz not null default now()
);
create table public.tarefas_progresso_ppp (
  versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  codigo_tarefa text not null, concluida boolean not null, primary key(versao_ppp_id,codigo_tarefa)
);

create table public.participantes_ppp (
  id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  papel text not null check(papel in ('direcao','colegiado')), segmento text not null default '', nome text not null, email text not null default '', masp text not null default '',
  convidado_em timestamptz, convite_expira_em timestamptz, assinado_em timestamptz, ressalva text, removido_em timestamptz
);
create table public.arquivos_ppp (
  id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  tipo text not null check(tipo in ('previa','documento_congelado','documento_assinado','ata','anexo','homologacao')),
  caminho_storage text not null unique, nome_original text not null, tipo_mime text not null, tamanho_bytes bigint not null check(tamanho_bytes>0), hash_sha256 text not null,
  criado_por uuid references public.perfis_usuarios(id), criado_em timestamptz not null default now(), removido_em timestamptz
);
create table public.eventos_ppp (
  id uuid primary key default gen_random_uuid(), versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  tipo text not null, descricao text not null default '', responsavel_id uuid references public.perfis_usuarios(id), ocorrido_em timestamptz not null default now()
);
create table public.eventos_auditoria (
  id uuid primary key default gen_random_uuid(), rede_ensino_id uuid not null references public.redes_ensino(id) on delete restrict,
  responsavel_id uuid references public.perfis_usuarios(id), acao text not null, entidade text not null, entidade_id uuid not null, descricao text not null default '', ocorrido_em timestamptz not null default now()
);

create sequence public.sequencia_protocolos_ppp;
create or replace function app.atualizar_atualizado_em() returns trigger language plpgsql as $$ begin new.atualizado_em=now(); return new; end; $$;
create or replace function app.criar_perfil_usuario() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.perfis_usuarios(id,nome_exibicao,email) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''),lower(coalesce(new.email,''))) on conflict(id) do update set email=excluded.email; return new; end; $$;
create or replace function app.pode_acessar(rede_id_destino uuid, regional_id_destino uuid default null, escola_id_destino uuid default null, edicao boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.vinculos_usuarios v where v.usuario_id=auth.uid() and v.rede_ensino_id=rede_id_destino and v.revogado_em is null and (
  (v.papel='editor_escola' and v.escola_id=escola_id_destino) or
  (not edicao and v.papel='leitor_regional' and v.regional_ensino_id=regional_id_destino) or
  (not edicao and v.papel in ('leitor_rede','curador_conteudo','administrador_acessos')))); $$;
create or replace function app.proximo_protocolo_ppp() returns text language sql volatile set search_path=public as $$ select 'PPP-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.sequencia_protocolos_ppp')::text,8,'0'); $$;
create trigger criar_perfil_auth after insert on auth.users for each row execute procedure app.criar_perfil_usuario();
create trigger atualizar_redes before update on public.redes_ensino for each row execute procedure app.atualizar_atualizado_em();
create trigger atualizar_regionais before update on public.regionais_ensino for each row execute procedure app.atualizar_atualizado_em();
create trigger atualizar_escolas before update on public.escolas for each row execute procedure app.atualizar_atualizado_em();
create trigger atualizar_ppps before update on public.ppps for each row execute procedure app.atualizar_atualizado_em();
create trigger atualizar_versoes before update on public.versoes_ppp for each row execute procedure app.atualizar_atualizado_em();

-- Funções de persistência; o JSON é recebido apenas pelo protocolo HTTP e é dividido em linhas relacionais.
create or replace function app.json_texto(texto text) returns jsonb language plpgsql immutable as $$ begin return coalesce(texto,'{}')::jsonb; exception when others then return '{}'::jsonb; end; $$;
create or replace function app.gravar_formulario(revisao_id_destino uuid, formulario jsonb, tarefas jsonb default '{}'::jsonb) returns void language plpgsql set search_path=public,app as $$
declare dados jsonb:=coalesce(formulario,'{}'); selecoes jsonb:=app.json_texto(dados->>'selecoes'); indicadores jsonb:=app.json_texto(dados->>'indicadores'); detalhes jsonb:=app.json_texto(dados->>'detalhes'); par record;
begin
 insert into public.identificacoes_ppp select revisao_id_destino,coalesce(dados->>'escola',''),coalesce(dados->>'inep',''),coalesce(dados->>'municipio',''),coalesce(dados->>'sre',''),coalesce(dados->>'direcao',''),coalesce(dados->>'especialista',''),coalesce(dados->>'endereco',''),coalesce(dados->>'ato',''),coalesce(dados->>'turnos',''),coalesce(dados->>'estudantes',''),coalesce(dados->>'turmas',''),coalesce(dados->>'colegiado',''),coalesce(dados->>'vigencia',''),coalesce(dados->>'assembleia',''),coalesce(dados->>'analiseSre',''),coalesce(dados->>'aprovacao',''),coalesce(dados->>'quorumPresentes',''),coalesce(dados->>'quorumTotal',''),coalesce(dados->>'homologacao','');
 insert into public.textos_ppp(revisao_ppp_id,secao,conteudo) select revisao_id_destino,key,value#>>'{}' from jsonb_each(dados) where key ~ '^t[A-Z]' and jsonb_typeof(value)='string';
 insert into public.ofertas_ensino_ppp select revisao_id_destino,case when g.key='etapas' then 'etapa' else 'modalidade' end,x.value#>>'{}' from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('etapas','mods');
 insert into public.opcoes_pedagogicas_ppp select revisao_id_destino,case g.key when 'infra' then 'infraestrutura' when 'temas' then 'tema' when 'principios' then 'principio' else 'metodo' end,x.value#>>'{}' from jsonb_each(selecoes) g cross join lateral jsonb_array_elements(g.value) x where g.key in ('infra','temas','principios','metodos');
 for par in select key,value from jsonb_each(indicadores) loop
  if par.key <> 'etapas' then insert into public.indicadores_educacionais_ppp values(revisao_id_destino,'',par.key,par.value#>>'{}',coalesce(indicadores->>'ano','')) on conflict do nothing; end if;
 end loop;
 insert into public.tarefas_revisoes_ppp select revisao_id_destino,key,(value#>>'{}')::boolean from jsonb_each(tarefas) where jsonb_typeof(value)='boolean';
end; $$;

create or replace function public.criar_rascunho_ppp(escola_destino_id uuid,respostas_iniciais jsonb default '{}'::jsonb) returns table(versao_ppp_id uuid,protocolo text,numero_revisao bigint,numero_revisao_progresso bigint) language plpgsql security definer set search_path=public,app as $$
declare usuario_id uuid:=auth.uid(); escola public.escolas%rowtype; publicacao_id uuid; ppp_id uuid; versao_id uuid; revisao_id uuid; protocolo_novo text;
begin
 if usuario_id is null then raise exception 'Autenticação obrigatória'; end if; select * into escola from public.escolas where id=escola_destino_id and ativo; if not found or not app.pode_acessar(escola.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then raise exception 'Sem permissão para criar PPP desta escola'; end if;
 select publicacao_institucional_ativa_id into publicacao_id from public.configuracoes_redes where rede_ensino_id=escola.rede_ensino_id;
 insert into public.ppps(rede_ensino_id,escola_id,criado_por) values(escola.rede_ensino_id,escola.id,usuario_id) returning id into ppp_id; protocolo_novo:=app.proximo_protocolo_ppp();
 insert into public.versoes_ppp(ppp_id,numero,protocolo,criado_por) values(ppp_id,1,protocolo_novo,usuario_id) returning id into versao_id;
 insert into public.revisoes_ppp(versao_ppp_id,numero,publicacao_institucional_id,criado_por) values(versao_id,1,publicacao_id,usuario_id) returning id into revisao_id;
 perform app.gravar_formulario(revisao_id,respostas_iniciais); update public.versoes_ppp set revisao_atual_id=revisao_id where id=versao_id; insert into public.progresso_ppp(versao_ppp_id,atualizado_por) values(versao_id,usuario_id); insert into public.eventos_ppp(versao_ppp_id,tipo,responsavel_id) values(versao_id,'criado',usuario_id); return query select versao_id,protocolo_novo,1::bigint,0::bigint;
end; $$;

create or replace function public.salvar_rascunho_ppp(versao_ppp_destino_id uuid,revisao_esperada bigint,proximas_respostas jsonb,proxima_tela_atual_chave text,proximas_tarefas jsonb default '{}'::jsonb) returns table(numero_revisao bigint,numero_revisao_progresso bigint) language plpgsql security definer set search_path=public,app as $$
declare usuario_id uuid:=auth.uid(); versao public.versoes_ppp%rowtype; ppp public.ppps%rowtype; escola public.escolas%rowtype; revisao public.revisoes_ppp%rowtype; nova_revisao uuid; proximo integer; progresso integer;
begin
 if usuario_id is null then raise exception 'Autenticação obrigatória'; end if; select * into versao from public.versoes_ppp where id=versao_ppp_destino_id for update; select * into ppp from public.ppps where id=versao.ppp_id; select * into escola from public.escolas where id=ppp.escola_id; if versao.situacao<>'rascunho' or not app.pode_acessar(escola.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then raise exception 'Sem permissão para alterar este PPP'; end if;
 select * into revisao from public.revisoes_ppp where id=versao.revisao_atual_id; if revisao.numero<>revisao_esperada then raise exception 'O rascunho foi alterado por outra sessão'; end if; proximo:=revisao.numero+1;
 insert into public.revisoes_ppp(versao_ppp_id,numero,publicacao_institucional_id,criado_por) values(versao.id,proximo,revisao.publicacao_institucional_id,usuario_id) returning id into nova_revisao; perform app.gravar_formulario(nova_revisao,proximas_respostas,proximas_tarefas); update public.versoes_ppp set revisao_atual_id=nova_revisao where id=versao.id;
 update public.progresso_ppp p set tela_atual=proxima_tela_atual_chave,numero_revisao=p.numero_revisao+1,atualizado_por=usuario_id where p.versao_ppp_id=versao.id returning p.numero_revisao into progresso; delete from public.tarefas_progresso_ppp where versao_ppp_id=versao.id; insert into public.tarefas_progresso_ppp select versao.id,key,(value#>>'{}')::boolean from jsonb_each(proximas_tarefas) where jsonb_typeof(value)='boolean'; return query select proximo::bigint,progresso::bigint;
end; $$;

create or replace function public.obter_contexto_usuario() returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('id',p.id,'email',p.email,'nome',p.nome_exibicao,'vinculos',coalesce(jsonb_agg(jsonb_build_object('papel',v.papel,'redeId',v.rede_ensino_id,'escolaId',v.escola_id) order by v.criado_em) filter(where v.id is not null),'[]'::jsonb)) from public.perfis_usuarios p left join public.vinculos_usuarios v on v.usuario_id=p.id and v.revogado_em is null where p.id=auth.uid() group by p.id,p.email,p.nome_exibicao; $$;
create or replace function public.obter_ppp_por_protocolo(protocolo_busca text) returns table(versao_ppp_id uuid,protocolo text,numero_versao integer,situacao text,numero_revisao bigint,respostas jsonb,tela_atual_chave text,tarefas jsonb,atualizado_em timestamptz) language sql security invoker set search_path=public as $$
 select v.id,v.protocolo,v.numero,v.situacao,r.numero,jsonb_build_object('escola',i.nome_escola,'inep',i.codigo_inep,'municipio',i.municipio,'sre',i.regional_nome,'direcao',i.direcao_nome,'especialista',i.especialista_nome,'endereco',i.endereco,'ato',i.ato_criacao,'turnos',i.turnos,'estudantes',i.quantidade_estudantes,'turmas',i.quantidade_turmas,'colegiado',i.colegiado_responsavel,'vigencia',i.vigencia)||coalesce((select jsonb_object_agg(t.secao,t.conteudo) from public.textos_ppp t where t.revisao_ppp_id=r.id),'{}'::jsonb),p.tela_atual,coalesce((select jsonb_object_agg(tp.codigo_tarefa,tp.concluida) from public.tarefas_progresso_ppp tp where tp.versao_ppp_id=v.id),'{}'::jsonb),v.atualizado_em from public.versoes_ppp v join public.revisoes_ppp r on r.id=v.revisao_atual_id join public.identificacoes_ppp i on i.revisao_ppp_id=r.id join public.progresso_ppp p on p.versao_ppp_id=v.id where upper(v.protocolo)=upper(trim(protocolo_busca)); $$;

alter table public.redes_ensino enable row level security; alter table public.regionais_ensino enable row level security; alter table public.escolas enable row level security; alter table public.perfis_usuarios enable row level security; alter table public.vinculos_usuarios enable row level security;
alter table public.ppps enable row level security; alter table public.versoes_ppp enable row level security; alter table public.revisoes_ppp enable row level security; alter table public.identificacoes_ppp enable row level security; alter table public.textos_ppp enable row level security; alter table public.ofertas_ensino_ppp enable row level security; alter table public.opcoes_pedagogicas_ppp enable row level security; alter table public.indicadores_educacionais_ppp enable row level security; alter table public.detalhes_ppp enable row level security; alter table public.tarefas_revisoes_ppp enable row level security; alter table public.progresso_ppp enable row level security; alter table public.tarefas_progresso_ppp enable row level security;
create policy "perfil proprio" on public.perfis_usuarios for select to authenticated using(id=auth.uid());
create policy "escola vinculada" on public.escolas for select to authenticated using(app.pode_acessar(rede_ensino_id,regional_ensino_id,id));
create policy "ppp por escola" on public.ppps for select to authenticated using(exists(select 1 from public.escolas e where e.id=escola_id and app.pode_acessar(rede_ensino_id,e.regional_ensino_id,e.id)));
create policy "versao por escola" on public.versoes_ppp for select to authenticated using(exists(select 1 from public.ppps d join public.escolas e on e.id=d.escola_id where d.id=ppp_id and app.pode_acessar(d.rede_ensino_id,e.regional_ensino_id,e.id)));
grant usage on schema public,app to authenticated; grant execute on function public.criar_rascunho_ppp(uuid,jsonb),public.salvar_rascunho_ppp(uuid,bigint,jsonb,text,jsonb),public.obter_contexto_usuario(),public.obter_ppp_por_protocolo(text) to authenticated;
