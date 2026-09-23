with usuario as (
  select id from auth.users where lower(email) = 'lucaskayke06@gmail.com'
), configurado as (
  select set_config('request.jwt.claim.sub', id::text, true) from usuario
), sincronizado as (
  select public.sincronizar_meu_acesso() from configurado
), acessos as (
  select public.obter_meus_acessos_institucionais() as dados from sincronizado
), conteudo as (
  select public.obter_conteudo_institucional_publicado() as dados from acessos
)
select jsonb_build_object(
  'vinculos_lidos', jsonb_array_length((select dados from acessos)) >= 1,
  'conteudo_publicado_lido', (select dados from conteudo) ? 'itens',
  'contrato_ok', (select dados from conteudo) ->> 'ok' = 'true'
) as validacao_fundacao_orgao_central;
