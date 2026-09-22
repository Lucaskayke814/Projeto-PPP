-- Evita ambiguidade entre o retorno da RPC e a revisão do progresso.
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
