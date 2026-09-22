-- Padronização do schema em português.
-- Esta migration preserva os dados e deve ser aplicada após as migrations 001 a 010.

alter table public.redes rename column code to codigo;
alter table public.redes rename column name to nome;
alter table public.redes rename column archived_at to arquivado_em;
alter table public.redes rename column created_at to criado_em;
alter table public.redes rename column updated_at to atualizado_em;

alter table public.superintendencias_regionais rename column network_id to rede_id;
alter table public.superintendencias_regionais rename column code to codigo;
alter table public.superintendencias_regionais rename column name to nome;
alter table public.superintendencias_regionais rename column archived_at to arquivado_em;
alter table public.superintendencias_regionais rename column created_at to criado_em;
alter table public.superintendencias_regionais rename column updated_at to atualizado_em;

alter table public.escolas rename column network_id to rede_id;
alter table public.escolas rename column regional_id to superintendencia_regional_id;
alter table public.escolas rename column name to nome;
alter table public.escolas rename column municipality to municipio;
alter table public.escolas rename column data to dados;
alter table public.escolas rename column archived_at to arquivado_em;
alter table public.escolas rename column created_at to criado_em;
alter table public.escolas rename column updated_at to atualizado_em;

alter table public.perfis_usuario rename column display_name to nome_exibicao;
alter table public.perfis_usuario rename column disabled_at to desativado_em;
alter table public.perfis_usuario rename column created_at to criado_em;
alter table public.perfis_usuario rename column updated_at to atualizado_em;

alter table public.vinculos_usuario rename column user_id to usuario_id;
alter table public.vinculos_usuario rename column network_id to rede_id;
alter table public.vinculos_usuario rename column regional_id to superintendencia_regional_id;
alter table public.vinculos_usuario rename column school_id to escola_id;
alter table public.vinculos_usuario rename column role to papel;
alter table public.vinculos_usuario rename column revoked_at to revogado_em;
alter table public.vinculos_usuario rename column created_at to criado_em;

alter table public.publicacoes_conteudo rename column network_id to rede_id;
alter table public.publicacoes_conteudo rename column number to numero;
alter table public.publicacoes_conteudo rename column form_version to versao_formulario;
alter table public.publicacoes_conteudo rename column content to conteudo;
alter table public.publicacoes_conteudo rename column checksum to soma_verificacao;
alter table public.publicacoes_conteudo rename column published_by to publicado_por;
alter table public.publicacoes_conteudo rename column published_at to publicado_em;

alter table public.configuracoes_rede rename column network_id to rede_id;
alter table public.configuracoes_rede rename column active_release_id to publicacao_ativa_id;
alter table public.configuracoes_rede rename column settings to configuracoes;
alter table public.configuracoes_rede rename column updated_at to atualizado_em;

alter table public.catalogos rename column code to codigo;
alter table public.catalogos rename column description to descricao;
alter table public.opcoes_catalogo rename column catalog_code to catalogo_codigo;
alter table public.opcoes_catalogo rename column key to chave;
alter table public.opcoes_catalogo rename column label to rotulo;
alter table public.opcoes_catalogo rename column position to ordem;
alter table public.opcoes_catalogo rename column config to configuracao;
alter table public.opcoes_catalogo rename column archived_at to arquivado_em;

alter table public.projetos_politico_pedagogicos rename column network_id to rede_id;
alter table public.projetos_politico_pedagogicos rename column school_id to escola_id;
alter table public.projetos_politico_pedagogicos rename column archived_at to arquivado_em;
alter table public.projetos_politico_pedagogicos rename column created_by to criado_por;
alter table public.projetos_politico_pedagogicos rename column created_at to criado_em;
alter table public.projetos_politico_pedagogicos rename column updated_at to atualizado_em;

