/* ============================================================
   MONTADOR DA PÁGINA ÚNICA (v8.0, P12)

   Desde a 8.0 o frontend vive em partes — Index (esqueleto), Css e App —,
   como o Apps Script serve em produção (include()). Este script junta as
   partes num arquivo HTML único:

     node montar.js                 → "Gerador de PPP.html"   (produção)
     node montar.js --demo          → "Gerador de PPP — demonstração.html"
     node montar.js --demo saida.html

   A build de DEMONSTRAÇÃO acrescenta, antes de </body>:
     · simulador-servicos.js — os serviços do Apps Script em memória;
     · o Code.gs REAL, verbatim, dentro de uma função que recebe esses
       serviços (sem eval: é um <script> comum, e funciona sob CSP);
     · Demo.html — a base fictícia e o despachante das chamadas.
   É por isso que a demonstração não reimplementa regra nenhuma: ela
   executa o mesmo servidor que a implantação.

   As baterias usam montar({demo:true}) e carregam a página resultante.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/** Os nomes declarados no topo do Code.gs — o que a demonstração pode chamar. */
function nomesDoTopo(src) {
  const nomes = [];
  const re = /^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) if (nomes.indexOf(m[1]) < 0) nomes.push(m[1]);
  return nomes;
}

const SERVICOS = ['SpreadsheetApp', 'DriveApp', 'MailApp', 'Utilities', 'LockService',
  'PropertiesService', 'CacheService', 'Session', 'ScriptApp', 'HtmlService', 'MimeType', 'Logger'];

/** O Code.gs embrulhado numa função que recebe os serviços simulados. */
function backendEmbutido() {
  const src = ler('Code.gs');
  const nomes = nomesDoTopo(src);
  /* "</script" dentro de uma string ou de uma expressão regular do código
     fecharia a tag; "<\/script" é equivalente em JavaScript e não fecha. */
  const seguro = src.replace(/<\/script/gi, '<\\/script');
  return '<script>\n' +
    '/* ============================================================\n' +
    '   O Code.gs REAL, embutido apenas nesta build de demonstração.\n' +
    '   Recebe os serviços simulados e devolve as suas funções: é ele que\n' +
    '   responde a cada chamada da tela, com as mesmas regras da\n' +
    '   implantação. NÃO faz parte do que se cola no Apps Script.\n' +
    '   ============================================================ */\n' +
    'window.__CODE_GS__ = function (' + SERVICOS.join(', ') + ') {\n' +
    seguro + '\n' +
    'return {' + nomes.map((n) => n + ': ' + n).join(', ') + '};\n' +
    '};\n</script>\n';
}

/** Resolve os include() do esqueleto e, na demonstração, injeta a demo. */
function montar(opcoes) {
  const demo = !!(opcoes && opcoes.demo);
  let html = ler('Index.html');
  html = html.replace(/<\?!=\s*include\('([A-Za-z0-9_-]+)'\);\s*\?>/g, (_, nome) => ler(nome + '.html').replace(/\s*$/, ''));
  /* v8.11: fora do Apps Script não há parâmetros do servidor — a página cai
     para a consulta da própria URL.
     v8.13: os parâmetros são dois atributos data- (<?= paramV ?> e
     <?= paramPa ?>); fora do Apps Script ficam vazios. */
  html = html.replace(/<\?=\s*param(?:V|Pa)\s*\?>/g, '');
  const bloco = demo
    ? '<script>\n' + ler('simulador-servicos.js') + '\n</script>\n' + backendEmbutido() + ler('Demo.html').replace(/\s*$/, '') + '\n'
    : '<!-- A demonstração (simulador-servicos.js, Code.gs embutido e Demo.html) não vai para a implantação. -->';
  /* v8.13 (E05) — O BLOCO ENTRA POR FUNÇÃO, NÃO POR STRING. Com uma string
     de substituição, o String.prototype.replace INTERPRETA `$'`, `` $` `` e
     `$&` — e uma dessas sequências dentro do Code.gs (num `new RegExp('…)$'
     + …)`, por exemplo) fazia o bloco embutido ser truncado no meio, sem
     erro nenhum no montador: a demonstração saía com um <script> quebrado e
     só a bateria de borda acusava. Com a função, o texto entra literal. */
  return html.replace('<!--DEMO-->', function () { return bloco; });
}

module.exports = { montar, nomesDoTopo, SERVICOS };

if (require.main === module) {
  const demo = process.argv.indexOf('--demo') >= 0;
  const resto = process.argv.slice(2).filter((a) => a !== '--demo');
  const saida = resto[0] || (demo ? 'Gerador de PPP — demonstração.html' : 'Gerador de PPP.html');
  const html = montar({ demo });
  fs.writeFileSync(path.isAbsolute(saida) ? saida : path.join(RAIZ, saida), html);
  console.log(saida + ' — ' + Math.round(html.length / 1024) + ' KB' + (demo ? ' (demonstração)' : ' (produção)'));
}
