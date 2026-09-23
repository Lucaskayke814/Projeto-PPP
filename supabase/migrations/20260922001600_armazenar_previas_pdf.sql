-- Bucket privado, políticas de Storage e registro auditável das prévias em PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ppp-private',
  'ppp-private',
  false,
  12582912,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function app.pode_enviar_previa_pdf(caminho_arquivo text)
returns boolean
language plpgsql
stable
security definer
set search_path=public,app
as $$
declare
  versao_destino_id uuid;
begin
  if auth.uid() is null then return false; end if;
  if caminho_arquivo !~ '^previas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+\.pdf$' then
    return false;
  end if;
  versao_destino_id := split_part(caminho_arquivo, '/', 2)::uuid;
  return exists (
    select 1
    from public.versoes_ppp versao
    join public.ppps documento on documento.id = versao.ppp_id
    join public.escolas escola on escola.id = documento.escola_id
    where versao.id = versao_destino_id
      and versao.situacao = 'rascunho'
      and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id, true)
  );
end;
$$;

drop policy if exists "enviar previa de ppp acessivel" on storage.objects;
create policy "enviar previa de ppp acessivel"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ppp-private'
    and app.pode_enviar_previa_pdf(name)
  );

drop policy if exists "remover previa de ppp acessivel" on storage.objects;
create policy "remover previa de ppp acessivel"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ppp-private'
    and app.pode_enviar_previa_pdf(name)
  );

drop policy if exists "ler arquivo de ppp acessivel" on storage.objects;
create policy "ler arquivo de ppp acessivel"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ppp-private'
    and exists (
      select 1
      from public.arquivos_ppp arquivo
      join public.versoes_ppp versao on versao.id = arquivo.versao_ppp_id
      join public.ppps documento on documento.id = versao.ppp_id
      join public.escolas escola on escola.id = documento.escola_id
      where arquivo.caminho_storage = storage.objects.name
        and arquivo.removido_em is null
        and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id)
    )
  );

create or replace function public.registrar_previa_pdf_ppp(
  versao_ppp_destino_id uuid,
  caminho_storage_destino text,
  nome_original_destino text,
  tamanho_bytes_destino bigint,
  hash_sha256_destino text
)
returns uuid
language plpgsql
security definer
set search_path=public,app,storage
as $$
declare
  usuario_id uuid := auth.uid();
  versao public.versoes_ppp%rowtype;
  documento public.ppps%rowtype;
  escola public.escolas%rowtype;
  arquivo_id uuid;
begin
  if usuario_id is null then raise exception 'Autenticacao obrigatoria'; end if;
  if tamanho_bytes_destino < 1 or tamanho_bytes_destino > 12582912 then raise exception 'Tamanho do PDF invalido'; end if;
  if hash_sha256_destino !~ '^[0-9a-f]{64}$' then raise exception 'Hash SHA-256 invalido'; end if;
  if caminho_storage_destino !~ '^previas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+\.pdf$' then
    raise exception 'Caminho de previa invalido';
  end if;
  if split_part(caminho_storage_destino, '/', 2)::uuid <> versao_ppp_destino_id then
    raise exception 'O caminho do arquivo nao corresponde a versao do PPP';
  end if;

  select * into versao from public.versoes_ppp where id = versao_ppp_destino_id for update;
  if not found or versao.situacao <> 'rascunho' then raise exception 'PPP indisponivel para gerar previa'; end if;
  select * into documento from public.ppps where id = versao.ppp_id;
  select * into escola from public.escolas where id = documento.escola_id;
  if not app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id, true) then
    raise exception 'Sem permissao para gerar previa deste PPP';
  end if;
  if not exists (
    select 1 from storage.objects objeto
    where objeto.bucket_id = 'ppp-private' and objeto.name = caminho_storage_destino
  ) then
    raise exception 'Arquivo PDF nao encontrado no Storage';
  end if;

  insert into public.arquivos_ppp(
    versao_ppp_id, tipo, caminho_storage, nome_original, tipo_mime,
    tamanho_bytes, hash_sha256, criado_por
  ) values (
    versao.id, 'previa', caminho_storage_destino, nome_original_destino,
    'application/pdf', tamanho_bytes_destino, hash_sha256_destino, usuario_id
  ) returning id into arquivo_id;

  insert into public.eventos_ppp(versao_ppp_id, tipo, descricao, responsavel_id)
  values (versao.id, 'previa_pdf_gerada', 'Previa em PDF gerada e armazenada.', usuario_id);
  insert into public.eventos_auditoria(rede_ensino_id, responsavel_id, acao, entidade, entidade_id, descricao)
  values (documento.rede_ensino_id, usuario_id, 'gerar_previa_pdf', 'arquivos_ppp', arquivo_id, 'Previa em PDF registrada no Storage.');
  return arquivo_id;
end;
$$;

grant execute on function app.pode_enviar_previa_pdf(text) to authenticated;
grant execute on function public.registrar_previa_pdf_ppp(uuid,text,text,bigint,text) to authenticated;
