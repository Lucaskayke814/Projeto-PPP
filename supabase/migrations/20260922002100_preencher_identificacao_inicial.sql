-- A identificação institucional não é confiada ao navegador. Cada PPP nasce
-- com o snapshot da escola e da regional que estavam vigentes na criação.
create or replace function public.criar_rascunho_ppp(
  escola_destino_id uuid,
  respostas_iniciais jsonb default '{}'::jsonb
)
returns table(
  versao_ppp_id uuid,
  protocolo text,
  numero_revisao bigint,
  numero_revisao_progresso bigint
)
language plpgsql
security definer
set search_path=public,app
as $$
declare
  usuario_id uuid := auth.uid();
  escola public.escolas%rowtype;
  regional public.regionais_ensino%rowtype;
  publicacao_id uuid;
  ppp_id uuid;
  versao_id uuid;
  revisao_id uuid;
  protocolo_novo text;
  formulario_inicial jsonb;
begin
  if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
  select * into escola from public.escolas where id=escola_destino_id and ativo;
  if not found or not app.pode_acessar(escola.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then
    raise exception 'Sem permissao para criar PPP desta escola';
  end if;
  select * into regional from public.regionais_ensino where id=escola.regional_ensino_id;

  perform 1 from public.escolas where id=escola.id for update;
  if exists (
    select 1 from public.versoes_ppp versao
    join public.ppps documento on documento.id=versao.ppp_id
    where documento.escola_id=escola.id
      and documento.arquivado_em is null
      and versao.situacao='rascunho'
  ) then
    raise exception 'A escola ja possui um PPP em elaboracao. Continue o rascunho existente.';
  end if;

  -- O segundo objeto prevalece deliberadamente: nome, códigos, município e
  -- regional vêm da base cadastrada, não de valores enviados pelo cliente.
  formulario_inicial := coalesce(respostas_iniciais,'{}'::jsonb) || jsonb_build_object(
    'escola',escola.nome,
    'inep',escola.codigo_inep,
    'censo',escola.codigo_inep_censo,
    'municipio',escola.municipio,
    'sre',coalesce(regional.nome,'')
  );

  select publicacao_institucional_ativa_id into publicacao_id
  from public.configuracoes_redes where rede_ensino_id=escola.rede_ensino_id;
  insert into public.ppps(rede_ensino_id,escola_id,criado_por)
    values(escola.rede_ensino_id,escola.id,usuario_id) returning id into ppp_id;
  protocolo_novo := app.proximo_protocolo_ppp();
  insert into public.versoes_ppp(ppp_id,numero,protocolo,criado_por)
    values(ppp_id,1,protocolo_novo,usuario_id) returning id into versao_id;
  insert into public.revisoes_ppp(versao_ppp_id,numero,publicacao_institucional_id,criado_por)
    values(versao_id,1,publicacao_id,usuario_id) returning id into revisao_id;
  perform app.gravar_formulario(revisao_id,formulario_inicial);
  update public.versoes_ppp set revisao_atual_id=revisao_id where id=versao_id;
  insert into public.progresso_ppp(versao_ppp_id,atualizado_por)
    values(versao_id,usuario_id);
  insert into public.eventos_ppp(versao_ppp_id,tipo,responsavel_id)
    values(versao_id,'criado',usuario_id);
  return query select versao_id,protocolo_novo,1::bigint,0::bigint;
end;
$$;

grant execute on function public.criar_rascunho_ppp(uuid,jsonb) to authenticated;
