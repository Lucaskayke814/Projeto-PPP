# Estado atual do desenvolvimento

> **Como usar:** leia este arquivo antes de alterar o projeto. Ele descreve somente o ponto atual de continuidade; deve ser reescrito ao fim de cada incremento relevante. Nao registrar senhas, tokens, chaves ou historico detalhado aqui.

## Objetivo atual

Prioridade da primeira versao: funcionalidades do perfil **Orgao Central**, preservando fielmente a interface e os comportamentos da referencia v10.2. O fluxo da escola e da SRE permanece no codigo e no banco quando necessario para consultas reais, mas nao e a prioridade imediata.

## Referencia imutavel

- Referencia oficial: `Gerador de PPP V6.5/Gerador de PPP v10.2/Gerador de PPP.html`.
- Este arquivo nao pode ser alterado, formatado, movido, renomeado ou usado como destino da implementacao.
- Validacao obrigatoria antes e depois de qualquer trabalho:

```powershell
git diff --numstat -- "Gerador de PPP V6.5/Gerador de PPP v10.2/Gerador de PPP.html"
```

A saida deve estar vazia. A copia gerada usada pela aplicacao fica em `apps/web/prototipo.html` e e ignorada pelo Git.

## Arquitetura em uso

- Frontend: Vite + TypeScript, em `apps/web`.
- Adaptacao visual: a aplicacao gera `apps/web/prototipo.html` a partir da referencia e conecta os contratos legados `servidor()` pela camada `apps/web/src/runtime/prototype-adapter.ts`.
- Persistencia: Supabase (PostgreSQL, Auth, RLS e Storage). O frontend usa somente a chave publica configurada por ambiente.
- Camadas principais:
  - `apps/web/src/runtime/prototype-adapter.ts`: ponte entre a interface original e os servicos.
  - `apps/web/src/services/`: regras de caso de uso.
  - `apps/web/src/repositories/`: chamadas RPC do Supabase.
  - `supabase/migrations/`: migrations versionadas.
- Nunca colocar `service_role`, senha do banco ou segredo no frontend ou neste arquivo.

## Banco remoto

- Projeto Supabase: `hsgvkzfueqiljeviqhdy`.
- Migrations `001` ate `048` estao aplicadas no ambiente remoto. A carga de testes fica em `supabase/seed.desenvolvimento-mg.sql` e foi aplicada no ambiente remoto.
- O banco possui RLS, RPCs com escopo institucional e auditoria para as operacoes administrativas implementadas.
- O usuario `lucaskayke06@gmail.com` esta provisionado para testes com os vinculos: `editor_escola`, `leitor_rede`, `curador_conteudo` e `administrador_acessos`. A selecao do contexto prioriza o perfil central.
- Nao alterar migrations ja aplicadas; criar uma nova migration para qualquer mudanca de schema ou funcao remota.

## Carga de desenvolvimento

- `supabase/seed.desenvolvimento-mg.sql` cria 47 SREs com nomes de referencia da SEE/MG e uma escola **ficticia** por regional, identificada como desenvolvimento.
- Cria provisionamentos pendentes para perfis central, regional, direcao e assinante do Colegiado. Os enderecos `@teste.invalid` nao sao contas Auth e nao podem autenticar via Google; eles existem para validar administracao de acessos.
- Para testar login real, provisionar um e-mail Google real ou criar a conta pelo fluxo administrativo seguro.

## Implementado e validado

### Orgao Central

- Contexto institucional de Orgao Central por Google Auth/Supabase Auth.
- Painel de PPPs com filtros, cobertura regional e registro de exportacao.
- Consulta detalhada de PPP pelo modal original **abrir documento**:
  - usa `consultar_ppp_orgao_central`;
  - retorna respostas, escola, progresso, arquivos e eventos;
  - preserva o modal e a montagem documental da referencia.
- Linha do tempo no modal original, com eventos reais de `eventos_ppp`.
- Gestao de acessos: listar vinculos e provisionamentos, salvar, revogar e registrar reenvio.
- Base de escolas: listar, cadastrar/atualizar, ativar/inativar e importar por lote com simulacao antes da aplicacao.
- Curadoria: abrir, salvar rascunhos, publicar e descartar rascunhos de conteudo institucional versionado.

### PPP e infraestrutura existente

- Criacao, salvamento, retomada e atualizacao de tela do rascunho de PPP.
- Dados do formulario divididos em tabelas relacionais; JSONB e usado somente como transporte de RPC e para conteudo institucional flexivel.
- Geracao de previa PDF e armazenamento privado no Supabase Storage.
- Login Google possui tratamento manual do retorno OAuth para evitar repeticao do login e limpeza dos parametros da URL.

## Ultimo incremento concluido

Em 23/09/2026, foi iniciado o ciclo de validacao institucional do PPP:

