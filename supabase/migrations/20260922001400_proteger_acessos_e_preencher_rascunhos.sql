-- Protege as tabelas complementares e completa identificacoes vazias de rascunhos
-- com os dados institucionais da escola vinculada. Nao altera respostas existentes
-- nem revisoes congeladas.
begin;

create or replace function app.usuario_possui_vinculo_na_rede(rede_destino_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.vinculos_usuarios vinculo
       where vinculo.usuario_id = auth.uid()
         and vinculo.rede_ensino_id = rede_destino_id
         and vinculo.revogado_em is null
     );
$$;

alter table public.arquivos_ppp enable row level security;
alter table public.catalogos enable row level security;
alter table public.configuracoes_redes enable row level security;
alter table public.eventos_auditoria enable row level security;
alter table public.eventos_ppp enable row level security;
alter table public.itens_catalogo enable row level security;
alter table public.itens_publicacao_institucional enable row level security;
alter table public.participantes_ppp enable row level security;
alter table public.provisionamentos_acesso enable row level security;
alter table public.publicacoes_institucionais enable row level security;

drop policy if exists "catalogos para usuarios autenticados" on public.catalogos;
create policy "catalogos para usuarios autenticados"
  on public.catalogos for select to authenticated using (true);

drop policy if exists "itens de catalogo para usuarios autenticados" on public.itens_catalogo;
create policy "itens de catalogo para usuarios autenticados"
  on public.itens_catalogo for select to authenticated using (true);

drop policy if exists "configuracoes da rede vinculada" on public.configuracoes_redes;
create policy "configuracoes da rede vinculada"
  on public.configuracoes_redes for select to authenticated
  using (app.usuario_possui_vinculo_na_rede(rede_ensino_id));

drop policy if exists "publicacoes da rede vinculada" on public.publicacoes_institucionais;
create policy "publicacoes da rede vinculada"
  on public.publicacoes_institucionais for select to authenticated
  using (app.usuario_possui_vinculo_na_rede(rede_ensino_id));

drop policy if exists "itens de publicacao da rede vinculada" on public.itens_publicacao_institucional;
create policy "itens de publicacao da rede vinculada"
  on public.itens_publicacao_institucional for select to authenticated
  using (exists (
    select 1 from public.publicacoes_institucionais publicacao
    where publicacao.id = publicacao_institucional_id
      and app.usuario_possui_vinculo_na_rede(publicacao.rede_ensino_id)
  ));

drop policy if exists "participantes do ppp acessivel" on public.participantes_ppp;
create policy "participantes do ppp acessivel"
  on public.participantes_ppp for select to authenticated
  using (exists (
    select 1
    from public.versoes_ppp versao
    join public.ppps documento on documento.id = versao.ppp_id
    join public.escolas escola on escola.id = documento.escola_id
    where versao.id = versao_ppp_id
      and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id)
  ));

drop policy if exists "arquivos do ppp acessivel" on public.arquivos_ppp;
create policy "arquivos do ppp acessivel"
  on public.arquivos_ppp for select to authenticated
  using (exists (
    select 1
    from public.versoes_ppp versao
    join public.ppps documento on documento.id = versao.ppp_id
    join public.escolas escola on escola.id = documento.escola_id
    where versao.id = versao_ppp_id
      and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id)
  ));

drop policy if exists "eventos do ppp acessivel" on public.eventos_ppp;
create policy "eventos do ppp acessivel"
  on public.eventos_ppp for select to authenticated
  using (exists (
    select 1
    from public.versoes_ppp versao
    join public.ppps documento on documento.id = versao.ppp_id
    join public.escolas escola on escola.id = documento.escola_id
    where versao.id = versao_ppp_id
      and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id)
  ));

drop policy if exists "auditoria para administradores da rede" on public.eventos_auditoria;
create policy "auditoria para administradores da rede"
  on public.eventos_auditoria for select to authenticated
  using (app.pode_acessar(rede_ensino_id));

