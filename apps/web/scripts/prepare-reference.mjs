import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, '../../..');
const source = resolve(projectRoot, 'Gerador de PPP V6.5', 'Gerador de PPP v6.5.html');
const destinationDirectory = resolve(projectRoot, 'apps/web/public/referencia');
const destination = resolve(destinationDirectory, 'Gerador de PPP v6.5.html');
const workingCopy = resolve(projectRoot, 'apps/web/prototipo.html');

const sourceBytes = await readFile(source);
await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, destination);
const copiedBytes = await readFile(destination);
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
const copiedHash = createHash('sha256').update(copiedBytes).digest('hex');
if (sourceHash !== copiedHash) throw new Error('A cÃ³pia de referÃªncia nÃ£o Ã© idÃªntica ao HTML oficial.');

await writeFile(resolve(destinationDirectory, 'REFERENCIA.sha256'), `${sourceHash}\n`, 'utf8');
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
    Object.keys(state.dados).forEach(function (chave) { state.dados[chave] = chave === 'sre' ? 'Divinopolis' : ''; });
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
    mostrarErro: function (mensagem) { var erro = $('#landErro'); erro.textContent = mensagem; erro.classList.add('show'); } };
}());
</script>
<script type="module" src="/src/runtime/prototype-adapter.ts"></script>`;
// A referência é preservada byte a byte. A cópia de trabalho recebe somente
// esta adequação editorial solicitada para a nova aplicação.
const sourceText = sourceBytes.toString('utf8');
const textoDaCopiaDeTrabalho = sourceText.replace(/\s*—\s*/g, ' ');
if (!sourceText.includes('</body>')) throw new Error('Nao foi possivel preparar a copia de trabalho.');
await writeFile(workingCopy, textoDaCopiaDeTrabalho.replace('</body>', `${workingRuntime}\n</body>`), 'utf8');
console.log(`ReferÃªncia preparada: ${sourceHash}`);
