-- A política de storage.objects não pode consultar escolas diretamente, pois
-- ela também está protegida por RLS. A verificação ocorre nesta função.
create or replace function app.pode_ler_arquivo_ppp(caminho_arquivo text)
returns boolean
language sql
stable
security definer
set search_path=public,app
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.arquivos_ppp arquivo
       join public.versoes_ppp versao on versao.id = arquivo.versao_ppp_id
       join public.ppps documento on documento.id = versao.ppp_id
       join public.escolas escola on escola.id = documento.escola_id
       where arquivo.caminho_storage = caminho_arquivo
         and arquivo.removido_em is null
         and app.pode_acessar(documento.rede_ensino_id, escola.regional_ensino_id, escola.id)
     );
$$;

drop policy if exists "ler arquivo de ppp acessivel" on storage.objects;
create policy "ler arquivo de ppp acessivel"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ppp-private'
    and app.pode_ler_arquivo_ppp(name)
  );

grant execute on function app.pode_ler_arquivo_ppp(text) to authenticated;
