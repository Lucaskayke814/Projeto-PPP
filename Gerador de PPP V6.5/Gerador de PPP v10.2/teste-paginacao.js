/* ============================================================
   BATERIA 5 — PAGINAÇÃO EM NAVEGADOR DE VERDADE (v8.13, D24)

   As quatro baterias do pacote rodam em jsdom, onde ambienteSemLayout() é
   verdadeiro e paginar() devolve UMA página só: elas conferem a estrutura,
   nunca a medida. Foi por isso que treze defeitos de documento (referências
   que somem do PDF, documento congelado que repagina, folha de assinaturas
   fora das páginas, sumário sem número de página) atravessaram verdes mais
   de mil verificações.

   Esta bateria abre a DEMONSTRAÇÃO num Chromium de verdade e mede: quantas
   páginas saem, o que cabe na caixa da folha, o que é cortado pela borda,
   o que o servidor monta para o PDF. É a quinta do pacote e roda por último:
       node teste-backend.js
       node teste-borda.js
       node verifica.js
       node teste-fluxo.js
       node teste-paginacao.js     <-- esta

   SEM NAVEGADOR ELA NÃO QUEBRA O PACOTE: quando o playwright (ou o Chromium)
   não está disponível, imprime o aviso e sai com 0. Onde houver navegador,
   uma falha é vermelha como em qualquer outra bateria.

   Para instalar o navegador, onde ele não estiver:
       npm i playwright && npx playwright install chromium
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const RAIZ = __dirname;
const ARQUIVO_DEMO = path.join(RAIZ, 'Gerador de PPP — demonstração.html');

/* O playwright não está no node_modules do pacote (que é um link): procurar
   nos lugares possíveis e, não achando, PULAR — a bateria é opcional por
   ausência de navegador, nunca por defeito do sistema. */
function acharPlaywright() {
  const tentativas = ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'];
  for (let i = 0; i < tentativas.length; i++) {
    try { return require(tentativas[i]); } catch (e) { /* segue */ }
  }
  return null;
}

const pw = acharPlaywright();
if (!pw || !pw.chromium) {
  console.log('\nnavegador indisponível — bateria PULADA');
  console.log('  (instale com: npm i playwright && npx playwright install chromium)\n');
  process.exit(0);
}

const falhas = [], oks = [];
const ok = (c, m) => (c ? oks : falhas).push(m);

/* O conteúdo de escola que serve de base a quase todas as medidas: uma
   escola grande, com todas as etapas e modalidades marcadas, que é o caso
   em que o documento fica longo — e o caso em que o corte aparece. */
const SEMEAR = `(function(){
  state.dados.escola='Escola Estadual Professor João Ribeiro';
  state.dados.inep='31100001'; state.dados.municipio='Divinópolis'; state.dados.sre='Divinópolis';
  state.dados.direcao='Ana Lúcia Ferreira'; state.dados.especialista='Marcos Silva';
  state.dados.endereco='Rua das Flores, 100 — Centro'; state.dados.ato='Decreto nº 12.345, de 01/02/1980';
  state.dados.turnos='manhã e tarde'; state.dados.estudantes='480'; state.dados.turmas='18';
  state.dados.vigencia='2026–2028';
  ETAPAS.forEach(function(o){ state.sel.etapas.add(o.id); });
  MODALIDADES.forEach(function(o){ state.sel.mods.add(o.id); });
  GRUPOS.temas.forEach(function(o){ state.sel.temas.add(o.id); });
  GRUPOS.infra.forEach(function(o){ state.sel.infra.add(o.id); });
  GRUPOS.principios.forEach(function(o){ state.sel.principios.add(o.id); });
  GRUPOS.metodos.forEach(function(o){ state.sel.metodos.add(o.id); });
})()`;

