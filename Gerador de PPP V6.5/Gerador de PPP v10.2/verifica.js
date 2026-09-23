const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
/* v8.0 (P12): a conferência estrutural roda sobre a página montada — a build
   de demonstração, que é a que funciona fora do Apps Script. */
const html=require('./montar.js').montar({demo:true}).replace('<?= JSON.stringify(token) ?>','"tok"');
const erros=[]; const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo/.test(e.message||'')) erros.push(e.message); });
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
 beforeParse(w){w.scrollTo=()=>{};w.alert=m=>erros.push('ALERT '+m);w.confirm=()=>true;
  w.HTMLElement.prototype.scrollIntoView=function(){};}});
setTimeout(()=>{
 const w=dom.window, d=w.document, TELAS=w.eval('TELAS');
 let falhas=[];
 // percorre todas as telas
 for(let i=0;i<TELAS.length;i++){
   try{ w.irPara(i, true); }
   catch(e){ falhas.push('tela '+i+' ('+TELAS[i].id+'): '+e.message); }
 }
 // preenche todos os campos e gera o documento
 const st=w.eval('state');
 Object.keys(st.txt).forEach(k=>st.txt[k]='Texto de teste para '+k+' com 2026 números e responsáveis definidos.');
 ['etapas','mods','infra','temas','principios','metodos'].forEach(g=>{
   w.eval('GRUPOS')[g].forEach(o=>st.sel[g].add(o.id));
 });
 let doc;
 try{ doc=w.docHTML(true).html; }catch(e){ falhas.push('docHTML: '+e.message); }
 const CHECK=w.eval('CHECK');
 const feitos=CHECK.filter(c=>{try{return c.ok()}catch(e){falhas.push('CHECK "'+c.t+'": '+e.message);return false}}).length;
 /* v8.13 (D14/A4-07) — A VERIFICAÇÃO DE RAIZ: o checklist da tela final não é
    uma lista paralela. Todo campo `!opcional` das TELAS tem de ser citado por
    algum item de CHECK. Sem isto, "Princípios norteadores" testava só a
    marcação e o documento saía sem a seção 3, com a tela dizendo
    "37 de 37 · TUDO PRONTO". Quem acrescentar campo obrigatório e esquecer o
    item encontra esta bateria vermelha. */
 {
   const citados = new Set();
   CHECK.forEach(c => { const f = String(c.ok);
     (f.match(/state\.txt\.(\w+)/g)||[]).forEach(m => citados.add(m.split('.')[2]));
     (f.match(/state\.dados\.(\w+)/g)||[]).forEach(m => citados.add(m.split('.')[2])); });
   const obrig = [];
   TELAS.forEach(t => (t.campos||[]).forEach(c => { if(!c.opcional) obrig.push(c.id); }));
   const orfaos = obrig.filter(id => !citados.has(id));
   console.log('campos obrigatórios das TELAS cobertos pelo checklist:', (obrig.length-orfaos.length)+'/'+obrig.length);
   if(orfaos.length) falhas.push('campo(s) obrigatório(s) das TELAS que nenhum item do checklist confere: '+orfaos.join(', '));
 }
 /* v8.13 (D16) — UMA FOLHA DE ESTILO SÓ PARA O DOCUMENTO.
    A tipografia do documento vivia em dois lugares — Css.html, com que a
    tela media a paginação, e uma cópia escrita à mão dentro do Code.gs, com
    que o PDF era impresso. As duas divergiam em onze regras de quebra e o
    documento fechava em 21 folhas na tela e 20 no papel. Agora ela mora em
    DocCss.html, e só lá. Esta conferência falha se alguém voltar a escrever
    regra de documento no servidor ou na folha de estilo da interface. */
 {
   const gs = fs.readFileSync('./Code.gs','utf8');
   const css = fs.readFileSync('./Css.html','utf8');
   const docCss = fs.readFileSync('./DocCss.html','utf8');
   const marcas = ['text-indent:25mm', '.pag-corpo{height', 'table.cxs{', '.cx-esp{', '.ref-item{'];
   marcas.forEach(function(m){
     if(gs.indexOf(m) >= 0) falhas.push('regra de tipografia do documento de volta no Code.gs: "'+m+'" — ela mora em DocCss.html');
     if(css.indexOf(m) >= 0) falhas.push('regra de tipografia do documento de volta no Css.html: "'+m+'" — ela mora em DocCss.html');
     if(docCss.indexOf(m) < 0) falhas.push('regra que saiu do Code.gs e não chegou ao DocCss.html: "'+m+'"');
   });
   if(!/docCss_\(\)/.test(gs)) falhas.push('montarHtmlPdf_ deixou de emitir a folha de estilo do documento (docCss_)');
   if(!/include\('DocCss'\)/.test(fs.readFileSync('./Index.html','utf8'))) falhas.push('o Index deixou de incluir DocCss');
   if(html.indexOf('id="docCssFonte"') < 0) falhas.push('a página montada não carrega DocCss.html');
   /* v9.1: a fonte do documento vai embutida, antes da folha de estilo, na tela e no PDF */
   const idx = fs.readFileSync('./Index.html','utf8');
   if(!/include\('DocFonte'\)/.test(idx)) falhas.push('o Index deixou de incluir DocFonte');
   if(idx.indexOf("include('DocFonte')") > idx.indexOf("include('DocCss')")) falhas.push('DocFonte tem de vir antes de DocCss no Index');
   if(html.indexOf('id="docFonteFonte"') < 0) falhas.push('a página montada não carrega DocFonte.html');
   const docFonte = fs.readFileSync('./DocFonte.html','utf8');
   const faces = (docFonte.match(/@font-face\{font-family:Carlito;/g)||[]).length;
   if(faces !== 4) falhas.push('DocFonte.html tem de trazer as quatro faces de Carlito (tem '+faces+')');
   if(docFonte.length > 200000) falhas.push('DocFonte.html cresceu demais ('+docFonte.length+' bytes): o subconjunto é só o latim');
   if(!/docFonte_\(\)/.test(gs)) falhas.push('montarHtmlPdf_ deixou de emitir a fonte do documento (docFonte_)');
   if(gs.indexOf('docFonte_() +') > gs.indexOf('docCss_() +')) falhas.push('no PDF, a fonte tem de vir antes da folha de estilo');
   if(/\.docwrap--full \.doc p[^{]*\{[^}]*text-align:left/.test(css)) falhas.push('o documento voltou a sair alinhado à esquerda no celular (Css.html)');
   if(/\.docwrap--mini \.doc\{font-size/.test(css)) falhas.push('a prévia lateral voltou a ter tamanho de letra próprio (Css.html) — a folha é escalada por transform');
   console.log('DocFonte — faces:', faces, '· bytes:', docFonte.length);
   const foraDoEscopo = (docCss.replace(/\/\*[\s\S]*?\*\//g,'').match(/^[^@\s}{][^{}]*\{/gm)||[])
     .filter(function(r){ return !/(^|,)\s*\.doc(?![A-Za-z0-9_-])/.test(r); });
   if(foraDoEscopo.length) falhas.push('regra de DocCss.html fora do escopo .doc: '+foraDoEscopo.slice(0,3).join(' | '));
   console.log('DocCss — regras do documento:', (docCss.match(/\{/g)||[]).length, '· fora do escopo .doc:', foraDoEscopo.length);
 }

 /* v8.13 (D23) — O QUE É CITADO TEM ENTRADA NA LISTA DE REFERÊNCIAS.
    O texto fixo citava a LGPD (13.709/2018) em T.publicidade e T.digital e a
    Lei de Acesso à Informação (12.527/2011) em T.publicidade, e nenhuma das
    duas estava em REF_LEGISLACAO nem em REF_COND: um documento que invoca a
    ABNT no sumário não pode citar norma sem referenciá-la. Esta conferência
    falha enquanto houver uma. */
 {
   const T = w.eval('T'), REFL = w.eval('REF_LEGISLACAO'), REFC = w.eval('REF_COND');
   let todas = REFL.slice();
   Object.keys(REFC).forEach(function(g){
     Object.keys(REFC[g]).forEach(function(id){ todas = todas.concat(REFC[g][id]); });
   });
   const base = todas.join(' | ');
   const citadas = {};
   Object.keys(T).forEach(function(k){
     (String(T[k] || '').match(/\d{1,3}(?:\.\d{3})+\s*\/\s*\d{4}/g) || []).forEach(function(c){
       const num = c.split('/')[0].trim();
       if(!citadas[num]) citadas[num] = [];
       if(citadas[num].indexOf(k) < 0) citadas[num].push(k);
     });
   });
   const semEntrada = Object.keys(citadas).filter(function(n){ return base.indexOf('nº ' + n) < 0; });
   console.log('normas citadas por número nos textos fixos:', Object.keys(citadas).length,
               '· sem entrada nas referências:', semEntrada.length);
   semEntrada.forEach(function(n){
     falhas.push('norma citada em T.' + citadas[n].join(', T.') + ' e sem entrada nas referências: nº ' + n);
   });
 }

 /* v8.13 (E06) — A GRAMÁTICA DO CAMINHO NÃO PODE RECUSAR CAMINHO LEGÍTIMO.
    `curadoriaSalvar` passou a recusar caminho fora da gramática; se ela for
    estreita demais, a curadoria deixa de gravar um texto que sempre gravou.
    Aqui os 1.000+ caminhos que montarMapa() oferece são passados, um a um,
    pela MESMA função do servidor — carregada sobre o simulador, como a
    bateria de servidor faz. */
 {
   const SS = require('./simulador-servicos.js');
   const Sv = SS.criarServicos({ nomePlanilha: 'conferência estrutural' });
   const Bv = SS.carregarCodigo(fs.readFileSync('./Code.gs', 'utf8'), Sv);
   let mapaV = [];
   try { mapaV = w.eval('montarMapa()'); } catch (e) { falhas.push('E06: montarMapa: ' + e.message); }
   const caminhosV = [];
   mapaV.forEach(function (g) { (g.campos || []).forEach(function (c) { caminhosV.push(c.p); }); });
   const recusados = caminhosV.filter(function (c) { return Bv.caminhoDeConteudo_(c) !== ''; });
   if (recusados.length) {
     falhas.push('E06: a gramática recusa caminho que a curadoria oferece (' + recusados.length + '): ' +
       recusados.slice(0, 8).map(function (c) { return c + ' (' + Bv.caminhoDeConteudo_(c) + ')'; }).join(' · '));
   }
   console.log('caminhos da curadoria aceitos pela gramática do servidor:',
     (caminhosV.length - recusados.length) + '/' + caminhosV.length);
 }

 /* v10.2 — NÃO HÁ MAIS PARÂMETRO DE REDE, E É ISSO QUE SE CONFERE.
    A v8.13 (E06) mantinha duas cópias do bloco REDE — App.html e Code.gs —
    e as comparava chave a chave, porque o servidor precisava resolver
    {{REDE.chave}} nos e-mails e na folha. Os marcadores saíram na 10.2: a
    citação está escrita em cada texto. O que se confere agora é a ausência,
    nos dois arquivos e no conteúdo — um marcador que sobrasse sairia literal
    no e-mail e congelado dentro do PDF. */
 {
   const gs = fs.readFileSync('./Code.gs', 'utf8');
   const app = fs.readFileSync('./App.html', 'utf8');
   const idx = fs.readFileSync('./Index.html', 'utf8');
   if (/const REDE_PADRAO = \{/.test(gs)) falhas.push('v10.2: REDE_PADRAO voltou ao Code.gs');
   if (/^const REDE = \{/m.test(app)) falhas.push('v10.2: o bloco REDE voltou ao App.html');
   /* marcador em TEXTO (fora de comentário): o que importa é o conteúdo */
   let marcadores = 0;
   ['T', 'UI', 'VIDEOS', 'MODULOS', 'TELAS', 'ETAPAS', 'MODALIDADES', 'INFRA', 'TEMAS',
    'PRINCIPIOS', 'METODOS', 'DETALHES', 'REF_COND', 'SECOES', 'SUBSECOES', 'VAZIOS'].forEach(function (raiz) {
     let v = null;
     try { v = w.eval(raiz); } catch (e) { return; }
     marcadores += (JSON.stringify(v).match(/\{\{[^}]+\}\}/g) || []).length;
   });
   try { marcadores += (JSON.stringify(w.eval('REF_LEGISLACAO')).match(/\{\{[^}]+\}\}/g) || []).length; } catch (e) {}
   const noServidor = (JSON.stringify(w.eval('CONTEUDO').padroesServidor || {}).match(/\{\{[^}]+\}\}/g) || []).length;
   const noIndex = (idx.match(/\{\{REDE\.[A-Za-z]+\}\}/g) || []).length;
   if (marcadores) falhas.push('v10.2: ' + marcadores + ' marcador(es) {{…}} ainda no conteúdo da tela');
   if (noServidor) falhas.push('v10.2: ' + noServidor + ' marcador(es) {{…}} ainda nos textos do servidor');
   if (noIndex) falhas.push('v10.2: ' + noIndex + ' marcador(es) {{REDE.…}} ainda no Index.html');
   console.log('marcadores {{…}} no conteúdo:', marcadores + noServidor + noIndex, '(esperado: 0)');
 }

 /* v8.13 (E01) — A SUPERFÍCIE PÚBLICA DO SERVIDOR É UM CONTRATO, E ELE SE
    CONFERE. No Apps Script, toda função de topo sem "_" final é chamável por
    qualquer navegador que abra o app. Eram 76; 18 delas eram rotinas de
    manutenção, uma das quais trocava a senha do Órgão Central sem sessão
    nenhuma. Daqui para a frente, publicar uma função é uma DECISÃO: ou ela
    está em API_TELA (a lista do que a tela pede), ou é um invólucro `menu…`
    (que somenteMenu_ guarda), ou é uma das quatro que o Apps Script exige
    pelo nome — doGet, include, onOpen e o próprio despachante api.
    Esta é a parte que dura: quem escrever `function rotinaNova()` de topo
    encontra esta conferência vermelha. */
 {
   const gs = fs.readFileSync('./Code.gs', 'utf8');
   const PERMITIDAS = ['doGet', 'include', 'onOpen', 'api'];
   /* as chaves de API_TELA, lidas do próprio arquivo */
   const mMapa = gs.match(/const API_TELA = \{([\s\S]*?)\n\};/);
   if (!mMapa) falhas.push('E01: não achei o mapa API_TELA no Code.gs');
   const daApi = new Set();
   if (mMapa) {
     (mMapa[1].match(/^\s*([A-Za-z_$][\w$]*)\s*:/gm) || [])
       .forEach(function (x) { daApi.add(x.replace(/[\s:]/g, '')); });
   }
   const topo = (gs.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm) || [])
     .map(function (x) { return x.replace(/^function\s+/, '').replace(/\s*\($/, ''); });
   const publicas = topo.filter(function (n) { return !/_$/.test(n); });
   const fora = publicas.filter(function (n) {
     return PERMITIDAS.indexOf(n) < 0 && !/^menu[A-Z]/.test(n) && !daApi.has(n);
   });
   if (fora.length) {
     falhas.push('E01: função de topo pública fora do contrato (ponha-a em API_TELA, dê-lhe o sublinhado, ' +
       'ou faça dela um invólucro menu…): ' + fora.join(', '));
   }
   /* o outro lado: nome no mapa que não existe como função de topo pública
      quebraria a tela inteira no primeiro clique */
   const semFuncao = Array.from(daApi).filter(function (n) { return publicas.indexOf(n) < 0; });
   if (semFuncao.length) {
     falhas.push('E01: API_TELA aponta para nome que não é função de topo pública: ' + semFuncao.join(', '));
   }
   /* e o contrato do outro lado ainda: tudo o que a tela chama por
      servidor('…') tem de estar no mapa */
   const app = fs.readFileSync('./App.html', 'utf8');
   const chamados = new Set();
   (app.match(/servidor\(\s*'[A-Za-z0-9_]+'/g) || [])
     .forEach(function (x) { chamados.add(x.replace(/^servidor\(\s*'/, '').replace(/'$/, '')); });
   const semMapa = Array.from(chamados).filter(function (n) { return !daApi.has(n); });
   if (semMapa.length) {
     falhas.push('E01: a tela chama servidor(\'…\') para nome fora de API_TELA — a tela quebraria: ' +
       semMapa.join(', '));
   }
   /* todo invólucro de menu começa por somenteMenu_() */
   const semGuarda = [];
   publicas.filter(function (n) { return /^menu[A-Z]/.test(n); }).forEach(function (n) {
     const i = gs.indexOf('function ' + n + '(');
     const corpo = gs.slice(i, i + 400);
     if (!/somenteMenu_\(\)/.test(corpo)) semGuarda.push(n);
   });
   if (semGuarda.length) falhas.push('E01: invólucro de menu sem somenteMenu_(): ' + semGuarda.join(', '));
   /* nenhum item de menu pode apontar para função privada: o Apps Script não
      resolve nome com sublinhado em addItem */
   const itens = (gs.match(/\.addItem\('[^']*',\s*'([A-Za-z_$][\w$]*)'\)/g) || [])
     .map(function (x) { return x.replace(/^[\s\S]*,\s*'/, '').replace(/'\)$/, ''); });
   const itensPrivados = itens.filter(function (n) { return /_$/.test(n); });
   if (itensPrivados.length) {
     falhas.push('E01: item de menu apontando para função privada (não resolve): ' + itensPrivados.join(', '));
   }
   console.log('superfície pública do Code.gs:', publicas.length, 'funções ·', daApi.size, 'em API_TELA ·',
     publicas.filter(function (n) { return /^menu[A-Z]/.test(n); }).length, 'invólucros de menu ·',
     PERMITIDAS.length, 'exigidas pelo Apps Script');
 }

 /* v8.13 (D25) — O GUARDA DA EXCLUSÃO DE PPP FICA NO CAMINHO, NÃO NO
    COMENTÁRIO. `recusaExclusaoDePPP_` não era chamada por caminho nenhum:
    a única ocorrência no Code.gs era a própria definição, e as baterias
    verdes davam a impressão de que a proteção estava ativa. Hoje não há
    deleteRow sobre a aba de registros — o risco é de REGRESSÃO. É isso que
    esta conferência protege: aparecendo remoção de linha nessa aba sem o
    guarda na mesma função, ela falha e diz a linha. Os deleteRow legítimos
    (acessos, conteúdo, fila e histórico) não a acendem, porque a
    identificação é pela ORIGEM da variável. */
 {
   const gs = fs.readFileSync('./Code.gs', 'utf8');
   const linhaDe = function (pos) { return gs.slice(0, pos).split('\n').length; };
   /* as funções de topo: começam em "function nome(" na coluna 0 e terminam
      no "}" da coluna 0 */
   const funcoes = [];
   const reFn = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
   let mf;
   while ((mf = reFn.exec(gs))) {
     const fim = gs.indexOf('\n}', mf.index);
     funcoes.push({ nome: mf[1], ini: mf.index, corpo: gs.slice(mf.index, fim < 0 ? gs.length : fim + 2) });
   }
   let comDelete = 0;
   funcoes.forEach(function (f) {
     const reDel = /([A-Za-z_$][\w$]*(?:_\(\))?)\s*\.\s*deleteRows?\s*\(/g;
     let md;
     while ((md = reDel.exec(f.corpo))) {
       comDelete++;
       const alvo = md[1];
       let daAbaDeRegistros;
       if (/\(\)$/.test(alvo)) {
         /* chamada direta — abaAcessos_().deleteRow(…) decide por si mesma */
         daAbaDeRegistros = /^abaRegistros_\(\)$/.test(alvo);
       } else {
         /* de onde vem a variável, dentro desta mesma função */
         const reOrigem = new RegExp('(?:const|let|var)\\s+' + alvo + '\\s*=\\s*([^;\\n]+)');
         const mo = f.corpo.match(reOrigem);
         /* variável que vem de fora (parâmetro) numa função que também pega a
            aba de registros: trata-se como se fosse dela — é o caso duvidoso,
            e num guarda de exclusão o duvidoso conta como sim */
         daAbaDeRegistros = mo ? /abaRegistros_/.test(mo[1]) : /abaRegistros_\s*\(/.test(f.corpo);
       }
       if (daAbaDeRegistros && !/recusaExclusaoDePPP_/.test(f.corpo)) {
         falhas.push('remoção de linha na aba de registros sem recusaExclusaoDePPP_: ' +
           f.nome + '(), Code.gs linha ' + linhaDe(f.ini + md.index));
       }
     }
   });
   console.log('remoções de linha no servidor:', comDelete, '· sobre a aba de registros sem guarda:',
     falhas.filter(function (x) { return /recusaExclusaoDePPP_/.test(x); }).length);
 }

 // curadoria: o mapa cobre todos os textos novos?
 let mapa=[]; try{ mapa=w.eval('montarMapa()'); }catch(e){ falhas.push('montarMapa: '+e.message); }
 const caminhos=new Set(); mapa.forEach(g=>(g.campos||[]).forEach(c=>caminhos.add(c.p)));
 const faltamT=Object.keys(w.eval('T')).filter(k=>!caminhos.has('T.'+k));
 const faltamSub=Object.keys(w.eval('SUBSECOES')).filter(k=>!caminhos.has('SUBSECOES.'+k));
 const faltamSec=Object.keys(w.eval('SECOES')).filter(k=>!caminhos.has('SECOES.'+k));
 console.log('telas percorridas:', TELAS.length);
 console.log('checklist:', feitos+'/'+CHECK.length, '(tudo preenchido menos aprovação)');
 console.log('documento:', doc? doc.length+' caracteres':'FALHOU');
 console.log('curadoria — campos editáveis:', caminhos.size);
 console.log('  textos T fora da curadoria:', faltamT.length?faltamT.join(','):'nenhum');
 console.log('  subseções fora da curadoria:', faltamSub.length?faltamSub.join(','):'nenhuma');
 console.log('  seções fora da curadoria:', faltamSec.length?faltamSec.join(','):'nenhuma');
 /* v10.2: sem parâmetro, cada citação pendente é um texto a corrigir na
    curadoria — o número aqui é o tamanho do trabalho que a publicação da
    resolução vai gerar, e o aviso da tela de edição leva a cada um. */
 console.log('resolução ainda citada como placeholder no documento:', (doc.match(/\[nº a publicar\]/g)||[]).length, 'vezes');
 {
   let campos = 0;
   try {
     w.eval('montarMapa()').forEach(function (g) {
       if (g.historico) return;
       g.campos.forEach(function (c) {
         if (String(w.paraCaixa(w.valorAtual(c.p), c.tipo)).indexOf('[nº a publicar]') >= 0) campos++;
       });
     });
   } catch (e) { falhas.push('v10.2: não consegui contar as pendências da resolução: ' + e.message); }
   console.log('textos da curadoria a corrigir quando a resolução sair:', campos);
 }
 console.log('erros de runtime:', erros.length?erros.join(' | '):'nenhum');
 console.log(falhas.length? '\nFALHAS:\n  '+falhas.join('\n  ') : '\nSem falhas.');
 process.exit(falhas.length||erros.length?1:0);
},500);
