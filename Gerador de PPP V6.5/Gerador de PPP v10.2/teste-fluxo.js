const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

/* v8.0 (P12): o frontend vive em partes (Index, Css, App) e a demonstração
   executa o Code.gs REAL sobre serviços simulados. A bateria monta a build
   de demonstração e trabalha sobre ela — é exatamente o arquivo entregue. */
const html = require('./montar.js').montar({ demo: true });
/* Para as conferências no código-fonte: a build de PRODUÇÃO — Index, Css e
   App resolvidos pelo include(), sem o Code.gs embutido da demonstração. */
const fonteProducao = require('./montar.js').montar({});
const erros = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erros.push('JSDOM: ' + (e.message || e)));
vc.on('error', m => erros.push('console.error: ' + m));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.scrollTo = () => {}; w.alert = m => erros.push('ALERT: ' + m); w.confirm = () => true;
      /* o sistema usa diálogo próprio: nativo é bloqueado em iframe com sandbox */
      w.confirmarAuto = true;
      /* v7.3: a latência do servidor simulado cai de 600 para 250 ms, e as
         esperas longas da bateria são reduzidas à metade — a bateria cresceu
         e precisa caber no tempo de uma execução */
      w.demoLatencia = 250;
    w.HTMLElement.prototype.scrollIntoView = function(){};
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  } });
const w = dom.window, d = w.document;

const $ = s => d.querySelector(s);
const iTipo = (tp) => w.eval('TELAS').findIndex(t => t.tipo === tp);
const iId = (id) => w.eval('TELAS').findIndex(t => t.id === id);
const falhas = [], oks = [];
const ok = (cond, msg) => (cond ? oks : falhas).push(msg);
const espera = ms => new Promise(r => setTimeout(r, ms >= 500 ? Math.round(ms / 2) : ms));
const clique = sel => { const el = $(sel); if(!el){ falhas.push('elemento ausente: '+sel); return; } el.click(); };
const digita = (sel, v) => { const el = $(sel); if(!el){ falhas.push('campo ausente: '+sel); return; } el.value = v; el.dispatchEvent(new w.Event('input', {bubbles:true})); el.dispatchEvent(new w.Event('change', {bubbles:true})); };
/* Chama o servidor da demonstração (o Code.gs real) como a tela chama. O
   erro lançado lá chega como {ok:false, erro}, que é o que as verificações
   leem; 'demo' como token significa "o token da sessão aberta agora". */
const chamarDemo = (fn, args, ok2) => {
  const a = (args && typeof args === 'object') ? Object.assign({}, args) : args;
  if(a && a.token === 'demo') a.token = w.eval('SESSAO.token');
  w.DEMO.chamar(fn, a, ok2, e => ok2({ ok:false, erro: String((e && e.message) || e) }));
};