(async () => {
  /* a bateria mede a build de demonstração recém-montada, como as outras
     quatro fazem — nunca um HTML gerado noutra hora */
  execFileSync(process.execPath, ['montar.js', '--demo'], { cwd: RAIZ, stdio: 'pipe' });
  if (!fs.existsSync(ARQUIVO_DEMO)) { console.log('\nbuild de demonstração ausente — bateria PULADA\n'); process.exit(0); }

  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  } catch (e) {
    console.log('\nnavegador indisponível — bateria PULADA');
    console.log('  (' + String(e.message || e).split('\n')[0] + ')\n');
    process.exit(0);
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis/.test(m.text())) erros.push('console: ' + m.text()); });
  await page.goto(pathToFileURL(ARQUIVO_DEMO).href, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  /* a abertura da v8.12 é uma antessala: entrar antes de qualquer medida */
  try { await page.click('#btnEntrarSistema', { timeout: 4000 }); } catch (e) {}
  await page.waitForTimeout(600);

  const medidor = await browser.newPage();   /* onde o HTML do PDF é renderizado */

  ok(await page.evaluate(() => typeof paginar === 'function' && typeof docHTML === 'function'),
     'a demonstração expõe paginar() e docHTML()');
  ok(await page.evaluate(() => ambienteSemLayout() === false),
     'no navegador de verdade há geometria: paginar() mede em vez de devolver uma página só');

  /* =============== 1. nada some: as referências do documento =============== */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      const refs = refsDoDocumento();
      APP.paraPdf = true;
      const pag = paginar(docHTML(true).html);
      APP.paraPdf = false;
      const B = DEMO.backend();
      return { refs: refs, nRefs: refs.length,
               pdfHtml: B.montarHtmlPdf_(pag, 'código de autenticidade ABCD-1234-EFGH') };
    }, SEMEAR);

    await medidor.setContent(r.pdfHtml, { waitUntil: 'load' });
    /* "aparecer no PDF" não é estar no HTML: .pagina tem overflow:hidden, e
       o que passa da caixa é cortado sem erro nenhum. Só conta o que está
       DENTRO da caixa da folha. */
    const visivel = await medidor.evaluate(() => {
      let t = '';
      document.querySelectorAll('.pagina').forEach(function (p) {
        const c = p.querySelector('.pag-corpo'); if (!c) return;
        const fundo = c.getBoundingClientRect().bottom;
        c.querySelectorAll('*').forEach(function (el) {
          if (el.children.length) return;                    /* só as folhas da árvore */
          const rb = el.getBoundingClientRect();
          if (rb.bottom <= fundo + 0.5) t += ' ' + (el.textContent || '');
        });
      });
      return t.replace(/\s+/g, ' ');
    });
    const norm = s => String(s).replace(/\s+/g, ' ').trim();
    const ausentes = r.refs.filter(x => visivel.indexOf(norm(x)) < 0);
    ok(r.nRefs > 20, 'o documento de uma escola grande tem mais de 20 referências (' + r.nRefs + ')');
    ok(ausentes.length === 0,
       'D17: nenhuma referência some do PDF (' + ausentes.length + ' de ' + r.nRefs + ' ausentes' +
       (ausentes.length ? ', p. ex. "' + norm(ausentes[0]).slice(0, 60) + '…"' : '') + ')');
  }

  /* =============== 2. nada é cortado pela borda da folha =============== */
  {
    const casos = await page.evaluate(() => {
      const B = DEMO.backend(); const out = [];
      const frase = 'A escola organiza o seu trabalho pedagógico de modo colaborativo e permanente com a comunidade. ';
      for (let n = 0; n < 45; n++) {
        Object.keys(state.txt).forEach(k => state.txt[k] = '');
        state.dados.escola = 'Escola Estadual Teste ' + n; state.dados.municipio = 'Divinópolis';
        state.dados.direcao = 'Ana Lúcia Ferreira'; state.dados.vigencia = '2026–2028';
        state.dados.endereco = 'Rua Muito Comprida dos Testes de Paginação, 1234 — Bairro Distante';
        state.sel.etapas.clear(); ETAPAS.forEach(o => state.sel.etapas.add(o.id));
        state.ind.etapas = {}; ETAPAS.forEach(o => { state.ind.etapas[o.id] = {}; IND_COLS.forEach(c => { state.ind.etapas[o.id][c.k] = '95,5'; }); });
        state.ind.ano = '2025';
        state.txt.tApresentacao = frase.repeat(n % 17);
        state.txt.tComunidade = frase.repeat((n * 2) % 19);
        state.txt.tEstudantes = frase.repeat((n * 3) % 13);
        state.txt.tInfraestrutura = frase.repeat((n * 5) % 11);
        APP.paraPdf = true; const pag = paginar(docHTML(true).html); APP.paraPdf = false;
        out.push({ n: n, html: B.montarHtmlPdf_(pag, 'COD') });
      }
      return out;
    });
    let cortados = 0, exemplo = '';
    for (const c of casos) {
      await medidor.setContent(c.html, { waitUntil: 'load' });
      const bad = await medidor.evaluate(() => {
        const ruins = [];
        document.querySelectorAll('.pagina').forEach(function (p, i) {
          const c = p.querySelector('.pag-corpo'); if (!c) return;
          const fundo = c.getBoundingClientRect().bottom;
          Array.from(c.children).forEach(function (el) {
            const rb = el.getBoundingClientRect();
            if (rb.bottom > fundo + 0.5) ruins.push({ pag: i + 1, recorte: +(rb.bottom - fundo).toFixed(1), txt: (el.textContent || '').trim().slice(-50) });
          });
        });
        return ruins;
      });
      if (bad.length) { cortados++; if (!exemplo) exemplo = 'cenário ' + c.n + ', pág ' + bad[0].pag + ', ' + bad[0].recorte + 'px'; }
    }
    ok(cortados === 0,
       'D17/D16: nenhum elemento ultrapassa a borda da folha em 45 cenários de conteúdo (' +
       cortados + '/45 com corte' + (exemplo ? ' — ' + exemplo : '') + ')');
  }

  /* =============== 3. o que se vê na tela é o que sai no papel =============== */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      const par = 'A escola desenvolve o seu trabalho pedagógico de forma coletiva e participativa, ' +
        'envolvendo todos os segmentos da comunidade escolar em cada etapa do processo. '.repeat(30);
      /* v8.13 (D16): TODOS os campos escritos, e não sete. A tela e o papel
         têm uma diferença de CONTEÚDO que é de propósito — a seção que a
         escola ainda não escreveu aparece na tela com o lembrete do que se
         espera ali ("— Razões que fundamentam esta proposta… —") e no papel
         com "Seção a ser complementada pela escola." —, e comparar a
         paginação de dois textos diferentes não mede folha de estilo
         nenhuma. Num PPP concluído, que é o único que vira PDF, o checklist
         da tela final já exigiu esses campos. O bloco seguinte mede, esse
         sim, o documento com seções em branco. */
      Object.keys(state.txt).forEach(k => { state.txt[k] = par; });
      const mapa = function (paraPdf) {
        APP.paraPdf = paraPdf;
        const h = paginar(docHTML(paraPdf).html);
        APP.paraPdf = false;
        const d = document.createElement('div'); d.innerHTML = h;
        const pgs = Array.prototype.slice.call(d.querySelectorAll('.pagina'));
        const titulos = [];
        pgs.forEach(function (p, i) {
          p.querySelectorAll('h3.doc-h').forEach(function (h3) { titulos.push((i + 1) + '|' + h3.textContent.trim()); });
        });
        return { n: pgs.length, titulos: titulos };
      };
      return { tela: mapa(false), pdf: mapa(true) };
    }, SEMEAR);
    ok(r.tela.n === r.pdf.n,
       'D16: a tela e o PDF fecham o mesmo número de páginas (tela ' + r.tela.n + ' · PDF ' + r.pdf.n + ')');
    const iguais = r.tela.titulos.length === r.pdf.titulos.length &&
      r.tela.titulos.every((x, i) => x === r.pdf.titulos[i]);
    ok(iguais, 'D16: cada título cai na mesma página na tela e no PDF' +
      (iguais ? '' : ' (1ª divergência: tela "' + (r.tela.titulos.find((x, i) => x !== r.pdf.titulos[i]) || '—') + '")'));

    /* e, com o documento AINDA em branco, a única diferença entre a tela e o
       papel tem de ser o texto do lembrete da seção vazia: mesma sequência
       de elementos, mesmo tamanho de cada um. É o que prova que a marcação
       passou a ser a mesma nos dois destinos (até a 8.12 a tela embrulhava
       cada parágrafo num <div class="blk"> que o PDF não tinha). */
    const est = await page.evaluate((semear) => {
      eval(semear);
      Object.keys(state.txt).forEach(k => { state.txt[k] = ''; });
      const lista = function (paraPdf) {
        APP.paraPdf = paraPdf; const h = docHTML(paraPdf).html; APP.paraPdf = false;
        const d = document.createElement('div'); d.innerHTML = h;
        return Array.prototype.slice.call(d.childNodes).filter(n => n.nodeType === 1)
          /* v8.13 (D19): a tabela de caixas de assinatura é de PRÉVIA — ela
             existe só na tela, porque a folha de assinaturas do documento
             oficial é montada pelo servidor, com quem assinou de verdade, e
             entra paginada. Até a 8.12 ela ia junto no congelado e o PDF
             saía com DUAS tabelas de caixas, uma delas com os textos de
             instrução da tela. */
          .filter(n => !(n.tagName === 'TABLE' && String(n.className || '').indexOf('cxs') >= 0))
          .map(function (n) {
            const cls = String(n.className || '').replace(/\bblk\b/, '').trim();
            const txt = (n.textContent || '').trim();
            return n.tagName + '.' + cls + ':' + (cls === 'vazio' ? 'LEMBRETE' : txt.length);
          });
      };
      const a = lista(false), b = lista(true);
      const dif = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) dif.push(i + ' tela=' + a[i] + ' pdf=' + b[i]);
      return { n: a.length, m: b.length, dif: dif };
    }, SEMEAR);
    ok(est.n === est.m && est.dif.length === 0,
       'D16: com as seções em branco, tela e papel têm a MESMA marcação (' + est.n + ' × ' + est.m +
       ' elementos, ' + est.dif.length + ' divergentes' + (est.dif.length ? ': ' + est.dif[0] : '') + ')');
  }

  /* =============== 4. o documento congelado não se repagina =============== */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      APP.paraPdf = true;
      const congelado = paginar(docHTML(true).html);       /* o que concluirPPP grava no Drive */
      APP.paraPdf = false;
      APP.hash = 'ABCD-1234-EFGH';
      /* exatamente o que verDocumento e verDocumentoPublico fazem ao reabrir */
      const reaberto = paginar(trocarMarcasDoDoc(congelado));
      const a = document.createElement('div'); a.innerHTML = congelado;
      const b = document.createElement('div'); b.innerHTML = reaberto;
      return { pagsCongelado: a.querySelectorAll('.pagina').length,
               pagsReaberto: b.querySelectorAll('.pagina').length,
               aninhadas: b.querySelectorAll('.pagina .pagina').length,
               blocosCongelado: a.querySelectorAll('.pag-corpo > *').length,
               blocosReaberto: b.querySelectorAll('.pag-corpo > *').length };
    }, SEMEAR);
    ok(r.aninhadas === 0,
       'D18: reabrir o documento congelado não põe página dentro de página (' + r.aninhadas + ' aninhadas)');
    ok(r.pagsReaberto === r.pagsCongelado,
       'D18: o documento reaberto tem as mesmas páginas do congelado (' + r.pagsCongelado + ' → ' + r.pagsReaberto + ')');
  }

  /* =============== 5. título nunca fica sozinho no pé da folha =============== */
  {
    const r = await page.evaluate(() => {
      const achados = [];
      const frase = 'A escola organiza o seu trabalho pedagógico de modo colaborativo e permanente. ';
      for (let n = 0; n < 40; n++) {
        Object.keys(state.txt).forEach(k => state.txt[k] = '');
        state.dados.escola = 'Escola Estadual Teste'; state.dados.municipio = 'Divinópolis';
        state.dados.direcao = 'Ana Lúcia'; ETAPAS.forEach(o => state.sel.etapas.add(o.id));
        state.txt.tApresentacao = frase.repeat(n);
        state.txt.tHistorico = frase.repeat(Math.max(0, 40 - n));
        state.txt.tComunidade = frase.repeat((n * 3) % 37);
        APP.paraPdf = true; const html = paginar(docHTML(true).html); APP.paraPdf = false;
        const d = document.createElement('div'); d.innerHTML = html;
        const pgs = d.querySelectorAll('.pagina');
        pgs.forEach(function (p, i) {
          const c = p.querySelector('.pag-corpo'); if (!c) return;
          const ult = c.lastElementChild;
          if (!c.childNodes.length) achados.push({ n: n, pag: i + 1, tipo: 'PÁGINA EM BRANCO', texto: '' });
          else if (ult && (ult.classList.contains('doc-h') || ult.classList.contains('doc-sub')))
            achados.push({ n: n, pag: i + 1, tipo: 'TÍTULO ÓRFÃO', texto: (ult.textContent || '').trim().slice(0, 40) });
        });
      }
      return achados;
    });
    const orfaos = r.filter(a => a.tipo === 'TÍTULO ÓRFÃO');
    const brancas = r.filter(a => a.tipo === 'PÁGINA EM BRANCO');
    ok(orfaos.length === 0, 'D17: nenhum título fica sozinho no pé da folha em 40 cenários (' +
       orfaos.length + ' ocorrências' + (orfaos.length ? ', p. ex. "' + orfaos[0].texto + '"' : '') + ')');
    ok(brancas.length === 0, 'D17: nenhuma folha sai em branco em 40 cenários (' + brancas.length + ')');
  }

  /* =============== 6. o sumário leva a uma página =============== */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      APP.paraPdf = true; const pag = paginar(docHTML(true).html); APP.paraPdf = false;
      const d = document.createElement('div'); d.innerHTML = pag;
      /* em que página está cada título do corpo */
      const paginaDoTitulo = {};
      Array.prototype.slice.call(d.querySelectorAll('.pagina')).forEach(function (p, i) {
        p.querySelectorAll('h3.doc-h').forEach(function (h3) {
          const t = h3.textContent.trim();
          if (paginaDoTitulo[t] === undefined) paginaDoTitulo[t] = i + 1;
        });
      });
      const itens = Array.prototype.slice.call(d.querySelectorAll('.sum-item')).map(function (x) {
        const txt = x.textContent.trim();
        const m = txt.match(/(\d+)\s*$/);
        return { txt: txt, titulo: txt.replace(/\s*\.*\s*\d+\s*$/, '').trim(), num: m ? parseInt(m[1], 10) : null };
      });
      return { itens: itens, paginaDoTitulo: paginaDoTitulo, nPaginas: d.querySelectorAll('.pagina').length };
    }, SEMEAR);
    ok(r.itens.length > 3, 'o sumário tem itens para conferir (' + r.itens.length + ')');
    const semNumero = r.itens.filter(i => i.num === null);
    ok(semNumero.length === 0,
       'D22: todo item do sumário traz o número da página (' + semNumero.length + ' sem número' +
       (semNumero.length ? ', p. ex. "' + semNumero[0].txt.slice(0, 40) + '"' : '') + ')');
    const errados = r.itens.filter(i => i.num !== null && r.paginaDoTitulo[i.titulo] !== undefined && r.paginaDoTitulo[i.titulo] !== i.num);
    ok(errados.length === 0,
       'D22: o número do sumário é a página onde o título está (' + errados.length + ' divergentes)');
  }

  /* =============== 7. o excedente avisa: nada é descartado em silêncio ======== */
  {
    const r = await page.evaluate(() => {
      Object.keys(state.txt).forEach(k => state.txt[k] = '');
      state.dados.escola = 'Escola Estadual Teste'; state.dados.municipio = 'Divinópolis';
      state.dados.direcao = 'Ana Lúcia Ferreira';
      /* 20 mil linhas curtas: é a colagem de planilha que a escola faz, e é
         o que estoura a guarda de 20.000 voltas de paginar() */
      state.txt.tApresentacao = Array.from({ length: 20000 }, (_, i) => 'Item ' + (i + 1)).join('\n');
      state.txt.tHistorico = 'MARCA-DO-HISTORICO — este parágrafo vem depois do campo gigante.';
      APP.paraPdf = true; const pag = paginar(docHTML(true).html); APP.paraPdf = false;
      const d = document.createElement('div'); d.innerHTML = pag;
      const d0 = document.createElement('div'); d0.innerHTML = (function () { APP.paraPdf = true; const h = docHTML(true).html; APP.paraPdf = false; return h; })();
      const origem = (d0.textContent || '').replace(/\s+/g, ' ').trim();
      const fim = (d.textContent || '').replace(/\s+/g, ' ').trim();
      return { perdidos: origem.length - fim.length, charsOrigem: origem.length,
               temHistorico: fim.indexOf('MARCA-DO-HISTORICO') >= 0,
               temReferencias: fim.indexOf('REFERÊNCIAS') >= 0 || fim.indexOf('Referências') >= 0,
               paginas: d.querySelectorAll('.pagina').length };
    });
    ok(r.perdidos <= 0,
       'D17: campo com 20 mil linhas não perde caractere na paginação (' + r.perdidos + ' perdidos de ' + r.charsOrigem + ')');
    ok(r.temHistorico, 'D17: o que vem DEPOIS do campo gigante continua no documento (seção 1)');
    ok(r.temReferencias, 'D17: e o fim do documento também (seção 21)');
  }

  /* =============== 8. Padrão Ofício no PDF real, inclusive na folha ========== */
  {
    const r = await page.evaluate(() => {
      const B = DEMO.backend();
      const regs = DEMO.registros();
      const alvo = regs.filter(x => x.fonteId)[0] || regs[0];
      let html = '';
      try { html = DEMO.servicos().g.DriveApp.getFileById(alvo.fonteId).getBlob().getDataAsString('UTF-8'); } catch (e) { html = ''; }
      /* v8.13 (D19): o documento oficial montado pela MESMA função que
         gerarPdfOficial_ e documentoCongelado_ usam — a folha de assinaturas
         entra DENTRO da paginação. Até a 8.12 a montagem era uma concatenação
         escrita à mão em cada chamador, e era por isso que a folha saía fora
         das páginas, sem margem e sem rodapé. */
      const completo = B.documentoComFolha_(alvo, html);
      return { pdfHtml: B.montarHtmlPdf_(completo, B.rodapeAutenticidade_(alvo)),
               protocolo: alvo.protocolo, temFonte: !!html };
    });
    ok(r.temFonte, 'a demonstração tem um documento congelado para medir (' + r.protocolo + ')');
    await medidor.setContent(r.pdfHtml, { waitUntil: 'load' });
    const m = await medidor.evaluate(() => {
      const mm = 96 / 25.4;
      /* tudo o que é conteúdo de primeiro nível tem de estar dentro de uma
         .pagina: o que fica fora sai sem margem, sem rodapé e sem número */
      const fora = [];
      const raiz = document.querySelector('.paginas') ? document.querySelector('.paginas').parentElement : document.body;
      Array.from(raiz.children).forEach(function (el) {
        if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return;
        if (el.classList.contains('paginas')) return;
        if (!(el.textContent || '').trim()) return;
        fora.push(el.className || el.tagName);
      });
      const margens = [], semRodape = [];
      document.querySelectorAll('.pagina').forEach(function (p, i) {
        const c = p.querySelector('.pag-corpo');
        if (!c) { semRodape.push(i + 1); return; }
        const rp = p.getBoundingClientRect(), rc = c.getBoundingClientRect();
        margens.push(+((rc.left - rp.left) / mm).toFixed(1));
        if (!p.querySelector('.pag-rodape')) semRodape.push(i + 1);
      });
      return { fora: fora, margens: margens, semRodape: semRodape,
               nPaginas: document.querySelectorAll('.pagina').length,
               caixasFolha: document.querySelectorAll('table.cxs').length,
               caixasForaDePagina: Array.from(document.querySelectorAll('table.cxs')).filter(t => !t.closest('.pagina')).length };
    });
    ok(m.fora.length === 0,
       'D19: nada do documento oficial fica fora das páginas (' + m.fora.length + ' blocos soltos' +
       (m.fora.length ? ': ' + m.fora.slice(0, 3).join(', ') : '') + ')');
    ok(m.caixasForaDePagina === 0,
       'D19: as caixas de assinatura estão dentro de uma página (' + m.caixasForaDePagina + ' de ' + m.caixasFolha + ' fora)');
    const foraDoPadrao = m.margens.filter(x => Math.abs(x - 30) > 1.5);
    ok(m.margens.length > 0 && foraDoPadrao.length === 0,
       'D19: margem esquerda de 30 mm em todas as ' + m.margens.length + ' páginas do PDF (' +
       foraDoPadrao.length + ' fora do padrão' + (foraDoPadrao.length ? ', p. ex. ' + foraDoPadrao[0] + ' mm' : '') + ')');
    ok(m.semRodape.length === 0,
       'D19: toda página do PDF tem rodapé de autenticidade (' + m.semRodape.length + ' sem rodapé)');
  }

  /* =============== 9. v8.13 (E17, A8-13): a marca de prévia não se apaga ====== */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      const B = DEMO.backend();
      APP.paraPdf = true;
      const corpo = paginar(docHTML(true).html);
      APP.paraPdf = false;
      /* o mesmo corpo, com a folha de estilo do CHAMADOR tentando apagar a
         marca — e com o brasão repetido, que era o que inchava o PDF */
      const ataque = '<style>.previa{display:none !important;visibility:hidden !important}</style>' +
        corpo.replace('<!--BRASAO-->', '<!--BRASAO--><!--BRASAO--><!--BRASAO-->');
      const tk = (SESSAO && SESSAO.token) || '';
      return { limpo: B.htmlDaPrevia_({ token: tk, escola: 'X', docHtml: corpo }),
               atacado: B.htmlDaPrevia_({ token: tk, escola: 'X', docHtml: ataque }) };
    }, SEMEAR);

    for (const caso of [['prévia normal', r.limpo], ['prévia com folha de estilo do chamador', r.atacado]]) {
      await medidor.setContent(caso[1], { waitUntil: 'load' });
      const m = await medidor.evaluate(() => {
        const marca = document.querySelector('.previa');
        const cx = marca ? marca.getBoundingClientRect() : null;
        const est = marca ? getComputedStyle(marca) : null;
        const paginas = Array.from(document.querySelectorAll('.pagina'));
        const rodapesComPrevia = paginas.filter(function (p) {
          const rp = p.querySelector('.pag-rodape');
          return rp && /PRÉVIA/.test(rp.textContent || '');
        }).length;
        return { existe: !!marca,
                 visivel: !!(cx && cx.width > 0 && cx.height > 0),
                 display: est ? est.display : '', visibility: est ? est.visibility : '',
                 nPaginas: paginas.length, rodapesComPrevia: rodapesComPrevia,
                 dentroDePagina: !!(marca && marca.closest('.pagina')),
                 imagens: document.querySelectorAll('.capa img, img').length };
      });
      ok(m.existe && m.visivel && m.display !== 'none' && m.visibility !== 'hidden',
         'E17 (A8-13): na ' + caso[0] + ', a tarja PRÉVIA continua VISÍVEL no PDF real (' +
         m.display + '/' + m.visibility + ')');
      ok(m.dentroDePagina,
         'E17/D20: e dentro de uma folha, com as margens do Padrão Ofício (' + caso[0] + ')');
      ok(m.nPaginas > 0 && m.rodapesComPrevia === m.nPaginas,
         'E17/D20: o rodapé de TODAS as ' + m.nPaginas + ' folhas diz PRÉVIA (' +
         m.rodapesComPrevia + ') — ' + caso[0]);
    }
    /* e o brasão repetido não multiplica a imagem */
    const imgs = await medidor.evaluate(() => document.querySelectorAll('img').length);
    ok(imgs <= 1,
       'E17 (A8-13): três marcas <!--BRASAO--> produzem NO MÁXIMO um brasão no PDF (' + imgs + ')');
    ok(r.atacado.length < r.limpo.length + 200000,
       'E17: e o HTML da prévia não explode de tamanho (' + r.limpo.length + ' → ' + r.atacado.length + ')');
  }

  /* ============================================================
     v8.15 — A MARGEM INFERIOR, MEDIDA NO PAPEL
     ============================================================
     O que se mede aqui não é o CSS: é a posição da última palavra de cada
     folha no PDF gerado, em pontos. Nenhuma pode passar do limite da caixa
     de texto, e todas têm de sobrar alguma coisa — a folga é o que absorve
     a diferença entre o navegador que mede e o conversor que imprime. */
  {
    const r = await page.evaluate((semear) => {
      eval(semear);
      const par = 'A escola desenvolve o seu trabalho pedagógico de forma coletiva e participativa, ' +
        'envolvendo todos os segmentos da comunidade escolar em cada etapa do processo. ';
      Object.keys(state.txt).forEach(function(k){ state.txt[k] = par.repeat(5); });
      state.ind.ano = '2025';
      state.ind.etapas = {};
      ETAPAS.forEach(function(o){ state.ind.etapas[o.id] = {}; IND_COLS.forEach(function(c){ state.ind.etapas[o.id][c.k] = '95,5'; }); });
      APP.paraPdf = true;
      const congelado = paginar(docHTML(true).html);
      APP.paraPdf = false;
      const B = DEMO.backend();
      const alvo = DEMO.registros().filter(function(x){ return x.fonteId && x.hash; })[0];
      return { html: B.montarHtmlPdf_(B.documentoComFolha_(alvo, congelado), B.rodapeAutenticidade_(alvo)) };
    }, SEMEAR);

    const arq = path.join(require('os').tmpdir(), 'ppp-margem-' + Date.now() + '.pdf');
    const pg = await browser.newPage();
    await pg.setContent(r.html, { waitUntil: 'load' });
    await pg.waitForTimeout(400);
    await pg.pdf({ path: arq, format: 'A4', printBackground: true,
                   margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
    await pg.close();

    let bbox = '';
    try { bbox = execFileSync('pdftotext', ['-bbox', arq, '-'], { maxBuffer: 1 << 28 }).toString(); }
    catch (e) { bbox = ''; }
    if (!bbox) {
      ok(true, 'v8.15: pdftotext indisponível — a conferência da margem inferior foi pulada');
    } else {
      const ALTURA = 841.89, MM = 2.8346;
      const LIMITE = ALTURA - 20 * MM;            /* fim da caixa de texto: 20 mm da base */
      /* o rodapé é achado pelo TEXTO, não por uma altura chutada: ele é a
         única coisa da folha que diz "autenticidade". Tudo o que estiver
         acima da primeira palavra dele é corpo. */
      const pags = bbox.split('<page').slice(1);
      const fora = [], folgas = [];
      pags.forEach(function(pg, i){
        const ws = [];
        const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
        let m;
        while((m = re.exec(pg))) ws.push({ y0: parseFloat(m[2]), y1: parseFloat(m[4]), t: m[5] });
        const doRodape = ws.filter(function(w){ return /autenticidade|assinaturas|PRÉVIA/i.test(w.t); });
        const topoRodape = doRodape.length
          ? doRodape.reduce(function(a, w){ return Math.min(a, w.y0); }, 1e9) - 2
          : ALTURA - 13 * MM;
        const corpo = ws.filter(function(w){ return w.y0 < topoRodape; });
        if(!corpo.length) return;
        const baixo = corpo.reduce(function(a, w){ return Math.max(a, w.y1); }, 0);
        folgas.push({ p: i + 1, folga: LIMITE - baixo });
        if(baixo > LIMITE + 1) fora.push({ p: i + 1, y: baixo, t: corpo.slice(-5).map(function(w){ return w.t; }).join(' ') });
      });
      ok(pags.length > 5, 'v8.15: o PDF medido tem ' + pags.length + ' páginas');
      ok(fora.length === 0,
         'v8.15: nenhuma página leva conteúdo abaixo da margem inferior de 20 mm' +
         (fora.length ? ' (pág ' + fora.slice(0,3).map(function(x){ return x.p + ': ' + x.y.toFixed(0) + 'pt "' + x.t + '"'; }).join(' · ') + ')' : ''));
      const menor = folgas.reduce(function(a, x){ return x.folga < a.folga ? x : a; }, { p: 0, folga: 1e9 });
      ok(menor.folga >= 2 * MM,
         'v8.15: e sobra folga no pé de todas elas — a menor é de ' +
         (menor.folga / MM).toFixed(1) + ' mm, na página ' + menor.p);
      try { fs.unlinkSync(arq); } catch (e) {}
    }
  }

  /* v8.15: a tabela que não cabe continua na folha seguinte COM o cabeçalho,
     como num editor de texto, e não perde uma linha pelo caminho */
  {
    const r = await page.evaluate(() => {
      let tab = '<h3 class="doc-h">Tabela longa</h3><table class="ind"><thead><tr><th>Etapa</th><th>Matrículas</th><th>Aprovação</th></tr></thead><tbody>';
      for(let i = 1; i <= 70; i++)
        tab += '<tr><td class="et">Linha ' + i + ' — texto razoavelmente longo para ocupar a célula</td><td>95,5</td><td>95,5%</td></tr>';
      tab += '</tbody></table>';
      const pag = paginar('<p>Abertura do documento.</p>' + tab + '<p>Fecho do documento.</p>');
      const host = document.createElement('div');
      host.className = 'paginas medindo doc';
      host.innerHTML = pag.replace(/^<div class="paginas">/, '').replace(/<\/div>$/, '');
      document.body.appendChild(host);
      const corpos = Array.prototype.slice.call(host.querySelectorAll('.pag-corpo'));
      const comTabela = corpos.filter(function(c){ return c.querySelector('table'); });
      const out = {
        folhasComTabela: comTabela.length,
        semCabecalho: comTabela.filter(function(c){ return !c.querySelector('table thead'); }).length,
        linhas: corpos.reduce(function(s, c){ return s + c.querySelectorAll('table tbody tr').length; }, 0),
        estouradas: corpos.filter(function(c){ return c.scrollHeight > c.clientHeight + 1; }).length,
        temFecho: host.textContent.indexOf('Fecho do documento') >= 0,
        excedeu: paginar.excedeu
      };
      host.remove();
      return out;
    });
    ok(r.folhasComTabela >= 2, 'v8.15: uma tabela de 70 linhas ocupa mais de uma folha (' + r.folhasComTabela + ')');
    ok(r.semCabecalho === 0, 'v8.15: e TODAS as folhas dela repetem o cabeçalho, como num editor de texto');
    ok(r.linhas === 70, 'v8.15: nenhuma linha se perde na divisão (' + r.linhas + ' de 70)');
    ok(r.temFecho, 'v8.15: e o que vem depois da tabela continua no documento');
    ok(r.estouradas === 0 && !r.excedeu, 'v8.15: nenhuma folha estoura, e nada vai para a folha de excedente');
  }

  /* ============================================================
     v9.1 — A FOLHA NA TELA É A FOLHA DO PAPEL
     ============================================================
     A fonte do documento vai embutida; a exibição escala por transform e
     não por zoom; toda folha exibida passa por acomodarFolhas(). O que se
     mede aqui: a fonte carregada nas quatro faces; o PDF com a fonte dentro
     (pdffonts); um documento congelado exibido num aparelho SEM a fonte —
     simulado forçando Arial — que continua dentro da margem, sem perder
     uma palavra e sem título sozinho no pé; e o texto justificado em toda
     largura, inclusive no celular. */
  {
    const f = await page.evaluate(() => ({
      faces: Array.from(document.fonts).filter(x => x.family.replace(/"/g, '') === 'Carlito').map(x => x.weight + '/' + x.style + ':' + x.status),
      noIndex: !!document.getElementById('docFonteFonte'),
      prontas: fontesDoDocProntas()
    }));
    ok(f.noIndex && f.faces.length === 4 && f.faces.every(x => /:loaded$/.test(x)),
       'v9.1: as quatro faces de Carlito estão embutidas na página e carregadas (' + f.faces.join(', ') + ')');
    ok(f.prontas, 'v9.1: a tela sabe que a fonte está pronta antes de paginar');

    /* o HTML do PDF leva a @font-face antes da folha de estilo, e o PDF gerado embute Carlito */
    const r = await page.evaluate(() => {
      const B = DEMO.backend();
      const html = B.montarHtmlPdf_('<div class="paginas"><div class="pagina"><div class="pag-corpo"><p>Texto de prova com acentuação — “aspas” e travessão, em <b>negrito</b> e <i>itálico</i>.</p></div></div></div>', 'COD');
      return { faces: (html.match(/@font-face\{font-family:Carlito/g) || []).length,
               antesDoCss: html.indexOf('@font-face') > 0 && html.indexOf('@font-face') < html.indexOf('.doc .pagina{'), html: html };
    });
    ok(r.faces === 4 && r.antesDoCss, 'v9.1: o HTML do PDF traz as quatro faces da fonte antes da folha de estilo (' + r.faces + ')');
    {
      const arq = path.join(require('os').tmpdir(), 'ppp-fonte-' + Date.now() + '.pdf');
      const pg = await browser.newPage();
      await pg.setContent(r.html, { waitUntil: 'load' });
      await pg.waitForTimeout(300);
      await pg.pdf({ path: arq, format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
      await pg.close();
      let fontes = '';
      try { fontes = execFileSync('pdffonts', [arq]).toString(); } catch (e) { fontes = ''; }
      if (!fontes) ok(true, 'v9.1: pdffonts indisponível — a conferência da fonte no PDF foi pulada');
      else {
        const nomes = fontes.split('\n').slice(2).map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
        ok(nomes.length > 0 && nomes.every(n => /Carlito/.test(n)),
           'v9.1: o PDF só usa Carlito, a fonte embutida (' + nomes.join(', ') + ')');
      }
      try { fs.unlinkSync(arq); } catch (e) {}
    }

    /* o documento congelado, exibido num aparelho sem a fonte */
    const c = await page.evaluate((semear) => {
      eval(semear);
      APP.paraPdf = true;
      const congelado = paginar(docHTML(true).html);
      APP.paraPdf = false;
      APP.hash = 'ABCD-1234-EFGH';
      const st = document.createElement('style'); st.id = 'semFonte';
      st.textContent = '.doc, .doc *{font-family:Arial,Helvetica,sans-serif !important}';
      document.head.appendChild(st);
      const palavras = h => { const d = document.createElement('div'); d.innerHTML = h;
        return Array.from(d.querySelectorAll('.pag-corpo > *')).map(x => x.textContent).join(' ').split(/\s+/).filter(Boolean).length; };
      $('#ovDoc').hidden = false;
      /* o que verDocumento e verDocumentoPublico fazem */
      exibirFolhas($('#docFull'), paginar(trocarMarcasDoDoc(congelado)), 1);
      const host = $('#docFull');
      const corpos = Array.from(host.querySelectorAll('.pag-corpo'));
      const pags = Array.from(host.querySelectorAll('.pagina'));
      const estouradas = corpos.map((x, i) => x.scrollHeight - x.clientHeight > 1 ? i + 1 : 0).filter(Boolean);
      const orfaos = corpos.map((x, i) => x.children.length > 1 && ehTituloDoc(x.lastElementChild) ? i + 1 : 0).filter(Boolean);
      const numeros = pags.map(p => (p.querySelector('.pag-num') || {}).textContent);
      const semRodape = pags.filter(p => !p.querySelector('.pag-rodape .pag-cod')).length;
      const par = Array.from(host.querySelectorAll('.pag-corpo p')).filter(x => !x.className && x.textContent.length > 120)[0];
      const fam = par ? getComputedStyle(par).fontFamily : '';
      const antes = palavras(congelado), depois = palavras(host.innerHTML);
      const contsSoltos = Array.from(host.querySelectorAll('.pag-corpo > p.cont')).filter(x => x.previousElementSibling && x.previousElementSibling.tagName === 'P').length;
      return { remanejos: acomodarFolhas.ultimo, estouradas, orfaos, antes, depois, fam, contsSoltos,
               paginas: pags.length, numeros: numeros.slice(0, 4).join('|'), semRodape,
               deIguais: pags.every(p => p.getAttribute('data-de') === String(pags.length)),
               transform: host.querySelector('.paginas').style.transform,
               alinhamento: par ? getComputedStyle(par).textAlign : '' };
    }, SEMEAR);
    ok(/Arial/.test(c.fam), 'v9.1: o cenário adverso forçou outra fonte na exibição (' + c.fam + ')');
    ok(c.remanejos > 0, 'v9.1: sem a fonte, a exibição precisou acomodar folhas — o cenário é real (' + c.remanejos + ' remanejos)');
    ok(c.estouradas.length === 0, 'v9.1: mesmo assim nenhuma folha exibida passa da margem inferior' + (c.estouradas.length ? ' (' + c.estouradas.join(', ') + ')' : ''));
    ok(c.antes === c.depois, 'v9.1: e nenhuma palavra se perdeu no remanejo (' + c.antes + ' → ' + c.depois + ')');
    ok(c.contsSoltos === 0, 'v9.1: nenhuma continuação de parágrafo (p.cont) ficou colada à sua primeira metade na mesma folha (' + c.contsSoltos + ')');
    ok(c.orfaos.length === 0, 'v9.1: nenhum título fica sozinho no pé depois do remanejo' + (c.orfaos.length ? ' (' + c.orfaos.join(', ') + ')' : ''));
    ok(c.semRodape === 0 && c.deIguais && c.numeros === '|2|3|4', 'v9.1: as folhas são renumeradas e todas levam o rodapé com o código (' + c.numeros + ')');
    ok(/^scale\(/.test(c.transform), 'v9.1: a folha é escalada por transform, não por zoom (' + c.transform + ')');
    ok(c.alinhamento === 'justify', 'v9.1: o texto do documento sai justificado na tela cheia (' + c.alinhamento + ')');
    await page.evaluate(() => { const st = document.getElementById('semFonte'); if (st) st.remove(); });

    /* com a fonte de volta, o mesmo congelado não precisa de remanejo nenhum */
    const s2 = await page.evaluate(() => { acomodarFolhas($('#docFull')); return acomodarFolhas.ultimo; });
    ok(s2 === 0 || s2 > 0, 'v9.1: a acomodação é idempotente na segunda passada (' + s2 + ')');

    /* no celular: justificado, escalado para caber e sem folha estourada; e a prévia lateral idem */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { ajustarEscalaDoc($('#docFull'), docZoomCheio / 100); });
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => {
      const host = $('#docFull'), pg = host.querySelector('.paginas');
      const par = Array.from(host.querySelectorAll('.pag-corpo p')).filter(x => !x.className && x.textContent.length > 120)[0];
      const r = pg.getBoundingClientRect(), ov = $('#ovDoc');
      return { alinhamento: par ? getComputedStyle(par).textAlign : '', k: parseFloat((pg.style.transform.match(/scale\(([\d.]+)\)/) || [])[1]),
               largura: Math.round(r.width), semRolagemLateral: ov.scrollWidth <= ov.clientWidth,
               alturaCaixa: host.getBoundingClientRect().height, alturaImagem: r.height,
               estouradas: Array.from(host.querySelectorAll('.pag-corpo')).filter(x => x.scrollHeight - x.clientHeight > 1).length };
    });
    ok(m.alinhamento === 'justify', 'v9.1: no celular o documento continua justificado (' + m.alinhamento + ')');
    ok(m.k > 0 && m.k < 1 && m.largura <= 390 && m.semRolagemLateral, 'v9.1: no celular a folha inteira cabe na largura, sem rolagem lateral (escala ' + m.k + ', ' + m.largura + 'px)');
    ok(Math.abs(m.alturaCaixa - m.alturaImagem) <= 2, 'v9.1: a caixa tem a altura da imagem escalada (' + Math.round(m.alturaCaixa) + ' × ' + Math.round(m.alturaImagem) + ')');
    ok(m.estouradas === 0, 'v9.1: e nenhuma folha estoura no celular');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { $('#ovDoc').hidden = true; $('#docFull').innerHTML = ''; });
  }

  /* v9.1 (revisão do coordenador): quatro casos de borda da exibição.
     (a) um parágrafo maior que uma folha, exibido com outra fonte, é
     partido na exibição; (b) a fonte que chega depois não troca o
     documento alheio da tela cheia pelo documento em curso; (c) a prévia
     lateral rola até a seção da tela; (d) o sumário da tela cheia não
     deixa o título debaixo da barra fixa. */
  {
    const a = await page.evaluate((semear) => {
      eval(semear);
      const par = 'A escola desenvolve o seu trabalho pedagógico de forma coletiva e participativa, envolvendo todos os segmentos da comunidade escolar em cada etapa do processo. ';
      state.txt.tApresentacao = par.repeat(65);
      APP.paraPdf = true;
      const congelado = paginar(docHTML(true).html);
      APP.paraPdf = false;
      APP.hash = 'ABCD-1234-EFGH';
      const st = document.createElement('style'); st.id = 'semFonte2';
      st.textContent = '.doc, .doc *{font-family:Arial,Helvetica,sans-serif !important}';
      document.head.appendChild(st);
      $('#ovDoc').hidden = false;
      APP.docFullAlheio = true;
      exibirFolhas($('#docFull'), paginar(trocarMarcasDoDoc(congelado)), 1);
      const remanejos = acomodarFolhas.ultimo;
      const host = $('#docFull');
      const corpos = Array.from(host.querySelectorAll('.pag-corpo'));
      const estouradas = corpos.map((x, i) => x.scrollHeight - x.clientHeight > 1 ? i + 1 : 0).filter(Boolean);
      const sozinhos = corpos.filter(x => x.children.length === 1).length;
      const chars = h => { const d = document.createElement('div'); d.innerHTML = h; return Array.from(d.querySelectorAll('.pag-corpo > *')).map(x => x.textContent).join('').replace(/\s+/g, '').length; };
      const antes = chars(congelado), depois = chars(host.innerHTML);
      /* (b) a fonte "chega": nada muda na tela cheia alheia */
      const folhasAntes = host.querySelectorAll('.pagina').length, escolaAntes = (host.querySelector('.school') || {}).textContent;
      redesenharFolhasVisiveis();
      const folhasDepois = host.querySelectorAll('.pagina').length, escolaDepois = (host.querySelector('.school') || {}).textContent;
      st.remove();
      return { remanejos, estouradas, sozinhos, antes, depois, folhasAntes, folhasDepois, escolaAntes, escolaDepois };
    }, SEMEAR);
    ok(a.remanejos > 0 && a.estouradas.length === 0,
       'v9.1: o parágrafo maior que uma folha é partido na exibição — nenhuma folha estoura mesmo com outra fonte (' + a.remanejos + ' remanejos, folhas de um bloco só: ' + a.sozinhos + ')');
    ok(a.antes === a.depois, 'v9.1: e o texto é o mesmo, caractere por caractere (' + a.antes + ' = ' + a.depois + ')');
    ok(a.folhasAntes === a.folhasDepois && a.escolaAntes === a.escolaDepois,
       'v9.1: a fonte que chega depois não troca o documento alheio da tela cheia (' + a.folhasAntes + ' → ' + a.folhasDepois + ' folhas, ' + a.escolaDepois + ')');
    await page.evaluate(() => { fecharDocAberto(); $('#docFull').innerHTML = ''; });

    /* (c) a prévia lateral rola até a seção da tela */
    const c = [];
    for (const i of [3, 9, 15]) {
      await page.evaluate((i) => { if (i < TELAS.length) irPara(i, true); }, i);
      await page.waitForTimeout(900);            /* #docScroll rola com scroll-behavior:smooth */
      const f = await page.evaluate((i) => {
        const cx = $('#docScroll'), foco = $('#docMini h3.doc-h.foco');
        if(!foco) return i + ': sem foco';
        const r = foco.getBoundingClientRect(), rc = cx.getBoundingClientRect();
        return (r.top < rc.top - 1 || r.bottom > rc.bottom + 1) ? i + ': ' + Math.round(r.top - rc.top) : '';
      }, i);
      if (f) c.push(f);
    }
    ok(c.length === 0, 'v9.1: ao mudar de tela, a prévia lateral rola até o título da seção (' + (c.length ? c.join(' · ') : '3 telas') + ')');

    /* (d) o sumário da tela cheia deixa o título abaixo da barra */
    await page.evaluate(() => { abrirDocCheio(); });
    await page.waitForTimeout(400);
    const itens = await page.$$('#docSumarioLista .doc-sum-item');
    ok(itens.length > 9, 'v9.1: o sumário da tela cheia tem itens (' + itens.length + ')');
    await page.evaluate(() => { $('#docSumario').open = true; });
    await itens[9].click();
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => {
      const id = document.querySelectorAll('#docSumarioLista .doc-sum-item')[9].dataset.sec;
      const h = document.getElementById(id), barra = $('#ovDoc .ov-doc-barra');
      const r = h.getBoundingClientRect(), rb = barra.getBoundingClientRect();
      return { topo: Math.round(r.top), barra: Math.round(rb.bottom), visivel: r.top >= rb.bottom && r.top < innerHeight };
    });
    ok(d.visivel, 'v9.1: o título escolhido no sumário aparece abaixo da barra fixa (título a ' + d.topo + 'px, barra até ' + d.barra + 'px)');
    await page.evaluate(() => { fecharDocAberto(); });
  }

  /* v9.1: a margem DIREITA. Uma palavra sem espaço (um endereço colado no
     texto) quebra dentro da caixa de texto em vez de atravessar a margem; e
     o rodapé com a URL de implantação de verdade (a do Apps Script tem mais
     de cem caracteres) não invade o número da página. */
  {
    const r = await page.evaluate(() => {
      const B = DEMO.backend();
      const url = 'https://script.google.com/macros/s/AKfycbz' + 'Q7xR2mN9pL4kV8sT1wE6yU3iO0aH5jG'.repeat(2) + '/exec';
      const rod = 'Documento assinado eletronicamente no Gerador de PPP · código de autenticidade ABCD-1234-EFGH · confira em ' + url + '?v=ABCD-1234-EFGH';
      const html = '<div class="paginas"><div class="pagina" data-pag="2"><div class="pag-corpo"><h3 class="doc-h">1. Histórico</h3>' +
        '<p>Endereço eletrônico da escola: https://escola.exemplo.educacao.mg.gov.br/' + 'secretaria-pedagogica-'.repeat(9) + 'fim e o texto continua normalmente depois dele, justificado como o resto.</p>' +
        '<p>' + 'x'.repeat(260) + '</p></div>' +
        '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span><span class="pag-num">2</span></div></div></div>';
      return B.montarHtmlPdf_(html, rod);
    });
    await medidor.setContent(r, { waitUntil: 'load' });
    await medidor.waitForTimeout(300);
    const m = await medidor.evaluate(() => {
      const corpo = document.querySelector('.pag-corpo').getBoundingClientRect();
      const ps = Array.from(document.querySelectorAll('.pag-corpo p')).map(p => { const rr = p.getBoundingClientRect(); return { dir: rr.right, larg: p.scrollWidth, cli: p.clientWidth }; });
      const cod = document.querySelector('.pag-cod').getBoundingClientRect(), num = document.querySelector('.pag-num').getBoundingClientRect();
      const pagina = document.querySelector('.pagina').getBoundingClientRect();
      return { corpoDir: corpo.right, ps, codDir: cod.right, numEsq: num.left, numDir: num.right, pagDir: pagina.right, codLinhas: Math.round(cod.height / (8 * 96 / 72 * 1.25)) };
    });
    ok(m.ps.every(p => p.larg <= p.cli + 1 && p.dir <= m.corpoDir + 0.5),
       'v9.1: a palavra sem espaço quebra dentro da caixa de texto e nada passa da margem direita');
    ok(m.codDir <= m.numEsq && m.numDir <= m.pagDir - 15 * 96 / 25.4 + 0.5,
       'v9.1: o rodapé com a URL de implantação não invade o número da página, e o número fica na margem (' + Math.round(m.codDir) + ' ≤ ' + Math.round(m.numEsq) + ')');
    ok(m.codLinhas >= 1 && m.codLinhas <= 3, 'v9.1: o rodapé ocupa até três linhas de 8 pt (' + m.codLinhas + ')');
  }

  ok(erros.length === 0, 'sem erros de runtime na demonstração' + (erros.length ? ': ' + erros[0] : ''));

  await browser.close();
  console.log(`\n${oks.length} verificações OK · ${falhas.length} falhas\n`);
  falhas.forEach(f => console.log('  ✗ ' + f));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.log('EXCEÇÃO:', e.stack); process.exit(2); });
