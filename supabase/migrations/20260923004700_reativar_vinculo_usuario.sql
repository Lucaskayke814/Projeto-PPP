begin;

create or replace function public.reativar_vinculo_rede(vinculo_destino_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  vinculo public.vinculos_usuarios%rowtype;
begin
  select * into vinculo
  from public.vinculos_usuarios
  where id = vinculo_destino_id
  for update;

  if not found then
    raise exception 'Vinculo de acesso nao encontrado';
  end if;

  if not app.usuario_administra_acessos(vinculo.rede_ensino_id) then
    raise exception 'Sem permissao para administrar acessos desta rede';
  end if;

  if vinculo.revogado_em is null then
    return;
  end if;

  if exists (
    select 1
    from public.vinculos_usuarios ativo
    where ativo.usuario_id = vinculo.usuario_id
      and ativo.rede_ensino_id = vinculo.rede_ensino_id
      and ativo.papel = vinculo.papel
      and ativo.regional_ensino_id is not distinct from vinculo.regional_ensino_id
      and ativo.escola_id is not distinct from vinculo.escola_id
      and ativo.revogado_em is null
  ) then
    return;
  end if;

  update public.vinculos_usuarios
  set revogado_em = null
  where id = vinculo.id;

  insert into public.eventos_auditoria(
    rede_ensino_id, responsavel_id, acao, entidade, entidade_id, descricao
  ) values (
    vinculo.rede_ensino_id, auth.uid(), 'acesso_reativado', 'vinculo_usuario', vinculo.id,
    'Vinculo reativado'
  );
end;
$$;

grant execute on function public.reativar_vinculo_rede(uuid) to authenticated;

commit;