alter table public.versoes_ppp rename column ppp_id to projeto_ppp_id;
alter table public.versoes_ppp rename column network_id to rede_id;
alter table public.versoes_ppp rename column number to numero;
alter table public.versoes_ppp rename column protocol to protocolo;
alter table public.versoes_ppp rename column predecessor_id to versao_anterior_id;
alter table public.versoes_ppp rename column status to situacao;
alter table public.versoes_ppp rename column current_revision_id to revisao_atual_id;
alter table public.versoes_ppp rename column sealed_revision_id to revisao_selada_id;
alter table public.versoes_ppp rename column concluded_at to concluido_em;
alter table public.versoes_ppp rename column review_due_on to revisao_prevista_em;
alter table public.versoes_ppp rename column created_by to criado_por;
alter table public.versoes_ppp rename column created_at to criado_em;
alter table public.versoes_ppp rename column updated_at to atualizado_em;

alter table public.revisoes_ppp rename column version_id to versao_ppp_id;
alter table public.revisoes_ppp rename column number to numero;
alter table public.revisoes_ppp rename column content_release_id to publicacao_conteudo_id;
alter table public.revisoes_ppp rename column answers to respostas;
alter table public.revisoes_ppp rename column created_by to criado_por;
alter table public.revisoes_ppp rename column created_at to criado_em;

alter table public.progresso_ppp rename column version_id to versao_ppp_id;
alter table public.progresso_ppp rename column screen_key to tela_atual_chave;
alter table public.progresso_ppp rename column tasks to tarefas;
alter table public.progresso_ppp rename column revision to numero_revisao;
alter table public.progresso_ppp rename column updated_by to atualizado_por;
alter table public.progresso_ppp rename column updated_at to atualizado_em;

alter table public.participantes_ppp rename column version_id to versao_ppp_id;
alter table public.participantes_ppp rename column user_id to usuario_id;
alter table public.participantes_ppp rename column role to papel;
alter table public.participantes_ppp rename column segment to segmento;
alter table public.participantes_ppp rename column name to nome;
alter table public.participantes_ppp rename column invitation_token_hash to convite_token_hash;
alter table public.participantes_ppp rename column invitation_expires_at to convite_expira_em;
alter table public.participantes_ppp rename column invited_at to convidado_em;
alter table public.participantes_ppp rename column signed_at to assinado_em;
alter table public.participantes_ppp rename column sealed_revision_id to revisao_selada_id;
alter table public.participantes_ppp rename column reservation to ressalva;
alter table public.participantes_ppp rename column removed_at to removido_em;
alter table public.participantes_ppp rename column created_by to criado_por;
alter table public.participantes_ppp rename column created_at to criado_em;
alter table public.participantes_ppp rename column updated_at to atualizado_em;

alter table public.arquivos_ppp rename column version_id to versao_ppp_id;
alter table public.arquivos_ppp rename column kind to tipo;
alter table public.arquivos_ppp rename column object_key to chave_objeto;
alter table public.arquivos_ppp rename column original_name to nome_original;
alter table public.arquivos_ppp rename column mime_type to tipo_mime;
alter table public.arquivos_ppp rename column size_bytes to tamanho_bytes;
alter table public.arquivos_ppp rename column metadata to metadados;
alter table public.arquivos_ppp rename column created_by to criado_por;
alter table public.arquivos_ppp rename column created_at to criado_em;
alter table public.arquivos_ppp rename column withdrawn_at to retirado_em;

alter table public.eventos_fluxo_ppp rename column version_id to versao_ppp_id;
alter table public.eventos_fluxo_ppp rename column type to tipo;
alter table public.eventos_fluxo_ppp rename column data to dados;
alter table public.eventos_fluxo_ppp rename column actor_id to responsavel_id;
alter table public.eventos_fluxo_ppp rename column occurred_at to ocorrido_em;

alter table public.eventos_auditoria rename column network_id to rede_id;
alter table public.eventos_auditoria rename column actor_id to responsavel_id;
alter table public.eventos_auditoria rename column entity_type to tipo_entidade;
alter table public.eventos_auditoria rename column entity_id to entidade_id;
alter table public.eventos_auditoria rename column metadata to metadados;
alter table public.eventos_auditoria rename column occurred_at to ocorrido_em;