- Migration `039` criou os estados `em_validacao` e `validado`, a tabela relacional `pareceres_validacao_ppp`, o papel `gestor_ppp_rede` e as RPCs transacionais de envio, validacao e devolucao.
- Migration `040` expoe a capacidade `podeGerenciarPpps` no contexto institucional, inclusive para uma conta com mais de um papel.
- `lucaskayke06@gmail.com` recebeu o vinculo de teste `gestor_ppp_rede`.
- Migration `041` criou a homologacao definitiva, protegida por RLS, com auditoria, bloqueio de versao e conferencia de assinaturas. O adaptador atende `homologarPPP`.
- O adaptador agora atende `enviarParaValidacao`, `validarPPP` e `devolverPPP` com as RPCs reais.
- A migration `041` e o contrato `homologarPPP` foram adicionados no incremento seguinte: a homologacao somente ocorre para PPP encaminhado, registra auditoria e nao pode ser desfeita.
- A migration `042` criou a base relacional de atas e a assinatura da direcao; `assinarDirecao` agora encaminha automaticamente um PPP elegivel para homologacao.
- A migration `043` protege o envio de atas ao Storage privado; `registrarAta` envia, calcula hash, registra a ata e remove o objeto se o registro falhar.
- Migrations `044` e `045` criaram o papel `assinante_colegiado`, presenca vinculada a escola e assinatura individual; o adaptador atende `colegiadoDaFolha`, `presencaColegiado` e `assinarNoSistema`.
- Migration `046` permite provisionar o assinante do Colegiado somente com uma escola vinculada; a gestao de acessos agora encaminha esse escopo ao Supabase.
- Correcao de acesso regional: a reativacao na lista de equipes de uma SRE agora converte os papeis visuais legados da referencia para `leitor_regional` e recupera a SRE do acesso inativo (ou da sessao regional). A tela original nao envia a SRE no clique de reativacao; antes, isso podia criar um acesso sem escopo ou no escopo central.
- Correcao de estado da equipe: convite pendente e acesso ativo aguardando primeiro login, nao usuario inativo. O adaptador agora mostra-o como ativo e informa que a pessoa ainda nao entrou; somente vinculos ou convites revogados exibem a acao de reativar. A migration `047` tambem disponibiliza a reativacao transacional do vinculo original para um usuario realmente inativo.
- Migration `048` corrige a edicao de acesso institucional: `emailAnterior` identifica o registro selecionado, preserva SRE e papel e impede a criacao acidental de outro superintendente. Ela tambem limita a dois os superintendentes ativos de cada SRE e entrega o historico real ao contrato `acessosHistorico` da interface.

No incremento imediatamente anterior, foi conectada a consulta detalhada do painel do Orgao Central:

- `OrgaoCentralRepository.consultarPpp()` chama a RPC `consultar_ppp_orgao_central`.
- `OrgaoCentralService.consultarPpp()` expoe o caso de uso.
- `prototype-adapter.ts` passou a atender os contratos legados `registroLeitura` e `linhaDoTempo` para o perfil central.
- Nenhuma migration nova foi necessaria neste incremento.

## Proximo incremento recomendado

Implementar o ciclo institucional de aprovacao do PPP, sem criar telas novas:

1. Testar o ciclo completo com contas distintas de direcao, Colegiado e Orgao Central.
2. Completar testes de transicoes autorizadas, recusas e RLS para todo o ciclo.
3. Expor dados de assinatura, ata e homologacao no painel e no documento consultado.

Tambem permanece pendente o contrato legado `curadoriaPrevia`, usado apenas para a previa de textos de e-mail e folha de assinaturas dentro da curadoria.

## Validacoes recentes

Executadas com sucesso apos o ultimo incremento:

```powershell
npm.cmd --prefix apps/web run build
npm.cmd --prefix apps/web run test
npx.cmd supabase@latest db lint --db-url "<URL_DO_BANCO_LOCALMENTE_CONFIGURADA>" --schema public,app
```

- Build Vite/TypeScript: aprovado.
- Vitest: aprovado.
- Lint remoto dos schemas `public` e `app`: sem erros.
- Consulta remota simulando o usuario de teste: listagem disponivel; consulta detalhada retornou `ok`, respostas e eventos.
- Fluxo de validacao: o estado novo foi confirmado, `pareceres_validacao_ppp` esta com RLS ativo e o usuario de teste possui `podeGerenciarPpps=true`.
- A referencia v10.2 permaneceu sem diferencas no Git.
- `supabase test db` ainda depende de Docker local, que nao esta disponivel nesta maquina.

## Operacao local

```powershell
npm.cmd --prefix apps/web run dev
```

Use a URL exibida pelo Vite. Em caso de porta ja ocupada, o Vite escolhe outra porta. Para build, o script prepara automaticamente a copia de trabalho da referencia e verifica seu hash.

## Regras de trabalho

- Nao fazer commits nem push sem pedido explicito do usuario.
- Nao remover funcionalidades, telas ou textos da referencia.
- Nao criar telas alternativas ou dashboards genericos.
- Preferir RPCs e servicos; nao espalhar consultas Supabase por componentes/interface.
- Antes de aplicar uma migration remota: revisar SQL, criar teste correspondente e confirmar que a migration e nova.
- Ao terminar qualquer incremento relevante, atualizar este arquivo substituindo as secoes **Ultimo incremento concluIdo**, **Proximo incremento recomendado** e **Validacoes recentes**.
