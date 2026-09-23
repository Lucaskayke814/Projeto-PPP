-- Os itens dos catálogos da v10.2 possuem conteúdo pedagógico além do rótulo.
-- Cada orientação do documento fica em uma linha para poder ser editada,
-- ordenada e publicada posteriormente sem serialização JSON.
alter table public.itens_catalogo
  add column if not exists referencia text not null default '',
  add column if not exists texto_documento text not null default '',
  add column if not exists texto_formativo text not null default '';

create table if not exists public.orientacoes_itens_catalogo (
  catalogo_codigo text not null,
  item_codigo text not null,
  ordem integer not null check(ordem > 0),
  texto text not null,
  primary key(catalogo_codigo,item_codigo,ordem),
  foreign key(catalogo_codigo,item_codigo)
    references public.itens_catalogo(catalogo_codigo,codigo)
    on delete cascade
);

alter table public.orientacoes_itens_catalogo enable row level security;

create policy "catalogos lidos por usuarios autenticados"
  on public.orientacoes_itens_catalogo
  for select to authenticated
  using (true);