-- provisionamentos_acesso permanece sem politica: somente funcoes security definer
-- podem consultar os convites antes da autenticacao do usuario.

update public.identificacoes_ppp identificacao
set nome_escola = case when trim(identificacao.nome_escola) = '' then escola.nome else identificacao.nome_escola end,
    codigo_inep = case when trim(identificacao.codigo_inep) = '' then escola.codigo_inep else identificacao.codigo_inep end,
    municipio = case when trim(identificacao.municipio) = '' then escola.municipio else identificacao.municipio end,
    regional_nome = case when trim(identificacao.regional_nome) = '' then regional.nome else identificacao.regional_nome end
from public.revisoes_ppp revisao
join public.versoes_ppp versao on versao.revisao_atual_id = revisao.id and versao.situacao = 'rascunho'
join public.ppps documento on documento.id = versao.ppp_id
join public.escolas escola on escola.id = documento.escola_id
join public.regionais_ensino regional on regional.id = escola.regional_ensino_id
where identificacao.revisao_ppp_id = revisao.id
  and (
    trim(identificacao.nome_escola) = '' or trim(identificacao.codigo_inep) = ''
    or trim(identificacao.municipio) = '' or trim(identificacao.regional_nome) = ''
  );

create or replace function public.criar_rascunho_ppp(escola_destino_id uuid,respostas_iniciais jsonb default '{}'::jsonb)
returns table(versao_ppp_id uuid,protocolo text,numero_revisao bigint,numero_revisao_progresso bigint)
language plpgsql security definer set search_path=public,app as $$
declare usuario_id uuid:=auth.uid(); escola public.escolas%rowtype; regional public.regionais_ensino%rowtype; publicacao_id uuid; ppp_id uuid; versao_id uuid; revisao_id uuid; protocolo_novo text;
begin
 if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
 select * into escola from public.escolas where id=escola_destino_id and ativo;
 if not found or not app.pode_acessar(escola.rede_ensino_id,escola.regional_ensino_id,escola.id,true) then raise exception 'Sem permissao para criar PPP desta escola'; end if;
 select * into regional from public.regionais_ensino where id=escola.regional_ensino_id;
 select publicacao_institucional_ativa_id into publicacao_id from public.configuracoes_redes where rede_ensino_id=escola.rede_ensino_id;
 insert into public.ppps(rede_ensino_id,escola_id,criado_por) values(escola.rede_ensino_id,escola.id,usuario_id) returning id into ppp_id;
 protocolo_novo:=app.proximo_protocolo_ppp();
 insert into public.versoes_ppp(ppp_id,numero,protocolo,criado_por) values(ppp_id,1,protocolo_novo,usuario_id) returning id into versao_id;
 insert into public.revisoes_ppp(versao_ppp_id,numero,publicacao_institucional_id,criado_por) values(versao_id,1,publicacao_id,usuario_id) returning id into revisao_id;
 perform app.gravar_formulario(revisao_id,respostas_iniciais);
 update public.identificacoes_ppp
    set nome_escola=case when trim(nome_escola)='' then escola.nome else nome_escola end,
        codigo_inep=case when trim(codigo_inep)='' then escola.codigo_inep else codigo_inep end,
        municipio=case when trim(municipio)='' then escola.municipio else municipio end,
        regional_nome=case when trim(regional_nome)='' then regional.nome else regional_nome end
  where revisao_ppp_id=revisao_id;
 update public.versoes_ppp set revisao_atual_id=revisao_id where id=versao_id;
 insert into public.progresso_ppp(versao_ppp_id,atualizado_por) values(versao_id,usuario_id);
 insert into public.eventos_ppp(versao_ppp_id,tipo,responsavel_id) values(versao_id,'criado',usuario_id);
 return query select versao_id,protocolo_novo,1::bigint,0::bigint;
end; $$;

grant execute on function app.usuario_possui_vinculo_na_rede(uuid) to authenticated;
grant execute on function public.criar_rascunho_ppp(uuid,jsonb) to authenticated;

commit;
