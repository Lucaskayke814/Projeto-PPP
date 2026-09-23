const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

/* v8.0 (P12): a página única é montada a partir das partes (Index, Css, App)
   — a de demonstração, que é a que roda sem o google.script. */
const PAGINAS = { './Index.html': require('./montar.js').montar({ demo: true }) };

function carrega(arquivo, googleFake, antes) {
  const fonte = PAGINAS[arquivo] || fs.readFileSync(arquivo, 'utf8');
  const html = fonte.replace('<?= JSON.stringify(token) ?>', '"tok-1"');
  const erros = [];
  const vc = new VirtualConsole();
  /* o jsdom não navega: o clique no <a download> do PDF (v7.4) é ignorado como o scrollTo */
  vc.on('jsdomError', e => { if(!/scrollTo|navigation to another Document/.test(e.message||'')) erros.push(e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://script.google.com/macros/s/teste/exec',
    beforeParse(w) {
      w.scrollTo = () => {}; w.alert = m => erros.push('ALERT: ' + m); w.confirm = () => true;
      /* o sistema usa diálogo próprio: nativo é bloqueado em iframe com sandbox */
      w.confirmarAuto = true;
      w.HTMLElement.prototype.scrollIntoView = function(){};
      /* v7.4 (P1): o PDF chega em base64 e vira um download no navegador */
      w.downloads = [];
      w.URL.createObjectURL = function(){ w.downloads.push('blob'); return 'blob:x'; };
      w.URL.revokeObjectURL = function(){};
      if (googleFake) w.google = googleFake(w);
      if (antes) antes(w);
    } });
  const w = dom.window;
  return { w, d: w.document, erros };
}

const falhas = [], oks = [];
const ok = (c, m) => (c ? oks : falhas).push(m);
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* =============== 1. restauração de registro salvo =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(30);
    const state = w.eval('state'), APP = w.eval('APP');
    w.preencherRegistro({
      protocolo:'PPP-2026-0042', versao:1, status:'Em andamento', tela: 12,
      escola:'EE Restaurada', inep:'31000001', municipio:'Divinópolis', sre:'Divinópolis',
      direcao:'Dir', especialista:'Esp', endereco:'Rua', ato:'', turnos:'', estudantes:'', turmas:'',
      colegiado:'', vigencia:'2026–2028',
      etapas:['Ensino Fundamental — Anos Finais','Ensino Médio'],
      mods:['Educação Especial','Nome Que Não Existe Mais'],
      infra:['Biblioteca ou sala de leitura'], temas:[], principios:[], metodos:[],
      indicadores: JSON.stringify({ano:'2025', etapas:{efaf:{mat:'200',aba:'4,0'}}}),
      detalhes: JSON.stringify({ept:{cursos:'Técnico em Informática'}}),
      tMissao:'Missão restaurada', tHistorico:'', assinaturas:'[]', anexos:'[]'
    });
    ok(APP.protocolo === 'PPP-2026-0042', 'protocolo restaurado');
    ok(state.sel.etapas.has('efaf') && state.sel.etapas.has('em'), 'etapas restauradas por rótulo');
    ok(state.sel.mods.has('esp'), 'modalidade restaurada por rótulo');
    ok(state.sel.mods.size === 1, 'rótulo desconhecido é ignorado sem quebrar');
    ok(state.ind.etapas.efaf && state.ind.etapas.efaf.mat === '200', 'indicadores restaurados do JSON');
    ok(state.det.ept && state.det.ept.cursos === 'Técnico em Informática', 'detalhes restaurados do JSON');
    ok(state.tela === 12, 'retoma na tela salva');
    ok(d.querySelector('#docMini').textContent.includes('Missão restaurada'), 'texto restaurado no documento');
    ok(erros.length === 0, 'restauração sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));

    // registro salvo com layout antigo (tela além do total)
    w.preencherRegistro({ protocolo:'PPP-2026-0001', tela: 99, escola:'X', etapas:[], mods:[], infra:[], temas:[], principios:[], metodos:[] });
    ok(state.tela === w.eval('TELAS').length - 1, 'tela fora do intervalo é limitada à última');
  }

  /* =============== 2. documento para PDF =============== */
  {
    const { w } = carrega('./Index.html');
    await espera(30);
    const state = w.eval('state');
    state.txt.tReferencias = 'AUTOR, Primeiro. Obra de referência um. 1996.\nAUTOR, Segundo. Obra de referência dois. 1995.';
    const pdf = w.docHTML(true).html, tela = w.docHTML(false).html;
    ok(!/class="blk"/.test(pdf), 'PDF sem invólucros de tela');
    ok((pdf.match(/class="quebra"/g)||[]).length === 2, 'PDF com quebras de página após capa e sumário');
    ok(/AUTOR, Primeiro/.test(pdf) && /AUTOR, Segundo/.test(pdf), 'referenciais teóricos em linhas separadas entram');
    ok(/Não se aplica|Seção a ser complementada/.test(pdf) || !/—\s*Nenhuma/.test(pdf), 'PDF não exibe avisos de rascunho');
    const secs = (pdf.match(/<h3 class="doc-h"[^>]*>([^<]+)<\/h3>/g)||[]).map(x=>x.replace(/<[^>]+>/g,''));
    ok(secs[0] === 'Identificação da escola' && secs[1] === 'Sumário',
       'v8.9: no documento, os dados da escola vêm antes do sumário');
    ok(secs[2] === 'Apresentação' && secs[3] === '1. Histórico da escola', 'numeração do documento conforme o ANEXO');
    ok(/data-sec="18"/.test(tela), 'seção de acompanhamento identificada para o foco');
    /* v8.13 (D22): cada item do sumário tem o lugar do número da página e o
       rótulo pelo qual a paginação o casa com o título. Em jsdom não há
       geometria e o número fica vazio — quem o preenche é a paginação real
       (teste-paginacao.js) e, no item da folha, o servidor. */
    const itensSum = tela.match(/<p class="sum-item" data-sum="[^"]*"><span class="sum-tx">[^<]*<\/span><span class="sum-pag"><\/span><\/p>/g) || [];
    ok(itensSum.length > 20, 'v8.13 (D22): todo item do sumário traz rótulo e o lugar do número da página (' + itensSum.length + ')');
    ok(/data-sum="folha"/.test(tela) && !/data-sum="folha"[^>]*>[^<]*<span class="sum-tx">folha/.test(tela),
       'v8.13 (D22): o item da folha de assinaturas é marcado para o servidor preencher, e mantém o rótulo do sumário');
    ok(!/<p class="sum-item">/.test(tela), 'v8.13 (D22): não sobrou item de sumário sem número de página');
    const refs = w.refsDoDocumento();
    /* v8.13 (D23): a ordem é por autor e, dentro do mesmo autor e tipo de ato,
       pelo NÚMERO da norma. localeCompare estrito punha "Lei nº 8.069" e
       "Lei nº 9.394" depois de "Lei nº 15.468" — alfabético e ilegível. */
    ok(refs.every((r,i,a)=> i===0 || a[i-1].split('.')[0].localeCompare(r.split('.')[0],'pt-BR') <= 0),
       'v8.13 (D23): referências agrupadas por autor, em ordem alfabética');
    const leis = refs.filter(r=>/^BRASIL\. Lei nº /.test(r)).map(r=>parseFloat(r.match(/Lei nº ([\d.]+)/)[1].replace(/\./g,'')));
    ok(leis.length > 3 && leis.every((n,i,a)=> i===0 || a[i-1] <= n),
       'v8.13 (D23): dentro de BRASIL/Lei, a ordem é numérica — a Lei nº 8.069 vem antes da nº 15.468 (' + leis.join(', ') + ')');
    ok(refs.some(r=>/Lei nº 13\.709/.test(r)) && refs.some(r=>/Lei nº 12\.527/.test(r)),
       'v8.13 (D23): a LGPD e a Lei de Acesso à Informação, citadas no texto fixo, têm entrada na lista');
    ok(refs.some(r=>/^BRASIL\. Lei nº 9\.394/.test(r)), 'LDB em formato ABNT');
  }

  /* v8.1 — as seções 3 e 4 (página externa de assinatura e ressalva) saíram:
     a página externa foi aposentada e a ressalva, retirada do sistema. O
     Colegiado é cadastrado pela direção, marcado como presente na reunião de
     aprovação e assina dentro do sistema. No lugar delas, as caixas de
     assinatura ao fim do documento. */

  /* =============== 3. v8.1: as caixas de assinatura ao fim do documento =============== */
  {
    const { w, erros } = carrega('./Index.html');
    await espera(30);
    const APP = w.eval('APP'), state = w.eval('state');

    /* antes de concluir, a prévia mostra como o fim do documento vai ficar.
       v8.13 (D19): a prévia é docHTML(FALSE) — as caixas são da folha de
       assinaturas, que o servidor monta e pagina com quem assinou de verdade;
       no que vai congelar elas não entram mais. */
    state.dados.direcao = 'Ana Lúcia Ferreira';
    let doc = w.docHTML(false).html;
    ok(!/<table class="cxs">/.test(w.docHTML(true).html),
       'v8.13: o documento que vai congelar NÃO leva caixas de assinatura — elas são da folha');
    ok(/<table class="cxs">/.test(doc) && (doc.match(/class="cxa"/g) || []).length === 3,
       'v8.1: a prévia já mostra as caixas — direção, exemplo do Colegiado e acompanhamento');
    ok(/Ana Lúcia Ferreira/.test(doc) && /Membro presente à reunião de aprovação/.test(doc),
       'v8.1: a caixa da direção traz o nome digitado na identificação');
    ok(!/doc-sign/.test(doc) && !/Presidente do Colegiado/.test(doc),
       'v8.1: as linhas de assinatura padronizadas e o presidente de colegiado saíram do documento');
    ok(/Acompanhado por/.test(doc) && !/Validado por/.test(doc),
       'v8.1: a caixa da Superintendência é rotulada "acompanhado por", não "validado por"');

    /* concluído, as caixas são as da folha: direção, presentes e acompanhamento */
    APP.assinaturas = [
      {papel:'Direção Escolar', segmento:'Direção', nome:'Ana Lúcia Ferreira', masp:'11234567',
       email:'direcao@x.mg', assinadoEm:'12/09/2026 10:00'},
      {papel:'Colegiado Escolar', segmento:'Docente', nome:'Rita Alves', masp:'',
       email:'rita@x.mg', assinadoEm:'12/09/2026 11:30'},
      {papel:'Colegiado Escolar', segmento:'Estudante', nome:'Pedro Henrique', masp:'',
       email:'pedro@x.mg', assinadoEm:''}
    ];
    APP.validadoPor = 'Cristina Diretora Educacional · Diretoria Educacional';
    APP.validadoEm = '09/09/2026 16:20';
    state.dados.sre = 'Divinópolis';
    doc = w.docHTML(false).html;
    ok((doc.match(/class="cxa"/g) || []).length === 4 && (doc.match(/class="cxa vazia"/g) || []).length === 0,
       'v8.1: uma caixa por signatário mais a de acompanhamento — quatro, sem sobra na grade');
    ok(/Assinado no sistema em 12\/09\/2026 11:30/.test(doc) && /Assinatura pendente no sistema/.test(doc),
       'v8.1: cada caixa diz se a assinatura já foi registrada e quando');
    ok(/Cristina Diretora Educacional/.test(doc) && /Diretoria Educacional · SRE Divinópolis/.test(doc) &&
       /Documento validado em 09\/09\/2026 16:20/.test(doc),
       'v8.1: a caixa de acompanhamento traz quem validou, de onde e quando');
    ok(!/direcao@x\.mg/.test(doc) && !/rita@x\.mg/.test(doc),
       'P3: nenhuma caixa imprime e-mail');
    ok(erros.length === 0, 'as caixas não geram erro de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 4. v8.3: os textos revistos e a tela da legislação =============== */
  {
    const { w, erros } = carrega('./Index.html');
    await espera(30);
    const TELAS = w.eval('TELAS'), T = w.eval('T');
    const tela = id => TELAS.filter(t => t.id === id)[0];
    const abertura = tela('t00');
    const t0 = abertura.conteudo;
    ok(/três eixos/.test(t0.titulo) && /escola que queremos/.test(t0.titulo),
       'v8.3: a primeira tela fala em três eixos, não em três partes');
    ok(/documento essencial que orienta os objetivos/.test(t0.lead),
       'v8.3: a abertura é a redação nova');
    ok(t0.blocos.filter(b => b.t === 'p').length >= 3 &&
       t0.blocos.some(b => b.t === 'lista' && /Os três eixos/.test(b.titulo || '')),
       'v8.3: três parágrafos de abertura e a lista dos eixos');
    ok(t0.blocos.some(b => b.t === 'dest' && /Por que começar pelo diagnóstico/.test(b.titulo || '')),
       'v8.3: o destaque passa a perguntar por que começar pelo diagnóstico');
    const comp = t0.blocos.filter(b => b.t === 'compare')[0];
    ok(comp && /se caracteriza como/.test(comp.sim.titulo) && /não deve ser/.test(comp.nao.titulo),
       'v8.3: "o PPP é/não é" vira "se caracteriza como"/"não deve ser"');
    ok(comp.nao.itens.every(i => !/gostaria de ter/.test(i)) && comp.sim.itens.some(i => /dinâmico/.test(i)),
       'v8.3: os itens das duas colunas são os da revisão');
    ok(/três eixos estruturantes/.test(T.metodologia) && /identidade, os princípios/.test(T.metodologia),
       'v8.3: o texto que vai para o documento acompanha a revisão');
    ok(abertura.tarefa && /vamos começar a construir/.test(abertura.tarefa.titulo),
       'v8.3: a tarefa de abertura foi reescrita');

    const leg = TELAS.filter(t => t.id === 't00b')[0];
    ok(!!leg && /Legislação para consultar/.test(leg.conteudo.titulo) && leg.modulo === 1,
       'v8.3: há uma tela de legislação no módulo de formação');
    const blocosLeg = leg.conteudo.blocos;
    ok(blocosLeg.some(b => /Toda escola deve consultar/.test(b.titulo || '')) &&
       blocosLeg.some(b => /Minas Gerais/.test(b.titulo || '')) &&
       blocosLeg.some(b => /SEE\/MG/.test(b.titulo || '')),
       'v8.3: com os blocos federal, estadual e SEE/MG');
    const tab = blocosLeg.filter(b => b.t === 'tabela')[0];
    ok(tab && tab.linhas.length === 8 && tab.colunas.length === 3,
       'v8.3: e o quadro do que consultar conforme a oferta da escola (8 linhas)');
    const txtLeg = JSON.stringify(leg.conteudo);
    ok(/15\.388\/2026/.test(txtLeg) && /15\.360\/2026/.test(txtLeg) && /15\.468\/2026/.test(txtLeg) &&
       /23\.197\/2018/.test(txtLeg) && /Meta 17\.6/.test(txtLeg),
       'v8.3: o novo PNE, as duas leis de 2026 e o PEE/MG estão na tela');
    ok(!/5\.234|5\.243/.test(txtLeg) && /n. a publicar/.test(txtLeg),
       'v8.3: a resolução pedagógica continua vindo do parâmetro da curadoria, sem número fixo');

    const refs = w.refsDoDocumento().join(' | ');
    ok(/Lei nº 15\.388/.test(refs) && /Lei nº 8\.069/.test(refs) && /Lei nº 15\.360/.test(refs) &&
       /Lei nº 15\.468/.test(refs) && /Lei nº 14\.644/.test(refs) && /Lei nº 23\.197/.test(refs) &&
       /Resolução SEE nº 5\.212/.test(refs) && /Constituição do Estado de Minas Gerais/.test(refs),
       'v8.3: as referências fixas do documento recebem as normas novas');
    ok(/CNE\/CP nº 2, de 22 de dezembro de 2017/.test(refs) && /CNE\/CP nº 4, de 17 de dezembro de 2018/.test(refs),
       'v8.3: e as duas resoluções da BNCC');
    /* as condicionais só entram quando a escola marca a oferta */
    ok(!/Resolução CNE\/CEB nº 6, de 17 de julho de 2025/.test(refs),
       'v8.3: sem EJA marcada, a resolução da EJA não entra');
    w.eval("state.sel.mods.add('eja'); state.sel.mods.add('campo'); state.sel.etapas.add('em'); state.sel.temas.add('etnico');");
    const refs2 = w.refsDoDocumento().join(' | ');
    ok(/CNE\/CEB nº 3, de 8 de abril de 2025/.test(refs2) && /CNE\/CEB nº 6, de 17 de julho de 2025/.test(refs2),
       'v8.3: marcada a EJA, entram a resolução das diretrizes e a que a alterou');
    ok(/CNE\/CEB nº 4, de 12 de maio de 2025/.test(refs2) && /itinerários formativos/.test(refs2),
       'v8.3: marcado o Ensino Médio, entram os parâmetros dos itinerários formativos');
    ok(/Decreto nº 7\.352/.test(refs2) && /CNE\/CEB nº 1, de 3 de abril de 2002/.test(refs2),
       'v8.3: marcada a Educação do Campo, entram o decreto e as diretrizes operacionais');
    ok(/CNE\/CP nº 1, de 17 de junho de 2004/.test(refs2),
       'v8.3: marcado o tema étnico-racial, entram as diretrizes das relações étnico-raciais');
    ok(erros.length === 0, 'v8.3: os textos revistos não geram erro de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 5. v7.8 (P7): sessão que sobrevive ao F5 e reentrada silenciosa =============== */
  {
    /* um servidor de mentira que responde ao que a tela pede, e uma sessão que "expira" quando mandarmos */
    let chamadas = [], tokenValido = 'tok-antigo', sessaoAtual = 'tok-antigo';
    const fake = w => ({ script: { run: new Proxy({}, {
      get: (_, nome) => {
        if (nome === 'withSuccessHandler') return fn => { fake._ok = fn; return w.google.script.run; };
        if (nome === 'withFailureHandler') return fn => { fake._err = fn; return w.google.script.run; };
        return (...args) => {
          /* v8.13 (E01): a tela deixou de nomear a função — ela chama
             api({fn, args}). O servidor de mentira desembrulha o pedido e
             continua despachando por nome, como o Code.gs faz em api(). */
          let a = args[0] || {};
          let nome2 = nome;
          if (nome2 === 'api') { nome2 = String(a.fn || ''); a = a.args || {}; }
          chamadas.push([nome2, a]);
          const okFn = fake._ok, errFn = fake._err;
          const sessaoOk = () => a.token === tokenValido;
          setTimeout(() => {
            if (nome2 === 'contexto') return okFn({ email:'diretora@educacao.mg.gov.br', admin:false, controleAtivo:true, identificado:true, urlApp:'https://x',
              acesso:{ perfil:'escola', papel:'diretor_escolar', papelNome:'Direção Escolar', nome:'Diretora Domínio', sre:'Divinópolis', inep:'31100001', escola:'EE Domínio', email:'diretora@educacao.mg.gov.br', podeValidar:false, podeAssociar:false, soLeitura:false, cadastra:['colegiado'] } });
            if (nome2 === 'conteudoPublicado') return okFn({ versao:0, itens:{}, padroes:{} });
            if (nome2 === 'sessaoValida') return okFn(sessaoOk() ? { ok:true, expiraEm:1000000 } : { ok:false, semSessao:true, erro:'Sessão expirada.' });
            if (nome2 === 'entrarInstitucional') { sessaoAtual = tokenValido = 'tok-novo'; return okFn({ ok:true, token:'tok-novo', perfil:'escola', papel:'diretor_escolar', papelNome:'Direção Escolar', sre:'Divinópolis', nome:'Diretora Domínio', email:'diretora@educacao.mg.gov.br', inep:'31100001', escola:'EE Domínio', podeValidar:false, podeAssociar:false, soLeitura:false, cadastra:['colegiado'] }); }
            if (nome2 === 'painelRegistros') return sessaoOk() ? okFn({ ok:true, perfil:'escola', linhas:[], sres:[], inep:'31100001', escola:'EE Domínio' }) : errFn(new Error('Sessão expirada. Entre novamente no sistema.'));
            if (nome2 === 'colegiadoListar') return sessaoOk() ? okFn({ ok:true, inep:'31100001', escola:'EE Domínio', membros:[] }) : okFn({ ok:false, semSessao:true, erro:'É preciso entrar no sistema para esta ação.' });
            if (nome2 === 'minhasAssinaturas') return okFn({ ok:true, pendentes:[], assinados:[] });
            if (nome2 === 'sair') return okFn({ ok:true });
            okFn({ ok:true });
          }, 5);
        };
      } }) } });
    const { w, d, erros } = carrega('./Index.html', fake, (win) => {
      /* a aba "já tinha" uma sessão guardada antes de recarregar */
      win.sessionStorage.setItem('ppp.sessao', JSON.stringify({ token:'tok-antigo', perfil:'escola', papel:'diretor_escolar', papelNome:'Direção Escolar', sre:'Divinópolis', nome:'Diretora Domínio', inep:'31100001', escola:'EE Domínio', email:'diretora@educacao.mg.gov.br', podeValidar:false, podeAssociar:false, soLeitura:false, cadastra:['colegiado'], modo:'visualizacao' }));
    });
    await espera(120);
    ok(chamadas.some(c => c[0] === 'sessaoValida' && c[1].token === 'tok-antigo'), 'P7: ao abrir, a tela confere no servidor a sessão guardada na aba');
    ok(w.eval('SESSAO.token') === 'tok-antigo' && d.querySelector('#landing').hidden && !d.querySelector('#painelInst').hidden,
       'P7: sessão reconhecida — a direção volta direto à sua tela inicial, sem passar pela abertura (F5 não derruba)');
    /* agora a sessão "expira" no servidor: a próxima chamada é recusada; quem tem conta do domínio reentra sozinho */
    tokenValido = 'nenhum';
    chamadas.length = 0;
    w.carregarColegiado();
    await espera(120);
    const idxEntrar = chamadas.findIndex(c => c[0] === 'entrarInstitucional');
    const repetida = chamadas.filter(c => c[0] === 'colegiadoListar');
    ok(idxEntrar > 0 && repetida.length === 2 && repetida[1][1].token === 'tok-novo' && w.eval('SESSAO.token') === 'tok-novo',
       'P7: com a sessão expirada, a tela refaz a entrada pela conta do domínio e repete a chamada com o token novo');
    ok(!d.querySelector('#landing').hidden === false && d.querySelector('#ovAviso').hidden, 'P7: sem aviso de "sessão expirada" e sem voltar à abertura');
    ok(JSON.parse(w.sessionStorage.getItem('ppp.sessao')).token === 'tok-novo', 'P7: a sessão guardada na aba é a nova');
    /* falha de sessão pelo caminho de exceção (withFailureHandler) também reentra */
    tokenValido = 'nenhum'; chamadas.length = 0;
    w.carregarPainel();
    await espera(150);
    ok(chamadas.some(c => c[0] === 'entrarInstitucional') && chamadas.filter(c => c[0] === 'painelRegistros').length === 2 && w.eval('SESSAO.token') === 'tok-novo',
       'P7: a exceção "Sessão expirada" do servidor também dispara a reentrada e a repetição');
    /* sair avisa o servidor e esquece a sessão da aba */
    chamadas.length = 0;
    w.sairSessao(true);
    await espera(60);
    ok(chamadas.some(c => c[0] === 'sair' && c[1].token === 'tok-novo') && !w.sessionStorage.getItem('ppp.sessao') && w.eval('SESSAO.token') === '',
       'P7: "Sair" chama o servidor com o token e apaga a sessão guardada');
    ok(erros.length === 0, 'P7: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 8. v8.5: indicações da oferta com mais de uma marcação =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(30);
    const TELAS = w.eval('TELAS'), DETALHES = w.eval('DETALHES'), state = w.eval('state');
    const $ = sel => d.querySelector(sel);
    const iMods = TELAS.findIndex(t => t.tipo === 'marcacao' && t.grupo === 'mods');

    /* as formas de oferta da EPT são as do art. 16 da Resolução CNE/CP nº 1/2021 */
    ok(DETALHES.ept[0].tipo === 'multi' &&
       DETALHES.ept[0].opcoes.join(' | ') === 'integrada | concomitante | concomitante intercomplementar | subsequente',
       'v8.5: a EPT lista as quatro formas de oferta previstas na norma');
    ok(DETALHES.emti[0].tipo === 'multi' && DETALHES.efti[0].tipo === 'multi' && DETALHES.efti[1].tipo === 'opcao',
       'v8.5: especificidade do EMTI e carga do EFTI aceitam mais de uma; a oferta bilíngue continua resposta única');
    ok(!Object.keys(DETALHES).some(k => DETALHES[k].some(f => f.tipo === 'select')),
       'v8.5: não sobrou lista suspensa de escolha única nas indicações da oferta');

    /* registro gravado antes da v8.5: o texto livre continua valendo */
    state.sel.mods.add('ept');
    state.det.ept = { formas: 'integrada e concomitante intercomplementar', cursos: 'Técnico em Administração; Técnico em Enfermagem' };
    w.irPara(iMods, true);
    const marcadas = Array.from(d.querySelectorAll('#optsHost input[data-det="ept"][data-f="formas"]'))
      .filter(c => c.checked).map(c => c.value);
    ok(marcadas.join(' | ') === 'integrada | concomitante intercomplementar',
       'v8.5: o que estava gravado como texto entra na lista já marcado');
    ok($('#docMini').textContent.includes('As formas de oferta praticadas são: integrada e concomitante intercomplementar'),
       'v8.5: o documento reúne as marcações numa frase no plural');
    ok($('#docMini').textContent.includes('Cursos ofertados: Técnico em Administração; Técnico em Enfermagem'),
       'v8.5: o campo de texto livre — os cursos — não foi dividido nem perdido');

    /* valor fora da lista prevista: aparece como opção marcada e não se perde */
    state.det.ept = { formas: 'integrada; oferta experimental de curso técnico' };
    w.irPara(iMods, true);
    const cxs = Array.from(d.querySelectorAll('#optsHost input[data-det="ept"][data-f="formas"]'));
    ok(cxs.length === 5 && cxs[4].value === 'oferta experimental de curso técnico' && cxs[4].checked,
       'v8.5: valor fora das quatro formas entra ao fim da lista, já marcado');

    /* marcar e desmarcar pela tela */
    state.det.ept = {};
    w.irPara(iMods, true);
    const opts = Array.from(d.querySelectorAll('#optsHost input[data-det="ept"][data-f="formas"]'));
    const marca = v => { const c = opts.filter(x => x.value === v)[0]; c.checked = true; c.dispatchEvent(new w.Event('change', {bubbles:true})); };
    marca('subsequente'); marca('integrada');
    ok(state.det.ept.formas.join(' | ') === 'integrada | subsequente',
       'v8.5: a ordem gravada é a da lista, não a da marcação');
    ok($('#docMini').textContent.includes('As formas de oferta praticadas são: integrada e subsequente'),
       'v8.5: as duas marcações chegam ao documento');
    const c = opts.filter(x => x.value === 'integrada')[0];
    c.checked = false; c.dispatchEvent(new w.Event('change', {bubbles:true}));
    ok($('#docMini').textContent.includes('A forma de oferta praticada é a subsequente'),
       'v8.5: com uma só marcação, a frase volta ao singular');
    ok(erros.length === 0, 'v8.5: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 9. v8.6: celular e acessibilidade (bloco 5) =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const TELAS = w.eval('TELAS');

    /* E7 — a versão vem de um lugar só, e é a do pacote */
    const versaoLeiaMe = (require('fs').readFileSync('./LEIA-ME.txt', 'utf8')
      .match(/versão (\d+\.\d+)/) || [])[1];
    ok(w.eval('VERSAO_SISTEMA') === versaoLeiaMe,
       'E7: a versão do rodapé é a mesma do pacote (' + w.eval('VERSAO_SISTEMA') + ' / ' + versaoLeiaMe + ')');
    ok(new RegExp('v' + versaoLeiaMe.replace('.', '\\.') + ' · \\d{4}').test($('.foot').textContent),
       'E7: e o rodapé a escreve a partir dessa constante só');
    ok(!/v7\.9/.test($('.foot').textContent), 'E7: a versão antiga saiu do rodapé');

    /* E1 — o crachá do protocolo */
    w.eval('APP.protocolo = "PPP-2026-0031-R4KP"; APP.sujo = true; atualizarBadge();');
    const bd = $('#badgeProto');
    ok(!!bd.querySelector('.badge-id') && !!bd.querySelector('.badge-aviso'),
       'E1: o protocolo e o aviso de alterações não salvas viram partes distintas do crachá');
    ok(bd.querySelector('.badge-id').textContent === 'PPP-2026-0031-R4KP' &&
       /alterações não salvas/.test(bd.querySelector('.badge-aviso-tx').textContent),
       'E1: o protocolo não se mistura ao aviso — no celular o aviso vira um ponto');
    ok(/alterações não salvas/i.test(bd.getAttribute('aria-label') || ''),
       'E1: o leitor de tela continua recebendo o aviso por extenso');
    w.eval('APP.sujo = false; atualizarBadge("18/09/2026 10:00");');
    ok(!bd.hasAttribute('title') && !!bd.querySelector('.badge-id'),
       'E1: gravado, o crachá volta ao normal e larga o aviso');

    /* E6 — o mapa do percurso */
    w.eval('abrirMapa();');
    ok($('#mapaQtd').textContent === 'As ' + w.eval('telasVisiveis().length') +
       ' telas do percurso e o que ainda falta em cada uma.',
       'E6: o mapa conta as telas do percurso em vez de trazer o número fixo no HTML');
    ok(!/34 telas/.test(d.body.innerHTML), 'E6: o número antigo, que estava errado, saiu do HTML');
    w.eval('document.getElementById("ovMapa").hidden = true;');

    /* E5 — o foco preso no diálogo */
    w.eval('document.getElementById("landing").hidden = false;');
    await espera(30);
    const landing = $('#landing');
    ok(landing.contains(d.activeElement), 'E5: ao abrir, o foco entra no diálogo');
    const inertes = Array.from(d.body.children).filter(x => x.hasAttribute('inert'));
    ok(inertes.length > 0 && !landing.hasAttribute('inert'),
       'E5: o que está atrás do diálogo fica inerte enquanto ele estiver aberto');
    const focaveis = w.eval('focaveisDe(document.getElementById("landing"))');
    ok(focaveis.length > 1, 'E5: o diálogo tem elementos focáveis a percorrer');
    focaveis[focaveis.length - 1].focus();
    const tab = new w.KeyboardEvent('keydown', {key:'Tab', bubbles:true, cancelable:true});
    d.dispatchEvent(tab);
    ok(d.activeElement === focaveis[0] && tab.defaultPrevented,
       'E5: do último elemento, a tabulação volta ao primeiro — não escapa para a tela de trás');
    focaveis[0].focus();
    const tabS = new w.KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true, cancelable:true});
    d.dispatchEvent(tabS);
    ok(d.activeElement === focaveis[focaveis.length - 1],
       'E5: e do primeiro, a tabulação para trás vai ao último');
    w.eval('document.getElementById("landing").hidden = true;');
    await espera(30);
    ok(!Array.from(d.body.children).some(x => x.hasAttribute('inert')),
       'E5: fechado o diálogo, a tela de trás volta a responder');

    /* E2 — o documento em tela cheia */
    w.eval('state.dados.escola = "Escola Estadual de Teste"; abrirDocCheio();');
    await espera(30);
    const itens = Array.from(d.querySelectorAll('.doc-sum-item'));
    ok(itens.length >= 10 && !$('#docSumario').hidden,
       'E2: o documento em tela cheia ganha sumário com as seções');
    ok(itens.every(b => !!d.getElementById(b.dataset.sec)),
       'E2: cada item do sumário aponta para uma seção que existe no documento');
    ok(itens[0].textContent.trim().length > 0 &&
       itens.map(b => b.textContent).join(' ').indexOf('Identificação da escola') >= 0,
       'E2: o sumário traz os títulos das seções, na ordem do documento');
    w.eval('document.getElementById("ovDoc").hidden = true;');

    /* E3 e E4 — as ações no celular */
    const fonte = require('./montar.js').montar({ demo: true });
    ok(fonte.indexOf('<td class="linha-acoes" style="white-space:nowrap">') < 0 &&
       fonte.indexOf('<td class="linha-acoes">') > 0,
       'E4: as ações do PPP deixam de levar o "nowrap" no próprio elemento, que as cortava no cartão');
    ok(/data-as-ver[^]{0,200}?pi-acao forte" data-as-assinar/.test(fonte),
       'E3: "assinar" é a ação em destaque e vem depois de "ler o documento"');
    ok(/\.linha-acoes \.pi-acao,\.eq-acoes \.pi-acao\{[^}]*min-height:44px/.test(fonte),
       'E3/E4: no celular as ações ganham altura de toque e uma por linha');
    /* v9.1: o documento é justificado em toda largura — a regra que o
       alinhava à esquerda no celular saiu; fica só o respiro da folha */
    ok(/\.docwrap--full \.paper\{padding:22px 16px 30px\}/.test(fonte) &&
       !/\.docwrap--full \.doc p,\.docwrap--full \.doc li\{text-align:left/.test(fonte),
       'E2 (v9.1): abaixo de 640px a folha ganha respiro, e o texto continua justificado como no papel');
    ok(erros.length === 0, 'v8.6: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 10. v8.7: erro humano e não perder texto (blocos 3 e 4) =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const TELAS = w.eval('TELAS');

    /* D1 — o contador do campo */
    ok(w.eval('LIMITE_CAMPO') === 45000 && w.eval('AVISO_CAMPO') < w.eval('LIMITE_CAMPO'),
       'D1: há um teto por campo na tela, com aviso antes dele');
    const iEsc = TELAS.findIndex(t => t.tipo === 'escrita' && (t.campos || []).length);
    w.irPara(iEsc, true);
    const ta = $('#panelProducao textarea[data-k]');
    const ct = () => d.getElementById('ct_' + ta.dataset.k);
    ta.value = 'Texto curto.'; ta.dispatchEvent(new w.Event('input', {bubbles:true}));
    ok(/palavras?$/.test(ct().textContent) && !ct().classList.contains('perto'),
       'D1: no uso normal, o contador continua contando palavras e mais nada');
    ta.value = 'x'.repeat(w.eval('AVISO_CAMPO') + 10); ta.dispatchEvent(new w.Event('input', {bubbles:true}));
    ok(ct().classList.contains('perto') && /de 45\.000 caracteres/.test(ct().textContent),
       'D1: perto do teto, o contador passa a mostrar os caracteres e os dois números');
    ta.value = 'x'.repeat(w.eval('LIMITE_CAMPO') + 1); ta.dispatchEvent(new w.Event('input', {bubbles:true}));
    ok(ct().classList.contains('estourou') && /não será salvo/.test(ct().textContent),
       'D1: passado o teto, o contador diz o que acontece — o PPP para de salvar');
    ta.value = 'Texto curto.'; ta.dispatchEvent(new w.Event('input', {bubbles:true}));

    /* D1 — o servidor nomeia o campo, e a tela leva até ele */
    ok(w.eval('typeof irParaCampo') === 'function' &&
       /res\.campoGrande/.test(require('./montar.js').montar({ demo: true })),
       'D1: a recusa do servidor é tratada pela tela, que leva ao campo apontado');

    /* D2 — o rascunho no navegador */
    ok(w.eval('typeof guardarRascunhoLocal') === 'function' && w.eval('typeof ofertarRascunhoLocal') === 'function',
       'D2: há rascunho local e oferta de recuperação');
    w.eval('APP.protocolo = "PPP-2026-0099-TEST";');
    w.eval('state.txt.tApresentacao = "O que a escola escreveu e não chegou a ser gravado."; guardarRascunhoLocal();');
    const bruto = w.localStorage.getItem('ppp.rascunho.PPP-2026-0099-TEST');
    ok(!!bruto, 'D2: o texto vai para o navegador, por protocolo');
    const rasc = JSON.parse(bruto);
    ok(rasc.dados.tApresentacao === 'O que a escola escreveu e não chegou a ser gravado.' && rasc.protocolo === 'PPP-2026-0099-TEST',
       'D2: com o conteúdo e o protocolo a que pertence');
    ok(rasc.dados.token === undefined && rasc.dados.sessao === undefined,
       'D2: e sem credencial nenhuma dentro — o rascunho fica num navegador que pode não ser da diretora');
    /* v8.13 (D10): o que o rascunho tem e a tela NÃO tem é oferecido de volta;
       o que já está igual ao que o servidor devolveu é descartado sem incomodar
       ninguém. A decisão deixou de ser pelo relógio (ver o bloco 16). */
    w.eval('ofertarRascunhoLocal({atualizadoEm: "01/01/2030 10:00"});');
    ok(!w.localStorage.getItem('ppp.rascunho.PPP-2026-0099-TEST'),
       'D2: rascunho igual ao que está aberto é descartado sem incomodar ninguém');
    /* diferente do que está aberto: é oferecido, e o teste confirma automaticamente */
    w.eval('state.txt.tApresentacao = "Texto recuperado do navegador."; APP.protocolo = "PPP-2026-0099-TEST"; guardarRascunhoLocal();');
    w.eval('state.txt.tApresentacao = "";');
    w.eval('ofertarRascunhoLocal({atualizadoEm: "01/01/2020 10:00"});');
    ok(w.eval('state.txt.tApresentacao') === 'Texto recuperado do navegador.',
       'D2: diferente do que está aberto, o texto é oferecido e volta para a tela');
    ok(w.eval('APP.sujo') === true, 'D2: e volta marcado como não salvo, para ser gravado');

    /* D2 — a tarja de gravação falhando */
    ok(!!$('#tarjaSalvar') && $('#tarjaSalvar').hidden, 'D2: a tarja existe e começa escondida');
    w.eval('falhaAoSalvar();');
    ok(!$('#tarjaSalvar').hidden && /não está sendo gravado/.test($('#tarjaSalvarTexto').textContent) &&
       !!$('#tarjaSalvarBtn'),
       'D2: falhando a gravação, a tarja fica à vista, com o botão de tentar de novo');
    w.eval('gravacaoRestabelecida();');
    ok($('#tarjaSalvar').hidden && w.eval('APP.gravacaoFalhando') === false,
       'D2: gravado, a tarja some');
    w.localStorage.removeItem('ppp.rascunho.PPP-2026-0099-TEST');

    /* C1, C2 e C4 — o que a tela passa a oferecer */
    const fonte = require('./montar.js').montar({ demo: true });
    ok(/data-devolver="' \+ esc\(x\.protocolo\) \+ '" title="Devolve o PPP à escola com parecer e revoga a validação/.test(fonte) &&
       /x\.status === 'Validado'/.test(fonte),
       'C1: o PPP validado passa a oferecer "devolver (revoga a validação)"');
    ok(/Este PPP <b>já foi validado<\/b>[\s\S]{0,120}revoga a validação/.test(fonte),
       'C1: e o diálogo diz o que a devolução faz com a validação');
    /* v10.0: o desfazer saiu da tela. O tratador do clique continua, porque
       uma aba aberta de antes ainda tem o botão no DOM — e ele agora explica
       a regra em vez de chamar uma função que não existe mais. */
    ok(!/function desfazerHomologacaoDocumento/.test(fonte) &&
       !/data-desfazer-homolog="/.test(fonte),
       'v10.0: a tela não monta mais o botão de desfazer a homologação, nem a função dele');
    ok(/UI\.homologadoDefinitivo/.test(fonte) && /não é desfeita/.test(fonte),
       'v10.0: e quem alcançar o caminho antigo recebe a regra escrita');
    ok(/caixas assinadas/.test(fonte) && /Homologar assim mesmo/.test(fonte) &&
       /Esperar as assinaturas/.test(fonte),
       'C2: homologar mostra quantas caixas estão assinadas e pede confirmação extra quando faltam');
    ok(/res\.pppAberto && !confirmado/.test(fonte) && /Inativar mesmo assim/.test(fonte),
       'C4: inativar a escola com PPP em elaboração passa por confirmação, com o aviso do servidor');
    ok(erros.length === 0, 'v8.7: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 11. v8.8: escrita, painel e curadoria (blocos 6 e 7) =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const TELAS = w.eval('TELAS'), CHECK = w.eval('CHECK');

    /* v8.14: a caixa "Ver um exemplo de preenchimento" (F1, da 8.8) SAIU da
       tela da escola. O exemplo continua onde sempre esteve — dentro do campo
       vazio, como placeholder —, e o bloco do modo de edição fica de pé. */
    const iEsc = TELAS.findIndex(t => t.tipo === 'escrita' && (t.campos || []).length);
    w.irPara(iEsc, true);
    ok(!$('#panelProducao details.exemplo-campo'),
       'v8.14: a caixa "Ver um exemplo de preenchimento" não aparece mais na tela da escola');
    ok($('#panelProducao').innerHTML.indexOf('Ver um exemplo de preenchimento') < 0,
       'v8.14: e a frase não sobrou em nenhum canto da tela');
    {
      const campo = $('#panelProducao textarea');
      ok(!!campo && campo.placeholder.indexOf(TELAS[iEsc].campos[0].placeholder.slice(0, 40)) === 0,
         'v8.14: o exemplo continua dentro do campo vazio, que é onde ele orienta sem convidar à cópia');
    }
    ok(w.eval("exemploHTML({placeholder:'x'}, 'T.x')") === '',
       'v8.14: e a função que a montava devolve vazio fora do modo de edição');

    /* F2 — a conferência final leva a cada pendência */
    w.irPara(TELAS.length - 1, true);
    await espera(20);
    const mods = d.querySelectorAll('#checklist details.check-mod');
    ok(mods.length >= 5, 'F2: a conferência final é agrupada por módulo (' + mods.length + ' grupos)');
    const links = Array.from(d.querySelectorAll('#checklist [data-ck-tela]'));
    ok(links.length >= CHECK.length - 2,
       'F2: quase todos os itens viram botão que leva à tela onde se resolvem (' + links.length + ' de ' + CHECK.length + ')');
    ok(links.every(b => { const i = +b.dataset.ckTela; return i >= 0 && i < TELAS.length; }),
       'F2: e cada um aponta para uma tela existente');
    /* v8.13 (D14): o item dos princípios passou a conferir TAMBÉM o texto da
       seção 3 (A4-07). Por isso o destino agora obedece à regra que a própria
       telaDoItem já anunciava: falta marcar, leva à marcação; já marcou e
       falta escrever, leva ao texto. */
    const alvo = links.filter(b => /Princípios norteadores/.test(b.textContent))[0];
    const iMarcPrinc = TELAS.findIndex(t => t.tipo === 'marcacao' && t.grupo === 'principios');
    const iTxtPrinc = TELAS.findIndex(t => (t.campos || []).some(c => c.id === 'tPrincipios'));
    ok(!!alvo && +alvo.dataset.ckTela === (w.eval('state.sel.principios.size') === 0 ? iMarcPrinc : iTxtPrinc),
       'F2: o item dos princípios leva à marcação quando nada foi marcado, e ao texto quando já há marcação');
    const daEscrita = links.filter(b => /Missão, visão e valores/.test(b.textContent))[0];
    ok(!!daEscrita && (TELAS[+daEscrita.dataset.ckTela].campos || []).some(c => c.id === 'tMissao'),
       'F2: e o item de um texto leva à tela do campo daquele texto');
    alvo.click();
    await espera(30);
    ok(w.eval('state.tela') === +alvo.dataset.ckTela,
       'F2: tocar no item sai da tela final e vai ao lugar da pendência');
    const abertos = Array.from(mods).filter(m => m.open).length;
    ok(abertos >= 1, 'F2: os módulos com pendência vêm abertos; os prontos, recolhidos');

    /* F3 — os indicadores */
    const IND = w.eval('IND_COLS');
    ok(IND.every(c => /^Ex\.:/.test(c.ph)),
       'F3: os exemplos da tabela de indicadores passam a dizer "Ex.:", como o resto do sistema');
    const iInd = TELAS.findIndex(t => t.tipo === 'indicadores');
    w.eval('state.sel.etapas.clear()');
    w.irPara(iInd, true);
    await espera(20);
    ok(!!$('#btnIrEtapas'), 'F3: sem etapa marcada, o estado vazio oferece o caminho — e não só a repreensão');
    $('#btnIrEtapas').click();
    await espera(30);
    ok(w.eval('state.tela') !== iInd &&
       (TELAS[w.eval('state.tela')].grupo === 'etapas' || !!w.eval('tarefaDaTela(state.tela)')),
       'F3: e o botão leva à tela das etapas — parando antes, como a trilha, se houver preparação pendente');
    const fonte = require('./montar.js').montar({ demo: true });
    ok(/\.ind-tabela td\[data-r\]::before\{content:attr\(data-r\)/.test(fonte),
       'F3: no celular a tabela vira cartão por etapa, com o nome da coluna em cada linha');

    /* F4 — a trilha */
    w.irPara(iEsc, true);
    await espera(20);
    const comNome = d.querySelectorAll('#trilha .mod-btn.com-nome').length;
    ok(comNome >= 2 && comNome <= 3,
       'F4: o módulo atual e os vizinhos aparecem com nome, e não só com o número (' + comNome + ')');
    ok(w.eval('typeof centralizarTrilha') === 'function',
       'F4: e no celular a trilha rola até o módulo atual');

    /* G3 — a curadoria */
    ok(!/texto sublinhado/.test(fonte),
       'G3: a instrução deixa de mandar clicar no "texto sublinhado", que nunca foi sublinhado');
    ok(/contorno tracejado/.test(fonte), 'G3: e passa a descrever o que se vê na tela');
    /* v10.2: os marcadores de parâmetro e a recusa que os protegia saíram.
       Reescrever a citação é o que a curadoria faz — e nada mais a impede. */
    ok(w.eval("typeof marcadoresDe") === 'undefined' &&
       w.eval("typeof marcadoresPerdidos") === 'undefined' &&
       w.eval("typeof recusarPorMarcador") === 'undefined',
       'v10.2: a maquinaria que reconhecia e protegia marcador saiu da tela');
    ok(w.eval("typeof interpolarTudo") === 'undefined' && w.eval("typeof REDE") === 'undefined',
       'v10.2: e o bloco de parâmetros e a sua interpolação também');
    ok(!/\{\{REDE\./.test(w.eval("JSON.stringify([T, UI, TELAS, VIDEOS, SECOES, SUBSECOES])")),
       'v10.2: nenhum texto da tela traz marcador — a citação está escrita neles');
    const antesRasc = Object.keys(w.eval('CUR.rascunhos') || {}).length;
    w.eval("curEditar('T.avaliacao', 'texto', 'A avaliação segue a norma.')");
    ok(Object.keys(w.eval('CUR.rascunhos') || {}).length === antesRasc + 1,
       'v10.2: a reescrita que tira a citação é ACEITA — é o editor que decide o que o texto diz');
    ok(!/Parâmetros da rede/.test(fonte),
       'v10.2: e a tela não fala mais de um painel de parâmetros que não existe');

    /* G1 — a tabela da regional */
    ok(/class="\$\{escola \? '' : 'tab-gestao'\}"/.test(fonte) && /\.tab-gestao \.col-escola\{min-width:270px/.test(fonte),
       'G1: o nome da escola ganha largura mínima na tabela da gestão');
    ok(/atualizado em/.test(fonte) && /class="mun proto"/.test(fonte),
       'G1: protocolo e data de atualização passam a ser a segunda linha da célula da escola');
    ok(/function acoesDaLinha/.test(fonte) && /ACOES_QUE_MUDAM/.test(fonte) && /acoes-menu/.test(fonte),
       'G1: e as ações que mudam a situação do documento vão para um menu, marcadas');
    ok(erros.length === 0, 'v8.8: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 12. v8.9: brasão, páginas A4 e a planilha do Órgão Central =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const fonte = require('./montar.js').montar({ demo: true });

    /* o brasão: uma cópia só, sem alteração da imagem */
    const brasao = require('fs').readFileSync('./Brasao.html', 'utf8');
    ok(/^data:image\/png;base64,/.test((brasao.match(/src="([^"]+)"/) || [])[1] || ''),
       'v8.9: o brasão está embutido como PNG, num arquivo só do projeto');
    ok(!!$('#brasaoFonte img') && $('#brasaoFonte').hidden,
       'v8.9: a página embute a imagem uma única vez, escondida, para a tela e para o servidor');
    ok((fonte.match(/data:image\/png;base64,iVBOR/g) || []).length === 1,
       'v8.9: e ela aparece uma única vez na página montada — não uma por documento');
    ok(w.eval("typeof brasaoHTML") === 'function' && /id="brasaoOficial"/.test(w.eval('brasaoHTML()')),
       'v8.9: a tela lê o brasão desse mesmo lugar');
    const pdf = w.docHTML(true).html, tela = w.docHTML(false).html;
    ok(/<div class="brasao"><!--BRASAO--><\/div>/.test(pdf) && !/base64/.test(pdf),
       'v8.9: o documento que vai para o servidor leva só a marca do brasão — não 240 KB de base64 por escola');
    ok(/<div class="brasao"><img id="brasaoOficial"/.test(tela),
       'v8.9: na tela, a imagem aparece no alto da capa');
    /* v8.10: o timbre é institucional — a Secretaria, não o Governo */
    ok(!/Governo do Estado/.test(pdf) && !/Governo do Estado/.test(tela),
       'v8.10: o documento não fala em Governo do Estado');
    ok(/Secretaria de Estado de Educação de Minas Gerais/.test(pdf) &&
       /Superintendência Regional de Ensino de/.test(pdf),
       'v8.10: o timbre traz a Secretaria de Estado de Educação de Minas Gerais e a Superintendência');
    ok(/@page\{size:A4;margin:0\}/.test(require('fs').readFileSync('./Code.gs', 'utf8')) &&
       /function brasaoPdf_/.test(require('fs').readFileSync('./Code.gs', 'utf8')),
       'v8.9: o servidor troca a marca pela imagem ao montar o PDF, em A4');

    /* a ordem: dados da escola, depois sumário */
    const iIdent = pdf.indexOf('Identificação da escola');
    const iSum = pdf.indexOf('>Sumário<');
    ok(iIdent > 0 && iSum > iIdent, 'v8.9: os dados da escola vêm antes do sumário');

    /* as medidas do Padrão Ofício */
    ok(/\.pagina\{position:relative;width:210mm;height:297mm;padding:20mm 15mm 20mm 30mm/.test(fonte),
       'v8.9: a folha é A4 com as margens do Padrão Ofício (3 cm à esquerda, 1,5 à direita, 2 em cima e embaixo)');
    ok(/\.doc p\{text-align:justify;margin:0 0 6pt;text-indent:25mm\}/.test(fonte),
       'v8.9: texto justificado, 6 pt depois do parágrafo e recuo de 2,5 cm');
    ok(/font-family:Carlito,Calibri,Arial/.test(fonte), 'v8.9: fonte Calibri/Carlito, como manda o padrão');
    ok(w.eval('PAG.larg') === 210 && w.eval('PAG.alt') === 297 && w.eval('PAG.esq') === 30 && w.eval('PAG.dir') === 15,
       'v8.9: as medidas usadas no cálculo são as mesmas da folha');

    /* o paginador */
    ok(w.eval('typeof paginar') === 'function' && w.eval('typeof dividirBloco') === 'function',
       'v8.9: há um paginador, com divisão de bloco que não cabe');
    const pag = w.eval('paginar(docHTML(false).html)');
    ok(/<div class="paginas">/.test(pag) && /<div class="pagina"[ >]/.test(pag),
       'v8.9: o documento sai em folhas — mesmo onde não há cálculo de geometria, a estrutura é a mesma');
    ok(w.eval("paginar('<p>x</p>').indexOf('quebra')") < 0,
       'v8.9: as marcas de quebra não sobram no resultado');
    /* v8.13 (D18): o documento congelado no Drive JÁ vem em folhas. Repaginá-lo
       aninhava as folhas reais dentro de uma folha nova e o overflow:hidden
       cortava 95% do documento — na tela da escola e na porta pública de
       conferência, que é onde alguém compara o papel com o original. */
    const jaEmFolhas = '<div class="paginas"><div class="pagina" data-pag="1" data-de="2">' +
      '<div class="pag-corpo"><p>a</p></div></div><div class="pagina" data-pag="2" data-de="2">' +
      '<div class="pag-corpo"><p>b</p></div></div></div>';
    ok(w.eval('paginar(' + JSON.stringify(jaEmFolhas) + ')') === jaEmFolhas,
       'v8.13: o que já está em folhas volta intacto de paginar() — o congelado não se repagina');
    ok((w.eval('paginar(' + JSON.stringify(jaEmFolhas) + ')').match(/class="pagina"/g) || []).length === 2,
       'v8.13: e continua com as folhas que tinha, sem página dentro de página');
    ok(w.eval('paginar(' + JSON.stringify('<p>a expressão &lt;div class="paginas" aparece no meio do texto</p>') + ')')
         .indexOf('pag-corpo') > 0,
       'v8.13: a guarda é sobre o INÍCIO da string — texto de escola que cite a expressão continua sendo paginado');
    ok(/DEMO\.gravarFonte\(r\.fonteId, congelado\)/.test(fonte),
       'v8.13: a demonstração congela paginado, como a produção congela');

    /* a planilha */
    ok(/\$\('#piExportar'\)\.hidden = !central;/.test(fonte),
       'v8.9: "Baixar planilha" do painel passa a ser só do Órgão Central');
    ok(/A planilha do painel é do Órgão Central/.test(fonte) &&
       /A planilha da cobertura é do Órgão Central/.test(fonte),
       'v8.9: e a exportação recusa, mesmo chamada por fora da tela');
    ok((fonte.match(/SESSAO\.perfil === 'central' \? '<button class="btn btn-ghost" id="cobExportar"/g) || []).length +
       (fonte.match(/\$\{SESSAO\.perfil === 'central' \? '<button class="btn btn-ghost" id="cobExportar"/g) || []).length >= 2,
       'v8.9: os dois botões da cobertura também');
    ok(erros.length === 0, 'v8.9: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 13. v8.11: o código de autenticidade e a conferência pública =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const fonte = require('./montar.js').montar({ demo: true });
    const codigo = require('fs').readFileSync('./Code.gs', 'utf8');

    /* o formato do código */
    ok(w.eval("formatarCodigo('56f528d4c8c9')") === '56F5-28D4-C8C9',
       'v8.11: doze hexadecimais viram 0000-0000-0000, em maiúsculas, enquanto se digita');
    ok(w.eval("formatarCodigo('56f5-28d4')") === '56F5-28D4' &&
       w.eval("formatarCodigo('zz56f5!!28d4c8c9ffff')") === '56F5-28D4-C8C9',
       'v8.11: o campo aceita o código colado de qualquer jeito e descarta o que não é hexadecimal');
    ok(/function normalizarCodigo_/.test(codigo) &&
       /if \(c\.length !== 12\) return '';/.test(codigo),
       'v8.11: o servidor faz a mesma normalização — e recusa o que não tem doze caracteres');

    /* o rodapé: na tela, o código do documento; no PDF, a marca que o servidor troca */
    ok(w.eval("typeof rodapeDeAutenticidade") === 'function',
       'v8.11: há um rodapé de autenticidade');
    w.eval("APP.paraPdf = true;");
    ok(w.eval("rodapeDeAutenticidade()") === '<!--COD-->',
       'v8.11: no que vai para o servidor, o rodapé é só a marca — o código nasce na conclusão');
    w.eval("APP.paraPdf = false; APP.hash = '56F5-28D4-C8C9';");
    ok(/código de autenticidade 56F5-28D4-C8C9/.test(w.eval("rodapeDeAutenticidade()")),
       'v8.11: na tela, o rodapé traz o código do documento aberto');
    w.eval("APP.hash = '';");
    ok(w.eval("rodapeDeAutenticidade()") === '',
       'v8.11: e fica vazio enquanto o PPP ainda está em elaboração — não há o que autenticar');

    /* v8.13 (D21): a tela diz a MESMA coisa que o papel, e diz onde conferir */
    w.eval("APP.hash = '56F5-28D4-C8C9'; APP.urlApp = 'https://app/exec'; APP.assinaturas = [{assinadoEm:''}];");
    ok(/Documento em coleta de assinaturas no Gerador de PPP/.test(w.eval("rodapeDeAutenticidade()")) &&
       /confira em https:\/\/app\/exec\?v=56F5-28D4-C8C9/.test(w.eval("rodapeDeAutenticidade()")),
       'v8.13 (D21): com assinatura pendente a tela diz "em coleta" e mostra onde conferir — até a 8.12 o endereço só existia no PDF');
    w.eval("APP.assinaturas = [{assinadoEm:'01/01/2026 10:00'}];");
    ok(/Documento assinado eletronicamente no Gerador de PPP/.test(w.eval("rodapeDeAutenticidade()")),
       'v8.13 (D21): colhidas todas, a tela passa a dizer "assinado eletronicamente"');
    ok(w.eval("trocarMarcasDoDoc('<i><!--COD--></i>', 'TEXTO DO SERVIDOR')").indexOf('TEXTO DO SERVIDOR') > 0 &&
       w.eval("trocarMarcasDoDoc('<i><!--COD--></i>', 'TEXTO DO SERVIDOR')").indexOf('assinado eletronicamente') < 0,
       'v8.13 (D21): quando o servidor manda o rodapé, a tela usa o dele e não remonta a frase');
    ok(/confira em https:\/\/app\/exec\?v=/.test(w.eval("trocarMarcasDoDoc('<i><!--COD--></i>')")),
       'v8.13 (D21): sem rodapé do servidor, a tela monta a mesma frase — com o endereço de conferência');
    ok(/res\.rodape/.test(fonte) && (fonte.match(/trocarMarcasDoDoc\(res\.(congelado|html), res\.rodape\)/g) || []).length === 2,
       'v8.13 (D21): a tela da escola e a porta pública passam o rodapé do servidor');
    w.eval("APP.hash = ''; APP.urlApp = ''; APP.assinaturas = [];");

    /* o rodapé em TODAS as páginas */
    const folhas = w.eval("paginar(docHTML(false).html)");
    const nPag = (folhas.match(/<div class="pagina"[ >]/g) || []).length;
    const nRod = (folhas.match(/<div class="pag-rodape">/g) || []).length;
    ok(nPag > 0 && nPag === nRod, `v8.11: o rodapé vem em todas as folhas (${nPag} folhas, ${nRod} rodapés)`);
    ok((folhas.match(/<span class="pag-cod">/g) || []).length === nPag,
       'v8.11: e em cada rodapé há o lugar do código');
    ok(/\.pag-rodape\{/.test(fonte) && /\.pag-cod\{/.test(fonte) && /\.pag-num\{/.test(fonte),
       'v8.11: o rodapé tem estilo próprio — código à esquerda, número da página à direita');
    /* v8.13 (E17): a substituição passou a usar FUNÇÃO — `$&`, `` $` `` e `$'`
       dentro do rodapé ou do brasão seriam interpretados pelo String.replace.
       A conferência olha o efeito, não a forma da linha. */
    ok(/replace\(\/<!--COD-->\/g, function/.test(codigo) && /const cod = esc_\(rodape/.test(codigo),
       'v8.11/E17: ao montar o PDF, o servidor troca a marca pelo código, em todas as páginas de uma vez (com função de substituição)');

    /* a porta pública */
    ok(!!$('#portaVerificar') && !!$('#verifCodigo') && !!$('#btnVerificar'),
       'v8.11: há a tela de conferência, com campo e botão');
    /* v8.12: e ela não é mais uma porta de perfil — vem antes do login */
    ok(!$('[data-porta="verificar"]') && !!$('#portaEntrada') &&
       !!$('#btnEntrarSistema') && !!$('#btnAutenticarPPP'),
       'v8.12: a abertura oferece entrar no sistema ou autenticar um PPP, e a conferência saiu das portas de perfil');
    ok(/function verificarDocumento/.test(codigo) && /function documentoPublico/.test(codigo),
       'v8.11: o servidor responde à conferência e entrega o PDF inteiro, sem sessão');
    ok(/const VERIF_ERROS_MIN = \d+;/.test(codigo) && /function portaDeVerificacaoTravada_/.test(codigo) &&
       /function contarVerificacaoErrada_/.test(codigo),
       'v8.11: tentativas erradas em sequência travam a porta — o código não serve para varrer a base');
    ok(/const ST_COM_CODIGO = \[ST_ASSINATURA, ST_ASSINADO, ST_CONCLUIDO, ST_HOMOLOGADO, ST_HOMOLOGADO_SRE\]/.test(codigo),
       'v8.11: só respondem os documentos já concluídos — rascunho não tem código nem porta');

    /* o congelamento */
    ok(/\{col:'Textos da folha \(JSON, congelados\)',\s*key:'textosFolha'\}/.test(codigo),
       'v8.11: há uma coluna para os textos da folha como estavam na conclusão');
    ok(/function congelarTextosFolha_/.test(codigo) && /function txtDaFolha_/.test(codigo),
       'v8.11: a conclusão congela esses textos e o documento passa a lê-los de lá');
    ok(/gravarCampo_\(aba, linha, 'textosFolha', congelarTextosFolha_\(\)\)/.test(codigo),
       'v8.11: o congelamento acontece no mesmo instante em que o código nasce');
    ok(/function documentoCongelado_/.test(codigo) && /congelado: documentoCongelado_\(reg\)/.test(codigo),
       'v8.11: quem abre um PPP concluído lê o arquivo congelado, não uma remontagem com os textos de hoje');

    /* a URL com o código */
    /* v8.13 (C11) — os tetos dos campos de identidade também na tela: sem
       eles, 50.000 caracteres num nome de escola e 10.000 numa SRE entravam
       pela porta e a SRE ia para o datalist e para o quadro das regionais. */
    ok($('#ecNome').getAttribute('maxlength') === '120' &&
       $('#ecMunicipio').getAttribute('maxlength') === '60' &&
       $('#ecSre').getAttribute('maxlength') === '80' &&
       $('#gsNome').getAttribute('maxlength') === '120',
       'v8.13 (C11): nome da escola, município, SRE e nome do diretor têm teto no formulário');
    ok(/const COD_ESCOLA_NOVO = \/\^\[1-9\]/.test(codigo) && /COD_ESCOLA = \/\^\\d\{2,8\}\$\//.test(codigo),
       'v8.13 (C11): o formato de CRIAÇÃO é mais apertado que o de busca — o de busca não muda');
    ok(/const ESCOLA_MAX_NOME = 120/.test(codigo) && /const ESCOLA_MAX_SRE = 80/.test(codigo),
       'v8.13 (C11): e os tetos também estão no servidor, que é quem decide');

    /* v8.13 (C01): quem manda continua sendo o servidor, mas agora em dois
       campos saneados e entregues em atributo — nunca serializados para
       dentro de um bloco de script. */
    ok(w.eval("typeof parametroDaURL") === 'function' &&
       /t\.paramV = paramSaneado_\(par\.v/.test(codigo) && /t\.paramPa = paramSaneado_\(par\.pa/.test(codigo) &&
       !/t\.parametros/.test(codigo),
       'v8.11/v8.13: o código pode vir na URL — quem manda é o servidor, e o valor chega saneado, em atributo');

    ok(erros.length === 0, 'v8.11: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 14. v8.12: a antessala, o histórico e o que não se exclui =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const fonte = require('./montar.js').montar({ demo: true });
    const codigo = require('fs').readFileSync('./Code.gs', 'utf8');

    /* a antessala */
    ok(!!$('#portaEntrada') && !!$('#btnEntrarSistema') && !!$('#btnAutenticarPPP'),
       'v8.12: a abertura oferece entrar no sistema ou autenticar um PPP');
    w.eval('irParaEntrada()');
    ok(!$('#portaEntrada').hidden && $('#portas').hidden && $('#portaVerificar').hidden,
       'v8.12: a escolha vem antes das portas de perfil');
    w.eval('abrirAutenticacao()');
    ok(!$('#portaVerificar').hidden && $('#portas').hidden && w.eval('SESSAO.porta') === '',
       'v8.12: autenticar um PPP não abre sessão nem escolhe perfil');
    w.eval('irParaEntrada(); entrarNoSistema()');
    ok(!$('#portas').hidden && $('#portaEntrada').hidden,
       'v8.12: entrar no sistema leva às portas de perfil');
    ok(w.eval('typeof verDocumentoPublico') === 'function' && /function documentoPublicoHtml/.test(codigo),
       'v8.12: conferido o código, o documento aparece na íntegra — e o servidor o entrega sem sessão');
    ok(/verDocumentoPublico\(\);/.test(fonte),
       'v8.12: e aparece sozinho, sem depender de a pessoa clicar em mais um botão');

    /* o documento congelado, com brasão e código, na tela */
    ok(w.eval('typeof trocarMarcasDoDoc') === 'function' &&
       w.eval("trocarMarcasDoDoc('<i><!--BRASAO--></i>').indexOf('brasaoOficial')") > 0,
       'v8.12: exibido na tela, o congelado recebe o brasão no lugar da marca do PDF');
    w.eval("APP.hash = 'AAAA-BBBB-CCCC';");
    ok(/código de autenticidade AAAA-BBBB-CCCC/.test(w.eval("trocarMarcasDoDoc('<i><!--COD--></i>')")),
       'v8.12: e o código de autenticidade no lugar da marca do rodapé');
    w.eval("APP.hash = '';");

    /* justificação */
    ok(/<p align="justify">/.test(w.eval('docHTML(true).html')),
       'v8.12: o parágrafo que vai para o PDF leva o alinhamento no atributo, que o conversor respeita');
    /* v8.13 (D16): a justificação continua dita três vezes — corpo, parágrafo
       e atributo align —, mas as duas primeiras passaram a viver num arquivo
       SÓ (DocCss.html), que a tela inclui e que montarHtmlPdf_ emite no PDF.
       Conferir a cópia do Code.gs deixou de fazer sentido: ela não existe
       mais, e é justamente isso que D16 garante. */
    const docCss = require('fs').readFileSync('./DocCss.html', 'utf8');
    ok(/\.doc\{[^}]*text-align:justify;text-justify:inter-word/.test(docCss) &&
       /\.doc p\{text-align:justify/.test(docCss),
       'v8.13: a justificação está dita na folha de estilo do documento, no corpo e no parágrafo');
    ok(/\.doc p\{text-align:justify/.test(fonte),
       'v8.13: e a página montada carrega essa folha de estilo (a tela mede com ela)');
    ok(/docCss_\(\)/.test(codigo) && !/text-indent:25mm/.test(codigo),
       'v8.13: o PDF emite a MESMA folha de estilo e o Code.gs não guarda mais cópia dela');

    /* colegiado: sem lote, com relação */
    ok(!/id="colImportar"/.test(fonte) && !/painelImportacao\('colegiado'\)/.test(fonte),
       'v8.12: a aba do colegiado não oferece mais cadastrar vários de uma vez');
    ok(/O cadastro do Colegiado Escolar é feito membro a membro/.test(codigo),
       'v8.12: e o servidor recusa a carga, mesmo chamada por fora da tela');
    ok(/id="colCampoRelacao"/.test(fonte) && /id="colRelacao"/.test(fonte),
       'v8.12: o formulário do membro tem campo para a relação com a escola');
    ok(w.eval("segmentoDeServidorUI('Docente')") === true &&
       w.eval("segmentoDeServidorUI('Pai, mãe ou responsável')") === false,
       'v8.12: a tela sabe quais segmentos são de servidor da rede');
    ok(/const SEGMENTOS_SERVIDOR = \['docente', 'servidor administrativo'\]/.test(codigo) &&
       /function segmentoDeServidor_/.test(codigo),
       'v8.12: o servidor sabe o mesmo, e é ele que decide');
    ok(/const cobraInstitucional = papel !== 'colegiado'/.test(codigo),
       'v8.12: a conta institucional é cobrada de quem é servidor — não de um pai de aluno');
    ok(/papelDe_\(a\) !== 'diretor_escolar'\) return false/.test(codigo),
       'v8.12: e a aba "Contas a regularizar" continua sendo só dos diretores escolares');

    /* histórico em todos os níveis */
    ok(/function historicoAssociacoes/.test(codigo) && /function escopoHistorico_/.test(codigo),
       'v8.12: há um histórico de associações, com escopo dado pela sessão');
    ok(/'Encerrado por', 'Observação'\]/.test(codigo),
       'v8.12: o histórico ganhou quem encerrou o período e a observação do vínculo — ao final das colunas');
    ok(/function gestorFechar_\(chave, motivo, autor\)/.test(codigo),
       'v8.12: encerrar um período passa a exigir quem encerrou');
    ok(!!$('#piAbaHistorico') && $('#piAbaHistorico').hidden && /historicoEmbutidoHTML/.test(fonte),
       'v8.12 → v9.6: o histórico existe, mas mora na caixa de cadastro de cada categoria, não numa aba');
    ok(/atual\.perfil = 'colegiado';/.test(codigo),
       'v8.12: o membro do colegiado tem período próprio, sem disputar o da gestão da escola');

    /* o PPP concluído não se exclui */
    ok(/function recusaExclusaoDePPP_/.test(codigo) && /const ST_INEXCLUIVEIS/.test(codigo),
       'v8.12: a regra da inexclusibilidade está escrita no servidor');
    ok(/Registros de PPP — registro permanente/.test(codigo),
       'v8.12: e a aba dos registros nasce protegida contra edição manual');
    {
      /* nenhuma linha da aba de registros é apagada em lugar nenhum do código */
      const trechos = codigo.split(/\n/);
      const suspeitas = trechos.filter(function (l) {
        return /deleteRow|deleteRows/.test(l) && /abaRegistros_|NOME_ABA\b/.test(l);
      });
      ok(suspeitas.length === 0,
         'v8.12: não há, em nenhum ponto do código, exclusão de linha na aba dos PPPs');
    }

    /* v8.12: "adotar" virou "vincular à escola" — o verbo "associar", no
       sistema, é pôr uma PESSOA numa escola, e é outra coisa */
    ok(w.eval("UI.adotarTitulo") === 'Vincular o PPP à escola' &&
       w.eval("UI.orfaoRotulo") === 'sem escola vinculada',
       'v8.12: o PPP órfão é vinculado à escola, e o selo diz isso');
    ok(/>vincular à escola<\/button>/.test(fonte) && !/>adotar<\/button>/.test(fonte),
       'v8.12: o botão do painel diz "vincular à escola"');
    ok(/PPP vinculado à escola/.test(codigo) && !/PPP adotado para a direção/.test(codigo),
       'v8.12: e é assim que o ato entra na linha do tempo do documento');
    ok(/function adotarPPP/.test(codigo),
       'v8.12: o nome interno da função não muda — chamadas antigas continuam valendo');

    /* v8.13 (F08, acabamento): clicar no balde "(sem SRE)" do quadro tem de
       FILTRAR o painel. O balde não é uma regional e não vem na lista que o
       servidor devolve, de modo que o <select> descartava o valor em silêncio
       e o clique redesenhava o mesmo quadro. */
    {
      const sel = $('#piSre');
      sel.innerHTML = '<option value="">Todas as regionais</option><option>Divinópolis</option>';
      /* o ouvinte está em #piTabela, que é onde o quadro das regionais é desenhado */
      const quadro = d.createElement('div');
      quadro.innerHTML = '<span data-quadro-sre="(sem SRE)">balde</span>';
      d.getElementById('piTabela').appendChild(quadro);
      let pediu = 0;
      const antes = w.eval('carregarPainel');
      w.eval('window.__carregarPainelAntes = carregarPainel; carregarPainel = function(){ window.__pediuPainel = (window.__pediuPainel||0)+1; };');
      quadro.querySelector('[data-quadro-sre]').click();
      pediu = w.eval('window.__pediuPainel') || 0;
      ok(sel.value === '(sem SRE)',
         'v8.13 (F08): clicar no balde "(sem SRE)" põe o filtro no painel, criando a opção que o servidor não manda');
      ok(pediu === 1, 'v8.13 (F08): e recarrega o painel uma vez, já filtrado');
      w.eval('carregarPainel = window.__carregarPainelAntes;');
      quadro.remove();
    }

    /* ===== v8.14: os quatro ajustes da coordenação ===== */

    /* 1. os índices por etapa seguem as etapas marcadas */
    ok(w.eval("typeof indicadorCabe") === 'function' && w.eval("typeof idebCabe") === 'function',
       'v8.14: há uma regra única para os indicadores que dependem da etapa');
    {
      const TELAS14 = w.eval('TELAS');
      const iInd = TELAS14.findIndex(function(x){ return x.tipo === 'indicadores'; });
      const marcar = function(ids){
        w.eval("state.sel.etapas = new Set(" + JSON.stringify(ids) + ");");
        w.irPara(iInd >= 0 ? iInd : 0, true);
      };
      marcar(['efai']);
      ok(!!$('#iIdebAI') && !$('#iIdebAF'),
         'v8.14: marcados só os Anos Iniciais, pede-se o IDEB dos iniciais e não o dos finais');
      ok(!!$('#iIdebAno') && !!$('#iProalfa'),
         'v8.14: e seguem o ano do IDEB e a avaliação de alfabetização, que são dos iniciais');
      marcar(['efaf']);
      ok(!$('#iIdebAI') && !!$('#iIdebAF'),
         'v8.14: marcados só os Anos Finais, é o contrário — e era este o caso relatado');
      ok(!$('#iProalfa'),
         'v8.14: sem anos iniciais não se pergunta resultado de alfabetização');
      marcar(['efai','efaf']);
      ok(!!$('#iIdebAI') && !!$('#iIdebAF') && !!$('#iIdebAno'),
         'v8.14: com as duas etapas, os dois índices voltam');
      marcar(['em']);
      ok(!$('#iIdebAI') && !$('#iIdebAF') && !!$('#iIdebEM') && !!$('#iIdebAno'),
         'v8.14/v9.2: só Ensino Médio — nem iniciais nem finais; pede-se o IDEB do ensino médio, e o ano fica');
      ok(/Ensino Médio/.test(($('.ind-etapas-nota') || {}).textContent || '') && /IDEB do ensino médio/.test(($('.ind-etapas-nota') || {}).textContent || '') && !!$('#btnMudarEtapas'),
         'v9.2: a tela diz quais etapas estão marcadas, o que se pede por causa delas, e oferece o caminho para mudar');
      marcar(['ei']);
      ok(!$('#iIdebAI') && !$('#iIdebAF') && !$('#iIdebEM') && /não se pede IDEB/.test(($('.ind-etapas-nota') || {}).textContent || ''),
         'v9.2: etapa sem IDEB próprio (Educação Infantil) — a nota diz que não se pede, em vez de deixar a dúvida');
      w.eval("state.ind.idebEM = '4,1'; state.ind.etapas.em = {mat:'120'}; state.sel.etapas = new Set(['em']);");
      ok(w.eval("docHTML(false).html").indexOf('IDEB ensino médio: 4,1') > 0, 'v9.2: o IDEB do ensino médio entra no documento');
      w.eval("state.sel.etapas = new Set(['efai']);");
      ok(w.eval("docHTML(false).html").indexOf('IDEB ensino médio') < 0, 'v9.2: e sai dele quando a etapa não está marcada — sem apagar o valor');
      w.eval("state.ind.idebEM = ''; delete state.ind.etapas.em;");
      /* o valor não se perde: deixa de ser pedido, não de existir */
      w.eval("state.ind.idebAI = '5,8'; state.sel.etapas = new Set(['efaf']);");
      const doc = w.eval("docHTML(false).html");
      ok(doc.indexOf('IDEB anos iniciais') < 0,
         'v8.14: índice de etapa desmarcada não entra no documento');
      ok(w.eval("state.ind.idebAI") === '5,8',
         'v8.14: mas o valor continua gravado — desmarcar por engano não apaga dado');
      w.eval("state.ind.idebAI = ''; state.sel.etapas = new Set(['efai','efaf']);");
    }

    /* 2. o percurso termina na validação */
    ok(!!$('#cardValidacao') && !!$('#btnEnviarValidacao') && !!$('#cardEmValidacao'),
       'v8.14: a tela final tem o cartão de envio para validação e o de documento em validação');
    ok(w.eval("typeof enviarValidacaoDaTela") === 'function',
       'v8.14: e o envio acontece pela própria tela final, não só pelo painel');
    {
      const estados = function(st){
        w.eval("APP.status = '" + st + "'; APP.protocolo = 'PPP-2026-0001-XXXX'; montarTelaFinal();");
        return { valid: !$('#cardValidacao').hidden, emVal: !$('#cardEmValidacao').hidden,
                 concl: !$('#cardConcluir').hidden };
      };
      const a = estados('Em andamento'), b = estados('Em validação'), c = estados('Validado');
      ok(a.valid && !a.concl, 'v8.14: em elaboração — enviar para validação, e só isso');
      ok(b.emVal && !b.valid && !b.concl, 'v8.14: em validação — nem enviar de novo, nem concluir');
      ok(c.concl && !c.valid && !c.emVal, 'v8.14: validado — aí sim, concluir e congelar para as assinaturas');
      w.eval("APP.status = 'Em andamento'; APP.protocolo = null; montarTelaFinal();");
      ok(!$('#cardValidacao').hidden && $('#btnEnviarValidacao').disabled &&
         /Salve o PPP/.test($('#btnEnviarValidacaoTxt').textContent),
         'v8.14: sem protocolo salvo o cartão continua à vista, e é o botão que explica o que falta');
    }

    /* 3. a caixa do exemplo saiu (conferida também no bloco da 8.8) */
    ok(fonte.indexOf('>Ver um exemplo de preenchimento<') < 0 &&
       fonte.indexOf('<summary>Ver um exemplo') < 0,
       'v8.14: a caixa "Ver um exemplo de preenchimento" não é mais escrita em lugar nenhum da página' +
       ' (a frase só sobrevive nos comentários que contam por que ela saiu)');
    ok(fonte.indexOf('.exemplo-campo{') < 0,
       'v8.14: e o estilo da caixa saiu junto');

    /* 4. nenhuma caixa com traço colorido à esquerda */
    {
      const css = require('fs').readFileSync('./Css.html', 'utf8');
      const sobrou = (css.match(/border-left:\s*[0-9]+px[^;}]*/g) || [])
        .filter(function(r){ return !/transparent/.test(r); });
      /* o fio da linha do tempo e o bloco do modo de edição não são borda de
         caixa — são os dois únicos que podem sobrar */
      const linhas = css.split(/\n/).filter(function(l){
        return /border-left:\s*[0-9]+px/.test(l) && !/transparent/.test(l);
      });
      ok(linhas.every(function(l){ return /\.linha-tempo|\.ed-exemplo/.test(l); }),
         'v8.14: nenhuma caixa da interface usa traço colorido à esquerda' +
         (linhas.length ? ' (sobraram: ' + linhas.map(function(l){ return l.split('{')[0].trim(); }).join(', ') + ')' : ''));
      ok(sobrou.length <= 2, 'v8.14: e o que restou são dois casos, não uma prática');
    }

    /* ===== v8.15: a folha não corta, e a medida tem folga ===== */
    {
      const doccss = require('fs').readFileSync('./DocCss.html', 'utf8');
      ok(!/\.doc \.pag-corpo\{[^}]*overflow:hidden/.test(doccss),
         'v8.15: o corpo da folha não esconde mais o que passa — documento oficial não corta texto em silêncio');
      ok(/\.doc\.medindo \.pag-corpo[^}]*height:249mm/.test(doccss),
         'v8.15: e a paginação é medida contra uma caixa menor que a folha, para absorver a diferença entre quem mede e quem imprime');
      ok(!/\.doc \.pagina\{[^}]*overflow:hidden/.test(doccss),
         'v8.15: a folha também não corta');
    }
    ok(w.eval("dividirBloco.toString().indexOf('tHead')") > 0,
       'v8.15: a tabela partida leva o cabeçalho para a folha seguinte');
    ok(w.eval("dividirBloco.toString().indexOf(\"createElement('tbody')\")") > 0,
       'v8.15: e um corpo de tabela de verdade, e não linhas soltas dentro da <table>');
    ok(w.eval("paginar.toString().indexOf('conferirFolhas')") > 0,
       'v8.15: depois de paginar, as folhas são conferidas uma a uma, e o que sobrou desce para a seguinte');

    /* ===== v9.2: quatro erros apontados no celular ===== */
    {
      const css = require('fs').readFileSync('./Css.html', 'utf8');
      const app = require('fs').readFileSync('./App.html', 'utf8');
      ok(/@media \(max-width:760px\)\{[^]*?\.tab-gestao th:last-child,\.tab-gestao td:last-child\{width:auto\}/.test(css),
         'v9.2: no celular a coluna de ações do painel institucional perde os 14% e ocupa o cartão inteiro');
      ok(/\.pi-tabela \.proto,\.tab-gestao td\.col-escola \.proto\{white-space:normal;overflow-wrap:anywhere\}/.test(css),
         'v9.2: e o protocolo em monoespaçada quebra em vez de sair do cartão');
      ok(/\.badge-proto\{[^}]*display:inline-block;border-radius:14px/.test(css),
         'v9.2: o selo do perfil, quando quebra em duas linhas no celular, é um bloco com a borda inteira');
      ok(/\.form-body p,\.form-body li,\n\.lista-mark li,\n\.perguntas li,\n\.hint,/.test(css) && /\.leitura\{text-align:justify;text-justify:inter-word;hyphens:auto;-webkit-hyphens:auto\}/.test(css),
         'v9.2: o texto corrido da interface volta a sair justificado, com hifenização, em toda tela');
      ok(/\.card-dest p,\.card-atencao p/.test(css) && /\.bloco-escrita textarea,\.cur-campos textarea,/.test(css) && /\.aviso-cx p,\.aviso-cx span/.test(css),
         'v9.2: as caixas de destaque, os avisos e os campos de escrita entram na justificação');
      ok(!/FREIRE|VEIGA|Freire|Veiga|Libâneo|Saviani|Gadotti|Vasconcellos/.test(app) && !/FREIRE|VEIGA/.test(fonte),
         'v9.2: nenhum autor é citado no sistema — o exemplo de referência é um molde ABNT sem nome');
      const campo = w.eval("TELAS.find(function(t){ return (t.campos||[]).some(function(c){ return c.id === 'tReferencias'; }); }).campos.find(function(c){ return c.id === 'tReferencias'; }).placeholder");
      ok(/^SOBRENOME, Nome\./.test(campo) && campo.split('\n').length === 2, 'v9.2: o molde tem uma linha para livro e outra para artigo (' + campo.split('\n')[0].slice(0, 30) + '…)');
    }

    /* ===== v9.7: cada nível administra só o nível imediatamente abaixo ===== */
    {
      const gs = require('fs').readFileSync('./Code.gs', 'utf8');
      ok(/const PAPEIS_ASSOCIAM = \['diretor_educacional', 'equipe_de'\];/.test(gs),
         'v9.7: quem gere os diretores escolares é a Diretoria Educacional e a sua equipe — e mais ninguém');
      ok(/const padrao = \(PAPEIS\[papel\] \|\| \{ cadastra: \[\] \}\)\.cadastra\.slice\(\);/.test(gs),
         'v9.7: cada perfil lista o que CADASTRA — o Órgão Central deixou de listar todos os institucionais');
      ok(/function podeGerirBase_\(papel\) \{ return papel === 'central' \|\| podeAssociar_\(papel\); \}/.test(gs),
         'v9.7: a base da rede e a carga da implantação continuam com o Órgão Central, além da Diretoria Educacional');
      ok(/if \(s\.perfil === 'central'\) return \['superintendente'\];/.test(gs),
         'v9.7: o histórico do Órgão Central é o dos superintendentes');
      /* a cascata que a TELA espelha é a mesma do servidor */
      const ui = w.eval('JSON.stringify(Object.keys(PAPEIS_UI).map(function(k){ return k + ":" + (PAPEIS_UI[k].cadastra || []).join("+"); }))');
      ok(JSON.parse(ui).join(' | ') === 'central:central+superintendente | superintendente:diretor_educacional+coordenador_inspecao | ' +
         'diretor_educacional:equipe_de | coordenador_inspecao:equipe_inspecao | equipe_de: | equipe_inspecao: | diretor_escolar:colegiado | colegiado:',
         'v9.7: a cascata da tela é a do servidor — Central→Superintendente→(DE, Coordenação)→equipes; Direção→Colegiado');
      /* as abas seguem a competência: só quem gere diretores tem "Acessos das escolas" */
      const abas = function (perfil, papel, podeAssociar, central) {
        w.eval('SESSAO.perfil = ' + JSON.stringify(perfil) + '; SESSAO.papel = ' + JSON.stringify(papel) +
               '; SESSAO.cadastra = ' + JSON.stringify((w.eval('PAPEIS_UI')[papel] || {}).cadastra || []) +
               '; SESSAO.podeAssociar = ' + (podeAssociar ? 'true' : 'false') + ';');
        w.abrirPainelInst();
        return { acessos: !d.getElementById('piAbaAcessos').hidden, escolas: !d.getElementById('piAbaEscolas').hidden,
                 contas: !d.getElementById('piAbaContas').hidden, equipe: !d.getElementById('piAbaEquipe').hidden,
                 inst: !d.getElementById('piAbaInst').hidden };
      };
      const aCentral = abas('central', 'central', false, true);
      ok(!aCentral.acessos && !aCentral.contas && aCentral.escolas && aCentral.inst,
         'v9.7: o Órgão Central tem a base da rede e o acesso do superintendente — não os diretores escolares');
      const aSup = abas('regional', 'superintendente', false);
      ok(!aSup.acessos && !aSup.escolas && !aSup.contas && aSup.equipe,
         'v9.7: o Superintendente tem só a própria equipe — Diretores Educacionais e Coordenador de Inspeção');
      const aDE = abas('regional', 'diretor_educacional', true);
      ok(aDE.acessos && aDE.escolas && aDE.contas && aDE.equipe,
         'v9.7: a Diretoria Educacional gere os diretores escolares, a base da sua regional e a própria equipe');
      const aEqDE = abas('regional', 'equipe_de', true);
      ok(aEqDE.acessos && aEqDE.contas && !aEqDE.equipe,
         'v9.7: a equipe da Diretoria Educacional também gere os diretores, e não cadastra ninguém');
      const aCI = abas('regional', 'coordenador_inspecao', false);
      ok(!aCI.acessos && !aCI.escolas && aCI.equipe,
         'v9.7: a Coordenação de Inspeção cadastra só a própria equipe de inspetores');
      const aEqCI = abas('regional', 'equipe_inspecao', false);
      ok(!aEqCI.acessos && !aEqCI.escolas && !aEqCI.equipe && !aEqCI.contas,
         'v9.7: a equipe de Inspeção só lê');
    }

    /* ===== v9.5: a ação em destaque dentro do menu "Ações" ===== */
    {
      const css = require('fs').readFileSync('./Css.html', 'utf8');
      ok(/\.acoes-menu-lista \.pi-acao\.forte,\.acoes-menu-lista \.pi-acao\.forte\.muda\{background:var\(--azul-gelo\);color:var\(--azul-profundo\)/.test(css),
         'v9.5: dentro do menu, "homologar"/"validar" é um item claro — tinta escura sobre fundo gelo, e não escuro sobre escuro');
      ok(/\.acoes-menu\{flex-direction:column\}/.test(css), 'v9.5: no celular a lista de ações abre abaixo de "Ações"');
    }

    /* ===== v9.4: nada passa por sistema de processos ===== */
    {
      const gs = require('fs').readFileSync('./Code.gs', 'utf8');
      const demo = require('fs').readFileSync('./Demo.html', 'utf8');
      const prod = require('./montar.js').montar({ demo: false });
      ok(!/\bSEI\b/.test(prod) && !/\bSEI\b/.test(demo) && (fonte.match(/\bSEI\b/g) || []).length === 1,
         'v9.4: a página de implantação e a base de demonstração não mencionam o SEI (na demonstração sobra só o Code.gs embutido, com o rótulo antigo)');
      ok((gs.match(/\bSEI\b/g) || []).length === 1 && /CABECALHOS_ANTIGOS_ = \{ 'Homologação — ato': \['Homologação — ato \(SEI\/ofício\)'\] \}/.test(gs),
         'v9.4: no servidor o SEI só sobrevive no rótulo antigo aceito pela conferência de cabeçalho');
      const t = w.eval('TELAS');
      const txts = JSON.stringify(t);
      ok(!/SEI\b|unidade SEI|envia o PDF final ao e-mail/.test(txts) && /segue automaticamente/.test(txts),
         'v9.4: os textos formativos sobre homologação dizem que o documento segue pelo próprio sistema');
    }

    /* ===== v9.1: a folha na tela é a folha do papel ===== */
    {
      const idx = require('fs').readFileSync('./Index.html', 'utf8');
      const css = require('fs').readFileSync('./Css.html', 'utf8');
      const gs = require('fs').readFileSync('./Code.gs', 'utf8');
      const docFonte = require('fs').readFileSync('./DocFonte.html', 'utf8');
      ok(/include\('DocFonte'\)/.test(idx) && idx.indexOf("include('DocFonte')") < idx.indexOf("include('DocCss')"),
         'v9.1: o Index embute a fonte do documento antes da folha de estilo');
      ok((docFonte.match(/@font-face\{font-family:Carlito;font-style:(normal|italic);font-weight:(400|700);font-display:block;src:url\(data:font\/woff2;base64,/g) || []).length === 4,
         'v9.1: DocFonte.html traz as quatro faces de Carlito em WOFF2, embutidas em base64');
      ok(docFonte.length < 200000, 'v9.1: o subconjunto latino da fonte pesa menos de 200 KB (' + Math.round(docFonte.length / 1024) + ' KB)');
      ok(fonte.indexOf('id="docFonteFonte"') > 0 && fonte.indexOf('id="docFonteFonte"') < fonte.indexOf('id="docCssFonte"'),
         'v9.1: a página montada carrega a fonte antes de DocCss');
      ok(/function docFonte_\(\)/.test(gs) && gs.indexOf('docFonte_() +') > 0 && gs.indexOf('docFonte_() +') < gs.indexOf('docCss_() +'),
         'v9.1: montarHtmlPdf_ emite a fonte antes da folha de estilo — o conversor imprime com a letra com que a tela mediu');
      const B = w.eval('DEMO.backend()');
      const pdfHtml = B.montarHtmlPdf_('<div class="paginas"><div class="pagina"><div class="pag-corpo"><p>x</p></div></div></div>', 'COD');
      ok((pdfHtml.match(/@font-face\{font-family:Carlito/g) || []).length === 4 && pdfHtml.indexOf('@font-face') < pdfHtml.indexOf('.doc .pagina{'),
         'v9.1: na demonstração, o HTML do PDF sai com as quatro faces (o simulador resolve include(\'DocFonte\'))');
      ok(!/\.docwrap--full \.doc p[^{]*\{[^}]*text-align:left/.test(css) && !/\.docwrap--mini \.doc\{font-size/.test(css),
         'v9.1: nem alinhamento à esquerda no celular, nem tamanho de letra próprio na prévia: a folha é a mesma em toda tela');
      ok(w.eval("ajustarEscalaDoc.toString().indexOf('style.transform')") > 0 && w.eval("ajustarEscalaDoc.toString().indexOf(\"style.zoom = ''\")") > 0,
         'v9.1: a folha é escalada por transform, e o zoom antigo é apagado — a linha quebra onde foi medida em qualquer escala');
      ok(typeof w.acomodarFolhas === 'function' && typeof w.exibirFolhas === 'function' && typeof w.prepararFontesDoDoc === 'function' && typeof w.renumerarFolhas === 'function',
         'v9.1: acomodarFolhas, exibirFolhas, renumerarFolhas e prepararFontesDoDoc existem');
      ok((fonte.match(/exibirFolhas\(\$\('#doc(Full|Mini)'\)/g) || []).length >= 5,
         'v9.1: toda folha exibida passa por exibirFolhas — prévia lateral, tela cheia, congelado e porta pública');
      ok(/prepararFontesDoDoc\(\);/.test(w.bootstrap.toString()), 'v9.1: a fonte é preparada no bootstrap, antes de qualquer folha');
      ok(w.eval("acomodarFolhas.toString().indexOf('dividirBloco')") > 0 && w.eval("acomodarFolhas.toString().indexOf('ehTituloDoc')") > 0 && w.eval("acomodarFolhas.toString().indexOf(\"classList.contains('cont')\")") > 0,
         'v9.1: a acomodação parte o parágrafo, não deixa título sozinho no pé e reemenda o parágrafo que se reencontra');
      /* sem geometria (jsdom) a acomodação não mexe em nada — e não quebra */
      const cx = d.createElement('div'); cx.className = 'doc';
      cx.innerHTML = '<div class="paginas"><div class="pagina"><div class="pag-corpo"><p>a</p><p>b</p></div><div class="pag-rodape"><span class="pag-cod">COD</span><span class="pag-num"></span></div></div>' +
        '<div class="pagina"><div class="pag-corpo"><p>c</p></div></div><div class="pagina"><div class="pag-corpo"><p>d</p></div></div></div>';
      d.body.appendChild(cx);
      ok(w.acomodarFolhas(cx) === 0 && cx.querySelectorAll('.pag-corpo > p').length === 4,
         'v9.1: sem geometria a acomodação devolve 0 e não toca nas folhas');
      w.renumerarFolhas(cx.querySelector('.paginas'));
      const pags = Array.from(cx.querySelectorAll('.pagina'));
      ok(pags.every(function(p, i){ return p.getAttribute('data-pag') === String(i + 1) && p.getAttribute('data-de') === '3'; }) &&
         pags.map(function(p){ return p.querySelector('.pag-num').textContent; }).join('|') === '|2|3' &&
         pags.every(function(p){ return p.querySelector('.pag-cod').textContent === 'COD'; }),
         'v9.1: renumerarFolhas numera a partir da segunda folha e leva o rodapé com o código às folhas que não o tinham');
      cx.remove();
    }
    ok(/if\(palavras\.length < 12\) return null;/.test(fonte),
       'v8.15: parágrafo a partir de doze palavras já pode continuar na folha seguinte (eram vinte e quatro)');

    ok(erros.length === 0, 'v8.12: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 15. v8.13 (D09): o texto digitado durante a gravação não se perde =============== */
  {
    /* um servidor de mentira que só responde quando mandarmos: é assim que se
       reproduz a rede de escola, com 2,5 s entre o envio e a resposta */
    let chamadas = [], pendentes = [];
    const fake = w => ({ script: { run: new Proxy({}, {
      get: (_, nome) => {
        if (nome === 'withSuccessHandler') return fn => { fake._ok = fn; return w.google.script.run; };
        if (nome === 'withFailureHandler') return fn => { fake._err = fn; return w.google.script.run; };
        return (...args) => {
          /* v8.13 (E01): o pedido chega embrulhado em api({fn, args}) */
          let a = args[0] || {};
          let nome2 = nome;
          if (nome2 === 'api') { nome2 = String(a.fn || ''); a = a.args || {}; }
          const okFn = fake._ok, errFn = fake._err;
          chamadas.push([nome2, a]);
          if (nome2 === 'salvarPPP'){
            pendentes.push(function(res){
              okFn(res || { ok:true, protocolo: a.protocolo || 'PPP-2026-0099-D09', versao: 1,
                            rev: (parseInt(a.rev,10)||0) + 1, atualizadoEm: '19/09/2026 05:42' });
            });
            return;
          }
          setTimeout(() => {
            if (nome2 === 'contexto') return okFn({ email:'diretora@educacao.mg.gov.br', admin:false, controleAtivo:false, identificado:false, urlApp:'https://x' });
            if (nome2 === 'conteudoPublicado') return okFn({ versao:0, itens:{}, padroes:{} });
            if (nome2 === 'buscarPPP') return okFn({ ok:true, registro: { protocolo:'PPP-2026-0099-D09', versao:1, rev:9,
              status:'Em andamento', escola:'EE do Voo', inep:'31000099', tela:0,
              etapas:[], mods:[], infra:[], temas:[], principios:[], metodos:[],
              tApresentacao:'O QUE ESTÁ GRAVADO NO SERVIDOR', assinaturas:'[]', anexos:'[]' } });
            okFn({ ok:true });
          }, 5);
        };
      } }) } });
    const { w, d, erros } = carrega('./Index.html', fake);
    await espera(40);
    const state = w.eval('state'), APP = w.eval('APP');
    const CHAVE = 'ppp.rascunho.PPP-2026-0099-D09';
    w.localStorage.removeItem(CHAVE);

    ok(w.eval('typeof conteudoDe') === 'function',
       'D09: existe o instantâneo do conteúdo enviado');
    {
      const a = w.coletarDados();
      const b = w.coletarDados(); b.token = 'outro'; b.sessao = 'outra'; b.rev = 99; b.status = 'X'; b.tela = 7;
      ok(w.conteudoDe(a) === w.conteudoDe(b),
         'D09: credencial, revisão, status e tela atual não contam como conteúdo');
      const c = w.coletarDados(); c.tApresentacao = (c.tApresentacao || '') + '!';
      ok(w.conteudoDe(a) !== w.conteudoDe(c), 'D09: um caractere a mais no texto conta');
    }

    /* o caso do achado A4-01 — digitar durante o voo */
    APP.protocolo = 'PPP-2026-0099-D09'; APP.status = 'Em andamento'; APP.rev = 3;
    state.dados.escola = 'EE do Voo'; state.dados.inep = '31000099';
    state.txt.tApresentacao = 'TEXTO-A'; w.eval('APP.sujo = true;');
    chamadas.length = 0; pendentes.length = 0;
    w.autoSalvar();
    ok(chamadas.filter(c => c[0] === 'salvarPPP').length === 1 && APP.emVoo === true,
       'D09: o salvamento foi enviado e a tela sabe que há uma gravação em voo');
    /* durante o voo, a escola continua escrevendo */
    state.txt.tApresentacao = 'TEXTO-A + TEXTO-B-DIGITADO-DURANTE-O-SALVAMENTO';
    /* e um segundo autossalvamento não dispara outra chamada */
    w.autoSalvar();
    ok(chamadas.filter(c => c[0] === 'salvarPPP').length === 1 && APP.salvarDeNovo === true,
       'D09: com uma gravação em voo, a seguinte espera em vez de disputar a mesma revisão');
    pendentes.shift()();            /* chega a resposta de TEXTO-A */
    await espera(20);
    ok(APP.sujo === true,
       'D09: o que foi digitado durante o voo mantém o PPP como "alterações não salvas"');
    const rasc = JSON.parse(w.localStorage.getItem(CHAVE) || 'null');
    ok(!!rasc && /TEXTO-B-DIGITADO-DURANTE-O-SALVAMENTO/.test(rasc.dados.tApresentacao || ''),
       'D09: e o rascunho do navegador guarda o texto novo, em vez de ser apagado');
    {
      const ev = new w.Event('beforeunload', {bubbles:false, cancelable:true});
      w.dispatchEvent(ev);
      ok(ev.defaultPrevented === true, 'D09: fechar a aba passaria a avisar');
    }
    ok(chamadas.filter(c => c[0] === 'salvarPPP').length === 2 &&
       /TEXTO-B-DIGITADO-DURANTE-O-SALVAMENTO/.test(chamadas[chamadas.length-1][1].tApresentacao || ''),
       'D09: o pedido represado é reenviado com o texto de agora, assim que a resposta chega');

    /* o caso normal: nada é digitado durante o voo */
    pendentes.shift()();
    await espera(20);
    ok(APP.sujo === false && !w.localStorage.getItem(CHAVE),
       'D09: sem digitação durante o voo, o PPP fica salvo e o rascunho sai do navegador');
    ok(APP.emVoo === false && APP.salvarDeNovo === false, 'D09: e nada fica represado');
    ok(APP.rev === 5, 'D09: a revisão devolvida pelo servidor é a que a tela passa a carregar');

    /* mudar de tela não é escrever */
    state.tela = 3; w.eval('APP.sujo = true;');
    chamadas.length = 0; pendentes.length = 0;
    w.autoSalvar(); state.tela = 9; pendentes.shift()();
    await espera(20);
    ok(APP.sujo === false, 'D09: navegar durante o voo não deixa o PPP como não salvo');

    /* D09 × D01: o conflito de revisão NÃO pode apagar o rascunho local */
    {
      w.localStorage.removeItem(CHAVE);
      state.txt.tApresentacao = 'TEXTO QUE A OUTRA ABA NÃO TEM';
      w.eval('APP.sujo = true;');
      chamadas.length = 0; pendentes.length = 0;
      w.confirmarAuto = false;                 /* o diálogo do conflito fica aberto */
      w.autoSalvar();
      pendentes.shift()({ ok:false, conflito:true, rev: 9, atualizadoEm:'19/09/2026 05:50',
                          erro:'Este PPP foi gravado por outra pessoa.', registro:{} });
      await espera(20);
      const g = w.localStorage.getItem(CHAVE) || '';
      ok(/TEXTO QUE A OUTRA ABA NÃO TEM/.test(g),
         'D09 × D01: recusado por conflito de revisão, o rascunho local CONTINUA com o texto da tela');
      ok(APP.sujo === true, 'D09 × D01: e o PPP continua marcado como não salvo');
      ok(APP.emVoo === false, 'D09 × D01: a recusa também solta o voo');
      d.querySelector('#avisoCancelar').click();   /* "Ver o que está gravado" */
      await espera(20);
      w.confirmarAuto = true;
      ok(!!w.localStorage.getItem(CHAVE),
         'D09 × D01: nem o caminho de "ver o que está gravado" apaga o rascunho');
    }

    /* sem resposta do servidor, a tela não pode parar de salvar */
    w.eval('APP.sujo = true;');
    chamadas.length = 0; pendentes.length = 0;
    w.autoSalvar();
    fake._err(new Error('falha de rede'));
    await espera(20);
    ok(APP.emVoo === false, 'D09: a falha solta o voo — a tela continua podendo salvar');
    ok(!d.querySelector('#tarjaSalvar').hidden && !!w.localStorage.getItem(CHAVE),
       'D09: e a falha deixa a tarja à vista, com o texto guardado no navegador');
    w.localStorage.removeItem(CHAVE);
    ok(erros.length === 0, 'D09: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 16. v8.13 (D10): o rascunho compara conteúdo, não relógio =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const state = w.eval('state'), APP = w.eval('APP'), GRUPOS = w.eval('GRUPOS');
    const PROT = 'PPP-2026-0099-D10', CHAVE = 'ppp.rascunho.' + PROT;
    const gravarRascunho = (dados, em) => w.localStorage.setItem(CHAVE,
      JSON.stringify({em: em === undefined ? Date.now() : em, protocolo: PROT, dados: dados}));

    ok(w.eval('typeof msDeDataBR') === 'undefined',
       'D10: a leitura do carimbo do servidor no fuso do navegador saiu do código');
    ok(w.eval('typeof ROTULO_DO_CAMPO') === 'object' &&
       w.eval('ROTULO_DO_CAMPO.tApresentacao') && w.eval('ROTULO_DO_CAMPO.escola') === 'Nome da escola',
       'D10: há um mapa de rótulos de tela, montado das TELAS e da identificação');

    /* (1) rascunho SÓ com marcações, detalhamentos e indicadores (A4-02) */
    APP.protocolo = PROT; APP.status = 'Em andamento';
    state.dados.escola = 'EE do Rascunho'; state.dados.inep = '31000010';
    Object.keys(state.sel).forEach(g => state.sel[g] = new w.Set());
    state.det = {}; state.ind = {ano:'', etapas:{}}; state.tarefas = {};
    {
      const base = w.coletarDados();
      const rasc = Object.assign({}, base);
      rasc.temas = ['Educação ambiental'];
      rasc.selecoes = JSON.stringify({etapas:[], mods:['ept'], infra:[], temas:['ambiental'], principios:[], metodos:[]});
      rasc.mods = ['Educação Profissional e Tecnológica'];
      rasc.detalhes = JSON.stringify({ept:{cursos:'Técnico em Enfermagem'}});
      rasc.indicadores = JSON.stringify({ano:'2025', etapas:{ef1:{mat:'320'}}});
      delete rasc.token; delete rasc.sessao;
      gravarRascunho(rasc);
      const dif = w.diferencasDoRascunhoLocal({dados: rasc});
      ok(dif.length > 0, 'D10: rascunho só com marcações, detalhes e indicadores JÁ conta como diferença');
      ok(dif.some(x => /indicador/i.test(x)) && dif.some(x => /oferta|modalidade/i.test(x) || /marca/i.test(x)),
         'D10: e a diferença é nomeada pelo rótulo da tela, não pela chave interna');
      /* a oferta acontece de verdade, com os campos nomeados no diálogo */
      w.confirmarAuto = false;
      w.ofertarRascunhoLocal({atualizadoEm:'19/09/2026 05:40'});
      const visivel = !d.querySelector('#ovAviso').hidden;
      const texto = d.querySelector('#avisoTexto').textContent;
      ok(visivel && /\d+ campos? difere/.test(texto), 'D10: a oferta acontece e diz quantos campos diferem');
      ok(/substitui/i.test(texto) && /indicador/i.test(texto),
         'D10: o diálogo diz que aceitar substitui, e nomeia os campos');
      d.querySelector('#avisoOk').click();
      w.confirmarAuto = true;
      ok(state.sel.temas.has('ambiental') && state.sel.mods.has('ept'),
         'D10: aceita a oferta, as marcações voltam');
      ok(state.det.ept && state.det.ept.cursos === 'Técnico em Enfermagem', 'D10: os detalhamentos voltam');
      ok(state.ind.etapas && state.ind.etapas.ef1 && state.ind.etapas.ef1.mat === '320', 'D10: e os indicadores voltam');
    }

    /* (2) rascunho idêntico ao que está aberto: descartado sem perguntar */
    {
      const igual = w.coletarDados(); delete igual.token; delete igual.sessao;
      gravarRascunho(igual);
      w.confirmarAuto = false;
      w.ofertarRascunhoLocal({atualizadoEm:'19/09/2026 05:40'});
      ok(d.querySelector('#ovAviso').hidden && !w.localStorage.getItem(CHAVE),
         'D10: rascunho igual ao que o servidor devolveu é descartado sem perguntar');
      w.confirmarAuto = true;
    }

    /* (3) relógio adiantado/atrasado em 3 h × três formatos de carimbo:
           o comportamento tem de ser o MESMO nos seis casos */
    {
      const TRES_H = 3 * 3600 * 1000;
      /* o carimbo é o de AGORA: é assim que os desvios de 3 h ficam de um lado
         e do outro dele — que é onde a decisão por relógio mudava de resposta.
         Três formatos: o do fuso do script, o do locale en-US da planilha e o ISO. */
      const ag = new Date(), dd = n => ('0' + n).slice(-2);
      const formatos = [
        dd(ag.getDate()) + '/' + dd(ag.getMonth()+1) + '/' + ag.getFullYear() + ' ' + dd(ag.getHours()) + ':' + dd(ag.getMinutes()),
        (ag.getMonth()+1) + '/' + ag.getDate() + '/' + ag.getFullYear() + ' ' + ag.getHours() + ':' + dd(ag.getMinutes()) + ':00',
        ag.getFullYear() + '-' + dd(ag.getMonth()+1) + '-' + dd(ag.getDate()) + 'T' + dd(ag.getHours()) + ':' + dd(ag.getMinutes()) + ':00'
      ];
      const resultados = [];
      formatos.forEach(function(fmt){
        [-TRES_H, +TRES_H].forEach(function(desvio){
          const rasc = w.coletarDados(); delete rasc.token; delete rasc.sessao;
          rasc.tApresentacao = 'texto que não chegou a ser gravado';
          gravarRascunho(rasc, Date.now() + desvio);
          w.confirmarAuto = false;
          w.ofertarRascunhoLocal({atualizadoEm: fmt});
          resultados.push(!d.querySelector('#ovAviso').hidden);
          d.querySelector('#avisoCancelar').click();      /* descartar */
          w.confirmarAuto = true;
        });
      });
      ok(resultados.length === 6 && resultados.every(x => x === true),
         'D10: com o relógio do navegador 3 h à frente ou atrás, e em três formatos de carimbo, ' +
         'o rascunho com texto novo é oferecido nos seis casos');
    }

    /* (4) tarefas voltam; id que não existe mais em GRUPOS não entra */
    {
      state.tarefas = {}; Object.keys(state.sel).forEach(g => state.sel[g] = new w.Set());
      const rasc = w.coletarDados(); delete rasc.token; delete rasc.sessao;
      rasc.tarefas = JSON.stringify({t05:{0:true, 1:true}});
      const valido = GRUPOS.temas[0].id;
      rasc.selecoes = JSON.stringify({etapas:[], mods:[], infra:[], temas:[valido, 'id-que-nao-existe-mais'], principios:[], metodos:[]});
      gravarRascunho(rasc);
      w.aplicarRascunhoLocal({dados: rasc});
      ok(JSON.stringify(state.tarefas).indexOf('t05') >= 0,
         'D10: os itens de preparação confirmados voltam com o rascunho (A4-14)');
      ok(state.sel.temas.has(valido) && !state.sel.temas.has('id-que-nao-existe-mais'),
         'D10: e um id que não existe mais em GRUPOS não entra no estado');
    }
    w.localStorage.removeItem(CHAVE);
    ok(erros.length === 0, 'D10: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 17. v8.13 (D11): o rascunho que não coube avisa =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const state = w.eval('state'), APP = w.eval('APP');
    const PREF = 'ppp.rascunho.';
    const contar = () => { let n = 0; for(let i=0;i<w.localStorage.length;i++){ const k = w.localStorage.key(i); if(k && k.indexOf(PREF)===0) n++; } return n; };
    const limparTudo = () => { const ks=[]; for(let i=0;i<w.localStorage.length;i++){ const k=w.localStorage.key(i); if(k&&k.indexOf(PREF)===0) ks.push(k); } ks.forEach(k=>w.localStorage.removeItem(k)); };

    ok(w.eval('RASC_MAX') === 2, 'D11: o navegador passa a guardar 2 rascunhos, não 3');

    /* a poda aceita um teto e nunca apaga o PPP que está aberto */
    limparTudo();
    APP.protocolo = 'PPP-2026-0099-D11'; APP.status = 'Em andamento';
    state.dados.escola = 'EE da Cota'; state.dados.inep = '31000011';
    ['A','B','C'].forEach((x,i) => w.localStorage.setItem(PREF + 'PPP-2020-000' + i + '-' + x,
      JSON.stringify({em: 1000 + i, protocolo:'PPP-2020-000'+i+'-'+x, dados:{tApresentacao:'velho'}})));
    w.localStorage.setItem(PREF + 'PPP-2026-0099-D11', JSON.stringify({em: 50, protocolo:'PPP-2026-0099-D11', dados:{tApresentacao:'o aberto'}}));
    w.podarRascunhosLocais(1);
    ok(contar() === 1 && !!w.localStorage.getItem(PREF + 'PPP-2026-0099-D11'),
       'D11: podada ao mínimo, sobra o rascunho do PPP que está aberto — mesmo sendo o mais antigo');

    /* o armazenamento cheio: a poda tem de acontecer ANTES do setItem */
    const realSet = w.Storage.prototype.setItem;
    let modo = 'ok', tentativas = 0;
    w.Storage.prototype.setItem = function(k, v){
      if(String(k).indexOf(PREF) === 0){
        tentativas++;
        if(modo === 'sempre') throw new w.DOMException('cota cheia', 'QuotaExceededError');
        if(modo === 'cheio'){
          let outros = 0;
          for(let i=0;i<w.localStorage.length;i++){ const kk = w.localStorage.key(i); if(kk && kk.indexOf(PREF)===0 && kk !== k) outros++; }
          if(outros >= 2) throw new w.DOMException('cota cheia', 'QuotaExceededError');
        }
      }
      return realSet.call(this, k, v);
    };

    limparTudo();
    ['A','B','C'].forEach((x,i) => realSet.call(w.localStorage, PREF + 'PPP-2020-000' + i + '-' + x,
      JSON.stringify({em: 1000 + i, protocolo:'PPP-2020-000'+i+'-'+x, dados:{tApresentacao:'velho'}})));
    modo = 'cheio'; tentativas = 0;
    state.txt.tApresentacao = 'o texto que precisa caber';
    w.guardarRascunhoLocal();
    ok(tentativas === 2, 'D11: não coubendo de primeira, o sistema poda ao mínimo e tenta de novo');
    const guardado = w.localStorage.getItem(PREF + 'PPP-2026-0099-D11');
    ok(!!guardado && /o texto que precisa caber/.test(guardado),
       'D11: e o rascunho do PPP aberto acaba guardado, em vez de sumir em silêncio');
    ok(APP.rascunhoIndisponivel === false && d.querySelector('#tarjaSalvar').hidden,
       'D11: coube — nenhuma tarja aparece');

    /* nem podando cabe: a promessa é retirada da tela */
    limparTudo();
    modo = 'sempre'; tentativas = 0;
    w.guardarRascunhoLocal();
    ok(tentativas === 2, 'D11: as duas tentativas acontecem antes de desistir');
    ok(APP.rascunhoIndisponivel === true, 'D11: o sistema passa a saber que não há rascunho neste navegador');
    ok(!d.querySelector('#tarjaSalvar').hidden &&
       /armazenamento cheio/.test(d.querySelector('#tarjaSalvarTexto').textContent),
       'D11: e a tarja de gravação diz o que houve, em vez do catch vazio');

    /* e a tela de sessão perdida para de prometer o que não pode cumprir */
    {
      w.eval('APP.sujo = true;');
      const avisos = [];
      const alertaReal = w.alerta;
      w.alerta = function(m, t){ avisos.push(String(m)); };
      w.sessaoPerdida('Sessão expirada', 'Sua sessão expirou.');
      w.alerta = alertaReal;
      ok(avisos.length === 1 && /<b>não<\/b> pôde ser guardado neste navegador/.test(avisos[0]),
         'D11: com o armazenamento cheio, a sessão perdida avisa que o texto NÃO ficou guardado');
    }

    /* com espaço, nada muda */
    modo = 'ok'; limparTudo();
    APP.protocolo = 'PPP-2026-0099-D11'; APP.status = 'Em andamento';
    w.eval('gravacaoRestabelecida();');
    w.guardarRascunhoLocal();
    ok(APP.rascunhoIndisponivel === false && !!w.localStorage.getItem(PREF + 'PPP-2026-0099-D11') &&
       d.querySelector('#tarjaSalvar').hidden,
       'D11: com espaço, o rascunho é guardado como sempre e nenhuma tarja aparece');
    {
      w.eval('APP.sujo = true;');
      const avisos = [];
      const alertaReal = w.alerta;
      w.alerta = function(m){ avisos.push(String(m)); };
      w.sessaoPerdida('Sessão expirada', 'Sua sessão expirou.');
      w.alerta = alertaReal;
      ok(avisos.length === 1 && /fica guardado neste navegador/.test(avisos[0]),
         'D11: e a promessa da sessão perdida volta a valer quando ela é verdadeira');
    }
    w.Storage.prototype.setItem = realSet;
    limparTudo();
    ok(erros.length === 0, 'D11: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 18. v8.13 (D12): todo campo que vira célula tem teto, contador e destino =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const state = w.eval('state'), TELAS = w.eval('TELAS');

    /* --- teto em TODO campo da identificação --- */
    const iDados = TELAS.findIndex(t => t.tipo === 'dados');
    w.irPara(iDados, true);
    const identSemTeto = Array.from(d.querySelectorAll('#panelProducao input[data-k]'))
      .filter(el => !el.getAttribute('maxlength')).map(el => el.dataset.k);
    ok(identSemTeto.length === 0,
       'D12: nenhum campo da identificação fica sem teto' + (identSemTeto.length ? ': ' + identSemTeto.join(', ') : ''));
    ok($('#fNome').getAttribute('maxlength') === '120' && $('#fEnd').getAttribute('maxlength') === '200' &&
       $('#fTur').getAttribute('maxlength') === '6',
       'D12: e o teto é o que faz sentido para o campo, não o teto da célula');
    /* uma colagem de 62 mil caracteres não cabe no campo */
    {
      const colado = 'x'.repeat(62000);
      const el = $('#fNome');
      const max = parseInt(el.getAttribute('maxlength'), 10);
      ok(colado.slice(0, max).length === 120,
         'D12: o navegador corta a colagem no teto do campo — o nome da escola para em 120');
      /* e o contador avisa do corte */
      const ctE = () => $('#ct_escola') || {textContent:'(sem contador)', classList:{contains:()=>false}};
      el.value = 'x'.repeat(115); el.dispatchEvent(new w.Event('input', {bubbles:true}));
      ok(/115 de 120 caracteres/.test(ctE().textContent) && ctE().classList.contains('perto'),
         'D12: perto do teto, o contador do campo curto aparece');
      el.value = 'x'.repeat(120); el.dispatchEvent(new w.Event('input', {bubbles:true}));
      ok(ctE().classList.contains('estourou') && /não aceita mais texto/.test(ctE().textContent),
         'D12: no teto, ele diz que o campo não aceita mais texto');
      el.value = 'EE de Teste'; el.dispatchEvent(new w.Event('input', {bubbles:true}));
      ok(ctE().textContent === '', 'D12: e no uso normal ele não aparece');
    }

    /* --- teto nas indicações da oferta e na tabela de indicadores --- */
    {
      state.sel.etapas.add('efai'); state.sel.mods.add('ept');
      const iMods = TELAS.findIndex(t => t.tipo === 'marcacao' && t.grupo === 'mods');
      w.irPara(iMods, true);
      const dets = Array.from(d.querySelectorAll('#optsHost input[data-det][type="text"]'));
      ok(dets.length > 0 && dets.every(el => el.getAttribute('maxlength') === '2000'),
         'D12: os campos de indicação da oferta passam a ter teto');
      const iInd = TELAS.findIndex(t => t.tipo === 'indicadores');
      w.irPara(iInd, true);
      const cels = Array.from(d.querySelectorAll('#panelProducao input[data-etapa]'));
      ok(cels.length > 0 && cels.every(el => el.getAttribute('maxlength') === '12'),
         'D12: as casas da tabela de indicadores têm teto');
      const ctx = Array.from(d.querySelectorAll('#panelProducao input[data-g]'));
      ok(ctx.length > 0 && ctx.every(el => !!el.getAttribute('maxlength')),
         'D12: e os campos de contexto do diagnóstico também');
    }

    /* --- o destino existe para toda coluna que o servidor pode recusar --- */
    {
      const MAPA = w.eval('typeof TELA_DA_COLUNA === "object" ? TELA_DA_COLUNA : ({})');
      const chaves = ['detalhes','selecoes','indicadores','escola','inep','municipio','direcao',
                      'especialista','endereco','ato','turnos','estudantes','turmas','vigencia',
                      'aprovacao','assembleia','analiseSre','quorumPresentes','quorumTotal',
                      'tApresentacao','etapas','mods','infra','temas','principios','metodos'];
      const semDestino = chaves.filter(k => MAPA[k] === undefined);
      ok(semDestino.length === 0,
         'D12: toda coluna que a escola escreve tem uma tela de destino' + (semDestino.length ? ': ' + semDestino.join(', ') : ''));
      const naoNavegou = [];
      chaves.forEach(function(k){
        w.irPara(0, true);
        const antes = state.tela;
        w.irParaCampo(k);
        if(state.tela === antes && MAPA[k] !== antes) naoNavegou.push(k);
      });
      ok(naoNavegou.length === 0,
         'D12: e irParaCampo leva até ela' + (naoNavegou.length ? ' — falhou em: ' + naoNavegou.join(', ') : ''));
      /* chave que não existe: a tela diz onde procurar, em vez de não fazer nada */
      d.querySelector('#toast').textContent = '';
      w.irParaCampo('colunaQueNaoExiste');
      ok(/Mapa do percurso/.test(d.querySelector('#toast').textContent),
         'D12: chave desconhecida não some em silêncio — a tela diz onde procurar');
    }

    /* --- o limite exato: 45.000 grava, 45.001 não (A4-12) --- */
    {
      const iEsc = TELAS.findIndex(t => t.tipo === 'escrita' && (t.campos || []).length);
      w.irPara(iEsc, true);
      const ta = $('#panelProducao textarea[data-k]');
      const ct = () => d.getElementById('ct_' + ta.dataset.k);
      ta.value = 'x'.repeat(45000); ta.dispatchEvent(new w.Event('input', {bubbles:true}));
      ok(!ct().classList.contains('estourou') && !/acima do limite/.test(ct().textContent),
         'D12: em exatamente 45.000 caracteres o contador não diz que o PPP deixa de salvar — porque o servidor grava');
      ta.value = 'x'.repeat(45001); ta.dispatchEvent(new w.Event('input', {bubbles:true}));
      ok(ct().classList.contains('estourou') && /acima do limite/.test(ct().textContent),
         'D12: em 45.001 ele diz — e é onde o servidor recusa');
      ta.value = 'texto curto'; ta.dispatchEvent(new w.Event('input', {bubbles:true}));
    }
    ok(erros.length === 0, 'D12: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 19. v8.13 (D13): indicador é número =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const state = w.eval('state'), TELAS = w.eval('TELAS');

    /* a regra, valor a valor */
    ok(w.indicadorInvalido('mat', '480') === '' && w.indicadorInvalido('apr', '88,4') === '' &&
       w.indicadorInvalido('apr', '88.4') === '' && w.indicadorInvalido('aba', '0') === '' &&
       w.indicadorInvalido('dis', '100') === '' && w.indicadorInvalido('mat', '') === '',
       'D13: número válido — inteiro, vírgula, ponto, zero, 100 e campo vazio — continua passando');
    const ruins = {mat:['-500','4,5','abc','1e9','<script>x',' 12x'], apr:['998','-1','abc','1e9','88,45','<script>x']};
    const passou = [];
    Object.keys(ruins).forEach(function(col){
      ruins[col].forEach(function(v){ if(!w.indicadorInvalido(col, v)) passou.push(col + '=' + v); });
    });
    ok(passou.length === 0, 'D13: negativo, acima da faixa, texto e notação científica são recusados' +
       (passou.length ? ' — passaram: ' + passou.join(', ') : ''));

    /* na tela: marcado, listado nos avisos, e o valor NÃO se perde */
    state.sel.etapas.add('ei');
    const iInd = TELAS.findIndex(t => t.tipo === 'indicadores');
    state.ind.etapas.ei = {mat:'-500', apr:'998', rep:'abc', aba:'1e9', dis:'<script>x'};
    w.irPara(iInd, true);
    const marcadas = Array.from(d.querySelectorAll('#panelProducao input[data-etapa="ei"]'))
      .filter(el => el.classList.contains('campo-alerta'));
    ok(marcadas.length === 5, 'D13: as cinco casas inválidas aparecem marcadas na tabela');
    ok(marcadas.every(el => !!el.getAttribute('title')), 'D13: e cada uma diz por quê');
    const avisos = $('#indAlertas').textContent;
    ok(/não é um número/.test(avisos) && /-500/.test(avisos) && /abc/.test(avisos),
       'D13: os avisos à escola nomeiam o que não é número');
    ok(!/abandono de 1000000000%/.test(avisos),
       'D13: e o alerta de patamar deixa de tratar "1e9" como se fosse uma taxa');
    ok(state.ind.etapas.ei.rep === 'abc',
       'D13: o valor continua no estado enquanto se trabalha — nada se descarta ao digitar');

    /* no documento: o "%" não se acrescenta ao que não é número */
    {
      const doc = w.docHTML(true).html;
      ok(/abc/.test(doc), 'D13: o valor que a escola digitou continua aparecendo na tabela (nada se descarta)');
      ok(!/abc%/.test(doc) && !/1e9%/.test(doc) && !/998%/.test(doc),
         'D13: mas o documento não imprime "abc%", "1e9%" nem "998%"');
      ok(!/&lt;script&gt;x%/.test(doc),
         'D13: nem dá aparência de taxa a um texto qualquer');
    }

    /* a porta do documento é que é estreita */
    {
      const barra = w.barrarPorIndicadores('concluir');
      ok(/não são números/.test(barra) && /Educação Infantil/.test(barra) && /concluir/.test(barra),
         'D13: concluir é barrado, nomeando etapa, coluna e valor');
      state.ind.etapas.ei = {mat:'320', apr:'95,0', rep:'3', aba:'2', dis:'10,5'};
      ok(w.barrarPorIndicadores('concluir') === '', 'D13: com números válidos, a porta abre');
    }
    ok(erros.length === 0, 'D13: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== 20. v8.13 (D14): a tela final concorda com as telas =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const state = w.eval('state'), APP = w.eval('APP'), TELAS = w.eval('TELAS'), CHECK = w.eval('CHECK'), GRUPOS = w.eval('GRUPOS');

    /* (A4-07) tudo preenchido MENOS o texto dos princípios */
    w.aplicarDemo();
    Object.keys(state.txt).forEach(k => { if(!state.txt[k]) state.txt[k] = 'Texto de teste para ' + k + '.'; });
    Object.keys(state.sel).forEach(g => GRUPOS[g].forEach(o => state.sel[g].add(o.id)));
    state.dados.aprovacao = '2026-03-10';
    state.txt.tPrincipios = '';
    APP.protocolo = 'PPP-2026-0099-D14'; APP.versao = 1;
    w.irPara(TELAS.length - 1, true);
    const cab = $('#checklist').textContent;
    ok(!/37 de 37/.test(cab),
       'D14 (A4-07): com o texto da seção 3 em branco, o checklist NÃO diz "37 de 37"');
    ok(CHECK.filter(c => !c.ok()).length === 1 && !CHECK.filter(c => c.t === 'Princípios norteadores')[0].ok(),
       'D14: e a pendência que sobra é exatamente a dos princípios');
    {
      const iPrinc = TELAS.findIndex(t => (t.campos||[]).some(c => c.id === 'tPrincipios'));
      const mod4 = TELAS[iPrinc].modulo;
      const blocos = Array.from($('#checklist').querySelectorAll('.ck-grupo, h4, .check-mod'));
      ok(w.pendenciasModulo(mod4) === 1,
         'D14: a trilha do módulo daquele campo continua marcando 1 pendência — os dois contadores concordam');
      ok(!/Módulo\s*' + (mod4+1) + '[^|]*TUDO PRONTO/.test($('#checklist').textContent),
         'D14: e o módulo não é anunciado como "TUDO PRONTO"');
    }
    state.txt.tPrincipios = 'Os princípios se materializam nesta escola em…';
    w.irPara(TELAS.length - 1, true);
    ok(/37 de 37/.test($('#checklist').textContent),
       'D14: escrito o texto, aí sim o checklist fecha em 37 de 37');

    /* (A4-11) o item dos indicadores aponta, rotula e leva à MESMA tela */
    {
      const iInd = TELAS.findIndex(t => t.tipo === 'indicadores');
      const item = CHECK.filter(c => /Indicadores educacionais/.test(c.t))[0];
      ok(w.telaDoItem(item) === iInd,
         'D14 (A4-11): o item dos indicadores aponta a tela da tabela de indicadores');
      /* zera os indicadores para que ele fique pendente e vire botão */
      state.ind.etapas = {};
      w.irPara(TELAS.length - 1, true);
      const btn = Array.from(d.querySelectorAll('#checklist [data-ck-tela]'))
        .filter(b => /Indicadores educacionais/.test(b.textContent))[0];
      ok(!!btn && +btn.dataset.ckTela === iInd,
         'D14: o botão do checklist carrega o mesmo destino');
      ok(/ir para a tela ' + (iInd + 1) + '/.test(btn.textContent) || btn.textContent.indexOf('ir para a tela ' + (iInd + 1)) >= 0,
         'D14: e o rótulo anuncia a mesma tela que o clique abre');
      /* a trava de preparação não desvia mais o clique da tela final */
      state.tarefas = {};
      w.irPara(0, true);
      btn.click();
      ok(state.tela === iInd,
         'D14: o clique leva DIRETO à tela do item, sem parar numa tela formativa');
    }

    /* (A4-13) irPara não quebra com índice que não é inteiro */
    {
      const casos = [NaN, undefined, 1.7, '3', -5, 999, null];
      const quebrou = [];
      casos.forEach(function(v){
        try { w.irPara(v, true); } catch(e){ quebrou.push(String(v) + ': ' + e.message); }
        if(!Number.isInteger(state.tela)) quebrou.push(String(v) + ' deixou state.tela = ' + state.tela);
      });
      ok(quebrou.length === 0,
         'D14 (A4-13): irPara(NaN), (undefined), (1.7), ("3"), (-5), (999) e (null) não lançam e deixam state.tela inteiro' +
         (quebrou.length ? ' — ' + quebrou.join(' | ') : ''));
      ok(Number.isInteger(w.coletarDados().tela),
         'D14: e a coluna "Tela atual" nunca recebe valor corrompido');
    }
    ok(erros.length === 0, 'D14: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 21. C17: o CSV deixa de ser vetor de fórmula =============== */
  {
    const capturado = [];
    const { w, d, erros } = carrega('./Index.html', null, function(win){
      win.URL.createObjectURL = function(b){ capturado.push(b); return 'blob:x'; };
      win.URL.revokeObjectURL = function(){};
    });
    await espera(30);
    const texto = async function(){ const b = capturado[capturado.length - 1]; return b ? await b.text() : ''; };
    /* Blob.text() decodifica em UTF-8 e COME o BOM (é o que a especificação
       manda); para conferir que ele continua lá, é preciso olhar os bytes. */
    const bytes = async function(){ const b = capturado[capturado.length - 1];
      return b ? new Uint8Array(await b.arrayBuffer()) : new Uint8Array(); };
    const comBOM = [];

    /* a regra isolada, valor a valor */
    const casos = [['=1+1', "'=1+1"], ['+1', "'+1"], ['-1', "'-1"], ['@cmd', "'@cmd"],
                   ['=HYPERLINK("http://x","clique")', '"\'=HYPERLINK(""http://x"",""clique"")"'],
                   ['EE Divinópolis', 'EE Divinópolis'], ['São José', 'São José'],
                   ['', ''], [true, 'sim'], [false, 'não']];
    const erradas = casos.filter(function(c){ return w.campoCSV(c[0]) !== c[1]; })
                         .map(function(c){ return JSON.stringify(c[0]) + ' → ' + JSON.stringify(w.campoCSV(c[0])); });
    ok(erradas.length === 0,
       'C17 (A3-17): campoCSV neutraliza =, +, -, @ e deixa o texto comum intacto' +
       (erradas.length ? ' — ' + erradas.join(' | ') : ''));
    ok(w.campoCSV('a\tb').indexOf('"') === 0 && w.campoCSV('a\rb').indexOf('"') === 0,
       'C17: tabulação e retorno de carro passaram a ser citados — antes partiam a linha');
    ok(/^"'/.test(w.campoCSV('=A1;B2')),
       'C17: e um valor que precisa das duas coisas recebe as duas');

    /* as TRÊS exportações, com a mesma escola de nome "=1+1" */
    w.eval('SESSAO.perfil = "central"; SESSAO.papel = "central"; SESSAO.token = "";');
    /* (1) cobertura */
    w.eval('COB.dados = ' + JSON.stringify({ sre: 'SRE X', escolas: [
      { escola: '=1+1', inep: '31000001', municipio: '@cmd', sre: 'SRE X', diretor: 'Ana',
        diretorEmail: 'ana@x.com', status: 'Em andamento', dias: 3, desde: '01/01/2026',
        protocolo: 'PPP-2026-0001', versao: 1 },
      { escola: 'EE Comum', inep: '31000002', municipio: 'Betim', sre: 'SRE X', diretor: 'Davi',
        diretorEmail: 'davi@x.com', status: 'Em andamento', dias: 3, desde: '01/01/2026',
        protocolo: 'PPP-2026-0002', versao: 1 } ] }));
    w.exportarCoberturaCSV();
    const csvCob = await texto(); comBOM.push(await bytes());
    ok(/(^|\r\n)'=1\+1;/.test(csvCob) && csvCob.indexOf(";'@cmd;") >= 0,
       'C17: na planilha da COBERTURA a escola "=1+1" sai como \'=1+1 e o município "@cmd" como \'@cmd');
    ok(/(^|\r\n)EE Comum;/.test(csvCob),
       'C17: e um nome comum continua saindo sem apóstrofo');
    /* (2) painel */
    w.eval('PAINEL.linhas = ' + JSON.stringify([
      { protocolo: 'PPP-2026-0001', versao: 1, escola: '=1+1', inep: '31000001', municipio: '@cmd',
        sre: 'SRE X', status: 'Em andamento', pct: 50, assinadas: 0, totalAssin: 3, ata: false,
        revisaoVencida: false, homolData: '', homolEm: '', homolAto: '', homolPor: '',
        atualizadoEm: '01/01/2026 08:00', temPdf: false },
      { protocolo: 'PPP-2026-0002', versao: 1, escola: 'EE Comum', inep: '31000002', municipio: 'Betim',
        sre: 'SRE X', status: 'Em andamento', pct: 50, assinadas: 0, totalAssin: 3, ata: false,
        revisaoVencida: false, homolData: '', homolEm: '', homolAto: '', homolPor: '',
        atualizadoEm: '01/01/2026 08:00', temPdf: false } ]));
    w.exportarPainelCSV();
    const csvPai = await texto(); comBOM.push(await bytes());
    ok(csvPai.indexOf(";'=1+1;") >= 0 && csvPai.indexOf(";'@cmd;") >= 0,
       'C17: na planilha do PAINEL, o mesmo');
    ok(csvPai.indexOf(';EE Comum;') >= 0, 'C17: e o nome comum continua intacto no painel');
    /* (3) contas a regularizar */
    w.eval('CONTAS = ' + JSON.stringify({ escopo: 'rede', dominio: '@educacao.mg.gov.br', totalDiretores: 2, jaEntraram: 0,
      sres: ['SRE X'], linhas: [
      { inep: '31000001', escola: '=1+1', municipio: '@cmd', sre: 'SRE X', nome: 'Ana', masp: '1234567',
        email: 'ana@x.com', dominio: 'x.com', jaDefiniuSenha: false, convitePendente: true,
        ultimoAcesso: '', situacao: 'ativo' },
      { inep: '31000002', escola: 'EE Comum', municipio: 'Betim', sre: 'SRE X', nome: 'Davi', masp: '7654321',
        email: 'davi@x.com', dominio: 'x.com', jaDefiniuSenha: false, convitePendente: true,
        ultimoAcesso: '', situacao: 'ativo' } ] }));
    w.exportarContasCSV();
    const csvCt = await texto(); comBOM.push(await bytes());
    ok(csvCt.indexOf(";'=1+1;") >= 0 && csvCt.indexOf(";'@cmd;") >= 0,
       'C17: e na planilha de CONTAS A REGULARIZAR também');
    /* v8.13 (E09): a mesma política nas três, e o MASP fora */
    ok(csvCt.split('\r\n')[0].indexOf('MASP') < 0,
       'E09 (A7-05): o cabeçalho da planilha de contas não tem mais a coluna MASP — ' + csvCt.split('\r\n')[0]);
    ok(csvCt.indexOf('1234567') < 0 && csvCt.indexOf('7654321') < 0,
       'E09: e nenhum MASP sai na planilha');
    /* o BOM e o ";" não mudaram: as três têm de continuar abrindo acentuadas no Excel */
    ok(comBOM.length === 3 && comBOM.every(function(b){ return b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF; }),
       'C17: as três continuam com BOM — abrem acentuadas no Excel');
    ok(csvCob.split('\r\n')[0].indexOf(';') > 0 && csvPai.split('\r\n')[0].indexOf(';') > 0 &&
       csvCt.split('\r\n')[0].indexOf(';') > 0,
       'C17: e o separador continua sendo o ponto e vírgula');
    ok(erros.length === 0, 'C17: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 22. C18: um passo por vez na abertura =============== */
  {
    const IDS = ['portaEntrada','portaEscola','portaInst','portaModo','portaIdent','portaSemCadastro',
                 'portaPapel','portaPrimeiro','portaVerificar','portas','portasVoltar'];
    const CTX_IDENT = { email:'jose.silva@educacao.mg.gov.br', admin:false, controleAtivo:true, identificado:true,
      urlApp:'https://script/app', curadoria:false, curador:false, senhaDefinida:true, acessoInstitucional:true,
      acesso:{ perfil:'escola', nome:'José Silva', sre:'Divinópolis', inep:'31100001', escola:'EE João Ribeiro',
               masp:'1234567', email:'jose.silva@educacao.mg.gov.br', papel:'diretor_escolar',
               papelNome:'Direção Escolar', podeValidar:false, podeAssociar:false, soLeitura:false,
               cadastra:['colegiado'] } };
    const CTX_ANONIMO = { email:'', admin:false, controleAtivo:true, identificado:false,
      urlApp:'https://script/app', curadoria:false, curador:false, senhaDefinida:false,
      acessoInstitucional:true, acesso:null };

    const cenarios = [['conta identificada com cadastro', CTX_IDENT], ['sem conta identificada', CTX_ANONIMO]];
    for (const [rotulo, ctx] of cenarios) {
      for (const larg of [1280, 390]) {
        const { w, d, erros } = carrega('./Index.html', null, function(win){
          /* o achado foi reproduzido também em 390x844 */
          try { Object.defineProperty(win, 'innerWidth', { value: larg, configurable: true }); } catch(e){}
          try { Object.defineProperty(win, 'innerHeight', { value: larg === 390 ? 844 : 900, configurable: true }); } catch(e){}
        });
        await espera(60);
        const visiveis = function(){ return IDS.filter(function(id){ const e = d.querySelector('#' + id); return e && !e.hidden; }); };
        /* a antessala, e dela a conferência pública — que é o passo aberto */
        w.irParaEntrada();
        d.querySelector('#btnEntrarSistema').click();
        await espera(5);
        d.querySelector('#btnAutenticarPPP').click();
        await espera(5);
        const antes = visiveis();
        ok(antes.join(',') === 'portaVerificar',
           'C18 (' + rotulo + ', ' + larg + 'px): com a conferência aberta, o único passo visível é portaVerificar — ' + antes.join(','));
        /* e só ENTÃO a resposta de `contexto` chega, como na rede de verdade */
        w.aplicarContexto(ctx);
        await espera(20);
        const depois = visiveis();
        ok(depois.join(',') === 'portaVerificar',
           'C18 (A1-03) (' + rotulo + ', ' + larg + 'px): o retorno do contexto NÃO revela passo de login nenhum — ' + depois.join(','));
        /* o contexto não se perde: ele foi guardado e o login é desenhado ao voltar */
        w.voltarPortas();
        await espera(10);
        const voltou = visiveis();
        ok(voltou.indexOf('portaVerificar') < 0 &&
           (ctx.acesso ? voltou.indexOf('portaIdent') >= 0 : voltou.indexOf('portas') >= 0),
           'C18 (' + rotulo + ', ' + larg + 'px): e ao voltar o login aparece normalmente — ' + voltou.join(','));
        ok(erros.length === 0, 'C18 (' + rotulo + ', ' + larg + 'px): sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
      }
    }
  }

  /* =============== 23. E05: texto curado não vira marcação na tela =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    /* a lista branca do cliente é a mesma do servidor */
    ok(w.htmlSeguro('<p>a <b>b</b><br>c</p>') === '<p>a <b>b</b><br>c</p>',
       'E05: htmlSeguro deixa passar a marcação da lista branca, idêntica');
    ['<scr<script>ipt>alert(1)</scr</script>ipt>', '<img src=x/onerror=alert(1)>',
     '<img src="x"onerror=alert(1)>', '<a href="javascript&#58;alert(1)">x</a>',
     '<svg/onload=alert(1)>'].forEach(function(v, i){
      ok(!/<\s*[A-Za-z]/.test(w.htmlSeguro(v)),
         'E05 (A7-03): vetor ' + (i+1) + ' vira texto no cliente — ' + w.htmlSeguro(v));
    });
    ok(w.htmlSeguro('<b onclick="x">a</b>').indexOf('<b onclick') < 0,
       'E05: tag da lista com atributo não é reintroduzida');

    /* o caminho real: a base em uso já tem texto gravado pela limpeza velha */
    const tituloAntes = d.title;
    w.eval("UI.finalHint = '<img src=x onerror=\"document.title=Xss\">Dica <b>importante</b>.'");
    w.aplicarUI();
    await espera(50);
    const alvo = d.getElementById(w.eval('UI_ELEMENTOS.finalHint'));
    ok(!!alvo, 'E05: o elemento da dica final existe');
    ok(!alvo.querySelector('img') && !alvo.querySelector('script') && !alvo.querySelector('svg'),
       'E05 (A7-03): o DOM resultante não tem img, script nem svg');
    ok(d.title === tituloAntes, 'E05: e nada tocou no document.title');
    ok(!!alvo.querySelector('b') && /importante/.test(alvo.textContent),
       'E05: o <b> curado continua chegando em negrito');
    ok(/onerror/.test(alvo.textContent),
       'E05: o que era ataque aparece como TEXTO, à vista de quem curar — ' + alvo.textContent.slice(0, 60));
    ok(erros.length === 0, 'E05: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== 24. E09: uma só política para as três planilhas =============== */
  {
    const capturado = [];
    const toasts = [];
    const { w, d, erros } = carrega('./Index.html', null, function(win){
      win.URL.createObjectURL = function(b){ capturado.push(b); return 'blob:x'; };
      win.URL.revokeObjectURL = function(){};
    });
    await espera(40);
    w.eval('toast = function(m){ window.__toasts = (window.__toasts||[]); window.__toasts.push(String(m)); };');
    /* uma sessão REGIONAL com podeAssociar: é o caso do achado */
    w.eval('SESSAO.perfil = "regional"; SESSAO.papel = "superintendente"; SESSAO.token = ""; SESSAO.podeAssociar = true;');
    w.eval('CONTAS = ' + JSON.stringify({ escopo: 'sre', dominio: '@educacao.mg.gov.br', totalDiretores: 1,
      jaEntraram: 0, sres: ['SRE X'], linhas: [
      { inep: '31000001', escola: 'EE Uma', municipio: 'Betim', sre: 'SRE X', nome: 'Ana', masp: '1234567',
        email: 'ana@x.com', dominio: 'x.com', jaDefiniuSenha: false, convitePendente: true,
        ultimoAcesso: '', situacao: 'ativo' }] }) + ';');
    w.desenharContasPendentes();
    await espera(30);
    ok(!d.querySelector('#ctExportar'),
       'E09 (A7-05): numa sessão regional, o botão "Baixar a lista" NÃO existe no DOM');
    const antes = capturado.length;
    w.exportarContasCSV();
    await espera(20);
    ok(capturado.length === antes,
       'E09: e chamar exportarContasCSV() direto não produz download nenhum');
    ok((w.eval('window.__toasts') || []).some(function(t){ return /Órgão Central/.test(t); }),
       'E09: a função diz por que recusou');
    /* no Órgão Central, o botão existe e a planilha sai */
    w.eval('SESSAO.perfil = "central"; SESSAO.papel = "central";');
    w.desenharContasPendentes();
    await espera(30);
    ok(!!d.querySelector('#ctExportar'),
       'E09: no Órgão Central o botão continua onde estava');
    w.exportarContasCSV();
    await espera(20);
    ok(capturado.length === antes + 1, 'E09: e a planilha é gerada');
    /* as outras duas já respeitavam a política — a conferência é a mesma */
    ok(/SESSAO\.perfil !== 'central'/.test(w.exportarPainelCSV.toString()) &&
       /SESSAO\.perfil !== 'central'/.test(w.exportarCoberturaCSV.toString()) &&
       /SESSAO\.perfil !== 'central'/.test(w.exportarContasCSV.toString()),
       'E09: as TRÊS exportações conferem o perfil na própria função, não só no botão');
    ok(erros.length === 0, 'E09: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== v8.13 (F01): a tela diz até quando a ata se troca =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(30);
    const base = { protocolo:'PPP-2026-0F01', versao:1, status:'Em assinatura',
      escola:'EE F01', inep:'31000901', municipio:'Divinópolis', sre:'Divinópolis',
      direcao:'Dir', hash:'AAAA-BBBB-CCCC', concluidoEm:'20/09/2026 10:00',
      etapas:['Ensino Médio'], mods:[], infra:[], temas:[], principios:[], metodos:[],
      anexos:'[]', ataUrl:'', ataNome:'', ataData:'', ataIdent:'' };

    /* (1) sem ata anexada: o rótulo continua o de sempre */
    w.preencherRegistro(Object.assign({}, base, { assinaturas: JSON.stringify(
      [{ papel:'Direção Escolar', nome:'Dir', email:'d@x', assinadoEm:'' }]) }));
    w.montarTelaFinal();
    await espera(20);
    ok(d.getElementById('btnAtaTxt').textContent === 'Anexar a ata da reunião',
       'F01 (tela): sem ata anexada, o botão diz "Anexar a ata da reunião"');
    ok(d.getElementById('btnRegistrarAta').disabled === false,
       'F01 (tela): e está habilitado');

    /* (2) com ata e NENHUMA assinatura: o rótulo vira "Substituir…" */
    w.preencherRegistro(Object.assign({}, base, { ataNome:'ata-errada.pdf', ataData:'30/08/2026',
      assinaturas: JSON.stringify([{ papel:'Direção Escolar', nome:'Dir', email:'d@x', assinadoEm:'' },
                                   { papel:'Colegiado Escolar', nome:'Ana', email:'a@x', assinadoEm:'' }]) }));
    w.montarTelaFinal();
    await espera(20);
    ok(d.getElementById('btnAtaTxt').textContent === 'Substituir a ata da reunião',
       'F01 (tela): com ata e nenhuma assinatura, o botão diz "Substituir a ata da reunião"');
    ok(d.getElementById('btnRegistrarAta').disabled === false,
       'F01 (tela): e continua habilitado — a troca é possível');

    /* (3) com ata e UMA assinatura: o botão fecha, e a tela explica por quê */
    w.preencherRegistro(Object.assign({}, base, { ataNome:'ata-errada.pdf', ataData:'30/08/2026',
      assinaturas: JSON.stringify([{ papel:'Direção Escolar', nome:'Dir', email:'d@x', assinadoEm:'' },
                                   { papel:'Colegiado Escolar', nome:'Ana', email:'a@x', assinadoEm:'20/09/2026 11:00' }]) }));
    w.montarTelaFinal();
    await espera(20);
    ok(d.getElementById('btnRegistrarAta').disabled === true,
       'F01 (tela): com ata e uma assinatura colhida, #btnRegistrarAta fica desabilitado');
    ok(/não pode mais ser trocada/.test(d.getElementById('uiAtaMini').textContent || ''),
       'F01 (tela): e a recusa é explicada ANTES de a pessoa enviar 12 MB');
    ok(erros.length === 0, 'F01 (tela): sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== v8.13 (F05): a recusa por falta de nome abre o formulário =============== */
  {
    const chamadas = [];
    const { w, d, erros } = carrega('./Index.html', null, function(win){
      win.__respostaAcessoSalvar = null;
    });
    await espera(30);
    /* o servidor da tela é substituído: o que se mede aqui é o que a TELA faz
       com a recusa, e a recusa do servidor já está provada na bateria dele */
    w.eval('servidor = function(fn, args, ok2){ window.__chamadas = (window.__chamadas||[]); ' +
           'window.__chamadas.push(fn); if(fn === "acessoSalvar") ' +
           'return ok2({ok:false, precisaNome:true, email:args.email, erro:"Este cadastro está sem nome: ' +
           'informe quem é a pessoa antes de reativá-lo."}); return ok2({ok:true, acessos:[]}); };');
    w.eval('SESSAO.perfil = "regional"; SESSAO.papel = "diretor_educacional"; SESSAO.token = "t";');
    w.eval('EQUIPE = [{email:"legado@educacao.mg.gov.br", nome:"", papel:"equipe_de", perfil:"regional", situacao:"inativo", sre:"X"}];');
    w.acaoEquipe('legado@educacao.mg.gov.br', 'situacao');
    await espera(60);
    ok(!d.getElementById('ovAviso').hidden,
       'F05 (tela): a recusa por falta de nome abre um diálogo');
    ok(!!d.getElementById('eqNome') && !!d.getElementById('eqEmail'),
       'F05 (tela): e o diálogo é o FORMULÁRIO de edição do cadastro, não só um alerta');
    ok((d.getElementById('eqEmail') || {}).value === 'legado@educacao.mg.gov.br',
       'F05 (tela): com o cadastro carregado — a pessoa preenche o nome e volta a reativar');
    ok(erros.length === 0, 'F05 (tela): sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== v8.13 (F06) → v9.6: o histórico mora na caixa de cadastro =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(30);
    const aba = function (perfil, papel, cadastra, podeAssociar) {
      w.eval('SESSAO.perfil = ' + JSON.stringify(perfil) + '; SESSAO.papel = ' + JSON.stringify(papel) +
             '; SESSAO.cadastra = ' + JSON.stringify(cadastra) +
             '; SESSAO.podeAssociar = ' + (podeAssociar ? 'true' : 'false') + ';');
      w.abrirPainelInst();
      return !d.getElementById('piAbaHistorico').hidden;
    };
    /* v9.6: a aba única saiu para todos — o histórico de cada categoria fica
       junto da caixa que a cadastra (equipe regional, Colegiado, janela da
       escola, janela da regional) */
    ok(aba('regional', 'equipe_de', [], true) === false && aba('regional', 'coordenador_inspecao', ['equipe_inspecao'], false) === false &&
       aba('central', 'central', ['central', 'superintendente'], false) === false && aba('escola', 'colegiado', [], false) === false,
       'v9.6: a aba "Histórico de acessos" não aparece para nenhum perfil');
    ok(typeof w.historicoEmbutidoHTML === 'function' && typeof w.ligarHistoricosEmbutidos === 'function' && typeof w.linhasDoHistoricoHTML === 'function',
       'v9.6: existe o histórico embutido, ligado à caixa de cadastro');
    /* a equipe regional: um histórico por papel cadastrado */
    w.eval("SESSAO.perfil='regional'; SESSAO.papel='superintendente'; SESSAO.sre='Divinópolis'; SESSAO.papelNome='Superintendente'; SESSAO.cadastra=['diretor_educacional','coordenador_inspecao']; EQUIPE=[];");
    w.desenharMinhaEquipe();
    const dets = Array.from(d.querySelectorAll('#piEquipe details.hist-embutido')).map(x => x.dataset.hist);
    ok(dets.length === 2 && dets.indexOf('papel:diretor_educacional') >= 0 && dets.indexOf('papel:coordenador_inspecao') >= 0,
       'v9.6: na equipe regional, cada caixa (Diretoria Educacional, Coordenação de Inspeção) tem o seu histórico (' + dets.join(', ') + ')');
    /* o Colegiado: um histórico só dele, na caixa dele */
    w.eval("SESSAO.perfil='escola'; SESSAO.papel='diretor_escolar'; COLEGIADO=[];");
    w.desenharColegiado();
    ok(d.querySelectorAll('#piColegiado details.hist-embutido[data-hist="grupo:colegiado"]').length === 1,
       'v9.6: a caixa do Colegiado Escolar traz o histórico do Colegiado');
    /* o servidor filtra por papel, sem ampliar escopo */
    const gs = require('fs').readFileSync('./Code.gs', 'utf8');
    ok(/const papelPedido = String\(payload && payload\.papel \|\| ''\)\.trim\(\);/.test(gs) && /papel: g\.papelEfetivo \|\| papelDe_\(g\)/.test(gs),
       'v9.6: historicoAssociacoes aceita o papel da caixa e devolve o papel de cada linha');
    ok(erros.length === 0, 'v9.6: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }


  /* =============== v8.13 (F09): a carga de escolas confirma o que gravou =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(30);
    w.eval('SESSAO.perfil = "central"; SESSAO.papel = "central"; SESSAO.token = "t";');
    w.eval('ESCOLAS = [{inep:"31000001", escola:"EE Uma", municipio:"Betim", sre:"SRE X", situacao:"ativa", codigoInep:""}];');
    /* o servidor responde a simulação e a gravação; a bateria do servidor já
       prova o que ele faz — aqui se mede o que a TELA faz com a resposta */
    w.eval('servidor = function(fn, args, ok2){ if(fn === "escolasImportar"){ ' +
           'return ok2(args.simular ? {ok:true, chave:"k1", total:2, incluidas:2, atualizadas:0, totalErros:0, ' +
           'mudamSre:1, voltamAtivas:1, ganhamInep:1, mudamInep:0, itens:[], erros:[]} ' +
           ': {ok:true, incluidas:2, atualizadas:0, totalErros:0, mudamSre:1, voltamAtivas:1, ' +
           'ganhamInep:1, mudamInep:0, escolas:[], erros:[]}); } ' +
           'if(fn === "escolasListar") return ok2({ok:true, escolas:ESCOLAS}); return ok2({ok:true}); };');
    w.desenharBaseEscolas();
    await espera(30);
    d.getElementById('escTexto').value = '31000002;EE Duas;Betim;SRE X\n31000003;EE Três;Betim;SRE Y';
    w.importarEscolas('simular');
    await espera(40);
    ok((d.getElementById('escImportarInfo').textContent || '').indexOf('conferida') > 0,
       'F09: a simulação escreve a prévia na tela');
    w.importarEscolas('importar');
    await espera(60);
    /* carregarBaseEscolas() redesenhou #piEscolas: é aqui que a confirmação sumia */
    const info = d.getElementById('escImportarInfo');
    ok(info && (info.textContent || '').indexOf('escolas incluídas') >= 0,
       'F09 (A3-11): depois da gravação e do redesenho, a confirmação continua na tela — "' +
       ((info && info.textContent) || '') + '"');
    ok(d.getElementById('escImportar').hasAttribute('open'),
       'F09: e o painel da carga fica ABERTO, para que ela seja vista');
    const res = d.getElementById('escImportarResultado');
    ok(res && /regional|SRE|INEP|ativa/i.test(res.innerHTML || ''),
       'F09: com o resumo — quantas mudaram de SRE, quantas voltaram de inativa, quantas ganharam INEP');
    /* segunda vez: a confirmação some, porque é de UMA carga, não é estado */
    w.desenharBaseEscolas();
    await espera(30);
    ok((d.getElementById('escImportarInfo').textContent || '') === '' &&
       !d.getElementById('escImportar').hasAttribute('open'),
       'F09: no redesenho seguinte ela já não aparece — confirmação de carga não é estado');
    ok(erros.length === 0, 'F09: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  /* =============== v9.9: a preparação e o modo edição de textos =============== */
  {
    const { w, d, erros } = carrega('./Index.html');
    await espera(40);
    const $ = sel => d.querySelector(sel);
    const TELAS = w.eval('TELAS');
    const comTarefa = [];
    for(let i = 0; i < TELAS.length; i++){
      const t = w.eval('tarefaDaTela')(i);
      if(t && t.obrigatorio) comTarefa.push(i);
    }
    const i0 = comTarefa[0];
    ok(i0 !== undefined, 'v9.9: há tela com itens de preparação obrigatórios');

    /* fora do modo edição — a trava é a de sempre */
    w.eval('EDICAO.ativa = false');
    ok(w.eval('travaPreparacao')(i0) === true,
       'v9.9: para a escola, a preparação não confirmada continua trancando');
    w.irPara(i0, true);
    await espera(40);
    ok($('#btnNext').classList.contains('travado') && !$('#navAviso').hidden,
       'v9.9: e o cadeado e o aviso continuam na tela da escola');
    const tar = w.eval('tarefaDaTela')(i0);
    ok(/fica liberado/.test(w.eval('textoDaTrava')(tar, false)),
       'v9.9: o rodapé da caixa diz que o avanço fica liberado ao confirmar');
    ok(/Faltam 2 itens/.test(w.eval('textoDaTrava')(tar, false, 2)) &&
       /Falta 1 item/.test(w.eval('textoDaTrava')(tar, false, 1)),
       'v9.9: e conta o que falta, no singular e no plural');

    /* no modo edição — a mesma tela deixa de trancar */
    w.eval('EDICAO.ativa = true');
    ok(w.eval('travaPreparacao')(i0) === false,
       'v9.9: no modo edição de textos, a mesma tela não tranca');
    ok(w.eval('tarefaCompleta')(i0) === false,
       'v9.9: e tarefaCompleta continua dizendo a verdade — é dela que o checklist vive');
    ok(/Modo edição/.test(w.eval('textoDaTrava')(tar, false)) &&
       /Modo edição/.test(w.eval('textoDaTrava')(tar, false, 2)),
       'v9.9: o rodapé da caixa muda nos dois caminhos — montagem e marcação de item');
    ok(/Tudo pronto/.test(w.eval('textoDaTrava')(tar, true)),
       'v9.9: confirmada, a mensagem é a mesma nos dois modos');
    w.irPara(i0, true);
    await espera(40);
    ok(!$('#btnNext').classList.contains('travado') && $('#navAviso').hidden,
       'v9.9: sem cadeado e sem aviso no modo edição');
    w.eval('EDICAO.ativa = false');
    ok(erros.length === 0, 'v9.9: sem erros de runtime' + (erros.length ? ': ' + erros[0] : ''));
  }

  console.log(`\n${oks.length} verificações OK · ${falhas.length} falhas\n`);
  falhas.forEach(f => console.log('  ✗ ' + f));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.log('EXCEÇÃO:', e.stack); process.exit(2); });
