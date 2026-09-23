import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, '../../..');
const workingCopy = resolve(projectRoot, 'apps/web/prototipo.html');
const sourceV102 = resolve(projectRoot, 'Gerador de PPP V6.5', 'Gerador de PPP v10.2', 'Gerador de PPP.html');
const destinationV102Directory = resolve(projectRoot, 'apps/web/public/referencia-v10.2');
const destinationV102 = resolve(destinationV102Directory, 'Gerador de PPP v10.2.html');

async function preservarReferencia(sourcePath, destinationPath, manifestPath) {
  const sourceBytes = await readFile(sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  const copiedBytes = await readFile(destinationPath);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const copiedHash = createHash('sha256').update(copiedBytes).digest('hex');
  if (sourceHash !== copiedHash) throw new Error(`A referencia copiada difere do arquivo fornecido: ${sourcePath}`);
  await writeFile(manifestPath, `${sourceHash}\n`, 'utf8');
  return sourceHash;
}

// A v10.2 é a única referência operacional e sua cópia de trabalho é a rota
// principal do Vite. O HTML original continua copiado byte a byte para consulta.
const sourceV102Hash = await preservarReferencia(sourceV102, destinationV102, resolve(destinationV102Directory, 'REFERENCIA.sha256'));

const workingRuntime = `
<script>
window.__PPP_REFERENCE_RUNTIME__ = (function () {
  function limparRascunho() {
    APP.protocolo = null; APP.versao = 1; APP.origem = ''; APP.status = 'Em andamento';
    APP.hash = ''; APP.concluidoEm = ''; APP.pdfUrl = ''; APP.ataUrl = ''; APP.ataNome = '';
    APP.ataData = ''; APP.ataIdent = ''; APP.homolDestino = ''; APP.homolData = '';
    APP.assinaturas = []; APP.anexos = []; APP.objetivosAnteriores = ''; APP.indicadoresAnteriores = '';
    APP.sujo = false; APP.local = false;
    Object.keys(state.sel).forEach(function (chave) { state.sel[chave] = new Set(); });
    state.det = {}; state.tarefas = {};
    state.ind = {ano:'', idebAI:'', idebAF:'', idebAno:'', proalfa:'', proeb:'', clima:'', aee:'', docentes:'', etapas:{}};
    Object.keys(state.dados).forEach(function (chave) { state.dados[chave] = chave === 'sre' ? ((typeof SESSAO !== 'undefined' && SESSAO.sre) || '') : ''; });
    state.dados.compartilhado = '';
    Object.keys(state.txt).forEach(function (chave) { state.txt[chave] = ''; });
    state.tela = 0;
    renderTrilha(); irPara(0, true); renderDoc(); atualizarBadge();
  }
  function telaPorChave(chave) { return indiceDaTela(chave) >= 0 ? indiceDaTela(chave) : 0; }
  function aplicarRegistro(registro) {
    preencherRegistro(Object.assign({}, registro.respostas || {}, {
      protocolo: registro.protocolo,
      versao: registro.numeroVersao,
      status: registro.situacao === 'draft' ? 'Em andamento' : registro.situacao,
      tela: telaPorChave(registro.telaAtual),
      tarefas: JSON.stringify(registro.tarefas || {})
    }));
    APP.local = false;
  }
  return { limparRascunho: limparRascunho, coletarDados: coletarDados, aplicarRegistro: aplicarRegistro,
    telaAtual: function () { return (TELAS[state.tela] || TELAS[0]).id; },
    indiceDaTela: telaPorChave,
    tarefas: function () { return state.tarefas || {}; },
    definirProtocolo: function (protocolo, versao) { APP.protocolo = protocolo; APP.versao = versao || 1; APP.local = false; atualizarBadge(); },
    abrirPainelInstitucional: function (sessao) {
      aplicarSessao(sessao);
      SESSAO.modo = 'visualizacao';
      $('#landing').hidden = true;
      abrirPainelInst();
    },
    mostrarErro: function (mensagem) { var erro = $('#landErro'); erro.textContent = mensagem; erro.classList.add('show'); } };
}());
</script>
<script type="module" src="/src/runtime/prototype-adapter.ts"></script>`;

const sourceV102Text = (await readFile(sourceV102)).toString('utf8');
if (!sourceV102Text.includes('</body>')) throw new Error('Nao foi possivel preparar a copia de trabalho da versao 10.2.');
const bootstrapV102 = `<script>
// Fora do Apps Script, a referencia tentaria carregar o simulador DEMO.
// A rota de migracao usa o adaptador Supabase e espera seu modulo carregar
// antes de iniciar a aplicacao.
APP.local = false;
window.addEventListener('DOMContentLoaded', function () { bootstrap(); }, { once: true });
</script>`;
if (!sourceV102Text.includes('<script>bootstrap();</script>')) throw new Error('Nao foi possivel localizar a inicializacao da versao 10.2.');
const copiaV102 = sourceV102Text
  .replace('<script>bootstrap();</script>', bootstrapV102)
  .replace('</body>', `${workingRuntime}\n</body>`);
await writeFile(workingCopy, copiaV102, 'utf8');
console.log(`Referencia 10.2 preservada: ${sourceV102Hash}`);
