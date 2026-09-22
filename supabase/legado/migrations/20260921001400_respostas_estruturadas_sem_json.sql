-- Respostas e metadados deixam de ser persistidos como JSONB.
-- JSON permanece somente como transporte temporário das RPCs para preservar o contrato do frontend.

create table public.respostas_campos_ppp (
  id uuid primary key default gen_random_uuid(),
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  chave_campo text not null check (chave_campo ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,150}$'),
  valor_texto text,
  valor_numerico numeric,
  valor_logico boolean,
  valor_data date,
  criado_em timestamptz not null default now(),
  unique (revisao_ppp_id, chave_campo),
  check (num_nonnulls(valor_texto, valor_numerico, valor_logico, valor_data) = 1)
);
create index respostas_campos_ppp_revisao_idx on public.respostas_campos_ppp(revisao_ppp_id, chave_campo);

create table public.selecoes_resposta_ppp (
  id uuid primary key default gen_random_uuid(),
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  grupo text not null check (grupo ~ '^[a-z][a-z0-9_]{1,62}$'),
  chave_opcao text not null check (chave_opcao ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  criado_em timestamptz not null default now(),
  unique (revisao_ppp_id, grupo, chave_opcao)
);
create index selecoes_resposta_ppp_revisao_idx on public.selecoes_resposta_ppp(revisao_ppp_id, grupo);

create table public.indicadores_resposta_ppp (
  id uuid primary key default gen_random_uuid(),
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  etapa_chave text,
  indicador_chave text not null check (indicador_chave ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,150}$'),
  valor_texto text not null,
  criado_em timestamptz not null default now(),
  unique nulls not distinct (revisao_ppp_id, etapa_chave, indicador_chave)
);

create table public.detalhes_resposta_ppp (
  id uuid primary key default gen_random_uuid(),
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  caminho text not null check (caminho ~ '^[A-Za-z0-9_.:-]{1,200}$'),
  valor_texto text not null,
  criado_em timestamptz not null default now(),
  unique (revisao_ppp_id, caminho)
);

create table public.tarefas_revisao_ppp (
  id uuid primary key default gen_random_uuid(),
  revisao_ppp_id uuid not null references public.revisoes_ppp(id) on delete restrict,
  chave_tarefa text not null check (chave_tarefa ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  concluida boolean not null,
  criado_em timestamptz not null default now(),
  unique (revisao_ppp_id, chave_tarefa)
);

create table public.tarefas_progresso_ppp (
  versao_ppp_id uuid not null references public.versoes_ppp(id) on delete restrict,
  chave_tarefa text not null check (chave_tarefa ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  concluida boolean not null,
  atualizado_em timestamptz not null default now(),
  primary key (versao_ppp_id, chave_tarefa)
);

create table public.atributos_escola (
  escola_id uuid not null references public.escolas(id) on delete restrict,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  atualizado_em timestamptz not null default now(),
  primary key (escola_id, chave)
);

create table public.itens_publicacao_conteudo (
  publicacao_conteudo_id uuid not null references public.publicacoes_conteudo(id) on delete restrict,
  caminho text not null check (caminho ~ '^[A-Za-z0-9_.:-]{1,250}$'),
  valor_texto text not null,
  primary key (publicacao_conteudo_id, caminho)
);

create table public.opcoes_configuracao_rede (
  rede_id uuid not null references public.redes(id) on delete restrict,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  atualizado_em timestamptz not null default now(),
  primary key (rede_id, chave)
);

create table public.atributos_opcao_catalogo (
  opcao_catalogo_id uuid not null references public.opcoes_catalogo(id) on delete cascade,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  primary key (opcao_catalogo_id, chave)
);

create table public.metadados_arquivo_ppp (
  arquivo_ppp_id uuid not null references public.arquivos_ppp(id) on delete restrict,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  primary key (arquivo_ppp_id, chave)
);

create table public.dados_evento_fluxo_ppp (
  evento_fluxo_ppp_id uuid not null references public.eventos_fluxo_ppp(id) on delete restrict,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  primary key (evento_fluxo_ppp_id, chave)
);

create table public.metadados_evento_auditoria (
  evento_auditoria_id uuid not null references public.eventos_auditoria(id) on delete restrict,
  chave text not null check (chave ~ '^[A-Za-z0-9_.:-]{1,150}$'),
  valor_texto text not null,
  primary key (evento_auditoria_id, chave)
);

create or replace function app.json_seguro(texto text)
returns jsonb language plpgsql immutable as $$
begin
  return coalesce(texto, '{}')::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

create or replace function app.achatar_json(valor jsonb, prefixo text default '')
returns table(caminho text, valor_texto text)
language plpgsql immutable as $$
declare item record;
begin
  case jsonb_typeof(valor)
    when 'object' then
      for item in select key, value from jsonb_each(valor) loop
        return query select * from app.achatar_json(item.value, concat_ws('.', prefixo, item.key));
      end loop;
    when 'array' then
      for item in select ordinality, value from jsonb_array_elements(valor) with ordinality loop
        return query select * from app.achatar_json(item.value, concat_ws('.', prefixo, item.ordinality::text));
      end loop;
    else
      return query select prefixo, valor #>> '{}';
  end case;
end;
$$;

create or replace function app.gravar_respostas_estruturadas(revisao_destino_id uuid, respostas_entrada jsonb, tarefas_entrada jsonb default '{}'::jsonb)
returns void language plpgsql set search_path = public, app as $$
declare
  dados jsonb := coalesce(respostas_entrada, '{}'::jsonb);
  selecoes jsonb := app.json_seguro(dados ->> 'selecoes');
  indicadores jsonb := app.json_seguro(dados ->> 'indicadores');
  detalhes jsonb := app.json_seguro(dados ->> 'detalhes');
  tarefas jsonb := coalesce(tarefas_entrada, app.json_seguro(dados ->> 'tarefas'), '{}'::jsonb);
begin
  insert into public.respostas_campos_ppp (revisao_ppp_id, chave_campo, valor_texto, valor_numerico, valor_logico)
  select revisao_destino_id, item.key,
    case when jsonb_typeof(item.value) = 'string' then item.value #>> '{}' else null end,
    case when jsonb_typeof(item.value) = 'number' then (item.value #>> '{}')::numeric else null end,
    case when jsonb_typeof(item.value) = 'boolean' then (item.value #>> '{}')::boolean else null end
  from jsonb_each(dados) item
  where jsonb_typeof(item.value) in ('string', 'number', 'boolean')
    and item.key not in ('indicadores', 'detalhes', 'selecoes', 'tarefas');

  insert into public.selecoes_resposta_ppp (revisao_ppp_id, grupo, chave_opcao)
  select revisao_destino_id, grupos.key, opcoes.valor #>> '{}'
  from jsonb_each(selecoes) grupos
  cross join lateral jsonb_array_elements(grupos.value) opcoes(valor)
  where jsonb_typeof(grupos.value) = 'array';

  insert into public.indicadores_resposta_ppp (revisao_ppp_id, etapa_chave, indicador_chave, valor_texto)
  select revisao_destino_id,
    case when partes[1] = 'etapas' then partes[2] else null end,
    case when partes[1] = 'etapas' then partes[3] else partes[1] end,
    item.valor_texto
  from app.achatar_json(indicadores) item
  cross join lateral string_to_array(item.caminho, '.') partes
  where array_length(partes, 1) in (1, 3);

  insert into public.detalhes_resposta_ppp (revisao_ppp_id, caminho, valor_texto)
  select revisao_destino_id, caminho, valor_texto from app.achatar_json(detalhes)
  where caminho <> '';

  insert into public.tarefas_revisao_ppp (revisao_ppp_id, chave_tarefa, concluida)
  select revisao_destino_id, item.key, (item.value #>> '{}')::boolean
  from jsonb_each(tarefas) item where jsonb_typeof(item.value) = 'boolean';
end;
$$;

do $$
declare revisao record;
begin
  for revisao in select id, respostas from public.revisoes_ppp loop
    perform app.gravar_respostas_estruturadas(revisao.id, revisao.respostas);
  end loop;
end;
$$;

insert into public.tarefas_progresso_ppp (versao_ppp_id, chave_tarefa, concluida)
select p.versao_ppp_id, item.key, (item.value #>> '{}')::boolean
from public.progresso_ppp p cross join lateral jsonb_each(p.tarefas) item
where jsonb_typeof(item.value) = 'boolean';

insert into public.atributos_escola (escola_id, chave, valor_texto)
select e.id, a.caminho, a.valor_texto from public.escolas e cross join lateral app.achatar_json(e.dados) a where a.caminho <> '';
insert into public.itens_publicacao_conteudo (publicacao_conteudo_id, caminho, valor_texto)
select p.id, a.caminho, a.valor_texto from public.publicacoes_conteudo p cross join lateral app.achatar_json(p.conteudo) a where a.caminho <> '';
insert into public.opcoes_configuracao_rede (rede_id, chave, valor_texto)
select c.rede_id, a.caminho, a.valor_texto from public.configuracoes_rede c cross join lateral app.achatar_json(c.configuracoes) a where a.caminho <> '';
insert into public.atributos_opcao_catalogo (opcao_catalogo_id, chave, valor_texto)
select o.id, a.caminho, a.valor_texto from public.opcoes_catalogo o cross join lateral app.achatar_json(o.configuracao) a where a.caminho <> '';
insert into public.metadados_arquivo_ppp (arquivo_ppp_id, chave, valor_texto)
select a.id, x.caminho, x.valor_texto from public.arquivos_ppp a cross join lateral app.achatar_json(a.metadados) x where x.caminho <> '';
insert into public.dados_evento_fluxo_ppp (evento_fluxo_ppp_id, chave, valor_texto)
select e.id, x.caminho, x.valor_texto from public.eventos_fluxo_ppp e cross join lateral app.achatar_json(e.dados) x where x.caminho <> '';
insert into public.metadados_evento_auditoria (evento_auditoria_id, chave, valor_texto)
select e.id, x.caminho, x.valor_texto from public.eventos_auditoria e cross join lateral app.achatar_json(e.metadados) x where x.caminho <> '';

alter table public.revisoes_ppp drop column respostas;
alter table public.progresso_ppp drop column tarefas;
alter table public.escolas drop column dados;
alter table public.publicacoes_conteudo drop column conteudo;
alter table public.configuracoes_rede drop column configuracoes;
alter table public.opcoes_catalogo drop column configuracao;
alter table public.arquivos_ppp drop column metadados;
alter table public.eventos_fluxo_ppp drop column dados;
alter table public.eventos_auditoria drop column metadados;

create or replace function public.criar_rascunho_ppp(escola_destino_id uuid, respostas_iniciais jsonb default '{}'::jsonb)
returns table(versao_ppp_id uuid, protocolo text, numero_revisao bigint, numero_revisao_progresso bigint)
language plpgsql security definer set search_path = public, app as $$
declare usuario_atual_id uuid := auth.uid(); escola_destino public.escolas%rowtype; publicacao_id uuid; projeto_id uuid; nova_versao_id uuid; nova_revisao_id uuid; novo_protocolo text;
begin
  if usuario_atual_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(respostas_iniciais) <> 'object' then raise exception 'respostas_iniciais deve ser um objeto JSON' using errcode = '22023'; end if;
  select * into escola_destino from public.escolas where id = escola_destino_id and arquivado_em is null;
  if not found then raise exception 'Escola não encontrada' using errcode = 'P0002'; end if;
  if not app.pode_acessar(escola_destino.rede_id, escola_destino.superintendencia_regional_id, escola_destino.id, true) then raise exception 'Sem permissão para criar PPP desta escola' using errcode = '42501'; end if;
  select publicacao_ativa_id into publicacao_id from public.configuracoes_rede where rede_id = escola_destino.rede_id;
  insert into public.projetos_politico_pedagogicos (rede_id, escola_id, criado_por) values (escola_destino.rede_id, escola_destino.id, usuario_atual_id) returning id into projeto_id;
  novo_protocolo := app.proximo_protocolo_ppp();
  insert into public.versoes_ppp (projeto_ppp_id, rede_id, numero, protocolo, criado_por) values (projeto_id, escola_destino.rede_id, 1, novo_protocolo, usuario_atual_id) returning id into nova_versao_id;
  insert into public.revisoes_ppp (versao_ppp_id, numero, publicacao_conteudo_id, criado_por) values (nova_versao_id, 1, publicacao_id, usuario_atual_id) returning id into nova_revisao_id;
  perform app.gravar_respostas_estruturadas(nova_revisao_id, respostas_iniciais);
  update public.versoes_ppp set revisao_atual_id = nova_revisao_id where id = nova_versao_id;
  insert into public.progresso_ppp (versao_ppp_id, atualizado_por) values (nova_versao_id, usuario_atual_id);
  insert into public.eventos_fluxo_ppp (versao_ppp_id, tipo, responsavel_id) values (nova_versao_id, 'created', usuario_atual_id);
  insert into public.eventos_auditoria (rede_id, responsavel_id, acao, tipo_entidade, entidade_id) values (escola_destino.rede_id, usuario_atual_id, 'ppp_draft_created', 'versao_ppp', nova_versao_id);
  return query select nova_versao_id, novo_protocolo, 1::bigint, 0::bigint;
end;
$$;

create or replace function public.salvar_rascunho_ppp(versao_ppp_destino_id uuid, revisao_esperada bigint, proximas_respostas jsonb, proxima_tela_atual_chave text, proximas_tarefas jsonb default '{}'::jsonb)
returns table(numero_revisao bigint, numero_revisao_progresso bigint)
language plpgsql security definer set search_path = public, app as $$
declare usuario_atual_id uuid := auth.uid(); versao_destino public.versoes_ppp%rowtype; escola_destino public.escolas%rowtype; revisao_anterior public.revisoes_ppp%rowtype; nova_revisao_id uuid; proximo_numero_revisao bigint; proximo_numero_revisao_progresso bigint;
begin
  if usuario_atual_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(proximas_respostas) <> 'object' or jsonb_typeof(proximas_tarefas) <> 'object' then raise exception 'Respostas e tarefas devem ser objetos JSON' using errcode = '22023'; end if;
  select v.* into versao_destino from public.versoes_ppp v where v.id = versao_ppp_destino_id for update;
  if not found then raise exception 'Versão de PPP não encontrada' using errcode = 'P0002'; end if;
  select e.* into escola_destino from public.projetos_politico_pedagogicos p join public.escolas e on e.id = p.escola_id where p.id = versao_destino.projeto_ppp_id and e.arquivado_em is null;
  if versao_destino.situacao <> 'draft' then raise exception 'Somente rascunhos podem ser alterados' using errcode = '55000'; end if;
  if not app.pode_acessar(versao_destino.rede_id, escola_destino.superintendencia_regional_id, escola_destino.id, true) then raise exception 'Sem permissão para alterar este PPP' using errcode = '42501'; end if;
  select * into revisao_anterior from public.revisoes_ppp where id = versao_destino.revisao_atual_id;
  if revisao_anterior.numero <> revisao_esperada then raise exception 'O rascunho foi alterado por outra sessão; recarregue antes de salvar' using errcode = '40001'; end if;
  proximo_numero_revisao := revisao_anterior.numero + 1;
  insert into public.revisoes_ppp (versao_ppp_id, numero, publicacao_conteudo_id, criado_por) values (versao_destino.id, proximo_numero_revisao, revisao_anterior.publicacao_conteudo_id, usuario_atual_id) returning id into nova_revisao_id;
  perform app.gravar_respostas_estruturadas(nova_revisao_id, proximas_respostas, proximas_tarefas);
  update public.versoes_ppp set revisao_atual_id = nova_revisao_id where id = versao_destino.id;
  update public.progresso_ppp as progresso set tela_atual_chave = proxima_tela_atual_chave, numero_revisao = progresso.numero_revisao + 1, atualizado_por = usuario_atual_id where progresso.versao_ppp_id = versao_destino.id returning progresso.numero_revisao into proximo_numero_revisao_progresso;
  delete from public.tarefas_progresso_ppp where versao_ppp_id = versao_destino.id;
  insert into public.tarefas_progresso_ppp (versao_ppp_id, chave_tarefa, concluida)
  select versao_destino.id, item.key, (item.value #>> '{}')::boolean from jsonb_each(proximas_tarefas) item where jsonb_typeof(item.value) = 'boolean';
  insert into public.eventos_auditoria (rede_id, responsavel_id, acao, tipo_entidade, entidade_id) values (versao_destino.rede_id, usuario_atual_id, 'ppp_draft_saved', 'versao_ppp', versao_destino.id);
  return query select proximo_numero_revisao, proximo_numero_revisao_progresso;
end;
$$;

drop function public.obter_ppp_por_protocolo(text);
create function public.obter_ppp_por_protocolo(protocolo_busca text)
returns table(versao_ppp_id uuid, protocolo text, numero_versao integer, situacao text, numero_revisao bigint, respostas jsonb, tela_atual_chave text, tarefas jsonb, atualizado_em timestamptz)
language sql stable security invoker set search_path = public as $$
  select v.id, v.protocolo, v.numero, v.situacao, r.numero,
    coalesce((select jsonb_object_agg(c.chave_campo, coalesce(to_jsonb(c.valor_texto), to_jsonb(c.valor_numerico), to_jsonb(c.valor_logico), to_jsonb(c.valor_data))) from public.respostas_campos_ppp c where c.revisao_ppp_id = r.id), '{}'::jsonb)
      || jsonb_build_object('selecoes', coalesce((select jsonb_object_agg(s.grupo, s.opcoes::text) from (select grupo, jsonb_agg(chave_opcao order by chave_opcao) opcoes from public.selecoes_resposta_ppp where revisao_ppp_id = r.id group by grupo) s), '{}'::jsonb))
      || jsonb_build_object('indicadores', coalesce((select jsonb_object_agg(i.caminho, i.valor_texto) from (select concat_ws('.', case when etapa_chave is null then null else 'etapas' end, etapa_chave, indicador_chave) caminho, valor_texto from public.indicadores_resposta_ppp where revisao_ppp_id = r.id) i), '{}'::jsonb)::text)
      || jsonb_build_object('detalhes', coalesce((select jsonb_object_agg(caminho, valor_texto) from public.detalhes_resposta_ppp where revisao_ppp_id = r.id), '{}'::jsonb)::text),
    coalesce(p.tela_atual_chave, 't00'),
    coalesce((select jsonb_object_agg(t.chave_tarefa, t.concluida) from public.tarefas_progresso_ppp t where t.versao_ppp_id = v.id), '{}'::jsonb), v.atualizado_em
  from public.versoes_ppp v join public.revisoes_ppp r on r.id = v.revisao_atual_id left join public.progresso_ppp p on p.versao_ppp_id = v.id
  where upper(v.protocolo) = upper(trim(protocolo_busca));
$$;

grant select on public.respostas_campos_ppp, public.selecoes_resposta_ppp, public.indicadores_resposta_ppp, public.detalhes_resposta_ppp, public.tarefas_revisao_ppp, public.tarefas_progresso_ppp, public.atributos_escola, public.itens_publicacao_conteudo, public.opcoes_configuracao_rede, public.atributos_opcao_catalogo, public.metadados_arquivo_ppp, public.dados_evento_fluxo_ppp, public.metadados_evento_auditoria to authenticated;