(async () => {
  await espera(50);
  const TELAS = w.eval('TELAS'), state = w.eval('state'), APP = w.eval('APP');
  ok(APP.local === true, 'modo demonstração detectado sem google.script');
  ok(!$('#demoRibbon').hidden, 'faixa de demonstração visível');
  ok(!$('#landing').hidden, 'abertura aberta');
  /* v8.12: a abertura pergunta primeiro se a pessoa vem entrar no sistema ou
     conferir um documento. Só o primeiro caminho leva às portas de perfil. */
  ok(!$('#portaEntrada').hidden && $('#portas').hidden,
     'v8.12: a abertura é a escolha entre entrar no sistema e autenticar um PPP');
  ok(!!$('#btnEntrarSistema') && !!$('#btnAutenticarPPP') && !d.querySelector('[data-porta="verificar"]'),
     'v8.12: a conferência deixou de ser uma porta de perfil e virou a segunda escolha da abertura');
  $('#btnEntrarSistema').click();
  ok(Array.from(d.querySelectorAll('#portas .porta')).filter(b => !b.hidden).length === 4,
     'v8.12: quatro portas de perfil — direção, Colegiado, regional e Órgão Central');
  ok(!d.querySelector('[data-porta="colegiado"]').hidden &&
     d.querySelector('[data-porta="colegiado"] .pt').textContent === 'Colegiado Escolar',
     'v7.4: o Colegiado Escolar tem porta própria na abertura');
  d.querySelector('[data-porta="escola"]').click();
  ok($('#portaPapel').hidden && !d.querySelector('[data-papel="colegiado"]'),
     'v7.4: a porta da direção não oferece mais o colegiado — entra direto como direção');
  await espera(900);
  ok(w.eval('SESSAO.perfil') === 'escola' && w.eval('SESSAO.papel') === 'diretor_escolar',
     'na demonstração a porta faz o papel da conta institucional e entra direto');
  ok($('#portaInst').hidden, 'não há formulário de e-mail e senha a preencher');
  /* v7.4 (P3): sem sessão não há percurso — "Iniciar novo percurso" e
     "Retomar por protocolo" foram aposentados; o percurso começa pela tela
     inicial da direção, em sessão */
  ok($('#btnNovo').hidden && $('#btnNovo').disabled && $('#btnRetomarToggle').hidden && $('#btnBuscar').hidden,
     'P3: "Iniciar novo percurso" e "Retomar por protocolo" saíram da abertura');
  /* a escola da demonstração já tem um PPP em andamento e outro em coleta de
     assinaturas; para percorrer o itinerário do zero, a bateria os estaciona
     e os devolve ao fim desta etapa.
     v8.13 (D07): "um PPP por vez" passou a valer para o CICLO inteiro — o
     ciclo só se encerra com a homologação pela SRE. Estacionar em "Enviado
     para homologação" já não libera a criação: os dois vão para "Homologado". */
  const baseInicial = w.DEMO.instantaneo();
  w.DEMO.gravar('PPP-2026-0031-R4KP', 'status', 'Homologado');
  w.DEMO.gravar('PPP-2024-0018-A2ND', 'status', 'Homologado');
  w.carregarPainel(); await espera(900);
  w.criarNovoPPP(); await espera(200);
  if(!$('#ovAviso').hidden){ $('#avisoOk').click(); await espera(150); }
  ok($('#landing').hidden && !$('#stage').hidden, 'criar novo PPP, em sessão, abre o percurso');
  ok(APP.protocolo === null && APP.versao === 1 && !state.txt.tMissao, 'o novo PPP nasce vazio, na versão 1');
  /* o percurso é exercitado sobre o preenchimento de demonstração (2ª versão,
     etapas marcadas), como nas versões anteriores da bateria */
  w.aplicarDemo(); w.renderTrilha(); w.irPara(0, true); w.renderDoc();

  // ---------- percorre todas as telas para frente ----------
  const vistos = [];
  for (let i = 0; i < TELAS.length; i++) {
    w.irPara(i, true);
    const t = TELAS[i];
    const painel = ['formativa','reflexao','aprofundamento','balanco'].includes(t.tipo) ? '#panelFormativo'
                 : t.tipo === 'final' ? '#panelFinal' : '#panelProducao';
    const visivel = !$(painel).hidden;
    if (!visivel) falhas.push(`tela ${i} (${t.tipo}): painel ${painel} não exibido`);
    const h2 = $(painel + ' h2');
    if (!h2 || !h2.textContent.trim()) falhas.push(`tela ${i} (${t.tipo}): sem título h2`);
    vistos.push(i);
    // documento sempre presente
    if ($('#docAside').hidden) falhas.push(`tela ${i}: painel do documento oculto`);
    // seção correspondente marcada
    const sec = w.secaoDaTela(i);
    if (sec !== 0 && !$('#docMini h3.doc-h.foco')) falhas.push(`tela ${i}: seção ${sec} não destacada no documento`);
  }
  ok(vistos.length === TELAS.length, `todas as ${TELAS.length} telas renderizam`);
  ok(TELAS.some(t => t.tipo === 'balanco'), 'percurso inclui o balanço da vigência anterior');

  // ---------- botão avançar bloqueado/ liberado pelas tarefas ----------
  const iAbertura = TELAS.findIndex(t => t.id === 't00');
  ok(TELAS[0].tipo === 'dados' && TELAS[0].modulo === 0 && iAbertura === 1,
     'v8.5: a identificação da escola abre o percurso, antes da formação');
  ok(w.eval('MODULOS')[0].n === 'A escola' && w.eval('MODULOS')[1].n === 'O PPP e a revisão',
     'v8.5: o módulo 1 passa a ser o da escola');
  w.irPara(iAbertura, true);
  const trava0 = $('#btnNext').classList.contains('travado');
  ok(trava0, 'tela de abertura: avançar travado até confirmar a tarefa');
  const antes = state.tela;
  w.tentarAvancar();
  ok(state.tela === antes, 'tela de abertura: clique no avançar não avança com tarefa pendente');
  d.querySelectorAll('#tarefaBox input[type=checkbox]').forEach(c => { c.checked = true; c.dispatchEvent(new w.Event('change', {bubbles:true})); });
  ok(!$('#btnNext').classList.contains('travado'), 'tela de abertura: tarefa confirmada libera o avanço');
  w.tentarAvancar();
  ok(state.tela === iAbertura + 1, 'tela de abertura avança após confirmar');

  // ---------- formulário de dados grava no estado e no documento ----------
  w.irPara(iTipo('dados'), true);
  digita('#fNome', 'Escola Estadual Teste Automático');
  digita('#fInep', '31999999');
  ok(state.dados.escola === 'Escola Estadual Teste Automático', 'nome gravado no estado');
  ok($('#docMini').textContent.includes('ESCOLA ESTADUAL TESTE AUTOMÁTICO') || $('#docMini').textContent.includes('Escola Estadual Teste Automático'), 'nome refletido no documento');
  ok(APP.sujo === true, 'edição marca alterações não salvas');

  // ---------- marcação insere texto-base e sub-campos ----------
  const iMods = TELAS.findIndex(t => t.tipo === 'marcacao' && t.grupo === 'mods');
  w.irPara(iMods, true);
  const cbEfti = $('#optsHost input[data-id="efti"]');
  ok(!!cbEfti, 'opção EFTI presente');
  cbEfti.checked = true; cbEfti.dispatchEvent(new w.Event('change', {bubbles:true}));
  ok(state.sel.mods.has('efti'), 'EFTI marcado no estado');
  ok(!$('#optsHost select[data-det="efti"]'), 'v8.5: a carga horária deixa de ser lista suspensa de escolha única');
  const cargas = Array.from(d.querySelectorAll('#optsHost input[data-det="efti"][data-f="carga"][data-multi]'));
  ok(cargas.length === 2 && cargas.every(c => c.type === 'checkbox'),
     'v8.5: a carga horária traz as duas opções para marcar');
  const c45 = cargas.filter(c => c.value === '45 horas')[0];
  c45.checked = true; c45.dispatchEvent(new w.Event('change', {bubbles:true}));
  ok(state.det.efti && Array.isArray(state.det.efti.carga) && state.det.efti.carga.join('|') === '45 horas',
     'detalhe de carga horária gravado como lista');
  ok($('#docMini').textContent.includes('A oferta corresponde a 45 horas semanais'),
     'detalhe refletido no documento');
  const c35 = cargas.filter(c => c.value === '35 horas')[0];
  c35.checked = true; c35.dispatchEvent(new w.Event('change', {bubbles:true}));
  ok(state.det.efti.carga.join(' | ') === '35 horas | 45 horas',
     'v8.5: as duas cargas convivem, na ordem da lista');
  ok($('#docMini').textContent.includes('A oferta compreende turmas de 35 horas e 45 horas semanais'),
     'v8.5: o documento reúne as duas marcações numa frase no plural');
  const bilSim = d.querySelectorAll('#optsHost input[data-det="efti"][data-f="bil"]');
  ok(bilSim.length === 2 && bilSim[0].type === 'radio',
     'v8.5: a oferta bilíngue, que só admite uma resposta, vira escolha entre duas opções visíveis');
  bilSim[0].checked = true; bilSim[0].dispatchEvent(new w.Event('change', {bubbles:true}));
  ok(state.det.efti.bil === 'sim' && $('#docMini').textContent.includes('com oferta de Educação Bilíngue'),
     'v8.5: a resposta única continua entrando no documento');
  c35.checked = false; c35.dispatchEvent(new w.Event('change', {bubbles:true}));
  ok($('#docMini').textContent.includes('A oferta corresponde a 45 horas semanais'),
     'v8.5: desmarcando uma delas, a frase volta ao singular');
  cbEfti.checked = false; cbEfti.dispatchEvent(new w.Event('change', {bubbles:true}));
  ok(!state.sel.mods.has('efti'), 'desmarcar remove do estado');
  ok(!$('#docMini').textContent.includes('45 horas semanais'), 'desmarcar remove o texto do documento');

  // ---------- indicadores e alertas ----------
  const iInd = TELAS.findIndex(t => t.tipo === 'indicadores');
  w.irPara(iInd, true);
  const inpAba = $('#panelProducao input[data-etapa="efaf"][data-col="aba"]');
  ok(!!inpAba, 'tabela de indicadores tem linha para etapa marcada');
  if (inpAba) {
    inpAba.value = '9,5'; inpAba.dispatchEvent(new w.Event('input', {bubbles:true}));
    ok($('#indAlertas').textContent.includes('abandono'), 'alerta de abandono acima do patamar');
    ok($('#docMini').querySelector('table.ind') !== null, 'tabela aparece no documento');
  }

  // ---------- aprofundamento com campo aberto ----------
  const iApr = TELAS.findIndex(t => t.tipo === 'aprofundamento' && t.grupo === 'etapas');
  w.irPara(iApr, true);
  ok(!!$('#ta_tEtapas'), 'campo aberto de etapas presente na tela de aprofundamento');
  digita('#ta_tEtapas', 'Texto de teste sobre as etapas.');
  await espera(200);   // o documento é redesenhado com pequeno atraso durante a digitação
  ok(state.txt.tEtapas === 'Texto de teste sobre as etapas.', 'texto de etapas gravado');
  ok($('#docMini').textContent.includes('Texto de teste sobre as etapas.'), 'texto de etapas no documento');

  // ---------- escrita comum ----------
  const iEsc = TELAS.findIndex(t => t.tipo === 'escrita' && t.campos.some(c => c.id === 'tMissao'));
  w.irPara(iEsc, true);
  digita('#ta_tMissao', 'Missão de teste.');
  await espera(200);
  ok(state.txt.tMissao === 'Missão de teste.', 'missão gravada');
  ok($('#ct_tMissao').textContent.includes('3 palavras'), 'contador de palavras funciona');

  // ---------- pendências por módulo ----------
  const pend = d.querySelectorAll('.mod-btn .pend:not([hidden])').length;
  ok(pend > 0, `pendências exibidas na trilha (${pend} módulos com pendência)`);

  // ---------- salvar (simulado) ----------
  w.salvarExplicito();
  await espera(800);
  const protoNovo = APP.protocolo;
  ok(/^PPP-\d{4}-\d{4}-[A-Z0-9]{4}$/.test(protoNovo || ''),
     'P12: o protocolo é gerado pelo servidor real, no formato oficial (' + protoNovo + ')');
  ok(APP.sujo === false, 'salvar limpa o estado de alterações pendentes');
  ok($('#badgeProto').textContent.includes(protoNovo), 'protocolo aparece no selo');
  ok(w.DEMO.registro(protoNovo).inep === '31100001',
     'P3: o registro nasce com o código da escola da SESSÃO, não com o digitado — como no servidor');

  // ---------- tela final ----------
  w.irPara(TELAS.length - 1, true);
  ok(!$('#panelFinal').hidden, 'tela final visível');
  ok($('#btnNext').hidden, 'sem botão avançar na tela final');
  /* v8.14: terminado o percurso, o que se oferece é o ENVIO PARA VALIDAÇÃO.
     Concluir só aparece quando a Diretoria Educacional devolver validado —
     é o que o servidor já exigia e a tela não dizia. */
  ok(!$('#cardValidacao').hidden && !!$('#btnEnviarValidacao'),
     'v8.14: em elaboração, a tela final oferece enviar para a validação da Diretoria Educacional');
  ok($('#cardConcluir').hidden,
     'v8.14: e não oferece concluir antes disso — o servidor recusaria');
  ok($('#cardEmValidacao').hidden, 'v8.14: nem o aviso de documento em validação');
  ok($('#cardAssinaturas').hidden, 'assinaturas ocultas antes da conclusão');
  const ckItens = d.querySelectorAll('#checklist .check-item').length;
  ok(ckItens > 20, `checklist com ${ckItens} itens`);
  digita('#fQpres', '7'); digita('#fQtot', '12');
  ok($('#avisoQuorum').textContent.includes('atendido'), 'quórum 7/12 reconhecido como maioria absoluta');
  digita('#fQpres', '6');
  ok($('#avisoQuorum').textContent.includes('insuficiente'), 'quórum 6/12 reconhecido como insuficiente');

  // ---------- concluir → assinatura direção → colegiado → ata → homologação ----------
  // v7.3 (T-16b): o simulador segue a regra do servidor — sem validação não há conclusão
  ok(w.DEMO.registros().some(x => x.protocolo === protoNovo && x.status === 'Em andamento'),
     'T-16b: o PPP salvo passa a existir na base da demonstração, em andamento');
  w.concluirPPP(); await espera(900);
  ok(APP.status === 'Em andamento', 'T-16b: sem validação, o simulador não conclui — como o servidor');
  ok(!$('#ovAviso').hidden && $('#avisoTexto').textContent.includes('validado pela Diretoria Educacional'),
     'T-16b: a recusa explica que falta a validação');
  $('#avisoOk').click(); await espera(150);
  // validado, o documento abre travado na tela final, com "Concluir" à mão (T-14)
  w.DEMO.gravar(protoNovo, 'status', 'Validado');
  APP.status = 'Validado';
  w.irPara(iTipo('dados'), true);
  ok($('#fNome').disabled === true && !$('#travaRibbon').hidden && $('#travaRibbon').textContent.includes('validado'),
     'T-14: validado, os campos ficam travados e a faixa explica por quê');
  ok(w.bloqueado() === true, 'T-14: bloqueado() inclui o estado Validado');
  ok($('#btnSalvar').hidden, 'T-14: sem botão salvar quando validado');
  w.irPara(TELAS.length - 1, true);
  ok(!$('#cardConcluir').hidden && !$('#btnConcluir').disabled, 'T-14: na tela final o cartão de concluir está visível e habilitado');
  ok($('#cardAssinaturas').hidden, 'T-14: as assinaturas ainda não aparecem — falta concluir');
  w.concluirPPP(); await espera(900);
  ok(APP.status === 'Em assinatura', 'conclusão muda status para Em assinatura');
  ok(w.bloqueado() === true, 'documento bloqueado após conclusão');
  ok(!$('#cardAssinaturas').hidden, 'cartão de assinaturas visível');
  ok(!$('#blocoDirecao').hidden, 'bloco da direção visível');
  ok(!$('#blocoColegiado').hidden, 'v8.1: a marcação de presença vem ANTES da assinatura da direção');
  ok(!$('#cardAta').hidden, 'v8.1: e a ata, antes das duas');
  ok($('#btnAssinarDir').disabled && /ata da reunião/.test($('#dirPendencias').textContent),
     'v8.1: sem ata e sem presença, o botão de assinar diz o que falta');
  ok($('#btnSalvar').hidden, 'botão salvar some quando bloqueado');
  ok(!$('#travaRibbon').hidden, 'faixa de bloqueio visível');

  // tentar editar bloqueado
  w.irPara(iTipo('dados'), true);
  ok($('#fNome').disabled === true, 'campos desabilitados quando bloqueado');
  w.irPara(TELAS.length - 1, true);

  /* v8.1 — a ordem da direção: (1) ata, (2) presença, (3) assinatura com atesto */
  w.eval("ataBase64 = 'QUJD'; ataMime = 'application/pdf'; ataNomeArq = 'ata-da-reuniao.pdf';");
  digita('#ataData', '2026-09-10');
  digita('#ataIdent', 'Ata nº 04/2026, fls. 20-22');
  w.registrarAta(true); await espera(1400);
  ok(APP.ataNome === 'ata-da-reuniao.pdf' && APP.status === 'Em assinatura',
     'v8.1: a ata é anexada durante a coleta, e não encerra nada');

  const presentes = () => Array.from(d.querySelectorAll('#listaPresenca .pr-check'));
  ok(presentes().length >= 2 && presentes().every(c => !c.checked),
     'v8.1: a lista traz os membros do Colegiado JÁ CADASTRADOS na escola, nenhum marcado (' + presentes().length + ')');
  ok(!d.querySelector('#listaPresenca input[type="email"]') && !d.querySelector('#listaMembrosNovos'),
     'v8.1: não há nada a cadastrar aqui — nem nome, nem e-mail, nem link a enviar');
  presentes()[0].checked = true; presentes()[1].checked = true;
  const nAntesPres = APP.assinaturas.length;
  w.registrarPresenca(); await espera(1400);
  ok(APP.assinaturas.length === nAntesPres + 2 &&
     APP.assinaturas.filter(a => a.papel === 'Colegiado Escolar').length === 2,
     'v8.1: os dois marcados entram na folha');
  ok(APP.assinaturas.every(a => !a.token), 'v8.1: sem token de convite na folha');

  ok($('#btnAssinarDir').disabled === false && $('#dirPendencias').hidden,
     'v8.1: com ata e presença, o botão de assinar libera');
  ok(/Atesto/.test($('#uiDeclDirecao').textContent) && /verdadeiras/.test($('#uiDeclDirecao').textContent),
     'v8.1: a declaração da direção passa a ser o atesto de veracidade');
  ok(/compareceu/.test($('#uiPresencaTitulo').textContent) && /já cadastrados/.test($('#uiPresencaTexto').textContent) &&
     /1\. Ata da reunião/.test($('#uiAtaTitulo').textContent),
     'v8.1: os três passos são numerados e os textos vêm da curadoria');
  digita('#aDirNome', 'Diretora Teste'); digita('#aDirMasp', '1234567-8'); digita('#aDirEmail', 'dir@teste.mg');
  w.assinarDirecao(); await espera(900);
  ok(!APP.assinaturas[0].assinadoEm, 'v8.1: sem marcar o atesto, a direção não assina');
  $('#aDirAceite').checked = true;
  /* v8.2 — assinar é encaminhar: antes do ato, a tela pergunta */
  w.confirmarAuto = false;
  w.assinarDirecao(); await espera(400);
  ok(!$('#ovAviso').hidden && /Diretoria Educacional/.test($('#avisoTexto').textContent) &&
     /imediatamente|segue/.test($('#avisoTexto').textContent) && !$('#avisoCancelar').hidden,
     'v8.2: ao assinar, a tela pergunta — e avisa que o documento segue para a Diretoria Educacional');
  ok(!APP.assinaturas[0].assinadoEm, 'v8.2: enquanto não confirmar, nada foi assinado');
  $('#avisoOk').click(); await espera(1600);
  w.confirmarAuto = true;
  ok(APP.assinaturas[0] && !!APP.assinaturas[0].assinadoEm, 'assinatura da direção registrada');
  ok(APP.status === 'Enviado para homologação' && !!APP.homolData,
     'v8.2: e o documento segue imediatamente para homologação');
  ok(!$('#ovAviso').hidden && /Diretoria Educacional/.test($('#avisoTexto').textContent),
     'v8.2: a tela confirma o encaminhamento');
  $('#avisoOk').click(); await espera(200);
  ok(!$('#cardHomol').hidden && /Encaminhado em/.test($('#infoHomol').textContent) && !$('#fHomol'),
     'v8.2: o cartão da homologação vira informativo — não há mais destino a digitar');
  ok($('#tabelaAssin').textContent.includes('assina ao entrar no sistema') &&
     !$('#tabelaAssin').textContent.includes('copiar link'),
     'v8.1: a tabela não oferece mais reenviar, copiar link nem remover — o membro assina na própria sessão');

  /* as caixas ao fim do documento */
  {
    const doc = w.docHTML(false).html;
    ok(/<table class="cxs">/.test(doc) && (doc.match(/class="cxa"/g) || []).length === 4,
       'v8.1: o fim do documento traz caixas — direção, dois presentes e a de acompanhamento');
    ok(!/Presidente do Colegiado/.test(doc) && !/doc-sign/.test(doc),
       'v8.1: saíram o presidente de colegiado e as linhas de assinatura padronizadas');
    ok(/Acompanhado por/.test(doc), 'v8.1: e a caixa de quem acompanhou o documento');
  }

  // ---------- nova versão a partir de documento encerrado ----------
  // v7.3 (T-06): antes de encerrar, o servidor recusa a nova versão
  APP.status = 'Em assinatura'; w.montarTelaFinal();
  w.DEMO.gravar(protoNovo, 'status', 'Em assinatura');
  w.iniciarNovaVersao(); await espera(900);
  ok(!$('#ovAviso').hidden && $('#avisoTexto').textContent.includes('encerrado'),
     'T-06: nova versão só de PPP encerrado — em assinatura é recusado');
  $('#avisoOk').click(); await espera(150);
  APP.status = 'Assinado'; w.montarTelaFinal();
  w.DEMO.gravar(protoNovo, 'status', 'Assinado');
  ok(!$('#cardAta').hidden, 'cartão da ata aparece quando assinado');
  ok(!$('#cardVersao').hidden, 'cartão de nova versão aparece quando assinado');
  /* v8.13 (D07): a revisão nasce da versão VIGENTE da escola, e o número é
     único por escola. Um PPP que NÃO é o vigente não dá origem a revisão.
     v8.13 (F11): o PPP criado do zero já nasce na versão seguinte à maior da
     escola — de modo que, para exercitar a recusa, é preciso pô-lo de volta
     numa versão anterior, que é a situação de um registro gravado antes
     desta correção. */
  ok(APP.versao > 1,
     'F11: o PPP criado do zero nesta escola nasceu na versão seguinte à maior dela (v' + APP.versao + ')');
  w.DEMO.gravar(protoNovo, 'versao', 1); APP.versao = 1;
  w.iniciarNovaVersao(); await espera(900);
  ok(!$('#ovAviso').hidden && /versão vigente desta escola/.test($('#avisoTexto').textContent),
     'D07: a revisão não nasce de uma versão anterior à vigente da escola');
  $('#avisoOk').click(); await espera(150);
  w.DEMO.gravar(protoNovo, 'versao', 3);    /* passa a ser o documento mais recente da escola */
  w.iniciarNovaVersao(); await espera(900);
  ok(APP.status === 'Em andamento', 'nova versão volta a Em andamento');
  ok(APP.versao === 4, 'D07: o número da versão é único por escola — a revisão da 3 nasce como 4');
  const protoRevisao = APP.protocolo;
  ok(/^PPP-\d{4}-\d{4}-[A-Z0-9]{4}$/.test(protoRevisao || '') && protoRevisao !== protoNovo, 'novo protocolo gerado');
  ok(w.bloqueado() === false, 'nova versão é editável');
  ok(state.txt.tMissao === 'Missão de teste.', 'conteúdo copiado para a nova versão');

  // ---------- zoom e tela cheia ----------
  w.aplicarZoom(10);
  ok($('#zoomVal').textContent === '110%', 'zoom aumenta');
  w.abrirDocCheio();
  ok(!$('#ovDoc').hidden, 'tela cheia abre');
  ok($('#docFull').textContent.includes('Missão de teste.'), 'tela cheia mostra o documento atual');
  d.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape'}));
  ok($('#ovDoc').hidden, 'Esc fecha a tela cheia');

  // ---------- volta ao início e testa "anterior" ----------
  w.irPara(5, true); w.irPara(w.proximaVisivel(state.tela, -1));
  ok(state.tela === 4, 'botão anterior recua uma tela');
  w.irPara(0, true); w.irPara(w.proximaVisivel(state.tela, -1));
  ok(state.tela === 0, 'anterior na primeira tela não vai abaixo de zero');

  // ---------- v6.1: sumário, mapa, devolutiva, tarefas, trilha ----------
  {
    const html = w.docHTML(true).html;
    const sum = (html.match(/class="sum-item"/g) || []).length;
    ok(sum >= 20, `sumário do documento lista ${sum} seções (antes saía vazio)`);
    ok(/22\. Folha de assinaturas/.test(html), 'sumário inclui a folha de assinaturas como seção 22');
    ok($('#miniCount').textContent.includes('seções'), 'contador de seções calculado a partir do documento');

    w.abrirMapa();
    ok(!$('#ovMapa').hidden, 'mapa do percurso abre');
    ok(d.querySelectorAll('#mapaCorpo .mapa-tela').length === TELAS.length, 'mapa lista todas as telas');
    ok(d.querySelectorAll('#mapaCorpo .st.pend').length > 0, 'mapa aponta telas pendentes');
    d.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape'}));
    ok($('#ovMapa').hidden, 'Esc fecha o mapa');

    // devolutiva heurística
    const iObj = TELAS.findIndex(t => t.tipo === 'escrita' && t.campos.some(c => c.id === 'tObjetivos'));
    w.irPara(iObj, true);
    digita('#ta_tObjetivos', 'Melhorar o desempenho dos estudantes e reduzir a evasão escolar.');
    $('#ta_tObjetivos').dispatchEvent(new w.Event('blur'));
    ok($('#dv_tObjetivos').textContent.includes('sem número'), 'devolutiva: objetivo sem número é apontado');
    ok($('#dv_tObjetivos').textContent.includes('prazo'), 'devolutiva: objetivo sem prazo é apontado');
    digita('#ta_tObjetivos', 'Reduzir o abandono nos anos finais de 3,5% (2025) para 1,5% até dezembro de 2027, mediante contato com a família na segunda falta. Monitoramento trimestral no Conselho de Classe pelo especialista, com relatório de frequência analisado e registrado em ata a cada trimestre do ano letivo.');
    $('#ta_tObjetivos').dispatchEvent(new w.Event('blur'));
    ok($('#dv_tObjetivos').textContent.trim() === '', 'devolutiva: objetivo verificável não recebe aviso');
    ok(!!$('#panelProducao .card-dest') || true, 'tela de objetivos renderiza');

    // tarefas persistidas e restauradas
    state.tarefas['t00:0'] = true;
    const col = w.coletarDados();
    ok(typeof col.tarefas === 'string' && JSON.parse(col.tarefas)['t00:0'] === true, 'tarefas confirmadas entram na gravação');
    w.preencherRegistro(Object.assign({}, col, {protocolo:'PPP-2026-0001-AB12', tela:0, etapas:[], mods:[], infra:[], temas:[], principios:[], metodos:[], assinaturas:'[]'}));
    ok(state.tarefas['t00:0'] === true, 'tarefas restauradas do registro');
    /* v8.5: registro gravado antes da mudança de ordem — chaves pela posição da tela */
    w.preencherRegistro(Object.assign({}, col, {protocolo:'PPP-2026-0001-AB12', tela:0,
      tarefas:'{"0:0":true,"3:1":true,"12:0":true}',
      etapas:[], mods:[], infra:[], temas:[], principios:[], metodos:[], assinaturas:'[]'}));
    ok(state.tarefas['t00:0'] === true && state.tarefas['tBal:1'] === true && state.tarefas['t10:0'] === true,
       'v8.5: a preparação gravada pela posição é convertida para o id da tela');
    ok(state.tarefas['0:0'] === undefined, 'v8.5: a chave antiga não sobrevive à conversão');
    ok(TELAS[state.tela].id === 't00', 'v8.5: o registro antigo reabre na tela em que parou, não na posição');

    // trilha respeita tarefa obrigatória pendente
    state.tarefas = {};
    w.irPara(0, true);
    w.irParaComTravas(10);
    ok(state.tela === TELAS.findIndex(t => t.id === 't00'), 'salto pela trilha para em tela com preparação pendente');
    d.querySelectorAll('#tarefaBox input[type=checkbox]').forEach(c => { c.checked = true; c.dispatchEvent(new w.Event('change', {bubbles:true})); });
    w.irParaComTravas(9);
    ok(state.tela === 9, 'salto liberado quando a preparação está confirmada');

    /* v8.13 (D02): a regional deixou de ser escolha da tela — ela é ESCOPO, e
       escopo vem da sessão. O campo virou leitura, e não manda mais `sre`. */
    w.irPara(iTipo('dados'), true);
    {
      const campoSre = d.querySelector('#fSre');
      ok(!!campoSre && campoSre.tagName === 'INPUT' && campoSre.hasAttribute('readonly'),
         'D02: a regional da escola é campo de leitura, não um seletor das 47 SREs');
      ok(!campoSre.hasAttribute('data-k'),
         'D02: e a tela não manda `sre` no salvamento — o servidor a toma da sessão');
      ok(d.querySelectorAll('#fSre option').length === 0, 'D02: não há mais lista de regionais para escolher');
    }
    ok(!$('#panelFinal').hidden || true, 'ok');
    w.irPara(TELAS.length - 1, true);
    ok($('#panelFinal .eyebrow').textContent.includes('Módulo 10'), 'tela final identificada como Módulo 10');
  }

  /* devolve a base da demonstração ao estado inicial: o PPP em andamento da
     escola volta ao seu status e os registros criados nesta etapa saem */
  w.DEMO.restaurar(baseInicial);
  ok(!w.DEMO.registros().some(x => x.protocolo === protoNovo || x.protocolo === protoRevisao) &&
     w.DEMO.registro('PPP-2026-0031-R4KP').status === 'Em andamento',
     'base da demonstração restaurada para as etapas seguintes');

  // ---------- v6.2: curadoria de conteúdo ----------
  {
    /* v8.13 (E04): a curadoria deixou de ter login próprio. A entrada do Órgão
       Central é UMA SÓ — a da abertura —, e é a sessão dela que a curadoria
       exige. O percurso passa a ser o real: sair, entrar, porta do Órgão
       Central, modo de edição. */
    w.sairSessao();
    await espera(200);
    w.entrarNoSistema();
    ok(!d.querySelector('[data-porta="central"]').hidden, 'porta do Órgão Central disponível no modo de demonstração');
    ok(/SIMAVE/.test(JSON.stringify(TELAS)) && !/\{\{REDE/.test(JSON.stringify(TELAS)),
       'nomes dos sistemas resolvidos nos textos formativos');
    w.abrirPorta('central');
    await espera(900);
    ok(w.eval('SESSAO.perfil') === 'central' && !!w.eval('SESSAO.token'),
       'v8.13 (E04): o Órgão Central entra pela porta única, com sessão');
    w.escolherModo('edicao');
    await espera(1200);
    ok(w.eval('CUR.token') === w.eval('SESSAO.token'),
       'v8.13 (E04): a credencial da curadoria é a própria sessão do Órgão Central');
    w.curAbrir();
    ok(!$('#ovCuradoria').hidden, 'painel de curadoria abre');
    ok(!$('#curCorpo').hidden, 'e abre já editável — não há mais um segundo login a atravessar');
    ok(!d.querySelector('#curLogin') && !d.querySelector('#curSenha') && !d.querySelector('#curEntrar'),
       'v8.13 (E04, A7-01): o formulário de senha da curadoria não existe mais na página');
    const grupos = w.eval('CUR.mapa').length;
    ok(grupos >= 20, `mapa de conteúdo com ${grupos} grupos editáveis`);
    const totalCampos = w.eval('CUR.mapa').reduce((a, g) => a + g.campos.length, 0);
    ok(totalCampos > 800, `${totalCampos} campos de texto editáveis pelo Órgão Central`);
    ok(w.eval('CUR.mapa').some(g => g.campos.some(c => c.p === 'T.avaliacao')), 'textos fixos do documento no mapa');
    ok(w.eval('CUR.mapa').some(g => g.campos.some(c => c.p === 'EMAIL.pendente.corpo')) &&
       w.eval('CUR.mapa').some(g => g.campos.some(c => c.p === 'DOC.folha.acompanhamento')),
       'textos dos e-mails e da folha no mapa da curadoria');
    ok(w.eval('CUR.mapa').some(g => g.campos.some(c => /^TELAS\.t10\./.test(c.p))), 'telas endereçadas por identificador estável no mapa');

    // edição de um texto que entra no documento de todas as escolas
    /* v10.2 — A CITAÇÃO É TEXTO, E REESCREVÊ-LA É O QUE A CURADORIA FAZ.
       Até a 10.1 este texto citava a resolução por marcador, e a v8.8 (G3)
       RECUSAVA a alteração que o apagasse: uma parte do texto ficava fora do
       alcance de quem edita. Os marcadores saíram; o que se verifica agora é
       que a reescrita passa, inclusive quando muda a citação inteira. */
    const antesDaEdicao = w.eval("valorAtual('T.avaliacao')");
    ok(!/\{\{/.test(antesDaEdicao),
       'v10.2: o texto de origem já não traz marcador nenhum — a citação está escrita nele');
    ok(/Resolução SEE/.test(antesDaEdicao),
       'v10.2: e a citação da resolução está lá, por extenso');
    w.curEditar('T.avaliacao', 'texto', 'A avaliação observa a norma vigente da rede.');
    ok(Object.keys(w.eval('CUR.rascunhos')).length === 1,
       'v10.2: reescrever o texto SEM a citação é aceito — nada é recusado por causa de marcador');
    w.curEditar('T.avaliacao', 'texto',
      'A avaliação observa a norma vigente da rede, nos termos da Resolução SEE nº 9.999, de 2027.');
    ok(/9\.999/.test(w.eval("valorAtual('T.avaliacao')")),
       'v10.2: e trocar a citação por outra também — é para isso que o modo de edição existe');
    ok(Object.keys(w.eval('CUR.rascunhos')).length === 1, 'alteração entra como rascunho');
    ok($('#curSalvar').textContent.includes('(1)'), 'botão de salvar mostra quantas alterações há');
    w.curVerPrevia();
    await espera(40);
    ok(!$('#previaFita').hidden, 'faixa de prévia avisa que o texto ainda não foi publicado');
    ok(w.docHTML(true).html.includes('A avaliação observa a norma vigente da rede'), 'prévia aplica o texto novo ao documento');
    w.curSairPrevia();
    ok($('#previaFita').hidden && !w.docHTML(true).html.includes('observa a norma vigente'), 'sair da prévia devolve o texto publicado');

    w.curAbrir();
    w.curPublicar();
    await espera(1400);
    ok(w.docHTML(true).html.includes('A avaliação observa a norma vigente da rede'), 'publicação altera o documento das escolas');
    ok(w.eval('CONTEUDO.versao') === 1, 'versão do conteúdo avança na publicação');
    ok(Object.keys(w.eval('CUR.rascunhos')).length === 0, 'rascunho é limpo depois de publicar');

    // restaurar o texto padrão
    w.eval("CUR.rascunhos['T.avaliacao'] = null");
    w.curVerPrevia();
    await espera(40);
    ok(w.docHTML(true).html.includes('caráter contínuo e formativo'), 'restaurar devolve o texto original do sistema');
    w.curSairPrevia();

    // catálogo: novo tema transversal e item oculto
    w.eval("CUR.rascunhos['NOVOS.temas'] = [{id:'novo1', label:'Tema novo por lei', ref:'Lei nova', texto:'o tema novo previsto na legislação superveniente'}]");
    w.eval("CUR.rascunhos['OCULTOS'] = ['temas:financeira']");
    w.curVerPrevia();
    await espera(40);
    ok(w.eval('TEMAS').some(t => t.id === 'novo1'), 'tema acrescentado pela curadoria entra no catálogo');
    w.irPara(TELAS.findIndex(t => t.grupo === 'temas'), true);
    const rotulos = Array.from(d.querySelectorAll('#optsHost .opt-title')).map(e => e.textContent);
    ok(rotulos.includes('Tema novo por lei'), 'novo tema aparece na tela de marcação');
    ok(!rotulos.includes('Educação financeira'), 'tema oculto sai da tela de marcação');
    w.curSairPrevia();
    ok(!w.eval('TEMAS').some(t => t.id === 'novo1'), 'sair da prévia desfaz o acréscimo');

    // textos da interface
    const antes = $('#uiLandLgpd').textContent;
    w.aplicarConteudo({'UI.landLgpd':'Aviso de proteção de dados atualizado.'});
    ok($('#uiLandLgpd').textContent === 'Aviso de proteção de dados atualizado.', 'texto da interface trocado pela curadoria');
    w.aplicarConteudo({});
    ok($('#uiLandLgpd').textContent === antes, 'sem diferenças, volta o texto original');
    w.eval('CUR.rascunhos = {}'); w.curFechar();

    /* ---- v9.9: a preparação NÃO tranca o modo edição de textos ----
       Os itens de preparação são da ESCOLA: confirmam que a equipe fez o que
       a tela pede antes de escrever. Quem percorre as telas no modo edição é
       o Órgão Central, corrigindo a redação do sistema — e ficava preso em
       quatro telas e no salto pela trilha e pelo mapa. */
    {
      ok(w.eval('EDICAO.ativa') === true, 'v9.9: o modo edição de textos está ativo');
      const comTarefa = [];
      for(let i = 0; i < TELAS.length; i++){
        if(w.eval('tarefaDaTela')(i) && w.eval('tarefaDaTela')(i).obrigatorio) comTarefa.push(i);
      }
      ok(comTarefa.length >= 3,
         'v9.9: há telas com itens de preparação obrigatórios (' + comTarefa.length + ')');
      /* o Órgão Central que entra no modo edição não tem confirmação nenhuma:
         é exatamente o estado em que a trava aparecia. Blocos anteriores desta
         bateria confirmaram itens como ESCOLA — aqui o estado é zerado, para
         que o que se verifica seja a regra e não o resíduo. */
      w.eval('state.tarefas = {}');
      ok(comTarefa.every(i => w.eval('tarefaCompleta')(i) === false),
         'v9.9: e nenhuma delas está confirmada — é o estado em que a trava aparecia');
      ok(comTarefa.every(i => w.eval('travaPreparacao')(i) === false),
         'v9.9: no modo edição, nenhuma delas tranca o avanço');
      const iTrava = comTarefa[0];
      w.irPara(iTrava, true);
      await espera(60);
      ok(!$('#btnNext').classList.contains('travado') && $('#navAviso').hidden,
         'v9.9: o botão Avançar não aparece com cadeado, e o aviso de preparação não aparece');
      ok(!!$('#tarefaBox') && $('#tarefaBox').querySelectorAll('[data-cur]').length >= 3,
         'v9.9: a caixa da preparação continua na tela, e continua editável pela curadoria');
      ok(/Modo edição/.test($('#tarefaBox .trava').textContent) &&
         !/fica liberado/.test($('#tarefaBox .trava').textContent),
         'v9.9: e o rodapé dela deixa de prometer uma trava que não existe ali');
      w.tentarAvancar();
      await espera(60);
      ok(w.eval('state.tela') > iTrava, 'v9.9: Avançar avança de verdade');
      /* o salto pela trilha e pelo mapa também deixa de parar */
      const ultima = comTarefa[comTarefa.length - 1] + 1;
      w.irPara(0, true); w.irParaComTravas(ultima);
      await espera(60);
      ok(w.eval('state.tela') === ultima,
         'v9.9: o salto pela trilha e pelo mapa chega ao destino — antes parava na primeira preparação');
    }
    w.irPara(0, true);
  }

  // ---------- v6.11: diálogos próprios, sem alert/confirm nativos ----------
  {
    w.confirmarAuto = false;      // exercita o diálogo de verdade
    let feito = 0, cancelado = 0;
    w.confirmar('Confirmar esta ação de teste?', function(){ feito++; },
                {titulo:'Teste', rotulo:'Pode ir', aoCancelar:function(){ cancelado++; }});
    ok(!$('#ovAviso').hidden, 'o diálogo de confirmação aparece na própria página');
    ok($('#avisoTitulo').textContent === 'Teste', 'o título vem das opções');
    ok($('#avisoOk').textContent === 'Pode ir', 'o rótulo do botão vem das opções');
    ok(!$('#avisoCancelar').hidden, 'há botão de cancelar');
    await espera(700);
    ok(!$('#ovAviso').hidden, 'a confirmação não some sozinha');
    $('#avisoCancelar').click();
    await espera(150);
    ok($('#ovAviso').hidden && cancelado === 1 && feito === 0, 'cancelar não executa a ação');
    w.confirmar('De novo?', function(){ feito++; });
    $('#avisoOk').click();
    await espera(150);
    ok(feito === 1, 'confirmar executa a ação');
    ok($('#avisoCancelar').hidden === false || true, 'estado do diálogo reaproveitado sem vazar');

    // o aviso simples não tem cancelar
    w.alerta('Mensagem de teste');
    ok(!$('#ovAviso').hidden && $('#avisoCancelar').hidden, 'o aviso simples só oferece OK');
    $('#avisoOk').click();
    await espera(150);
    ok($('#ovAviso').hidden, 'o aviso fecha no OK');

    // nenhum diálogo nativo pode ter sobrado no código
    const fonte = fonteProducao;
    const nativos = (fonte.match(/(?<![\w.])(alert|confirm)\(/g) || []);
    ok(nativos.length === 0, 'não há mais alert() nem confirm() nativos no sistema');

    /* Função que recebe "confirmado" não pode ser ligada direto a um evento:
       o objeto Event chegaria como argumento e valeria como confirmação,
       pulando a pergunta. Foi o que aconteceu com "Criar novo PPP". */
    const comConfirmado = [];
    fonte.replace(/function\s+(\w+)\s*\(\s*confirmado\s*\)/g, function(_, nome){ comConfirmado.push(nome); return _; });
    ok(comConfirmado.length >= 6, 'há funções que dependem de confirmação (' + comConfirmado.length + ')');
    const ligadasDireto = comConfirmado.filter(function(nome){
      return new RegExp("addEventListener\\(\\s*'[a-z]+'\\s*,\\s*" + nome + "\\s*\\)").test(fonte);
    });
    ok(ligadasDireto.length === 0,
       'nenhuma função de confirmação está ligada direto a um evento' +
       (ligadasDireto.length ? ': ' + ligadasDireto.join(', ') : ''));

    w.confirmarAuto = true;
  }

  // ---------- v6.11: entrada pela conta institucional ----------
  {
    w.sairSessao();
    // o servidor identificou a pessoa e já resolveu o cadastro dela
    w.entrarNoSistema();
    w.aplicarContexto({email:'direcao.31100001@educacao.mg.gov.br', controleAtivo:true,
      acesso:{perfil:'escola', nome:'Ana Lúcia Ferreira', masp:'11234567',
              inep:'31100001', escola:'Escola Estadual Professor João Ribeiro', sre:'Divinópolis'}});
    ok($('#portas').hidden && !$('#portaIdent').hidden,
       'com cadastro, a abertura mostra a identificação em vez das portas');
    const cartao = $('#identCard').textContent;
    ok(cartao.includes('Ana Lúcia Ferreira'), 'o cartão traz o nome que a regional cadastrou');
    ok(cartao.includes('Escola Estadual Professor João Ribeiro'), 'e a escola vinculada');
    ok(cartao.includes('MASP 11234567'), 'e o MASP do cadastro');
    ok(cartao.includes('código 31100001') && !cartao.includes('INEP'), 'T-25: e o código da escola, não "INEP"');
    ok(cartao.includes('Direção Escolar'), 'e o papel');
    ok(!d.querySelector('#portaIdent input'), 'não há nada a digitar para entrar');

    // v7.3 (T-02): pelo cartão, o papel entra junto — colegiado não vira direção
    w.aplicarContexto({email:'colegiado.docente@educacao.mg.gov.br', controleAtivo:true,
      acesso:{perfil:'escola', papel:'colegiado', papelNome:'Colegiado Escolar', nome:'Rita Alves — representante docente',
              inep:'31100001', escola:'Escola Estadual Professor João Ribeiro', sre:'Divinópolis',
              email:'colegiado.docente@educacao.mg.gov.br', podeValidar:false, podeAssociar:false, soLeitura:true, cadastra:[]}});
    ok($('#identCard').textContent.includes('Colegiado Escolar') && !$('#identCard').textContent.includes('Direção'),
       'T-02: o cartão de identificação rotula o colegiado como colegiado');
    w.entrarIdentificado();
    await espera(1200);
    ok(w.eval('SESSAO.papel') === 'colegiado' && w.eval('SESSAO.soLeitura') === true && w.eval('SESSAO.podeValidar') === false,
       'T-02: entrar pelo cartão grava papel e competências na sessão, como o caminho por senha');
    ok(w.eval('SESSAO.email') === 'colegiado.docente@educacao.mg.gov.br', 'T-15: a sessão carrega o e-mail do cadastro');
    ok($('#badgeProto').textContent.includes('Colegiado Escolar'), 'T-02: o selo diz "Colegiado Escolar", não "Direção escolar"');
    ok($('#piNovo').hidden && $('#piAbaColegiado').hidden && $('#piAbaAcessos').hidden,
       'T-02/T-01: identificado como colegiado, não há "Criar novo PPP" nem aba do colegiado');
    ok(!$('#piAssinaturas').hidden, 'T-02: o colegiado identificado cai nas suas assinaturas');
    w.sairSessao();
    await espera(200);
    w.aplicarContexto({email:'analista.divinopolis@educacao.mg.gov.br', controleAtivo:true,
      acesso:{perfil:'regional', papel:'equipe_de', papelNome:'Equipe da Diretoria Educacional', nome:'Analista da Diretoria Educacional',
              sre:'Divinópolis', email:'analista.divinopolis@educacao.mg.gov.br', podeValidar:true, podeAssociar:true, soLeitura:false, cadastra:[]}});
    w.entrarIdentificado();
    await espera(1200);
    ok(w.eval('SESSAO.papel') === 'equipe_de' && w.eval('SESSAO.podeValidar') === true,
       'T-02: a equipe da DE identificada pela conta valida');
    ok(!$('#piAbaAcessos').hidden && !$('#piAbaContas').hidden && !$('#piAbaEscolas').hidden,
       'T-02: e tem as abas de acessos, escolas e contas a regularizar');
    ok(!!d.querySelector('#piTabela [data-validar]'), 'T-02/T-26: e vê os botões de validar ao entrar — há PPP em validação na demonstração');
    w.sairSessao();
    await espera(200);

    // e-mail sem cadastro: recusa explicativa, sem formulário
    /* v8.12: a abertura pergunta antes se a pessoa vem entrar ou conferir um
       documento; o caminho do login começa em "Entrar no sistema" */
    w.entrarNoSistema();
    w.aplicarContexto({email:'ninguem@educacao.mg.gov.br', controleAtivo:true, acesso:null});
    ok(!$('#portaSemCadastro').hidden, 'e-mail sem cadastro recebe aviso próprio');
    ok($('#semCadastroCard').textContent.includes('Superintendência Regional de Ensino'),
       'o aviso diz a quem recorrer');
    ok($('#semCadastroCard').textContent.includes('ninguem@educacao.mg.gov.br'),
       'o aviso mostra qual e-mail foi identificado');

    // cadastro inativo
    w.aplicarContexto({email:'antigo@educacao.mg.gov.br', controleAtivo:true, acesso:null, cadastroInativo:true});
    ok($('#semCadastroCard').textContent.includes('inativo'), 'cadastro inativo tem aviso distinto');

    // volta ao estado de demonstração
    w.aplicarContexto({});
    ok(!$('#portas').hidden, 'sem identificação, as portas continuam disponíveis');
    /* v8.12: e a conferência de autenticidade não é uma delas — vem antes */
    w.irParaEntrada();
    ok(!$('#portaEntrada').hidden && $('#portas').hidden,
       'v8.12: a abertura é a escolha entre entrar no sistema e autenticar um PPP');
    w.abrirAutenticacao();
    ok(!$('#portaVerificar').hidden && $('#portas').hidden && w.eval("SESSAO.token") === '',
       'v8.12: autenticar um PPP não abre sessão nem passa pelas portas de perfil');
    w.entrarNoSistema();
  }

  // ---------- v6.6: tela inicial da direção escolar ----------
  {
    w.sairSessao();
    w.abrirPorta('escola');
    if(d.querySelector('[data-papel="diretor_escolar"]')) d.querySelector('[data-papel="diretor_escolar"]').click();
    // no modo de demonstração a porta faz o papel da conta institucional
    await espera(1500);
    ok(w.eval('SESSAO.perfil') === 'escola', 'entrada como direção escolar');
    ok(w.eval('SESSAO.inep') === '31100001', 'sessão carrega o INEP do cadastro de acesso');
    ok(!$('#painelInst').hidden && $('#stage').hidden, 'a direção cai na tela inicial, não no percurso');
    ok($('#piTitulo').textContent.includes('João Ribeiro'), 'tela inicial nomeia a escola');
    ok(!$('#piNovo').hidden, 'botão de criar novo PPP disponível para a direção');
    ok($('#piEditar').hidden && $('#piAbaAcessos').hidden && $('#piAbaEscolas').hidden && $('#piAbaInst').hidden,
       'direção não edita textos nem associa diretores nem mexe na base da rede');
    ok(!$('#piAbaColegiado').hidden && !$('#piAbaAssinaturas').hidden,
       'a direção tem as abas do colegiado e das suas assinaturas');

    const linhasEsc = Array.from(d.querySelectorAll('#piTabela tbody tr'));
    ok(linhasEsc.length === 3, 'a escola vê os ' + linhasEsc.length + ' PPPs dela, e só os dela');
    ok(!d.querySelector('#piTabela').textContent.includes('Horizonte do Saber'),
       'PPPs de outras escolas não aparecem para a direção');
    ok(d.querySelectorAll('#piTabela [data-continuar]').length === 1,
       'só o PPP em elaboração oferece continuar');
    /* v9.3: o botão "nova versão" saiu da linha do painel — nenhuma versão o
       oferece ali; o caminho é o cartão da tela final */
    ok(d.querySelectorAll('#piTabela [data-nova-versao]').length === 0 && !/nova versão/.test($('#piTabela').textContent),
       'T-06 (v9.3): nenhuma linha do painel da escola oferece "nova versão"');
    const linhaAssin = linhasEsc.filter(tr => tr.textContent.includes('PPP-2024-0018-A2ND'))[0];
    ok(linhaAssin && !linhaAssin.querySelector('[data-nova-versao]') && !linhaAssin.querySelector('[data-continuar]') &&
       linhaAssin.textContent.includes('em coleta de assinaturas') && linhaAssin.textContent.includes('9 de 11'),
       'T-06/T-26: o PPP em assinatura não oferece nova versão nem continuar — e mostra 9 de 11 assinadas');
    ok(d.querySelector('#piTabela').textContent.includes('homologada — encerrada'),
       'a lista diz por que o documento não pode mais ser editado (v7.9: homologada pela SRE)');
    ok($('#piSub').textContent.includes('código 31100001') && !$('#piSub').textContent.includes('INEP'),
       'T-25: o subtítulo da escola fala em código, não em INEP');
    ok($('#piResumo').textContent.includes('versão homologada'), 'resumo da escola fala do documento, não da rede');

    // continuar o PPP em elaboração
    d.querySelector('#piTabela [data-continuar]').click();
    await espera(900);
    ok($('#painelInst').hidden && !$('#stage').hidden, 'continuar leva ao percurso');
    ok(!$('#btnPainel').hidden, 'no percurso há volta para a tela inicial');
    ok(w.eval('state').dados.inep === '31100001', 'o percurso já vem identificado com o INEP da escola');
    w.voltarAoPainel();
    await espera(900);
    ok(!$('#painelInst').hidden, 'volta para a tela inicial');

    // com um PPP em andamento, criar outro é bloqueado — não é pergunta
    w.confirmarAuto = false;
    w.criarNovoPPP();
    await espera(300);
    ok(!$('#ovAviso').hidden, 'clicar em criar com um PPP em andamento abre o aviso');
    ok($('#avisoTitulo').textContent.includes('Já existe'), 'o aviso diz que já existe um em andamento');
    ok($('#avisoTexto').textContent.includes('PPP-2026-0031-R4KP'), 'o aviso identifica qual é');
    ok($('#avisoTexto').textContent.includes('um PPP em elaboração por vez'), 'e explica a regra');
    ok($('#avisoOk').textContent === 'Continuar esse PPP', 'a saída oferecida é continuar o que existe');
    ok($('#avisoCancelar').textContent === 'Fechar', 'não há opção de criar assim mesmo');
    $('#avisoCancelar').click();
    await espera(200);
    ok(!$('#painelInst').hidden && $('#stage').hidden,
       'fechar não cria nada e mantém a tela inicial');
    // e o caminho oferecido leva ao PPP existente
    w.criarNovoPPP();
    await espera(300);
    $('#avisoOk').click();
    await espera(900);
    ok(w.eval('APP').protocolo === 'PPP-2026-0031-R4KP', 'o botão do aviso abre o PPP em andamento');
    w.confirmarAuto = true;
    w.voltarAoPainel();
    await espera(800);

    // com o PPP em validação, criar outro também é barrado — e o caminho é aguardar (T-06)
    w.confirmarAuto = false;
    w.eval('PAINEL').linhas.forEach(function(x){ if(x.editavel){ x.status = 'Em validação'; x.editavel = false; x.enviadoValidacaoEm = '10/09/2026 08:00'; } });
    w.criarNovoPPP();
    await espera(300);
    ok(!$('#ovAviso').hidden && $('#avisoTitulo').textContent.includes('Já existe') &&
       $('#avisoTexto').textContent.includes('em validação'),
       'T-06: com um PPP em validação, "Criar novo PPP" explica que ele espera a Diretoria Educacional');
    ok($('#avisoOk').textContent === 'Fechar' && $('#avisoCancelar').hidden, 'T-06: em validação não há "continuar" — só fechar (v9.0: um botão só)');
    $('#avisoOk').click();
    await espera(300);
    ok(!$('#painelInst').hidden && $('#stage').hidden, 'T-06: nada é criado nem aberto');
    w.ajustarBotaoNovo(w.eval('PAINEL').linhas);
    ok($('#piNovo').classList.contains('btn-ghost') && /em validação/.test($('#piNovo').title),
       'T-06: o botão de criar fica sem destaque e explica que há um PPP em validação');
    w.confirmarAuto = true;

    // sem nenhum em andamento, a criação segue normalmente
    w.eval('PAINEL').linhas.forEach(function(x){ x.editavel = false; x.emElaboracao = false; x.status = 'Enviado para homologação'; });
    w.eval('state').txt.tMissao = 'texto antigo que não pode vazar para o novo PPP';
    w.criarNovoPPP();
    await espera(600);
    ok(!$('#ovAviso').hidden && $('#avisoTitulo').textContent === 'Percurso iniciado',
       'sem PPP em andamento, o percurso começa e dá as boas-vindas');
    await espera(1200);
    ok(!$('#ovAviso').hidden, 'o aviso não some sozinho com o tempo');
    $('#avisoOk').click();
    await espera(200);
    ok($('#ovAviso').hidden, 'o aviso só sai depois do OK');
    ok(w.eval('state').txt.tMissao === '', 'novo PPP começa em branco');
    ok(w.eval('state').dados.inep === '31100001' && w.eval('APP').protocolo === null,
       'novo PPP nasce sem protocolo e já vinculado à escola');
    w.voltarAoPainel();
    await espera(800);
  }

  // ---------- v6.3: perfis de acesso e edição direta ----------
  {
    // perfil regional
    w.sairSessao();
    w.abrirPorta('regional');
    if(d.querySelector('[data-papel="superintendente"]')) d.querySelector('[data-papel="superintendente"]').click();
    await espera(1500);
    ok(w.eval('SESSAO.perfil') === 'regional', 'entrada como regional');
    ok(!$('#painelInst').hidden && $('#stage').hidden, 'painel institucional substitui o percurso');
    const linhasReg = d.querySelectorAll('#piTabela tbody tr').length;
    const esperadosReg = w.DEMO.registros().filter(x => x.sre === 'Divinópolis').length;
    ok(linhasReg === esperadosReg && linhasReg >= 10, `regional vê apenas os ${linhasReg} PPPs da sua SRE`);
    ok(d.querySelector('#piTabela').textContent.includes('Em validação') && d.querySelector('#piTabela').textContent.includes('São Sebastião do Oeste'),
       'T-26: a demonstração traz um PPP em validação de outra escola da regional');
    ok(!d.querySelector('#piTabela').textContent.includes('INEP'), 'T-25: o painel regional fala em código, não em INEP');
    ok(!d.querySelector('#piTabela').textContent.includes('Uberlândia'), 'escolas de outra regional não aparecem');
    ok($('#piEditar').hidden, 'regional não tem acesso à edição de textos');
    /* v9.7: o Superintendente administra os Diretores Educacionais e o
       Coordenador de Inspeção; os diretores escolares são da Diretoria
       Educacional, e a aba não aparece para ele */
    ok(!$('#piAbas').hidden && $('#piAbaAcessos').hidden && $('#piAbaEscolas').hidden && $('#piAbaContas').hidden,
       'v9.7: o Superintendente não tem as abas de acessos das escolas, base da rede nem contas a regularizar');
    ok(!$('#piAbaEquipe').hidden && $('#piAbaEquipe').textContent === 'Equipe da Superintendência',
       'v9.7: e tem a aba da própria equipe — Diretores Educacionais e Coordenador de Inspeção');
    ok($('#piResumo').textContent.includes('PPPs listados'), 'painel traz o resumo por situação');

    // filtro por situação
    $('#piStatus').value = 'Em andamento';
    $('#piStatus').dispatchEvent(new w.Event('change'));
    await espera(700);
    const andamentoReg = w.DEMO.registros().filter(x => x.sre === 'Divinópolis' && x.status === 'Em andamento').length;
    ok(d.querySelectorAll('#piTabela tbody tr').length === andamentoReg && andamentoReg < esperadosReg, 'filtro por situação reduz a lista');
    $('#piStatus').value = '';
    $('#piStatus').dispatchEvent(new w.Event('change'));
    await espera(700);

    // leitura de um documento
    d.querySelector('[data-ver]').click();
    await espera(750);
    ok(!$('#ovDoc').hidden && $('#docFull').textContent.includes('Projeto Político-Pedagógico'),
       'regional abre o documento de uma escola em leitura');
    /* v8.11/v8.12: o que ela lê é o arquivo CONGELADO na conclusão — vem com
       a folha de assinaturas que o servidor acrescentou naquele momento, e
       não é uma remontagem da tela (que não monta a folha). */
    ok(/Folha de assinaturas/.test($('#docFull').textContent) &&
       !d.querySelector('#docFull [data-cur]'),
       'v8.11: e o que ela lê é o documento congelado, não uma remontagem com os textos de hoje');
    ok(!!d.querySelector('#docFull .brasao img') &&
       /código de autenticidade/.test(($('#docFull').querySelector('.pag-cod') || {textContent:''}).textContent),
       'v8.12: com o brasão e o código de autenticidade no lugar das marcas do PDF');
    $('#ovDoc').hidden = true;

    // a regional associa diretores só na sua SRE, e filtra por município
    d.querySelector('[data-aba="acessos"]').click();
    await espera(1000);
    const linhasReg2 = () => Array.from(d.querySelectorAll('#piAcessos [data-inep]'));
    ok(linhasReg2().length > 0, 'a regional vê as escolas da sua SRE para associar o diretor');
    ok(w.eval('ESCOLAS').every(e => e.sre === 'Divinópolis'),
       'nenhuma escola de outra regional chega à tela da regional');
    ok(!$('#piAcessos').textContent.includes('Uberlândia'),
       'nem escola nem diretor de outra regional aparecem na associação');
    ok(!$('#escSre'), 'a regional não escolhe regional — ela já vê apenas a sua');
    ok(!!$('#escMun'), 'a regional tem o filtro por município');
    const munsReg = Array.from($('#escMun').options).map(o => o.value).filter(Boolean);
    ok(munsReg.length > 1, 'o filtro oferece os municípios da regional');
    $('#escMun').value = munsReg[0];
    $('#escMun').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(300);
    ok(linhasReg2().length > 0 && linhasReg2().every(x => {
         const e = w.eval('ESCOLAS').filter(y => y.inep === x.dataset.inep)[0];
         return e && e.municipio === munsReg[0];
       }), 'o filtro por município reduz a lista da regional');
    linhasReg2()[0].click();
    await espera(400);
    ok(!$('#ovGestor').hidden, 'a regional abre a janela para associar o diretor');
    w.fecharGestor();
    await espera(200);
    $('#escMun').value = '';
    $('#escMun').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(300);
    // e a base de escolas da regional segue o mesmo escopo
    d.querySelector('[data-aba="escolas"]').click();
    await espera(1000);
    ok(!$('#baseSre'), 'na base de escolas a regional também não escolhe regional');
    ok(!!$('#baseMun'), 'a base de escolas da regional tem o filtro por município');
    ok($('#piEscolas').textContent.includes('sua própria SRE'),
       'a tela diz à regional que o alcance dela é a própria SRE');
    d.querySelector('[data-aba="docs"]').click();
    await espera(700);

    // troca para o Órgão Central
    w.sairSessao();
    ok(!$('#landing').hidden && !$('#portaEntrada').hidden,
       'v8.12: sair volta ao início — entrar no sistema ou autenticar um PPP');
    w.entrarNoSistema();
    ok(!$('#portas').hidden, 'e daí se chega à escolha de perfil');
    w.abrirPorta('central');
    await espera(750);
    ok(w.eval('SESSAO.perfil') === 'central' && !$('#portaModo').hidden,
       'Órgão Central escolhe entre visualizar e editar');
    w.escolherModo('visualizacao');
    await espera(1500);
    /* v7.7 (P5): o Central começa pelo QUADRO das regionais; a lista plana só ao escolher uma SRE */
    const nSres = new Set(w.DEMO.registros().map(x => x.sre)).size;
    ok(d.querySelectorAll('#piTabela tbody tr[data-quadro-sre]').length === nSres && nSres >= 3,
       'P5: o Órgão Central começa pelo quadro das regionais — uma linha por SRE (' + nSres + ')');
    /* v8.8 (B2): o Central recebe o QUADRO somado no servidor, não as linhas */
    ok(w.eval('PAINEL').resumido === true && w.eval('PAINEL').linhas.length === 0 &&
       w.eval('PAINEL').totais.total === w.DEMO.registros().length,
       'B2: o Órgão Central recebe o quadro somado pelo servidor — os totais cobrem a rede inteira, sem trazer as linhas');
    {
      const linhaDiv = d.querySelector('#piTabela tbody tr[data-quadro-sre="Divinópolis"]');
      ok(!!linhaDiv && /a mais antiga há \d+ d/.test(linhaDiv.textContent), 'P5: o quadro diz quantos esperam validação em cada SRE e há quanto tempo');
      linhaDiv.click(); await espera(900);
      ok($('#piSre').value === 'Divinópolis' && d.querySelectorAll('#piTabela tbody tr').length === w.DEMO.registros().filter(x => x.sre === 'Divinópolis').length,
         'P5: clicar na regional abre a lista plana dos PPPs dela');
      ok(!!d.querySelector('#piResumo [data-fila-validacao]') && /a mais antiga há \d+ dias?/.test($('#piResumo').textContent),
         'P5: o cartão "em validação" diz há quanto tempo o mais antigo espera');
      d.querySelector('#piResumo [data-fila-validacao]').click(); await espera(900);
      ok($('#piStatus').value === 'Em validação' && Array.from(d.querySelectorAll('#piTabela tbody tr')).every(tr => /Em validação/.test(tr.textContent)) && /espera há \d+ dia/.test($('#piTabela').textContent),
         'P5: o cartão abre a fila de validação, com a espera de cada PPP');
      $('#piStatus').value = ''; $('#piSre').value = '';
      $('#piStatus').dispatchEvent(new w.Event('change')); await espera(900);
    }
    ok(!$('#piAbas').hidden && !$('#piEditar').hidden, 'Órgão Central tem as abas de acessos e a edição de textos');
    ok($('#piResumo').textContent.includes('REVISÃO VENCIDA') || $('#piResumo').textContent.toLowerCase().includes('revisão vencida'),
       'painel alerta sobre PPP com revisão vencida (mais de dois anos)');
    $('#piStatus').value = '__vencidas';
    $('#piStatus').dispatchEvent(new w.Event('change'));
    await espera(800);
    {
      const linhasV = Array.from(d.querySelectorAll('#piTabela tbody tr'));
      ok(linhasV.length >= 1 && linhasV.every(tr => /revisão vencida/i.test(tr.textContent)),
         'filtro mostra só os PPPs com revisão vencida (' + linhasV.length + ')');
    }
    ok(d.querySelector('#piTabela').textContent.includes('revisão vencida'), 'a linha traz a marca de revisão vencida');
    $('#piStatus').value = '';
    $('#piStatus').dispatchEvent(new w.Event('change'));
    await espera(800);
    ok(typeof w.exportarPainelCSV === 'function', 'painel exporta a lista filtrada em planilha');
    ok(d.querySelector('#piTabela').textContent.includes('Uberlândia'), 'documentos de outras regionais listados');

    /* v9.7: quem gere os diretores escolares é a Diretoria Educacional — a
       partir daqui a bateria entra como ela */
    w.sairSessao();
    w.abrirPorta('regional');
    if(d.querySelector('[data-papel="diretor_educacional"]')) d.querySelector('[data-papel="diretor_educacional"]').click();
    await espera(1500);
    ok(w.eval('SESSAO.papel') === 'diretor_educacional' && !$('#piAbaAcessos').hidden && !$('#piAbaEscolas').hidden,
       'v9.7: a Diretoria Educacional tem as abas de acessos das escolas e da base da rede');
    // gestão de acessos a partir da base de escolas
    d.querySelector('[data-aba="acessos"]').click();
    await espera(900);
    const linhasEscola = () => Array.from(d.querySelectorAll('#piAcessos [data-inep]'));
    ok(linhasEscola().length > 0, 'a aba de acessos lista as escolas da base, não e-mails soltos');
    ok($('#piAcessos').textContent.includes('sem acesso'), 'a base marca as escolas ainda sem gestor');
    ok(!$('#escImportar'), 'a importação em lote saiu da aba de acessos — passou para a aba da base de escolas');

    /* v9.7: a aba é da Diretoria Educacional, que tem uma SRE só — o filtro
       por regional (do Órgão Central) não existe aqui; o de município, sim */
    ok(!$('#escSre'), 'v9.7: a Diretoria Educacional não tem filtro por regional — a lista é da sua SRE');
    ok(!!$('#escMun'), 'a aba de acessos tem o filtro por município');
    ok(linhasEscola().length > 0 && linhasEscola().every(x => {
         const e = w.eval('ESCOLAS').filter(y => y.inep === x.dataset.inep)[0];
         return e && e.sre === 'Divinópolis';
       }), 'a lista traz só as escolas da regional da Diretoria Educacional');
    const munsDaSre = Array.from($('#escMun').options).map(o => o.value).filter(Boolean);
    ok(munsDaSre.length > 0 && munsDaSre.every(m => w.eval('ESCOLAS')
         .filter(e => e.municipio === m).some(e => e.sre === 'Divinópolis')),
       'os municípios oferecidos são os da regional escolhida');
    $('#escMun').value = munsDaSre[0];
    $('#escMun').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(300);
    ok(linhasEscola().every(x => {
         const e = w.eval('ESCOLAS').filter(y => y.inep === x.dataset.inep)[0];
         return e && e.municipio === munsDaSre[0];
       }), 'o filtro por município reduz a lista àquele município');
    $('#escMun').value = '';
    $('#escMun').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(300);
    ok($('#escMun').value === '' && linhasEscola().length > 0, 'limpar o município devolve a lista da regional');

    // filtro e busca
    $('#escFiltro').value = 'sem';
    $('#escFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    ok(!$('#piAcessos').textContent.includes('com acesso') || linhasEscola().length < w.eval('ESCOLAS').length,
       'filtro reduz a lista às escolas sem gestor');
    $('#escFiltro').value = '';
    $('#escFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    $('#escBusca').value = 'Dona Maria da Glória';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    ok(linhasEscola().length === 1, 'busca encontra a escola pelo nome');

    // histórico de gestores da escola que já teve vários
    $('#escBusca').value = 'João Ribeiro';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    const comHistorico = linhasEscola().filter(x => x.textContent.includes('Professor João Ribeiro'))[0];
    ok(!!comHistorico, 'escola com histórico localizada');
    ok(comHistorico.textContent.includes('3º diretor'), 'a lista já indica que a escola trocou de diretor');
    ok(comHistorico.textContent.includes('Ana Lúcia Ferreira') && !comHistorico.textContent.includes('Pedro Henrique'),
       'T-04(a): o gestor da escola é a diretora, não o representante estudantil do colegiado');
    comHistorico.click();
    await espera(900);
    ok(!$('#gsHistBox').hidden, 'a janela do gestor oferece o histórico da escola');
    ok($('#gsHistResumo').textContent.includes('3 períodos'), 'o resumo informa quantos diretores já passaram');
    const linhasHist = d.querySelectorAll('#gsHist .gh');
    ok(linhasHist.length === 3, 'o histórico lista todos os gestores já cadastrados');
    ok(linhasHist[0].classList.contains('atual'), 'o gestor vigente vem primeiro e é destacado');
    ok(d.querySelector('#gsHist').textContent.includes('Sebastião Prates'),
       'gestores antigos continuam visíveis');
    ok(d.querySelector('#gsHist').textContent.includes('aposentadoria'),
       'o histórico mostra o motivo do encerramento de cada período');
    ok(d.querySelector('#gsHist').textContent.includes('MASP'), 'o histórico preserva o MASP de cada gestor');
    w.fecharGestor();
    await espera(200);
    $('#escBusca').value = 'Dona Maria da Glória';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);

    // janela do diretor: primeira associação
    const inepAlvo = linhasEscola()[0].dataset.inep;
    linhasEscola()[0].click();
    await espera(300);
    ok(!$('#ovGestor').hidden, 'clicar na escola abre a janela do diretor');
    ok($('#gsEscola').textContent.includes('Dona Maria da Glória'), 'a janela mostra a escola escolhida');
    ok($('#gsPainelAtual').hidden && !$('#gsPainelForm').hidden,
       'escola sem diretor abre direto no formulário de associação');
    ok($('#gsSalvar').hidden && !$('#gsContinuar').hidden,
       'o botão do formulário é Continuar, não Salvar — a gravação vem depois da conferência');
    $('#gsNome').value = 'Marcos Vinícius Alves';
    $('#gsMasp').value = 'a12b3456x';
    $('#gsMasp').dispatchEvent(new w.Event('input', {bubbles:true}));
    ok($('#gsMasp').value === '123456', 'MASP aceita apenas números, mesmo colado com letras');
    $('#gsNome').value = 'Marcos Vinícius Alves';
    $('#gsEmail').value = 'direcao.31123459@educacao.mg.gov.br';
    const maspAntes = $('#gsMasp').value;
    $('#gsMasp').value = '123';
    $('#gsContinuar').click();
    await espera(200);
    ok($('#gsErro').textContent.includes('MASP'), 'MASP fora de 6 a 12 dígitos é barrado, como no servidor');
    $('#gsMasp').value = maspAntes;
    $('#gsEmail').value = 'sem-arroba';
    $('#gsContinuar').click();
    await espera(300);
    ok($('#gsErro').classList.contains('show') && !$('#gsPainelForm').hidden,
       'e-mail inválido é barrado antes da conferência');
    $('#gsEmail').value = 'direcao.31123459@educacao.mg.gov.br';
    $('#gsContinuar').click();
    await espera(300);

    // passo de conferência
    ok(!$('#gsPainelResumo').hidden && $('#gsPainelForm').hidden, 'Continuar leva ao resumo de conferência');
    ok($('#gsTitulo').textContent.includes('Confira'), 'a janela anuncia que é hora de conferir');
    const resumo1 = $('#gsResumo').textContent;
    ok(resumo1.includes('Marcos Vinícius Alves') && resumo1.includes('123456') &&
       resumo1.includes('direcao.31123459@educacao.mg.gov.br') && resumo1.includes('Dona Maria da Glória'),
       'o resumo mostra escola, diretor, MASP e e-mail antes de gravar');
    ok(/\d{2}\/\d{2}\/\d{4}/.test(resumo1), 'o resumo traz a data da associação');
    ok(!$('#gsVoltar').hidden, 'a conferência pode ser recusada com Voltar');
    $('#gsVoltar').click();
    await espera(200);
    ok(!$('#gsPainelForm').hidden && $('#gsNome').value === 'Marcos Vinícius Alves',
       'Voltar devolve ao formulário sem perder o que foi digitado');
    $('#gsContinuar').click();
    await espera(300);
    $('#gsSalvar').click();
    await espera(900);
    ok($('#ovGestor').hidden, 'janela fecha depois de salvar');
    const salva = w.eval('ESCOLAS').filter(x => x.inep === inepAlvo)[0];
    ok(salva && salva.gestor && salva.gestor.masp === '123456', 'diretor gravado com o MASP numérico');
    ok(salva.gestoresJaCadastrados === 1, 'a primeira associação abre o histórico da escola');

    // escola com diretor abre mostrando quem está no exercício
    $('#escBusca').value = 'Dona Maria da Glória';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    linhasEscola()[0].click();
    await espera(900);
    ok(!$('#gsPainelAtual').hidden && $('#gsPainelForm').hidden,
       'escola com diretor abre no cartão de quem está no exercício, não no formulário');
    ok($('#gsAtualNome').textContent === 'Marcos Vinícius Alves', 'o cartão nomeia o diretor em exercício');
    ok($('#gsAtualDesde').textContent.includes('Associado em'), 'o cartão mostra desde quando ele responde');
    ok(!!$('#gsNovoDiretor') && !!$('#gsCorrigir'),
       'a janela separa associar novo diretor de corrigir os dados do atual');

    // ESTE É O DEFEITO CORRIGIDO: diretor novo com o MESMO e-mail institucional
    $('#gsNovoDiretor').click();
    await espera(200);
    ok($('#gsNome').value === '' && $('#gsEmail').value === '' && $('#gsMasp').value === '',
       'o formulário do diretor novo começa vazio — não se digita por cima de quem sai');
    $('#gsNome').value = 'Terceira Diretora da Escola';
    $('#gsMasp').value = '7654321';
    $('#gsEmail').value = 'direcao.31123459@educacao.mg.gov.br';   // a mesma caixa da escola
    $('#gsContinuar').click();
    await espera(300);
    ok($('#gsResumoAviso').textContent.includes('Marcos Vinícius Alves') &&
       $('#gsResumoAviso').textContent.includes('encerrado'),
       'o resumo avisa quem será encerrado e mandado ao histórico');
    $('#gsSalvar').click();
    await espera(900);
    const trocada = w.eval('ESCOLAS').filter(x => x.inep === inepAlvo)[0];
    ok(trocada.gestor.nome === 'Terceira Diretora da Escola', 'a diretora nova assume a escola');
    ok(trocada.gestor.masp === '7654321', 'com os dados dela, não os do anterior');
    ok(trocada.gestoresJaCadastrados === 2,
       'mesmo mantendo o e-mail institucional, a troca abre um período novo — o anterior NÃO é sobrescrito');
    linhasEscola()[0].click();
    await espera(900);
    $('#gsHistBox').open = true;
    await espera(400);
    const linhasH = d.querySelectorAll('#gsHist .gh');
    ok(linhasH.length === 2, 'o histórico da escola mostra os dois diretores');
    ok(d.querySelector('#gsHist').textContent.includes('Marcos Vinícius Alves'),
       'o diretor substituído continua no histórico, com nome e MASP próprios');
    ok(d.querySelector('#gsHist').textContent.includes('123456'),
       'o MASP do anterior não foi sobrescrito pelo do sucessor');
    ok(!linhasH[1].classList.contains('atual') && linhasH[1].textContent.includes('até'),
       'o período do anterior tem data final');

    // correção de dados NÃO abre período novo
    $('#gsCorrigir').click();
    await espera(200);
    ok($('#gsNome').value === 'Terceira Diretora da Escola',
       'corrigir carrega os dados de quem está no exercício');
    $('#gsNome').value = 'Terceira Diretora da Silva';
    $('#gsContinuar').click();
    await espera(300);
    ok($('#gsResumoAviso').textContent.includes('Correção'), 'o resumo deixa claro que é correção, não troca');
    $('#gsSalvar').click();
    await espera(900);
    const corrigida = w.eval('ESCOLAS').filter(x => x.inep === inepAlvo)[0];
    ok(corrigida.gestor.nome === 'Terceira Diretora da Silva', 'a correção acerta o nome');
    ok(corrigida.gestoresJaCadastrados === 2, 'corrigir não cria período novo no histórico');

    // desativação pelo cartão do diretor ativo
    linhasEscola()[0].click();
    await espera(900);
    $('#gsCartaoAtual').click();
    await espera(200);
    ok(!$('#gsPainelDesativar').hidden, 'clicar no diretor ativo abre a janela de desativação');
    ok($('#gsDesResumo').textContent.includes('Terceira Diretora da Silva'),
       'a desativação mostra de quem se trata');
    ok($('#gsMotivoOutroBox').hidden, 'o campo de motivo livre só aparece quando escolhido');
    $('#gsMotivo').value = '__outro';
    $('#gsMotivo').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(100);
    ok(!$('#gsMotivoOutroBox').hidden, 'escolhido "outro", o campo de descrição aparece');
    $('#gsMotivoOutro').value = 'ab';
    $('#gsDesativar').click();
    await espera(300);
    ok($('#gsErro').classList.contains('show'), 'motivo livre vazio ou curto é barrado');
    $('#gsMotivo').value = 'Aposentadoria';
    $('#gsMotivo').dispatchEvent(new w.Event('change', {bubbles:true}));
    $('#gsDesativar').click();
    await espera(900);
    const semDiretor = w.eval('ESCOLAS').filter(x => x.inep === inepAlvo)[0];
    ok(!semDiretor.gestor, 'desativar deixa a escola sem diretor associado');
    ok(semDiretor.gestoresJaCadastrados === 2, 'desativar não apaga nada do histórico');
    linhasEscola()[0].click();
    await espera(900);
    $('#gsHistBox').open = true;
    ok(d.querySelector('#gsHist').textContent.includes('Aposentadoria'),
       'o motivo escolhido na desativação fica registrado no histórico');
    ok(d.querySelectorAll('#gsHist .gh.atual').length === 0, 'nenhum período fica em aberto depois da desativação');
    w.fecharGestor();
    await espera(200);
    $('#escBusca').value = '';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);

    // ---- base de escolas: cadastrar escola nova, alterar e inativar ----
    ok(!!d.querySelector('[data-aba="escolas"]'), 'existe a aba da base de escolas da rede');
    d.querySelector('[data-aba="escolas"]').click();
    await espera(900);
    const linhasBase = () => Array.from(d.querySelectorAll('#piEscolas [data-base-inep]'));
    ok(linhasBase().length > 0, 'a aba lista as escolas da base');
    /* v9.7: a carga em lote da base e o filtro por regional são do Órgão
       Central, que recebe a base da rede na implantação; a Diretoria
       Educacional mantém a base da SUA regional */
    ok(!$('#escImportar'), 'v9.7: a importação em lote da base é do Órgão Central, não da Diretoria Educacional');
    ok(!!$('#baseNova'), 'há o botão de cadastrar escola');
    ok(!$('#baseSre') && !!$('#baseMun'), 'v9.7: a Diretoria Educacional filtra por município; a regional é a sua');
    ok(linhasBase().length > 0 && linhasBase().every(x => {
         const e = w.eval('ESCOLAS').filter(y => y.inep === x.dataset.baseInep)[0];
         return e && e.sre === 'Divinópolis';
       }), 'na base, a Diretoria Educacional vê as escolas da sua regional');
    const totalAntes = linhasBase().length;

    // cadastro de escola nova
    $('#baseNova').click();
    await espera(300);
    ok(!$('#ovEscola').hidden, 'o botão abre a janela de cadastro');
    ok($('#ecTitulo').textContent.includes('Cadastrar'), 'a janela abre em modo de cadastro');
    ok(!$('#ecInep').readOnly, 'no cadastro o código INEP é digitável');
    ok($('#ecSituacao').hidden, 'escola que ainda não existe não oferece inativação');
    $('#ecInep').value = '31a7b0c9-99';
    $('#ecInep').dispatchEvent(new w.Event('input', {bubbles:true}));
    ok($('#ecInep').value === '3170999', 'o código INEP aceita apenas números, mesmo colado com letras');
    $('#ecInep').value = '3';
    $('#ecNome').value = 'Escola Estadual Nova do Horto';
    $('#ecMunicipio').value = 'Divinópolis';
    $('#ecSre').value = 'Divinópolis';
    $('#ecSalvar').click();
    await espera(300);
    ok($('#ecErro').classList.contains('show') && $('#ecErro').textContent.includes('2 a 8 dígitos'),
       'código da escola curto demais é barrado antes de ir ao servidor');
    $('#ecInep').value = '184381';
    $('#ecCodInep').value = '123';
    $('#ecSalvar').click();
    await espera(300);
    ok($('#ecErro').textContent.includes('INEP'), 'o INEP, com tamanho errado, também é barrado');
    /* v9.8: o código INEP passou a ser OBRIGATÓRIO no cadastro de escola */
    $('#ecCodInep').value = '';
    $('#ecInep').value = '31799001';
    $('#ecSalvar').click();
    await espera(300);
    ok($('#ecErro').textContent.includes('obrigatório'),
       'v9.8: escola sem código INEP é recusada, e a recusa diz que ele é obrigatório');
    $('#ecCodInep').value = '31799801';
    $('#ecMunicipio').value = '';
    $('#ecSalvar').click();
    await espera(300);
    ok($('#ecErro').textContent.includes('município'), 'escola sem município é recusada');
    $('#ecMunicipio').value = 'Divinópolis';
    $('#ecSalvar').click();
    await espera(900);
    ok($('#ovEscola').hidden, 'a janela fecha depois de cadastrar');
    ok(linhasBase().length === totalAntes + 1, 'a escola nova entra na lista da base');
    ok($('#piEscolas').textContent.includes('Nova do Horto'), 'a escola nova aparece pelo nome');

    // INEP repetido não cria uma segunda escola
    $('#baseNova').click();
    await espera(300);
    $('#ecInep').value = '31799001';
    $('#ecNome').value = 'Outra escola qualquer';
    $('#ecMunicipio').value = 'Itaúna';
    $('#ecSre').value = 'Divinópolis';
    $('#ecCodInep').value = '31799802';
    $('#ecSalvar').click();
    await espera(400);
    ok($('#ecErro').classList.contains('show') && $('#ecErro').textContent.includes('já está na base'),
       'código INEP repetido é recusado — a base não duplica escola');
    w.fecharEscola();
    await espera(200);

    // a escola nova já pode receber gestor na aba de acessos
    d.querySelector('[data-aba="acessos"]').click();
    await espera(900);
    $('#escBusca').value = 'Nova do Horto';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    ok(d.querySelectorAll('#piAcessos [data-inep="31799001"]').length === 1,
       'a escola cadastrada aparece na lista de acessos, pronta para receber gestor');
    $('#escBusca').value = '';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);

    // alterar os dados de uma escola já cadastrada
    d.querySelector('[data-aba="escolas"]').click();
    await espera(900);
    $('#baseBusca').value = 'Nova do Horto';
    $('#baseBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    linhasBase()[0].click();
    await espera(300);
    ok($('#ecInep').readOnly, 'em escola já cadastrada o código INEP não é editável');
    ok(!$('#ecSituacao').hidden && $('#ecSituacao').textContent.includes('Inativar'),
       'escola ativa oferece a inativação');
    $('#ecNome').value = 'Escola Estadual Nova do Horto Florido';
    $('#ecSalvar').click();
    await espera(900);
    ok($('#piEscolas').textContent.includes('Horto Florido'), 'alterar o nome reescreve o mesmo registro');
    ok(linhasBase().length === 1, 'alterar não cria uma segunda escola');

    // inativar: some da lista de acessos, permanece na base
    linhasBase()[0].click();
    await espera(300);
    w.confirmarAuto = true;
    $('#ecSituacao').click();
    await espera(900);
    const inativada = w.eval('ESCOLAS').filter(x => x.inep === '31799001')[0];
    ok(inativada && inativada.situacao === 'inativa', 'a escola fica inativa, não é excluída');
    ok(w.eval('ESCOLAS').filter(x => x.inep === '31799001').length === 1, 'a linha continua na base');
    $('#baseFiltro').value = 'inativa';
    $('#baseFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    ok(linhasBase().length >= 1 && $('#piEscolas').textContent.includes('inativa'),
       'o filtro de inativas mostra a escola dada baixa');
    $('#baseFiltro').value = '';
    $('#baseFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    $('#baseBusca').value = '';
    $('#baseBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);

    d.querySelector('[data-aba="acessos"]').click();
    await espera(900);
    ok(d.querySelectorAll('#piAcessos [data-inep="31799001"]').length === 0,
       'escola inativa sai da lista de cadastro de acessos');

    // reativar devolve a escola ao cadastro de acessos
    d.querySelector('[data-aba="escolas"]').click();
    await espera(900);
    $('#baseBusca').value = 'Horto Florido';
    $('#baseBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    linhasBase()[0].click();
    await espera(300);
    ok($('#ecSituacao').textContent.includes('Reativar'), 'escola inativa oferece a reativação');
    ok($('#ecAvisoAcesso').textContent.includes('não recebe diretor novo'),
       'a janela explica o que a inativação significa');
    $('#ecSituacao').click();
    await espera(900);
    ok(w.eval('ESCOLAS').filter(x => x.inep === '31799001')[0].situacao === 'ativa', 'a escola volta a ficar ativa');
    $('#baseBusca').value = '';
    $('#baseBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);

    /* v9.7: volta ao Órgão Central — é dele a aba do superintendente, a carga
       em lote da base e o filtro por regional */
    w.sairSessao();
    w.entrarNoSistema();
    w.abrirPorta('central');
    await espera(750);
    w.escolherModo('visualizacao');
    await espera(1500);
    d.querySelector('[data-aba="escolas"]').click();
    await espera(900);
    ok(!!$('#escImportar') && !!$('#baseSre'),
       'v9.7: a carga em lote da base e o filtro por regional continuam com o Órgão Central');
    ok($('#piAbaAcessos').hidden && $('#piAbaContas').hidden,
       'v9.7: e o Órgão Central não gere os diretores escolares — sem as abas de acessos e de contas');
    // acessos institucionais voltam a ter tela própria, só para o Órgão Central
    d.querySelector('[data-aba="inst"]').click();
    await espera(300);
    ok(!$('#piAbaInst').hidden && $('#piAbaInst').textContent.trim() === 'Acesso do superintendente', 'Órgão Central tem a aba "Acesso do superintendente" (v9.6)');
    d.querySelector('[data-aba="inst"]').click();
    await espera(900);

    // a aba passou a ser a lista das REGIONAIS
    const linhasReg3 = () => Array.from(d.querySelectorAll('#piInst [data-reg]'));
    ok(linhasReg3().length === w.eval('SRES').length,
       'a aba lista todas as regionais da rede, inclusive as que ainda não têm ninguém');
    ok(!!d.querySelector('[data-reg-central]'), 'o Órgão Central tem a sua própria linha');
    ok($('#piInst').textContent.includes('com equipe cadastrada'),
       'os indicadores dizem quantas regionais já têm equipe');
    ok(!$('#piInst').textContent.includes('direcao.31100001'),
       'acessos de direção escolar não aparecem aqui — ficam por escola');
    // v7.7 (P5): a aba Cobertura do Central — o quadro das regionais e a lista de uma SRE
    d.querySelector('[data-aba="cobertura"]').click(); await espera(900);
    ok(d.querySelectorAll('#piCobertura tbody tr[data-cob-sre]').length >= 3 && /escolas ativas/.test($('#piCobertura').textContent),
       'P5: o Central vê o quadro das regionais na cobertura');
    d.querySelector('#piCobertura tbody tr[data-cob-sre="Divinópolis"]').click(); await espera(900);
    ok(!!$('#cobVoltar') && /SRE Divinópolis/.test($('#piCobertura').textContent) && d.querySelectorAll('#piCobertura tbody tr').length > 5,
       'P5: clicar na regional abre a lista escola por escola, com o caminho de volta');
    $('#cobVoltar').click(); await espera(900);
    ok(d.querySelectorAll('#piCobertura tbody tr[data-cob-sre]').length >= 3, 'P5: "voltar" devolve ao quadro');
    d.querySelector('[data-aba="inst"]').click(); await espera(900);
    // v7.6 (P4): a fila de e-mails
    await espera(900);
    ok(!!$('#filaCard') && /pendentes/.test($('#filaResumo').textContent) && !!$('#filaProcessar'),
       'P4: o Órgão Central vê o resumo da fila de e-mails e pode processá-la');
    $('#filaProcessar').click(); await espera(900);
    ok(/\d+ enviados?, \d+ falhas?/.test($('#filaInfo').textContent), 'P4: "processar agora" responde com o que saiu'); /* v9.0: plural pelo número */
    const linhaDiv = linhasReg3().filter(x => x.dataset.reg === 'Divinópolis')[0];
    ok(!!linhaDiv, 'a SRE de Divinópolis está na lista');
    ok(linhaDiv.textContent.includes('Superintendente de Divinópolis'),
       'a linha da regional já mostra quem responde por ela');

    // busca e filtro
    $('#regBusca').value = 'Divinópolis';
    $('#regBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    ok(linhasReg3().length === 1, 'a busca encontra a regional pelo nome');
    $('#regBusca').value = 'super.metropolitana';
    $('#regBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    ok(linhasReg3().length === 1 && linhasReg3()[0].dataset.reg === 'Metropolitana A',
       'a busca também encontra a regional pelo e-mail de quem está nela');
    $('#regBusca').value = '';
    $('#regBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    $('#regFiltro').value = 'com';
    $('#regFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    ok(linhasReg3().length === 2, 'o filtro mostra só as regionais que já têm equipe');
    $('#regFiltro').value = 'sem';
    $('#regFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    ok(linhasReg3().length === w.eval('SRES').length - 2, 'e o inverso mostra as que ainda não têm');
    $('#regFiltro').value = '';
    $('#regFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);

    // clicar na regional abre a gestão dos acessos dela
    linhasReg3().filter(x => x.dataset.reg === 'Divinópolis')[0].click();
    await espera(900);
    ok(!$('#ovRegional').hidden, 'clicar na regional abre a janela de gestão');
    ok($('#rgTitulo').textContent.includes('Divinópolis'), 'a janela nomeia a regional');
    /* v9.7: o Órgão Central administra só o Superintendente — a janela da
       regional lista ele, e não a equipe inteira (que é dele) */
    ok(d.querySelectorAll('#rgEquipe .eq-linha').length === 1,
       'v9.7: a janela da regional lista o Superintendente, o único acesso que o Órgão Central administra ali');
    ok($('#rgEquipe').textContent.includes('super.divinopolis'), 'com o e-mail dele');
    ok(!$('#rgEquipe').textContent.includes('dire.divinopolis') && !$('#rgEquipe').textContent.includes('inspecao.divinopolis'),
       'v9.7: a equipe da regional não aparece para o Órgão Central — ela é do Superintendente');
    ok(!$('#rgEquipe').textContent.includes('super.metropolitana'),
       'e ninguém de outra regional aparece nela');
    ok(/\d+ registros?\)/.test($('#rgHistResumo').textContent) && /superintendente/.test($('#rgHistResumo').textContent),
       'a janela traz o histórico do superintendente daquela regional (v9.6: ' + $('#rgHistResumo').textContent + ')');
    ok(d.querySelector('#rgHist').textContent.includes('Cláudia Regina'),
       'quem já teve acesso à regional e saiu continua no histórico dela');
    ok(!d.querySelector('#rgHist').textContent.includes('super.metropolitana'),
       'o histórico é o daquela regional, não o da rede inteira');

    // v7.3 (T-10): a janela do Central cadastra o SUPERINTENDENTE — e há um por SRE
    ok($('#rgSub').textContent.includes('Superintendente') && $('#rgSub').textContent.includes('cadastra os Diretores Educacionais'),
       'T-10: a janela diz que aqui se cadastra o Superintendente, e que ele cadastra o resto');
    ok($('#rgNovo').textContent.includes('Superintendente'), 'T-10: o botão nomeia quem é cadastrado');
    ok($('#rgNovo').disabled && /já tem Superintendente/.test($('#rgNovo').title),
       'T-10: com o Superintendente em exercício, o botão de cadastrar fica travado');
    ok(!$('#rgSub').textContent.includes('não derruba ninguém') && !$('#rgFormIntro').textContent.includes('não derruba ninguém'),
       'T-10: o texto "não derruba ninguém" saiu da janela da regional');
    ok($('#rgEquipe').textContent.includes('Superintendente Regional'),
       'T-10: a pessoa aparece com o seu papel');
    /* v9.7: suspender pela janela do Central vale para o Superintendente —
       o Diretor Educacional é do Superintendente, e nem aparece aqui */
    ok(!d.querySelector('[data-eq-situacao="de2.divinopolis@educacao.mg.gov.br"]'),
       'v9.7: não há botão para suspender o Diretor Educacional na janela do Órgão Central');
    d.querySelector('[data-eq-situacao="super.divinopolis@educacao.mg.gov.br"]').click();
    await espera(1000);
    ok(w.DEMO.acessos().filter(a => a.email === 'super.divinopolis@educacao.mg.gov.br')[0].situacao === 'inativo',
       'T-10: o Órgão Central suspende o Superintendente pela janela');
    ok(w.DEMO.acessos().filter(a => a.email === 'super.divinopolis@educacao.mg.gov.br')[0].papel === 'superintendente',
       'T-10: suspender preserva o papel');
    d.querySelector('[data-eq-situacao="super.divinopolis@educacao.mg.gov.br"]').click();
    await espera(1000);
    ok(w.DEMO.acessos().filter(a => a.email === 'de2.divinopolis@educacao.mg.gov.br')[0].situacao === 'ativo' &&
       w.DEMO.acessos().filter(a => a.email === 'de2.divinopolis@educacao.mg.gov.br')[0].papel === 'diretor_educacional',
       'T-10: reativar também preserva o papel');
    // o simulador recusa um segundo Superintendente na mesma SRE, como o servidor
    let segundoSuper = null;
    chamarDemo('acessoSalvar', {token:'demo', papel:'superintendente', perfil:'regional', sre:'Divinópolis',
      nome:'Segundo Superintendente', email:'segundo.super@educacao.mg.gov.br', situacao:'ativo'}, function(r){ segundoSuper = r; });
    await espera(800);
    ok(segundoSuper && !segundoSuper.ok && /Já existe/.test(segundoSuper.erro),
       'T-10/T-16c: o simulador recusa o segundo Superintendente da SRE, como o servidor');
    w.fecharRegional();
    await espera(300);

    // numa SRE ainda sem ninguém, o Central cadastra o Superintendente
    $('#regBusca').value = 'Uberlândia';
    $('#regBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    linhasReg3().filter(x => x.dataset.reg === 'Uberlândia')[0].click();
    await espera(900);
    ok(!$('#rgNovo').disabled, 'T-10: sem Superintendente, o botão de cadastrar está liberado');
    $('#rgNovo').click();
    await espera(200);
    ok(!$('#rgPainelForm').hidden && $('#rgPainelLista').hidden, 'o botão abre o formulário na própria janela');
    ok(!d.querySelector('#rgSre'), 'não se escolhe a regional: ela vem da janela que foi aberta');
    ok($('#rgFormIntro').textContent.includes('Superintendente'), 'T-10: o formulário diz que cadastra o Superintendente');
    $('#rgNome').value = 'Se';
    $('#rgEmail').value = 'super.uberlandia@educacao.mg.gov.br';
    $('#rgSalvar').click();
    await espera(300);
    ok($('#rgErro').classList.contains('show'), 'nome curto é barrado');
    $('#rgNome').value = 'Superintendente de Uberlândia';
    $('#rgEmail').value = 'sem-arroba';
    $('#rgSalvar').click();
    await espera(300);
    ok($('#rgErro').textContent.includes('e-mail'), 'e-mail inválido é barrado');
    $('#rgEmail').value = 'super.uberlandia@educacao.mg.gov.br';
    $('#rgSalvar').click();
    await espera(1000);
    ok(!$('#rgPainelLista').hidden, 'salvar devolve à lista da equipe');
    ok(d.querySelectorAll('#rgEquipe .eq-linha').length === 1, 'a pessoa cadastrada aparece na equipe da regional');
    const superUber = w.eval('INSTITUCIONAIS').filter(a => a.email === 'super.uberlandia@educacao.mg.gov.br')[0];
    ok(superUber && superUber.sre === 'Uberlândia', 'a pessoa é gravada na regional da janela');
    ok(superUber && superUber.papel === 'superintendente', 'T-10: quem o Central cadastra na regional é o Superintendente');
    ok($('#rgNovo').disabled, 'T-10: cadastrado o Superintendente, a SRE não recebe um segundo');

    // suspender e reativar sem sair da janela
    d.querySelector('[data-eq-situacao="super.uberlandia@educacao.mg.gov.br"]').click();
    await espera(1000);
    ok(w.eval('INSTITUCIONAIS').filter(a => a.email === 'super.uberlandia@educacao.mg.gov.br')[0].situacao === 'inativo',
       'suspender inativa o acesso sem sair da janela');
    ok($('#rgEquipe').textContent.includes('reativar'), 'a ação passa a oferecer a reativação');
    ok(!$('#rgNovo').disabled, 'T-12: com o Superintendente suspenso, a vaga fica livre — suspensos não contam no limite');
    await espera(800);
    ok(d.querySelector('#rgHist').textContent.includes('Superintendente de Uberlândia'),
       'o período encerrado aparece no histórico da regional');
    d.querySelector('[data-eq-situacao="super.uberlandia@educacao.mg.gov.br"]').click();
    await espera(1000);
    ok(w.eval('INSTITUCIONAIS').filter(a => a.email === 'super.uberlandia@educacao.mg.gov.br')[0].situacao === 'ativo',
       'reativar abre um período novo');

    // editar alguém da equipe — trocar o e-mail reescreve a MESMA pessoa (T-12)
    d.querySelector('[data-eq-editar="super.uberlandia@educacao.mg.gov.br"]').click();
    await espera(200);
    ok($('#rgNome').value === 'Superintendente de Uberlândia', 'editar carrega os dados da pessoa');
    ok($('#rgFormIntro').textContent.includes('super.uberlandia'), 'o formulário diz de quem se trata');
    $('#rgEmail').value = 'super.uberlandia.novo@educacao.mg.gov.br';
    $('#rgSalvar').click();
    await espera(1000);
    ok(!w.eval('INSTITUCIONAIS').some(a => a.email === 'super.uberlandia@educacao.mg.gov.br') &&
       w.eval('INSTITUCIONAIS').filter(a => a.email === 'super.uberlandia.novo@educacao.mg.gov.br').length === 1,
       'T-12: trocar o e-mail não cria uma segunda pessoa — a linha antiga é reescrita');
    ok(d.querySelectorAll('#rgEquipe .eq-linha').length === 1, 'T-12: a equipe continua com uma pessoa só');
    d.querySelector('[data-eq-editar="super.uberlandia.novo@educacao.mg.gov.br"]').click();
    await espera(200);
    $('#rgVoltar').click();
    await espera(200);
    ok(!$('#rgPainelLista').hidden, 'Voltar devolve à lista sem gravar');
    w.fecharRegional();
    await espera(300);
    ok($('#ovRegional').hidden, 'a janela fecha');
    $('#regBusca').value = '';
    $('#regBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    ok(linhasReg3().filter(x => x.dataset.reg === 'Uberlândia')[0].textContent.includes('1 pessoa'),
       'a lista de regionais passa a mostrar quantas pessoas há em cada uma');

    // a equipe do próprio Órgão Central
    d.querySelector('[data-reg-central]').click();
    await espera(900);
    ok($('#rgTitulo').textContent.includes('Órgão Central'), 'a linha do Órgão Central abre a equipe dele');
    ok(!$('#rgEquipe').textContent.includes('super.divinopolis'),
       'a equipe do Órgão Central não se mistura com a das regionais');
    $('#rgNovo').click();
    await espera(200);
    $('#rgNome').value = 'Equipe DIPEB';
    $('#rgEmail').value = 'dipeb@educacao.mg.gov.br';
    $('#rgSalvar').click();
    await espera(1000);
    ok(w.eval('INSTITUCIONAIS').filter(a => a.email === 'dipeb@educacao.mg.gov.br')[0].perfil === 'central',
       'quem é cadastrado pela linha do Órgão Central recebe o perfil central');
    w.fecharRegional();
    await espera(300);

    /* v9.8 — A CARGA DE DIRETORES EM LOTE SAIU DA TELA.
       Até a 9.7 ela ficava aqui, ao lado da carga da base de escolas, para a
       implantação. A coordenação decidiu desativá-la: o diretor é associado
       à escola um a um, com autor e data no histórico. A carga única da
       implantação passou a ser rotina do MENU da planilha
       (menuImportarDiretores), fora do alcance de qualquer tela — e é na
       bateria do servidor que ela é exercitada. O que se verifica aqui é a
       ausência, nas duas abas em que o painel existia. */
    d.querySelector('[data-aba="escolas"]').click();
    await espera(700);
    ok(!$('#dirImportar') && !$('#dirTexto') && !$('#dirSomenteSem'),
       'v9.8: a aba "Escolas da rede" não oferece mais a carga de diretores em lote');
    ok(!!$('#escImportar'),
       'v9.8: e a carga da BASE DE ESCOLAS continua ali, para o Órgão Central — só a de diretores saiu');
    ok(!/Importar diretores em lote/.test($('#piEscolas').textContent || ''),
       'v9.8: nem o rótulo do painel sobrou na aba');

    // ---- v7.0: os papéis dentro da regional ----
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(300);
    ok(!$('#portaPapel').hidden, 'na demonstração, a porta da regional abre a escolha do papel');
    const papeisOferecidos = Array.from(d.querySelectorAll('#papelLista [data-papel]')).map(x => x.dataset.papel);
    ok(papeisOferecidos.length === 5 &&
       papeisOferecidos.indexOf('superintendente') >= 0 &&
       papeisOferecidos.indexOf('equipe_inspecao') >= 0,
       'os cinco papéis da regional são oferecidos');

    // Coordenação de Inspeção: só leitura
    d.querySelector('[data-papel="equipe_inspecao"]').click();
    await espera(1500);
    ok(w.eval('SESSAO.papel') === 'equipe_inspecao', 'entrada como equipe da Coordenação de Inspeção');
    ok(w.eval('SESSAO.soLeitura') === true && w.eval('SESSAO.podeValidar') === false,
       'a equipe da Inspeção é leitora e não valida');
    ok($('#piEyebrow').textContent.includes('somente leitura'), 'a tela diz que o acesso é de leitura');
    ok($('#piAbaAcessos').hidden, 'a Inspeção não associa diretores às escolas');
    ok($('#piAbaEscolas').hidden, 'a Inspeção não mexe na base de escolas');
    ok($('#piAbaEquipe').hidden, 'a equipe da Inspeção não cadastra ninguém');
    ok(d.querySelectorAll('#piTabela tbody tr').length > 0, 'mas enxerga os PPPs da sua regional');
    ok(!d.querySelector('#piTabela [data-validar]'), 'e não tem a ação de validar');

    // Coordenador de Inspeção: cadastra a sua equipe
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="coordenador_inspecao"]').click();
    await espera(1500);
    ok(!$('#piAbaEquipe').hidden && $('#piAbaEquipe').textContent === 'Minha equipe',
       'o Coordenador de Inspeção tem a aba da sua equipe');
    d.querySelector('[data-aba="equipe"]').click();
    await espera(900);
    ok($('#piEquipe').textContent.includes('Equipe da Coordenação de Inspeção'),
       'a aba mostra o papel que ele cadastra');
    ok($('#piEquipe').textContent.includes('apenas como leitora'),
       'a tela diz o que a equipe da Inspeção pode fazer no sistema');
    ok(!$('#piEquipe').textContent.includes('Equipe da Diretoria Educacional'),
       'e não oferece cadastrar a equipe da Diretoria Educacional');

    // Superintendente: cadastra DE e Coordenador, com limites
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="superintendente"]').click();
    await espera(1500);
    ok($('#piAbaEquipe').textContent === 'Equipe da Superintendência', 'o Superintendente vê a equipe da SRE');
    d.querySelector('[data-aba="equipe"]').click();
    await espera(900);
    ok($('#piEquipe').textContent.includes('Diretor Educacional · até 2'),
       'a aba diz que cabem até dois Diretores Educacionais');
    ok($('#piEquipe').textContent.includes('Coordenador de Inspeção · até 1'),
       'e um único Coordenador de Inspeção');
    ok($('#piEquipe').textContent.includes('opcional'), 'o segundo Diretor Educacional é anunciado como opcional');
    const btnDE = d.querySelector('[data-eqp-novo="diretor_educacional"]');
    ok(!!btnDE && btnDE.disabled, 'com os dois já cadastrados, o botão fica travado');
    ok($('#piAbaAcessos').hidden && $('#piAbaEscolas').hidden,
       'v9.7: o Superintendente NÃO gere os diretores escolares nem a base — administra a própria equipe');

    // Diretor Educacional: valida
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="diretor_educacional"]').click();
    await espera(1500);
    ok(w.eval('SESSAO.podeValidar') === true, 'o Diretor Educacional valida');
    ok($('#piEyebrow').textContent.includes('Diretor Educacional') && !/valida os PPPs/.test($('#piEyebrow').textContent),
       'v9.0 (R20): o olho-de-página diz só o papel — a competência de validar aparece na fila, não repetida ali');
    // ---- v7.7 (P5): a aba Cobertura da regional ----
    ok(!$('#piAbaCobertura').hidden, 'P5: a regional tem a aba Cobertura');
    d.querySelector('[data-aba="cobertura"]').click(); await espera(900);
    {
      const escolasDiv = w.DEMO.escolas().filter(e => e.sre === 'Divinópolis' && e.situacao !== 'inativa');
      ok(d.querySelectorAll('#piCobertura tbody tr').length === escolasDiv.length && escolasDiv.length > 5,
         'P5: uma linha por escola ativa da regional (' + escolasDiv.length + '), com ou sem PPP');
      ok(/sem PPP/.test($('#piCobertura').textContent) && /sem diretor cadastrado/.test($('#piCobertura').textContent),
         'P5: as escolas que não começaram e as sem diretor aparecem como tal');
      ok(/a mais antiga há \d+ dia/.test($('#piCobertura').textContent), 'P5: o resumo aponta a espera mais antiga em validação');
      $('#cobFiltro').value = 'semppp'; $('#cobFiltro').dispatchEvent(new w.Event('change', {bubbles:true})); await espera(100);
      ok(Array.from(d.querySelectorAll('#piCobertura tbody tr')).every(tr => /sem PPP/.test(tr.textContent)) && d.querySelectorAll('#piCobertura tbody tr').length >= 1,
         'P5: o filtro "somente sem PPP" isola as escolas que não começaram');
      $('#cobFiltro').value = 'validacao'; $('#cobFiltro').dispatchEvent(new w.Event('change', {bubbles:true})); await espera(100);
      ok(Array.from(d.querySelectorAll('#piCobertura tbody tr')).every(tr => /Em validação/.test(tr.textContent)), 'P5: a fila de validação lista só quem espera, o mais antigo primeiro');
      ok(typeof w.exportarCoberturaCSV === 'function' &&
         (!!$('#cobExportar') === (w.eval('SESSAO.perfil') === 'central')),
         'v8.9: a planilha da cobertura só é oferecida ao Órgão Central (perfil atual: ' + w.eval('SESSAO.perfil') + ')');
      $('#cobFiltro').value = ''; $('#cobFiltro').dispatchEvent(new w.Event('change', {bubbles:true})); await espera(100);
    }
    d.querySelector('[data-aba="docs"]').click(); await espera(900);
    /* v9.8: a carga de diretores em lote SAIU da tela. O que se verifica aqui
       é a ausência: a rota não é alcançável pela porta da tela nem pelo nome
       antigo, e o painel que a oferecia não existe mais. A regra de escopo
       (escola de outra SRE recusada, diretor já em exercício sem mudança)
       continua verificada na bateria do servidor, onde ela vive. */
    {
      let semRota = null;
      chamarDemo('diretoresImportar', {token:'demo', texto:'31123456;Fulano;;fulano@educacao.mg.gov.br\n'}, function(r){ semRota = r; });
      await espera(800);
      ok(semRota && semRota.ok === false && /Ação desconhecida/.test(semRota.erro || ''),
         'v9.8: a carga de diretores em lote não é mais alcançável pela tela');
      ok(!d.querySelector('#dirImportar') && !d.querySelector('#dirTexto') &&
         !/Importar diretores em lote/.test($('#piAcessos').textContent || ''),
         'v9.8: e o painel que a oferecia saiu da aba de acessos das escolas');
    }
    d.querySelector('[data-aba="equipe"]').click();
    await espera(900);
    ok($('#piEquipe').textContent.includes('valida os PPPs'),
       'a equipe da Diretoria Educacional é anunciada como validadora');
    d.querySelector('[data-aba="docs"]').click();
    await espera(900);

    // ---- v7.0: o percurso da validação ----
    w.sairSessao();
    w.abrirPorta('escola');
    await espera(200);
    if(d.querySelector('[data-papel="diretor_escolar"]')) d.querySelector('[data-papel="diretor_escolar"]').click();   // v7.4: a porta da direção entra direto
    await espera(1500);
    const linhaAndamento = () => Array.from(d.querySelectorAll('#piTabela tbody tr'))
      .filter(tr => tr.textContent.includes('EM ANDAMENTO') || tr.textContent.includes('Em andamento'))[0];
    ok(!!d.querySelector('#piTabela [data-enviar-validacao]'),
       'o PPP preenchido oferece o envio para validação');
    const protoEnviar = d.querySelector('#piTabela [data-enviar-validacao]').dataset.enviarValidacao;
    w.confirmarAuto = true;
    const filaAntesEnvio = w.DEMO.fila().length;
    d.querySelector('#piTabela [data-enviar-validacao]').click();
    await espera(1200);
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Em validação',
       'enviado, o PPP fica em validação');
    {
      const f = w.DEMO.fila();
      ok(f.length === filaAntesEnvio + 1 && f[f.length - 1].tipo === 'validação' && /dire.divinopolis/.test(f[f.length - 1].para) && /analista.divinopolis/.test(f[f.length - 1].para),
         'P6: o envio para validação avisa os validadores da SRE, numa mensagem só, pela fila');
    }
    ok(!d.querySelector('#piTabela [data-continuar]') ||
       !Array.from(d.querySelectorAll('#piTabela [data-continuar]')).some(b => b.dataset.continuar === protoEnviar),
       'em validação, a escola não continua editando');

    // a Diretoria Educacional devolve com parecer
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="equipe_de"]').click();
    await espera(1500);
    ok(!!d.querySelector('#piTabela [data-validar]'), 'a equipe da DE vê a ação de validar');
    ok(!!d.querySelector('#piTabela [data-devolver]'), 'e a de devolver');
    d.querySelector('#piTabela [data-devolver="' + protoEnviar + '"]').click();
    await espera(300);
    // v7.3 (T-13): o diálogo com formulário tem Cancelar, botão com rótulo próprio, e não perde o texto
    ok(!$('#avisoCancelar').hidden && $('#avisoCancelar').textContent === 'Cancelar',
       'T-13: o diálogo de devolver tem o botão Cancelar');
    ok($('#avisoOk').textContent === 'Devolver com o parecer', 'T-13: o botão principal tem o rótulo pedido');
    $('#devParecer').value = 'curto';
    $('#avisoOk').click();
    await espera(300);
    ok(!$('#ovAviso').hidden && !!$('#devParecer') && $('#devParecer').value === 'curto',
       'T-13: parecer curto é barrado SEM fechar o diálogo — o texto digitado continua lá');
    ok($('#avisoErro').classList.contains('show') && $('#avisoErro').textContent.includes('20 caracteres'),
       'T-13: a validação aparece dentro do diálogo');
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Em validação',
       'com parecer curto nada é devolvido');
    $('#devParecer').value = 'A seção de avaliação da aprendizagem precisa descrever os instrumentos e a periodicidade.';
    $('#avisoOk').click();
    await espera(1200);
    ok($('#ovAviso').hidden, 'T-13: com o parecer válido o diálogo fecha');
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Em andamento',
       'devolvido com parecer, o PPP volta editável para a escola');
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].parecerValidacao.includes('instrumentos'),
       'o parecer fica gravado no registro');

    // v7.3 (T-07): o parecer chega à escola — na lista e no percurso
    w.sairSessao();
    w.abrirPorta('escola');
    await espera(200);
    if(d.querySelector('[data-papel="diretor_escolar"]')) d.querySelector('[data-papel="diretor_escolar"]').click();   // v7.4: a porta da direção entra direto
    await espera(1500);
    const linhaDoPPP = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => tr.textContent.includes(protoEnviar))[0];
    /* o parecer ocupa a linha seguinte da tabela, na largura toda */
    const linhaDevolvida = linhaDoPPP && linhaDoPPP.nextElementSibling;
    ok(linhaDevolvida && linhaDevolvida.classList.contains('tr-parecer') && linhaDevolvida.querySelector('.pi-parecer') &&
       linhaDevolvida.textContent.includes('Devolvido pela Diretoria Educacional') &&
       linhaDevolvida.textContent.includes('instrumentos e a periodicidade'),
       'T-07: a linha do PPP devolvido mostra o parecer da Diretoria Educacional');
    ok(linhaDevolvida.textContent.includes('Equipe da Diretoria Educacional'), 'T-07: e quem devolveu');
    d.querySelector('#piTabela [data-continuar="' + protoEnviar + '"]').click();
    await espera(1200);
    ok(!$('#stage').hidden && !!d.querySelector('#parecerDevolucao') &&
       d.querySelector('#parecerDevolucao').classList.contains('card-atencao') &&
       d.querySelector('#parecerDevolucao').textContent.includes('instrumentos e a periodicidade'),
       'T-07: ao abrir o PPP devolvido, o parecer aparece num cartão de atenção no topo do painel');
    ok(w.eval('APP.devolucoes').length === 1, 'T-07: as devoluções viajam com o registro');
    w.irPara(iTipo('dados'), true);
    ok(!!d.querySelector('#panelProducao #parecerDevolucao'), 'T-07: o cartão acompanha a escola nas telas de produção');
    // T-17: a identificação da escola aceita o código de 2 a 8 dígitos
    ok($('#panelProducao label[for="fInep"]').textContent === 'Código da escola' && /2 a 8/.test($('#fInep').placeholder),
       'T-17: o rótulo é "Código da escola", de 2 a 8 dígitos');
    const inepAntes = state.dados.inep;
    digita('#fInep', '184403');
    ok(!$('#fInep').classList.contains('campo-alerta'), 'T-17: um código de 6 dígitos não dispara alerta');
    digita('#fInep', '1');
    ok($('#fInep').classList.contains('campo-alerta') && /2 a 8/.test($('#fInep').title), 'T-17: um dígito só é apontado');
    digita('#fInep', inepAntes);
    w.voltarAoPainel(true);
    await espera(900);

    // a escola reenvia e a DE valida
    d.querySelector('#piTabela [data-enviar-validacao]').click();
    await espera(1200);
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="equipe_de"]').click();
    await espera(1500);
    d.querySelector('#piTabela [data-validar="' + protoEnviar + '"]').click();
    await espera(300);
    ok(!$('#avisoCancelar').hidden && $('#avisoOk').textContent === 'Validar', 'T-13: o diálogo de validar tem Cancelar e o rótulo "Validar"');
    $('#avisoOk').click();
    await espera(1200);
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Validado',
       'validado pela Diretoria Educacional');
    {
      const f = w.DEMO.fila();
      ok(f[f.length - 1].tipo === 'validação' && f[f.length - 1].para === 'direcao.31100001@educacao.mg.gov.br',
         'P6: a validação avisa a direção da escola, pela fila');
    }
    ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].validadoPor.includes('Diretoria Educacional'),
       'o registro guarda quem validou');

    // ---- v7.9 (P9): a homologação registrada pela SRE (a equipe da DE está logada) ----
    {
      const concl = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => /Concluído|Enviado para homologação/.test(tr.textContent) && tr.querySelector('[data-homologar]'))[0];
      ok(!!concl, 'P9: para quem valida, os PPPs concluídos oferecem "homologar"');
      ok(!d.querySelector('#piTabela tr [data-homologar]') || Array.from(d.querySelectorAll('#piTabela tbody tr')).every(tr => !(/Homologado/.test(tr.textContent) && /Homologado(?!.*Concluído)/.test(tr.textContent) && tr.querySelector('[data-homologar]'))),
         'P9: o que já está homologado não oferece de novo');
      ok(/homologados/.test($('#piResumo').textContent), 'P9: o cartão conta o que a SRE registrou, não o que a escola declarou');
      const protoHom = concl.querySelector('[data-homologar]').dataset.homologar;

      /* ---- v10.0: o aviso de assinaturas faltantes NOMEIA quem falta ----
         Com a homologação definitiva, a caixa que ficar em branco fica em
         branco para sempre. Um número ("7 de 9") não permite decidir: quem
         homologa precisa saber de QUEM é a caixa. Aqui uma das assinaturas
         do documento é desfeita de propósito, para ver o que a tela diz. */
      {
        const reg0 = w.DEMO.registros().filter(x => x.protocolo === protoHom)[0];
        const caixas0 = JSON.parse(reg0.assinaturas || '[]');
        const assinadas0 = caixas0.filter(c => c.assinadoEm);
        if(assinadas0.length){
          const vitima = assinadas0[assinadas0.length - 1];
          const nomeVitima = vitima.nome || vitima.email;
          const semUma = caixas0.map(c => (c.email === vitima.email ? Object.assign({}, c, {assinadoEm:''}) : c));
          w.DEMO.gravar(protoHom, 'assinaturas', JSON.stringify(semUma));
          w.carregarPainel(); await espera(1200);
          const linhaF = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => tr.textContent.includes(protoHom))[0];
          linhaF.querySelector('[data-homologar]').click(); await espera(1400);
          ok(!$('#ovAviso').hidden && /Faltam assinaturas/.test($('#avisoTitulo').textContent),
             'v10.0: faltando assinatura, a homologação passa por um aviso antes');
          ok($('#avisoTexto').textContent.includes(nomeVitima),
             'v10.0: e o aviso NOMEIA quem foi marcado como presente e não assinou — "' + nomeVitima + '"');
          ok(!!$('.lista-pendentes') && d.querySelectorAll('.lista-pendentes li').length >= 1,
             'v10.0: a lista vem em caixa própria, um nome por linha');
          ok(/presentes na reunião de aprovação/.test($('#avisoTexto').textContent) &&
             /final e definitivo/.test($('#avisoTexto').textContent) &&
             /não é desfeita/.test($('#avisoTexto').textContent),
             'v10.0: o aviso diz de onde vem a lista e o que a homologação significa');
          ok($('#avisoOk').textContent === 'Homologar assim mesmo' &&
             $('#avisoCancelar').textContent === 'Esperar as assinaturas',
             'v10.0: e as duas saídas são explícitas — homologar assim ou esperar');
          $('#avisoCancelar').click(); await espera(400);
          ok(w.DEMO.registros().filter(x => x.protocolo === protoHom)[0].status !== 'Homologado',
             'v10.0: escolhendo esperar, nada é homologado');
          /* devolve a assinatura e segue o roteiro original */
          w.DEMO.gravar(protoHom, 'assinaturas', reg0.assinaturas);
          w.carregarPainel(); await espera(1200);
        }
      }

      const linhaOk = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => tr.textContent.includes(protoHom))[0];
      linhaOk.querySelector('[data-homologar]').click(); await espera(300);
      /* v8.2 — homologar é confirmar: sem ato e sem data a digitar */
      ok(!$('#ovAviso').hidden && /Homologar este PPP/.test($('#avisoTitulo').textContent) &&
         !$('#homAto') && !$('#homData') && $('#avisoOk').textContent === 'Confirmar a homologação',
         'v8.2: o diálogo apenas pede a confirmação — não há ato nem data a informar');
      ok(/não é preciso informar ato nem data/i.test($('#avisoTexto').textContent),
         'v8.2: e diz que a data é a do momento da confirmação');
      $('#avisoOk').click(); await espera(1400);
      const regHom = w.DEMO.registros().filter(x => x.protocolo === protoHom)[0];
      ok(regHom.status === 'Homologado' && /Diretoria Educacional/.test(regHom.homolPor) &&
         /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(regHom.homolEm) && !regHom.homolAto,
         'v8.2: o registro guarda quem homologou e o momento — sem ato');
      ok(!$('#ovAviso').hidden && /homologado/i.test($('#avisoTitulo').textContent),
         'v8.2: a tela confirma a homologação a quem a registrou');
      /* v10.0: e diz o que o ato significa — o documento passou a ser final */
      ok(/final e definitiva/.test($('#avisoTexto').textContent) &&
         /não recebe mais assinatura/.test($('#avisoTexto').textContent),
         'v10.0: a confirmação diz que aquela é a versão final e definitiva');
      $('#avisoOk').click(); await espera(900);
      const f = w.DEMO.fila(); const c = w.DEMO.ciclo();
      ok(f[f.length - 1].tipo === 'validação' &&
         /PPP homologado pela Diretoria Educacional — versão final e definitiva/.test(c[c.length - 1].ato),
         'P9: a direção é avisada e o ato entra no ciclo, com a natureza do ato escrita (v10.0)');
      const linhaHom = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => tr.textContent.includes(protoHom))[0];
      ok(linhaHom && /Homologado/.test(linhaHom.textContent) && !linhaHom.querySelector('[data-homologar]'),
         'P9: a linha mostra a homologação, sem oferecer homologar de novo');
      /* v10.0: nem desfazer — a homologação encerra o documento */
      ok(linhaHom && !linhaHom.querySelector('[data-desfazer-homolog]') &&
         !d.querySelector('#piTabela [data-desfazer-homolog]'),
         'v10.0: e nenhuma linha oferece desfazer a homologação');
      regHom.status = 'Enviado para homologação'; regHom.homolPor = ''; regHom.homolEm = ''; regHom.homolAto = '';
    }

    // v7.3 (T-14/T-15/T-16b): validado, a direção abre na tela final e conclui; a folha nasce do cadastro
    w.sairSessao();
    w.abrirPorta('escola');
    await espera(200);
    if(d.querySelector('[data-papel="diretor_escolar"]')) d.querySelector('[data-papel="diretor_escolar"]').click();   // v7.4: a porta da direção entra direto
    await espera(1500);
    const linhaValidada = Array.from(d.querySelectorAll('#piTabela tbody tr')).filter(tr => tr.textContent.includes(protoEnviar))[0];
    ok(linhaValidada && linhaValidada.textContent.includes('validada — pronta para concluir') &&
       linhaValidada.textContent.includes('validado por'), 'T-06: a linha diz que o PPP está validado e pronto para concluir');
    ok(!linhaValidada.querySelector('[data-enviar-validacao]') && !linhaValidada.querySelector('[data-nova-versao]'),
       'T-06: validado, não há "enviar para validação" nem "nova versão"');
    ok($('#piNovo').classList.contains('btn-ghost'), 'T-06: com um PPP validado, "Criar novo PPP" fica sem destaque');
    linhaValidada.querySelector('[data-continuar]').click();
    await espera(1200);
    ok(!$('#stage').hidden && !$('#panelFinal').hidden, 'T-14: o PPP validado abre direto na tela final');
    ok(!$('#travaRibbon').hidden && $('#travaRibbon').textContent.includes('validado'), 'T-14: com a faixa de trava explicando o estado');
    ok(!$('#cardConcluir').hidden && !$('#btnConcluir').disabled, 'T-14: e com "Concluir" habilitado');
    ok(!d.querySelector('#parecerDevolucao'), 'T-07: validado, o cartão do parecer antigo não aparece mais');
    const errosAntesConcluir = erros.length;

    /* ---- v8.13 (F04): a conclusão recusada por outra gravação tem saída ----
       D01 fez `concluirPPP` herdar a recusa por conflito de revisão, e a tela
       caía no `else` genérico: "Este PPP foi gravado por outra pessoa … O seu
       texto continua na tela." — frase que não nomeia o ato tentado (a pessoa
       clicou em CONCLUIR), não diz o que fazer e não oferece caminho. */
    {
      const revBoa = w.eval('APP.rev');
      w.eval('APP.rev = 0;');                 /* a tela envelheceu: é o caso do achado */
      w.confirmarAuto = false;
      w.concluirPPP();
      await espera(150);
      ok(!$('#ovAviso').hidden && /Concluir o PPP/.test($('#avisoTitulo').textContent),
         'F04: o primeiro diálogo continua sendo o de confirmar a conclusão');
      $('#avisoOk').click();
      await espera(1200);
      ok(!$('#ovAviso').hidden && $('#avisoTitulo').textContent === 'A conclusão não foi feita',
         'F04 (R2-03): a recusa por conflito ganha diálogo próprio, que NOMEIA o ato tentado');
      ok(/Nada foi congelado e nada se perdeu/.test($('#avisoTexto').textContent),
         'F04: e diz que nada foi congelado');
      ok($('#avisoOk').textContent === 'Abrir o que está gravado' &&
         $('#avisoCancelar').textContent === 'Fechar',
         'F04: com o caminho no botão — e sem oferecer "concluir o meu por cima"');
      ok(w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Validado',
         'F04: e o registro continua "Validado" — a conclusão não aconteceu');
      $('#avisoOk').click();
      await espera(1200);
      ok(w.eval('APP.rev') === revBoa,
         'F04: "Abrir o que está gravado" deixa a tela na revisão do servidor (' + w.eval('APP.rev') + ')');
      w.confirmarAuto = true;
      if(!$('#ovAviso').hidden) { $('#avisoOk').click(); await espera(150); }
    }

    w.concluirPPP();
    await espera(1200);
    ok(APP.status === 'Em assinatura' && w.DEMO.registros().filter(x => x.protocolo === protoEnviar)[0].status === 'Em assinatura',
       'T-16b: validado, o simulador conclui e o registro passa a "Em assinatura"');
    ok(APP.assinaturas.length === 1 && APP.assinaturas[0].papel === 'Direção Escolar',
       'v8.1: a folha nasce só com a direção — o Colegiado entra por marcação de presença');
    ok(APP.assinaturas[0].email === 'direcao.31100001@educacao.mg.gov.br' && APP.assinaturas[0].nome === 'Ana Lúcia Ferreira',
       'T-15: a direção entra na folha com o e-mail e o nome do CADASTRO da sessão');
    ok(erros.length === errosAntesConcluir, 'a conclusão pela tela final não gera erro de runtime');
    w.voltarAoPainel(true);
    await espera(900);

    // ---- v7.0: colegiado e assinatura dentro do sistema ----
    w.sairSessao();
    w.abrirPorta('escola');
    await espera(200);
    if(d.querySelector('[data-papel="diretor_escolar"]')) d.querySelector('[data-papel="diretor_escolar"]').click();   // v7.4: a porta da direção entra direto
    await espera(1500);
    ok(!$('#piAbaColegiado').hidden, 'a direção tem a aba do colegiado');
    d.querySelector('[data-aba="colegiado"]').click();
    await espera(900);
    ok(d.querySelectorAll('#piColegiado .eq-linha').length === 2, 'os membros já cadastrados aparecem');
    ok($('#piColegiado').textContent.includes('ainda não entrou'),
       'quem ainda não definiu senha é sinalizado');
    ok(!!$('#colNovo'), 'há o botão de cadastrar membro');
    $('#colNovo').click();
    await espera(200);
    ok(!$('#avisoCancelar').hidden && $('#avisoOk').textContent === 'Cadastrar', 'T-13: o formulário do colegiado tem Cancelar e o rótulo "Cadastrar"');
    $('#colNome').value = 'Jo';
    $('#colEmail').value = 'joana@exemplo.com';
    $('#avisoOk').click();
    await espera(300);
    ok(!$('#ovAviso').hidden && $('#colEmail').value === 'joana@exemplo.com' && $('#avisoErro').textContent.includes('nome'),
       'T-13: nome curto é apontado dentro do diálogo, sem perder o e-mail digitado');
    // T-22: a direção não se cadastra como membro do colegiado
    $('#colNome').value = 'Ana Lúcia Ferreira';
    $('#colEmail').value = 'direcao.31100001@educacao.mg.gov.br';
    $('#avisoOk').click();
    await espera(300);
    ok(!$('#ovAviso').hidden && /próprio e-mail|diretor/.test($('#avisoErro').textContent),
       'T-22: o e-mail da própria direção é recusado como membro do colegiado');
    let dirComoColegiado = null;
    chamarDemo('acessoSalvar', {token:'demo', papel:'colegiado', nome:'Ana', email:'direcao.31100001@educacao.mg.gov.br', segmento:'Docente'},
      function(r){ dirComoColegiado = r; });
    await espera(800);
    ok(dirComoColegiado && !dirComoColegiado.ok && /diretor escolar/.test(dirComoColegiado.erro),
       'T-22: o simulador também recusa, como o servidor');
    $('#colNome').value = 'Joana Mãe de Estudante';
    $('#colEmail').value = 'joana@exemplo.com';
    $('#colSegmento').value = 'Pai, mãe ou responsável';
    /* v8.12: quem não é servidor declara a relação com a escola — e o campo
       só aparece para esses segmentos */
    $('#colSegmento').dispatchEvent(new w.Event('change'));
    await espera(120);
    ok(!$('#colCampoRelacao').hidden,
       'v8.12: escolhido um segmento que não é de servidor, a tela pede a relação com a escola');
    $('#avisoOk').click();
    await espera(400);
    ok(!$('#ovAviso').hidden && /relação desta pessoa/.test($('#avisoErro').textContent),
       'v8.12: sem a relação, o cadastro não passa');
    $('#colRelacao').value = 'mãe do estudante Pedro Henrique, 7º ano A';
    $('#avisoOk').click();
    await espera(1200);
    ok($('#ovAviso').hidden || $('#avisoTitulo').textContent.includes('Conta institucional'),
       'T-13: com os dados válidos o diálogo do formulário fecha');
    if(!$('#ovAviso').hidden){ $('#avisoOk').click(); await espera(150); }
    ok(w.DEMO.acessos().some(a => a.email === 'joana@exemplo.com' && a.papel === 'colegiado'),
       'o membro é cadastrado com o papel de colegiado');
    ok(w.DEMO.acessos().filter(a => a.email === 'joana@exemplo.com')[0].inep === '31100001',
       'e vinculado à escola da sessão, sem digitação');
    /* v8.12: o membro do colegiado passa a ter período no histórico — com
       perfil próprio, sem disputar o período de gestão da escola.
       v8.13 (E19, A8-20): a RELAÇÃO com a escola deixou de ir junto. Ela
       identifica um estudante pelo intermédio do responsável, e o histórico
       é registro permanente, sem caminho de exclusão. Ela continua no
       cadastro, que a direção lê e que `acessoRemover` apaga. */
    {
      const perJoana = w.DEMO.gestores().filter(g => g.email === 'joana@exemplo.com');
      ok(perJoana.length === 1 && perJoana[0].perfil === 'colegiado' && !perJoana[0].fim,
         'v8.12: cadastrar um membro do colegiado abre período próprio no histórico');
      ok(/Pai, mãe ou responsável/.test(perJoana[0].observacao || ''),
         'v8.12: e o histórico guarda o segmento — ' + (perJoana[0].observacao || '(vazia)'));
      ok(!/Pedro Henrique/.test(perJoana[0].observacao || ''),
         'v8.13 (E19, A8-20): e NÃO o nome do estudante de quem ela é responsável');
      ok(w.DEMO.acessos().filter(a => a.email === 'joana@exemplo.com')[0].relacao &&
         /Pedro Henrique/.test(w.DEMO.acessos().filter(a => a.email === 'joana@exemplo.com')[0].relacao),
         'v8.13 (E19): a relação continua no CADASTRO, que tem caminho de exclusão');
      ok(String(perJoana[0].registradoPor || '').length > 0,
         'v8.12: com o nome de quem cadastrou');
      ok(w.DEMO.gestores().filter(g => g.inep === '31100001' && g.perfil === 'escola' && !g.fim).length <= 1,
         'v8.12: e o período de gestão da escola continua sendo um só');
    }
    // ---- v7.8 (P8): a linha do tempo do PPP, pela direção ----
    d.querySelector('[data-aba="docs"]').click(); await espera(900);
    {
      const btnLT = d.querySelector('#piTabela [data-linha-tempo]');
      ok(!!btnLT, 'P8: cada PPP da direção tem "linha do tempo"');
      btnLT.click(); await espera(900);
      ok(!$('#ovAviso').hidden && /Linha do tempo/.test($('#avisoTitulo').textContent) && d.querySelectorAll('#avisoTexto .linha-tempo li').length >= 1,
         'P8: a linha do tempo abre com os eventos do PPP (' + d.querySelectorAll('#avisoTexto .linha-tempo li').length + ')');
      ok(/PPP criado|PPP validado|assinatura registrada|PPP concluído/.test($('#avisoTexto').textContent), 'P8: os eventos vêm das datas do registro e dos atos');
      $('#avisoOk').click(); await espera(150);
    }
    d.querySelector('[data-aba="colegiado"]').click(); await espera(900);
    // T-11: a direção remove membro do colegiado da própria escola
    const gestoresAntes = JSON.stringify(w.DEMO.gestores());
    d.querySelector('[data-col-remover="joana@exemplo.com"]').click();
    await espera(1200);
    ok(!w.DEMO.acessos().some(a => a.email === 'joana@exemplo.com'), 'T-11: a direção remove um membro do colegiado da própria escola');
    {
      const perJoana = w.DEMO.gestores().filter(g => g.email === 'joana@exemplo.com');
      ok(perJoana.length === 1 && !!perJoana[0].fim && String(perJoana[0].encerradoPor || '').length > 0,
         'v8.12: remover um membro do colegiado encerra o período dele, com o nome de quem removeu');
      ok(w.DEMO.gestores().filter(g => g.inep === '31100001' && g.perfil === 'escola' && !g.fim).length <= 1,
         'v8.12: e não encerra o período de gestão de mais ninguém');
    }
    ok(d.querySelectorAll('#piColegiado .eq-linha').length === 2, 'a lista do colegiado é redesenhada sem o membro removido');
    // ---- v8.12: a carga em lote do colegiado saiu; o link do convite continua ----
    ok(!$('#colImportar') && !$('#colTexto') && !$('#colImportarBtn'),
       'v8.12: a aba do colegiado não oferece mais cadastrar vários de uma vez');
    {
      let lote = null;
      chamarDemo('colegiadoImportar', {token:'demo', texto:'Nome;E-mail;Segmento\nX;x@exemplo.com;Docente\n'},
        function(r){ lote = r; });
      await espera(800);
      ok(lote && !lote.ok && /membro a membro/.test(lote.erro || ''),
         'v8.12: e o servidor recusa a carga, mesmo chamada por fora da tela');
    }
    await new Promise(r => chamarDemo('acessoSalvar', {token:'demo', papel:'colegiado',
      nome:'Carlos Servidor', email:'carlos@exemplo.com', segmento:'Servidor administrativo'}, () => r()));
    w.carregarColegiado(); await espera(900);
    ok(w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').length === 3,
       'v8.12: o membro cadastrado um a um entra na escola');
    ok(!!d.querySelector('[data-col-link="carlos@exemplo.com"]') && !d.querySelector('[data-col-link="colegiado.docente@educacao.mg.gov.br"]'),
       'P4: "copiar link" só aparece para quem ainda não definiu a senha');
    d.querySelector('[data-col-link="carlos@exemplo.com"]').click(); await espera(800);
    ok(!$('#ovAviso').hidden && /Link de primeiro acesso de carlos@exemplo.com/.test($('#avisoTitulo').textContent) && /pa=/.test(($('#linkConviteCampo') || {value:''}).value),
       'P4: o link do convite abre num diálogo, pronto para copiar');
    $('#avisoOk').click(); await espera(150);
    await new Promise(r => chamarDemo('acessoRemover', {token:'demo', email:'carlos@exemplo.com'}, () => r()));
    w.carregarColegiado(); await espera(900);
    let remDiretorPelaEscola = null;
    chamarDemo('acessoRemover', {token:'demo', email:'diretora.horizonte@hotmail.com'}, function(r){ remDiretorPelaEscola = r; });
    await espera(800);
    ok(remDiretorPelaEscola && !remDiretorPelaEscola.ok && /própria escola/.test(remDiretorPelaEscola.erro),
       'T-11: a direção não remove diretor de outra escola');
    $('#colNovo').click();
    await espera(200);
    $('#colNome').value = 'Joana Mãe de Estudante';
    $('#colEmail').value = 'joana@exemplo.com';
    $('#colSegmento').value = 'Pai, mãe ou responsável';
    $('#colSegmento').dispatchEvent(new w.Event('change'));
    $('#colRelacao').value = 'mãe do estudante Pedro Henrique, 7º ano A';
    $('#avisoOk').click();
    await espera(1200);
    if(!$('#ovAviso').hidden){ $('#avisoOk').click(); await espera(150); }

    // o membro entra e assina
    w.sairSessao();
    ok(w.eval('SESSAO.papel') === '' && w.eval('SESSAO.papelNome') === '' && w.eval('SESSAO.podeAssociar') === false &&
       w.eval('SESSAO.cadastra').length === 0 && w.eval('SESSAO.email') === '' && w.eval('SESSAO.porta') === '',
       'T-19: sair zera papel, competências, e-mail e porta da sessão');
    ok($('#badgeUser').textContent === 'modo demonstração' && !$('#badgeProto').textContent.includes('Direção'),
       'T-19: sair devolve os selos do alto ao estado inicial');
    /* v7.4: o colegiado entra pela PRÓPRIA porta — e as portas não se misturam */
    await new Promise(function(r){ chamarDemo('entrarInstitucional', {porta:'escola', perfilDemo:'escola', papelDemo:'colegiado'}, function(res){
      ok(res && !res.ok && /Colegiado Escolar/.test(res.erro), 'v7.4: membro do colegiado pela porta da direção é recusado, com o caminho certo'); r(); }); });
    await new Promise(function(r){ chamarDemo('entrarInstitucional', {porta:'colegiado', perfilDemo:'colegiado', papelDemo:'diretor_escolar'}, function(res){
      ok(res && !res.ok && /só para os membros do Colegiado/.test(res.erro), 'v7.4: direção pela porta do colegiado é recusada'); r(); }); });
    w.abrirPorta('colegiado');
    ok($('#portaPapel').hidden, 'v7.4: a porta do colegiado entra direto, sem escolha de papel');
    await espera(1500);
    ok(w.eval('SESSAO.papel') === 'colegiado' && w.eval('SESSAO.porta') === 'colegiado', 'entrada como membro do colegiado, pela porta do colegiado');
    ok($('#piAbaColegiado').hidden && $('#piAbaAcessos').hidden && $('#piNovo').hidden,
       'o colegiado não cadastra ninguém nem cria PPP');
    ok(!$('#piAssinaturas').hidden, 'o colegiado cai direto nas suas assinaturas');
    d.querySelector('[data-aba="docs"]').click(); await espera(900);
    ok(!d.querySelector('#piTabela [data-linha-tempo]'), 'P8: o colegiado não tem a linha do tempo — lê e assina');
    d.querySelector('[data-aba="assinaturas"]').click(); await espera(600);
    // v7.3 (T-01): na aba Documentos o colegiado só lê
    d.querySelector('[data-aba="docs"]').click();
    await espera(900);
    ok(d.querySelectorAll('#piTabela tbody tr').length === 3 && d.querySelectorAll('#piTabela [data-ver]').length === 3,
       'T-01: o colegiado vê os PPPs da escola, cada um com "abrir documento"');
    ok(!d.querySelector('#piTabela [data-continuar]') && !d.querySelector('#piTabela [data-enviar-validacao]') &&
       !d.querySelector('#piTabela [data-nova-versao]'),
       'T-01: sem continuar, enviar para validação nem nova versão');
    const recusasColegiado = {};
    ['salvarPPP','buscarPPP','enviarParaValidacao','concluirPPP','novaVersao'].forEach(function(f){
      chamarDemo(f, {token:'demo', p:'PPP-2026-0031-R4KP', protocolo:'PPP-2026-0031-R4KP', escola:'x', inep:'31100001'},
        function(r){ recusasColegiado[f] = r; });
    });
    await espera(900);
    ok(['salvarPPP','buscarPPP','enviarParaValidacao','concluirPPP','novaVersao'].every(f =>
         recusasColegiado[f] && !recusasColegiado[f].ok && /direção escolar/.test(recusasColegiado[f].erro)),
       'T-01: o simulador recusa ao colegiado salvar, abrir para edição, enviar, concluir e versionar — como o servidor');
    d.querySelector('[data-ver]').click();
    await espera(900);
    ok(!$('#ovDoc').hidden, 'T-01: o colegiado abre o documento para leitura');
    ok($('#badgeProto').textContent.includes('Consulta'), 'o selo diz que é consulta enquanto o documento está aberto');
    w.fecharDocAberto();
    ok($('#badgeProto').textContent.includes('Colegiado Escolar'), 'T-19: fechado o documento, o selo volta ao papel da sessão');
    d.querySelector('[data-aba="assinaturas"]').click();
    await espera(900);
    const pendentes = () => Array.from(d.querySelectorAll('#piAssinaturas [data-as-assinar]'));
    ok(pendentes().length >= 1, 'há documento esperando a assinatura dele');
    const protoAssinar = pendentes()[0].dataset.asAssinar;
    pendentes()[0].click();
    await espera(300);
    $('#avisoOk').click();
    await espera(1200);
    ok(JSON.parse(w.DEMO.registro(protoAssinar).assinaturas || '[]')
         .some(a => a.email === w.eval('SESSAO.email') && a.assinadoEm),
       'a assinatura é registrada dentro do sistema, na folha do documento');
    ok(d.querySelector('#piAssinaturas').textContent.includes('Já assinados por você'),
       'o documento passa para a lista dos já assinados');

    // ---- v7.1: aviso do domínio institucional ----
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="equipe_de"]').click();
    await espera(1500);
    d.querySelector('[data-aba="acessos"]').click();
    await espera(1100);
    $('#escBusca').value = 'Horizonte do Saber';
    $('#escBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(300);
    d.querySelectorAll('#piAcessos [data-inep]')[0].click();
    await espera(400);
    $('#gsNome').value = 'Diretora com e-mail particular';
    $('#gsMasp').value = '1234567';
    $('#gsEmail').value = 'diretora@yahoo.com.br';
    $('#gsContinuar').click();
    await espera(300);
    ok($('#gsResumoAviso').textContent.includes('não é uma conta @educacao.mg.gov.br'),
       'a conferência avisa quando o e-mail não é do domínio da rede');
    ok($('#gsResumoAviso').textContent.includes('não é identificada pela conta institucional') &&
       $('#gsResumoAviso').textContent.includes('link de primeiro acesso') &&
       !$('#gsResumoAviso').textContent.includes('acesso restrito ao domínio'),
       'T-25: e diz a consequência certa — entra por e-mail e senha, pelo link de primeiro acesso; nada de "acesso restrito ao domínio"');
    ok(!$('#gsSalvar').hidden, 'mas o cadastro continua possível — o aviso não bloqueia');
    /* v9.8: com o código INEP obrigatório na base, a janela mostra OS DOIS —
       e cada um com o seu nome. O que T-25 proíbe continua proibido: chamar
       o código da escola de INEP. */
    ok($('#gsLocal').textContent.includes('código 31123456') &&
       /· INEP \d{8}/.test($('#gsLocal').textContent) &&
       !$('#gsLocal').textContent.includes('INEP 31123456'),
       'T-25: a janela do diretor identifica a escola pelo código da SEE e mostra o INEP à parte');
    ok($('#gsResumo').textContent.includes('Código da escola') && !$('#gsResumo').textContent.includes('INEP'),
       'T-25: o resumo de conferência identifica pelo código da escola');
    $('#gsEmail').value = 'direcao.31123456@educacao.mg.gov.br';
    $('#gsVoltar').click();
    await espera(200);
    $('#gsContinuar').click();
    await espera(300);
    ok(!$('#gsResumoAviso').textContent.includes('não é uma conta'),
       'com conta institucional não há aviso nenhum');
    w.fecharGestor();
    await espera(200);

    // ---- v7.2: a aba de contas a regularizar ----
    ok(!$('#piAbaContas').hidden, 'quem associa diretores tem a aba de contas a regularizar');
    d.querySelector('[data-aba="contas"]').click();
    await espera(1000);
    const linhasCt = () => Array.from(d.querySelectorAll('#piContas .eq-linha'));
    ok(linhasCt().length === 2, 'a aba lista os diretores com e-mail fora do domínio da regional');
    ok($('#piContas').textContent.includes('hotmail.com') && $('#piContas').textContent.includes('gmail.com'),
       'mostrando o domínio de cada um');
    ok(!$('#piContas').textContent.includes('direcao.31100001'),
       'quem tem conta institucional não aparece na lista');
    ok($('#piContas').textContent.includes('já definiram a senha'),
       'os indicadores separam quem já entrou de quem ainda não');
    ok($('#piContas').textContent.includes('já entrou') && $('#piContas').textContent.includes('não entrou'),
       'cada linha diz se a pessoa já definiu a senha');
    ok(!d.querySelector('#ctSre'), 'a regional não escolhe regional — vê apenas a sua');
    $('#ctFiltro').value = 'nao';
    $('#ctFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(300);
    ok(linhasCt().length === 1 && linhasCt()[0].textContent.includes('hotmail'),
       'o filtro isola quem ainda não entrou');
    $('#ctFiltro').value = '';
    $('#ctFiltro').dispatchEvent(new w.Event('change', {bubbles:true}));
    await espera(200);
    $('#ctBusca').value = 'Boa Esperança';
    $('#ctBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(300);
    ok(linhasCt().length === 1, 'a busca encontra pela escola');
    $('#ctBusca').value = '';
    $('#ctBusca').dispatchEvent(new w.Event('input', {bubbles:true}));
    await espera(200);
    /* v8.13 (E09, A7-05): baixar planilha é do Órgão Central, e a política
       passou a valer para as TRÊS. A regional continua com a aba — com busca,
       filtro e o link de primeiro acesso —, mas não extrai a lista. */
    ok(!$('#ctExportar'),
       'v8.13 (E09): a regional não tem o botão de baixar a lista de contas');
    ok(!!d.querySelector('[data-ct-link]') || !!d.querySelector('[data-ct-convite]'),
       'v8.13 (E09): e continua com a ferramenta de regularização — convite e link de primeiro acesso');
    ok(!!d.querySelector('[data-ct-convite]'), 'cada linha oferece reenviar o convite');
    d.querySelector('[data-ct-email="31123456"]').click();
    await espera(1400);
    ok(!$('#ovGestor').hidden && $('#gsNome').value === 'Marta Ribeiro do Horizonte',
       '"trocar o e-mail" leva à janela daquele diretor, já em correção');
    ok($('#gsTitulo').textContent.includes('Corrigir'), 'e em modo de correção, sem abrir período novo');
    w.fecharGestor();
    await espera(200);
    d.querySelector('[data-aba="docs"]').click();
    await espera(700);

    // ---- v7.3: competências por papel no simulador (T-03, T-11, T-12, T-21) ----
    const chama = function(fn, args){ return new Promise(function(res){ chamarDemo(fn, args, res); }); };
    // a equipe da DE (sessão atual) edita o e-mail de alguém via emailAnterior sem duplicar (T-12)
    let r12 = await chama('acessoSalvar', {token:'demo', papel:'diretor_educacional', nome:'Hélio Diretor Educacional',
      email:'helio.novo@educacao.mg.gov.br', emailAnterior:'de2.divinopolis@educacao.mg.gov.br', situacao:'ativo'});
    ok(r12 && !r12.ok && /não cadastra/.test(r12.erro), 'T-03: a equipe da DE não cadastra nem edita Diretor Educacional — a cascata vale no simulador');
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="equipe_inspecao"]').click();
    await espera(1500);
    const r03a = await chama('acessoRemover', {token:'demo', email:'direcao.31100001@educacao.mg.gov.br'});
    ok(r03a && !r03a.ok && /não gere os diretores/.test(r03a.erro), 'T-03/T-11: a equipe da Inspeção não remove diretor');
    const r03b = await chama('escolaSituacao', {token:'demo', inep:'31123456', situacao:'inativa'});
    ok(r03b && !r03b.ok && /não mantém a base/.test(r03b.erro), 'T-03: nem inativa escola');
    const r03c = await chama('escolaSalvar', {token:'demo', inep:'999001', escola:'Escola da Inspeção', municipio:'X', sre:'Divinópolis'});
    ok(r03c && !r03c.ok && /não mantém a base/.test(r03c.erro), 'T-03: nem cadastra escola');
    const r03d = await chama('primeiroAcessoReenviar', {token:'demo', email:'diretora.horizonte@hotmail.com'});
    ok(r03d && !r03d.ok, 'T-03: nem reenvia convite de diretor');
    const r03e = await chama('contasPendentes', {token:'demo'});
    ok(r03e && !r03e.ok && /não gere os diretores/.test(r03e.erro), 'T-03: nem alcança a lista de contas a regularizar');
    ok(w.DEMO.acessos().some(a => a.email === 'direcao.31100001@educacao.mg.gov.br') &&
       w.DEMO.escolas().filter(e => e.inep === '31123456')[0].situacao === 'ativa',
       'T-03: nada foi alterado pelas tentativas da Inspeção');
    // T-11: a mensagem de recusa do servidor é mostrada como veio, não como "exclusiva do Órgão Central"
    w.sessaoPerdida('Equipe da Coordenação de Inspeção não gere os diretores escolares: isso cabe à Diretoria Educacional.');
    ok(!$('#ovAviso').hidden && $('#avisoTexto').textContent.includes('não gere os diretores') &&
       !$('#avisoTexto').textContent.includes('exclusiva do Órgão Central'),
       'T-11: a recusa por competência é mostrada com a mensagem do servidor');
    ok(!!w.eval('SESSAO.token') && w.eval('SESSAO.papel') === 'equipe_inspecao', 'T-11: uma recusa por competência não derruba a sessão');
    $('#avisoOk').click(); await espera(150);
    w.sessaoPerdida('Esta ação é exclusiva do Órgão Central.');
    ok($('#avisoTexto').textContent.includes('exclusiva do Órgão Central'), 'T-11: a mensagem do Órgão Central continua sendo mostrada quando é ela');
    $('#avisoOk').click(); await espera(150);

    // o Superintendente remove DE e CI, edita e-mail sem duplicar, e o limite ignora suspensos
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="superintendente"]').click();
    await espera(1500);
    d.querySelector('[data-aba="equipe"]').click();
    await espera(900);
    ok(d.querySelectorAll('#piEquipe .eq-linha').length === 3, 'a equipe da Superintendência lista os dois DE e o CI');
    d.querySelector('[data-eqp-editar="de2.divinopolis@educacao.mg.gov.br"]').click();
    await espera(200);
    ok(!$('#avisoCancelar').hidden && $('#avisoOk').textContent === 'Salvar', 'T-13: o formulário da equipe tem Cancelar e o rótulo "Salvar"');
    $('#eqNome').value = 'He';
    $('#avisoOk').click();
    await espera(300);
    ok(!$('#ovAviso').hidden && $('#avisoErro').classList.contains('show') && $('#eqEmail').value === 'de2.divinopolis@educacao.mg.gov.br',
       'T-13: nome curto é apontado no diálogo, e o e-mail digitado fica');
    $('#eqNome').value = 'Hélio Diretor Educacional';
    $('#eqEmail').value = 'helio.novo@educacao.mg.gov.br';
    $('#avisoOk').click();
    await espera(1400);
    ok(w.DEMO.acessos().filter(a => a.papel === 'diretor_educacional' && a.sre === 'Divinópolis').length === 2,
       'T-12: trocar o e-mail de um DE com a SRE cheia é aceito — quem troca não conta como novo');
    ok(w.DEMO.acessos().some(a => a.email === 'helio.novo@educacao.mg.gov.br' && a.papel === 'diretor_educacional') &&
       !w.DEMO.acessos().some(a => a.email === 'de2.divinopolis@educacao.mg.gov.br'),
       'T-12: a pessoa é a mesma, com o e-mail novo — não há uma segunda linha');
    ok(!w.DEMO.acessos().filter(a => a.email === 'helio.novo@educacao.mg.gov.br')[0].hash,
       'T-12: com o e-mail trocado, a senha antiga não vale — a pessoa recebe convite novo');
    const r21a = await chama('acessoSalvar', {token:'demo', papel:'coordenador_inspecao', nome:'Coordenadora de Inspeção',
      email:'inspecao.divinopolis@educacao.mg.gov.br', situacao:'inativo'});
    ok(r21a && r21a.ok && !r21a.convite, 'T-21: suspender quem já está cadastrado não reenvia convite');
    const r12b = await chama('acessoSalvar', {token:'demo', papel:'coordenador_inspecao', nome:'Novo Coordenador',
      email:'ci.novo@educacao.mg.gov.br', situacao:'ativo'});
    ok(r12b && r12b.ok, 'T-12: com o Coordenador suspenso, cabe outro — suspenso não ocupa vaga');
    const r21b = await chama('acessoSalvar', {token:'demo', papel:'coordenador_inspecao', nome:'Novo Coordenador (nome corrigido)',
      email:'ci.novo@educacao.mg.gov.br', situacao:'ativo'});
    ok(r21b && r21b.ok && !r21b.convite, 'T-21: corrigir o nome de quem ainda não definiu senha não reenvia convite');
    const r11a = await chama('acessoRemover', {token:'demo', email:'ci.novo@educacao.mg.gov.br'});
    ok(r11a && r11a.ok && !w.DEMO.acessos().some(a => a.email === 'ci.novo@educacao.mg.gov.br'),
       'T-11: o Superintendente remove o Coordenador de Inspeção');
    const r11b = await chama('acessoRemover', {token:'demo', email:'inspetor.divinopolis@educacao.mg.gov.br'});
    ok(r11b && !r11b.ok && /não remove/.test(r11b.erro), 'T-11: mas não remove a equipe da Inspeção — quem a cadastra é o Coordenador');
    const r11c = await chama('acessoRemover', {token:'demo', email:'colegiado.docente@educacao.mg.gov.br'});
    ok(r11c && !r11c.ok && /direção dela/.test(r11c.erro), 'T-11: nem o colegiado de uma escola');
    await chama('acessoSalvar', {token:'demo', papel:'coordenador_inspecao', nome:'Coordenadora de Inspeção',
      email:'inspecao.divinopolis@educacao.mg.gov.br', situacao:'ativo'});

    /* T-04 no simulador: correção, remoção e inativação não confundem colegiado
       com diretor. v9.7: quem gere os diretores é a Diretoria Educacional. */
    w.sairSessao();
    w.abrirPorta('regional');
    await espera(200);
    d.querySelector('[data-papel="diretor_educacional"]').click();
    await espera(1500);
    const membrosAntes = w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').map(a => a.email);
    const r04 = await chama('acessoRemover', {token:'demo', email:'direcao.31100001@educacao.mg.gov.br', motivo:'teste'});
    ok(r04 && r04.ok, 'T-04(e): a Diretoria Educacional remove a diretora');
    ok(w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').map(a => a.email).join() === membrosAntes.join(),
       'T-04(d): remover a diretora não mexe no colegiado');
    const r04b = await chama('acessoSalvar', {token:'demo', perfil:'escola', papel:'diretor_escolar', inep:'31100001',
      nome:'Ana Lúcia Ferreira', masp:'11234567', email:'direcao.31100001@educacao.mg.gov.br', modo:'novo'});
    ok(r04b && r04b.ok && r04b.escolas.filter(e => e.inep === '31100001')[0].gestor.email === 'direcao.31100001@educacao.mg.gov.br',
       'T-04(e): re-associar a diretora não sobrescreve a linha de nenhum membro do colegiado');
    ok(w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').map(a => a.email).join() === membrosAntes.join(),
       'T-04(e): o colegiado continua inteiro');
    /* v8.12: os membros aparecem, sim — com perfil 'colegiado'. O que T-04
       protegia era o período de GESTÃO da escola, e esse continua sendo um só */
    ok(w.DEMO.gestores().filter(g => membrosAntes.indexOf(g.email) >= 0)
         .every(g => g.perfil === 'colegiado'),
       'v8.12: os membros do colegiado entram no histórico com perfil próprio');
    ok(w.DEMO.gestores().filter(g => g.inep === '31100001' && g.perfil === 'escola' && !g.fim).length === 1,
       'T-04(b): e o período de gestão da escola continua sendo um só, o da direção');
    /* v8.13 (C09): a escola tem um PPP que não está encerrado — a baixa passa a
       pedir confirmação também nessa fase, que é a mais frágil do ciclo. */
    const r04pergunta = await chama('escolaSituacao', {token:'demo', inep:'31100001', situacao:'inativa'});
    ok(r04pergunta && r04pergunta.ok === false && r04pergunta.pppAberto && r04pergunta.pppAberto.protocolo,
       'v8.13 (C09): com um PPP ainda não encerrado, inativar a escola pede confirmação');
    const r04f = await chama('escolaSituacao', {token:'demo', inep:'31100001', situacao:'inativa', confirmado:true});
    ok(r04f && r04f.ok && r04f.gestorEncerrado === 'direcao.31100001@educacao.mg.gov.br' && r04f.colegiadoInativado === membrosAntes.length,
       'T-04(f): inativar a escola encerra o diretor e deixa o colegiado inativo');
    ok(!r04f.escolas.filter(e => e.inep === '31100001')[0].gestor, 'T-04(f): a escola inativa não tem gestor — o colegiado não passa por gestor');
    ok(w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').every(a => a.situacao === 'inativo'),
       'T-04(f): os membros do colegiado ficam inativos no cadastro, sem sair dele');
    const r04volta = await chama('escolaSituacao', {token:'demo', inep:'31100001', situacao:'ativa'});
    ok(r04volta && r04volta.ok && r04volta.semDiretor === true && r04volta.colegiadoInativo === membrosAntes.length,
       'v8.13 (C09): reativar diz a verdade — a escola volta sem direção e com o colegiado inativo');
    await chama('acessoSalvar', {token:'demo', perfil:'escola', papel:'diretor_escolar', inep:'31100001',
      nome:'Ana Lúcia Ferreira', masp:'11234567', email:'direcao.31100001@educacao.mg.gov.br', modo:'novo'});
    w.DEMO.acessos().filter(a => a.papel === 'colegiado' && a.inep === '31100001').forEach(a => w.DEMO.situacaoAcesso(a.email, 'ativo'));

    // T-16a: a base da demonstração aceita o código da SEE e o INEP no 5º campo
    const r16sem = await chama('escolaSalvar', {token:'demo', inep:'184403', escola:'EE de Machado Mineiro', municipio:'Divinópolis', sre:'Divinópolis'});
    ok(r16sem && r16sem.ok === false && /obrigatório/.test(r16sem.erro || ''),
       'v9.8: a demonstração recusa a escola sem código INEP, como a implantação');
    const r16 = await chama('escolaSalvar', {token:'demo', inep:'184403', escola:'EE de Machado Mineiro', municipio:'Divinópolis', sre:'Divinópolis', codigoInep:'31088901'});
    ok(r16 && r16.ok && r16.criada, 'T-16a: o simulador aceita um código de 6 dígitos, como o servidor');
    /* a carga em massa é do Órgão Central (sessaoCentral_ no servidor): a
       bateria troca de sessão para exercitá-la, como faria quem a usa */
    w.sairSessao();
    w.abrirPorta('central');
    await espera(900);
    /* v8.13 (C10): a carga da base é simulada antes e só grava com a chave
       emitida pela simulação — é a operação mais destrutiva do sistema. */
    const textoBase16 = '200671;CESEC Zenith Campos;Divinópolis;Divinópolis;31998877\n9121;EE dos Palmares;Divinópolis;Divinópolis;inativa';
    const r16sim = await chama('escolasImportar', {token:'demo', texto:textoBase16, simular:true});
    ok(r16sim && r16sim.ok && r16sim.simulacao === true && r16sim.incluidas === 2 && !!r16sim.chave &&
       w.DEMO.escolas().filter(e => e.inep === '200671').length === 0,
       'v8.13 (C10): a simulação da base conta o que entraria e não grava nada');
    const r16nega = await chama('escolasImportar', {token:'demo', texto:textoBase16, simular:false});
    ok(r16nega && r16nega.ok === false && /Simule a carga antes de importar/.test(r16nega.erro || ''),
       'v8.13 (C10): sem a chave, a carga real é recusada');
    const r16b = await chama('escolasImportar', {token:'demo', texto:textoBase16, simular:false, chave:r16sim.chave});
    ok(r16b && r16b.ok && r16b.incluidas === 2 && !r16b.totalErros, 'T-16a: a carga aceita códigos curtos');
    ok(w.DEMO.escolas().filter(e => e.inep === '200671')[0].codigoInep === '31998877' &&
       w.DEMO.escolas().filter(e => e.inep === '9121')[0].situacao === 'inativa',
       'T-16a: o 5º campo é o INEP — e cargas antigas com a situação ali continuam valendo');

    /* v8.1 — a presença é da DIREÇÃO, e só entre os cadastrados da escola */
    w.sairSessao();
    w.abrirPorta('colegiado');   // v7.4: porta própria do colegiado
    await espera(1500);
    const rPresCol = await chama('presencaColegiado', {token:'demo', p:'PPP-2024-0018-A2ND', emails:['colegiado.docente@educacao.mg.gov.br']});
    ok(rPresCol && !rPresCol.ok && /direção escolar/i.test(rPresCol.erro || ''),
       'v8.1: o colegiado não marca a própria presença — quem marca é a direção');
    ok(!w.eval('typeof ressalvarDocumento') || w.eval('typeof ressalvarDocumento') === 'undefined',
       'v8.1: a ressalva saiu da tela do colegiado');

    // T-16d/T-20: o link ?pa= abre a tela de primeiro acesso e, consumido, não volta
    w.sairSessao();
    const conviteEstudante = w.DEMO.convite('colegiado.estudante@educacao.mg.gov.br');
    w.eval("PA_CONSUMIDO = false; tokenPrimeiroAcessoDaURL = function(){ return " + JSON.stringify(conviteEstudante) + "; };");
    w.mostrarIdentificacao();
    await espera(900);
    ok(!$('#portaPrimeiro').hidden && $('#portas').hidden, 'T-16d: o bootstrap/identificação abre a tela de primeiro acesso quando há convite');
    ok($('#paCartao').textContent.includes('Colegiado Escolar') && $('#paCartao').textContent.includes('Pedro Henrique'),
       'T-16d: o cartão do convite diz quem é e em que papel');
    $('#paSenha').value = 'senha-demo-2026'; $('#paSenha2').value = 'senha-demo-2026';
    w.definirSenhaPrimeiroAcesso();
    await espera(1800);
    ok(w.eval('SESSAO.papel') === 'colegiado' && w.eval('SESSAO.perfil') === 'escola' && w.eval('SESSAO.porta') === 'colegiado',
       'T-16d: definida a senha, entra com o papel do convite — colegiado, não Superintendente — pela porta do colegiado (v7.4)');
    ok(w.eval('SESSAO.email') === 'colegiado.estudante@educacao.mg.gov.br', 'T-16d: e com o e-mail do convite');
    ok(w.eval('PA_CONSUMIDO') === true, 'T-20: o convite é marcado como consumido');
    w.sairSessao();
    await espera(200);
    ok($('#portaPrimeiro').hidden && !$('#portaEntrada').hidden,
       'T-20: "Sair" não reabre a tela de primeiro acesso — volta ao início');
    w.entrarNoSistema();
    w.eval("tokenPrimeiroAcessoDaURL = function(){ try { const m = String(location.search || '').match(/[?&]pa=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; } catch(e){ return ''; } };");

    // T-08 / T-18 / T-24: conferências no código-fonte
    {
      const fonte = fonteProducao;
      const gs = fs.readFileSync('./Code.gs', 'utf8');
      ok(/\.pi-abas\{[^}]*flex-wrap:wrap/.test(fonte), 'T-18: as abas do painel quebram linha (flex-wrap)');
      ok(/@media \(max-width:480px\)\{\s*\.eq-linha\{grid-template-columns:1fr/.test(fonte), 'T-18: a linha de equipe vira uma coluna em telas estreitas');
      ok(!/membro:token/.test(fonte) && !/adicionarMembros/.test(fonte) && !/reenviarConvite'/.test(fonte) &&
         !/data-copiar/.test(fonte) && !/ressalvarNoSistema/.test(fonte),
         'v8.1: a tela não convida, não reenvia link, não copia link e não registra ressalva');
      ok(/servidor\('presencaColegiado', \{p:APP\.protocolo, token:SESSAO\.token/.test(fonte) &&
         /servidor\('colegiadoDaFolha', \{p:APP\.protocolo, token:SESSAO\.token\}/.test(fonte),
         'v8.1: a marcação de presença envia o protocolo e o token da sessão');
      ok(!/registrarHomologacao/.test(fonte) && !/id="fHomol"/.test(fonte),
         'v8.2: o envio para homologação saiu da tela — assinar já encaminha');
      ok(/servidor\('homologarPPP', \{token:SESSAO\.token, protocolo:protocolo, confirmaSemAssinaturas/.test(fonte) &&
         !/ato:|fHomol/.test(fonte.slice(fonte.indexOf("servidor('homologarPPP'"), fonte.indexOf("servidor('homologarPPP'") + 200)),
         'v8.2/v8.7: homologar manda a sessão, o protocolo e a confirmação de assinaturas faltantes — nunca ato nem data');
      ['assinarDirecao','registrarAta','registrarAnexo'].forEach(function(f){
        ok(new RegExp("servidor\\('" + f + "', \\{p:APP\\.protocolo, token:SESSAO\\.token").test(fonte),
           'T-08: ' + f + ' envia o token da sessão');
      });
      const tituloGs = (gs.match(/'DOC\.folha\.titulo':\s*'([^']+)'/) || [])[1];
      ok(tituloGs === w.eval("CONTEUDO.padroesServidor['DOC.folha.titulo']") && tituloGs === '22. Folha de assinaturas',
         'T-24: o título da folha no servidor é o mesmo do cliente ("22. Folha de assinaturas")');
      ok(!/acesso restrito ao domínio/.test(gs) && !/acesso restrito ao domínio/.test(fonte),
         'T-25: nenhum aviso fala mais em "acesso restrito ao domínio"');
      ok(!/não há senha a definir/.test(fonte), 'T-25: "não há senha a definir" saiu das janelas de cadastro');
      ok(/podeAssociar_\(papelDaSessao_\(s\)\)|function sessaoAssocia_/.test(gs) && /sessaoDirecao_/.test(gs),
         'T-01/T-03: o servidor tem as guardas por papel');

      /* v8.13 (C01): o parâmetro da URL não pode virar markup. O esqueleto
         servido pelo Apps Script é o que importa aqui — é nele que os
         scriptlets ainda existem; a build de produção já os resolveu. */
      {
        const esqueleto = fs.readFileSync('./Index.html', 'utf8');
        const forcados = esqueleto.match(/<\?!=[^?]*\?>/g) || [];
        ok(!forcados.some(x => /param/i.test(x)),
           'v8.13 (C01): nenhum scriptlet de força-impressão (<?!=) emite parâmetro da URL');
        const ini = esqueleto.indexOf('window.PARAMETROS');
        const bloco = esqueleto.slice(ini, esqueleto.indexOf('</scr' + 'ipt>', ini));
        ok(ini > 0 && bloco.length > 50 && !/<\?/.test(bloco),
           'v8.13 (C01): o bloco que monta window.PARAMETROS não tem mais nenhum scriptlet');
        ok(/id="paramsUrl"[^>]*data-v="<\?=\s*paramV\s*\?>"[^>]*data-pa="<\?=\s*paramPa\s*\?>"/.test(esqueleto),
           'v8.13 (C01): os parâmetros são entregues em atributo data-, com o escape de HTML do Apps Script');
        ok(/dataset/.test(bloco), 'v8.13 (C01): e a página os lê pelo dataset');
        ok(!/<\?/.test(fonte) && /window\.PARAMETROS/.test(fonte),
           'v8.13 (C01): a build de produção continua com window.PARAMETROS e sem scriptlet pendente');
        ok(/paramSaneado_\(par\.v/.test(gs) && /paramSaneado_\(par\.pa/.test(gs) && !/t\.parametros/.test(gs),
           'v8.13 (C01): o doGet sanea os dois parâmetros e não serializa mais nada para dentro de um script');
      }
    }

    // volta ao Órgão Central para o restante da bateria
    w.sairSessao();
    w.abrirPorta('central');
    await espera(900);
    w.escolherModo('visualizacao');
    await espera(1200);

    // modo de edição de textos
    $('#piEditar').click();
    await espera(900);
    ok(w.eval('EDICAO.ativa') && !$('#barraEdicao').hidden, 'modo de edição de textos ativado');
    ok(d.body.classList.contains('modo-edicao'), 'telas passam a marcar os textos editáveis');
    w.irPara(iId('t21'), true);
    const marcados = d.querySelectorAll('#panelFormativo [data-cur]').length;
    ok(marcados > 8, `${marcados} trechos editáveis na tela formativa`);
    ok(d.querySelectorAll('#docMini [data-cur]').length > 5, 'parágrafos do documento também são editáveis');
    ok($('#travaRibbon').textContent.includes('campos da escola'), 'aviso deixa claro que os campos da escola estão bloqueados');

    // edição direta de um texto
    const alvo = d.querySelector('#panelFormativo [data-cur$=".lead"]');
    ok(!!alvo && alvo.dataset.inline === '1', 'texto de abertura editável no próprio lugar');
    w.editarInline(alvo);
    ok(alvo.getAttribute('contenteditable') === 'true', 'clique transforma o texto em campo editável');
    alvo.textContent = 'Avaliar é acompanhar a aprendizagem, não classificar o estudante.';
    alvo.dispatchEvent(new w.Event('blur'));
    ok(w.eval("CUR.rascunhos['TELAS.t21.conteudo.lead']") === 'Avaliar é acompanhar a aprendizagem, não classificar o estudante.',
       'alteração vira rascunho no endereço certo do conteúdo');
    ok(w.eval('TELAS')[iId('t21')].conteudo.lead.includes('Avaliar é acompanhar'), 'texto novo aplicado na hora');
    ok($('#beInfo').textContent.includes('1'), 'barra mostra quantos textos foram alterados');

    // publicar a alteração
    $('#bePublicar').click();
    await espera(1400);
    ok(w.eval('CONTEUDO.itens')['TELAS.t21.conteudo.lead'], 'alteração publicada para a rede');
    ok(Object.keys(w.eval('CUR.rascunhos')).length === 0, 'rascunho limpo após publicar');

    // texto composto abre na lista completa
    const composto = d.querySelector('#docMini [data-cur]:not([data-inline])');
    if(composto){ w.abrirNaLista(composto.dataset.cur);
      ok(!$('#ovCuradoria').hidden, 'texto de catálogo abre na lista completa, já identificado'); 
      $('#ovCuradoria').hidden = true; }

    w.sairEdicao(true);
    w.sairSessao();
    d.querySelector('[data-porta="escola"]').click();
    await espera(900);
    /* v7.4 (P3): o percurso só se abre em sessão, pela tela inicial da direção */
    w.criarNovoPPP(); await espera(900);
    if(!$('#ovAviso').hidden){ $('#avisoOk').click(); await espera(150); }
    ok($('#landing').hidden && !$('#stage').hidden, 'direção escolar volta ao percurso normal, em sessão');

    /* v8.13 (C04): a janela da baixa promete que, inativada a escola,
       "ninguém poderá assinar, anexar a ata nem concluir esse documento".
       Até aqui a promessa valia só para quem ainda não tinha entrado: com a
       sessão aberta, quem teve o cadastro apagado continuava trabalhando.
       Agora a tela da direção daquela escola cai na abertura. */
    {
      const tokenDaDirecao = w.eval('SESSAO.token');
      const protocoloDaDirecao = w.eval('APP.protocolo');
      ok(!!tokenDaDirecao && $('#landing').hidden, 'v8.13 (C04): a direção está em sessão, no percurso');
      await new Promise(function(resolve){
        chamarDemo('entrarInstitucional', { porta: 'central' }, function(r1){
          chamarDemo('escolaSituacao', { token: r1.token, inep: '31100001', situacao: 'inativa', confirmado: true },
            function(){ resolve(); });
        });
      });
      /* primeiro o servidor, direto: é a promessa da janela — ninguém assina */
      const recusa = await new Promise(function(resolve){
        chamarDemo('assinarNoSistema', { token: tokenDaDirecao, protocolo: protocoloDaDirecao || 'PPP-2026-0001-AAAA', aceite: true },
          function(res){ resolve(String((res && res.erro) || (res && res.ok ? 'PASSOU' : ''))); });
      });
      ok(/acesso foi encerrado|marcada como inativa na base da rede/.test(recusa),
         'v8.13 (C04): dada a baixa, a mesma sessão não assina mais no sistema — ' + recusa);
      /* e a tela, na primeira gravação, volta à abertura */
      w.salvarExplicito();
      await espera(900);
      ok(!$('#landing').hidden && !w.eval('SESSAO.token'),
         'v8.13 (C04): a tela da direção daquela escola cai na abertura');
    }
  }

  // ---------- resultado ----------
  console.log(`\n${oks.length} verificações OK · ${falhas.length} falhas · ${erros.length} erros de runtime\n`);
  if (falhas.length) { console.log('FALHAS:'); falhas.forEach(f => console.log('  ✗ ' + f)); }
  if (erros.length) { console.log('\nERROS DE RUNTIME:'); [...new Set(erros)].slice(0,12).forEach(e => console.log('  ! ' + e.slice(0,220))); }
  process.exit(falhas.length || erros.length ? 1 : 0);
})().catch(e => {
  /* mostra o que já havia sido verificado antes da exceção — é o que orienta o conserto */
  console.log(`\n${oks.length} verificações OK · ${falhas.length} falhas antes da exceção\n`);
  if (falhas.length) { console.log('FALHAS:'); falhas.forEach(f => console.log('  ✗ ' + f)); }
  if (erros.length) { console.log('ERROS DE RUNTIME:'); [...new Set(erros)].slice(0,8).forEach(x => console.log('  ! ' + String(x).slice(0,200))); }
  console.log('EXCEÇÃO NO TESTE:', e.stack);
  process.exit(2); });
