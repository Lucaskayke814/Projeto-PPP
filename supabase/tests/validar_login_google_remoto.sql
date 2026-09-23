with usuario as (
  select id from auth.users where lower(email) = 'lucaskayke06@gmail.com'
), configurado as (
  select set_config('request.jwt.claim.sub', id::text, true) as usuario_id from usuario
), sincronizado as (
  select public.sincronizar_meu_acesso() from configurado
), contexto as (
  select public.obter_contexto_institucional() as dados from sincronizado
), painel as (
  select count(*)::integer as quantidade from public.listar_ppps_do_painel('',20,0)
)
select jsonb_build_object(
  'contexto_da_escola', (dados ->> 'escolaId') is not null,
  'papel_editor_escola', (dados ->> 'papel') = 'editor_escola',
  'dados_da_escola_presentes', coalesce(dados ->> 'escola','') <> '',
  'painel_consultado', quantidade >= 0
) as validacao_acesso_aplicacao
from contexto cross join painel;
