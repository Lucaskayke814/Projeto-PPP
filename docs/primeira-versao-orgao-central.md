# Primeira versao: Orgao Central

A primeira versao funcional prioriza o Orgao Central. O fluxo da escola e a interface propria das regionais continuam preservados no banco para consulta central, mas nao sao o foco desta etapa.

## Fundacao de banco entregue

- Escopo organizacional relacional: rede, regional e escola, com triggers que impedem cruzamento de redes.
- Usuarios por Supabase Auth e vinculos com papeis: editor de escola, leitor regional, leitor de rede, curador de conteudo e administrador de acessos.
- Provisionamentos de acesso com criacao, uso, revogacao, reativacao e registro de reenvio. O reenvio nao envia e-mail diretamente: ele registra uma solicitacao auditavel ate existir a integracao de entrega.
- Consulta central de PPPs, cobertura regional, detalhe de documento, arquivos e eventos.
- Curadoria por rascunho e publicacao imutavel, com historico e descarte controlado.
- Cadastro unitario de escolas e importacao em dois passos: validar lote, revisar linhas e aplicar. Nenhuma escola e alterada enquanto o lote possuir erros.
- Auditoria das operacoes administrativas e RLS ativa nas tabelas administrativas.

## Contratos RPC principais

| Dominio | Operacoes |
| --- | --- |
| Contexto | `obter_meus_acessos_institucionais`, `obter_contexto_institucional` |
| Consulta central | `obter_cobertura_rede_ppps`, `listar_ppps_orgao_central`, `consultar_ppp_orgao_central` |
| Acessos | `listar_vinculos_rede`, `listar_provisionamentos_acesso`, `salvar_provisionamento_acesso`, `revogar_vinculo_rede`, `revogar_provisionamento_acesso`, `registrar_reenvio_convite_acesso` |
| Escolas | `salvar_escola_rede`, `criar_lote_importacao_escolas`, `listar_lotes_importacao_escolas`, `listar_linhas_lote_importacao_escolas`, `aplicar_lote_importacao_escolas` |
| Curadoria | `abrir_curadoria_conteudo`, `salvar_rascunhos_curadoria`, `descartar_rascunhos_curadoria`, `listar_publicacoes_institucionais`, `publicar_conteudo_institucional` |

## Limites deliberados

O banco esta pronto para receber a interface central. A tela central ainda precisa consumir esses contratos. Envio de e-mail de convite, exportacao fisica de arquivos e importacao de CSV no navegador serao integrados depois, com Edge Function ou servico protegido quando houver definicao do provedor.