alter function app.touch_updated_at() rename to atualizar_data_atualizacao;
alter function app.create_profile() rename to criar_perfil_usuario;
alter function app.can_access(uuid, uuid, uuid, boolean) rename to pode_acessar;
alter function app.has_network_membership(uuid) rename to possui_vinculo_rede;
alter function app.validate_revision_scope() rename to validar_escopo_revisao;
alter function app.validate_participant_scope() rename to validar_escopo_participante;
alter function app.next_ppp_protocol() rename to proximo_protocolo_ppp;

create or replace function app.atualizar_data_atualizacao()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end;
$$;

create or replace function app.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis_usuario (id, nome_exibicao, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), lower(coalesce(new.email, '')))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function app.pode_acessar(
  target_network uuid,
  target_regional uuid default null,
  target_school uuid default null,
  editing boolean default false
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculos_usuario v
    where v.usuario_id = auth.uid() and v.rede_id = target_network and v.revogado_em is null
      and (
        (not editing and v.papel in ('central_viewer', 'content_curator', 'access_admin'))
        or (not editing and v.papel = 'regional_viewer' and (v.superintendencia_regional_id is null or v.superintendencia_regional_id = target_regional))
        or (v.papel = 'school_editor' and (v.escola_id = target_school or (v.escola_id is null and v.superintendencia_regional_id = target_regional)))
      )
  );
$$;

create or replace function app.possui_vinculo_rede(target_network uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculos_usuario v
    where v.usuario_id = auth.uid() and v.rede_id = target_network and v.revogado_em is null
  );
$$;

create or replace function app.validar_escopo_revisao()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.versoes_ppp v join public.publicacoes_conteudo p on p.id = new.publicacao_conteudo_id
    where v.id = new.versao_ppp_id and v.rede_id = p.rede_id
  ) then raise exception 'Revisão e conteúdo pertencem a redes diferentes' using errcode = '23514'; end if;
  return new;
end;
$$;

create or replace function app.validar_escopo_participante()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.revisao_selada_id is not null and not exists (
    select 1 from public.revisoes_ppp r where r.id = new.revisao_selada_id and r.versao_ppp_id = new.versao_ppp_id
  ) then raise exception 'Assinatura deve referenciar a revisão selada da própria versão' using errcode = '23514'; end if;
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;
create trigger criar_perfil_apos_usuario_auth after insert on auth.users for each row execute procedure app.criar_perfil_usuario();
drop trigger if exists networks_touch on public.redes;
drop trigger if exists regionals_touch on public.superintendencias_regionais;
drop trigger if exists schools_touch on public.escolas;
drop trigger if exists profiles_touch on public.perfis_usuario;
drop trigger if exists ppps_touch on public.projetos_politico_pedagogicos;
drop trigger if exists versions_touch on public.versoes_ppp;
drop trigger if exists progress_touch on public.progresso_ppp;
drop trigger if exists participants_touch on public.participantes_ppp;
create trigger atualizar_redes_antes_alteracao before update on public.redes for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_superintendencias_antes_alteracao before update on public.superintendencias_regionais for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_escolas_antes_alteracao before update on public.escolas for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_perfis_antes_alteracao before update on public.perfis_usuario for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_projetos_ppp_antes_alteracao before update on public.projetos_politico_pedagogicos for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_versoes_ppp_antes_alteracao before update on public.versoes_ppp for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_progresso_ppp_antes_alteracao before update on public.progresso_ppp for each row execute procedure app.atualizar_data_atualizacao();
create trigger atualizar_participantes_ppp_antes_alteracao before update on public.participantes_ppp for each row execute procedure app.atualizar_data_atualizacao();

drop trigger if exists revision_scope on public.revisoes_ppp;
drop trigger if exists participant_scope on public.participantes_ppp;
create trigger validar_escopo_revisao_antes_insercao before insert on public.revisoes_ppp for each row execute procedure app.validar_escopo_revisao();
create trigger validar_escopo_participante_antes_alteracao before insert or update on public.participantes_ppp for each row execute procedure app.validar_escopo_participante();

