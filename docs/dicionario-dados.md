# Dicionário de dados

Este é o modelo ativo do Gerador de PPP. Todas as tabelas usam português e plurais; chaves primárias são `id`, chaves estrangeiras terminam em `_id` e datas terminam em `_em`. Não existem colunas JSONB persistidas.

| Grupo | Tabelas | Finalidade |
| --- | --- | --- |
| Organização | `redes_ensino`, `regionais_ensino`, `escolas` | Estrutura administrativa e cadastro de escolas. |
| Pessoas | `perfis_usuarios`, `vinculos_usuarios` | Perfil complementar ao Supabase Auth e permissões por rede, regional ou escola. |
| Conteúdo | `catalogos`, `itens_catalogo`, `publicacoes_institucionais`, `itens_publicacao_institucional`, `configuracoes_redes` | Opções e textos institucionais publicados. |
| Documento | `ppps`, `versoes_ppp`, `revisoes_ppp` | Identidade permanente, versão e histórico imutável de salvamentos. |
| Formulário | `identificacoes_ppp`, `textos_ppp`, `ofertas_ensino_ppp`, `opcoes_pedagogicas_ppp`, `indicadores_educacionais_ppp`, `detalhes_ppp`, `tarefas_revisoes_ppp` | Respostas de cada revisão, separadas pelo seu domínio. |
| Progresso | `progresso_ppp`, `tarefas_progresso_ppp` | Última tela e tarefas atuais da versão em edição. |
| Evidências | `participantes_ppp`, `arquivos_ppp`, `eventos_ppp`, `eventos_auditoria` | Assinaturas, Storage, histórico e auditoria. |

## Onde cada resposta é salva

- Identificação da escola, direção, endereço e vigência: `identificacoes_ppp`.
- Textos como histórico, missão, diagnóstico e objetivos: `textos_ppp`.
- Etapas e modalidades: `ofertas_ensino_ppp`.
- Infraestrutura, temas, princípios e metodologias: `opcoes_pedagogicas_ppp`.
- Indicadores educacionais: `indicadores_educacionais_ppp`.
- Campos condicionais de modalidades: `detalhes_ppp`.
- Tarefas: `tarefas_revisoes_ppp` e `tarefas_progresso_ppp`.

Cada salvamento cria uma nova linha em `revisoes_ppp` e novas respostas relacionadas a ela. A versão aponta para a última revisão por `versoes_ppp.revisao_atual_id`; versões e revisões anteriores nunca são sobrescritas.
