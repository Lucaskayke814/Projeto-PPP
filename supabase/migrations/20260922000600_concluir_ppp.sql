-- Congela uma revisao e inicia a coleta de assinaturas sem sobrescrever o PPP.
alter table public.versoes_ppp
  add column if not exists iniciado_assinatura_em timestamptz;

create unique index if not exists participantes_ppp_direcao_unica
  on public.participantes_ppp(versao_ppp_id)
  where papel = 'direcao' and removido_em is null;

create or replace function public.concluir_ppp(
  versao_ppp_destino_id uuid,
  revisao_esperada bigint
)
returns table(
  situacao text,
  revisao_congelada_id uuid,
  iniciado_assinatura_em timestamptz
)
language plpgsql
security definer
set search_path=public,app
as $$
declare
  usuario_id uuid := auth.uid();
  versao public.versoes_ppp%rowtype;
  documento public.ppps%rowtype;
  escola public.escolas%rowtype;
  revisao public.revisoes_ppp%rowtype;
  identificacao public.identificacoes_ppp%rowtype;
  momento timestamptz := now();
begin
  if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;

  select * into versao
  from public.versoes_ppp
  where id = versao_ppp_destino_id
  for update;
  if not found then raise exception 'PPP nao encontrado'; end if;
  if versao.situacao <> 'rascunho' then raise exception 'Este PPP nao esta disponivel para conclusao'; end if;

  select * into documento from public.ppps where id = versao.ppp_id;
  select * into escola from public.escolas where id = documento.escola_id;
  if not app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id, true) then
    raise exception 'Sem permissao para concluir este PPP';
  end if;

  select * into revisao from public.revisoes_ppp where id = versao.revisao_atual_id;
  if revisao.numero <> revisao_esperada then
    raise exception 'O rascunho foi alterado por outra sessao';
  end if;
  select * into identificacao from public.identificacoes_ppp where revisao_ppp_id = revisao.id;

  update public.versoes_ppp
  set situacao = 'em_assinatura',
      revisao_congelada_id = revisao.id,
      iniciado_assinatura_em = momento
  where id = versao.id;

  insert into public.participantes_ppp(versao_ppp_id, papel, segmento, nome)
  values (versao.id, 'direcao', 'Direcao escolar', coalesce(identificacao.direcao_nome, ''))
  on conflict do nothing;

  insert into public.eventos_ppp(versao_ppp_id, tipo, descricao, responsavel_id, ocorrido_em)
  values (versao.id, 'concluido_para_assinatura', 'Revisao congelada e encaminhada para assinatura.', usuario_id, momento);
  insert into public.eventos_auditoria(rede_ensino_id, responsavel_id, acao, entidade, entidade_id, descricao, ocorrido_em)
  values (documento.rede_ensino_id, usuario_id, 'concluir_ppp', 'versoes_ppp', versao.id, 'Revisao congelada para assinatura.', momento);

  return query select 'em_assinatura'::text, revisao.id, momento;
end; $$;

grant execute on function public.concluir_ppp(uuid,bigint) to authenticated;