create or replace function public.criar_rascunho_ppp(
  escola_destino_id uuid,
  respostas_iniciais jsonb default '{}'::jsonb
)
returns table(versao_ppp_id uuid, protocolo text, numero_revisao bigint, numero_revisao_progresso bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  usuario_atual_id uuid := auth.uid();
  escola_destino public.escolas%rowtype;
  publicacao_id uuid;
  projeto_id uuid;
  nova_versao_id uuid;
  nova_revisao_id uuid;
  novo_protocolo text;
begin
  if usuario_atual_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(respostas_iniciais) <> 'object' then raise exception 'respostas_iniciais deve ser um objeto JSON' using errcode = '22023'; end if;
  select * into escola_destino from public.escolas where id = escola_destino_id and arquivado_em is null;
  if not found then raise exception 'Escola não encontrada' using errcode = 'P0002'; end if;
  if not app.pode_acessar(escola_destino.rede_id, escola_destino.superintendencia_regional_id, escola_destino.id, true) then raise exception 'Sem permissão para criar PPP desta escola' using errcode = '42501'; end if;
  select publicacao_ativa_id into publicacao_id from public.configuracoes_rede where rede_id = escola_destino.rede_id;
  if publicacao_id is null then raise exception 'A rede ainda não publicou o conteúdo institucional ativo' using errcode = 'P0001'; end if;
  insert into public.projetos_politico_pedagogicos (rede_id, escola_id, criado_por) values (escola_destino.rede_id, escola_destino.id, usuario_atual_id) returning id into projeto_id;
  novo_protocolo := app.proximo_protocolo_ppp();
  insert into public.versoes_ppp (projeto_ppp_id, rede_id, numero, protocolo, criado_por) values (projeto_id, escola_destino.rede_id, 1, novo_protocolo, usuario_atual_id) returning id into nova_versao_id;
  insert into public.revisoes_ppp (versao_ppp_id, numero, publicacao_conteudo_id, respostas, criado_por) values (nova_versao_id, 1, publicacao_id, respostas_iniciais, usuario_atual_id) returning id into nova_revisao_id;
  update public.versoes_ppp set revisao_atual_id = nova_revisao_id where id = nova_versao_id;
  insert into public.progresso_ppp (versao_ppp_id, atualizado_por) values (nova_versao_id, usuario_atual_id);
  insert into public.eventos_fluxo_ppp (versao_ppp_id, tipo, responsavel_id) values (nova_versao_id, 'created', usuario_atual_id);
  insert into public.eventos_auditoria (rede_id, responsavel_id, acao, tipo_entidade, entidade_id) values (escola_destino.rede_id, usuario_atual_id, 'ppp_draft_created', 'versao_ppp', nova_versao_id);
  return query select nova_versao_id, novo_protocolo, 1::bigint, 0::bigint;
end;
$$;

create or replace function public.salvar_rascunho_ppp(
  versao_ppp_destino_id uuid,
  revisao_esperada bigint,
  proximas_respostas jsonb,
  proxima_tela_atual_chave text,
  proximas_tarefas jsonb default '{}'::jsonb
)
returns table(numero_revisao bigint, numero_revisao_progresso bigint)
language plpgsql security definer set search_path = public, app as $$
declare
  usuario_atual_id uuid := auth.uid();
  versao_destino public.versoes_ppp%rowtype;
  escola_destino public.escolas%rowtype;
  revisao_anterior public.revisoes_ppp%rowtype;
  nova_revisao_id uuid;
  proximo_numero_revisao bigint;
  proximo_numero_revisao_progresso bigint;
begin
  if usuario_atual_id is null then raise exception 'Autenticação obrigatória' using errcode = '28000'; end if;
  if jsonb_typeof(proximas_respostas) <> 'object' or jsonb_typeof(proximas_tarefas) <> 'object' then raise exception 'Respostas e tarefas devem ser objetos JSON' using errcode = '22023'; end if;
  if coalesce(length(trim(proxima_tela_atual_chave)), 0) = 0 then raise exception 'Tela atual é obrigatória' using errcode = '22023'; end if;
  select v.* into versao_destino from public.versoes_ppp v where v.id = versao_ppp_destino_id for update;
  if not found then raise exception 'Versão de PPP não encontrada' using errcode = 'P0002'; end if;
  select e.* into escola_destino from public.projetos_politico_pedagogicos p join public.escolas e on e.id = p.escola_id where p.id = versao_destino.projeto_ppp_id and e.arquivado_em is null;
  if not found then raise exception 'Escola da versão não está disponível' using errcode = 'P0002'; end if;
  if versao_destino.situacao <> 'draft' then raise exception 'Somente rascunhos podem ser alterados' using errcode = '55000'; end if;
  if not app.pode_acessar(versao_destino.rede_id, escola_destino.superintendencia_regional_id, escola_destino.id, true) then raise exception 'Sem permissão para alterar este PPP' using errcode = '42501'; end if;
  select * into revisao_anterior from public.revisoes_ppp where id = versao_destino.revisao_atual_id;
  if not found or revisao_anterior.numero <> revisao_esperada then raise exception 'O rascunho foi alterado por outra sessão; recarregue antes de salvar' using errcode = '40001'; end if;
  proximo_numero_revisao := revisao_anterior.numero + 1;
  insert into public.revisoes_ppp (versao_ppp_id, numero, publicacao_conteudo_id, respostas, criado_por) values (versao_destino.id, proximo_numero_revisao, revisao_anterior.publicacao_conteudo_id, proximas_respostas, usuario_atual_id) returning id into nova_revisao_id;
  update public.versoes_ppp set revisao_atual_id = nova_revisao_id where id = versao_destino.id;
  update public.progresso_ppp as progresso set tela_atual_chave = proxima_tela_atual_chave, tarefas = proximas_tarefas, numero_revisao = progresso.numero_revisao + 1, atualizado_por = usuario_atual_id where progresso.versao_ppp_id = versao_destino.id returning progresso.numero_revisao into proximo_numero_revisao_progresso;
  insert into public.eventos_auditoria (rede_id, responsavel_id, acao, tipo_entidade, entidade_id, metadados) values (versao_destino.rede_id, usuario_atual_id, 'ppp_draft_saved', 'versao_ppp', versao_destino.id, jsonb_build_object('numero_revisao', proximo_numero_revisao, 'tela_atual_chave', proxima_tela_atual_chave));
  return query select proximo_numero_revisao, proximo_numero_revisao_progresso;
end;
$$;

create or replace function public.obter_contexto_usuario()
returns jsonb language plpgsql security definer set search_path = public as $$
declare resultado jsonb;
begin
  if auth.uid() is null then return '{}'::jsonb; end if;
  select jsonb_build_object('id', p.id, 'email', p.email, 'nome', p.nome_exibicao,
    'vinculos', coalesce(jsonb_agg(jsonb_build_object('papel', v.papel, 'redeId', v.rede_id,
      'superintendenciaRegionalId', v.superintendencia_regional_id, 'escolaId', v.escola_id,
      'revogadoEm', v.revogado_em) order by v.criado_em) filter (where v.id is not null), '[]'::jsonb)) into resultado
  from public.perfis_usuario p left join public.vinculos_usuario v on v.usuario_id = p.id and v.revogado_em is null
  where p.id = auth.uid() group by p.id, p.email, p.nome_exibicao;
  return coalesce(resultado, '{}'::jsonb);
end;
$$;

drop function public.obter_ppp_por_protocolo(text);
create function public.obter_ppp_por_protocolo(protocolo_busca text)
returns table(versao_ppp_id uuid, protocolo text, numero_versao integer, situacao text, numero_revisao bigint, respostas jsonb, tela_atual_chave text, tarefas jsonb, atualizado_em timestamptz)
language sql stable security invoker set search_path = public as $$
  select v.id, v.protocolo, v.numero, v.situacao, r.numero, r.respostas, coalesce(p.tela_atual_chave, 't00'), coalesce(p.tarefas, '{}'::jsonb), v.atualizado_em
  from public.versoes_ppp v join public.revisoes_ppp r on r.id = v.revisao_atual_id left join public.progresso_ppp p on p.versao_ppp_id = v.id
  where upper(v.protocolo) = upper(trim(protocolo_busca));
$$;

create or replace function public.obter_conteudo_institucional_ativo()
returns table(rede_id uuid, versao integer, conteudo jsonb)
language sql stable security invoker set search_path = public as $$
  select p.rede_id, p.numero, p.conteudo
  from public.configuracoes_rede c
  join public.publicacoes_conteudo p on p.id = c.publicacao_ativa_id
  order by p.publicado_em desc;
$$;

create or replace function public.listar_painel_ppp(filtros jsonb default '{}'::jsonb)
returns table(
  protocolo text, numero_versao integer, escola text, inep text, municipio text, regional text,
  situacao text, percentual_preenchimento integer, assinaturas_realizadas integer,
  assinaturas_previstas integer, ressalvas integer, ata_registrada boolean, revisao_vencida boolean,
  homologado_em timestamptz, atualizado_em timestamptz
)
language sql stable security invoker set search_path = public as $$
  with dados as (
    select v.id, v.protocolo, v.numero, v.situacao, v.revisao_prevista_em, v.atualizado_em,
      e.nome as escola_nome, e.inep, e.municipio, sr.nome as regional_nome,
      coalesce(pg.tarefas, '{}'::jsonb) as tarefas
    from public.versoes_ppp v
    join public.projetos_politico_pedagogicos ppp on ppp.id = v.projeto_ppp_id
    join public.escolas e on e.id = ppp.escola_id
    join public.superintendencias_regionais sr on sr.id = e.superintendencia_regional_id
    left join public.progresso_ppp pg on pg.versao_ppp_id = v.id
    where (coalesce(filtros ->> 'regional', '') = '' or sr.nome = filtros ->> 'regional')
      and (coalesce(filtros ->> 'situacao', '') = '' or v.situacao = filtros ->> 'situacao')
      and (not coalesce((filtros ->> 'somente_vencidos')::boolean, false) or (v.revisao_prevista_em is not null and v.revisao_prevista_em < current_date))
      and (coalesce(filtros ->> 'busca', '') = '' or concat_ws(' ', e.nome, e.inep, e.municipio, v.protocolo) ilike '%' || (filtros ->> 'busca') || '%')
  )
  select d.protocolo, d.numero, d.escola_nome, d.inep, d.municipio, d.regional_nome, d.situacao,
    coalesce((select round(100.0 * count(*) filter (where value = 'true') / nullif(count(*), 0))::integer from jsonb_each_text(d.tarefas)), 0),
    (select count(*)::integer from public.participantes_ppp pp where pp.versao_ppp_id = d.id and pp.assinado_em is not null and pp.removido_em is null),
    (select count(*)::integer from public.participantes_ppp pp where pp.versao_ppp_id = d.id and pp.removido_em is null),
    (select count(*)::integer from public.participantes_ppp pp where pp.versao_ppp_id = d.id and pp.ressalva is not null and pp.removido_em is null),
    exists (select 1 from public.arquivos_ppp a where a.versao_ppp_id = d.id and a.tipo = 'minutes' and a.retirado_em is null),
    d.revisao_prevista_em is not null and d.revisao_prevista_em < current_date, null::timestamptz, d.atualizado_em
  from dados d order by d.atualizado_em desc;
$$;

revoke all on function public.create_ppp_draft(uuid, jsonb), public.save_ppp_draft(uuid, bigint, jsonb, text, jsonb) from public;
drop function public.create_ppp_draft(uuid, jsonb);
drop function public.save_ppp_draft(uuid, bigint, jsonb, text, jsonb);
grant execute on function public.criar_rascunho_ppp(uuid, jsonb), public.salvar_rascunho_ppp(uuid, bigint, jsonb, text, jsonb), public.obter_contexto_usuario(), public.obter_ppp_por_protocolo(text) to authenticated;
