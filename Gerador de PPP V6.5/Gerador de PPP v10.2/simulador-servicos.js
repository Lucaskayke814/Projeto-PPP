/* ============================================================
   SIMULADOR DOS SERVIÇOS DO APPS SCRIPT (v8.0, P12)

   Uma implementação em memória, em JavaScript puro, dos serviços que o
   Code.gs usa: SpreadsheetApp, DriveApp, MailApp, Utilities, LockService,
   PropertiesService, CacheService, Session, ScriptApp, HtmlService,
   MimeType e Logger. Serve a DUAS coisas:
     · à bateria de servidor (teste-backend.js), no Node;
     · ao modo de demonstração do Index, no navegador — que desde a 8.0
       executa o Code.gs REAL sobre estes serviços, em vez de um
       simulador reescrito à mão (a divergência entre os dois foi uma
       classe inteira de defeitos: T-16).
   Nada aqui conhece as regras do sistema: só imita a planilha, o Drive,
   o e-mail e o cache. Os ganchos em `estado` permitem às baterias medir
   leituras, travas, e-mails e backups, e fazer o e-mail falhar.
   ============================================================ */
(function (raiz) {
  'use strict';

  /* v8.9: o conteúdo de um arquivo do projeto, como o Apps Script o serve. */
  function arquivoDoProjeto(nome) {
    try {
      if (typeof require === 'function' && typeof process !== 'undefined') {
        const fs = require('fs'), path = require('path');
        return fs.readFileSync(path.join(__dirname, nome + '.html'), 'utf8');
      }
    } catch (e) {}
    try {
      const el = document.getElementById('brasaoFonte');
      if (nome === 'Brasao' && el) return el.innerHTML;
      /* v8.13 (D16): a folha de estilo do documento também é um arquivo do
         projeto — o servidor a emite no <style> do PDF (docCss_()). Na
         demonstração dentro do navegador ela já está no <head> da própria
         página, posta lá pelo Index; devolvê-la aqui é o que faz o PDF
         montado na demonstração sair com a MESMA tipografia do papel. */
      const cs = document.getElementById('docCssFonte');
      if (nome === 'DocCss' && cs) return '<style>' + cs.textContent + '</style>';
      /* v9.1: a fonte embutida do documento segue o mesmo caminho (docFonte_()). */
      const cf = document.getElementById('docFonteFonte');
      if (nome === 'DocFonte' && cf) return '<style>' + cf.textContent + '</style>';
    } catch (e) {}
    return '';
  }

  /* ---------- SHA-256 em JavaScript puro (síncrono, como computeDigest) ---------- */
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function utf8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) { c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function sha256(entrada) {
    const msg = Array.isArray(entrada) ? entrada.map(function (b) { return b & 255; }) : utf8(String(entrada));
    const l = msg.length;
    const bits = l * 8;
    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);
    for (let i = 7; i >= 0; i--) msg.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Array(64);
    const rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (let i = 0; i < msg.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = (msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | msg[i + t * 4 + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = [];
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach(function (x) { out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); });
    /* o Apps Script devolve bytes com sinal */
    return out.map(function (b) { return b > 127 ? b - 256 : b; });
  }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes) {
    const b = Array.isArray(bytes) ? bytes.map(function (x) { return x & 255; }) : utf8(String(bytes));
    let s = '';
    for (let i = 0; i < b.length; i += 3) {
      const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return s;
  }
  function base64Decode(s) {
    const out = []; let buf = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64.indexOf(s[i]); if (v < 0) continue;
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
    }
    return out.map(function (b) { return b > 127 ? b - 256 : b; });
  }
  /** Um PDF mínimo, válido, de uma página com o título — o que "getAs(PDF)" entrega na demonstração. */
  function pdfMinimo(titulo) {
    const limpa = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, ' ').slice(0, 90); };
    const stream = 'BT /F1 14 Tf 60 780 Td (' + limpa(titulo || 'Gerador de PPP') + ') Tj ' +
      '0 -24 Td /F1 11 Tf (PDF gerado pelo modo de demonstracao. Implantado, o sistema entrega o documento oficial.) Tj ET';
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let pdf = '%PDF-1.4\n'; const offs = [];
    objs.forEach(function (o, i) { offs.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('');
    pdf += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return utf8(pdf);
  }

  /* ---------- planilha em memória ---------- */
  function textFinder(cel, r0, c0, nr, nc, txt) {
    let inteira = false; const alvo = String(txt).toLowerCase();
    const acha = function (v) { const t = String(v == null ? '' : v).toLowerCase(); return inteira ? t === alvo : t.indexOf(alvo) >= 0; };
    const todos = function () {
      const out = [];
      for (let r = r0; r < r0 + nr; r++) for (let c = c0; c < c0 + nc; c++) if (acha(cel[r + ':' + c])) out.push({ getRow: function () { return r; }, getColumn: function () { return c; } });
      return out;
    };
    const tf = { matchEntireCell: function (b) { inteira = b !== false; return tf; }, matchCase: function () { return tf; },
                 findNext: function () { return todos()[0] || null; }, findAll: function () { return todos(); } };
    return tf;
  }

  function criarServicos(op) {
    op = op || {};
    const estado = {
      LEITURAS: [], TRAVAS: { n: 0, preso: false, soltas: 0 }, BACKUPS: [], CACHE: { c: {}, ttl: {} }, CRIADAS: [],
      /* v8.8 (B3): arquivos criados no Drive, com a marca de estar ou não
         dentro da trava — é o que permite conferir que a geração do PDF saiu
         da seção crítica */
      ARQUIVOS_CRIADOS: [],
      /* v8.13 (D24), aperto 1: toda escrita em célula fica registrada com a
         marca de estar ou não dentro da trava do script. Sem isto não havia
         como provar que a regravação de uma linha de registro acontece sob
         exclusão mútua — e era justamente essa lacuna que deixava A5-01 e
         A5-02 (a gravação da escola apagando a conclusão e a validação)
         passarem verdes pelas quatro baterias. */
      GRAVACOES: [],
      /* v8.13 (E13): as REMOÇÕES DE LINHA, com a mesma marca de trava. É o
         que a fila de e-mails custa de verdade no Sheets real (cada
         `deleteRows` é uma chamada de rede), e sem registrá-las não havia
         como provar que o expurgo saiu de dentro do envio. */
      REMOCOES: [],
      MAIL: { falha: '', cota: op.cota || 100 }, arquivos: {}, emails: [], triggers: [], abas: {},
      nomePlanilha: op.nomePlanilha || 'Gerador de PPP — base', identidade: op.identidade || '',
      urlApp: op.urlApp || 'https://script.google.com/macros/s/DEMO/exec', props: {}, seq: 0, agora: null
    };
    const arquivos = estado.arquivos;
    const proximoId = function (p) { return (p || 'f') + (++estado.seq); };

    /* v8.13 (D24), aperto 3: o Sheets recusa célula acima de 50.000
       caracteres e a recusa derruba a linha inteira. O simulador aceitava
       qualquer tamanho, de modo que o guarda de celulaGrandeDemais_ (45.000)
       nunca era exercitado: ele podia sumir sem nenhuma bateria reclamar. */
    const LIMITE_CELULA_SHEETS = 50000;
    function conferirTamanhoCelula(v, aba, r, c) {
      if (typeof v === 'string' && v.length > LIMITE_CELULA_SHEETS) {
        throw new Error('Your input contains more than the maximum of 50000 characters in a single cell. ('
          + aba + '!' + r + ':' + c + ' com ' + v.length + ')');
      }
    }

    function novaAba(nome) {
      /* v8.13 (D24), aperto 2: o formato por célula. O Sheets só guarda texto
         começado por "=" como texto quando o formato é '@'; sem isso ele
         interpreta como FÓRMULA e a leitura devolve o erro. O simulador
         devolvia o valor cru, e era por isso que A4-05 (o texto do PPP que
         começa por "=") não aparecia em bateria nenhuma. */
      const cel = {}; const fmtCel = {}; let nl = 0, nc = 0;
      const A = {
        getName: function () { return nome; }, getLastRow: function () { return nl; }, getLastColumn: function () { return nc; },
        linhas: cel,
        getRange: function (r0, c0, nr, ncol) {
          if (typeof r0 === 'string') {   // 'A:A'
            const col = r0.charCodeAt(0) - 64;
            return { createTextFinder: function (txt) { return textFinder(cel, 1, col, nl, 1, txt); } };
          }
          nr = nr || 1; ncol = ncol || 1;
          /* v8.13 (C10) — o Sheets recusa faixa fora das dimensões; este
             simulador aceitava linha 0 e devolvia um objeto utilizável, e é
             por ser permissivo aqui que nenhuma das quatro baterias viu o
             getRange(0, …) da carga de escolas. */
          if (r0 < 1 || c0 < 1 || nr < 1 || ncol < 1) {
            throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
          }
          const o = {
            createTextFinder: function (txt) { return textFinder(cel, r0, c0, nr, ncol, txt); },
            getValues: function () { estado.LEITURAS.push({ aba: nome, r0: r0, c0: c0, nr: nr, nc: ncol }); const out = []; for (let r = 0; r < nr; r++) { const row = []; for (let c = 0; c < ncol; c++) { const v = cel[(r0 + r) + ':' + (c0 + c)]; row.push(v == null ? '' : v); } out.push(row); } return out; },
            /* v8.13 (D24): o que a planilha MOSTRA. Texto começado por "=" em
               célula que não está formatada como texto ('@') é fórmula para o
               Sheets, e uma fórmula inválida se lê como '#ERROR!'. */
            getDisplayValues: function () {
              const vals = o.getValues();
              return vals.map(function (row, r) {
                return row.map(function (v, c) {
                  const s = String(v == null ? '' : v);
                  if (s.charAt(0) === '=' && fmtCel[(r0 + r) + ':' + (c0 + c)] !== '@') return '#ERROR!';
                  return s;
                });
              });
            },
            setValues: function (vals) { vals.forEach(function (row, r) { row.forEach(function (v, c) { conferirTamanhoCelula(v, nome, r0 + r, c0 + c); }); }); vals.forEach(function (row, r) { row.forEach(function (v, c) { cel[(r0 + r) + ':' + (c0 + c)] = v; nl = Math.max(nl, r0 + r); nc = Math.max(nc, c0 + c); }); }); estado.GRAVACOES.push({ aba: nome, r0: r0, c0: c0, nr: vals.length, nc: (vals[0] || []).length, comTrava: !!estado.TRAVAS.preso }); return o; },
            setValue: function (v) { conferirTamanhoCelula(v, nome, r0, c0); cel[r0 + ':' + c0] = v; nl = Math.max(nl, r0); nc = Math.max(nc, c0); estado.GRAVACOES.push({ aba: nome, r0: r0, c0: c0, nr: 1, nc: 1, comTrava: !!estado.TRAVAS.preso }); return o; },
            getRow: function () { return r0; },
            setFontWeight: function () { return o; }, setBackground: function () { return o; }, setFontColor: function () { return o; },
            setNumberFormat: function (f) { for (let r = 0; r < nr; r++) for (let c = 0; c < ncol; c++) fmtCel[(r0 + r) + ':' + (c0 + c)] = f; return o; }
          };
          return o;
        },
        appendRow: function (vals) { vals.forEach(function (v, c) { conferirTamanhoCelula(v, nome, nl + 1, c + 1); }); nl++; vals.forEach(function (v, c) { cel[nl + ':' + (c + 1)] = v; nc = Math.max(nc, c + 1); }); estado.GRAVACOES.push({ aba: nome, r0: nl, c0: 1, nr: 1, nc: vals.length, comTrava: !!estado.TRAVAS.preso }); return A; },
        deleteRows: function (l, k) { estado.REMOCOES.push({ aba: nome, ini: l, n: k, comTrava: !!estado.TRAVAS.preso }); for (let j = 0; j < k; j++) A.deleteRow(l); },
        deleteRow: function (l) {
          for (let r = l; r < nl; r++) for (let c = 1; c <= nc; c++) { const v = cel[(r + 1) + ':' + c]; cel[r + ':' + c] = v == null ? '' : v; }
          for (let c = 1; c <= nc; c++) delete cel[nl + ':' + c];
          nl--;
        },
        setName: function (n) { nome = n; return A; },
        /* v8.13 (D15): o Sheets entrega uma grade com linhas de sobra; é sobre
           ela que a aba nova formata as colunas como texto puro. 1.000 é o
           padrão de uma planilha nova. */
        getMaxRows: function () { return Math.max(nl, 1000); },
        getMaxColumns: function () { return Math.max(nc, 26); },
        setFrozenRows: function () {}, setColumnWidth: function () {}, autoResizeColumns: function () {}, clear: function () { Object.keys(cel).forEach(function (k) { delete cel[k]; }); Object.keys(fmtCel).forEach(function (k) { delete fmtCel[k]; }); nl = 0; nc = 0; },
        setConditionalFormatRules: function () {}, hideColumns: function () {}, protect: function () { const p = { setDescription: function () { return p; }, removeEditors: function () { return p; }, getEditors: function () { return []; }, canDomainEdit: function () { return false; }, setDomainEdit: function () { return p; } }; return p; }
      };
      return A;
    }
    const abas = estado.abas;
    const planilha = {
      getSheetByName: function (n) { return abas[n] || null; },
      insertSheet: function (n) { abas[n] = abas[n] || novaAba(n); return abas[n]; },
      getId: function () { return 'ss1'; },
      getName: function () { return estado.nomePlanilha; },
      getSheets: function () { return Object.keys(abas).map(function (k) { return abas[k]; }); }
    };
    const PASTA = {
      createFile: function (b) { const id = proximoId('f'); arquivos[id] = b;
        estado.ARQUIVOS_CRIADOS.push({ id: id, nome: (b && b.nome) || '', comTrava: !!estado.TRAVAS.preso });
        return { getId: function () { return id; }, getUrl: function () { return 'https://drive/' + id; }, getName: function () { return b.nome || 'arquivo'; }, getBlob: function () { return b; }, setTrashed: function () {} }; },
      /* v8.13 (E16): a rotação do histórico passou a PROCURAR o arquivo do mês
         na pasta de backups e a acrescentar linhas a ele, em vez de criar um
         arquivo homônimo a cada chamada. O simulador devolvia "não há
         nenhum" para qualquer nome, e a busca nunca seria exercitada. */
      getFilesByName: function (nome) {
        const achados = estado.CRIADAS.filter(function (ss) { return ss.getName() === nome; });
        let i = 0;
        return { hasNext: function () { return i < achados.length; },
                 next: function () { const ss = achados[i++];
                   return { getId: function () { return ss.getId(); }, getName: function () { return ss.getName(); } }; } };
      },
      getFiles: function () { let i = 0; const vivos = estado.BACKUPS.filter(function (b) { return !b.lixo; }); return { hasNext: function () { return i < vivos.length; }, next: function () { const b = vivos[i++]; return { getName: function () { return b.nome; }, getDateCreated: function () { return b.criado; }, getId: function () { return 'bk-' + b.nome; }, setTrashed: function () { b.lixo = true; } }; } }; }
    };
    const fmt = function (dt, tz, f) {
      const d = (dt instanceof Date ? dt : new Date()), p = function (n) { return ('0' + n).slice(-2); };
      if (f === 'yyyy-MM') return d.getFullYear() + '-' + p(d.getMonth() + 1);
      if (f === 'yyyy-MM-dd HHmm') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes());
      /* v8.13 (E15): o carimbo do backup ganhou SEGUNDOS (A8-23). O simulador
         devolvia dd/MM/yyyy para qualquer formato desconhecido, e um nome de
         backup errado passaria verde. */
      if (f === 'yyyy-MM-dd HHmmss') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
      if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      /* v8.13 (F01): o sufixo _SUBSTITUIDA_ da ata trocada usa 'ddMMyyyy'.
         Sem este ramo o simulador devolvia 'dd/MM/yyyy HH:mm', isto é, uma
         barra dentro de um nome de arquivo — defeito do simulador, não do
         Code.gs, que o teste da troca de ata mediria como se fosse real. */
      if (f === 'ddMMyyyy') return p(d.getDate()) + p(d.getMonth() + 1) + d.getFullYear();
      return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    };
    const blob = function (c, m, n) {
      const b = {
        nome: n, mime: m,
        getAs: function () { const bytes = pdfMinimo(n || 'documento'); const q = { nome: (n || 'documento').replace(/\.html?$/i, '') + '.pdf', getBytes: function () { return bytes; }, getContentType: function () { return 'application/pdf'; }, setName: function (x) { q.nome = x; return q; }, getName: function () { return q.nome; } }; return q; },
        getDataAsString: function () { return Array.isArray(c) ? String.fromCharCode.apply(null, c.map(function (x) { return x & 255; })) : String(c == null ? '' : c); },
        getBytes: function () { return Array.isArray(c) ? c : utf8(String(c == null ? '' : c)); },
        getContentType: function () { return m; }, getName: function () { return b.nome; },
        setName: function (x) { b.nome = x; return b; }
      };
      return b;
    };
    const g = {
      SpreadsheetApp: {
        getActiveSpreadsheet: function () { return planilha; },
        create: function (nome) { const a = novaAba(nome); const id = 'novo-' + estado.CRIADAS.length;
          const ss = { nome: nome, getId: function () { return id; }, getName: function () { return nome; },
                       getSheets: function () { return [a]; },
                       getSheetByName: function (n) { return a.getName() === n ? a : null; } };
          estado.CRIADAS.push(ss); return ss; },
        /* v8.13 (E16): reabrir um arquivo já criado, que é o que a rotação faz
           para acrescentar as linhas do mês ao arquivo do mês. */
        openById: function (id) {
          const ss = estado.CRIADAS.filter(function (x) { return x.getId() === id; })[0];
          if (!ss) throw new Error('Spreadsheet not found: ' + id);
          return ss;
        },
        getUi: function () { return { createMenu: function () { const m = { addItem: function () { return m; }, addSeparator: function () { return m; }, addToUi: function () {} }; return m; }, alert: function () {}, ButtonSet: { OK: 1 } }; },
        newConditionalFormatRule: function () { const r = { setGradientMinpointWithValue: function () { return r; }, setGradientMidpointWithValue: function () { return r; }, setGradientMaxpointWithValue: function () { return r; }, whenNumberGreaterThan: function () { return r; }, whenTextEqualTo: function () { return r; }, setBackground: function () { return r; }, setRanges: function () { return r; }, build: function () { return {}; } }; return r; },
        InterpolationType: { NUMBER: 1 }
      },
      DriveApp: {
        getFoldersByName: function () { return { hasNext: function () { return false; } }; },
        createFolder: function () { return PASTA; },
        getFileById: function (id) {
          if (id === 'ss1') return { makeCopy: function (nome) { const c = { nome: nome, criado: new Date(Date.now() + estado.BACKUPS.length), lixo: false }; estado.BACKUPS.push(c); return c; }, moveTo: function () {} };
          if (String(id).indexOf('novo-') === 0) return { moveTo: function () {} };
          if (!arquivos[id]) throw new Error('File not found: ' + id);
          return { getId: function () { return id; }, getName: function () { return arquivos[id].nome || 'arquivo'; }, getBlob: function () { return arquivos[id]; }, setTrashed: function () {}, makeCopy: function () { return {}; }, isTrashed: function () { return false; },
            /* v8.13 (F01): o File de verdade tem setName, e o simulador não
               tinha — a renomeação da ata substituída caía no catch e o teste
               media "não renomeou" quando o Code.gs renomeava certo. */
            setName: function (n) { if (arquivos[id]) arquivos[id].nome = String(n); return this; },
            /* v8.12: o Drive de verdade não tem setContent; este existe só para
               que a demonstração possa substituir o congelado semeado pelo
               documento inteiro, montado pela tela. Nenhum caminho do Code.gs
               o chama — a bateria de servidor confere isso. */
            setContent: function (txt) { arquivos[id] = blob(String(txt == null ? '' : txt), arquivos[id].mime, arquivos[id].nome); return this; } };
        }
      },
      /* v8.13 (E02): o MailApp de verdade aceita as DUAS formas —
         sendEmail({to,subject,body}) e sendEmail(para, assunto, corpo). O
         simulador só guardava a primeira, de modo que um envio posicional
         entrava na lista como uma string e sumia de qualquer conferência. */
      MailApp: { sendEmail: function (o, assunto, corpo) {
          if (estado.MAIL.falha) throw new Error(estado.MAIL.falha);
          const msg = (typeof o === 'string') ? { to: o, subject: assunto, body: corpo } : o;
          /* v8.13 (E13): a cópia guarda se o envio aconteceu com a trava do
             script presa — enviar sob trava é o que prende as 25 funções que
             gravam (salvar PPP, concluir, homologar) por minutos a fio. */
          const reg = Object.assign({}, msg);
          reg.__comTrava = !!estado.TRAVAS.preso;
          estado.emails.push(reg); estado.MAIL.cota--;
        }, getRemainingDailyQuota: function () { return estado.MAIL.cota; } },
      Utilities: {
        formatDate: fmt, getUuid: function () { return 'uuid-' + proximoId('') + '-' + Math.random().toString(36).slice(2, 10); },
        base64Encode: function (x) { return base64(x); }, base64Decode: function (s) { return base64Decode(String(s || '')); },
        newBlob: blob,
        computeDigest: function (alg, txt) { return sha256(txt); },
        DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }
      },
      LockService: { getScriptLock: function () { return {
        waitLock: function () { estado.TRAVAS.n++; estado.TRAVAS.preso = true; },
        tryLock: function () { estado.TRAVAS.n++; estado.TRAVAS.preso = true; return true; },
        releaseLock: function () { estado.TRAVAS.preso = false; estado.TRAVAS.soltas++; } }; } },
      PropertiesService: (function () { const p = estado.props; const api = { getProperty: function (k) { return (k in p) ? p[k] : null; }, setProperty: function (k, v) { p[k] = String(v); return api; }, deleteProperty: function (k) { delete p[k]; return api; } }; return { getScriptProperties: function () { return api; } }; })(),
      CacheService: (function () { const c = estado.CACHE.c, ttl = estado.CACHE.ttl; return { getScriptCache: function () { return { get: function (k) { return (k in c) ? c[k] : null; }, put: function (k, v, t) { c[k] = v; ttl[k] = t; }, remove: function (k) { delete c[k]; delete ttl[k]; } }; } }; })(),
      Session: { getActiveUser: function () { return { getEmail: function () { return estado.identidade; } }; }, getScriptTimeZone: function () { return 'America/Sao_Paulo'; } },
      /* v8.13 (E01): `getProjectTriggers()` devolve ACIONADORES, não nomes — o
         Code.gs chama `t.getHandlerFunction()` desde a 7.6, e o simulador
         devolvia strings: a varredura nunca rodava e o defeito ficava
         escondido. `estado.triggers` continua guardando os nomes (é o que a
         bateria inspeciona) e `deleteTrigger` passa a apagar de verdade. */
      ScriptApp: { getService: function () { return { getUrl: function () { return estado.urlApp; } }; },
        getProjectTriggers: function () { return estado.triggers.map(function (n) { return { getHandlerFunction: function () { return n; } }; }); },
        deleteTrigger: function (t) { const n = t && t.getHandlerFunction ? t.getHandlerFunction() : t; const i = estado.triggers.indexOf(n); if (i >= 0) estado.triggers.splice(i, 1); },
        newTrigger: function (fn) { const b = { timeBased: function () { return b; }, everyDays: function () { return b; }, everyMinutes: function () { return b; }, everyWeeks: function () { return b; }, onWeekDay: function () { return b; }, onMonthDay: function () { return b; }, atHour: function () { return b; }, create: function () { estado.triggers.push(fn); } }; return b; }, WeekDay: { MONDAY: 1 } },
      /* v8.9: createHtmlOutputFromFile devolve o conteúdo do arquivo — é assim
         que o servidor lê o brasão (include('Brasao')) para montar o PDF. No
         Node vem do disco; no navegador, do que o Index já embutiu na página. */
      HtmlService: { createTemplateFromFile: function () { return { evaluate: function () { return { setTitle: function () { return { addMetaTag: function () { return 'html'; } }; } }; } }; },
        createHtmlOutputFromFile: function (nome) {
          return { getContent: function () { return arquivoDoProjeto(nome); },
                   setTitle: function () { return { addMetaTag: function () { return 'html'; } }; } };
        },
        createHtmlOutput: function (s) { return { getContent: function () { return s; } }; } },
      MimeType: { HTML: 'text/html', PDF: 'application/pdf' }, Logger: { log: function () {} }
    };
    return { g: g, estado: estado, novaAba: novaAba, sha256: sha256, base64: base64, pdfMinimo: pdfMinimo };
  }

  /**
   * Carrega o Code.gs sobre os serviços simulados e devolve TODAS as
   * funções e constantes de topo, pelo nome — é o que a bateria e a
   * demonstração chamam. `src` é o texto do Code.gs.
   */
  function carregarCodigo(src, servicos) {
    const nomes = [];
    const re = /^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    let m; while ((m = re.exec(src))) if (nomes.indexOf(m[1]) < 0) nomes.push(m[1]);
    const corpo = src + '\nreturn {' + nomes.join(',') + '};';
    const f = new Function(Object.keys(servicos.g).join(','), corpo);
    return f.apply(null, Object.keys(servicos.g).map(function (k) { return servicos.g[k]; }));
  }

  /** A ordem em que o Code.gs embutido recebe os serviços (igual à de montar.js). */
  const ORDEM = ['SpreadsheetApp', 'DriveApp', 'MailApp', 'Utilities', 'LockService', 'PropertiesService',
                 'CacheService', 'Session', 'ScriptApp', 'HtmlService', 'MimeType', 'Logger'];
  const api = { criarServicos: criarServicos, carregarCodigo: carregarCodigo, sha256: sha256, base64: base64, pdfMinimo: pdfMinimo, ORDEM: ORDEM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SimuladorServicos = api;
})(typeof window !== 'undefined' ? window : this);
