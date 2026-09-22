-- Mantém o ponto exato de retomada sem criar uma nova revisão do formulário.
create or replace function public.atualizar_tela_atual_ppp(
  versao_ppp_destino_id uuid,
  proxima_tela_atual_chave text
)
returns void
language plpgsql
security definer
set search_path=public,app
as $$
declare
  usuario_id uuid := auth.uid();
  versao public.versoes_ppp%rowtype;
  documento public.ppps%rowtype;
  escola public.escolas%rowtype;
begin
  if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
  if proxima_tela_atual_chave !~ '^t[0-9]{2}$' then raise exception 'Tela de retomada invalida'; end if;

  select * into versao from public.versoes_ppp where id=versao_ppp_destino_id for update;
  if not found or versao.situacao <> 'rascunho' then raise exception 'PPP indisponivel para alteracao'; end if;
  select * into documento from public.ppps where id=versao.ppp_id;
  select * into escola from public.escolas where id=documento.escola_id;
  if not app.pode_acessar(documento.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then
    raise exception 'Sem permissao para alterar este PPP';
  end if;

  update public.progresso_ppp
     set tela_atual=proxima_tela_atual_chave,
         atualizado_por=usuario_id,
         atualizado_em=now()
   where versao_ppp_id=versao.id;
end;
$$;

grant execute on function public.atualizar_tela_atual_ppp(uuid,text) to authenticated;
