/**
 * ============================================================
 *  GERADOR DE PPP — PERCURSO FORMATIVO
 *  Backend (Google Apps Script + Google Sheets) · Versão 7.9
 * ============================================================
 *  Ciclo de vida do documento:
 *    Em andamento  → editável livremente
 *    Em assinatura → CONGELADO. Direção assina no app; membros do
 *                    Colegiado assinam por link enviado por e-mail
 *    Assinado      → definitivo. Alterações só por NOVA VERSÃO
 *
 *  ARQUIVOS DO PROJETO (Apps Script):
 *    Código.gs      — este arquivo
 *    Index          — esqueleto da página (inclui Css e App)
 *    Css            — as folhas de estilo
 *    App            — o JavaScript do percurso formativo
 *  (v8.0: o frontend foi partido em três; o Index os junta por include().)
 *  (v8.1: a página externa de assinatura foi aposentada — o Colegiado assina
 *   dentro do sistema, com o acesso que a direção cadastrou.)
 *
 *  IMPLANTAÇÃO:
 *  1. Planilha nova, criada pela CONTA INSTITUCIONAL que será a dona do
 *     sistema → Extensões → Apps Script.
 *  2. Cole este arquivo em "Código.gs".
 *  3. "+" → HTML → "Index", "Css" e "App" → cole cada arquivo de mesmo nome.
 *  4. Recarregue a planilha e use o menu "Gerador de PPP" → "Verificar
 *     configuração" (autoriza e-mail, Drive e planilha).
 *  5. Menu "Gerador de PPP" → "Instalar backup diário" (backup da planilha e
 *     fila de e-mails a cada 10 minutos — v7.6).
 *  6. Menu "Gerador de PPP" → "Definir senha institucional" e preencha a lista
 *     CURADORES com os e-mails do Órgão Central (edição dos textos do sistema).
 *     v8.13 (E01): as rotinas de manutenção passaram a ser PRIVADAS (nome
 *     terminado em "_") — é o que as retira do google.script.run —, e por isso
 *     não aparecem mais no seletor de funções do editor. O caminho delas é o
 *     menu da planilha.
 *  7. Implantar → Nova implantação → App da Web:
 *       Executar como: EU (a conta institucional dona da planilha)
 *       Quem pode acessar: QUALQUER PESSOA COM CONTA GOOGLE
 *
 *  POR QUE "EXECUTAR COMO: EU" (v7.4):
 *   · A planilha e a pasta "Gerador PPP — Documentos" pertencem a UMA conta:
 *     ninguém precisa de permissão de edição na base, e o PDF, a ata e os
 *     anexos ficam sempre alcançáveis pelo app — que os entrega ao navegador
 *     por documentoPdf(), depois de checar a autorização. Nenhum link direto
 *     do Drive é exposto.
 *   · Quem tem conta do MESMO domínio Workspace continua sendo identificado
 *     por Session.getActiveUser() e entra sem senha. Quem não tem (Gmail,
 *     Yahoo, pais e estudantes do colegiado) entra por e-mail e senha, pelo
 *     link de primeiro acesso. Identificação vazia é NORMAL nesta
 *     implantação: não é sinal de controle inativo.
 *   · O controle de acesso é o CADASTRO + a SESSÃO: toda gravação exige token
 *     de sessão (v7.4, P3). O único caminho sem sessão é o link individual
 *     de assinatura (?t=<token>), protegido pelo token do convite.
 *   · Cotas: o e-mail (MailApp) e as execuções simultâneas passam a contar
 *     para a conta dona. Acompanhe MailApp.getRemainingDailyQuota() em
 *     "Verificar configuração".
 *
 *  ESCALA (v7.5, P2) — atualizando uma base em uso:
 *   · Menu "Gerador de PPP" → "Recalcular % preenchido" uma vez depois de colar esta versão:
 *     ela preenche a coluna nova "% preenchido" nas linhas antigas (se não
 *     executar, a primeira chamada do painel faz o mesmo, uma vez só).
 *   · Piloto técnico: numa CÓPIA da planilha (nome com "TESTE" ou "CÓPIA"),
 *     gerarBaseSintetica_(3400, 'SIM') cria uma rede do tamanho real e
 *     medirDesempenho_('SIM') cronometra as chamadas mais frequentes. As duas
 *     são privadas (v8.13, E01) e se executam a partir de uma função
 *     temporária escrita no editor, na cópia — nunca em produção.
 *
 *  CARGA DE DIRETORES E FILA DE E-MAILS (v7.6, P4):
 *   · Use "Instalar backup diário" de novo ao atualizar: ele instala o
 *     acionador da fila (processarFilaEmails_, a cada 10 min) e cria a aba
 *     "Fila de e-mails".
 *
 *  SESSÃO, HISTÓRICO E BACKUP (v7.8, P7/P8/P10):
 *   · Use "Instalar backup diário" de novo: instala a verificação semanal de
 *     integridade e a rotação mensal do histórico de acessos, e cria as
 *     abas "Acessos — histórico", "Ciclo — histórico" e "Integridade".
 *   · A senha das pessoas e a senha institucional passam a v2 (pepper nas
 *     propriedades do script + 5.000 passadas) na primeira entrada válida;
 *     nada a fazer. Se quiser, redefina a senha institucional pelo menu
 *     ("Definir senha institucional") para já nascer em v2.
 *   · Restauração a partir de um backup: procedimento no LEIA-ME.
 *
 *  HOMOLOGAÇÃO PELA SRE E SANEAMENTO (v7.9, P9/P11):
 *   · Três colunas novas ao final dos Registros (homologação registrada
 *     por / em / ato) — nada a fazer: abaRegistros_ completa o cabeçalho.
 *   · Se a planilha foi usada com as versões 7.0 a 7.2, use UMA vez o menu
 *     Gerador de PPP → "Sanear histórico de gestores", que marca as linhas
 *     de colegiado gravadas como gestão.
 *   · A carga dos 3.401 diretores da base é feita pela tela ("Acessos das
 *     escolas" → "Importar diretores em lote"), com simulação obrigatória.
 *     Os convites vão pela fila; contas do domínio recebem só boas-vindas.
 * ============================================================
 */

const NOME_ABA = 'Registros';
const NOME_PASTA_PDF = 'Gerador PPP — Documentos';

/** E-mails com acesso a todos os registros (equipe da SRE / SEE). */
const ADMINS = [
  // 'fulano@educacao.mg.gov.br',
];

/* v8.13 (D02) — QUEM ESCREVE CADA COLUNA.
   `deTela:true` marca a coluna que a TELA DA ESCOLA escreve. Coluna sem a
   marca é do servidor: salvarPPP_ preserva o que já está gravado e ignora o
   que vier no payload. Era o contrário até a 8.12 — uma lista NEGRA de 18
   chaves, e tudo o que ninguém se lembrasse de proteger vinha da tela: a
   homologação da SRE, o link da ata, os textos congelados da folha e até a
   bandeira interna `concluindo`. Invertida a lista, coluna nova nasce
   protegida: quem acrescentar uma não precisa lembrar de protegê-la —
   precisa lembrar de LIBERÁ-LA, se for o caso. */
const CAMPOS = [
  {col:'Protocolo',                  key:'protocolo'},
  {col:'Versão',                     key:'versao'},
  {col:'Revisão de',                 key:'origem'},
  {col:'Status',                     key:'status'},
  {col:'Responsável (e-mail)',       key:'email'},
  {col:'E-mails autorizados',        key:'compartilhado'},
  {col:'Criado em',                  key:'criadoEm'},
  {col:'Atualizado em',              key:'atualizadoEm'},
  {col:'Concluído em',               key:'concluidoEm'},
  {col:'Código de verificação',      key:'hash'},
  {col:'Assinaturas (JSON)',         key:'assinaturas'},
  {col:'Documento congelado (ID)',   key:'fonteId'},
  {col:'Escola',                     key:'escola', deTela:true},
  {col:'Código INEP',                key:'inep'},
  {col:'Município',                  key:'municipio', deTela:true},
  {col:'SRE',                        key:'sre'},
  {col:'Diretor(a)',                 key:'direcao', deTela:true},
  {col:'Especialista / Coordenação', key:'especialista', deTela:true},
  {col:'Endereço',                   key:'endereco', deTela:true},
  {col:'Ato de criação',             key:'ato', deTela:true},
  {col:'Turnos',                     key:'turnos', deTela:true},
  {col:'Nº de estudantes',           key:'estudantes', deTela:true},
  {col:'Nº de turmas',               key:'turmas', deTela:true},
  {col:'Presidente do Colegiado',    key:'colegiado', deTela:true},
  {col:'Vigência',                   key:'vigencia', deTela:true},
  {col:'Assembleia de validação',    key:'assembleia', deTela:true},
  {col:'Análise técnica da SRE',     key:'analiseSre', deTela:true},
  {col:'Quórum — presentes',         key:'quorumPresentes', deTela:true},
  {col:'Quórum — total de membros',  key:'quorumTotal', deTela:true},
  {col:'Detalhes das ofertas (JSON)',key:'detalhes', deTela:true,
   rotulo:'Cursos técnicos ofertados / detalhamento das ofertas (tela das modalidades)'},
  {col:'Seleções por id (JSON)',      key:'selecoes', deTela:true,
   rotulo:'marcações das telas de seleção'},
  {col:'Edição — sessão',            key:'lockSessao'},
  {col:'Edição — desde',             key:'lockDesde'},
  {col:'Etapas de ensino',           key:'etapas', deTela:true,      tipo:'lista'},
  {col:'Modalidades',                key:'mods', deTela:true,        tipo:'lista'},
  {col:'Infraestrutura',             key:'infra', deTela:true,       tipo:'lista'},
  {col:'Temas transversais',         key:'temas', deTela:true,       tipo:'lista'},
  {col:'Princípios norteadores',     key:'principios', deTela:true,  tipo:'lista'},
  {col:'Metodologias',               key:'metodos', deTela:true,     tipo:'lista'},
  {col:'Indicadores (JSON)',         key:'indicadores', deTela:true,
   rotulo:'tabela de indicadores do diagnóstico'},
  {col:'Apresentação',            key:'tApresentacao', deTela:true},
  {col:'1. Histórico',               key:'tHistorico', deTela:true},
  {col:'2.1 Comunidade escolar',     key:'tComunidade', deTela:true},
  {col:'2.2 Perfil dos estudantes',  key:'tEstudantes', deTela:true},
  {col:'2.3 Infraestrutura',         key:'tInfraestrutura', deTela:true},
  {col:'2.4 Leitura dos indicadores',key:'tDiagnostico', deTela:true},
  {col:'3. Princípios na prática',   key:'tPrincipios', deTela:true},
  {col:'4. Missão, visão e valores', key:'tMissao', deTela:true},
  {col:'5. Objetivos',               key:'tObjetivos', deTela:true},
  {col:'6.1 Organização das etapas',  key:'tEtapas', deTela:true},
  {col:'6.2 Organização das modalidades', key:'tModalidades', deTela:true},
  {col:'6.3 Organização curricular', key:'tCurriculo', deTela:true},
  {col:'7. Temas transversais',      key:'tTemas', deTela:true},
  {col:'8. Metodologias',           key:'tMetodologias', deTela:true},
  {col:'9.1 Avaliação',              key:'tAvaliacao', deTela:true},
  {col:'10. Educação inclusiva',     key:'tInclusiva', deTela:true},
  {col:'11. Relações étnico-raciais',key:'tEtnico', deTela:true},
  {col:'12. Cultura digital',        key:'tDigital', deTela:true},
  {col:'13. Protagonismo estudantil',key:'tProtagonismo', deTela:true},
  {col:'15. Escola-família-comunidade', key:'tFamilia', deTela:true},
  {col:'16. Formação continuada',    key:'tFormacao', deTela:true},
  {col:'17. Gestão democrática',     key:'tGestao', deTela:true},
  {col:'18. Projetos e programas',   key:'tProjetos', deTela:true},
  {col:'19.1 Plano de Ação',          key:'tPlanoAcao', deTela:true},
  {col:'19. Acompanhamento',         key:'tAcompanhamento', deTela:true},
  {col:'21. Referenciais teóricos',  key:'tReferencias', deTela:true},
  {col:'Data de aprovação',          key:'aprovacao', deTela:true},
  {col:'Ata — arquivo (ID)',         key:'ataId'},
  {col:'Ata — link',                 key:'ataUrl'},
  {col:'Ata — nome do arquivo',      key:'ataNome'},
  {col:'Ata — reunião em',           key:'ataData'},
  {col:'Ata — identificação',        key:'ataIdent'},
  {col:'Anexos (JSON)',              key:'anexos'},
  {col:'Homologação — destino',      key:'homolDestino'},
  {col:'Homologação — enviado em',   key:'homolData'},
  {col:'PDF (Drive)',                key:'pdfUrl'},
  {col:'Tela atual',                 key:'tela', deTela:true},
  /* Campos novos entram SEMPRE ao final, para não desalinhar planilhas já em uso. */
  {col:'Tarefas confirmadas (JSON)', key:'tarefas', deTela:true,
   rotulo:'itens de preparação confirmados'},
  {col:'19.3 Balanço da vigência anterior', key:'tBalanco', deTela:true},
  {col:'Objetivos da versão anterior',      key:'objetivosAnteriores'},
  {col:'Indicadores da versão anterior (JSON)', key:'indicadoresAnteriores'},
  {col:'Justificativa da proposta',                 key:'tJustificativa', deTela:true},
  {col:'6.4 Organização do trabalho e calendário',  key:'tOrganizacaoTrabalho', deTela:true},
  {col:'9.2 Classificação e reclassificação',       key:'tAceleracao', deTela:true},
  {col:'14.1 Plano de Convivência Escolar',         key:'tConvivencia', deTela:true},
  {col:'15.1 Informação às famílias',               key:'tComunicacaoFamilias', deTela:true},
  {col:'17.1 Articulação entre profissionais',      key:'tArticulacao', deTela:true},
  {col:'17.2 Participação no processo decisório',   key:'tDecisorio', deTela:true},
  {col:'19.2 Avaliação institucional',              key:'tAvaliacaoInstitucional', deTela:true},
  {col:'20. Outros aspectos',                       key:'tOutrosAspectos', deTela:true},
  /* v7.0 — validação pela Diretoria Educacional. Colunas novas SEMPRE ao
     final, para não desalinhar planilhas em uso. */
  {col:'Enviado para validação em',                 key:'enviadoValidacaoEm'},
  {col:'Validado por',                              key:'validadoPor'},
  {col:'Validado em',                               key:'validadoEm'},
  {col:'Parecer da validação',                      key:'parecerValidacao'},
  {col:'Devoluções',                                key:'devolucoes'},
  /* v7.4 (P1) — o PDF é entregue pelo app (documentoPdf), lido pelo ID do
     arquivo no Drive; a coluna "PDF (Drive)" continua gravada por
     compatibilidade, mas a tela não a expõe mais como link. AO FINAL. */
  {col:'PDF — arquivo (ID)',                        key:'pdfId'},
  /* v7.5 (P2) — o "% preenchido" é calculado pelo servidor a cada gravação e
     guardado aqui, para que o painel não precise ler as colunas de texto.
     Linhas anteriores à 7.5 (célula vazia) são completadas pela primeira
     chamada do painel ou por recalcularPercentuais_(). AO FINAL. */
  {col:'% preenchido',                              key:'pct'},
  /* v7.9 (P9) — a homologação REGISTRADA PELA SRE: quem, quando e, se
     houver, o ato. "Homologação — destino/enviado em" continuam sendo a
     autodeclaração de envio da escola. AO FINAL.
     v9.4: nada passa por sistema de processos — o rótulo da coluna perdeu
     a menção; uma base criada antes conserva o rótulo antigo, aceito por
     CABECALHOS_ANTIGOS_ em conferirCabecalho_. */
  {col:'Homologação — registrada por',              key:'homolPor'},
  {col:'Homologação — registrada em',               key:'homolEm'},
  {col:'Homologação — ato',                         key:'homolAto'},
  /* v8.11 — os textos da folha de assinaturas congelados na conclusão: o
     documento assinado não muda quando o Órgão Central reescreve os textos
     do sistema. Coluna nova entra SEMPRE no fim. */
  {col:'Textos da folha (JSON, congelados)',        key:'textosFolha'},
  /* v8.13 (D01) — O NÚMERO DE REVISÃO DA LINHA. Sobe a cada escrita no
     registro. O cliente recebe `rev` ao abrir e ao salvar, e devolve-o no
     salvamento seguinte: divergindo, a gravação é RECUSADA em vez de
     sobrescrever em silêncio o que outra aba (ou outro ato) já gravou.
     Vai ao FINAL, como toda coluna nova, para não desalinhar planilha em
     uso — e célula vazia (toda linha gravada antes da 8.13) vale 0, de modo
     que registro antigo continua funcionando sem conversão nenhuma. */
  {col:'Revisão do registro',                      key:'rev'},
  /* v9.8 — O CÓDIGO INEP DA ESCOLA (Censo Escolar), obrigatório na base de
     escolas desde esta versão. Não é digitado na tela: é copiado da base no
     momento da gravação, como a SRE. A coluna existe porque a folha de rosto
     precisa dele mesmo quando quem lê o documento é a regional, que não tem
     a base da escola carregada — e porque o documento congelado tem de
     guardar o código vigente na conclusão. Entra no FIM, como toda coluna
     nova; a coluna 'Código da escola' continua sendo o código da SEE. */
  {col:'Código INEP (Censo Escolar)',              key:'censo'}
];


const IDX = {};
CAMPOS.forEach(function (c, i) { IDX[c.key] = i + 1; });


/* ============================================================
   v8.13 (E01) — A SUPERFÍCIE PÚBLICA DO SERVIDOR

   No Apps Script, TODA função de topo sem "_" final é chamável por qualquer
   navegador que abra o app: é essa, e só essa, a definição de "público". O
   inventário da área 8 achou 76 funções nessa condição — 46 que exigem
   sessão e conferem escopo, 12 portas públicas por desenho, e 18 rotinas de
   manutenção que não deveriam estar ali (uma delas trocava a senha do Órgão
   Central sem sessão nenhuma).

   Três camadas, cada uma com um papel diferente:

   1. O SUBLINHADO É O MECANISMO. É a única coisa que de fato retira uma
      função do google.script.run. As rotinas de manutenção passaram a ter o
      corpo em `nome_`. Quem as chama de dentro do servidor chama a privada.

   2. A TELA FALA COM UM DESPACHANTE ÚNICO. `api({fn, args})` procura o nome
      em API_TELA e chama a função. Fora do mapa, recusa. Isso não fecha nada
      que o sublinhado já não feche — as 46 conferem sessão —, mas torna a
      lista um OBJETO REAL E CONFERÍVEL, dá um único lugar para política
      transversal futura, e permite tornar as 46 privadas depois, uma a uma,
      sem tocar no frontend outra vez. Elas continuam públicas agora, de
      propósito: uma aba aberta antes da implantação continua chamando pelo
      nome antigo e continua funcionando.

   3. O QUE PRECISA DE NOME PÚBLICO TEM NOME PÚBLICO, por um caminho que a
      tela não alcança: acionadores apontam para os nomes privados
      (instalarAcionadores_), o menu da planilha usa invólucros `menu…`
      guardados por somenteMenu_(), e o que o Órgão Central dispara pela
      interface entra aqui com sessaoCentral_.

   E a conferência que impede a reincidência: `verifica.js` lê este arquivo e
   FALHA quando existe função de topo sem "_" que não seja doGet, include,
   onOpen, api, um invólucro `menu…` ou um nome deste mapa. Daqui para a
   frente, publicar uma função é uma decisão explícita, não um descuido.

   A LISTA É O CONTRATO: um nome esquecido aqui quebra uma tela inteira.
   Ela foi montada varrendo as chamadas `servidor('…')` do App.html, mais os
   nome que a tela monta em tempo de execução (colegiadoImportar, em
   importarLote) e os invólucros do Órgão Central.
   v9.8: a carga de diretores em lote SAIU da lista — foi desativada na
   interface por decisão da coordenação, e o nome público `diretoresImportar`
   deixou de existir junto com ela. A rotina continua no código, privada
   (importarAcessos_), alcançável só pelo menu do Órgão Central na planilha
   (menuImportarDiretores), para a carga única da implantação.
   ============================================================ */
const API_TELA = {
  acessoRemover: acessoRemover,
  acessoSalvar: acessoSalvar,
  acessosHistorico: acessosHistorico,
  acessosListar: acessosListar,
  adotarPPP: adotarPPP,
  assinarDirecao: assinarDirecao,
  assinarNoSistema: assinarNoSistema,
  auditarConteudoComMarcacao: auditarConteudoComMarcacao,
  backupAgora: backupAgora,
  backupsListar: backupsListar,
  buscarPPP: buscarPPP,
  coberturaRegional: coberturaRegional,
  colegiadoDaFolha: colegiadoDaFolha,
  colegiadoImportar: colegiadoImportar,
  colegiadoListar: colegiadoListar,
  concluirPPP: concluirPPP,
  contasPendentes: contasPendentes,
  conteudoPublicado: conteudoPublicado,
  contexto: contexto,
  conviteLink: conviteLink,
  curadoriaAbrir: curadoriaAbrir,
  curadoriaDescartar: curadoriaDescartar,
  curadoriaPrevia: curadoriaPrevia,
  curadoriaPublicar: curadoriaPublicar,
  curadoriaSalvar: curadoriaSalvar,
  desfazerHomologacao: desfazerHomologacao,
  devolverPPP: devolverPPP,
  documentoPdf: documentoPdf,
  documentoPublico: documentoPublico,
  documentoPublicoHtml: documentoPublicoHtml,
  entrarInstitucional: entrarInstitucional,
  enviarParaValidacao: enviarParaValidacao,
  escolaSalvar: escolaSalvar,
  escolaSituacao: escolaSituacao,
  escolasImportar: escolasImportar,
  escolasListar: escolasListar,
  filaEmailsProcessar: filaEmailsProcessar,
  filaEmailsResumo: filaEmailsResumo,
  gestoresHistorico: gestoresHistorico,
  historicoAssociacoes: historicoAssociacoes,
  homologarPPP: homologarPPP,
  integridadeAgora: integridadeAgora,
  linhaDoTempo: linhaDoTempo,
  minhasAssinaturas: minhasAssinaturas,
  novaVersao: novaVersao,
  painelRegistros: painelRegistros,
  presencaColegiado: presencaColegiado,
  previaPDF: previaPDF,
  primeiroAcessoDefinir: primeiroAcessoDefinir,
  primeiroAcessoInfo: primeiroAcessoInfo,
  primeiroAcessoReenviar: primeiroAcessoReenviar,
  registrarAnexo: registrarAnexo,
  registrarAta: registrarAta,
  registrarExportacao: registrarExportacao,
  registroLeitura: registroLeitura,
  resumoParadosAgora: resumoParadosAgora,
  sair: sair,
  salvarPPP: salvarPPP,
  sessaoValida: sessaoValida,
  validarPPP: validarPPP,
  verificarDocumento: verificarDocumento,
};

/* Recusa registrada, no máximo uma vez por minuto por nome: a trilha serve
   para ver que alguém está varrendo a superfície, e não para ser inundada
   por quem varre. */
function registrarChamadaRecusada_(fn) {
  try {
    const c = CacheService.getScriptCache();
    const chave = 'apirec:' + String(fn || '').slice(0, 60);
    if (c && c.get(chave)) return;
    if (c) c.put(chave, '1', 60);
  } catch (e) { /* sem cache, registra mesmo assim */ }
  try {
    registrarHistorico_(usuarioAtual_() || 'chamada sem identificação', 'chamada fora da lista pública',
      '—', '', String(fn || '').slice(0, 120));
  } catch (e) { /* a trilha não pode derrubar a recusa */ }
}

/**
 * O despachante da tela. A exceção PROPAGA como sempre propagou: `servidor()`
 * no App.html distingue erro lançado de `{ok:false}` e lê a mensagem do
 * servidor para saber se é sessão expirada ou recusa de competência. `api`
 * não embrulha nada.
 */
function api(pedido) {
  const p = pedido || {};
  const fn = String(p.fn || '');
  const alvo = Object.prototype.hasOwnProperty.call(API_TELA, fn) ? API_TELA[fn] : null;
  if (typeof alvo !== 'function') {
    registrarChamadaRecusada_(fn);
    throw new Error('Ação desconhecida.');
  }
  return alvo(p.args === null || p.args === undefined ? {} : p.args);
}

/* ============================================================
   v8.13 (E01) — O QUE O ÓRGÃO CENTRAL DISPARA PELA INTERFACE

   As rotinas de manutenção são privadas; quando uma delas precisa ser
   acionada da tela, o caminho é um invólucro público que exige
   sessaoCentral_ — é o padrão que filaEmailsProcessar já usava pela metade.
   ============================================================ */
function backupAgora(payload) {
  sessaoCentral_(payload && payload.token);
  /* v8.13 (E15): o botão do Órgão Central é pedido humano, como o menu —
     a guarda de intervalo existe contra acionador duplicado, não contra
     quem está olhando a tela e decide fazer uma cópia agora. */
  return backupDiario_({ forcado: true });
}
function backupsListar(payload) {
  sessaoCentral_(payload && payload.token);
  return { ok: true, arquivos: listarBackups_() };
}
function integridadeAgora(payload) {
  sessaoCentral_(payload && payload.token);
  return verificarIntegridade_();
}
function resumoParadosAgora(payload) {
  sessaoCentral_(payload && payload.token);
  return { ok: true, porSre: levantarParados_() };
}

const ST_ANDAMENTO = 'Em andamento';
const ST_VALIDACAO = 'Em validação';
const ST_VALIDADO  = 'Validado';
const ST_ASSINATURA = 'Em assinatura';
/* v8.13 (D06) — ESTADOS LEGADOS. Desde a v8.2 a assinatura da direção grava
   "Enviado para homologação" na hora, de modo que nenhum documento novo
   passa por "Assinado" nem por "Concluído": eles deixaram de ser produzidos.
   NÃO são removidos — há registros nesses estados em bases em uso (e na
   demonstração), e compatibilidade com dado gravado é regra de projeto.
   Continuam sendo reconhecidos na leitura, no painel e nos contadores; o que
   não acontece mais é o sistema gravá-los. */
const ST_ASSINADO = 'Assinado';
const ST_CONCLUIDO = 'Concluído';
const ST_HOMOLOGADO = 'Enviado para homologação';
/* v7.9 (P9): o status final de verdade — gravado pela SRE, não pela escola */
const ST_HOMOLOGADO_SRE = 'Homologado';

/* ============================================================
   Roteamento do app web
   ============================================================ */

/**
 * v8.0 (P12) — O frontend é servido em partes: o Index traz o esqueleto e
 * chama include('Css') e include('App'). É o mesmo recorte que o
 * montar.js usa para produzir o arquivo único da demonstração.
 */
function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}
/* ============================================================
   v8.11 — A CONFERÊNCIA PÚBLICA DE AUTENTICIDADE

   Quem recebe o PPP impresso — uma família, um conselho, outro órgão — não
   tem como saber se aquele papel é o documento que a escola assinou. O
   código de autenticidade, que já existia no fim da folha, passa a vir no
   rodapé de todas as páginas e ganha uma porta pública: digitando o código,
   sem cadastro nenhum, a pessoa recebe o PDF inteiro, com a identificação
   da escola e a situação em que o documento está.

   A porta é pública de propósito — o PPP é documento público da escola —,
   mas não é uma lista: só responde a quem já tem o código, que tem doze
   caracteres hexadecimais (2,8 x 10^14 combinações) e é o SHA-256 do
   conteúdo congelado. Para tirar o valor de uma varredura, as tentativas
   erradas são contadas no cache do script e travam a porta por um minuto.

   v8.13 (C19): a trava NÃO É UM PRÉ-BLOQUEIO. Ela é avaliada depois da busca
   e só no caminho do erro — código que existe é respondido sempre, esteja a
   porta travada ou não. O que a trava protege é a planilha de ser martelada
   por quem não tem código nenhum.
   ============================================================ */
const VERIF_ERROS_MIN = 40;          /* tentativas erradas por minuto, no sistema todo */

function normalizarCodigo_(texto) {
  const c = String(texto || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (c.length !== 12) return '';
  return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12);
}
function cacheVerif_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}
function portaDeVerificacaoTravada_() {
  const c = cacheVerif_(); if (!c) return false;
  return (parseInt(c.get('verif:erros'), 10) || 0) >= VERIF_ERROS_MIN;
}
function contarVerificacaoErrada_() {
  const c = cacheVerif_(); if (!c) return;
  const n = (parseInt(c.get('verif:erros'), 10) || 0) + 1;
  try { c.put('verif:erros', String(n), 60); } catch (e) {}
}
/**
 * v8.13 (D04) — O CÓDIGO DE AUTENTICIDADE DO DOCUMENTO.
 *
 * Até a 8.12 o código era o SHA-256 de um HTML que o CLIENTE mandava: quem
 * concluía escolhia o código, dois PPPs com o mesmo corpo recebiam o mesmo
 * código, e `docHtml` vazio produzia sempre o mesmo (o digest da string
 * vazia). Como `linhaPorHash_` entrega a PRIMEIRA linha que bater, quem
 * digitasse o código impresso no PDF da escola B recebia a escola A.
 *
 * Agora a IDENTIDADE DO REGISTRO entra no digest — protocolo, versão, código
 * da escola e data da conclusão. Dois protocolos nunca são iguais, de modo
 * que a colisão deixa de ser possível na prática; e o cliente perde qualquer
 * escolha sobre o código. A forma NÃO muda (doze hexadecimais em três grupos
 * de quatro): é o que está impresso no rodapé de todo PPP já emitido, e o
 * que `normalizarCodigo_` aceita na conferência pública.
 */
function codigoDeAutenticidade_(html, reg, sal) {
  const base = String(html || '') + '|' + String((reg && reg.protocolo) || '') + '|' +
               String((reg && reg.versao) || '') + '|' + String((reg && reg.inep) || '') + '|' +
               String((reg && reg.concluidoEm) || '') + (sal ? '|' + sal : '');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base, Utilities.Charset.UTF_8);
  let hex = '';
  digest.forEach(function (b) { hex += ('0' + (b & 0xFF).toString(16)).slice(-2); });
  return (hex.substring(0, 12).toUpperCase().match(/.{1,4}/g) || []).join('-');
}

/** A linha cujo código de autenticidade é este. */
function linhaPorHash_(aba, codigo) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return -1;
  const achado = aba.getRange(2, IDX.hash, ultima - 1, 1).createTextFinder(codigo)
                    .matchEntireCell(true).findNext();
  return achado ? achado.getRow() : -1;
}
/** As situações em que o documento já está congelado e tem código. */
const ST_COM_CODIGO = [ST_ASSINATURA, ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE];

/** Conferência pública: devolve a identificação do documento, sem sessão. */
/**
 * v8.13 (C03) — A PORTA PÚBLICA RESPONDE NOME E PAPEL, NUNCA E-MAIL.
 *
 * `validadoPor` e `homolPor` eram compostos com `(s.nome || s.email)`. Quem
 * entra pela conta institucional — sempre o caso do Órgão Central — caía no
 * ramo do e-mail, e a conferência pública, que não tem sessão nenhuma,
 * devolvia o endereço de login a quem só tem o código de doze caracteres.
 * Corrige-se nos dois lados: na GRAVAÇÃO o campo nunca nasce com e-mail; na
 * LEITURA pública o campo é saneado de qualquer forma, porque a base em uso
 * já tem endereços gravados aí e histórico não se reescreve.
 */
/**
 * v10.1 — O MASP VOLTA A SER IMPRESSO POR EXTENSO.
 *
 * A v8.13 (E18, A8-19) mascarava a matrícula na folha de assinaturas
 * ("MASP •••567"), por ela sair pela PORTA PÚBLICA: com o código de 12
 * caracteres, qualquer um abre o documento. O raciocínio era de proteção de
 * dado pessoal.
 *
 * A coordenação decidiu o contrário, e a razão é jurídica, não de desenho: a
 * matrícula de servidor público NÃO é dado protegido. Ela identifica o
 * servidor no exercício do cargo, é publicada no Diário Oficial a cada
 * nomeação, designação, remoção e aposentadoria, e consta dos portais de
 * transparência. Mascará-la num documento oficial não protege ninguém —
 * apenas dificulta a conferência de quem precisa verificar quem assinou.
 *
 * A função `maspMascarado_` saiu junto com a regra: a folha imprime o MASP
 * como ele está no cadastro, que é o que a TELA já fazia. Até aqui, a mesma
 * folha saía de dois jeitos — inteira na tela da escola, mascarada no PDF e
 * na porta pública —, e essa divergência é que fazia o documento final
 * parecer outro documento.
 *
 * O que NÃO mudou: a folha continua sem imprimir e-mail (v7.4), e a planilha
 * de contas a regularizar continua sem a coluna MASP (v8.13, E09/A7-05) —
 * aquela é extração em massa de dado cadastral para fora do sistema, que é
 * outra coisa; esta é a identificação de quem assinou um ato público.
 */
function semEmail_(texto) {
  let t = String(texto == null ? '' : texto).replace(/\S+@\S+\.\S+/g, ' ');
  /* separadores que sobraram sozinhos: " · " no começo, no fim ou dobrado */
  t = t.replace(/\s+/g, ' ').replace(/·\s*·/g, '·');
  return t.replace(/^[\s·,;\-]+/, '').replace(/[\s·,;\-]+$/, '').trim();
}
/**
 * O autor de um ato que vai para dentro do documento. Sem nome no cadastro,
 * o que a folha de assinaturas precisa dizer é o PAPEL e a unidade — não o
 * endereço de quem clicou.
 */
function autorParaDocumento_(s, papel) {
  const rotulo = nomeDoPapel_(papel) || 'Acesso institucional';
  const nome = semEmail_(String((s && s.nome) || ''));
  if (nome) return nome + ' · ' + rotulo;
  const sre = String((s && s.sre) || '').trim();
  return sre ? rotulo + ' · SRE ' + sre : rotulo;
}

function verificarDocumento(payload) {
  const codigo = normalizarCodigo_(payload && payload.codigo);
  if (!codigo) {
    return { ok: false, erro: 'O código de autenticidade tem doze caracteres, no formato 0000-0000-0000. ' +
      'Ele está no rodapé de todas as páginas do documento.' };
  }
  /* v8.13 (C19, A1-04) — A TRAVA VALE SÓ NO CAMINHO DO ERRO. Ela era avaliada
     AQUI, antes de o código ser procurado, sobre um contador ÚNICO do script:
     uma só fonte de tráfego derrubava a conferência pública da rede inteira —
     inclusive para quem tinha na mão um código legítimo. Documento público de
     escola pública não pode deixar de ser autenticável porque alguém está
     varrendo. A busca passa a acontecer primeiro: código que EXISTE é sempre
     respondido. Não há IP do cliente no Apps Script, então limitar por origem
     não é possível; limitar o ERRO é o que resta, e basta — quem acerta nunca
     é penalizado, e quem erra não descobre nada mais depressa. */
  const aba = abaRegistros_();
  const linha = linhaPorHash_(aba, codigo);
  if (linha < 0) {
    contarVerificacaoErrada_();
    /* o contador já subiu: quem estourou o limite recebe a mensagem da trava,
       e quem apenas digitou errado recebe a de sempre */
    if (portaDeVerificacaoTravada_()) {
      return { ok: false, erro: 'Houve muitas conferências sem sucesso nos últimos minutos. Tente de novo em instantes.' };
    }
    return { ok: false, erro: 'Não há documento com este código de autenticidade. Confira os doze caracteres ' +
      'do rodapé — o código só existe a partir da conclusão do PPP.' };
  }
  const reg = lerLinha_(aba, linha);
  if (ST_COM_CODIGO.indexOf(reg.status) < 0) {
    return { ok: false, erro: 'Este documento não está concluído.' };
  }
  const assin = assinaturasDe_(reg);
  const assinadas = assin.filter(function (a) { return !!a.assinadoEm; }).length;
  /* o ato fica no ciclo, uma vez por hora por documento, para não inundar */
  const c = cacheVerif_(), marca = 'verif:' + codigo;
  let repetida = false;
  try { repetida = !!(c && c.get(marca)); } catch (e) {}
  if (!repetida) {
    registrarCiclo_(reg.protocolo, 'autenticidade conferida', 'conferência pública', '', codigo);
    try { if (c) c.put(marca, '1', 3600); } catch (e) {}
  }
  return { ok: true, codigo: codigo,
    escola: reg.escola, inep: reg.inep, municipio: reg.municipio, sre: reg.sre,
    protocolo: reg.protocolo, versao: parseInt(reg.versao, 10) || 1, status: reg.status,
    concluidoEm: reg.concluidoEm, homolEm: reg.homolEm || '', homolPor: semEmail_(reg.homolPor),
    validadoPor: semEmail_(reg.validadoPor), validadoEm: reg.validadoEm || '',
    assinadas: assinadas, total: assin.length, ata: !!reg.ataUrl,
    assinantes: assin.map(function (a) {
      return { nome: a.nome || '', papel: a.papel === 'Direção Escolar' ? 'Direção Escolar' : (a.segmento || 'Colegiado Escolar'),
               assinadoEm: a.assinadoEm || '' };
    }) };
}

/** O PDF do documento conferido — a mesma porta pública, sem sessão. */
function documentoPublico(payload) {
  const conferido = verificarDocumento(payload);
  if (!conferido.ok) return conferido;
  const aba = abaRegistros_();
  const linha = linhaPorHash_(aba, conferido.codigo);
  if (linha < 0) return { ok: false, erro: 'Documento não encontrado.' };
  let reg = lerLinha_(aba, linha);
  const abrir = function (id) {
    if (!id) return null;
    try { return DriveApp.getFileById(id); } catch (e) { return null; }
  };
  let arq = abrir(reg.pdfId) || abrir(idDeUrlDrive_(reg.pdfUrl));
  if (!arq) {
    gerarPdfOficial_(linha, true);
    reg = lerLinha_(aba, linha);
    arq = abrir(reg.pdfId);
    if (!arq) return { ok: false, erro: 'Não foi possível montar o PDF agora. Tente novamente em instantes.' };
  }
  const blob = arq.getBlob();
  return { ok: true, nome: arq.getName(), mime: 'application/pdf',
           base64: Utilities.base64Encode(blob.getBytes()), codigo: conferido.codigo };
}

/**
 * v8.12 — O DOCUMENTO INTEIRO NA PORTA PÚBLICA.
 *
 * Conferir um código e receber uma ficha com o nome da escola não confirma
 * nada: quem tem o papel na mão quer comparar o papel com o documento. Esta
 * função devolve o PPP inteiro, em HTML, do arquivo congelado na conclusão —
 * o mesmo de que sai o PDF. Vale a mesma porta: sem sessão, com o código, e
 * só para as situações que já têm código.
 */
function documentoPublicoHtml(payload) {
  const conferido = verificarDocumento(payload);
  if (!conferido.ok) return conferido;
  const aba = abaRegistros_();
  const linha = linhaPorHash_(aba, conferido.codigo);
  if (linha < 0) return { ok: false, erro: 'Documento não encontrado.' };
  const reg = lerLinha_(aba, linha);
  const html = documentoCongelado_(reg);
  if (!html) {
    return { ok: false, erro: 'O arquivo deste documento não está disponível agora. ' +
      'O PDF continua podendo ser baixado.' };
  }
  return { ok: true, codigo: conferido.codigo, escola: reg.escola || '',
           protocolo: reg.protocolo, versao: parseInt(reg.versao, 10) || 1,
           status: reg.status, html: html,
           rodape: rodapeAutenticidade_(reg) };
}

/**
 * v8.13 — o parâmetro da URL só chega à página se couber inteiro no formato
 * esperado; qualquer outra coisa vira string vazia. Recusar o valor todo (e
 * não limpar caractere a caractere) evita entregar um "resto" que ninguém
 * previu.
 */
function paramSaneado_(valor, formato) {
  const v = String(valor == null ? '' : valor);
  return formato.test(v) ? v : '';
}

function doGet(e) {
  /* v8.1 — a página externa de assinatura (?t=<token do convite>) foi
     aposentada: o colegiado é cadastrado pela direção e assina DENTRO do
     sistema, na própria sessão. Links antigos caem na abertura, onde a
     pessoa entra com o cadastro que já tem. */
  try { abaRegistros_(); } catch (err) {}
  /* v8.11 — os parâmetros da URL passam a ser entregues à página pelo
     servidor. Dentro do sandbox do Apps Script a página não enxerga a
     consulta da barra de endereços: era por isso que o ?pa= do convite só
     funcionava por acaso, e é isso que faria o ?v= impresso no rodapé de
     cada PPP não levar a lugar nenhum. */
  const par = (e && e.parameter) || {};
  const t = HtmlService.createTemplateFromFile('Index');
  /* v8.13 — os dois parâmetros saem separados e já saneados, e a página os
     recebe em ATRIBUTO, não dentro de um <script>. JSON.stringify escapa
     aspas e barras, mas não a sequência "</script>": um link com ela fechava
     a tag e abria outra, com código de quem montou o link. Em atributo não
     existe quebra de contexto possível. O saneamento aqui é o segundo muro:
     um código de autenticidade é hexadecimal com hífens e um token de
     convite é UUID — nenhum deep link legítimo traz outro caractere. */
  t.paramV = paramSaneado_(par.v, /^[0-9A-Fa-f-]{0,14}$/);
  t.paramPa = paramSaneado_(par.pa, /^[0-9A-Za-z-]{0,64}$/);
  return t.evaluate()
    .setTitle('Gerador de PPP — SEE/MG')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function testeConfiguracao_() {
  const aba = abaRegistros_();
  obterPastaPdf_();
  Logger.log('OK — aba "%s" com %s colunas e %s registro(s).\nUsuário identificado: "%s" (vazio é normal fora do domínio: a entrada é por e-mail e senha)\nURL do app: %s\nCota de e-mails restante hoje: %s (com "Executar como: eu", a cota é a desta conta)',
    aba.getName(), CAMPOS.length, Math.max(0, aba.getLastRow() - 1),
    usuarioAtual_(), urlApp_(), MailApp.getRemainingDailyQuota());
  /* v8.13 (E02): o diagnóstico passa a dizer quando cada rotina agendada
     rodou pela última vez — é a pergunta que ninguém conseguia responder. */
  const carimbos = rotinasCarimbos_();
  const atrasadas = conferirRotinas_();
  const linhas = Object.keys(ROTINAS_ESPERADAS).map(function (n) {
    return '  ' + (ROTINAS_NOMES[n] || n) + ' (' + n + '): ' + (carimbos[n] || 'nunca registrou execução');
  });
  Logger.log('Rotinas agendadas — última execução registrada:\n%s\nAtrasadas: %s',
    linhas.join('\n'), atrasadas.length ? atrasadas.map(function (a) { return a.rotina; }).join(', ') : 'nenhuma');
  /* v8.13 (E03): o operador vê o problema INTEIRO de uma vez, e não uma aba
     por vez, cada uma numa recusa diferente. */
  const diag = diagnosticoPlanilha_();
  return { ok: true, colunas: CAMPOS.length, registros: Math.max(0, aba.getLastRow() - 1),
           rotinas: carimbos, rotinasAtrasadas: atrasadas, planilha: diag };
}

function contexto() {
  const email = usuarioAtual_();
  const temSenha = !!PropertiesService.getScriptProperties().getProperty(PROP_HASH);
  const curador = ehCurador_(email);
  /* O acesso é resolvido pelo e-mail institucional com que a pessoa abriu o
     app: quem cadastrou (Órgão Central ou regional) já informou nome, MASP e
     unidade. Nada disso é digitado na entrada. */
  const cad = email ? acessoPorEmail_(email) : null;
  let acesso = null;
  if (cad && String(cad.situacao).toLowerCase() !== 'inativo') {
    /* v7.3 — o PAPEL vai junto: o cartão de identificação e a sessão aberta
       a partir dele precisam saber se a pessoa é diretor ou colegiado,
       Superintendente ou equipe da Inspeção. */
    const papelCad = papelDe_(cad);
    acesso = { perfil: cad.perfil, nome: cad.nome || cad.email, sre: cad.sre || '',
               inep: cad.inep || '', escola: cad.escola || '', masp: cad.masp || '',
               email: cad.email, papel: papelCad, papelNome: nomeDoPapel_(papelCad),
               podeValidar: podeValidar_(papelCad), podeAssociar: podeAssociar_(papelCad),
               soLeitura: soLeitura_(papelCad),
               cadastra: (PAPEIS[papelCad] || {cadastra: []}).cadastra };
  }
  /* v7.4 (P1) — publicado como "Executar como: eu", o app identifica pela
     conta só quem é do mesmo domínio; para os demais, getActiveUser() vem
     vazio e a entrada é por e-mail e senha. O CONTROLE de acesso é o cadastro
     e a sessão — está sempre ativo. `identificado` diz se a conta foi
     reconhecida; `controleAtivo` fica true por compatibilidade com a tela. */
  return { email: email, admin: ehAdmin_(email), controleAtivo: true, identificado: !!email,
           urlApp: urlApp_(),
           curadoria: curador || temSenha, curador: curador, senhaDefinida: temSenha,
           acesso: acesso,
           cadastroInativo: !!(cad && !acesso),
           bootstrapCentral: curador || temSenha,
           acessoInstitucional: curador || temSenha || abaAcessos_().getLastRow() > 1 };
}

/* ---- trava leve contra edição simultânea (aviso, não bloqueio) ---- */
const LOCK_MIN = 20;
function lockAtivo_(reg, sessao) {
  if (!reg.lockSessao || reg.lockSessao === sessao || !reg.lockDesde) return null;
  const partes = String(reg.lockDesde).match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (!partes) return null;
  const inicio = new Date(partes[3], partes[2] - 1, partes[1], partes[4], partes[5]);
  const minutos = (Date.now() - inicio.getTime()) / 60000;
  return minutos < LOCK_MIN ? { desde: reg.lockDesde, minutos: Math.round(minutos) } : null;
}
function assumirLock_(aba, linha, sessao) {
  if (!sessao) return;
  gravarCampo_(aba, linha, 'lockSessao', sessao);
  gravarCampo_(aba, linha, 'lockDesde', agora_());
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/* ============================================================
   Acesso e infraestrutura
   ============================================================ */

function usuarioAtual_() {
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
  catch (e) { return ''; }
}
function ehAdmin_(email) {
  if (!email) return false;
  return ADMINS.map(function (x) { return String(x).toLowerCase(); }).indexOf(email) >= 0;
}
/**
 * v7.4 (P3) — caminho de leitura LEGADO, pelo e-mail identificado. Até a 7.3
 * devolvia true para quem não estava identificado, e registro sem dono era
 * de todo mundo: era por aí que "Abrir por protocolo" editava qualquer PPP.
 * Agora exige e-mail identificado E autorizado. Nenhuma gravação passa mais
 * por aqui — todas exigem sessão (sessaoDirecao_).
 */
function podeAcessar_(dono, compartilhado, email) {
  if (!email) return false;
  if (ehAdmin_(email)) return true;
  const d = String(dono || '').toLowerCase();
  if (d && d === email) return true;
  return String(compartilhado || '').toLowerCase()
    .split(/[;,\s]+/).filter(String).indexOf(email) >= 0;
}
const ERRO_ACESSO = 'Este registro pertence a outro responsável.';
/* v7.4 (P3) — TODA gravação exige sessão. Sem token, a resposta é esta —
   com a bandeira semSessao, para a tela levar a pessoa à entrada. O único
   caminho sem sessão que permanece é o link individual de assinatura (?t=). */
const ERRO_SEM_SESSAO = 'É preciso entrar no sistema para esta ação. Entre novamente e tente de novo.';   /* v9.0 (item 98): vale para todos os perfis, não só a direção */
function semSessao_() { return { ok: false, erro: ERRO_SEM_SESSAO, semSessao: true }; }
const ERRO_BLOQUEIO = 'Este PPP foi concluído e está em processo de assinatura — seu conteúdo não pode mais ser alterado. Para modificá-lo, inicie uma nova versão.';

/* ============================================================
   v8.13 (E03, A8-06) — O CABEÇALHO É CONFERIDO PELO NOME

   Todas as dez abas decidiam tudo por CONTAGEM de colunas
   (`getLastColumn() < cab.length`), e nunca pelo nome. Numa planilha do
   Google usada por uma equipe, o que de fato acontece é alguém inserir uma
   coluna no MEIO: 102 > 101, a condição é falsa, o cabeçalho não é
   reescrito — e todo `lerLinha_`/`gravarCampo_` passa a ler e gravar
   DESLOCADO. `escola` e `status` vêm vazios; o PDF, o painel, o percentual
   e o código de autenticidade saem errados, sem um erro na tela. Apagar uma
   coluna do meio é pior: volta a 101 == 101, e o deslocamento fica
   permanente com o cabeçalho MENTINDO sobre o conteúdo.

   A regra "coluna nova sempre ao final" protege contra acrescentar; não
   protege contra isso.

   Agora o sistema SE RECUSA A OPERAR sobre planilha com cabeçalho
   divergente, e a mensagem diz qual coluna e o que fazer. Recusar, e não
   avisar: continuar gravando sobre colunas trocadas destrói documento
   oficial, e um aviso que ninguém lê não impede isso.

   A conferência é por NOME NORMALIZADO (sem acento, espaços colapsados,
   minúsculas), posição a posição, no PREFIXO declarado. Com isso:
     · base em uso, escrita pelo próprio sistema, PASSA SEMPRE;
     · base antiga com menos colunas e prefixo certo CONTINUA MIGRANDO (o
       cabeçalho é completado ao final, como sempre foi);
     · coluna extra ao FINAL, posta pela equipe, é ACEITA — é o uso legítimo
       de uma planilha compartilhada — e apenas anotada;
     · coluna trocada, inserida ou apagada no meio RECUSA.

   Uma leitura de cabeçalho por aba por execução, memorizada em
   `_cabConferido` — custo desprezível ao lado das 102.000 células que o
   painel do Central já lê. A memória é POR EXECUÇÃO, nunca persistida:
   planilha consertada volta a funcionar na chamada seguinte.
   ============================================================ */
const _cabConferido = {};
/* v9.4: rótulos que uma base anterior pode trazer no lugar do atual — a
   conferência aceita os dois, e ninguém precisa renomear coluna à mão. */
const CABECALHOS_ANTIGOS_ = { 'Homologação — ato': ['Homologação — ato (SEI/ofício)'] };
function normalizarCabecalho_(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
/**
 * Confere o cabeçalho de uma aba contra os nomes declarados.
 * Devolve `{completar:true}` quando faltam colunas AO FINAL com o prefixo
 * certo, `{}` quando está tudo certo (com `extras` quando a equipe
 * acrescentou colunas ao final), e LANÇA na divergência.
 */
function conferirCabecalho_(aba, cols, rotulo) {
  const chave = rotulo + '|' + cols.length;
  if (_cabConferido[chave]) return _cabConferido[chave];
  const ultimaCol = aba.getLastColumn();
  if (aba.getLastRow() === 0 || ultimaCol === 0) return { vazia: true };   /* aba nova: quem chama escreve o cabeçalho */
  const lido = aba.getRange(1, 1, 1, ultimaCol).getDisplayValues()[0];
  const n = Math.min(cols.length, lido.length);
  for (let i = 0; i < n; i++) {
    const esperado = String(cols[i]);
    const antigos = (CABECALHOS_ANTIGOS_[esperado] || []).map(normalizarCabecalho_);
    if (normalizarCabecalho_(lido[i]) !== normalizarCabecalho_(esperado) && antigos.indexOf(normalizarCabecalho_(lido[i])) < 0) {
      throw new Error('A planilha "' + rotulo + '" está com as colunas trocadas: a coluna ' + (i + 1) +
        ' deveria chamar-se "' + esperado + '" e está como "' + String(lido[i] || '(vazia)') + '". ' +
        'Nenhuma alteração foi feita. Restaure a planilha pelo backup mais recente (pasta "' +
        NOME_PASTA_BACKUP + '") ou devolva a coluna ao fim da aba — coluna nova entra sempre no final.');
    }
  }
  const r = (lido.length < cols.length)
    ? { completar: true, de: lido.length }
    : { extras: Math.max(0, lido.length - cols.length) };
  _cabConferido[chave] = r;
  return r;
}
/** O nome das colunas de cada aba, para a conferência e para o diagnóstico. */
function abasDeclaradas_() {
  return [
    { rotulo: NOME_ABA,               cols: CAMPOS.map(function (c) { return c.col; }) },
    { rotulo: NOME_ABA_ACESSOS,       cols: ACESSO_COLS },
    { rotulo: NOME_ABA_ESCOLAS,       cols: ESCOLA_COLS },
    { rotulo: NOME_ABA_GESTORES,      cols: GESTOR_COLS },
    { rotulo: NOME_ABA_FILA,          cols: FILA_COLS },
    { rotulo: NOME_ABA_CICLO,         cols: CICLO_COLS },
    { rotulo: NOME_ABA_HIST_ACESSOS,  cols: ACESSO_HIST_COLS },
    { rotulo: NOME_ABA_HISTORICO,     cols: CUR_HIST_COLS },
    { rotulo: NOME_ABA_CONTEUDO,      cols: CONTEUDO_COLS },
    { rotulo: NOME_ABA_INTEGRIDADE,   cols: INTEGRIDADE_COLS }
  ];
}
/**
 * Percorre as dez abas SEM LANÇAR e devolve a lista de divergências — para
 * o operador ver o problema inteiro de uma vez, em vez de descobri-lo uma
 * aba por vez, cada uma numa recusa diferente.
 */
function diagnosticoPlanilha_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const achados = [];
  abasDeclaradas_().forEach(function (d) {
    const aba = ss.getSheetByName(d.rotulo);
    if (!aba) { achados.push({ aba: d.rotulo, situacao: 'não existe ainda' }); return; }
    try {
      const antes = _cabConferido[d.rotulo + '|' + d.cols.length];
      delete _cabConferido[d.rotulo + '|' + d.cols.length];
      const r = conferirCabecalho_(aba, d.cols, d.rotulo);
      if (antes === undefined) delete _cabConferido[d.rotulo + '|' + d.cols.length];
      if (r.completar) achados.push({ aba: d.rotulo, situacao: 'cabeçalho a completar ao final (base anterior)', de: r.de });
      else if (r.extras) achados.push({ aba: d.rotulo, situacao: r.extras + ' coluna(s) extra(s) ao final — aceitas', extras: r.extras });
    } catch (e) {
      achados.push({ aba: d.rotulo, situacao: 'DIVERGÊNCIA', erro: String(e && e.message || e) });
    }
  });
  const problemas = achados.filter(function (a) { return a.situacao === 'DIVERGÊNCIA'; });
  Logger.log('Diagnóstico da planilha: %s divergência(s).\n%s', problemas.length, JSON.stringify(achados, null, 2));
  return { ok: problemas.length === 0, divergencias: problemas, achados: achados };
}

function abaRegistros_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA);
  if (!aba) aba = ss.insertSheet(NOME_ABA);
  const cab = CAMPOS.map(function (c) { return c.col; });
  /* v8.13 (E03): pelo NOME, antes de qualquer operação */
  const confR = conferirCabecalho_(aba, cab, NOME_ABA);
  if (confR.vazia || confR.completar) {
    aba.getRange(1, 1, 1, cab.length).setValues([cab])
       .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 130);
    aba.setColumnWidth(IDX.escola, 260);
    /* v8.13 (D15): a aba nasce com as colunas formatadas como TEXTO PURO,
       para que a proteção valha também em gravação feita por rotina futura
       (ou à mão, na planilha). Linha já gravada numa base em uso não é
       reformatada em massa: a próxima gravação daquela linha a corrige. */
    try { aba.getRange(1, 1, aba.getMaxRows(), CAMPOS.length).setNumberFormat('@'); } catch (e) {}
    /* v8.12 — A ABA DOS PPPs É REGISTRO PERMANENTE.

       Um Projeto Político-Pedagógico concluído e assinado é ato da escola,
       aprovado pelo Colegiado. Ele não se desfaz: erra-se para a frente,
       com nova versão, devolução ou homologação desfeita — todas
       registradas. Nenhuma rotina do sistema apaga linha aqui (a bateria de
       servidor confere que não há exclusão em lugar nenhum do código), e a
       aba nasce protegida contra edição manual, para que o apagamento não
       aconteça pela planilha, por engano, numa tarde qualquer. */
    try {
      const prot = aba.protect().setDescription(
        'Registros de PPP — registro permanente. Documento concluído e assinado não pode ser excluído.');
      prot.removeEditors(prot.getEditors());
      if (prot.canDomainEdit && prot.canDomainEdit()) prot.setDomainEdit(false);
    } catch (e) { /* planilha pessoal sem permissão de proteção: segue sem ela */ }
  }
  return aba;
}

/* ============================================================
   v8.12 — O PPP CONCLUÍDO NÃO SE EXCLUI

   Não existe, e não deve passar a existir, caminho de exclusão de PPP no
   sistema. Esta função é o lugar onde a regra fica escrita: qualquer código
   futuro que venha a precisar remover um registro pergunta aqui primeiro, e
   a resposta, para documento concluído, é sempre não.

   v8.13 (D25) — E A REGRA DEIXOU DE DEPENDER DA MEMÓRIA DE QUEM ESCREVE.
   Até a 8.12 esta função não era chamada por caminho nenhum: a única
   ocorrência dela no arquivo era a própria definição, e as baterias verdes
   davam a impressão de que a proteção estava ativa. Ela só valia enquanto o
   código futuro se lembrasse de perguntar.
   Agora quem confere é a CONFERÊNCIA ESTRUTURAL: `verifica.js` lê este
   arquivo e falha se aparecer `deleteRow`/`deleteRows` sobre a aba de
   registros sem esta função na mesma função. Quem for acrescentar um
   caminho de exclusão encontra a bateria vermelha antes de publicar.
   ============================================================ */
const ST_INEXCLUIVEIS = [ST_ASSINATURA, ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE];
function recusaExclusaoDePPP_(reg) {
  if (!reg) return 'Documento não encontrado.';
  if (ST_INEXCLUIVEIS.indexOf(reg.status) >= 0) {
    return 'Este Projeto Político-Pedagógico foi concluído e assinado em ' +
      (reg.concluidoEm || 'data registrada') + ', sob o código de autenticidade ' + (reg.hash || '—') +
      '. Documento assinado não pode ser excluído, em nenhuma hipótese. ' +
      'Se houver o que corrigir, o caminho é uma nova versão.';
  }
  return '';
}
function obterPastaPdf_() {
  const it = DriveApp.getFoldersByName(NOME_PASTA_PDF);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA_PDF);
}
function agora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}
/**
 * Protocolo no formato PPP-AAAA-NNNN-XXXX: sequencial por ano, com sufixo
 * aleatório de quatro caracteres para que não seja adivinhável (v6.1).
 * Protocolos antigos, sem sufixo, continuam válidos na busca.
 */
function novoProtocolo_(aba) {
  const ano = new Date().getFullYear();
  let max = 0;
  const ultima = aba.getLastRow();
  if (ultima >= 2) {
    aba.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (r) {
      const m = String(r[0]).match(/^PPP-\d{4}-(\d+)(?:-[A-Z0-9]{4})?$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sem 0/O, 1/I
  let sufixo = '';
  for (let i = 0; i < 4; i++) sufixo += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
  return 'PPP-' + ano + '-' + ('0000' + (max + 1)).slice(-4) + '-' + sufixo;
}
function localizarLinha_(aba, protocolo) {
  if (!protocolo) return -1;
  const achado = aba.getRange('A:A').createTextFinder(String(protocolo).trim())
                    .matchEntireCell(true).findNext();
  return achado ? achado.getRow() : -1;
}
/**
 * v7.3 — A mesma busca, mas devolvendo 0 quando não acha. localizarLinha_
 * devolve -1, que é "verdadeiro" em JavaScript: as funções da 7.0 testavam
 * `if (!linha)` e nunca recusavam um protocolo inexistente — em produção,
 * getRange(-1, …) lançava exceção. Use esta nas verificações novas.
 */
function linhaDoProtocolo_(aba, protocolo) {
  const p = String(protocolo || '').trim().toUpperCase();
  if (!p) return 0;
  const l = localizarLinha_(aba, p);
  return l > 0 ? l : 0;
}
function slug_(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ESCOLA';
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function lerLinha_(aba, linha) {
  const v = aba.getRange(linha, 1, 1, CAMPOS.length).getDisplayValues()[0];
  const reg = {};
  CAMPOS.forEach(function (c, i) {
    const b = v[i] || '';
    if (c.tipo === 'lista') {
      reg[c.key] = b ? b.split(';').map(function (x) { return x.trim(); }).filter(String) : [];
    } else if (c.key === 'tela') { reg[c.key] = b ? parseInt(b, 10) : 0; }
    else if (c.key === 'versao') { reg[c.key] = b ? parseInt(b, 10) : 1; }
    else { reg[c.key] = b; }
  });
  return reg;
}
/**
 * v8.13 (F07) — UMA FAIXA FORMATADA COMO TEXTO PURO, ANTES DE RECEBER VALOR.
 *
 * POR QUÊ: nome de pessoa e nome de escola vêm da rede, e um valor colado de
 * outra planilha começando por "=" é FÓRMULA para o Google Planilhas. O que o
 * sistema lê de volta é `#ERROR!` — o nome deixa de existir na base, e é o
 * nome que vai para a folha de assinaturas e para o histórico permanente.
 * D15 fez isso nas abas Registros e Ciclo; esta função é para não escrever a
 * mesma linha uma sétima vez nas abas Acessos, Gestores e Escolas.
 * O `try` existe porque uma planilha sem permissão de formatação não pode
 * impedir a gravação — o pior caso volta a ser o de hoje, não uma exceção.
 */
function faixaDeTexto_(aba, linha, col, nLinhas, nCols) {
  const r = aba.getRange(linha, col, nLinhas, nCols);
  try { r.setNumberFormat('@'); } catch (e) { /* sem permissão de formato: segue */ }
  return r;
}

function gravarCampo_(aba, linha, chave, valor) {
  /* v8.13 (D15): a célula é formatada como texto ANTES de receber o valor —
     um campo que comece por "=" gravado por aqui viraria fórmula igual. */
  const r = aba.getRange(linha, IDX[chave]);
  r.setNumberFormat('@');
  r.setValue(valor);
}

/* ============================================================
   LEITURA POR FAIXAS (v7.5, P2)

   A aba Registros tem 37 colunas de texto livre (até 50 mil caracteres
   cada). Até a 7.4 o painel — a primeira chamada de todo diretor —, a
   busca por escola e "minhas assinaturas" liam a aba INTEIRA. Com 3.400
   escolas e ~1,5 versão por escola são ~5.000 linhas: dezenas de MB por
   chamada. Agora cada leitura pede só as colunas de que precisa, em
   faixas contíguas, e pula as de texto. As faixas são calculadas a partir
   de CAMPOS/IDX, de modo que uma coluna nova ao final não as desalinha.
   ============================================================ */

/** As chaves de texto livre — as que o painel nunca precisa ler. */
const CHAVES_TEXTO = CAMPOS.filter(function (c) {
  return /^t[A-Z]/.test(c.key) || c.key === 'objetivosAnteriores' || c.key === 'indicadoresAnteriores';
}).map(function (c) { return c.key; });

/** Blocos contíguos de colunas que cobrem as chaves pedidas. Buracos de até
    duas colunas são absorvidos (uma chamada a menos vale mais que duas
    células), desde que não sejam colunas de texto. */
function faixasDe_(chaves) {
  const cols = chaves.map(function (k) { return IDX[k]; }).filter(Boolean)
    .sort(function (a, b) { return a - b; });
  const faixas = [];
  cols.forEach(function (c) {
    const f = faixas[faixas.length - 1];
    let pode = !!f && c - f.fim <= 3;
    if (pode) for (let x = f.fim + 1; x < c; x++) if (CHAVES_TEXTO.indexOf(CAMPOS[x - 1].key) >= 0) pode = false;
    if (pode) f.fim = c; else faixas.push({ ini: c, fim: c });
  });
  return faixas;
}
/** Lê `n` linhas a partir de `linhaIni`, só as chaves pedidas. Devolve
    objetos {chave: texto exibido, _linha}. */
function lerFaixas_(aba, chaves, linhaIni, n) {
  const regs = [];
  for (let i = 0; i < n; i++) regs.push({ _linha: linhaIni + i });
  if (n < 1) return regs;
  faixasDe_(chaves).forEach(function (f) {
    const vals = aba.getRange(linhaIni, f.ini, n, f.fim - f.ini + 1).getDisplayValues();
    for (let c = f.ini; c <= f.fim; c++) {
      const key = CAMPOS[c - 1].key;
      if (chaves.indexOf(key) < 0) continue;
      for (let i = 0; i < n; i++) regs[i][key] = vals[i][c - f.ini] || '';
    }
  });
  return regs;
}
/** Todas as linhas da aba, só as chaves pedidas. */
function lerColunas_(aba, chaves) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  return lerFaixas_(aba, chaves, 2, ultima - 1);
}
/** Uma linha, só as chaves pedidas. */
function lerLinhaChaves_(aba, linha, chaves) {
  return lerFaixas_(aba, chaves, linha, 1)[0];
}
/** As linhas em que a coluna `chave` contém `texto` (célula inteira, sem
    diferenciar maiúsculas) — createTextFinder na coluna, sem ler a aba. */
function linhasOnde_(aba, chave, texto, celulaInteira) {
  const t = String(texto == null ? '' : texto).trim();
  const ultima = aba.getLastRow();
  if (!t || ultima < 2) return [];
  const finder = aba.getRange(2, IDX[chave], ultima - 1, 1).createTextFinder(t);
  if (celulaInteira !== false) finder.matchEntireCell(true);
  return finder.findAll().map(function (r) { return r.getRow(); });
}

/* ---- % preenchido (v7.5, P2) ---- */
/** O percentual de seções obrigatórias preenchidas de uma linha já montada
    (array na ordem de CAMPOS) ou de um registro/objeto de dados. */
function pctDe_(obj) {
  let feitos = 0;
  const valor = function (k) {
    const v = Array.isArray(obj) ? obj[IDX[k] - 1] : obj[k];
    if (Array.isArray(v)) return v.length ? 'x' : '';
    return String(v == null ? '' : v).trim();
  };
  OBRIG_PAINEL.forEach(function (k) { if (valor(k)) feitos++; });
  return Math.round(feitos / OBRIG_PAINEL.length * 100);
}
/**
 * Garante a coluna "% preenchido" em todas as linhas. Linhas gravadas antes
 * da 7.5 têm a célula vazia: UMA leitura completa as calcula e grava todas
 * de uma vez — depois disso o painel nunca mais lê as colunas de texto.
 * Devolve quantas linhas foram completadas.
 */
/**
 * v8.8 (B1) — A completação do "% preenchido" era a primeira coisa que todo
 * painel fazia, e ela lia as 100 colunas da aba INTEIRA — com todo o texto
 * livre de cada PPP. Duas causas: a linha sem protocolo ficava com o
 * percentual em branco, de modo que voltava à lista de faltantes para
 * sempre (bastava uma anotação numa célula solta para a leitura completa se
 * repetir a cada abertura, com 3.400 escolas), e a leitura era da aba toda,
 * mesmo quando faltava uma linha só. Agora a linha sem protocolo recebe
 * zero — a lista esvazia — e a leitura é só das faixas que faltam.
 */
function faixasContinuas_(indices) {
  const out = [];
  indices.slice().sort(function (a, b) { return a - b; }).forEach(function (i) {
    const u = out[out.length - 1];
    if (u && i === u.de + u.qtd) u.qtd++;
    else out.push({ de: i, qtd: 1 });
  });
  return out;
}
function garantirPercentuais_(aba) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return 0;
  const col = aba.getRange(2, IDX.pct, ultima - 1, 1).getDisplayValues();
  const faltam = [];
  col.forEach(function (r, i) { if (String(r[0] || '').trim() === '') faltam.push(i); });
  if (!faltam.length) return 0;
  const novos = col.map(function (r) { return [r[0]]; });
  faixasContinuas_(faltam).forEach(function (f) {
    const vals = aba.getRange(2 + f.de, 1, f.qtd, CAMPOS.length).getDisplayValues();
    vals.forEach(function (linha, k) {
      /* linha em branco não é registro: recebe zero, e não volta à lista */
      novos[f.de + k] = [String(linha[IDX.protocolo - 1] || '').trim() ? pctDe_(linha) : 0];
    });
  });
  aba.getRange(2, IDX.pct, ultima - 1, 1).setValues(novos);
  return faltam.length;
}
/** Para rodar pelo menu depois de implantar a 7.5 sobre uma base em uso. */
/* v8.13 (E01, A8-18): reescreve a coluna inteira; sem a trava, corria com
   qualquer gravação em curso e podia escrever o percentual de uma linha
   sobre o estado anterior dela. */
function recalcularPercentuais_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const aba = abaRegistros_();
    const n = garantirPercentuais_(aba);
    Logger.log('%s linha(s) receberam o "%% preenchido".', n);
    return n;
  } finally { lock.releaseLock(); }
}
/* v8.7 (D1) — O Sheets recusa célula acima de 50.000 caracteres, e a recusa
   derruba a gravação da LINHA INTEIRA: quem colasse a matriz curricular num
   campo fazia o PPP parar de salvar em silêncio, e tudo o que escrevesse
   depois se perdia. O teto é conferido antes de gravar, e a recusa nomeia o
   campo e o tamanho — a tela mostra o mesmo contador enquanto se escreve. */
const LIMITE_CELULA = 45000;
function milhar_(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function celulaGrandeDemais_(registro) {
  for (let i = 0; i < CAMPOS.length; i++) {
    const v = registro[i];
    if (typeof v === 'string' && v.length > LIMITE_CELULA) {
      /* v8.13 (D12): junto com a coluna vai o RÓTULO DA TELA — a recusa
         nomeava "Detalhes das ofertas (JSON)", que não existe em lugar
         nenhum da interface, e a escola não tinha como saber o que encurtar. */
      return { col: CAMPOS[i].col, key: CAMPOS[i].key, tam: v.length,
               rotulo: CAMPOS[i].rotulo || CAMPOS[i].col };
    }
  }
  return null;
}
function recusaPorTamanho_(g) {
  const nome = g.rotulo || g.col;
  return { ok: false, campoGrande: g.key, campoCol: g.col, campoRotulo: nome,
    tamanho: g.tam, limite: LIMITE_CELULA,
    erro: 'O campo "' + nome + '" está com ' + milhar_(g.tam) + ' caracteres, acima do limite de ' +
          milhar_(LIMITE_CELULA) + ' por campo. A planilha recusa células maiores que isso e, com elas, ' +
          'a gravação da linha inteira — nada seria salvo. Reduza esse texto (ou anexe o material ao PPP) ' +
          'para voltar a salvar.' };
}

/**
 * v8.13 (D13) — INDICADOR É NÚMERO, E DOCUMENTO NORMATIVO NÃO IMPRIME "abc%".
 *
 * As casas da tabela chegavam como texto livre e eram impressas na seção 2.4
 * do documento oficial: -500 matrículas, 998% de aprovação, "1e9%" de
 * abandono. A recusa NÃO acontece no salvamento — travar a gravação por causa
 * de um dígito errado faria a escola perder o que escreveu depois, e a regra
 * do projeto é a contrária. Ela acontece nos dois atos que congelam o
 * documento: enviar para validação e concluir.
 * Registro JÁ CONCLUÍDO com indicador inválido continua sendo lido e entregue
 * como está: documento assinado não se reescreve.
 */
const IND_FAIXA = {
  mat: { rotulo: 'Matrículas', inteiro: true, min: 0, max: 999999 },
  apr: { rotulo: 'Aprovação', min: 0, max: 100 },
  rep: { rotulo: 'Reprovação', min: 0, max: 100 },
  aba: { rotulo: 'Abandono', min: 0, max: 100 },
  dis: { rotulo: 'Distorção idade/ano', min: 0, max: 100 }
};
const ROTULO_ETAPA = { ei: 'Educação Infantil', efai: 'Ensino Fundamental — Anos Iniciais',
                       efaf: 'Ensino Fundamental — Anos Finais', em: 'Ensino Médio' };
function indicadoresInvalidos_(json) {
  let o;
  try { o = JSON.parse(json || '{}') || {}; } catch (e) { return []; }
  const et = o.etapas || {};
  const fora = [];
  Object.keys(et).forEach(function (id) {
    const linha = et[id] || {};
    Object.keys(IND_FAIXA).forEach(function (k) {
      const f = IND_FAIXA[k];
      const v = String(linha[k] == null ? '' : linha[k]).trim();
      if (!v) return;                                   /* vazio continua válido */
      const forma = f.inteiro ? /^\d+$/ : /^\d+(?:[.,]\d)?$/;
      let ruim = !forma.test(v);
      if (!ruim) {
        const n = parseFloat(v.replace(',', '.'));
        ruim = isNaN(n) || n < f.min || n > f.max;
      }
      if (ruim) fora.push({ etapa: ROTULO_ETAPA[id] || id, coluna: f.rotulo, valor: v });
    });
  });
  return fora;
}
function recusaPorIndicadores_(reg, acao) {
  const fora = indicadoresInvalidos_(reg.indicadores);
  if (!fora.length) return null;
  const tres = fora.slice(0, 3).map(function (x) {
    return x.etapa + ' · ' + x.coluna + ' = ' + x.valor;
  }).join('; ');
  return { ok: false, indicadoresInvalidos: fora,
    erro: 'A tabela de indicadores tem valores que não são números: ' + tres +
          (fora.length > 3 ? '; e mais ' + (fora.length - 3) : '') +
          '. Corrija na tela de indicadores antes de ' + acao + '.' };
}

function assinaturasDe_(reg) {
  try { return JSON.parse(reg.assinaturas || '[]'); } catch (e) { return []; }
}

/* ============================================================
   v10.0 — HOMOLOGADO É FINAL E DEFINITIVO

   Decisão da coordenação: registrada a homologação pela Diretoria
   Educacional (ou pela sua equipe), o documento não é mais editado, não
   recebe mais assinatura e a homologação não é desfeita. Ele é a versão
   final daquela vigência, e o que estiver nele é o que vale.

   Até a 9.9 a regra existia espalhada: cada função recusava o homologado
   pelo seu próprio caminho — `salvarPPP_` porque só grava em elaboração,
   `assinarNoSistema` por uma lista de situações, `adotarPPP` pelo código de
   autenticidade — e UMA delas não recusava (`assinarDirecao`, que só barrava
   "Em andamento": homologado sem a assinatura da direção, ela ainda assinava
   depois). Regra espalhada é regra que uma função nova não herda.

   Agora a recusa é UMA função, chamada logo depois da leitura da linha por
   todo ato que escreve no registro. Quem escrever o próximo ato tem a
   chamada à vista nos vizinhos, e a mensagem é a mesma em toda parte.

   O caminho que continua aberto é o único que sempre foi o certo: a escola
   abre uma NOVA VERSÃO. Ela nasce como documento próprio, com protocolo e
   número de versão próprios, e não toca no que foi homologado.
   ============================================================ */
/**
 * v10.0 — QUEM FOI MARCADO COMO PRESENTE E AINDA NÃO ASSINOU.
 *
 * A folha de assinaturas guarda uma caixa por pessoa: a direção da escola e
 * cada membro do Colegiado que a direção MARCOU COMO PRESENTE na reunião de
 * aprovação. Caixa sem `assinadoEm` é caixa que ficará em branco no PDF se o
 * documento for homologado assim — e, desde esta versão, em branco para
 * sempre, porque a homologação não se desfaz.
 *
 * A lista sai daqui para dois lugares: o painel, que a entrega à tela antes
 * mesmo do clique (o aviso nomeia sem uma ida a mais ao servidor), e a
 * própria homologação, que é quem de fato decide. A direção vai ao fim: o
 * que a marcação de presença define é o Colegiado.
 */
function pendentesDaFolha_(reg) {
  return assinaturasDe_(reg)
    .filter(function (a) { return !a.assinadoEm; })
    .map(function (a) {
      return { nome: a.nome || a.email || '(sem nome)', email: a.email || '',
               papel: a.papel || '', segmento: a.segmento || '',
               direcao: a.papel === 'Direção Escolar' };
    })
    .sort(function (a, b) { return (a.direcao ? 1 : 0) - (b.direcao ? 1 : 0); });
}

function recusaSeHomologado_(reg) {
  if (!reg || reg.status !== ST_HOMOLOGADO_SRE) return null;
  return { ok: false, homologado: true, definitivo: true,
    erro: 'Este PPP foi homologado em ' + (reg.homolEm || '—') +
          (reg.homolPor ? ', por ' + reg.homolPor : '') +
          ', e é a versão final e definitiva: não pode ser editado, não recebe mais assinatura ' +
          'e a homologação não é desfeita. Para registrar mudanças, a escola abre uma nova versão.' };
}

/* ============================================================
   Gravação e leitura
   ============================================================ */

/**
 * A PORTA PÚBLICA DA GRAVAÇÃO — é esta que a tela chama.
 *
 * v8.13 (D01/D02): `concluindo` é bandeira INTERNA e não viaja mais no
 * payload. Quem conclui chama `salvarPPP_(dados, {concluindo:true})`; o que
 * chega da tela é apagado aqui, antes de qualquer outra coisa. `sobrepor`
 * (D01) continua sendo lido: aquilo é decisão da PESSOA diante de um
 * conflito, não bandeira do servidor.
 */
function salvarPPP(dados) {
  dados = dados || {};
  delete dados.concluindo;
  return salvarPPP_(dados, {});
}

/**
 * v8.13 (D01) — O CORPO DA GRAVAÇÃO.
 *
 * `op.concluindo`  a gravação é a que precede a conclusão (status preservado)
 * `op.jaComTrava`  quem chamou já segura a trava do script (concluirPPP) —
 *                  o LockService NÃO é reentrante, e tomar a trava de novo
 *                  dentro dela travaria a própria execução.
 */
function salvarPPP_(dados, op) {
  dados = dados || {}; op = op || {};
  /* Com o acesso da direção escolar, quem autoriza é o vínculo escola↔INEP
     do cadastro, não o e-mail identificado pelo Google. E é a DIREÇÃO que
     escreve: uma sessão de colegiado (ou de qualquer outro papel) com token
     é recusada aqui — v7.3, T-01. Sem token não há gravação — v7.4, P3:
     acabou o caminho que gravava só com o número do protocolo. */
  const ses = sessaoDirecao_(dados.token);
  if (!ses) return semSessao_();
  const aba = abaRegistros_();
  /* v8.13 (D02): escopo é da SESSÃO. O que a tela mandar em `inep` e `sre`
     não é usado — as duas colunas são montadas no `switch` abaixo. */
  dados.inep = ses.inep;
  dados.escola = dados.escola || ses.escola;
  dados.sre = ses.sre || '';
  /* v8.13 (D01) — TODA escrita nesta aba passa a acontecer sob a trava do
     script, inclusive a regravação de linha que já existe. A v7.5 (P2) tomava
     a trava só na criação, com o argumento de que "cada escola escreve só o
     seu registro": é verdade e é irrelevante — a disputa não é entre escolas,
     é entre a escola e o ato da SRE sobre a MESMA linha. Entre a leitura e a
     gravação desta função cabia uma execução inteira de concluirPPP ou de
     validarPPP, e a gravação pendente devolvia o status, o código de
     autenticidade, as assinaturas e o documento congelado ao que eram antes. */
  const lock = op.jaComTrava ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(20000);
  try {
    /* a releitura acontece DEPOIS da trava, também para linha existente: é ela
       que garante que `ant` é o estado de agora, e não o de antes da espera */
    let linhaExistente = localizarLinha_(aba, dados.protocolo || '');
    let novo = linhaExistente < 0;

    /* Uma escola escreve um PPP de cada vez. Com sessão de direção escolar a
       regra é absoluta: não há como criar um segundo enquanto houver um em
       andamento — nem passando ignorarDuplicado, que serve apenas aos
       caminhos internos do próprio servidor. */
    /* v8.13 (D07): a escola não começa um PPP do zero enquanto houver um em
       curso — inclusive um já concluído, em coleta de assinaturas ou à
       espera da homologação. Antes, a regra só via "em elaboração". */
    if (novo && dados.inep) {
      const dup = buscarPPPNaoEncerrado_(aba, dados.inep);
      if (dup) return { ok: false, duplicado: dup,
        erro: 'Esta escola já tem um PPP em andamento (' + dup.protocolo +
              (dup.status && dup.status !== ST_ANDAMENTO ? ', ' + dup.status.toLowerCase() : '') + '). ' +
              'Continue esse ou conclua-o antes de começar outro.' };
    }

    let criadoEm, pdfAnt, protocolo, dono, versao, origem, compart, ant = null;
    if (novo) {
      /* o responsável é o e-mail CADASTRADO da direção, o mesmo da sessão —
         é ele que o painel da regional compara para apontar registro órfão */
      criadoEm = agora_(); pdfAnt = ''; protocolo = novoProtocolo_(aba);
      dono = String(ses.email || '').toLowerCase();
      /* v8.13 (F11) — VERSÃO É ATRIBUTO DA ESCOLA, NÃO DA LINHA. D07 tornou o
         número único por escola SÓ em `novaVersao`; a criação continuava em 1
         fixo, e numa escola com v1 e v2 homologadas o botão "Novo PPP" criava
         um terceiro registro também "v1" — dois "v1" no painel, no histórico e
         no PDF, quando o número da versão é o que a SRE usa para saber de que
         revisão se está falando. `maiorVersaoDaEscola_` devolve 0 sem
         registro, logo versão 1; o registro SEM INEP (o "abrir por protocolo"
         antigo) continua nascendo na 1. A chamada corre dentro da trava.
         `origem` continua VAZIO: um PPP criado do zero não descende de
         ninguém, e é `origem` que diz isso — as duas informações não se
         confundem. */
      versao = dados.inep ? (maiorVersaoDaEscola_(aba, dados.inep) + 1) : 1;
      origem = '';
      compart = '';
    } else {
      ant = lerLinha_(aba, linhaExistente);
      if (!mesmaEscola_(ses, ant.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
      /* O documento é editável só enquanto está em elaboração. Enviado para
         validação, ele fica parado até a Diretoria Educacional se manifestar;
         validado, o único caminho adiante é concluir — e é a própria
         conclusão que grava por último, com a marca 'concluindo'. */
      if (ant.status === ST_VALIDACAO) {
        return { ok: false, bloqueado: true, erro: 'Este PPP está em validação pela Diretoria Educacional (' +
          (ant.enviadoValidacaoEm || 'enviado há pouco') + '). Enquanto ela não se manifestar, o conteúdo não pode ser alterado.' };
      }
      if (ant.status === ST_VALIDADO && !op.concluindo) {
        return { ok: false, bloqueado: true, erro: 'Este PPP já foi validado pela Diretoria Educacional e não pode mais ser alterado. O passo seguinte é concluir e colher as assinaturas.' };
      }
      /* v10.0: homologado é final — a recusa diz a regra, e não o genérico */
      const negaHomSalvar = recusaSeHomologado_(ant);
      if (negaHomSalvar) return Object.assign(negaHomSalvar, { bloqueado: true });
      if (ant.status !== ST_ANDAMENTO && ant.status !== ST_VALIDADO) {
        return { ok: false, erro: ERRO_BLOQUEIO, bloqueado: true };
      }
      /* v8.13 (D01) — A LINHA MUDOU DESDE QUE VOCÊ A LEU.
         A trava resolve a corrida entre execuções simultâneas; não resolve
         duas abas da mesma escola que gravam em sequência, cada uma com o
         instantâneo da sua tela — a segunda apagava a primeira sem marca
         nenhuma. Aqui a gravação é RECUSADA, não mesclada: juntar texto de
         duas telas sem saber qual é o mais recente produziria um documento
         que ninguém escreveu. A recusa devolve o registro do servidor, e a
         tela oferece as duas saídas (ver o que está gravado, ou gravar o meu
         por cima).
         Compatibilidade: cliente que NÃO manda `rev` nunca é recusado —
         é o que permite implantar sem derrubar aba já aberta. */
      if (dados.rev !== undefined && !dados.sobrepor &&
          String(parseInt(dados.rev, 10) || 0) !== String(parseInt(ant.rev, 10) || 0)) {
        return { ok: false, conflito: true, rev: parseInt(ant.rev, 10) || 0,
                 atualizadoEm: ant.atualizadoEm, registro: ant,
                 erro: 'Este PPP foi gravado por outra pessoa em ' + (ant.atualizadoEm || 'instantes atrás') +
                       '. O seu texto continua na tela.' };
      }
      criadoEm = ant.criadoEm; pdfAnt = ant.pdfUrl; protocolo = ant.protocolo;
      dono = ant.email || String(ses.email || '').toLowerCase(); versao = ant.versao || 1; origem = ant.origem || '';
      compart = ant.compartilhado || '';
    }
    const linha = novo ? aba.getLastRow() + 1 : linhaExistente;

    const registro = CAMPOS.map(function (c) {
      /* As colunas que só esta função sabe montar. Todas as demais do
         servidor caem na regra geral logo abaixo, que PRESERVA o gravado. */
      switch (c.key) {
        case 'protocolo':    return protocolo;
        case 'versao':       return versao;
        case 'origem':       return origem;
        case 'email':        return dono;
        case 'compartilhado':return compart;
        case 'status':       return (!novo && ant && op.concluindo) ? ant.status : ST_ANDAMENTO;
        case 'criadoEm':     return criadoEm;
        case 'atualizadoEm': return agora_();
        /* v8.13 (D02) — ESCOPO VEM DA SESSÃO, NUNCA DO PAYLOAD. O código da
           escola e a regional são o que decide quem vê e quem age sobre este
           registro; até a 8.12 a SRE vinha de `dados.sre || ses.sre`, com a
           tela oferecendo um <select> de todas as regionais do Estado. */
        case 'inep':         return ses.inep || (ant ? (ant.inep || '') : '');
        case 'sre':          return ses.sre || (ant ? (ant.sre || '') : '') || '';
        /* v9.8 — O CÓDIGO INEP (Censo) VEM DA BASE DE ESCOLAS, como a SRE.
           Obrigatório desde esta versão, ele é relido a cada gravação: a
           correção feita na base chega ao documento sem que a escola
           precise redigitar nada. Registro cuja escola ainda não tem o
           código preserva o que estava gravado. */
        case 'censo':        return (escolaPorInep_(ses.inep) || {}).codigoInep ||
                                    (ant ? (ant.censo || '') : '');
        /* o PDF é do servidor: a tela não grava nem o link nem o ID (v7.4) */
        case 'pdfUrl':       return pdfAnt || '';
        /* v8.13 (D01): a revisão sobe a cada escrita. Célula vazia vale 0. */
        case 'rev':          return (ant ? (parseInt(ant.rev, 10) || 0) : 0) + 1;
      }
      /* v8.13 (D02) — LISTA BRANCA. Coluna sem `deTela` é do servidor: o que
         está gravado permanece, e o que vier no payload é ignorado. É o que
         protege, de uma vez, a homologação da SRE (homolPor/homolEm/homolAto),
         a ata (ataId/ataUrl/ataNome/ataData/ataIdent), os anexos, os textos
         congelados da folha, o parecer e as devoluções da validação, a trava
         de edição e o percentual — e toda coluna que vier depois desta.
         v8.1 continua valendo aqui: quem validou o documento é ato da SRE, e
         a conclusão (que regrava a linha inteira) não pode apagá-lo. */
      if (!c.deTela) {
        if (!ant) return '';
        const g = ant[c.key];
        if (g === undefined || g === null) return '';
        return (c.tipo === 'lista') ? (g || []).join('; ') : g;
      }
      const v = dados[c.key];
      if (c.tipo === 'lista') return (v || []).join('; ');
      return (v === undefined || v === null) ? '' : v;
    });

    /* v7.5 (P2): o "% preenchido" é do servidor, calculado da linha montada */
    registro[IDX.pct - 1] = pctDe_(registro);
    /* v8.7 (D1): confere ANTES de gravar — a recusa do Sheets levaria a linha
       inteira junto, e o salvamento automático falharia em silêncio */
    const grande = celulaGrandeDemais_(registro);
    if (grande) return recusaPorTamanho_(grande);
    /* v8.13 (D15) — TEXTO DA ESCOLA QUE COMEÇA POR "=" É TEXTO, NÃO FÓRMULA.
       Sem o formato de texto puro, "=== Eixo 1 ===" ou "=40 horas semanais"
       são interpretados pelo Sheets como fórmula, e o que volta por
       getDisplayValues — para a tela, para o documento e para o PDF
       congelado — é "#NAME?"/"#ERROR!". Um "=IMPORTRANGE" colado por engano
       viraria execução de fórmula dentro da base da rede. O formato vai na
       FAIXA, antes do setValues: depois já seria tarde, a célula já teria
       virado fórmula. */
    aba.getRange(linha, 1, 1, registro.length).setNumberFormat('@');
    aba.getRange(linha, 1, 1, registro.length).setValues([registro]);
    assumirLock_(aba, linha, dados.sessao);
    if (novo) registrarCiclo_(protocolo, 'PPP criado', ses.nome || ses.email, rotuloSessao_(ses), dados.escola || '');   // v7.8 (P8)
    /* v8.13 (D01) — a sobreposição deliberada fica no histórico: nada se
       perde em silêncio, e quem for conferir depois sabe que houve duas
       telas disputando a mesma linha, e qual gravação ficou. */
    if (!novo && ant && dados.sobrepor && dados.rev !== undefined &&
        String(parseInt(dados.rev, 10) || 0) !== String(parseInt(ant.rev, 10) || 0)) {
      registrarCiclo_(protocolo, 'gravação sobreposta', ses.nome || ses.email, rotuloSessao_(ses),
        'a gravação anterior era de ' + (ant.atualizadoEm || '—') + ' (revisão ' + (parseInt(ant.rev, 10) || 0) + ')');
    }
    return { ok: true, protocolo: protocolo, versao: versao, atualizadoEm: registro[IDX.atualizadoEm - 1],
             pct: registro[IDX.pct - 1], rev: registro[IDX.rev - 1] };
  } finally { if (lock) { lock.releaseLock(); gerarPdfsPendentes_(); } }
}

/**
 * v8.13 (D01) — Marca que a linha mudou: sobe a revisão e atualiza a data.
 * Todo ato que escreve num registro (validar, devolver, concluir, assinar,
 * anexar ata, homologar, desfazer, vincular à escola) chama isto uma vez, ao
 * fim. É o que faz o `rev` da tela divergir e a gravação pendente da escola
 * ser recusada em vez de desfazer o ato de terceiro.
 */
function marcarRevisao_(aba, linha) {
  if (!aba || !(linha > 0)) return 0;
  const atual = parseInt(aba.getRange(linha, IDX.rev).getDisplayValues()[0][0], 10) || 0;
  aba.getRange(linha, IDX.rev).setValue(atual + 1);
  aba.getRange(linha, IDX.atualizadoEm).setValue(agora_());
  return atual + 1;
}

/** As situações em que o PPP ainda está "em elaboração" — a escola tem UM
    documento nesse estado de cada vez. Em validação e validado contam: o
    ciclo não se encerrou, ele só está parado esperando a SRE ou a conclusão. */
const ST_EM_ELABORACAO = [ST_ANDAMENTO, ST_VALIDACAO, ST_VALIDADO];
function emElaboracao_(status) { return ST_EM_ELABORACAO.indexOf(status) >= 0; }

/** Procura PPP em elaboração (andamento, validação ou validado) para o mesmo código da escola. */
function buscarPorInep_(aba, inep) {
  const alvo = String(inep == null ? '' : inep).replace(/\D/g, '');
  if (!alvo) return null;
  /* v7.5 (P2): localiza as linhas da escola pela coluna do código
     (createTextFinder) e lê só elas — a aba inteira não é mais lida */
  const linhas = linhasOnde_(aba, 'inep', alvo, true);
  for (let i = 0; i < linhas.length; i++) {
    const v = lerLinhaChaves_(aba, linhas[i], ['protocolo', 'status', 'atualizadoEm', 'escola', 'inep']);
    if (String(v.inep).replace(/\D/g, '') === alvo && emElaboracao_(v.status)) {
      return { protocolo: v.protocolo, escola: v.escola, status: v.status, atualizadoEm: v.atualizadoEm };
    }
  }
  return null;
}

/**
 * v8.13 (C09) — Procura o PPP NÃO ENCERRADO da escola, do mais recente para
 * o mais antigo. Encerrado é só o homologado pela SRE. buscarPorInep_ não
 * serve aqui: ela só enxerga "em elaboração", e era por isso que a trava da
 * baixa deixava de fora justamente a fase mais frágil do ciclo — um PPP em
 * assinatura, assinado, concluído ou enviado para homologação era inativado
 * sem uma palavra. buscarPorInep_ não muda: ela sustenta a regra de "um PPP
 * em elaboração por escola" e a checagem de duplicidade de adotarPPP.
 */
function buscarPPPNaoEncerrado_(aba, inep, protocoloIgnorar) {
  const alvo = String(inep == null ? '' : inep).replace(/\D/g, '');
  if (!alvo) return null;
  /* v8.13 (D07): `protocoloIgnorar` deixa de fora a própria linha de origem —
     é o que permite a novaVersao perguntar "há outro PPP em curso?" sem se
     encontrar a si mesma. */
  const ignora = String(protocoloIgnorar || '').trim().toUpperCase();
  const linhas = linhasOnde_(aba, 'inep', alvo, true);
  let achado = null;
  for (let i = 0; i < linhas.length; i++) {
    const v = lerLinhaChaves_(aba, linhas[i], ['protocolo', 'status', 'atualizadoEm', 'escola', 'inep', 'versao', 'pct']);
    if (String(v.inep).replace(/\D/g, '') !== alvo) continue;
    if (String(v.status) === ST_HOMOLOGADO_SRE) continue;
    if (ignora && String(v.protocolo || '').trim().toUpperCase() === ignora) continue;
    /* o mais recente: a última linha da escola é a versão mais nova */
    achado = { protocolo: v.protocolo, escola: v.escola, status: v.status,
               atualizadoEm: v.atualizadoEm, versao: v.versao, pct: v.pct };
  }
  return achado;
}

/**
 * v8.13 (D07) — A MAIOR VERSÃO JÁ EXISTENTE DESTA ESCOLA.
 * O número da versão passa a ser único por escola: `ant.versao + 1` produzia
 * duas "v2" quando a revisão nascia de uma versão que não era a mais nova.
 */
function maiorVersaoDaEscola_(aba, inep) {
  const alvo = String(inep == null ? '' : inep).replace(/\D/g, '');
  if (!alvo) return 0;
  const linhas = linhasOnde_(aba, 'inep', alvo, true);
  let maior = 0;
  for (let i = 0; i < linhas.length; i++) {
    const v = lerLinhaChaves_(aba, linhas[i], ['inep', 'versao']);
    if (String(v.inep).replace(/\D/g, '') !== alvo) continue;
    maior = Math.max(maior, parseInt(v.versao, 10) || 1);
  }
  return maior;
}

function buscarPPP(payload) {
  const protocolo = (payload && typeof payload === 'object') ? payload.p : payload;
  const sessao = (payload && typeof payload === 'object') ? payload.sessao : '';
  /* buscarPPP abre o registro para EDIÇÃO (assume a trava): é caminho da
     direção. O colegiado lê pelo registroLeitura — v7.3, T-01. Sem sessão
     não abre: o protocolo é público (capa, folha, e-mails) e não é
     credencial — v7.4, P3. */
  const ses = sessaoDirecao_(payload && typeof payload === 'object' ? payload.token : '');
  if (!ses) return semSessao_();
  const p = String(protocolo || '').trim().toUpperCase();
  if (!p) return { ok: false, erro: 'Informe o número do protocolo.' };
  const aba = abaRegistros_();
  const linha = localizarLinha_(aba, p);
  if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado. Confira o número e tente novamente.' };
  const reg = lerLinha_(aba, linha);
  if (!mesmaEscola_(ses, reg.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
  const ocupado = lockAtivo_(reg, sessao);
  if (!ocupado && reg.status === ST_ANDAMENTO) assumirLock_(aba, linha, sessao);
  /* v8.13 (D01): a tela leva a revisão com que abriu e a devolve ao gravar */
  return { ok: true, registro: reg, ocupado: ocupado, rev: parseInt(reg.rev, 10) || 0 };
}

function novaVersao(protocolo) {
  const obj = (protocolo && typeof protocolo === 'object') ? protocolo : {};
  const prot = obj.p !== undefined ? obj.p : protocolo;
  /* v7.4 (P3): só a direção da escola, em sessão, abre nova versão */
  const ses = sessaoDirecao_(obj.token);
  if (!ses) return semSessao_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, String(prot || '').trim().toUpperCase());
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
    const ant = lerLinha_(aba, linha);
    if (!mesmaEscola_(ses, ant.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
    /* v7.3 (T-06) — nova versão só nasce de um documento ENCERRADO: assinado,
       concluído ou já enviado para homologação. E vale a regra de sempre: a
       escola escreve um PPP de cada vez — se já houver um em elaboração, é
       ele que deve ser continuado, não um terceiro. */
    if ([ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE].indexOf(ant.status) < 0) {
      return { ok: false, erro: 'Só um PPP encerrado — assinado, concluído ou enviado para homologação — ' +
        'dá origem a uma nova versão. Este está como "' + ant.status + '".' };
    }
    /* v8.13 (D07) — UM PPP EM CURSO POR ESCOLA. A regra só enxergava "em
       elaboração": com a v1 homologada e a v2 em coleta de assinaturas,
       novaVersao(v1) era aceita e criava OUTRA v2 — mesmo número, mesma
       escola, ao mesmo tempo, nascida do conteúdo da v1 e ignorando tudo o
       que a v2 mudou. O ciclo anterior não se encerrou enquanto a SRE não
       homologou. */
    const emCurso = buscarPPPNaoEncerrado_(aba, ant.inep, ant.protocolo);
    if (emCurso) {
      return { ok: false, duplicado: emCurso,
        erro: 'Esta escola já tem um PPP em curso (' + emCurso.protocolo + ', ' +
              String(emCurso.status || '').toLowerCase() + '). O ciclo anterior só se encerra com a ' +
              'homologação pela Superintendência: conclua esse antes de abrir outra versão.' };
    }
    /* v8.13 (D07) — e a revisão nasce do documento MAIS RECENTE: nascer de
       uma versão antiga faria a nova herdar um conteúdo mais velho do que o
       que já existe. */
    const maiorV = maiorVersaoDaEscola_(aba, ant.inep);
    if ((ant.versao || 1) < maiorV) {
      return { ok: false, erro: 'A versão vigente desta escola é a ' + maiorV +
        '. A revisão nasce dela, não de uma versão anterior.' };
    }

    const novoProt = novoProtocolo_(aba);
    const destino = aba.getLastRow() + 1;
    const registro = CAMPOS.map(function (c) {
      switch (c.key) {
        case 'protocolo':    return novoProt;
        /* v8.13 (D07): o número é único por ESCOLA, não por linha de origem */
        case 'versao':       return maiorVersaoDaEscola_(aba, ant.inep) + 1;
        case 'origem':       return ant.protocolo;
        case 'status':       return ST_ANDAMENTO;
        case 'criadoEm':     return agora_();
        case 'atualizadoEm': return agora_();
        case 'concluidoEm':  return '';
        case 'hash':         return '';
        case 'assinaturas':  return '';
        case 'fonteId':      return '';
        case 'aprovacao':    return '';
        case 'pdfUrl':       return '';
        case 'pdfId':        return '';
        case 'tela':         return 0;
        /* a nova versão é da direção em sessão — o sucessor herda o documento
           da antecessora, mas responde por ele com o próprio e-mail */
        case 'email':        return String(ses.email || ant.email || '').toLowerCase();
        case 'lockSessao':   return '';
        case 'lockDesde':    return '';
        case 'anexos':       return '';
        case 'tarefas':      return '';   // a revisão refaz a preparação (quem participa, dados, encontros)
        case 'tBalanco':     return '';   // o balanço é escrito nesta nova vigência
        /* v8.7 (C3) — a nova versão nascia com a ata, a homologação, o parecer
           e as devoluções da anterior: o painel da SRE mostrava a revisão como
           já tendo ata e homologação, e o prazo de dois anos era contado pela
           homologação ANTIGA — o PPP que É a revisão aparecia como revisão
           vencida. O ciclo anterior continua guardado na aba de histórico e no
           registro que lhe deu origem. */
        case 'ataId':        return '';
        case 'ataUrl':       return '';
        case 'ataNome':      return '';
        case 'ataData':      return '';
        case 'ataIdent':     return '';
        case 'homolDestino': return '';
        case 'homolData':    return '';
        case 'homolPor':     return '';
        case 'homolEm':      return '';
        case 'homolAto':     return '';
        case 'enviadoValidacaoEm': return '';
        case 'validadoPor':  return '';
        case 'validadoEm':   return '';
        case 'parecerValidacao': return '';
        case 'devolucoes':   return '';
        case 'assembleia':   return '';
        case 'analiseSre':   return '';
        case 'quorumPresentes': return '';
        case 'quorumTotal':  return '';
        // guarda o que a versão anterior prometeu e mediu, para o balanço comparar
        case 'objetivosAnteriores':   return ant.tObjetivos || '';
        case 'indicadoresAnteriores': return ant.indicadores || '';
        /* v8.13 (D01): a revisão nasce em 1 — a linha já foi escrita uma vez */
        case 'rev':          return 1;
        /* v8.13 (D08): a folha da versão nova é a DELA. Os textos congelados
           na conclusão da versão anterior (v8.11) vinham junto, e a revisão
           nascia carregando a redação de um documento que não é este. */
        case 'textosFolha':  return '';
        /* v9.8: o código INEP é relido da base — não se herda o de anos atrás */
        case 'censo':        return (escolaPorInep_(ant.inep) || {}).codigoInep || ant.censo || '';
      }
      const v = ant[c.key];
      if (c.tipo === 'lista') return (v || []).join('; ');
      return (v === undefined || v === null) ? '' : v;
    });
    registro[IDX.pct - 1] = pctDe_(registro);   // v7.5 (P2)
    const grandeNV = celulaGrandeDemais_(registro);            // v8.7 (D1)
    if (grandeNV) return recusaPorTamanho_(grandeNV);
    aba.getRange(destino, 1, 1, registro.length).setNumberFormat('@');   /* v8.13 (D15) */
    aba.getRange(destino, 1, 1, registro.length).setValues([registro]);
    registrarCiclo_(novoProt, 'nova versão aberta', ses.nome || ses.email, rotuloSessao_(ses), 'versão ' + ((ant.versao || 1) + 1) + ', a partir de ' + ant.protocolo);   // v7.8 (P8)
    registrarCiclo_(ant.protocolo, 'nova versão aberta a partir deste PPP', ses.nome || ses.email, rotuloSessao_(ses), novoProt);
    return { ok: true, registro: lerLinha_(aba, destino) };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   Prévia (não altera o status)
   ============================================================ */

/**
 * v8.13 (D20) — O REGISTRO A QUE A PRÉVIA SE REFERE, PARA MONTAR A FOLHA.
 *
 * A folha de assinaturas leva nome, MASP e representação de cada signatário:
 * a prévia não pode ser porta para ler a folha de OUTRA escola. Por isso o
 * registro só é lido quando quem pede tem sessão sobre ele; sem isso, a
 * folha sai com o que a própria tela mandou — sem caixa nenhuma, que é o
 * certo num documento que ainda não foi concluído e ainda não tem
 * signatário nenhum.
 */
function regDaPrevia_(dados) {
  const d = dados || {};
  const prot = String(d.protocolo || '').trim().toUpperCase();
  if (prot) {
    try {
      const aba = abaRegistros_();
      const linha = localizarLinha_(aba, prot);
      if (linha >= 0) {
        const reg = lerLinha_(aba, linha);
        if (!recusaSobreRegistro_(d.token, reg)) {
          /* v8.13 (F02) — a prévia de um PPP JÁ CONCLUÍDO mostra a folha de
             verdade; a de um que ainda não tem conclusão mostra o modo
             prévia, porque data de conclusão, protocolo e código de
             autenticidade só existem depois dela. */
          reg.previa = !(reg.concluidoEm && reg.hash);
          return reg;
        }
      }
    } catch (e) { /* prévia nunca falha por causa da folha */ }
  }
  /* v8.13 (F02) — REGISTRO DE RECUO COMPLETO. Até aqui ele trazia sete
     chaves, e `folhaCabecalho_`/`folhaRodapeTextos_` leem mais de vinte:
     `preencher_` devolve o marcador LITERAL quando a chave falta (é assim
     que E06 denuncia texto curado com marcador inventado), e a folha 25 da
     prévia saía com "Documento concluído em {concluidoEm}, sob o protocolo
     .". Declarar as chaves aqui conserta a prévia sem apagar o sinal. */
  return { protocolo: prot, escola: d.escola || '', sre: d.sre || '',
           versao: parseInt(d.versao, 10) || 1, hash: '', assinaturas: '[]', anexos: '[]',
           concluidoEm: '', ataUrl: '', ataData: '', ataNome: '', ataIdent: '',
           homolEm: '', homolData: '', homolAto: '', homolPor: '', homolDestino: '',
           validadoPor: '', validadoEm: '', textosFolha: '', previa: true };
}

/**
 * v8.13 (D20) — A PRÉVIA É PRÉVIA EM TODAS AS FOLHAS.
 *
 * Até a 8.12 a tarja era colada ANTES do <div class="paginas">, fora de
 * qualquer .pagina: como cada folha tem 297 mm e page-break-inside:avoid, a
 * capa era empurrada para a folha seguinte, a folha 1 saía EM BRANCO com a
 * tarja nas bordas do papel e a numeração impressa ficava deslocada de uma
 * folha. E a marca "PRÉVIA" aparecia UMA vez só: separada a pilha, cada
 * folha avulsa era indistinguível de uma folha do documento final, porque
 * previaPDF chamava montarHtmlPdf_ sem rodapé e o <!--COD--> virava vazio.
 *
 * Agora a tarja entra DENTRO da primeira folha e o rodapé de TODAS as folhas
 * diz que aquilo é prévia. A prévia não escreve nada no registro — é o que
 * esta função promete desde sempre.
 */
/** O HTML da prévia, separado do PDF para poder ser conferido sem conversor. */
/* ============================================================
   v8.13 (E17, A8-13) — O QUE VEM DA TELA É CONTEÚDO, NÃO FOLHA DE ESTILO.

   `previaPDF` recebe o HTML do documento montado pela tela. Um chamador
   podia mandar `<style>.previa{display:none}</style>` e receber de volta um
   PDF com a identidade visual da SEE/MG, conteúdo arbitrário e SEM a marca
   de prévia — porque o aviso era um `<p class="previa">` e a folha de estilo
   do autor vinha depois dela. Os estilos do documento vêm de
   `montarHtmlPdf_` (e, desde D16, de DocCss.html), nunca do payload.

   Cinco tags saem com o conteúdo: <script>, <style>, <link>, <base> e
   <meta>. A build atual NÃO injeta <style> no corpo paginado (conferido em
   verifica.js), de modo que nada legítimo se perde.
   ============================================================ */
function limparHtmlDoCliente_(html) {
  return String(html == null ? '' : html)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    /* tag aberta e nunca fechada: some com o resto dela até o fim */
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<\s*\/?\s*(link|base|meta)\b[^>]*>/gi, '');
}
/**
 * v8.13 (E17, A8-13) — A MARCA DE PRÉVIA NÃO SE APAGA.
 * Estilo EM LINHA e com `!important`: nenhuma folha de autor vence uma
 * declaração em linha marcada como importante. A classe continua ali para o
 * DocCss, mas ela já não é o que sustenta a marca.
 */
function marcaDePrevia_(texto) {
  return '<p class="previa" style="display:block !important;visibility:visible !important;' +
    'text-align:center !important;border:1.5pt dashed #8A6D1F !important;color:#6E5615 !important;' +
    'padding:8pt !important;margin:0 0 16pt !important;font-weight:bold !important;' +
    'text-indent:0 !important;font-size:11pt !important;opacity:1 !important">' +
    esc_(texto) + '</p>';
}
function htmlDaPrevia_(dados) {
  const d = dados || {};
  const agora = agora_();
  const aviso = marcaDePrevia_(preencher_(txtServidor_('DOC.previa'), {agora: agora}));
  const corpo = limparHtmlDoCliente_(d.docHtml || '');
  const marca = '<div class="pag-corpo">';
  const i = corpo.indexOf(marca);
  /* queda para o comportamento antigo se o documento não vier em folhas —
     registro legado, ou tela que não pagina */
  const comTarja = (i >= 0)
    ? corpo.slice(0, i + marca.length) + aviso + corpo.slice(i + marca.length)
    : aviso + corpo;
  /* a folha de assinaturas entra na prévia: o sumário promete a seção 22, e
     a prévia é justamente onde se confere o documento antes de congelar */
  const completo = (i >= 0) ? documentoComFolha_(regDaPrevia_(d), comTarja) : comTarja;
  const rodape = 'PRÉVIA — documento ainda não concluído nem assinado · gerado em ' + agora;
  return montarHtmlPdf_(completo, rodape);
}
/* v8.13 (E17): teto do HTML que a prévia aceita converter. O documento da
   demonstração, com o checklist inteiro preenchido, tem 69 mil caracteres
   (verifica.js o imprime a cada execução); os 100 campos do formulário
   somam, no limite dos seus próprios tetos, algo abaixo de 1,2 MB. Dois
   milhões é folga confortável sobre o maior PPP possível e continua sendo
   um teto: o conversor deixa de aceitar entrada de tamanho arbitrário. */
const PREVIA_MAX = 2000000;

function previaPDF(dados) {
  dados = dados || {};
  /* v8.13 (E01/E17, A8-13) — A PRÉVIA É DA DIREÇÃO QUE EDITA O SEU PPP.
     Era um conversor de HTML em PDF ABERTO na API pública: qualquer
     navegador mandava HTML e recebia PDF com o brasão de Minas Gerais,
     gastando a cota de conversão da conta dona. A tela só oferece o botão na
     edição, e quem edita é a direção — `coletarDados` já manda o token, de
     modo que a tela não precisou mudar: a função é que nunca o conferiu.
     O escopo do REGISTRO continua sendo conferido em regDaPrevia_ (D20). */
  const s = sessaoDirecao_(dados.token);
  if (!s) return semSessao_();
  const html = String(dados.docHtml || '');
  if (html.length > PREVIA_MAX) {
    return { ok: false, erro: 'O documento ficou grande demais para a prévia (' +
      Math.round(html.length / 1000) + ' mil caracteres; o limite é ' +
      Math.round(PREVIA_MAX / 1000) + ' mil). Reveja os campos com texto colado de outros arquivos.' };
  }
  const pdf = Utilities.newBlob(htmlDaPrevia_(dados), MimeType.HTML, 'p.html')
                       .getAs(MimeType.PDF);
  const nome = 'PREVIA_' + slug_(dados.escola) + '.pdf';
  pdf.setName(nome);
  return { ok: true, nomeArquivo: nome, base64: Utilities.base64Encode(pdf.getBytes()) };
}

/* ============================================================
   ENTREGA DE ARQUIVOS PELO APP (v7.4, P1)

   Publicado como "Executar como: eu", os arquivos — PDF oficial, ata e
   anexos — vivem no Drive da conta dona e ninguém mais os alcança por link.
   Em vez de expor o link, o app LÊ o arquivo e o entrega ao navegador em
   base64, depois de checar quem pede:
     · sessão de escola (direção ou colegiado) → só a própria escola;
     · sessão regional → só a própria SRE; Central → qualquer registro;
     · signatário externo (membro = token do convite, sem sessão) → só o
       documento cuja folha contém aquele token.
   O padrão é o de previaPDF; o cliente já tem baixarBase64.
   ============================================================ */

/** O ID de um arquivo a partir do link do Drive (registros anteriores à 7.4, sem pdfId). */
function idDeUrlDrive_(url) {
  const m = String(url || '').match(/\/d\/([A-Za-z0-9_\-]{10,})|[?&]id=([A-Za-z0-9_\-]{10,})/);
  return m ? (m[1] || m[2]) : '';
}
/** A linha cuja folha de assinaturas contém o token de convite. 0 quando não há. */
/**
 * documentoPdf({token, p, tipo, id}).
 *   tipo: 'ppp' (padrão) — o PDF oficial, regerado na hora se não existir;
 *         'ata'          — a ata anexada;
 *         'anexo'        — um anexo, por `id` (o ID do arquivo) ou `indice`.
 * Devolve {ok, nome, base64, mime}.
 * v8.1: só em sessão — o token de convite do signatário foi aposentado.
 */
function documentoPdf(payload) {
  const p = payload || {};
  const tipo = String(p.tipo || 'ppp').toLowerCase();
  const aba = abaRegistros_();
  if (!p.token) return semSessao_();
  const s = sessao_(p.token);
  const linha = linhaDoProtocolo_(aba, p.p || p.protocolo);
  if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
  let reg = lerLinha_(aba, linha);
  if (s.perfil === 'escola' && !mesmaEscola_(s, reg.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
  if (s.perfil === 'regional' && String(reg.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return { ok: false, erro: 'Este PPP pertence a outra Superintendência Regional de Ensino.' };
  }
  const entregar = function (arq, mimePadrao) {
    const blob = arq.getBlob();
    let mime = mimePadrao || '';
    try { mime = blob.getContentType() || mime; } catch (e) {}
    return { ok: true, nome: arq.getName(), mime: mime || 'application/octet-stream',
             base64: Utilities.base64Encode(blob.getBytes()) };
  };
  const abrir = function (id) {
    if (!id) return null;
    try { return DriveApp.getFileById(id); } catch (e) { return null; }
  };
  if (tipo === 'ata') {
    const ata = abrir(reg.ataId) || abrir(idDeUrlDrive_(reg.ataUrl));
    if (!ata) return { ok: false, erro: 'Este PPP ainda não tem ata anexada.' };
    return entregar(ata, 'application/pdf');
  }
  if (tipo === 'anexo') {
    let lista = []; try { lista = JSON.parse(reg.anexos || '[]'); } catch (e) { lista = []; }
    const item = lista.filter(function (a) { return p.id && a.id === p.id; })[0] ||
                 (p.indice !== undefined ? lista[parseInt(p.indice, 10)] : null);
    if (!item) return { ok: false, erro: 'Anexo não encontrado.' };
    const arq = abrir(item.id) || abrir(idDeUrlDrive_(item.url));
    if (!arq) return { ok: false, erro: 'O arquivo deste anexo não foi encontrado no acervo.' };
    return entregar(arq, '');
  }
  if (tipo !== 'ppp') return { ok: false, erro: 'Tipo de documento desconhecido.' };
  if (!reg.fonteId) return { ok: false, erro: 'Este PPP ainda não foi concluído: o PDF oficial só existe a partir da conclusão. Use a prévia.' };
  if (s.perfil !== 'escola') registrarCiclo_(reg.protocolo, 'PDF baixado', s.nome || s.email, rotuloSessao_(s), '');   // v7.8 (P8)
  let arq = abrir(reg.pdfId) || abrir(idDeUrlDrive_(reg.pdfUrl));
  if (!arq) {
    /* registro antigo, ou arquivo removido: gera de novo a partir da fonte
       congelada — aqui é forçado, porque o que falta é o arquivo, não a marca */
    gerarPdfOficial_(linha, true);
    reg = lerLinha_(aba, linha);
    arq = abrir(reg.pdfId);
    if (!arq) return { ok: false, erro: 'Não foi possível gerar o PDF agora. Tente novamente em instantes.' };
  }
  return entregar(arq, 'application/pdf');
}

/* ============================================================
   Conclusão — congela o documento e abre a coleta de assinaturas
   ============================================================ */

function concluirPPP(dados) {
  dados = dados || {};
  /* Quem conclui é a direção da escola, em sessão (v7.3, T-01; v7.4, P3). */
  const ses = sessaoDirecao_(dados.token);
  if (!ses) return semSessao_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    dados.ignorarDuplicado = true;            // concluir é ato explícito: não interrompe por INEP repetido
    /* v8.13 (D04) — O DOCUMENTO TEM DE CHEGAR INTEIRO. O corpo congelado é o
       que o código autentica e o que a porta pública devolve; um `docHtml`
       vazio (ou sem as páginas montadas pela tela) produzia um documento
       congelado vazio e, antes da 8.13, sempre o mesmo código. É a mesma
       checagem que apanha um congelamento malfeito. */
    if (String(dados.docHtml || '').indexOf('<div class="paginas"') < 0) {
      return { ok: false, documentoIncompleto: true,
        erro: 'O documento não chegou completo ao servidor. Feche e abra a tela do PPP e conclua de novo; nada foi alterado.' };
    }

    /* A VALIDAÇÃO VEM ANTES DA CONCLUSÃO. Sem o aval da Diretoria
       Educacional não há o que concluir nem o que assinar: é a regra da 7.0,
       e ela vale no servidor, não só nos botões da tela. Um pedido sem
       protocolo, ou com protocolo que não existe, não tem o que concluir —
       antes da 7.3 ele escapava da regra (T-05, T-23). */
    const abaV = abaRegistros_();
    const lv = linhaDoProtocolo_(abaV, dados.protocolo);
    if (!lv) {
      return { ok: false, precisaValidacao: true,
        erro: 'Não há PPP salvo com esse protocolo para concluir. Salve o PPP, envie-o para validação e, validado, conclua.' };
    }
    const atual = lerLinha_(abaV, lv);
    if (!mesmaEscola_(ses, atual.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
    const negaHomConcluir = recusaSeHomologado_(atual);   /* v10.0 */
    if (negaHomConcluir) return negaHomConcluir;
    if (atual.status === ST_ANDAMENTO) {
      return { ok: false, precisaValidacao: true,
        erro: 'Este PPP ainda não foi validado pela Diretoria Educacional. Envie-o para validação; concluído o aval, a conclusão e as assinaturas ficam liberadas.' };
    }
    if (atual.status === ST_VALIDACAO) {
      return { ok: false, precisaValidacao: true,
        erro: 'Este PPP está em validação pela Diretoria Educacional desde ' +
          (atual.enviadoValidacaoEm || 'há pouco') + '. Aguarde o parecer para concluir.' };
    }
    if (atual.status !== ST_VALIDADO) {
      return { ok: false, bloqueado: true, erro: ERRO_BLOQUEIO };
    }

    /* v8.13 (D13): a conferência é feita sobre o que ESTÁ CHEGANDO, que é o
       que será congelado — não sobre a linha gravada. */
    const ruimC = recusaPorIndicadores_({ indicadores: (dados.indicadores !== undefined ? dados.indicadores : atual.indicadores) }, 'concluir');
    if (ruimC) return ruimC;

    /* v8.13 (D01/D02) — a bandeira é ARGUMENTO, não campo do payload, e a
       trava já está em mãos: o LockService não é reentrante, e chamar a porta
       pública aqui faria esta execução esperar por si mesma. */
    const salvo = salvarPPP_(dados, { concluindo: true, jaComTrava: true });
    if (!salvo.ok) return salvo;

    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, salvo.protocolo);
    const reg = lerLinha_(aba, linha);

    const html = String(dados.docHtml || '');
    /* v8.13 (D04) — o digest é calculado DEPOIS de `concluidoEm` existir,
       senão dois cálculos do mesmo documento divergiriam. E a gravação
       CONFERE: existindo o código em outra linha, recalcula com um sal; ao
       fim de cinco tentativas recusa a conclusão, ANTES de gravar qualquer
       campo — um código ambíguo é pior do que uma conclusão adiada. */
    const concluidoEm = agora_();
    const identidade = { protocolo: reg.protocolo, versao: reg.versao, inep: reg.inep, concluidoEm: concluidoEm };
    let codigo = '';
    for (let n = 0; n < 5; n++) {
      codigo = codigoDeAutenticidade_(html, identidade, n ? n : 0);
      const jaExiste = linhaPorHash_(aba, codigo);
      if (jaExiste < 0 || jaExiste === linha) break;
      codigo = '';
    }
    if (!codigo) {
      return { ok: false, erro: 'Não foi possível emitir um código de autenticidade único para este documento. ' +
        'Tente novamente em instantes.' };
    }

    // guarda o documento congelado no Drive (evita o limite de célula da planilha)
    const pasta = obterPastaPdf_();
    const fonte = pasta.createFile(Utilities.newBlob(html, MimeType.HTML,
                    salvo.protocolo + '_fonte.html'));

    /* v8.1 — A folha nasce só com a DIREÇÃO. Os membros do Colegiado entram
       depois, quando a direção marcar quem compareceu à reunião de aprovação
       (presencaColegiado): a folha registra quem esteve lá, não quem está
       cadastrado. Cada um assina dentro do sistema, na própria sessão. */
    /* v7.3 (T-15) — com sessão de direção, quem assina como direção é quem
       está CADASTRADO na sessão: nome, MASP e e-mail vêm do cadastro, e não
       do que a tela digitou. É esse e-mail que "Minhas assinaturas" procura. */
    /* v8.13 (D03): a caixa nasce com o CADASTRO. O que a tela digitava (o
       campo "assinaturaDirecao" do payload) não é mais lido em lugar nenhum:
       a caixa de uma assinatura não se preenche com o que o próprio
       signatário escreve sobre si. */
    const cadDir = acessoPorEmail_(String(ses.email || '').toLowerCase());
    const assinaturas = [{
      papel: 'Direção Escolar',
      segmento: 'Direção',
      nome: (cadDir && cadDir.nome) || reg.direcao || '',
      masp: (cadDir && cadDir.masp) || '',
      email: String((cadDir && cadDir.email) || ses.email || '').toLowerCase(),
      assinadoEm: ''
    }];

    gravarCampo_(aba, linha, 'status', ST_ASSINATURA);
    gravarCampo_(aba, linha, 'concluidoEm', concluidoEm);   /* v8.13 (D04): a mesma data que entrou no digest */
    gravarCampo_(aba, linha, 'hash', codigo);
    gravarCampo_(aba, linha, 'fonteId', fonte.getId());
    gravarCampo_(aba, linha, 'assinaturas', JSON.stringify(assinaturas));
    gravarCampo_(aba, linha, 'textosFolha', congelarTextosFolha_());   /* v8.11 */

    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    pedirPdf_(linha);                         /* v8.8 (B3): fora da trava */
    registrarCiclo_(reg.protocolo, 'PPP concluído', ses.nome || ses.email, rotuloSessao_(ses),
      'coleta de assinaturas aberta · código ' + codigo);   // v7.8 (P8)
    /* v8.8 (B3): o PDF é gerado ao soltar a trava — ainda dentro desta
       execução, antes de a resposta sair. A linha devolvida foi lida antes
       disso, então a marca de "tem PDF" vem à parte. */
    return { ok: true, registro: Object.assign(lerLinha_(aba, linha), { temPdf: true }) };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   VALIDAÇÃO PELA DIRETORIA EDUCACIONAL (v7.0)

   Entre "a escola terminou" e "o documento está concluído" passou a haver um
   ato de terceiro: a Diretoria Educacional da Superintendência olha o PPP e
   valida, ou devolve com parecer. Enquanto não validar, não há conclusão nem
   assinatura — e essa regra vale aqui, no servidor, não nos botões da tela.
   ============================================================ */

/** A escola declara que terminou e manda o documento para o aval da SRE. */
function enviarParaValidacao(payload) {
  const p = payload || {};
  /* v7.3 (T-22) — só a DIREÇÃO da escola envia; v7.4 (P3) — e só em sessão. */
  const ses = sessaoDirecao_(p.token);
  if (!ses) return semSessao_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    if (!mesmaEscola_(ses, reg.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
    const negaHomEnv = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomEnv) return negaHomEnv;
    if (reg.status === ST_VALIDACAO) return { ok: false, erro: 'Este PPP já está em validação desde ' + reg.enviadoValidacaoEm + '.' };
    if (reg.status !== ST_ANDAMENTO) {
      return { ok: false, erro: 'Só um PPP em elaboração pode ser enviado para validação. Este está como "' + reg.status + '".' };
    }
    /* v8.13 (D13): número inválido não entra em documento com valor normativo */
    const ruimV = recusaPorIndicadores_(reg, 'enviar para validação');
    if (ruimV) return ruimV;
    gravarCampo_(aba, linha, 'status', ST_VALIDACAO);
    gravarCampo_(aba, linha, 'enviadoValidacaoEm', agora_());
    gravarCampo_(aba, linha, 'parecerValidacao', '');
    registrarCiclo_(reg.protocolo, 'PPP enviado para validação', ses.nome || ses.email, rotuloSessao_(ses), '');
    /* v7.7 (P6): os validadores da SRE ficam sabendo, pela fila */
    let avisados = 0;
    try { avisados = avisarValidadores_(reg, ses); } catch (e) { avisados = 0; }
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, registro: lerLinha_(aba, linha), avisados: avisados };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   AVISOS POR E-MAIL NOS ATOS DO CICLO (v7.7, P6)
   Enviar para validação avisa os validadores ativos da SRE (uma mensagem,
   todos os destinatários); validar e devolver avisam o diretor em
   exercício. Tudo pela fila de e-mails — nada é enviado na hora, e uma
   falha não trava o ato. Os textos são curáveis (EMAIL.validacao.*).
   ============================================================ */
function corpoAviso_(chave, dados) {
  const app = urlApp_();
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#232A31;line-height:1.55">' +
    preencher_(txtServidor_(chave), dados) +
    (app ? '<p style="margin:22px 0"><a href="' + app + '" style="background:#1F4E79;color:#fff;text-decoration:none;' +
      'padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">' +
      esc_(txtServidor_('EMAIL.validacao.botao')) + '</a></p>' : '') +
    '<p style="font-size:12.5px;color:#5A6572">Gerador de PPP · SEE/MG (mensagem automática, não responda)</p></div>';
}
/** Os validadores ATIVOS de uma SRE (papéis que validam, no perfil regional). */
function validadoresDaSre_(sre) {
  const alvo = String(sre || '').toLowerCase();
  return acessosTodos_().filter(function (a) {
    return a.perfil === 'regional' && String(a.sre || '').toLowerCase() === alvo &&
           String(a.situacao || 'ativo').toLowerCase() !== 'inativo' && podeValidar_(papelDe_(a)) && !!a.email;
  }).map(function (a) { return a.email; });
}
function avisarValidadores_(reg, ses) {
  const emails = validadoresDaSre_(reg.sre);
  if (!emails.length) return 0;
  enfileirarEmail_(emails.join(','), 'validação',
    preencher_(txtServidor_('EMAIL.validacao.enviado.assunto'), { escola: reg.escola }),
    corpoAviso_('EMAIL.validacao.enviado.corpo', { escola: esc_(reg.escola), protocolo: esc_(reg.protocolo),
      diretor: esc_(ses.nome || ses.email), quando: agora_() }), 2);
  return emails.length;
}
function avisarDirecao_(reg, chave, dados, prioridade) {
  const dir = acessoPorInep_(reg.inep);
  if (!dir || !dir.email) return '';
  enfileirarEmail_(dir.email, 'validação',
    preencher_(txtServidor_(chave + '.assunto'), { escola: reg.escola }),
    corpoAviso_(chave + '.corpo', dados), prioridade || 2);
  return dir.email;
}

/** A Diretoria Educacional valida — e só então a escola pode concluir. */
function validarPPP(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = payload || {};
    const s = sessaoGestora_(p.token);
    const papel = papelDaSessao_(s);
    if (!podeValidar_(papel)) {
      return { ok: false, erro: nomeDoPapel_(papel) + ' não valida o Projeto Político-Pedagógico. ' +
        'A validação é da Diretoria Educacional da Superintendência.' };
    }
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    if (s.perfil === 'regional' && String(reg.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
    }
    const negaHomVal = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomVal) return negaHomVal;
    if (reg.status !== ST_VALIDACAO) {
      return { ok: false, erro: 'Só um PPP enviado para validação pode ser validado. Este está como "' + reg.status + '".' };
    }
    gravarCampo_(aba, linha, 'status', ST_VALIDADO);
    gravarCampo_(aba, linha, 'validadoPor', autorParaDocumento_(s, papel));
    gravarCampo_(aba, linha, 'validadoEm', agora_());
    gravarCampo_(aba, linha, 'parecerValidacao', String(p.parecer || ''));
    registrarCiclo_(reg.protocolo, 'PPP validado', s.nome || s.email, rotuloSessao_(s), String(p.parecer || ''));
    /* v7.7 (P6): a direção fica sabendo, pela fila */
    let avisado = '';
    try {
      const parecerV = String(p.parecer || '').trim();
      avisado = avisarDirecao_(reg, 'EMAIL.validacao.validado', { escola: esc_(reg.escola), protocolo: esc_(reg.protocolo),
        por: esc_(autorParaDocumento_(s, papel)), quando: agora_(),
        parecer: parecerV ? '<p><b>Observação da validação:</b> ' + esc_(parecerV) + '</p>' : '' }, 2);
    } catch (e) { avisado = ''; }
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, registro: lerLinha_(aba, linha), avisado: avisado };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/** Devolve à escola com parecer escrito: o documento volta a ser editável. */
function devolverPPP(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = payload || {};
    const s = sessaoGestora_(p.token);
    const papel = papelDaSessao_(s);
    if (!podeValidar_(papel)) {
      return { ok: false, erro: nomeDoPapel_(papel) + ' não devolve o Projeto Político-Pedagógico. ' +
        'A validação é da Diretoria Educacional da Superintendência.' };
    }
    const parecer = String(p.parecer || '').trim();
    if (parecer.length < 20) {
      return { ok: false, erro: 'Descreva no parecer o que precisa ser ajustado — ao menos 20 caracteres. É o que a escola vai ler na tela.' };
    }
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    if (s.perfil === 'regional' && String(reg.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
    }
    /* v8.7 (C1) — "Validado" era um estado sem saída: validada a linha errada,
       ou descoberto um erro grave depois do aval, não havia como devolver, e a
       escola tinha de concluir, anexar ata e ATESTAR A VERACIDADE de um
       documento que sabia estar errado só para poder recomeçar. O PPP já
       validado volta a ser devolvido, com parecer, e a validação é revogada. */
    const negaHomDev = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomDev) return negaHomDev;
    const revogando = (reg.status === ST_VALIDADO);
    if (reg.status !== ST_VALIDACAO && !revogando) {
      return { ok: false, erro: 'Só um PPP em validação, ou já validado, pode ser devolvido. Este está como "' + reg.status + '".' };
    }
    /* Cada devolução vira uma linha no histórico do próprio registro: a
       escola vê o que foi pedido em cada rodada, não só na última. */
    let lista = [];
    try { lista = JSON.parse(reg.devolucoes || '[]'); } catch (e) { lista = []; }
    lista.push({ em: agora_(), por: (s.nome || s.email) + ' · ' + nomeDoPapel_(papel),
                 parecer: parecer, revogacao: revogando || undefined });
    gravarCampo_(aba, linha, 'status', ST_ANDAMENTO);
    gravarCampo_(aba, linha, 'enviadoValidacaoEm', '');
    gravarCampo_(aba, linha, 'parecerValidacao', parecer);
    gravarCampo_(aba, linha, 'devolucoes', JSON.stringify(lista));
    if (revogando) {                                   /* v8.7 (C1) */
      gravarCampo_(aba, linha, 'validadoPor', '');
      gravarCampo_(aba, linha, 'validadoEm', '');
      registrarCiclo_(reg.protocolo, 'validação revogada', s.nome || s.email, rotuloSessao_(s),
        'validado em ' + (reg.validadoEm || '—') + ' por ' + (reg.validadoPor || '—'));
    }
    registrarCiclo_(reg.protocolo, 'PPP devolvido para ajustes', s.nome || s.email, rotuloSessao_(s), parecer);
    /* v7.7 (P6): a direção recebe o parecer também por e-mail, em alta prioridade */
    let avisado = '';
    try {
      avisado = avisarDirecao_(reg, 'EMAIL.validacao.devolvido', { escola: esc_(reg.escola), protocolo: esc_(reg.protocolo),
        por: esc_((s.nome || s.email) + ' · ' + nomeDoPapel_(papel)), quando: agora_(), parecer: esc_(parecer) }, 1);
    } catch (e) { avisado = ''; }
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, rodadas: lista.length, revogada: revogando, registro: lerLinha_(aba, linha), avisado: avisado };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/**
 * v8.8 (B3) — A geração do PDF e a escrita no Drive levam segundos e
 * estavam DENTRO da trava global do script: na semana de fechamento, a rede
 * inteira entrava em fila atrás de uma conversão de PDF, e quem estava
 * definindo a senha via um erro genérico. O que precisa de exclusão mútua é
 * a leitura-e-escrita da planilha; o PDF é derivado dela e pode ser gerado
 * depois. Os atos pedem o PDF com pedirPdf_(), e a geração acontece ao
 * soltar a trava, em gerarPdfsPendentes_().
 *
 * O Apps Script não tem trava por chave — LockService oferece apenas as
 * travas de script, de documento e de usuário —, de modo que não há como
 * travar "por protocolo". O caminho foi encurtar a seção crítica ao que ela
 * precisa ser: a gravação da linha, sem PDF, sem Drive e sem e-mail.
 */
let PDF_PENDENTE = [];
let APOS_TRAVA = [];
function pedirPdf_(linha) {
  if (PDF_PENDENTE.indexOf(linha) < 0) PDF_PENDENTE.push(linha);
}
/** O que também não precisa da trava: e-mail, Drive, avisos. */
function apos_(fn) { APOS_TRAVA.push(fn); }
function gerarPdfsPendentes_() {
  const fila = PDF_PENDENTE, tarefas = APOS_TRAVA;
  PDF_PENDENTE = []; APOS_TRAVA = [];
  fila.forEach(function (l) { try { gerarPdfOficial_(l); } catch (e) {} });
  tarefas.forEach(function (fn) { try { fn(); } catch (e) {} });
}
/** Tudo o que a folha de assinaturas imprime — se não mudou, o PDF não muda. */
function assinaturaDaFolha_(reg) {
  const bruto = [reg.status, reg.versao, reg.hash, reg.concluidoEm, reg.assinaturas, reg.anexos,
    reg.ataNome, reg.ataData, reg.ataIdent, reg.ataUrl,
    reg.homolPor, reg.homolEm, reg.homolAto, reg.homolDestino, reg.homolData,
    reg.validadoPor, reg.validadoEm].join('|');
  try {
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bruto));
  } catch (e) { return String(bruto.length); }
}

/**
 * v8.11 — O CÓDIGO DE AUTENTICIDADE NO RODAPÉ E A CONFERÊNCIA PÚBLICA
 *
 * O código já existia desde a 6.0 — o SHA-256 do conteúdo no momento da
 * conclusão, impresso uma única vez, no fim da folha de assinaturas. Ele
 * passa a vir no rodapé de TODAS as páginas, com o endereço onde se confere,
 * e ganha a contrapartida que faltava: uma porta pública, sem cadastro, em
 * que qualquer pessoa digita o código e recebe o PDF inteiro. É o que
 * permite a quem recebe o documento impresso saber se é aquele mesmo.
 */
/**
 * v8.13 (D21) — O RODAPÉ DIZ O ESTADO, E O ESTADO É DO SERVIDOR.
 *
 * O código nasce na conclusão, ANTES de a folha ter uma única assinatura, e
 * a partir daí todas as páginas afirmavam "Documento assinado eletronicamente
 * no Gerador de PPP" num PDF cujo nome era "…_AGUARDANDO_ASSINATURAS.pdf" e
 * cuja folha dizia "Assinaturas registradas: 0 de 1". O documento continua
 * sendo entregue a quem tem o código — é público por obrigação normativa, e
 * esconder o arquivo seria pior do que dizer em que ponto ele está —, mas o
 * rodapé passa a dizer a verdade.
 *
 * assinaturaDaFolha_ já inclui status e assinaturas, de modo que o cache do
 * PDF invalida sozinho quando o estado muda.
 */
function rodapeAutenticidade_(reg) {
  if (!reg || !reg.hash) return '';
  const url = urlApp_();
  const assin = assinaturasDe_(reg);
  const colhidas = assin.filter(function (a) { return !!a.assinadoEm; }).length;
  const completo = assin.length > 0 && colhidas === assin.length;
  return (completo ? 'Documento assinado eletronicamente no Gerador de PPP'
                   : 'Documento em coleta de assinaturas no Gerador de PPP') +
    ' · código de autenticidade ' + reg.hash +
    (url ? ' · confira em ' + url + '?v=' + encodeURIComponent(reg.hash) : '');
}

/** Regera o PDF oficial com a folha de assinaturas no estado atual. */
function gerarPdfOficial_(linha, forcar) {
  const aba = abaRegistros_();
  const reg = lerLinha_(aba, linha);
  if (!reg.fonteId) return '';
  /* v8.8 (B3): nada do que entra na folha mudou desde a última geração —
     não há PDF novo a fazer. A marca vive no cache do script; perdida ela,
     o pior que acontece é uma geração a mais. */
  const chaveMarca = 'pdf:' + String(reg.protocolo || linha);
  const marca = assinaturaDaFolha_(reg);
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (!forcar && reg.pdfId && cache) {
    let anterior = null;
    try { anterior = cache.get(chaveMarca); } catch (e) { anterior = null; }
    if (anterior === marca) return reg.pdfUrl || '';
  }
  const html = DriveApp.getFileById(reg.fonteId).getBlob().getDataAsString('UTF-8');
  /* v8.13 (D19): a folha de assinaturas entra DENTRO da paginação, e não
     colada depois do </div> que fecha .paginas — ali ela saía sem as margens
     do Padrão Ofício, sem rodapé e sem o código de autenticidade. */
  const completo = documentoComFolha_(reg, html);

  const pdf = Utilities.newBlob(montarHtmlPdf_(completo, rodapeAutenticidade_(reg)), MimeType.HTML, 'd.html')
                       .getAs(MimeType.PDF);
  /* v8.2: assinado o termo pela direção, o documento já está com a SRE — o
     nome do arquivo deixa de dizer que aguarda assinaturas */
  const sufixo = (reg.versao > 1 ? '_v' + reg.versao : '') +
                 ([ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE].indexOf(reg.status) >= 0 ? '' :
                  reg.status === ST_ASSINADO ? '_AGUARDANDO_ATA' : '_AGUARDANDO_ASSINATURAS');
  const nome = reg.protocolo + '_' + slug_(reg.escola) + sufixo + '.pdf';
  pdf.setName(nome);

  const pasta = obterPastaPdf_();
  // remove o PDF anterior do mesmo protocolo, para não acumular versões intermediárias
  const antigos = pasta.getFilesByName(nome);
  while (antigos.hasNext()) { antigos.next().setTrashed(true); }
  const arq = pasta.createFile(pdf);
  /* v7.4 (P1): o ID é o que documentoPdf() lê; o link fica por compatibilidade */
  gravarCampo_(aba, linha, 'pdfUrl', arq.getUrl());
  gravarCampo_(aba, linha, 'pdfId', arq.getId());
  if (cache) { try { cache.put(chaveMarca, marca, 21600); } catch (e) {} }
  return arq.getUrl();
}

/**
 * v7.4 (P3) — a folha não imprime o e-mail de nenhum signatário: o documento
 * é de divulgação obrigatória, e o endereço pessoal de pais e estudantes não
 * tem por que circular nele. Ficam nome, representação, MASP e data/hora.
 *
 * v8.1 — as assinaturas deixam de ser uma tabela e passam a ser CAIXAS, uma
 * por pessoa, com espaço para assinar à mão: a direção, cada membro do
 * Colegiado que compareceu à reunião de aprovação e, ao final, a caixa de
 * quem acompanhou o documento pela Superintendência. Saíram do documento as
 * linhas de assinatura padronizadas e a menção a presidente de colegiado.
 */
function caixaAssinatura_(op) {
  const nome = String((op && op.nome) || '').trim();
  return '<td class="cxa">' +
    '<p class="cx-rot">' + esc_(op.rotulo || '') + '</p>' +
    '<div class="cx-esp"></div>' +
    '<div class="cx-lin"></div>' +
    '<p class="cx-nome">' + (nome ? esc_(nome) : '&nbsp;') + '</p>' +
    (op.abaixo ? '<p class="cx-rep">' + esc_(op.abaixo) + '</p>' : '') +
    (op.quando ? '<p class="cx-quando">' + esc_(op.quando) + '</p>' : '') +
    '</td>';
}
/** As caixas, duas por linha, em tabela — é o que a conversão para PDF respeita. */
function caixasAssinatura_(caixas) {
  let h = '<table class="cxs"><tbody>';
  for (let i = 0; i < caixas.length; i += 2) {
    h += '<tr>' + caixas[i] + (caixas[i + 1] || '<td class="cxa vazia"></td>') + '</tr>';
  }
  return h + '</tbody></table>';
}
/* ============================================================
   v8.11 — O DOCUMENTO ASSINADO NÃO MUDA MAIS

   O corpo do PPP já era congelado na conclusão: vira um arquivo no Drive
   (fonteId) e é dele que sai o PDF. A folha de assinaturas, não — ela é
   remontada a cada assinatura, e usava os textos do sistema COMO ESTÃO
   AGORA. Bastava o Órgão Central reescrever um deles para que a folha de
   um PPP assinado há meses mudasse de redação, sem que ninguém percebesse.
   Agora os cinco textos que a folha usa são congelados na conclusão, junto
   com o resto; a curadoria passa a valer só para os PPPs concluídos DEPOIS
   da alteração.
   ============================================================ */
const CHAVES_FOLHA = ['DOC.folha.titulo', 'DOC.folha.intro', 'DOC.folha.acompanhamento',
                      'DOC.folha.homologacao', 'DOC.folha.codigo'];
function congelarTextosFolha_() {
  const o = {};
  CHAVES_FOLHA.forEach(function (k) { o[k] = txtServidor_(k); });
  return JSON.stringify(o);
}
/** O texto da folha como ele era na conclusão — ou o atual, para os registros
    anteriores à 8.11, que não têm o congelamento. */
function txtDaFolha_(reg, chave) {
  let congelados = null;
  try { congelados = JSON.parse((reg && reg.textosFolha) || 'null'); } catch (e) { congelados = null; }
  if (congelados && typeof congelados[chave] === 'string') return congelados[chave];
  return txtServidor_(chave);
}

/* ============================================================
   v8.13 (D19) — A FOLHA DE ASSINATURAS É UMA SEÇÃO DO DOCUMENTO

   Até a 8.12 a folha era CONCATENADA depois do </div> que fecha .paginas:
   ficava fora de qualquer .pagina e, por isso, sem as margens do Padrão
   Ofício e sem rodapé. Medido com pdftotext -bbox, ela começava a 0 mm da
   borda esquerda (deveria ser 30) e a 5,2 mm do topo (deveria ser 20), e o
   PDF tinha 15 rodapés para 16 páginas — justamente a página que carrega as
   assinaturas e o código de autenticidade era a única sem o código.

   A folha é remontada a cada leitura (as assinaturas mudam), então quem tem
   de paginá-la é o servidor. E ele pode fazê-lo sem medir nada: a folha tem
   estrutura conhecida — título, abertura, N caixas em tabela de duas
   colunas, ata, anexos, homologação e código. Seis caixas (três linhas) por
   folha, a abertura na primeira e os parágrafos finais na última.
   Determinístico, conferível em Node e independente do conversor.

   A função é decomposta em três partes para que folhaEmPaginas_ as
   distribua sem duplicar redação — folhaAssinaturas_ continua existindo,
   com a mesma saída de sempre, para o documento antigo que foi congelado
   sem folhas.
   ============================================================ */
function folhaCabecalho_(reg) {
  /* v8.13 (F02) — NA PRÉVIA, A ABERTURA DIZ O QUE É VERDADE ANTES DA
     CONCLUSÃO. A data da conclusão e o protocolo não existem ainda; o texto
     é do SERVIDOR e fixo, como a tarja de D20, porque não é texto do
     documento oficial: é aviso sobre o que ainda não existe. O título
     continua vindo da curadoria. */
  if (reg && reg.previa) {
    return '<h3 class="doc-h">' + esc_(txtDaFolha_(reg, 'DOC.folha.titulo')) + '</h3>' +
      '<p align="justify">Esta é uma PRÉVIA: o documento ainda não foi concluído. A data da conclusão, o protocolo e ' +
      'o código de autenticidade aparecem nesta folha quando o PPP for concluído no sistema.</p>';
  }
  return '<h3 class="doc-h">' + esc_(txtDaFolha_(reg, 'DOC.folha.titulo')) + '</h3>' +
    '<p align="justify">' + esc_(preencher_(txtDaFolha_(reg, 'DOC.folha.intro'), {
      concluidoEm: reg.concluidoEm, protocolo: reg.protocolo,
      versao: reg.versao > 1 ? ', versão ' + reg.versao : ''})) + '</p>';
}
/** As caixas da folha, na ordem em que são impressas — uma por signatário. */
function folhaCaixas_(reg) {
  const assin = assinaturasDe_(reg);
  const caixas = assin.map(function (a) {
    const daDirecao = a.papel === 'Direção Escolar';
    return caixaAssinatura_({
      rotulo: daDirecao ? 'Direção Escolar' : (a.segmento || 'Colegiado Escolar'),
      nome: a.nome || '',
      /* v10.1: o MASP sai POR EXTENSO — matrícula de servidor público é
         informação pública, e é assim que a tela já a mostrava. */
      abaixo: (daDirecao ? '' : 'Colegiado Escolar') +
              (a.masp ? (daDirecao ? '' : ' · ') + 'MASP ' + a.masp : ''),
      quando: a.assinadoEm ? 'Assinado no sistema em ' + a.assinadoEm : 'Assinatura pendente no sistema'
    });
  });
  /* v8.1 — a caixa de quem acompanhou: o servidor da Diretoria Educacional
     (ou quem mais tenha validado) aparece como ACOMPANHADO POR, não como
     signatário do documento. */
  if (reg.validadoPor) {
    /* v8.13 (C03): a folha é remontada a cada leitura e vai para a porta
       pública — o que estiver gravado com e-mail sai saneado aqui. */
    const partes = semEmail_(reg.validadoPor).split(' · ');
    caixas.push(caixaAssinatura_({
      rotulo: txtDaFolha_(reg, 'DOC.folha.acompanhamento'),
      nome: partes[0] || '',
      abaixo: (partes[1] || '') + (reg.sre ? (partes[1] ? ' · ' : '') + 'SRE ' + reg.sre : ''),
      quando: reg.validadoEm ? 'Documento validado em ' + reg.validadoEm : ''
    }));
  }
  return caixas;
}
/** Os parágrafos do fim da folha: ata, homologação, anexos e o código. */
/* v9.1: os parágrafos da folha de assinaturas levam align="justify" como
   os do corpo (P_JUST na tela): o conversor de PDF descarta parte do CSS, e
   o documento oficial não pode ter a última folha solta à direita. */
function folhaRodapeTextos_(reg) {
  const assin = assinaturasDe_(reg);
  const assinados = assin.filter(function (a) { return !!a.assinadoEm; }).length;
  return (reg.ataUrl
      ? '<p align="justify">A aprovação foi formalizada em reunião do Colegiado Escolar' +
        (reg.ataData ? ' realizada em ' + esc_(reg.ataData) : '') +
        ', cuja ata' + (reg.ataIdent ? ' (' + esc_(reg.ataIdent) + ')' : '') +
        ' encontra-se digitalizada e arquivada junto a este documento no acervo digital da escola, ' +
        'sob o arquivo ' + esc_(reg.ataNome) + '.</p>'
      : '<p class="vazio">Ata de aprovação do Colegiado Escolar pendente de anexação.</p>') +
    (reg.homolData
      ? '<p align="justify">A versão final deste documento foi encaminhada à Superintendência Regional de Ensino em ' +
        esc_(reg.homolData) + ' (' + esc_(reg.homolDestino) + '), para fins de homologação e arquivamento.</p>'
      : '') +
    (function () {
      let ax = [];
      try { ax = JSON.parse(reg.anexos || '[]'); } catch (e) { ax = []; }
      return ax.length
        ? '<p align="justify">Integram este documento, como anexos, os seguintes materiais: ' +
          ax.map(function (a) { return esc_(a.nome); }).join('; ') + '.</p>'
        : '';
    })() +
    /* v7.9 (P9): a homologação registrada pela SRE entra na folha */
    (reg.homolEm
      ? '<p class="homol" align="justify"><b>' + esc_(preencher_(txtDaFolha_(reg, 'DOC.folha.homologacao'), {
          sre: esc_(reg.sre || ''), data: esc_(reg.homolEm),
          ato: reg.homolAto ? ', ato ' + esc_(reg.homolAto) : '', por: esc_(semEmail_(reg.homolPor)) })) + '</b></p>'
      : '') +
    /* v8.13 (F02): na prévia não há assinaturas registradas nem código — o
       parágrafo final diz quando eles passam a existir. O parágrafo da ata
       pendente, acima, continua como está: ele é verdadeiro na prévia. */
    (reg && reg.previa
      ? '<p class="fonte">As assinaturas e o código de autenticidade são gerados na conclusão do documento.</p>'
      : '<p class="fonte">' + preencher_(txtDaFolha_(reg, 'DOC.folha.codigo'), {
          assinados: assinados, total: assin.length, hash: esc_(reg.hash)}) + '</p>');
}

/**
 * v7.4 (P3) — a folha não imprime o e-mail de nenhum signatário.
 * A folha INTEIRA, sem paginar: é o que o documento anterior à 8.13 (e o
 * congelado sem folhas, anterior à 8.9) recebe concatenado ao corpo.
 */
function folhaAssinaturas_(reg) {
  return folhaCabecalho_(reg) + caixasAssinatura_(folhaCaixas_(reg)) + folhaRodapeTextos_(reg);
}

/**
 * v8.13 (D19) — a folha DISTRIBUÍDA em folhas A4, no formato exato que
 * paginar() produz no cliente: seis caixas por folha (três linhas de duas),
 * a abertura na primeira e os parágrafos finais na última. O <!--COD--> é a
 * marca LITERAL que montarHtmlPdf_ troca pelo rodapé de autenticidade — não
 * criar uma segunda marca aqui.
 */
const FOLHA_CAIXAS_POR_PAGINA = 6;
function folhaEmPaginas_(reg, primeiraPagina, totalPrevisto) {
  const caixas = folhaCaixas_(reg);
  const grupos = [];
  for (let i = 0; i < caixas.length; i += FOLHA_CAIXAS_POR_PAGINA) {
    grupos.push(caixas.slice(i, i + FOLHA_CAIXAS_POR_PAGINA));
  }
  if (!grupos.length) grupos.push([]);
  const corpos = grupos.map(function (g, i) {
    return (i === 0 ? folhaCabecalho_(reg) : '') +
           (g.length ? caixasAssinatura_(g) : '') +
           (i === grupos.length - 1 ? folhaRodapeTextos_(reg) : '');
  });
  const html = corpos.map(function (corpo, i) {
    const n = primeiraPagina + i;
    return '<div class="pagina" data-pag="' + n + '" data-de="' + totalPrevisto + '">' +
      '<div class="pag-corpo">' + corpo + '</div>' +
      '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span>' +
      '<span class="pag-num">' + (n > 1 ? n : '') + '</span></div></div>';
  }).join('');
  return { html: html, paginas: corpos.length };
}

/**
 * v8.13 (D19) — o documento oficial INTEIRO: o corpo congelado mais a folha
 * de assinaturas, ambos em folhas A4 numeradas de ponta a ponta.
 *
 * As folhas da assinatura entram ANTES do </div> que fecha .paginas, e o
 * data-de de TODAS as folhas é reescrito com o total final — até a 8.12 o
 * congelado gravava um total que o servidor depois desmentia, acrescentando
 * folhas por fora.
 *
 * Corpo congelado antes da 8.9 não tem folhas: aí a folha continua sendo
 * concatenada como sempre foi, porque não há paginação a que se juntar.
 * Documento assinado não se reescreve.
 */
function documentoComFolha_(reg, corpo) {
  const html = String(corpo || '');
  const nCorpo = (html.match(/<div class="pagina"/g) || []).length;
  if (!nCorpo) return html + '<div class="quebra"></div>' + folhaAssinaturas_(reg);
  const nFolha = folhaEmPaginas_(reg, nCorpo + 1, 0).paginas;
  const total = nCorpo + nFolha;
  const folha = folhaEmPaginas_(reg, nCorpo + 1, total).html;
  const corte = html.lastIndexOf('</div>');
  const junto = (corte < 0 ? html + folha : html.slice(0, corte) + folha + html.slice(corte));
  /* v8.13 (D22): o item "22. Folha de assinaturas" do sumário passa a levar
     o número da PRIMEIRA folha de assinaturas — quem monta o documento
     completo é quem sabe esse número. */
  return junto.replace(/data-de="\d*"/g, 'data-de="' + total + '"')
              .replace(/(<p class="sum-item" data-sum="folha">[\s\S]*?<span class="sum-pag">)[^<]*(<\/span>)/,
                       '$1' + (nCorpo + 1) + '$2');
}

/* ============================================================
   Assinaturas
   ============================================================ */

/**
 * v7.3 (T-08) — Quem age sobre um registro já concluído: a DIREÇÃO da escola
 * dona do registro, em sessão. O diretor sucessor herda o documento da
 * antecessora, porque o vínculo é com a ESCOLA, não com o e-mail que o
 * criou. v7.4 (P3): sem token não há caminho — a resposta é semSessao_().
 * Devolve o erro a responder, ou null quando autorizado.
 */
function recusaSobreRegistro_(token, reg) {
  const ses = sessaoDirecao_(token);
  if (!ses) return semSessao_();
  return mesmaEscola_(ses, reg.inep) ? null : { ok: false, erro: 'Este PPP pertence a outra escola.' };
}

function assinarDirecao(payload) {
  const protocolo = payload && payload.p;
  /* v8.13 (D03): `payload.pessoa` não é mais lido — nome, MASP e e-mail da
     assinatura vêm do cadastro, e só dele. */
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, String(protocolo || '').trim().toUpperCase());
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    const recusa = recusaSobreRegistro_(payload && payload.token, reg);
    if (recusa) return recusa;
    /* v10.0: homologado não recebe mais assinatura — nem a da direção. Era a
       única porta que ainda escrevia depois da homologação: bastava homologar
       com a folha incompleta (o que o sistema permite, avisando) para que a
       direção assinasse um documento já encerrado. */
    const negaHomDir = recusaSeHomologado_(reg);
    if (negaHomDir) return negaHomDir;
    if (reg.status === ST_ANDAMENTO) return { ok: false, erro: 'Conclua o PPP antes de assinar.' };

    const assin = assinaturasDe_(reg);
    const dir = assin.filter(function (a) { return a.papel === 'Direção Escolar'; })[0];
    if (!dir) return { ok: false, erro: 'Registro de assinatura da direção não encontrado.' };
    if (dir.assinadoEm) return { ok: false, erro: 'A direção já assinou este documento.' };

    /* v8.1 — a direção assina POR ÚLTIMO dos seus atos: primeiro anexa a ata
       da reunião, depois marca quem compareceu, e só então assina, atestando
       que o que está registrado é verdadeiro. */
    /* v8.13 (D02) — ATA DE VERDADE, E NÃO UM LINK QUE A TELA ESCREVEU. Até a
       8.12 `ataUrl` vinha do payload (lista negra), de modo que bastava
       mandá-lo em salvarPPP para assinar um documento SEM ATA NENHUMA. O que
       vale é o arquivo no acervo (`ataId`). `ataUrl` sozinho só é aceito em
       registro anterior à 8.13 (sem os textos da folha congelados), que é
       quando a ata podia ter sido anexada antes de `ataId` existir. */
    const ataLegado = !reg.ataId && reg.ataUrl && !reg.textosFolha;
    if (!reg.ataId && !ataLegado) {
      return { ok: false, erro: 'Anexe a ata da reunião de aprovação antes de assinar.' };
    }
    if (!assin.filter(function (a) { return a.papel === 'Colegiado Escolar'; }).length) {
      return { ok: false, erro: 'Marque quem compareceu à reunião de aprovação antes de assinar.' };
    }
    if (!(payload && payload.atesto)) {
      return { ok: false, erro: 'É necessário atestar que as informações registradas são verdadeiras.' };
    }

    /* Com sessão de direção, quem assina é quem está cadastrado: o sucessor
       assina com o próprio nome, MASP e e-mail, não com os da antecessora.
       v8.13 (D03): sem cadastro, RECUSA — a queda para o que a tela digitou
       (`pessoa.*`) era exatamente a situação de quem foi removido depois de
       entrar, e produzia uma assinatura redigida pelo próprio signatário. */
    const ses = sessaoDirecao_(payload && payload.token);
    const cadDir = ses ? acessoPorEmail_(String(ses.email || '').toLowerCase()) : null;
    if (!cadDir) {
      return { ok: false, erro: 'O cadastro da direção não foi encontrado nesta escola. Entre novamente no sistema.' };
    }
    dir.nome = cadDir.nome || '';
    dir.masp = cadDir.masp || '';
    dir.email = String(cadDir.email || '').toLowerCase();
    dir.assinadoEm = agora_();

    gravarCampo_(aba, linha, 'assinaturas', JSON.stringify(assin));
    registrarCiclo_(reg.protocolo, 'assinatura registrada', dir.nome || dir.email, 'Direção Escolar',
      'no sistema · atesto de veracidade');   // v7.8 (P8)

    /* v8.2 — a assinatura da direção ENCAMINHA o documento. Não há mais um
       ato separado de "registrar o envio para homologação": assinado o
       termo, o PPP segue na hora para a equipe da Diretoria Educacional da
       Superintendência, que é quem homologa. */
    const destino = destinoDaDire_(reg.sre);
    gravarCampo_(aba, linha, 'homolDestino', destino);
    gravarCampo_(aba, linha, 'homolData', agora_());
    gravarCampo_(aba, linha, 'status', ST_HOMOLOGADO);
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());
    pedirPdf_(linha);                         /* v8.8 (B3) */
    registrarCiclo_(reg.protocolo, 'enviado para homologação', dir.nome || dir.email, 'Direção Escolar',
      'automático, ao assinar · ' + destino);   // v7.8 (P8)
    let avisados = 0;
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    try { avisados = avisarHomologacao_(lerLinha_(aba, linha), dir); } catch (e) { avisados = 0; }
    return { ok: true, registro: lerLinha_(aba, linha), enviado: true, destino: destino, avisados: avisados };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/** Para quem o documento vai ao ser assinado: a equipe que valida naquela SRE. */
function destinoDaDire_(sre) {
  const n = validadoresDaSre_(sre).length;
  return 'Diretoria Educacional da SRE ' + (sre || '—') + (n ? ' (' + n + ' destinatário(s))' : ' (sem destinatário cadastrado)');
}
/** Avisa quem valida naquela SRE de que há um PPP esperando homologação. */
function avisarHomologacao_(reg, dir) {
  const emails = validadoresDaSre_(reg.sre);
  if (!emails.length) return 0;
  enfileirarEmail_(emails.join(','), 'homologação',
    preencher_(txtServidor_('EMAIL.homologacao.pedido.assunto'), { escola: reg.escola }),
    corpoAviso_('EMAIL.homologacao.pedido.corpo', { escola: esc_(reg.escola), protocolo: esc_(reg.protocolo),
      diretor: esc_((dir && (dir.nome || dir.email)) || reg.direcao || ''), quando: agora_() }), 2);
  return emails.length;
}

/**
 * v8.1 — Quem compareceu à reunião de aprovação.
 *
 * Até a 8.0 a direção CADASTRAVA os membros na folha (nome, e-mail,
 * representação) e o sistema disparava um link individual de assinatura para
 * cada um. Como o colegiado já é cadastrado pela direção na aba própria, era
 * cadastro em dobro. Agora a direção apenas MARCA, entre os membros
 * cadastrados da escola, quem esteve na reunião: são esses que entram na
 * folha e que, ao entrar no sistema com o acesso que já têm, encontram o
 * documento esperando a sua assinatura.
 */
function colegiadoDaFolha(payload) {
  const p = payload || {};
  const aba = abaRegistros_();
  const linha = localizarLinha_(aba, String(p.p || '').trim().toUpperCase());
  if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
  const reg = lerLinha_(aba, linha);
  const recusa = recusaSobreRegistro_(p.token, reg);
  if (recusa) return recusa;
  const naFolha = {};
  assinaturasDe_(reg).forEach(function (a) {
    if (a.papel === 'Colegiado Escolar') naFolha[String(a.email || '').toLowerCase()] = a;
  });
  const membros = membrosColegiado_(reg).map(function (m) {
    const f = naFolha[m.email];
    return { email: m.email, nome: m.nome, segmento: m.segmento, masp: m.masp,
             presente: !!f, assinadoEm: (f && f.assinadoEm) || '' };
  });
  return { ok: true, membros: membros, ata: !!(reg.ataId || reg.ataUrl), status: reg.status };
}
/** Os cadastros de Colegiado Escolar ativos da escola do registro. */
function membrosColegiado_(reg) {
  const inep = String(reg.inep || '').replace(/\D/g, '');
  return acessosTodos_().filter(function (a) {
    return papelDe_(a) === 'colegiado' && a.inep === inep &&
           String(a.situacao).toLowerCase() !== 'inativo';
  }).map(function (a) {
    return { email: String(a.email || '').toLowerCase(), nome: a.nome || '',
             segmento: a.segmento || 'Colegiado Escolar', masp: a.masp || '' };
  });
}
function presencaColegiado(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, String(p.p || '').trim().toUpperCase());
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    const recusa = recusaSobreRegistro_(p.token, reg);
    if (recusa) return recusa;
    const negaHomPres = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomPres) return negaHomPres;
    if (reg.status === ST_ANDAMENTO) return { ok: false, erro: 'Conclua o PPP antes de registrar a reunião de aprovação.' };
    if (reg.status !== ST_ASSINATURA) return { ok: false, erro: 'A coleta de assinaturas deste PPP já está encerrada.' };

    const cadastrados = {};
    membrosColegiado_(reg).forEach(function (m) { cadastrados[m.email] = m; });

    const pedidos = [];
    (p.emails || []).forEach(function (e) {
      const mail = String(e || '').trim().toLowerCase();
      if (mail && pedidos.indexOf(mail) < 0) pedidos.push(mail);
    });
    const fora = pedidos.filter(function (e) { return !cadastrados[e]; });
    if (fora.length) {
      return { ok: false, erro: 'Não estão cadastrados como Colegiado Escolar desta escola: ' + fora.join(', ') +
        '. Cadastre na aba “Colegiado Escolar” e marque a presença em seguida.' };
    }
    if (!pedidos.length) {
      return { ok: false, erro: 'Marque ao menos um membro do Colegiado Escolar presente à reunião de aprovação.' };
    }

    const assin = assinaturasDe_(reg);
    const anteriores = {};
    assin.forEach(function (a) {
      if (a.papel === 'Colegiado Escolar') anteriores[String(a.email || '').toLowerCase()] = a;
    });
    /* Assinatura registrada não sai da folha: quem já assinou continua nela. */
    const presos = Object.keys(anteriores).filter(function (e) {
      return anteriores[e].assinadoEm && pedidos.indexOf(e) < 0;
    });
    if (presos.length) {
      return { ok: false, erro: 'Já há assinatura registrada de ' + presos.join(', ') +
        ': quem assinou não pode ser retirado da folha.' };
    }

    const nova = assin.filter(function (a) { return a.papel !== 'Colegiado Escolar'; });
    pedidos.forEach(function (e) {
      const cad = cadastrados[e], antes = anteriores[e];
      nova.push({ papel: 'Colegiado Escolar',
                  segmento: cad.segmento || 'Colegiado Escolar',
                  nome: cad.nome || (antes && antes.nome) || '',
                  masp: cad.masp || (antes && antes.masp) || '',
                  email: e,
                  assinadoEm: (antes && antes.assinadoEm) || '' });
    });
    gravarCampo_(aba, linha, 'assinaturas', JSON.stringify(nova));
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());
    registrarCiclo_(reg.protocolo, 'presença na reunião de aprovação registrada',
      (sessaoEscola_(p.token) || {}).nome || reg.direcao || '', 'Direção Escolar',
      pedidos.length + ' membro(s) do Colegiado Escolar');   // v7.8 (P8)

    /* Quem entrou agora na folha é avisado, pela fila, de que há um documento
       esperando a sua assinatura. Não é um link de assinatura: é o endereço
       do sistema, onde a pessoa entra com o acesso que já tem. */
    let avisados = 0;
    pedidos.forEach(function (e) {
      if (anteriores[e]) return;
      const cad = cadastrados[e];
      enfileirarEmail_(e, 'assinatura pendente',
        preencher_(txtServidor_('EMAIL.pendente.assunto'), { escola: reg.escola }),
        preencher_(txtServidor_('EMAIL.pendente.corpo'), {
          nome: cad.nome || 'membro do Colegiado Escolar', escola: reg.escola,
          url: urlApp_(), protocolo: reg.protocolo, hash: reg.hash }), 2);
      avisados++;
    });

    concluirSeCompleto_(linha);
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, registro: lerLinha_(aba, linha), presentes: pedidos.length, avisados: avisados };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* v8.1 — Aposentados: adicionarMembros, o convite por link individual
   (enviarConvite_, reenviarConvite, removerMembro, erroDeEmail_), a página
   externa de assinatura (dadosAssinatura, textosAssinatura_,
   registrarAssinatura, registrarRessalva, avisarRessalva_) e a ressalva
   (ressalvarNoSistema). O colegiado é cadastrado pela direção, marcado como
   presente na reunião de aprovação e assina dentro do sistema; a divergência
   que houver fica registrada na ata da reunião. */


/* ============================================================
   ASSINATURA DENTRO DO SISTEMA (v7.0)

   Até aqui a assinatura acontecia numa página externa, alcançada por um link
   individual enviado por e-mail. Com o colegiado cadastrado e com login
   próprio, ela passa a acontecer dentro do sistema: quem entra vê o que está
   esperando a sua assinatura e assina ali. O link externo continua existindo
   como plano B — quem não conseguir entrar ainda consegue assinar.
   ============================================================ */

/** O que espera a assinatura de quem está na sessão. */
function minhasAssinaturas(payload) {
  const s = sessao_(payload && payload.token);
  const email = String(s.email || '').toLowerCase();
  const aba = abaRegistros_();
  const ultima = aba.getLastRow();
  if (ultima < 2 || !email) return { ok: true, pendentes: [], assinados: [] };
  /* v7.5 (P2): só as linhas cuja folha contém o e-mail (createTextFinder na
     coluna das assinaturas), e delas só as colunas necessárias */
  const linhasFolha = linhasOnde_(aba, 'assinaturas', email, false);
  const pendentes = [], assinados = [];
  linhasFolha.forEach(function (l) {
    const reg = lerLinhaChaves_(aba, l, ['protocolo', 'escola', 'versao', 'status', 'assinaturas']);
    /* v8.13 (D06): homologado o documento — o momento em que ele se torna
       definitivo —, o signatário continua vendo o que assinou. Ficava de
       fora justamente o estado final. */
    if ([ST_ASSINATURA, ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE].indexOf(reg.status) < 0) return;
    let assin = []; try { assin = JSON.parse(reg.assinaturas || '[]'); } catch (e) { assin = []; }
    const meu = assin.filter(function (a) { return String(a.email || '').toLowerCase() === email; })[0];
    if (!meu) return;
    const item = { protocolo: reg.protocolo, escola: reg.escola, versao: reg.versao,
                   papel: meu.papel, segmento: meu.segmento, nome: meu.nome,
                   assinadoEm: meu.assinadoEm || '',
                   total: assin.length,
                   assinadas: assin.filter(function (a) { return !!a.assinadoEm; }).length };
    if (meu.assinadoEm) assinados.push(item); else pendentes.push(item);
  });
  return { ok: true, pendentes: pendentes, assinados: assinados };
}

/** Assina o documento identificado pela sessão — sem token, sem link. */
function assinarNoSistema(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = payload || {};
    const s = sessao_(p.token);
    recusarEscolaInativa_(s);   // v8.13 (C04): escola fora da rede não coleta assinatura
    if (!p.aceite) return { ok: false, erro: 'É necessário declarar a leitura e a aprovação do documento.' };
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    /* v8.2 — assinado o termo pela direção, o documento já segue para a
       Diretoria Educacional; as caixas do Colegiado continuam sendo
       preenchidas até a homologação, que encerra o documento. */
    /* v10.0: a recusa do homologado é a mesma de todo ato que escreve */
    const negaHomAss = recusaSeHomologado_(reg);
    if (negaHomAss) return negaHomAss;
    if ([ST_ASSINATURA, ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO].indexOf(reg.status) < 0) {
      return { ok: false, erro: 'Este documento não está em coleta de assinaturas. Situação atual: ' + reg.status + '.' };
    }
    const assin = assinaturasDe_(reg);
    const email = String(s.email || '').toLowerCase();
    const m = assin.filter(function (a) { return String(a.email || '').toLowerCase() === email; })[0];
    if (!m) return { ok: false, erro: 'O seu nome não está na folha de assinaturas deste documento. Procure a direção da escola.' };
    if (m.assinadoEm) return { ok: false, erro: 'Você já assinou este documento em ' + m.assinadoEm + '.' };
    /* v8.13 (D03) — NOME E MASP IMPRESSOS SAEM DO CADASTRO, SEMPRE. Até a
       8.12 `p.nome` e `p.masp` vinham da tela e sobrescreviam a caixa: um
       membro do Colegiado assinava a própria caixa como "Secretário de
       Estado de Educação", com o MASP que quisesse, e era isso que saía no
       PDF oficial e na conferência pública. Uma assinatura que o próprio
       signatário redige não é assinatura. Sem cadastro, o ato é RECUSADO —
       não completado pela tela. */
    const cad = acessoPorEmail_(email);
    if (!cad) {
      return { ok: false, erro: 'O seu cadastro não foi encontrado. Procure a direção da escola.' };
    }
    /* v8.13 (D03) — e o ato reconfere o VÍNCULO com ESTA escola, não só a
       presença do e-mail na folha: quem saiu do Colegiado (ou passou a
       integrar o de outra escola) continuava assinando. A folha registra
       quem compareceu à reunião; a assinatura é ato de agora. */
    if (m.papel === 'Colegiado Escolar') {
      const vinculado = membrosColegiado_(reg).some(function (x) {
        return String(x.email || '').toLowerCase() === email;
      });
      if (!vinculado) {
        return { ok: false, erro: 'O seu vínculo com o Colegiado Escolar desta escola foi encerrado. ' +
          'A folha registra quem compareceu à reunião; a assinatura não pode mais ser registrada.' };
      }
    }
    m.nome = cad.nome || m.nome;
    m.masp = cad.masp || m.masp;
    m.assinadoEm = agora_();
    m.assinadoPor = 'sistema';
    gravarCampo_(aba, linha, 'assinaturas', JSON.stringify(assin));
    concluirSeCompleto_(linha);
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    const fim = lerLinha_(aba, linha);
    registrarCiclo_(reg.protocolo, 'assinatura registrada', m.nome || s.nome || email, m.segmento || m.papel || 'Colegiado', 'no sistema');   // v7.8 (P8)
    return { ok: true, assinadoEm: m.assinadoEm, status: fim.status, hash: fim.hash,
             temPdf: !!(fim.pdfId || fim.pdfUrl || fim.fonteId) };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}


/** Se todos assinaram, fecha o documento e avisa a direção. */
function concluirSeCompleto_(linha) {
  const aba = abaRegistros_();
  const reg = lerLinha_(aba, linha);
  const assin = assinaturasDe_(reg);
  const faltam = assin.filter(function (a) { return !a.assinadoEm; }).length;
  const colegiado = assin.filter(function (a) { return a.papel === 'Colegiado Escolar'; }).length;
  // v6.1: o documento só fecha quando a direção E ao menos um membro do Colegiado
  // assinaram. Antes, a assinatura isolada da direção encerrava a coleta e impedia
  // o convite aos membros.
  const completo = assin.length && faltam === 0 && colegiado > 0;
  /* v8.1 — a ata vem antes das assinaturas. Com ela anexada, a última
     assinatura já encerra o processo: o documento passa direto a
     "Concluído". Sem ata (registros das versões anteriores), para em
     "Assinado" e espera a ata, como antes. */
  /* v8.13 (D06) — O ENCERRAMENTO DA COLETA É UM FATO, E TEM DE FICAR
     REGISTRADO. Desde a v8.2 a assinatura da direção grava "Enviado para
     homologação" na hora, de modo que esta função, que só agia em
     "Em assinatura", nunca mais chegava a agir: o ato "todas as assinaturas
     colhidas" não entrava no ciclo e o e-mail à direção não saía. Em
     "Enviado para homologação" o STATUS NÃO MUDA — o documento está onde
     deve estar, esperando a SRE —, mas o fato é registrado, uma vez só. */
  const encerrando = completo && (reg.status === ST_ASSINATURA || reg.status === ST_HOMOLOGADO);
  if (completo && reg.status === ST_ASSINATURA) {
    const comAta = !!(reg.ataId || reg.ataUrl);
    gravarCampo_(aba, linha, 'status', comAta ? ST_CONCLUIDO : ST_ASSINADO);
    registrarCiclo_(reg.protocolo, 'todas as assinaturas colhidas', 'sistema', '',
      assin.length + ' assinatura(s)' + (comAta ? ' · ata anexada: processo encerrado' : ''));   // v7.8 (P8)
  } else if (completo && reg.status === ST_HOMOLOGADO &&
             !cicloTemAto_(reg.protocolo, 'todas as assinaturas colhidas')) {
    registrarCiclo_(reg.protocolo, 'todas as assinaturas colhidas', 'sistema', '',
      assin.length + ' assinatura(s) · documento aguardando homologação');
  }
  pedirPdf_(linha);                           /* v8.8 (B3) */
  if (encerrando) {
    const dir = assin.filter(function (a) { return a.papel === 'Direção Escolar'; })[0];
    const destino = (dir && dir.email) || reg.email;
    /* v7.4 (P1): o e-mail aponta para o APP, não para o arquivo no Drive; a
       direção entra com o seu acesso e baixa o PDF por documentoPdf(), que
       confere a autorização. v8.1: sem link de convite, é o endereço do app. */
    const link = urlApp_();
    if (destino) apos_(function () {          /* v8.8 (B3): fora da trava */
      try {
        MailApp.sendEmail({ to: destino,
          subject: preencher_(txtServidor_('EMAIL.assinado.assunto'), {escola: reg.escola}),
          name: 'Gerador de PPP — SEE/MG',
          htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' +
            /* v8.13 (D06): em "Enviado para homologação" o que falta não é a
               ata — é a homologação da SRE. O texto diz isso. */
            preencher_(txtServidor_(reg.status === ST_HOMOLOGADO
                ? 'EMAIL.assinado.corpoHomologacao' : 'EMAIL.assinado.corpo'), {
              escola: esc_(reg.escola), total: assin.length}) +
            '<p>Protocolo ' + esc_(reg.protocolo) + ' · código de verificação ' + esc_(reg.hash) + '</p>' +
            (link ? '<p><a href="' + link + '">' + esc_(txtServidor_('EMAIL.assinado.botao')) + '</a></p>' : '') +
            '<p style="font-size:12.5px;color:#5A6572">O conteúdo não pode mais ser alterado; para a ' +
            'revisão bienal, inicie uma nova versão no sistema.</p></div>' });
      } catch (e) {}
    });
  }
}

/**
 * Aprovação definitiva: anexa a ata da reunião do Colegiado Escolar,
 * encerrando o processo. Só é permitida depois de colhidas todas as
 * assinaturas (art. 7º da resolução pedagógica vigente).
 */
function registrarAta(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, String(payload && payload.p || '').trim().toUpperCase());
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    const recusa = recusaSobreRegistro_(payload && payload.token, reg);
    if (recusa) return recusa;
    /* v8.1 — a ata da reunião de aprovação passa a ser o PRIMEIRO ato da
       direção depois de concluído o PPP: anexa a ata, marca quem compareceu
       e só então assina. Registros das versões anteriores, que assinaram
       antes da ata, continuam podendo anexá-la. */
    const negaHomAta = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomAta) return negaHomAta;
    if (reg.status !== ST_ASSINATURA && reg.status !== ST_ASSINADO && reg.status !== ST_CONCLUIDO) {
      return { ok: false, erro: 'A ata é anexada depois de concluído o PPP, na etapa das assinaturas.' };
    }
    /* v8.13 (D05) — A ATA É ANTERIOR À ASSINATURA, E NÃO SE SUBSTITUI.
       Até a 8.12 a ata podia ser trocada depois de o Colegiado ter assinado:
       o arquivo anterior ia para a lixeira, a data da reunião impressa no
       documento mudava, e as assinaturas permaneciam — as pessoas passavam a
       constar como tendo aprovado uma ata que não existia quando assinaram.
       A ordem que a v8.1 estabelece é ata, presença, assinatura. */
    const dirAssinou = assinaturasDe_(reg).some(function (a) {
      return a.papel === 'Direção Escolar' && a.assinadoEm;
    });
    if (dirAssinou) {
      return { ok: false, erro: 'A ata da reunião de aprovação é anexada antes da assinatura da direção. ' +
        'Este documento já foi assinado e encaminhado; o que está assinado não muda. ' +
        'Se a ata precisa ser corrigida, o caminho é uma nova versão.' };
    }
    /* v8.13 (F01) — O CORTE É A PRIMEIRA ASSINATURA, NÃO A PRIMEIRA ATA.
       D05 recusava a troca sempre que houvesse ata anexada, e com isso a
       escola que escolheu o PDF errado no seletor de arquivos ficava sem
       nenhuma saída dentro do sistema: `novaVersao`, `devolverPPP` e
       `desfazerHomologacao` recusam — corretamente — um documento "Em
       assinatura". Enquanto NINGUÉM assinou, trocar a ata não desmente
       assinatura de pessoa alguma e não toca o corpo congelado, que é o que
       o código de autenticidade responde. A partir da primeira assinatura,
       vale a recusa de D05 inteira. */
    const algumaAssinatura = assinaturasDe_(reg).some(function (a) { return !!a.assinadoEm; });
    if (reg.ataId && algumaAssinatura) {
      return { ok: false, erro: 'A ata anexada a este documento não se substitui depois que alguém assinou: ' +
        'quem assinou atestou a reunião registrada nela. Ela é parte do que foi registrado sob o código de ' +
        'autenticidade. Se houver o que corrigir, inicie uma nova versão.' };
    }
    if (!payload.base64) return { ok: false, erro: 'Nenhum arquivo foi recebido.' };
    /* v8.13 (D08) — A DATA DA REUNIÃO SAI IMPRESSA NO DOCUMENTO OFICIAL, e
       era gravada sem nenhuma conferência: o PPP chegou a imprimir "reunião
       … realizada em 99/99/9999". `new Date(9999, 98, 99)` não lança — ele
       transborda para outro mês —, e por isso a validação compara dia, mês e
       ano DE VOLTA com o que foi informado. */
    if (!dataDeReuniaoValida_(payload.dataReuniao)) {
      return { ok: false, erro: 'Informe a data da reunião do Colegiado no formato dd/mm/aaaa. ' +
        'A data sai impressa no documento oficial.' };
    }

    const nomeOrig = String(payload.nome || 'ata');
    const ext = (nomeOrig.match(/\.(pdf|jpg|jpeg|png)$/i) || [, ''])[1].toLowerCase();
    if (!ext) return { ok: false, erro: 'Formato não aceito. Envie a ata em PDF, JPG ou PNG.' };

    let bytes;
    try { bytes = Utilities.base64Decode(payload.base64); }
    catch (e) { return { ok: false, erro: 'Arquivo inválido ou corrompido.' }; }
    if (bytes.length > 12 * 1024 * 1024) {
      return { ok: false, erro: 'Arquivo acima de 12 MB. Reduza a resolução do documento digitalizado.' };
    }

    const blob = Utilities.newBlob(bytes, payload.mime || 'application/octet-stream',
                   reg.protocolo + '_ATA_APROVACAO.' + ext);
    const arq = obterPastaPdf_().createFile(blob);

    /* v8.13 (D05/F01) — histórico não se apaga: o arquivo anterior é
       RENOMEADO, nunca mandado para a lixeira, e a troca entra no ciclo do
       documento. Este bloco corre DEPOIS da criação do arquivo novo (F01):
       antes dele, uma falha em `createFile` deixaria o acervo com uma
       `_SUBSTITUIDA_` e nenhuma ata. */
    if (reg.ataId) {
      try {
        const antigo = DriveApp.getFileById(reg.ataId);
        antigo.setName(antigo.getName() + '_SUBSTITUIDA_' +
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'ddMMyyyy'));
        registrarCiclo_(reg.protocolo, 'ata substituída',
          (sessaoEscola_(payload && payload.token) || {}).nome || reg.direcao || '', 'Direção Escolar',
          'anterior: ' + (reg.ataNome || antigo.getName()));
      } catch (e) { /* arquivo já removido do acervo: segue */ }
    }

    gravarCampo_(aba, linha, 'ataId', arq.getId());
    gravarCampo_(aba, linha, 'ataUrl', arq.getUrl());
    gravarCampo_(aba, linha, 'ataNome', nomeOrig);
    gravarCampo_(aba, linha, 'ataData', String(payload.dataReuniao || ''));
    gravarCampo_(aba, linha, 'ataIdent', String(payload.identificacao || ''));
    registrarCiclo_(reg.protocolo, 'ata anexada', (sessaoEscola_(payload && payload.token) || {}).nome || reg.direcao || '', 'Direção Escolar', nomeOrig);   // v7.8 (P8)
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());

    /* Com a ata no lugar, o que fecha o documento é a última assinatura;
       quando ela já veio (registro das versões anteriores), fecha aqui. */
    if (reg.status === ST_ASSINADO) gravarCampo_(aba, linha, 'status', ST_CONCLUIDO);
    concluirSeCompleto_(linha);
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, registro: lerLinha_(aba, linha) };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/** Anexa ao PPP documentos complementares que enriqueçam sua composição. */
function registrarAnexo(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const aba = abaRegistros_();
    const linha = localizarLinha_(aba, String(payload && payload.p || '').trim().toUpperCase());
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    const recusa = recusaSobreRegistro_(payload && payload.token, reg);
    if (recusa) return recusa;
    /* v8.13 (D05) — ANEXO SÓ ENQUANTO A COLETA ESTÁ ABERTA. Até a 8.12 a
       recusa era só em "Em andamento": aceitava-se anexo em documento já
       HOMOLOGADO. A folha passava a trazer "Integram este documento, como
       anexos: …", o PDF oficial era regerado e o documento congelado
       devolvia outro texto — tudo sob o MESMO código de autenticidade.
       Assinado o termo pela direção, o documento já está com a SRE e o
       código responde pelo que foi assinado: acrescentar material é caso de
       nova versão. */
    const negaHomAnexo = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomAnexo) return negaHomAnexo;
    if (reg.status !== ST_ASSINATURA) {
      return { ok: false, erro: reg.status === ST_ANDAMENTO
        ? 'Conclua o documento antes de anexar materiais.'
        : 'Assinado o termo pela direção, o documento não recebe mais anexos: o código de autenticidade ' +
          'responde pelo que foi assinado. Para acrescentar material, inicie uma nova versão.' };
    }
    if (!payload.base64) return { ok: false, erro: 'Nenhum arquivo foi recebido.' };

    const nomeOrig = String(payload.nome || 'anexo');
    const ext = (nomeOrig.match(/\.(pdf|jpg|jpeg|png|docx|xlsx)$/i) || [, ''])[1].toLowerCase();
    if (!ext) return { ok: false, erro: 'Formato não aceito. Envie PDF, imagem, DOCX ou XLSX.' };

    let bytes;
    try { bytes = Utilities.base64Decode(payload.base64); }
    catch (e) { return { ok: false, erro: 'Arquivo inválido ou corrompido.' }; }
    if (bytes.length > 12 * 1024 * 1024) return { ok: false, erro: 'Arquivo acima de 12 MB.' };

    let lista = [];
    try { lista = JSON.parse(reg.anexos || '[]'); } catch (e) { lista = []; }
    const seq = ('0' + (lista.length + 1)).slice(-2);
    const blob = Utilities.newBlob(bytes, payload.mime || 'application/octet-stream',
                   reg.protocolo + '_ANEXO_' + seq + '.' + ext);
    const arq = obterPastaPdf_().createFile(blob);
    lista.push({ nome: nomeOrig, url: arq.getUrl(), id: arq.getId(), data: agora_() });

    gravarCampo_(aba, linha, 'anexos', JSON.stringify(lista));
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());
    pedirPdf_(linha);                         /* v8.8 (B3) */
    registrarCiclo_(reg.protocolo, 'anexo registrado', (sessaoEscola_(payload && payload.token) || {}).nome || reg.direcao || '', 'Direção Escolar', nomeOrig);   // v7.8 (P8)
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, registro: lerLinha_(aba, linha) };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* v8.2 — registrarHomologacao foi aposentada: o envio para homologação
   deixou de ser um ato da direção. Assinado o termo, assinarDirecao já
   encaminha o documento à Diretoria Educacional e avisa quem valida. */


/**
 * v7.9 (P9) — A HOMOLOGAÇÃO REGISTRADA PELA SRE. Até a 7.8 "homologado" era
 * o que a escola declarava (registrarHomologacao: "enviei"). Agora a
 * Diretoria Educacional, o Superintendente (ou o Central) registram o ato:
 * quem, quando e, se houver, o número do ato. O status final passa a ser
 * "Homologado"; "Enviado para homologação" continua sendo a declaração da
 * escola. A folha e o PDF passam a citar a homologação; a direção é
 * avisada pela fila; a revisão de dois anos conta da data real.
 */
function homologarPPP(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = payload || {};
    const s = sessaoGestora_(p.token);
    const papel = papelDaSessao_(s);
    if (!podeValidar_(papel)) {
      return { ok: false, erro: nomeDoPapel_(papel) + ' não registra a homologação. ' +
        'Isso cabe à Diretoria Educacional, ao Superintendente ou ao Órgão Central.' };
    }
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    if (s.perfil === 'regional' && String(reg.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
    }
    /* v10.0: homologado é final — a recusa é a mesma de todo ato que escreve */
    const negaHomHom = recusaSeHomologado_(reg);
    if (negaHomHom) return negaHomHom;
    if (reg.status !== ST_CONCLUIDO && reg.status !== ST_HOMOLOGADO) {
      return { ok: false, erro: 'Só um PPP assinado pela direção — com a ata da aprovação anexada — pode ser homologado. Este está como "' + reg.status + '".' };
    }
    /* v8.7 (C2) — homologar era irreversível e era feito às cegas: o diálogo
       não dizia que faltavam assinaturas do Colegiado e, homologado, ninguém
       mais assina — o PDF fica com as caixas em branco para sempre. A
       contagem passou a voltar para a tela e, faltando assinatura, era
       preciso confirmar de novo.
       v10.0 — E AGORA O AVISO DIZ DE QUEM. Com a homologação definitiva (o
       desfazer saiu), a caixa que ficar em branco fica em branco para
       sempre, no documento final da vigência. Um número — "7 de 9" — não
       permite decidir: quem homologa precisa saber QUEM foi marcado como
       presente na reunião de aprovação e ainda não assinou, para escolher
       entre esperar essas pessoas e encerrar sem elas. A lista volta com
       nome e segmento, o Colegiado primeiro e a direção destacada. */
    const assin = assinaturasDe_(reg);
    const assinadas = assin.filter(function (a) { return !!a.assinadoEm; }).length;
    const pendentes = pendentesDaFolha_(reg);
    if (pendentes.length && !p.confirmaSemAssinaturas) {
      const nomes = pendentes.map(function (a) {
        return a.nome + (a.direcao ? ' (direção da escola)' : (a.segmento ? ' (' + a.segmento + ')' : ''));
      });
      return { ok: false, faltamAssinaturas: true, assinadas: assinadas, total: assin.length,
        pendentes: pendentes,
        erro: 'Faltam assinaturas: ' + assinadas + ' de ' + assin.length + ' caixas assinadas. ' +
              'Ainda não assinaram: ' + nomes.join('; ') + '. ' +
              'Homologado, o documento é final e definitivo — não recebe mais assinatura e a homologação ' +
              'não é desfeita; estas caixas ficam em branco no PDF, para sempre. ' +
              'Confirme se ainda assim deve ser homologado.' };
    }
    const ato = String(p.ato || '').trim();
    const data = agora_();
    const por = autorParaDocumento_(s, papel);
    gravarCampo_(aba, linha, 'homolPor', por);
    gravarCampo_(aba, linha, 'homolEm', data);
    gravarCampo_(aba, linha, 'homolAto', ato);
    gravarCampo_(aba, linha, 'status', ST_HOMOLOGADO_SRE);
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());
    pedirPdf_(linha);          /* v8.8 (B3): a folha passa a citar a homologação */
    registrarCiclo_(reg.protocolo, 'PPP homologado pela Diretoria Educacional — versão final e definitiva',
      s.nome || s.email, rotuloSessao_(s),
      data + (ato ? ' · ato ' + ato : '') +
      (assinadas < assin.length
        ? ' · homologado com ' + assinadas + ' de ' + assin.length + ' assinaturas · sem assinatura de: ' +
          pendentes.map(function (a) { return a.nome; }).join('; ')
        : ''));
    let avisado = '';
    try {
      avisado = avisarDirecao_(reg, 'EMAIL.homologado', { escola: esc_(reg.escola), protocolo: esc_(reg.protocolo),
        por: esc_(por), quando: esc_(data), ato: ato ? ', ato ' + esc_(ato) : '' }, 2);
    } catch (e) { avisado = ''; }
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, assinadas: assinadas, total: assin.length,
             registro: lerLinha_(aba, linha), avisado: avisado };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/**
 * v10.0 — DESFAZER A HOMOLOGAÇÃO SAIU.
 *
 * A v8.7 (C2) criou este caminho porque homologar era irreversível e era
 * feito às cegas: não se sabia que faltavam assinaturas, e homologado o
 * documento errado o único remédio era abrir nova versão, jogando fora a
 * vigência inteira. O desfazer valia por sete dias, exigia motivo escrito e
 * ficava registrado dos dois lados.
 *
 * A coordenação decidiu o contrário, e a decisão é de fundo: a homologação
 * pela Diretoria Educacional ENCERRA o documento. Ele passa a ser a versão
 * final e definitiva daquela vigência — não se edita, não se assina, não se
 * desomologa. Um documento homologado que pode voltar atrás não é final; é
 * provisório com outro nome, e quem o recebe não sabe qual dos dois está
 * lendo.
 *
 * O que sustentava o desfazer foi resolvido pelo outro lado: o aviso de
 * assinaturas faltantes, que na 10.0 passou a NOMEAR quem foi marcado como
 * presente e ainda não assinou, e a exigir confirmação em separado. Homologa
 * quem quiser homologar assim — sabendo de quem é a caixa que fica em branco.
 *
 * A FUNÇÃO CONTINUA NO MAPA, E RECUSA. Ela existia em API_TELA e tinha botão
 * na tela; uma aba aberta de antes, um atalho guardado ou uma chamada direta
 * não podem voltar a gravar em silêncio. A recusa diz a regra e o caminho
 * que ficou: nova versão.
 */
function desfazerHomologacao(payload) {
  void payload;
  return { ok: false, definitivo: true,
    erro: 'A homologação não é desfeita. Registrada pela Diretoria Educacional, ela encerra o documento: ' +
          'aquela é a versão final e definitiva da vigência, e não pode ser editada, assinada nem desomologada. ' +
          'Para registrar mudanças, a escola abre uma nova versão — ela nasce com protocolo próprio e não altera ' +
          'o que foi homologado.' };
}


/* ============================================================
   PERFIS DE ACESSO (v6.3)
   Três perfis (escopos), com portas distintas na abertura do sistema:

     escola    — direção escolar: elabora e responde o PPP. Entra pelo
                 cadastro feito pela regional (conta institucional ou
                 e-mail e senha); desde a 7.4 não há mais entrada pelo
                 número do protocolo. O COLEGIADO ESCOLAR é do mesmo
                 escopo (papel `colegiado`), mas desde a 7.4 tem a sua
                 própria porta na abertura — lê e assina, só isso.
     regional  — Superintendência Regional de Ensino: consulta os
                 documentos de todas as escolas da sua SRE.
     central   — Órgão Central, em dois modos:
                 · visualização — consulta os documentos de toda a rede;
                 · edição de textos — altera o conteúdo do sistema.

   O cadastro dos acessos regionais é feito pelo próprio Órgão Central,
   dentro do sistema. O acesso do Órgão Central usa a senha institucional
   (definirSenhaCuradoria_) ou o e-mail cadastrado em CURADORES.
   ============================================================ */

const NOME_ABA_ACESSOS = 'Acessos';
const NOME_ABA_ESCOLAS = 'Escolas';
const NOME_ABA_GESTORES = 'Gestores — histórico';
const GESTOR_COLS = ['Código INEP', 'Escola', 'Nome', 'MASP', 'E-mail',
  'Início', 'Fim', 'Registrado por', 'Motivo do encerramento', 'Perfil', 'SRE',
  /* v8.12 — quem encerrou o período e o que caracteriza o vínculo. Até aqui
     o histórico dizia quem ABRIU a associação e não quem a ENCERROU: numa
     auditoria de acesso, saber quem tirou alguém de um perfil importa tanto
     quanto saber quem o pôs. A observação guarda o papel e, no Colegiado
     Escolar, a relação da pessoa com a escola. */
  'Encerrado por', 'Observação'];

/**
 * Histórico dos gestores de cada escola. Cada linha é um período: começa
 * quando o gestor é cadastrado e se encerra quando ele é substituído ou
 * removido. A linha sem "Fim" é o gestor vigente.
 */
function abaGestores_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_GESTORES);
  if (!aba) aba = ss.insertSheet(NOME_ABA_GESTORES);
  const confG = conferirCabecalho_(aba, GESTOR_COLS, NOME_ABA_GESTORES);   /* v8.13 (E03) */
  if (confG.completar) {
    /* histórico criado antes de cobrir os acessos institucionais */
    const de = confG.de + 1;
    aba.getRange(1, de, 1, GESTOR_COLS.length - de + 1)
      .setValues([GESTOR_COLS.slice(de - 1)])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  }
  if (confG.vazia) {
    aba.getRange(1, 1, 1, GESTOR_COLS.length).setValues([GESTOR_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(2, 300); aba.setColumnWidth(3, 220); aba.setColumnWidth(5, 260);
    /* v8.13 (F07): em TEXTO PURO, como a aba de Registros desde D15 */
    try { aba.getRange(1, 1, aba.getMaxRows(), GESTOR_COLS.length).setNumberFormat('@'); } catch (e) {}
    /* O histórico é registro permanente: nenhuma rotina do sistema apaga
       linha aqui, e a aba fica protegida contra edição manual. */
    try {
      const p = aba.protect().setDescription('Histórico de gestores — registro permanente, não deve ser alterado');
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit && p.canDomainEdit()) p.setDomainEdit(false);
    } catch (e) { /* planilha pessoal sem permissão de proteção: segue sem ela */ }
  }
  return aba;
}
/* v7.5 (P2) — memorizado por execução: um cadastro lia a aba inteira duas
   ou três vezes. Toda gravação na aba chama invalidarGestores_(). */
let _gestoresCache = null;
function invalidarGestores_() { _gestoresCache = null; }
/**
 * v8.13 (E08) — O PAPEL DE UM PERÍODO, para efeito de escopo.
 *
 * A aba de gestores guarda o PERFIL (escola / colegiado / regional /
 * central), não o papel: `papelDe_` sobre uma linha de período devolvia
 * sempre o papel de topo do perfil — todo período regional virava
 * "superintendente". Desde a C05 a coluna Observação guarda o NOME do papel
 * (`nomeDoPapel_`), que é o que o cabeçalho da aba promete desde a 8.12: é
 * dela que o papel é resolvido, na LEITURA. Nada é gravado — a aba é
 * registro permanente e protegido. Observação que não nomeia papel (linha
 * antiga, ou Colegiado, que escreve o segmento) cai no papel de topo do
 * perfil, como antes.
 */
function papelDoPeriodo_(g) {
  const obs = String((g && g.observacao) || '').trim().toLowerCase();
  if (obs) {
    const nomes = Object.keys(PAPEIS);
    for (let i = 0; i < nomes.length; i++) {
      if (String(PAPEIS[nomes[i]].nome).trim().toLowerCase() === obs) return nomes[i];
    }
  }
  /* v9.6: período antigo sem o nome do papel na observação — antes de cair
     no papel de topo do perfil, procura o cadastro de acesso da mesma
     pessoa no mesmo perfil: é a melhor evidência do que ela era. Sem isto,
     um Diretor Educacional de antes da 8.13 aparecia como superintendente
     no histórico embutido da caixa errada. */
  try {
    const email = String((g && g.email) || '').toLowerCase();
    if (email) {
      const ac = acessosTodos_().filter(function (a) { return String(a.email || '').toLowerCase() === email && a.perfil === g.perfil; })[0];
      if (ac && PAPEIS[papelDe_(ac)]) return papelDe_(ac);
    }
  } catch (e) {}
  return papelDe_({ papel: '', perfil: (g && g.perfil) || '' });
}
function gestoresTodos_() {
  if (_gestoresCache) return _gestoresCache;
  const aba = abaGestores_();
  const n = aba.getLastRow();
  if (n < 2) { _gestoresCache = []; return _gestoresCache; }
  _gestoresCache = aba.getRange(2, 1, n - 1, GESTOR_COLS.length).getDisplayValues().map(function (r, i) {
    const g = { linha: i + 2, inep: String(r[0]).replace(/\D/g, ''), escola: r[1], nome: r[2],
             masp: String(r[3] || ''), email: String(r[4] || '').toLowerCase(),
             inicio: r[5], fim: r[6], registradoPor: r[7], motivo: r[8],
             perfil: String(r[9] || 'escola'), sre: String(r[10] || ''),
             encerradoPor: String(r[11] || ''), observacao: String(r[12] || '') };
    g.sreEfetiva = sreEfetivaDoPeriodo_(g);
    g.papelEfetivo = papelDoPeriodo_(g);   /* v8.13 (E08) */
    return g;
  });
  return _gestoresCache;
}
/**
 * v8.13 (C02) — a unidade de um período, para efeito de ESCOPO. As linhas
 * anteriores às colunas Perfil e SRE não têm regional gravada, e por isso
 * sumiam do histórico da regional enquanto continuavam visíveis na tela de
 * gestores da mesma escola: duas telas contando histórias diferentes. Aqui a
 * SRE é resolvida pelo INEP, na LEITURA. Não se grava nada na planilha: o
 * histórico é registro permanente e protegido, e uma migração que reescreve
 * milhares de linhas para consertar um defeito de leitura vale menos do que
 * a leitura consertada. Linha institucional antiga, sem SRE e sem INEP,
 * continua sem unidade resolvível — fica visível só ao Órgão Central.
 */
function sreEfetivaDoPeriodo_(g) {
  if (g.sre) return String(g.sre);
  if (!g.inep) return '';
  const base = escolaPorInep_(g.inep);
  return base ? String(base.sre || '') : '';
}
/**
 * Quem é o "titular" de um período. Na escola, o vínculo é a unidade — só
 * um gestor por INEP —, e por isso o período é localizado pelo código INEP.
 * Nos acessos institucionais, uma SRE ou o Órgão Central podem ter várias
 * pessoas ao mesmo tempo; ali o período pertence à PESSOA, e é localizado
 * pelo e-mail.
 */
/**
 * v8.13 (C05) — A CLASSE de um período. Até aqui a busca do período
 * não-escolar era `perfil !== 'escola' && email igual`: uma linha de Colegiado
 * casava com uma busca institucional e vice-versa, e era por essa fresta que
 * um período de colegiado acabava reescrito como se fosse de uma regional.
 */
function classeDePerfil_(p) {
  const x = String(p || 'escola').toLowerCase();
  if (x === 'colegiado') return 'colegiado';
  if (x === 'escola') return 'escola';
  return 'institucional';
}
function periodosAbertos_(chave) {
  const classe = classeDePerfil_(chave.perfil);
  const inep = String(chave.inep || '').replace(/\D/g, '');
  const email = String(chave.email || '').toLowerCase();
  return gestoresTodos_().filter(function (g) {
    if (g.fim) return false;
    if (classeDePerfil_(g.perfil) !== classe) return false;
    /* na escola o vínculo é a UNIDADE (um gestor por INEP); no colegiado é a
       pessoa DENTRO de uma escola; no institucional, a pessoa. */
    if (classe === 'escola') return g.inep === inep;
    if (classe === 'colegiado') return g.email === email && g.inep === inep;
    return g.email === email;
  });
}
/** Abre um período para quem assume o acesso. */
function gestorAbrir_(reg, autor) {
  const aba = abaGestores_();
  const linha = [reg.inep || '', reg.escola || '', reg.nome, reg.masp || '', reg.email,
    agora_(), '', autor || '', '', reg.perfil || 'escola', reg.sre || '', '', reg.observacao || ''];
  /* v8.13 (F07): escola, nome e observação vêm da rede — a faixa é formatada
     como texto ANTES do valor, e por isso `appendRow` vira faixa + setValues. */
  faixaDeTexto_(aba, aba.getLastRow() + 1, 1, 1, GESTOR_COLS.length).setValues([linha]);
  /* v7.6: a memória é completada com a linha nova em vez de descartada — na
     carga em lote, descartar faria reler a aba a cada diretor */
  if (_gestoresCache) {
    const novo = { linha: aba.getLastRow(), inep: String(linha[0]).replace(/\D/g, ''), escola: linha[1], nome: linha[2],
      masp: String(linha[3] || ''), email: String(linha[4] || '').toLowerCase(), inicio: linha[5], fim: '',
      registradoPor: linha[7], motivo: '', perfil: String(linha[9] || 'escola'), sre: String(linha[10] || ''),
      encerradoPor: '', observacao: String(linha[12] || '') };
    novo.sreEfetiva = sreEfetivaDoPeriodo_(novo);
    novo.papelEfetivo = papelDoPeriodo_(novo);   /* v8.13 (E08) */
    _gestoresCache.push(novo);
  }
}
/**
 * Fecha o período aberto. Devolve o último registro encerrado.
 * v8.12: quem encerrou vai na coluna própria. Sem autor — nas rotinas do
 * sistema, como a inativação de escola — fica "sistema", que é a verdade.
 */
function gestorFechar_(chave, motivo, autor) {
  const abertos = periodosAbertos_(chave);
  if (!abertos.length) return null;
  const aba = abaGestores_();
  const fim = agora_();
  const porQuem = String(autor || '').trim() || 'sistema';
  abertos.forEach(function (g) {
    /* v8.13 (F07): o motivo e quem encerrou são texto da rede */
    faixaDeTexto_(aba, g.linha, 7, 1, 3).setValues([[fim, g.registradoPor || '', motivo || '']]);
    faixaDeTexto_(aba, g.linha, 12, 1, 1).setValue(porQuem);
    g.fim = fim; g.motivo = motivo || ''; g.encerradoPor = porQuem;   // a memória acompanha a planilha (v7.6)
  });
  return abertos[abertos.length - 1];
}
/**
 * Atualiza o período vigente quando mudam apenas os dados cadastrais.
 * v8.13 (C05) — só os campos DESCRITIVOS. Até aqui esta função reescrevia as
 * colunas 1 a 5 e 10 e 11 do período já aberto: INEP, e-mail, Perfil e SRE, ou
 * seja, justamente o que IDENTIFICA o vínculo. Mudou a identidade, o período
 * anterior fecha e outro abre — é o que gestorRegistrar_ decide. A aba se
 * declara registro permanente e a promessa tem de valer.
 */
function gestorAtualizar_(reg) {
  const abertos = periodosAbertos_(reg);
  if (!abertos.length) return false;
  const aba = abaGestores_();
  const g = abertos[abertos.length - 1];
  /* v8.13 (F07): escola, nome e MASP — e a observação logo abaixo */
  faixaDeTexto_(aba, g.linha, 2, 1, 3).setValues([[reg.escola || g.escola, reg.nome, reg.masp || '']]);
  if (reg.observacao) { faixaDeTexto_(aba, g.linha, 13, 1, 1).setValue(reg.observacao); g.observacao = reg.observacao; }
  g.escola = reg.escola || g.escola; g.nome = reg.nome;
  g.masp = String(reg.masp || '');   // a memória acompanha a planilha (v7.6)
  return true;
}
/* ============================================================
   v8.13 (C05) — UM PONTO ÚNICO PARA O PERÍODO DE ACESSO

   Os três ramos de acessoSalvarSemTrava_ decidiam por conta própria entre
   abrir, atualizar e fechar. O resultado é que, quando a identidade do
   vínculo mudava de classe (escola → regional, colegiado → regional) ou de
   unidade (outra SRE, outro INEP), o período antigo — que estava sob a chave
   antiga — nunca era fechado, e sobravam dois abertos. Aqui a regra é uma só:
   PERÍODO É IDENTIDADE; mudou a identidade, o anterior FECHA com motivo e um
   novo ABRE.
   ============================================================ */
function chaveDoCadastro_(x) {
  if (!x) return null;
  const papel = String(x.papel || '').trim() || papelDe_(x);
  const perfilPeriodo = (papel === 'colegiado') ? 'colegiado'
    : String(x.perfil || (PAPEIS[papel] ? PAPEIS[papel].perfil : 'escola'));
  return { classe: classeDePerfil_(perfilPeriodo), perfil: perfilPeriodo, papel: papel,
           inep: String(x.inep || '').replace(/\D/g, ''),
           email: String(x.email || '').toLowerCase(),
           sre: String(x.sre || '').trim().toLowerCase() };
}
function mesmaChaveDePeriodo_(a, b) {
  if (!a || !b) return false;
  if (a.classe !== b.classe) return false;
  if (a.classe === 'escola') return a.inep === b.inep;
  if (a.classe === 'colegiado') return a.inep === b.inep && a.email === b.email;
  /* no institucional o PAPEL faz parte da identidade: promover ou rebaixar
     alguém não é corrigir dado cadastral — é outro vínculo. Sem isto, o
     período era reescrito e o histórico deixava de dizer, em momento algum,
     que aquela pessoa tinha sido Superintendente. */
  return a.email === b.email && a.sre === b.sre && a.perfil === b.perfil && a.papel === b.papel;
}
/** O motivo de uma mudança de vínculo, dito em português. */
function motivoDoVinculo_(anterior, novo) {
  const a = chaveDoCadastro_(anterior), b = chaveDoCadastro_(novo);
  const papelA = a.papel || papelDe_(anterior), papelB = b.papel || papelDe_(novo);
  if (papelA && papelB && papelA !== papelB) {
    return 'vínculo alterado: ' + nomeDoPapel_(papelA) + ' → ' + nomeDoPapel_(papelB);
  }
  if (a.classe === 'institucional' && b.classe === 'institucional' && a.sre !== b.sre) {
    return 'transferido de ' + (anterior.sre || '—') + ' para ' + (novo.sre || '—');
  }
  if (a.inep !== b.inep) return 'vínculo alterado para outra unidade';
  return 'vínculo alterado';
}
/** Abre o período, garantindo um só vigente por escola. */
function gestorAbrirPeriodo_(chave, reg, autor) {
  if (chave.classe === 'escola') {
    /* é o que impede dois "vigentes" na mesma escola: qualquer período aberto
       daquele INEP que seja de outra pessoa é encerrado antes, com motivo */
    const deOutros = periodosAbertos_(chave).filter(function (g) { return g.email !== chave.email; });
    if (deOutros.length) {
      gestorFechar_(chave, 'encerrado ao registrar ' + (reg.nome || reg.email) + ' na direção desta escola', autor);
    }
  }
  gestorAbrir_(reg, autor);
}
/**
 * Registra o período de `reg`. `cadAnterior` é o cadastro como estava antes
 * (quando havia). `opcoes.fecharEAbrir` diz que o período anterior encerra e
 * outro começa ainda que a CHAVE não mude — é a troca de diretor (outra
 * pessoa na mesma escola) e a transferência da escola de regional (mesma
 * pessoa, outra SRE). `opcoes.encerrar` diz que o acesso apenas termina.
 */
function gestorRegistrar_(cadAnterior, reg, autor, motivo, opcoes) {
  opcoes = opcoes || {};
  const nova = chaveDoCadastro_(reg);
  const antiga = cadAnterior ? chaveDoCadastro_(cadAnterior) : null;
  if (opcoes.encerrar) { gestorFechar_(antiga || nova, motivo, autor); return; }
  if (antiga && !mesmaChaveDePeriodo_(antiga, nova)) {
    gestorFechar_(antiga, motivo || motivoDoVinculo_(cadAnterior, reg), autor);
    gestorAbrirPeriodo_(nova, reg, autor);
    return;
  }
  if (opcoes.fecharEAbrir) {
    gestorFechar_(nova, motivo, autor);
    gestorAbrirPeriodo_(nova, reg, autor);
    return;
  }
  if (!periodosAbertos_(nova).length) { gestorAbrirPeriodo_(nova, reg, autor); return; }
  gestorAtualizar_(reg);
}

/**
 * Todos os gestores já cadastrados para uma escola, do mais recente para o
 * mais antigo. Visível ao Órgão Central e à regional da própria escola.
 */
/**
 * Todos os períodos de acesso institucional já registrados — regionais e
 * Órgão Central —, do mais recente para o mais antigo. Exclusivo do
 * Órgão Central, que é quem mantém esses cadastros.
 */
/* ============================================================
   v8.12 — O HISTÓRICO DE ASSOCIAÇÕES, EM TODOS OS NÍVEIS

   Até a 8.11 só o histórico dos DIRETORES ESCOLARES era consultável por
   quem os cadastra, e o dos acessos institucionais, só pelo Órgão Central.
   O Colegiado não tinha nenhum. Mas a pergunta "quem pôs esta pessoa aqui,
   quando, e quem a tirou" vale em cada nível da cascata — e é justamente
   nos níveis intermediários que ela costuma aparecer.

   O que muda: cada perfil enxerga o histórico do que ele próprio gere.
     · Órgão Central .............. toda a rede
     · Superintendente ............ os acessos da sua SRE
     · Diretor Educacional e
       Coordenador de Inspeção .... os acessos da sua SRE e as escolas dela
     · equipes das regionais ...... o mesmo escopo da sua chefia, só leitura
     · Direção escolar ............ o colegiado e a gestão da sua escola
   Ninguém vê fora do seu escopo, e todo período traz quem o abriu e quem o
   encerrou.
   ============================================================ */
/** O escopo de histórico de uma sessão: 'rede', uma SRE, ou uma escola. */
/* v8.13 (E08, A7-02) — O ESCOPO DO HISTÓRICO É O QUE A SESSÃO CADASTRA.

   Esta função decidia pelo PERFIL e ignorava o PAPEL: qualquer
   `perfil:'regional'` recebia `{tipo:'sre'}` — inclusive coordenador_inspecao
   e equipe_inspecao, que têm `soLeitura_` e `podeAssociar_` falso. A Inspeção
   recebia o histórico de TODOS os cadastros institucionais e de TODAS as
   direções escolares da SRE. A tela escondia a aba só do colegiado, e o
   comentário logo acima dizia o contrário do que o código fazia.

   A regra passa a ser a que `papeisListaveis_` já aplica em `acessosListar`
   desde a 7.4: o histórico mostra os papéis que aquela sessão CADASTRA,
   dentro da unidade dela. Uma regra, duas telas, a mesma resposta. Quem não
   cadastra ninguém (equipe_de, equipe_inspecao, colegiado) recebe a recusa
   que já existe — e a tela esconde a aba por consequência, não por causa. */
function escopoHistorico_(s) {
  const papel = papelDaSessao_(s);
  const cadastra = (PAPEIS[papel] || { cadastra: [] }).cadastra || [];
  /* o Órgão Central é a exceção declarada: ele não tem "cadastra" que cubra a
     rede inteira, mas é o topo da cascata e mantém os institucionais */
  /* v8.13 (F06) — QUEM ASSOCIA TAMBÉM MANTÉM CADASTRO. `PAPEIS.equipe_de.cadastra`
     é [], mas a Equipe da Diretoria Educacional ASSOCIA diretores às escolas,
     tem a aba "Acessos das escolas" e `papeisDoHistorico_` devolve, para ela,
     ["diretor_escolar"]. O guarda anterior jogava esse cálculo fora e o ramo
     de `papeisListaveis_` que acrescenta `diretor_escolar` a quem associa
     ficava inalcançável por esta porta: quem associa deixou de poder ver o que
     associou, por quem e quando. Quem não cadastra NEM associa continua sem a
     aba — é o acerto de A2-01, e a Equipe de Inspeção segue fora. */
  if (!cadastra.length && !podeAssociar_(papel) && papel !== 'central') return { tipo: 'nenhum' };
  if (s.perfil === 'central') return { tipo: 'rede', papel: papel };
  if (s.perfil === 'regional') return { tipo: 'sre', sre: String(s.sre || ''), papel: papel };
  if (s.perfil === 'escola') return { tipo: 'escola', inep: String(s.inep || '').replace(/\D/g, ''),
                                      escola: s.escola || '', papel: papel };
  return { tipo: 'nenhum' };
}
/**
 * O histórico das associações que a sessão gere. Um só caminho para todos
 * os níveis: o escopo é da sessão, nunca do que a tela pede.
 */
function historicoAssociacoes(payload) {
  const s = sessao_(payload && payload.token);
  const esc = escopoHistorico_(s);
  if (esc.tipo === 'nenhum') return { ok: false, erro: 'Este acesso não mantém cadastros.' };
  const inepPedido = String(payload && payload.inep || '').replace(/\D/g, '');
  const so = String(payload && payload.grupo || '').trim();   // '', 'institucional', 'escola', 'colegiado'
  const daSre = String(esc.sre || '').toLowerCase();

  /* v8.13 (C02) — o escopo é decidido por PERFIL e unidade, nunca só pela
     unidade. As linhas de Colegiado carregam SRE, então caíam no filtro
     regional e entregavam nome, e-mail pessoal e a relação com a escola de
     ESTUDANTES E DE PAIS à regional inteira — inclusive aos dois papéis de
     Inspeção, que só leem. A regra é a que papeisListaveis_ aplica desde a
     7.3: quem vê o Colegiado de uma escola é a direção dela, e ninguém mais
     — nem a regional, nem o Órgão Central. O parâmetro `grupo` vindo da tela
     não amplia escopo: fora da escola, pedir 'colegiado' devolve lista
     vazia. Esconder a opção na tela não bastaria; o escopo vem da sessão. */
  const soDaEscola = (esc.tipo === 'escola');
  let lista = gestoresTodos_();
  if (!soDaEscola) lista = lista.filter(function (g) { return g.perfil !== 'colegiado'; });
  if (esc.tipo === 'sre') {
    /* sreEfetiva: a linha antiga, sem SRE gravada, é localizada pelo INEP */
    lista = lista.filter(function (g) { return String(g.sreEfetiva || '').toLowerCase() === daSre; });
  } else if (soDaEscola) {
    /* a direção vê a sua escola: o colegiado que ela cadastra e a própria
       sucessão na direção. O colegiado, que só lê o PPP, não vê nem isso. */
    if (esc.papel !== 'diretor_escolar') return { ok: false, erro: 'Este acesso não mantém cadastros.' };
    lista = lista.filter(function (g) { return g.inep === esc.inep; });
  } else if (inepPedido) {
    lista = lista.filter(function (g) { return g.inep === inepPedido; });
  }
  /* v8.13 (E08, A7-02): fora da escola, o histórico é dos PAPÉIS que esta
     sessão cadastra — a mesma lista que acessosListar devolve. Chamada SEM
     `pedidos`: o grupo que a tela pede já é tratado acima (C02), e o payload
     não amplia escopo.
     As linhas antigas, sem coluna Papel, derivam o papel do perfil
     (institucional antigo vira `superintendente`), o que as mantém visíveis
     à chefia regional — que é o comportamento desejado. */
  if (!soDaEscola) {
    const papeis = papeisDoHistorico_(s);
    lista = lista.filter(function (g) { return papeis.indexOf(g.papelEfetivo || papelDe_(g)) >= 0; });
  }
  if (so === 'colegiado' && !soDaEscola) lista = [];
  if (so === 'institucional') {
    lista = lista.filter(function (g) { return g.perfil !== 'escola' && g.perfil !== 'colegiado'; });
  } else if (so) {
    lista = lista.filter(function (g) { return g.perfil === so; });
  }
  /* v9.6: o histórico mora junto da caixa de cadastro de cada categoria — a
     tela pede o papel daquela caixa. O filtro NÃO amplia escopo: só estreita
     o que a sessão já veria. */
  const papelPedido = String(payload && payload.papel || '').trim();
  if (papelPedido) lista = lista.filter(function (g) { return (g.papelEfetivo || papelDe_(g)) === papelPedido; });
  const linhas = lista.map(function (g) {
    return { nome: g.nome, email: g.email, masp: g.masp, perfil: g.perfil, sre: g.sre, papel: g.papelEfetivo || papelDe_(g),
             inep: g.inep, escola: g.escola, inicio: g.inicio, fim: g.fim,
             registradoPor: g.registradoPor, encerradoPor: g.encerradoPor,
             motivo: g.motivo, observacao: g.observacao, vigente: !g.fim };
  }).reverse();
  return { ok: true, escopo: esc.tipo, sre: esc.sre || '', escola: esc.escola || '',
           inep: esc.inep || inepPedido || '', linhas: linhas };
}

function acessosHistorico(payload) {
  sessaoCentral_(payload && payload.token);
  const email = String(payload && payload.email || '').trim().toLowerCase();
  /* A janela de gestão é por REGIONAL: pede o histórico daquela unidade
     inteira, não de uma pessoa. 'central' traz o do próprio Órgão Central. */
  const sre = String(payload && payload.sre || '').trim().toLowerCase();
  const soCentral = !!(payload && payload.central);
  const lista = gestoresTodos_()
    .filter(function (g) { return g.perfil !== 'escola' && g.perfil !== 'colegiado'; })   // v7.9 (P11)
    .filter(function (g) { return !email || g.email === email; })
    .filter(function (g) { return !sre || String(g.sre || '').toLowerCase() === sre; })
    .filter(function (g) { return !soCentral || g.perfil === 'central'; })
    .map(function (g) {
      return { nome: g.nome, email: g.email, perfil: g.perfil, sre: g.sre, papel: g.papelEfetivo || papelDe_(g),
               inicio: g.inicio, fim: g.fim, registradoPor: g.registradoPor,
               encerradoPor: g.encerradoPor, observacao: g.observacao,
               motivo: g.motivo, vigente: !g.fim };
    })
    .reverse();
  return { ok: true, acessos: lista };
}

function gestoresHistorico(payload) {
  const s = sessaoGestora_(payload && payload.token);
  const inep = String(payload && payload.inep || '').replace(/\D/g, '');
  const base = escolaPorInep_(inep);
  if (!base) return { ok: false, erro: 'Escola não encontrada na base da rede.' };
  if (s.perfil === 'regional' && String(base.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
  }
  /* v7.9 (P11): só períodos de gestão — as linhas saneadas (perfil "colegiado") ficam fora */
  const daEscola = gestoresTodos_().filter(function (g) { return g.inep === inep && g.perfil === 'escola'; });
  /* v8.13 (C05) — a base em uso pode ter mais de um período aberto na mesma
     escola (inconsistência que a 8.12 e as anteriores deixavam gravar). Não se
     sanea a aba: ela é registro permanente e protegido, e apagar o rastro de um
     defeito do sistema é pior do que exibi-lo. Corrige-se na LEITURA — vigente
     é só o mais recente; os demais saem marcados, e o próximo encerramento
     legítimo resolve o resto sozinho, porque gestorFechar_ fecha todos os
     abertos daquela chave. */
  const abertos = daEscola.filter(function (g) { return !g.fim; });
  const linhaVigente = abertos.length ? abertos[abertos.length - 1].linha : -1;
  const lista = daEscola
    .map(function (g) {
      return { nome: g.nome, masp: g.masp, email: g.email, inicio: g.inicio, fim: g.fim,
               registradoPor: g.registradoPor, encerradoPor: g.encerradoPor,
               motivo: g.motivo, vigente: !g.fim && g.linha === linhaVigente,
               semEncerramento: !g.fim && g.linha !== linhaVigente };
    })
    .reverse();
  return { ok: true, inep: inep, escola: base.escola, gestores: lista };
}
/* A PRIMEIRA COLUNA É A IDENTIDADE DA ESCOLA. Até a 7.0 ela era o código
   INEP, de 8 dígitos. As extrações da rede (SIMADE/SGP) trazem outro número:
   o código da escola na SEE, de 2 a 6 dígitos. Como é esse o número que a
   rede efetivamente usa para se identificar, ele passou a ser a identidade,
   e o INEP virou um campo adicional — útil para cruzar com o Censo Escolar,
   e preenchível depois. Bases já implantadas não mudam de lugar: o que está
   na coluna 1 continua sendo a identidade, tenha 6 ou 8 dígitos. */
const ESCOLA_COLS = ['Código da escola', 'Escola', 'Município', 'SRE', 'Situação', 'Código INEP'];
/** Identidade da escola: de 2 a 8 dígitos — cabe o código da SEE e o INEP. */
const COD_ESCOLA = /^\d{2,8}$/;
/* v8.13 (C11) — tetos dos campos de identidade da escola. Sem eles entravam
   50.000 caracteres num nome de escola e 10.000 numa SRE, que passa a figurar
   no datalist e no quadro das regionais. Os limites são da PORTA DE ENTRADA;
   nada do que já está gravado deixa de ser encontrado por causa deles. */
const ESCOLA_MAX_NOME = 120;
const ESCOLA_MAX_MUNICIPIO = 60;
const ESCOLA_MAX_SRE = 80;
/* v8.13 (C11) — "0031002" e "31002" conviviam como duas escolas distintas,
   porque a comparação é textual sobre a cadeia já normalizada — e é assim que
   uma planilha exportada como texto e outra como número chegam. O aperto é na
   PORTA DE ENTRADA, nunca na de leitura: escolaPorInep_, acessoPorInep_ e
   escolasTodas_ continuam normalizando com replace(/\D/g,''), porque bases em
   uso já têm códigos gravados de vários jeitos e precisam continuar
   encontrando o que está lá. O que muda é o que se pode CRIAR: escola nova
   não começa por zero. Não se inventa um piso numérico — os códigos da SEE
   variam e um mínimo arbitrário recusaria unidade legítima. */
const COD_ESCOLA_NOVO = /^[1-9]\d{1,7}$/;
/** A escola já gravada cujo código é o MESMO número, escrito de outro jeito. */
function escolaComMesmoNumero_(codigo) {
  const n = String(codigo || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!n) return null;
  return escolasTodas_().filter(function (e) {
    return String(e.inep || '').replace(/^0+/, '') === n;
  })[0] || null;
}
/** A escola que já usa este código INEP, se for outra. */
function escolaComMesmoCodigoInep_(codigoInep, exceto) {
  const alvo = String(codigoInep || '').replace(/\D/g, '');
  if (!alvo) return null;
  const meu = String(exceto || '').replace(/\D/g, '');
  return escolasTodas_().filter(function (e) {
    return e.codigoInep === alvo && e.inep !== meu;
  })[0] || null;
}

/**
 * Base das escolas da rede. É a fonte de verdade da identificação escolar:
 * o cadastro de acesso escolhe uma escola daqui, não digita um INEP solto.
 */
function abaEscolas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_ESCOLAS);
  if (!aba) aba = ss.insertSheet(NOME_ABA_ESCOLAS);
  const confE = conferirCabecalho_(aba, ESCOLA_COLS, NOME_ABA_ESCOLAS);   /* v8.13 (E03) */
  if (confE.vazia) {
    aba.getRange(1, 1, 1, ESCOLA_COLS.length).setValues([ESCOLA_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 140); aba.setColumnWidth(2, 340);
    aba.setColumnWidth(3, 200); aba.setColumnWidth(4, 180); aba.setColumnWidth(6, 120);
    /* v8.13 (F07): em TEXTO PURO — o nome da escola e o do município vêm
       colados de planilha e começam por "=" com mais frequência do que se
       imagina (títulos de coluna, separadores). */
    try { aba.getRange(1, 1, aba.getMaxRows(), ESCOLA_COLS.length).setNumberFormat('@'); } catch (e) {}
  } else if (confE.completar) {
    /* base criada antes da 7.1: acrescenta a coluna do INEP ao final */
    const de = confE.de + 1;
    aba.getRange(1, de, 1, ESCOLA_COLS.length - de + 1)
      .setValues([ESCOLA_COLS.slice(de - 1)])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setColumnWidth(6, 120);
  }
  return aba;
}
let _escolasCache = null;
function invalidarEscolas_() { _escolasCache = null; }
function escolasTodas_() {
  if (_escolasCache) return _escolasCache;
  const aba = abaEscolas_();
  const n = aba.getLastRow();
  if (n < 2) { _escolasCache = []; return _escolasCache; }
  _escolasCache = aba.getRange(2, 1, n - 1, ESCOLA_COLS.length).getDisplayValues()
    .map(function (r, i) {
      return { linha: i + 2, inep: String(r[0]).replace(/\D/g, ''), escola: String(r[1] || '').trim(),
               municipio: String(r[2] || '').trim(), sre: String(r[3] || '').trim(),
               situacao: String(r[4] || 'ativa').trim().toLowerCase(),
               codigoInep: String(r[5] || '').replace(/\D/g, '') };
    })
    .filter(function (e) { return e.inep; });
  return _escolasCache;
}
function escolaPorInep_(inep) {
  const alvo = String(inep || '').replace(/\D/g, '');
  if (!alvo) return null;
  return escolasTodas_().filter(function (e) { return e.inep === alvo; })[0] || null;
}
/**
 * O DIRETOR cadastrado para esta escola, se houver. Um por código de escola.
 * O colegiado também tem perfil "escola" e o mesmo código, mas NÃO é gestor:
 * até a 7.2 esta busca pegava o primeiro perfil escolar que aparecesse — e
 * um membro do colegiado passava por diretor (T-04). O papel decide.
 */
function acessoPorInep_(inep) {
  const alvo = String(inep || '').replace(/\D/g, '');
  if (!alvo) return null;
  /* v7.5 (P2): pela coluna do código da escola, sem ler a aba */
  const lista = _acessosCache || acessosOnde_(ACESSO_COLS.indexOf('Código INEP') + 1, alvo);
  return lista.filter(function (a) {
    return papelDe_(a) === 'diretor_escolar' && a.inep === alvo;
  })[0] || null;
}
/** Os membros do colegiado cadastrados numa escola (ativos ou não). */
function colegiadoDaEscola_(inep) {
  const alvo = String(inep || '').replace(/\D/g, '');
  if (!alvo) return [];
  const lista = _acessosCache || acessosOnde_(ACESSO_COLS.indexOf('Código INEP') + 1, alvo);
  return lista.filter(function (a) { return papelDe_(a) === 'colegiado' && a.inep === alvo; });
}

/**
 * v7.3 (T-03) — As ações sobre a base de escolas e sobre os acessos das
 * direções são de quem ASSOCIA diretores: a Diretoria Educacional e os
 * perfis acima dela. A Coordenação de Inspeção e sua equipe leem; não
 * cadastram escola, não inativam, não removem diretor.
 */
/* v9.7: a sessão que ASSOCIA diretores — estrita: Diretoria Educacional e equipe */
function sessaoAssociaDiretores_(token) {
  const s = sessaoGestora_(token);
  const papel = papelDaSessao_(s);
  if (!podeAssociar_(papel)) {
    throw new Error(nomeDoPapel_(papel) + ' não gere os diretores escolares: essa competência é da Diretoria Educacional da Superintendência e da sua equipe.');
  }
  return s;
}
function sessaoAssocia_(token) {
  const s = sessaoGestora_(token);
  const papel = papelDaSessao_(s);
  if (!podeGerirBase_(papel)) {
    throw new Error(nomeDoPapel_(papel) + ' não mantém a base de escolas: essa competência é do Órgão Central ' +
      'e da Diretoria Educacional da Superintendência.');
  }
  return s;
}

/**
 * Lista as escolas da rede com o gestor de cada uma. A regional recebe
 * apenas as da sua SRE; o Órgão Central, todas.
 */
function escolasListar(payload) {
  const s = sessaoGestora_(payload && payload.token);
  const daSre = String(s.sre || '').toLowerCase();
  const acessos = {};
  /* só o DIRETOR é gestor: o colegiado, que também tem perfil escolar, não
     entra neste mapa (T-04) */
  acessosTodos_().forEach(function (a) { if (papelDe_(a) === 'diretor_escolar' && a.inep) acessos[a.inep] = a; });
  const quantos = {};
  gestoresTodos_().forEach(function (g) { if (g.perfil === 'escola') quantos[g.inep] = (quantos[g.inep] || 0) + 1; });   // v7.9 (P11)
  const lista = escolasTodas_()
    .filter(function (e) { return s.perfil === 'central' || String(e.sre).toLowerCase() === daSre; })
    .map(function (e) {
      const a = acessos[e.inep];
      return { inep: e.inep, escola: e.escola, municipio: e.municipio, sre: e.sre,
               situacao: e.situacao, codigoInep: e.codigoInep || '',
               gestoresJaCadastrados: quantos[e.inep] || 0,
               gestor: a ? { email: a.email, nome: a.nome, masp: a.masp,
                             situacao: a.situacao, ultimoAcesso: a.ultimoAcesso } : null };
    });
  lista.sort(function (a, b) { return String(a.escola).localeCompare(String(b.escola), 'pt-BR'); });
  return { ok: true, perfilGestor: s.perfil, sreGestor: s.sre || '',
           escolas: lista, total: lista.length,
           ativas: lista.filter(function (e) { return e.situacao !== 'inativa'; }).length,
           comAcesso: lista.filter(function (e) { return !!e.gestor; }).length,
           sres: sresConhecidas_() };
}

/* O domínio institucional da rede. Quem tem conta nele é identificado pelo
   próprio aplicativo, sem digitar nada. Quem tem e-mail de outro domínio NÃO
   é identificado assim: entra por e-mail e senha, pelo link de primeiro
   acesso — e por isso depende de ter recebido e usado o convite. O cadastro
   não é bloqueado por isso: seria pior perder a informação. O que o sistema
   faz é AVISAR quem cadastra, e listar a pendência em "Contas a regularizar". */
const DOMINIO_REDE = '@educacao.mg.gov.br';
function emailInstitucional_(email) {
  /* v8.0: a comparação era indexOf(DOMINIO) === length - DOMINIO.length, e
     dava "institucional" para todo endereço de 18 caracteres sem o domínio
     — indexOf devolve -1 e 18 - 19 também é -1. "carlos@exemplo.com" era um
     deles: recebia boas-vindas em vez do convite de primeiro acesso. */
  const e = String(email || '').toLowerCase();
  return e.length > DOMINIO_REDE.length && e.slice(-DOMINIO_REDE.length) === DOMINIO_REDE;
}
/** O aviso a quem cadastra alguém com e-mail fora do domínio (v7.3, T-25). */
/* ============================================================
   v8.12 — SERVIDOR OU NÃO, NO COLEGIADO ESCOLAR

   O Colegiado é composto por segmentos: docentes e servidores
   administrativos, que são servidores da rede e têm conta institucional; e
   estudantes, famílias e comunidade, que não são e nunca terão. Cobrar
   conta institucional de um pai de aluno é cobrar o impossível: o alerta
   nunca se resolve e a pendência polui a lista de quem realmente precisa
   regularizar. Daqui para a frente, a cobrança é só de quem é servidor.

   De quem não é servidor pede-se outra coisa, que faz sentido: a relação
   com a escola — de que estudante é responsável, que entidade representa.
   ============================================================ */
const SEGMENTOS_SERVIDOR = ['docente', 'servidor administrativo'];
function segmentoDeServidor_(segmento) {
  const g = String(segmento || '').trim().toLowerCase();
  return SEGMENTOS_SERVIDOR.indexOf(g) >= 0;
}
/** O que o histórico guarda do vínculo de um membro do colegiado. */
/* ============================================================
   v8.13 (E19, A8-20) — A "RELAÇÃO COM A ESCOLA" SAI DO REGISTRO PERMANENTE.

   O campo `relacao` foi criado na v8.12 para guardar "de que estudante é
   responsável, que entidade representa". Ele identifica, pelo intermédio do
   responsável, um ESTUDANTE — quase sempre uma criança — por ano e turma.

   Ele era gravado em DOIS lugares: na coluna 18 da aba Acessos, que é o
   cadastro vivo e tem caminho de exclusão (`acessoRemover` apaga a linha), e
   concatenado na `observacao` do histórico de gestores — aba que se declara
   "registro permanente", que nenhuma rotina apaga e que `acessoRemover` não
   tocava. O vínculo nominal ficava sem caminho de exclusão.

   Ele deixa de ser escrito no histórico. O histórico continua dizendo o que
   precisa dizer — quem entrou, em que papel, quando, por quem e quem
   encerrou —, que é a razão de ele ser permanente. O segmento fica: ele é a
   composição do Colegiado, que é ato público.
   ============================================================ */
const TARJA_RELACAO = '(relação removida com o cadastro)';
function observacaoColegiado_(segmento) {
  return String(segmento || '').trim() || 'Colegiado Escolar';
}
/**
 * v8.13 (E19, A8-20) — Tarja a relação já gravada nos períodos daquela
 * pessoa naquela escola. NÃO apaga linha, NÃO toca em nome, datas,
 * "registrado por" nem "encerrado por": o que sai é o detalhe livre sobre um
 * TERCEIRO. Isso não é apagar o histórico; é a minimização que a finalidade
 * do registro permite. Só acontece quando há o que tarjar — período cuja
 * observação é só o segmento fica exatamente como está.
 * Roda sob a trava de quem chama (acessoRemover já a tem).
 */
function tarjarRelacaoNoHistorico_(email, inep) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return 0;
  const chaveInep = String(inep || '').replace(/\D/g, '');
  const aba = abaGestores_();
  let n = 0;
  gestoresTodos_().forEach(function (g) {
    if (g.perfil !== 'colegiado') return;
    if (g.email !== e) return;
    if (chaveInep && g.inep !== chaveInep) return;
    const obs = String(g.observacao || '');
    const i = obs.indexOf(' · ');
    if (i < 0) return;                       /* só o segmento: não há o que tarjar */
    const segmento = obs.slice(0, i);
    const nova = segmento + ' · ' + TARJA_RELACAO;
    if (nova === obs) return;
    faixaDeTexto_(aba, g.linha, 13, 1, 1).setValue(nova);   /* v8.13 (F07) */
    g.observacao = nova;                     /* a memória acompanha a planilha (v7.6) */
    n++;
  });
  return n;
}

function avisoDominio_(email, conviteEnviado, modo) {
  if (emailInstitucional_(email)) return '';
  return 'O e-mail ' + email + ' não é do domínio ' + DOMINIO_REDE + '. Esta pessoa não é identificada ' +
    'pela conta institucional e entrará por e-mail e senha, pelo link de primeiro acesso' +
    (conviteEnviado ? (modo === 'fila' ? ', que será enviado nos próximos minutos' : ', que foi enviado agora') : '') +
    '. Providencie a conta ' + DOMINIO_REDE +
    ' para que ela passe a entrar sem senha. O cadastro foi gravado.';
}

/** As regionais conhecidas: as que já aparecem na base e nos acessos. */
function sresConhecidas_() {
  const m = {};
  escolasTodas_().forEach(function (e) { if (e.sre) m[e.sre] = true; });
  acessosTodos_().forEach(function (a) { if (a.sre) m[a.sre] = true; });
  return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
}

/**
 * OS DIRETORES COM E-MAIL FORA DO DOMÍNIO DA REDE.
 *
 * O sistema aceita qualquer endereço — recusar o cadastro só faria a rede
 * perder a informação de quem dirige a escola. Mas quem tem e-mail de outro
 * domínio não é identificado pela conta institucional: entra por senha, pelo
 * link de primeiro acesso, e depende de tê-lo recebido e usado. Isso é uma
 * pendência de implantação, e pendência que ninguém vê não se resolve.
 *
 * Daí esta lista: cada regional enxerga os seus, com o estado de cada um —
 * quem já definiu senha e quem ainda não abriu o convite. O Órgão Central
 * enxerga a rede inteira, com filtro por regional.
 */
function contasPendentes(payload) {
  /* v8.13 (C16, A2-08) — A PENDÊNCIA PRECISA TER ONDE SER VISTA. Cadastrar um
     docente ou um servidor administrativo do Colegiado com e-mail particular
     produz o aviso "Providencie a conta @educacao.mg.gov.br" (avisoDominio_),
     mas esta lista só olhava `diretor_escolar` e a aba era escondida
     justamente de quem cadastra o Colegiado: a pendência nascia sem destino.
     As duas pontas passam a usar a MESMA regra — segmentoDeServidor_ decide o
     aviso e decide a lista. O escopo, porém, não se alarga: o Colegiado é da
     direção da escola, e não sai para a regional nem para o Órgão Central
     (é a regra de C02 e de papeisListaveis_). Daí os três escopos. */
  const sEsc = sessao_(payload && payload.token);
  if (sEsc.perfil === 'escola' && papelDaSessao_(sEsc) === 'diretor_escolar') {
    return contasPendentesDaEscola_(sEsc);
  }
  /* fora da escola, a lista continua sendo a dos diretores escolares — e
     continua sendo de quem associa, com a recusa de sempre */
  const s = sessaoAssociaDiretores_(payload && payload.token);   /* v9.7 */
  const daSre = String(s.sre || '').toLowerCase();
  const escolas = {};
  escolasTodas_().forEach(function (e) { escolas[e.inep] = e; });
  const diretores = acessosTodos_().filter(function (a) {
    if (papelDe_(a) !== 'diretor_escolar') return false;
    return s.perfil === 'central' || String(a.sre || '').toLowerCase() === daSre;
  });
  const fora = diretores.filter(function (a) { return !emailInstitucional_(a.email); });
  const linhas = fora.map(function (a) {
    const e = escolas[a.inep] || {};
    return { inep: a.inep, escola: a.escola || e.escola || '', municipio: e.municipio || '',
             sre: a.sre || '', nome: a.nome || '', masp: a.masp || '', email: a.email,
             dominio: String(a.email).split('@')[1] || '',
             jaDefiniuSenha: !!a.hash, convitePendente: !!a.token,
             ultimoAcesso: a.ultimoAcesso || '', situacao: a.situacao || 'ativo' };
  });
  linhas.sort(function (x, y) {
    return (x.sre + x.escola).localeCompare(y.sre + y.escola, 'pt-BR');
  });
  const sres = {};
  linhas.forEach(function (x) { if (x.sre) sres[x.sre] = true; });
  return { ok: true, escopo: s.perfil === 'central' ? 'rede' : 'sre',
           perfilGestor: s.perfil, sreGestor: s.sre || '', dominio: DOMINIO_REDE,
           linhas: linhas, totalDiretores: diretores.length, foraDominio: linhas.length,
           jaEntraram: linhas.filter(function (x) { return x.jaDefiniuSenha; }).length,
           sres: Object.keys(sres).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }) };
}

/**
 * v8.13 (C16) — a mesma lista, no escopo da escola: os membros SERVIDORES do
 * Colegiado da própria escola com conta fora do domínio. Estudantes, famílias
 * e comunidade não entram: deles não se cobra conta institucional (v8.12), e
 * uma pendência impossível de resolver só polui a lista de quem tem
 * pendência de verdade.
 */
function contasPendentesDaEscola_(s) {
  const inep = String(s.inep || '').replace(/\D/g, '');
  if (!inep) return { ok: false, erro: 'Esta ação é da direção escolar.' };
  const servidores = acessosTodos_().filter(function (a) {
    return papelDe_(a) === 'colegiado' && a.inep === inep && segmentoDeServidor_(a.segmento);
  });
  const linhas = servidores.filter(function (a) { return !emailInstitucional_(a.email); })
    .map(function (a) {
      return { inep: a.inep, escola: a.escola || s.escola || '', municipio: '', sre: '',
               nome: a.nome || '', masp: a.masp || '', email: a.email,
               segmento: a.segmento || '', relacao: a.relacao || '',
               dominio: String(a.email).split('@')[1] || '',
               jaDefiniuSenha: !!a.hash, convitePendente: !!a.token,
               ultimoAcesso: a.ultimoAcesso || '', situacao: a.situacao || 'ativo' };
    });
  linhas.sort(function (x, y) { return String(x.nome).localeCompare(String(y.nome), 'pt-BR'); });
  return { ok: true, escopo: 'escola', perfilGestor: 'escola', sreGestor: '', dominio: DOMINIO_REDE,
           escola: s.escola || '', linhas: linhas,
           totalDiretores: servidores.length, foraDominio: linhas.length,
           jaEntraram: linhas.filter(function (x) { return x.jaDefiniuSenha; }).length,
           sres: [] };
}

/**
 * Cadastro de uma escola na base da rede, uma a uma — o caminho para a
 * escola nova, criada ou reaberta ao longo do ano, sem esperar por uma nova
 * carga completa da planilha.
 *
 * O código INEP é a identidade e não muda: informado um INEP que já existe,
 * a gravação é uma alteração do registro daquela escola, nunca um segundo
 * registro. Vale a mesma cascata do resto do sistema — o Órgão Central
 * alcança toda a rede; a regional, apenas a sua própria SRE, que vem da
 * sessão e não do que a tela enviar.
 */
function escolaSalvar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const s = sessaoAssocia_(payload && payload.token);
    const p = payload || {};
    const inep = String(p.inep || '').replace(/\D/g, '');
    const escola = String(p.escola || '').trim();
    const municipio = String(p.municipio || '').trim();
    if (!COD_ESCOLA.test(inep)) return { ok: false, erro: 'O código da escola deve ter de 2 a 8 dígitos, apenas números.' };
    /* v9.8: o código INEP passou a ser OBRIGATÓRIO na base da rede, por
       decisão da coordenação. Ele é o que cruza a escola com o Censo e com
       as bases federais; enquanto era opcional, entrava em branco e nunca
       mais era preenchido. Escola já gravada sem INEP só é alterada depois
       de informá-lo — é assim que a base se regulariza. */
    const codigoInep = String(p.codigoInep || '').replace(/\D/g, '');
    if (!codigoInep) return { ok: false, erro: 'Informe o código INEP da escola: são 8 dígitos, e ele é obrigatório.' };
    if (codigoInep.length !== 8) {
      return { ok: false, erro: 'O código INEP tem 8 dígitos.' };
    }
    if (escola.length < 4) return { ok: false, erro: 'Informe o nome da escola.' };
    /* v8.13 (C11): tetos da porta de entrada — sem eles entravam 50.000
       caracteres num nome de escola e 10.000 numa SRE, que passa a figurar no
       datalist e no quadro das regionais. */
    if (escola.length > ESCOLA_MAX_NOME) {
      return { ok: false, erro: 'O nome da escola tem no máximo ' + ESCOLA_MAX_NOME + ' caracteres.' };
    }
    if (!municipio) return { ok: false, erro: 'Informe o município da escola.' };
    if (municipio.length > ESCOLA_MAX_MUNICIPIO) {
      return { ok: false, erro: 'O nome do município tem no máximo ' + ESCOLA_MAX_MUNICIPIO + ' caracteres.' };
    }

    invalidarEscolas_();
    const jaExiste = escolaPorInep_(inep);
    if (!jaExiste) {
      /* v8.13 (C11): só na CRIAÇÃO. A escola já gravada com zero à esquerda
         continua endereçável, editável e inativável; o que não se pode é
         recriá-la com outra grafia. */
      if (!COD_ESCOLA_NOVO.test(inep)) {
        return { ok: false, erro: 'O código de uma escola nova não pode começar por zero. ' +
          'Se a escola já existe na base, abra-a pela lista para alterá-la.' };
      }
      const gemea = escolaComMesmoNumero_(inep);
      if (gemea) {
        return { ok: false, erro: 'Já existe a escola ' + gemea.escola + ', de código ' + gemea.inep +
          ' — é o mesmo número escrito de outro jeito. Abra-a pela lista para alterá-la.' };
      }
    }
    if (codigoInep) {
      const dono = escolaComMesmoCodigoInep_(codigoInep, inep);
      if (dono) {
        return { ok: false, erro: 'O código INEP ' + codigoInep + ' já pertence à escola ' +
          dono.escola + ' (código ' + dono.inep + ').' };
      }
    }
    /* A SRE da regional vem da sessão; a do Órgão Central, do formulário.
       Uma escola já cadastrada só muda de regional pelo Órgão Central: para
       a regional, mover a escola seria tirá-la do próprio alcance. */
    let sre = String(p.sre || '').trim();
    if (s.perfil === 'regional') {
      if (jaExiste && String(jaExiste.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
        return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
      }
      sre = String(s.sre || '');
    }
    if (!sre) return { ok: false, erro: 'Informe a Superintendência Regional de Ensino da escola.' };
    if (sre.length > ESCOLA_MAX_SRE) {
      return { ok: false, erro: 'O nome da Superintendência Regional de Ensino tem no máximo ' + ESCOLA_MAX_SRE + ' caracteres.' };
    }

    const situacao = (String(p.situacao || '').trim().toLowerCase() === 'inativa') ? 'inativa'
      : (jaExiste ? jaExiste.situacao : 'ativa');
    const aba = abaEscolas_();
    const reg = [inep, escola, municipio, sre, situacao,
                 codigoInep || (jaExiste ? jaExiste.codigoInep : '')];
    /* v8.13 (F07): nome de escola e município vêm colados de planilha */
    if (jaExiste) faixaDeTexto_(aba, jaExiste.linha, 1, 1, ESCOLA_COLS.length).setValues([reg]);
    else faixaDeTexto_(aba, aba.getLastRow() + 1, 1, 1, ESCOLA_COLS.length).setValues([reg]);
    invalidarEscolas_();
    /* v8.13 (C13) — A ESCOLA QUE MUDA DE SRE LEVA O CADASTRO JUNTO. Até aqui
       mover uma escola de regional trocava a SRE na aba Escolas e mais nada:
       o cadastro de acesso continuava na regional antiga, a trava de escopo
       usava a SRE gravada no cadastro, e a regional nova enxergava a escola
       sem poder agir. Propaga-se na ESCRITA o que é cadastro; o que é
       documento (registro já autenticado) resolve-se na LEITURA. */
    const mudouSre = !!(jaExiste && String(jaExiste.sre || '').toLowerCase() !== String(sre).toLowerCase());
    const mudouNome = !!(jaExiste && String(jaExiste.escola || '') !== escola);
    let acessosMovidos = 0, registrosMovidos = 0, periodosReabertos = 0;
    if (mudouSre || mudouNome) {
      const abaAc = abaAcessos_();
      const colSre = ACESSO_COLS.indexOf('SRE') + 1, colEsc = ACESSO_COLS.indexOf('Escola') + 1;
      acessosTodos_().filter(function (a) { return a.inep === inep; }).forEach(function (a) {
        const antesDaMudanca = Object.assign({}, a);
        /* v8.13 (F07): SRE e nome da escola são texto da rede */
        if (mudouSre) faixaDeTexto_(abaAc, a.linha, colSre, 1, 1).setValue(sre);
        if (mudouNome) faixaDeTexto_(abaAc, a.linha, colEsc, 1, 1).setValue(escola);
        acessosMovidos++;
        if (mudouSre) {
          /* o período de gestão acompanha a escola: é a SRE que responde por
             ela a partir de agora */
          const novoVinculo = { inep: inep, escola: escola, nome: a.nome, masp: a.masp, email: a.email,
            perfil: papelDe_(a) === 'colegiado' ? 'colegiado' : a.perfil, sre: sre, papel: papelDe_(a),
            observacao: papelDe_(a) === 'colegiado'
              ? observacaoColegiado_(a.segmento) : nomeDoPapel_(papelDe_(a)) };
          /* a chave do período não muda (a unidade é a mesma escola), mas a
             regional que responde por ela muda: o período anterior encerra e
             outro começa, para que cada SRE veja o seu */
          gestorRegistrar_(antesDaMudanca, novoVinculo, s.nome || s.email,
            'escola transferida de ' + (jaExiste.sre || '—') + ' para ' + sre, { fecharEAbrir: true });
          periodosReabertos++;
        }
      });
      invalidarAcessos_(); invalidarGestores_();
    }
    if (mudouSre) {
      /* os registros AINDA EM ELABORAÇÃO acompanham; os já concluídos não —
         a SRE gravada neles faz parte do que foi autenticado */
      const abaR = abaRegistros_();
      const linhasDaEscola = linhasOnde_(abaR, 'inep', inep, true);
      linhasDaEscola.forEach(function (l) {
        const v = lerLinhaChaves_(abaR, l, ['protocolo', 'status', 'inep', 'sre']);
        if (String(v.inep).replace(/\D/g, '') !== inep) return;
        if (emElaboracao_(v.status)) { gravarCampo_(abaR, l, 'sre', sre); registrosMovidos++; }
        if (String(v.status) !== ST_HOMOLOGADO_SRE) {
          registrarCiclo_(v.protocolo, 'escola transferida de regional', s.nome || s.email, rotuloSessao_(s),
            (jaExiste.sre || '—') + ' → ' + sre +
            (emElaboracao_(v.status) ? ' · o registro acompanha' : ' · a SRE gravada neste documento não muda'));
        }
      });
    }

    registrarHistorico_(sessao_(p.token).nome,
      jaExiste ? 'escola alterada na base' : 'escola cadastrada na base', inep,
      jaExiste ? [jaExiste.escola, jaExiste.municipio, jaExiste.sre].join(' · ') : '',
      [escola, municipio, sre].join(' · '));
    /* v8.13 (C12): homônimos entre municípios são legítimos e não se bloqueia
       o cadastro por isso — mas criar a segunda "EE Central" da mesma SRE é,
       quase sempre, um código digitado errado. O aviso é o lugar certo. */
    let aviso = '';
    if (!jaExiste) {
      const homonima = escolasTodas_().filter(function (e) {
        return e.inep !== inep && String(e.escola || '').trim().toLowerCase() === escola.toLowerCase() &&
               String(e.sre || '').toLowerCase() === String(sre).toLowerCase();
      })[0];
      if (homonima) {
        aviso = 'Já existe ' + homonima.escola + ' (código ' + homonima.inep + ') na mesma regional. ' +
          'Confira se o código desta é mesmo outro — duas escolas de mesmo nome na mesma SRE costumam ser o mesmo cadastro em duplicidade.';
      }
    }
    return { ok: true, criada: !jaExiste, inep: inep, aviso: aviso,
             mudouSre: mudouSre, acessosMovidos: acessosMovidos,
             registrosMovidos: registrosMovidos, periodosReabertos: periodosReabertos,
             escolas: escolasListar({ token: p.token }).escolas, sres: sresConhecidas_() };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/**
 * Baixa de escola. A linha nunca sai da base: a escola passa a "inativa" e
 * some dos cadastros de acesso, mas os PPPs que ela já produziu e o
 * histórico de quem a dirigiu continuam alcançáveis — é a mesma regra
 * adotada para gestores e acessos institucionais.
 */
function escolaSituacao(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const s = sessaoAssocia_(payload && payload.token);
    const p = payload || {};
    const inep = String(p.inep || '').replace(/\D/g, '');
    const base = escolaPorInep_(inep);
    if (!base) return { ok: false, erro: 'Escola não encontrada na base da rede.' };
    if (s.perfil === 'regional' && String(base.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
    }
    const situacao = (String(p.situacao || '').trim().toLowerCase() === 'ativa') ? 'ativa' : 'inativa';
    if (situacao === base.situacao) return { ok: false, erro: 'A escola já está marcada como ' + situacao + '.' };
    /* v8.7 (C4) — Inativar a escola apaga o cadastro do diretor e inativa o
       colegiado. Com um PPP em elaboração, ninguém mais pode assinar, anexar
       ata ou concluir — e a escola some da aba Cobertura, que só lista as
       ativas: o documento fica parado sem que nada aponte para ele. Acontece
       em nucleação, fusão e fechamento. Agora o sistema olha para o registro
       antes, e a inativação precisa ser confirmada; confirmada, a pendência
       fica registrada no ciclo do próprio PPP, à vista da SRE. */
    let pppAberto = null;
    if (situacao === 'inativa') {
      /* v8.13 (C09): a confirmação vale para qualquer PPP NÃO ENCERRADO, e o
         texto cita a situação real — antes dizia "em elaboração" sempre. */
      pppAberto = buscarPPPNaoEncerrado_(abaRegistros_(), inep);
      if (pppAberto && !p.confirmado) {
        const st = String(pppAberto.status || '').toLowerCase();
        const comoEsta = emElaboracao_(pppAberto.status)
          ? 'um PPP em elaboração (' + pppAberto.protocolo + ', ' + st + ', ' +
            (parseInt(pppAberto.pct, 10) || 0) + '% preenchido)'
          : 'um PPP ainda não encerrado (' + pppAberto.protocolo + ', ' + st + ')';
        return { ok: false, pppAberto: { protocolo: pppAberto.protocolo, status: pppAberto.status,
                   versao: pppAberto.versao || 1, pct: parseInt(pppAberto.pct, 10) || 0 },
          erro: 'Esta escola tem ' + comoEsta + '. Inativada a escola, o acesso da direção é encerrado e o ' +
                'colegiado é inativado: ninguém poderá assinar, anexar a ata nem concluir esse documento, ' +
                'e a escola sai da aba Cobertura. Confirme se ainda assim a escola deve ser inativada.' };
      }
    }
    const aba = abaEscolas_();
    /* a situação é a 5ª coluna — não a última, desde que o INEP entrou ao final */
    aba.getRange(base.linha, ESCOLA_COLS.indexOf('Situação') + 1).setValue(situacao);
    invalidarEscolas_();

    /* Inativar a escola encerra o acesso do DIRETOR em exercício: não faz
       sentido manter alguém respondendo por uma unidade fora da rede. O
       cadastro sai da aba de acessos — como em qualquer remoção —, mas o
       período fica registrado no histórico, com o motivo. O colegiado da
       escola não é gestor e não tem período: fica INATIVO no cadastro, sem
       sair dele, e sem entrar no histórico de gestores (v7.3, T-04). */
    let gestorEncerrado = '';
    let colegiadoInativado = 0;
    let colegiadoInativo = 0;
    let semDiretor = false;
    if (situacao === 'inativa') {
      const a = acessoPorInep_(inep);
      if (a) {
        gestorEncerrado = a.email;
        abaAcessos_().deleteRow(a.linha); invalidarAcessos_();
        gestorFechar_({ perfil: 'escola', inep: inep }, 'escola inativada na base da rede', s.nome || s.email);
      }
      colegiadoDaEscola_(inep).forEach(function (m) {
        if (String(m.situacao).toLowerCase() === 'inativo') return;
        abaAcessos_().getRange(m.linha, ACESSO_COLS.indexOf('Situação') + 1).setValue('inativo'); invalidarAcessos_();
        colegiadoInativado++;
      });
    } else {
      /* v8.13 (C09) — REATIVAR NÃO RESTAURA NINGUÉM. Trazer de volta membros
         de Colegiado meses depois, sem que a escola peça, é pior do que
         deixá-los inativos. O que muda é a honestidade da resposta: ela passa
         a dizer quantos continuam inativos e que a direção precisa ser
         reassociada antes que alguém possa assinar. */
      colegiadoInativo = colegiadoDaEscola_(inep)
        .filter(function (m) { return String(m.situacao).toLowerCase() === 'inativo'; }).length;
      semDiretor = !acessoPorInep_(inep);
      pppAberto = buscarPPPNaoEncerrado_(abaRegistros_(), inep);
    }
    registrarHistorico_(sessao_(p.token).nome, 'escola marcada como ' + situacao, inep,
      base.situacao, situacao + (gestorEncerrado ? ' · acesso de ' + gestorEncerrado + ' encerrado' : '') +
      (colegiadoInativado ? ' · ' + colegiadoInativado + ' membro(s) do colegiado inativado(s)' : '') +
      (pppAberto ? ' · PPP ' + pppAberto.protocolo + ' ficou em aberto' : ''));
    if (pppAberto) {                                    /* v8.7 (C4); v8.13 (C09) */
      registrarCiclo_(pppAberto.protocolo,
        situacao === 'inativa' ? 'escola inativada com o PPP em aberto' : 'escola reativada na base da rede',
        sessao_(p.token).nome, rotuloSessao_(sessao_(p.token)),
        'situação do PPP: ' + pppAberto.status + (situacao === 'inativa'
          ? ' · a direção e o colegiado perderam o acesso'
          : ' · a direção precisa ser reassociada' +
            (colegiadoInativo ? ' e ' + colegiadoInativo + ' membro(s) do colegiado continuam inativos' : '')));
    }
    return { ok: true, situacao: situacao, gestorEncerrado: gestorEncerrado,
             colegiadoInativado: colegiadoInativado,
             colegiadoInativo: colegiadoInativo, semDiretor: semDiretor,
             pppEmAberto: pppAberto ? pppAberto.protocolo : '',
             escolas: escolasListar({ token: p.token }).escolas };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   v8.13 (C10) — A CARGA DA BASE DE ESCOLAS, REFEITA

   Esta é a operação mais destrutiva do sistema e era a única sem simulação,
   sem chave e sem confirmação. Dentro dela conviviam seis defeitos: a
   segunda ocorrência do mesmo código caía no ramo de atualização com
   `linha: 0` e derrubava a carga inteira no Sheets, perdendo todas as
   escolas novas; a linha era montada inteira e sobrescrevia, de modo que uma
   reimportação de rotina REATIVAVA escolas dadas baixa e ZERAVA o código
   INEP de toda a rede; o código era normalizado com replace(/\D/g,'') ANTES
   de ser validado, e "31A12" virava 3112 e sobrescrevia outra escola —
   inclusive mudando-a de SRE — devolvendo erros: []; SRE e município eram
   opcionais, ao contrário do formulário, e escola sem SRE fica invisível
   para toda regional; e 3.600 escolas custavam 3.600 gravações em sequência.

   A forma passa a ser a mesma da carga de diretores — SIMULAR, depois
   IMPORTAR COM CHAVE — com três regras novas:
     · campo ausente PRESERVA o gravado (situação, INEP, município, SRE);
       situação 'ativa' só para escola NOVA;
     · VALIDAR ANTES DE NORMALIZAR: o campo do código só aceita dígitos e
       espaços; letra ou pontuação é erro de linha, nunca um código diferente;
     · código repetido no mesmo texto é erro de linha — com isso o
       getRange(0, …) deixa de existir por construção.
   E as gravações são em bloco: a faixa existente numa chamada, as novas
   noutra.
   ============================================================ */
/** A linha da planilha a partir de uma linha conferida. */
function linhaDaEscola_(r) {
  return [r.inep, r.escola, r.municipio, r.sre, r.situacao, r.codigoInep];
}
/**
 * Confere uma linha da carga da base. `atual` é o mapa código→escola gravada;
 * `vistos` guarda os códigos já vistos NESTE texto.
 */
function conferirEscola_(c, atual, vistos, linha) {
  const r = { linha: linha || 0, ok: false, motivo: '', inep: '', escola: '', municipio: '', sre: '',
              situacao: '', codigoInep: '', novo: false, mudaSre: false, voltaAtiva: false,
              ganhaInep: false, mudaInep: false };
  const bruto = String(c[0] == null ? '' : c[0]).trim();
  if (!bruto) { r.motivo = 'sem código da escola'; return r; }
  /* validar antes de normalizar: "31A12" não é a escola 3112 */
  if (!/^[\d\s]+$/.test(bruto)) { r.motivo = 'código da escola inválido'; return r; }
  const inep = bruto.replace(/\s+/g, '');
  if (!COD_ESCOLA.test(inep)) { r.motivo = 'código da escola inválido'; return r; }
  r.inep = inep;
  if (vistos.inep[inep]) { r.motivo = 'código repetido na carga (linha ' + vistos.inep[inep] + ')'; return r; }
  vistos.inep[inep] = r.linha;
  const gravada = atual[inep] || null;
  r.novo = !gravada;
  if (r.novo) {
    /* v8.13 (C11): escola NOVA não começa por zero, e não se cria a segunda
       grafia de um código que já existe */
    if (!COD_ESCOLA_NOVO.test(inep)) { r.motivo = 'código da escola não pode começar por zero'; return r; }
    const gemea = escolaComMesmoNumero_(inep);
    if (gemea) {
      r.motivo = 'já existe a escola de código ' + gemea.inep + ' — é o mesmo número escrito de outro jeito';
      return r;
    }
  }

  const nome = String(c[1] == null ? '' : c[1]).trim();
  if (nome) {
    if (nome.length < 4) { r.motivo = 'nome da escola muito curto'; return r; }
    if (nome.length > ESCOLA_MAX_NOME) { r.motivo = 'nome da escola acima de ' + ESCOLA_MAX_NOME + ' caracteres'; return r; }
  } else if (r.novo) { r.motivo = 'sem nome da escola'; return r; }
  r.escola = nome || gravada.escola;

  const municipio = String(c[2] == null ? '' : c[2]).trim();
  if (municipio && municipio.length > ESCOLA_MAX_MUNICIPIO) {
    r.motivo = 'município acima de ' + ESCOLA_MAX_MUNICIPIO + ' caracteres'; return r;
  }
  if (!municipio && r.novo) { r.motivo = 'sem município'; return r; }
  r.municipio = municipio || (gravada ? gravada.municipio : '');

  const sre = String(c[3] == null ? '' : c[3]).trim();
  if (sre && sre.length > ESCOLA_MAX_SRE) {
    r.motivo = 'SRE acima de ' + ESCOLA_MAX_SRE + ' caracteres'; return r;
  }
  if (!sre && r.novo) { r.motivo = 'sem Superintendência Regional de Ensino'; return r; }
  r.sre = sre || (gravada ? gravada.sre : '');

  /* O 5º campo é o código INEP, opcional. Cargas antigas, que traziam a
     situação nessa posição, continuam funcionando: "ativa"/"inativa" é
     reconhecido como situação, e não como um INEP mal digitado. */
  const quinto = String(c[4] == null ? '' : c[4]).trim();
  const ehSituacao = /^(ativa|inativa)$/i.test(quinto);
  if (ehSituacao) {
    r.situacao = quinto.toLowerCase();
  } else {
    /* campo ausente preserva o gravado; escola NOVA nasce ativa */
    r.situacao = gravada ? gravada.situacao : 'ativa';
    if (quinto) {
      if (!/^[\d\s.-]+$/.test(quinto)) { r.motivo = 'código INEP inválido'; return r; }
      const codigo = quinto.replace(/\D/g, '');
      if (codigo.length !== 8) { r.motivo = 'código INEP deve ter 8 dígitos'; return r; }
      r.codigoInep = codigo;
    }
  }
  if (!r.codigoInep) r.codigoInep = gravada ? gravada.codigoInep : '';
  /* v9.8 — POR QUE A CARGA NÃO EXIGE O INEP, E O FORMULÁRIO EXIGE.
     O código passou a ser obrigatório no cadastro de escola (escolaSalvar):
     da v9.8 em diante não se cria nem se altera escola sem ele. A CARGA DE
     IMPLANTAÇÃO é outro caso: a extração da rede que abre o sistema traz a
     coluna do INEP VAZIA nas 3.401 escolas, e recusar linha sem INEP aqui
     seria recusar a base inteira — o sistema não teria como ser implantado.
     A carga então aceita a linha sem o código e CONTA quantas entraram
     assim (`semInep` no resumo); a base de escolas marca cada uma delas e
     tem filtro próprio, e a regularização é feita pelo formulário, que
     exige. O dia em que a extração trouxer o INEP, a carga o grava. */
  if (r.codigoInep) {
    /* v8.13 (C11): o INEP serve para cruzar com o Censo — dois iguais não
       cruzam nada, e entravam sem uma palavra */
    const dono = escolaComMesmoCodigoInep_(r.codigoInep, inep);
    if (dono) {
      r.motivo = 'o código INEP ' + r.codigoInep + ' já pertence à escola ' + dono.escola + ' (código ' + dono.inep + ')';
      return r;
    }
  }
  if (gravada) {
    r.mudaSre = !!sre && String(sre).toLowerCase() !== String(gravada.sre || '').toLowerCase();
    r.voltaAtiva = String(gravada.situacao) === 'inativa' && r.situacao === 'ativa';
    r.ganhaInep = !gravada.codigoInep && !!r.codigoInep;
    r.mudaInep = !!gravada.codigoInep && !!r.codigoInep && gravada.codigoInep !== r.codigoInep;
  }
  r.ok = true;
  return r;
}
/**
 * Carga da base de escolas, privativa do Órgão Central. Duas fases: simular
 * (não grava, devolve o resumo e emite a chave) e importar (exige a chave).
 * Recebe linhas "código; escola; município; SRE" (ponto e vírgula, tabulação
 * ou vírgula) e faz upsert por código — reimportar corrige, não duplica.
 */
function escolasImportar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = payload || {};
    const s = sessaoCentral_(p.token);
    const linhas = linhasDaCarga_(p.texto).filter(function (l) {
      return !/^\s*(c[óo]digo|inep)\b/i.test(l.txt);      // cabeçalho colado junto
    });
    if (!linhas.length) {
      return { ok: false, erro: 'Cole ao menos uma linha, no formato código da escola; escola; município; SRE.' };
    }
    if (linhas.length > 5000) return { ok: false, erro: 'No máximo 5.000 linhas por carga. Divida o arquivo.' };
    const simular = p.simular !== false && p.simular !== 'false';
    if (!simular && !conferirChaveDeCarga_(s, p.chave, 'escolas', p.texto, 'escolas')) {
      return { ok: false, erro: 'Simule a carga antes de importar: a chave não corresponde ao texto conferido, ' +
        'é de outra sessão ou já venceu (ela vale 30 minutos). Simule de novo.' };
    }
    invalidarEscolas_();
    const gravadas = escolasTodas_();
    const atual = {};
    gravadas.forEach(function (e) { atual[e.inep] = e; });
    const vistos = { inep: {} };
    const itens = [], erros = [];
    let novas = 0, atualizadas = 0, mudamSre = 0, voltamAtivas = 0, ganhamInep = 0, mudamInep = 0;
    let semInep = 0;   /* v9.8: quantas entram sem o código INEP, a regularizar */
    linhas.forEach(function (l) {
      const r = conferirEscola_(l.c, atual, vistos, l.n);
      itens.push(r);
      if (!r.ok) { erros.push('linha ' + l.n + ': ' + r.motivo); return; }
      if (r.novo) novas++; else atualizadas++;
      if (r.mudaSre) mudamSre++;
      if (r.voltaAtiva) voltamAtivas++;
      if (r.ganhaInep) ganhamInep++;
      if (r.mudaInep) mudamInep++;
      if (!r.codigoInep) semInep++;   /* v9.8 */
    });
    const resumo = { total: linhas.length, incluidas: novas, atualizadas: atualizadas,
                     recusadas: itens.length - novas - atualizadas, mudamSre: mudamSre,
                     voltamAtivas: voltamAtivas, ganhamInep: ganhamInep, mudamInep: mudamInep,
                     /* v9.8: o tamanho da regularização que fica para depois */
                     semInep: semInep,
                     erros: erros.slice(0, 12), totalErros: erros.length };
    if (simular) {
      const chave = emitirChaveDeCarga_(s, 'escolas', p.texto, 'escolas');
      registrarHistorico_(s.nome || s.email, 'carga da base de escolas simulada', '—', '',
        linhas.length + ' linha(s): ' + novas + ' incluída(s), ' + atualizadas + ' atualizada(s), ' +
        resumo.recusadas + ' recusada(s), ' + mudamSre + ' muda(m) de SRE, ' + voltamAtivas + ' volta(m) a ativa');
      return Object.assign({ ok: true, simulacao: true, chave: chave,
        itens: itens.map(function (r) {
          return { linha: r.linha, ok: r.ok, motivo: r.motivo, inep: r.inep, escola: r.escola,
                   sre: r.sre, novo: r.novo, mudaSre: r.mudaSre, voltaAtiva: r.voltaAtiva }; }) }, resumo);
    }
    /* gravação em BLOCO: a faixa existente numa chamada, as novas noutra */
    const aba = abaEscolas_();
    const ultima = aba.getLastRow();
    const matriz = (ultima >= 2) ? aba.getRange(2, 1, ultima - 1, ESCOLA_COLS.length).getValues() : [];
    const acrescentar = [];
    let mexidas = 0;
    itens.forEach(function (r) {
      if (!r.ok) return;
      if (r.novo) { acrescentar.push(linhaDaEscola_(r)); return; }
      const e = atual[r.inep];
      if (e && e.linha >= 2 && (e.linha - 2) < matriz.length) { matriz[e.linha - 2] = linhaDaEscola_(r); mexidas++; }
      else acrescentar.push(linhaDaEscola_(r));   // não deveria acontecer; não se perde a linha
    });
    /* v8.13 (F07): a faixa inteira em texto ANTES das duas escritas — a carga
       traz 3.600 nomes de escola e de município vindos de outra planilha. */
    if (mexidas) faixaDeTexto_(aba, 2, 1, matriz.length, ESCOLA_COLS.length).setValues(matriz);
    if (acrescentar.length) {
      faixaDeTexto_(aba, ultima + 1, 1, acrescentar.length, ESCOLA_COLS.length).setValues(acrescentar);
    }
    invalidarEscolas_();
    registrarHistorico_(s.nome || s.email, 'base de escolas importada', '—', '',
      novas + ' incluída(s), ' + atualizadas + ' atualizada(s), ' + resumo.recusadas + ' recusada(s)' +
      (mudamSre ? ' · ' + mudamSre + ' mudou(aram) de SRE' : '') +
      (voltamAtivas ? ' · ' + voltamAtivas + ' voltou(aram) a ativa' : ''));
    consumirChaveDeCarga_(p.chave);
    return Object.assign({ ok: true, escolas: escolasListar({ token: p.token }).escolas,
                           sres: sresConhecidas_() }, resumo);
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}
/* ============================================================
   PAPÉIS E COMPETÊNCIAS (v7.0)

   Até a 6.16 o sistema tinha três perfis — central, regional e escola — e
   dentro da regional todo mundo podia tudo. A rede não funciona assim: quem
   cadastra a equipe de uma Superintendência é a própria Superintendência, em
   cascata, e nem todo mundo que enxerga o PPP pode agir sobre ele.

   O PERFIL continua sendo o escopo (o que a pessoa alcança: a rede, uma SRE,
   uma escola) e é o que as travas de escopo já existentes comparam. O PAPEL,
   acrescentado aqui, é a competência dentro daquele escopo: quem a pessoa
   pode cadastrar, se valida, se associa diretor, ou se apenas lê.

   A cascata de cadastro, de cima para baixo:
     Órgão Central  →  1 Superintendente por SRE (e a própria equipe central)
     Superintendente →  até 2 Diretores Educacionais e 1 Coordenador de Inspeção
     Diretor Educacional  →  a equipe da Diretoria Educacional (validadores)
     Coordenador de Inspeção →  a equipe da Coordenação de Inspeção (leitores)
     Direção Escolar →  os membros do Colegiado Escolar (assinam no sistema)
   ============================================================ */
const PAPEIS = {
  central: {
    perfil: 'central', nome: 'Órgão Central',
    cadastra: ['central', 'superintendente'], limite: 0
  },
  superintendente: {
    perfil: 'regional', nome: 'Superintendente Regional de Ensino',
    cadastra: ['diretor_educacional', 'coordenador_inspecao'], limite: 1
  },
  diretor_educacional: {
    perfil: 'regional', nome: 'Diretor Educacional',
    cadastra: ['equipe_de'], limite: 2      // o segundo é opcional: nem toda SRE tem dois
  },
  coordenador_inspecao: {
    perfil: 'regional', nome: 'Coordenador de Inspeção',
    cadastra: ['equipe_inspecao'], limite: 1
  },
  equipe_de: {
    perfil: 'regional', nome: 'Equipe da Diretoria Educacional',
    cadastra: [], limite: 0
  },
  equipe_inspecao: {
    perfil: 'regional', nome: 'Equipe da Coordenação de Inspeção',
    cadastra: [], limite: 0
  },
  diretor_escolar: {
    /* Um por escola — mas quem garante isso é a identidade do cadastro pelo
       INEP, não uma contagem: trocar de diretor reescreve o mesmo registro. */
    perfil: 'escola', nome: 'Direção Escolar',
    cadastra: ['colegiado'], limite: 0
  },
  colegiado: {
    perfil: 'escola', nome: 'Colegiado Escolar',
    cadastra: [], limite: 0
  }
};

/** Quem valida o PPP: a Diretoria Educacional e quem está acima dela. */
const PAPEIS_VALIDAM = ['central', 'superintendente', 'diretor_educacional', 'equipe_de'];
/** Quem associa o diretor à escola: os mesmos. A inspeção não associa. */
/* v9.7: quem gere os diretores escolares é a Diretoria Educacional e a sua
   equipe — nem o Órgão Central nem o Superintendente (decisão da
   coordenação: cada nível administra só o nível imediatamente abaixo). */
const PAPEIS_ASSOCIAM = ['diretor_educacional', 'equipe_de'];
/** Quem apenas lê: a Coordenação de Inspeção e sua equipe, e o colegiado. */
const PAPEIS_LEITURA = ['coordenador_inspecao', 'equipe_inspecao', 'colegiado'];

/** O papel de um cadastro. Linhas antigas, sem a coluna, derivam do perfil. */
function papelDe_(cad) {
  if (!cad) return '';
  const p = String(cad.papel || '').trim();
  if (p && PAPEIS[p]) return p;
  /* planilhas anteriores à 7.0: o perfil vira o papel de topo equivalente */
  if (cad.perfil === 'central') return 'central';
  if (cad.perfil === 'escola') return 'diretor_escolar';
  /* v8.13 (F06): o perfil 'colegiado' não é papel de topo de nada, e caía na
     queda abaixo — a linha de Colegiado passava a casar com a chefia
     regional. Hoje é inofensivo (as linhas de Colegiado são descartadas ANTES
     do filtro por papel, C02), e é por isso mesmo que é uma armadilha. */
  if (cad.perfil === 'colegiado') return 'colegiado';
  return 'superintendente';
}
function nomeDoPapel_(papel) {
  return (PAPEIS[papel] && PAPEIS[papel].nome) || papel || '—';
}
function podeValidar_(papel) { return PAPEIS_VALIDAM.indexOf(papel) >= 0; }
function podeAssociar_(papel) { return PAPEIS_ASSOCIAM.indexOf(papel) >= 0; }
/* v9.7: a BASE da rede (cadastro e situação das escolas) e a CARGA EM LOTE
   de diretores na implantação continuam com o Órgão Central — é ele quem
   recebe a base de 3.401 escolas e a carrega de uma vez. O dia a dia dos
   diretores (associar, corrigir, remover, contas a regularizar) é da
   Diretoria Educacional e da sua equipe, e só delas. */
function podeGerirBase_(papel) { return papel === 'central' || podeAssociar_(papel); }
function soLeitura_(papel) { return PAPEIS_LEITURA.indexOf(papel) >= 0; }
/** O papel de quem está na sessão. */
function papelDaSessao_(s) {
  if (!s) return '';
  if (s.papel && PAPEIS[s.papel]) return s.papel;
  return papelDe_({ papel: '', perfil: s.perfil });
}

/**
 * Quantos cadastros daquele papel já existem na unidade — é o que limita
 * o Superintendente a um por SRE e os Diretores Educacionais a dois.
 * A unidade é a SRE nos papéis regionais e o INEP nos escolares.
 */
function quantosNoPapel_(papel, sre, inep, menosEmail) {
  const alvo = String(menosEmail || '').toLowerCase();
  return acessosTodos_().filter(function (a) {
    if (papelDe_(a) !== papel) return false;
    if (a.email === alvo) return false;                       // alteração não conta como novo
    if (String(a.situacao).toLowerCase() === 'inativo') return false;   // suspenso não ocupa vaga (v7.3, T-12)
    if (PAPEIS[papel].perfil === 'escola') return a.inep === String(inep || '').replace(/\D/g, '');
    if (PAPEIS[papel].perfil === 'central') return true;
    return String(a.sre || '').toLowerCase() === String(sre || '').toLowerCase();
  }).length;
}

const SESSAO_HORAS = 4;

/* Colunas da aba "Acessos". Vale aqui a mesma regra da aba de registros:
   coluna nova entra SEMPRE ao final, para não desalinhar planilhas em uso. */
const ACESSO_COLS = ['E-mail', 'Nome', 'Perfil', 'SRE', 'Hash', 'Sal',
  'Situação', 'Criado em', 'Último acesso', 'Código INEP', 'Escola', 'MASP',
  /* v7.0 — papel dentro do perfil e o convite de primeiro acesso */
  'Papel', 'Token de acesso', 'Token expira em', 'Segmento',
  /* v7.8 (P7) — a versão do hash da senha (vazio = v1, uma passada; 2 = pepper + 5.000 passadas). AO FINAL. */
  'Versão do hash',
  /* v8.12 — a relação com a escola de quem entra no Colegiado Escolar sem
     ser servidor: de que estudante é responsável, que entidade representa.
     É o que permite conferir, dois anos depois, quem assinou o PPP e por
     quê. Fica vazia nos demais cadastros. AO FINAL. */
  'Relação com a escola'];
function abaAcessos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_ACESSOS);
  if (!aba) aba = ss.insertSheet(NOME_ABA_ACESSOS);
  const confA = conferirCabecalho_(aba, ACESSO_COLS, NOME_ABA_ACESSOS);   /* v8.13 (E03) */
  if (confA.vazia) {
    aba.getRange(1, 1, 1, ACESSO_COLS.length).setValues([ACESSO_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 260); aba.setColumnWidth(2, 220); aba.setColumnWidth(4, 180);
    aba.setColumnWidth(11, 260);
    aba.hideColumns(5, 2);
    /* v8.13 (F07): a aba nasce com as colunas em TEXTO PURO, como a de
       Registros desde D15 — nome de pessoa e nome de escola moram aqui. */
    try { aba.getRange(1, 1, aba.getMaxRows(), ACESSO_COLS.length).setNumberFormat('@'); } catch (e) {}
  } else if (confA.completar) {
    /* planilha criada antes do perfil de escola: acrescenta as colunas novas */
    const de = confA.de + 1;
    aba.getRange(1, de, 1, ACESSO_COLS.length - de + 1)
      .setValues([ACESSO_COLS.slice(de - 1)])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setColumnWidth(11, 260);
  }
  return aba;
}
/** Uma linha da aba Acessos como objeto (v7.5: também usada pelas buscas pontuais). */
function acessoDaLinha_(r, linha) {
  return { linha: linha, email: String(r[0]).trim().toLowerCase(), nome: r[1], perfil: r[2],
           sre: r[3], hash: r[4], sal: r[5], situacao: r[6] || 'ativo',
           criadoEm: r[7], ultimoAcesso: r[8],
           inep: String(r[9] || '').replace(/\D/g, ''), escola: r[10] || '',
           masp: String(r[11] || '').replace(/\D/g, ''),
           papel: String(r[12] || '').trim(), token: String(r[13] || '').trim(),
           tokenAte: r[14] || '', segmento: r[15] || '', hashVersao: String(r[16] || '').trim(),
           relacao: String(r[17] || '').trim() };
}
/* v7.5 (P2) — memorizado por execução. Com ~20.000 linhas (3.400 escolas,
   diretores e colegiados), um cadastro relia a aba sete ou oito vezes.
   Toda gravação na aba chama invalidarAcessos_(). */
let _acessosCache = null;
function invalidarAcessos_() { _acessosCache = null; }
function acessosTodos_() {
  if (_acessosCache) return _acessosCache;
  const aba = abaAcessos_();
  const n = aba.getLastRow();
  if (n < 2) { _acessosCache = []; return _acessosCache; }
  _acessosCache = aba.getRange(2, 1, n - 1, ACESSO_COLS.length).getDisplayValues()
    .map(function (r, i) { return acessoDaLinha_(r, i + 2); });
  return _acessosCache;
}
/** As linhas da aba Acessos em que a coluna `col` (1-based) é igual a `texto`. */
function acessosOnde_(col, texto) {
  const t = String(texto == null ? '' : texto).trim();
  const aba = abaAcessos_();
  const n = aba.getLastRow();
  if (!t || n < 2) return [];
  return aba.getRange(2, col, n - 1, 1).createTextFinder(t).matchEntireCell(true).findAll()
    .map(function (r) { return acessoDaLinha_(aba.getRange(r.getRow(), 1, 1, ACESSO_COLS.length).getDisplayValues()[0], r.getRow()); });
}
/** O cadastro de um e-mail. v7.5: localizado pela coluna do e-mail
    (createTextFinder), sem ler a aba — é o caminho de toda entrada no sistema. */
function acessoPorEmail_(email) {
  const alvo = String(email || '').trim().toLowerCase();
  if (!alvo) return null;
  if (_acessosCache) return _acessosCache.filter(function (a) { return a.email === alvo; })[0] || null;
  return acessosOnde_(1, alvo).filter(function (a) { return a.email === alvo; })[0] || null;
}

/* ---- sessão ----
   v7.8 (P7): a sessão é DESLIZANTE — cada chamada renova as SESSAO_HORAS de
   validade — até o teto absoluto de SESSAO_MAX_HORAS desde a entrada. "Sair"
   remove a sessão no servidor (sair). O CacheService continua sendo o
   guardião; a tela guarda o token em sessionStorage e, para quem tem conta
   do domínio, refaz a entrada sozinha quando a sessão expira. */
const SESSAO_MAX_HORAS = 12;
function criarSessao_(dados) {
  const token = Utilities.getUuid();
  const d = Object.assign({}, dados, { criadaEm: Date.now() });
  CacheService.getScriptCache().put('ses_' + token, JSON.stringify(d), SESSAO_HORAS * 3600);
  return token;
}
function sessao_(token) {
  const chave = 'ses_' + String(token || '');
  const cache = CacheService.getScriptCache();
  const bruto = cache.get(chave);
  if (!bruto) throw new Error('Sessão expirada. Entre novamente no sistema.');
  const s = JSON.parse(bruto);
  if (s.criadaEm && Date.now() - s.criadaEm > SESSAO_MAX_HORAS * 3600000) {
    cache.remove(chave);
    throw new Error('Sessão expirada: o acesso vale por no máximo ' + SESSAO_MAX_HORAS + ' horas seguidas. Entre novamente no sistema.');
  }
  /* renova a validade: quem está usando o sistema não é derrubado no meio */
  cache.put(chave, bruto, SESSAO_HORAS * 3600);
  conferirVinculoDaSessao_(s, chave, cache);   // v8.13 (C04)
  return s;
}
/**
 * v8.13 (C04) — A SESSÃO DEIXA DE SER UM SALVO-CONDUTO DE 12 HORAS.
 *
 * Até aqui a sessão vivia só no cache e nenhuma ação reconferia a aba
 * Acessos. Por isso a baixa da escola prometia, com estas palavras, que
 * "ninguém poderá assinar, anexar a ata nem concluir esse documento" e não
 * cumpria: com a sessão aberta, quem teve o cadastro APAGADO assinava pela
 * direção e quem foi marcado INATIVO assinava pelo Colegiado. O mesmo valia
 * para a remoção avulsa de um acesso e para a suspensão de um institucional.
 *
 * A reconferência fica AQUI, e não em cada ação: é o único lugar em que a
 * garantia é completa — qualquer ação futura já nasce protegida. E é barata:
 * acessoPorEmail_ localiza a linha pela coluna do e-mail (createTextFinder),
 * sem ler a aba, e _acessosCache memoriza por execução. A alternativa —
 * invalidar as sessões na baixa — foi descartada: o CacheService não permite
 * listar chaves, exigiria um índice paralelo, e não cobriria a remoção
 * avulsa, que é o mesmo problema.
 *
 * A situação da ESCOLA, que exige ler a base inteira, fica só nos caminhos
 * de ato (sessaoDirecao_ e assinarNoSistema): pôr uma leitura de 3.600
 * linhas em toda chamada custaria mais do que resolve.
 */
function conferirVinculoDaSessao_(s, chave, cache) {
  const email = String((s && s.email) || '').trim().toLowerCase();
  if (!email) return;
  const derrubar = function (msg) {
    try { cache.remove(chave); } catch (e) {}
    throw new Error(msg);
  };
  const cad = acessoPorEmail_(email);
  /* A PORTA DO ÓRGÃO CENTRAL NÃO É A ABA ACESSOS. Entra-se por senha
     institucional ou pela lista CURADORES, e a sessão guarda a conta que
     abriu o app — que pode ser de qualquer perfil (a curadoria registra o
     e-mail de quem entrou; na demonstração é o da direção). Sem cadastro
     CENTRAL para esse e-mail não há vínculo a reconferir: a autorização não
     veio da planilha. Havendo, ele manda. */
  if (s.perfil === 'central') {
    if (cad && papelDe_(cad) === 'central' && String(cad.situacao || '').toLowerCase() === 'inativo') {
      derrubar('Este acesso está inativo. Procure o Órgão Central.');
    }
    return;
  }
  if (!cad) derrubar('O seu acesso foi encerrado. Entre novamente no sistema.');
  if (String(cad.situacao || '').toLowerCase() === 'inativo') {
    derrubar('Este acesso está inativo. Procure ' +
      (cad.perfil === 'escola' ? 'a sua Superintendência Regional de Ensino.' : 'o Órgão Central.'));
  }
  /* o que identifica o VÍNCULO: papel, escola e regional. O nome não entra —
     entrarInstitucional grava `nome: cad.nome || cad.email`, e corrigir um
     nome não pode derrubar quem está trabalhando. */
  const igual = function (a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  };
  const mesmoInep = String(cad.inep || '').replace(/\D/g, '') === String(s.inep || '').replace(/\D/g, '');
  if (papelDe_(cad) !== papelDaSessao_(s) || !mesmoInep || !igual(cad.sre, s.sre)) {
    derrubar('O seu cadastro mudou desde que você entrou. Entre novamente no sistema.');
  }
}
/**
 * v8.13 (C04) — a escola saiu da rede: nenhum ato do documento continua.
 * Só os caminhos de ato passam por aqui; a consulta comum não paga a
 * leitura da base.
 */
function recusarEscolaInativa_(s) {
  const inep = String((s && s.inep) || '').replace(/\D/g, '');
  if (!inep) return;
  const base = escolaPorInep_(inep);
  if (base && String(base.situacao || 'ativa').toLowerCase() !== 'ativa') {
    throw new Error('Esta escola está marcada como ' + base.situacao + ' na base da rede: ' +
      'enquanto ela não for reativada, o PPP não recebe alteração nem assinatura.');
  }
}
/** Quanto falta da sessão: o teto absoluto, em ms; a tela avisa antes. */
function expiraEm_(s) {
  return s && s.criadaEm ? Math.max(0, s.criadaEm + SESSAO_MAX_HORAS * 3600000 - Date.now()) : SESSAO_HORAS * 3600000;
}
/** Sai: a sessão deixa de existir no servidor — não só na tela (v7.8, P7). */
function sair(payload) {
  const token = String(payload && payload.token || '');
  if (!token) return { ok: true };
  try {
    const bruto = CacheService.getScriptCache().get('ses_' + token);
    if (bruto) {
      const s = JSON.parse(bruto);
      registrarHistorico_(s.nome || s.email, 'saiu do sistema', '—', '', '');
    }
  } catch (e) {}
  CacheService.getScriptCache().remove('ses_' + token);
  return { ok: true };
}
/** A sessão ainda vale? (a tela pergunta ao reabrir com um token guardado) */
function sessaoValida(payload) {
  try {
    const s = sessao_(payload && payload.token);
    return { ok: true, perfil: s.perfil, papel: s.papel, nome: s.nome, email: s.email, sre: s.sre || '',
             inep: s.inep || '', escola: s.escola || '',
             censo: s.perfil === 'escola' ? ((escolaPorInep_(s.inep) || {}).codigoInep || '') : '',
             expiraEm: expiraEm_(s) };
  } catch (e) { return { ok: false, semSessao: true, erro: String(e.message || e) }; }
}
function sessaoCentral_(token) {
  const s = sessao_(token);
  if (s.perfil !== 'central') throw new Error('Esta ação é exclusiva do Órgão Central.');
  return s;
}
/** Central e Regional: quem pode cadastrar acessos de escola. */
function sessaoGestora_(token) {
  const s = sessao_(token);
  if (s.perfil !== 'central' && s.perfil !== 'regional') {
    throw new Error('Esta ação é exclusiva do Órgão Central e das Superintendências Regionais.');
  }
  return s;
}
/** Sessão de perfil escolar (direção OU colegiado), quando houver token. Devolve null sem token. */
function sessaoEscola_(token) {
  if (!token) return null;
  const s = sessao_(token);
  return s.perfil === 'escola' ? s : null;
}
/**
 * v7.3 (T-01) — Sessão de DIREÇÃO escolar, quando houver token. Devolve null
 * sem token; lança erro quando há sessão mas ela não é da direção (colegiado,
 * regional, central). Linhas antigas, sem papel, com perfil escola, contam
 * como direção — é o que papelDaSessao_ já faz.
 */
const ERRO_SO_DIRECAO = 'Esta ação é da direção escolar. O seu acesso permite ler o PPP e assinar, não alterá-lo.';
function sessaoDirecao_(token) {
  if (!token) return null;
  const s = sessao_(token);
  if (s.perfil !== 'escola' || papelDaSessao_(s) !== 'diretor_escolar') throw new Error(ERRO_SO_DIRECAO);
  recusarEscolaInativa_(s);   // v8.13 (C04)
  return s;
}
/** O registro pertence à escola da sessão? Compara pelo código INEP. */
function mesmaEscola_(sessao, inepRegistro) {
  const a = String(sessao && sessao.inep || '').replace(/\D/g, '');
  const b = String(inepRegistro || '').replace(/\D/g, '');
  return !!a && a === b;
}

/**
 * Entrada dos perfis institucionais (Órgão Central e Regional).
 * Aceita, nesta ordem: cadastro na aba "Acessos"; senha institucional do
 * Órgão Central; e-mail identificado na lista CURADORES.
 */
function entrarInstitucional(payload) {
  const p = payload || {};
  const email = String(p.email || '').trim().toLowerCase();
  const senha = String(p.senha || '');
  const props = PropertiesService.getScriptProperties();

  /* O bloqueio por tentativas é POR E-MAIL, não da rede inteira. Até a 7.2
     um único contador global fazia cinco senhas erradas de qualquer pessoa
     bloquearem por quinze minutos a entrada por senha de todo mundo — e
     qualquer login certo zerava o contador de todos. Agora cada endereço
     tem o seu, no CacheService, que expira sozinho. */
  const chaveTent = 'tent_' + (email || 'sem-email');
  const cache = CacheService.getScriptCache();
  let tent = {};
  try { tent = JSON.parse(cache.get(chaveTent) || '{}'); } catch (e) { tent = {}; }
  if (tent.ate && Date.now() < tent.ate) {
    return { ok: false, erro: 'Muitas tentativas seguidas para este e-mail. Tente novamente em ' +
      Math.ceil((tent.ate - Date.now()) / 60000) + ' minuto(s).' };
  }
  const recusar = function (msg) {
    const n = (tent.n || 0) + 1;
    cache.put(chaveTent, JSON.stringify({ n: n, ate: n >= CUR_MAX_TENTATIVAS ? Date.now() + 15 * 60000 : 0 }), 15 * 60);
    registrarHistorico_(email || 'não identificado', 'acesso institucional recusado', '—', '', '');
    return { ok: false, erro: n >= CUR_MAX_TENTATIVAS ? msg + ' O acesso deste e-mail fica bloqueado por 15 minutos.' : msg };
  };

  /* A identidade vem da conta institucional com que o app foi aberto; o
     e-mail enviado pela tela só é aceito quando o app não consegue
     identificar ninguém (implantação fora do padrão) e há senha de arranque. */
  const identificadoAgora = usuarioAtual_();
  const alvo = identificadoAgora || email;
  const cad = acessoPorEmail_(alvo);
  if (cad) {
    if (String(cad.situacao).toLowerCase() === 'inativo') {
      return { ok: false, erro: 'Este acesso está inativo. Procure ' +
        (cad.perfil === 'escola' ? 'a sua Superintendência Regional de Ensino.' : 'o Órgão Central.') };
    }
    if (cad.perfil === 'escola' && !cad.inep) {
      return { ok: false, erro: 'Este acesso ainda não está vinculado a uma escola. Procure a sua Superintendência Regional de Ensino.' };
    }
    if (!identificadoAgora) {
      /* Sem identificação pela conta institucional vale a senha definida no
         primeiro acesso. Os dois caminhos convivem: quem tem conta entra sem
         digitar nada; quem não tem — membros de colegiado, por exemplo —
         entra por e-mail e senha. */
      if (!cad.hash) {
        return { ok: false, semSenha: true, erro: cad.token
          ? 'Você ainda não definiu a sua senha. Use o link de primeiro acesso que foi enviado para ' + cad.email + '.'
          : 'Este acesso ainda não tem senha definida. Peça um novo convite de primeiro acesso a quem fez o seu cadastro.' };
      }
      if (!senhaConfere_(cad, senha)) return recusar('E-mail ou senha incorretos.');
    }
    const papelCad = papelDe_(cad);
    /* v7.4 — o Colegiado Escolar tem entrada própria na abertura: pela
       porta da direção não entra membro do colegiado, e pela porta do
       colegiado não entra ninguém de outro papel. A porta não muda o que a
       pessoa pode (isso é o cadastro): só evita a entrada pelo lugar
       errado — e a sessão nem chega a ser criada. */
    const porta = String(p.porta || '').toLowerCase();
    if (porta === 'colegiado' && papelCad !== 'colegiado') {
      return { ok: false, erro: 'A entrada "Colegiado Escolar" é só para os membros do Colegiado. Volte e use a entrada do seu perfil.' };
    }
    if (porta === 'escola' && papelCad === 'colegiado') {
      return { ok: false, erro: 'Este e-mail é de membro do Colegiado Escolar. Volte e use a entrada "Colegiado Escolar".' };
    }
    abaAcessos_().getRange(cad.linha, 9).setValue(agora_()); invalidarAcessos_();
    cache.remove(chaveTent);
    const token = criarSessao_({ email: cad.email, nome: cad.nome || cad.email, perfil: cad.perfil,
                                 papel: papelCad, sre: cad.sre, inep: cad.inep || '',
                                 escola: cad.escola || '' });
    registrarHistorico_(cad.nome || cad.email, 'entrou como ' + nomeDoPapel_(papelCad) +
      (cad.perfil === 'escola' ? ' · ' + cad.escola : (cad.sre ? ' · ' + cad.sre : '')), '—', '', '');
    return { ok: true, token: token, perfil: cad.perfil, papel: papelCad,
             papelNome: nomeDoPapel_(papelCad), sre: cad.sre, nome: cad.nome || cad.email,
             email: cad.email, masp: cad.masp || '',
             inep: cad.inep || '', escola: cad.escola || '',
             /* v9.8: o INEP do Censo, para a identificação já nascer completa */
             censo: cad.perfil === 'escola' ? ((escolaPorInep_(cad.inep) || {}).codigoInep || '') : '',
             podeValidar: podeValidar_(papelCad), podeAssociar: podeAssociar_(papelCad),
             soLeitura: soLeitura_(papelCad),
             cadastra: (PAPEIS[papelCad] || {cadastra:[]}).cadastra };
  }

  /* ============================================================
     v8.4 — A PORTA DO ÓRGÃO CENTRAL

     Até a 8.3, a conferência da lista CURADORES só rodava quando o Google
     identificava a pessoa. Com "Executar como: eu", quem abre o app de uma
     conta de FORA do domínio não é identificado — e, por isso, a conferência
     era pulada: a senha institucional sozinha abria sessão de Órgão Central,
     com acesso de leitura à rede inteira e poder de validar, homologar,
     associar diretores e editar os textos do sistema. Ao mesmo tempo, um
     servidor do domínio fora da lista era recusado. O controle estava
     invertido: barrava quem era de dentro e deixava passar quem era de fora.

     Agora a regra é a mesma para os dois casos: com a lista preenchida, só
     entra quem está nela — identificado pela conta ou pelo e-mail digitado.
     Com a lista vazia (implantação recém-feita), só entra quem é do domínio,
     e a resposta diz o que falta configurar.

     O contador de tentativas desta porta também mudou. Ele era chaveado pelo
     e-mail que a própria tela mandava: bastava variar o e-mail a cada
     tentativa para nunca ser bloqueado. A senha é uma só, compartilhada, e
     portanto o contador dela é um só, guardado nas propriedades do script —
     como o da curadoria (PROP_TENT) sempre foi.
     ============================================================ */
  const hash = props.getProperty(PROP_HASH), sal = props.getProperty(PROP_SAL);
  const identificado = identificadoAgora;
  const candidato = identificado || email;

  let tentCentral = {};
  try { tentCentral = JSON.parse(props.getProperty(PROP_TENT_CENTRAL) || '{}'); } catch (e) { tentCentral = {}; }
  if (tentCentral.ate && Date.now() < tentCentral.ate) {
    return { ok: false, erro: 'Muitas tentativas seguidas na entrada do Órgão Central. Tente novamente em ' +
      Math.ceil((tentCentral.ate - Date.now()) / 60000) + ' minuto(s).' };
  }
  const recusarCentral = function (msg) {
    const n = (tentCentral.n || 0) + 1;
    props.setProperty(PROP_TENT_CENTRAL,
      JSON.stringify({ n: n, ate: n >= CUR_MAX_TENTATIVAS ? Date.now() + 15 * 60000 : 0 }));
    registrarHistorico_(candidato || 'não identificado', 'entrada do Órgão Central recusada', '—', '',
      identificado ? 'conta identificada' : 'sem conta identificada · e-mail digitado: ' + (email || '—'));
    return { ok: false, erro: n >= CUR_MAX_TENTATIVAS
      ? msg + ' A entrada do Órgão Central fica bloqueada por 15 minutos.' : msg };
  };
  /* Identificado, mas sem cadastro e sem ser curador: não é caso de senha —
     é caso de pedir o cadastro a quem o mantém. */
  if (identificado && !ehCurador_(identificado) && !hash) {
    return { ok: false, erro: 'O e-mail ' + identificado + ' não está cadastrado no sistema. ' +
      'A direção escolar é cadastrada pela sua Superintendência Regional de Ensino; ' +
      'as equipes das regionais, pelo Órgão Central.' };
  }
  if (identificado && !ehCurador_(identificado) && hash && !senha) {
    return { ok: false, erro: 'O e-mail ' + identificado + ' não está cadastrado no sistema. ' +
      'A direção escolar é cadastrada pela sua Superintendência Regional de Ensino; ' +
      'as equipes das regionais, pelo Órgão Central.' };
  }
  const nome = String(p.nome || '').trim(), masp = String(p.masp || '').trim();
  const podeSemSenha = !hash && ehCurador_(identificado);

  if (!hash && !podeSemSenha) {
    return { ok: false, erro: 'Os acessos institucionais ainda não foram configurados. A equipe responsável ' +
      'deve definir a senha institucional pelo menu da planilha (Gerador de PPP → Definir senha institucional).' };
  }
  if (hash && !senhaCuradoriaConfere_(senha)) return recusarCentral('E-mail ou senha incorretos.');
  /* v8.4 — a lista vale para quem é identificado E para quem não é */
  if (hash && CURADORES.length) {
    if (!candidato) return recusarCentral('Informe o e-mail institucional do Órgão Central.');
    if (!ehCurador_(candidato)) return recusarCentral('Este e-mail não consta na lista de acessos do Órgão Central.');
  }
  if (hash && !CURADORES.length && !identificado) {
    return { ok: false, erro: 'A entrada do Órgão Central por senha exige a conta institucional. ' +
      'Se este acesso precisa ser feito de uma conta de fora do domínio, a equipe responsável deve incluir ' +
      'o endereço na lista CURADORES, no topo do Code.gs.' };
  }
  const autor = identificado || (nome + (masp ? ' · MASP ' + masp : ''));
  if (!identificado && nome.length < 3) return { ok: false, erro: 'Informe o nome do responsável pelo acesso.' };
  cache.remove(chaveTent);
  props.deleteProperty(PROP_TENT_CENTRAL);
  const token = criarSessao_({ email: identificado || email, nome: autor, perfil: 'central',
                              papel: 'central', sre: '' });
  /* v8.4 — toda entrada como Órgão Central fica registrada com a origem, e os
     curadores são avisados quando ela acontece sem conta identificada. */
  registrarHistorico_(autor, 'entrou como Órgão Central', '—', '',
    identificado ? 'conta institucional identificada' : 'por senha, sem conta identificada');
  if (!identificado) { try { avisarEntradaCentral_(autor, email); } catch (e) {} }
  return { ok: true, token: token, perfil: 'central', papel: 'central',
           papelNome: nomeDoPapel_('central'), sre: '', nome: autor,
           email: identificado || email,
           podeValidar: true, podeAssociar: true, soLeitura: false,
           cadastra: PAPEIS.central.cadastra };
}

/* ---- painel de acompanhamento dos perfis institucionais ---- */
/* v8.13 (D14/A4-07): `tPrincipios` — o texto da seção 3 — é obrigatório na
   tela e não estava aqui, de modo que o "% preenchido" mostrado à SRE o
   ignorava: um PPP sem a seção 3 podia aparecer como 100%.
   AO ATUALIZAR UMA BASE EM USO: o denominador passa de 36 para 37 e o
   percentual de TODA linha já gravada cai cerca de 3 pontos. É previsto e se
   resolve sozinho — a próxima gravação recalcula, e recalcularPercentuais_()
   refaz a base inteira. */
const OBRIG_PAINEL = ['escola','inep','municipio','especialista','etapas','mods','infra','temas',
  'principios','metodos','indicadores','tApresentacao','tHistorico','tComunidade','tEstudantes',
  'tEtapas','tModalidades','tInfraestrutura','tDiagnostico','tPrincipios','tMissao','tObjetivos','tCurriculo',
  'tTemas','tMetodologias','tAvaliacao','tInclusiva','tEtnico','tDigital','tProtagonismo','tFamilia',
  'tFormacao','tGestao','tProjetos','tPlanoAcao','tAcompanhamento','aprovacao'];

/** Converte "dd/MM/aaaa HH:mm" em Date; devolve null quando não reconhece. */
function dataDe_(txt) {
  const m = String(txt || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2], ano = +m[3];
  const d = new Date(ano, mes - 1, dia);
  /* v8.13 (D08): 99/99/9999 e 31/02 NÃO são datas. O construtor de Date as
     aceita transbordando para outro mês, e era por isso que uma homologação
     gravada com data impossível ficava desfazível para sempre: `diasDesde_`
     devolvia 0 (data no futuro) em vez de dizer que não reconhecia. A
     conferência de volta — dia, mês e ano iguais aos informados — é o que
     separa uma data de uma sequência de dígitos. */
  if (d.getDate() !== dia || d.getMonth() !== mes - 1 || d.getFullYear() !== ano) return null;
  return d;
}
/**
 * v8.13 (D08) — A data de uma reunião que já aconteceu: dd/mm/aaaa, não
 * anterior a 01/01/2000 e não posterior a hoje. A conferência de volta
 * (dia/mês/ano iguais aos informados) é o que apanha 31/02 e 99/99/9999,
 * que o construtor de Date aceita transbordando para outro mês.
 */
function dataDeReuniaoValida_(txt) {
  const bruto = String(txt == null ? '' : txt).trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(bruto)) return false;   /* a data inteira, e só ela */
  const d = dataDe_(bruto);
  if (!d) return false;
  if (d < new Date(2000, 0, 1)) return false;
  const hoje = new Date();
  if (d > new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) return false;
  return true;
}

/** Revisão vencida: art. 7º, parágrafo único, da resolução pedagógica vigente — no máximo a cada dois anos. */
const MESES_REVISAO = 24;
/* v8.13 (E10): a função NÃO mudou — o que mudou é QUEM entra na conta. Ela
   responde por uma linha; a decisão de qual linha é a vigente da escola é de
   painelRegistros, com a mesma regra da Cobertura. */
function revisaoVencida_(reg) {
  /* v7.9 (P9): a data que vale é a da homologação registrada pela SRE; sem
     ela, a do envio declarado pela escola; sem nenhuma, a da conclusão */
  const base = dataDe_(reg.homolEm) || dataDe_(reg.homolData) || dataDe_(reg.concluidoEm);
  if (!base) return false;
  const limite = new Date(base.getTime());
  limite.setMonth(limite.getMonth() + MESES_REVISAO);
  return new Date() > limite;
}

/** As colunas que o painel lê — nenhuma de texto livre (v7.5, P2). */
const CHAVES_PAINEL = ['protocolo', 'versao', 'status', 'email', 'atualizadoEm', 'concluidoEm', 'assinaturas',
  'escola', 'inep', 'municipio', 'sre', 'ataUrl', 'homolData', 'pdfUrl', 'pdfId', 'pct',
  'enviadoValidacaoEm', 'validadoPor', 'validadoEm', 'parecerValidacao', 'devolucoes',
  'homolPor', 'homolEm', 'homolAto'];

/* ============================================================
   v8.13 (E11, A7-09) — A BUSCA NÃO DERRUBA O RESUMO, E A LISTA TEM TETO.

   A v8.8 (B2) resume no servidor porque o Órgão Central recebia as 3.400
   linhas a cada abertura do painel. Mas a condição do resumo caía com
   QUALQUER busca não vazia, e a tela dispara a cada 350 ms de digitação: quem
   digita "Escola Estadual X" atravessa "E", "Es", "Esc" — e a primeira letra
   já pedia a rede inteira (5.130 KB contra 10 KB do resumo).

   Três travas independentes:
   1. BUSCA_MINIMA caracteres, conferidos no SERVIDOR — o escopo e o custo de
      uma resposta não podem depender do que a tela resolve disparar.
   2. PAINEL_MAX_LINHAS linhas por resposta, cortadas DEPOIS da ordenação
      (senão "as 500 primeiras" seriam arbitrárias), com `truncado`, `total` e
      as contagens do conjunto INTEIRO — os cartões do resumo contam sobre o
      que foi filtrado, nunca sobre o pedaço que coube.
   3. Parecer de validação e devoluções existem para a ESCOLA ler o que a
      Diretoria Educacional pediu (v7.3, T-07). Deixam de viajar quando a
      resposta é do Órgão Central sem regional escolhida — quem vai ao caso
      concreto já escolheu SRE ou buscou. Regional e escola continuam
      recebendo tudo.
   ============================================================ */
const PAINEL_MAX_LINHAS = 500;
const BUSCA_MINIMA = 3;

function painelRegistros(payload) {
  const s = sessao_(payload && payload.token);
  const f = (payload && payload.filtros) || {};
  const aba = abaRegistros_();
  const ultima = aba.getLastRow();
  if (ultima < 2) return { ok: true, perfil: s.perfil, sre: s.sre, linhas: [], sres: [] };
  /* v7.5 (P2): linhas anteriores à 7.5 sem "% preenchido" são completadas
     uma única vez; depois o painel lê só as faixas de colunas que usa */
  garantirPercentuais_(aba);
  const vals = lerColunas_(aba, CHAVES_PAINEL);
  const sreDaSessao = (s.perfil === 'regional') ? String(s.sre || '').toLowerCase() : '';
  const inepDaSessao = (s.perfil === 'escola') ? String(s.inep || '').replace(/\D/g, '') : '';
  /* o colegiado vê os PPPs da sua escola, mas nunca como editáveis (T-01) */
  const podeEditar = (s.perfil !== 'escola') || papelDaSessao_(s) === 'diretor_escolar';
  /* v8.13 (E11): busca curta é IGNORADA aqui, não só na tela. `buscaIgnorada`
     sai na resposta para que o painel possa dizer por que nada mudou. */
  const buscaBruta = String(f.busca || '').trim();
  const busca = (buscaBruta.length >= BUSCA_MINIMA) ? buscaBruta.toLowerCase() : '';
  const buscaIgnorada = (buscaBruta.length > 0) && !busca;
  const sres = {};
  const linhas = [];
  /* v7.4 (P3) — para a regional e o Central, cada linha diz se o registro é
     ÓRFÃO: o e-mail do responsável não corresponde a nenhuma direção da
     escola — nem à atual, nem às do histórico de gestores. É o PPP criado
     antes do cadastro (pelo antigo "abrir por protocolo"), que a regional
     pode vincular à escola (adotarPPP), entregando-o à direção em exercício. */
  /* v8.8 (B2) — O Órgão Central recebia as 3.400 linhas a cada abertura do
     painel, com parecer de validação e devoluções dentro, e montava o quadro
     das regionais no navegador. Sem regional escolhida, o servidor devolve
     agora só o resumo por SRE: as linhas vêm quando ele escolhe uma. Basta
     qualquer filtro — regional, situação, busca ou "revisões vencidas" —
     para o painel voltar a trazer as linhas. */
  const resumir = (s.perfil === 'central') && !f.sre && !f.status && !f.vencidas && !busca && !f.todas;
  const resumo = {};
  const somar = function (sre, v, vencida) {
    const k = sre || SEM_SRE;
    const c = resumo[k] || (resumo[k] = { sre: k, total: 0, emAndamento: 0, emValidacao: 0, validado: 0,
      emAssinatura: 0, concluido: 0, enviadoHomologacao: 0, homologado: 0, vencidas: 0, escolas: 0,
      esperaMaisAntiga: 0 });
    c.total++;
    if (vencida) c.vencidas++;
    if (v.status === ST_ANDAMENTO) c.emAndamento++;
    else if (v.status === ST_VALIDACAO) {
      c.emValidacao++;
      const d = diasDesde_(v.enviadoValidacaoEm || v.atualizadoEm);
      if (d !== null && d > c.esperaMaisAntiga) c.esperaMaisAntiga = d;
    }
    else if (v.status === ST_VALIDADO) c.validado++;
    else if (v.status === ST_ASSINATURA || v.status === ST_ASSINADO) c.emAssinatura++;
    else if (v.status === ST_CONCLUIDO) c.concluido++;
    else if (v.status === ST_HOMOLOGADO) c.enviadoHomologacao++;
    else if (v.status === ST_HOMOLOGADO_SRE) c.homologado++;
  };
  const escolasVistas = {};
  const donos = (s.perfil === 'escola' || resumir) ? null : donosPorEscola_();
  /* v8.13 (E11, A7-09): parecer e devoluções só onde são LIDOS. O Órgão
     Central sem regional escolhida está olhando a rede, não o caso concreto —
     e é a resposta que mais pesa. */
  const detalhar = !(s.perfil === 'central' && !f.sre);
  /* ============================================================
     v8.13 (E10, A7-07) — REVISÃO VENCIDA É DA VERSÃO VIGENTE, E SÓ DELA.

     `revisaoVencida_` era calculada LINHA A LINHA, e `novaVersao` mantém a
     linha anterior com o status e as datas antigos: uma escola com a v2
     homologada há 30 dias era acusada de revisão vencida por causa da v1, de
     2021. O filtro "Somente revisão vencida" devolvia documentos
     SUBSTITUÍDOS, e a aba Cobertura — que olha só a versão vigente
     (pppMaisRecentePorEscola_) — mostrava a mesma escola em dia. É a conta do
     art. 7º, parágrafo único: a que mais precisa estar certa.

     A vigente de cada escola é decidida com a MESMA regra da Cobertura (maior
     versão; empate, a última atualização), numa passada prévia sobre os
     valores JÁ LIDOS — sem uma leitura a mais da planilha. Registro sem INEP
     não agrupa e continua sendo avaliado sozinho.
     ============================================================ */
  const vigentes = {};
  vals.forEach(function (v) {
    const prot = String(v.protocolo || '').trim();
    const inepV = String(v.inep || '').replace(/\D/g, '');
    if (!prot || !inepV) return;
    const atual = vigentes[inepV];
    const versao = parseInt(v.versao, 10) || 1;
    if (!atual) { vigentes[inepV] = { protocolo: prot, versao: versao, atualizadoEm: v.atualizadoEm }; return; }
    const maior = versao > atual.versao ||
      (versao === atual.versao && (diasDesde_(v.atualizadoEm) !== null) &&
       (diasDesde_(atual.atualizadoEm) === null || diasDesde_(v.atualizadoEm) < diasDesde_(atual.atualizadoEm)));
    if (maior) vigentes[inepV] = { protocolo: prot, versao: versao, atualizadoEm: v.atualizadoEm };
  });
  const ehVigente = function (v) {
    const inepV = String(v.inep || '').replace(/\D/g, '');
    if (!inepV) return true;    /* registro sem escola: é avaliado sozinho */
    const vig = vigentes[inepV];
    return !vig || vig.protocolo === String(v.protocolo || '').trim();
  };
  /* v8.13 (C13) — A SRE DE UM REGISTRO É A DA ESCOLA, HOJE. Mover uma escola
     de regional trocava a SRE só na aba Escolas: a Cobertura agrupava pela
     base, o Painel filtrava pela SRE gravada no REGISTRO, e a regional nova
     enxergava e não podia agir enquanto a antiga podia agir e não enxergava.
     Os registros já autenticados NÃO são reescritos — a SRE gravada faz parte
     do que foi autenticado —; o que muda é de onde as telas de escopo leem.
     escolasTodas_() é memorizada por execução: é uma leitura a mais, não uma
     por linha. O escopo continua vindo da SESSÃO. */
  const sreDoRegistro = function (v) {
    const base = escolaPorInep_(v.inep);
    return (base && base.sre) ? base.sre : v.sre;
  };
  vals.forEach(function (v) {
    if (!String(v.protocolo || '').trim()) return;   // linha em branco não é registro
    const sre = sreDoRegistro(v);
    /* v8.13 (E10, A7-13): a relação das regionais é montada ANTES dos filtros
       de escopo, e servia para preencher um seletor que só existe no Órgão
       Central — de modo que a regional recebia a lista das 47 regionais com
       documento no sistema. Ela passa a ser montada só para quem tem o
       seletor. */
    if (s.perfil === 'central' && sre) sres[sre] = true;
    if (sreDaSessao && String(sre).toLowerCase() !== sreDaSessao) return;
    if (inepDaSessao && String(v.inep).replace(/\D/g, '') !== inepDaSessao) return;
    /* v8.13 (F08): o balde "(sem SRE)" é um valor de filtro, não um nome de
       regional que por acaso ninguém tem. O recorte por `sreDaSessao` já
       correu acima — escopo da sessão, nunca do payload. */
    if (f.sre) { if (f.sre === SEM_SRE ? !!sre : sre !== f.sre) return; }
    if (f.status && v.status !== f.status) return;
    /* v8.13 (E10, A7-14): a busca era feita sobre os quatro campos EMENDADOS
       por espaço, e o indexOf casava ATRAVÉS da emenda: "1 ppp" encontrava
       toda escola cujo nome termina em "1" seguida do protocolo. Quatro
       buscas independentes, uma por campo. */
    if (busca &&
        String(v.escola || '').toLowerCase().indexOf(busca) < 0 &&
        String(v.protocolo || '').toLowerCase().indexOf(busca) < 0 &&
        String(v.municipio || '').toLowerCase().indexOf(busca) < 0 &&
        String(v.inep || '').toLowerCase().indexOf(busca) < 0) return;
    let assinadas = 0, totalAssin = 0;
    try {
      const a = JSON.parse(v.assinaturas || '[]');
      totalAssin = a.length;
      assinadas = a.filter(function (x) { return !!x.assinadoEm; }).length;
    } catch (e) {}
    /* v10.0: nas linhas que oferecem homologar, QUEM ainda não assinou vai
       junto — é o que permite ao aviso nomear as pessoas no primeiro clique,
       sem uma ida a mais ao servidor. Só nessas linhas: a lista não tem o que
       fazer nas outras, e o painel da rede tem milhares. */
    const ofereceHomologar = podeValidar_(papelDaSessao_(s)) && s.perfil !== 'escola' &&
      (v.status === ST_CONCLUIDO || v.status === ST_HOMOLOGADO);
    const pendentesAssin = (ofereceHomologar && assinadas < totalAssin) ? pendentesDaFolha_(v) : [];
    const vencida = ehVigente(v) &&
      revisaoVencida_({ homolEm: v.homolEm, homolData: v.homolData, concluidoEm: v.concluidoEm });
    if (f.vencidas && !vencida) return;
    if (resumir) {                                  /* v8.8 (B2) */
      somar(sre, v, vencida);
      const chaveEsc = (sre || SEM_SRE) + '|' + String(v.inep || '');
      if (!escolasVistas[chaveEsc]) { escolasVistas[chaveEsc] = true; resumo[sre || SEM_SRE].escolas++; }
      return;
    }
    /* v7.3 (T-07) — o parecer da validação e as devoluções vão ao painel: é
       ali que a escola lê o que a Diretoria Educacional pediu.
       v8.13 (E11): só quando a resposta é de quem os lê (ver `detalhar`). */
    let devolucoes = [];
    if (detalhar) {
      try { devolucoes = JSON.parse(v.devolucoes || '[]'); } catch (e) { devolucoes = []; }
      if (!Array.isArray(devolucoes)) devolucoes = [];
    }
    const inepLinha = String(v.inep || '').replace(/\D/g, '');
    const orfao = donos ? !(donos[inepLinha] && donos[inepLinha][String(v.email || '').toLowerCase()]) : false;
    linhas.push({ revisaoVencida: vencida, editavel: podeEditar && v.status === ST_ANDAMENTO,
      emElaboracao: emElaboracao_(v.status),
      protocolo: v.protocolo, versao: v.versao || 1,
      escola: v.escola, inep: v.inep, municipio: v.municipio, sre: sre,
      /* v7.5 (P2): o percentual vem gravado pelo servidor */
      status: v.status, pct: parseInt(v.pct, 10) || 0,
      assinadas: assinadas, totalAssin: totalAssin,
      pendentesAssin: pendentesAssin,   /* v10.0 */
      ata: !!v.ataUrl, homolData: v.homolData || '',
      atualizadoEm: v.atualizadoEm,
      /* v7.4 (P1): nada de link direto do Drive — a tela pede o PDF ao app */
      temPdf: !!(v.pdfId || v.pdfUrl),
      orfao: orfao,
      enviadoValidacaoEm: v.enviadoValidacaoEm || '',
      validadoPor: v.validadoPor || '', validadoEm: v.validadoEm || '',
      parecerValidacao: detalhar ? (v.parecerValidacao || '') : '', devolucoes: devolucoes,
      /* v7.9 (P9): a homologação registrada pela SRE */
      homolPor: v.homolPor || '', homolEm: v.homolEm || '', homolAto: v.homolAto || '',
      podeHomologar: ofereceHomologar,
      /* v10.0: `podeDesfazerHomologacao` saiu. A homologação encerra o
         documento e não é desfeita — não há botão a oferecer, e o painel
         deixa de calcular a janela de dias que não existe mais. */
      definitivo: v.status === ST_HOMOLOGADO_SRE,
      homolEm: v.homolEm || '' });
  });
  if (s.perfil === 'escola') {
    /* na escola, o mais recente primeiro: a versão vigente fica no topo */
    linhas.sort(function (a, b) { return (b.versao || 1) - (a.versao || 1); });
  } else {
    linhas.sort(function (a, b) { return String(a.escola).localeCompare(String(b.escola), 'pt-BR'); });
  }
  const listaSres = Object.keys(sres).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  if (resumir) {
    const quadro = Object.keys(resumo).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); })
      .map(function (k) { return resumo[k]; });
    /* v8.13 (E10, A7-15): `esperaMaisAntiga` é um MÁXIMO, não uma parcela.
       Somá-la dava 261 + 110 + 49 = 420 dias de espera onde o certo é 261. A
       tela ainda não exibia esse total; o valor saía na resposta e apareceria
       errado assim que alguém o usasse. */
    const MAXIMOS = ['esperaMaisAntiga'];
    const totais = quadro.reduce(function (t, c) {
      Object.keys(c).forEach(function (k) {
        if (k === 'sre') return;
        if (MAXIMOS.indexOf(k) >= 0) t[k] = Math.max(t[k] || 0, c[k] || 0);
        else t[k] = (t[k] || 0) + c[k];
      });
      return t;
    }, {});
    return { ok: true, perfil: s.perfil, sre: s.sre, nome: s.nome, resumido: true,
             linhas: [], quadro: quadro, totais: totais, sres: listaSres,
             buscaIgnorada: buscaIgnorada,
             inep: s.inep || '', escola: s.escola || '' };
  }
  /* v8.13 (E11, A7-09): o corte vem DEPOIS da ordenação — "as 500 primeiras"
     precisa querer dizer alguma coisa. E os cartões do resumo passam a contar
     sobre o conjunto FILTRADO INTEIRO, não sobre o pedaço que coube: um painel
     truncado que diz "12 em validação" quando há 180 é pior do que um painel
     grande. A escola tem poucas linhas e nunca chega aqui. */
  const total = linhas.length;
  const truncado = total > PAINEL_MAX_LINHAS;
  let contagens = null;
  if (truncado) {
    contagens = { total: total, emAndamento: 0, emValidacao: 0, esperaMaisAntiga: 0,
                  emAssinatura: 0, aguardandoHomologacao: 0, homologados: 0, vencidas: 0 };
    linhas.forEach(function (x) {
      if (x.revisaoVencida) contagens.vencidas++;
      if (x.status === ST_ANDAMENTO) contagens.emAndamento++;
      else if (x.status === ST_VALIDACAO) {
        contagens.emValidacao++;
        const d = diasDesde_(x.enviadoValidacaoEm || x.atualizadoEm);
        if (d !== null && d > contagens.esperaMaisAntiga) contagens.esperaMaisAntiga = d;
      }
      else if (x.status === ST_ASSINATURA || x.status === ST_ASSINADO) contagens.emAssinatura++;
      else if (x.status === ST_CONCLUIDO || x.status === ST_HOMOLOGADO) contagens.aguardandoHomologacao++;
      else if (x.status === ST_HOMOLOGADO_SRE) contagens.homologados++;
    });
  }
  const resposta = { ok: true, perfil: s.perfil, sre: s.sre, nome: s.nome,
           linhas: truncado ? linhas.slice(0, PAINEL_MAX_LINHAS) : linhas,
           total: total, truncado: truncado, buscaIgnorada: buscaIgnorada,
           maximo: PAINEL_MAX_LINHAS,
           inep: s.inep || '', escola: s.escola || '',
           sres: listaSres };
  if (contagens) resposta.contagens = contagens;
  return resposta;
}


/* ============================================================
   COBERTURA POR REGIONAL E FILA DE VALIDAÇÃO (v7.7, P5)

   O painel lista PPPs; a cobertura lista ESCOLAS — inclusive as que
   ainda não começaram, que o painel não mostra. Para cada escola ativa:
   a situação do PPP mais recente (ou "Sem PPP"), há quantos dias está
   nela, e o diretor em exercício. Para o Órgão Central sem SRE escolhida,
   o quadro das regionais: uma linha por SRE com as contagens. É indicador
   de espera, não cronograma.
   ============================================================ */
const ST_SEM_PPP = 'Sem PPP';
/**
 * v8.13 (F08) — O RÓTULO DO BALDE É UM VALOR DE FILTRO RECONHECIDO.
 *
 * O resumo por regional agrupa sob "(sem SRE)" os registros e as escolas de
 * base migrada que não têm Superintendência gravada, e a tela devolvia esse
 * rótulo como se fosse NOME de regional: o quadro dizia "1 escola" e o
 * clique devolvia zero, sem caminho de conserto pela tela. A porta de
 * entrada já está fechada (a carga exige SRE desde C13), de modo que o
 * grupo tende a esvaziar — mas quem implanta sobre planilha em uso precisa
 * poder abri-lo. Uma constante em vez de cinco literais.
 */
const SEM_SRE = '(sem SRE)';
const CHAVES_COBERTURA = ['protocolo', 'versao', 'status', 'atualizadoEm', 'concluidoEm', 'escola', 'inep', 'sre',
                          'enviadoValidacaoEm', 'validadoEm', 'homolData', 'homolEm'];
function diasDesde_(txt) {
  const d = dataDe_(txt);
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
/** Desde quando o PPP está na situação atual — a data que marca a entrada nela. */
function desdeQuando_(r) {
  switch (r.status) {
    case ST_VALIDACAO:  return r.enviadoValidacaoEm || r.atualizadoEm;
    case ST_VALIDADO:   return r.validadoEm || r.atualizadoEm;
    case ST_ASSINATURA: case ST_ASSINADO: case ST_CONCLUIDO: return r.concluidoEm || r.atualizadoEm;
    case ST_HOMOLOGADO: return r.homolData || r.concluidoEm || r.atualizadoEm;
    case ST_HOMOLOGADO_SRE: return r.homolEm || r.homolData || r.atualizadoEm;
    default:            return r.atualizadoEm;
  }
}
/** O PPP "mais recente" de cada escola: a maior versão; empate, a última atualização. */
function pppMaisRecentePorEscola_(aba) {
  const por = {};
  lerColunas_(aba, CHAVES_COBERTURA).forEach(function (r) {
    if (!String(r.protocolo || '').trim()) return;
    const inep = String(r.inep || '').replace(/\D/g, '');
    if (!inep) return;
    const v = parseInt(r.versao, 10) || 1;
    const atual = por[inep];
    const dAt = dataDe_(r.atualizadoEm), dAtual = atual ? dataDe_(atual.atualizadoEm) : null;
    if (!atual || v > atual._v || (v === atual._v && dAt && (!dAtual || dAt > dAtual))) { r._v = v; por[inep] = r; }
  });
  return por;
}
function coberturaRegional(payload) {
  const p = payload || {};
  const s = sessao_(p.token);
  if (s.perfil === 'escola') return { ok: false, erro: 'A cobertura é da regional e do Órgão Central.' };
  const central = s.perfil === 'central';
  const sreAlvo = central ? String(p.sre || '').trim() : String(s.sre || '');
  const alvoL = sreAlvo.toLowerCase();
  /* v8.13 (F08): pedir "(sem SRE)" filtra as escolas SEM regional gravada.
     A regional não chega aqui com esse pedido: `sreAlvo` é forçado para a SRE
     da sessão quando o perfil não é central (linha acima). */
  const semSre = (sreAlvo === SEM_SRE);
  const escolas = escolasTodas_().filter(function (e) {
    if (e.situacao === 'inativa') return false;
    if (semSre) return !String(e.sre || '').trim();
    return !alvoL || String(e.sre || '').toLowerCase() === alvoL;
  });
  const por = pppMaisRecentePorEscola_(abaRegistros_());
  const diretores = {};
  acessosTodos_().forEach(function (a) {
    if (papelDe_(a) === 'diretor_escolar' && a.inep && String(a.situacao || 'ativo').toLowerCase() !== 'inativo') diretores[a.inep] = a;
  });
  const linhas = escolas.map(function (e) {
    const r = por[e.inep], d = diretores[e.inep];
    const desde = r ? desdeQuando_(r) : '';
    return { inep: e.inep, escola: e.escola, municipio: e.municipio, sre: e.sre,
             diretor: d ? (d.nome || d.email) : '', diretorEmail: d ? d.email : '', semDiretor: !d,
             status: r ? r.status : ST_SEM_PPP, protocolo: r ? r.protocolo : '', versao: r ? (parseInt(r.versao, 10) || 1) : 0,
             desde: desde, dias: r ? diasDesde_(desde) : null };
  });
  const contar = function (L) {
    const c = { escolas: L.length, semPPP: 0, emAndamento: 0, emValidacao: 0, validado: 0, emAssinatura: 0,
                concluido: 0, enviadoHomologacao: 0, homologado: 0, semDiretor: 0, esperaMaisAntiga: 0 };
    L.forEach(function (x) {
      if (x.semDiretor) c.semDiretor++;
      if (x.status === ST_SEM_PPP) c.semPPP++;
      else if (x.status === ST_ANDAMENTO) c.emAndamento++;
      else if (x.status === ST_VALIDACAO) { c.emValidacao++; if (x.dias != null && x.dias > c.esperaMaisAntiga) c.esperaMaisAntiga = x.dias; }
      else if (x.status === ST_VALIDADO) c.validado++;
      else if (x.status === ST_ASSINATURA || x.status === ST_ASSINADO) c.emAssinatura++;
      else if (x.status === ST_CONCLUIDO) c.concluido++;
      else if (x.status === ST_HOMOLOGADO) c.enviadoHomologacao++;     // declarado pela escola
      else if (x.status === ST_HOMOLOGADO_SRE) c.homologado++;         // registrado pela SRE (v7.9)
    });
    return c;
  };
  if (central && !alvoL && !semSre) {
    /* o quadro das regionais: uma linha por SRE */
    const porSre = {};
    linhas.forEach(function (x) { (porSre[x.sre || SEM_SRE] = porSre[x.sre || SEM_SRE] || []).push(x); });
    const quadro = Object.keys(porSre).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); })
      .map(function (sre) { const c = contar(porSre[sre]); c.sre = sre; return c; });
    return { ok: true, quadro: quadro, totais: contar(linhas), geradoEm: agora_() };
  }
  linhas.sort(function (a, b) { return String(a.escola).localeCompare(String(b.escola), 'pt-BR'); });
  return { ok: true, sre: sreAlvo, escolas: linhas, resumo: contar(linhas), geradoEm: agora_() };
}

/**
 * v7.4 (P3) — Quem já respondeu por cada escola: o diretor em exercício (aba
 * Acessos) e todos os que constam do histórico de gestores. Mapa
 * inep → { email: true }. É contra isso que o painel aponta registro órfão.
 */
function donosPorEscola_() {
  const m = {};
  const marca = function (inep, email) {
    const i = String(inep || '').replace(/\D/g, ''), e = String(email || '').toLowerCase();
    if (!i || !e) return;
    (m[i] = m[i] || {})[e] = true;
  };
  acessosTodos_().forEach(function (a) { if (papelDe_(a) === 'diretor_escolar') marca(a.inep, a.email); });
  gestoresTodos_().forEach(function (g) { if (g.perfil === 'escola') marca(g.inep, g.email); });
  return m;
}

/**
 * v7.4 (P3) — VÍNCULO de um PPP órfão com a sua escola. Registros criados
 * antes do cadastro (pelo antigo "abrir por protocolo", sem sessão) ficaram
 * com e-mail vazio ou de alguém que nunca foi diretor daquela escola, e às
 * vezes com o código da escola digitado à mão. Quem associa diretores na SRE
 * da escola grava no registro o e-mail do diretor em exercício e o código, o
 * nome e a SRE da base — e a direção passa a vê-lo no painel. `inep` é
 * opcional: serve para apontar a escola quando a do registro não está na base.
 *
 * v8.12 — A operação se chamava "adotar". O nome não dizia o que acontece, e
 * "associar", o candidato natural, já tem dono aqui: associar é pôr uma
 * PESSOA numa escola, no cadastro de acessos, e é o nome da competência que
 * autoriza esta mesma função. Quem é vinculado aqui é o DOCUMENTO. O nome da
 * função continua `adotarPPP` para não quebrar chamadas antigas.
 */
function adotarPPP(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = payload || {};
    const s = sessaoAssociaDiretores_(p.token);   /* v9.7 */
    const aba = abaRegistros_();
    const linha = linhaDoProtocolo_(aba, p.protocolo || p.p);
    if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
    const reg = lerLinha_(aba, linha);
    const inep = String(p.inep || reg.inep || '').replace(/\D/g, '');
    const base = escolaPorInep_(inep);
    if (!base) {
      return { ok: false, erro: 'A escola deste registro (código ' + (inep || 'em branco') +
        ') não está na base da rede. Informe o código da escola correta para vincular o PPP.' };
    }
    if (s.perfil === 'regional' && String(base.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
    }
    /* v8.13 (C12) — A PARTIR DA EMISSÃO DO CÓDIGO, A ESCOLA É PARTE DO QUE FOI
       AUTENTICADO. adotarPPP não conferia status em lugar nenhum: um registro
       já concluído, com documento congelado, PDF gerado e código de doze
       caracteres emitido, podia ser apontado para outra escola — e o mesmo
       código passava a responder outro nome de escola, enquanto o PDF baixado
       na mesma página continuava com o antigo. Um mecanismo de autenticidade
       que muda de resposta não autentica nada. A checagem vem ANTES de
       qualquer gravação. */
    const negaHomAdot = recusaSeHomologado_(reg);   /* v10.0 */
    if (negaHomAdot) return negaHomAdot;
    if (ST_COM_CODIGO.indexOf(reg.status) >= 0) {
      return { ok: false, erro: 'Este PPP já foi concluído e tem código de autenticidade (' +
        (reg.hash || '—') + '): a escola faz parte do que foi autenticado e não muda. ' +
        'Para corrigir, inicie uma nova versão.' };
    }
    /* v8.13 (C12): a trava de transferência passa a olhar a SITUAÇÃO da escola
       de origem. Transferir entre duas escolas ATIVAS continua proibido — é a
       regra que importa. Quando a de origem está INATIVA, a transferência é,
       por definição, correção administrativa, feita por quem já tem a
       competência de associar: era exatamente o roteiro que a própria tela
       mandava seguir ("cadastre a escola certa e inative esta") e que deixava
       o documento preso. */
    const origem = (p.inep && reg.inep && String(reg.inep).replace(/\D/g, '') !== inep)
      ? escolaPorInep_(reg.inep) : null;
    if (origem && String(origem.situacao || 'ativa').toLowerCase() === 'ativa') {
      return { ok: false, erro: 'O registro já pertence a uma escola da base (código ' + reg.inep +
        '). O vínculo não transfere um PPP de uma escola para outra.' };
    }
    const dir = acessoPorInep_(inep);
    if (!dir) {
      return { ok: false, erro: 'A escola ' + base.escola + ' ainda não tem diretor em exercício cadastrado. ' +
        'Associe o diretor na aba "Acessos das escolas" e depois vincule o PPP à escola.' };
    }
    const donos = donosPorEscola_();
    const emailAtual = String(reg.email || '').toLowerCase();
    if (donos[inep] && donos[inep][emailAtual] && String(reg.inep).replace(/\D/g, '') === inep) {
      return { ok: false, erro: 'Este PPP já está vinculado à direção da escola (' + emailAtual + '). Não há o que vincular.' };
    }
    /* a escola escreve um PPP de cada vez: vincular um registro em elaboração
       para uma escola que já tem outro em elaboração criaria o segundo */
    if (emElaboracao_(reg.status)) {
      const dup = buscarPorInep_(aba, base.inep);
      if (dup && dup.protocolo !== reg.protocolo) {
        return { ok: false, duplicado: dup, erro: 'A escola ' + base.escola + ' já tem um PPP em elaboração (' + dup.protocolo +
          ', ' + String(dup.status || '').toLowerCase() + '). Conclua-o antes de vincular este.' };
      }
    }
    const antes = [reg.email || '(sem responsável)', reg.inep || '(sem código)', reg.escola || ''].join(' · ');
    gravarCampo_(aba, linha, 'email', dir.email);
    gravarCampo_(aba, linha, 'compartilhado', '');
    gravarCampo_(aba, linha, 'inep', base.inep);
    gravarCampo_(aba, linha, 'escola', base.escola);
    gravarCampo_(aba, linha, 'sre', base.sre);
    if (!reg.municipio) gravarCampo_(aba, linha, 'municipio', base.municipio);
    gravarCampo_(aba, linha, 'atualizadoEm', agora_());
    registrarCiclo_(reg.protocolo, 'PPP vinculado à escola', s.nome || s.email, rotuloSessao_(s),
      antes + ' → ' + dir.email + ' · ' + base.inep + ' · ' + base.escola +
      (origem ? ' · escola de origem inativa na base (' + origem.escola + ')' : ''));
    marcarRevisao_(aba, linha);   /* v8.13 (D01): a linha mudou — a gravação pendente da escola será recusada */
    return { ok: true, protocolo: reg.protocolo, email: dir.email, inep: base.inep, escola: base.escola,
             diretor: dir.nome || dir.email };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   v8.13 (E12, A7-12) — A TRILHA SÓ REGISTRA O QUE PODE TER ACONTECIDO.

   A lista é a MESMA política da v8.9 (e de E09), escrita uma vez: as três
   planilhas que o sistema exporta saem só pelo Órgão Central. `tipo` deixa de
   ser texto livre do cliente e passa a vir desta lista fechada, com o perfil
   que pode exportá-la. Uma sessão de direção escolar gravava "exportou painel
   (99999 linhas)" no histórico — e um registro que aceita qualquer coisa não
   prova nada.

   O NÚMERO DE LINHAS continua vindo da tela: o servidor não tem como sabê-lo,
   porque o recorte é dos filtros do navegador. Ele passa a ser registrado
   COMO DECLARADO ("412 linhas informadas pela tela"), que é a verdade do que
   o sistema sabe.

   A recusa também é registrada — uma tentativa de forjar a trilha é
   informação de auditoria —, no máximo uma por minuto por sessão, para que
   uma varredura não encha o histórico.
   ============================================================ */
const EXPORTACOES = {
  'painel': ['central'],
  'cobertura': ['central'],
  'contas a regularizar': ['central']
};

/**
 * v7.4 (P3) — Rastro das exportações em CSV. A tela avisa antes de baixar
 * (sem bloquear o download); o histórico guarda quem exportou o quê e
 * quantas linhas saíram do sistema.
 * v8.13 (E12): é RASTRO, não porta — a recusa aqui não impede o download
 * (que já foi montado), ela impede a MENTIRA no histórico.
 */
function registrarExportacao(payload) {
  const p = payload || {};
  const s = sessao_(p.token);
  const tipo = String(p.tipo || '').trim().toLowerCase();
  const escopo = (s.perfil === 'central' ? 'Órgão Central' : (s.sre || s.escola || ''));
  const permitidos = Object.prototype.hasOwnProperty.call(EXPORTACOES, tipo) ? EXPORTACOES[tipo] : null;
  if (!permitidos || permitidos.indexOf(s.perfil) < 0) {
    registrarExportacaoRecusada_(s, tipo, escopo);
    return { ok: false, erro: 'Este perfil não exporta esta lista.' };
  }
  const n = Math.max(0, parseInt(p.linhas, 10) || 0);
  registrarHistorico_(s.nome || s.email, 'exportou ' + tipo + ' · ' + n + ' linhas informadas pela tela',
    '—', '', escopo);
  return { ok: true };
}

/** v8.13 (E12): a tentativa impossível fica registrada, uma vez por minuto por sessão. */
function registrarExportacaoRecusada_(s, tipo, escopo) {
  try {
    const c = CacheService.getScriptCache();
    const chave = 'exprec:' + String((s && s.email) || '').slice(0, 60);
    if (c && c.get(chave)) return;
    if (c) c.put(chave, '1', 60);
  } catch (e) { /* sem cache, registra mesmo assim */ }
  try {
    registrarHistorico_((s && (s.nome || s.email)) || 'sessão sem nome',
      'exportação recusada', '—', '',
      (String(tipo || '(sem tipo)').slice(0, 40)) + ' · perfil ' + ((s && s.perfil) || '?') +
      (escopo ? ' · ' + escopo : ''));
  } catch (e) { /* a trilha não pode derrubar a recusa */ }
}

/** Abre um PPP para leitura pelos perfis institucionais. Não trava o registro. */
function registroLeitura(payload) {
  const s = sessao_(payload && payload.token);
  const aba = abaRegistros_();
  const linha = localizarLinha_(aba, String(payload && payload.p || '').trim().toUpperCase());
  if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };
  const reg = lerLinha_(aba, linha);
  /* v8.13 (C13): o escopo pergunta à BASE qual é a SRE da escola hoje, e cai
     para a SRE gravada só quando a escola não está na base. */
  const baseDoReg = escolaPorInep_(reg.inep);
  const sreEfetiva = (baseDoReg && baseDoReg.sre) ? baseDoReg.sre : reg.sre;
  if (s.perfil === 'regional' && String(sreEfetiva || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return { ok: false, erro: 'Este PPP pertence a outra Superintendência Regional de Ensino.' };
  }
  if (s.perfil === 'escola' && !mesmaEscola_(s, reg.inep)) {
    return { ok: false, erro: 'Este PPP pertence a outra escola.' };
  }
  /* v7.8 (P8): a leitura institucional fica no ciclo — a escola sabe quem abriu o seu PPP */
  if (s.perfil !== 'escola') registrarCiclo_(reg.protocolo, 'PPP lido', s.nome || s.email, rotuloSessao_(s), '');
  /* v8.11: concluído o PPP, o que se lê é o documento CONGELADO — o mesmo
     arquivo de que sai o PDF —, e não uma remontagem com os textos de hoje. */
  /* v8.13 (D21): o rodapé vem do SERVIDOR, que é quem sabe o estado. A tela
     deixou de remontar a frase por conta própria ao exibir o congelado. */
  return { ok: true, registro: reg, congelado: documentoCongelado_(reg),
           rodape: rodapeAutenticidade_(reg) };
}

/** O documento como ele foi congelado: corpo do Drive + folha de assinaturas. */
function documentoCongelado_(reg) {
  if (!reg || !reg.fonteId) return '';
  try {
    const html = DriveApp.getFileById(reg.fonteId).getBlob().getDataAsString('UTF-8');
    /* v8.13 (D19): a tela e a porta pública mostram EXATAMENTE o que o PDF
       imprime — mesma função, mesma paginação, mesmo número de folhas. */
    return documentoComFolha_(reg, html);
  } catch (e) { return ''; }
}

/* ---- cadastro dos acessos regionais, feito pelo Órgão Central ---- */
/**
 * v7.4 (P3) — Os papéis que uma sessão pode LISTAR em acessosListar: o que
 * ela mesma gere. O Central gere os institucionais (a própria equipe e os
 * Superintendentes; altera DE, CI e equipes — T-10); cada chefia regional,
 * a linha da sua cascata; quem associa diretores pode PEDIR explicitamente
 * os diretores (por padrão eles vêm por escolasListar). O COLEGIADO nunca
 * sai por aqui para a regional ou o Central: é a direção que o lista, por
 * colegiadoListar. Até a 7.3 a regional recebia todos os acessos da SRE,
 * inclusive nomes e e-mails de estudantes e pais.
 */
const PAPEIS_INSTITUCIONAIS = ['central', 'superintendente', 'diretor_educacional', 'coordenador_inspecao',
  'equipe_de', 'equipe_inspecao'];
/**
 * v8.13 (E08) — os papéis que o HISTÓRICO daquela sessão mostra.
 *
 * É `papeisListaveis_` com a lista COMPLETA como pedido, e não o padrão: o
 * padrão é o que a janela de cadastro abre primeiro (só os institucionais da
 * cascata), enquanto o histórico é de tudo o que a sessão mantém — e quem
 * associa diretor mantém também o período de direção das escolas da sua
 * unidade. A lista vem daqui, do código, nunca do payload: é o que impede
 * que a tela amplie o escopo pedindo um papel a mais.
 */
function papeisDoHistorico_(s) {
  const lista = papeisListaveis_(s, Object.keys(PAPEIS));
  /* v8.13 (F06) — QUEM RESPONDE POR UMA UNIDADE VÊ A SUCESSÃO DO PRÓPRIO
     POSTO nela. A v8.12 mostrava; a 8.13 tirou de 47 regionais sem dizer
     nada. Não é ampliação de escopo: o filtro de SRE continua valendo, o
     Colegiado continua fora da regional (C02) e o dado é institucional —
     nome, e-mail institucional e período —, o mesmo que a folha de
     assinaturas publica. `papeisListaveis_` NÃO muda: ela governa
     `acessosListar`, isto é, quem se pode CADASTRAR, e ninguém passa a
     cadastrar o próprio papel. */
  const proprio = papelDaSessao_(s);
  /* v9.6: o Órgão Central vê o histórico dos SUPERINTENDENTES — os acessos
     que ele próprio cadastra —, e não o de todo o estado. As equipes de
     cada regional são cadastradas e acompanhadas pelo superintendente, e é
     na regional que o histórico delas mora. Decisão da coordenação. */
  if (s.perfil === 'central') return ['superintendente'];
  if (proprio && s.perfil === 'regional' && lista.indexOf(proprio) < 0) {
    return lista.concat([proprio]);
  }
  return lista;
}
function papeisListaveis_(s, pedidos) {
  const papel = papelDaSessao_(s);
  /* v9.7: o Órgão Central lista e administra só o que cadastra — os
     superintendentes (e a própria unidade); a equipe de cada regional é do
     superintendente. Antes ele enxergava todos os institucionais da rede. */
  const padrao = (PAPEIS[papel] || { cadastra: [] }).cadastra.slice();
  const permitidos = padrao.slice();
  if (podeAssociar_(papel) && permitidos.indexOf('diretor_escolar') < 0) permitidos.push('diretor_escolar');
  if (!Array.isArray(pedidos) || !pedidos.length) return padrao;
  return pedidos.map(String).filter(function (x) { return permitidos.indexOf(x) >= 0; });
}
function acessosListar(payload) {
  const s = sessaoGestora_(payload && payload.token);
  const papeis = papeisListaveis_(s, payload && payload.papeis);
  const daRegional = function (a) {
    if (papeis.indexOf(papelDe_(a)) < 0) return false;
    if (s.perfil === 'central') return true;
    /* A regional enxerga os acessos da SUA SRE — os da própria estrutura,
       que desde a 7.0 ela mesma cadastra em cascata. */
    return String(a.sre || '').toLowerCase() === String(s.sre || '').toLowerCase();
  };
  const periodos = {};
  gestoresTodos_().forEach(function (g) {
    if (g.perfil !== 'escola' && g.perfil !== 'colegiado' && g.email) periodos[g.email] = (periodos[g.email] || 0) + 1;
  });
  return { ok: true, perfilGestor: s.perfil, sreGestor: s.sre || '', papeis: papeis,
           acessos: acessosTodos_().filter(daRegional).map(function (a) {
    return { email: a.email, nome: a.nome, perfil: a.perfil, sre: a.sre,
             papel: papelDe_(a), papelNome: nomeDoPapel_(papelDe_(a)), segmento: a.segmento,
             inep: a.inep, escola: a.escola, masp: a.masp,
             periodos: periodos[a.email] || 0,
             situacao: a.situacao, criadoEm: a.criadoEm, ultimoAcesso: a.ultimoAcesso,
             comSenha: !!a.hash };
  }) };
}
function acessoSalvar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return acessoSalvarSemTrava_(payload, {});
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}
/**
 * O cadastro propriamente dito, sem a trava — v7.6 (P4): a carga em lote
 * pega a trava uma vez e chama isto para cada linha. opts:
 *   emLote     — não monta a lista de volta (a carga devolve o seu resumo);
 *   modoEnvio  — 'fila' põe o convite na fila em vez de enviar na hora.
 */
function acessoSalvarSemTrava_(payload, opts) {
  opts = opts || {};
  {
    /* A direção escolar também cadastra — o colegiado da sua escola —, por
       isso aqui basta uma sessão válida: o que cada papel pode fazer é
       decidido logo abaixo, pela cascata. */
    const s = sessao_(payload && payload.token);
    const p = payload || {};
    const email = String(p.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: 'Informe um e-mail válido.' };
    /* v8.13 (C11): o mesmo teto do nome de escola vale para o nome de quem
       recebe o acesso — ele vai para o histórico e para a folha de assinaturas. */
    if (String(p.nome || '').trim().length > ESCOLA_MAX_NOME) {
      return { ok: false, erro: 'O nome tem no máximo ' + ESCOLA_MAX_NOME + ' caracteres.' };
    }
    /* O PAPEL é que manda: ele define o perfil (o escopo) e quem pode
       criá-lo. Chamadas antigas, que mandavam só o perfil, continuam
       funcionando — o papel de topo equivalente é assumido. */
    let papel = String(p.papel || '').trim();
    if (!papel || !PAPEIS[papel]) {
      papel = (p.perfil === 'escola') ? 'diretor_escolar'
            : (p.perfil === 'central') ? 'central' : 'superintendente';
    }
    const perfil = PAPEIS[papel].perfil;
    let sre = String(p.sre || '').trim();
    const inep = String(p.inep || '').replace(/\D/g, '');
    const masp = String(p.masp || '').replace(/\D/g, '');
    let escola = String(p.escola || '').trim();
    const papelDeQuemCria = papelDaSessao_(s);

    /* DUAS AUTORIZAÇÕES DIFERENTES, e não convém confundi-las.
       A CASCATA (quem cria quem dentro da própria estrutura) vale para os
       papéis institucionais: cada linha de PAPEIS diz o que aquele papel
       cadastra. Já ASSOCIAR O DIRETOR À ESCOLA não é cascata — é uma
       competência à parte, da Diretoria Educacional e de quem está acima
       dela, exercida sobre as escolas da SRE. E o colegiado só é cadastrado
       pela própria direção escolar. */
    /* v8.12 — quem entra no Colegiado sem ser servidor declara a relação com
       a escola. Não é burocracia: é o que identifica a pessoa que vai
       assinar o PPP, e é o que a escola vai precisar dois anos depois. */
    const segmentoInformado = String(p.segmento || '').trim();
    const relacao = String(p.relacao || '').trim();
    const podeCriar = (PAPEIS[papelDeQuemCria] || { cadastra: [] }).cadastra;
    /* v7.3 (T-10) — o Órgão Central, topo da cascata, ALTERA (corrige, suspende,
       reativa) qualquer cadastro institucional já existente pela janela da
       regional; o que ele não faz é CRIAR fora da sua linha da cascata. */
    const jaExisteInst = papel !== 'diretor_escolar' && papel !== 'colegiado' &&
      !!(acessoPorEmail_(email) || (p.emailAnterior && acessoPorEmail_(String(p.emailAnterior).trim().toLowerCase())));
    if (papel === 'diretor_escolar') {
      if (!podeAssociar_(papelDeQuemCria) && !(opts && opts.cargaDaImplantacao && podeGerirBase_(papelDeQuemCria))) {
        return { ok: false, erro: nomeDoPapel_(papelDeQuemCria) + ' não gere os diretores escolares. ' +
          'Isso cabe à Diretoria Educacional da Superintendência e à sua equipe.' };
      }
    } else if (papel === 'colegiado') {
      if (papelDeQuemCria !== 'diretor_escolar') {
        return { ok: false, erro: 'Só a direção escolar cadastra os membros do colegiado da sua escola.' };
      }
      const cadCol = acessoPorEmail_(email);
      const segCol = segmentoInformado || (cadCol ? cadCol.segmento : '');
      const relCol = relacao || (cadCol ? cadCol.relacao : '');
      if (!segmentoDeServidor_(segCol) && String(relCol).trim().length < 4) {
        return { ok: false, erro: 'Informe a relação desta pessoa com a escola — de que estudante é ' +
          'responsável, que turma, que entidade representa. É o que identifica quem assina o PPP.' };
      }
    } else if (podeCriar.indexOf(papel) < 0) {
      /* v9.7: a exceção da 7.3 (o Órgão Central alterava qualquer cadastro
         institucional existente pela janela da regional) saiu — cada nível
         administra só o nível imediatamente abaixo; a equipe da regional é
         do superintendente. `jaExisteInst` fica para o diagnóstico. */
      void jaExisteInst;
      return { ok: false, erro: nomeDoPapel_(papelDeQuemCria) + ' não cadastra ' +
        nomeDoPapel_(papel) + '. ' + (podeCriar.length
          ? 'Cadastra: ' + podeCriar.map(nomeDoPapel_).join(', ') + '.'
          : 'Este perfil não cadastra ninguém.') };
    }
    /* A unidade de quem cria é a unidade de quem é criado: ninguém cadastra
       para fora da sua própria SRE ou da sua própria escola. */
    if (perfil === 'regional') sre = String(s.sre || sre || '');
    if (papel === 'colegiado') {
      if (!s.inep) return { ok: false, erro: 'Só a direção escolar cadastra o colegiado da sua escola.' };
    }

    /* LIMITE POR UNIDADE: um Superintendente por SRE, dois Diretores
       Educacionais, um Coordenador de Inspeção. Zero significa sem limite. */
    /* v7.3 (T-12) — Nos papéis institucionais e no colegiado, quem identifica
       o cadastro é o e-mail; para TROCAR o e-mail de alguém, a tela manda o
       anterior em emailAnterior, e é aquela linha que é reescrita — não se
       cria uma segunda pessoa. */
    const emailAnterior = String(p.emailAnterior || '').trim().toLowerCase();
    const porAnterior = (emailAnterior && emailAnterior !== email && papel !== 'diretor_escolar')
      ? acessoPorEmail_(emailAnterior) : null;
    if (emailAnterior && emailAnterior !== email && papel !== 'diretor_escolar' && !porAnterior) {
      return { ok: false, erro: 'O cadastro de ' + emailAnterior + ' não foi encontrado para ter o e-mail trocado.' };
    }
    if (porAnterior && papelDe_(porAnterior) !== papel) {
      return { ok: false, erro: 'O cadastro de ' + emailAnterior + ' é de ' + nomeDoPapel_(papelDe_(porAnterior)) +
        ', não de ' + nomeDoPapel_(papel) + '.' };
    }

    const limite = PAPEIS[papel].limite;
    if (limite > 0) {
      /* quem está tendo o e-mail trocado (emailAnterior) também não conta como novo */
      const menos = (porAnterior ? emailAnterior : '') || email;
      const jaTem = quantosNoPapel_(papel, sre, (papel === 'colegiado' || papel === 'diretor_escolar') ? (inep || s.inep) : '', menos);
      if (jaTem >= limite) {
        return { ok: false, erro: limite === 1
          ? 'Já existe ' + nomeDoPapel_(papel) + ' cadastrado nesta unidade. Substitua o cadastro existente em vez de criar um segundo.'
          : 'Esta unidade já tem ' + limite + ' ' + nomeDoPapel_(papel) + '. Remova um para cadastrar outro.' };
      }
    }

    if (papel === 'colegiado') {
      /* membro do colegiado: a escola vem da sessão da direção */
      const base = escolaPorInep_(s.inep);
      if (!base) return { ok: false, erro: 'Escola não encontrada na base da rede.' };
      escola = base.escola; sre = base.sre;
      /* v7.3 (T-22) — a direção não se cadastra como colegiado: o e-mail
         dela, ou de qualquer diretor, não pode virar membro. */
      const jaDiretor = acessoPorEmail_(email);
      if (email === String(s.email || '').toLowerCase() || (jaDiretor && papelDe_(jaDiretor) === 'diretor_escolar')) {
        return { ok: false, erro: 'O e-mail ' + email + ' é de um diretor escolar e não pode ser cadastrado como membro do colegiado. ' +
          'A direção já consta da folha de assinaturas por conta própria.' };
      }
    } else if (perfil === 'escola') {
      /* A escola não é digitada: é escolhida na base da rede, que também
         define nome, município e regional do cadastro. */
      const base = escolaPorInep_(inep);
      if (!base) return { ok: false, erro: 'Esta escola não está na base da rede. Importe a base ou confira o código da escola.' };
      if (base.situacao && base.situacao !== 'ativa') {
        return { ok: false, erro: 'Esta escola está marcada como ' + base.situacao + ' na base da rede.' };
      }
      escola = base.escola;
      sre = base.sre;
      if (s.perfil === 'regional' && String(sre).toLowerCase() !== String(s.sre || '').toLowerCase()) {
        return { ok: false, erro: 'Esta escola pertence a outra Superintendência Regional de Ensino.' };
      }
      if (masp && !/^\d{6,12}$/.test(masp)) return { ok: false, erro: 'O MASP deve conter apenas números.' };
    }
    if (perfil !== 'central' && !sre) return { ok: false, erro: 'Informe a Superintendência Regional de Ensino deste acesso.' };
    const inepFinal = (papel === 'colegiado') ? String(s.inep || '') : inep;
    /* Quem cadastra não define senha: quem entra é identificado pela conta
       institucional ou define a própria senha pelo link de primeiro acesso.
       Uma senha enviada aqui (chamadas antigas) continua sendo aceita. */
    const senha = String(p.senha || '');
    if (senha && senha.length < 8) return { ok: false, erro: 'A senha deve ter ao menos 8 caracteres.' };
    const aba = abaAcessos_();
    const porEmail = acessoPorEmail_(email);
    /* Para a direção escolar, quem identifica o cadastro é a ESCOLA, não o
       e-mail: uma escola tem um cadastro só, e trocar de gestor é reescrever
       esse mesmo cadastro — inclusive o e-mail. O e-mail novo, porém, não
       pode já pertencer a outro acesso. */
    const porInep = (papel === 'diretor_escolar') ? acessoPorInep_(inep) : null;
    /* a troca de e-mail (emailAnterior, resolvido acima) reescreve a linha
       de quem está trocando — e o e-mail novo não pode ser de outra pessoa */
    if (porAnterior && porEmail && porEmail.linha !== porAnterior.linha) {
      return { ok: false, erro: 'O e-mail ' + email + ' já responde por ' +
        (porEmail.escola || porEmail.sre || porEmail.perfil) + '. Use outro e-mail ou libere aquele cadastro antes.' };
    }
    const cad = porInep || porAnterior || porEmail;
    /* v8.13 (C06) — ALTERAR EXIGE COMPETÊNCIA SOBRE O PAPEL ATUAL, não só
       sobre o pedido. A cascata acima confere apenas o papel PEDIDO: bastava
       a um Diretor Educacional pedir `papel:'equipe_de'` com o e-mail do
       Superintendente para reescrever a linha dele; depois,
       recusaGestaoDeAcesso_ decidia pelo papel ATUAL do alvo — que já era
       equipe_de — e a remoção passava. A proteção caía em dois passos. A
       guarda equivalente já existia, mas só para emailAnterior; aqui ela
       passa a valer para o cadastro alcançado por INEP ou por e-mail.
       O Órgão Central mantém a exceção T-10 (altera qualquer cadastro
       institucional já existente), que é por projeto — e desde a C05 essa
       alteração fecha e abre período, com o papel de origem e o de destino. */
    if (cad && papelDe_(cad) !== papel && papelDeQuemCria !== 'central' &&
        podeCriar.indexOf(papelDe_(cad)) < 0) {
      return { ok: false, erro: nomeDoPapel_(papelDeQuemCria) + ' não altera o cadastro de ' +
        nomeDoPapel_(papelDe_(cad)) + '. ' + (podeCriar.length
          ? 'Altera quem cadastra: ' + podeCriar.map(nomeDoPapel_).join(', ') + '.'
          : 'Este perfil não cadastra ninguém.') };
    }
    if (porEmail && porInep && porEmail.linha !== porInep.linha) {
      return { ok: false, erro: 'O e-mail ' + email + ' já responde por ' +
        (porEmail.escola || porEmail.perfil) + '. Use outro e-mail ou libere aquele cadastro antes.' };
    }
    if (papel === 'diretor_escolar' && porEmail && !porInep && porEmail.inep && porEmail.inep !== inep) {
      return { ok: false, erro: 'O e-mail ' + email + ' já responde pela escola ' + porEmail.escola + '.' };
    }
    if (cad && s.perfil === 'regional' &&
        String(cad.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Este acesso não pertence à sua Superintendência Regional de Ensino.' };
    }
    if (cad && s.perfil === 'escola' && cad.inep !== String(s.inep || '')) {
      /* v8.13 (C06): "de outra escola (código )" — com o parêntese vazio — é o
         que saía quando o e-mail pertencia a um acesso regional ou central,
         que não têm INEP. A mensagem passa a dizer o que ocupa o endereço. */
      return { ok: false, erro: 'O e-mail ' + email + ' já está cadastrado como ' +
        nomeDoPapel_(papelDe_(cad)) + ' de ' + (cad.escola || cad.sre || 'Órgão Central') +
        '. Cada e-mail responde por um cadastro só; use outro endereço.' };
    }
    /* QUEM É A PESSOA NÃO SE DEDUZ DO E-MAIL. O endereço institucional da
       direção costuma pertencer à ESCOLA, não a quem a dirige: a mesma caixa
       passa de um diretor para o outro. Deduzir a troca da mudança de e-mail
       — como se fazia até a 6.14 — fazia o sucessor sobrescrever o nome e o
       MASP do antecessor no período em aberto, apagando-o do histórico.
       A intenção passa a ser declarada: 'correcao' conserta os dados de quem
       está no exercício; qualquer outra coisa é diretor NOVO, e diretor novo
       sempre encerra o período do anterior e abre o seu. */
    const correcao = String(p.modo || '') === 'correcao';
    if (papel === 'diretor_escolar' && correcao && !porInep) {
      return { ok: false, erro: 'Não há diretor em exercício nesta escola para corrigir.' };
    }
    /* v8.13 (C07) — CORRIGIR DADOS NÃO É TROCAR A PESSOA. O modo 'correcao'
       abre nome, MASP e e-mail para edição e promete, na tela, que o período
       continua o mesmo. Trocar os três de uma vez é outra pessoa por qualquer
       critério — e era assim que o antecessor sumia do registro permanente.
       Um erro de digitação real tem caminho: salva-se o nome e o MASP num
       salvamento e o e-mail noutro; a mensagem diz isso. */
    if (papel === 'diretor_escolar' && correcao && porInep && porInep.email !== email &&
        (String(p.nome || '').trim() !== String(porInep.nome || '').trim() ||
         (masp && masp !== String(porInep.masp || '')))) {
      return { ok: false, erro: 'Trocar o e-mail junto com o nome ou o MASP é substituição de diretor, ' +
        'não correção de dados: use "Associar novo diretor" para que o período de ' +
        (porInep.nome || porInep.email) + ' seja encerrado e o novo aberto. ' +
        'Para corrigir só a digitação, salve o nome e o MASP primeiro e o e-mail depois.' };
    }
    const trocaDeGestor = !!(porInep && !correcao);
    /* v8.13 (C15) — NOME OBRIGATÓRIO NO SERVIDOR, não só na tela. A exigência
       de três caracteres estava apenas em salvarEquipe e salvarColegiado, no
       App: uma chamada direta, um atalho guardado ou uma tela antiga gravava
       o cadastro com nome vazio e abria, na aba que não se apaga, um período
       de acesso ANÔNIMO e permanente — sem ninguém a quem atribuir a
       assinatura do PPP dois anos depois. O que se valida é o nome FINAL: o
       enviado, ou o já gravado quando o payload não o traz (é o caso de
       suspender e reativar, que não reenviam o nome).
       DECISÃO DE IMPLEMENTAÇÃO (além do plano): a queda para o nome gravado
       vale só quando o cadastro alcançado é a MESMA pessoa. Numa troca de
       diretor (`trocaDeGestor`) o cadastro alcançado é o do ANTECESSOR;
       herdar o nome dele faria o sucessor entrar no lugar com o nome de quem
       saiu — trocar um cadastro anônimo por um cadastro trocado é pior. */
    const nomeFinal = String(p.nome || ((cad && !trocaDeGestor) ? cad.nome : '')).trim();
    /* v8.13 (F05) — FECHAR UM ACESSO NUNCA DEPENDE DE UM CAMPO DE CADASTRO.
       C15 pôs a exigência no caminho de TODOS os atos, e "suspender" passa
       pela mesma função. Sobre um cadastro que a 8.12 gravou SEM NOME, o
       botão devolvia "Informe o nome de quem recebe o acesso…" — sobre um
       campo que a pessoa não abriu e não vê — e o acesso continuava ATIVO.
       Suspender reduz risco e vale o mesmo que já vale para "remover":
       nenhuma política de dado fica entre o gestor e o botão que tira alguém
       de dentro do sistema. A exceção é SÓ para `inativo`, porque reabrir um
       período anônimo é exatamente o que C15 existe para impedir; criar
       continua exigindo o nome, sem exceção. */
    const soFechando = !!cad && !trocaDeGestor && String(p.situacao || '') === 'inativo';
    if (nomeFinal.length < 3 && !soFechando) {
      return { ok: false, precisaNome: true, email: email,
        /* a redação do cadastro EXISTENTE só vale quando o cadastro alcançado é a
           MESMA pessoa — numa troca de gestor, `cad` é o ANTECESSOR */
        erro: (cad && !trocaDeGestor)
          ? 'Este cadastro está sem nome: informe quem é a pessoa antes de reativá-lo. É o nome que ' +
            'vai para o histórico de acessos e para a folha de assinaturas.'
          : 'Informe o nome de quem recebe o acesso: é o que vai constar do ' +
            'histórico e da folha de assinaturas.' };
    }
    /* troca de e-mail de um cadastro institucional ou de colegiado: é outra
       pessoa que passa a entrar — nada de credencial herdada (T-12) */
    const trocaDeEmail = !!(porAnterior && porAnterior.email !== email);
    /* o diretor que tem o e-mail CORRIGIDO continua sendo a mesma pessoa —
       mantém a senha, mas recebe o convite na caixa nova */
    const emailDoDiretorCorrigido = !!(papel === 'diretor_escolar' && correcao && porInep && porInep.email !== email);
    let sal = cad ? cad.sal : '', hash = cad ? cad.hash : '';
    let hashVersao = cad ? (cad.hashVersao || '') : '';
    if (senha) { sal = Utilities.getUuid(); hash = hashSenhaV2_(senha, sal); hashVersao = '2'; }
    /* Gestor novo nunca herda credencial do anterior.
       v8.13 (C07): CREDENCIAL NUNCA ACOMPANHA E-MAIL — nem na correção. Até
       aqui, corrigir o e-mail do diretor preservava sal/hash, e quem sabia a
       senha do diretor que saiu entrava no acesso do que entrou. O convite já
       é reemitido nesse caso (emailDoDiretorCorrigido), então a pessoa define
       a senha na caixa nova; o custo é um incômodo, o ganho é que credencial
       deixa de ser transferível. */
    if (trocaDeGestor || trocaDeEmail || emailDoDiretorCorrigido) { sal = ''; hash = ''; hashVersao = ''; if (senha) { sal = Utilities.getUuid(); hash = hashSenhaV2_(senha, sal); hashVersao = '2'; } }
    /* Para a direção escolar não existe "ativo/inativo" a escolher: o gestor
       cadastrado É o vigente, e o anterior sai automaticamente para o
       histórico no mesmo movimento. A situação só é escolhida nos perfis
       institucionais, onde suspender um acesso faz sentido. */
    const situacao = (papel === 'diretor_escolar') ? 'ativo' : String(p.situacao || 'ativo');

    /* CONVITE DE PRIMEIRO ACESSO. Quem é cadastrado agora — ou quem assume o
       lugar de outra pessoa, ou passa a entrar por outro e-mail — recebe um
       link para definir a própria senha. O convite não é credencial: vale por
       prazo e some no primeiro uso. Quem já está cadastrado e está apenas
       tendo os dados corrigidos, sendo suspenso ou reativado NÃO recebe outro
       convite — para isso existe "reenviar convite" (v7.3, T-21). */
    const pessoaNova = !cad || trocaDeGestor || trocaDeEmail || emailDoDiretorCorrigido;
    let convite = cad ? cad.token : '', conviteAte = cad ? cad.tokenAte : '';
    if (pessoaNova) {
      convite = Utilities.getUuid();
      conviteAte = Utilities.formatDate(new Date(Date.now() + CONVITE_DIAS * 86400000),
        Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    }

    const linhaVals = [email, nomeFinal, perfil, perfil === 'central' ? '' : sre,
      hash, sal, situacao, cad ? cad.criadoEm : agora_(), cad ? cad.ultimoAcesso : '',
      perfil === 'escola' ? inepFinal : '', perfil === 'escola' ? escola : '',
      perfil === 'escola' ? masp : '',
      papel, convite, conviteAte, String(p.segmento || (cad ? cad.segmento : '') || ''),
      hashVersao,    // v7.8 (P7): a versão do hash acompanha a linha
      papel === 'colegiado' ? relacao : ''];   // v8.12
    /* v8.13 (F07): a faixa é formatada como texto ANTES de receber o valor.
       `appendRow` não deixa formatar antes — vira getLastRow()+1 + faixa +
       setValues, como `registrarCiclo_` já faz desde D15. */
    if (cad) faixaDeTexto_(aba, cad.linha, 1, 1, ACESSO_COLS.length).setValues([linhaVals]);
    else faixaDeTexto_(aba, aba.getLastRow() + 1, 1, 1, ACESSO_COLS.length).setValues([linhaVals]);
    /* v7.6: a memória é atualizada com a linha gravada, não descartada — na
       carga em lote, descartar faria reler ~20.000 linhas a cada cadastro */
    if (_acessosCache) {
      const novoObj = acessoDaLinha_(linhaVals, cad ? cad.linha : aba.getLastRow());
      if (cad) { const i = _acessosCache.findIndex(function (a) { return a.linha === cad.linha; }); if (i >= 0) _acessosCache[i] = novoObj; else _acessosCache.push(novoObj); }
      else _acessosCache.push(novoObj);
    }
    let conviteEnviado = '', conviteModo = '';
    if (convite && pessoaNova) {
      conviteEnviado = enviarPrimeiroAcesso_(email, nomeFinal, papel, convite, conviteAte,
                                             s.nome || s.email, opts.modoEnvio);
      conviteModo = ULTIMO_ENVIO;
    }
    /* v8.12: a conta institucional é cobrada de quem é servidor. De um pai
       de aluno ou de um estudante ela não existe — e um alerta que não se
       pode resolver só atrapalha quem tem pendência de verdade. */
    const cobraInstitucional = papel !== 'colegiado' ||
      segmentoDeServidor_(String(p.segmento || (cad ? cad.segmento : '') || ''));
    const avisoDominio = cobraInstitucional ? avisoDominio_(email, !!conviteEnviado, conviteModo) : '';

    /* Histórico de acessos: quem assumiu, quando e até quando. Vale para os
       três perfis; muda apenas o que identifica o período — a escola, no
       perfil escolar; a pessoa, nos institucionais. O COLEGIADO não entra
       aqui: não é gestor, não tem período — até a 7.2 ele entrava com perfil
       "escola" e o código da escola, e passava por diretor (T-04). */
    const atual = { inep: perfil === 'escola' ? inepFinal : '', escola: perfil === 'escola' ? escola : '',
                    nome: nomeFinal, masp: masp, email: email,
                    perfil: perfil, sre: perfil === 'central' ? '' : sre, papel: papel,
                    /* v8.13 (C05): a Observação passa a guardar o PAPEL, como o
                       cabeçalho de GESTOR_COLS promete desde a 8.12 — sem ela,
                       nenhum período institucional ou de direção registrava que
                       papel a pessoa exercia, e um rebaixamento ficava invisível
                       numa auditoria. O Colegiado sobrescreve logo abaixo, com
                       algo mais informativo. */
                    observacao: nomeDoPapel_(papel) };
    if (papel === 'colegiado') {
      /* v8.12 — o Colegiado Escolar também entra no histórico. A 7.2 o
         deixou de fora porque, ali, ele entrava como se fosse gestor da
         escola e passava por diretor (T-04). O problema era a CHAVE, não o
         registro: o período do colegiado pertence à PESSOA, como nos
         acessos institucionais, e vai com perfil próprio — 'colegiado' —,
         sem disputar o período de gestão da unidade. Quem assina o PPP
         precisa ter a sua entrada e a sua saída registradas, com o nome de
         quem as fez. */
      atual.perfil = 'colegiado';
      atual.inep = inepFinal; atual.escola = escola;
      /* v8.13 (E19, A8-20): a relação NÃO entra no registro permanente — ela
         vive só no cadastro, que tem exclusão. */
      atual.observacao = observacaoColegiado_(String(p.segmento || (cad ? cad.segmento : '') || ''));
      /* v8.13 (C05): um ponto só decide entre atualizar, fechar-e-abrir e abrir */
      gestorRegistrar_(cad, atual, s.nome || s.email,
        trocaDeEmail ? 'e-mail trocado para ' + email : '', {});
    } else if (papel === 'diretor_escolar') {
      gestorRegistrar_(cad, atual, s.nome || s.email,
        trocaDeGestor ? 'substituído por ' + (nomeFinal || email) : '',
        { fecharEAbrir: !!trocaDeGestor });
      if (trocaDeGestor) {
        registrarHistorico_(s.nome, 'gestor escolar substituído',
          porInep.nome || porInep.email, escola, nomeFinal || email);
      } else if (correcao && porInep) {
        /* v8.13 (C07) — CORREÇÃO DEIXA RASTRO. A aba de gestores continua
           sendo o registro do PERÍODO; o que mudou nos DADOS dentro dele
           passa a ter onde ser consultado. */
        const antes = [porInep.nome || '(sem nome)', porInep.masp || 'sem MASP', porInep.email].join(' · ');
        const depois = [atual.nome || '(sem nome)', masp || 'sem MASP', email].join(' · ');
        if (antes !== depois) {
          registrarHistorico_(s.nome, 'dados do diretor corrigidos', email, antes, depois);
        }
      }
    } else {
      const eraInativo = cad && String(cad.situacao).toLowerCase() === 'inativo';
      const ficaInativo = String(situacao).toLowerCase() === 'inativo';
      if (trocaDeEmail) {
        /* o período institucional pertence ao e-mail: o antigo encerra, o novo abre */
        gestorRegistrar_(cad, atual, s.nome || s.email, 'e-mail trocado para ' + email,
          { encerrar: ficaInativo });
      } else if (ficaInativo && !eraInativo) {
        gestorRegistrar_(cad, atual, s.nome || s.email,
          'acesso inativado por ' + (s.nome || s.email), { encerrar: true });
      } else if (!ficaInativo) {
        gestorRegistrar_(cad, atual, s.nome || s.email, '', {});
      }
    }
    registrarHistorico_(s.nome, cad ? 'acesso alterado' : 'acesso criado', email,
      cad ? nomeDoPapel_(papelDe_(cad)) + ' · ' + (cad.escola || cad.sre) : '',
      nomeDoPapel_(papel) + ' · ' + (perfil === 'escola' ? escola + ' · código ' + inepFinal : sre) +
      (conviteModo === 'enviado' ? ' · convite de primeiro acesso enviado'
       : conviteModo === 'fila' ? ' · convite de primeiro acesso na fila de e-mails'
       : conviteModo === 'boas-vindas' ? ' · boas-vindas na fila (conta institucional)' : ''));
    /* v7.6: na carga em lote, só o essencial — a carga devolve o seu resumo */
    if (opts.emLote) {
      return { ok: true, email: email, papel: papel, inep: inepFinal, escola: escola, sre: sre,
               convite: conviteEnviado, conviteModo: conviteModo, aviso: avisoDominio,
               substituiu: trocaDeGestor ? (porInep.nome || porInep.email) : '' };
    }
    /* a tela da direção escolar é a lista de escolas; a do colegiado e a das
       equipes regionais, a lista de acessos */
    if (papel === 'colegiado') {
      const r = colegiadoListar({ token: p.token });
      r.convite = conviteEnviado; r.conviteModo = conviteModo; r.aviso = avisoDominio; return r;
    }
    if (papel === 'diretor_escolar') {
      const r = escolasListar({ token: p.token });
      r.convite = conviteEnviado; r.conviteModo = conviteModo; r.aviso = avisoDominio; return r;
    }
    const r = acessosListar({ token: p.token });
    r.convite = conviteEnviado; r.conviteModo = conviteModo;
    r.aviso = avisoDominio;
    return r;
  }
}
/**
 * O colegiado da escola da sessão. Quem chama é a direção escolar — e a
 * lista nunca sai do INEP dela.
 *
 * v8.13 (C14) — a exigência passou a ser `sessaoDirecao_`, e não `sessao_`
 * com `s.inep`. O membro do Colegiado TAMBÉM tem INEP na sessão, de modo que
 * a guarda anterior o deixava entrar: um estudante recebia nome, e-mail
 * particular, segmento, situação, último acesso e o estado da senha de todos
 * os colegas — inclusive os endereços de pais e responsáveis. Quem administra
 * o cadastro do Colegiado é a direção, e é só ela que o lê. As demais ações
 * de gestão do colegiado já usavam esta mesma porta.
 */
function colegiadoListar(payload) {
  const s = sessaoDirecao_(payload && payload.token);
  if (!s) return semSessao_();
  const inep = String(s.inep || '').replace(/\D/g, '');
  /* guarda de cadastro escolar sem escola vinculada — não é o caso comum,
     mas a lista sem INEP seria a lista de todo mundo */
  if (!inep) return { ok: false, erro: 'Esta ação é da direção escolar.' };
  const lista = acessosTodos_()
    .filter(function (a) { return papelDe_(a) === 'colegiado' && a.inep === inep; })
    .map(function (a) {
      return { email: a.email, nome: a.nome, segmento: a.segmento, situacao: a.situacao,
               ultimoAcesso: a.ultimoAcesso, comSenha: !!a.hash, convitePendente: !!a.token };
    });
  lista.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  return { ok: true, inep: inep, escola: s.escola || '', membros: lista,
           comSenha: lista.filter(function (m) { return m.comSenha; }).length };
}

/* ============================================================
   PRIMEIRO ACESSO (v7.0)

   Quem é cadastrado recebe um link por e-mail para definir a própria senha.
   O convite não é credencial: vale por prazo, serve uma vez e some assim que
   a senha é definida. Ele não substitui a entrada pela conta institucional —
   quem tem conta @educacao.mg.gov.br continua entrando sem digitar nada; a
   senha atende quem não tem conta (membros do colegiado, por exemplo) e vale
   de plano B quando a identificação falha.
   ============================================================ */
/* ============================================================
   FILA DE E-MAILS (v7.6, P4)

   Com "Executar como: eu" a cota de e-mail é uma só (MailApp, ~1.500/dia)
   e a carga de 3.400 diretores a esgotaria em minutos — sem contar que
   3.186 deles têm conta @educacao.mg.gov.br e entram sem senha: o convite
   para eles era inútil. Agora:
     · quem tem e-mail do domínio recebe BOAS-VINDAS em baixa prioridade,
       pela fila; o link de senha vai junto, como opção;
     · quem não tem recebe o CONVITE — na hora, se houver cota e não for
       carga em lote; senão pela fila, em alta prioridade;
     · o que falha não se perde: vai para a fila e é tentado de novo.
   A aba "Fila de e-mails" guarda cada mensagem com situação, tentativas e
   o último erro. processarFilaEmails_() roda a cada 10 minutos (acionador
   instalado por instalarAcionadores_) e respeita a cota restante do dia,
   guardando uma reserva para os envios imediatos.
   ============================================================ */
const NOME_ABA_FILA = 'Fila de e-mails';
const FILA_COLS = ['Criado em', 'Destinatário', 'Tipo', 'Assunto', 'Corpo', 'Prioridade', 'Situação',
                   'Tentativas', 'Último erro', 'Enviado em'];
const FILA_MAX_TENTATIVAS = 5;
const FILA_RESERVA_COTA = 50;      // e-mails do dia guardados para os envios imediatos
const FILA_LOTE_MAX = 120;         // por execução do acionador
/* v8.4 — a fila precisa de expurgo. Sem ele, a aba só cresce: a carga inicial
   do colegiado põe dezenas de milhares de linhas, cada ciclo de PPP acrescenta
   cerca de dez avisos por escola, e a execução de dez em dez minutos passa a
   ler tudo isso — com o corpo HTML de cada mensagem — até estourar o tempo. E
   quando a fila para, NENHUM aviso da rede sai, sem nada apitar. */
const FILA_GUARDA_DIAS = 30;       // linhas já enviadas são apagadas depois disso
const FILA_ALERTA_PENDENTES = 2000;// acima disso, o Órgão Central é avisado
/* ============================================================
   v8.13 (E13, A8-07/A8-11/A8-12) — A FILA CABE NA EXECUÇÃO.

   Três defeitos que se somavam dentro do acionador de 10 minutos:

   1. O EXPURGO RODAVA DENTRO DA TRAVA DO ENVIO. Numa fila de 20.000 linhas
      medimos 1.400 chamadas `deleteRows` (bloco médio de 7,7 linhas), ~210 s
      no Sheets real — antes de enviar, e ainda com até 120 `MailApp` pela
      frente, contra um teto de execução de 360 s. Enquanto isso, as 25
      funções que gravam esperam a trava com `waitLock(10..30 s)` FORA de
      try: salvar PPP, concluir, registrar ata, homologar e definir senha de
      primeiro acesso estouravam a cada 10 minutos. O expurgo vira rotina
      PRÓPRIA (diária, 2h), com trava própria e ORÇAMENTO — no máximo
      EXPURGO_MAX_BLOCOS remoções e EXPURGO_TEMPO por execução; o resto fica
      para amanhã.

   2. O ENVIO ACONTECIA DENTRO DA TRAVA. Agora são três fases: sob a trava,
      escolher o lote e marcá-lo `enviando`; SOLTAR a trava; enviar; retomar a
      trava por instantes e gravar os desfechos. Linha em `enviando` há mais
      de FILA_ENVIANDO_MIN minutos volta a `pendente` no início da execução
      seguinte — é o que cobre a queda no meio do envio. A marca carrega a
      hora em que o envio começou, porque sem ela não há como distinguir um
      envio em curso de um envio morto.

   3. O AVISO DE FILA CHEIA ENTRAVA NA PRÓPRIA FILA, com prioridade 1, a cada
      execução: 144 linhas por dia, cada uma à frente dos convites que
      justamente não estavam saindo. Um aviso sobre a fila não pode depender
      da fila: passa a sair DIRETO pelo MailApp, no máximo uma vez a cada
      24 h.
   ============================================================ */
const EXPURGO_MAX_BLOCOS = 100;    // chamadas deleteRows por execução da rotina
const EXPURGO_TEMPO = 60000;       // e no máximo um minuto de relógio
const FILA_ENVIANDO_MIN = 30;      // minutos; acima disso, o envio é dado por morto
const PROP_AVISO_FILA = 'FILA_AVISO';
const PROP_EXPURGO_FILA = 'FILA_EXPURGO';   // {em, apagadas, restam} da última rotina
function abaFila_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_FILA);
  if (aba) conferirCabecalho_(aba, FILA_COLS, NOME_ABA_FILA);   /* v8.13 (E03) */
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA_FILA);
    aba.getRange(1, 1, 1, FILA_COLS.length).setValues([FILA_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(2, 260); aba.setColumnWidth(4, 300);
    aba.hideColumns(5);
  }
  return aba;
}
/** Põe uma mensagem na fila. prioridade 1 = convite (senha), 2 = boas-vindas. */
function enfileirarEmail_(para, tipo, assunto, corpo, prioridade) {
  abaFila_().appendRow([agora_(), String(para || '').toLowerCase(), tipo, assunto, corpo,
                        prioridade || 2, 'pendente', 0, '', '']);
  return true;
}
/** Tenta enviar agora. Devolve '' quando conseguiu, ou a mensagem de erro traduzida. */
function tentarEnviar_(para, assunto, corpo) {
  try {
    const msg = { to: para, name: 'Gerador de PPP — SEE/MG', subject: assunto };
    /* v7.7: os avisos do ciclo são HTML; convites e boas-vindas, texto simples */
    if (/^\s*</.test(String(corpo || ''))) msg.htmlBody = corpo; else msg.body = corpo;
    MailApp.sendEmail(msg);
    return '';
  } catch (e) { return erroDeEmail_(e); }
}
/** Os erros do MailApp chegam em inglês; a tela é em português. */
function erroDeEmail_(e) {
  const m = String((e && e.message) || e || '');
  if (/too many times for one day: email|Service invoked too many times/i.test(m)) {
    return 'A cota diária de envio de e-mails do sistema acabou. A mensagem fica na fila e sai amanhã.';
  }
  if (/Invalid email|invalid.*address/i.test(m)) return 'Endereço de e-mail inválido.';
  if (/Mail service not enabled|not authorized|Authorization/i.test(m)) {
    return 'O envio de e-mail não está autorizado nesta implantação. A equipe responsável precisa autorizar o serviço de e-mail do aplicativo.';
  }
  return 'Não foi possível enviar o e-mail agora (' + m.slice(0, 120) + ').';
}
function cotaDisponivel_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return 0; }
}
/** v8.13 (E13): a marca de "em envio", com a hora — sem ela não há como
    distinguir um envio em curso de um envio que morreu no meio. */
function marcaEnviando_() { return 'enviando desde ' + agora_(); }
function ehEnviando_(v) { return /^enviando\b/.test(String(v == null ? '' : v)); }
/* `dataDe_` descarta a hora (devolve meia-noite do dia), e aqui a janela é de
   MINUTOS: uma marca de hoje às 14:03 lida como 00:00 seria dada por morta na
   execução seguinte, e a mensagem sairia duas vezes. Parser próprio, com hora. */
function enviandoDesde_(v) {
  const m = String(v == null ? '' : v).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2], ano = +m[3];
  const d = new Date(ano, mes - 1, dia, m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  if (d.getDate() !== dia || d.getMonth() !== mes - 1 || d.getFullYear() !== ano) return null;
  return d;
}

/**
 * v8.13 (E13) — Linha em `enviando` há mais de FILA_ENVIANDO_MIN minutos
 * volta a `pendente`: a execução que a marcou não chegou a gravar o desfecho
 * (estouro de tempo, queda). Sem isto, uma queda no meio do envio deixaria a
 * mensagem parada para sempre — e o convite é a porta de entrada do sistema.
 * A tentativa NÃO é contada: não houve falha atribuível à mensagem.
 * Devolve quantas ressuscitaram. Roda sob a trava de quem a chama.
 */
function ressuscitarEnviando_(aba) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return 0;
  const sit = aba.getRange(2, 7, ultima - 1, 1).getValues();
  /* o "agora" é lido pelo MESMO caminho da marca (agora_ → enviandoDesde_),
     para que o fuso do script e o do ambiente de execução não entrem na conta */
  const agoraD = enviandoDesde_(agora_());
  const limite = (agoraD ? agoraD.getTime() : Date.now()) - FILA_ENVIANDO_MIN * 60000;
  const voltar = [];
  sit.forEach(function (r, i) {
    if (!ehEnviando_(r[0])) return;
    const d = enviandoDesde_(r[0]);
    if (!d || d.getTime() <= limite) voltar.push(i);
  });
  if (!voltar.length) return 0;
  /* uma escrita de faixa só, da primeira à última linha afetada */
  const marcadas = {};
  voltar.forEach(function (i) { marcadas[i] = true; });
  const ini = voltar[0], fim = voltar[voltar.length - 1];
  const faixa = [];
  for (let i = ini; i <= fim; i++) faixa.push([marcadas[i] ? 'pendente' : sit[i][0]]);
  aba.getRange(ini + 2, 7, faixa.length, 1).setValues(faixa);
  registrarHistorico_('fila de e-mails', 'envios interrompidos devolvidos à fila', '—', '',
    voltar.length + ' mensagem(ns) voltaram a pendente sem contar tentativa');
  return voltar.length;
}

/**
 * Processa a fila: pendentes em ordem de prioridade e de chegada, até
 * FILA_LOTE_MAX por execução, enquanto a cota do dia (menos a reserva)
 * permitir. Falha conta tentativa e guarda o erro; na quinta, desiste.
 * Chamada pelo acionador de 10 minutos e pelo botão do Órgão Central.
 *
 * v8.13 (E13): TRÊS FASES. O envio não acontece mais sob a trava do script —
 * ela é presa para escolher o lote, solta para enviar, e retomada por
 * instantes para gravar os desfechos.
 */
function processarFilaEmails_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: true, enviados: 0, motivo: 'outra execução está processando a fila' };
  let itens = [], pendentesTotal = 0, ultimaNaSelecao = 0, semCota = 0, ressuscitadas = 0;
  let aba = null;
  /* ---------- fase 1: sob a trava, escolher o lote e marcá-lo ---------- */
  try {
    aba = abaFila_();
    ressuscitadas = ressuscitarEnviando_(aba);
    const ultima = aba.getLastRow();
    ultimaNaSelecao = ultima;
    if (ultima < 2) {
      marcarRotina_('processarFilaEmails_');
      return { ok: true, enviados: 0, pendentes: 0, apagadas: 0, ressuscitadas: ressuscitadas };
    }
    /* v8.4 — a varredura NÃO lê o corpo das mensagens: lê a situação e a
       prioridade, escolhe o lote, e só então busca assunto e corpo das linhas
       que vai mesmo enviar. Com dezenas de milhares de linhas, é a diferença
       entre uma execução de segundos e uma que estoura o tempo. */
    const leves = aba.getRange(2, 6, ultima - 1, 3).getValues();   // Prioridade, Situação, Tentativas
    const pendentes = [];
    leves.forEach(function (r, i) { if (String(r[1]) === 'pendente') pendentes.push({ i: i, pri: Number(r[0]) || 2, tent: Number(r[2]) || 0 }); });
    pendentes.sort(function (a, b) { return a.pri - b.pri || a.i - b.i; });
    pendentesTotal = pendentes.length;
    const cota = cotaDisponivel_() - FILA_RESERVA_COTA;
    const cabem = Math.max(0, Math.min(FILA_LOTE_MAX, cota));
    semCota = Math.max(0, pendentes.length - cabem);
    const escolhidos = pendentes.slice(0, cabem);
    escolhidos.forEach(function (it) {
      const linha = it.i + 2;
      const r = aba.getRange(linha, 1, 1, FILA_COLS.length).getValues()[0];
      itens.push({ i: it.i, linha: linha, tent: it.tent, para: String(r[1]), tipo: String(r[2]),
                   assunto: String(r[3]), corpo: String(r[4]), prioridade: r[5] });
    });
    if (itens.length) {
      /* uma única escrita de faixa na coluna Situação: as linhas escolhidas
         viram `enviando`, as do meio ficam como estavam */
      /* o lote vem ORDENADO POR PRIORIDADE, não por linha: a faixa vai da
         menor à maior linha escolhida, e as do meio voltam como estavam */
      let a = itens[0].i, b = itens[0].i;
      const marcadas = {};
      itens.forEach(function (it) { marcadas[it.i] = true; if (it.i < a) a = it.i; if (it.i > b) b = it.i; });
      const marca = marcaEnviando_();
      const faixa = [];
      for (let i = a; i <= b; i++) faixa.push([marcadas[i] ? marca : leves[i][1]]);
      aba.getRange(a + 2, 7, faixa.length, 1).setValues(faixa);
    }
  } finally { lock.releaseLock(); }

  /* ---------- fase 2: FORA da trava, enviar ---------- */
  let enviados = 0, falhas = 0, desistidos = 0;
  itens.forEach(function (it) {
    /* v8.4 — o convite carrega um prazo; se ficou dias na fila, ele é
       renovado no momento do envio, para ninguém receber link vencido.
       v8.13 (E14): aqui só se CALCULA — a gravação é do ramo de sucesso. */
    if (it.tipo === 'convite') {
      const nova = renovarConviteNoCorpo_(it.para, it.corpo);
      it.corpo = nova.corpo; it.ate = nova.ate; it.cad = nova.cad;
    }
    const erro = tentarEnviar_(it.para, it.assunto, it.corpo);
    if (!erro) { it.desfecho = 'enviado'; it.erro = ''; enviados++; return; }
    /* v8.13 (E14, A8-08): falha de COTA não é tentativa — é condição do
       sistema, não do destinatário, e a própria mensagem promete que a
       mensagem "fica na fila e sai amanhã". */
    const porCota = /cota diária/.test(erro);
    it.tentNova = porCota ? it.tent : it.tent + 1;
    it.desfecho = (!porCota && it.tentNova >= FILA_MAX_TENTATIVAS) ? 'desistiu' : 'pendente';
    it.erro = erro; falhas++;
    if (it.desfecho === 'desistiu') desistidos++;
  });

  /* ---------- fase 3: retomar a trava e gravar os desfechos ---------- */
  if (itens.length) {
    const lock2 = LockService.getScriptLock();
    lock2.waitLock(30000);
    try {
      gravarDesfechosDaFila_(aba, itens, ultimaNaSelecao);
      /* v8.13 (E14): o token do convite só é renovado DEPOIS de o e-mail sair */
      itens.forEach(function (it) {
        if (it.desfecho === 'enviado' && it.ate && it.cad) gravarPrazoDoConvite_(it.cad, it.ate);
      });
    } finally { lock2.releaseLock(); }
  }

  if (enviados || falhas) {
    registrarHistorico_('fila de e-mails', 'fila processada', '—', '',
      enviados + ' enviado(s), ' + falhas + ' falha(s), ' + desistidos + ' desistido(s), ' +
      (pendentesTotal - enviados - desistidos) + ' pendente(s)');
  }
  /* v8.13 (E14, A8-08): a desistência vira FATO VISÍVEL. Convite perdido em
     silêncio é o pior desfecho possível num sistema cuja porta de entrada é
     o convite. */
  itens.forEach(function (it) {
    if (it.desfecho !== 'desistiu') return;
    registrarHistorico_('fila de e-mails', 'desistiu de enviar', it.para, '', it.tipo + ' · ' + it.erro);
  });
  const restam = pendentesTotal - enviados - desistidos;
  /* v8.4 — fila entupida é avisada: é o sinal de que os convites e os avisos
     do ciclo pararam de sair. */
  if (restam >= FILA_ALERTA_PENDENTES) { try { avisarFilaCheia_(restam); } catch (e) {} }
  marcarRotina_('processarFilaEmails_');
  try { gerarPdfsPendentes_(); } catch (e) {}
  return { ok: true, enviados: enviados, falhas: falhas, desistidos: desistidos,
           pendentes: restam, semCota: semCota > 0, apagadas: 0,
           ressuscitadas: ressuscitadas, cotaRestante: cotaDisponivel_() };
}

/**
 * v8.13 (E13/E14) — Grava o desfecho do lote. Colunas 5 e 7..10 numa escrita
 * só (a 6, Prioridade, é preservada): o CORPO sai da planilha junto com o
 * desfecho, porque é ele que carrega o link de primeiro acesso em claro
 * (A8-09). Linha `pendente` conserva o corpo — ela ainda vai ser enviada.
 *
 * Antes de escrever, reconfere o formato da aba: se o número de linhas mudou
 * (o expurgo correu junto), os índices de antes não valem mais e cada linha é
 * relocalizada pelo destinatário entre as que estão em `enviando`.
 */
function gravarDesfechosDaFila_(aba, itens, ultimaNaSelecao) {
  const ultimaAgora = aba.getLastRow();
  const valor = function (it) {
    const enviado = it.desfecho === 'enviado';
    const limpar = (it.desfecho === 'enviado' || it.desfecho === 'desistiu');
    return { corpo: limpar ? '' : it.corpo,
             sit: it.desfecho,
             tent: enviado ? (it.tent + 1) : (it.tentNova == null ? it.tent : it.tentNova),
             erro: it.erro || '',
             em: enviado ? agora_() : '' };
  };
  if (ultimaAgora === ultimaNaSelecao) {
    let a = itens[0].i, b = itens[0].i;
    itens.forEach(function (it) { if (it.i < a) a = it.i; if (it.i > b) b = it.i; });
    /* UMA leitura da faixa (colunas 5..10) e UMA escrita: as linhas do meio
       voltam exatamente como estavam, e a Prioridade (coluna 6) é preservada
       por vir da própria leitura. */
    const faixa = aba.getRange(a + 2, 5, b - a + 1, 6).getValues();
    const porIndice = {};
    itens.forEach(function (it) { porIndice[it.i] = it; });
    for (let i = a; i <= b; i++) {
      const it = porIndice[i];
      if (!it) continue;
      const linha = faixa[i - a];
      if (!ehEnviando_(linha[2])) continue;   /* alguém mexeu na linha: não sobrescrever */
      const v = valor(it);
      linha[0] = v.corpo; linha[2] = v.sit; linha[3] = v.tent; linha[4] = v.erro; linha[5] = v.em;
    }
    aba.getRange(a + 2, 5, faixa.length, 6).setValues(faixa);
    return;
  }
  /* o formato mudou: relocalizar linha a linha pelo destinatário */
  const n = aba.getLastRow() - 1;
  if (n < 1) return;
  const chaves = aba.getRange(2, 2, n, 6).getValues();   // Destinatário … Situação
  const usadas = {};
  itens.forEach(function (it) {
    for (let i = 0; i < chaves.length; i++) {
      if (usadas[i]) continue;
      if (!ehEnviando_(chaves[i][5])) continue;
      if (String(chaves[i][0]) !== it.para || String(chaves[i][2]) !== it.assunto) continue;
      usadas[i] = true;
      const v = valor(it);
      aba.getRange(i + 2, 5).setValue(v.corpo);
      aba.getRange(i + 2, 7, 1, 4).setValues([[v.sit, v.tent, v.erro, v.em]]);
      return;
    }
  });
  registrarHistorico_('fila de e-mails', 'desfechos gravados linha a linha', '—', '',
    'a aba mudou de tamanho durante o envio (' + ultimaNaSelecao + ' → ' + aba.getLastRow() + ')');
}

/**
 * v8.4 — Apaga da fila as linhas já enviadas há mais de FILA_GUARDA_DIAS. O que
 * saiu está registrado no histórico; o que fica na aba é o que ainda espera.
 *
 * v8.13 (E13, A8-07) — É ROTINA PRÓPRIA, diária, com trava e ORÇAMENTO. Rodava
 * dentro da trava do envio, e numa fila de 20.000 linhas emitia 1.400
 * `deleteRows` antes de o primeiro e-mail sair. O que não couber no orçamento
 * fica para amanhã: a fila não é registro permanente, e apagá-la em três dias
 * em vez de um não custa nada a ninguém.
 */
function expurgarFilaRotina_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: true, apagadas: 0, restam: null, motivo: 'outra execução está usando a planilha' };
  const t0 = Date.now();
  try {
    const aba = abaFila_();
    const ultima = aba.getLastRow();
    if (ultima < 2) { marcarRotina_('expurgarFilaRotina_'); return { ok: true, apagadas: 0, restam: 0 }; }
    const cols = aba.getRange(2, 7, ultima - 1, 4).getDisplayValues();   // Situação … Enviado em
    /* v8.13 (F10, A8-09) — "Criado em" numa FAIXA PRÓPRIA. A leitura NÃO é
       ampliada para as colunas 1..10: a coluna 5 é o CORPO da mensagem, e
       A8-12 existe para mantê-la fora destas rotinas. */
    const criados = aba.getRange(2, 1, ultima - 1, 1).getDisplayValues();
    const limite = Date.now() - FILA_GUARDA_DIAS * 86400000;
    const apagar = [];
    cols.forEach(function (r, i) {
      /* v8.13 (F10) — AS DUAS SITUAÇÕES TERMINAIS, e nenhuma outra. E14
         fechou a parte de segurança (o corpo com o link em claro sai da
         planilha); a de crescimento ficou: a linha `desistiu` nunca era
         apagada, e numa rede de 3.400 escolas a aba cresce sem teto. O que o
         sistema desistiu de enviar continua registrado na TRILHA, que é
         registro permanente; o que sai é a linha da fila, que nunca foi.
         `pendente` ainda vai ser enviada e `enviando` está em voo. */
      const sit = String(r[0]);
      if (sit !== 'enviado' && sit !== 'desistiu') return;
      /* a idade é medida por "Enviado em" QUANDO HOUVER — em linha `desistiu`
         ela é vazia (gravarDesfechosDaFila_) —, com queda para "Criado em".
         Linha sem data nenhuma NÃO é apagada: não se apaga o que não se sabe
         datar. Até aqui, data ilegível era tratada como "velha o bastante". */
      const d = dataDe_(r[3]) || dataDe_(criados[i][0]);
      if (d && d.getTime() <= limite) apagar.push(i + 2);
    });
    if (!apagar.length) { marcarRotina_('expurgarFilaRotina_'); return { ok: true, apagadas: 0, restam: 0 }; }
    /* de baixo para cima, para os índices não escorregarem */
    apagar.sort(function (a, b) { return b - a; });
    let blocos = 0, apagadas = 0, i = 0;
    while (i < apagar.length && blocos < EXPURGO_MAX_BLOCOS && (Date.now() - t0) < EXPURGO_TEMPO) {
      let j = i;
      while (j + 1 < apagar.length && apagar[j + 1] === apagar[j] - 1) j++;
      const ini = apagar[j], quantas = j - i + 1;
      aba.deleteRows(ini, quantas);
      blocos++; apagadas += quantas; i = j + 1;
    }
    const restam = apagar.length - apagadas;
    registrarHistorico_('fila de e-mails', 'fila expurgada', '—', '',
      apagadas + ' mensagem(ns) encerradas (enviadas ou desistidas) há mais de ' + FILA_GUARDA_DIAS + ' dias' +
      (restam ? ' · ' + restam + ' ficaram para a próxima execução (orçamento de ' +
        EXPURGO_MAX_BLOCOS + ' blocos / ' + Math.round(EXPURGO_TEMPO / 1000) + ' s)' : ''));
    try {
      PropertiesService.getScriptProperties().setProperty(PROP_EXPURGO_FILA,
        JSON.stringify({ em: agora_(), apagadas: apagadas, restam: restam }));
    } catch (e) { /* o registro do expurgo não pode derrubar o expurgo */ }
    marcarRotina_('expurgarFilaRotina_');
    return { ok: true, apagadas: apagadas, restam: restam };
  } finally { lock.releaseLock(); }
}

/**
 * v8.13 (E14, A8-09) — Tira da planilha o corpo das mensagens que já não vão
 * ser enviadas. O corpo do convite traz `…/exec?pa=<token>` em claro, e a
 * coluna 5 é apenas OCULTA. A fila NÃO é registro permanente (ao contrário da
 * aba de PPPs e da de gestores): fica o destinatário, o assunto, a situação e
 * a data, que é o que a auditoria precisa. Linha `pendente` conserva o corpo,
 * porque ainda vai ser enviada — e o token dela já vive no cadastro.
 */
function limparCorposDaFila_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const aba = abaFila_();
    const ultima = aba.getLastRow();
    if (ultima < 2) return { ok: true, limpas: 0 };
    const sit = aba.getRange(2, 7, ultima - 1, 1).getValues();
    const corpos = aba.getRange(2, 5, ultima - 1, 1).getValues();
    let limpas = 0;
    const novos = corpos.map(function (c, i) {
      const s = String(sit[i][0] || '');
      if (s === 'pendente' || ehEnviando_(s)) return [c[0]];
      if (!String(c[0] || '')) return [c[0]];
      limpas++;
      return [''];
    });
    if (limpas) aba.getRange(2, 5, novos.length, 1).setValues(novos);
    registrarHistorico_(usuarioAtual_() || 'menu da planilha', 'corpos da fila apagados', '—', '',
      limpas + ' mensagem(ns) já enviadas ou desistidas tiveram o corpo removido da planilha');
    return { ok: true, limpas: limpas };
  } finally { lock.releaseLock(); }
}

/**
 * v8.4 — O convite de primeiro acesso traz um prazo no corpo e um token com
 * validade no cadastro. Se a mensagem esperou dias na fila, os dois são
 * renovados no momento do envio: o cadastro passa a valer por mais
 * CONVITE_DIAS e o corpo passa a dizer a data nova.
 */
/*
 * v8.13 (E14, A8-10) — CALCULA, NÃO GRAVA. A função gravava `tokenAte = hoje +
 * CONVITE_DIAS` ANTES do envio e não desfazia quando o envio falhava: um
 * convite parado por erro permanente RESSUSCITAVA, a cada execução, um link
 * já vencido (no teste, um token expirado em 01/01/2020 voltou a valer até
 * 03/10/2026). A promessa impressa no corpo — "vale até X e serve uma única
 * vez" — deixava de ser verdadeira. Agora devolve o corpo novo e a data; quem
 * grava é o ramo de SUCESSO do envio.
 */
function renovarConviteNoCorpo_(destino, corpo) {
  const cad = acessoPorEmail_(String(destino || '').toLowerCase());
  if (!cad || !cad.token || cad.hash) return { corpo: corpo, ate: '', cad: null };   // já definiu a senha
  const ate = Utilities.formatDate(new Date(Date.now() + CONVITE_DIAS * 86400000),
                                   Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  if (String(cad.tokenAte || '') === ate) return { corpo: corpo, ate: '', cad: null };
  return { corpo: String(corpo || '').replace(/vale at[ée]\s+\d{2}\/\d{2}\/\d{4}( \d{2}:\d{2})?/g, 'vale até ' + ate),
           ate: ate, cad: cad };
}
/** v8.13 (E14): a gravação do prazo novo, no ramo de sucesso do envio. */
function gravarPrazoDoConvite_(cad, ate) {
  if (!cad || !ate) return false;
  abaAcessos_().getRange(cad.linha, 15).setValue(ate);
  invalidarAcessos_();
  return true;
}

/**
 * v8.4 — Avisa o Órgão Central quando a fila passa do teto de pendentes.
 *
 * v8.13 (E13, A8-11) — O AVISO SAI POR FORA DA FILA. Era enfileirado NA
 * PRÓPRIA FILA, com prioridade 1, a cada execução do acionador: 144 linhas
 * por dia, cada uma passando à frente dos convites que justamente não
 * estavam saindo. Um aviso sobre a fila não pode depender da fila. Agora vai
 * DIRETO pelo MailApp e no máximo uma vez a cada 24 h; sem cota, fica
 * registrado no histórico e não insiste (é a mesma lição de E02).
 */
function avisarFilaCheia_(pendentes) {
  const props = PropertiesService.getScriptProperties();
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (props.getProperty(PROP_AVISO_FILA) === hoje) return 0;
  const todos = destinosDeOperacao_();
  if (!todos.length) {
    registrarHistorico_('fila de e-mails', 'fila acima do limite, sem destinatário para o aviso', '—', '', pendentes + ' pendente(s)');
    return 0;
  }
  const corpo = 'A fila de e-mails do Gerador de PPP tem ' + pendentes + ' mensagens pendentes, acima do limite de ' +
    FILA_ALERTA_PENDENTES + '.\n\nEnquanto a fila não escoa, convites de primeiro acesso e avisos do ciclo do ' +
    'PPP não chegam às escolas. Confira a cota diária de e-mails da conta que executa o aplicativo e o ' +
    'acionador processarFilaEmails_.\n\n' + urlApp_();
  try {
    MailApp.sendEmail({ to: todos.join(','), name: 'Gerador de PPP — SEE/MG',
      subject: 'Fila de e-mails acima do limite — Gerador de PPP', body: corpo });
  } catch (e) {
    registrarHistorico_('fila de e-mails', 'aviso de fila cheia não enviado', '—', '', String(e && e.message || e));
    return 0;
  }
  props.setProperty(PROP_AVISO_FILA, hoje);
  registrarHistorico_('fila de e-mails', 'fila acima do limite avisada', '—', '',
    pendentes + ' pendente(s) · ' + todos.length + ' destinatário(s)');
  return todos.length;
}
/**
 * Resumo da fila para o Órgão Central: quantos em cada situação, cota do dia.
 *
 * v8.13 (E13, A8-12) — LÊ SÓ O QUE PRECISA. Lia as 10 colunas de TODAS as
 * linhas, corpo HTML incluído (~31 MB numa fila de 20.000 linhas), enquanto o
 * acionador, corrigido na v8.4, já lia só três colunas leves. A tela do Órgão
 * Central não tinha recebido a mesma correção. Agora conta sobre as colunas
 * 6..10 e só busca destinatário e tipo das ATÉ CINCO linhas que vão para
 * `ultimosErros`.
 */
function filaEmailsResumo(payload) {
  sessaoCentral_(payload && payload.token);
  const aba = abaFila_();
  const ultima = aba.getLastRow();
  const r = { ok: true, pendentes: 0, enviados: 0, desistidos: 0, enviando: 0,
              ultimosErros: [], cotaRestante: cotaDisponivel_(), expurgo: ultimoExpurgoDaFila_() };
  if (ultima < 2) return r;
  /* Situação, Tentativas, Último erro — as três de que o resumo precisa.
     Prioridade e "Enviado em" não entram em número nenhum desta resposta. */
  const vals = aba.getRange(2, 7, ultima - 1, 3).getDisplayValues();
  const comErro = [];
  vals.forEach(function (v, i) {
    const sit = String(v[0]);
    if (sit === 'pendente') r.pendentes++;
    else if (sit === 'enviado') r.enviados++;
    else if (sit === 'desistiu') r.desistidos++;
    else if (ehEnviando_(sit)) r.enviando++;
    if (v[2] && sit !== 'enviado' && comErro.length < 5) comErro.push({ linha: i + 2, erro: v[2], tentativas: v[1] });
  });
  comErro.forEach(function (c) {
    const d = aba.getRange(c.linha, 2, 1, 2).getDisplayValues()[0];   // Destinatário, Tipo
    r.ultimosErros.push({ para: d[0], tipo: d[1], erro: c.erro, tentativas: c.tentativas });
  });
  return r;
}
/** v8.13 (E13): o que a última rotina de expurgo fez — a tela do Central mostra. */
function ultimoExpurgoDaFila_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_EXPURGO_FILA) || 'null'); }
  catch (e) { return null; }
}
/** O botão "processar agora" do Órgão Central. */
function filaEmailsProcessar(payload) {
  sessaoCentral_(payload && payload.token);
  const r = processarFilaEmails_();
  const resumo = filaEmailsResumo(payload);
  r.resumo = resumo;
  return r;
}

const CONVITE_DIAS = 14;
let ULTIMO_ERRO_EMAIL = '';
/** O link de primeiro acesso de um token. */
function linkPrimeiroAcesso_(token) {
  const app = urlApp_();
  return app + (app.indexOf('?') >= 0 ? '&' : '?') + 'pa=' + encodeURIComponent(token);
}

function acessoPorToken_(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  return acessosTodos_().filter(function (a) { return a.token && a.token === t; })[0] || null;
}

/**
 * Envia o convite de primeiro acesso — ou o põe na fila (v7.6, P4).
 *   · e-mail do domínio: BOAS-VINDAS pela fila, em baixa prioridade (a
 *     pessoa entra sem senha; o link de senha vai como opção);
 *   · fora do domínio: CONVITE na hora, se houver cota e não for carga em
 *     lote (modo 'fila'); senão pela fila, em alta prioridade;
 *   · falha no envio imediato: vai para a fila, não se perde.
 * Devolve o e-mail quando enviou ou enfileirou; '' quando nada pôde ser
 * feito. ULTIMO_ENVIO diz como foi: 'enviado', 'fila' ou 'boas-vindas'.
 */
let ULTIMO_ENVIO = '';
function enviarPrimeiroAcesso_(email, nome, papel, token, ate, quemCadastrou, modo) {
  const link = linkPrimeiroAcesso_(token);
  const doDominio = emailInstitucional_(email);
  const abertura = 'Olá' + (nome ? ', ' + nome : '') + '.\n\n' +
    'Você foi cadastrado no Gerador de Projeto Político-Pedagógico da Secretaria de Estado de ' +
    'Educação de Minas Gerais como ' + nomeDoPapel_(papel) + '' +
    (quemCadastrou ? ', por ' + quemCadastrou : '') + '.\n\n';
  const rodape = '\n\n— Gerador de PPP · SEE/MG (mensagem automática, não responda)';
  ULTIMO_ENVIO = ''; ULTIMO_ERRO_EMAIL = '';
  if (doDominio) {
    const corpo = abertura +
      'Você entra no sistema com a sua conta institucional ' + DOMINIO_REDE + ', sem senha: basta abrir o ' +
      'endereço abaixo já autenticado nessa conta.\n\n' + urlApp_() + '\n\n' +
      'Se preferir entrar por e-mail e senha (por exemplo, em um computador sem a conta institucional), ' +
      'defina a sua senha por este link, que vale até ' + ate + ' e serve uma única vez:\n\n' + link + rodape;
    enfileirarEmail_(email, 'boas-vindas', 'Bem-vindo ao Gerador de PPP · SEE/MG', corpo, 2);
    ULTIMO_ENVIO = 'boas-vindas';
    return email;
  }
  const corpo = abertura +
    'Para definir a sua senha e entrar pela primeira vez, use o endereço abaixo:\n\n' + link + '\n\n' +
    'O link vale até ' + ate + ' e serve uma única vez. Depois disso, peça um novo convite a quem ' +
    'fez o seu cadastro.' + rodape;
  const assunto = 'Primeiro acesso ao Gerador de PPP · SEE/MG';
  if (modo !== 'fila' && cotaDisponivel_() > 0) {
    const erro = tentarEnviar_(email, assunto, corpo);
    if (!erro) { ULTIMO_ENVIO = 'enviado'; return email; }
    ULTIMO_ERRO_EMAIL = erro;
  }
  /* sem cota, em lote ou com falha: o convite não se perde — vai para a fila */
  enfileirarEmail_(email, 'convite', assunto, corpo, 1);
  ULTIMO_ENVIO = 'fila';
  return email;
}

/** O que a tela de primeiro acesso precisa saber antes de pedir a senha. */
function primeiroAcessoInfo(payload) {
  const cad = acessoPorToken_(payload && payload.token);
  if (!cad) return { ok: false, erro: 'Este link de primeiro acesso não é válido. Ele serve uma única vez — se você já definiu a sua senha, entre normalmente. Se não, peça um novo convite a quem fez o seu cadastro.' };
  const ate = dataDe_(cad.tokenAte);
  if (ate && ate.getTime() < Date.now()) {
    return { ok: false, erro: 'Este link expirou em ' + cad.tokenAte + '. Peça um novo convite a quem fez o seu cadastro.' };
  }
  if (String(cad.situacao).toLowerCase() === 'inativo') {
    return { ok: false, erro: 'Este acesso está inativo. Procure quem fez o seu cadastro.' };
  }
  return { ok: true, nome: cad.nome || '', email: cad.email,
           papel: papelDe_(cad), papelNome: nomeDoPapel_(papelDe_(cad)),
           unidade: cad.perfil === 'escola' ? cad.escola : (cad.sre || 'Órgão Central') };
}

/** Define a senha e consome o convite. */
function primeiroAcessoDefinir(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = payload || {};
    const info = primeiroAcessoInfo(p);
    if (!info.ok) return info;
    const senha = String(p.senha || '');
    if (senha.length < 8) return { ok: false, erro: 'A senha deve ter ao menos 8 caracteres.' };
    if (senha !== String(p.repetir || '')) return { ok: false, erro: 'As duas senhas digitadas são diferentes.' };
    const cad = acessoPorToken_(p.token);
    const sal = Utilities.getUuid();
    const aba = abaAcessos_();
    aba.getRange(cad.linha, 5, 1, 2).setValues([[hashSenhaV2_(senha, sal), sal]]);
    aba.getRange(cad.linha, 14, 1, 2).setValues([['', '']]);   // convite consumido
    aba.getRange(cad.linha, ACESSO_COLS.indexOf('Versão do hash') + 1).setValue('2');   // v7.8 (P7)
    invalidarAcessos_();
    registrarHistorico_(cad.nome || cad.email, 'senha definida no primeiro acesso', cad.email, '', '');
    return { ok: true, email: cad.email };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/** Reenvia o convite — troca de e-mail, caixa cheia, prazo vencido. */
function primeiroAcessoReenviar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    /* Reenvia quem cadastrou: a regional, para as suas equipes e diretores;
       a direção escolar, para o seu colegiado. */
    const s = sessao_(payload && payload.token);
    const email = String(payload && payload.email || '').trim().toLowerCase();
    const cad = acessoPorEmail_(email);
    if (!cad) return { ok: false, erro: 'Acesso não encontrado.' };
    if (s.perfil === 'regional' && String(cad.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
      return { ok: false, erro: 'Este acesso não pertence à sua Superintendência Regional de Ensino.' };
    }
    if (s.perfil === 'escola' && cad.inep !== String(s.inep || '')) {
      return { ok: false, erro: 'Este acesso não pertence à sua escola.' };
    }
    /* v7.3 (T-03) — reenvia quem pode cadastrar: na escola, a direção; na
       regional, quem associa diretores ou quem cadastra aquele papel. */
    const recusa = recusaGestaoDeAcesso_(s, cad);
    if (recusa) return { ok: false, erro: recusa };
    const token = Utilities.getUuid();
    const ate = Utilities.formatDate(new Date(Date.now() + CONVITE_DIAS * 86400000),
      Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    abaAcessos_().getRange(cad.linha, 14, 1, 2).setValues([[token, ate]]); invalidarAcessos_();
    const enviado = enviarPrimeiroAcesso_(cad.email, cad.nome, papelDe_(cad), token, ate, s.nome || s.email);
    registrarHistorico_(s.nome, 'convite de primeiro acesso reenviado', cad.email, '', ate + ' · ' + ULTIMO_ENVIO);
    /* v7.6: o que não pôde ir na hora está na fila — o link também pode ser copiado da tela */
    return { ok: true, enviado: !!enviado, modo: ULTIMO_ENVIO, ate: ate, link: linkPrimeiroAcesso_(token),
             erro: ULTIMO_ENVIO === 'fila' && ULTIMO_ERRO_EMAIL
               ? ('O envio imediato falhou (' + ULTIMO_ERRO_EMAIL + '). O convite será enviado de novo nos próximos minutos; se preferir, copie o link e entregue por outro canal.')
               : '' };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}


/* ============================================================
   CARGA EM LOTE DE ACESSOS (v7.6, P4)

   A base da rede tem 3.401 diretores prontos, e a tela cadastrava um por
   vez, em três passos. importarAcessos_('diretores', …) recebe linhas
   "código; nome; MASP; e-mail" (o Órgão Central para toda a rede; a
   Diretoria Educacional e os perfis acima, na própria SRE).
   v9.8: esta carga não é mais oferecida na tela — ela roda pelo menu da
   planilha (menuImportarDiretores), na implantação. colegiadoImportar,
   desativado desde a 8.12, continua recusando com a razão escrita.
   Cada linha passa por acessoSalvarSemTrava_ — as mesmas regras, ganchos
   e histórico do cadastro individual; os convites vão pela fila.

   A SIMULAÇÃO É OBRIGATÓRIA: a primeira chamada (simular=true) só
   confere e devolve o que faria com cada linha — aceita, substituiria a
   diretora X, recusada e por quê — e uma chave do texto conferido; a
   carga real exige essa chave, de modo que o que se importa é exatamente
   o que se conferiu. Importar em lote uma base velha encerraria períodos
   de diretores em exercício; por isso a opção "só escolas sem diretor",
   e por isso a simulação diz quem seria substituído.

   A carga real processa até LOTE_MAX linhas por chamada e devolve de onde
   continuar: a tela chama de novo até acabar, mostrando o progresso.
   ============================================================ */
const LOTE_MAX = 150;
/* ============================================================
   v8.13 (C08) — A CHAVE DA CARGA É EMITIDA, NÃO DERIVADA

   Até aqui a chave era SHA-256(texto|opção) truncado: sem sessão, sem
   instante, sem nada de aleatório. A mesma chave valia em qualquer
   instalação, para sempre, e quem conhecesse o texto podia importar sem ter
   simulado. Pior: `simular` era decidido por "não tem a chave certa", de
   modo que, com a chave em mãos, a carga GRAVAVA mesmo quando o chamador
   pedira simular:true. Agora a simulação EMITE um token aleatório, guardado
   no cache do script, ligado ao e-mail da sessão, ao tipo, à opção e à
   impressão do texto conferido; vale 30 minutos, é renovado a cada lote e
   consumido no último. E `simular` é decidido só por `p.simular`: intenção
   declarada não se sobrepõe por conhecimento do texto.
   ============================================================ */
const CARGA_CHAVE_SEG = 1800;
function impressaoDaCarga_(texto, opcoes) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto) + '|' + String(opcoes || ''), Utilities.Charset.UTF_8);
  return bytes.slice(0, 8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function emitirChaveDeCarga_(s, tipo, texto, opcoes) {
  const token = String(Utilities.getUuid()).replace(/-/g, '');
  const valor = JSON.stringify({ email: String((s && s.email) || '').toLowerCase(),
    impressao: impressaoDaCarga_(texto, opcoes), emitidaEm: Date.now(),
    tipo: String(tipo), opcoes: String(opcoes || '') });
  try { CacheService.getScriptCache().put('carga:' + token, valor, CARGA_CHAVE_SEG); } catch (e) {}
  return token;
}
function conferirChaveDeCarga_(s, chave, tipo, texto, opcoes) {
  const token = String(chave || '').trim();
  if (!token) return false;
  let bruto = null;
  try { bruto = CacheService.getScriptCache().get('carga:' + token); } catch (e) { bruto = null; }
  if (!bruto) return false;
  let v = null;
  try { v = JSON.parse(bruto); } catch (e) { return false; }
  return !!v && v.email === String((s && s.email) || '').toLowerCase() &&
         v.tipo === String(tipo) && v.opcoes === String(opcoes || '') &&
         v.impressao === impressaoDaCarga_(texto, opcoes);
}
/** A carga continua: a chave vale mais 30 minutos. */
function renovarChaveDeCarga_(chave) {
  const token = String(chave || '').trim();
  if (!token) return;
  try {
    const c = CacheService.getScriptCache();
    const bruto = c.get('carga:' + token);
    if (bruto) c.put('carga:' + token, bruto, CARGA_CHAVE_SEG);
  } catch (e) {}
}
/** Terminou: a chave é de uso único. */
function consumirChaveDeCarga_(chave) {
  const token = String(chave || '').trim();
  if (!token) return;
  try { CacheService.getScriptCache().remove('carga:' + token); } catch (e) {}
}
function linhasDaCarga_(bruto) {
  return String(bruto || '').split(/\r?\n/).map(function (l, i) { return { n: i + 1, txt: l.trim() }; })
    .filter(function (l) { return l.txt; })
    .map(function (l) {
      l.c = l.txt.split(/;|\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (x) { return x.replace(/^"|"$/g, '').trim(); });
      return l;
    });
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Confere uma linha de diretor; devolve {ok, motivo, aviso, substitui}. */
function conferirDiretor_(s, c, somenteSemDiretor, vistos, linha) {
  const inep = String(c[0] || '').replace(/\D/g, '');
  const nome = String(c[1] || '').trim();
  const masp = String(c[2] || '').replace(/\D/g, '');
  const email = String(c[3] || '').trim().toLowerCase();
  const r = { linha: linha || 0, inep: inep, nome: nome, masp: masp, email: email,
              ok: false, motivo: '', aviso: '', substitui: '' };
  if (!COD_ESCOLA.test(inep)) { r.motivo = 'código da escola inválido'; return r; }
  if (!nome) { r.motivo = 'sem nome'; return r; }
  if (!EMAIL_RE.test(email)) { r.motivo = 'e-mail inválido'; return r; }
  if (masp && !/^\d{6,12}$/.test(masp)) { r.motivo = 'MASP deve ter de 6 a 12 dígitos'; return r; }
  /* v8.13 (C08) — A CONFERÊNCIA TEM DE SER A MESMA EM TODAS AS PASSADAS. A
     carga real é fatiada em lotes de LOTE_MAX e cada continuação reconfere o
     arquivo inteiro do zero. Enquanto `vistos` só era alimentado pelas linhas
     ACEITAS, as linhas já gravadas passavam a ser recusadas ("já é o diretor
     em exercício") e deixavam de marcar o código: a guarda de repetição
     sumia, e uma segunda ocorrência da mesma escola num lote posterior era
     aceita, substituindo o diretor que a própria carga acabara de gravar. A
     marcação passa a acontecer assim que código e e-mail estão bem FORMADOS —
     depois da checagem de repetição, que continua valendo para a linha. */
  if (vistos.inep[inep]) { r.motivo = 'código repetido na carga (linha ' + vistos.inep[inep] + ')'; return r; }
  if (vistos.email[email]) { r.motivo = 'e-mail repetido na carga (linha ' + vistos.email[email] + ')'; return r; }
  vistos.inep[inep] = r.linha; vistos.email[email] = r.linha;
  const base = escolaPorInep_(inep);
  if (!base) { r.motivo = 'escola não está na base da rede'; return r; }
  if (base.situacao && base.situacao !== 'ativa') { r.motivo = 'escola ' + base.situacao + ' na base'; return r; }
  if (s.perfil === 'regional' && String(base.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    r.motivo = 'escola de outra SRE (' + base.sre + ')'; return r;
  }
  r.escola = base.escola; r.sre = base.sre;
  const porEmail = acessoPorEmail_(email);
  const atual = acessoPorInep_(inep);
  if (porEmail && (!atual || porEmail.linha !== atual.linha)) {
    r.motivo = 'e-mail já responde por ' + (porEmail.escola || porEmail.sre || nomeDoPapel_(papelDe_(porEmail))); return r;
  }
  if (atual) {
    if (atual.email === email) { r.motivo = 'já é o diretor em exercício desta escola'; r.semMudanca = true; return r; }
    if (somenteSemDiretor) { r.motivo = 'escola já tem diretor (' + (atual.nome || atual.email) + ')'; return r; }
    r.substitui = atual.nome || atual.email;
  }
  if (!emailInstitucional_(email)) r.aviso = 'e-mail fora do domínio — entra por senha, pelo convite';
  r.ok = true;
  return r;
}
/** Confere uma linha de membro do colegiado; devolve {ok, motivo}. */
function conferirMembro_(s, c, vistos, linha) {
  const nome = String(c[0] || '').trim();
  const email = String(c[1] || '').trim().toLowerCase();
  const segmento = String(c[2] || '').trim();
  const r = { linha: linha || 0, nome: nome, email: email, segmento: segmento, ok: false, motivo: '', aviso: '' };
  if (!nome) { r.motivo = 'sem nome'; return r; }
  if (!EMAIL_RE.test(email)) { r.motivo = 'e-mail inválido'; return r; }
  if (!segmento) { r.motivo = 'sem segmento (Docente, Estudante, Família, Servidor, Comunidade…)'; return r; }
  if (vistos.email[email]) { r.motivo = 'e-mail repetido na carga (linha ' + vistos.email[email] + ')'; return r; }
  vistos.email[email] = r.linha;   // v8.13 (C08): ver conferirDiretor_
  if (email === String(s.email || '').toLowerCase()) { r.motivo = 'é o e-mail da própria direção'; return r; }
  const cad = acessoPorEmail_(email);
  if (cad) {
    if (papelDe_(cad) === 'diretor_escolar') { r.motivo = 'e-mail de um diretor escolar'; return r; }
    if (cad.inep !== String(s.inep || '').replace(/\D/g, '')) { r.motivo = 'já é membro do colegiado de outra escola (' + (cad.escola || cad.inep) + ')'; return r; }
    r.motivo = 'já é membro do colegiado desta escola'; r.semMudanca = true; return r;
  }
  if (!emailInstitucional_(email)) r.aviso = 'e-mail fora do domínio — entra por senha, pelo convite';
  r.ok = true;
  return r;
}
/**
 * O motor da carga. tipo: 'diretores' | 'colegiado'.
 *   payload: { token, texto, simular, chave, somenteSemDiretor, de }
 * Devolve, na simulação: { ok, simulacao:true, chave, total, aceitas, recusadas,
 *   substituicoes, itens:[{linha, ok, motivo, …}] }. Na carga: { ok, processadas,
 *   aceitas, recusadas, proximo (ou 0), itens (do lote), convitesFila, boasVindas }.
 */
function importarAcessos_(tipo, payload) {
  const p = payload || {};
  const s = sessao_(p.token);
  const papelS = papelDaSessao_(s);
  if (tipo === 'diretores') {
    if (!podeGerirBase_(papelS)) {   /* v9.7: a carga da implantação fica com o Órgão Central */
      return { ok: false, erro: nomeDoPapel_(papelS) + ' não gere os diretores escolares. A carga em lote é do Órgão Central, na implantação, e da Diretoria Educacional da Superintendência.' };
    }
  } else if (papelS !== 'diretor_escolar' || !s.inep) {
    return { ok: false, erro: 'Só a direção escolar cadastra os membros do colegiado da sua escola.' };
  }
  const linhas = linhasDaCarga_(p.texto).filter(function (l) {
    return !/^\s*(c[óo]digo|inep|nome)\b/i.test(l.txt);      // cabeçalho colado junto
  });
  if (!linhas.length) {
    return { ok: false, erro: tipo === 'diretores'
      ? 'Cole ao menos uma linha, no formato código; nome; MASP; e-mail.'
      : 'Cole ao menos uma linha, no formato nome; e-mail; segmento.' };
  }
  if (linhas.length > 5000) return { ok: false, erro: 'No máximo 5.000 linhas por carga. Divida o arquivo.' };
  const somenteSem = !!p.somenteSemDiretor;
  const opcoes = tipo + '|' + (somenteSem ? 'sem' : 'todas');
  /* v8.13 (C08): a intenção declarada manda. Carga real é simular:false MAIS
     chave válida — conhecer o texto nunca substituiu simular, e agora não
     substitui mesmo. */
  const simular = p.simular !== false && p.simular !== 'false';
  if (!simular && !conferirChaveDeCarga_(s, p.chave, tipo, p.texto, opcoes)) {
    return { ok: false, erro: 'Simule a carga antes de importar: a chave não corresponde ao texto conferido, ' +
      'é de outra sessão ou já venceu (ela vale 30 minutos). Simule de novo.' };
  }
  const vistos = { inep: {}, email: {} };
  const itens = [];
  let aceitas = 0, recusadas = 0, substituicoes = 0, semMudanca = 0;
  linhas.forEach(function (l) {
    const r = tipo === 'diretores' ? conferirDiretor_(s, l.c, somenteSem, vistos, l.n) : conferirMembro_(s, l.c, vistos, l.n);
    r.linha = l.n;
    if (r.ok) { aceitas++; if (r.substitui) substituicoes++; }
    else { recusadas++; if (r.semMudanca) semMudanca++; }
    itens.push(r);
  });
  if (simular) {
    const chave = emitirChaveDeCarga_(s, tipo, p.texto, opcoes);
    registrarHistorico_(s.nome || s.email, 'carga de ' + tipo + ' simulada', '—', '',
      linhas.length + ' linha(s): ' + aceitas + ' aceita(s), ' + recusadas + ' recusada(s), ' + substituicoes + ' substituição(ões)');
    return { ok: true, simulacao: true, chave: chave, total: linhas.length, aceitas: aceitas, recusadas: recusadas,
             substituicoes: substituicoes, semMudanca: semMudanca, somenteSemDiretor: somenteSem,
             itens: itens.map(function (r) { return { linha: r.linha, ok: r.ok, motivo: r.motivo, aviso: r.aviso, substitui: r.substitui || '',
               nome: r.nome, email: r.email, inep: r.inep || '', escola: r.escola || '', segmento: r.segmento || '' }; }) };
  }
  /* carga real, por lotes — a trava uma vez, o cadastro linha a linha */
  const de = Math.max(0, parseInt(p.de, 10) || 0);
  /* v8.13 (C08): "carga concluída" sem ter gravado nada é a pior resposta
     possível para quem acompanha o progresso. Ponto de continuação fora da
     faixa é erro. */
  if (de >= itens.length) {
    return { ok: false, erro: 'A carga já foi concluída ou o ponto de continuação é inválido. Simule de novo.' };
  }
  const lote = itens.slice(de, de + LOTE_MAX);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    acessosTodos_(); gestoresTodos_();   // uma leitura de cada; as gravações atualizam a memória
    let feitas = 0, falhas = 0, convitesFila = 0, boasVindas = 0;
    const resultado = [];
    lote.forEach(function (r) {
      if (!r.ok) { resultado.push({ linha: r.linha, ok: false, motivo: r.motivo, email: r.email }); return; }
      const pedido = tipo === 'diretores'
        ? { token: p.token, papel: 'diretor_escolar', inep: r.inep, nome: r.nome, masp: r.masp, email: r.email, modo: 'novo' }
        : { token: p.token, papel: 'colegiado', nome: r.nome, email: r.email, segmento: r.segmento };
      let res;
      /* v9.7: a CARGA EM LOTE da implantação é do Órgão Central — a trava de
         competência que vale para o cadastro um a um (Diretoria Educacional)
         não se aplica aqui, e a porta desta função já a conferiu acima. */
      try { res = acessoSalvarSemTrava_(pedido, { emLote: true, modoEnvio: 'fila', cargaDaImplantacao: tipo === 'diretores' }); }
      catch (e) { res = { ok: false, erro: String(e.message || e) }; }
      if (res && res.ok) {
        feitas++;
        if (res.conviteModo === 'fila') convitesFila++;
        if (res.conviteModo === 'boas-vindas') boasVindas++;
        resultado.push({ linha: r.linha, ok: true, email: r.email, substituiu: res.substituiu || '', conviteModo: res.conviteModo });
      } else {
        falhas++;
        resultado.push({ linha: r.linha, ok: false, motivo: (res && res.erro) || 'recusada', email: r.email });
      }
    });
    const proximo = (de + LOTE_MAX < itens.length) ? de + LOTE_MAX : 0;
    /* v8.13 (C08): a chave acompanha a carga enquanto ela dura e é consumida
       no último lote — uso único. */
    if (proximo) renovarChaveDeCarga_(p.chave); else consumirChaveDeCarga_(p.chave);
    registrarHistorico_(s.nome || s.email, 'carga de ' + tipo + ' importada', '—', '',
      'linhas ' + (de + 1) + '–' + (de + lote.length) + ' de ' + itens.length + ': ' + feitas + ' gravada(s), ' +
      (lote.length - feitas) + ' recusada(s)' + (proximo ? ' · continua' : ' · concluída'));
    return { ok: true, chave: String(p.chave || ''), total: itens.length, de: de, processadas: lote.length, proximo: proximo,
             gravadas: feitas, recusadas: lote.length - feitas, falhas: falhas,
             convitesFila: convitesFila, boasVindas: boasVindas, itens: resultado,
             concluida: !proximo };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}
/** Carga de diretores: Órgão Central (toda a rede) ou quem associa diretores (na própria SRE). */
/**
 * v9.8 — A CARGA DE DIRETORES EM LOTE SAIU DA INTERFACE.
 *
 * A coordenação desativou o painel "Importar diretores em lote": o cadastro
 * do diretor de cada escola passa a ser sempre individual, pela janela da
 * escola, onde quem cadastra vê o que está fazendo — quem sai, quem entra e
 * o histórico da escola. A função continua aqui, fora de API_TELA, chamável
 * apenas pelo menu do Órgão Central na planilha, para a carga da implantação
 * da rede. Nenhuma tela a alcança.
 */
/* v9.8 — A CARGA DE DIRETORES DEIXOU DE SER FUNÇÃO PÚBLICA.
   Até a 9.7 ela era `diretoresImportar`, no mapa API_TELA, com painel na
   aba "Acessos das escolas". A coordenação decidiu desativá-la na tela: o
   diretor é associado à escola um a um, com autor e data, e é isso que o
   histórico registra. A carga continua sendo necessária UMA vez — a
   implantação, com os 3.401 diretores da rede —, e para isso existe
   `menuImportarDiretores`, invólucro de menu da planilha (somenteMenu_),
   logo abaixo. O nome público sumiu de vez: fora de API_TELA e sem
   invólucro, ele seria função pública sem contrato — o que verifica.js
   recusa, e com razão. Quem carrega agora é o menu, chamando direto a
   rotina privada `importarAcessos_('diretores', …)`. */
/* a sessão da rotina de menu: o Órgão Central, identificado pela conta que
   abriu a planilha — é a mesma identidade que os demais menus usam */
function tokenDoMenu_() {
  let email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { email = ''; }
  return criarSessao_({ email: email || 'menu@planilha', nome: email || 'Órgão Central (menu)',
                        perfil: 'central', papel: 'central' });
}
function menuImportarDiretores() {
  somenteMenu_();
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Carga de diretores (implantação)',
    'Cole as linhas no formato: código da escola; nome; MASP; e-mail. A carga é simulada primeiro.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const texto = String(r.getResponseText() || '');
  const sim = importarAcessos_('diretores', { token: tokenDoMenu_(), texto: texto, simular: true });
  if (!sim.ok) { ui.alert('Carga de diretores', sim.erro || 'Não foi possível simular.', ui.ButtonSet.OK); return; }
  const seguir = ui.alert('Carga de diretores',
    sim.total + ' linhas: ' + sim.aceitas + ' aceitas, ' + sim.recusadas + ' recusadas. Gravar as aceitas?',
    ui.ButtonSet.YES_NO);
  if (seguir !== ui.Button.YES) return;
  let de = 0, gravadas = 0;
  for (let volta = 0; volta < 60; volta++) {
    const c = importarAcessos_('diretores', { token: tokenDoMenu_(), texto: texto, simular: false, chave: sim.chave, de: de });
    if (!c.ok) { ui.alert('Carga de diretores', c.erro || 'Falha na carga.', ui.ButtonSet.OK); return; }
    gravadas += c.gravadas;
    if (!c.proximo) break;
    de = c.proximo;
  }
  ui.alert('Carga de diretores', gravadas + ' cadastros gravados.', ui.ButtonSet.OK);
}
/** Carga do colegiado: a direção escolar, para a própria escola. */
/**
 * v8.12 — A CARGA EM LOTE DO COLEGIADO SAIU.
 *
 * Ela existia para poupar digitação, e poupava. Mas cada membro do Colegiado
 * é uma pessoa que vai ASSINAR o Projeto Político-Pedagógico, e cadastrá-la
 * é um ato de gestão de acesso: tem autor, tem data e, quando a pessoa não é
 * servidora, tem de dizer qual é a relação dela com a escola. Colar vinte
 * linhas de uma vez atropela as três coisas — o histórico registra um lote,
 * e não vinte decisões.
 *
 * A função continua existindo, e recusando: uma tela antiga, um atalho
 * guardado ou uma chamada direta não devem silenciosamente voltar a gravar.
 */
function colegiadoImportar(payload) {
  return { ok: false, erro: 'O cadastro do Colegiado Escolar é feito membro a membro. ' +
    'Cada pessoa que vai assinar o PPP entra com o seu segmento e, quando não é servidora da rede, ' +
    'com a relação que tem com a escola — e o histórico guarda quem a cadastrou.' };
}

/**
 * O link do convite de primeiro acesso, para copiar da tela e entregar por
 * outro canal (v7.6, P4). Só quem pode reenviar o convite pode copiá-lo, e
 * só enquanto ele está pendente e no prazo.
 */
function conviteLink(payload) {
  const s = sessao_(payload && payload.token);
  const email = String(payload && payload.email || '').trim().toLowerCase();
  const cad = acessoPorEmail_(email);
  if (!cad) return { ok: false, erro: 'Acesso não encontrado.' };
  if (s.perfil === 'regional' && String(cad.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return { ok: false, erro: 'Este acesso não pertence à sua Superintendência Regional de Ensino.' };
  }
  if (s.perfil === 'escola' && cad.inep !== String(s.inep || '')) return { ok: false, erro: 'Este acesso não pertence à sua escola.' };
  const recusa = recusaGestaoDeAcesso_(s, cad);
  if (recusa) return { ok: false, erro: recusa };
  if (!cad.token) return { ok: false, erro: cad.hash ? 'Esta pessoa já definiu a senha: não há convite pendente.' : 'Não há convite pendente. Reenvie o convite para gerar um novo link.' };
  const ate = dataDe_(cad.tokenAte);
  if (ate && ate.getTime() < Date.now()) return { ok: false, erro: 'O convite expirou em ' + cad.tokenAte + '. Reenvie o convite para gerar um novo link.' };
  registrarHistorico_(s.nome || s.email, 'link de primeiro acesso copiado', cad.email, '', cad.tokenAte);
  return { ok: true, link: linkPrimeiroAcesso_(cad.token), ate: cad.tokenAte, email: cad.email };
}

/**
 * v7.3 (T-11) — Quem pode REMOVER (ou reenviar o convite de) um cadastro,
 * decidido pelo papel de quem pede e pelo papel de quem é alvo:
 *   · a direção escolar remove o COLEGIADO da própria escola;
 *   · um papel institucional remove quem a sua linha em PAPEIS.cadastra
 *     autoriza (o Superintendente remove DE e CI; o DE, a equipe_de; o CI, a
 *     equipe_inspecao), dentro da própria SRE;
 *   · quem associa diretores remove o DIRETOR ESCOLAR da própria SRE;
 *   · o Órgão Central remove qualquer um.
 * Devolve a mensagem de recusa, ou '' quando pode.
 */
function recusaGestaoDeAcesso_(s, cad) {
  const papelS = papelDaSessao_(s), papelAlvo = papelDe_(cad);
  if (s.perfil === 'central') return '';
  if (s.perfil === 'escola') {
    if (papelS !== 'diretor_escolar') return ERRO_SO_DIRECAO;
    if (papelAlvo !== 'colegiado' || cad.inep !== String(s.inep || '').replace(/\D/g, '')) {
      return 'A direção escolar só gere os membros do colegiado da própria escola.';
    }
    return '';
  }
  if (String(cad.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return 'Este acesso não pertence à sua Superintendência Regional de Ensino.';
  }
  if (papelAlvo === 'diretor_escolar') {
    return podeAssociar_(papelS) ? '' :
      nomeDoPapel_(papelS) + ' não gere os diretores escolares: isso cabe à Diretoria Educacional da Superintendência e à sua equipe.';
  }
  if (papelAlvo === 'colegiado') return 'O colegiado de uma escola é gerido pela direção dela.';
  const cadastra = (PAPEIS[papelS] || { cadastra: [] }).cadastra;
  return cadastra.indexOf(papelAlvo) >= 0 ? '' :
    nomeDoPapel_(papelS) + ' não remove ' + nomeDoPapel_(papelAlvo) + '. ' +
    (cadastra.length ? 'Remove quem cadastra: ' + cadastra.map(nomeDoPapel_).join(', ') + '.' : 'Este perfil não cadastra nem remove ninguém.');
}

function acessoRemover(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    /* v7.3 (T-11) — qualquer sessão entra; quem pode remover quem é decidido
       por papel, em recusaGestaoDeAcesso_. */
    const s = sessao_(payload && payload.token);
    const email = String(payload && payload.email || '').trim().toLowerCase();
    const cad = acessoPorEmail_(email);
    if (!cad) return { ok: false, erro: 'Acesso não encontrado.' };
    const recusa = recusaGestaoDeAcesso_(s, cad);
    if (recusa) return { ok: false, erro: recusa };
    const papelAlvo = papelDe_(cad);
    /* O motivo informado na janela de desativação vale mais que a frase
       genérica: é o que o histórico vai mostrar daqui a dois anos. */
    const motivo = String(payload && payload.motivo || '').trim();
    abaAcessos_().deleteRow(cad.linha); invalidarAcessos_();
    /* v8.12: o colegiado também tem período, e remover um membro o encerra —
       com o nome de quem removeu e o motivo que a janela pediu */
    gestorFechar_(papelAlvo === 'colegiado'
                    ? { perfil: 'colegiado', email: cad.email, inep: cad.inep }   // v8.13 (C05): a chave do colegiado inclui a escola
                    : { perfil: cad.perfil, inep: cad.inep, email: cad.email },
                  motivo || ('acesso removido por ' + (s.nome || s.email)),
                  s.nome || s.email);
    /* v8.13 (E19, A8-20): removido o cadastro do membro do Colegiado, a
       relação já gravada em períodos anteriores é TARJADA — o período, a
       pessoa, as datas e os autores permanecem. É o caminho de exclusão que
       faltava ao vínculo nominal com um estudante identificado. */
    let tarjados = 0;
    if (papelAlvo === 'colegiado') {
      tarjados = tarjarRelacaoNoHistorico_(cad.email, cad.inep);
      if (tarjados) {
        registrarHistorico_(s.nome, 'relação com a escola removida do histórico', email,
          '', tarjados + ' período(s) · ' + (cad.escola || ''));
      }
    }
    registrarHistorico_(s.nome, 'acesso removido', email,
      nomeDoPapel_(papelAlvo) + ' · ' + (cad.escola || cad.sre), motivo);
    if (s.perfil === 'escola') return colegiadoListar({ token: payload.token });
    if (papelAlvo === 'diretor_escolar') return escolasListar({ token: payload.token });
    return acessosListar({ token: payload.token });
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   CURADORIA DE CONTEÚDO (v6.2)
   Permite ao Órgão Central alterar os textos do sistema sem
   depender da equipe de desenvolvimento. Na aba "Conteúdo" ficam
   apenas as DIFERENÇAS em relação ao texto original do código:
   um par "caminho → valor". Publicar troca o texto para toda a
   rede; restaurar apaga a diferença e o texto original volta.
   PPPs já concluídos não mudam: o conteúdo deles foi congelado
   no Drive no momento da conclusão.
   ============================================================ */

const NOME_ABA_CONTEUDO = 'Conteúdo';
/* v8.13 (E03): os cabeçalhos que estavam escritos em literal viram constantes
   — sem elas não há o que conferir contra a planilha. */
const CONTEUDO_COLS = ['Caminho', 'Rótulo', 'Valor publicado (JSON)',
  'Valor em rascunho (JSON)', 'Ação pendente', 'Atualizado em', 'Autor'];
const NOME_ABA_HISTORICO = 'Curadoria — histórico';
const CUR_HIST_COLS = ['Data', 'Autor', 'Ação', 'Caminho', 'Valor anterior', 'Valor novo'];

/** E-mails do Órgão Central autorizados a abrir a curadoria. */
const CURADORES = [
  // 'fulano@educacao.mg.gov.br',
];

/* v8.4 — o contador de tentativas da porta do Órgão Central. A senha é uma
   só, compartilhada: o contador dela também é um só. */
const PROP_TENT_CENTRAL = 'CENTRAL_TENT';
const PROP_HASH = 'CURADORIA_HASH';
const PROP_SAL  = 'CURADORIA_SAL';
/** A senha institucional confere? Aceita o hash antigo (v1) e o novo (v2). */
function senhaCuradoriaConfere_(senha) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty(PROP_HASH), sal = props.getProperty(PROP_SAL);
  if (!hash) return false;
  const v = props.getProperty(PROP_HASH + '_V') === '2' ? '2' : '1';
  return hashSenha_(String(senha || ''), sal, v) === hash;
}
const PROP_VER  = 'CONTEUDO_VERSAO';
/* v8.13 (E04): PROP_TENT era o contador GLOBAL da porta paralela da
   curadoria, que foi retirada. Ele continua declarado e continua sendo
   apagado por definirSenhaCuradoria_, para não deixar lixo em implantação
   antiga; nada mais o escreve. O contador que vale é o de
   entrarInstitucional, que é POR E-MAIL (PROP_TENT_CENTRAL e a chave de
   cache), e não derruba a porta para todos. */
const PROP_TENT = 'CURADORIA_TENTATIVAS';
const CUR_HORAS = 4;
const CUR_MAX_TENTATIVAS = 5;
const CUR_MAX_CARACTERES = 40000;

/** Textos que vivem no servidor: e-mails e trechos gerados no PDF. */
const PADRAO_SERVIDOR = {
  /* v8.1 — não há mais link individual de assinatura: quem foi marcado como
     presente na reunião de aprovação entra no sistema com o acesso que já tem
     e encontra o documento esperando a sua assinatura. Este é o aviso. */
  'EMAIL.pendente.assunto': 'Há um PPP esperando a sua assinatura — {escola}',
  'EMAIL.pendente.corpo':
    'Prezado(a) {nome},\n\n' +
    'O Projeto Político-Pedagógico da {escola} foi concluído e a direção registrou a sua presença na ' +
    'reunião do Colegiado Escolar que o aprovou. O documento está esperando a sua assinatura, nos termos ' +
    'do art. 7º da resolução pedagógica vigente.\n\n' +
    'Entre no sistema com o seu acesso de Colegiado Escolar, pelo endereço abaixo: o documento aparece em ' +
    '"Minhas assinaturas", onde você pode lê-lo em PDF e assinar. O registro guarda data e hora.\n\n' +
    '{url}\n\n' +
    'Protocolo {protocolo} · código de verificação {hash}',
  'EMAIL.assinado.assunto': 'PPP integralmente assinado — {escola}',
  'EMAIL.assinado.corpo':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b> recebeu todas as {total} assinaturas previstas ' +
    'e está concluído.</p>' +
    '<p><b>Falta um passo:</b> anexar a ata da reunião do Colegiado Escolar que aprovou o documento. ' +
    'Abra o sistema, vá até a tela final e registre a aprovação definitiva.</p>',
  /* v8.13 (D06): o mesmo aviso, para o documento que já seguiu para a SRE —
     assinado o termo pela direção, o que falta não é a ata, é a homologação. */
  'EMAIL.assinado.corpoHomologacao':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b> recebeu todas as {total} assinaturas previstas.</p>' +
    '<p>Todas as assinaturas foram colhidas; o documento segue para homologação pela Superintendência ' +
    'Regional de Ensino. Não há mais nenhum passo a cumprir pela escola.</p>',
  /* v7.4 (P1): o link do e-mail leva ao app, onde o PDF é baixado após a autorização */
  'EMAIL.assinado.botao': 'Abrir o documento assinado no sistema e baixar o PDF',
  /* v7.7 (P6): avisos nos atos do ciclo de validação — pela fila de e-mails */
  'EMAIL.validacao.enviado.assunto': 'PPP enviado para validação — {escola}',
  'EMAIL.validacao.enviado.corpo':
    '<p>A direção da <b>{escola}</b> ({diretor}) enviou o Projeto Político-Pedagógico, protocolo {protocolo}, ' +
    'para validação da Diretoria Educacional em {quando}.</p>' +
    '<p>Abra o sistema para ler o documento e validá-lo, ou devolvê-lo à escola com parecer.</p>',
  'EMAIL.validacao.validado.assunto': 'PPP validado — {escola}',
  'EMAIL.validacao.validado.corpo':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b>, protocolo {protocolo}, foi validado pela Diretoria ' +
    'Educacional ({por}) em {quando}.</p>{parecer}' +
    '<p>O passo seguinte é concluir o documento no sistema e colher as assinaturas da direção e do Colegiado Escolar.</p>',
  'EMAIL.validacao.devolvido.assunto': 'PPP devolvido para ajustes — {escola}',
  'EMAIL.validacao.devolvido.corpo':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b>, protocolo {protocolo}, foi devolvido pela Diretoria ' +
    'Educacional ({por}) em {quando}, com o parecer:</p>' +
    /* v8.13 (E05): sem atributo. O texto curado passou a ser lista branca de
       marcação SEM atributo nenhum (é o que fecha o XSS armazenado), e um
       padrão que depende de `style=` seria silenciosamente despido na
       primeira vez que a curadoria republicasse este texto. O <blockquote>
       puro já é recuado pelos clientes de e-mail. */
    '<blockquote>{parecer}</blockquote>' +
    '<p>O documento voltou a ser editável. Faça os ajustes indicados e envie de novo para validação.</p>',
  'EMAIL.validacao.botao': 'Abrir o Gerador de PPP',
  'DOC.folha.titulo': '22. Folha de assinaturas',
  'DOC.folha.intro':
    'Documento concluído em {concluidoEm}, sob o protocolo {protocolo}{versao}. Assinam abaixo a direção ' +
    'escolar e os membros do Colegiado Escolar que compareceram à reunião de aprovação, cada um mediante ' +
    'declaração expressa de leitura e aprovação do documento, registrada nesta plataforma.',
  'DOC.folha.acompanhamento': 'Acompanhado por',
  'DOC.folha.homologacao': 'Homologado pela Superintendência Regional de Ensino de {sre} em {data}{ato}, registrado por {por}.',
  /* v8.2 — assinado o termo pela direção, o documento segue na hora para quem
     homologa; este é o aviso que a equipe da Diretoria Educacional recebe. */
  'EMAIL.homologacao.pedido.assunto': 'PPP aguardando homologação — {escola}',
  'EMAIL.homologacao.pedido.corpo':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b>, protocolo {protocolo}, foi assinado pela direção escolar ' +
    '({diretor}) em {quando} e segue para homologação por esta Superintendência Regional de Ensino.</p>' +
    '<p>A ata da reunião do Colegiado Escolar que aprovou o documento está anexada, e a folha de assinaturas traz ' +
    'quem compareceu. Para homologar, abra o PPP no painel e confirme: a data do ato é registrada no momento da ' +
    'confirmação.</p>',
  'EMAIL.homologado.assunto': 'PPP homologado pela SRE — {escola}',
  'EMAIL.homologado.corpo':
    '<p>O Projeto Político-Pedagógico da <b>{escola}</b>, protocolo {protocolo}, foi homologado pela Superintendência ' +
    'Regional de Ensino ({por}) em {quando}{ato}.</p>' +
    '<p>O documento está encerrado. A próxima revisão deve ocorrer em até dois anos, por meio de uma nova versão no sistema.</p>',
  /* v8.7 (C2) */
  'EMAIL.homologacaoDesfeita.assunto': 'Homologação desfeita — {escola}',
  'EMAIL.homologacaoDesfeita.corpo':
    '<p>A homologação do Projeto Político-Pedagógico da <b>{escola}</b>, protocolo {protocolo}, registrada em ' +
    '{antes}, foi desfeita por {por} em {quando}.</p>' +
    '<p><b>Motivo informado:</b> {motivo}</p>' +
    '<p>O documento voltou à situação de aguardando homologação. Se houver assinatura pendente do Colegiado ' +
    'Escolar, ela pode ser colhida agora, antes de nova homologação.</p>',
  /* v8.13 (D05) — a redação anterior dizia que "qualquer alteração posterior
     no conteúdo produz código distinto", o que é falso: o código é do CORPO
     congelado na conclusão, e os atos posteriores previstos (assinaturas,
     ata, homologação) acrescentam-se à folha sem alterá-lo. Só o PADRÃO muda:
     quem já concluiu tem o texto congelado em `textosFolha` (v8.11) e
     continua com a redação que assinou. */
  'DOC.folha.codigo':
    'Assinaturas registradas: {assinados} de {total}. Código de autenticidade do conteúdo: <b>{hash}</b> ' +
    '(SHA-256 do Projeto Político-Pedagógico congelado na conclusão). O código responde pelo conteúdo do ' +
    'documento; esta folha registra os atos posteriores previstos — assinaturas, ata de aprovação e ' +
    'homologação —, que se acrescentam sem alterá-lo. Conteúdo alterado exige nova versão, com novo código.',
  'DOC.previa': 'PRÉVIA — documento ainda não concluído nem assinado. Gerado em {agora}.'
};

/* ---- leitura dos textos do servidor, já com a curadoria aplicada ----
   A leitura da aba "Conteúdo" é guardada durante a execução: um envio de
   convites a doze membros chegava a reler a planilha inteira 25 vezes. */
let _conteudoCache = null;
function conteudoAtual_() {
  if (!_conteudoCache) _conteudoCache = conteudoPublicado();
  return _conteudoCache;
}
function limparCacheConteudo_() { _conteudoCache = null; }
function txtServidor_(chave) {
  const itens = conteudoAtual_().itens;
  return (itens && itens[chave] != null) ? String(itens[chave]) : (PADRAO_SERVIDOR[chave] || '');
}
/* ============================================================
   v8.13 (E06, A7-10) — O CAMINHO DO CONTEÚDO É CONFERIDO

   `curadoriaSalvar` conferia `if (!caminho || caminho.length > 200)` e nada
   mais. Um erro de digitação — ou um cliente adulterado — gravava chave
   inventada, inclusive `__proto__.poluido`: ela contava como pendência, era
   publicada, e a tela só registrava um `console.warn` que ninguém vê. O lixo
   ficava na planilha e na versão publicada para sempre.

   Agora o caminho passa por uma GRAMÁTICA FECHADA: raiz numa lista, até oito
   segmentos, cada um `[A-Za-z][A-Za-z0-9_]*` ou índice numérico, 200
   caracteres. `__proto__`, `prototype` e `constructor` são recusados em
   qualquer posição. Para as raízes que o SERVIDOR conhece por inteiro
   (EMAIL. e DOC.), a conferência é exata contra PADRAO_SERVIDOR: caminho que
   não existe lá é recusado nomeando a chave. Para as demais, a gramática é o
   que o servidor pode garantir — o resto vem da faixa de alerta da tela, que
   passa a mostrar o que ela não reconheceu.

   A lista de raízes foi conferida contra a saída de montarMapa(): os 1.079
   caminhos editáveis passam, um a um (há verificação disso na bateria).
   ============================================================ */
const RAIZES_CONTEUDO = ['ABERTURAS', 'CHECK', 'DOC', 'EMAIL', 'ETAPAS', 'IND_ALERTA', 'INFRA',
  'METODOS', 'MODALIDADES', 'MODULOS', 'NOVOS', 'OCULTOS', 'PRINCIPIOS', 'REDE', 'REF_COND',
  'REF_LEGISLACAO', 'SECOES', 'SEGMENTOS', 'SRES', 'SUBSECOES', 'T', 'TELAS', 'TEMAS', 'UI',
  'VAZIOS', 'VIDEOS'];
const SEGMENTOS_PROIBIDOS = ['__proto__', 'prototype', 'constructor'];
/** '' quando o caminho é válido; a razão da recusa quando não é. */
function caminhoDeConteudo_(c) {
  const caminho = String(c == null ? '' : c).trim();
  if (!caminho) return 'caminho vazio';
  if (caminho.length > 200) return 'caminho com mais de 200 caracteres';
  const partes = caminho.split('.');
  if (partes.length > 8) return 'caminho com mais de 8 níveis';
  if (RAIZES_CONTEUDO.indexOf(partes[0]) < 0) {
    return 'a raiz "' + partes[0] + '" não é editável pela curadoria';
  }
  for (let i = 0; i < partes.length; i++) {
    const seg = partes[i];
    if (SEGMENTOS_PROIBIDOS.indexOf(seg.toLowerCase()) >= 0) return 'o segmento "' + seg + '" não é permitido';
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(seg) && !/^[0-9]+$/.test(seg)) {
      return 'o segmento "' + seg + '" não é um nome nem um índice';
    }
  }
  /* as raízes que o SERVIDOR conhece por inteiro: conferência exata */
  if (partes[0] === 'EMAIL' || partes[0] === 'DOC') {
    if (!Object.prototype.hasOwnProperty.call(PADRAO_SERVIDOR, caminho)) {
      return 'não existe texto do servidor com este caminho';
    }
  }
  return '';
}

/* ============================================================
   v10.2 — O SERVIDOR NÃO CONHECE MAIS "REDE"

   A v8.13 (E06, A7-11) ensinou o servidor a resolver {{REDE.chave}}, porque
   o marcador saía literal no assunto do e-mail e ia congelado para dentro do
   PDF. REDE_PADRAO era a cópia literal de App.html:REDE, e o verifica.js
   comparava as duas para que não houvesse duas verdades.

   Decisão da coordenação (v10.2): os marcadores saíram do sistema. A citação
   está escrita em cada texto, e é lá que o Órgão Central a altera. Com eles
   saíram o bloco de parâmetros, a cópia do servidor e a resolução — não há
   mais duas verdades porque não há mais a segunda.

   O que CONTINUA: `preencher_` resolve os marcadores de UMA chave ({escola},
   {protocolo}, {link}), que são dados daquela chamada e não texto curável;
   e a conferência abaixo, que recusa texto de e-mail ou de folha com
   qualquer {{…}} — agora nenhum é resolvido por ninguém, e um marcador que
   escape sairia literal no e-mail e dentro do PDF.
   ============================================================ */
/** v10.2: TODO {{…}} num texto do servidor fica sem resolver — não há mais
    marcador aceito. O que passar daqui sai literal no e-mail e no PDF. */
function marcadoresNaoResolvidos_(texto) {
  const faltam = [];
  String(texto == null ? '' : texto).replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (m, dentro) {
    if (faltam.indexOf(dentro) < 0) faltam.push(dentro);
    return m;
  });
  return faltam;
}

/**
 * v8.13 (F03) — os marcadores de UMA chave (`{chave}`) que `dados` não traz.
 * Irmã de `marcadoresNaoResolvidos_`, que trata os `{{…}}`. Serve à prévia da
 * curadoria: o texto curado que amanhã usar um marcador novo aparece na tela
 * como pendência, e não como literal impresso para 3.400 escolas.
 */
function marcadoresSemExemplo_(texto, dados) {
  const faltam = [], d = dados || {};
  String(texto == null ? '' : texto).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (m, k) {
    if (d[k] === undefined && faltam.indexOf(k) < 0) faltam.push(k);
    return m;
  });
  return faltam;
}

function preencher_(texto, dados) {
  /* v10.2: resta o marcador de UMA chave — {escola}, {protocolo}, {link} —,
     que é dado daquela chamada, não texto curável. O de rede saiu com os
     parâmetros: a citação está escrita no texto. */
  return String(texto == null ? '' : texto).replace(/\{(\w+)\}/g, function (m, k) {
    return dados[k] === undefined ? m : String(dados[k]);
  });
}

/* ---- abas de apoio ---- */
function abaConteudo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_CONTEUDO);
  if (!aba) aba = ss.insertSheet(NOME_ABA_CONTEUDO);
  const confC = conferirCabecalho_(aba, CONTEUDO_COLS, NOME_ABA_CONTEUDO);   /* v8.13 (E03) */
  if (confC.vazia) {
    aba.getRange(1, 1, 1, CONTEUDO_COLS.length).setValues([CONTEUDO_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 230); aba.setColumnWidth(2, 260);
    aba.setColumnWidth(3, 320); aba.setColumnWidth(4, 320);
  }
  return aba;
}
function abaHistorico_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_HISTORICO);
  if (aba) conferirCabecalho_(aba, CUR_HIST_COLS, NOME_ABA_HISTORICO);   /* v8.13 (E03) */
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA_HISTORICO);
    aba.getRange(1, 1, 1, CUR_HIST_COLS.length).setValues([CUR_HIST_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(2, 220); aba.setColumnWidth(4, 240);
  }
  return aba;
}
/* ============================================================
   TRÊS REGISTROS (v7.8, P8)
   Até a 7.7 tudo ia para uma aba só, e as entradas no sistema afogavam
   a curadoria (que mostra as últimas 40 linhas). Agora:
     · "Curadoria — histórico": só a curadoria, com o valor anterior
       INTEGRAL, para "voltar a esta versão";
     · "Acessos — histórico": entradas, cadastros, recusas, cargas,
       exportações, fila — com rotação mensal para uma planilha-arquivo
       na pasta de backups (rotacionarHistoricoAcessos_);
     · "Ciclo — histórico": cada ato sobre cada PPP, por protocolo — o que
       alimenta a linha do tempo.
   registrarHistorico_ continua sendo a porta de entrada e ROTEIA pelo
   tipo de ação; registrarCiclo_ é a porta explícita dos atos do ciclo.
   ============================================================ */
const NOME_ABA_HIST_ACESSOS = 'Acessos — histórico';
const ACESSO_HIST_COLS = ['Data', 'Autor', 'Ação', 'Alvo', 'Antes', 'Depois'];
const NOME_ABA_CICLO = 'Ciclo — histórico';
const CICLO_COLS = ['Data', 'Protocolo', 'Ato', 'Autor', 'Papel', 'Detalhe'];
function abaHistAcessos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_HIST_ACESSOS);
  if (aba) conferirCabecalho_(aba, ACESSO_HIST_COLS, NOME_ABA_HIST_ACESSOS);   /* v8.13 (E03) */
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA_HIST_ACESSOS);
    aba.getRange(1, 1, 1, ACESSO_HIST_COLS.length).setValues([ACESSO_HIST_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(2, 220); aba.setColumnWidth(4, 240);
  }
  return aba;
}
function abaCiclo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_CICLO);
  if (aba) conferirCabecalho_(aba, CICLO_COLS, NOME_ABA_CICLO);   /* v8.13 (E03) */
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA_CICLO);
    aba.getRange(1, 1, 1, CICLO_COLS.length).setValues([CICLO_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setColumnWidth(2, 170); aba.setColumnWidth(4, 220); aba.setColumnWidth(6, 320);
    try { aba.getRange(1, 1, aba.getMaxRows(), CICLO_COLS.length).setNumberFormat('@'); } catch (e) {}   /* v8.13 (D15) */
  }
  return aba;
}
const ACAO_CURADORIA_RE = /^(texto |rascunho |entrou na curadoria|senha de curadoria|parâmetro)/i;
function registrarHistorico_(autor, acao, caminho, antes, depois) {
  const corta = function (v, max) { const s = (v == null) ? '' : String(v); return s.length > max ? s.slice(0, max) + '…' : s; };
  if (ACAO_CURADORIA_RE.test(String(acao || ''))) {
    /* o valor anterior fica INTEIRO: é ele que "voltar a esta versão" restaura */
    abaHistorico_().appendRow([agora_(), autor, acao, caminho, corta(antes, 45000), corta(depois, 45000)]);
    return;
  }
  if (/^PPP /.test(String(acao || ''))) {
    registrarCiclo_(caminho, acao, autor, '', [antes, depois].filter(function (x) { return x != null && x !== ''; }).join(' → '));
    return;
  }
  abaHistAcessos_().appendRow([agora_(), autor, acao, caminho, corta(antes, 900), corta(depois, 900)]);
}
/**
 * v8.13 (D06) — O ciclo já registra este ato para este protocolo?
 * Serve aos atos que podem ser alcançados mais de uma vez (o encerramento
 * da coleta é reavaliado a cada assinatura e a cada ata de registro legado):
 * o fato entra uma vez só, e a linha do tempo não repete.
 */
function cicloTemAto_(protocolo, ato) {
  const aba = abaCiclo_();
  const n = aba.getLastRow();
  if (n < 2) return false;
  const alvo = String(protocolo || '').toUpperCase();
  const achados = aba.getRange(2, 2, n - 1, 1).createTextFinder(alvo).matchEntireCell(true).findAll();
  for (let i = 0; i < achados.length; i++) {
    if (String(aba.getRange(achados[i].getRow(), 3).getDisplayValues()[0][0]) === ato) return true;
  }
  return false;
}

/** Um ato sobre um PPP: protocolo, ato, autor, papel (rótulo) e detalhe. */
function registrarCiclo_(protocolo, ato, autor, papel, detalhe) {
  const corta = function (v) { const s = (v == null) ? '' : String(v); return s.length > 900 ? s.slice(0, 900) + '…' : s; };
  const aba = abaCiclo_();
  const linha = [agora_(), String(protocolo || '').toUpperCase(), ato, autor || '', papel || '', corta(detalhe)];
  /* v8.13 (D15): o DETALHE do ciclo carrega texto da escola (o nome da
     escola, o parecer, o motivo). `appendRow` não deixa formatar antes, e
     formatar depois seria tarde — a célula já teria virado fórmula. Por isso
     a linha é escrita por faixa, com o formato de texto posto antes. */
  const destino = aba.getLastRow() + 1;
  aba.getRange(destino, 1, 1, linha.length).setNumberFormat('@');
  aba.getRange(destino, 1, 1, linha.length).setValues([linha]);
}
function rotuloSessao_(s) {
  if (!s) return '';
  return nomeDoPapel_(papelDaSessao_(s)) + (s.perfil === 'escola' ? '' : (s.sre ? ' · ' + s.sre : ''));
}
/**
 * Rotação mensal do histórico de acessos (v7.8, P8): as linhas vão para
 * uma planilha-arquivo na pasta de backups e a aba volta a ter só o
 * cabeçalho. Instalada por instalarAcionadores_ (dia 1, 4h).
 */
/* ============================================================
   v8.13 (E16, A8-05) — A ROTAÇÃO COMPLETA O ARQUIVO DO MÊS E SÓ ENTÃO APAGA.

   Era a ÚNICA rotina de escrita do sistema sem LockService: copiava a aba e
   apagava todas as linhas da aba viva (`deleteRows(2, n-1)`) sem exclusão
   mútua nenhuma — o que entrasse no histórico entre a leitura e a remoção
   sumia. E criava um arquivo NOVO a cada chamada, todos com o mesmo nome
   ("… 2026-09"): duas execuções no mesmo mês espalhavam a trilha por dois
   arquivos homônimos, e quem fosse auditar não teria como saber disso.

   Agora: trava; se já existe o arquivo do mês na pasta de backups, as linhas
   são ACRESCENTADAS a ele (o cabeçalho só é escrito na criação); depois da
   escrita, a contagem de linhas do arquivo é RELIDA, e a aba viva só é
   esvaziada quando o número bate. Trilha de auditoria não se apaga contra
   uma escrita que talvez não tenha acontecido.
   ============================================================ */
function rotacionarHistoricoAcessos_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const aba = abaHistAcessos_();
    const n = aba.getLastRow();
    if (n < 2) { marcarRotina_('rotacionarHistoricoAcessos_'); return { ok: true, linhas: 0 }; }   /* v8.13 (E02) */
    const pasta = pastaBackups_();
    const carimbo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
    const nome = 'Gerador PPP — Acessos histórico ' + carimbo;
    const vals = aba.getRange(1, 1, n, 6).getValues();
    let arquivo = null, criado = false;
    try {
      const achados = pasta.getFilesByName(nome);
      if (achados.hasNext()) arquivo = SpreadsheetApp.openById(achados.next().getId());
    } catch (e) { arquivo = null; }
    if (!arquivo) {
      arquivo = SpreadsheetApp.create(nome);
      criado = true;
      try { DriveApp.getFileById(arquivo.getId()).moveTo(pasta); } catch (e) {}
    }
    let folha = null;
    try { folha = arquivo.getSheetByName(NOME_ABA_HIST_ACESSOS); } catch (e) { folha = null; }
    if (!folha) folha = arquivo.getSheets()[0];
    folha.setName(NOME_ABA_HIST_ACESSOS);
    const antes = folha.getLastRow();
    /* o cabeçalho não se reescreve a cada acréscimo: ele só vai na criação */
    const corpo = (antes >= 1) ? vals.slice(1) : vals;
    const destino = (antes >= 1) ? antes + 1 : 1;
    let gravou = true;
    try { folha.getRange(destino, 1, corpo.length, 6).setValues(corpo); }
    catch (e) { gravou = false; }
    const esperado = (antes >= 1 ? antes : 0) + corpo.length;
    const depois = gravou ? folha.getLastRow() : antes;
    if (!gravou || depois !== esperado) {
      /* a aba viva CONTINUA CHEIA — e o porquê fica registrado nela mesma */
      registrarHistorico_('sistema', 'histórico de acessos NÃO arquivado', nome, '',
        'a escrita do arquivo do mês não pôde ser confirmada (' + depois + ' linha(s), esperadas ' +
        esperado + ') — nenhuma linha foi apagada da aba');
      return { ok: false, linhas: 0, arquivo: nome,
               erro: 'A cópia do histórico não pôde ser confirmada; nada foi apagado.' };
    }
    aba.deleteRows(2, n - 1);
    registrarHistorico_('sistema', 'histórico de acessos arquivado', nome, '',
      (n - 1) + ' linha(s)' + (criado ? '' : ' acrescentada(s) ao arquivo do mês, que passou a ter ' + (depois - 1)));
    marcarRotina_('rotacionarHistoricoAcessos_');   /* v8.13 (E02) */
    return { ok: true, linhas: n - 1, arquivo: nome, criado: criado, total: depois - 1 };
  } finally { lock.releaseLock(); }
}
/**
 * A linha do tempo de um PPP (v7.8, P8): os atos do "Ciclo — histórico" por
 * protocolo (createTextFinder na coluna) mais as datas gravadas no próprio
 * registro — para os PPPs anteriores à 7.8, que não têm atos registrados.
 * Visível à escola dona, à regional da escola e ao Central.
 */
function linhaDoTempo(payload) {
  const p = payload || {};
  const s = sessao_(p.token);
  const aba = abaRegistros_();
  const linha = linhaDoProtocolo_(aba, p.protocolo);
  if (!linha) return { ok: false, erro: 'Protocolo não encontrado.' };
  const reg = lerLinhaChaves_(aba, linha, ['protocolo', 'escola', 'inep', 'sre', 'versao', 'origem', 'status', 'criadoEm',
    'enviadoValidacaoEm', 'validadoPor', 'validadoEm', 'concluidoEm', 'assinaturas', 'ataData', 'ataIdent', 'homolDestino', 'homolData', 'devolucoes']);
  if (s.perfil === 'escola' && !mesmaEscola_(s, reg.inep)) return { ok: false, erro: 'Este PPP pertence a outra escola.' };
  if (s.perfil === 'regional' && String(reg.sre || '').toLowerCase() !== String(s.sre || '').toLowerCase()) {
    return { ok: false, erro: 'Este PPP pertence a outra Superintendência Regional de Ensino.' };
  }
  const eventos = [];
  const chaves = {};
  const add = function (data, ato, autor, papel, detalhe, origem) {
    if (!data) return;
    const k = String(data).slice(0, 16) + '|' + ato;
    if (chaves[k]) return;
    chaves[k] = true;
    eventos.push({ data: data, ato: ato, autor: autor || '', papel: papel || '', detalhe: detalhe || '', origem: origem });
  };
  /* os atos registrados */
  const ciclo = abaCiclo_();
  const nc = ciclo.getLastRow();
  if (nc >= 2) {
    ciclo.getRange(2, 2, nc - 1, 1).createTextFinder(String(reg.protocolo).toUpperCase()).matchEntireCell(true).findAll()
      .forEach(function (c) {
        const r = ciclo.getRange(c.getRow(), 1, 1, CICLO_COLS.length).getDisplayValues()[0];
        add(r[0], r[2], r[3], r[4], r[5], 'registro');
      });
  }
  /* as datas do próprio registro (também cobrem os PPPs anteriores à 7.8) */
  add(reg.criadoEm, 'PPP criado', '', '', reg.origem ? 'nova versão de ' + reg.origem : '', 'registro');
  let dev = []; try { dev = JSON.parse(reg.devolucoes || '[]'); } catch (e) { dev = []; }
  (Array.isArray(dev) ? dev : []).forEach(function (d) { add(d.em, 'PPP devolvido para ajustes', d.por, '', d.parecer, 'registro'); });
  add(reg.enviadoValidacaoEm, 'PPP enviado para validação', '', '', '', 'registro');
  add(reg.validadoEm, 'PPP validado', reg.validadoPor, '', '', 'registro');
  add(reg.concluidoEm, 'PPP concluído', '', '', 'coleta de assinaturas aberta', 'registro');
  let assin = []; try { assin = JSON.parse(reg.assinaturas || '[]'); } catch (e) { assin = []; }
  assin.forEach(function (a) {
    if (a.assinadoEm) add(a.assinadoEm, 'assinatura registrada', a.nome || a.email, a.papel === 'Direção Escolar' ? 'Direção Escolar' : (a.segmento || a.papel || 'Colegiado'), a.assinadoPor === 'sistema' ? 'no sistema' : 'pelo link', 'registro');
  });
  /* v8.13 (D08) — A ATA APARECIA DUAS VEZES em todo PPP que tinha ata: o ato
     real, já registrado no ciclo, e uma síntese feita a partir de `ataData`.
     A chave de deduplicação é data|ato, e as datas diferem (a da reunião é
     anterior à do registro), de modo que as duas entravam — e a sintética
     ficava ANTES de "PPP criado". A síntese fica só para o registro anterior
     à 7.8, que não tem ciclo; e, quando a data informada não é reconhecível,
     ela entra com a data do REGISTRO, dizendo qual foi o valor informado. */
  if (reg.ataData && !cicloTemAto_(reg.protocolo, 'ata anexada')) {
    if (dataDe_(String(reg.ataData).trim())) {
      add(reg.ataData + ' 00:00', 'ata anexada', '', '', reg.ataIdent || '', 'registro');
    } else {
      add(reg.concluidoEm || reg.criadoEm, 'ata anexada', '', '',
        (reg.ataIdent ? reg.ataIdent + ' · ' : '') + 'data da reunião informada: ' + reg.ataData, 'registro');
    }
  }
  add(reg.homolData, 'enviado para homologação', '', '', reg.homolDestino || '', 'registro');
  /* v8.13 (D08): data irreconhecível vai para o FIM da lista, não para o
     topo — um evento sem data não encabeça a história de um documento. */
  const ord = function (t) { const m = String(t || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : Number.MAX_SAFE_INTEGER; };
  eventos.sort(function (a, b) { return ord(a.data) - ord(b.data); });
  return { ok: true, protocolo: reg.protocolo, escola: reg.escola, versao: parseInt(reg.versao, 10) || 1, status: reg.status, eventos: eventos };
}

/* ---- conteúdo publicado (lido por toda escola ao abrir o sistema) ---- */
function conteudoPublicado() {
  const aba = abaConteudo_();
  const ultima = aba.getLastRow();
  const itens = {};
  if (ultima >= 2) {
    aba.getRange(2, 1, ultima - 1, 3).getValues().forEach(function (r) {
      const caminho = String(r[0] || '').trim();
      if (!caminho || r[2] === '' || r[2] == null) return;
      try { itens[caminho] = JSON.parse(r[2]); } catch (e) {}
    });
  }
  /* v8.0 (P12): os textos do servidor (e-mails e folha) vão junto — é deles
     que a curadoria precisa para mostrar o padrão de cada campo. Até a 7.9
     só a demonstração os tinha, num espelho que podia divergir. */
  return { versao: Number(PropertiesService.getScriptProperties().getProperty(PROP_VER) || 0), itens: itens,
           padroes: PADRAO_SERVIDOR };
}

/* ---- senha e sessão ---- */
/**
 * v7.8 (P7) — Duas versões de hash convivem:
 *   v1 (até a 7.7): uma passada de SHA-256 sobre sal|senha;
 *   v2: HASH_ITERACOES passadas de SHA-256 sobre pepper|sal|senha, com o
 *       pepper guardado nas propriedades do script (fora da planilha).
 * Senhas novas nascem em v2; uma senha v1 é migrada para v2 na primeira
 * entrada válida. A versão fica na coluna "Versão do hash" da aba Acessos
 * (ao final); vazio significa v1.
 */
const HASH_ITERACOES = 5000;
const PROP_PEPPER = 'SENHA_PEPPER';
function pepper_() {
  const props = PropertiesService.getScriptProperties();
  let p = props.getProperty(PROP_PEPPER);
  if (!p) { p = Utilities.getUuid() + Utilities.getUuid(); props.setProperty(PROP_PEPPER, p); }
  return p;
}
function hex_(bytes) {
  let hex = ''; bytes.forEach(function (b) { hex += ('0' + (b & 0xFF).toString(16)).slice(-2); });
  return hex;
}
function hashSenha_(senha, sal, versao) {
  if (String(versao || '') === '2') return hashSenhaV2_(senha, sal);
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + senha, Utilities.Charset.UTF_8));
}
function hashSenhaV2_(senha, sal) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper_() + '|' + sal + '|' + senha, Utilities.Charset.UTF_8);
  for (let i = 1; i < HASH_ITERACOES; i++) bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hex_(bytes);
}
/** Confere a senha contra o cadastro; se bater e ainda for v1, migra para v2. */
function senhaConfere_(cad, senha) {
  if (!cad || !cad.hash) return false;
  const versao = String(cad.hashVersao || '') === '2' ? '2' : '1';
  if (hashSenha_(senha, cad.sal, versao) !== cad.hash) return false;
  if (versao === '1') {
    try {
      const sal = Utilities.getUuid();
      abaAcessos_().getRange(cad.linha, 5, 1, 2).setValues([[hashSenhaV2_(senha, sal), sal]]);
      abaAcessos_().getRange(cad.linha, ACESSO_COLS.indexOf('Versão do hash') + 1).setValue('2');
      invalidarAcessos_();
    } catch (e) { /* a migração é oportunista: a entrada vale mesmo assim */ }
  }
  return true;
}
/**
 * Define a senha institucional do Órgão Central. O caminho é o menu da
 * planilha (Gerador de PPP → Definir senha institucional).
 *
 * v8.13 (E01, A8-01) — ESTA ERA A FUNÇÃO MAIS PERIGOSA DO SISTEMA. Sem o
 * sublinhado ela era pública no `google.script.run`: qualquer navegador que
 * abrisse o app trocava a senha do Órgão Central, sem sessão nenhuma, e a
 * troca ainda zerava o contador de tentativas. Três coisas mudaram:
 *   · o sublinhado, que é o que de fato a retira da superfície pública;
 *   · sobrescrever senha JÁ DEFINIDA passa a exigir a confirmação 'SIM' —
 *     redefinir a senha da rede não é o tipo de coisa que se faz por engano;
 *   · a trilha passa a registrar quem de fato fez a troca. Antes ela
 *     atribuía sempre a "editor do Apps Script", e quem auditasse depois
 *     leria o contrário do que aconteceu.
 */
function definirSenhaCuradoria_(senha, confirmar) {
  const s = String(senha || '');
  if (s.length < 10) throw new Error('A senha deve ter ao menos 10 caracteres.');
  const props = PropertiesService.getScriptProperties();
  const jaTem = !!props.getProperty(PROP_HASH);
  if (jaTem && String(confirmar) !== 'SIM') {
    throw new Error('Já existe senha institucional definida. Para substituí-la, confirme com o segundo ' +
      'argumento "SIM" — a senha atual deixa de valer para todo o Órgão Central.');
  }
  const sal = Utilities.getUuid();
  props.setProperty(PROP_SAL, sal);
  props.setProperty(PROP_HASH, hashSenhaV2_(s, sal));   // v7.8 (P7): pepper + 5.000 passadas
  props.setProperty(PROP_HASH + '_V', '2');
  props.deleteProperty(PROP_TENT);
  registrarHistorico_(usuarioAtual_() || 'editor do Apps Script (conta não identificada)',
    /* o prefixo "senha de curadoria" é o que leva a linha para o histórico da
       CURADORIA (ACAO_CURADORIA_RE), que é onde esta trilha sempre esteve */
    jaTem ? 'senha de curadoria substituída' : 'senha de curadoria definida', '—', '', '');
  Logger.log('Senha institucional definida.');
}
/**
 * v8.4 — Avisa quem consta da lista CURADORES de que alguém entrou como Órgão
 * Central por senha, sem conta institucional identificada. É a entrada mais
 * sensível do sistema: quem a usa alcança a rede inteira.
 */
function avisarEntradaCentral_(autor, emailDigitado) {
  const destinos = CURADORES.filter(Boolean);
  if (!destinos.length) return 0;
  enfileirarEmail_(destinos.join(','), 'acesso',
    'Entrada no Órgão Central sem conta identificada — Gerador de PPP',
    'Houve uma entrada como Órgão Central por senha institucional, sem conta do domínio identificada.\n\n' +
    'Responsável informado: ' + autor + '\n' +
    'E-mail digitado: ' + (emailDigitado || '—') + '\n' +
    'Quando: ' + agora_() + '\n\n' +
    'Se não reconhece este acesso, troque a senha institucional pelo menu da planilha ' +
    '(Gerador de PPP → Definir senha institucional) e confira a lista CURADORES.\n\n' +
    urlApp_(), 1);
  return destinos.length;
}
function ehCurador_(email) {
  if (!email) return false;
  return CURADORES.map(function (x) { return String(x).toLowerCase(); }).indexOf(email) >= 0;
}
/* ============================================================
   v8.13 (E04, A7-01 + A8-02) — UMA SÓ PORTA DO ÓRGÃO CENTRAL

   Aqui existia `curadoriaEntrar`. Ela abria sessão `perfil:'central'` — o
   topo da rede — por senha institucional, e conservava a lógica anterior à
   v8.4: `if (email && CURADORES.length && !curador)`. Com o e-mail VAZIO,
   que é exatamente o caso perigoso (conta de fora do domínio, que o Apps
   Script não identifica), a lista de curadores NUNCA era conferida. A
   v8.4 endureceu `entrarInstitucional` e escreveu o defeito no próprio
   código; a correção ficou só naquela função. Esta não avisava
   `avisarEntradaCentral_`, e tinha um contador próprio e GLOBAL
   (PROP_TENT): a mesma senha tinha dois orçamentos de cinco tentativas, e
   um anônimo errando cinco vezes trancava esta porta para todos.

   E a interface não usava mais esta porta: o caminho real é
   entrarInstitucional → escolherModo('edicao') → curadoriaAbrir, com o
   token da sessão. Era porta de ataque sem uso.

   A porta foi RETIRADA. A curadoria exige sessão de Órgão Central já
   aberta, que é o que `curadoriaAbrir` faz. Não se duplicam as três regras
   da v8.4 numa segunda função: duas portas para o mesmo lugar é exatamente
   como esta diferença nasceu, e a próxima mudança de regra ficaria de novo
   só em uma delas. `PROP_TENT` continua sendo apagado onde já era, para não
   deixar lixo em implantação antiga.
   ============================================================ */

/** Estado da curadoria para uma sessão já aberta (perfil central). */
function curadoriaAbrir(payload) {
  const s = sessaoCentral_(payload && payload.token);
  const est = curadoriaEstado_(s.nome);   /* v8.13 (E07): o rascunho é do curador da sessão */
  return { ok: true, autor: s.nome, padroesServidor: PADRAO_SERVIDOR,
           rascunhos: est.rascunhos, pendentes: est.pendentes, historico: est.historico,
           deOutros: est.deOutros };
}
function curadorDaSessao_(token) {
  return sessaoCentral_(token).nome;
}
/* ============================================================
   v8.13 (E07, A7-06) — O RASCUNHO DA CURADORIA TEM DONO

   O rascunho era gravado POR CAMINHO, não por curador, e `curadoriaAbrir`
   devolvia a todos o rascunho de todos. Dois curadores no mesmo campo:
   vencia o último a salvar, sem aviso. `curadoriaPublicar` publicava TUDO o
   que estivesse pendente — o texto que o outro deixou em estudo ia para a
   rede junto. E "Descartar todas as alterações ainda não publicadas"
   apagava o rascunho dos outros. Tudo em silêncio.

   A coluna 7 da aba "Conteúdo" já guardava o autor: ela passa a ser PARTE DA
   IDENTIDADE do rascunho. `curadoriaAbrir` devolve `rascunhos` (os do
   curador da sessão, que a tela edita) e `deOutros` (caminho, rótulo, autor
   e data — SEM o valor: para saber que existe, sem ler o conteúdo alheio).

   Não há segunda linha por caminho: duas linhas para o mesmo caminho
   significaria dois valores publicados possíveis, que é pior do que o
   conflito. O conflito passa a ser AVISADO.

   Autor vazio (registro antigo) é "de ninguém": editável por qualquer
   curador, sem conflito. A comparação é por igualdade exata do que
   curadorDaSessao_ devolve — os registros antigos guardam o autor em formato
   livre ("nome · MASP …"), e adivinhar semelhança seria pior que não casar.
   ============================================================ */
function curadoriaEstado_(autorDaSessao) {
  const aba = abaConteudo_();
  const ultima = aba.getLastRow();
  const rascunhos = {};
  const deOutros = [];
  const donoDe = {};
  const so = String(autorDaSessao || '');
  let pendentes = 0;
  if (ultima >= 2) {
    aba.getRange(2, 1, ultima - 1, CONTEUDO_COLS.length).getValues().forEach(function (r) {
      const caminho = String(r[0] || '').trim();
      if (!caminho || !r[4]) return;
      const dono = String(r[6] || '').trim();
      donoDe[caminho] = dono;
      /* sem autor de sessão (chamadas internas), o estado é o de sempre */
      const meu = !so || !dono || dono === so;
      if (!meu) {
        deOutros.push({ caminho: caminho, rotulo: String(r[1] || ''), autor: dono,
                        quando: String(r[5] || ''), acao: String(r[4] || '') });
        return;
      }
      pendentes++;
      if (r[4] === 'restaurar') rascunhos[caminho] = null;
      else { try { rascunhos[caminho] = JSON.parse(r[3]); } catch (e) {} }
    });
  }
  const h = abaHistorico_();
  const nh = h.getLastRow();
  /* v7.8 (P8): só curadoria vive aqui (as entradas foram para "Acessos —
     histórico"); o valor anterior vai inteiro, para "voltar a esta versão" */
  const historico = nh < 2 ? [] :
    h.getRange(Math.max(2, nh - 39), 1, Math.min(40, nh - 1), 6).getDisplayValues()
     .map(function (r) { return { data: r[0], autor: r[1], acao: r[2], caminho: r[3],
                                  antes: /texto publicado/.test(String(r[2])) ? r[4] : '' }; }).reverse();
  return { rascunhos: rascunhos, pendentes: pendentes, historico: historico,
           deOutros: deOutros, donoDe: donoDe };
}

/* ---- gravação do rascunho ---- */
/* ============================================================
   v8.13 (E05, A7-03) — TEXTO CURADO DEIXA DE VIRAR MARCAÇÃO

   Aqui estava `limparTexto_`: uma passada ÚNICA de três expressões
   regulares, com duas falhas independentes e conhecidas.
     · Ela REMONTA a tag que retira: `<scr<script>ipt>` perde o miolo e o que
       sobra é `<script>`.
     · Ela exige espaço antes do manipulador: `<img src=x/onerror=alert(1)>`
       atravessa inteiro, e `javascript&#58;` escapa da terceira regra.
   O destino desse texto é `innerHTML` (aplicarUI, no App): senha
   institucional virava XSS armazenado para as 3.400 escolas da rede.

   A lista negra saiu e entrou LISTA BRANCA DE MARCAÇÃO. O texto é escapado
   POR INTEIRO e só então as poucas tags que a curadoria legitimamente usa
   são reintroduzidas, sem atributo nenhum. Sem atributo não há `onerror`,
   não há `href`, não há `javascript:`; e como a base já está escapada, não
   há remontagem possível.

   É a diferença entre tentar adivinhar o que é perigoso e declarar o que é
   permitido: lista branca não precisa prever o ataque; lista negra precisa
   prever todos.

   `<a href>` NÃO entra: os links do sistema são montados pelo código
   (urlApp_()), nunca digitados pelo curador.

   DECISÃO DE IMPLEMENTAÇÃO (além da lista do plano): `blockquote` entrou.
   O plano listou b, i, em, strong, br, p, ul, ol, li; os textos padrão do
   SERVIDOR (PADRAO_SERVIDOR) usam `<blockquote>` — deixá-lo de fora faria o
   e-mail e a folha perderem a formatação na primeira republicação, que é
   exatamente a regressão que o plano manda evitar. Está conferido pela
   bateria, valor a valor.
   ============================================================ */
const TAGS_CURADORIA = 'b|i|em|strong|br|p|ul|ol|li|blockquote';
const TAGS_ACEITAS_ = {};
TAGS_CURADORIA.split('|').forEach(function (t) { TAGS_ACEITAS_[t] = true; });
const RE_TAGS_CURADORIA = new RegExp('&lt;(\\/?)(' + TAGS_CURADORIA + ')&gt;', 'gi');
function saneadorTexto_(v) {
  if (typeof v === 'string') {
    /* DECISÃO: escapam-se `<` e `>`, e SÓ eles.
       · As aspas não: `"` só é perigoso dentro de atributo, e esta lista
         branca não reintroduz atributo nenhum. Escapá-las faria `&quot;`
         aparecer LITERALMENTE nos e-mails de texto simples
         (EMAIL.pendente.corpo tem aspas na frase).
       · O `&` também não, e por uma razão mais forte: o saneador é aplicado
         DUAS VEZES — aqui, na gravação, e de novo no consumo (htmlSeguro, no
         App), porque a base em uso tem texto gravado pela limpeza velha.
         Escapando `&`, a segunda passada escaparia a primeira, e o curador
         leria `&amp;lt;script&amp;gt;` na tela. Sem ele, a função é
         IDEMPOTENTE: aplicá-la de novo não muda nada.
       Entidade não cria elemento: `&lt;script&gt;` em innerHTML é o TEXTO
       "<script>", e é exatamente isso que se quer que o curador veja. */
    const escapado = v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escapado.replace(RE_TAGS_CURADORIA, '<$1$2>');
  }
  if (Array.isArray(v)) return v.map(saneadorTexto_);
  if (v && typeof v === 'object') {
    const o = {}; Object.keys(v).forEach(function (k) { o[k] = saneadorTexto_(v[k]); }); return o;
  }
  return v;
}
/**
 * v8.13 (E05) — O QUE JÁ ESTÁ GRAVADO. Não há saneamento retroativo da aba
 * "Conteúdo": reescrever texto publicado em massa, sem alguém ler o
 * resultado, é trocar um estrago por outro. O que entra é (a) a limpeza no
 * CONSUMO, que neutraliza o que já está lá, e (b) este relatório SÓ DE
 * LEITURA, que lista os caminhos cujo valor publicado contém marcação fora
 * da lista branca, para o Órgão Central conferir e republicar um a um.
 */
function auditarConteudoComMarcacao(payload) {
  sessaoCentral_(payload && payload.token);
  const aba = abaConteudo_();
  const ultima = aba.getLastRow();
  if (ultima < 2) return { ok: true, itens: [] };
  const vals = aba.getRange(2, 1, ultima - 1, CONTEUDO_COLS.length).getDisplayValues();
  const itens = [];
  vals.forEach(function (r) {
    const caminho = String(r[0] || '').trim();
    const bruto = String(r[2] || '');
    if (!caminho || !bruto) return;
    /* o valor gravado é JSON; o que interessa é o texto que ele carrega */
    let texto = bruto;
    try { texto = JSON.stringify(JSON.parse(bruto)); } catch (e) { /* valor antigo, sem JSON */ }
    const suspeitos = (texto.match(/<\/?[A-Za-z][A-Za-z0-9]*/g) || []).filter(function (t) {
      const nome = t.replace(/^<\/?/, '').toLowerCase();
      return !TAGS_ACEITAS_[nome];
    });
    if (suspeitos.length) {
      const i = texto.indexOf(suspeitos[0]);
      itens.push({ caminho: caminho, rotulo: String(r[1] || ''), autor: String(r[6] || ''),
                   tags: Array.from(new Set(suspeitos)).slice(0, 6),
                   trecho: texto.slice(Math.max(0, i - 30), i + 90) });
    }
  });
  return { ok: true, itens: itens, total: itens.length, aceitas: TAGS_CURADORIA.split('|') };
}
function curadoriaSalvar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const autor = curadorDaSessao_(payload && payload.token);
    const alteracoes = (payload && payload.alteracoes) || [];
    const aba = abaConteudo_();
    const ultima = aba.getLastRow();
    const linhaDe = {};
    if (ultima >= 2) {
      aba.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (r, i) {
        if (r[0]) linhaDe[String(r[0]).trim()] = i + 2;
      });
    }
    /* v8.13 (E06) — A CONFERÊNCIA VEM ANTES, E O LOTE É TUDO OU NADA. Gravar
       metade de um lote deixaria a planilha num estado que ninguém pediu. */
    const recusados = [];
    alteracoes.forEach(function (a) {
      const c = String(a && a.p || '').trim();
      const razao = caminhoDeConteudo_(c);
      if (razao) { recusados.push('"' + c + '" — ' + razao); return; }
      /* texto do servidor com marcador que o servidor não resolve: é AQUI que
         há alguém para ler o aviso. Depois da publicação, o marcador sai
         literal no e-mail e vai congelado para dentro do PDF (A7-11). */
      if ((c.indexOf('EMAIL.') === 0 || c.indexOf('DOC.') === 0) && typeof a.valor === 'string') {
        const faltam = marcadoresNaoResolvidos_(a.valor);
        if (faltam.length) {
          recusados.push('"' + c + '" — marcador que o servidor não resolve: {{' + faltam.join('}}, {{') +
            '}}. O servidor não resolve marcador nenhum: escreva o texto como ele deve sair.');
        }
      }
    });
    if (recusados.length) {
      throw new Error('Caminho de conteúdo inválido: ' + recusados.join(' · ') + '. Nada foi gravado.');
    }
    /* v8.13 (E07): gravar por cima do rascunho de OUTRO curador passa a ser
       uma decisão declarada. Sem `sobrepor`, a resposta traz o conflito e
       NADA é gravado; com ele, grava e registra quem foi sobreposto. */
    const conflito = [];
    if (!(payload && payload.sobrepor)) {
      const estAtual = curadoriaEstado_();
      alteracoes.forEach(function (a) {
        const c = String(a && a.p || '').trim();
        const dono = String((estAtual.donoDe || {})[c] || '').trim();
        if (dono && dono !== autor) {
          conflito.push({ caminho: c, autor: dono, quando: '' });
        }
      });
    }
    if (conflito.length) {
      return { ok: false, conflito: conflito,
               erro: 'Há rascunho de outro curador em ' + conflito.length + ' campo(s): ' +
                 conflito.map(function (x) { return x.caminho + ' (' + x.autor + ')'; }).join(', ') +
                 '. Nada foi gravado.' };
    }
    const sobrepostos = [];
    alteracoes.forEach(function (a) {
      const caminho = String(a && a.p || '').trim();
      const restaurar = (a.valor === null || a.valor === undefined);
      const valor = restaurar ? '' : JSON.stringify(saneadorTexto_(a.valor));   /* v8.13 (E05) */
      if (valor.length > CUR_MAX_CARACTERES) throw new Error('Texto longo demais em "' + caminho + '".');
      const linha = linhaDe[caminho];
      if (linha) {
        const donoAnterior = String(aba.getRange(linha, 7).getDisplayValues()[0][0] || '').trim();
        const pendenteAnterior = String(aba.getRange(linha, 5).getDisplayValues()[0][0] || '').trim();
        if (pendenteAnterior && donoAnterior && donoAnterior !== autor) sobrepostos.push({ caminho: caminho, autor: donoAnterior });
        aba.getRange(linha, 4, 1, 4).setValues([[valor, restaurar ? 'restaurar' : 'alterar', agora_(), autor]]);
      } else {
        const nova = aba.getLastRow() + 1;
        aba.getRange(nova, 1, 1, 7).setValues([[caminho, String(a.rot || ''), '', valor,
          restaurar ? 'restaurar' : 'alterar', agora_(), autor]]);
        linhaDe[caminho] = nova;
      }
    });
    registrarHistorico_(autor, 'rascunho salvo', alteracoes.map(function (a) { return a.p; }).join(', ') || '—', '', '');
    sobrepostos.forEach(function (x) {
      registrarHistorico_(autor, 'rascunho sobreposto', x.caminho, 'rascunho de ' + x.autor, '');
    });
    const estFinal = curadoriaEstado_(autor);
    return { ok: true, pendentes: estFinal.pendentes, deOutros: estFinal.deOutros,
             sobrepostos: sobrepostos };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/**
 * v8.13 (E06, A7-11) — PRÉVIA DE VERDADE PARA O E-MAIL E PARA A FOLHA.
 *
 * `curVerPrevia` aplica o rascunho ao DOCUMENTO, e `aplicarConteudo` filtra
 * fora justamente `EMAIL.` e `DOC.`: o único grupo que o curador NÃO
 * conseguia ver antes de publicar era o que vai para a caixa de entrada de
 * 3.400 diretores e para dentro do PDF congelado. Aqui ele vê: o texto já
 * interpolado, com dados de exemplo, e — para DOC.folha.* — a folha montada
 * sobre um registro fictício.
 */
function curadoriaPrevia(payload) {
  sessaoCentral_(payload && payload.token);
  const p = payload || {};
  const caminho = String(p.caminho || '').trim();
  const razao = caminhoDeConteudo_(caminho);
  if (razao) return { ok: false, erro: 'Caminho de conteúdo inválido: "' + caminho + '" — ' + razao + '.' };
  const bruto = (p.valor === undefined || p.valor === null)
    ? txtServidor_(caminho) : String(p.valor);
  const faltam = marcadoresNaoResolvidos_(bruto);
  /* v8.13 (F03) — OS VALORES SÃO DE EXEMPLO, e a lista espelha o que os
     chamadores passam a `preencher_`. Faltavam oito (`hash`, `total`,
     `assinados`, `ato`, `url`, `diretor`, `motivo`, `antes`), e por isso 9
     dos 25 textos do servidor saíam na prévia com o marcador literal à
     mostra — inclusive `DOC.folha.codigo` e `DOC.folha.homologacao`, que são
     os dois que mais importam ao curador. É a tela em que ele confere o
     texto ANTES de publicá-lo para 3.400 escolas. */
  const CODIGO_EXEMPLO = 'A1B2-C3D4-E5F6';
  const exemplo = {
    escola: 'Escola Estadual Exemplo', protocolo: 'PPP-2026-0001-EXEM', versao: ' (versão 2)',
    nome: 'Maria da Silva', por: 'Diretoria Educacional de Divinópolis', quando: agora_(),
    parecer: 'Ajustar o diagnóstico da seção 4 e reenviar.', concluidoEm: agora_(),
    link: urlApp_(), sre: 'Divinópolis', agora: agora_(), codigo: CODIGO_EXEMPLO,
    data: agora_(), destino: 'SRE Divinópolis',
    /* o mesmo código que a folha de exemplo usa — os dois não podem discordar */
    hash: CODIGO_EXEMPLO, total: 7, assinados: 5,
    /* o chamador real passa o prefixo junto (Code.gs, folhaRodapeTextos_) */
    ato: ', ato 123/2026', url: urlApp_(), diretor: 'Maria da Silva',
    motivo: 'erro no ato de homologação', antes: agora_()
  };
  const texto = preencher_(bruto, exemplo);
  const r = { ok: true, caminho: caminho, texto: texto, marcadoresNaoResolvidos: faltam,
              /* v8.13 (F03): completar uma lista à mão é o conserto que volta —
                 a prévia passa a DENUNCIAR o marcador que ficou sem exemplo,
                 do mesmo jeito que já denuncia o {{REDE.…}} desconhecido. */
              marcadoresSemExemplo: marcadoresSemExemplo_(bruto, exemplo),
              html: /^\s*</.test(texto) };
  /* a folha inteira, montada como o documento oficial a monta */
  if (caminho.indexOf('DOC.folha.') === 0) {
    const reg = { protocolo: exemplo.protocolo, escola: exemplo.escola, sre: exemplo.sre,
                  versao: 2, concluidoEm: exemplo.concluidoEm, hash: exemplo.codigo,
                  assinaturas: JSON.stringify([
                    { papel: 'direcao', nome: 'Maria da Silva', masp: '1234567', assinadoEm: exemplo.concluidoEm },
                    { papel: 'colegiado', segmento: 'Docente', nome: 'João de Exemplo', assinadoEm: '' }
                  ]), anexos: '[]',
                  /* o rascunho em prova vale sobre o padrão, só nesta montagem */
                  textosFolha: JSON.stringify((function () {
                    const t = {}; t[caminho] = bruto; return t;
                  })()) };
    try { r.folha = folhaAssinaturas_(reg); } catch (e) { r.folha = ''; }
  }
  return r;
}

/* ---- publicação ---- */
function curadoriaPublicar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const autor = curadorDaSessao_(payload && payload.token);
    /* v8.13 (E07): a publicação passa a ser ESCOLHIDA, não varrida. Sem lista
       no payload, recusa: "publicar tudo" levava para a rede o texto que o
       outro curador tinha deixado em estudo. Publicar item de outro é
       possível — às vezes é preciso —, mas só explicitamente, e a tela
       enumera o que vai sair, com o autor de cada item. */
    const pedidos = (payload && payload.caminhos) || null;
    if (!Array.isArray(pedidos) || !pedidos.length) {
      return { ok: false, erro: 'Informe quais textos publicar. A publicação é escolhida, item a item — ' +
        'não há mais "publicar tudo o que estiver pendente".' };
    }
    const querPublicar = {};
    pedidos.forEach(function (c) { querPublicar[String(c || '').trim()] = true; });
    const aba = abaConteudo_();
    const ultima = aba.getLastRow();
    if (ultima < 2) return { ok: false, erro: 'Não há nada para publicar.' };
    const vals = aba.getRange(2, 1, ultima - 1, 7).getValues();
    const apagar = [];
    const publicados = [], ignorados = [];
    let n = 0;
    vals.forEach(function (r, i) {
      const acao = r[4];
      const cam = String(r[0] || '').trim();
      if (!acao) return;
      if (!querPublicar[cam]) { ignorados.push(cam); return; }
      publicados.push(cam);
      n++;
      if (acao === 'restaurar') {
        registrarHistorico_(autor, 'texto restaurado ao padrão', r[0], r[2], '(padrão do sistema)');
        apagar.push(i + 2);
      } else {
        registrarHistorico_(autor, 'texto publicado', r[0], r[2], r[3]);
        aba.getRange(i + 2, 3, 1, 5).setValues([[r[3], '', '', agora_(), autor]]);
      }
    });
    if (!n) return { ok: false, erro: 'Não há alterações pendentes de publicação nos textos informados.' };
    apagar.reverse().forEach(function (l) { aba.deleteRow(l); });
    limparCacheConteudo_();
    const props = PropertiesService.getScriptProperties();
    const versao = Number(props.getProperty(PROP_VER) || 0) + 1;
    props.setProperty(PROP_VER, String(versao));
    const pub = conteudoPublicado();
    const estPub = curadoriaEstado_(autor);
    return { ok: true, versao: versao, itens: pub.itens, historico: estPub.historico,
             publicados: publicados, ignorados: ignorados, deOutros: estPub.deOutros,
             pendentes: estPub.pendentes };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}
function curadoriaDescartar(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const autor = curadorDaSessao_(payload && payload.token);
    const aba = abaConteudo_();
    const ultima = aba.getLastRow();
    if (ultima < 2) return { ok: true };
    const vals = aba.getRange(2, 1, ultima - 1, CONTEUDO_COLS.length).getValues();
    const apagar = [];
    let n = 0;
    vals.forEach(function (r, i) {
      if (!r[4]) return;
      /* v8.13 (E07): só o que ESTE curador gravou. Autor vazio (registro
         antigo) é de ninguém, e continua sendo descartável. */
      const dono = String(r[6] || '').trim();
      if (dono && dono !== autor) return;
      n++;
      if (r[2] === '' || r[2] == null) apagar.push(i + 2);
      else aba.getRange(i + 2, 4, 1, 2).setValues([['', '']]);
    });
    apagar.reverse().forEach(function (l) { aba.deleteRow(l); });
    registrarHistorico_(autor, 'rascunho descartado', '—', '', n + ' campo(s) do próprio curador');
    const estDes = curadoriaEstado_(autor);
    return { ok: true, pendentes: estDes.pendentes, descartados: n, deOutros: estDes.deOutros };
  } finally { lock.releaseLock(); gerarPdfsPendentes_(); }
}

/* ============================================================
   Backup e acionadores (v6.1)
   ============================================================ */

const NOME_PASTA_BACKUP = 'Gerador PPP — Backups';
const BACKUPS_MANTIDOS = 30;
/* ============================================================
   v8.13 (E15, A8-03/A8-23) — RETENÇÃO POR IDADE, E CARIMBO QUE NÃO COLIDE.

   A retenção era só POR CONTAGEM: `diarios.slice(BACKUPS_MANTIDOS)` mandava
   para a lixeira tudo além dos 30 mais recentes. Trinta chamadas seguidas —
   um operador clicando no menu, um acionador duplicado — empurravam TODOS os
   backups legítimos para fora da janela e os descartavam em segundos.

   Agora são duas condições, nesta ordem: nunca se descarta backup com menos
   de BACKUP_GUARDA_DIAS dias; entre os mais velhos que isso, mantêm-se os
   BACKUPS_MANTIDOS mais recentes. Repetir a rotina N vezes não descarta nada
   legítimo (as cópias novas são todas jovens), e a janela de recuperação
   passa a ser um TEMPO — que é o que um plano de continuidade promete.

   O carimbo ganhou SEGUNDOS: com resolução de minuto, duas cópias no mesmo
   minuto ficavam homônimas e indistinguíveis para quem fosse restaurar
   (A8-23), porque `arquivosDaPasta_` seleciona por prefixo de nome.

   E a rotina recusa rodar de novo em menos de BACKUP_MIN_INTERVALO, salvo
   quando vem do menu (`{forcado:true}`): copiar a planilha inteira é a
   operação mais cara do sistema.
   ============================================================ */
const BACKUP_GUARDA_DIAS = 30;
const BACKUP_GUARDA_MENSAL_DIAS = 60;
const BACKUP_MIN_INTERVALO = 6 * 3600000;

/** Copia a planilha inteira para a pasta de backups e mantém apenas as 30 mais recentes. */
/* ============================================================
   BACKUP E INTEGRIDADE (v7.8, P10)
   · Diário: cópia da planilha, 30 guardadas (como antes).
   · Mensal: a primeira cópia de cada mês fica 24 meses.
   · Semanal: verificarIntegridade_ percorre os registros e confere no
     Drive cada arquivo referido — fonte congelada, PDF, ata, anexos —,
     grava as faltas na aba "Integridade" e avisa o Órgão Central pela
     fila. A política é "os arquivos nunca saem da pasta": em vez de
     copiar milhares de PDFs, o sistema confere que continuam lá.
   · Restauração: procedimento no LEIA-ME; listarBackups_() mostra o que há.
   ============================================================ */
const BACKUPS_MENSAIS = 24;
const NOME_ABA_INTEGRIDADE = 'Integridade';
const INTEGRIDADE_COLS = ['Data', 'Protocolo', 'Escola', 'SRE', 'Tipo', 'ID do arquivo', 'Situação'];
function pastaBackups_() {
  const it = DriveApp.getFoldersByName(NOME_PASTA_BACKUP);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA_BACKUP);
}
function arquivosDaPasta_(pasta, prefixo) {
  const arquivos = [];
  const fs = pasta.getFiles();
  while (fs.hasNext()) { const f = fs.next(); if (String(f.getName()).indexOf(prefixo) === 0) arquivos.push(f); }
  arquivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  return arquivos;
}
/** v8.13 (E15): a idade de um arquivo do Drive, em dias. */
function idadeEmDias_(f) {
  try { return (Date.now() - f.getDateCreated().getTime()) / 86400000; }
  catch (e) { return 0; }   /* sem data legível, trata-se como recém-criado: não se descarta */
}
/**
 * v8.13 (E15): descarta o EXCEDENTE, entre os que já passaram da guarda.
 * A ordem importa: primeiro a idade (nada novo é descartado), depois a
 * contagem (entre os velhos, guardam-se os `quantos` mais recentes).
 */
function aposentarBackups_(arquivos, quantos, guardaDias) {
  const velhos = arquivos.filter(function (f) { return idadeEmDias_(f) > guardaDias; });
  const descartar = velhos.slice(quantos);
  descartar.forEach(function (f) { f.setTrashed(true); });
  return descartar.length;
}
function backupDiario_(opcoes) {
  const o = opcoes || {};
  const pasta = pastaBackups_();
  /* v8.13 (E15): a guarda de intervalo lê o carimbo de E02 — a própria
     rotina já registra quando terminou, e não é preciso inventar outro. */
  if (!o.forcado) {
    const ultimo = rotinasCarimbos_()['backupDiario_'];
    const d = ultimo ? enviandoDesde_(ultimo) : null;
    if (d && (Date.now() - d.getTime()) < BACKUP_MIN_INTERVALO) {
      return { ok: true, copiado: false,
               motivo: 'o último backup é de ' + ultimo + ' — a cópia da planilha inteira só se repete a cada ' +
                       Math.round(BACKUP_MIN_INTERVALO / 3600000) + ' h. Use o menu para forçar.',
               diarios: arquivosDaPasta_(pasta, 'Backup Base PPP ').length };
    }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agora = new Date();
  /* v8.13 (E15, A8-23): com SEGUNDOS. Duas cópias no mesmo minuto ficavam
     homônimas, e quem restaura escolhe pelo nome. */
  const carimbo = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
  DriveApp.getFileById(ss.getId()).makeCopy('Backup Base PPP ' + carimbo, pasta);
  /* v7.8 (P10): a primeira cópia do mês fica 24 meses */
  const mes = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM');
  const mensais = arquivosDaPasta_(pasta, 'Backup mensal Base PPP ');
  if (!mensais.some(function (f) { return String(f.getName()).indexOf(mes) >= 0; })) {
    DriveApp.getFileById(ss.getId()).makeCopy('Backup mensal Base PPP ' + mes, pasta);
  }
  const diarios = arquivosDaPasta_(pasta, 'Backup Base PPP ');
  const fora = aposentarBackups_(diarios, BACKUPS_MANTIDOS, BACKUP_GUARDA_DIAS);
  const foraMensais = aposentarBackups_(arquivosDaPasta_(pasta, 'Backup mensal Base PPP '),
                                        BACKUPS_MENSAIS, BACKUP_GUARDA_MENSAL_DIAS);
  marcarRotina_('backupDiario_');   /* v8.13 (E02) */
  return { ok: true, copiado: true, carimbo: carimbo, diarios: diarios.length,
           aposentados: fora, aposentadosMensais: foraMensais };
}
/** O que há na pasta de backups, do mais recente para o mais antigo. */
function listarBackups_() {
  const pasta = pastaBackups_();
  const lista = arquivosDaPasta_(pasta, 'Backup').map(function (f) {
    return { nome: f.getName(), criadoEm: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'), id: f.getId() };
  });
  Logger.log(JSON.stringify(lista, null, 2));
  return lista;
}
function abaIntegridade_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_INTEGRIDADE);
  if (aba) conferirCabecalho_(aba, INTEGRIDADE_COLS, NOME_ABA_INTEGRIDADE);   /* v8.13 (E03) */
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA_INTEGRIDADE);
    aba.getRange(1, 1, 1, INTEGRIDADE_COLS.length).setValues([INTEGRIDADE_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
  }
  return aba;
}
function arquivoExiste_(id) {
  if (!id) return true;
  try { const f = DriveApp.getFileById(id); return !(f.isTrashed && f.isTrashed()); } catch (e) { return false; }
}
/**
 * Percorre os registros e confere no Drive cada arquivo referido. Grava
 * as faltas na aba "Integridade" (uma execução por linha de cabeçalho de
 * data) e avisa o Órgão Central pela fila quando há falta. Devolve
 * {verificados, faltas, itens}.
 */
/* v8.4 — A VERIFICAÇÃO EM LOTES.

   Cada registro refere de três a cinco arquivos no Drive, e cada conferência é
   uma chamada. Com a rede inteira são dezenas de milhares — muito além dos seis
   minutos que o Apps Script dá a uma execução. Pior: as faltas só eram gravadas
   no fim, de modo que o estouro descartava tudo e a verificação semanal nunca
   concluía, nunca escrevia nada e nunca avisava ninguém.

   Agora cada execução confere um lote, grava as faltas do lote na hora e guarda
   onde parou. A volta se fecha em algumas execuções, e só ao fechá-la é que o
   aviso sai — com o total do ciclo inteiro.

   v8.13 (E16, A8-15): o parágrafo acima descrevia a intenção, não o código —
   as faltas e o cursor eram gravados depois do `while`, e o orçamento de
   tempo só era conferido entre lotes. Um lote de 150 registros são até 750
   `DriveApp.getFileById`: morrendo no meio, nada era gravado. Agora a
   gravação é por lote, de verdade, e o tempo é conferido a cada
   INTEGRIDADE_PASSO registros DENTRO do lote. */
const INTEGRIDADE_LOTE = 150;                  // registros por passada
const INTEGRIDADE_TEMPO = 4 * 60 * 1000;       // orçamento de tempo por execução (o teto é 6 min)
const INTEGRIDADE_PASSO = 25;                  // v8.13 (E16): de quantos em quantos o relógio é olhado
/* ============================================================
   v8.13 (E02) — O BATIMENTO DAS ROTINAS AGENDADAS

   Depois de E01 os cinco acionadores apontam para funções privadas. O modo
   de falha que não se aceita é o SILENCIOSO: acionador que não dispara não
   produz erro, não produz log e só é descoberto quando alguém precisa de um
   backup que não existe. E o sistema não sabia dizer quando cada rotina
   rodou pela última vez — nem antes de E01.

   Agora toda rotina agendada carimba a hora em que terminou, e a verificação
   diária compara os carimbos com o intervalo esperado. Atraso vira E-MAIL
   DIRETO, nunca enfileirado: a fila é justamente uma das coisas que pode
   estar parada (é a lição de A8-11 — o aviso de fila entupida entrava na
   fila entupida). O carimbo mora em Script Properties, que é barato: não se
   cria aba para isto.

   Numa implantação recém-feita o mapa está vazio, e conferirRotinas_ devolve
   lista vazia — ninguém está atrasado antes de a primeira rotina rodar.
   ============================================================ */
const PROP_ROTINAS = 'ROTINAS_ULTIMA';
const PROP_AVISO_ROTINAS = 'ROTINAS_AVISO';
/* dias máximos sem rodar, com folga sobre o intervalo de cada uma */
const ROTINAS_ESPERADAS = {
  backupDiario_: 2,                  /* diária, 3h */
  processarFilaEmails_: 1,           /* a cada 10 minutos */
  expurgarFilaRotina_: 2,            /* v8.13 (E13): diária, 2h */
  verificarIntegridade_: 2,          /* diária, 4h, em lotes */
  rotacionarHistoricoAcessos_: 40,   /* mensal, dia 1 */
  resumoSemanalParados_: 10          /* semanal, segunda */
};
const ROTINAS_NOMES = {
  backupDiario_: 'backup diário da planilha',
  processarFilaEmails_: 'fila de e-mails',
  expurgarFilaRotina_: 'expurgo da fila de e-mails',
  verificarIntegridade_: 'verificação de integridade do acervo',
  rotacionarHistoricoAcessos_: 'rotação do histórico de acessos',
  resumoSemanalParados_: 'resumo dos PPPs parados'
};
function rotinasCarimbos_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_ROTINAS) || '{}') || {}; }
  catch (e) { return {}; }
}
/** Carimba o fim do caminho de sucesso de uma rotina agendada. */
function marcarRotina_(nome) {
  try {
    const props = PropertiesService.getScriptProperties();
    const m = rotinasCarimbos_();
    m[nome] = agora_();
    props.setProperty(PROP_ROTINAS, JSON.stringify(m));
  } catch (e) { /* o carimbo nunca derruba a rotina que ele mede */ }
}
/**
 * As rotinas atrasadas. "Nunca rodou" só conta como atraso quando JÁ HÁ
 * carimbo de alguma outra: numa implantação nova ninguém está atrasado.
 */
function conferirRotinas_() {
  const m = rotinasCarimbos_();
  if (!Object.keys(m).length) return [];
  const atrasadas = [];
  Object.keys(ROTINAS_ESPERADAS).forEach(function (nome) {
    const quando = m[nome] || '';
    const dias = quando ? diasDesde_(quando) : null;
    if (!quando) { atrasadas.push({ rotina: nome, nome: ROTINAS_NOMES[nome] || nome, desde: '', dias: null, limite: ROTINAS_ESPERADAS[nome] }); return; }
    if (dias === null || dias > ROTINAS_ESPERADAS[nome]) {
      atrasadas.push({ rotina: nome, nome: ROTINAS_NOMES[nome] || nome, desde: quando, dias: dias, limite: ROTINAS_ESPERADAS[nome] });
    }
  });
  return atrasadas;
}
/**
 * A quem avisar quando uma rotina para. É a MESMA regra do aviso de
 * integridade (curadores + acessos ativos do Órgão Central, e ADMINS na
 * falta dos dois): quem cuida do sistema é quem precisa saber que o backup
 * parou, e não faria sentido ter duas listas para a mesma operação.
 */
function destinosDeOperacao_() {
  const destinos = {};
  CURADORES.forEach(function (e) { if (e) destinos[String(e).toLowerCase()] = true; });
  try {
    acessosTodos_().forEach(function (a) {
      if (a.perfil === 'central' && a.email && String(a.situacao || 'ativo').toLowerCase() !== 'inativo') {
        destinos[a.email] = true;
      }
    });
  } catch (e) { /* sem a aba de acessos, restam os curadores e os ADMINS */ }
  if (!Object.keys(destinos).length) ADMINS.forEach(function (e) { if (e) destinos[String(e).toLowerCase()] = true; });
  return Object.keys(destinos);
}
/**
 * O aviso de rotina parada. DIRETO pelo MailApp, e no máximo uma vez por dia
 * — a fila pode ser exatamente o que está parado.
 */
function avisarRotinasParadas_(atrasadas) {
  if (!atrasadas || !atrasadas.length) return 0;
  const props = PropertiesService.getScriptProperties();
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (props.getProperty(PROP_AVISO_ROTINAS) === hoje) return 0;
  const destinos = destinosDeOperacao_();
  if (!destinos.length) {
    registrarHistorico_('sistema', 'rotina parada sem destinatário', '—', '',
      'cadastre um curador ou um administrador para receber os avisos de operação');
    return 0;
  }
  const linhas = atrasadas.map(function (a) {
    return '· ' + a.nome + ' (' + a.rotina + '): ' +
      (a.desde ? 'última execução em ' + a.desde + (a.dias === null ? '' : ' — há ' + a.dias + ' dia(s)')
               : 'nunca registrou execução') +
      ' · esperado: ao menos a cada ' + a.limite + ' dia(s)';
  });
  try {
    /* o envio é DIRETO (MailApp), nunca por enfileirarEmail_, e na mesma
       forma de objeto que tentarEnviar_ usa */
    MailApp.sendEmail({ to: destinos.join(','), name: 'Gerador de PPP — SEE/MG',
      subject: 'Gerador de PPP: rotina automática parada',
      body: 'A verificação diária encontrou rotina(s) agendada(s) sem execução registrada dentro do prazo esperado:\n\n' +
        linhas.join('\n') + '\n\n' +
        'Confira os acionadores do projeto (menu "Gerador de PPP" → "Instalar backup diário" reinstala os cinco) ' +
        'e a cota de execução da conta dona.\n\n' + urlApp_() });
  } catch (e) {
    registrarHistorico_('sistema', 'aviso de rotina parada não enviado', '—', '', String(e && e.message || e));
    return 0;
  }
  props.setProperty(PROP_AVISO_ROTINAS, hoje);
  registrarHistorico_('sistema', 'rotinas paradas avisadas', '—', '', linhas.join(' | '));
  return destinos.length;
}

const PROP_INTEGRIDADE = 'INTEGRIDADE_ESTADO'; // {de, verificados, faltas, inicio}

function verificarIntegridade_() {
  const aba = abaRegistros_();
  const props = PropertiesService.getScriptProperties();
  let estado = {};
  try { estado = JSON.parse(props.getProperty(PROP_INTEGRIDADE) || '{}'); } catch (e) { estado = {}; }
  const t0 = Date.now();
  const de = Math.max(0, parseInt(estado.de, 10) || 0);
  const todos = lerColunas_(aba, ['protocolo', 'escola', 'sre', 'status', 'fonteId', 'pdfId', 'ataId', 'anexos']);
  /* ============================================================
     v8.13 (E16, A8-15) — GRAVA O QUE JÁ FEZ, LOTE A LOTE.

     As faltas eram acumuladas num array FORA do `while` e o cursor só era
     gravado depois que o laço terminava; e o orçamento de tempo só era
     conferido ao fim de cada lote de INTEGRIDADE_LOTE registros — que são
     até cinco `DriveApp.getFileById` cada. Estourando os 6 minutos no meio
     de um lote, NADA era gravado: nem as faltas encontradas, nem o avanço
     do cursor, e a execução seguinte recomeçava do mesmo ponto para morrer
     no mesmo lugar. É o problema que a v8.4 diz ter resolvido, um nível
     acima. Agora: faltas e cursor gravados ao fim de CADA lote, e o tempo
     conferido a cada INTEGRIDADE_PASSO registros DENTRO do lote, com saída
     limpa — o cursor é o índice do próximo registro NÃO INICIADO, de modo
     que nenhum registro é conferido duas vezes nem pulado.
     ============================================================ */
  const quando = agora_();
  const abaI = abaIntegridade_();
  let verificados = 0, ate = de, faltasTotais = 0, parar = false;
  let ultimas = [];
  let acumulado = { de: de,
                    verificados: (parseInt(estado.verificados, 10) || 0),
                    faltas: (parseInt(estado.faltas, 10) || 0),
                    inicio: estado.inicio || quando };
  while (ate < todos.length && !parar) {
    const fim = Math.min(todos.length, ate + INTEGRIDADE_LOTE);
    const faltas = [];
    let confs = 0, passo = 0, i = ate;
    for (; i < fim; i++) {
      const r = todos[i];
      if (String(r.protocolo || '').trim()) {
        const confere = function (tipo, id) {
          if (!id) return;
          confs++;
          if (!arquivoExiste_(id)) faltas.push({ protocolo: r.protocolo, escola: r.escola, sre: r.sre, tipo: tipo, id: id });
        };
        confere('documento congelado', r.fonteId);
        confere('PDF oficial', r.pdfId);
        confere('ata', r.ataId);
        let anexos = []; try { anexos = JSON.parse(r.anexos || '[]'); } catch (e) { anexos = []; }
        (Array.isArray(anexos) ? anexos : []).forEach(function (a) { confere('anexo ' + (a.nome || ''), a.id); });
      }
      passo++;
      /* o orçamento é conferido DENTRO do lote: `i++` porque este registro já
         foi inteiramente conferido, e o cursor aponta o PRÓXIMO. */
      if ((passo % INTEGRIDADE_PASSO) === 0 && (Date.now() - t0) >= INTEGRIDADE_TEMPO) { parar = true; i++; break; }
    }
    /* as faltas DESTE lote (ou do pedaço dele) são gravadas AGORA */
    if (faltas.length) {
      abaI.getRange(abaI.getLastRow() + 1, 1, faltas.length, 7).setValues(faltas.map(function (f) {
        return [quando, f.protocolo, f.escola, f.sre, f.tipo, f.id, 'arquivo não encontrado no Drive'];
      }));
    }
    verificados += confs; faltasTotais += faltas.length;
    ultimas = ultimas.concat(faltas).slice(0, 200);
    ate = i;
    acumulado = { de: (ate < todos.length) ? ate : 0,
                  verificados: acumulado.verificados + confs,
                  faltas: acumulado.faltas + faltas.length,
                  inicio: acumulado.inicio };
    /* e o cursor também: quem morrer daqui em diante continua daqui */
    if (ate < todos.length) props.setProperty(PROP_INTEGRIDADE, JSON.stringify(acumulado));
    if (!parar && (Date.now() - t0) >= INTEGRIDADE_TEMPO) parar = true;
  }
  const regs = { length: ate - de };
  const proximo = (ate < todos.length) ? ate : 0;
  const faltas = { length: faltasTotais };
  if (proximo) {
    props.setProperty(PROP_INTEGRIDADE, JSON.stringify(acumulado));
    registrarHistorico_('sistema', 'integridade — lote verificado', '—', '',
      'registros ' + (de + 1) + '–' + (de + regs.length) + ' de ' + todos.length + ' · ' +
      verificados + ' arquivo(s) conferido(s), ' + faltas.length + ' falta(s) · continua');
    return { ok: true, parcial: true, de: de, proximo: proximo, total: todos.length,
             verificados: verificados, faltas: faltas.length, itens: ultimas.slice(0, 200), quando: quando };
  }
  /* volta fechada: o aviso sai com o total do ciclo */
  props.deleteProperty(PROP_INTEGRIDADE);
  verificados = acumulado.verificados;
  const faltasCiclo = acumulado.faltas;
  if (faltasCiclo) {
    /* avisa quem cuida do sistema: os curadores e os acessos do Órgão Central */
    const destinos = {};
    CURADORES.forEach(function (e) { if (e) destinos[String(e).toLowerCase()] = true; });
    acessosTodos_().forEach(function (a) { if (a.perfil === 'central' && a.email && String(a.situacao || 'ativo').toLowerCase() !== 'inativo') destinos[a.email] = true; });
    if (!Object.keys(destinos).length) ADMINS.forEach(function (e) { if (e) destinos[String(e).toLowerCase()] = true; });
    const lista = Object.keys(destinos);
    if (!lista.length) registrarHistorico_('sistema', 'integridade sem destinatário', '—', '', 'cadastre um acesso do Órgão Central ou um curador para receber os avisos');
    if (lista.length) {
      enfileirarEmail_(lista.join(','), 'integridade', 'Integridade do acervo: ' + faltasCiclo + ' arquivo(s) não encontrado(s)',
        'A verificação do Gerador de PPP, encerrada em ' + quando + ' (iniciada em ' + acumulado.inicio + '), conferiu ' +
        verificados + ' arquivo(s) referido(s) pelos registros e não encontrou ' + faltasCiclo + '.\n\n' +
        'As faltas desta volta estão na aba "Integridade" da planilha, com a data de cada conferência. ' +
        'Para restaurar, siga o procedimento do LEIA-ME (backups na pasta "' + NOME_PASTA_BACKUP + '").', 1);
    }
  }
  registrarHistorico_('sistema', 'integridade verificada', '—', '',
    'volta completa em ' + todos.length + ' registro(s) · ' + verificados + ' arquivo(s) conferido(s), ' + faltasCiclo + ' falta(s)');
  /* v8.13 (E02) — o carimbo vem ANTES do batimento: a própria verificação é
     uma das rotinas conferidas, e ela acabou de rodar. */
  marcarRotina_('verificarIntegridade_');
  const atrasadas = conferirRotinas_();
  const avisadas = atrasadas.length ? avisarRotinasParadas_(atrasadas) : 0;
  return { ok: true, parcial: false, total: todos.length, verificados: verificados,
           faltas: faltasCiclo, itens: ultimas.slice(0, 200), quando: quando,
           rotinasAtrasadas: atrasadas, avisoRotinas: avisadas };
}

/**
 * v7.9 (P11) — SANEAMENTO do histórico de gestores das versões 7.0–7.2, que
 * gravavam os membros do colegiado como se fossem períodos de gestão
 * (perfil "escola", sem papel). Para cada linha de perfil "escola" cujo
 * e-mail é de um cadastro de colegiado (e nunca de um diretor), grava
 * Perfil = "colegiado", o motivo, e a data-fim se estava aberta. Nada é
 * apagado. Os leitores já filtram perfil === "escola". Executar UMA vez,
 * pelo menu da planilha ou pelo editor; repetir não faz mal.
 */
function sanearHistoricoColegiado_() {
  /* v8.13 (E01, A8-18): reescreve linhas do registro permanente de gestores;
     nada disso pode correr com um cadastro em curso. */
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return sanearHistoricoColegiadoSemTrava_(); } finally { lock.releaseLock(); }
}
function sanearHistoricoColegiadoSemTrava_() {
  const aba = abaGestores_();
  const n = aba.getLastRow();
  if (n < 2) return { ok: true, marcadas: 0 };
  const colegiado = {}, diretores = {};
  acessosTodos_().forEach(function (a) {
    if (papelDe_(a) === 'colegiado') colegiado[a.email] = true;
    if (papelDe_(a) === 'diretor_escolar') diretores[a.email] = true;
  });
  const vals = aba.getRange(2, 1, n - 1, GESTOR_COLS.length).getDisplayValues();
  const motivo = 'linha de colegiado das 7.0–7.2 — não é período de gestão';
  let marcadas = 0;
  vals.forEach(function (r, i) {
    const perfil = String(r[9] || 'escola').trim().toLowerCase();
    const email = String(r[4] || '').trim().toLowerCase();
    if (perfil !== 'escola' || !email) return;
    if (!colegiado[email] || diretores[email]) return;
    const linha = i + 2;
    /* v8.13 (F07): o motivo é texto */
    faixaDeTexto_(aba, linha, 10, 1, 1).setValue('colegiado');
    faixaDeTexto_(aba, linha, 9, 1, 1).setValue(motivo);
    if (!String(r[6] || '').trim()) faixaDeTexto_(aba, linha, 7, 1, 1).setValue(agora_());
    marcadas++;
  });
  invalidarGestores_();
  registrarHistorico_(usuarioAtual_() || 'editor do Apps Script', 'histórico de gestores saneado', '—', '',
    marcadas + ' linha(s) de colegiado marcada(s) — não são períodos de gestão');
  Logger.log('%s linha(s) marcada(s) como colegiado.', marcadas);
  return { ok: true, marcadas: marcadas };
}

/** Instala os acionadores: backup diário (3h), fila de e-mails (10 min),
    integridade semanal (segunda, 4h) e rotação mensal do histórico de
    acessos (dia 1, 4h). Pode ser executado de novo a qualquer momento. */
/* ============================================================
   v8.8 (G2) — O RESUMO SEMANAL DO QUE ESTÁ PARADO

   Não havia prazo, alerta nem relatório de PPP parado: um documento
   esquecido em validação, um validado que nunca se conclui, um em assinatura
   que não anda, uma revisão vencida — nada disso avisava ninguém. Com 3.400
   escolas e 47 regionais, só aparecia para quem abrisse o painel e reparasse.
   Toda segunda-feira o sistema monta, por SRE, o que está parado e há quantos
   dias, e enfileira o resumo para quem valida naquela regional; o Órgão
   Central recebe o consolidado da rede.
   ============================================================ */
const PARADO_DIAS = {};
PARADO_DIAS[ST_VALIDACAO] = 7;      /* esperando a Diretoria Educacional */
PARADO_DIAS[ST_VALIDADO] = 15;      /* validado e não concluído */
PARADO_DIAS[ST_ASSINATURA] = 20;    /* coleta de assinaturas parada */
PARADO_DIAS[ST_ASSINADO] = 20;      /* assinado, esperando a ata */
PARADO_DIAS[ST_CONCLUIDO] = 10;     /* concluído, esperando a homologação */
PARADO_DIAS[ST_HOMOLOGADO] = 10;    /* enviado para homologação, sem resposta */
PARADO_DIAS[ST_ANDAMENTO] = 60;     /* em elaboração, sem toque */

const CHAVES_PARADOS = ['protocolo', 'escola', 'inep', 'sre', 'status', 'versao', 'pct', 'atualizadoEm',
  'enviadoValidacaoEm', 'validadoEm', 'concluidoEm', 'homolData', 'homolEm'];

/** O que está parado, por regional. Sem efeito colateral: serve ao acionador e à conferência. */
function levantarParados_() {
  const vals = lerColunas_(abaRegistros_(), CHAVES_PARADOS);
  const porSre = {};
  vals.forEach(function (v) {
    if (!String(v.protocolo || '').trim()) return;
    const status = String(v.status || '');
    const vencida = revisaoVencida_({ homolEm: v.homolEm, homolData: v.homolData, concluidoEm: v.concluidoEm });
    const limite = PARADO_DIAS[status];
    const desde = desdeQuando_(v);
    const dias = diasDesde_(desde);
    const parado = (limite !== undefined && dias !== null && dias >= limite);
    if (!parado && !vencida) return;
    const sre = v.sre || SEM_SRE;
    (porSre[sre] = porSre[sre] || []).push({
      protocolo: v.protocolo, escola: v.escola, inep: v.inep, sre: sre, status: status,
      versao: parseInt(v.versao, 10) || 1, pct: parseInt(v.pct, 10) || 0,
      dias: dias, desde: desde, limite: limite === undefined ? null : limite,
      motivo: !parado ? 'revisão vencida' : (vencida ? status.toLowerCase() + ' e revisão vencida' : status.toLowerCase())
    });
  });
  Object.keys(porSre).forEach(function (k) {
    porSre[k].sort(function (a, b) { return (b.dias || 0) - (a.dias || 0); });
  });
  const total = Object.keys(porSre).reduce(function (t, k) { return t + porSre[k].length; }, 0);
  return { ok: true, porSre: porSre, total: total, geradoEm: agora_() };
}

function tabelaParados_(lista, comSre) {
  const linha = function (c) { return '<td style="border:1px solid #BFBFBF;padding:5px 8px;font-size:13px">' + c + '</td>'; };
  return '<table style="border-collapse:collapse;margin-top:8px">' +
    '<tr style="background:#F2F2F2">' +
    (comSre ? '<th style="border:1px solid #BFBFBF;padding:5px 8px;font-size:12px;text-align:left">Regional</th>' : '') +
    '<th style="border:1px solid #BFBFBF;padding:5px 8px;font-size:12px;text-align:left">Escola</th>' +
    '<th style="border:1px solid #BFBFBF;padding:5px 8px;font-size:12px;text-align:left">Protocolo</th>' +
    '<th style="border:1px solid #BFBFBF;padding:5px 8px;font-size:12px;text-align:left">Situação</th>' +
    '<th style="border:1px solid #BFBFBF;padding:5px 8px;font-size:12px;text-align:left">Há quantos dias</th></tr>' +
    lista.map(function (x) {
      return '<tr>' + (comSre ? linha(esc_(x.sre)) : '') + linha(esc_(x.escola)) + linha(esc_(x.protocolo)) +
             linha(esc_(x.motivo)) + linha(x.dias === null ? '—' : x.dias) + '</tr>';
    }).join('') + '</table>';
}

/** Acionador semanal: enfileira o resumo por SRE e o consolidado da rede. */
function resumoSemanalParados_() {
  const r = levantarParados_();
  const link = urlApp_();
  let enviados = 0;
  Object.keys(r.porSre).sort().forEach(function (sre) {
    const lista = r.porSre[sre];
    const destinos = validadoresDaSre_(sre);
    if (!destinos.length || !lista.length) return;
    const corpo = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' +
      '<p>Na Superintendência Regional de Ensino de <b>' + esc_(sre) + '</b> há <b>' + lista.length +
      '</b> Projeto(s) Político-Pedagógico(s) parado(s) além do prazo de referência, ou com a revisão vencida.</p>' +
      tabelaParados_(lista.slice(0, 60), false) +
      (lista.length > 60 ? '<p style="font-size:12.5px;color:#5A6572">Mostrando os 60 mais antigos.</p>' : '') +
      (link ? '<p><a href="' + link + '">Abrir o painel</a></p>' : '') +
      '<p style="font-size:12.5px;color:#5A6572">Prazos de referência: validação ' + PARADO_DIAS[ST_VALIDACAO] +
      ' dias, validado sem conclusão ' + PARADO_DIAS[ST_VALIDADO] + ', coleta de assinaturas ' +
      PARADO_DIAS[ST_ASSINATURA] + ', concluído sem homologação ' + PARADO_DIAS[ST_CONCLUIDO] +
      ', em elaboração sem toque ' + PARADO_DIAS[ST_ANDAMENTO] + '. Este resumo é semanal e automático.</p></div>';
    enfileirarEmail_(destinos.join(','), 'validação',
      'PPPs parados na SRE ' + sre + ' — ' + lista.length + ' documento(s)', corpo, 3);
    enviados++;
  });
  /* o consolidado da rede, para o Órgão Central */
  const centrais = CURADORES.filter(Boolean).concat(acessosTodos_().filter(function (a) {
    return a.perfil === 'central' && String(a.situacao || 'ativo').toLowerCase() !== 'inativo' && a.email;
  }).map(function (a) { return a.email; })).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
  if (centrais.length && r.total) {
    const porRegional = Object.keys(r.porSre).sort().map(function (sre) {
      return { sre: sre, escola: r.porSre[sre].length + ' documento(s)', protocolo: '—',
               motivo: 'mais antigo: ' + (r.porSre[sre][0].dias === null ? '—' : r.porSre[sre][0].dias + ' dias'),
               dias: r.porSre[sre][0].dias };
    });
    const corpo = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' +
      '<p>Na rede há <b>' + r.total + '</b> Projeto(s) Político-Pedagógico(s) parado(s) além do prazo de ' +
      'referência, ou com a revisão vencida, em ' + Object.keys(r.porSre).length + ' regional(is).</p>' +
      tabelaParados_(porRegional, true) +
      blocoDesistenciasDaSemana_() +
      (link ? '<p><a href="' + link + '">Abrir o painel</a></p>' : '') + '</div>';
    enfileirarEmail_(centrais.join(','), 'validação',
      'PPPs parados na rede — ' + r.total + ' documento(s)', corpo, 3);
    enviados++;
  }
  registrarHistorico_('resumo semanal', 'PPPs parados levantados', '—', '',
    r.total + ' documento(s) em ' + Object.keys(r.porSre).length + ' regional(is) · ' + enviados + ' aviso(s) enfileirado(s)');
  marcarRotina_('resumoSemanalParados_');   /* v8.13 (E02) */
  return { ok: true, total: r.total, regionais: Object.keys(r.porSre).length, avisos: enviados };
}

/**
 * v8.13 (E14, A8-08) — AS DESISTÊNCIAS DA SEMANA, no resumo do Órgão Central.
 * Uma mensagem que atinge FILA_MAX_TENTATIVAS deixa de ser tentada, não é
 * expurgada, não gera aviso e não aparece em lugar nenhum. Num sistema cuja
 * porta de entrada é o convite, convite perdido em silêncio é o pior desfecho
 * possível: a desistência passa a ser linha no histórico (no momento em que
 * acontece) e contagem semanal, com os destinatários, aqui.
 * Lê o HISTÓRICO, não a fila — a linha da fila pode já ter sido expurgada, e
 * o histórico é o registro do fato.
 */
function desistenciasDaSemana_() {
  const aba = abaHistAcessos_();
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  const vals = aba.getRange(2, 1, ultima - 1, 6).getDisplayValues();
  const lista = [];
  vals.forEach(function (v) {
    if (String(v[2]) !== 'desistiu de enviar') return;
    const d = diasDesde_(v[0]);
    if (d === null || d > 7) return;
    lista.push({ em: v[0], para: v[3], detalhe: v[5] });
  });
  return lista;
}
function blocoDesistenciasDaSemana_() {
  const lista = desistenciasDaSemana_();
  if (!lista.length) return '';
  const linhas = lista.slice(0, 30).map(function (x) {
    return '<li>' + esc_(x.para) + ' — ' + esc_(x.detalhe) + ' <span style="color:#5A6572">(' + esc_(x.em) + ')</span></li>';
  }).join('');
  return '<p style="margin-top:14px"><b>Mensagens que o sistema desistiu de enviar nesta semana: ' +
    lista.length + '</b></p><ul style="font-size:13px;line-height:1.5">' + linhas + '</ul>' +
    (lista.length > 30 ? '<p style="font-size:12.5px;color:#5A6572">Mostrando as 30 primeiras.</p>' : '') +
    '<p style="font-size:12.5px;color:#5A6572">Cada uma delas é um convite ou um aviso que NÃO chegou ao ' +
    'destinatário. Confira o endereço no cadastro e reenvie o convite pela tela de acessos.</p>';
}

function instalarAcionadores_() {
  const nossos = ['backupDiario_', 'processarFilaEmails_', 'expurgarFilaRotina_', 'verificarIntegridade_',
                  'rotacionarHistoricoAcessos_', 'resumoSemanalParados_'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (nossos.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupDiario_').timeBased().everyDays(1).atHour(3).create();
  /* v7.6 (P4): a fila de e-mails é processada a cada 10 minutos */
  ScriptApp.newTrigger('processarFilaEmails_').timeBased().everyMinutes(10).create();
  /* v8.13 (E13): o expurgo da fila deixou de rodar dentro do envio e ganhou
     acionador próprio, de madrugada, fora do horário de uso das escolas */
  ScriptApp.newTrigger('expurgarFilaRotina_').timeBased().everyDays(1).atHour(2).create();
  /* v7.8 (P10, P8): integridade semanal; histórico de acessos arquivado mensalmente */
  /* v8.4 — diária, e não semanal: a verificação passou a ser em lotes, e é a
     execução seguinte que continua de onde a anterior parou. */
  ScriptApp.newTrigger('verificarIntegridade_').timeBased().everyDays(1).atHour(4).create();
  ScriptApp.newTrigger('rotacionarHistoricoAcessos_').timeBased().onMonthDay(1).atHour(4).create();
  /* v8.8 (G2): o resumo do que está parado, toda segunda-feira */
  ScriptApp.newTrigger('resumoSemanalParados_').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(5).create();
  abaFila_(); abaHistAcessos_(); abaCiclo_(); abaIntegridade_();
  /* v8.13 (E01) — os acionadores passaram a apontar para nomes PRIVADOS, e
     eu não aceito depender disso sem prova: relê os acionadores instalados e
     registra no histórico os nomes que ficaram de fato. Se algum dia o Apps
     Script deixar de aceitar um nome com sublinhado, a lista registrada dirá
     — e E02 (o batimento das rotinas) avisa em 24 h se algum ficar mudo. */
  const instalados = ScriptApp.getProjectTriggers()
    .map(function (t) { return t.getHandlerFunction(); })
    .filter(function (n) { return nossos.indexOf(n) >= 0; });
  registrarHistorico_(usuarioAtual_() || 'menu da planilha', 'acionadores instalados', '—', '',
    instalados.join(', ') || 'nenhum acionador do sistema foi reconhecido depois da instalação');
  Logger.log('Acionadores instalados: backup diário (3h, fuso %s), fila de e-mails (10 min), expurgo da fila (2h), integridade diária em lotes (4h), rotação mensal do histórico de acessos (dia 1, 4h) e resumo semanal de PPPs parados (segunda, 5h).', Session.getScriptTimeZone());
  Logger.log('Acionadores efetivamente instalados: %s', instalados.join(', '));
  return { ok: true, instalados: instalados };
}

/* ============================================================
   Painel
   ============================================================ */

/* ============================================================
   v8.13 (E01, A8-22) — O MENU DA PLANILHA E O DISCRIMINADOR

   Item de menu não chama função privada: o Apps Script não resolve um nome
   terminado em "_" como destino de `addItem`. Por isso cada item passa a
   apontar para um invólucro público `menu…`, e cada invólucro começa por
   `somenteMenu_()`.

   O DISCRIMINADOR É CONFIÁVEL, e está provado no próprio achado A8-22:
   `SpreadsheetApp.getUi()` LANÇA fora do contexto da planilha. Quem clicar
   no menu passa; quem tentar chamar `menuBackupAgora` pelo google.script.run
   cai na exceção e não executa nada.

   `onOpen` não pode ser renomeado (é acionador simples da planilha e o Apps
   Script exige o nome exato). O corpo inteiro vai para dentro de um
   try/catch: chamado pela tela, `getUi()` lança e a função sai calada, em
   vez de encher o log de exceções de quem está varrendo a superfície.
   ============================================================ */
function somenteMenu_() {
  try { SpreadsheetApp.getUi(); }
  catch (e) { throw new Error('Esta é uma rotina de manutenção: só roda pelo menu da planilha.'); }
}
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Gerador de PPP')
      .addItem('Atualizar painel de acompanhamento', 'menuAtualizarPainel')
      .addItem('Recalcular % preenchido', 'menuRecalcularPercentuais')
      .addSeparator()
      .addItem('Verificar configuração', 'menuVerificarConfiguracao')
      .addItem('Definir senha institucional', 'menuDefinirSenhaCuradoria')
      .addItem('Importar diretores em lote (implantação)', 'menuImportarDiretores')
      .addItem('Fazer backup agora', 'menuBackupAgora')
      .addItem('Backups guardados (listar)', 'menuListarBackups')
      .addItem('Instalar backup diário', 'menuInstalarAcionadores')
      .addSeparator()
      .addItem('Conteúdo publicado (conferir)', 'menuConferirConteudo')
      .addItem('Preparar cadastro de acessos', 'menuPrepararAcessos')
      .addSeparator()
      .addItem('Sanear histórico de gestores (7.0–7.2)', 'menuSanearHistorico')
      .addItem('Verificar integridade do acervo', 'menuVerificarIntegridade')
      .addItem('Conferir homologações sem ato no ciclo', 'menuAuditarHomologacoes')
      .addItem('Conferir códigos de autenticidade repetidos', 'menuAuditarCodigos')
      .addItem('Resumo dos PPPs parados (enviar agora)', 'menuResumoParados')
      .addItem('Limpar corpos da fila de e-mails', 'menuLimparCorposDaFila')
      .addToUi();
  } catch (e) { /* fora da planilha não há menu a criar — e não há o que registrar */ }
}
function menuAtualizarPainel()        { somenteMenu_(); return atualizarPainel_(); }
function menuRecalcularPercentuais()  { somenteMenu_(); return recalcularPercentuais_(); }
function menuVerificarConfiguracao() {
  somenteMenu_();
  const r = testeConfiguracao_();
  /* v8.13 (E02/E03): o diagnóstico é para ser LIDO, e por isso sai numa
     caixa, não só no log. */
  const rot = Object.keys(ROTINAS_ESPERADAS).map(function (n) {
    return '· ' + (ROTINAS_NOMES[n] || n) + ': ' + ((r.rotinas || {})[n] || 'nunca registrou execução');
  }).join('\n');
  const div = ((r.planilha || {}).divergencias || []);
  SpreadsheetApp.getUi().alert('Verificação de configuração',
    'Aba "' + NOME_ABA + '": ' + r.colunas + ' colunas, ' + r.registros + ' registro(s).\n\n' +
    'ROTINAS AGENDADAS — última execução:\n' + rot + '\n\n' +
    'Atrasadas: ' + ((r.rotinasAtrasadas || []).map(function (a) { return a.nome; }).join(', ') || 'nenhuma') + '\n\n' +
    'CABEÇALHO DAS ABAS: ' + (div.length ? div.length + ' divergência(s)\n' +
      div.map(function (d) { return '· ' + d.erro; }).join('\n') : 'nenhuma divergência'),
    SpreadsheetApp.getUi().ButtonSet.OK);
  return r;
}
/* ============================================================
   v8.13 (F12) — AS DUAS CONFERÊNCIAS PROMETIDAS NO LOTE 2.

   O lote 2 adiou dois saneamentos retroativos — homologação gravada pela
   tela antes de D02 e código de autenticidade repetido antes de D04 —
   DECLARANDO como compensação estas duas conferências. Elas não foram
   escritas, e sem elas a decisão de não sanear perdia a metade que a
   justificava: quem recebe uma base já em uso não tem como saber se há
   homologação sem ato correspondente na linha do tempo, ou dois documentos
   com o mesmo código.

   SÃO SOMENTE LEITURA. Nenhuma escrita, nenhuma trava, nenhum deleteRow:
   elas LISTAM, e o que fazer com um caso encontrado é decisão de quem
   responde pelo documento, registrada no ciclo como qualquer outro ato.
   Cada aba é lida numa FAIXA ÚNICA — a de Registros tem 3.400 linhas e a de
   Ciclo muito mais; uma leitura por registro não caberia na execução.
   ============================================================ */
/**
 * Registros com homologação gravada e SEM o ato correspondente no ciclo.
 * Possível antes da 8.13 (a tela gravava a homologação sem passar pelo ato);
 * impedido nela. Devolve a lista, e nada mais.
 */
function auditarHomologacoesSemCiclo_() {
  const abaR = abaRegistros_();
  const nR = abaR.getLastRow();
  if (nR < 2) return { ok: true, total: 0, itens: [] };
  const regs = lerColunas_(abaR, ['protocolo', 'escola', 'sre', 'homolEm', 'homolPor', 'homolAto']);
  /* o ciclo, numa faixa só: protocolo (2) e ato (3) */
  const abaC = abaCiclo_();
  const nC = abaC.getLastRow();
  const comAto = {};
  if (nC >= 2) {
    abaC.getRange(2, 2, nC - 1, 2).getDisplayValues().forEach(function (l) {
      if (String(l[1]) === 'PPP homologado pela SRE') comAto[String(l[0]).trim().toUpperCase()] = true;
    });
  }
  const itens = [];
  regs.forEach(function (v) {
    const prot = String(v.protocolo || '').trim().toUpperCase();
    if (!prot || !String(v.homolEm || '').trim()) return;
    if (comAto[prot]) return;
    itens.push({ protocolo: prot, escola: v.escola || '', sre: v.sre || '',
                 homolEm: v.homolEm || '', homolPor: semEmail_(v.homolPor || ''),
                 homolAto: v.homolAto || '' });
  });
  return { ok: true, total: itens.length, itens: itens };
}
/**
 * Códigos de autenticidade repetidos: dois documentos respondendo pelo mesmo
 * código. Possível antes da 8.13 (D04), impedido nela.
 */
function auditarCodigosRepetidos_() {
  const aba = abaRegistros_();
  const n = aba.getLastRow();
  if (n < 2) return { ok: true, total: 0, grupos: [] };
  const regs = lerColunas_(aba, ['protocolo', 'escola', 'sre', 'hash', 'concluidoEm']);
  const por = {};
  regs.forEach(function (v) {
    const h = String(v.hash || '').trim();
    const prot = String(v.protocolo || '').trim().toUpperCase();
    if (!h || !prot) return;
    (por[h] = por[h] || []).push({ protocolo: prot, escola: v.escola || '', sre: v.sre || '',
                                   concluidoEm: v.concluidoEm || '' });
  });
  const grupos = [];
  Object.keys(por).forEach(function (h) {
    if (por[h].length > 1) grupos.push({ codigo: h, documentos: por[h] });
  });
  return { ok: true, total: grupos.length, grupos: grupos };
}
function menuAuditarHomologacoes() {
  somenteMenu_();
  const r = auditarHomologacoesSemCiclo_();
  SpreadsheetApp.getUi().alert('Homologações sem ato no ciclo',
    r.total === 0
      ? 'Nenhuma: toda homologação gravada tem o ato correspondente na linha do tempo do documento.'
      : r.total + ' registro(s) com homologação gravada e SEM o ato "PPP homologado pela SRE" no ciclo.\n' +
        'Isto era possível antes da 8.13 e está impedido nela. A conferência não corrige nada — o que ' +
        'fazer com cada caso é decisão de quem responde pelo documento.\n\n' +
        r.itens.slice(0, 40).map(function (i) {
          return '· ' + i.protocolo + ' — ' + i.escola + (i.sre ? ' (SRE ' + i.sre + ')' : '') +
                 ' — homologado em ' + i.homolEm + (i.homolPor ? ', por ' + i.homolPor : '');
        }).join('\n') + (r.total > 40 ? '\n… e mais ' + (r.total - 40) + '.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
  return r;
}
function menuAuditarCodigos() {
  somenteMenu_();
  const r = auditarCodigosRepetidos_();
  SpreadsheetApp.getUi().alert('Códigos de autenticidade repetidos',
    r.total === 0
      ? 'Nenhum: cada código de autenticidade responde por um documento só.'
      : r.total + ' código(s) repetido(s). Isto era possível antes da 8.13 e está impedido nela.\n' +
        'A conferência não corrige nada — regerar documento concluído é justamente o que esta versão ' +
        'existe para impedir.\n\n' +
        r.grupos.slice(0, 20).map(function (g) {
          return '· ' + g.codigo + ': ' + g.documentos.map(function (d) {
            return d.protocolo + ' (' + d.escola + (d.concluidoEm ? ', concluído em ' + d.concluidoEm : '') + ')';
          }).join(' · ');
        }).join('\n') + (r.total > 20 ? '\n… e mais ' + (r.total - 20) + '.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
  return r;
}
function menuBackupAgora()            { somenteMenu_(); return backupDiario_({ forcado: true }); }
function menuInstalarAcionadores()    { somenteMenu_(); return instalarAcionadores_(); }
function menuConferirConteudo()       { somenteMenu_(); return conferirConteudo_(); }
function menuPrepararAcessos()        { somenteMenu_(); return abaAcessos_(); }
function menuSanearHistorico()        { somenteMenu_(); return sanearHistoricoColegiado_(); }
function menuVerificarIntegridade()   { somenteMenu_(); return verificarIntegridade_(); }
function menuResumoParados()          { somenteMenu_(); return resumoSemanalParados_(); }
/**
 * v8.13 (E14, A8-09): tira da planilha o corpo das mensagens que já não vão
 * ser enviadas — é o único jeito de retirar credencial em claro de uma
 * planilha em uso. Item de menu porque é operação de implantação, feita pelo
 * Órgão Central na própria planilha; a rotina em si é privada.
 */
function menuLimparCorposDaFila()     { somenteMenu_(); return limparCorposDaFila_(); }
/** v8.13 (E01): a lista dos backups, que o procedimento de restauração usa. */
function menuListarBackups() {
  somenteMenu_();
  const r = listarBackups_() || [];
  const linhas = r.map(function (a) { return '· ' + a.nome + ' — ' + a.criadoEm; });
  SpreadsheetApp.getUi().alert('Backups guardados',
    (linhas.length ? linhas.join('\n') : 'Nenhum backup na pasta "' + NOME_PASTA_BACKUP + '".') +
    '\n\nO procedimento de restauração está no LEIA-ME.', SpreadsheetApp.getUi().ButtonSet.OK);
  return r;
}
/**
 * v8.13 (E01) — DECISÃO DE IMPLEMENTAÇÃO, além do plano: a senha
 * institucional precisava de um caminho. `definirSenhaCuradoria_` passou a
 * ser privada, e função privada NÃO aparece no seletor de funções do editor
 * do Apps Script — sem este item, uma implantação nova não teria como
 * definir a senha do Órgão Central. O prompt do menu é o caminho, e ele
 * exige a confirmação quando já há senha.
 */
function menuDefinirSenhaCuradoria() {
  somenteMenu_();
  const ui = SpreadsheetApp.getUi();
  const jaTem = !!PropertiesService.getScriptProperties().getProperty(PROP_HASH);
  const r1 = ui.prompt('Senha institucional do Órgão Central',
    (jaTem ? 'JÁ EXISTE uma senha definida; a que você digitar a substitui para toda a rede.\n\n' : '') +
    'Digite a senha (ao menos 10 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const senha = String(r1.getResponseText() || '');
  let confirmar = '';
  if (jaTem) {
    const r2 = ui.prompt('Confirmar a substituição',
      'Digite SIM para substituir a senha institucional em uso:', ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() !== ui.Button.OK) return;
    confirmar = String(r2.getResponseText() || '').trim().toUpperCase();
  }
  try {
    definirSenhaCuradoria_(senha, confirmar);
    ui.alert('Senha institucional definida.');
  } catch (e) { ui.alert(String(e && e.message || e)); }
}

/** Relatório rápido: quantos textos a curadoria já alterou. */
function conferirConteudo_() {
  const pub = conteudoPublicado();
  const est = curadoriaEstado_();
  SpreadsheetApp.getUi().alert('Curadoria de conteúdo',
    'Versão publicada: ' + pub.versao + '\n' +
    'Textos alterados em relação ao padrão do sistema: ' + Object.keys(pub.itens).length + '\n' +
    'Alterações em rascunho, aguardando publicação: ' + est.pendentes + '\n\n' +
    'A aba "' + NOME_ABA_CONTEUDO + '" guarda apenas as diferenças; o texto original permanece no código.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ============================================================
   BASE SINTÉTICA E MEDIÇÃO (v7.5, P2)

   Para o piloto técnico, numa CÓPIA da planilha: gera n escolas — cada
   uma com diretor, dois membros de colegiado e um PPP com textos do
   tamanho real — e mede o tempo das chamadas mais frequentes. É o que
   permite dizer "antes/depois" em vez de supor. Recusa rodar fora de uma
   cópia: o nome da planilha precisa conter "TESTE" ou "CÓPIA", e o
   segundo argumento precisa ser a palavra SIM.
   ============================================================ */
function gerarBaseSintetica_(n, confirmar) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nome = String((ss.getName && ss.getName()) || '').toUpperCase();
  if (String(confirmar) !== 'SIM' || !/TESTE|C[ÓO]PIA/.test(nome)) {
    throw new Error('gerarBaseSintetica_ só roda numa CÓPIA da planilha (nome com "TESTE" ou "CÓPIA") e com o segundo argumento "SIM".');
  }
  n = Math.max(1, Math.min(20000, parseInt(n, 10) || 100));
  const abaR = abaRegistros_(), abaA = abaAcessos_(), abaE = abaEscolas_();
  const SRES = ['Divinópolis', 'Metropolitana A', 'Metropolitana B', 'Uberlândia', 'Montes Claros', 'Juiz de Fora',
                'Governador Valadares', 'Poços de Caldas', 'Teófilo Otoni', 'Patos de Minas'];
  const STATUS = [ST_ANDAMENTO, ST_ANDAMENTO, ST_ANDAMENTO, ST_VALIDACAO, ST_VALIDADO, ST_ASSINATURA,
                  ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE];
  const frase = 'A escola organiza o trabalho pedagógico a partir do diagnóstico da realidade e das metas de aprendizagem. ';
  const texto = function (tam) { let t = ''; while (t.length < tam) t += frase; return t.slice(0, tam); };
  const base0 = 900000 + Math.floor(Math.random() * 90000);
  const carimbo = agora_();
  const linhasE = [], linhasA = [], linhasR = [];
  const protoBase = abaR.getLastRow();
  for (let i = 0; i < n; i++) {
    const cod = String(base0 + i);
    const sre = SRES[i % SRES.length];
    const escola = 'EE Sintética ' + (i + 1);
    const dir = 'dir.sint' + i + '@exemplo.mg';
    linhasE.push([cod, escola, 'Município ' + (i % 97), sre, 'ativa', '']);
    linhasA.push([dir, 'Diretor Sintético ' + i, 'escola', sre, '', '', 'ativo', carimbo, '', cod, escola, String(1000000 + i), 'diretor_escolar', '', '', '']);
    linhasA.push(['m1.sint' + i + '@exemplo.mg', 'Membro Um ' + i, 'escola', sre, '', '', 'ativo', carimbo, '', cod, escola, '', 'colegiado', '', '', 'Docente']);
    linhasA.push(['m2.sint' + i + '@exemplo.mg', 'Membro Dois ' + i, 'escola', sre, '', '', 'ativo', carimbo, '', cod, escola, '', 'colegiado', '', '', 'Estudante']);
    const status = STATUS[i % STATUS.length];
    const folha = emElaboracao_(status) ? '' : JSON.stringify([
      { papel: 'direcao', nome: 'Diretor Sintético ' + i, email: dir, assinadoEm: carimbo, token: 'tok-d-' + i },
      { papel: 'colegiado', segmento: 'Docente', nome: 'Membro Um ' + i, email: 'm1.sint' + i + '@exemplo.mg', assinadoEm: status === ST_ASSINATURA ? '' : carimbo, token: 'tok-1-' + i },
      { papel: 'colegiado', segmento: 'Estudante', nome: 'Membro Dois ' + i, email: 'm2.sint' + i + '@exemplo.mg', assinadoEm: status === ST_ASSINATURA ? '' : carimbo, token: 'tok-2-' + i }]);
    const reg = CAMPOS.map(function (c) {
      switch (c.key) {
        case 'protocolo': return 'PPP-2026-' + ('0000' + (protoBase + i + 1)).slice(-4) + '-S' + ('00' + (i % 1000)).slice(-3);
        case 'versao': return 1;
        case 'status': return status;
        case 'email': return dir;
        case 'criadoEm': case 'atualizadoEm': return carimbo;
        case 'concluidoEm': return emElaboracao_(status) ? '' : carimbo;
        case 'assinaturas': return folha;
        case 'escola': return escola;
        case 'inep': return cod;
        case 'municipio': return 'Município ' + (i % 97);
        case 'sre': return sre;
        case 'direcao': return 'Diretor Sintético ' + i;
        case 'especialista': return 'Especialista ' + i;
        case 'etapas': return 'Ensino Fundamental — Anos Finais; Ensino Médio';
        case 'mods': return 'Educação de Jovens e Adultos';
        case 'infra': return 'Biblioteca; Quadra';
        case 'temas': return 'Educação ambiental';
        case 'principios': return 'Gestão democrática';
        case 'metodos': return 'Projetos';
        case 'indicadores': return JSON.stringify({ ano: '2025', etapas: { efaf: { mat: '200', apr: '90', rep: '5', aba: String(1 + i % 6), dis: String(10 + i % 15) } } });
        case 'aprovacao': return emElaboracao_(status) ? '' : carimbo;
        case 'homolPor': return status === ST_HOMOLOGADO_SRE ? 'Diretoria Educacional sintética' : '';
        case 'homolEm': return status === ST_HOMOLOGADO_SRE ? carimbo : '';
        case 'homolAto': return '';   /* v9.4: a homologação é registrada no próprio sistema, sem ato externo */
        case 'tela': return 0;
      }
      if (CHAVES_TEXTO.indexOf(c.key) >= 0) return texto(1500 + (i % 7) * 400);
      return '';
    });
    reg[IDX.pct - 1] = pctDe_(reg);
    linhasR.push(reg);
  }
  const gravar = function (aba, linhas) {
    for (let i = 0; i < linhas.length; i += 500) {
      const bloco = linhas.slice(i, i + 500);
      aba.getRange(aba.getLastRow() + 1, 1, bloco.length, bloco[0].length).setValues(bloco);
    }
  };
  gravar(abaE, linhasE); gravar(abaA, linhasA); gravar(abaR, linhasR);
  invalidarEscolas_(); invalidarAcessos_();
  Logger.log('Base sintética: %s escolas, %s acessos, %s registros.', linhasE.length, linhasA.length, linhasR.length);
  return { ok: true, escolas: linhasE.length, acessos: linhasA.length, registros: linhasR.length,
           primeiroCodigo: String(base0), ultimoCodigo: String(base0 + n - 1) };
}
/**
 * Cronometra as chamadas que toda escola faz: entrada (acessoPorEmail_),
 * painel da direção, painel do Central, "um PPP por vez" (buscarPorInep_),
 * "minhas assinaturas" e a regravação de um PPP existente. Devolve e
 * registra os tempos em milissegundos. Roda sobre a base que houver —
 * sintética ou real —, sem alterar nada além de uma regravação idêntica.
 */
function medirDesempenho_(confirmar, codigoEscola) {
  /* v8.13 (E01, A8-16) — a medição REGRAVA um PPP existente (`salvarPPP`) e
     abre sessões no cache. Era pública: bastava chamá-la para pôr o servidor
     a reescrever registros de produção. Rotina que regrava PPP não roda em
     produção, ponto — a mesma trava de gerarBaseSintetica_. */
  const ssM = SpreadsheetApp.getActiveSpreadsheet();
  const nomeM = String((ssM.getName && ssM.getName()) || '').toUpperCase();
  if (String(confirmar) !== 'SIM' || !/TESTE|C[ÓO]PIA/.test(nomeM)) {
    throw new Error('A medição de desempenho só roda numa CÓPIA da planilha (nome com "TESTE" ou "CÓPIA") ' +
      'e com o primeiro argumento "SIM": ela regrava um PPP.');
  }
  const abaR = abaRegistros_();
  const t = {};
  const mede = function (nome, fn) { const t0 = Date.now(); const r = fn(); t[nome] = Date.now() - t0; return r; };
  const acessos = acessosTodos_();
  const dir = acessos.filter(function (a) { return papelDe_(a) === 'diretor_escolar' && (!codigoEscola || a.inep === String(codigoEscola)); }).pop();
  if (!dir) throw new Error('Não há diretor cadastrado para medir.');
  invalidarAcessos_();
  mede('entrada — acessoPorEmail_', function () { return acessoPorEmail_(dir.email); });
  const tokD = criarSessao_({ email: dir.email, nome: dir.nome, perfil: 'escola', papel: 'diretor_escolar', sre: dir.sre, inep: dir.inep, escola: dir.escola });
  const tokC = criarSessao_({ email: 'central@medicao', nome: 'Medição', perfil: 'central', papel: 'central', sre: '' });
  mede('painel da direção', function () { return painelRegistros({ token: tokD, filtros: {} }); });
  /* v8.8 (B2): o Central abre no quadro por SRE; o custo das linhas todas
     passa a ser medido à parte, porque deixou de ser o caminho do dia a dia */
  mede('painel do Central — quadro por SRE', function () { return painelRegistros({ token: tokC, filtros: {} }); });
  const central = mede('painel do Central — todas as linhas', function () { return painelRegistros({ token: tokC, filtros: { todas: true } }); });
  mede('um PPP por vez — buscarPorInep_', function () { return buscarPorInep_(abaR, dir.inep); });
  const membro = acessos.filter(function (a) { return papelDe_(a) === 'colegiado' && a.inep === dir.inep; })[0];
  if (membro) {
    const tokM = criarSessao_({ email: membro.email, nome: membro.nome, perfil: 'escola', papel: 'colegiado', sre: membro.sre, inep: membro.inep, escola: membro.escola });
    mede('minhas assinaturas', function () { return minhasAssinaturas({ token: tokM }); });
  }
  const meu = (central.linhas || []).filter(function (x) { return String(x.inep) === String(dir.inep) && x.status === ST_ANDAMENTO; })[0];
  if (meu) {
    const linha = linhaDoProtocolo_(abaR, meu.protocolo);
    const reg = lerLinha_(abaR, linha);
    reg.token = tokD; reg.protocolo = meu.protocolo;
    mede('regravar PPP existente — salvarPPP', function () { return salvarPPP(reg); });
  }
  t.linhasNoPainelCentral = (central.linhas || []).length;
  Logger.log(JSON.stringify(t, null, 2));
  return t;
}

function atualizarPainel_() {
  /* v8.13 (E01, A8-18): a aba "Painel" é APAGADA e reescrita por inteiro.
     Sem a trava, isso corria com qualquer gravação em curso — e a rotina
     ainda era pública no google.script.run, de modo que qualquer navegador
     podia mandá-la rodar em cima da base. */
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return atualizarPainelSemTrava_(); } finally { lock.releaseLock(); }
}
function atualizarPainelSemTrava_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = abaRegistros_();
  let painel = ss.getSheetByName('Painel');
  if (!painel) painel = ss.insertSheet('Painel');
  painel.clear();
  painel.setConditionalFormatRules([]);

  const cab = ['Protocolo', 'V.', 'Escola', 'Município', 'SRE', 'Status', 'Seções', '% concluído',
               'Assinaturas', 'Presentes à aprovação', 'Ata', 'Homologação', 'Abandono', 'Distorção', 'Última atualização', 'PDF'];
  painel.getRange(1, 1, 1, cab.length).setValues([cab])
        .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  painel.setFrozenRows(1);

  const ultima = aba.getLastRow();
  if (ultima < 2) { painel.getRange(2, 1).setValue('Nenhum registro na base.'); return; }

  /* v7.5 (P2): o percentual vem gravado (OBRIG_PAINEL, em salvarPPP); a
     leitura pula as colunas de texto */
  garantirPercentuais_(aba);
  const OBRIG = OBRIG_PAINEL;
  const dados = lerColunas_(aba, ['protocolo', 'versao', 'escola', 'municipio', 'sre', 'status', 'pct',
    'indicadores', 'assinaturas', 'ataUrl', 'homolData', 'atualizadoEm', 'pdfUrl'])
    .filter(function (v) { return String(v.protocolo || '').trim(); });
  const linhas = dados.map(function (v) {
    const feitos = Math.round((parseInt(v.pct, 10) || 0) / 100 * OBRIG.length);
    let aband = '', dist = '';
    try {
      const et = (JSON.parse(v.indicadores || '{}').etapas) || {};
      const maior = function (campo) {
        const vals = Object.keys(et).map(function (k) {
          return parseFloat(String(et[k][campo]).replace(',', '.')); })
          .filter(function (x) { return !isNaN(x); });
        return vals.length ? Math.max.apply(null, vals) : '';
      };
      aband = maior('aba'); dist = maior('dis');
    } catch (e) {}
    let assinStr = '', presentes = '';
    try {
      const a = JSON.parse(v.assinaturas || '[]');
      if (a.length) assinStr = a.filter(function (x) { return !!x.assinadoEm; }).length + '/' + a.length;
      /* v8.1: quantos membros do Colegiado a direção marcou como presentes */
      presentes = a.filter(function (x) { return x.papel === 'Colegiado Escolar'; }).length || '';
    } catch (e) {}
    return [v.protocolo, v.versao || 1, v.escola, v.municipio,
            v.sre, v.status, feitos + '/' + OBRIG.length, (parseInt(v.pct, 10) || 0) / 100,
            assinStr, presentes, v.ataUrl ? 'anexada' : '', v.homolData || '',
            aband === '' ? '' : aband / 100, dist === '' ? '' : dist / 100,
            v.atualizadoEm, v.pdfUrl];
  });

  if (!linhas.length) { painel.getRange(2, 1).setValue('Nenhum registro na base.'); return; }
  painel.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
  painel.getRange(2, 8, linhas.length, 1).setNumberFormat('0%');
  painel.getRange(2, 13, linhas.length, 2).setNumberFormat('0.0%');
  painel.setColumnWidth(3, 260);
  painel.autoResizeColumns(1, 2);

  painel.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue('#F4C7C3', SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue('#FCE8B2', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
      .setGradientMaxpointWithValue('#B7E1CD', SpreadsheetApp.InterpolationType.NUMBER, '1')
      .setRanges([painel.getRange(2, 8, linhas.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0.05).setBackground('#F4C7C3')
      .setRanges([painel.getRange(2, 13, linhas.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0.20).setBackground('#F4C7C3')
      .setRanges([painel.getRange(2, 14, linhas.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ST_HOMOLOGADO_SRE).setBackground('#B7E1CD')
      .setRanges([painel.getRange(2, 6, linhas.length, 1)]).build()
  ]);

  painel.getRange(linhas.length + 3, 1)
        .setValue('Painel atualizado em ' + agora_() + ' · ' + linhas.length + ' registro(s).')
        .setFontColor('#5A6572');
}

/* ============================================================
   Modelo de impressão
   ============================================================ */

/**
 * v8.9 — O PDF em páginas montadas pelo próprio sistema.
 *
 * Até a 8.8 quem paginava era o conversor do Google: o documento saía sem
 * número de página, e a escola não tinha como saber, antes de gerar, onde
 * cada seção cairia. Agora a tela distribui o conteúdo em folhas A4 e manda
 * as folhas prontas; aqui as margens do @page vão a zero, porque cada folha
 * já traz as suas — as do Padrão Ofício (Manual de Redação da Presidência da
 * República, 3ª edição): 3 cm à esquerda, 1,5 cm à direita e 2 cm em cima e
 * embaixo, fonte Calibri/Carlito 12, entrelinhas simples, 6 pt depois de
 * cada parágrafo, texto justificado, recuo de 2,5 cm e numeração a partir da
 * segunda página.
 *
 * O brasão do Estado entra aqui, e não no documento gravado: a tela manda a
 * marca <!--BRASAO--> e o servidor a troca pela imagem, que vive num arquivo
 * só do projeto. Assim o documento congelado de cada escola não carrega
 * 240 KB de base64 — com 3.400 escolas, seriam quase 800 MB no Drive.
 */
function brasaoPdf_() {
  try { return include('Brasao'); } catch (e) { return ''; }
}
/**
 * v8.13 (D16) — A folha de estilo do documento vem do MESMO arquivo que a
 * tela usa para medir a paginação (DocCss.html). Até a 8.12 havia aqui uma
 * cópia escrita à mão que divergia da tela em onze regras de quebra: o
 * documento fechava em 21 folhas na tela e 20 no papel, e a última linha de
 * cada folha era cortada em silêncio. Duas cópias mantidas à mão são um
 * defeito que volta.
 *
 * O try/catch é o mesmo cuidado de brasaoPdf_: sem o arquivo, o PDF sai com
 * a tipografia padrão do conversor — feio, mas inteiro. Um documento oficial
 * que não é gerado é pior do que um documento oficial mal formatado.
 */
function docCss_() {
  try { return include('DocCss'); } catch (e) { return ''; }
}
/**
 * v9.1 — A FONTE DO DOCUMENTO VAI NO PDF. O conversor do Google desenha o
 * PDF com as fontes que TEM, e ninguém sabe ao certo quais são; a tela mede
 * a folha em Carlito 12. Quando os dois desenhos de letra não coincidem, a
 * última linha da folha não cabe — e foi por isso que a 8.15 precisou de
 * oito milímetros de folga. Com a fonte embutida (DocFonte.html, WOFF2 em
 * base64, ≈ 86 KB), o conversor usa a MESMA fonte com que a tela mediu, e a
 * folga passa a ser só uma segurança. O try/catch é o de docCss_: sem o
 * arquivo, o PDF sai com a fonte do conversor — feio, mas inteiro.
 */
function docFonte_() {
  try { return include('DocFonte'); } catch (e) { return ''; }
}
function montarHtmlPdf_(conteudo, rodape) {
  /* v8.11: o código de autenticidade entra no rodapé de TODAS as páginas.
     A tela deixa o lugar marcado (<!--COD-->) porque, quando ela monta as
     folhas, o código ainda não existe: ele nasce aqui, na conclusão.

     v8.13 (E17, A8-13): o brasão entra UMA VEZ. A substituição era global, e
     a capa tem exatamente uma marca (App.html): um chamador que repetisse
     `<!--BRASAO-->` mil vezes recebia mil brasões de Minas Gerais dentro de
     um PDF de conteúdo arbitrário — 3.115 caracteres de entrada viravam
     245.604 de saída. Trocada a primeira, as demais marcas são REMOVIDAS:
     marca de posição que sobra não é conteúdo. */
  /* a substituição usa FUNÇÃO, não string: `$&`, `` $` `` e `$'` dentro do
     brasão (ou do rodapé) seriam interpretados pelo String.replace e
     reintroduziriam o que se acabou de tirar — é a mesma armadilha que
     truncava o Code.gs embutido na demonstração (v8.13, E01). */
  const brasao = brasaoPdf_();
  const cod = esc_(rodape || '');
  const corpo = String(conteudo || '').replace(/<!--BRASAO-->/, function () { return brasao; })
    .replace(/<!--BRASAO-->/g, '')
    .replace(/<!--COD-->/g, function () { return cod; });
  /* as margens do @page vão a zero porque cada folha já traz as suas — as
     do Padrão Ofício, que estão em DocCss.html. E o <body> ganha class="doc"
     para que os seletores do arquivo, todos escopados sob .doc, valham aqui
     exatamente como valem na tela. */
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>@page{size:A4;margin:0}html,body{margin:0;padding:0}</style>' +
    docFonte_() +
    docCss_() +
    '</head><body class="doc">' + corpo + '</body></html>';
}
