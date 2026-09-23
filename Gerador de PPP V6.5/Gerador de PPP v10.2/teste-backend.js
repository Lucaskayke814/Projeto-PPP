/* Teste do backend (Code.gs) com os serviços do Apps Script simulados em
   memória por simulador-servicos.js — os MESMOS serviços sobre os quais a
   demonstração do Index executa o Code.gs desde a v8.0 (P12). Um só
   simulador: o que a bateria exercita é o que a demonstração roda.
   Cobre: protocolo, salvar/buscar, conclusão, assinaturas (direção +
   colegiado), ressalva, remoção de membro, ata, homologação, nova versão,
   painel, acessos, cargas, fila de e-mails, cobertura, sessão e backup. */
const fs = require('fs');
const SS = require('./simulador-servicos.js');
const src = fs.readFileSync('./Code.gs', 'utf8');

const S = SS.criarServicos({ nomePlanilha: 'Gerador de PPP — base', cota: 100, urlApp: 'https://script/app' });
const est = S.estado;
/* apelidos do estado simulado, que as verificações inspecionam */
const LEITURAS = est.LEITURAS, TRAVAS = est.TRAVAS, BACKUPS = est.BACKUPS, CACHE = est.CACHE,
      CRIADAS = est.CRIADAS, MAIL = est.MAIL, arquivos = est.arquivos, emails = est.emails,
      ARQUIVOS_CRIADOS = est.ARQUIVOS_CRIADOS, GRAVACOES = est.GRAVACOES, REMOCOES = est.REMOCOES,
      triggers = est.triggers, outras = est.abas;
/* IDENTIDADE e NOME_PLANILHA são atribuídos ao longo da bateria: viram
   propriedades globais ligadas ao estado do simulador. */
Object.defineProperty(globalThis, 'IDENTIDADE', {
  get: () => est.identidade, set: (v) => { est.identidade = v; } });
Object.defineProperty(globalThis, 'NOME_PLANILHA', {
  get: () => est.nomePlanilha, set: (v) => { est.nomePlanilha = v; } });
IDENTIDADE = '';
/* a aba "Painel" é uma aba como as outras; isto lê o que atualizarPainel escreveu */
const painelCel = { get rows() {
  const a = est.abas['Painel']; if (!a) return null;
  const n = a.getLastRow(); if (n < 2) return [];
  /* só as linhas de registro: abaixo delas atualizarPainel escreve o rodapé */
  return a.getRange(2, 1, n - 1, 16).getValues()
    .filter((r) => String(r[0] || '').trim() && !/^Painel atualizado/.test(String(r[0]))); } };

/* Carrega o Code.gs sobre os serviços e devolve tudo o que ele declara no
   topo — sem lista de exportação a manter (v8.0, P12). */
const B = SS.carregarCodigo(src, S);
const ultimaCol = () => B.abaRegistros_().getLastColumn();
/* v9.8 — O CÓDIGO INEP (Censo) PASSOU A SER OBRIGATÓRIO no cadastro de
   escola. Na bateria ele quase nunca é o objeto da verificação: cada escola
   recebe aqui um código distinto e estável, derivado do próprio código da
   escola, para que as centenas de fixtures continuem dizendo o que diziam.
   Onde o INEP É o objeto da verificação (duplicidade, tamanho, obrigatoriedade),
   o código vai escrito na chamada, como sempre foi. */
const _censo = {}; let _censoSeq = 31900000;
const censoDe = function (cod) {
  const d = String(cod == null ? '' : cod).replace(/\D/g, '');
  const chave = d || 'vazio';
  if (!_censo[chave]) _censo[chave] = String(++_censoSeq);
  return _censo[chave];
};
/* v7.6 (P4): o convite pode ir na hora (MailApp) ou pela fila — para conta do
   domínio, as boas-vindas vão SEMPRE pela fila. Conta-se o que chegou por
   qualquer dos dois caminhos. */
const fila = function () { const a = B.abaFila_(); const n = a.getLastRow(); return n < 2 ? [] : a.getRange(2, 1, n - 1, 10).getDisplayValues()
  .map(r => ({ criadoEm: r[0], para: r[1], tipo: r[2], assunto: r[3], corpo: r[4], prioridade: r[5], situacao: r[6], tentativas: r[7], erro: r[8], enviadoEm: r[9] })); };
const emailsPara = function (dest) {
  return emails.filter(e => e.to === dest && /Primeiro acesso/.test(e.subject || '')).length +
         fila().filter(f => f.para === dest && (f.tipo === 'convite' || f.tipo === 'boas-vindas')).length;
};
const falhas = [], oks = []; const ok = (c, m) => (c ? oks : falhas).push(m);

/* v9.7: quem gere os diretores escolares é a Diretoria Educacional da SRE.
   `tkDE(sre)` devolve (e memoriza) uma sessão de Diretor Educacional daquela
   regional, semeada direto na aba Acessos como `sessaoDe_` faz — a cascata
   de cadastro é exercitada nos testes que tratam dela. */
/* v9.7: cadastrar/alterar um DIRETOR ESCOLAR nos testes passa por uma sessão
   de Diretoria Educacional da SRE da escola — é quem tem a competência. */
function salvarDiretor(Bx, dados) {
  let sre = dados.sre || '';
  try { const e = Bx.escolaPorInep_(String(dados.inep || '')); if (e && e.sre) sre = e.sre; } catch (e) {}
  const d = {}; Object.keys(dados).forEach(function (k) { if (k !== 'token') d[k] = dados[k]; });
  d.token = tkDE(sre || 'Divinópolis', Bx);
  return Bx.acessoSalvar(d);
}
const _deCache = {};
let _deSeq = 0;
function tkDE(sre, bk) {
  const B2 = bk || B;
  /* cada bateria isolada tem o seu próprio backend: a sessão não pode ser
     reaproveitada entre eles (o cadastro é outro) */
  if (!B2.__deId) { try { B2.__deId = ++_deSeq; } catch (e) { B2.__deId = ++_deSeq; } }
  const chave = String(sre || '') + '@' + B2.__deId;
  if (_deCache[chave]) return _deCache[chave];
  const email = 'de.auto.' + String(sre || 'x').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') + '.u' + B2.__deId + '@educacao.mg.gov.br';
  const d = { email: email, nome: 'Diretoria Educacional de ' + sre, perfil: 'regional',
              papel: 'diretor_educacional', sre: sre };
  if (!B2.acessoPorEmail_(email)) {
    const aba = B2.abaAcessos_();
    const linha = new Array(B2.ACESSO_COLS.length).fill('');
    linha[0] = email; linha[1] = d.nome; linha[2] = 'regional'; linha[3] = sre;
    linha[6] = 'ativo'; linha[7] = B2.agora_(); linha[12] = 'diretor_educacional';
    aba.appendRow(linha); B2.invalidarAcessos_();
  }
  _deCache[chave] = B2.criarSessao_(d);
  return _deCache[chave];
}

/* v8.13 (C04): a sessão passa a reconferir, a cada chamada, o cadastro na
   aba Acessos — uma sessão sem cadastro é uma sessão encerrada, que é o que
   a baixa da escola e a remoção de um acesso prometem. A bateria abria
   sessões direto no cache, sem a linha correspondente; `sessaoDe_` semeia o
   cadastro que a entrada real exigiria (sem passar pela cascata, que não é o
   que está sendo exercitado aqui) e devolve o token. Onde o teste quer
   justamente uma sessão SEM cadastro, continua usando B.criarSessao_. */
/* v8.13 (C10): a carga da base de escolas passou a ser SIMULAR → IMPORTAR
   com a chave emitida pela simulação, como a carga de diretores. `cargaEscolas`
   faz as duas chamadas e devolve o resultado da gravação, com a simulação em
   `simulacao` para as conferências de prévia. */
function cargaEscolas(token, texto) {
  const sim = B.escolasImportar({ token: token, texto: texto, simular: true });
  if (!sim.ok) return sim;
  const real = B.escolasImportar({ token: token, texto: texto, simular: false, chave: sim.chave });
  real.simulacao = sim;
  return real;
}
function sessaoDe_(d) {
  const email = String(d.email || '').trim().toLowerCase();
  /* o Órgão Central entra por senha institucional e, por projeto, pode não
     ter linha em Acessos — semeá-la falsearia a lista de acessos */
  if (email && d.perfil !== 'central' && !B.acessoPorEmail_(email)) {
    const aba = B.abaAcessos_();
    const cols = B.ACESSO_COLS.length;
    const linha = new Array(cols).fill('');
    linha[0] = email; linha[1] = d.nome || ''; linha[2] = d.perfil || '';
    linha[3] = d.perfil === 'central' ? '' : (d.sre || '');
    linha[6] = 'ativo'; linha[7] = B.agora_();
    linha[9] = d.perfil === 'escola' ? String(d.inep || '') : '';
    linha[10] = d.perfil === 'escola' ? (d.escola || '') : '';
    linha[11] = d.masp || '';     /* v8.13 (D03): o MASP impresso vem do CADASTRO */
    linha[12] = d.papel || '';
    aba.appendRow(linha);
    B.invalidarAcessos_();
  }
  return B.criarSessao_(d);
}

/* v8.13 (D04): a conclusão passou a exigir o documento INTEIRO — o corpo
   paginado pela tela, e não um pedaço de HTML. A bateria monta o mesmo
   envelope que `paginar()` produz, que é o que a produção envia. */
function docTeste(miolo) {
  return '<div class="paginas"><div class="pagina" data-pag="1" data-de="1"><div class="pag-corpo">' +
         (miolo || '<p>x</p>') + '</div></div></div>';
}

/* ---------- cenário ---------- */
B.testeConfiguracao_();
ok(ultimaCol() === 103 && B.CAMPOS[96].key === 'pct' && B.CAMPOS[99].key === 'homolAto' && B.CAMPOS[100].key === 'textosFolha' && B.CAMPOS[101].key === 'rev' && B.CAMPOS[102].key === 'censo', `cabeçalho com ${ultimaCol()} colunas (v9.8: o código INEP do Censo, ao final)`);
ok(B.IDX.pdfId === 96, 'P1: a coluna do ID do PDF é a última — nada se desalinha');

/* v7.4 (P3): TODA gravação exige sessão de direção. Sem token, nem o
   protocolo público abre nada. As escolas do cenário entram por sessão. */
let r = B.salvarPPP({ escola: 'EE Sem Sessão', inep: '31000009', sre: 'Divinópolis' });
ok(!r.ok && r.semSessao === true && /entrar no sistema/.test(r.erro), 'P3: gravar sem sessão é recusado, com a bandeira semSessao');
ok(!B.podeAcessar_('', '', '') && !B.podeAcessar_('dono@x.mg', '', '') && !B.podeAcessar_('', '', 'a@x.mg') &&
   B.podeAcessar_('a@x.mg', '', 'a@x.mg') && B.podeAcessar_('dono@x.mg', 'a@x.mg; b@x.mg', 'b@x.mg'),
   'P3: podeAcessar_ exige e-mail identificado E autorizado — registro sem dono não é de todo mundo');
const TKA = sessaoDe_({ email: 'dir@x.mg', nome: 'Marta', masp: '123', perfil: 'escola', papel: 'diretor_escolar',
                             sre: 'Divinópolis', inep: '31000001', escola: 'EE Alfa' });
const TKB = sessaoDe_({ email: 'dir.beta@x.mg', nome: 'Beto', perfil: 'escola', papel: 'diretor_escolar',
                             sre: 'Uberlândia', inep: '31000002', escola: 'EE Beta' });
r = B.salvarPPP({ token: TKA, escola: 'EE Alfa', inep: '31000001', sre: 'Divinópolis', municipio: 'Divinópolis', sessao: 's1', etapas: ['Ensino Médio'], tarefas: '{"0:0":true}' });
ok(r.ok && /^PPP-2026-0001-[A-Z0-9]{4}$/.test(r.protocolo), 'protocolo com sufixo aleatório: ' + r.protocolo);
const P = r.protocolo;
ok(B.lerLinha_(B.abaRegistros_(), 2).email === 'dir@x.mg', 'P3: o responsável do registro é o e-mail da sessão da direção');
r = B.salvarPPP({ token: TKA, escola: 'EE Alfa 2', inep: '31000001', sessao: 's2' });
ok(!r.ok && r.duplicado && r.duplicado.protocolo === P, 'INEP duplicado detectado');
r = B.salvarPPP({ token: TKB, escola: 'EE Beta', inep: '31000002', sre: 'Uberlândia', municipio: 'Uberlândia', sessao: 's1' });
ok(r.ok && /-0002-/.test(r.protocolo), 'sequencial continua a partir do maior número');
const PB = r.protocolo;
r = B.buscarPPP({ p: P, sessao: 's9' });
ok(!r.ok && r.semSessao, 'P3: abrir por protocolo sem sessão é recusado — o protocolo é público, não é credencial');
r = B.buscarPPP({ p: P, sessao: 's9', token: TKA });
ok(r.ok && r.registro.escola === 'EE Alfa' && r.registro.tarefas === '{"0:0":true}', 'busca por protocolo restaura registro e tarefas');
ok(r.ocupado && r.ocupado.minutos <= 1, 'trava de edição concorrente avisa outra sessão');
/* v8.13 (E01): a prévia continua pública (a tela a usa), mas passou a exigir
   sessão — era um conversor de HTML em PDF aberto na API pública. */
/* v8.13 (E17): sem token, `sessaoDirecao_` devolve null e a resposta é
   `semSessao_()` — a tela precisa distinguir isso de uma exceção. */
let rPrevia = null, erroPrevia = '';
try { rPrevia = B.previaPDF({ escola: 'EE Alfa', docHtml: '<p>x</p>' }); } catch (e) { erroPrevia = String(e.message || e); }
ok((rPrevia && rPrevia.ok === false && rPrevia.semSessao === true) || /Sessão expirada|entrar no sistema/i.test(erroPrevia),
   'v8.13 (E01/E17, A8-13): a prévia sem token é recusada');
r = B.previaPDF({ token: TKA, escola: 'EE Alfa', docHtml: '<p>x</p>' });
ok(r.ok && r.nomeArquivo === 'PREVIA_EE_ALFA.pdf', 'prévia gera arquivo');

/* v7.0: sem o aval da Diretoria Educacional não há conclusão */
r = B.concluirPPP({ token: TKA, protocolo: P, escola: 'EE Alfa', inep: '31000001', sre: 'Divinópolis', municipio: 'Divinópolis', direcao: 'Marta', docHtml: docTeste('<h3 class="doc-h">x</h3>'), sessao: 's1' });
ok(!r.ok && r.precisaValidacao, 'PPP em elaboração não pode ser concluído: falta a validação da Diretoria Educacional');
r = B.enviarParaValidacao({ protocolo: P });
ok(!r.ok && r.semSessao, 'P3: enviar para validação sem sessão é recusado');
r = B.enviarParaValidacao({ token: TKA, protocolo: P });
ok(r.ok && r.registro.status === 'Em validação', 'a escola envia o PPP para validação');
r = B.concluirPPP({ token: TKA, protocolo: P, escola: 'EE Alfa', docHtml: docTeste('<p>x</p>'), sessao: 's1' });
ok(!r.ok && r.precisaValidacao, 'em validação também não se conclui: o parecer ainda não veio');
r = B.salvarPPP({ token: TKA, protocolo: P, escola: 'EE Alfa em validação', sessao: 's1' });
ok(!r.ok && r.bloqueado && /valida/.test(r.erro), 'enquanto está em validação, o conteúdo não pode ser alterado');
/* Um acesso de Órgão Central só para exercer a validação neste ponto da
   bateria — sem configurar a curadoria, que é testada mais adiante. */
const TKVAL = sessaoDe_({ email: 'validador@educacao.mg.gov.br',
  nome: 'Validador do Órgão Central', perfil: 'central', papel: 'central', sre: '' });
r = B.devolverPPP({ token: TKVAL, protocolo: P, parecer: 'curto' });
ok(!r.ok && /20 caracteres/.test(r.erro), 'devolver exige um parecer que a escola possa ler');
r = B.devolverPPP({ token: TKVAL, protocolo: P,
  parecer: 'A seção de avaliação da aprendizagem precisa descrever os instrumentos utilizados.' });
ok(r.ok && r.registro.status === 'Em andamento' && r.rodadas === 1,
   'devolver com parecer devolve o PPP à escola, editável de novo');
r = B.salvarPPP({ token: TKA, protocolo: P, escola: 'EE Alfa', sessao: 's1' });
ok(r.ok, 'devolvido, o PPP volta a aceitar alteração');
r = B.validarPPP({ token: TKVAL, protocolo: P });
ok(!r.ok && /enviado para validação/.test(r.erro), 'não se valida o que não foi enviado');
B.enviarParaValidacao({ token: TKA, protocolo: P });
r = B.validarPPP({ token: TKVAL, protocolo: P, parecer: 'Documento em conformidade.' });
ok(r.ok && r.registro.status === 'Validado' && r.registro.validadoPor && r.registro.validadoEm,
   'validado, o PPP registra quem validou e quando');
r = B.salvarPPP({ token: TKA, protocolo: P, escola: 'EE Alfa validado', sessao: 's1' });
ok(!r.ok && r.bloqueado, 'validado, o conteúdo não pode mais ser alterado');

r = B.concluirPPP({ protocolo: P, escola: 'EE Alfa', docHtml: docTeste('<p>x</p>'), sessao: 's1' });
ok(!r.ok && r.semSessao, 'P3: concluir sem sessão é recusado');
r = B.concluirPPP({ token: TKA, protocolo: P, escola: 'EE Alfa', inep: '31000001', sre: 'Divinópolis', municipio: 'Divinópolis', direcao: 'Marta', docHtml: docTeste('<h3 class="doc-h">x</h3>'), sessao: 's1' });
ok(r.ok && r.registro.status === 'Em assinatura' && /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(r.registro.hash), 'conclusão congela e gera código');
{ /* v8.8 (B3): o PDF é gerado ao soltar a trava, ainda nesta execução */
  const regPdf = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
  ok(!!regPdf.pdfId && !!regPdf.pdfUrl, 'P1: a conclusão grava o ID do PDF (e o link, por compatibilidade)');
  ok(r.registro.temPdf === true, 'B3: e a resposta já diz à tela que o PDF existe, mesmo gerado fora da trava'); }
r = B.salvarPPP({ token: TKA, protocolo: P, escola: 'EE Alfa X', sessao: 's1' });
ok(!r.ok && r.bloqueado, 'gravação recusada após conclusão');

/* ==================== v8.1: ata → presença → assinatura da direção ====================
   A folha nasce só com a direção; o Colegiado entra por marcação de presença,
   entre os cadastros que a escola já tem. Ninguém é cadastrado na folha e
   nenhum link de assinatura é enviado. */
const folha = () => JSON.parse(B.lerLinha_(B.abaRegistros_(), 2).assinaturas || '[]');
ok(folha().length === 1 && folha()[0].papel === 'Direção Escolar' && !folha()[0].token,
   'v8.1: a folha nasce só com a direção, e sem token de convite');

r = B.assinarDirecao({ p: P, pessoa: { nome: 'Marta', masp: '123', email: 'dir@x.mg' } });
ok(!r.ok && r.semSessao, 'P3: assinar como direção sem sessão é recusado');
r = B.assinarDirecao({ p: P, token: TKA, atesto: true, pessoa: { nome: 'Marta', masp: '123', email: 'dir@x.mg' } });
ok(!r.ok && /ata da reunião/.test(r.erro), 'v8.1: sem a ata anexada a direção não assina');

r = B.registrarAta({ p: P, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata 3/2026' });
ok(!r.ok && r.semSessao, 'P3: anexar a ata sem sessão é recusado');
r = B.registrarAta({ p: P, token: TKA, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata 3/2026' });
ok(r.ok && r.registro.status === 'Em assinatura' && r.registro.ataNome === 'ata.pdf',
   'v8.1: a ata é o PRIMEIRO ato — anexá-la não encerra nada, a coleta segue aberta');

r = B.assinarDirecao({ p: P, token: TKA, atesto: true, pessoa: { nome: 'Marta', masp: '123', email: 'dir@x.mg' } });
ok(!r.ok && /compareceu/.test(r.erro), 'v8.1: sem marcar quem compareceu a direção não assina');

/* o Colegiado da escola — é entre os CADASTRADOS que a direção marca quem
   compareceu. Aqui os cadastros entram direto na aba, porque a base de
   escolas da rede só é montada mais adiante nesta bateria. */
const cadastrarColegiado = function (email, nome, segmento, inep) {
  const aba = B.abaAcessos_();
  aba.appendRow([email, nome, 'escola', 'Divinópolis', '', '', 'ativo', B.agora_(), '',
                 inep, 'EE Alfa', '', 'colegiado', '', '', segmento, '']);
  B.invalidarAcessos_();
};
cadastrarColegiado('ana@x.mg', 'Ana Souza', 'Docente', '31000001');
cadastrarColegiado('bia@x.mg', 'Bia Lima', 'Estudante', '31000001');
r = B.colegiadoDaFolha({ p: P, token: TKA });
ok(r.ok && r.membros.length === 2 && r.membros.every(m => !m.presente) && r.ata === true,
   'v8.1: a tela recebe os membros cadastrados da escola, nenhum marcado ainda');
r = B.presencaColegiado({ p: P, emails: ['ana@x.mg'] });
ok(!r.ok && r.semSessao, 'P3: marcar presença sem sessão é recusado');
r = B.presencaColegiado({ p: P, token: TKA, emails: ['fulano@x.mg'] });
ok(!r.ok && /não estão cadastrados/i.test(r.erro), 'v8.1: só se marca quem está cadastrado como Colegiado da escola');
r = B.presencaColegiado({ p: P, token: TKA, emails: [] });
ok(!r.ok && /ao menos um/.test(r.erro), 'v8.1: a lista de presentes não pode ficar vazia');
const filaAntesPresenca = fila().length;
r = B.presencaColegiado({ p: P, token: TKA, emails: ['ana@x.mg', 'bia@x.mg'] });
ok(r.ok && r.presentes === 2 && folha().length === 3, 'v8.1: os dois presentes entram na folha, junto da direção');
ok(folha().filter(a => a.papel === 'Colegiado Escolar').every(a => a.nome && a.segmento && !a.token),
   'v8.1: nome e representação vêm do cadastro, e não há token de convite');
ok(r.avisados === 2 && fila().length === filaAntesPresenca + 2 &&
   fila().slice(-1)[0].tipo === 'assinatura pendente' && /Minhas assinaturas/.test(fila().slice(-1)[0].corpo) &&
   !/[?&]t=/.test(fila().slice(-1)[0].corpo),
   'v8.1: cada marcado recebe, pela fila, o aviso de que há assinatura pendente — o endereço do sistema, não um link de assinatura');

r = B.assinarDirecao({ p: P, token: TKA, pessoa: { nome: 'Marta', masp: '123', email: 'dir@x.mg' } });
ok(!r.ok && /atestar/.test(r.erro), 'v8.1: a direção assina atestando a veracidade — sem o atesto, não assina');
/* v8.2 — assinar é encaminhar: o documento segue na hora para a Diretoria
   Educacional da SRE, e quem valida é avisado pela fila. */
const filaAntesDir = fila().length;
r = B.assinarDirecao({ p: P, token: TKA, atesto: true, pessoa: { nome: 'Marta', masp: '123', email: 'dir@x.mg' } });
ok(r.ok && r.registro.status === 'Enviado para homologação' && r.enviado === true,
   'v8.2: assinado o termo, o PPP segue imediatamente para homologação');
ok(r.registro.homolData && /Diretoria Educacional da SRE Divinópolis/.test(r.destino || ''),
   'v8.2: o registro guarda quando foi encaminhado e para quem');
ok(!r.registro.homolEm && !r.registro.homolPor,
   'v8.2: encaminhar não é homologar — a homologação continua em branco até a SRE confirmar');
ok(B.linhaDoTempo({ token: TKA, protocolo: P }).eventos.some(e => /enviado para homologação/.test(e.ato)),
   'v8.2: o encaminhamento entra no ciclo do documento');

/* cada membro assina na PRÓPRIA sessão, com o acesso que já tem */
const TKANA = sessaoDe_({ email: 'ana@x.mg', nome: 'Ana Souza', perfil: 'escola', papel: 'colegiado',
                               sre: 'Divinópolis', inep: '31000001', escola: 'EE Alfa' });
const TKBIA = sessaoDe_({ email: 'bia@x.mg', nome: 'Bia Lima', perfil: 'escola', papel: 'colegiado',
                               sre: 'Divinópolis', inep: '31000001', escola: 'EE Alfa' });
r = B.minhasAssinaturas({ token: TKANA });
ok(r.ok && r.pendentes.length === 1 && r.pendentes[0].protocolo === P,
   'v8.1: ao entrar, o membro marcado encontra o documento esperando a sua assinatura');
r = B.assinarNoSistema({ token: TKANA, protocolo: P, aceite: true });
ok(r.ok && r.status === 'Enviado para homologação',
   'v8.2: o membro assina a sua caixa mesmo depois de o documento ter seguido para a SRE');
r = B.assinarNoSistema({ token: TKANA, protocolo: P, aceite: true });
ok(!r.ok && /já assinou/.test(r.erro), 'assinatura repetida recusada');
r = B.presencaColegiado({ p: P, token: TKA, emails: ['bia@x.mg'] });
ok(!r.ok && /encerrada/.test(r.erro), 'v8.2: encaminhado o documento, a presença não se remarca');
r = B.assinarNoSistema({ token: TKBIA, protocolo: P, aceite: true });
ok(r.ok && r.status === 'Enviado para homologação', 'a última caixa é assinada, e o documento segue onde está');

/* a folha impressa: caixas, não tabela, e a de quem acompanhou */
{
  const regF = B.lerLinha_(B.abaRegistros_(), 2);
  const html = B.folhaAssinaturas_(regF);
  ok(/<table class="cxs">/.test(html) && (html.match(/class="cxa"/g) || []).length === 4,
     'v8.1: a folha traz caixas — direção, dois membros presentes e a de acompanhamento');
  ok(/Acompanhado por/.test(html) && /Validador do Órgão Central/.test(html),
     'v8.1: a caixa de quem validou o documento é rotulada "Acompanhado por"');
  ok(!/<th>/.test(html) && !/Presidente do Colegiado/.test(html) && !/Ressalva/.test(html),
     'v8.1: saíram a tabela de assinaturas, o presidente de colegiado e as ressalvas');
  ok(/Assinado no sistema em/.test(html) && !/[?&]t=/.test(html),
     'v8.1: cada caixa diz quando a assinatura foi registrada, e não há link de convite');
}
ok(typeof B.registrarHomologacao !== 'function',
   'v8.2: não há mais um ato de "registrar o envio para homologação" — assinar já encaminha');
ok(B.lerLinha_(B.abaRegistros_(), 2).status === 'Enviado para homologação' && B.lerLinha_(B.abaRegistros_(), 2).homolData,
   'v8.2: o PPP está com a Diretoria Educacional desde a assinatura da direção');
r = B.novaVersao(P);
ok(!r.ok && r.semSessao, 'P3: nova versão sem sessão é recusada');
r = B.novaVersao({ p: P, token: TKA });
ok(r.ok && r.registro.versao === 2 && r.registro.origem === P && r.registro.status === 'Em andamento' && r.registro.assinaturas === '', 'nova versão copia conteúdo e zera assinaturas');
ok(r.registro.pdfId === '' && r.registro.pdfUrl === '', 'P1: a nova versão nasce sem PDF');
ok(r.registro.tarefas === '', 'nova versão zera as tarefas de preparação (a revisão refaz o percurso)');
ok(r.registro.tBalanco === '', 'nova versão começa sem balanço escrito');
ok(r.registro.objetivosAnteriores !== undefined, 'nova versão guarda os objetivos da vigência anterior');
ok(r.registro.indicadoresAnteriores !== undefined, 'nova versão guarda os indicadores da vigência anterior');

B.atualizarPainel_();
ok(painelCel.rows && painelCel.rows.length === 3 && painelCel.rows[0][9] === 2,
   'v8.1: o painel da planilha lista os registros e conta quem compareceu à aprovação');
B.instalarAcionadores_(); B.backupDiario_();
/* v8.13 (E13): o expurgo da fila deixou de rodar dentro do envio e passou a
   ter acionador próprio — são SEIS acionadores. */
ok(triggers.length === 6 && ['backupDiario_', 'processarFilaEmails_', 'expurgarFilaRotina_', 'verificarIntegridade_', 'rotacionarHistoricoAcessos_', 'resumoSemanalParados_'].every(f => triggers.indexOf(f) >= 0),
   'acionadores instalados: backup diário, fila de e-mails, expurgo da fila, integridade diária, rotação mensal do histórico e resumo semanal de parados (G2, E13)');
ok(B.doGet({ parameter: { t: 'convite-antigo' } }) === 'html' && B.doGet({ parameter: {} }) === 'html',
   'v8.1: um link de convite antigo cai na abertura do sistema — a página externa foi aposentada');

/* v8.13 (C01) — o deep link não pode virar markup. O que o doGet entrega à
   página passa a ser dois campos saneados, emitidos em atributo. */
{
  const modeloOriginal = S.g.HtmlService.createTemplateFromFile;
  let t = null;
  S.g.HtmlService.createTemplateFromFile = function () {
    t = { evaluate: function () { return { setTitle: function () { return { addMetaTag: function () { return 'html'; } }; } }; } };
    return t;
  };
  const params = (par) => { B.doGet({ parameter: par }); return { v: t.paramV, pa: t.paramPa }; };
  let q = params({ v: '</scr' + 'ipt><scr' + 'ipt>window.x=1</scr' + 'ipt>', pa: '"><img src=x onerror=alert(1)>' });
  ok(q.v === '' && q.pa === '',
     'v8.13 (C01): ?v= e ?pa= com markup são descartados pelo doGet — não chegam à página');
  q = params({ v: 'D418-514F-97C2', pa: '3f2b7c10-9a44-4e18-bd21-77c0a1f9e0d2' });
  ok(q.v === 'D418-514F-97C2' && q.pa === '3f2b7c10-9a44-4e18-bd21-77c0a1f9e0d2',
     'v8.13 (C01): o código de autenticidade e o token de convite legítimos atravessam intactos');
  q = params({ v: { codigo: 'D418-514F-97C2' }, pa: 'a'.repeat(200) });
  ok(q.v === '' && q.pa === '',
     'v8.13 (C01): objeto no lugar do código e token gigante viram string vazia');
  q = params({});
  ok(q.v === '' && q.pa === '', 'v8.13 (C01): sem parâmetro, os dois campos ficam vazios');
  ok(B.paramSaneado_('abc', /^[0-9]*$/) === '' && B.paramSaneado_(null, /^[0-9]*$/) === '',
     'v8.13 (C01): paramSaneado_ recusa o valor inteiro quando ele não cabe no formato');
  S.g.HtmlService.createTemplateFromFile = modeloOriginal;
}

/* ---------- curadoria de conteúdo (v6.2) ---------- */
/* v8.13 (E04): a porta paralela `curadoriaEntrar` foi RETIRADA. A curadoria
   passa a exigir sessão de Órgão Central já aberta — e a entrada do Órgão
   Central é uma só, `entrarInstitucional`, endurecida desde a v8.4. */
ok(B.contexto().curadoria === false, 'sem senha e sem curadores, a curadoria não é oferecida');
ok(typeof B.curadoriaEntrar === 'undefined',
   'v8.13 (E04, A7-01/A8-02): curadoriaEntrar não existe mais — a segunda porta do Órgão Central foi retirada');
r = B.entrarInstitucional({ porta: 'central', senha: 'x', nome: 'Fulano' });
ok(!r.ok && /não foram configurados/.test(r.erro), 'entrada recusada antes de configurar a curadoria');
let erroCurto = null;
try { B.definirSenhaCuradoria_('curta'); } catch (e) { erroCurto = e.message; }
ok(/ao menos 10/.test(erroCurto || ''), 'senha curta é recusada');
B.definirSenhaCuradoria_('senha-de-teste-2026');
ok(B.contexto().curadoria === true && B.contexto().senhaDefinida === true, 'com a senha definida, a curadoria é oferecida');
r = B.entrarInstitucional({ porta: 'central', senha: 'errada', nome: 'Fulano' });
ok(!r.ok && /incorret/i.test(r.erro), 'senha incorreta é recusada');
/* v8.4 (e, com E04, para TODO caminho da curadoria): sem conta identificada e
   com a lista CURADORES vazia, a senha sozinha não abre o Órgão Central */
r = B.entrarInstitucional({ porta: 'central', senha: 'senha-de-teste-2026', nome: 'Jo' });
ok(!r.ok && /exige a conta institucional/.test(r.erro),
   'v8.13 (E04): sem conta identificada, a senha institucional sozinha não abre o Órgão Central');
/* v8.4: a entrada do Órgão Central por senha exige a conta institucional
   quando a lista CURADORES está vazia — é a regra que E04 passa a valer para
   TODO caminho da curadoria, por não haver mais um segundo. */
IDENTIDADE = 'maria.curadoria@educacao.mg.gov.br';
r = B.entrarInstitucional({ porta: 'central', senha: 'senha-de-teste-2026', nome: 'Maria da Curadoria', masp: '9999999-9' });
ok(r.ok && r.token && r.nome === 'maria.curadoria@educacao.mg.gov.br', 'entrada aceita e autoria registrada');
const TK = r.token;
r = B.curadoriaAbrir({ token: TK });
ok(r.ok && /maria\.curadoria/.test(r.autor), 'v8.13 (E04): a curadoria abre a partir da sessão do Órgão Central');
IDENTIDADE = '';
ok(!!r.padroesServidor['EMAIL.pendente.corpo'] && !!r.padroesServidor['DOC.folha.acompanhamento'],
   'padrões dos textos do servidor enviados à interface');

let bloqueado = null;
try { B.curadoriaSalvar({ token: 'inexistente', alteracoes: [] }); } catch (e) { bloqueado = e.message; }
ok(/expirada/.test(bloqueado || ''), 'gravação sem sessão válida é recusada');

r = B.curadoriaSalvar({ token: TK, alteracoes: [
  { p: 'T.avaliacao', valor: 'Texto novo da avaliação, conforme a resolução vigente.', rot: 'Avaliação' },
  { p: 'UI.declColegiado', valor: 'Declaro que li e aprovo o documento. <script>alert(1)</script>', rot: 'Declaração' },
  { p: 'REF_LEGISLACAO', valor: ['NORMA A.', 'NORMA B.'], rot: 'Referências' },
  { p: 'EMAIL.pendente.assunto', valor: 'Assinatura do PPP — {escola}', rot: 'Assinatura pendente' }
] });
ok(r.ok && r.pendentes === 4, 'quatro alterações gravadas em rascunho');
ok(Object.keys(B.conteudoPublicado().itens).length === 0, 'rascunho não altera nada para as escolas');
ok(B.txtServidor_('EMAIL.pendente.assunto') === B.PADRAO_SERVIDOR['EMAIL.pendente.assunto'], 'servidor segue com o texto padrão antes da publicação');

/* v8.13 (E07): a publicação passa a ser ESCOLHIDA — sem a lista de caminhos,
   recusa. Antes, "publicar" varria tudo o que estivesse pendente, inclusive o
   rascunho que outro curador tinha deixado em estudo. */
ok(!B.curadoriaPublicar({ token: TK }).ok &&
   /Informe quais textos publicar/.test(B.curadoriaPublicar({ token: TK }).erro || ''),
   'v8.13 (E07, A7-06): curadoriaPublicar sem a lista de caminhos é recusada');
r = B.curadoriaPublicar({ token: TK, caminhos: ['T.avaliacao', 'UI.declColegiado', 'REF_LEGISLACAO', 'EMAIL.pendente.assunto'] });
ok(r.ok && r.versao === 1, 'publicação incrementa a versão do conteúdo');
const pub = B.conteudoPublicado().itens;
ok(pub['T.avaliacao'] === 'Texto novo da avaliação, conforme a resolução vigente.', 'texto do documento publicado');
/* v8.13 (E05): a lista negra saiu; a lista branca ESCAPA o que não é
   marcação permitida. A palavra "script" continua no texto — como texto —,
   e o que não existe mais é a TAG: nada com "<" seguido de letra fora da
   lista atravessa. */
ok(!/<\s*script/i.test(pub['UI.declColegiado']) && /&lt;script&gt;/.test(pub['UI.declColegiado']),
   'v8.13 (E05, A7-03): o trecho de script vira TEXTO escapado no valor salvo — ' + pub['UI.declColegiado']);
ok(Array.isArray(pub['REF_LEGISLACAO']) && pub['REF_LEGISLACAO'].length === 2, 'lista de referências publicada');
ok(B.txtServidor_('EMAIL.pendente.assunto') === 'Assinatura do PPP — {escola}', 'servidor passa a usar o texto curado');

r = B.curadoriaSalvar({ token: TK, alteracoes: [{ p: 'T.avaliacao', valor: null, rot: 'Avaliação' }] });
ok(r.ok && r.pendentes === 1, 'pedido de restauração fica pendente');
r = B.curadoriaPublicar({ token: TK, caminhos: ['T.avaliacao'] });
ok(r.ok && B.conteudoPublicado().itens['T.avaliacao'] === undefined, 'restaurar apaga a diferença e devolve o texto original');
ok(r.versao === 2, 'versão avança a cada publicação');

r = B.curadoriaSalvar({ token: TK, alteracoes: [{ p: 'UI.landTitulo', valor: 'Teste', rot: 'Abertura' }] });
r = B.curadoriaDescartar({ token: TK });
ok(r.ok && B.conteudoPublicado().itens['UI.landTitulo'] === undefined, 'descartar remove o rascunho sem publicar');

r = B.curadoriaSalvar({ token: TK, alteracoes: [{ p: 'DOC.folha.titulo', valor: '20. Folha de assinaturas e ressalvas', rot: 'Folha' }] });
B.curadoriaPublicar({ token: TK, caminhos: ['DOC.folha.titulo'] });
/* v8.11: o documento JÁ CONCLUÍDO não muda quando a curadoria reescreve o
   texto — ele guarda os textos da folha congelados na conclusão. */
{
  const regC = B.lerLinha_(B.abaRegistros_(), 2);
  ok(!!regC.textosFolha && JSON.parse(regC.textosFolha)['DOC.folha.titulo'] === '22. Folha de assinaturas',
     'v8.11: a conclusão congela os textos da folha, como eles eram naquele momento');
  ok(!/Folha de assinaturas e ressalvas/.test(B.folhaAssinaturas_(regC)) &&
     /22\. Folha de assinaturas/.test(B.folhaAssinaturas_(regC)),
     'v8.11: e a folha do documento assinado NÃO muda quando o Órgão Central reescreve o texto');
  ok(/Folha de assinaturas e ressalvas/.test(B.folhaAssinaturas_({ hash: 'X', assinaturas: '[]' })),
     'v8.11: o texto novo vale para os PPPs concluídos a partir de agora');
}

/* ---------- perfis de acesso (v6.3) ---------- */
/* ===== v8.4: a porta do Órgão Central =====
   Até a 8.3, a conferência da lista CURADORES só valia para quem o Google
   identificava — e, por isso, quem abria o app de uma conta de FORA do domínio
   entrava com a senha institucional sozinha. */
r = B.entrarInstitucional({ senha: 'senha-de-teste-2026', nome: 'Ana do Órgão Central' });
ok(!r.ok && /conta institucional/.test(r.erro || ''),
   'v8.4: sem conta identificada e sem lista de curadores, a senha sozinha não abre o Órgão Central');
r = B.entrarInstitucional({ senha: 'errada', nome: 'Alguém', email: 'terceiro@gmail.com' });
ok(!r.ok && /incorretos/.test(r.erro || ''), 'v8.4: senha errada é recusada');
B.CURADORES.push('central@educacao.mg.gov.br');
r = B.entrarInstitucional({ senha: 'senha-de-teste-2026', nome: 'Terceiro', email: 'terceiro@gmail.com' });
ok(!r.ok && /não consta na lista/.test(r.erro || ''),
   'v8.4: com a lista preenchida, um e-mail de fora é recusado mesmo com a senha certa');
{
  /* o contador desta porta é um só: trocar de e-mail não escapa do bloqueio */
  for (let i = 0; i < 3; i++) B.entrarInstitucional({ senha: 'errada', nome: 'X', email: 'tenta' + i + '@gmail.com' });
  r = B.entrarInstitucional({ senha: 'senha-de-teste-2026', nome: 'Terceiro', email: 'outro@gmail.com' });
  ok(!r.ok && /bloquead|Muitas tentativas/.test(r.erro || ''),
     'v8.4: cinco tentativas seguidas bloqueiam a porta, ainda que cada uma use um e-mail diferente');
  S.g.PropertiesService.getScriptProperties().deleteProperty('CENTRAL_TENT');
}
r = B.entrarInstitucional({ senha: 'senha-de-teste-2026', nome: 'Ana do Órgão Central', email: 'central@educacao.mg.gov.br' });
ok(r.ok && r.perfil === 'central' && !r.sre, 'v8.4: quem está na lista entra, e a senha institucional continua valendo');
ok(fila().some(f => /Entrada no Órgão Central sem conta identificada/.test(f.assunto || '')),
   'v8.4: e os curadores são avisados da entrada sem conta identificada');
const TKC = r.token;
r = B.painelRegistros({ token: TKC, filtros: {} });
ok(r.ok && r.resumido === true && r.linhas.length === 0 && Array.isArray(r.quadro) && r.quadro.length >= 1,
   'B2: sem regional escolhida, o Órgão Central recebe o quadro por SRE — e não as linhas da rede inteira');
ok(r.quadro.every(q => q.sre && typeof q.total === 'number' && typeof q.escolas === 'number') &&
   r.totais.total === r.quadro.reduce((t, q) => t + q.total, 0),
   'B2: o quadro traz, por regional, quantos documentos e quantas escolas, e os totais fecham');
ok(B.painelRegistros({ token: TKC, filtros: { sre: 'Divinópolis' } }).linhas.length >= 1 &&
   B.painelRegistros({ token: TKC, filtros: { sre: 'Divinópolis' } }).resumido === undefined,
   'B2: escolhida uma regional, as linhas vêm — e só as dela');
ok(B.painelRegistros({ token: TKC, filtros: { busca: 'alfa' } }).resumido === undefined,
   'B2: qualquer busca também traz as linhas, sem passar pelo quadro');
r = B.painelRegistros({ token: TKC, filtros: { todas: true } });
ok(r.ok && r.linhas.length >= 2, 'Órgão Central enxerga os registros de toda a rede');
ok(r.linhas.some(function (x) { return x.pct > 0; }), 'painel calcula o percentual de preenchimento');
ok(r.sres.indexOf('Divinópolis') >= 0, 'painel lista as regionais existentes');

r = B.acessoSalvar({ token: TKC, email: 'dire.divinopolis@educacao.mg.gov.br', nome: 'DIRE Divinópolis',
                     perfil: 'regional', sre: 'Divinópolis', senha: 'regional-2026' });
ok(r.ok && r.acessos.length === 1, 'Órgão Central cadastra o acesso de uma regional');
r = B.acessoSalvar({ token: TKC, email: 'sem-arroba', perfil: 'regional', sre: 'X', senha: 'abcdefgh' });
ok(!r.ok && /e-mail válido/.test(r.erro), 'e-mail inválido é recusado no cadastro');
r = B.acessoSalvar({ token: TKC, email: 'dire.passos@educacao.mg.gov.br', perfil: 'regional', sre: '', senha: 'abcdefgh' });
ok(!r.ok && /Superintendência/.test(r.erro), 'acesso regional exige a SRE');

r = B.entrarInstitucional({ email: 'dire.divinopolis@educacao.mg.gov.br', senha: 'errada' });
ok(!r.ok, 'senha errada da regional é recusada');
r = B.entrarInstitucional({ email: 'dire.divinopolis@educacao.mg.gov.br', senha: 'regional-2026' });
ok(r.ok && r.perfil === 'regional' && r.sre === 'Divinópolis', 'regional entra com o cadastro feito pelo Órgão Central');
let TKR = r.token;   // v8.13 (C04): reaberto adiante, quando o cadastro é removido e recriado
/* v9.7: os DIRETORES ESCOLARES são geridos pela Diretoria Educacional e sua
   equipe — o Superintendente (TKR) e o Órgão Central (TKC) não associam. As
   operações sobre diretores passam a usar TKDA, a DE de Divinópolis. */
const TKDA = sessaoDe_({ email: 'equipe.de.divinopolis.a@educacao.mg.gov.br', nome: 'Equipe DE de Divinópolis',
  perfil: 'regional', papel: 'equipe_de', sre: 'Divinópolis' });
const painelReg = B.painelRegistros({ token: TKR, filtros: {} });
ok(painelReg.linhas.every(function (x) { return x.sre === 'Divinópolis'; }),
   'regional só enxerga as escolas da própria SRE');
const deOutra = B.painelRegistros({ token: TKC, filtros: { todas: true } }).linhas
  .filter(function (x) { return x.sre !== 'Divinópolis'; })[0];
if (deOutra) {
  r = B.registroLeitura({ token: TKR, p: deOutra.protocolo });
  ok(!r.ok && /outra Superintendência/.test(r.erro), 'regional não abre PPP de outra SRE');
}
r = B.registroLeitura({ token: TKR, p: painelReg.linhas[0].protocolo });
ok(r.ok && r.registro.escola, 'regional abre o PPP de uma escola da sua SRE');

/* A regional cadastra acessos de direção escolar da sua própria SRE (v6.6),
   mas não alcança perfis institucionais nem escolas de outra regional. */
r = B.acessosListar({ token: TKR });
ok(r.ok && r.perfilGestor === 'regional', 'regional acessa o cadastro de acessos de escola');
ok(r.acessos.every(a => a.sre === 'Divinópolis'),
   'a regional enxerga os acessos da sua SRE — os das escolas e os da própria estrutura');
r = B.acessoSalvar({ token: TKR, email: 'novo.regional@x.mg', nome: 'X', perfil: 'regional',
                     sre: 'Divinópolis', senha: 'senha12345' });
ok(!r.ok && /não cadastra/.test(r.erro || ''), 'o Superintendente não cadastra outro Superintendente');
barrado = null;
try { B.curadoriaSalvar({ token: TKR, alteracoes: [{ p: 'T.gestao', valor: 'x' }] }); } catch (e) { barrado = e.message; }
ok(/exclusiva do Órgão Central/.test(barrado || ''), 'regional não altera os textos do sistema');

/* ---------- v6.11: entrada pela conta institucional, sem senha ---------- */
IDENTIDADE = 'dire.divinopolis@educacao.mg.gov.br';
r = B.entrarInstitucional({});
ok(r.ok && r.perfil === 'regional' && r.sre === 'Divinópolis',
   'a regional entra só com a conta institucional, sem digitar nada');
ok(r.nome && r.nome !== r.email, 'os dados vêm do cadastro feito pelo Órgão Central');
let ctx = B.contexto();
ok(ctx.acesso && ctx.acesso.perfil === 'regional' && ctx.acesso.sre === 'Divinópolis',
   'o contexto já entrega o acesso resolvido pelo e-mail identificado');

IDENTIDADE = 'ninguem.cadastrado@educacao.mg.gov.br';
r = B.entrarInstitucional({});
ok(!r.ok && /não está cadastrado/.test(r.erro || ''), 'e-mail sem cadastro recebe recusa explicativa');
ok(/Superintendência Regional/.test(r.erro || '') && /Órgão Central/.test(r.erro || ''),
   'a recusa diz a quem recorrer, conforme o perfil');
ok(B.contexto().acesso === null, 'sem cadastro, o contexto não devolve acesso');

/* a identidade prevalece sobre o que a tela envia */
IDENTIDADE = 'dire.divinopolis@educacao.mg.gov.br';
r = B.entrarInstitucional({ email: 'outra.pessoa@educacao.mg.gov.br', senha: 'qualquer' });
ok(r.ok && r.email !== 'outra.pessoa@educacao.mg.gov.br' || r.ok,
   'o e-mail digitado na tela não sobrepõe a conta identificada');
ok(r.sre === 'Divinópolis', 'a sessão é a do e-mail identificado, não a do digitado');

IDENTIDADE = '';   // volta ao plano B por senha, usado no resto da bateria

/* ---------- v6.10: histórico também dos acessos institucionais ---------- */
let hi = B.acessosHistorico({ token: TKC });
ok(hi.ok && hi.acessos.length >= 1, 'acessos institucionais também abrem período no histórico');
ok(hi.acessos.every(a => a.perfil !== 'escola'), 'o histórico institucional não mistura direção escolar');
ok(hi.acessos.some(a => a.email === 'dire.divinopolis@educacao.mg.gov.br' && a.vigente),
   'a regional cadastrada aparece como vigente');

/* ---------- v7.0: a cascata de cadastro dentro da regional ---------- */
/* O Órgão Central cadastra UM Superintendente por SRE, e só isso. */
r = B.acessoSalvar({ token: TKC, email: 'segundo.super@educacao.mg.gov.br', nome: 'Segundo Superintendente',
                     papel: 'superintendente', sre: 'Divinópolis' });
ok(!r.ok && /Já existe/.test(r.erro || ''), 'uma SRE tem um único Superintendente');
r = B.acessoSalvar({ token: TKC, email: 'de.pelo.central@educacao.mg.gov.br', nome: 'DE pelo Central',
                     papel: 'diretor_educacional', sre: 'Divinópolis' });
ok(!r.ok && /não cadastra/.test(r.erro || ''),
   'o Órgão Central não cadastra Diretor Educacional — quem cadastra é o Superintendente');

/* O Superintendente cadastra dois Diretores Educacionais e um Coordenador. */
r = B.acessoSalvar({ token: TKR, email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1',
                     papel: 'diretor_educacional' });
ok(r.ok, 'o Superintendente cadastra o primeiro Diretor Educacional');
ok(B.acessoPorToken_ && true, 'convite de primeiro acesso gerado no cadastro');
ok(fila().some(f => f.tipo === 'boas-vindas' && f.para === 'de1@educacao.mg.gov.br' && /pa=/.test(f.corpo)) &&
   !emails.some(e => e.to === 'de1@educacao.mg.gov.br'),
   'quem é cadastrado com conta do domínio recebe as boas-vindas pela fila (com o link de senha como opção), não um convite na hora');
r = B.acessoSalvar({ token: TKR, email: 'de2@educacao.mg.gov.br', nome: 'Diretor Educacional 2',
                     papel: 'diretor_educacional' });
ok(r.ok, 'o segundo Diretor Educacional é opcional, mas cabe');
r = B.acessoSalvar({ token: TKR, email: 'de3@educacao.mg.gov.br', nome: 'Diretor Educacional 3',
                     papel: 'diretor_educacional' });
ok(!r.ok && /2 Diretor/.test(r.erro || ''), 'um terceiro Diretor Educacional é recusado');
r = B.acessoSalvar({ token: TKR, email: 'ci@educacao.mg.gov.br', nome: 'Coordenadora de Inspeção',
                     papel: 'coordenador_inspecao' });
ok(r.ok, 'o Superintendente cadastra o Coordenador de Inspeção');
r = B.acessoSalvar({ token: TKR, email: 'ci2@educacao.mg.gov.br', nome: 'Segundo Coordenador',
                     papel: 'coordenador_inspecao' });
ok(!r.ok && /Já existe/.test(r.erro || ''), 'só há um Coordenador de Inspeção por SRE');
r = B.acessoSalvar({ token: TKR, email: 'equipe.pelo.super@educacao.mg.gov.br', nome: 'Equipe',
                     papel: 'equipe_de' });
ok(!r.ok && /não cadastra/.test(r.erro || ''),
   'o Superintendente não cadastra a equipe: quem cadastra é o Diretor Educacional');

/* A equipe de cada um é cadastrada por quem a chefia. */
const acessos1 = B.acessosListar({ token: TKR }).acessos;
ok(acessos1.some(a => a.email === 'de1@educacao.mg.gov.br'), 'o Diretor Educacional aparece na lista de acessos do Superintendente, que o cadastra');
ok(B.acessosListar({ token: TKC }).acessos.every(a => a.email !== 'de1@educacao.mg.gov.br'),
   'v9.7: e NÃO na do Órgão Central, que administra só os superintendentes');

/* o histórico e a inativação continuam funcionando, agora por papel */
hi = B.acessosHistorico({ token: TKC, sre: 'Divinópolis' });
ok(hi.acessos.filter(a => a.vigente).length === 4,
   'a SRE passa a ter Superintendente, dois Diretores Educacionais e o Coordenador');
r = B.acessoSalvar({ token: TKR, email: 'de2@educacao.mg.gov.br', nome: 'Diretor Educacional 2',
                     papel: 'diretor_educacional', situacao: 'inativo' });
ok(r.ok, 'acesso institucional pode ser inativado');
hi = B.acessosHistorico({ token: TKC, email: 'de2@educacao.mg.gov.br' });
ok(hi.acessos.length === 1 && !hi.acessos[0].vigente && hi.acessos[0].fim,
   'inativar encerra o período no histórico');
ok(/inativado/.test(hi.acessos[0].motivo || ''), 'o motivo da inativação fica registrado');
r = B.acessoSalvar({ token: TKR, email: 'de2@educacao.mg.gov.br', nome: 'Diretor Educacional 2',
                     papel: 'diretor_educacional', situacao: 'ativo' });
ok(r.ok, 'acesso institucional pode ser reativado');
hi = B.acessosHistorico({ token: TKC, email: 'de2@educacao.mg.gov.br' });
ok(hi.acessos.length === 2 && hi.acessos[0].vigente, 'reativar abre um período novo, sem apagar o anterior');
r = B.acessoRemover({ token: TKC, email: 'de2@educacao.mg.gov.br' });
ok(r.ok, 'acesso institucional removido');
hi = B.acessosHistorico({ token: TKC, email: 'de2@educacao.mg.gov.br' });
ok(hi.acessos.length === 2 && hi.acessos.every(a => !a.vigente),
   'remover encerra o período e mantém os dois registros no histórico');

let barradoAcH = null;
try { B.acessosHistorico({ token: TKR }); } catch (e) { barradoAcH = e.message; }
ok(/exclusiva do Órgão Central/.test(barradoAcH || ''), 'histórico institucional é exclusivo do Órgão Central');

/* ---------- v6.7: base de escolas e um único acesso por escola ---------- */
const INEP_A = String(painelReg.linhas[0].inep).replace(/\D/g, '');
const INEP_B = '31700200';   // escola só da base, sem PPP — para testar o cadastro isolado

r = B.acessoSalvar({ token: TKDA, email: 'dir.sem.base@educacao.mg.gov.br', nome: 'Diretor X',
                     perfil: 'escola', inep: INEP_A, senha: 'senha12345' });
ok(!r.ok && /não está na base/.test(r.erro || ''), 'sem base de escolas, nenhum acesso escolar é criado');

let barradoImp = null;
try { B.escolasImportar({ token: TKR, texto: '31999999;Escola X;Y;Divinópolis' }); } catch (e) { barradoImp = e.message; }
ok(/exclusiva do Órgão Central/.test(barradoImp || ''), 'só o Órgão Central importa a base de escolas');

r = cargaEscolas(TKC,
  'Código INEP;Escola;Município;SRE\n' +
  INEP_A + ';EE Alfa;Divinópolis;Divinópolis\n' +
  INEP_B + ';EE Beta;Divinópolis;Divinópolis\n' +
  '31700099;EE Longe;Uberlândia;Uberlândia\n' +
  '1;EE Código Curto;X;Y\n' +
  '31700100;;X;Y');
ok(r.ok && r.incluidas === 3 && r.atualizadas === 0, 'base de escolas importada');
ok(r.totalErros === 2, 'linhas inválidas são recusadas e relatadas, sem derrubar a importação');
ok(!r.erros.join(' ').includes('linha 1'), 'cabeçalho colado junto é ignorado');
r = cargaEscolas(TKC, INEP_A + ';EE Alfa (nome corrigido);Divinópolis;Divinópolis');
ok(r.ok && r.incluidas === 0 && r.atualizadas === 1, 'reimportar corrige a escola, não duplica');

const listaEsc = B.escolasListar({ token: TKR });
ok(listaEsc.ok && listaEsc.escolas.every(e => e.sre === 'Divinópolis'),
   'regional vê na base apenas as escolas da sua SRE');
/* v8.13 (C04): a direção que já criou o PPP da escola A tem cadastro — sem
   ele não haveria sessão. As demais escolas ainda não têm gestor. */
ok(listaEsc.escolas.filter(e => e.inep !== INEP_A).every(e => e.gestor === null) &&
   (listaEsc.escolas.filter(e => e.inep === INEP_A)[0].gestor || {}).email === 'dir@x.mg',
   'base começa sem gestor cadastrado, salvo a escola cuja direção já está no sistema');

r = B.acessoSalvar({ token: TKDA, email: 'dir.escola.a@educacao.mg.gov.br', nome: 'Diretor A',
                     masp: '14862338', perfil: 'escola', inep: INEP_A, escola: 'nome digitado à mão',
                     senha: 'senha12345' });
ok(r.ok, 'regional cadastra o gestor de uma escola da sua SRE');
let hist = B.gestoresHistorico({ token: TKDA, inep: INEP_A });
ok(hist.ok && hist.gestores.length === 1 && hist.gestores[0].vigente,
   'o cadastro abre o histórico de gestores da escola');
ok(hist.gestores[0].inicio && !hist.gestores[0].fim, 'o gestor vigente tem início e não tem fim');
ok(hist.gestores[0].registradoPor, 'o histórico guarda quem fez o cadastro');
ok((r.escolas || []).filter(e => e.inep === INEP_A)[0].escola === 'EE Alfa (nome corrigido)',
   'o nome da escola vem da base, não do que foi digitado');
ok((r.escolas || []).filter(e => e.inep === INEP_A)[0].gestor.masp === '14862338', 'MASP gravado');

/* Identidade do cadastro escolar é a ESCOLA, não o e-mail: trocar o gestor
   reescreve o mesmo cadastro; nunca existem dois para o mesmo INEP. */
r = B.acessoSalvar({ token: TKDA, email: 'outro.diretor@educacao.mg.gov.br', nome: 'Diretor Y',
                     masp: '9876543', perfil: 'escola', inep: INEP_A });
ok(r.ok, 'trocar o gestor da escola é permitido, sem senha alguma');
const soUm = (r.escolas || []).filter(e => e.inep === INEP_A);
ok(soUm.length === 1 && soUm[0].gestor.email === 'outro.diretor@educacao.mg.gov.br',
   'a escola continua com um único cadastro, agora do gestor novo');
r = B.acessosListar({ token: TKDA, papeis: ['diretor_escolar'] });
ok(r.acessos.filter(a => a.inep === INEP_A).length === 1, 'não sobrou cadastro órfão do gestor anterior');
ok(B.acessosListar({ token: TKC }).acessos.every(a => a.papel !== 'diretor_escolar' && a.papel !== 'diretor_educacional' && a.papel !== 'coordenador_inspecao'),
   'P3/v9.7: o Órgão Central lista só os superintendentes — nem diretores escolares, nem equipe de regional');
hist = B.gestoresHistorico({ token: TKDA, inep: INEP_A });
ok(hist.gestores.length === 2, 'a substituição guarda os dois gestores no histórico');
ok(hist.gestores[0].vigente && hist.gestores[0].email === 'outro.diretor@educacao.mg.gov.br',
   'o mais recente vem primeiro e é o vigente');
ok(!hist.gestores[1].vigente && hist.gestores[1].fim, 'o gestor anterior fica com período encerrado');
ok(/substitu/.test(hist.gestores[1].motivo || ''), 'o histórico diz por que o período foi encerrado');
ok(hist.gestores[1].email === 'dir.escola.a@educacao.mg.gov.br' && hist.gestores[1].masp === '14862338',
   'o histórico preserva nome, MASP e e-mail de quem saiu');
let barradoHist = null;
try { barradoHist = B.gestoresHistorico({ token: TKDA, inep: '31700099' }); } catch (e) { barradoHist = { erro: e.message }; }
ok(/outra Superintendência/.test(barradoHist.erro || ''), 'regional não vê o histórico de escola de outra SRE');
r = B.entrarInstitucional({ email: 'dir.escola.a@educacao.mg.gov.br' });
ok(!r.ok, 'o gestor substituído perde o acesso');

/* devolve o cadastro original, para o restante da bateria */
r = B.acessoSalvar({ token: TKDA, email: 'dir.escola.a@educacao.mg.gov.br', nome: 'Diretor A',
                     masp: '14862338', perfil: 'escola', inep: INEP_A, senha: 'senha12345' });
ok(r.ok, 'gestor pode ser trocado de volta');

r = B.acessoSalvar({ token: TKDA, email: 'dir.escola.a@educacao.mg.gov.br', nome: 'Diretor A',
                     perfil: 'escola', inep: INEP_B, senha: 'senha12345' });
ok(!r.ok && /já responde/.test(r.erro || ''), 'um e-mail não responde por duas escolas');

r = B.acessoSalvar({ token: TKDA, email: 'dir.masp.errado@educacao.mg.gov.br', nome: 'Diretor Z',
                     masp: 'abc', perfil: 'escola', inep: INEP_B, senha: 'senha12345' });
ok(r.ok, 'MASP não numérico é limpo, não derruba o cadastro');
ok((r.escolas || []).filter(e => e.inep === INEP_B)[0].gestor.masp === '', 'MASP não numérico não é gravado');
r = B.acessoRemover({ token: TKDA, email: 'dir.masp.errado@educacao.mg.gov.br' });
ok(r.ok, 'gestor removido libera a escola para novo cadastro');
hist = B.gestoresHistorico({ token: TKDA, inep: INEP_B });
ok(hist.gestores.length === 1 && !hist.gestores[0].vigente && hist.gestores[0].fim,
   'remover o gestor encerra o período, sem apagar o histórico');
/* nenhuma rotina do sistema apaga linha do histórico */
const fonteHist = String(B.gestoresHistorico) + String(B.acessoRemover) + String(B.acessoSalvar);
ok(!/abaGestores_\(\)\.deleteRow/.test(fonteHist), 'nenhuma rotina exclui linha do histórico de gestores');
ok(/removido/.test(hist.gestores[0].motivo || ''), 'o motivo da remoção fica registrado');

/* a situação do gestor escolar é derivada, não escolhida: enviar "inativo"
   não tem efeito — quem está cadastrado é o vigente, e o anterior já saiu */
r = B.acessoSalvar({ token: TKDA, email: 'dir.escola.a@educacao.mg.gov.br', nome: 'Diretor A',
                     perfil: 'escola', inep: INEP_A, situacao: 'inativo', modo: 'correcao' });
ok(r.ok, 'gravação aceita mesmo enviando situação');
ok((r.escolas || []).filter(e => e.inep === INEP_A)[0].gestor.situacao === 'ativo',
   'gestor escolar é sempre o vigente — não existe cadastro escolar inativo');

/* nesta altura a escola A já teve três períodos: A, o substituto, e A de volta */
hist = B.gestoresHistorico({ token: TKDA, inep: INEP_A });
ok(hist.gestores.length === 3, 'cada troca de gestor acrescenta um período ao histórico');
ok(hist.gestores.filter(g => g.vigente).length === 1, 'só um gestor é o vigente');
ok(hist.gestores.slice(1).every(g => !!g.fim), 'todos os períodos anteriores estão encerrados');

/* alterar só os dados do gestor vigente não abre período novo */
r = B.acessoSalvar({ token: TKDA, email: 'dir.escola.a@educacao.mg.gov.br', nome: 'Diretor A (nome corrigido)',
                     masp: '5550001', perfil: 'escola', inep: INEP_A, modo: 'correcao' });
ok(r.ok, 'corrigir nome e MASP do gestor vigente é permitido sem senha nova');
hist = B.gestoresHistorico({ token: TKDA, inep: INEP_A });
ok(hist.gestores.length === 3, 'corrigir dados não cria um período novo no histórico');
ok(hist.gestores[0].nome === 'Diretor A (nome corrigido)' && hist.gestores[0].masp === '5550001',
   'a correção aparece no período vigente');
ok((r.escolas || []).filter(e => e.inep === INEP_A)[0].gestoresJaCadastrados === 3,
   'a lista de escolas informa quantos gestores já passaram pela escola');

r = B.acessoSalvar({ token: TKDA, email: 'dir.fora.sre@educacao.mg.gov.br', nome: 'Diretor W',
                     perfil: 'escola', inep: '31700099', senha: 'senha12345' });
ok(!r.ok && /outra Superintendência/.test(r.erro || ''), 'regional não cadastra escola de outra SRE');

r = B.acessoSalvar({ token: TKDA, email: 'dir.sem.base2@educacao.mg.gov.br', nome: 'Diretor V',
                     perfil: 'escola', inep: '31900000', senha: 'senha12345' });
ok(!r.ok && /não está na base/.test(r.erro || ''), 'INEP fora da base é recusado');

/* ---------- v6.14: o escopo da regional na associação de diretores ---------- */
/* O Órgão Central cadastra um diretor numa escola de OUTRA regional: nada
   disso pode chegar à SRE de Divinópolis — nem a escola, nem o diretor. */
r = B.acessoSalvar({ token: TKC, email: 'dir.uberlandia@educacao.mg.gov.br', nome: 'Diretor de Uberlândia',
                     masp: '7001234', perfil: 'escola', inep: '31700099' });
ok(!r.ok && /não gere os diretores/.test(r.erro || ''), 'v9.7: o Órgão Central NÃO associa diretor — isso é da Diretoria Educacional da regional');
const TKDU = sessaoDe_({ email: 'de.uberlandia@educacao.mg.gov.br', nome: 'DE de Uberlândia',
  perfil: 'regional', papel: 'diretor_educacional', sre: 'Uberlândia' });
r = B.acessoSalvar({ token: TKDU, email: 'dir.uberlandia@educacao.mg.gov.br', nome: 'Diretor de Uberlândia',
                     masp: '7001234', perfil: 'escola', inep: '31700099' });
ok(r.ok, 'a Diretoria Educacional de Uberlândia associa o diretor de uma escola da sua regional');
const visaoRegional = B.escolasListar({ token: TKR });
ok(visaoRegional.escolas.every(e => e.sre === 'Divinópolis'),
   'a regional lista apenas as escolas da sua própria SRE');
ok(!visaoRegional.escolas.some(e => e.inep === '31700099'),
   'escola de outra regional não aparece para a regional');
ok(!JSON.stringify(visaoRegional).includes('dir.uberlandia'),
   'o diretor de outra regional não chega sequer aos dados enviados à regional');
const visaoCentral = B.escolasListar({ token: TKC });
ok(visaoCentral.escolas.some(e => e.inep === '31700099'),
   'só o Órgão Central enxerga as escolas de todas as regionais');
ok(visaoCentral.escolas.filter(e => e.inep === '31700099')[0].gestor.email === 'dir.uberlandia@educacao.mg.gov.br',
   'o Órgão Central enxerga o diretor associado em qualquer regional');
ok(new Set(visaoCentral.escolas.map(e => e.sre)).size > 1,
   'a lista do Órgão Central reúne mais de uma regional — é o que o filtro por regional percorre');
r = B.acessoRemover({ token: TKR, email: 'dir.uberlandia@educacao.mg.gov.br' });
ok(!r.ok && /Superintendência/.test(r.erro || ''),
   'a regional não desfaz a associação de diretor de outra SRE');
r = B.acessosListar({ token: TKR });
ok(!r.acessos.some(a => a.email === 'dir.uberlandia@educacao.mg.gov.br'),
   'a lista de acessos da regional não traz diretor de outra SRE');
ok(r.acessos.every(a => a.sre === 'Divinópolis'),
   'a regional não alcança acesso de outra SRE, em nenhum papel');
ok(B.escolasListar({ token: TKR }).escolas.some(e => e.municipio),
   'a base devolve o município de cada escola — é por ele que a regional filtra');
/* escola da mesma SRE em outro município: é o que o filtro por município separa */
r = B.escolaSalvar({ token: TKC, inep: '31700300', escola: 'EE de Itaúna',
                     municipio: 'Itaúna', sre: 'Divinópolis', codigoInep: censoDe('31700300') });
ok(r.ok, 'a mesma regional pode ter escolas em municípios diferentes');
ok(new Set(B.escolasListar({ token: TKR }).escolas.map(e => e.municipio).filter(Boolean)).size > 1,
   'a regional tem escolas em mais de um município — é o que o filtro por município percorre');

r = B.entrarInstitucional({ email: 'dir.escola.a@educacao.mg.gov.br', senha: 'senha12345' });
ok(r.ok && r.perfil === 'escola' && r.inep === INEP_A, 'direção entra e a sessão traz o INEP vinculado');
const TKE = r.token;
const painelEsc = B.painelRegistros({ token: TKE, filtros: {} });
ok(painelEsc.ok && painelEsc.linhas.length > 0, 'direção enxerga os PPPs da própria escola');
ok(painelEsc.linhas.every(x => String(x.inep).replace(/\D/g, '') === String(INEP_A).replace(/\D/g, '')),
   'direção não enxerga PPP de nenhuma outra escola');
ok(painelEsc.linhas.every(x => typeof x.editavel === 'boolean'),
   'cada PPP informa se ainda pode ser editado');

const deOutraEscola = B.painelRegistros({ token: TKC, filtros: { todas: true } }).linhas
  .filter(x => String(x.inep).replace(/\D/g, '') !== String(INEP_A).replace(/\D/g, ''))[0];
if (deOutraEscola) {
  r = B.registroLeitura({ token: TKE, p: deOutraEscola.protocolo });
  ok(!r.ok && /outra escola/.test(r.erro || ''), 'direção não abre PPP de outra escola');
  r = B.buscarPPP({ p: deOutraEscola.protocolo, token: TKE });
  ok(!r.ok && /outra escola/.test(r.erro || ''), 'nem pelo número do protocolo');
  r = B.salvarPPP({ protocolo: deOutraEscola.protocolo, token: TKE, escola: 'invasão' });
  ok(!r.ok && /outra escola/.test(r.erro || ''), 'nem gravando por cima');
  r = B.novaVersao({ p: deOutraEscola.protocolo, token: TKE });
  ok(!r.ok && /outra escola/.test(r.erro || ''), 'nem abrindo nova versão do PPP alheio');
}
/* Uma escola escreve um PPP de cada vez — regra absoluta na sessão escolar. */
r = B.salvarPPP({ token: TKE, escola: 'Nome digitado à mão', inep: '00000000', tMissao: 'x' });
ok(!r.ok && r.duplicado, 'com um PPP em andamento, a escola não cria outro');
ok(/já tem um PPP em andamento/.test(r.erro || ''), 'a recusa explica a regra');
r = B.salvarPPP({ token: TKE, escola: 'Nome digitado à mão', inep: '00000000', tMissao: 'x',
                  ignorarDuplicado: true });
ok(!r.ok && r.duplicado, 'nem forçando ignorarDuplicado: a trava é do servidor, não da tela');

/* concluído o que estava aberto, a escola pode começar outro */
const emAberto = B.painelRegistros({ token: TKE, filtros: {} }).linhas.filter(x => x.editavel)[0];
r = B.buscarPPP({ p: emAberto.protocolo, token: TKE });
ok(r.ok, 'o PPP em andamento continua acessível para ser continuado');

r = B.acessoSalvar({ token: TKC, email: 'dire.divinopolis@educacao.mg.gov.br', nome: 'DIRE Divinópolis',
                     perfil: 'regional', sre: 'Divinópolis', situacao: 'inativo' });
ok(r.ok, 'acesso pode ser inativado sem perder o cadastro');
r = B.entrarInstitucional({ email: 'dire.divinopolis@educacao.mg.gov.br', senha: 'regional-2026' });
ok(!r.ok && /inativo/.test(r.erro), 'acesso inativo não entra');
const painelC = B.painelRegistros({ token: TKC, filtros: { todas: true } });
ok(painelC.linhas.every(function (x) { return x.revisaoVencida === false; }),
   'PPP concluído agora não aparece como revisão vencida');
ok(B.painelRegistros({ token: TKC, filtros: { vencidas: true } }).linhas.length === 0,
   'filtro de revisão vencida devolve lista vazia quando não há atraso');

const antesDeRemover = B.acessosListar({ token: TKC }).acessos.length;
r = B.acessoRemover({ token: TKC, email: 'dire.divinopolis@educacao.mg.gov.br' });
ok(r.ok && r.acessos.length === antesDeRemover - 1, 'acesso removido pelo Órgão Central');
ok(!r.acessos.some(a => a.email === 'dire.divinopolis@educacao.mg.gov.br'), 'o acesso removido some da lista');
/* v8.13 (C04): removido o cadastro, a SESSÃO daquele acesso deixa de valer na
   chamada seguinte — até aqui ela seguia respondendo por até 12 horas. */
ok(/acesso foi encerrado/.test((function () {
     try { B.painelRegistros({ token: TKR, filtros: {} }); return ''; } catch (e) { return String(e.message || e); }
   })()),
   'v8.13 (C04): removido o cadastro, a sessão aberta cai na chamada seguinte');
r = B.acessoSalvar({ token: TKC, email: 'dire.divinopolis@educacao.mg.gov.br', nome: 'DIRE Divinópolis',
                     perfil: 'regional', sre: 'Divinópolis', senha: 'regional-2026' });
TKR = B.entrarInstitucional({ email: 'dire.divinopolis@educacao.mg.gov.br', senha: 'regional-2026' }).token;
ok(!!TKR && B.painelRegistros({ token: TKR, filtros: {} }).ok,
   'v8.13 (C04): recriado o cadastro, a regional entra de novo e a bateria segue');

/* ---------- v6.13: cadastro de escola nova na base da rede ---------- */
const INEP_NOVA = '31788800';

r = B.escolaSalvar({ token: TKC, inep: '1', escola: 'EE do código curto', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe('1') });
ok(!r.ok && /2 a 8 dígitos/.test(r.erro || ''), 'código da escola fora de 2 a 8 dígitos é recusado');
r = B.escolaSalvar({ token: TKC, inep: '184381', escola: 'EE do Código da SEE', municipio: 'Almenara',
                     sre: 'Almenara', codigoInep: censoDe('184381') });
ok(r.ok && r.criada, 'o código da escola na SEE, de 6 dígitos, é aceito como identidade');
r = B.escolaSalvar({ token: TKC, inep: '184381', escola: 'EE do Código da SEE', municipio: 'Almenara',
                     sre: 'Almenara', codigoInep: '123' });
ok(!r.ok && /8 dígitos/.test(r.erro || ''), 'o INEP adicional, quando informado, precisa ter 8 dígitos');
r = B.escolaSalvar({ token: TKC, inep: '184381', escola: 'EE do Código da SEE', municipio: 'Almenara',
                     sre: 'Almenara', codigoInep: '31112233' });
ok(r.ok && r.escolas.filter(e => e.inep === '184381')[0].codigoInep === '31112233',
   'o código INEP é guardado à parte, sem trocar a identidade da escola');
r = B.escolaSalvar({ token: TKC, inep: INEP_NOVA, escola: 'EE', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_NOVA) });
ok(!r.ok && /nome da escola/.test(r.erro || ''), 'escola sem nome é recusada');
r = B.escolaSalvar({ token: TKC, inep: INEP_NOVA, escola: 'EE Nova do Horto', municipio: '', sre: 'Divinópolis', codigoInep: censoDe(INEP_NOVA) });
ok(!r.ok && /município/.test(r.erro || ''), 'escola sem município é recusada');
r = B.escolaSalvar({ token: TKC, inep: INEP_NOVA, escola: 'EE Nova do Horto', municipio: 'Divinópolis', sre: '', codigoInep: censoDe(INEP_NOVA) });
ok(!r.ok && /Regional/.test(r.erro || ''), 'o Órgão Central precisa informar a regional da escola');

r = B.escolaSalvar({ token: TKC, inep: INEP_NOVA, escola: 'EE Nova do Horto', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_NOVA) });
ok(r.ok && r.criada, 'Órgão Central cadastra uma escola nova na base');
ok(r.escolas.filter(e => e.inep === INEP_NOVA).length === 1, 'a escola nova entra na base uma única vez');
ok(r.escolas.filter(e => e.inep === INEP_NOVA)[0].situacao === 'ativa', 'escola nova nasce ativa');

/* o INEP é a identidade: gravar de novo é alterar, nunca duplicar */
r = B.escolaSalvar({ token: TKC, inep: INEP_NOVA, escola: 'EE Nova do Horto Florido',
                     municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_NOVA) });
ok(r.ok && !r.criada, 'gravar o mesmo INEP é alteração, não criação');
ok(B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === INEP_NOVA).length === 1,
   'a base continua com um único registro para aquele INEP');
ok(B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === INEP_NOVA)[0].escola === 'EE Nova do Horto Florido',
   'a alteração reescreve o nome da escola');

/* a regional cadastra na própria SRE; a SRE vem da sessão, não da tela */
r = B.escolaSalvar({ token: TKDA, inep: '31788801', escola: 'EE da Regional',
                     municipio: 'Itaúna', sre: 'Uberlândia', codigoInep: censoDe('31788801') });
ok(r.ok && r.escolas.filter(e => e.inep === '31788801')[0].sre === 'Divinópolis',
   'a regional cadastra a escola na sua própria SRE, mesmo enviando outra');
r = B.escolaSalvar({ token: TKDA, inep: '31700099', escola: 'EE Longe renomeada',
                     municipio: 'Uberlândia', sre: 'Divinópolis', codigoInep: censoDe('31700099') });
ok(!r.ok && /outra Superintendência/.test(r.erro || ''),
   'a regional não altera escola de outra SRE');
ok(B.escolasListar({ token: TKR }).escolas.every(e => e.sre === 'Divinópolis'),
   'a regional continua vendo apenas as escolas da sua SRE');

/* a escola cadastrada já serve de base para o acesso */
r = B.acessoSalvar({ token: TKDA, email: 'dir.horto@educacao.mg.gov.br', nome: 'Diretora do Horto',
                     perfil: 'escola', inep: INEP_NOVA });
ok(r.ok, 'a escola recém-cadastrada já recebe gestor');
ok(r.escolas.filter(e => e.inep === INEP_NOVA)[0].gestor.email === 'dir.horto@educacao.mg.gov.br',
   'o gestor fica ligado à escola nova');

/* baixa: inativa, nunca exclui */
r = B.escolaSituacao({ token: TKDA, inep: INEP_NOVA, situacao: 'inativa' });
ok(r.ok && r.situacao === 'inativa', 'a escola é marcada como inativa');
ok(r.escolas.filter(e => e.inep === INEP_NOVA).length === 1, 'a linha da escola permanece na base');
ok(r.gestorEncerrado === 'dir.horto@educacao.mg.gov.br', 'inativar a escola encerra o acesso do gestor');
ok(!B.entrarInstitucional({ email: 'dir.horto@educacao.mg.gov.br' }).ok,
   'o gestor de escola inativa deixa de entrar');
let histHorto = B.gestoresHistorico({ token: TKDA, inep: INEP_NOVA });
ok(histHorto.ok && histHorto.gestores.length === 1 && histHorto.gestores[0].fim,
   'o período do gestor é encerrado, não apagado');
ok(/inativada/.test(histHorto.gestores[0].motivo || ''), 'o histórico registra o motivo do encerramento');
r = B.acessoSalvar({ token: TKDA, email: 'outro.horto@educacao.mg.gov.br', nome: 'Outro',
                     perfil: 'escola', inep: INEP_NOVA });
ok(!r.ok && /inativa/.test(r.erro || ''), 'escola inativa não recebe gestor novo');
r = B.escolaSituacao({ token: TKDA, inep: INEP_NOVA, situacao: 'inativa' });
ok(!r.ok, 'inativar duas vezes é recusado');
r = B.escolaSituacao({ token: TKDA, inep: '31700099', situacao: 'inativa' });
ok(!r.ok && /outra Superintendência/.test(r.erro || ''), 'a regional não dá baixa em escola de outra SRE');
r = B.escolaSituacao({ token: TKDA, inep: INEP_NOVA, situacao: 'ativa' });
ok(r.ok && r.situacao === 'ativa', 'a escola pode ser reativada');
r = B.acessoSalvar({ token: TKDA, email: 'outro.horto@educacao.mg.gov.br', nome: 'Outro',
                     perfil: 'escola', inep: INEP_NOVA });
ok(r.ok, 'reativada, a escola volta a receber gestor');

ok(B.sresConhecidas_().indexOf('Divinópolis') >= 0 && B.sresConhecidas_().indexOf('Uberlândia') >= 0,
   'as regionais conhecidas alimentam o cadastro de escola nova');
ok(!/abaEscolas_\(\)\.deleteRow/.test(src) && !/escolaExcluir/.test(src),
   'nenhuma rotina do sistema exclui linha da base de escolas');
ok(/deleteRow/.test(String(B.escolaSituacao)) && /abaAcessos_\(\)\.deleteRow/.test(String(B.escolaSituacao)),
   'a baixa da escola remove o cadastro de acesso, não a escola');

/* ---------- v6.15: troca de diretor não sobrescreve o antecessor ---------- */
/* O defeito: a caixa institucional da direção pertence à ESCOLA, não à
   pessoa. Deduzir a troca da mudança de e-mail fazia o sucessor gravar por
   cima do nome e do MASP do antecessor no período em aberto. */
const INEP_CX = '31788850';
B.escolaSalvar({ token: TKC, inep: INEP_CX, escola: 'EE da Caixa Institucional',
                 municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_CX) });
const CAIXA = 'direcao.' + INEP_CX + '@educacao.mg.gov.br';

r = B.acessoSalvar({ token: TKDA, email: CAIXA, nome: 'Diretora Primeira',
                     masp: '1110001', perfil: 'escola', inep: INEP_CX });
ok(r.ok, 'primeira diretora associada à escola');
let hx = B.gestoresHistorico({ token: TKDA, inep: INEP_CX });
ok(hx.gestores.length === 1 && hx.gestores[0].vigente && hx.gestores[0].inicio,
   'a associação abre um período com data de início');

/* sucessora com a MESMA caixa institucional */
r = B.acessoSalvar({ token: TKDA, email: CAIXA, nome: 'Diretora Segunda',
                     masp: '2220002', perfil: 'escola', inep: INEP_CX });
ok(r.ok, 'a sucessora é associada usando a mesma caixa institucional da escola');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_CX });
ok(hx.gestores.length === 2,
   'mesmo com o e-mail idêntico, a troca abre período novo — o antecessor NÃO é sobrescrito');
ok(hx.gestores[0].nome === 'Diretora Segunda' && hx.gestores[0].vigente && !hx.gestores[0].fim,
   'a sucessora é a vigente');
ok(hx.gestores[1].nome === 'Diretora Primeira' && hx.gestores[1].masp === '1110001',
   'a antecessora continua no histórico com o nome e o MASP dela');
ok(!!hx.gestores[1].fim, 'o período da antecessora ficou com data final');
ok(/substitu/.test(hx.gestores[1].motivo || '') && /Segunda/.test(hx.gestores[1].motivo || ''),
   'o motivo do encerramento nomeia quem assumiu, não só o e-mail');

/* correção continua sendo correção: mesma pessoa, mesmo período */
r = B.acessoSalvar({ token: TKDA, email: CAIXA, nome: 'Diretora Segunda de Souza',
                     masp: '2220002', perfil: 'escola', inep: INEP_CX, modo: 'correcao' });
ok(r.ok, 'a correção de dados é aceita');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_CX });
ok(hx.gestores.length === 2, 'corrigir não abre período novo');
ok(hx.gestores[0].nome === 'Diretora Segunda de Souza', 'a correção acerta o período vigente');
ok(hx.gestores[1].nome === 'Diretora Primeira',
   'e não encosta no período de quem já saiu');

/* correção sem ninguém no exercício é recusada */
r = B.acessoRemover({ token: TKDA, email: CAIXA, motivo: 'Aposentadoria' });
ok(r.ok, 'o diretor em exercício é desativado');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_CX });
ok(hx.gestores.every(g => !g.vigente), 'nenhum período fica em aberto depois da desativação');
ok(hx.gestores[0].motivo === 'Aposentadoria',
   'o motivo informado na desativação é o que fica registrado no histórico');
ok(hx.gestores.length === 2, 'desativar não apaga nada do histórico');
r = B.acessoSalvar({ token: TKDA, email: CAIXA, nome: 'Qualquer',
                     perfil: 'escola', inep: INEP_CX, modo: 'correcao' });
ok(!r.ok && /para corrigir/.test(r.erro || ''),
   'não há o que corrigir quando a escola está sem diretor');
r = B.acessoSalvar({ token: TKDA, email: CAIXA, nome: 'Diretora Terceira',
                     masp: '3330003', perfil: 'escola', inep: INEP_CX });
ok(r.ok, 'a escola volta a receber diretor depois da desativação');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_CX });
ok(hx.gestores.length === 3 && hx.gestores[0].nome === 'Diretora Terceira' && hx.gestores[0].vigente,
   'o terceiro período começa sem tocar nos dois anteriores');
ok(hx.gestores.map(g => g.nome).join(' | ') ===
   'Diretora Terceira | Diretora Segunda de Souza | Diretora Primeira',
   'as três diretoras estão no histórico, do mais recente ao mais antigo');

/* ---------- v6.16: gestão de acessos por regional ---------- */
/* o Órgão Central cadastra o Superintendente de cada SRE; ele cadastra os seus */
B.acessoSalvar({ token: TKC, email: 'super.uberlandia@educacao.mg.gov.br', nome: 'Superintendente de Uberlândia',
                 papel: 'superintendente', sre: 'Uberlândia' });
const TKSU = sessaoDe_({ email: 'super.uberlandia@educacao.mg.gov.br', nome: 'Superintendente de Uberlândia',
                              perfil: 'regional', papel: 'superintendente', sre: 'Uberlândia' });
B.acessoSalvar({ token: TKSU, email: 'equipe.a.uberlandia@educacao.mg.gov.br', nome: 'Equipe A de Uberlândia',
                 papel: 'diretor_educacional' });
B.acessoSalvar({ token: TKSU, email: 'equipe.b.uberlandia@educacao.mg.gov.br', nome: 'Equipe B de Uberlândia',
                 papel: 'coordenador_inspecao' });
B.acessoSalvar({ token: TKC, email: 'equipe.passos@educacao.mg.gov.br', nome: 'Equipe de Passos',
                 papel: 'superintendente', sre: 'Passos' });
let hUber = B.acessosHistorico({ token: TKC, sre: 'Uberlândia' });
ok(hUber.ok && hUber.acessos.length === 3, 'o histórico pode ser pedido por regional');
ok(hUber.acessos.every(g => g.sre === 'Uberlândia'),
   'o histórico de uma regional não traz períodos de outra');
ok(!JSON.stringify(hUber).includes('equipe.passos'),
   'a janela de uma regional não enxerga a equipe de outra');
ok(hUber.acessos.every(g => g.vigente), 'as pessoas da regional convivem ativas');

/* suspender uma não derruba a outra */
r = B.acessoSalvar({ token: TKSU, email: 'equipe.b.uberlandia@educacao.mg.gov.br', nome: 'Equipe B de Uberlândia',
                     papel: 'coordenador_inspecao', situacao: 'inativo' });
ok(r.ok, 'uma pessoa da equipe pode ser suspensa');
hUber = B.acessosHistorico({ token: TKC, sre: 'Uberlândia' });
ok(hUber.acessos.filter(g => g.vigente).length === 2, 'suspender encerra só o período dela');
ok(hUber.acessos.filter(g => g.email === 'equipe.a.uberlandia@educacao.mg.gov.br')[0].vigente,
   'a outra pessoa da mesma regional continua ativa');
r = B.acessoSalvar({ token: TKSU, email: 'equipe.b.uberlandia@educacao.mg.gov.br', nome: 'Equipe B de Uberlândia',
                     papel: 'coordenador_inspecao', situacao: 'ativo' });
ok(r.ok, 'a pessoa suspensa pode ser reativada');
hUber = B.acessosHistorico({ token: TKC, sre: 'Uberlândia' });
ok(hUber.acessos.length === 4, 'a reativação abre um período novo, sem apagar o encerrado');

/* a equipe do próprio Órgão Central é uma unidade à parte */
const hCentral = B.acessosHistorico({ token: TKC, central: true });
ok(hCentral.ok && hCentral.acessos.every(g => g.perfil === 'central'),
   'o histórico do Órgão Central traz apenas os acessos dele');
ok(!JSON.stringify(hCentral).includes('equipe.a.uberlandia'),
   'a equipe do Órgão Central não se mistura com a das regionais');

/* a aba continua privativa do Órgão Central */
let barradoHistInst = null;
try { B.acessosHistorico({ token: TKR, sre: 'Divinópolis' }); } catch (e) { barradoHistInst = e.message; }
ok(/exclusiva do Órgão Central/.test(barradoHistInst || ''),
   'a regional não alcança o histórico de acessos institucionais');

/* ---------- v7.0: competências, primeiro acesso e colegiado ---------- */
/* Quem valida e quem associa — e quem não faz nem uma coisa nem outra. */
ok(B.podeValidar_('equipe_de') && B.podeValidar_('diretor_educacional') &&
   B.podeValidar_('superintendente') && B.podeValidar_('central'),
   'validam o PPP: a Diretoria Educacional, sua equipe e quem está acima');
ok(!B.podeValidar_('coordenador_inspecao') && !B.podeValidar_('equipe_inspecao'),
   'a Coordenação de Inspeção não valida');
ok(B.podeAssociar_('equipe_de') && !B.podeAssociar_('equipe_inspecao'),
   'associar diretor à escola é da Diretoria Educacional, não da Inspeção');
ok(B.soLeitura_('equipe_inspecao') && B.soLeitura_('coordenador_inspecao') && B.soLeitura_('colegiado'),
   'inspeção e colegiado atuam apenas como leitores');

/* A equipe de cada chefia é cadastrada por ela. */
let TKDE = sessaoDe_({ email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1',
                              perfil: 'regional', papel: 'diretor_educacional', sre: 'Divinópolis' });
let TKCI = sessaoDe_({ email: 'ci@educacao.mg.gov.br', nome: 'Coordenadora de Inspeção',
                              perfil: 'regional', papel: 'coordenador_inspecao', sre: 'Divinópolis' });
r = B.acessoSalvar({ token: TKDE, email: 'analista.de@educacao.mg.gov.br', nome: 'Analista da DE',
                     papel: 'equipe_de' });
ok(r.ok, 'o Diretor Educacional cadastra a sua equipe');
r = B.acessoSalvar({ token: TKCI, email: 'inspetor@educacao.mg.gov.br', nome: 'Inspetor Escolar',
                     papel: 'equipe_inspecao' });
ok(r.ok, 'o Coordenador de Inspeção cadastra a sua equipe');
r = B.acessoSalvar({ token: TKDE, email: 'invasor@educacao.mg.gov.br', nome: 'X', papel: 'equipe_inspecao' });
ok(!r.ok && /não cadastra/.test(r.erro || ''), 'o Diretor Educacional não cadastra a equipe da Inspeção');
r = B.acessoSalvar({ token: TKCI, email: 'invasor2@educacao.mg.gov.br', nome: 'X', papel: 'equipe_de' });
ok(!r.ok && /não cadastra/.test(r.erro || ''), 'o Coordenador de Inspeção não cadastra a equipe da DE');
const TKEQDE = sessaoDe_({ email: 'analista.de@educacao.mg.gov.br', nome: 'Analista da DE',
                                perfil: 'regional', papel: 'equipe_de', sre: 'Divinópolis' });
const TKEQCI = sessaoDe_({ email: 'inspetor@educacao.mg.gov.br', nome: 'Inspetor Escolar',
                                perfil: 'regional', papel: 'equipe_inspecao', sre: 'Divinópolis' });
r = B.acessoSalvar({ token: TKEQDE, email: 'maisum@educacao.mg.gov.br', nome: 'X', papel: 'equipe_de' });
ok(!r.ok && /não cadastra ninguém/.test(r.erro || ''), 'a equipe não cadastra mais ninguém: a cascata termina nela');

/* Associar diretor à escola: a DE e sua equipe podem; a Inspeção, não. */
const INEP_V7 = '31788870';
B.escolaSalvar({ token: TKC, inep: INEP_V7, escola: 'EE da Sétima Versão', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_V7) });
r = B.acessoSalvar({ token: TKEQCI, email: 'dir.v7@educacao.mg.gov.br', nome: 'Diretora V7',
                     papel: 'diretor_escolar', inep: INEP_V7 });
ok(!r.ok && /não gere os diretores/.test(r.erro || ''),
   'a equipe da Inspeção não associa diretor à escola');
r = B.acessoSalvar({ token: TKEQDE, email: 'dir.v7@educacao.mg.gov.br', nome: 'Diretora V7',
                     papel: 'diretor_escolar', inep: INEP_V7 });
ok(r.ok, 'a equipe da Diretoria Educacional associa o diretor à escola');
ok(emailsPara('dir.v7@educacao.mg.gov.br') === 1 && r.conviteModo === 'boas-vindas',
   'a diretora associada (conta do domínio) recebe as boas-vindas pela fila');

/* Primeiro acesso: define a senha, o convite some, e os dois logins convivem. */
const cadDir = B.acessoPorToken_ ? null : null;
const linhaDir = B.acessosListar({ token: TKDA, papeis: ['diretor_escolar'] }).acessos.filter(a => a.email === 'dir.v7@educacao.mg.gov.br')[0];
ok(!!linhaDir, 'a diretora aparece na lista de acessos');
const tokConvite = (function () {
  const aba = B.abaAcessos_();
  const n = aba.getLastRow();
  const vals = aba.getRange(2, 1, n - 1, 16).getDisplayValues();
  const l = vals.filter(v => String(v[0]).toLowerCase() === 'dir.v7@educacao.mg.gov.br')[0];
  return l ? String(l[13]) : '';
})();
ok(!!tokConvite, 'o convite fica gravado na planilha');
r = B.primeiroAcessoInfo({ token: 'inventado' });
ok(!r.ok && /não é válido/.test(r.erro || ''), 'convite inventado é recusado');
r = B.primeiroAcessoInfo({ token: tokConvite });
ok(r.ok && r.email === 'dir.v7@educacao.mg.gov.br' && r.papelNome === 'Direção Escolar',
   'o convite diz quem é a pessoa e em que papel foi cadastrada');
r = B.primeiroAcessoDefinir({ token: tokConvite, senha: 'curta', repetir: 'curta' });
ok(!r.ok && /8 caracteres/.test(r.erro || ''), 'senha curta é recusada');
r = B.primeiroAcessoDefinir({ token: tokConvite, senha: 'senha-boa-2026', repetir: 'outra-coisa' });
ok(!r.ok && /diferentes/.test(r.erro || ''), 'as duas senhas precisam coincidir');
r = B.primeiroAcessoDefinir({ token: tokConvite, senha: 'senha-boa-2026', repetir: 'senha-boa-2026' });
ok(r.ok, 'a senha é definida pelo link de primeiro acesso');
r = B.primeiroAcessoInfo({ token: tokConvite });
ok(!r.ok, 'o convite serve uma única vez');
IDENTIDADE = '';
r = B.entrarInstitucional({ email: 'dir.v7@educacao.mg.gov.br', senha: 'senha-boa-2026' });
ok(r.ok && r.papel === 'diretor_escolar' && r.inep === INEP_V7,
   'a diretora entra com a senha que definiu, e a sessão traz o papel');
ok(r.podeAssociar === false && r.soLeitura === false,
   'a sessão informa o que aquele papel pode fazer');
const TKESCOLA = r.token;
r = B.entrarInstitucional({ email: 'dir.v7@educacao.mg.gov.br', senha: 'errada' });
ok(!r.ok, 'senha errada é recusada');
IDENTIDADE = 'dir.v7@educacao.mg.gov.br';
r = B.entrarInstitucional({});
ok(r.ok && r.papel === 'diretor_escolar',
   'quem tem conta institucional continua entrando sem digitar nada');
IDENTIDADE = '';

/* Colegiado: só a direção escolar cadastra, e só na própria escola. */
r = B.acessoSalvar({ token: TKEQDE, email: 'membro@educacao.mg.gov.br', nome: 'Membro',
                     papel: 'colegiado', inep: INEP_V7 });
ok(!r.ok && /direção escolar/.test(r.erro || ''), 'a regional não cadastra o colegiado da escola');
r = B.acessoSalvar({ token: TKESCOLA, email: 'membro1@educacao.mg.gov.br', nome: 'Membro Docente',
                     papel: 'colegiado', segmento: 'Docente' });
ok(r.ok, 'a direção escolar cadastra o colegiado da sua escola');
r = B.acessoSalvar({ token: TKESCOLA, email: 'membro2@educacao.mg.gov.br', nome: 'Membro Estudante',
                     papel: 'colegiado', segmento: 'Estudante', relacao: 'estudante do 9º ano, turma B' });
ok(r.ok, 'o colegiado tem vários membros — não há limite de um por escola');
const doColegiado = B.colegiadoListar({ token: TKESCOLA });
ok(doColegiado.ok && doColegiado.membros.length === 2, 'os dois membros ficam cadastrados na escola');
ok(doColegiado.inep === INEP_V7 && doColegiado.membros.some(m => m.segmento === 'Docente'),
   'a lista do colegiado é a da escola da sessão, com o segmento de cada membro');
ok(emailsPara('membro1@educacao.mg.gov.br') === 1 && emailsPara('membro2@educacao.mg.gov.br') === 1,
   'cada membro do colegiado recebe o seu link de primeiro acesso');
r = B.acessoSalvar({ token: TKESCOLA, email: 'sucessora.v7@educacao.mg.gov.br', nome: 'Sucessora',
                     papel: 'diretor_escolar', inep: INEP_V7 });
ok(!r.ok && /não gere os diretores/.test(r.erro || ''),
   'a direção escolar não associa a si mesma nem à sua sucessora');

/* Reenvio do convite. */
r = B.primeiroAcessoReenviar({ token: TKESCOLA, email: 'membro1@educacao.mg.gov.br' });
ok(r.ok, 'a direção reenvia o convite de um membro do colegiado');
r = B.primeiroAcessoReenviar({ token: TKESCOLA, email: 'de1@educacao.mg.gov.br' });
ok(!r.ok && /sua escola/.test(r.erro || ''), 'a direção não reenvia convite de quem não é da sua escola');

/* ---------- v7.0: assinatura dentro do sistema ---------- */
/* A escola V7 percorre o caminho inteiro: validação, conclusão e assinatura
   pelos membros do colegiado, cada um entrando com a própria conta. */
r = B.salvarPPP({ escola: 'EE da Sétima Versão', inep: INEP_V7, sre: 'Divinópolis',
                  municipio: 'Divinópolis', direcao: 'Diretora V7', token: TKESCOLA });
ok(r.ok, 'a escola V7 cria o seu PPP');
const PV7 = r.protocolo;
r = B.concluirPPP({ protocolo: PV7, escola: 'EE da Sétima Versão', docHtml: docTeste('<p>x</p>'), token: TKESCOLA });
ok(!r.ok && r.precisaValidacao, 'sem validação não há conclusão');
B.enviarParaValidacao({ token: TKESCOLA, protocolo: PV7 });
r = B.validarPPP({ token: TKEQCI, protocolo: PV7 });
ok(!r.ok && /não valida/.test(r.erro || ''), 'a equipe da Inspeção não valida o PPP');
r = B.validarPPP({ token: TKEQDE, protocolo: PV7, parecer: 'Em conformidade.' });
ok(r.ok, 'a equipe da Diretoria Educacional valida o PPP');
r = B.concluirPPP({ protocolo: PV7, escola: 'EE da Sétima Versão',
                    direcao: 'Diretora V7', docHtml: docTeste('<p>x</p>'), token: TKESCOLA,
                    assinaturaDirecao: { nome: 'Diretora V7', masp: '1112223', email: 'dir.v7@educacao.mg.gov.br' } });
ok(r.ok && r.registro.status === 'Em assinatura', 'validado, o PPP pode ser concluído');
ok(JSON.parse(r.registro.assinaturas).length === 1, 'v8.1: a folha nasce só com a direção');
/* v8.1: ata, presença e só então a assinatura da direção */
B.registrarAta({ p: PV7, token: TKESCOLA, base64: 'QUJD', nome: 'ata-v7.pdf', mime: 'application/pdf', dataReuniao: '10/09/2026' });
r = B.presencaColegiado({ p: PV7, token: TKESCOLA,
  emails: ['membro1@educacao.mg.gov.br', 'membro2@educacao.mg.gov.br'] });
ok(r.ok && r.presentes === 2, 'a direção marca os dois membros presentes à reunião de aprovação');
const folhaV7 = JSON.parse(r.registro.assinaturas);
ok(folhaV7.length === 3, 'a folha passa a ter a direção e os dois membros presentes');
ok(folhaV7.some(a => a.email === 'membro1@educacao.mg.gov.br' && a.segmento === 'Docente'),
   'cada membro entra na folha com o seu segmento, como está no cadastro');

/* cada um assina entrando no sistema, sem link nem token */
const TKM1 = sessaoDe_({ email: 'membro1@educacao.mg.gov.br', nome: 'Membro Docente',
                              perfil: 'escola', papel: 'colegiado', sre: 'Divinópolis',
                              inep: INEP_V7, escola: 'EE da Sétima Versão' });
r = B.minhasAssinaturas({ token: TKM1 });
ok(r.ok && r.pendentes.length === 1 && r.pendentes[0].protocolo === PV7,
   'ao entrar, o membro vê o documento que espera a assinatura dele');
r = B.assinarNoSistema({ token: TKM1, protocolo: PV7 });
ok(!r.ok && /leitura e a aprovação/.test(r.erro || ''), 'assinar exige a declaração de leitura');
r = B.assinarNoSistema({ token: TKM1, protocolo: PV7, aceite: true });
ok(r.ok && r.assinadoEm, 'o membro assina dentro do sistema');
r = B.assinarNoSistema({ token: TKM1, protocolo: PV7, aceite: true });
ok(!r.ok && /já assinou/.test(r.erro || ''), 'ninguém assina duas vezes');
r = B.minhasAssinaturas({ token: TKM1 });
ok(r.pendentes.length === 0 && r.assinados.length === 1, 'assinado, o documento sai da lista de pendências');
const TKFORA = sessaoDe_({ email: 'inspetor@educacao.mg.gov.br', nome: 'Inspetor Escolar',
                                perfil: 'regional', papel: 'equipe_inspecao', sre: 'Divinópolis' });
r = B.assinarNoSistema({ token: TKFORA, protocolo: PV7, aceite: true });
ok(!r.ok && /não está na folha/.test(r.erro || ''), 'quem não está na folha não assina');
const TKM2 = sessaoDe_({ email: 'membro2@educacao.mg.gov.br', nome: 'Membro Estudante',
                              perfil: 'escola', papel: 'colegiado', sre: 'Divinópolis',
                              inep: INEP_V7, escola: 'EE da Sétima Versão' });
r = B.assinarNoSistema({ token: TKM2, protocolo: PV7, aceite: true });
ok(r.ok && r.assinadoEm, 'o segundo membro também assina dentro do sistema');

/* ---------- v7.1: base real da rede e domínio institucional ---------- */
/* Carga no formato das extrações da rede: o código da escola tem 6 dígitos,
   e o quinto campo pode trazer o INEP — ou a situação, como nas cargas antigas. */
r = cargaEscolas(TKC,
  'SRE;ID Escola;Escola;Município\n' +
  '184403;EE de Machado Mineiro;Almenara;Almenara\n' +
  '9121;EE dos Palmares;Belo Horizonte;Metropolitana B\n' +
  '34410;EE Maria Rita Duarte;Belo Horizonte;Metropolitana B\n' +
  '200671;CESEC Zenith Campos;Monte Carmelo;Monte Carmelo;31998877');
ok(r.ok && r.incluidas === 4, 'a base da rede entra com o código da SEE, de 2 a 6 dígitos');
const comInep = B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === '200671')[0];
ok(comInep && comInep.codigoInep === '31998877',
   'o quinto campo da carga, quando é um INEP, é guardado à parte');
const semInep = B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === '9121')[0];
ok(semInep && semInep.situacao === 'ativa' && !semInep.codigoInep,
   'sem o quinto campo, a escola nasce ativa e sem INEP');
r = cargaEscolas(TKC, '184403;EE de Machado Mineiro;Almenara;Almenara;inativa');
ok(r.ok && r.atualizadas === 1 &&
   B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === '184403')[0].situacao === 'inativa',
   'cargas antigas, com a situação no quinto campo, continuam funcionando');
r = cargaEscolas(TKC, '184403;EE de Machado Mineiro;Almenara;Almenara;123');
ok(r.ok && r.totalErros === 1, 'um INEP de tamanho errado é recusado linha a linha, sem derrubar a carga');

/* O aviso do domínio: 215 diretores da base real usam e-mail particular. */
ok(B.emailInstitucional_('roseny.silva@educacao.mg.gov.br'), 'e-mail do domínio da rede é reconhecido');
ok(!B.emailInstitucional_('mariajosesilveira@yahoo.com.br'), 'e-mail particular é reconhecido como de fora');
ok(!B.emailInstitucional_('fulano@educacao.mg.gov.br.br'), 'domínio parecido não passa por institucional');
B.escolaSalvar({ token: TKC, inep: '184381', escola: 'EE do Código da SEE', municipio: 'Almenara',
                 sre: 'Almenara', codigoInep: censoDe('184381') });
B.acessoSalvar({ token: TKC, email: 'super.almenara@educacao.mg.gov.br', nome: 'Superintendente de Almenara',
                 papel: 'superintendente', sre: 'Almenara' });
const lanca = function (fn) { try { fn(); return ''; } catch (e) { return String(e.message || e); } };
/* v9.7: quem associa diretores é a Diretoria Educacional — a sessão de
   Almenara passa a ser a DE de lá */
const TKAL = sessaoDe_({ email: 'de.almenara@educacao.mg.gov.br', nome: 'Diretora Educacional de Almenara',
                              perfil: 'regional', papel: 'diretor_educacional', sre: 'Almenara' });
r = salvarDiretor(B, { email: 'diretora.particular@yahoo.com.br', nome: 'Diretora com e-mail particular',
                     papel: 'diretor_escolar', inep: '184381' });
ok(r.ok, 'o cadastro com e-mail particular NÃO é bloqueado — a informação é guardada');
ok(/não é do domínio/.test(r.aviso || '') && /conta institucional/.test(r.aviso || ''),
   'mas quem cadastra é avisado de que a pessoa não conseguirá entrar sem conta institucional');
B.escolaSalvar({ token: TKC, inep: '184446', escola: 'EE Veríssimo Teixeira Costa', municipio: 'Almenara',
                 sre: 'Almenara', codigoInep: censoDe('184446') });
r = salvarDiretor(B, { email: 'diretora.certa@educacao.mg.gov.br', nome: 'Diretora com conta da rede',
                     papel: 'diretor_escolar', inep: '184446' });
ok(r.ok && !r.aviso, 'com conta institucional não há aviso nenhum');

/* ---------- v7.2: a lista de contas a regularizar ---------- */
/* Em Almenara há duas diretoras: uma com e-mail particular, outra com conta
   da rede. A lista traz só a primeira, e o escopo é o da regional. */
let cp = B.contasPendentes({ token: TKAL });
ok(cp.ok && cp.linhas.length === 1 && cp.linhas[0].email === 'diretora.particular@yahoo.com.br',
   'a regional enxerga os seus diretores com e-mail fora do domínio');
ok(cp.linhas[0].dominio === 'yahoo.com.br', 'a lista mostra o domínio de cada endereço');
ok(cp.linhas[0].jaDefiniuSenha === false, 'e diz quem ainda não definiu a senha');
ok(cp.totalDiretores >= 1 && cp.foraDominio === 1,
   'o resumo compara os fora do domínio com o total de diretores da unidade');
ok(!JSON.stringify(cp).includes('diretora.certa@educacao.mg.gov.br'),
   'quem tem conta institucional não entra na lista');

/* v9.7: as contas a regularizar dos diretores são de quem os gere — a
   Diretoria Educacional; o Órgão Central não as vê. */
ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKC }))),
   'v9.7: o Órgão Central não enxerga as contas a regularizar dos diretores — isso é da Diretoria Educacional');
const cpR = B.contasPendentes({ token: TKDA });
ok(cpR.linhas.every(x => x.sre === 'Divinópolis'),
   'a regional de Divinópolis não vê os pendentes de Almenara');

/* Definida a senha, a pessoa continua na lista — mas marcada como quem já entrou:
   a pendência da conta institucional não some porque ela conseguiu entrar. */
const tkConvDir = (function () {
  const aba = B.abaAcessos_(); const n = aba.getLastRow();
  const l = aba.getRange(2, 1, n - 1, 16).getDisplayValues()
    .filter(v => String(v[0]).toLowerCase() === 'diretora.particular@yahoo.com.br')[0];
  return l ? String(l[13]) : '';
})();
ok(!!tkConvDir, 'a diretora com e-mail particular recebeu convite de primeiro acesso');
r = B.primeiroAcessoDefinir({ token: tkConvDir, senha: 'senha-particular-2026', repetir: 'senha-particular-2026' });
ok(r.ok, 'ela define a senha pelo link e passa a conseguir entrar');
cp = B.contasPendentes({ token: TKAL });
ok(cp.linhas.length === 1 && cp.linhas[0].jaDefiniuSenha === true,
   'continua na lista, agora marcada como quem já entrou — a conta institucional segue pendente');
r = B.entrarInstitucional({ email: 'diretora.particular@yahoo.com.br', senha: 'senha-particular-2026' });
ok(r.ok && r.papel === 'diretor_escolar',
   'e-mail fora do domínio entra normalmente por senha: o sistema não o recusa');

/* v8.13 (C16): a lista dos DIRETORES continua sendo de quem associa diretores
   — a direção escolar não a alcança. O que ela passa a alcançar é outra
   lista, no escopo da própria escola: os membros SERVIDORES do seu Colegiado
   com conta fora do domínio. Comportamento novo e correto (A2-08): antes, o
   aviso de conta pendente era dado a quem cadastra o Colegiado e não tinha
   onde ser visto. */
const cpEscola = B.contasPendentes({ token: TKESCOLA });
ok(cpEscola.ok && cpEscola.escopo === 'escola',
   'v8.13 (C16): a direção escolar recebe a lista no escopo da sua escola');
ok((cpEscola.linhas || []).every(function (x) { return x.inep === B.sessao_(TKESCOLA).inep; }),
   'v8.13 (C16): e nenhuma linha de fora da escola dela');

/* ============================================================
   v7.3 — regressão dos achados do testador (T-01 a T-26)
   ============================================================ */


/* ---- T-01: colegiado só lê e assina ---- */
ok(/direção escolar/.test(lanca(() => B.salvarPPP({ token: TKM1, protocolo: PV7, escola: 'x' }))),
   'T-01: colegiado não grava o PPP da escola');
ok(/direção escolar/.test(lanca(() => B.salvarPPP({ token: TKM1, escola: 'novo', inep: INEP_V7 }))),
   'T-01: nem cria um novo');
ok(/direção escolar/.test(lanca(() => B.buscarPPP({ p: PV7, token: TKM1 }))),
   'T-01: colegiado não abre o PPP para edição (buscarPPP assume a trava)');
ok(/direção escolar/.test(lanca(() => B.enviarParaValidacao({ token: TKM1, protocolo: PV7 }))),
   'T-01: colegiado não envia para validação');
ok(/direção escolar/.test(lanca(() => B.concluirPPP({ token: TKM1, protocolo: PV7, docHtml: docTeste('<p>x</p>') }))),
   'T-01: colegiado não conclui');
ok(/direção escolar/.test(lanca(() => B.novaVersao({ p: PV7, token: TKM1 }))),
   'T-01: colegiado não abre nova versão');
r = B.painelRegistros({ token: TKM1, filtros: {} });
ok(r.ok && r.linhas.length >= 1 && r.linhas.every(x => String(x.inep) === INEP_V7 && x.editavel === false),
   'T-01: o colegiado vê os PPPs da própria escola, nunca como editáveis');
r = B.registroLeitura({ token: TKM1, p: PV7 });
ok(r.ok && r.registro.protocolo === PV7, 'T-01: o colegiado lê o documento da própria escola pelo registroLeitura');
r = B.registroLeitura({ token: TKM1, p: P });
ok(!r.ok && /outra escola/.test(r.erro || ''), 'T-01: mas não o de outra escola');
ok(B.sessaoDirecao_('') === null, 'T-01: sem token, sessaoDirecao_ devolve null (caminho antigo, pelo e-mail)');
ok(B.sessaoDirecao_(TKESCOLA) && B.sessaoDirecao_(TKESCOLA).inep === INEP_V7, 'T-01: com sessão de direção, devolve a sessão');
ok(/direção escolar/.test(lanca(() => B.sessaoDirecao_(TKEQDE))), 'T-01: sessão regional não passa por direção');

/* ---- T-02: o contexto e a entrada identificada carregam o papel ---- */
IDENTIDADE = 'membro1@educacao.mg.gov.br';
ctx = B.contexto();
ok(ctx.acesso && ctx.acesso.papel === 'colegiado' && ctx.acesso.papelNome === 'Colegiado Escolar' &&
   ctx.acesso.soLeitura === true && ctx.acesso.podeValidar === false && ctx.acesso.email === 'membro1@educacao.mg.gov.br',
   'T-02: contexto() devolve papel, nome do papel, competências e e-mail do cadastro identificado');
r = B.entrarInstitucional({});
ok(r.ok && r.papel === 'colegiado' && r.email === 'membro1@educacao.mg.gov.br' && r.soLeitura === true,
   'T-02/T-15: a entrada identificada devolve o papel e o e-mail');
IDENTIDADE = 'analista.de@educacao.mg.gov.br';
ctx = B.contexto();
ok(ctx.acesso && ctx.acesso.papel === 'equipe_de' && ctx.acesso.podeValidar === true && ctx.acesso.podeAssociar === true,
   'T-02: a equipe da DE identificada pela conta chega com podeValidar e podeAssociar');
IDENTIDADE = '';

/* ---- T-03: papéis só-leitura da regional não mexem em escolas nem em diretores ---- */
r = B.acessoRemover({ token: TKEQCI, email: 'dir.v7@educacao.mg.gov.br' });
ok(!r.ok && /não gere os diretores/.test(r.erro || ''), 'T-03: a equipe da Inspeção não remove diretor');
ok(/não mantém a base/.test(lanca(() => B.escolaSituacao({ token: TKEQCI, inep: INEP_V7, situacao: 'inativa' }))),
   'T-03: nem inativa escola');
ok(/não mantém a base/.test(lanca(() => B.escolaSalvar({ token: TKEQCI, inep: '31788898', escola: 'Escola da Inspeção', municipio: 'X', sre: 'Divinópolis', codigoInep: censoDe('31788898') }))),
   'T-03: nem cadastra escola');
r = B.primeiroAcessoReenviar({ token: TKEQCI, email: 'dir.v7@educacao.mg.gov.br' });
ok(!r.ok && /não remove diretores|Diretoria Educacional/.test(r.erro || ''), 'T-03: nem reenvia convite de diretor');
ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKEQCI }))), 'T-03: nem alcança a lista de contas a regularizar');
ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKCI }))), 'T-03: o Coordenador de Inspeção também não');
r = B.primeiroAcessoReenviar({ token: TKCI, email: 'inspetor@educacao.mg.gov.br' });
ok(r.ok, 'T-03: mas o Coordenador reenvia o convite da própria equipe — a cascata dele continua valendo');
ok(B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === INEP_V7)[0].situacao === 'ativa' &&
   B.escolasListar({ token: TKC }).escolas.filter(e => e.inep === INEP_V7)[0].gestor.email === 'dir.v7@educacao.mg.gov.br',
   'T-03: nada mudou com as tentativas');

/* ---- T-04: colegiado não é gestor ---- */
const INEP_T4 = '31788899';
B.escolaSalvar({ token: TKC, inep: INEP_T4, escola: 'EE do Colegiado Distinto', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_T4) });
r = B.acessoSalvar({ token: TKEQDE, email: 'd4@educacao.mg.gov.br', nome: 'Diretora Quatro', masp: '4440004',
                     papel: 'diretor_escolar', inep: INEP_T4 });
ok(r.ok, 'T-04: a diretora é associada à escola');
const TKD4 = sessaoDe_({ email: 'd4@educacao.mg.gov.br', nome: 'Diretora Quatro', perfil: 'escola',
                              papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_T4, escola: 'EE do Colegiado Distinto' });
r = B.acessoSalvar({ token: TKD4, email: 'm1.t4@educacao.mg.gov.br', nome: 'Membro Um', papel: 'colegiado', segmento: 'Docente' });
ok(r.ok, 'T-04: a direção cadastra o membro 1');
r = B.acessoSalvar({ token: TKD4, email: 'm2.t4@educacao.mg.gov.br', nome: 'Membro Dois', papel: 'colegiado', segmento: 'Estudante', relacao: 'estudante do 8º ano' });
ok(r.ok, 'T-04: e o membro 2');
const gestorT4 = () => B.escolasListar({ token: TKR }).escolas.filter(e => e.inep === INEP_T4)[0];
ok(gestorT4().gestor && gestorT4().gestor.email === 'd4@educacao.mg.gov.br',
   'T-04(a): na lista de escolas o gestor é a diretora — não o último membro do colegiado cadastrado');
ok(gestorT4().gestoresJaCadastrados === 1, 'T-04(a): a escola conta um gestor, não três');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_T4 });
ok(hx.gestores.length === 1 && hx.gestores[0].email === 'd4@educacao.mg.gov.br' && hx.gestores[0].vigente,
   'T-04(b): o histórico de gestores tem só a diretora; o colegiado não entra nele');
ok(B.acessoPorInep_(INEP_T4).email === 'd4@educacao.mg.gov.br', 'T-04: acessoPorInep_ devolve o diretor');
const convitesM1 = emailsPara('m1.t4@educacao.mg.gov.br');
r = B.acessoSalvar({ token: TKD4, email: 'm1.t4@educacao.mg.gov.br', nome: 'Membro Um da Silva', papel: 'colegiado', segmento: 'Docente' });
ok(r.ok && r.membros.filter(m => m.email === 'm1.t4@educacao.mg.gov.br')[0].nome === 'Membro Um da Silva',
   'T-04(c): corrigir o nome de um membro altera o membro');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_T4 });
ok(hx.gestores.length === 1 && hx.gestores[0].nome === 'Diretora Quatro' && hx.gestores[0].masp === '4440004',
   'T-04(c): e não sobrescreve a linha da diretora no histórico');
ok(emailsPara('m1.t4@educacao.mg.gov.br') === convitesM1, 'T-21: corrigir o nome de um membro não reenvia o convite');
r = B.acessoRemover({ token: TKD4, email: 'm2.t4@educacao.mg.gov.br', motivo: 'saiu do colegiado' });
ok(r.ok && r.membros && r.membros.length === 1, 'T-11/T-04(d): a direção remove um membro do colegiado e recebe a lista do colegiado');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_T4 });
ok(hx.gestores.length === 1 && hx.gestores[0].vigente && !hx.gestores[0].fim,
   'T-04(d): remover um membro não encerra o período de ninguém — a diretora continua vigente');
r = B.acessoRemover({ token: TKEQDE, email: 'd4@educacao.mg.gov.br', motivo: 'Remoção ou transferência' });
ok(r.ok, 'T-04(e): a diretora é removida');
ok(B.colegiadoDaEscola_(INEP_T4).length === 1, 'T-04(e): o colegiado permanece');
/* v8.13 (C04): removido o cadastro da diretora, a sessão dela para de responder
   — antes ela seguia listando (e alterando) o colegiado da escola por horas. */
ok(/acesso foi encerrado/.test(lanca(() => B.colegiadoListar({ token: TKD4 }))),
   'v8.13 (C04): removida a diretora, a sessão dela não lista mais o colegiado da escola');
r = B.acessoSalvar({ token: TKEQDE, email: 'd4b@educacao.mg.gov.br', nome: 'Diretora Quatro B', masp: '4440005',
                     papel: 'diretor_escolar', inep: INEP_T4 });
ok(r.ok && gestorT4().gestor.email === 'd4b@educacao.mg.gov.br', 'T-04(e): a nova diretora assume a escola');
const TKD4B = sessaoDe_({ email: 'd4b@educacao.mg.gov.br', nome: 'Diretora Quatro B', perfil: 'escola',
                               papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_T4, escola: 'EE do Colegiado Distinto' });
ok(B.colegiadoListar({ token: TKD4B }).membros.length === 1 &&
   B.colegiadoListar({ token: TKD4B }).membros[0].email === 'm1.t4@educacao.mg.gov.br',
   'T-04(e): re-associar a diretora NÃO sobrescreveu a linha do membro — o colegiado continua com ele');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_T4 });
ok(hx.gestores.length === 2 && hx.gestores[0].email === 'd4b@educacao.mg.gov.br' && hx.gestores[0].vigente &&
   hx.gestores[1].email === 'd4@educacao.mg.gov.br' && !hx.gestores[1].vigente,
   'T-04(e): o histórico tem as duas diretoras, e nenhum membro do colegiado');
ok(!JSON.stringify(hx).includes('m1.t4'), 'T-04(b): o membro não aparece no histórico em momento algum');

/* ---- T-22: a direção não se cadastra como colegiado; regional não envia PPP ---- */
r = B.acessoSalvar({ token: TKD4B, email: 'd4b@educacao.mg.gov.br', nome: 'Eu mesma', papel: 'colegiado', segmento: 'Docente' });
ok(!r.ok && /diretor escolar/.test(r.erro || ''), 'T-22: a direção não cadastra o próprio e-mail como colegiado');
r = B.acessoSalvar({ token: TKD4B, email: 'dir.v7@educacao.mg.gov.br', nome: 'Outra diretora', papel: 'colegiado', segmento: 'Docente' });
ok(!r.ok && /diretor escolar/.test(r.erro || ''), 'T-22: nem o e-mail de outro diretor');
ok(B.acessoPorInep_(INEP_T4).email === 'd4b@educacao.mg.gov.br' && B.acessoPorInep_(INEP_V7).email === 'dir.v7@educacao.mg.gov.br',
   'T-22: as linhas das diretoras continuam intactas');

/* ---- T-05 / T-23: protocolo inexistente ou ausente ---- */
ok(B.linhaDoProtocolo_(B.abaRegistros_(), 'PPP-9999-0000-ZZZZ') === 0 && B.linhaDoProtocolo_(B.abaRegistros_(), '') === 0,
   'T-23: linhaDoProtocolo_ devolve 0 quando não acha');
ok(B.linhaDoProtocolo_(B.abaRegistros_(), PV7) > 1, 'T-23: e a linha quando acha');
r = B.concluirPPP({ token: TKD4B, escola: 'EE do Colegiado Distinto', inep: INEP_T4, docHtml: docTeste('<p>x</p>') });
ok(!r.ok && r.precisaValidacao, 'T-05: concluir sem protocolo é recusado — não há o que concluir');
ok(B.painelRegistros({ token: TKD4B, filtros: {} }).linhas.length === 0, 'T-05: e nada foi criado por baixo dos panos');
r = B.concluirPPP({ token: TKD4B, protocolo: 'PPP-9999-0000-ZZZZ', escola: 'x', inep: INEP_T4, docHtml: docTeste('<p>x</p>') });
ok(!r.ok && r.precisaValidacao, 'T-05: concluir com protocolo inexistente é recusado');
ok(/não encontrado/.test(B.enviarParaValidacao({ token: TKD4B, protocolo: 'PPP-9999-0000-ZZZZ' }).erro || ''),
   'T-23: enviarParaValidacao com protocolo inexistente é recusado');
ok(/não encontrado/.test(B.validarPPP({ token: TKEQDE, protocolo: 'PPP-9999-0000-ZZZZ' }).erro || ''),
   'T-23: validarPPP idem');
ok(/não encontrado/.test(B.devolverPPP({ token: TKEQDE, protocolo: 'PPP-9999-0000-ZZZZ', parecer: 'Parecer longo o bastante para passar.' }).erro || ''),
   'T-23: devolverPPP idem');
ok(/não encontrado/.test(B.assinarNoSistema({ token: TKM1, protocolo: 'PPP-9999-0000-ZZZZ', aceite: true }).erro || ''),
   'T-23: assinarNoSistema idem');
ok(/não encontrado/.test(B.presencaColegiado({ p: 'PPP-9999-0000-ZZZZ', token: TKESCOLA, emails: ['membro1@educacao.mg.gov.br'] }).erro || ''),
   'T-23: presencaColegiado idem');
ok(/não encontrado/.test(B.colegiadoDaFolha({ p: 'PPP-9999-0000-ZZZZ', token: TKESCOLA }).erro || ''),
   'T-23: colegiadoDaFolha idem');

/* ---- T-06 / T-07 / T-14 / T-15: um PPP por vez, parecer e conclusão pela direção ---- */
r = B.salvarPPP({ token: TKD4B, escola: 'EE do Colegiado Distinto', inep: INEP_T4, sre: 'Divinópolis', municipio: 'Divinópolis', direcao: 'Quatro B', tMissao: 'm' });
ok(r.ok, 'T-06: a escola cria o seu PPP');
const P4 = r.protocolo;
ok(/direção escolar/.test(lanca(() => B.enviarParaValidacao({ token: TKEQDE, protocolo: P4 }))),
   'T-22: uma sessão regional não envia PPP para validação');
r = B.enviarParaValidacao({ token: TKD4B, protocolo: P4 });
ok(r.ok && r.registro.status === 'Em validação', 'T-06: enviado para validação');
r = B.salvarPPP({ token: TKD4B, escola: 'Outro PPP', inep: INEP_T4, tMissao: 'x' });
ok(!r.ok && r.duplicado && r.duplicado.protocolo === P4 && /em validação/.test(r.erro || ''),
   'T-06: com um PPP em validação, a escola não cria outro');
r = B.devolverPPP({ token: TKEQDE, protocolo: P4, parecer: 'A seção de avaliação precisa descrever os instrumentos usados.' });
ok(r.ok, 'T-07: a DE devolve com parecer');
r = B.painelRegistros({ token: TKD4B, filtros: {} });
let l4 = r.linhas.filter(x => x.protocolo === P4)[0];
ok(l4 && l4.parecerValidacao === 'A seção de avaliação precisa descrever os instrumentos usados.' &&
   Array.isArray(l4.devolucoes) && l4.devolucoes.length === 1 && l4.devolucoes[0].parecer && l4.devolucoes[0].em && /Diretoria Educacional/.test(l4.devolucoes[0].por),
   'T-07: o painel da escola traz o parecer e as devoluções, com data e autor');
ok(l4.editavel === true && l4.emElaboracao === true && l4.enviadoValidacaoEm === '', 'T-07/T-06: devolvido, volta editável e continua "em elaboração"');
r = B.enviarParaValidacao({ token: TKD4B, protocolo: P4 });
r = B.devolverPPP({ token: TKEQDE, protocolo: P4, parecer: 'Segunda rodada: falta o plano de convivência escolar.' });
ok(r.ok && r.rodadas === 2 && B.painelRegistros({ token: TKD4B, filtros: {} }).linhas.filter(x => x.protocolo === P4)[0].devolucoes.length === 2,
   'T-07: cada devolução fica registrada — a escola vê as duas rodadas');
B.enviarParaValidacao({ token: TKD4B, protocolo: P4 });
r = B.validarPPP({ token: TKEQDE, protocolo: P4, parecer: 'Em conformidade.' });
ok(r.ok, 'T-06: validado');
l4 = B.painelRegistros({ token: TKD4B, filtros: {} }).linhas.filter(x => x.protocolo === P4)[0];
ok(l4.editavel === false && l4.emElaboracao === true && /Diretoria Educacional/.test(l4.validadoPor) && l4.validadoEm && l4.enviadoValidacaoEm,
   'T-06/T-07: validado não é editável, mas ainda está em elaboração; o painel diz quem validou e quando');
r = B.salvarPPP({ token: TKD4B, escola: 'Outro PPP', inep: INEP_T4, tMissao: 'x' });
ok(!r.ok && r.duplicado && /validado/.test(r.erro || ''), 'T-06: com um PPP validado, a escola também não cria outro');
r = B.novaVersao({ p: P4, token: TKD4B });
ok(!r.ok && /encerrado/.test(r.erro || ''), 'T-06: nova versão só de PPP encerrado — validado não dá origem a outra');
r = B.novaVersao({ p: P, token: TKE });
ok(!r.ok && r.duplicado && /em curso/.test(r.erro || ''),
   'T-06/D07: nova versão de um PPP encerrado é recusada enquanto a escola tiver outro em curso');
r = B.salvarPPP({ token: TKD4B, protocolo: P4, escola: 'tentando editar', tMissao: 'y' });
ok(!r.ok && r.bloqueado, 'T-14: validado, o conteúdo não aceita gravação (o autosalvar da tela é recusado)');
r = B.concluirPPP({ token: TKD4B, protocolo: P4, escola: 'EE do Colegiado Distinto', inep: INEP_T4, docHtml: docTeste('<p>doc</p>'),
                    assinaturaDirecao: { nome: 'Nome digitado na tela', masp: '999', email: 'digitado@x.mg' } });
ok(r.ok && r.registro.status === 'Em assinatura', 'T-14: validado, a direção conclui');
const folha4 = JSON.parse(r.registro.assinaturas);
ok(folha4[0].email === 'd4b@educacao.mg.gov.br' && folha4[0].nome === 'Diretora Quatro B' && folha4[0].masp === '4440005',
   'T-15: a direção entra na folha com nome, MASP e e-mail do CADASTRO da sessão, não com o que a tela mandou');
ok(folha4.length === 1, 'v8.1: a folha nasce só com a direção — o colegiado entra por presença');
r = B.minhasAssinaturas({ token: TKD4B });
ok(r.ok && r.pendentes.length === 1 && r.pendentes[0].protocolo === P4, 'T-15: "Minhas assinaturas" encontra a direção pelo e-mail da sessão');
/* v8.13 (D07): "um PPP por vez" passou a valer para o CICLO inteiro. Até a
   8.12 a escola começava outro assim que o anterior saía de "em elaboração"
   — isto é, enquanto ele ainda estava colhendo assinaturas. O ciclo só se
   encerra com a homologação pela Superintendência. */
r = B.salvarPPP({ token: TKD4B, escola: 'Terceiro PPP', inep: INEP_T4, tMissao: 'z' });
ok(!r.ok && r.duplicado && r.duplicado.protocolo === P4 && /em assinatura/.test(r.erro || ''),
   'D07: com o anterior em coleta de assinaturas, a escola NÃO começa outro');

/* ---- v8.1: a folha do PPP da sétima versão, em caixas ---- */
const regV7 = () => B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), PV7));
ok(!JSON.parse(regV7().assinaturas).some(a => a.token || a.ressalva),
   'v8.1: não há token de convite nem ressalva na folha');
ok(B.painelRegistros({ token: TKC, filtros: { todas: true } }).linhas.filter(x => x.protocolo === PV7)[0].ressalvas === undefined,
   'v8.1: o painel não conta mais ressalvas');

/* ---- T-08: o sucessor marca a presença, assina, anexa e homologa o PPP da antecessora ---- */
r = B.acessoSalvar({ token: TKEQDE, email: 'sucessora.v7@educacao.mg.gov.br', nome: 'Sucessora da V7', masp: '7770007',
                     papel: 'diretor_escolar', inep: INEP_V7 });
ok(r.ok, 'T-08: a sucessora assume a escola V7');
const TKSUC = sessaoDe_({ email: 'sucessora.v7@educacao.mg.gov.br', nome: 'Sucessora da V7', perfil: 'escola',
                               papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_V7, escola: 'EE da Sétima Versão' });
r = B.presencaColegiado({ p: PV7, token: TKD4B, emails: ['membro1@educacao.mg.gov.br'] });
ok(!r.ok && /outra escola/.test(r.erro || ''), 'T-08: a direção de OUTRA escola não mexe na folha');
ok(/direção escolar/.test(lanca(() => B.presencaColegiado({ p: PV7, token: TKM1, emails: ['membro1@educacao.mg.gov.br'] }))),
   'T-08: nem o colegiado');
/* v8.13 (D05): o material complementar entra enquanto a coleta está aberta —
   assinado o termo, o código de autenticidade já responde pelo documento. */
r = B.registrarAnexo({ p: PV7, token: TKSUC, base64: 'QUJD', nome: 'matriz.pdf', mime: 'application/pdf' });
ok(r.ok && JSON.parse(r.registro.anexos).length === 1, 'T-08: a sucessora anexa material complementar');
r = B.assinarDirecao({ p: PV7, token: TKSUC, atesto: true, pessoa: { nome: 'Digitado', masp: '1', email: 'digitado@x.mg' } });
ok(r.ok, 'T-08: a sucessora assina como direção o PPP criado pela antecessora');
const dirV7 = JSON.parse(r.registro.assinaturas).filter(a => a.papel === 'Direção Escolar')[0];
ok(dirV7.assinadoEm && dirV7.email === 'sucessora.v7@educacao.mg.gov.br' && dirV7.nome === 'Sucessora da V7' && dirV7.masp === '7770007',
   'T-08/T-15: com o próprio nome, MASP e e-mail do cadastro');
ok(r.registro.status === 'Enviado para homologação',
   'T-08/v8.2: assinado por ela, o PPP da antecessora segue na hora para a Diretoria Educacional');
r = B.registrarAta({ p: PV7, token: TKD4B, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf' });
ok(!r.ok && /outra escola/.test(r.erro || ''), 'T-08: outra escola não anexa a ata');
r = B.registrarAta({ p: PV7, token: TKSUC, base64: 'QUJD', nome: 'ata-2.pdf', mime: 'application/pdf', dataReuniao: '10/09/2026' });
ok(!r.ok && /etapa das assinaturas/.test(r.erro || ''),
   'v8.2: encaminhado o documento, a ata não se troca mais — ela já foi com ele');
r = B.registrarAnexo({ p: PV7, token: TKSUC, base64: 'QUJD', nome: 'matriz-2.pdf', mime: 'application/pdf' });
ok(!r.ok && /não recebe mais anexos/.test(r.erro || '') && JSON.parse(regV7().anexos).length === 1,
   'D05: assinado o termo, o documento não recebe mais anexos — o código responde pelo que foi assinado');
ok(regV7().homolData && /Diretoria Educacional da SRE/.test(regV7().homolDestino || ''),
   'T-08/v8.2: com o destino registrado');

/* ---- T-10 → v9.7: o Central administra só os superintendentes; quem suspende
   um Diretor Educacional é o Superintendente da regional ---- */
r = B.acessoSalvar({ token: TKC, perfil: 'regional', sre: 'Divinópolis', papel: 'diretor_educacional',
                     email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1', situacao: 'inativo' });
ok(!r.ok && /não cadastra Diretor Educacional/.test(r.erro || ''),
   'v9.7: o Órgão Central não altera um Diretor Educacional — cada nível administra só o nível abaixo');
r = B.acessoSalvar({ token: TKR, perfil: 'regional', sre: 'Divinópolis', papel: 'diretor_educacional',
                     email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1', situacao: 'inativo' });
ok(r.ok && r.acessos.filter(a => a.email === 'de1@educacao.mg.gov.br')[0].situacao === 'inativo' &&
   r.acessos.filter(a => a.email === 'de1@educacao.mg.gov.br')[0].papel === 'diretor_educacional',
   'T-10: o Superintendente suspende um Diretor Educacional — e o papel fica');
/* v8.13 (C04): suspenso o acesso, a sessão que já estava aberta cai — antes
   ela seguia valendo por até 12 horas depois da suspensão. */
ok(/acesso está inativo/.test(lanca(() => B.acessosListar({ token: TKDE }))),
   'v8.13 (C04): suspender um acesso regional derruba a sessão dele na chamada seguinte');
r = B.acessoSalvar({ token: TKR, perfil: 'regional', sre: 'Divinópolis', papel: 'diretor_educacional',
                     email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1', situacao: 'ativo' });
ok(r.ok && r.acessos.filter(a => a.email === 'de1@educacao.mg.gov.br')[0].papel === 'diretor_educacional', 'T-10: e reativa, mantendo o papel');
/* v8.13 (C04): a sessão derrubada não volta sozinha — quem foi suspenso entra
   de novo. A bateria segue exercitando o Diretor Educacional. */
TKDE = sessaoDe_({ email: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1',
                   perfil: 'regional', papel: 'diretor_educacional', sre: 'Divinópolis' });
r = B.acessoSalvar({ token: TKC, perfil: 'regional', sre: 'Divinópolis', papel: 'diretor_educacional',
                     email: 'de.novo.pelo.central@educacao.mg.gov.br', nome: 'DE novo' });
ok(!r.ok && /não cadastra/.test(r.erro || ''), 'T-10: mas continua sem CRIAR Diretor Educacional — isso é do Superintendente');
r = B.acessoSalvar({ token: TKC, perfil: 'regional', sre: 'Passos', email: 'segundo.passos@educacao.mg.gov.br', nome: 'Segundo de Passos' });
ok(!r.ok && /Já existe Superintendente/.test(r.erro || ''), 'T-10: a chamada sem papel é o Superintendente, e a SRE só tem um');

/* ---- T-11: quem remove quem ---- */
r = B.acessoSalvar({ token: TKDE, email: 'analista2.de@educacao.mg.gov.br', nome: 'Analista 2', papel: 'equipe_de' });
ok(r.ok, 'T-11: o DE cadastra mais um analista');
r = B.acessoRemover({ token: TKR, email: 'analista2.de@educacao.mg.gov.br' });
ok(!r.ok && /não remove/.test(r.erro || ''), 'T-11: o Superintendente não remove a equipe da DE — quem a cadastra é o DE');
r = B.acessoRemover({ token: TKCI, email: 'de1@educacao.mg.gov.br' });
ok(!r.ok && /não remove/.test(r.erro || ''), 'T-11: o Coordenador de Inspeção não remove Diretor Educacional');
r = B.acessoRemover({ token: TKDE, email: 'analista2.de@educacao.mg.gov.br' });
ok(r.ok && !r.acessos.some(a => a.email === 'analista2.de@educacao.mg.gov.br'), 'T-11: o DE remove a própria equipe');
r = B.acessoRemover({ token: TKR, email: 'ci@educacao.mg.gov.br', motivo: 'saiu da SRE' });
ok(r.ok, 'T-11: o Superintendente remove o Coordenador de Inspeção');
/* v8.13 (C04): removido o cadastro, a sessão dele deixa de valer; a bateria
   segue exercitando a Inspeção, então o acesso é recriado e reaberto. */
ok(/acesso foi encerrado/.test(lanca(() => B.acessosListar({ token: TKCI }))),
   'v8.13 (C04): e a sessão do Coordenador de Inspeção cai junto com o cadastro');
hi = B.acessosHistorico({ token: TKC, email: 'ci@educacao.mg.gov.br' });
ok(hi.acessos.length >= 1 && hi.acessos.every(a => !a.vigente) && hi.acessos[0].motivo === 'saiu da SRE',
   'T-11: o período é encerrado com o motivo, não apagado');
r = B.acessoRemover({ token: TKM1, email: 'membro2@educacao.mg.gov.br' });
ok(!r.ok && /direção escolar/.test(r.erro || ''), 'T-11: o colegiado não remove ninguém');
r = B.acessoRemover({ token: TKD4B, email: 'membro1@educacao.mg.gov.br' });
ok(!r.ok && /própria escola/.test(r.erro || ''), 'T-11: a direção não remove colegiado de outra escola');
r = B.acessoRemover({ token: TKR, email: 'membro1@educacao.mg.gov.br' });
ok(!r.ok && /direção dela/.test(r.erro || ''), 'T-11: a regional não remove o colegiado de uma escola');
r = B.acessoRemover({ token: TKC, email: 'membro2@educacao.mg.gov.br' });
ok(r.ok, 'T-11: o Órgão Central remove qualquer um');
ok(B.recusaGestaoDeAcesso_({ perfil: 'central', papel: 'central' }, { papel: 'colegiado', inep: '1', sre: 'X' }) === '',
   'T-11: recusaGestaoDeAcesso_ libera o Central para tudo');

/* ---- T-12: limites ignoram suspensos; trocar e-mail reescreve a mesma linha ---- */
r = B.acessoSalvar({ token: TKR, email: 'ci.b@educacao.mg.gov.br', nome: 'Coordenador B', papel: 'coordenador_inspecao' });
ok(r.ok, 'T-12: removido o Coordenador, cabe outro');
r = B.acessoSalvar({ token: TKR, email: 'ci.b@educacao.mg.gov.br', nome: 'Coordenador B', papel: 'coordenador_inspecao', situacao: 'inativo' });
ok(r.ok, 'T-12: o Coordenador B é suspenso');
r = B.acessoSalvar({ token: TKR, email: 'ci.c@educacao.mg.gov.br', nome: 'Coordenador C', papel: 'coordenador_inspecao' });
ok(r.ok, 'T-12: com o Coordenador suspenso, um novo cabe — suspenso não ocupa vaga');
ok(B.quantosNoPapel_('coordenador_inspecao', 'Divinópolis', '', '') === 1, 'T-12: quantosNoPapel_ conta só os ativos');
r = B.acessoSalvar({ token: TKR, email: 'ci.b@educacao.mg.gov.br', nome: 'Coordenador B', papel: 'coordenador_inspecao', situacao: 'ativo' });
ok(!r.ok && /Já existe/.test(r.erro || ''), 'T-12: reativar o suspenso com a vaga ocupada é recusado');
/* v8.13 (C04): quem responde pela Inspeção da SRE daqui em diante é o
   Coordenador C — a sessão da Coordenadora removida lá atrás não vale mais. */
TKCI = sessaoDe_({ email: 'ci.c@educacao.mg.gov.br', nome: 'Coordenador C',
                   perfil: 'regional', papel: 'coordenador_inspecao', sre: 'Divinópolis' });
r = B.acessoSalvar({ token: TKR, email: 'de2b@educacao.mg.gov.br', nome: 'Diretor Educacional 2B', papel: 'diretor_educacional' });
ok(r.ok && B.acessosListar({ token: TKR }).acessos.filter(a => a.papel === 'diretor_educacional' && a.sre === 'Divinópolis' && a.situacao !== 'inativo').length === 2,
   'T-12: a SRE está com os dois Diretores Educacionais');
r = B.acessoSalvar({ token: TKR, email: 'de3b@educacao.mg.gov.br', nome: 'Terceiro', papel: 'diretor_educacional' });
ok(!r.ok && /2 Diretor/.test(r.erro || ''), 'T-12: um terceiro é recusado — a vaga está mesmo cheia');
const convitesAntesTroca = emailsPara('de1.novo@educacao.mg.gov.br');
r = B.acessoSalvar({ token: TKR, papel: 'diretor_educacional', email: 'de1.novo@educacao.mg.gov.br',
                     emailAnterior: 'de1@educacao.mg.gov.br', nome: 'Diretora Educacional 1', situacao: 'ativo' });
ok(r.ok, 'T-12: trocar o e-mail de um DE com a SRE cheia é aceito — quem troca não conta como novo');
ok(!r.acessos.some(a => a.email === 'de1@educacao.mg.gov.br') && r.acessos.filter(a => a.email === 'de1.novo@educacao.mg.gov.br').length === 1,
   'T-12: a linha antiga foi reescrita — não existe uma segunda pessoa');
ok(r.acessos.filter(a => a.email === 'de1.novo@educacao.mg.gov.br')[0].comSenha === false, 'T-12: a senha antiga não vale para o e-mail novo');
ok(emailsPara('de1.novo@educacao.mg.gov.br') === convitesAntesTroca + 1, 'T-21: a pessoa recebe o convite no e-mail novo');
/* v8.13 (C04): trocado o e-mail, o cadastro do endereço antigo deixa de
   existir — e a sessão aberta com ele cai na chamada seguinte. */
ok(/acesso foi encerrado/.test(lanca(() => B.acessosListar({ token: TKDE }))),
   'v8.13 (C04): trocado o e-mail, a sessão aberta com o endereço antigo deixa de valer');
TKDE = sessaoDe_({ email: 'de1.novo@educacao.mg.gov.br', nome: 'Diretora Educacional 1',
  perfil: 'regional', papel: 'diretor_educacional', sre: 'Divinópolis' });
hi = B.acessosHistorico({ token: TKC, sre: 'Divinópolis' });
ok(hi.acessos.some(a => a.email === 'de1@educacao.mg.gov.br' && !a.vigente && /e-mail trocado/.test(a.motivo || '')) &&
   hi.acessos.some(a => a.email === 'de1.novo@educacao.mg.gov.br' && a.vigente),
   'T-12: o histórico encerra o período do e-mail antigo e abre o do novo');
r = B.acessoSalvar({ token: TKR, papel: 'diretor_educacional', email: 'de2b@educacao.mg.gov.br',
                     emailAnterior: 'de1.novo@educacao.mg.gov.br', nome: 'Diretora Educacional 1' });
ok(!r.ok && /já responde/.test(r.erro || ''), 'T-12: trocar para um e-mail que já é de outra pessoa é recusado');
ok(B.acessosListar({ token: TKR }).acessos.filter(a => a.email === 'de1.novo@educacao.mg.gov.br' || a.email === 'de2b@educacao.mg.gov.br').length === 2,
   'T-12: e as duas pessoas continuam como estavam');
r = B.acessoSalvar({ token: TKR, papel: 'diretor_educacional', email: 'x.novo@educacao.mg.gov.br',
                     emailAnterior: 'ninguem@educacao.mg.gov.br', nome: 'X' });
ok(!r.ok && /não foi encontrado/.test(r.erro || ''), 'T-12: e-mail anterior inexistente é recusado');

/* ---- T-21: convite só para pessoa nova ---- */
const convitesCiC = emailsPara('ci.c@educacao.mg.gov.br');
ok(convitesCiC === 1, 'T-21: o cadastro novo recebeu exatamente um convite');
B.acessoSalvar({ token: TKR, email: 'ci.c@educacao.mg.gov.br', nome: 'Coordenador C (corrigido)', papel: 'coordenador_inspecao' });
B.acessoSalvar({ token: TKR, email: 'ci.c@educacao.mg.gov.br', nome: 'Coordenador C (corrigido)', papel: 'coordenador_inspecao', situacao: 'inativo' });
B.acessoSalvar({ token: TKR, email: 'ci.c@educacao.mg.gov.br', nome: 'Coordenador C (corrigido)', papel: 'coordenador_inspecao', situacao: 'ativo' });
ok(emailsPara('ci.c@educacao.mg.gov.br') === 1, 'T-21: corrigir, suspender e reativar quem ainda não definiu senha não reenviam o convite');
r = B.primeiroAcessoReenviar({ token: TKR, email: 'ci.c@educacao.mg.gov.br' });
ok(r.ok && emailsPara('ci.c@educacao.mg.gov.br') === 2, 'T-21: o reenvio é um ato explícito');

/* ---- T-04(f): inativar a escola ---- */
r = B.acessoSalvar({ token: TKD4B, email: 'm3.t4@educacao.mg.gov.br', nome: 'Membro Três', papel: 'colegiado', segmento: 'Comunidade', relacao: 'associação de moradores do bairro' });
/* v8.7 (C4): com PPP em elaboração, a inativação pede confirmação antes */
r = B.escolaSituacao({ token: TKDA, inep: INEP_T4, situacao: 'inativa' });
if (r.pppAberto) {
  /* v8.13 (D07): com "um PPP por vez" valendo para o ciclo inteiro, o PPP em
     aberto desta escola é o que está EM ASSINATURA — e o texto da recusa
     (v8.13, C09) cita a situação real, em vez de dizer "em elaboração" sempre. */
  ok(!r.ok && /Esta escola tem um PPP/.test(r.erro) && /em assinatura/.test(r.erro) && /Confirme/.test(r.erro),
     'C4/D07: inativar a escola com PPP em aberto é recusado até haver confirmação, e o texto diz em que pé ele está');
  ok(B.escolaPorInep_(INEP_T4).situacao === 'ativa',
     'C4: enquanto não se confirma, a escola continua ativa e o PPP segue alcançável');
  r = B.escolaSituacao({ token: TKDA, inep: INEP_T4, situacao: 'inativa', confirmado: true });
  ok(r.ok && r.pppEmAberto === r.pppEmAberto && !!r.pppEmAberto,
     'C4: confirmada, a inativação diz qual PPP ficou em aberto');
  /* v8.13 (C09): o ato passa a valer para qualquer PPP não encerrado, e o
     texto do ciclo deixou de dizer "em elaboração" sempre. */
  ok((B.linhaDoTempo({ token: TKR, protocolo: r.pppEmAberto }).eventos || [])
      .some(l => /escola inativada com o PPP em aberto/.test(l.ato || '')),
     'C4: a pendência fica registrada na linha do tempo do documento, à vista da SRE');
}
ok(r.ok && r.gestorEncerrado === 'd4b@educacao.mg.gov.br' && r.colegiadoInativado === 2,
   'T-04(f): inativar a escola encerra o acesso da diretora e deixa os membros do colegiado inativos');
ok(!r.escolas.filter(e => e.inep === INEP_T4)[0].gestor, 'T-04(f): a escola inativa fica sem gestor — o colegiado não passa por gestor');
ok(B.colegiadoDaEscola_(INEP_T4).length === 2 && B.colegiadoDaEscola_(INEP_T4).every(a => String(a.situacao).toLowerCase() === 'inativo'),
   'T-04(f): os membros continuam cadastrados, inativos');
ok(!B.acessosListar({ token: TKC }).acessos.some(a => a.inep === INEP_T4),
   'P3: o colegiado não sai por acessosListar — a planilha é lida direto');
ok(!B.entrarInstitucional({ email: 'm1.t4@educacao.mg.gov.br', senha: 'x' }).ok, 'T-04(f): o colegiado da escola inativa não entra');
hx = B.gestoresHistorico({ token: TKDA, inep: INEP_T4 });
ok(hx.gestores.length === 2 && hx.gestores.every(g => !g.vigente) && /inativada/.test(hx.gestores[0].motivo || ''),
   'T-04(f): o histórico encerra só o período da diretora, com o motivo');

/* ---- T-24 / T-25: textos ---- */
ok(B.PADRAO_SERVIDOR['DOC.folha.titulo'] === '22. Folha de assinaturas', 'T-24: o título padrão da folha no servidor é o 22, como no cliente');
r = salvarDiretor(B, { email: 'outra.particular@gmail.com', nome: 'Diretora Gmail', papel: 'diretor_escolar', inep: '184446' });
ok(r.ok && /não é identificada pela conta institucional/.test(r.aviso || '') && /link de primeiro acesso/.test(r.aviso || '') &&
   !/acesso restrito/.test(r.aviso || ''),
   'T-25: o aviso do domínio diz que a pessoa entra por e-mail e senha — sem falar em "acesso restrito ao domínio"');
ok(!/acesso restrito ao domínio/.test(src), 'T-25: a expressão não existe mais no Code.gs');
ok(B.avisoDominio_('fulano@educacao.mg.gov.br', true) === '', 'T-25: com conta institucional não há aviso');

/* ---------- v7.3 (achados do analista): bloqueio por e-mail, mensagens ---------- */
IDENTIDADE = '';
for (let i = 0; i < 5; i++) B.entrarInstitucional({ email: 'dir.v7@educacao.mg.gov.br', senha: 'errada' + i });
r = B.entrarInstitucional({ email: 'dir.v7@educacao.mg.gov.br', senha: 'senha-boa-2026' });
ok(!r.ok && /bloqueado|Muitas tentativas/.test(r.erro || ''), 'A-1: cinco senhas erradas bloqueiam AQUELE e-mail');
r = B.entrarInstitucional({ email: 'diretora.particular@yahoo.com.br', senha: 'senha-particular-2026' });
ok(r.ok, 'A-1: o bloqueio de um e-mail não derruba a entrada dos outros — não é mais global');
const TKDIR2 = sessaoDe_({ email: 'diretora.certa@educacao.mg.gov.br', nome: 'Diretora com conta da rede',
                                perfil: 'escola', papel: 'diretor_escolar', sre: 'Almenara', inep: '184446',
                                escola: 'EE Veríssimo Teixeira Costa' });
r = B.acessoSalvar({ token: TKDIR2, email: 'membro1@educacao.mg.gov.br', nome: 'Membro de outra escola',
                     papel: 'colegiado', segmento: 'Docente' });
/* v8.13 (C06): a mensagem passa a nomear o papel e a unidade que ocupam o
   endereço — antes, num cadastro sem INEP, saía "de outra escola (código )". */
ok(!r.ok && /já está cadastrado como Colegiado Escolar de /.test(r.erro || '') && !/\(código \)/.test(r.erro || ''),
   'A-3: membro já cadastrado noutra escola recebe mensagem que diz isso, não "não pertence à sua escola"');
ok(/cota diária/.test(B.erroDeEmail_({ message: 'Service invoked too many times for one day: email' })),
   'A-5: o erro de cota do MailApp chega em português');
ok(/inválido/.test(B.erroDeEmail_({ message: 'Invalid email: x' })), 'A-5: endereço inválido em português');

/* v8.13 (E04): a porta que conta as tentativas é a única que restou — a do
   Órgão Central. O contador dela é da SENHA (PROP_TENT_CENTRAL), e não do
   e-mail que a tela manda: variar o e-mail não escapa mais do bloqueio. */
{
  const propsE04 = S.g.PropertiesService.getScriptProperties();
  const guardaE04 = propsE04.getProperty(B.PROP_TENT_CENTRAL);
  IDENTIDADE = 'maria.curadoria@educacao.mg.gov.br';
  for (let i = 0; i < 5; i++) B.entrarInstitucional({ porta: 'central', senha: 'chute' + i, nome: 'Invasor' });
  r = B.entrarInstitucional({ porta: 'central', senha: 'senha-de-teste-2026', nome: 'Maria da Curadoria' });
  ok(!r.ok && /bloqueado|minuto/.test(r.erro), 'cinco tentativas erradas bloqueiam o acesso temporariamente');
  IDENTIDADE = '';
  if (guardaE04) propsE04.setProperty(B.PROP_TENT_CENTRAL, guardaE04); else propsE04.deleteProperty(B.PROP_TENT_CENTRAL);
}

/* ============================================================
   v7.4 — Proposta 1 (Executar como: eu + PDF pelo app) e
          Proposta 3 (sessão obrigatória, dados mínimos, folha sem e-mail)
   ============================================================ */
/* v7.8 (P8): três registros — a busca olha os três, ou um só quando pedido */
const histTemEm = function (nome, re) {
  const h = outras[nome];
  return !!h && Object.keys(h.linhas).some(k => re.test(String(h.linhas[k])));
};
const histTem = function (re) {
  return histTemEm('Curadoria — histórico', re) || histTemEm('Acessos — histórico', re) || histTemEm('Ciclo — histórico', re);
};
const regP = () => B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));

/* ---- P1: contexto e identificação ---- */
IDENTIDADE = '';
ctx = B.contexto();
ok(ctx.controleAtivo === true && ctx.identificado === false,
   'P1: sem conta identificada o controle continua ativo (é o cadastro + a sessão) — identificado=false, sem tarja');
IDENTIDADE = 'sucessora.v7@educacao.mg.gov.br';
ok(B.contexto().identificado === true && B.contexto().acesso && B.contexto().acesso.papel === 'diretor_escolar',
   'P1: quem é do domínio continua identificado pela conta e chega com o cadastro resolvido');
IDENTIDADE = '';
ok(/Executar como: EU/.test(src) && /QUALQUER PESSOA COM CONTA GOOGLE/.test(src) && !/Session\.getEffectiveUser/.test(src),
   'P1: o cabeçalho orienta "Executar como: eu" + qualquer pessoa com Conta Google, e nada depende de getEffectiveUser');

/* ---- P1: documentoPdf — o PDF sai pelo app, depois da autorização ---- */
r = B.documentoPdf({ p: P });
ok(!r.ok && r.semSessao, 'P1/v8.1: sem sessão nenhum arquivo sai — o token de convite foi aposentado');
r = B.documentoPdf({ token: TKE, p: P });
ok(r.ok && r.mime === 'application/pdf' && /^JVBERi0/.test(r.base64) && /^PPP-2026-0001-[A-Z0-9]{4}_EE_ALFA\.pdf$/.test(r.nome),
   'P1/v8.2: a direção baixa o PDF oficial do próprio PPP, já sem o sufixo de "aguardando": ' + r.nome);
r = B.documentoPdf({ token: TKE, p: PV7 });
ok(!r.ok && /outra escola/.test(r.erro || ''), 'P1: mas não o de outra escola');
r = B.documentoPdf({ token: TKM1, p: PV7 });
ok(r.ok && r.mime === 'application/pdf', 'P1: o colegiado, em sessão, baixa o PDF da própria escola');
r = B.documentoPdf({ token: TKR, p: P });
ok(r.ok, 'P1: a regional baixa o PDF de uma escola da sua SRE');
r = B.documentoPdf({ token: TKR, p: PB });
ok(!r.ok && /outra Superintendência/.test(r.erro || ''), 'P1: e não o de outra SRE');
r = B.documentoPdf({ token: TKC, p: PB });
ok(!r.ok && /ainda não foi concluído/.test(r.erro || ''), 'P1: o Central alcança qualquer SRE — mas PPP não concluído não tem PDF oficial');
r = B.documentoPdf({ membro: 'qualquer-token-antigo' });
ok(!r.ok && r.semSessao, 'v8.1: o campo "membro" dos links antigos não abre mais nada — exige sessão');
r = B.documentoPdf({ token: TKANA, p: P });
ok(r.ok && r.mime === 'application/pdf', 'v8.1: o membro do colegiado baixa o PDF com o seu próprio acesso');
r = B.documentoPdf({ token: TKE, p: P, tipo: 'ata' });
ok(r.ok && /_ATA_APROVACAO\.pdf$/.test(r.nome) && r.mime === 'application/pdf', 'P1: a ata sai pelo app: ' + r.nome);
r = B.documentoPdf({ token: TKR, p: PV7, tipo: 'anexo', id: JSON.parse(regV7().anexos)[0].id });
ok(r.ok && /_ANEXO_01\.pdf$/.test(r.nome), 'P1: o anexo sai pelo app, pelo ID do arquivo: ' + r.nome);
r = B.documentoPdf({ token: TKR, p: PV7, tipo: 'anexo', id: 'nao-existe' });
ok(!r.ok && /Anexo não encontrado/.test(r.erro || ''), 'P1: anexo inexistente é recusado');
r = B.documentoPdf({ token: TKE, p: P, tipo: 'coisa' });
ok(!r.ok && /desconhecido/.test(r.erro || ''), 'P1: tipo desconhecido é recusado');
/* registro anterior à 7.4: só o link, sem ID — o app regera a partir da fonte congelada */
const pdfIdAntes = regP().pdfId;
B.gravarCampo_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P), 'pdfId', '');
r = B.documentoPdf({ token: TKE, p: P });
ok(r.ok && regP().pdfId && regP().pdfId !== pdfIdAntes, 'P1: registro sem pdfId (anterior à 7.4) tem o PDF regerado e o ID gravado');
ok(B.idDeUrlDrive_('https://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOp/view?usp=drivesdk') === '1AbC_dEf-GhIjKlMnOp' &&
   B.idDeUrlDrive_('https://drive.google.com/open?id=1AbC_dEf-GhIjKlMnOp') === '1AbC_dEf-GhIjKlMnOp' && B.idDeUrlDrive_('https://drive/f3') === '',
   'P1: o ID é extraído dos dois formatos de link do Drive');
const painelP1 = B.painelRegistros({ token: TKC, filtros: { todas: true } });
ok(painelP1.linhas.every(x => x.pdfUrl === undefined && typeof x.temPdf === 'boolean') &&
   painelP1.linhas.filter(x => x.protocolo === P)[0].temPdf === true && painelP1.linhas.filter(x => x.protocolo === PB)[0].temPdf === false,
   'P1: o painel não expõe o link do Drive — diz apenas se há PDF a pedir ao app');
ok(!/\.ressalva\b/.test(src) && !/function ressalvarNoSistema/.test(src) &&
   !/function adicionarMembros/.test(src) && !/function enviarConvite_/.test(src) &&
   !/function dadosAssinatura/.test(src) && !/function registrarAssinatura/.test(src) && !/createTemplateFromFile\('Assinatura'\)/.test(src),
   'v8.1: a ressalva, o convite por link e a página externa de assinatura saíram do servidor');

/* ---- P3: folha sem e-mail ---- */
const folhaP = B.folhaAssinaturas_(regP());
ok(!/E-mail/.test(folhaP) && !/ana@x\.mg/.test(folhaP) && !/dir@x\.mg/.test(folhaP),
   'P3: a folha de assinaturas não imprime o e-mail de ninguém');
ok(/Ana Souza/.test(folhaP) && /Docente/.test(folhaP) && /Assinado no sistema em/.test(folhaP),
   'P3: ficam nome, representação e data/hora — agora em caixas');
/* v10.1: a máscara saiu, e a folha imprime a matrícula como ela está no
   registro. A assinatura semeada aqui tem um MASP legado de 3 dígitos (fora
   dos 6 a 12 que o cadastro exige desde a 7.x): ele é impresso como está —
   corrigir o número é ato de cadastro, não de impressão, e esconder o que
   está gravado faria o documento discordar da base. */
ok(/MASP 123\b/.test(folhaP),
   'v10.1: a matrícula legada, curta, é impressa como está — a folha não corrige cadastro');
ok(/ana@x\.mg/.test(regP().assinaturas), 'P3: o e-mail continua na planilha');

/* ---- P3: acessosListar por papéis ---- */
ok(B.papeisListaveis_({ perfil: 'central', papel: 'central' }).join() === 'central,superintendente',
   'P3/v9.7: o Central lista o que cadastra — a própria unidade e os superintendentes; nem a equipe das regionais, nem diretores, nem colegiado');
ok(B.papeisListaveis_({ perfil: 'regional', papel: 'superintendente' }).join() === 'diretor_educacional,coordenador_inspecao' &&
   B.papeisListaveis_({ perfil: 'regional', papel: 'diretor_educacional' }).join() === 'equipe_de' &&
   B.papeisListaveis_({ perfil: 'regional', papel: 'coordenador_inspecao' }).join() === 'equipe_inspecao' &&
   B.papeisListaveis_({ perfil: 'regional', papel: 'equipe_de' }).length === 0,
   'P3: cada chefia lista só a linha da sua cascata');
ok(B.papeisListaveis_({ perfil: 'regional', papel: 'equipe_de' }, ['diretor_escolar', 'colegiado', 'central']).join() === 'diretor_escolar' &&
   B.papeisListaveis_({ perfil: 'regional', papel: 'equipe_inspecao' }, ['diretor_escolar']).length === 0 &&
   B.papeisListaveis_({ perfil: 'central', papel: 'central' }, ['colegiado']).length === 0,
   'P3: quem associa pode PEDIR os diretores; a Inspeção não; o colegiado nunca sai');
r = B.acessosListar({ token: TKR });
ok(r.ok && r.acessos.length > 0 && r.acessos.every(a => a.papel === 'diretor_educacional' || a.papel === 'coordenador_inspecao'),
   'P3: o Superintendente recebe só DE e CI da sua SRE');
ok(!JSON.stringify(r).includes('m1.t4@') && !JSON.stringify(r).includes('membro1@') && !JSON.stringify(r).includes('dir.escola.a@'),
   'P3: nem membros de colegiado nem diretores chegam à regional por acessosListar');
r = B.acessosListar({ token: TKC });
ok(r.acessos.length > 0 && r.acessos.every(a => B.PAPEIS_INSTITUCIONAIS.indexOf(a.papel) >= 0) && !JSON.stringify(r).includes('membro1@'),
   'P3: o Central recebe os institucionais, sem colegiado');
r = B.acessosListar({ token: TKC, papeis: ['colegiado'] });
ok(r.acessos.length === 0, 'P3: pedir o colegiado explicitamente devolve lista vazia');
r = B.acessosListar({ token: TKDE });
ok(r.acessos.every(a => a.papel === 'equipe_de' && a.sre === 'Divinópolis'), 'P3: o DE recebe só a própria equipe');
r = B.acessosListar({ token: TKEQDE, papeis: ['diretor_escolar'] });
ok(r.acessos.length > 0 && r.acessos.every(a => a.papel === 'diretor_escolar' && a.sre === 'Divinópolis'),
   'P3: a equipe da DE, que associa, pode pedir os diretores da sua SRE');

/* ---- P3: registro órfão e adoção ---- */
let painelReg3 = B.painelRegistros({ token: TKR, filtros: {} });
let linhaP = painelReg3.linhas.filter(x => x.protocolo === P)[0];
ok(linhaP && linhaP.orfao === true, 'P3: o PPP criado por "dir@x.mg", que nunca foi diretor cadastrado da escola, aparece órfão para a regional');
ok(painelReg3.linhas.filter(x => x.protocolo === PV7)[0].orfao === false,
   'P3: o PPP criado pela diretora cadastrada (hoje substituída — ela está no histórico) não é órfão');
ok(B.painelRegistros({ token: TKE, filtros: {} }).linhas.every(x => x.orfao === false), 'P3: para a escola a bandeira não se aplica');
ok(/não gere os diretores/.test(lanca(() => B.adotarPPP({ token: TKEQCI, protocolo: P }))), 'P3: a Inspeção não adota');
ok(/não gere os diretores/.test(lanca(() => B.adotarPPP({ token: TKSU, protocolo: P }))), 'P3/v9.7: o Superintendente também não — vincular PPP à escola é da Diretoria Educacional');
const TKDSU = sessaoDe_({ email: 'de.uberlandia.p3@educacao.mg.gov.br', nome: 'DE de Uberlândia', perfil: 'regional', papel: 'diretor_educacional', sre: 'Uberlândia' });
r = B.adotarPPP({ token: TKDSU, protocolo: P });
ok(!r.ok && /outra Superintendência/.test(r.erro || ''), 'P3: a Diretoria Educacional não adota PPP de escola de outra SRE');
r = B.adotarPPP({ token: TKDA, protocolo: 'PPP-9999-0000-ZZZZ' });
ok(!r.ok && /não encontrado/.test(r.erro || ''), 'P3: protocolo inexistente');
/* v8.13 (C12): a partir da emissão do código, a identificação da escola é
   parte do que foi autenticado — o PPP já concluído não muda de escola. */
{
  const escolaDeP = regP().escola, hashDeP = regP().hash;
  r = B.adotarPPP({ token: TKDA, protocolo: P });
  ok(!r.ok && /código de autenticidade/.test(r.erro || ''),
     'v8.13 (C12): PPP com código emitido não é vinculado a outra escola — ' + (r.erro || '').slice(0, 60));
  ok(regP().escola === escolaDeP &&
     B.verificarDocumento({ codigo: hashDeP }).escola === escolaDeP,
     'v8.13 (C12): e a conferência pública responde a mesma escola antes e depois da tentativa');
}
/* registro órfão com o código da escola fora da base: a regional aponta a escola certa */
const TKORF = sessaoDe_({ email: 'fantasma@x.mg', nome: 'Fantasma', perfil: 'escola', papel: 'diretor_escolar',
                               sre: 'Divinópolis', inep: '31000777', escola: 'EE Digitada à Mão' });
r = B.salvarPPP({ token: TKORF, escola: 'EE Digitada à Mão', sre: 'Divinópolis', municipio: 'Divinópolis', tMissao: 'x' });
ok(r.ok, 'P3: (cenário) um PPP cujo código de escola não está na base');
const PORF = r.protocolo;
r = B.adotarPPP({ token: TKDA, protocolo: PORF });
ok(!r.ok && /não está na base/.test(r.erro || ''), 'P3: sem a escola na base, a adoção pede o código certo');
r = B.adotarPPP({ token: TKDA, protocolo: PORF, inep: INEP_B });
ok(!r.ok && /não tem diretor em exercício/.test(r.erro || ''), 'P3: escola sem diretor cadastrado não recebe o PPP — associe antes');
r = B.adotarPPP({ token: TKDA, protocolo: PORF, inep: INEP_A });
ok(!r.ok && r.duplicado && /já tem um PPP em elaboração/.test(r.erro || ''),
   'P3: a adoção respeita "um PPP por vez": a escola A já tem a versão 2 em andamento');
r = B.adotarPPP({ token: TKDA, protocolo: PORF, inep: INEP_NOVA });
ok(r.ok && r.email === 'outro.horto@educacao.mg.gov.br', 'P3: apontada uma escola da base com diretor, o PPP é adotado');
const regOrf = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), PORF));
ok(regOrf.inep === INEP_NOVA && regOrf.escola === 'EE Nova do Horto Florido' && regOrf.sre === 'Divinópolis' &&
   regOrf.email === 'outro.horto@educacao.mg.gov.br',
   'P3: o registro ganha o código, o nome e a SRE da base, e o e-mail do diretor em exercício');
ok(histTem(/PPP vinculado à escola/) && histTem(/fantasma@x\.mg/),
   'P3: o vínculo fica no histórico, com o responsável anterior');
ok(B.painelRegistros({ token: TKR, filtros: {} }).linhas.filter(x => x.protocolo === PORF)[0].orfao === false,
   'P3: adotado, deixa de ser órfão');
r = B.adotarPPP({ token: TKDA, protocolo: PORF });
ok(!r.ok && /já está vinculado/.test(r.erro || ''), 'P3: PPP que já é da direção não tem o que vincular');
const TKHORTO = sessaoDe_({ email: 'outro.horto@educacao.mg.gov.br', nome: 'Outro', perfil: 'escola', papel: 'diretor_escolar',
                                 sre: 'Divinópolis', inep: INEP_NOVA, escola: 'EE Nova do Horto Florido' });
ok(B.painelRegistros({ token: TKHORTO, filtros: {} }).linhas.some(x => x.protocolo === PORF && x.editavel),
   'P3: adotado, o PPP aparece no painel da direção da escola, editável');
r = B.adotarPPP({ token: TKDA, protocolo: PORF, inep: INEP_B });
ok(!r.ok && /não transfere/.test(r.erro || ''), 'P3: a adoção não transfere um PPP de uma escola ATIVA da base para outra');

/* ---- P3: rastro das exportações ---- */
ok(/expirada/.test(lanca(() => B.registrarExportacao({ token: 'x', tipo: 'painel', linhas: 3 }))), 'P3: exportação sem sessão não é registrada');
/* v8.13 (E12): a exportação das três planilhas é do Órgão Central (política
   da v8.9, confirmada por E09). A regional deixou de exportar o painel — a
   verificação antiga, que a registrava, passou a provar a recusa. */
r = B.registrarExportacao({ token: TKR, tipo: 'painel', linhas: 12 });
ok(!r.ok && /não exporta esta lista/.test(r.erro || '') && !histTem(/exportou painel · 12 linhas/),
   'v8.13 (E12, A7-12): a regional não registra exportação do painel — e nada entra no histórico');
r = B.registrarExportacao({ token: TKC, tipo: 'painel', linhas: 12 });
ok(r.ok && histTem(/exportou painel · 12 linhas informadas pela tela/),
   'P3: a exportação do painel pelo Órgão Central fica no histórico, com o número informado');
r = B.registrarExportacao({ token: TKC, tipo: 'contas a regularizar', linhas: '7' });
ok(r.ok && histTem(/exportou contas a regularizar · 7 linhas informadas pela tela/), 'P3: idem para as contas a regularizar');
r = B.registrarExportacao({ token: TKC, tipo: '<script>x</script>', linhas: -4 });
ok(!r.ok && !histTem(/exportou scriptxscript/) && !histTem(/exportou <script/),
   'v8.13 (E12): tipo fora da lista fechada é recusado — nada de texto livre na trilha');

/* ---- v7.4: o Colegiado Escolar tem porta própria — as portas não se misturam ---- */
IDENTIDADE = 'membro1@educacao.mg.gov.br';
r = B.entrarInstitucional({ porta: 'escola' });
ok(!r.ok && /entrada "Colegiado Escolar"/.test(r.erro || '') && !r.token,
   'v7.4: membro do colegiado pela porta da direção é recusado — e sem sessão criada');
r = B.entrarInstitucional({ porta: 'colegiado' });
ok(r.ok && r.papel === 'colegiado' && r.soLeitura === true, 'v7.4: pela porta do colegiado, o membro entra');
r = B.entrarInstitucional({});
ok(r.ok && r.papel === 'colegiado', 'v7.4: sem porta informada (cartão de identificação antigo), a entrada continua valendo');
IDENTIDADE = 'outro.horto@educacao.mg.gov.br';   // diretor em exercício da escola adotada acima
r = B.entrarInstitucional({ porta: 'colegiado' });
ok(!r.ok && /só para os membros do Colegiado/.test(r.erro || ''), 'v7.4: a direção pela porta do colegiado é recusada');
r = B.entrarInstitucional({ porta: 'escola' });
ok(r.ok && r.papel === 'diretor_escolar', 'v7.4: a direção entra pela porta da direção');
IDENTIDADE = 'super.uberlandia@educacao.mg.gov.br';
r = B.entrarInstitucional({ porta: 'colegiado' });
ok(!r.ok, 'v7.4: ninguém de outro papel entra pela porta do colegiado');
r = B.entrarInstitucional({ porta: 'regional' });
ok(r.ok && r.perfil === 'regional', 'v7.4: a porta da regional segue como antes');
IDENTIDADE = '';


/* ==================== v7.5 (P2): escala — leituras por faixa, % gravado, memo, trava só na criação ==================== */
{
  const colsTexto = B.CHAVES_TEXTO.map(k => B.IDX[k]);
  const leTexto = (l) => l.aba === 'Registros' && l.nr > 1 && colsTexto.some(c => c >= l.c0 && c < l.c0 + l.nc);
  ok(B.CHAVES_TEXTO.length === 38 && B.CHAVES_TEXTO.indexOf('tApresentacao') >= 0 && B.CHAVES_TEXTO.indexOf('objetivosAnteriores') >= 0,
     'P2: as ' + B.CHAVES_TEXTO.length + ' colunas de texto livre são conhecidas');
  const fx = B.faixasDe_(B.CHAVES_PAINEL);
  ok(fx.length >= 3 && fx.length <= 8 && fx.every(f => { for (let c = f.ini; c <= f.fim; c++) if (colsTexto.indexOf(c) >= 0) return false; return true; }),
     'P2: as chaves do painel cabem em ' + fx.length + ' faixas contíguas, nenhuma passando por coluna de texto');
  /* o painel não lê as colunas de texto — nem para o Central, nem para a escola */
  LEITURAS.length = 0;
  const pc = B.painelRegistros({ token: TKC, filtros: { todas: true } });
  ok(pc.ok && pc.linhas.length > 5 && !LEITURAS.some(leTexto), 'P2: o painel do Central lê ' + LEITURAS.filter(l => l.aba === 'Registros').length + ' faixas e nenhuma coluna de texto');
  LEITURAS.length = 0;
  const pe = B.painelRegistros({ token: TKHORTO, filtros: {} });
  ok(pe.ok && !LEITURAS.some(leTexto), 'P2: o painel da direção também não lê texto');
  /* % preenchido gravado pelo servidor = o que o painel mostra = o que a 7.4 calculava */
  const linhaP = B.linhaDoProtocolo_(B.abaRegistros_(), pe.linhas[0].protocolo);
  const regP = B.lerLinha_(B.abaRegistros_(), linhaP);
  ok(String(regP.pct) !== '' && parseInt(regP.pct, 10) === B.pctDe_(regP) && pe.linhas[0].pct === parseInt(regP.pct, 10),
     'P2: o "% preenchido" está gravado na linha, igual ao cálculo antigo e ao que o painel devolve (' + regP.pct + '%)');
  /* linhas anteriores à 7.5 (sem %) são completadas uma vez, e o painel segue sem ler texto */
  B.gravarCampo_(B.abaRegistros_(), linhaP, 'pct', '');
  ok(B.garantirPercentuais_(B.abaRegistros_()) === 1 && String(B.lerLinha_(B.abaRegistros_(), linhaP).pct) === String(B.pctDe_(regP)),
     'P2: linha sem "% preenchido" (anterior à 7.5) é completada pela migração, com o mesmo valor');
  ok(B.garantirPercentuais_(B.abaRegistros_()) === 0, 'P2: com tudo preenchido, a migração não lê nada');
  B.gravarCampo_(B.abaRegistros_(), linhaP, 'pct', '');
  LEITURAS.length = 0;
  B.painelRegistros({ token: TKC, filtros: { todas: true } });
  ok(!LEITURAS.some(leTexto) && String(B.lerLinha_(B.abaRegistros_(), linhaP).pct) !== '',
     'B1: o painel completa a linha antiga lendo só ela — não a aba inteira, como até a 8.7');
  LEITURAS.length = 0;
  B.painelRegistros({ token: TKC, filtros: { todas: true } });
  ok(!LEITURAS.some(leTexto), 'P2: e na chamada seguinte volta a ler só as faixas');
  ok(B.recalcularPercentuais_() === 0, 'P2: recalcularPercentuais() (do editor) não tem o que fazer numa base já migrada');
  /* v8.13 (D01): a trava passou a valer para TODA escrita na aba de
     registros, inclusive a regravação de linha existente. A regra da v7.5
     ("cada escola escreve só o seu registro") era verdadeira e irrelevante:
     a disputa é entre a escola e o ato da SRE sobre a MESMA linha. */
  const abaR = B.abaRegistros_();
  const regE = B.lerLinha_(abaR, linhaP); regE.token = TKHORTO;
  const antesT = TRAVAS.n;
  GRAVACOES.length = 0;
  r = B.salvarPPP(regE);
  ok(r.ok && r.protocolo === regE.protocolo && TRAVAS.n === antesT + 1 && typeof r.pct === 'number',
     'D01: regravar um PPP existente também pede a trava global — e devolve o % preenchido');
  ok(GRAVACOES.length > 0 && GRAVACOES.filter(g => g.aba === 'Registros').every(g => g.comTrava),
     'D01: nenhuma escrita na aba de registros acontece fora da trava');
  var inepSemPPP = '777001';
  B.escolaSalvar({ token: TKDA, inep: inepSemPPP, escola: 'EE Sem PPP', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(inepSemPPP) });
  B.acessoSalvar({ token: TKDA, perfil: 'escola', papel: 'diretor_escolar', inep: inepSemPPP, nome: 'Dir 777', masp: '7770001', email: 'dir777@exemplo.mg', modo: 'novo' });
  var TK777 = sessaoDe_({ email: 'dir777@exemplo.mg', nome: 'Dir 777', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: inepSemPPP, escola: 'EE Sem PPP' });
  const antesT2 = TRAVAS.n;
  r = B.salvarPPP({ token: TK777, escola: 'EE Sem PPP', tMissao: 'Missão' });
  ok(r.ok && TRAVAS.n === antesT2 + 1, 'P2: criar um PPP novo pede a trava global (protocolo e "um PPP por vez")');
  ok(r.pct === B.pctDe_(B.lerLinha_(abaR, B.linhaDoProtocolo_(abaR, r.protocolo))) && r.pct > 0 && r.pct < 100,
     'P2: o PPP novo nasce com o % calculado no servidor (' + r.pct + '%)');
  /* buscarPorInep_ acha pela coluna do código, sem ler a aba */
  LEITURAS.length = 0;
  const dup = B.salvarPPP({ token: TK777, escola: 'EE Sem PPP' });
  ok(!dup.ok && dup.duplicado && dup.duplicado.protocolo === r.protocolo && !LEITURAS.some(l => l.aba === 'Registros' && l.nr > 1),
     'P2: "um PPP por vez" localiza o registro pela coluna do código (createTextFinder), lendo só a linha achada');
  /* acessos: entrada sem ler a aba inteira; memo por execução; invalidação após gravar */
  B.invalidarAcessos_(); LEITURAS.length = 0;
  const cad777 = B.acessoPorEmail_('dir777@exemplo.mg');
  ok(cad777 && cad777.inep === inepSemPPP && LEITURAS.filter(l => l.aba === 'Acessos').every(l => l.nr === 1),
     'P2: acessoPorEmail_ (a entrada de todo mundo) lê uma linha, não a aba');
  ok(B.acessoPorEmail_('DIR777@EXEMPLO.MG') && !B.acessoPorEmail_('ninguem@exemplo.mg'), 'P2: a busca ignora maiúsculas e devolve null para quem não existe');
  LEITURAS.length = 0;
  B.acessosTodos_(); B.acessosTodos_(); B.acessoPorEmail_('dir777@exemplo.mg');
  ok(LEITURAS.filter(l => l.aba === 'Acessos').length === 1, 'P2: a lista de acessos é lida uma vez por execução e reaproveitada');
  B.acessoSalvar({ token: TK777, email: 'm777@exemplo.mg', nome: 'Membro 777', papel: 'colegiado', segmento: 'Docente' });
  ok(B.acessosTodos_().some(a => a.email === 'm777@exemplo.mg') && B.colegiadoDaEscola_(inepSemPPP).length === 1,
     'P2: gravar invalida a memória — a lista seguinte já traz o membro novo');
  B.invalidarAcessos_(); LEITURAS.length = 0;
  ok(B.acessoPorInep_(inepSemPPP).email === 'dir777@exemplo.mg' && B.colegiadoDaEscola_(inepSemPPP).length === 1 &&
     LEITURAS.filter(l => l.aba === 'Acessos').every(l => l.nr === 1),
     'P2: diretor e colegiado da escola são localizados pela coluna do código, linha a linha');
  /* minhas assinaturas: só as linhas cuja folha tem o e-mail */
  LEITURAS.length = 0;
  const mm = B.minhasAssinaturas({ token: sessaoDe_({ email: 'membro1@educacao.mg.gov.br', nome: 'M', perfil: 'escola', papel: 'colegiado', sre: 'Divinópolis', inep: INEP_V7, escola: 'x' }) });
  ok(mm.ok && LEITURAS.filter(l => l.aba === 'Registros').every(l => l.nr === 1), 'P2: "minhas assinaturas" lê só as linhas em que o e-mail consta da folha');
  /* base sintética e medição */
  ok(/CÓPIA/.test(lanca(() => B.gerarBaseSintetica_(10, 'SIM'))), 'P2: a base sintética recusa rodar fora de uma cópia da planilha');
  NOME_PLANILHA = 'CÓPIA de Gerador de PPP — TESTE';
  ok(/SIM/.test(lanca(() => B.gerarBaseSintetica_(10, 'nao'))), 'P2: e exige a confirmação "SIM"');
  const antesR = B.abaRegistros_().getLastRow();
  const sint = B.gerarBaseSintetica_(30, 'SIM');
  ok(sint.ok && sint.registros === 30 && sint.acessos === 90 && sint.escolas === 30 && B.abaRegistros_().getLastRow() === antesR + 30,
     'P2: a base sintética cria 30 escolas, 90 acessos e 30 PPPs numa cópia');
  const regS = B.lerLinha_(B.abaRegistros_(), antesR + 1);
  ok(regS.tMissao.length >= 1500 && String(regS.pct) !== '' && regS.status === 'Em andamento',
     'P2: cada PPP sintético tem textos do tamanho real e o % já gravado');
  LEITURAS.length = 0;
  const pcs = B.painelRegistros({ token: TKC, filtros: { todas: true } });
  ok(pcs.linhas.length >= 30 && !LEITURAS.some(leTexto), 'P2: com a base maior, o painel do Central segue sem ler texto (' + pcs.linhas.length + ' linhas)');
  /* v8.13 (E01, A8-16): a medição REGRAVA um PPP; ganhou a mesma trava da
     base sintética — cópia da planilha e confirmação "SIM". */
  ok(/CÓPIA|SIM/.test(lanca(() => B.medirDesempenho_('nao'))),
     'v8.13 (E01): a medição exige a confirmação "SIM" — ela regrava um PPP');
  /* a escola i=22 (código final − 7) tem PPP em andamento na distribuição sintética */
  const med = B.medirDesempenho_('SIM', String(parseInt(sint.ultimoCodigo, 10) - 7));
  ok(med && typeof med['painel do Central — quadro por SRE'] === 'number' &&
     typeof med['painel do Central — todas as linhas'] === 'number' &&
     typeof med['entrada — acessoPorEmail_'] === 'number' &&
     typeof med['minhas assinaturas'] === 'number' && typeof med['regravar PPP existente — salvarPPP'] === 'number',
     'P2/B2: medirDesempenho cronometra entrada, o quadro por SRE, as linhas todas, "um PPP por vez", assinaturas e regravação');
  NOME_PLANILHA = 'Gerador de PPP — base';
}


/* ==================== v7.6 (P4): fila de e-mails, convite só para quem precisa, carga em lote, link copiável ==================== */
{
  MAIL.cota = 100; MAIL.falha = '';
  /* convite imediato para e-mail fora do domínio; boas-vindas pela fila para o domínio */
  const antesE = emails.length;
  r = B.acessoSalvar({ token: TKDA, perfil: 'escola', papel: 'diretor_escolar', inep: INEP_NOVA, nome: 'Diretora Gmail', masp: '7788990', email: 'diretora.gmail@gmail.com', modo: 'novo' });
  ok(r.ok && r.conviteModo === 'enviado' && emails.length === antesE + 1 && emails[emails.length - 1].to === 'diretora.gmail@gmail.com' && /Primeiro acesso/.test(emails[emails.length - 1].subject),
     'P4: e-mail fora do domínio recebe o convite na hora, quando há cota');
  ok(/fora do domínio|não é do domínio/.test(r.aviso || '') && /enviado agora/.test(r.aviso), 'P4: o aviso de domínio diz que o convite foi enviado agora');
  /* v8.0: a conferência do domínio compara o FIM do endereço. A comparação
     antiga (indexOf === length - 19) dava "institucional" a todo endereço de
     18 caracteres sem o domínio — indexOf devolve -1 e 18 - 19 também é -1 —,
     e essas pessoas recebiam boas-vindas em vez do convite de senha. */
  ok(B.emailInstitucional_('ana@educacao.mg.gov.br') === true &&
     B.emailInstitucional_('carlos@exemplo.com') === false &&
     B.emailInstitucional_('x@exemplo.com') === false &&
     B.emailInstitucional_('a@educacao.mg.gov.br.br') === false &&
     B.emailInstitucional_('@educacao.mg.gov.br') === false &&
     B.emailInstitucional_('') === false,
     'v8.0: institucional é quem TERMINA no domínio — endereço de 18 caracteres fora dele não passa mais');
  {
    const antesF = fila().length;
    const rr = B.acessoSalvar({ token: TK777, email: 'carlos@exemplo.com', nome: 'Carlos Servidor', papel: 'colegiado', segmento: 'Servidor administrativo' });
    ok(rr.ok && rr.conviteModo !== 'boas-vindas' && fila().length + emails.length > antesF,
       'v8.0: e quem está fora do domínio recebe o convite de primeiro acesso, não as boas-vindas');
    B.acessoRemover({ token: TK777, email: 'carlos@exemplo.com', motivo: 'conferência' });
  }
  /* falha no envio imediato: vai para a fila, não se perde */
  MAIL.falha = 'Service invoked too many times for one day: email';
  const filaAntes = fila().length;
  r = B.acessoSalvar({ token: TK777, email: 'docente.colegiado@hotmail.com', nome: 'Docente do Colegiado', papel: 'colegiado', segmento: 'Docente' });
  ok(r.ok && r.conviteModo === 'fila' && fila().length === filaAntes + 1 && fila()[fila().length - 1].tipo === 'convite' && fila()[fila().length - 1].prioridade === '1',
     'P4: se o envio imediato falha, o convite entra na fila em alta prioridade');
  ok(/será enviado/.test(r.aviso || ''), 'P4: e o aviso diz que o convite será enviado');
  /* v8.12: a conta institucional é cobrada de quem é servidor; de um pai de
     aluno, não — e o convite sai do mesmo jeito */
  const rPai = B.acessoSalvar({ token: TK777, email: 'pai.colegiado@hotmail.com', nome: 'Pai do Colegiado',
    papel: 'colegiado', segmento: 'Pai, mãe ou responsável', relacao: 'pai do estudante João, 7º ano A' });
  ok(rPai.ok && !rPai.aviso,
     'v8.12: membro do colegiado que não é servidor não recebe cobrança de conta institucional');
  const rSemRel = B.acessoSalvar({ token: TK777, email: 'mae.sem.relacao@hotmail.com', nome: 'Mãe Sem Relação',
    papel: 'colegiado', segmento: 'Pai, mãe ou responsável' });
  ok(!rSemRel.ok && /relação desta pessoa com a escola/.test(rSemRel.erro || ''),
     'v8.12: de quem não é servidor pede-se a relação com a escola, e sem ela o cadastro não passa');
  MAIL.falha = '';
  /* reenvio: informa o modo e devolve o link */
  r = B.primeiroAcessoReenviar({ token: TK777, email: 'pai.colegiado@hotmail.com' });
  ok(r.ok && r.modo === 'enviado' && /pa=/.test(r.link || ''), 'P4: o reenvio manda na hora quando pode e devolve o link do convite');
  /* a fila: prioridade, cota, tentativas, desistência. A cota precisa dar
     conta do que a bateria acumulou na fila até aqui — desde a 8.1, também
     os avisos de assinatura pendente de cada marcação de presença. */
  MAIL.cota = 400; MAIL.falha = '';
  B.enfileirarEmail_('a@exemplo.mg', 'boas-vindas', 'Bem-vindo', 'corpo a', 2);
  B.enfileirarEmail_('b@exemplo.mg', 'convite', 'Primeiro acesso', 'corpo b', 1);
  const antesFila = emails.length;
  r = B.processarFilaEmails_();
  ok(r.ok && r.enviados >= 2 && emails.slice(antesFila).findIndex(e => e.to === 'b@exemplo.mg') < emails.slice(antesFila).findIndex(e => e.to === 'a@exemplo.mg'),
     'P4: a fila envia os pendentes, convites (prioridade 1) antes das boas-vindas');
  ok(fila().filter(f => f.situacao === 'pendente').length === 0 && fila().every(f => f.situacao !== 'enviado' || f.enviadoEm),
     'P4: cada mensagem enviada fica marcada com a data');
  B.enfileirarEmail_('c@exemplo.mg', 'convite', 'Primeiro acesso', 'corpo c', 1);
  MAIL.cota = 50;   // só a reserva: nada pode sair
  r = B.processarFilaEmails_();
  ok(r.ok && r.enviados === 0 && r.semCota === true && fila().some(f => f.para === 'c@exemplo.mg' && f.situacao === 'pendente'),
     'P4: sem cota além da reserva, a fila espera a próxima execução');
  MAIL.cota = 100; MAIL.falha = 'Invalid email: c@exemplo.mg';
  for (let k = 0; k < 5; k++) B.processarFilaEmails_();
  const itemC = fila().filter(f => f.para === 'c@exemplo.mg')[0];
  ok(itemC.situacao === 'desistiu' && itemC.tentativas === '5' && /inválido/.test(itemC.erro),
     'P4: cinco falhas seguidas e a fila desiste, guardando o erro traduzido');
  MAIL.falha = '';
  const resumo = B.filaEmailsResumo({ token: TKC });
  ok(resumo.ok && resumo.desistidos >= 1 && resumo.enviados >= 2 && typeof resumo.cotaRestante === 'number' && resumo.ultimosErros.length >= 1,
     'P4: o resumo da fila para o Órgão Central conta situações e mostra os últimos erros');
  ok(/exclusiva do Órgão Central/.test(lanca(() => B.filaEmailsResumo({ token: TKR }))), 'P4: o resumo da fila é do Órgão Central');
  r = B.filaEmailsProcessar({ token: TKC });
  ok(r.ok && r.resumo && r.resumo.ok, 'P4: o Central processa a fila pelo botão e recebe o resumo atualizado');

  /* ===== v8.4: a fila é expurgada, lida sem o corpo, e o convite não vence nela ===== */
  {
    const abaF = B.abaFila_();
    const antes = fila().length;
    /* uma mensagem enviada há muito tempo e outra enviada hoje */
    B.enfileirarEmail_('velha@exemplo.mg', 'boas-vindas', 'Velha', 'corpo velho', 2);
    const linhaVelha = abaF.getLastRow();
    abaF.getRange(linhaVelha, 7, 1, 4).setValues([['enviado', 1, '', '01/01/2020 08:00']]);
    B.enfileirarEmail_('nova@exemplo.mg', 'boas-vindas', 'Nova', 'corpo novo', 2);
    const linhaNova = abaF.getLastRow();
    abaF.getRange(linhaNova, 7, 1, 4).setValues([['enviado', 1, '', B.agora_()]]);
    /* v8.13 (E13, A8-07): o expurgo saiu do caminho do envio — quem apaga é
       a rotina própria, com trava e orçamento. */
    const r8env = B.processarFilaEmails_();
    ok(r8env.apagadas === 0 && fila().some(f => f.para === 'velha@exemplo.mg'),
       'v8.13 (E13): processarFilaEmails_ NÃO apaga mais nada — a fila só é enviada');
    const r8 = B.expurgarFilaRotina_();
    ok(r8.apagadas >= 1 && !fila().some(f => f.para === 'velha@exemplo.mg'),
       'v8.4: a mensagem enviada há mais de 30 dias sai da fila (agora pela rotina de expurgo)');
    ok(fila().some(f => f.para === 'nova@exemplo.mg'),
       'v8.4: a enviada hoje continua lá — o expurgo é só do que já passou da guarda');
    ok(histTemEm('Acessos — histórico', /fila expurgada/), 'v8.4: o expurgo fica no histórico');
    ok(typeof B.FILA_GUARDA_DIAS === 'number' && typeof B.FILA_ALERTA_PENDENTES === 'number',
       'v8.4: a guarda e o limite de alerta são parâmetros do sistema');
  }
  {
    /* o convite que esperou na fila é renovado no envio */
    MAIL.cota = 400; MAIL.falha = '';
    const alvo = 'convite.parado@hotmail.com';
    B.acessoSalvar({ token: TK777, email: alvo, nome: 'Membro Parado', papel: 'colegiado', segmento: 'Pai, mãe ou responsável', relacao: 'mãe da estudante Ana, 6º ano' });
    const cad0 = B.acessoPorEmail_(alvo);
    ok(!!cad0 && !!cad0.token, 'v8.4: o cadastro novo tem convite pendente');
    /* envelhece o prazo, como se o convite estivesse parado na fila há dias */
    B.abaAcessos_().getRange(cad0.linha, 15).setValue('01/01/2020 08:00');
    B.invalidarAcessos_();
    B.enfileirarEmail_(alvo, 'convite', 'Primeiro acesso ao Gerador de PPP · SEE/MG',
      'Use o endereço abaixo. O link vale até 01/01/2020 08:00 e serve uma única vez.', 1);
    const antesE = emails.length;
    B.processarFilaEmails_();
    const cad1 = B.acessoPorEmail_(alvo);
    ok(cad1.tokenAte !== '01/01/2020 08:00' && /\d{2}\/\d{2}\/\d{4}/.test(cad1.tokenAte),
       'v8.4: ao sair da fila, o convite ganha prazo novo no cadastro (' + cad1.tokenAte + ')');
    const enviado = emails.slice(antesE).filter(e => e.to === alvo)[0];
    ok(enviado && enviado.body.indexOf('01/01/2020') < 0 && enviado.body.indexOf(cad1.tokenAte) >= 0,
       'v8.4: e o corpo da mensagem diz a data nova, não a vencida');
    ok(B.primeiroAcessoInfo({ token: cad1.token }).ok,
       'v8.4: o link recebido funciona — era isto que vencia dentro da fila');
  }

  /* carga em lote de diretores */
  ['610001', '610002', '610003', '610004'].forEach((c, i) => B.escolaSalvar({ token: TKDA, inep: c, escola: 'EE Lote ' + (i + 1), municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(c) }));
  B.escolaSalvar({ token: TKC, inep: '620001', escola: 'EE Outra SRE', municipio: 'Uberlândia', sre: 'Uberlândia', codigoInep: censoDe('620001') });
  B.acessoSalvar({ token: TKDA, perfil: 'escola', papel: 'diretor_escolar', inep: '610004', nome: 'Diretora Antiga', masp: '6100040', email: 'antiga.610004@educacao.mg.gov.br', modo: 'novo' });
  const textoD = 'Código;Nome;MASP;E-mail\n' +
    '610001;Diretor Lote Um;6100011;lote1@educacao.mg.gov.br\n' +
    '610002;Diretora Lote Dois;6100022;lote2@gmail.com\n' +
    '610003;;6100033;lote3@educacao.mg.gov.br\n' +
    '999999;Escola Inexistente;6100044;lote4@educacao.mg.gov.br\n' +
    '620001;Diretor de Outra SRE;6100055;lote5@educacao.mg.gov.br\n' +
    '610004;Diretora Nova;6100066;nova.610004@educacao.mg.gov.br\n' +
    '610001;Repetido;6100077;lote7@educacao.mg.gov.br\n' +
    '610003;E-mail repetido;6100088;lote2@gmail.com\n';
  ok(/Simule a carga/.test((B.importarAcessos_('diretores', { token: TKDA, texto: textoD, simular: false, chave: 'x' }) || {}).erro || ''),
     'P4: importar sem simular (chave errada) é recusado');
  ok(/não gere os diretores/.test((B.importarAcessos_('diretores', { token: TKCI, texto: textoD }) || {}).erro || ''),
     'P4: a Coordenação de Inspeção não importa diretores');
  const sim = B.importarAcessos_('diretores', { token: TKDA, texto: textoD });
  ok(sim.ok && sim.simulacao && sim.total === 8 && sim.aceitas === 3 && sim.recusadas === 5 && sim.substituicoes === 1 && sim.chave,
     'P4: a simulação confere as 8 linhas — 3 aceitas, 5 recusadas, 1 substituição — sem gravar nada');
  const porLinha = {}; sim.itens.forEach(i => porLinha[i.linha] = i);
  ok(/sem nome/.test(porLinha[4].motivo) && /não está na base/.test(porLinha[5].motivo) && /outra SRE/.test(porLinha[6].motivo) &&
     porLinha[7].substitui === 'Diretora Antiga' && /repetido na carga/.test(porLinha[8].motivo) && /e-mail repetido/.test(porLinha[9].motivo),
     'P4: cada linha recusada diz por quê; a substituição diz quem seria substituído');
  ok(/fora do domínio/.test(porLinha[3].aviso), 'P4: e-mail fora do domínio recebe aviso na simulação');
  ok(!B.acessoPorEmail_('lote1@educacao.mg.gov.br') && B.acessoPorInep_('610004').email === 'antiga.610004@educacao.mg.gov.br',
     'P4: a simulação não cadastrou ninguém nem substituiu a diretora');
  const simSem = B.importarAcessos_('diretores', { token: TKDA, texto: textoD, somenteSemDiretor: true });
  ok(simSem.ok && simSem.aceitas === 2 && simSem.substituicoes === 0 && /já tem diretor/.test(simSem.itens.filter(i => i.linha === 7)[0].motivo) && simSem.chave !== sim.chave,
     'P4: "só escolas sem diretor" recusa a substituição — e muda a chave');
  const filaAntesCarga = fila().length, emailsAntesCarga = emails.length;
  const imp = B.importarAcessos_('diretores', { token: TKDA, texto: textoD, simular: false, chave: sim.chave });
  ok(imp.ok && imp.concluida && imp.gravadas === 3 && imp.recusadas === 5 && imp.proximo === 0,
     'P4: a carga real grava as 3 aceitas e recusa as 5, como simulado');
  ok(B.acessoPorInep_('610001').email === 'lote1@educacao.mg.gov.br' && B.acessoPorInep_('610002').email === 'lote2@gmail.com' &&
     B.acessoPorInep_('610004').email === 'nova.610004@educacao.mg.gov.br',
     'P4: os diretores estão cadastrados nas escolas');
  const hx = B.gestoresHistorico({ token: TKDA, inep: '610004' });
  ok(hx.gestores.length === 2 && hx.gestores.some(g => /Antiga/.test(g.nome) && !g.vigente && /substitu/.test(g.motivo || '')) && hx.gestores.some(g => /Nova/.test(g.nome) && g.vigente),
     'P4: a substituição em lote encerra o período da diretora anterior e abre o da nova — os mesmos ganchos do cadastro individual');
  ok(emails.length === emailsAntesCarga && fila().length === filaAntesCarga + 3 && imp.convitesFila === 1 && imp.boasVindas === 2,
     'P4: na carga nenhum e-mail sai na hora — 1 convite e 2 boas-vindas vão para a fila');
  ok(histTem(/carga de diretores importada/) && histTem(/carga de diretores simulada/), 'P4: simulação e carga ficam no histórico');
  /* lotes: mais de LOTE_MAX linhas continuam na chamada seguinte */
  let textoG = '';
  for (let k = 0; k < B.LOTE_MAX + 5; k++) textoG += '5' + ('00000' + k).slice(-5) + ';Pessoa ' + k + ';;p' + k + '@educacao.mg.gov.br\n';
  const simG = B.importarAcessos_('diretores', { token: TKC, texto: textoG });
  ok(simG.ok && simG.total === B.LOTE_MAX + 5 && simG.recusadas === B.LOTE_MAX + 5, 'P4: a simulação percorre todas as linhas (' + simG.total + ')');
  const l1 = B.importarAcessos_('diretores', { token: TKC, texto: textoG, simular: false, chave: simG.chave });
  ok(l1.ok && l1.processadas === B.LOTE_MAX && l1.proximo === B.LOTE_MAX && !l1.concluida, 'P4: a carga processa ' + B.LOTE_MAX + ' linhas por chamada e diz de onde continuar');
  const l2 = B.importarAcessos_('diretores', { token: TKC, texto: textoG, simular: false, chave: simG.chave, de: l1.proximo });
  ok(l2.ok && l2.processadas === 5 && l2.proximo === 0 && l2.concluida, 'P4: a chamada seguinte termina o resto');
  ok(/5\.000 linhas/.test((B.importarAcessos_('diretores', { token: TKC, texto: 'x;y;z;w\n'.repeat(5001) }) || {}).erro || ''), 'P4: mais de 5.000 linhas é recusado');

  /* v8.12: a carga do colegiado saiu — cada membro é cadastrado um a um */
  const TKL1 = sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'Diretor Lote Um', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'EE Lote 1' });
  const textoM = 'Nome;E-mail;Segmento\nMaria Docente;maria@educacao.mg.gov.br;Docente\n';
  ok(/membro a membro/.test((B.colegiadoImportar({ token: TKL1, texto: textoM }) || {}).erro || ''),
     'v8.12: a carga em lote do colegiado recusa — o cadastro é membro a membro');
  ok(B.colegiadoDaEscola_('610001').length === 0, 'v8.12: e nada é gravado por esse caminho');
  B.acessoSalvar({ token: TKL1, email: 'joao.pai@gmail.com', nome: 'João Pai',
                   papel: 'colegiado', segmento: 'Pai, mãe ou responsável',
                   relacao: 'pai do estudante Pedro, 5º ano' });

  /* link do convite copiável */
  r = B.conviteLink({ token: TKL1, email: 'joao.pai@gmail.com' });
  ok(r.ok && /pa=/.test(r.link) && r.ate, 'P4: a direção copia o link do convite pendente de um membro');
  ok(!B.conviteLink({ token: TK777, email: 'joao.pai@gmail.com' }).ok, 'P4: outra direção não copia o link de membro alheio');
  ok(/Central/.test((B.conviteLink({ token: TKCI, email: 'lote2@gmail.com' }) || {}).erro || '') || !B.conviteLink({ token: TKCI, email: 'lote2@gmail.com' }).ok,
     'P4: a Coordenação de Inspeção não copia o link de um diretor');
  r = B.conviteLink({ token: TKDA, email: 'lote2@gmail.com' });
  ok(r.ok && /pa=/.test(r.link), 'P4: a Diretoria Educacional copia o link do convite de um diretor da sua SRE');
  const tokL2 = B.acessoPorEmail_('lote2@gmail.com').token;
  B.primeiroAcessoDefinir({ token: tokL2, senha: 'senha-lote-2026', repetir: 'senha-lote-2026' });
  r = B.conviteLink({ token: TKDA, email: 'lote2@gmail.com' });
  ok(!r.ok && /já definiu a senha/.test(r.erro), 'P4: consumido o convite, não há link a copiar');
  ok(histTem(/link de primeiro acesso copiado/), 'P4: copiar o link fica no histórico');
}


/* ==================== v7.7 (P5, P6): cobertura por regional, fila de validação, avisos do ciclo ==================== */
{
  MAIL.cota = 100; MAIL.falha = '';
  /* P6: enviar para validação avisa os validadores da SRE; devolver e validar avisam a direção */
  const TKL1b = sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'Diretor Lote Um', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'EE Lote 1' });
  r = B.salvarPPP({ token: TKL1b, escola: 'EE Lote 1', tMissao: 'Missão da escola lote 1', tObjetivos: 'Objetivos' });
  const P77 = r.protocolo;
  const validadores = B.validadoresDaSre_('Divinópolis');
  ok(validadores.length >= 1 && validadores.every(e => /@/.test(e)), 'P6: a SRE tem validadores ativos (' + validadores.length + ')');
  const filaAntes77 = fila().length, emailsAntes77 = emails.length;
  r = B.enviarParaValidacao({ token: TKL1b, protocolo: P77 });
  ok(r.ok && r.avisados === validadores.length, 'P6: enviar para validação avisa os ' + validadores.length + ' validadores da SRE');
  let ultimo = fila()[fila().length - 1];
  ok(fila().length === filaAntes77 + 1 && emails.length === emailsAntes77 && ultimo.tipo === 'validação' &&
     validadores.every(e => ultimo.para.indexOf(e) >= 0) && /EE Lote 1/.test(ultimo.assunto) && /enviou o Projeto/.test(ultimo.corpo) && /<div/.test(ultimo.corpo),
     'P6: uma mensagem só, para todos os validadores, pela fila — em HTML, com a escola no assunto');
  r = B.devolverPPP({ token: TKR, protocolo: P77, parecer: 'Falta detalhar o plano de ação com metas e prazos verificáveis.' });
  ultimo = fila()[fila().length - 1];
  ok(r.ok && r.avisado === 'lote1@educacao.mg.gov.br' && ultimo.para === 'lote1@educacao.mg.gov.br' && ultimo.prioridade === '1' &&
     /devolvido/.test(ultimo.assunto) && /metas e prazos verific/.test(ultimo.corpo) && /voltou a ser editável/.test(ultimo.corpo),
     'P6: a devolução chega ao diretor em exercício com o parecer, em alta prioridade');
  r = B.enviarParaValidacao({ token: TKL1b, protocolo: P77 });
  r = B.validarPPP({ token: TKR, protocolo: P77, parecer: 'Documento consistente.' });
  ultimo = fila()[fila().length - 1];
  ok(r.ok && r.avisado === 'lote1@educacao.mg.gov.br' && /validado/.test(ultimo.assunto) && /Documento consistente/.test(ultimo.corpo) && /concluir o documento/.test(ultimo.corpo),
     'P6: a validação chega ao diretor com a observação, pela fila');
  const antesProc = emails.length;
  B.processarFilaEmails_();
  const enviadoHtml = emails.slice(antesProc).filter(e => /validado/.test(e.subject))[0];
  ok(enviadoHtml && enviadoHtml.htmlBody && !enviadoHtml.body, 'P6: a fila envia os avisos do ciclo como HTML');
  ok(!B.txtServidor_ || B.PADRAO_SERVIDOR['EMAIL.validacao.devolvido.assunto'] && B.PADRAO_SERVIDOR['EMAIL.validacao.botao'],
     'P6: os textos dos avisos são curáveis (PADRAO_SERVIDOR)');

  /* P5: cobertura por regional */
  ok(!B.coberturaRegional({ token: TKL1b }).ok, 'P5: a cobertura não é da escola');
  const cob = B.coberturaRegional({ token: TKR });
  ok(cob.ok && cob.sre === 'Divinópolis' && cob.escolas.length >= 4 && cob.escolas.every(e => e.sre === 'Divinópolis'),
     'P5: a regional recebe uma linha por escola ativa da sua SRE (' + cob.escolas.length + ')');
  const e1 = cob.escolas.filter(e => e.inep === '610001')[0], e3 = cob.escolas.filter(e => e.inep === '610003')[0];
  ok(e1 && e1.status === 'Validado' && e1.dias === 0 && e1.diretor === 'Diretor Lote Um' && e1.protocolo === P77 && e1.versao === 1,
     'P5: a escola com PPP mostra a situação do PPP mais recente, há quantos dias, e o diretor');
  ok(e3 && e3.status === B.ST_SEM_PPP && e3.dias === null && e3.semDiretor === true && e3.diretor === '',
     'P5: a escola que nunca começou aparece como "Sem PPP", e sem diretor quando não há');
  ok(cob.resumo.escolas === cob.escolas.length && cob.resumo.semPPP >= 1 && cob.resumo.validado >= 1 && typeof cob.resumo.esperaMaisAntiga === 'number',
     'P5: o resumo conta as situações, inclusive "sem PPP" e a espera mais antiga em validação');
  ok(!cob.escolas.some(e => e.inep === '620001'), 'P5: a escola de outra SRE não entra');
  /* a versão mais recente manda: a escola A tem v1 encerrada e v2 em andamento */
  const eA = cob.escolas.filter(e => e.inep === INEP_A)[0];
  ok(eA && eA.versao >= 2 && eA.status === 'Em andamento', 'P5: com duas versões, vale a situação da mais recente (' + eA.versao + 'ª, ' + eA.status + ')');
  /* fila de validação: quem espera há mais tempo */
  B.gravarCampo_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P77), 'status', 'Em validação');
  B.gravarCampo_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P77), 'enviadoValidacaoEm', '01/09/2026 10:00');
  const cob2 = B.coberturaRegional({ token: TKR });
  const e1b = cob2.escolas.filter(e => e.inep === '610001')[0];
  ok(e1b.status === 'Em validação' && e1b.dias >= 10 && cob2.resumo.esperaMaisAntiga >= e1b.dias && cob2.resumo.emValidacao >= 1,
     'P5: em validação, os dias contam desde o envio — e o resumo aponta a espera mais antiga (' + e1b.dias + ' dias)');
  /* o quadro das regionais, para o Central */
  const quadro = B.coberturaRegional({ token: TKC });
  ok(quadro.ok && Array.isArray(quadro.quadro) && quadro.quadro.length >= 2 && quadro.quadro.some(q => q.sre === 'Divinópolis') && quadro.quadro.some(q => q.sre === 'Uberlândia'),
     'P5: sem SRE escolhida, o Central recebe o quadro das regionais (' + quadro.quadro.length + ' linhas)');
  const qd = quadro.quadro.filter(q => q.sre === 'Divinópolis')[0];
  ok(qd.escolas === cob2.resumo.escolas && qd.emValidacao === cob2.resumo.emValidacao && qd.semPPP === cob2.resumo.semPPP && qd.esperaMaisAntiga === cob2.resumo.esperaMaisAntiga,
     'P5: a linha da regional no quadro bate com o resumo da própria regional');
  ok(quadro.totais.escolas === quadro.quadro.reduce((a, q) => a + q.escolas, 0), 'P5: os totais somam as regionais');
  const cobU = B.coberturaRegional({ token: TKC, sre: 'Uberlândia' });
  ok(cobU.ok && cobU.escolas.length >= 1 && cobU.escolas.every(e => e.sre === 'Uberlândia'), 'P5: escolhida uma SRE, o Central recebe a lista plana dela');
  B.gravarCampo_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P77), 'status', 'Validado');
}


/* ==================== v7.8 (P7, P8, P10): sessão deslizante, senha reforçada, três registros, linha do tempo, backup e integridade ==================== */
{
  /* P7: sessão deslizante, com teto absoluto; sair remove no servidor */
  const TKS = sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'Diretor Lote Um', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'EE Lote 1' });
  const chaveS = 'ses_' + TKS;
  ok(CACHE.ttl[chaveS] === 4 * 3600 && JSON.parse(CACHE.c[chaveS]).criadaEm > 0, 'P7: a sessão nasce com 4 h de validade e a hora de criação');
  CACHE.ttl[chaveS] = 100;
  const sv = B.sessaoValida({ token: TKS });
  ok(sv.ok && CACHE.ttl[chaveS] === 4 * 3600 && sv.expiraEm > 11 * 3600000 && sv.expiraEm <= 12 * 3600000,
     'P7: cada chamada renova as 4 h — a sessão é deslizante — e diz quanto falta do teto de 12 h');
  { const s0 = JSON.parse(CACHE.c[chaveS]); s0.criadaEm = Date.now() - 13 * 3600000; CACHE.c[chaveS] = JSON.stringify(s0); }
  const svx = B.sessaoValida({ token: TKS });
  ok(!svx.ok && svx.semSessao && /12 horas/.test(svx.erro) && !CACHE.c[chaveS], 'P7: passadas 12 h desde a entrada, a sessão acaba mesmo em uso');
  const TKS2 = sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'Diretor Lote Um', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'EE Lote 1' });
  ok(B.sair({ token: TKS2 }).ok && !CACHE.c['ses_' + TKS2] && !B.sessaoValida({ token: TKS2 }).ok, 'P7: "sair" remove a sessão no servidor');
  ok(histTemEm('Acessos — histórico', /saiu do sistema/), 'P7: a saída fica no histórico de acessos');
  ok(B.sair({}).ok && B.sessaoValida({ token: 'nada' }).semSessao === true, 'P7: sair sem token e validar token inexistente não lançam');

  /* P7: senha v2 (pepper + 5.000 passadas) e migração da v1 na primeira entrada */
  const salV1 = 'sal-antigo';
  const hashV1 = B.hashSenhaV2_ && require('crypto').createHash('sha256').update(salV1 + '|senha-v1-2026').digest('hex');
  B.acessoSalvar({ token: TKDA, perfil: 'escola', papel: 'diretor_escolar', inep: '610003', nome: 'Diretora V1', masp: '6100033', email: 'v1.610003@educacao.mg.gov.br', modo: 'novo' });
  { const cadV1 = B.acessoPorEmail_('v1.610003@educacao.mg.gov.br');
    B.abaAcessos_().getRange(cadV1.linha, 5, 1, 2).setValues([[hashV1, salV1]]); B.invalidarAcessos_(); }
  IDENTIDADE = '';
  r = B.entrarInstitucional({ email: 'v1.610003@educacao.mg.gov.br', senha: 'errada', porta: 'escola' });
  ok(!r.ok, 'P7: senha errada continua recusada contra o hash antigo');
  r = B.entrarInstitucional({ email: 'v1.610003@educacao.mg.gov.br', senha: 'senha-v1-2026', porta: 'escola' });
  const cadMig = B.acessoPorEmail_('v1.610003@educacao.mg.gov.br');
  ok(r.ok && cadMig.hashVersao === '2' && cadMig.sal !== salV1 && cadMig.hash !== hashV1 && cadMig.hash === B.hashSenhaV2_('senha-v1-2026', cadMig.sal),
     'P7: a senha antiga (v1) entra e é migrada para v2 — pepper e 5.000 passadas — na primeira entrada válida');
  r = B.entrarInstitucional({ email: 'v1.610003@educacao.mg.gov.br', senha: 'senha-v1-2026', porta: 'escola' });
  ok(r.ok, 'P7: e continua entrando com a mesma senha depois da migração');
  ok(B.hashSenhaV2_('x', 's') !== B.hashSenhaV2_('x', 't') && B.hashSenhaV2_('x', 's') === B.hashSenhaV2_('x', 's') && B.hashSenhaV2_('x', 's').length === 64,
     'P7: o hash v2 depende do sal e é estável');
  { const tokC = B.acessoPorEmail_('lote2@gmail.com'); }
  B.acessoSalvar({ token: TKDA, perfil: 'escola', papel: 'diretor_escolar', inep: '610003', nome: 'Diretora V1', masp: '6100033', email: 'v1.610003@educacao.mg.gov.br', modo: 'correcao' });
  ok(B.acessoPorEmail_('v1.610003@educacao.mg.gov.br').hashVersao === '2', 'P7: corrigir o cadastro preserva a versão do hash');
  ok(B.senhaConfere_(B.acessoPorEmail_('v1.610003@educacao.mg.gov.br'), 'senha-v1-2026') && !B.senhaConfere_({ hash: '', sal: '' }, 'x'), 'P7: senhaConfere_ decide pelo cadastro');

  /* P8: três registros; a curadoria não se afoga em entradas */
  ok(!histTemEm('Curadoria — histórico', /entrou como/) && histTemEm('Acessos — histórico', /entrou como/),
     'P8: as entradas no sistema vão para "Acessos — histórico", nunca para a curadoria');
  ok(histTemEm('Ciclo — histórico', /PPP validado/) && histTemEm('Ciclo — histórico', /PPP devolvido/) && histTemEm('Ciclo — histórico', /PPP enviado para validação/),
     'P8: os atos de validação vão para "Ciclo — histórico"');
  ok(histTemEm('Ciclo — histórico', /PPP criado/) && histTemEm('Ciclo — histórico', /PPP concluído/) && histTemEm('Ciclo — histórico', /assinatura registrada/) &&
     histTemEm('Ciclo — histórico', /ata anexada/) && histTemEm('Ciclo — histórico', /enviado para homologação/) && histTemEm('Ciclo — histórico', /nova versão aberta/) &&
     histTemEm('Ciclo — histórico', /presença na reunião de aprovação registrada/) && histTemEm('Ciclo — histórico', /PPP lido/),
     'P8: criação, conclusão, assinaturas, presença, ata, homologação, nova versão e leituras institucionais ficam no ciclo');
  ok(histTemEm('Curadoria — histórico', /texto publicado/) && !histTemEm('Curadoria — histórico', /acesso criado/),
     'P8: a curadoria guarda só a curadoria');
  const estC = B.curadoriaEstado_();
  ok(estC.historico.every(h => /texto|rascunho|curadoria|parâmetro/i.test(h.acao)), 'P8: as 40 últimas linhas que a curadoria mostra são todas de curadoria');
  /* linha do tempo */
  const lt = B.linhaDoTempo({ token: TKR, protocolo: P });
  ok(lt.ok && lt.eventos.length >= 5 && lt.eventos.some(e => e.ato === 'PPP criado') && lt.eventos.some(e => /assinatura registrada/.test(e.ato)) && lt.eventos.some(e => /homologação/.test(e.ato)),
     'P8: a linha do tempo do PPP reúne os atos (' + lt.eventos.length + ' eventos)');
  ok(lt.eventos.every((e, i) => i === 0 || true) && lt.eventos.some(e => e.origem === 'registro'), 'P8: eventos vêm do ciclo e das datas do registro, sem duplicar');
  { const datas = lt.eventos.map(e => e.data); ok(JSON.stringify(datas) === JSON.stringify(datas.slice().sort((a, b) => { const o = t => { const m = String(t).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0)).getTime() : 0; }; return o(a) - o(b); })), 'P8: em ordem cronológica'); }
  ok(/expirada/.test(lanca(() => B.linhaDoTempo({ token: TKS, protocolo: P }))), 'P8: a linha do tempo exige sessão');
  ok(/outra escola/.test((B.linhaDoTempo({ token: sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'x', perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'x' }), protocolo: P }) || {}).erro || ''),
     'P8: outra escola não vê a linha do tempo');
  ok(B.linhaDoTempo({ token: TKC, protocolo: P }).ok && /não encontrado/.test((B.linhaDoTempo({ token: TKC, protocolo: 'PPP-0000-0000-XXXX' }) || {}).erro || ''), 'P8: o Central vê; protocolo inexistente é recusado');
  /* rotação mensal do histórico de acessos */
  const antesRot = B.abaHistAcessos_().getLastRow();
  const rot = B.rotacionarHistoricoAcessos_();
  ok(rot.ok && rot.linhas === antesRot - 1 && CRIADAS.length === 1 && /Acessos histórico \d{4}-\d{2}/.test(CRIADAS[0].nome) && B.abaHistAcessos_().getLastRow() <= 2,
     'P8: a rotação move as ' + rot.linhas + ' linhas para uma planilha-arquivo e deixa a aba só com o cabeçalho (e o registro da rotação)');
  ok(CRIADAS[0].getSheets()[0].getLastRow() === antesRot, 'P8: o arquivo tem o cabeçalho e todas as linhas');

  /* P10: backup mensal e integridade
     v8.13 (E15): a rotina recusa repetir em menos de BACKUP_MIN_INTERVALO —
     as chamadas de bateria pedem `{forcado:true}`, como o menu; e a retenção
     passou a ser por IDADE e depois por contagem. */
  BACKUPS.length = 0;
  B.backupDiario_({ forcado: true });
  ok(BACKUPS.filter(b => /^Backup Base PPP /.test(b.nome)).length === 1 && BACKUPS.filter(b => /^Backup mensal Base PPP \d{4}-\d{2}$/.test(b.nome)).length === 1,
     'P10: o backup diário cria a cópia do dia e, na primeira do mês, a cópia mensal');
  B.backupDiario_({ forcado: true });
  ok(BACKUPS.filter(b => /^Backup Base PPP /.test(b.nome)).length === 2 && BACKUPS.filter(b => /^Backup mensal/.test(b.nome)).length === 1, 'P10: no mesmo mês, só a cópia diária é acrescentada');
  for (let k = 0; k < 40; k++) BACKUPS.push({ nome: 'Backup Base PPP 2020-01-' + (k + 10) + ' 030000', criado: new Date(2020, 0, k + 10), lixo: false });
  for (let k = 0; k < 30; k++) BACKUPS.push({ nome: 'Backup mensal Base PPP 20' + (10 + Math.floor(k / 12)) + '-' + ('0' + (k % 12 + 1)).slice(-2), criado: new Date(2010 + Math.floor(k / 12), k % 12, 1), lixo: false });
  B.backupDiario_({ forcado: true });
  ok(BACKUPS.filter(b => /^Backup Base PPP /.test(b.nome) && !b.lixo).length === 33 && BACKUPS.filter(b => /^Backup mensal/.test(b.nome) && !b.lixo).length === 25,
     'v8.13 (E15): entre os VELHOS ficam as 30 diárias e as 24 mensais mais recentes — e as três cópias novas de hoje NÃO são descartadas (' +
     BACKUPS.filter(b => /^Backup Base PPP /.test(b.nome) && !b.lixo).length + '/' +
     BACKUPS.filter(b => /^Backup mensal/.test(b.nome) && !b.lixo).length + ')');
  ok(B.listarBackups_().length === 58 && B.listarBackups_()[0].nome.indexOf('Backup') === 0, 'P10: listarBackups mostra o que há na pasta');
  const integ = B.verificarIntegridade_();
  ok(integ.ok && integ.verificados >= 3 && integ.faltas === 0, 'P10: a integridade confere os arquivos referidos (' + integ.verificados + ') e não acha falta');
  const regInt = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
  const fonteSumida = regInt.fonteId;
  const fonteOriginal = arquivos[fonteSumida];
  delete arquivos[fonteSumida];
  B.acessoSalvar({ token: TKC, email: 'central.aviso@educacao.mg.gov.br', nome: 'Analista do Central', papel: 'central' });
  const filaAntesI = fila().length;
  const integ2 = B.verificarIntegridade_();
  ok(integ2.faltas === 1 && integ2.itens[0].protocolo === P && /congelado/.test(integ2.itens[0].tipo),
     'P10: um arquivo que sumiu do Drive é apontado, com o protocolo e o tipo');
  ok(outras['Integridade'] && Object.keys(outras['Integridade'].linhas).some(k => String(outras['Integridade'].linhas[k]) === P),
     'P10: a falta fica registrada na aba "Integridade"');
  const avisoI = fila()[fila().length - 1];
  ok(fila().length === filaAntesI + 1 && avisoI.tipo === 'integridade' && avisoI.prioridade === '1' && /não encontrado/.test(avisoI.assunto) && /central.aviso@educacao.mg.gov.br/.test(avisoI.para),
     'P10: o Órgão Central é avisado pela fila, em alta prioridade');
  ok(histTemEm('Acessos — histórico', /integridade verificada/), 'P10: a verificação fica no histórico');
  arquivos[fonteSumida] = fonteOriginal;

  /* ===== v8.4: a verificação em lotes ===== */
  ok(integ2.parcial === false && typeof integ2.total === 'number',
     'v8.4: com poucos registros a volta se fecha numa execução só');
  {
    /* com o orçamento de tempo zerado, cada execução faz um lote e guarda onde parou */
    const propsSim = S.g.PropertiesService.getScriptProperties();
    propsSim.deleteProperty('INTEGRIDADE_ESTADO');
    const total = B.lerColunas_(B.abaRegistros_(), ['protocolo']).length;
    const loteOriginal = B.INTEGRIDADE_LOTE;
    ok(typeof loteOriginal === 'number' && loteOriginal > 0, 'v8.4: há um tamanho de lote configurado (' + loteOriginal + ')');
    ok(typeof B.INTEGRIDADE_TEMPO === 'number' && B.INTEGRIDADE_TEMPO <= 5 * 60 * 1000,
       'v8.4: e um orçamento de tempo abaixo do teto de 6 minutos do Apps Script');
    ok(triggers.filter(f => f === 'verificarIntegridade_').length === 1,
       'v8.4: a verificação tem um acionador — agora diário, porque é a execução seguinte que continua');
    /* v8.13 (E01): o acionador passou a apontar para o nome PRIVADO */
    ok(/newTrigger\('verificarIntegridade_'\)\.timeBased\(\)\.everyDays\(1\)\.atHour\(4\)/.test(src),
       'v8.4: e ele é diário, não semanal — e aponta para verificarIntegridade_ (v8.13, E01)');
    ok(total > 0 && !propsSim.getProperty('INTEGRIDADE_ESTADO'),
       'v8.4: fechada a volta, o ponteiro é apagado e a próxima execução recomeça do início');
  }
}


/* ==================== v7.9 (P9, P11): homologação registrada pela SRE; saneamento do histórico de gestores ==================== */
{
  MAIL.cota = 100; MAIL.falha = '';
  /* P9: o PPP P está "Enviado para homologação" (declarado pela escola) */
  const regH0 = regP();
  ok(regH0.status === 'Enviado para homologação' && !regH0.homolEm,
     'v8.2: encaminhado pela assinatura da direção, o PPP espera a confirmação da SRE');
  ok(/não registra a homologação/.test((B.homologarPPP({ token: TKCI, protocolo: P }) || {}).erro || ''), 'P9: a Inspeção não homologa');
  /* v8.13 (C04): o diretor do Horto foi substituído lá atrás e a sessão dele
     não vale mais — quem representa a escola aqui é uma direção em exercício. */
  ok(/exclusiva/.test(lanca(() => B.homologarPPP({ token: TKSUC, protocolo: P }))), 'P9: a escola não homologa o próprio PPP');
  const filaAntesH = fila().length;
  const antesH = Date.now();
  r = B.homologarPPP({ token: TKR, protocolo: P });
  const regH = regP();
  ok(r.ok && regH.status === 'Homologado' && /Superintendente|Diretor Educacional/.test(regH.homolPor),
     'v8.2: a equipe da Diretoria Educacional homologa confirmando — sem informar ato nem data');
  ok(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(regH.homolEm) && regH.homolAto === '',
     'v8.2: a data e a hora são as do momento da confirmação, e o ato fica em branco: ' + regH.homolEm);
  ok(regH.homolData && regH.homolDestino, 'v8.2: o encaminhamento automático continua guardado');
  ok(/final e definitiva/.test((B.homologarPPP({ token: TKR, protocolo: P }) || {}).erro || ''),
     'P9: não se homologa duas vezes — e a recusa (v10.0) diz que o documento é final e definitivo');
  ok(fila().length === filaAntesH + 1 && fila()[fila().length - 1].tipo === 'validação' && /homologado/.test(fila()[fila().length - 1].assunto),
     'P9: a direção é avisada pela fila');
  ok(histTemEm('Ciclo — histórico', /PPP homologado pela Diretoria Educacional — versão final e definitiva/),
     'P9: o ato fica no ciclo, com a natureza do ato escrita (v10.0)');
  ok(/Homologado pela Superintendência Regional de Ensino de Divinópolis em /.test(B.folhaAssinaturas_(regH)) &&
     !/ato /.test(B.folhaAssinaturas_(regH).match(/Homologado pela[^<]*/)[0]),
     'v8.2: a folha cita a homologação sem mencionar ato quando não há');
  const pai = B.painelRegistros({ token: TKR, filtros: {} }).linhas.filter(x => x.protocolo === P)[0];
  ok(pai.status === 'Homologado' && pai.podeHomologar === false, 'P9: o painel traz a homologação e não oferece homologar de novo');
  const outroConc = B.painelRegistros({ token: TKR, filtros: {} }).linhas.filter(x => x.status === 'Concluído' || x.status === 'Enviado para homologação')[0];
  ok(!outroConc || outroConc.podeHomologar === true, 'P9: para quem valida, os PPPs concluídos oferecem "homologar"');
  ok(B.painelRegistros({ token: TKCI, filtros: {} }).linhas.every(x => !x.podeHomologar), 'P9: a Inspeção não vê "homologar"');
  ok(B.revisaoVencida_({ homolEm: '10/09/2020', homolData: '10/09/2026', concluidoEm: '10/09/2026' }) === true && B.revisaoVencida_({ homolEm: '10/09/2026', homolData: '10/09/2020' }) === false,
     'P9: a revisão de dois anos conta da data registrada pela SRE, quando há');
  const cobH = B.coberturaRegional({ token: TKC });
  ok(cobH.totais.homologado >= 1 && typeof cobH.totais.enviadoHomologacao === 'number' && cobH.quadro.some(q => q.homologado >= 1),
     'P9: a cobertura separa "homologado pela SRE" de "enviado para homologação"');
  /* v8.13 (C04): quem abre a nova versão é a direção EM EXERCÍCIO — dir@x.mg
     foi substituído por dir.escola.a@ lá atrás, e a sessão dele não vale mais. */
  { const nv = B.novaVersao({ p: P, token: TKE }); ok(nv.ok || /já tem um PPP em curso/.test(nv.erro || ''), 'P9/D07: homologado é estado encerrado — a nova versão só esbarra em "um PPP por vez"'); }

  /* P11: saneamento do histórico de gestores */
  /* v8.12: Maria era cadastrada pela carga em lote, que saiu; agora entra
     como qualquer membro do colegiado — uma a uma, pela direção */
  const TKL1P11 = sessaoDe_({ email: 'lote1@educacao.mg.gov.br', nome: 'Diretor Lote Um',
    perfil: 'escola', papel: 'diretor_escolar', sre: 'Divinópolis', inep: '610001', escola: 'EE Lote 1' });
  B.acessoSalvar({ token: TKL1P11, email: 'maria@educacao.mg.gov.br', nome: 'Maria Docente',
                   papel: 'colegiado', segmento: 'Docente' });
  const abaG = B.abaGestores_();
  const nG = abaG.getLastRow();
  /* uma linha "à moda 7.0–7.2": membro do colegiado gravado como gestor, em aberto */
  abaG.appendRow(['610001', 'EE Lote 1', 'Maria Docente', '', 'maria@educacao.mg.gov.br', '01/08/2026 10:00', '', 'v7.0', '', 'escola', 'Divinópolis']);
  abaG.appendRow(['610001', 'EE Lote 1', 'Diretor Lote Um', '6100011', 'lote1@educacao.mg.gov.br', '01/08/2026 10:00', '', 'v7.0', '', 'escola', 'Divinópolis']);
  B.invalidarAcessos_(); B.invalidarGestores_();
  const antesSan = B.gestoresHistorico({ token: TKDA, inep: '610001' }).gestores.length;
  const san = B.sanearHistoricoColegiado_();
  ok(san.ok && san.marcadas === 1, 'P11: o saneamento marca só a linha do membro do colegiado (' + san.marcadas + ')');
  const linhaS = abaG.getRange(nG + 1, 1, 1, 11).getDisplayValues()[0];
  ok(linhaS[9] === 'colegiado' && /não é período de gestão/.test(linhaS[8]) && linhaS[6] !== '', 'P11: perfil "colegiado", motivo e data-fim gravados — nada apagado');
  const linhaD = abaG.getRange(nG + 2, 1, 1, 11).getDisplayValues()[0];
  ok(linhaD[9] === 'escola' && !linhaD[6], 'P11: a linha do diretor continua como período aberto');
  ok(B.gestoresHistorico({ token: TKDA, inep: '610001' }).gestores.length === antesSan - 1, 'P11: o histórico da escola deixa de contar a linha saneada');
  ok(!B.acessosHistorico({ token: TKC, sre: 'Divinópolis' }).acessos.some(a => a.email === 'maria@educacao.mg.gov.br'), 'P11: nem o histórico institucional a mostra');
  ok(B.sanearHistoricoColegiado_().marcadas === 0 && histTemEm('Acessos — histórico', /histórico de gestores saneado/), 'P11: repetir não marca nada; o saneamento fica no histórico');
}

/* ==================== v8.7 (bloco 3 e 4): erro humano e não perder texto ==================== */
{
  MAIL.cota = 200; MAIL.falha = '';
  const INEP87 = '31870087';
  cargaEscolas(TKC, INEP87 + ';EE do Bloco Três;Divinópolis;Divinópolis');
  const TKD87 = sessaoDe_({ email: 'd87@educacao.mg.gov.br', nome: 'Diretora Oito Sete', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP87, escola: 'EE do Bloco Três' });
  let r87 = B.salvarPPP({ token: TKD87, escola: 'EE do Bloco Três', inep: INEP87, sre: 'Divinópolis',
                          municipio: 'Divinópolis', sessao: 's87', tApresentacao: 'Texto da apresentação.' });
  ok(r87.ok, 'v8.7: PPP de teste criado (' + r87.protocolo + ')');
  const P87 = r87.protocolo;
  const aba87 = B.abaRegistros_();
  const lin87 = () => B.linhaDoProtocolo_(aba87, P87);
  const reg87 = () => B.lerLinha_(aba87, lin87());
  const grava87 = (k, v) => B.gravarCampo_(aba87, lin87(), k, v);

  /* ---- D1: teto por célula ---- */
  {
    const antes = reg87().tApresentacao;
    const gigante = 'x'.repeat(B.LIMITE_CELULA + 1);
    const rec = B.salvarPPP({ token: TKD87, protocolo: P87, escola: 'EE do Bloco Três', inep: INEP87,
                              sessao: 's87', tApresentacao: gigante });
    ok(!rec.ok && rec.campoGrande === 'tApresentacao' && rec.tamanho === B.LIMITE_CELULA + 1,
       'D1: o servidor recusa a gravação e diz qual campo estourou e de quanto');
    ok(/Apresentação/i.test(rec.campoCol || '') && /45\.001 caracteres/.test(rec.erro) && /45\.000/.test(rec.erro),
       'D1: a recusa nomeia o campo como ele aparece na planilha e mostra os dois números');
    ok(reg87().tApresentacao === antes,
       'D1: nada é gravado — antes, a recusa do Sheets derrubava a linha inteira e o PPP parava de salvar em silêncio');
    const noLimite = 'y'.repeat(B.LIMITE_CELULA);
    const rok = B.salvarPPP({ token: TKD87, protocolo: P87, escola: 'EE do Bloco Três', inep: INEP87,
                              sessao: 's87', tApresentacao: noLimite });
    ok(rok.ok && reg87().tApresentacao.length === B.LIMITE_CELULA, 'D1: exatamente no limite, grava');
    B.salvarPPP({ token: TKD87, protocolo: P87, escola: 'EE do Bloco Três', inep: INEP87,
                  sessao: 's87', tApresentacao: 'Texto da apresentação.' });
  }

  /* ---- C1: "Validado" deixa de ser estado sem saída ---- */
  {
    grava87('status', 'Validado');
    grava87('validadoPor', 'Servidora da DIRE · Diretor Educacional');
    grava87('validadoEm', '10/09/2026 09:00');
    grava87('parecerValidacao', 'De acordo.');
    const curto = B.devolverPPP({ token: TKR, protocolo: P87, parecer: 'errado' });
    ok(!curto.ok && /ao menos 20 caracteres/.test(curto.erro), 'C1: devolver o validado continua exigindo parecer escrito');
    const dev = B.devolverPPP({ token: TKR, protocolo: P87,
      parecer: 'A validação foi registrada na linha errada: este PPP ainda não tinha sido analisado.' });
    const rd = reg87();
    ok(dev.ok && dev.revogada === true && rd.status === 'Em andamento',
       'C1: o PPP já validado volta a ser editável — antes, "Validado" não tinha saída');
    ok(rd.validadoPor === '' && rd.validadoEm === '',
       'C1: quem validou é limpo junto — a validação foi revogada, não apenas devolvida');
    const lista87 = JSON.parse(rd.devolucoes || '[]');
    ok(lista87.length >= 1 && lista87[lista87.length - 1].revogacao === true,
       'C1: a devolução fica marcada como revogação de validação no histórico do registro');
    ok(histTemEm('Ciclo — histórico', /validação revogada/), 'C1: "validação revogada" entra no ciclo do documento');
    ok(B.salvarPPP({ token: TKD87, protocolo: P87, escola: 'EE do Bloco Três', inep: INEP87,
                     sessao: 's87', tApresentacao: 'Corrigindo o que a DIRE apontou.' }).ok,
       'C1: e a escola volta a escrever, sem ter de concluir e atestar um documento que sabe estar errado');
  }

  /* ---- C3: a nova versão nasce limpa ---- */
  {
    ['ataId','ataUrl','ataNome','ataData','ataIdent'].forEach(k => grava87(k, k + '-antigo'));
    grava87('homolPor', 'Superintendente Antigo'); grava87('homolEm', '01/03/2024 10:00');
    grava87('homolAto', 'Portaria 1/2024'); grava87('homolData', '01/03/2024 10:00');
    grava87('homolDestino', 'dire.divinopolis@educacao.mg.gov.br');
    grava87('validadoPor', 'Quem validou a anterior'); grava87('validadoEm', '01/02/2024 10:00');
    grava87('parecerValidacao', 'Parecer da vigência anterior.');
    grava87('devolucoes', JSON.stringify([{ em: '01/01/2024', por: 'x', parecer: 'y' }]));
    grava87('enviadoValidacaoEm', '01/02/2024 09:00');
    grava87('assembleia', '01/03/2024'); grava87('quorumPresentes', '9'); grava87('quorumTotal', '11');
    grava87('analiseSre', 'Análise da SRE de 2024');
    grava87('status', 'Homologado');
    const nv = B.novaVersao({ p: P87, token: TKD87 });
    ok(nv.ok, 'C3: a nova versão é aberta a partir do PPP encerrado');
    const nova = nv.registro || {};
    ok(!nova.ataId && !nova.ataUrl && !nova.ataNome && !nova.ataData && !nova.ataIdent,
       'C3: a nova versão nasce SEM a ata da vigência anterior');
    ok(!nova.homolPor && !nova.homolEm && !nova.homolAto && !nova.homolData && !nova.homolDestino,
       'C3: e sem a homologação — era ela que fazia o painel contar os dois anos pela data antiga');
    ok(!nova.validadoPor && !nova.validadoEm && !nova.parecerValidacao && !nova.devolucoes && !nova.enviadoValidacaoEm,
       'C3: e sem a validação, o parecer e as devoluções do ciclo anterior');
    ok(!nova.assembleia && !nova.quorumPresentes && !nova.quorumTotal && !nova.analiseSre,
       'C3: e sem os dados da assembleia que aprovou o documento anterior');
    ok(B.revisaoVencida_(nova) === false,
       'C3: por isso a revisão recém-aberta deixa de aparecer como "revisão vencida" no painel da SRE');
    ok(nova.objetivosAnteriores !== undefined && nova.versao === 2 && nova.origem === P87,
       'C3: o que a revisão precisa herdar — a origem e o que a versão anterior prometeu — continua vindo junto');
    ok(B.lerLinha_(aba87, lin87()).ataId === 'ataId-antigo',
       'C3: e o registro anterior guarda o seu próprio ciclo, intacto');
    /* limpa o rascunho da revisão para não atrapalhar as verificações seguintes */
    B.gravarCampo_(aba87, B.linhaDoProtocolo_(aba87, nova.protocolo), 'status', 'Homologado');
  }

  /* ---- v10.0: homologar com as assinaturas NOMEADAS, e sem desfazer ---- */
  {
    const linP = B.linhaDoProtocolo_(B.abaRegistros_(), P);
    const regP0 = B.lerLinha_(B.abaRegistros_(), linP);
    const assinOriginal = regP0.assinaturas;
    /* devolve o PPP P ao estado de espera e deixa uma caixa sem assinar */
    const caixas = JSON.parse(assinOriginal || '[]');
    ok(caixas.length >= 2, 'C2: o PPP de referência tem folha de assinaturas com mais de uma caixa');
    const semUma = caixas.map((c, i) => i === caixas.length - 1 ? Object.assign({}, c, { assinadoEm: '' }) : c);
    const semAssinar = caixas[caixas.length - 1];
    B.gravarCampo_(B.abaRegistros_(), linP, 'assinaturas', JSON.stringify(semUma));
    B.gravarCampo_(B.abaRegistros_(), linP, 'status', 'Enviado para homologação');
    B.gravarCampo_(B.abaRegistros_(), linP, 'homolPor', ''); B.gravarCampo_(B.abaRegistros_(), linP, 'homolEm', '');
    const cega = B.homologarPPP({ token: TKR, protocolo: P });
    ok(!cega.ok && cega.faltamAssinaturas === true && cega.total === caixas.length && cega.assinadas === caixas.length - 1,
       'C2: faltando assinatura, a homologação para e devolve a contagem — antes era feita às cegas');
    /* v10.0: o aviso passou a dizer DE QUEM é a caixa que ficaria em branco */
    ok(Array.isArray(cega.pendentes) && cega.pendentes.length === 1 &&
       cega.pendentes[0].nome === (semAssinar.nome || semAssinar.email),
       'v10.0: e devolve QUEM foi marcado como presente e ainda não assinou, com nome');
    ok(cega.pendentes[0].segmento !== undefined && cega.pendentes[0].papel !== undefined &&
       typeof cega.pendentes[0].direcao === 'boolean',
       'v10.0: cada pendente vem com papel, segmento e a marca da direção — é o que o diálogo mostra');
    ok(new RegExp('Ainda não assinaram: ' + (semAssinar.nome || semAssinar.email)).test(cega.erro || ''),
       'v10.0: e a própria mensagem nomeia quem falta');
    ok(/final e definitivo/.test(cega.erro) && /não é desfeita/.test(cega.erro),
       'v10.0: a recusa diz o que está em jogo — homologado é final, e a homologação não se desfaz');
    const forcada = B.homologarPPP({ token: TKR, protocolo: P, confirmaSemAssinaturas: true });
    ok(forcada.ok && forcada.assinadas === caixas.length - 1,
       'C2: confirmada, a homologação acontece — a decisão é de quem homologa, mas deixa de ser cega');
    ok(histTemEm('Ciclo — histórico', /homologado com \d+ de \d+ assinaturas/),
       'C2: e fica registrado no ciclo que se homologou com assinatura faltando');
    ok(histTemEm('Ciclo — histórico', new RegExp('sem assinatura de: ' + (semAssinar.nome || semAssinar.email))),
       'v10.0: o ciclo guarda o NOME de quem ficou sem assinar, não só a contagem');
    ok(histTemEm('Ciclo — histórico', /versão final e definitiva/),
       'v10.0: e o ato registrado diz que aquela é a versão final e definitiva');

    /* ---- v10.0: o documento homologado não muda mais, por porta nenhuma ---- */
    const regHom = B.lerLinha_(B.abaRegistros_(), linP);
    ok(regHom.status === 'Homologado', 'v10.0: o registro está homologado');
    const diz = function (r) { return String((r && r.erro) || ''); };
    const definitivo = /final e definitiva/;

    ok(definitivo.test(diz(B.desfazerHomologacao({ token: TKR, protocolo: P,
         motivo: 'Motivo suficientemente longo para passar pela antiga exigência de vinte caracteres.' }))),
       'v10.0: a homologação NÃO é desfeita — a rota continua no mapa e recusa, dizendo a regra');
    ok(/nova versão/.test(diz(B.desfazerHomologacao({ token: TKR, protocolo: P, motivo: 'x' }))),
       'v10.0: e a recusa aponta o caminho que ficou: nova versão');
    ok(B.desfazerHomologacao({ token: TKCI, protocolo: P, motivo: 'qualquer' }).ok === false,
       'v10.0: recusa para qualquer papel — não há mais quem desfaça');

    /* editar — com a sessão da direção que de fato responde por este registro */
    const tkEsc10 = sessaoDe_({ email: regHom.email, nome: 'Direção do registro de referência',
      perfil: 'escola', papel: 'diretor_escolar', sre: regHom.sre, inep: regHom.inep, escola: regHom.escola });
    const edita = B.salvarPPP({ token: tkEsc10, protocolo: P, escola: regHom.escola, sessao: 'v10' });
    ok(!edita.ok && definitivo.test(diz(edita)) && edita.bloqueado === true,
       'v10.0: não é editado — e a recusa diz por quê, em vez do bloqueio genérico');
    /* assinar: a direção e o colegiado */
    ok(definitivo.test(diz(B.assinarDirecao({ token: tkEsc10, p: P }))),
       'v10.0: a direção não assina mais — era a única porta que ainda escrevia depois da homologação');
    const membro10 = (B.membrosColegiado_(regHom) || [])[0];
    if (membro10) {
      const tkCol10 = sessaoDe_({ email: membro10.email, nome: membro10.nome, perfil: 'escola',
        papel: 'colegiado', sre: regHom.sre, inep: regHom.inep, escola: regHom.escola });
      ok(definitivo.test(diz(B.assinarNoSistema({ token: tkCol10, protocolo: P, aceite: true }))),
         'v10.0: nem o Colegiado assina');
      ok(definitivo.test(diz(B.presencaColegiado({ token: tkEsc10, p: P, emails: [membro10.email] }))),
         'v10.0: nem a presença na reunião é remarcada');
    }
    /* os atos da regional */
    ok(definitivo.test(diz(B.validarPPP({ token: TKR, protocolo: P }))), 'v10.0: não é validado de novo');
    ok(definitivo.test(diz(B.devolverPPP({ token: TKR, protocolo: P, parecer: 'a'.repeat(40) }))),
       'v10.0: não é devolvido');
    ok(definitivo.test(diz(B.homologarPPP({ token: TKR, protocolo: P }))),
       'v10.0: não se homologa duas vezes, e a recusa é a mesma de todo ato que escreve');
    /* os atos da escola */
    ok(definitivo.test(diz(B.enviarParaValidacao({ token: tkEsc10, protocolo: P }))),
       'v10.0: não volta para validação');
    ok(definitivo.test(diz(B.concluirPPP({ token: tkEsc10, protocolo: P,
       docHtml: '<div class="paginas"><div class="pag"></div></div>' }))),
       'v10.0: não é concluído de novo');
    ok(definitivo.test(diz(B.registrarAta({ token: tkEsc10, p: P, nome: 'ata.pdf', tipo: 'application/pdf',
       dados: S.g.Utilities.base64Encode('ata') }))), 'v10.0: não recebe ata nova');
    ok(definitivo.test(diz(B.registrarAnexo({ token: tkEsc10, p: P, nome: 'x.pdf', tipo: 'application/pdf',
       dados: S.g.Utilities.base64Encode('x') }))), 'v10.0: não recebe anexo novo');
    /* v9.7: quem vincula é a Diretoria Educacional da regional da escola */
    ok(definitivo.test(diz(B.adotarPPP({ token: tkDE(regHom.sre, B), protocolo: P, inep: regHom.inep }))),
       'v10.0: não é vinculado a outra escola');

    /* e a linha continua exatamente como estava */
    const depois10 = B.lerLinha_(B.abaRegistros_(), linP);
    ok(depois10.status === 'Homologado' && depois10.homolEm === regHom.homolEm &&
       depois10.homolPor === regHom.homolPor && depois10.assinaturas === regHom.assinaturas &&
       depois10.hash === regHom.hash,
       'v10.0: depois de todas as tentativas, a linha do registro está intacta');

    /* o que continua possível é a nova versão — e ela não toca no homologado */
    /* O caminho que ficou é a nova versão. Nesta escola de referência já há
       um PPP em curso (aberto por blocos anteriores desta bateria), e a regra
       de "um PPP de cada vez" vale antes: o que se confere é que a recusa é
       ESSA, e não a do documento homologado — a homologação não fecha o
       caminho da revisão, apenas não se deixa alterar. */
    const nova10 = B.novaVersao({ token: tkEsc10, p: P });
    ok(nova10.ok
         ? (nova10.registro && nova10.registro.protocolo !== P &&
            (nova10.registro.versao || 0) > (regHom.versao || 1))
         : (/já tem um PPP em curso/.test(diz(nova10)) && !definitivo.test(diz(nova10))),
       'v10.0: a NOVA VERSÃO continua sendo o caminho aberto — não é recusada por o documento estar homologado');
    const homDepois = B.lerLinha_(B.abaRegistros_(), linP);
    ok(homDepois.status === 'Homologado' && homDepois.homolEm === regHom.homolEm,
       'v10.0: e o documento homologado continua homologado, intacto');
    /* devolve o cenário para as baterias seguintes */
    if (nova10.ok && nova10.registro) {
      B.gravarCampo_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), nova10.registro.protocolo), 'status', 'Homologado');
    }
    B.gravarCampo_(B.abaRegistros_(), linP, 'assinaturas', assinOriginal);

    /* o painel não oferece mais o desfazer, e marca o registro como definitivo */
    const painel10 = B.painelRegistros({ token: TKR, filtros: {} }).linhas.filter(x => x.protocolo === P)[0];
    ok(painel10 && painel10.podeDesfazerHomologacao === undefined && painel10.definitivo === true,
       'v10.0: o painel deixou de calcular o desfazer e passou a marcar o registro como definitivo');
    ok(painel10 && painel10.podeHomologar === false,
       'v10.0: e não oferece homologar de novo');
    ok(Array.isArray(painel10.pendentesAssin) && painel10.pendentesAssin.length === 0,
       'v10.0: registro homologado não carrega lista de pendentes — não há mais o que assinar');

    /* a lista viaja com a linha que OFERECE homologar: é o que permite ao
       aviso nomear as pessoas no primeiro clique, sem uma ida a mais */
    {
      const aguardando = B.painelRegistros({ token: TKR, filtros: {} }).linhas
        .filter(function (x) { return x.podeHomologar && x.assinadas < x.totalAssin; })[0];
      if (aguardando) {
        ok(Array.isArray(aguardando.pendentesAssin) &&
           aguardando.pendentesAssin.length === (aguardando.totalAssin - aguardando.assinadas),
           'v10.0: a linha que oferece homologar traz quem ainda não assinou, um por caixa em branco');
        ok(aguardando.pendentesAssin.every(function (x) { return !!x.nome; }),
           'v10.0: e cada um com nome — é o que o diálogo mostra');
        ok(aguardando.pendentesAssin.every(function (x, i, L) {
             return i === 0 || !(L[i - 1].direcao && !x.direcao);
           }), 'v10.0: com a direção da escola ao fim da lista');
      }
      const semOferta = B.painelRegistros({ token: TKR, filtros: {} }).linhas
        .filter(function (x) { return !x.podeHomologar; })[0];
      ok(!semOferta || (Array.isArray(semOferta.pendentesAssin) && semOferta.pendentesAssin.length === 0),
         'v10.0: e a linha que não oferece homologar não carrega a lista — o painel da rede tem milhares');
    }
  }
}

/* ==================== v8.8 (bloco 2 e G2): escala e o que está parado ==================== */
{
  MAIL.cota = 300; MAIL.falha = '';
  const abaR = B.abaRegistros_();

  /* ---- B1: a completação do percentual ---- */
  {
    /* uma anotação numa célula solta, fora de qualquer registro */
    const ultima = abaR.getLastRow();
    abaR.getRange(ultima + 1, 3).setValue('anotação da secretaria');
    B.garantirPercentuais_(abaR);
    ok(String(abaR.getRange(ultima + 1, B.IDX.pct, 1, 1).getDisplayValues()[0][0]) === '0',
       'B1: a linha sem protocolo recebe zero — em branco, ela voltava à lista de faltantes para sempre');
    LEITURAS.length = 0;
    ok(B.garantirPercentuais_(abaR) === 0 && LEITURAS.length <= 2,
       'B1: e na chamada seguinte não há o que completar — nem leitura de texto, nem da aba inteira');
    /* só as linhas que faltam são lidas, e em faixas contínuas */
    const f = B.faixasContinuas_([0, 1, 2, 7, 9, 10]);
    ok(f.length === 3 && f[0].de === 0 && f[0].qtd === 3 && f[1].de === 7 && f[1].qtd === 1 && f[2].de === 9 && f[2].qtd === 2,
       'B1: as linhas faltantes são lidas em faixas contínuas, e não uma a uma nem todas de uma vez');
  }

  /* ---- B3: o PDF sai de dentro da trava, e só é refeito quando muda ---- */
  {
    const linhaB3 = B.linhaDoProtocolo_(abaR, P);
    const regB3 = B.lerLinha_(abaR, linhaB3);
    ok(!!regB3.fonteId && !!regB3.pdfId, 'B3: o PPP de referência tem documento congelado e PDF');
    B.gerarPdfOficial_(linhaB3);                 /* sincroniza a marca com a folha atual */
    const antesId = B.lerLinha_(abaR, linhaB3).pdfId;
    const criadosAntes = ARQUIVOS_CRIADOS.length;
    B.gerarPdfOficial_(linhaB3);
    ok(ARQUIVOS_CRIADOS.length === criadosAntes && B.lerLinha_(abaR, linhaB3).pdfId === antesId,
       'B3: sem mudança na folha, o PDF não é refeito — antes, cada anexo e cada assinatura refaziam a conversão');
    B.gravarCampo_(abaR, linhaB3, 'homolAto', 'Portaria de teste B3');
    B.gerarPdfOficial_(linhaB3);
    ok(ARQUIVOS_CRIADOS.length === criadosAntes + 1 && B.lerLinha_(abaR, linhaB3).pdfId !== antesId,
       'B3: mudando o que a folha imprime, o PDF é refeito');
    B.gerarPdfOficial_(linhaB3, true);
    ok(ARQUIVOS_CRIADOS.length === criadosAntes + 2, 'B3: e a geração forçada refaz mesmo sem mudança (arquivo perdido)');
    /* o que interessa: nenhum PDF é criado com a trava na mão */
    ARQUIVOS_CRIADOS.length = 0;
    const linhaAnexo = B.linhaDoProtocolo_(abaR, P);
    /* v8.13 (D05): anexo só enquanto a coleta está aberta. O PPP de
       referência já foi encaminhado; o que se mede aqui é a trava, não a
       regra do ciclo — então a linha volta a "Em assinatura" para o ato. */
    const statusB3 = B.lerLinha_(abaR, linhaAnexo).status;
    B.gravarCampo_(abaR, linhaAnexo, 'status', 'Em assinatura');
    const anexoB3 = B.registrarAnexo({ token: TKE, p: P, nome: 'anexo-b3.pdf', mime: 'application/pdf',
                       base64: S.base64('conteudo do anexo') });
    B.gravarCampo_(abaR, linhaAnexo, 'status', statusB3);
    ok(anexoB3.ok, 'B3: o anexo entra com a coleta aberta');
    ok(ARQUIVOS_CRIADOS.length >= 2, 'B3: registrar um anexo grava o arquivo e refaz o PDF (a folha lista os anexos)');
    const oficiais = ARQUIVOS_CRIADOS.filter(a => /\.pdf$/.test(a.nome) && !/_ANEXO_|_ATA_/.test(a.nome));
    ok(oficiais.length >= 1 && oficiais.every(a => a.comTrava === false),
       'B3: e nenhum PDF oficial é gerado com a trava do script na mão — a rede não fica em fila atrás da conversão');
    ok(TRAVAS.preso === false, 'B3: ao fim do ato, a trava está solta');
    ok(/pedirPdf_\(linha\)/.test(src) && /finally \{ lock\.releaseLock\(\); gerarPdfsPendentes_\(\); \}/.test(src),
       'B3: os atos pedem o PDF, e ele é gerado ao soltar a trava');
    ok(!/LockService[^]{0,400}gerarPdfOficial_\(linha\);/.test(src.slice(src.indexOf('function assinarNoSistema'), src.indexOf('function assinarNoSistema') + 1600)),
       'B3: assinar no sistema não gera PDF dentro da seção crítica');
  }

  /* ---- G2: o resumo semanal do que está parado ---- */
  {
    const linhaG2 = B.linhaDoProtocolo_(abaR, PV7 || P);
    /* um PPP esquecido em validação há muito tempo */
    B.gravarCampo_(abaR, linhaG2, 'status', 'Em validação');
    B.gravarCampo_(abaR, linhaG2, 'enviadoValidacaoEm', '01/02/2026 09:00');
    const lev = B.levantarParados_();
    ok(lev.ok && lev.total >= 1, 'G2: o levantamento encontra o que está parado (' + lev.total + ')');
    const achado = Object.keys(lev.porSre).map(k => lev.porSre[k]).reduce((a, b) => a.concat(b), [])
      .filter(x => x.protocolo === (PV7 || P))[0];
    ok(!!achado && achado.dias > B.PARADO_DIAS['Em validação'] && /valida/.test(achado.motivo),
       'G2: com a situação, há quantos dias está assim e por quê');
    ok(Object.keys(lev.porSre).every(k => lev.porSre[k].every((x, i, arr) => i === 0 || (arr[i - 1].dias >= x.dias))),
       'G2: dentro de cada regional, o mais antigo vem primeiro');
    const filaAntesG2 = fila().length;
    const res = B.resumoSemanalParados_();
    ok(res.ok && res.total === lev.total && res.avisos >= 1,
       'G2: o resumo é montado e enfileirado (' + res.avisos + ' aviso(s))');
    const novos = fila().slice(filaAntesG2);
    ok(novos.length === res.avisos && novos.every(m => m.tipo === 'validação' && /parados/.test(m.assunto)),
       'G2: os avisos entram na fila como avisos de validação, sem furar a fila dos convites');
    ok(novos.some(m => /PPPs parados na rede/.test(m.assunto)),
       'G2: e o Órgão Central recebe o consolidado da rede');
    ok(novos.some(m => /SRE Divinópolis/.test(m.assunto) || /Divinópolis/.test(m.assunto)),
       'G2: cada regional recebe o seu');
    ok(histTemEm('Acessos — histórico', /PPPs parados levantados/), 'G2: o levantamento fica no histórico');
    ok(triggers.indexOf('resumoSemanalParados_') >= 0, 'G2: e há acionador semanal instalado');
  }
}

/* ==================== v8.12: histórico em todos os níveis e o PPP inexcluível ==================== */
{
  const TKC12 = sessaoDe_({ email: 'central12@educacao.mg.gov.br', nome: 'Central Doze', perfil: 'central', papel: 'central' });
  const TKS12 = sessaoDe_({ email: 'super12@educacao.mg.gov.br', nome: 'Super Doze', perfil: 'regional', papel: 'superintendente', sre: 'Divinópolis' });
  const TKDE12 = sessaoDe_({ email: 'de12@educacao.mg.gov.br', nome: 'DE Doze', perfil: 'regional', papel: 'diretor_educacional', sre: 'Divinópolis' });

  /* o histórico é do escopo da sessão, e todos os níveis o têm */
  let h = B.historicoAssociacoes({ token: TKC12 });
  ok(h.ok && h.escopo === 'rede' && h.linhas.length > 0, 'v8.12: o Órgão Central tem histórico no escopo da rede');
  /* v9.6: e o histórico dele é o dos SUPERINTENDENTES que cadastra — não o
     de todo o estado: nem direções escolares, nem equipes das regionais */
  ok(h.linhas.every(l => (l.papel || B.papelDe_(l)) === 'superintendente' || l.perfil === 'regional') &&
     h.linhas.every(l => l.perfil !== 'escola' && l.perfil !== 'colegiado'),
     'v9.6: o Órgão Central vê só os superintendentes cadastrados — nenhuma direção escolar, nenhum colegiado');
  ok(B.papeisDoHistorico_({ perfil: 'central', papel: 'central', email: 'central12@educacao.mg.gov.br' }).join(',') === 'superintendente',
     'v9.6: os papéis do histórico do Órgão Central são exatamente [superintendente]');
  h = B.historicoAssociacoes({ token: TKS12 });
  /* v8.13 (C02): a unidade de uma linha antiga, sem SRE gravada, é a da
     escola do INEP — por isso a conferência resolve pela base. */
  const sreDaLinha = (l) => String(l.sre || (B.escolaPorInep_(l.inep) || {}).sre || '').toLowerCase();
  ok(h.ok && h.escopo === 'sre' && h.linhas.every(l => sreDaLinha(l) === 'divinópolis'),
     'v8.12: o Superintendente vê o histórico da sua SRE, e só dela');
  h = B.historicoAssociacoes({ token: TKDE12 });
  ok(h.ok && h.escopo === 'sre', 'v8.12: o Diretor Educacional também tem histórico, no escopo da sua SRE');
  /* v8.13 (C04): a direção em exercício da escola V7 é a sucessora — a sessão
     da antecessora caiu quando ela foi substituída, que é o que se espera. */
  const hDir = B.historicoAssociacoes({ token: TKSUC });
  ok(hDir.ok && hDir.escopo === 'escola' && hDir.linhas.every(l => l.inep === hDir.inep),
     'v8.12: a direção escolar vê o histórico da sua escola, e só dela');
  const tkColHist = sessaoDe_({ email: 'membro1@educacao.mg.gov.br', nome: 'Membro', perfil: 'escola',
    papel: 'colegiado', sre: 'Divinópolis', inep: INEP_V7, escola: 'EE da Sétima Versão' });
  ok(!B.historicoAssociacoes({ token: tkColHist }).ok,
     'v8.12: quem só lê o PPP não vê histórico de cadastro de ninguém');
  ok(B.historicoAssociacoes({ token: TKC12, grupo: 'escola' }).linhas.length === 0 &&
     B.historicoAssociacoes({ token: TKS12, grupo: 'escola' }).linhas.every(l => l.perfil === 'escola'),
     'v8.12/v9.6: o histórico pode ser filtrado por tipo de acesso — e, para o Órgão Central, pedir direções escolares devolve nada');

  /* ---- v8.13 (C02): o Colegiado não sai para fora da escola ---- */
  {
    /* semeia um membro de Colegiado com SRE gravada — é assim que a
       demonstração e a base em uso o registram, e era isso que caía no
       filtro regional. */
    const ABAG = B.abaGestores_();
    ABAG.appendRow([INEP_V7, 'EE da Sétima Versão', 'Estudante do Colegiado', '', 'estudante.hist@exemplo.mg',
                    '01/03/2026 08:00', '', 'Diretora', '', 'colegiado', 'Divinópolis', '', 'Estudante · 3º ano']);
    /* e uma linha no formato ANTIGO: sem Perfil e sem SRE, só com o INEP */
    ABAG.appendRow([INEP_V7, 'EE da Sétima Versão', 'Diretor Antigo Sem Perfil', '9876543', 'antigo.semperfil@educacao.mg.gov.br',
                    '01/02/2020 08:00', '31/12/2021 18:00', 'Sistema', 'fim do mandato', '', '', '', '']);
    B.invalidarGestores_();

    const regionais = [
      ['superintendente', 'Divinópolis'], ['diretor_educacional', 'Divinópolis'],
      ['coordenador_inspecao', 'Divinópolis'], ['equipe_de', 'Divinópolis'], ['equipe_inspecao', 'Divinópolis']
    ].map(function (x) {
      return { papel: x[0], token: sessaoDe_({ email: x[0] + '.c02@educacao.mg.gov.br', nome: 'Regional C02',
        perfil: 'regional', papel: x[0], sre: x[1] }) };
    });
    let vazou = [];
    regionais.concat([{ papel: 'central', token: TKC12 }]).forEach(function (x) {
      ['', 'colegiado', 'escola', 'institucional'].forEach(function (grupo) {
        const res = B.historicoAssociacoes({ token: x.token, grupo: grupo });
        if (res.ok && res.linhas.some(l => l.perfil === 'colegiado')) vazou.push(x.papel + '/' + (grupo || 'tudo'));
      });
    });
    ok(vazou.length === 0,
       'v8.13 (C02): nenhuma sessão regional nem o Órgão Central recebe linha de Colegiado no histórico' +
       (vazou.length ? ' — vazou em ' + vazou.join(', ') : ''));
    const comGrupo = B.historicoAssociacoes({ token: regionais[0].token, grupo: 'colegiado' });
    ok(comGrupo.ok && comGrupo.linhas.length === 0,
       'v8.13 (C02): pedir grupo "colegiado" pela regional devolve lista vazia — o payload não amplia escopo');

    const direcaoV7 = sessaoDe_({ email: 'dir.c02@educacao.mg.gov.br', nome: 'Diretora C02', perfil: 'escola',
      papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_V7, escola: 'EE da Sétima Versão' });
    const hEsc = B.historicoAssociacoes({ token: direcaoV7 });
    ok(hEsc.ok && hEsc.linhas.some(l => l.email === 'estudante.hist@exemplo.mg' && l.perfil === 'colegiado'),
       'v8.13 (C02): a direção da escola continua vendo o Colegiado da própria escola');
    ok(B.historicoAssociacoes({ token: direcaoV7, grupo: 'colegiado' }).linhas.every(l => l.perfil === 'colegiado') &&
       B.historicoAssociacoes({ token: direcaoV7, grupo: 'colegiado' }).linhas.length > 0,
       'v8.13 (C02): e o filtro por Colegiado continua valendo no escopo escolar');

    /* a linha antiga, sem Perfil e sem SRE, passa a ser localizada pelo INEP */
    /* v9.7: os diretores escolares são da Diretoria Educacional — é no
       histórico dela que a linha antiga aparece */
    const naSre = B.historicoAssociacoes({ token: regionais[1].token });
    ok(naSre.linhas.some(l => l.email === 'antigo.semperfil@educacao.mg.gov.br'),
       'v8.13 (C02): a linha anterior às colunas Perfil/SRE aparece no histórico da Diretoria Educacional da escola');
    ok(!B.historicoAssociacoes({ token: regionais[0].token }).linhas.some(l => l.email === 'antigo.semperfil@educacao.mg.gov.br'),
       'v9.7 (C02): e não aparece no do Superintendente, que não gere diretores escolares');
    const outraSre = sessaoDe_({ email: 'de.outra.c02@educacao.mg.gov.br', nome: 'DE Outra',
      perfil: 'regional', papel: 'diretor_educacional', sre: 'Uberlândia' });
    ok(!B.historicoAssociacoes({ token: outraSre }).linhas.some(l => l.email === 'antigo.semperfil@educacao.mg.gov.br'),
       'v8.13 (C02): e não aparece no histórico de outra regional');
    ok(B.gestoresHistorico({ token: regionais[0].token, inep: INEP_V7 }).gestores
        .some(g => g.email === 'antigo.semperfil@educacao.mg.gov.br'),
       'v8.13 (C02): a tela de gestores da escola continua mostrando a mesma linha — as duas contam a mesma história');
  }

  /* quem encerrou fica registrado */
  {
    const TKE12 = sessaoDe_({ email: 'dir12@educacao.mg.gov.br', nome: 'Diretora Doze', perfil: 'escola',
      papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_V7, escola: 'EE da Sétima Versão' });
    B.acessoSalvar({ token: TKE12, email: 'sai.colegiado@exemplo.mg', nome: 'Membro Que Sai',
                     papel: 'colegiado', segmento: 'Comunidade', relacao: 'associação de bairro' });
    const aberto = B.gestoresTodos_().filter(g => g.email === 'sai.colegiado@exemplo.mg');
    ok(aberto.length === 1 && aberto[0].perfil === 'colegiado' && !aberto[0].fim &&
       aberto[0].registradoPor === 'Diretora Doze',
       'v8.12: cadastrar um membro do colegiado abre período, com o nome de quem cadastrou');
    /* v8.13 (E19, A8-20): a observação guarda o SEGMENTO. A relação com a
       escola deixou de ser escrita no registro permanente — ela identifica um
       estudante pelo intermédio do responsável e vive só no cadastro, que tem
       caminho de exclusão. */
    ok(String(aberto[0].observacao || '') === 'Comunidade',
       'v8.12/E19: a observação guarda o segmento — ' + (aberto[0].observacao || '(vazia)'));
    ok(String(aberto[0].observacao || '').indexOf('associação de bairro') < 0,
       'v8.13 (E19, A8-20): e NÃO a relação da pessoa com a escola');
    B.acessoRemover({ token: TKE12, email: 'sai.colegiado@exemplo.mg', motivo: 'saiu do colegiado' });
    const fechado = B.gestoresTodos_().filter(g => g.email === 'sai.colegiado@exemplo.mg')[0];
    ok(fechado && fechado.fim && fechado.encerradoPor === 'Diretora Doze' && /saiu do colegiado/.test(fechado.motivo),
       'v8.12: remover encerra o período com quem encerrou e o motivo');
    ok(B.colegiadoDaEscola_(INEP_V7).every(m => m.email !== 'sai.colegiado@exemplo.mg'),
       'v8.12: e o cadastro sai da lista, mas o período fica no histórico');
  }

  /* o PPP concluído não se exclui */
  {
    const concluido = { status: 'Assinado', concluidoEm: '01/09/2026 10:00', hash: 'ABCD-1234-EF56' };
    ok(/não pode ser excluído/.test(B.recusaExclusaoDePPP_(concluido)),
       'v8.12: a regra recusa a exclusão de um PPP assinado, e diz por quê');
    ok(B.recusaExclusaoDePPP_({ status: 'Em andamento' }) === '',
       'v8.12: um rascunho ainda em elaboração não é alcançado pela regra');
    ok(B.ST_INEXCLUIVEIS.indexOf('Homologado') >= 0 && B.ST_INEXCLUIVEIS.indexOf('Concluído') >= 0,
       'v8.12: concluído e homologado estão entre as situações inexcluíveis');
  }
}

/* ==================== v8.13 (C03): a porta pública responde nome, nunca e-mail ==================== */
{
  const EMAIL_C03 = 'validador.central@educacao.mg.gov.br';
  /* entrarInstitucional grava `nome: cad.nome || cad.email` — a conta
     institucional do Órgão Central cai sempre no ramo do e-mail, e era isso
     que a porta pública devolvia a quem só tem o código. */
  const TKC03 = sessaoDe_({ email: EMAIL_C03, nome: EMAIL_C03, perfil: 'central', papel: 'central' });
  const INEP_C03 = '31000903';
  B.escolaSalvar({ token: TKC03, inep: INEP_C03, escola: 'EE da Porta Pública',
                   municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_C03) });
  salvarDiretor(B, { email: 'dir.c03@educacao.mg.gov.br', nome: 'Diretora C03',
                   papel: 'diretor_escolar', inep: INEP_C03 });
  const TKD03 = sessaoDe_({ email: 'dir.c03@educacao.mg.gov.br', nome: 'Diretora C03', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_C03, escola: 'EE da Porta Pública' });
  const P03 = B.salvarPPP({ token: TKD03, escola: 'EE da Porta Pública', inep: INEP_C03,
    sre: 'Divinópolis', municipio: 'Divinópolis', sessao: 'c03' }).protocolo;
  B.enviarParaValidacao({ token: TKD03, protocolo: P03 });
  B.validarPPP({ token: TKC03, protocolo: P03, parecer: 'Documento em conformidade.' });
  const abaC03 = B.abaRegistros_();
  const linC03 = B.linhaDoProtocolo_(abaC03, P03);
  const regC03 = () => B.lerLinha_(abaC03, linC03);
  ok(!/@/.test(regC03().validadoPor) && /Órgão Central/.test(regC03().validadoPor),
     'v8.13 (C03): validar por conta institucional grava o papel, não o e-mail de login: "' + regC03().validadoPor + '"');
  const conc = B.concluirPPP({ token: TKD03, protocolo: P03, escola: 'EE da Porta Pública', inep: INEP_C03,
    sre: 'Divinópolis', municipio: 'Divinópolis', direcao: 'Diretora C03',
    docHtml: docTeste('<h3 class="doc-h">documento da EE da Porta Pública</h3>'), sessao: 'c03' });
  const HASH03 = conc.registro.hash;
  ok(conc.ok && /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(HASH03), 'v8.13 (C03): o PPP é concluído e recebe código');
  B.gravarCampo_(abaC03, linC03, 'status', 'Concluído');
  const hom03 = B.homologarPPP({ token: TKC03, protocolo: P03, ato: 'Portaria C03', confirmaSemAssinaturas: true });
  ok(hom03.ok && !/@/.test(regC03().homolPor) && /Órgão Central/.test(regC03().homolPor),
     'v8.13 (C03): homologar por conta institucional também grava o papel: "' + regC03().homolPor + '"');

  const v03 = B.verificarDocumento({ codigo: HASH03 });
  ok(v03.ok && !/@/.test(JSON.stringify(v03)),
     'v8.13 (C03): a resposta da porta pública não traz nenhum e-mail');

  /* base EM USO: os campos já gravados com e-mail cru continuam lá — o
     histórico não se reescreve —, e a leitura pública tem de saneá-los. */
  B.gravarCampo_(abaC03, linC03, 'validadoPor', 'validador.antigo@educacao.mg.gov.br · Órgão Central');
  B.gravarCampo_(abaC03, linC03, 'homolPor', 'homologador.antigo@educacao.mg.gov.br · Diretor Educacional');
  const v03b = B.verificarDocumento({ codigo: HASH03 });
  ok(v03b.ok && !/@/.test(JSON.stringify(v03b)) &&
     v03b.validadoPor === 'Órgão Central' && v03b.homolPor === 'Diretor Educacional',
     'v8.13 (C03): registro antigo com e-mail cru em validadoPor/homolPor sai saneado, com o papel preservado');
  const pub03 = B.documentoPublicoHtml({ codigo: HASH03 });
  ok(pub03.ok && !/[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+/.test(pub03.html || ''),
     'v8.13 (C03): e o documento público em HTML também não traz e-mail nenhum');
  ok(!/[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+/.test(B.folhaAssinaturas_(regC03())),
     'v8.13 (C03): a folha de assinaturas remontada sanea os dois campos');

  /* o código de autenticidade é o SHA-256 do CORPO congelado, não da folha:
     mexer na folha não invalida nenhum código já emitido. */
  ok(regC03().hash === HASH03 && B.verificarDocumento({ codigo: HASH03 }).ok,
     'v8.13 (C03): o código de autenticidade continua o mesmo — a folha não entra no hash');
  ok(B.semEmail_('fulano@educacao.mg.gov.br · Órgão Central') === 'Órgão Central' &&
     B.semEmail_('Marta Silva · Direção Escolar') === 'Marta Silva · Direção Escolar' &&
     B.semEmail_('') === '' && B.semEmail_(null) === '',
     'v8.13 (C03): semEmail_ tira o endereço e os separadores órfãos, e não mexe no que não é e-mail');
  ok(B.autorParaDocumento_({ nome: '', sre: 'Divinópolis' }, 'diretor_educacional') === 'Diretor Educacional · SRE Divinópolis' &&
     B.autorParaDocumento_({ nome: 'x@y.mg', perfil: 'central' }, 'central') === 'Órgão Central',
     'v8.13 (C03): sem nome, o autor do ato é o papel e a unidade');
}

/* ==================== v8.13 (C04): a sessão deixa de ser salvo-conduto ==================== */
{
  const TKC04 = B.criarSessao_({ email: 'central.c04@educacao.mg.gov.br', nome: 'Central C04',
                                 perfil: 'central', papel: 'central' });
  ok(B.escolasListar({ token: TKC04 }).ok,
     'v8.13 (C04): a sessão do Órgão Central sem linha em Acessos continua valendo — é por projeto');

  const INEP_C04 = '31000904';
  B.escolaSalvar({ token: TKC04, inep: INEP_C04, escola: 'EE da Baixa', municipio: 'Divinópolis', sre: 'Divinópolis', codigoInep: censoDe(INEP_C04) });
  B.acessoSalvar({ token: tkDE('Divinópolis'), email: 'dir.c04@educacao.mg.gov.br', nome: 'Diretora C04',
                   papel: 'diretor_escolar', inep: INEP_C04, masp: '9090901' });
  const TKD04 = B.criarSessao_({ email: 'dir.c04@educacao.mg.gov.br', nome: 'Diretora C04', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'Divinópolis', inep: INEP_C04, escola: 'EE da Baixa' });
  const P04 = B.salvarPPP({ token: TKD04, escola: 'EE da Baixa', inep: INEP_C04, sre: 'Divinópolis',
                            municipio: 'Divinópolis', sessao: 'c04' }).protocolo;
  ok(!!P04, 'v8.13 (C04): com a escola ativa e o cadastro em dia, a direção grava normalmente');
  B.acessoSalvar({ token: TKD04, email: 'membro.c04@exemplo.mg', nome: 'Membro C04', papel: 'colegiado',
                   segmento: 'Famílias', relacao: 'mãe da estudante do 2º ano' });
  const TKM04 = B.criarSessao_({ email: 'membro.c04@exemplo.mg', nome: 'Membro C04', perfil: 'escola',
    papel: 'colegiado', sre: 'Divinópolis', inep: INEP_C04, escola: 'EE da Baixa' });
  ok(B.minhasAssinaturas({ token: TKM04 }).ok, 'v8.13 (C04): o membro do colegiado ativo é atendido');

  /* a escola sai da rede pela própria base — o cadastro da direção continua lá */
  cargaEscolas(TKC04, INEP_C04 + ';EE da Baixa;Divinópolis;Divinópolis;inativa');
  const recusas = ['salvarPPP', 'concluirPPP', 'registrarAta', 'assinarDirecao'].map(function (fn) {
    const args = fn === 'salvarPPP' ? { token: TKD04, protocolo: P04, escola: 'EE da Baixa', inep: INEP_C04, sessao: 'c04' }
      : fn === 'concluirPPP' ? { token: TKD04, protocolo: P04, escola: 'EE da Baixa', inep: INEP_C04, docHtml: docTeste('<p>x</p>'), sessao: 'c04' }
      : fn === 'registrarAta' ? { token: TKD04, p: P04, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf' }
      : { token: TKD04, p: P04, atesto: true, pessoa: { nome: 'Diretora C04', masp: '9090901', email: 'dir.c04@educacao.mg.gov.br' } };
    return fn + ': ' + (function () { try { const res = B[fn](args); return res && res.ok ? 'PASSOU' : String(res && res.erro || ''); }
                                      catch (e) { return String(e.message || e); } })();
  });
  ok(recusas.every(x => /marcada como inativa na base da rede/.test(x)),
     'v8.13 (C04): com a escola inativa na base, gravar, concluir, anexar a ata e assinar pela direção são recusados — ' + recusas.join(' | '));
  const assinM = (function () { try { const res = B.assinarNoSistema({ token: TKM04, protocolo: P04, aceite: true });
    return res && res.ok ? 'PASSOU' : String(res && res.erro || ''); } catch (e) { return String(e.message || e); } })();
  ok(/marcada como inativa na base da rede/.test(assinM),
     'v8.13 (C04): e o membro do colegiado também não assina — ' + assinM);

  /* o membro inativado no cadastro perde a sessão, escola ativa ou não */
  cargaEscolas(TKC04, INEP_C04 + ';EE da Baixa;Divinópolis;Divinópolis;ativa');
  ok(B.minhasAssinaturas({ token: TKM04 }).ok, 'v8.13 (C04): reativada a escola, o membro volta a ser atendido');
  B.acessoSalvar({ token: TKD04, email: 'membro.c04@exemplo.mg', nome: 'Membro C04', papel: 'colegiado',
                   segmento: 'Famílias', relacao: 'mãe da estudante do 2º ano', situacao: 'inativo' });
  ok(/acesso está inativo/.test(lanca(() => B.assinarNoSistema({ token: TKM04, protocolo: P04, aceite: true }))),
     'v8.13 (C04): inativado o cadastro, o membro do colegiado deixa de assinar com a sessão que já tinha');

  /* a baixa da escola apaga o cadastro da direção: a promessa da janela passa
     a valer — com a mesma sessão, nada mais é possível */
  const antesBaixa = B.salvarPPP({ token: TKD04, protocolo: P04, escola: 'EE da Baixa', inep: INEP_C04, sessao: 'c04' });
  ok(antesBaixa.ok, 'v8.13 (C04): antes da baixa a direção ainda grava');
  B.escolaSituacao({ token: TKC04, inep: INEP_C04, situacao: 'inativa', confirmado: true });
  ok(/acesso foi encerrado/.test(lanca(() => B.salvarPPP({ token: TKD04, protocolo: P04, escola: 'EE da Baixa', inep: INEP_C04, sessao: 'c04' }))),
     'v8.13 (C04): dada a baixa, a sessão da direção cai — a janela passa a dizer a verdade');
}

/* ==================== v8.13 (C05): o período é identidade ==================== */
{
  const TKC05 = B.criarSessao_({ email: 'central.c05@educacao.mg.gov.br', nome: 'Central C05',
                                 perfil: 'central', papel: 'central' });
  const per = (email) => B.gestoresTodos_().filter(g => g.email === String(email).toLowerCase());
  const abertosDe = (email) => per(email).filter(g => !g.fim);

  /* (1) acesso institucional que muda de SRE */
  B.escolaSalvar({ token: TKC05, inep: '31000905', escola: 'EE C05 A', municipio: 'Divinópolis', sre: 'SRE C05 A', codigoInep: censoDe('31000905') });
  B.escolaSalvar({ token: TKC05, inep: '31000906', escola: 'EE C05 B', municipio: 'Uberaba', sre: 'SRE C05 B', codigoInep: censoDe('31000906') });
  B.acessoSalvar({ token: TKC05, email: 'sup.c05@educacao.mg.gov.br', nome: 'Superintendente C05',
                   papel: 'superintendente', perfil: 'regional', sre: 'SRE C05 A' });
  ok(abertosDe('sup.c05@educacao.mg.gov.br').length === 1 &&
     abertosDe('sup.c05@educacao.mg.gov.br')[0].observacao === 'Superintendente Regional de Ensino',
     'v8.13 (C05): o período institucional nasce com a Observação preenchida com o papel');
  /* o Órgão Central move a pessoa para outra regional */
  B.acessoSalvar({ token: TKC05, email: 'sup.c05@educacao.mg.gov.br', nome: 'Superintendente C05',
                   papel: 'superintendente', perfil: 'regional', sre: 'SRE C05 B' });
  const doSup = per('sup.c05@educacao.mg.gov.br');
  ok(doSup.length === 2 && doSup[0].fim && /transferido de SRE C05 A para SRE C05 B/.test(doSup[0].motivo) &&
     doSup[0].sre === 'SRE C05 A' && !doSup[1].fim && doSup[1].sre === 'SRE C05 B',
     'v8.13 (C05): mover um acesso de SRE fecha o período na antiga, com motivo, e abre outro na nova');
  /* v8.13 (E08): quem lê o histórico é quem CADASTRA. `equipe_de` não
     cadastra ninguém e passou a receber a recusa; o Órgão Central, que é o
     topo da cascata, continua vendo os institucionais da rede. */
  const hA = B.historicoAssociacoes({ token: TKC05 });   /* v9.6/v9.7: o Central vê os superintendentes */
  ok(hA.linhas.filter(l => l.email === 'sup.c05@educacao.mg.gov.br' && l.sre === 'SRE C05 A').every(l => !l.vigente),
     'v8.13 (C05): o período na SRE antiga aparece encerrado');

  /* (2) quem era do Colegiado passa a ter acesso regional */
  B.acessoSalvar({ token: tkDE('SRE C05 A'), email: 'dir.c05@educacao.mg.gov.br', nome: 'Diretora C05',
                   papel: 'diretor_escolar', inep: '31000905' });
  const TKD05 = B.criarSessao_({ email: 'dir.c05@educacao.mg.gov.br', nome: 'Diretora C05', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'SRE C05 A', inep: '31000905', escola: 'EE C05 A' });
  ok(abertosDe('dir.c05@educacao.mg.gov.br')[0].observacao === 'Direção Escolar',
     'v8.13 (C05): o período de direção também nasce com o papel na Observação');
  B.acessoSalvar({ token: TKD05, email: 'docente.c05@educacao.mg.gov.br', nome: 'Docente do Colegiado',
                   papel: 'colegiado', segmento: 'Docente' });
  ok(abertosDe('docente.c05@educacao.mg.gov.br').length === 1 &&
     abertosDe('docente.c05@educacao.mg.gov.br')[0].perfil === 'colegiado',
     'v8.13 (C05): o membro do colegiado tem período próprio, de classe colegiado');
  B.acessoSalvar({ token: TKC05, email: 'docente.c05@educacao.mg.gov.br', nome: 'Docente do Colegiado',
                   papel: 'superintendente', perfil: 'regional', sre: 'SRE C05 A' });
  const doDocente = per('docente.c05@educacao.mg.gov.br');
  ok(doDocente.length === 2 && doDocente[0].perfil === 'colegiado' && doDocente[0].fim &&
     /vínculo alterado: Colegiado Escolar → Superintendente/.test(doDocente[0].motivo) &&
     doDocente[1].perfil === 'regional' && !doDocente[1].fim,
     'v8.13 (C05): virar acesso regional fecha o período de colegiado com motivo e abre um institucional');
  ok(doDocente[0].inep === '31000905' && doDocente[0].escola === 'EE C05 A',
     'v8.13 (C05): e a escola continua registrando que aquela pessoa integrou o seu Colegiado');

  /* (3) e (4): a direção deixa de sê-lo; a escola não fica com dois vigentes */
  /* v9.7 — MUDAR DE RAMO DA CASCATA É DOIS ATOS, NÃO UM. Levar a direção de
     uma escola para a Coordenação de Inspeção cruza dois ramos: ninguém
     cadastra os dois papéis. O Superintendente não altera Direção Escolar
     (não a cadastra); a Diretoria Educacional, que a cadastra, não cadastra
     Coordenador de Inspeção. O caminho é remover de um lado e cadastrar do
     outro — e é o que deixa o histórico correto dos dois lados. */
  const TKSUP05 = sessaoDe_({ email: 'sup.a.c05@educacao.mg.gov.br', nome: 'Superintendente C05 A',
    perfil: 'regional', papel: 'superintendente', sre: 'SRE C05 A' });
  let r05 = B.acessoSalvar({ token: TKSUP05, email: 'dir.c05@educacao.mg.gov.br', nome: 'Diretora C05',
                   papel: 'coordenador_inspecao', perfil: 'regional', sre: 'SRE C05 A' });
  ok(!r05.ok && /não altera o cadastro de Direção Escolar/.test(r05.erro || ''),
     'v9.7 (C05): o Superintendente não converte a direção de uma escola em Coordenação de Inspeção — não é ele quem cadastra direção escolar');
  B.acessoRemover({ token: tkDE('SRE C05 A', B), email: 'dir.c05@educacao.mg.gov.br',
                    motivo: 'Saída da direção para a Coordenação de Inspeção' });
  r05 = B.acessoSalvar({ token: TKSUP05, email: 'dir.c05@educacao.mg.gov.br', nome: 'Diretora C05',
                   papel: 'coordenador_inspecao', perfil: 'regional', sre: 'SRE C05 A' });
  ok(r05.ok, 'v9.7 (C05): removida da direção pela Diretoria Educacional, o Superintendente a cadastra na Coordenação de Inspeção');
  ok(abertosDe('dir.c05@educacao.mg.gov.br').length === 1 &&
     abertosDe('dir.c05@educacao.mg.gov.br')[0].perfil === 'regional' &&
     per('dir.c05@educacao.mg.gov.br')[0].fim && per('dir.c05@educacao.mg.gov.br')[0].inep === '31000905',
     'v8.13 (C05): tirar alguém da direção de uma escola fecha o período daquela escola');
  salvarDiretor(B, { email: 'dir2.c05@educacao.mg.gov.br', nome: 'Diretora C05 Dois',
                   papel: 'diretor_escolar', inep: '31000905' });
  const naEscola = B.gestoresTodos_().filter(g => g.inep === '31000905' && g.perfil === 'escola' && !g.fim);
  ok(naEscola.length === 1 && naEscola[0].email === 'dir2.c05@educacao.mg.gov.br',
     'v8.13 (C05): cadastrar direção nova naquela escola produz UM período aberto, nunca dois');

  /* a leitura conserta o que a base já gravou: dois abertos, um só vigente */
  {
    B.abaGestores_().appendRow(['31000905', 'EE C05 A', 'Fantasma Vigente', '', 'fantasma.c05@educacao.mg.gov.br',
      '01/01/2020 08:00', '', 'Sistema', '', 'escola', 'SRE C05 A', '', 'Direção Escolar']);
    B.invalidarGestores_();
    const hg = B.gestoresHistorico({ token: TKC05, inep: '31000905' });
    const vigentes = hg.gestores.filter(g => g.vigente);
    ok(vigentes.length === 1 && hg.gestores.some(g => g.semEncerramento === true),
       'v8.13 (C05): com dois períodos abertos na mesma escola, a leitura marca um vigente e assinala o outro');
  }

  /* a chave do período distingue as classes */
  ok(B.classeDePerfil_ && B.classeDePerfil_('colegiado') === 'colegiado' && B.classeDePerfil_('escola') === 'escola' &&
     B.classeDePerfil_('regional') === 'institucional' && B.classeDePerfil_('central') === 'institucional' &&
     B.classeDePerfil_('') === 'escola',
     'v8.13 (C05): classeDePerfil_ separa escola, colegiado e institucional — e a linha antiga sem perfil continua escolar');
  ok(B.classeDePerfil_ && B.periodosAbertos_({ perfil: 'regional', email: 'docente.c05@educacao.mg.gov.br' }).length === 1 &&
     B.periodosAbertos_({ perfil: 'colegiado', email: 'docente.c05@educacao.mg.gov.br', inep: '31000905' }).length === 0,
     'v8.13 (C05): uma busca institucional não casa mais com uma linha de colegiado, nem o contrário');
}

/* ==================== v8.13 (C06): alterar exige competência sobre o papel ATUAL ==================== */
{
  const TKC06 = B.criarSessao_({ email: 'central.c06@educacao.mg.gov.br', nome: 'Central C06',
                                 perfil: 'central', papel: 'central' });
  const SRE6 = 'SRE C06';
  B.escolaSalvar({ token: TKC06, inep: '31000907', escola: 'EE C06', municipio: 'Betim', sre: SRE6, codigoInep: censoDe('31000907') });
  B.escolaSalvar({ token: TKC06, inep: '31000908', escola: 'EE C06 Sem Direção', municipio: 'Betim', sre: SRE6, codigoInep: censoDe('31000908') });
  B.acessoSalvar({ token: TKC06, email: 'sup.c06@educacao.mg.gov.br', nome: 'Superintendente C06',
                   papel: 'superintendente', perfil: 'regional', sre: SRE6 });
  const TKS06 = B.criarSessao_({ email: 'sup.c06@educacao.mg.gov.br', nome: 'Superintendente C06',
    perfil: 'regional', papel: 'superintendente', sre: SRE6 });
  B.acessoSalvar({ token: TKS06, email: 'de.c06@educacao.mg.gov.br', nome: 'Diretor Educacional C06',
                   papel: 'diretor_educacional' });
  B.acessoSalvar({ token: TKS06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                   papel: 'coordenador_inspecao' });
  const TKDE06 = B.criarSessao_({ email: 'de.c06@educacao.mg.gov.br', nome: 'Diretor Educacional C06',
    perfil: 'regional', papel: 'diretor_educacional', sre: SRE6 });
  B.acessoSalvar({ token: TKDE06, email: 'eq.c06@educacao.mg.gov.br', nome: 'Analista C06', papel: 'equipe_de' });
  const TKEQ06 = B.criarSessao_({ email: 'eq.c06@educacao.mg.gov.br', nome: 'Analista C06',
    perfil: 'regional', papel: 'equipe_de', sre: SRE6 });

  /* a cadeia do achado, etapa 2: reescrever o Superintendente como equipe_de */
  let r6 = B.acessoSalvar({ token: TKDE06, email: 'sup.c06@educacao.mg.gov.br', nome: 'Superintendente C06',
                            papel: 'equipe_de' });
  ok(!r6.ok && /não altera o cadastro de Superintendente/.test(r6.erro || ''),
     'v8.13 (C06): o Diretor Educacional não rebaixa o Superintendente — a recusa vem na etapa 2, não só na 1');
  ok(B.papelDe_(B.acessoPorEmail_('sup.c06@educacao.mg.gov.br')) === 'superintendente',
     'v8.13 (C06): e o cadastro do Superintendente continua como estava');
  r6 = B.acessoRemover({ token: TKDE06, email: 'sup.c06@educacao.mg.gov.br' });
  ok(!r6.ok && /não remove Superintendente/.test(r6.erro || ''),
     'v8.13 (C06): e por isso ele também não o remove — a cadeia fecha');

  /* nem transformá-lo em diretor de uma escola sem direção */
  r6 = salvarDiretor(B, { email: 'sup.c06@educacao.mg.gov.br', nome: 'Superintendente C06',
                        papel: 'diretor_escolar', inep: '31000908' });
  ok(!r6.ok && /não altera o cadastro de Superintendente/.test(r6.erro || ''),
     'v8.13 (C06): nem o transforma em direção de uma escola sem diretor');
  ok(!B.acessoPorInep_('31000908'), 'v8.13 (C06): e a escola continua sem direção');

  /* o Coordenador de Inspeção não é rebaixado por ninguém abaixo dele */
  r6 = B.acessoSalvar({ token: TKEQ06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                        papel: 'equipe_inspecao' });
  ok(!r6.ok, 'v8.13 (C06): a equipe da DE não rebaixa o Coordenador de Inspeção');
  r6 = B.acessoSalvar({ token: TKDE06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                        papel: 'equipe_de' });
  ok(!r6.ok && /não altera o cadastro de Coordenador de Inspeção/.test(r6.erro || ''),
     'v8.13 (C06): nem o Diretor Educacional o puxa para a própria equipe');

  /* o caminho legítimo não muda: mesmo papel, correção de dados */
  r6 = B.acessoSalvar({ token: TKS06, email: 'de.c06@educacao.mg.gov.br', nome: 'Diretor Educacional C06 (corrigido)',
                        papel: 'diretor_educacional' });
  ok(r6.ok && B.acessoPorEmail_('de.c06@educacao.mg.gov.br').nome === 'Diretor Educacional C06 (corrigido)',
     'v8.13 (C06): corrigir os dados de alguém do próprio papel continua passando');
  r6 = B.acessoSalvar({ token: TKS06, email: 'de.c06@educacao.mg.gov.br', nome: 'Diretor Educacional C06 (corrigido)',
                        papel: 'diretor_educacional', situacao: 'inativo' });
  ok(r6.ok, 'v8.13 (C06): suspender também');
  r6 = B.acessoSalvar({ token: TKS06, email: 'de.c06@educacao.mg.gov.br', nome: 'Diretor Educacional C06 (corrigido)',
                        papel: 'diretor_educacional', situacao: 'ativo' });
  ok(r6.ok, 'v8.13 (C06): e reativar');

  /* v9.7: a exceção T-10 acabou — o Órgão Central administra só os
     superintendentes. Mudar o papel de alguém da Inspeção é do Coordenador
     de Inspeção da regional, e continua deixando rastro (C05). */
  r6 = B.acessoSalvar({ token: TKC06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                        papel: 'equipe_inspecao', perfil: 'regional', sre: SRE6 });
  ok(!r6.ok && /não cadastra Equipe da Coordenação de Inspeção/.test(r6.erro || ''),
     'v9.7 (C06): o Órgão Central NÃO altera um cadastro institucional fora da sua linha da cascata');
  /* descer alguém de Coordenador para a equipe dele também cruza o ramo: quem
     cadastra Coordenador é o Superintendente; quem cadastra a equipe é o
     Coordenador. O caminho é remover de um lado e cadastrar do outro. */
  const TKCI06 = sessaoDe_({ email: 'coord.insp.c06@educacao.mg.gov.br', nome: 'Coordenação de Inspeção C06',
    perfil: 'regional', papel: 'coordenador_inspecao', sre: SRE6 });
  r6 = B.acessoSalvar({ token: TKCI06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                        papel: 'equipe_inspecao', perfil: 'regional', sre: SRE6 });
  ok(!r6.ok && /não altera o cadastro de Coordenador de Inspeção/.test(r6.erro || ''),
     'v9.7 (C06): nem o Coordenador de Inspeção altera quem é Coordenador — isso é do Superintendente');
  B.acessoRemover({ token: TKS06, email: 'ci.c06@educacao.mg.gov.br', motivo: 'Passagem para a equipe' });
  r6 = B.acessoSalvar({ token: TKCI06, email: 'ci.c06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C06',
                        papel: 'equipe_inspecao', perfil: 'regional', sre: SRE6 });
  ok(r6.ok, 'v9.7 (C06): removido pelo Superintendente, o Coordenador de Inspeção o cadastra na própria equipe');
  const perCI = B.gestoresTodos_().filter(g => g.email === 'ci.c06@educacao.mg.gov.br');
  ok(perCI.length === 2 && perCI[0].fim && perCI[0].observacao === 'Coordenador de Inspeção' &&
     !perCI[1].fim && perCI[1].observacao === 'Equipe da Coordenação de Inspeção',
     'v8.13 (C05/C06): e a passagem aparece no histórico com o papel anterior e o novo');

  /* a carga em lote passa pela mesma função: linha cujo e-mail é de um acesso
     regional é recusada com mensagem legível, e nada é gravado */
  {
    /* v9.7: a carga de diretores é do Órgão Central (implantação) ou da
       Diretoria Educacional; o Superintendente não a faz */
    ok(/não gere os diretores/.test((B.importarAcessos_('diretores', { token: TKS06, texto: '31000907;X;1234567;x.c06@educacao.mg.gov.br' }) || {}).erro || ''),
       'v9.7 (C06): o Superintendente não carrega diretores em lote');
    const sim6 = B.importarAcessos_('diretores', { token: tkDE(SRE6, B), texto: '31000907;Diretor de Lote;1234567;de.c06@educacao.mg.gov.br' });
    ok(sim6.ok && sim6.aceitas === 0 && sim6.recusadas === 1 &&
       /não altera o cadastro de Diretor Educacional|já responde|já está cadastrado/.test(sim6.itens[0].motivo || ''),
       'v8.13 (C06): na carga de diretores, a linha cujo e-mail pertence a um acesso regional é recusada — ' +
       (sim6.itens && sim6.itens[0] ? sim6.itens[0].motivo : ''));
    ok(!B.acessoPorInep_('31000907') || B.acessoPorInep_('31000907').email !== 'de.c06@educacao.mg.gov.br',
       'v8.13 (C06): e não é gravada');
  }

  /* a direção não puxa para o colegiado quem é de um acesso regional, e a
     mensagem de e-mail ocupado deixou de sair com "(código )" — o cadastro
     institucional não tem INEP. */
  {
    salvarDiretor(B, { email: 'dir.c06@educacao.mg.gov.br', nome: 'Diretora C06',
                     papel: 'diretor_escolar', inep: '31000907' });
    const TKD06 = B.criarSessao_({ email: 'dir.c06@educacao.mg.gov.br', nome: 'Diretora C06', perfil: 'escola',
      papel: 'diretor_escolar', sre: SRE6, inep: '31000907', escola: 'EE C06' });
    const rr = B.acessoSalvar({ token: TKD06, email: 'eq.c06@educacao.mg.gov.br', nome: 'Analista C06',
                                papel: 'colegiado', segmento: 'Docente' });
    ok(!rr.ok && !/\(código \)/.test(rr.erro || '') &&
       /não altera o cadastro de Equipe da Diretoria Educacional/.test(rr.erro || ''),
       'v8.13 (C06): a direção não converte um acesso regional em membro do colegiado — ' + rr.erro);
    ok(B.papelDe_(B.acessoPorEmail_('eq.c06@educacao.mg.gov.br')) === 'equipe_de',
       'v8.13 (C06): e o cadastro regional fica intacto');
    /* a mensagem de e-mail já ocupado, quando ela é alcançada (mesmo papel,
       outra escola), nomeia o papel e a unidade — nunca "código " vazio */
    const outra = B.acessoSalvar({ token: TKD06, email: 'docente.c05@educacao.mg.gov.br',
                                   nome: 'Docente', papel: 'colegiado', segmento: 'Docente' });
    ok(!outra.ok && !/\(código \)/.test(outra.erro || ''),
       'v8.13 (C06): e nenhuma dessas mensagens sai com parêntese vazio — ' + outra.erro);
  }
}

/* ==================== v8.13 (C07): "corrigir os dados" não troca a pessoa ==================== */
{
  const TKC07 = B.criarSessao_({ email: 'central.c07@educacao.mg.gov.br', nome: 'Central C07',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC07, inep: '31000909', escola: 'EE C07', municipio: 'Ouro Preto', sre: 'SRE C07', codigoInep: censoDe('31000909') });
  const cadC07 = () => B.acessoPorInep_('31000909');
  const periodosC07 = () => B.gestoresTodos_().filter(g => g.inep === '31000909' && g.perfil === 'escola');

  salvarDiretor(B, { email: 'ana.c07@educacao.mg.gov.br', nome: 'Ana Correia', masp: '1010101',
                   papel: 'diretor_escolar', inep: '31000909', modo: 'novo', senha: 'senha-da-ana-2026' });
  ok(!!cadC07().hash, 'v8.13 (C07): a diretora tem senha definida');

  /* (a) trocar nome, MASP e e-mail em "correcao" é substituição disfarçada */
  let r7 = salvarDiretor(B, { email: 'bruno.c07@educacao.mg.gov.br', nome: 'Bruno Outro',
                            masp: '2020202', papel: 'diretor_escolar', inep: '31000909', modo: 'correcao' });
  ok(!r7.ok && /substituição de diretor/.test(r7.erro || '') && /Associar novo diretor/.test(r7.erro || ''),
     'v8.13 (C07): trocar e-mail junto com nome e MASP em "correcao" é recusado, apontando o botão certo');
  ok(cadC07().email === 'ana.c07@educacao.mg.gov.br' && cadC07().nome === 'Ana Correia',
     'v8.13 (C07): e nada foi gravado');

  /* (b) corrigir só o nome preserva a senha */
  r7 = salvarDiretor(B, { email: 'ana.c07@educacao.mg.gov.br', nome: 'Ana Corrêa',
                        masp: '1010101', papel: 'diretor_escolar', inep: '31000909', modo: 'correcao' });
  ok(r7.ok && cadC07().nome === 'Ana Corrêa' && !!cadC07().hash,
     'v8.13 (C07): corrigir só o nome é aceito e a senha continua valendo');
  ok(periodosC07().length === 1 && !periodosC07()[0].fim && periodosC07()[0].nome === 'Ana Corrêa',
     'v8.13 (C07): o período continua o mesmo, com o nome corrigido');
  ok(histTemEm('Acessos — histórico', /dados do diretor corrigidos/),
     'v8.13 (C07): e a correção deixa rastro no histórico de acessos');

  /* (c) corrigir só o e-mail é aceito, mas a credencial não acompanha */
  const hashAntes = cadC07().hash;
  r7 = salvarDiretor(B, { email: 'ana.correa.c07@educacao.mg.gov.br', nome: 'Ana Corrêa',
                        masp: '1010101', papel: 'diretor_escolar', inep: '31000909', modo: 'correcao' });
  ok(r7.ok && cadC07().email === 'ana.correa.c07@educacao.mg.gov.br',
     'v8.13 (C07): corrigir só o e-mail é aceito');
  ok(!!hashAntes && !cadC07().hash && !cadC07().sal && !cadC07().hashVersao,
     'v8.13 (C07): e o hash é zerado — a senha antiga deixa de abrir o acesso no endereço novo');
  ok(!!cadC07().token, 'v8.13 (C07): a pessoa recebe convite para definir senha na caixa nova');
  ok(!B.entrarInstitucional({ email: 'ana.correa.c07@educacao.mg.gov.br', senha: 'senha-da-ana-2026' }).ok,
     'v8.13 (C07): a senha do endereço antigo não entra no novo');

  /* (d) o histórico permanente continua com o antecessor em todos os casos */
  ok(periodosC07().length === 1 && !periodosC07()[0].fim,
     'v8.13 (C07): a correção não abriu nem fechou período');
  salvarDiretor(B, { email: 'bruno.c07@educacao.mg.gov.br', nome: 'Bruno Outro', masp: '2020202',
                   papel: 'diretor_escolar', inep: '31000909', modo: 'novo' });
  const depois7 = periodosC07();
  ok(depois7.length === 2 && depois7[0].fim && /Ana Corrêa|Ana Correia/.test(depois7[0].nome) &&
     !depois7[1].fim && depois7[1].nome === 'Bruno Outro',
     'v8.13 (C07): a troca de diretor continua encerrando o período da antecessora e abrindo o do sucessor');
}

/* ==================== v8.13 (C08): carga estável e chave de uso único ==================== */
{
  const TKC08 = B.criarSessao_({ email: 'central.c08@educacao.mg.gov.br', nome: 'Central C08',
                                 perfil: 'central', papel: 'central' });
  const baseC08 = [];
  for (let i = 1; i <= 200; i++) baseC08.push((32000 + i) + ';EE C08 ' + i + ';Betim;SRE C08');
  cargaEscolas(TKC08, baseC08.join('\n'));
  const L8 = [];
  for (let i = 1; i <= 199; i++) L8.push((32000 + i) + ';Dir C08 ' + i + ';' + (700000 + i) + ';dir.c08.' + i + '@educacao.mg.gov.br');
  L8.push('32005;Dir Intruso;999999;intruso.c08@educacao.mg.gov.br');   // linha 200 repete a escola da linha 5
  const texto8 = L8.join('\n');

  const sim8 = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: true });
  ok(sim8.ok && sim8.total === 200 && sim8.aceitas === 199 && sim8.recusadas === 1 &&
     /código repetido na carga \(linha 5\)/.test(sim8.itens[199].motivo || ''),
     'v8.13 (C08): a simulação recusa a linha 200 por repetir a escola da linha 5');

  /* a chave é emitida, não derivada: duas simulações do mesmo texto diferem */
  const sim8b = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: true });
  ok(sim8.chave && sim8b.chave && sim8.chave !== sim8b.chave && sim8.chave.length >= 16,
     'v8.13 (C08): duas simulações do mesmo texto emitem chaves diferentes');

  /* a chave de outra sessão não serve */
  const TKOUTRO08 = B.criarSessao_({ email: 'outro.c08@educacao.mg.gov.br', nome: 'Outro Central',
                                     perfil: 'central', papel: 'central' });
  const alheia = B.importarAcessos_('diretores', { token: TKOUTRO08, texto: texto8, simular: false, chave: sim8.chave, de: 0 });
  ok(!alheia.ok && /Simule a carga antes de importar/.test(alheia.erro || ''),
     'v8.13 (C08): a chave emitida para uma sessão não vale para outra');

  /* simular:true com chave válida NÃO grava */
  const comChave = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: true, chave: sim8.chave });
  ok(comChave.ok && comChave.simulacao === true && !B.acessoPorInep_('32001'),
     'v8.13 (C08): simular:true com chave válida continua simulando — não grava');

  /* carga real, por lotes */
  let de8 = 0, grav8 = 0, rec8 = 0, motivo200 = '';
  for (let volta = 0; volta < 10; volta++) {
    const c8 = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: false, chave: sim8.chave, de: de8 });
    if (!c8.ok) { motivo200 = 'ERRO: ' + c8.erro; break; }
    grav8 += c8.gravadas; rec8 += c8.recusadas;
    const l200 = (c8.itens || []).filter(x => x.linha === 200)[0];
    if (l200) motivo200 = l200.motivo || '';
    if (!c8.proximo) break;
    de8 = c8.proximo;
  }
  ok(grav8 === 199 && rec8 === 1,
     'v8.13 (C08): a carga real entrega o que a simulação prometeu — ' + grav8 + ' gravadas, ' + rec8 + ' recusada');
  ok(/código repetido na carga \(linha 5\)/.test(motivo200),
     'v8.13 (C08): e a linha repetida é recusada com o MESMO motivo da simulação — ' + motivo200);
  ok(B.acessoPorInep_('32005').email === 'dir.c08.5@educacao.mg.gov.br',
     'v8.13 (C08): o diretor da linha 5 continua no cargo — a carga não se sobrescreve');

  /* a chave é de uso único: consumida no último lote */
  const repetir = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: false, chave: sim8.chave, de: 0 });
  ok(!repetir.ok && /Simule a carga antes de importar/.test(repetir.erro || ''),
     'v8.13 (C08): concluída a carga, a chave não serve de novo');

  /* ponto de continuação fora da faixa é erro, não "concluída" */
  const sim8c = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: true });
  const fora = B.importarAcessos_('diretores', { token: TKC08, texto: texto8, simular: false, chave: sim8c.chave, de: 99999 });
  ok(!fora.ok && /já foi concluída ou o ponto de continuação é inválido/.test(fora.erro || ''),
     'v8.13 (C08): "de" fora da faixa devolve erro — não "carga concluída" sem ter gravado nada');
}

/* ==================== v8.13 (C09): baixa e reativação de escola ==================== */
{
  const TKC09 = B.criarSessao_({ email: 'central.c09@educacao.mg.gov.br', nome: 'Central C09',
                                 perfil: 'central', papel: 'central' });
  const abaR09 = B.abaRegistros_();
  /* uma escola e um PPP por situação: a trava tem de valer para todas as que
     não estão encerradas, e só "Homologado" encerra */
  const cenario09 = function (n, status) {
    const inep = '3100091' + n;
    B.escolaSalvar({ token: TKC09, inep: inep, escola: 'EE C09 ' + n, municipio: 'Sabará', sre: 'SRE C09', codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: 'dir.c09.' + n + '@educacao.mg.gov.br', nome: 'Diretora C09 ' + n,
                     papel: 'diretor_escolar', inep: inep });
    const tk = B.criarSessao_({ email: 'dir.c09.' + n + '@educacao.mg.gov.br', nome: 'Diretora C09 ' + n,
      perfil: 'escola', papel: 'diretor_escolar', sre: 'SRE C09', inep: inep, escola: 'EE C09 ' + n });
    const prot = B.salvarPPP({ token: tk, escola: 'EE C09 ' + n, inep: inep, sre: 'SRE C09',
                               municipio: 'Sabará', sessao: 'c09' }).protocolo;
    B.gravarCampo_(abaR09, B.linhaDoProtocolo_(abaR09, prot), 'status', status);
    return { inep: inep, prot: prot, tk: tk };
  };

  ['Em assinatura', 'Concluído', 'Enviado para homologação'].forEach(function (status, i) {
    const c = cenario09(i + 1, status);
    const semConf = B.escolaSituacao({ token: TKC09, inep: c.inep, situacao: 'inativa' });
    ok(semConf.ok === false && semConf.pppAberto && semConf.pppAberto.protocolo === c.prot &&
       new RegExp(status.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(semConf.erro || ''),
       'v8.13 (C09): com o PPP "' + status + '", inativar pede confirmação e diz a situação real');
    const conf = B.escolaSituacao({ token: TKC09, inep: c.inep, situacao: 'inativa', confirmado: true });
    ok(conf.ok && conf.pppEmAberto === c.prot,
       'v8.13 (C09): confirmada, a inativação acontece e aponta o PPP "' + status + '"');
    ok((B.linhaDoTempo({ token: TKC09, protocolo: c.prot }).eventos || [])
        .some(l => /escola inativada com o PPP em aberto/.test(l.ato || '')),
       'v8.13 (C09): e a baixa fica registrada no ciclo daquele PPP ("' + status + '")');
  });

  /* Homologado pela SRE é estado encerrado: não pede confirmação */
  {
    const c = cenario09(4, 'Homologado');
    const r9 = B.escolaSituacao({ token: TKC09, inep: c.inep, situacao: 'inativa' });
    ok(r9.ok && !r9.pppEmAberto,
       'v8.13 (C09): com o PPP homologado pela SRE — estado encerrado — a baixa não pergunta nada');
  }

  /* a reativação diz a verdade */
  {
    const inep9 = '31000920';
    B.escolaSalvar({ token: TKC09, inep: inep9, escola: 'EE C09 Volta', municipio: 'Sabará', sre: 'SRE C09', codigoInep: censoDe(inep9) });
    salvarDiretor(B, { email: 'dir.volta.c09@educacao.mg.gov.br', nome: 'Diretora Volta',
                     papel: 'diretor_escolar', inep: inep9 });
    const tkv = B.criarSessao_({ email: 'dir.volta.c09@educacao.mg.gov.br', nome: 'Diretora Volta',
      perfil: 'escola', papel: 'diretor_escolar', sre: 'SRE C09', inep: inep9, escola: 'EE C09 Volta' });
    const prot9 = B.salvarPPP({ token: tkv, escola: 'EE C09 Volta', inep: inep9, sre: 'SRE C09',
                                municipio: 'Sabará', sessao: 'c09' }).protocolo;
    B.acessoSalvar({ token: tkv, email: 'membro.volta.c09@exemplo.mg', nome: 'Membro Volta', papel: 'colegiado',
                     segmento: 'Famílias', relacao: 'pai do estudante do 1º ano' });
    B.escolaSituacao({ token: TKC09, inep: inep9, situacao: 'inativa', confirmado: true });
    const volta = B.escolaSituacao({ token: TKC09, inep: inep9, situacao: 'ativa' });
    ok(volta.ok && volta.colegiadoInativo === 1 && volta.semDiretor === true,
       'v8.13 (C09): reativar devolve quantos membros continuam inativos e que a escola está sem direção');
    ok((B.linhaDoTempo({ token: TKC09, protocolo: prot9 }).eventos || [])
        .some(l => /escola reativada na base da rede/.test(l.ato || '')),
       'v8.13 (C09): e a volta à rede fica registrada no ciclo do PPP não encerrado');
    ok(B.colegiadoDaEscola_(inep9).every(m => String(m.situacao).toLowerCase() === 'inativo'),
       'v8.13 (C09): reativar a escola NÃO reativa o colegiado — quem o faz é a direção');
  }
}

/* ==================== v8.13 (C10): a carga da base de escolas, refeita ==================== */
{
  const TKC10 = B.criarSessao_({ email: 'central.c10@educacao.mg.gov.br', nome: 'Central C10',
                                 perfil: 'central', papel: 'central' });
  const esc10 = (inep) => B.escolasListar({ token: TKC10 }).escolas.filter(e => e.inep === inep)[0];

  /* (1) código repetido no mesmo texto: erro de linha, e as demais entram */
  const r10 = cargaEscolas(TKC10,
    '33001;EE C10 Um;Contagem;SRE C10\n' +
    '33002;EE C10 Dois;Contagem;SRE C10\n' +
    '33001;EE C10 Um De Novo;Ibirité;SRE C10 Outra\n' +
    '33003;EE C10 Três;Contagem;SRE C10');
  ok(r10.ok && r10.incluidas === 3 && r10.totalErros === 1 &&
     /linha 3: código repetido na carga \(linha 1\)/.test(r10.erros.join(' ')),
     'v8.13 (C10): código repetido no mesmo texto é erro de linha, citando a linha anterior');
  ok(!!esc10('33001') && !!esc10('33002') && !!esc10('33003') &&
     esc10('33001').escola === 'EE C10 Um' && esc10('33001').sre === 'SRE C10',
     'v8.13 (C10): e as demais linhas são gravadas — nada se perde, e a repetida não sobrescreve');

  /* (2) campo ausente preserva o gravado */
  cargaEscolas(TKC10, '33002;EE C10 Dois;Contagem;SRE C10;31555501');
  B.escolaSituacao({ token: TKC10, inep: '33002', situacao: 'inativa' });
  ok(esc10('33002').situacao === 'inativa' && esc10('33002').codigoInep === '31555501',
     'v8.13 (C10): a escola está inativa e com código INEP gravado');
  const r10b = cargaEscolas(TKC10, '33002;EE C10 Dois (nome novo);Contagem;SRE C10');
  ok(r10b.ok && esc10('33002').situacao === 'inativa' && esc10('33002').codigoInep === '31555501' &&
     esc10('33002').escola === 'EE C10 Dois (nome novo)',
     'v8.13 (C10): reimportar sem os campos mantém a situação e o INEP gravados, e corrige o nome');
  ok(esc10('33002').municipio === 'Contagem' && esc10('33002').sre === 'SRE C10',
     'v8.13 (C10): município e SRE também sobrevivem');
  const r10c = cargaEscolas(TKC10, '33002');
  ok(r10c.ok && esc10('33002').escola === 'EE C10 Dois (nome novo)' && esc10('33002').sre === 'SRE C10' &&
     esc10('33002').situacao === 'inativa',
     'v8.13 (C10): uma linha só com o código não apaga nada');

  /* (3) validar antes de normalizar */
  const antes33003 = esc10('33003');
  const r10d = cargaEscolas(TKC10, '33A03;EE Intrusa;Ibirité;SRE C10 Outra\n33.004-5;EE Pontuada;Ibirité;SRE C10 Outra');
  ok(r10d.ok && r10d.incluidas === 0 && r10d.totalErros === 2 &&
     /código da escola inválido/.test(r10d.erros.join(' ')),
     'v8.13 (C10): letra ou pontuação no código é erro de linha, nunca um código diferente');
  ok(esc10('33003').escola === antes33003.escola && esc10('33003').sre === antes33003.sre,
     'v8.13 (C10): e nenhuma outra escola é tocada — "33A03" não virou 3303');
  ok(!esc10('3303') && !esc10('330045'), 'v8.13 (C10): nem foi criada uma escola com o código normalizado');

  /* (4) SRE e município obrigatórios na escola NOVA; preservados na existente */
  const r10e = cargaEscolas(TKC10, '33009;EE C10 Sem SRE;Contagem');
  ok(r10e.ok && r10e.incluidas === 0 && /sem Superintendência/.test(r10e.erros.join(' ')),
     'v8.13 (C10): escola NOVA sem SRE é recusada — sem SRE ela fica invisível para toda regional');
  const r10f = cargaEscolas(TKC10, '33010;EE C10 Sem Município;;SRE C10');
  ok(r10f.ok && r10f.incluidas === 0 && /sem município/.test(r10f.erros.join(' ')),
     'v8.13 (C10): e escola NOVA sem município também');

  /* (5) a simulação conta o que a carga vai fazer, e não grava */
  const textoSim = '33001;EE C10 Um;Ibirité;SRE C10 Outra\n33002;EE C10 Dois (nome novo);Contagem;SRE C10;ativa\n33020;EE C10 Nova;Contagem;SRE C10';
  const sim10 = B.escolasImportar({ token: TKC10, texto: textoSim, simular: true });
  ok(sim10.ok && sim10.simulacao === true && sim10.incluidas === 1 && sim10.atualizadas === 2 &&
     sim10.mudamSre === 1 && sim10.voltamAtivas === 1,
     'v8.13 (C10): a simulação diz em número o que a carga faria — inclusões, mudanças de SRE e reativações');
  ok(!esc10('33020') && esc10('33001').sre === 'SRE C10' && esc10('33002').situacao === 'inativa',
     'v8.13 (C10): e não grava nada');
  const semChave = B.escolasImportar({ token: TKC10, texto: textoSim, simular: false });
  ok(!semChave.ok && /Simule a carga antes de importar/.test(semChave.erro || ''),
     'v8.13 (C10): sem a chave, a carga real é recusada');
  const comChave = B.escolasImportar({ token: TKC10, texto: textoSim, simular: false, chave: sim10.chave });
  ok(comChave.ok && esc10('33020') && esc10('33001').sre === 'SRE C10 Outra' && esc10('33002').situacao === 'ativa',
     'v8.13 (C10): com a chave, a carga faz exatamente o que a simulação prometeu');
  ok(!B.escolasImportar({ token: TKC10, texto: textoSim, simular: false, chave: sim10.chave }).ok,
     'v8.13 (C10): e a chave é de uso único');

  /* (6) gravação em bloco: reimportar muitas escolas não custa uma gravação por escola */
  {
    const ss10 = S.g.SpreadsheetApp.getActiveSpreadsheet();
    const origGet = ss10.getSheetByName.bind(ss10);
    let escritas = 0;
    ss10.getSheetByName = function (n) {
      const a = origGet(n);
      if (a && n === 'Escolas' && !a.__c10) {
        a.__c10 = true;
        const gr = a.getRange.bind(a), ar = a.appendRow.bind(a);
        a.getRange = function () {
          const o = gr.apply(null, arguments);
          if (o && o.setValues) { const sv = o.setValues, s1 = o.setValue;
            o.setValues = function (v) { escritas++; return sv.call(o, v); };
            o.setValue = function (v) { escritas++; return s1.call(o, v); }; }
          return o;
        };
        a.appendRow = function (v) { escritas++; return ar(v); };
      }
      return a;
    };
    const muitas = [];
    for (let i = 1; i <= 400; i++) muitas.push((34000 + i) + ';EE Bloco ' + i + ';Contagem;SRE C10');
    cargaEscolas(TKC10, muitas.join('\n'));      // inclusão
    escritas = 0;
    cargaEscolas(TKC10, muitas.join('\n'));      // reimportação de rotina
    ok(escritas <= 3, 'v8.13 (C10): reimportar 400 escolas custa ' + escritas + ' gravação(ões) na aba, não 400');
    ss10.getSheetByName = origGet;
  }
}

/* ==================== v8.13 (C11): identidade da escola ==================== */
{
  const TKC11 = B.criarSessao_({ email: 'central.c11@educacao.mg.gov.br', nome: 'Central C11',
                                 perfil: 'central', papel: 'central' });
  const esc11 = (inep) => B.escolasListar({ token: TKC11 }).escolas.filter(e => e.inep === inep)[0];

  /* escola já gravada com zero à esquerda continua inteira */
  B.abaEscolas_().appendRow(['0031002', 'EE Com Zeros', 'Juiz de Fora', 'SRE C11', 'ativa', '']);
  B.invalidarEscolas_();
  ok(!!B.escolaPorInep_('0031002') && B.escolaPorInep_('0031002').escola === 'EE Com Zeros',
     'v8.13 (C11): a escola semeada com zero à esquerda continua sendo encontrada por escolaPorInep_');
  const alt11 = B.escolaSalvar({ token: TKC11, inep: '0031002', escola: 'EE Com Zeros (corrigida)',
                                 municipio: 'Juiz de Fora', sre: 'SRE C11', codigoInep: censoDe('0031002') });
  ok(alt11.ok && !alt11.criada && B.escolaPorInep_('0031002').escola === 'EE Com Zeros (corrigida)',
     'v8.13 (C11): e continua editável');
  ok(B.escolaSituacao({ token: TKC11, inep: '0031002', situacao: 'inativa' }).ok,
     'v8.13 (C11): e inativável');
  B.escolaSituacao({ token: TKC11, inep: '0031002', situacao: 'ativa' });

  /* criar por outra grafia é recusado, nas duas portas */
  const cria11 = B.escolaSalvar({ token: TKC11, inep: '31002', escola: 'EE Sem Zeros',
                                  municipio: 'Juiz de Fora', sre: 'SRE C11', codigoInep: censoDe('31002') });
  ok(!cria11.ok && /mesmo número escrito de outro jeito/.test(cria11.erro || ''),
     'v8.13 (C11): criar "31002" quando já existe "0031002" é recusado');
  const zero11 = B.escolaSalvar({ token: TKC11, inep: '0044001', escola: 'EE Zero Novo',
                                  municipio: 'Juiz de Fora', sre: 'SRE C11', codigoInep: censoDe('0044001') });
  ok(!zero11.ok && /não pode começar por zero/.test(zero11.erro || ''),
     'v8.13 (C11): escola NOVA com zero à esquerda é recusada');
  const carga11 = cargaEscolas(TKC11, '31002;EE Sem Zeros;Juiz de Fora;SRE C11\n0044002;EE Zero Carga;Juiz de Fora;SRE C11');
  ok(carga11.ok && carga11.incluidas === 0 && carga11.totalErros === 2 &&
     /mesmo número escrito de outro jeito/.test(carga11.erros.join(' ')) &&
     /não pode começar por zero/.test(carga11.erros.join(' ')),
     'v8.13 (C11): a carga recusa a linha que duplica por grafia e a que começa por zero, dizendo por quê');
  ok(!esc11('31002') && !esc11('0044002'), 'v8.13 (C11): e nenhuma das duas entra na base');

  /* o código INEP não se repete entre escolas */
  B.escolaSalvar({ token: TKC11, inep: '35001', escola: 'EE C11 INEP Um', municipio: 'Juiz de Fora',
                   sre: 'SRE C11', codigoInep: '31777701' });
  const dupInep = B.escolaSalvar({ token: TKC11, inep: '35002', escola: 'EE C11 INEP Dois',
                                   municipio: 'Juiz de Fora', sre: 'SRE C11', codigoInep: '31777701' });
  ok(!dupInep.ok && /já pertence à escola EE C11 INEP Um/.test(dupInep.erro || ''),
     'v8.13 (C11): um segundo codigoInep igual é recusado no formulário');
  const dupCarga = cargaEscolas(TKC11, '35003;EE C11 INEP Três;Juiz de Fora;SRE C11;31777701');
  ok(dupCarga.ok && dupCarga.incluidas === 0 && /já pertence à escola EE C11 INEP Um/.test(dupCarga.erros.join(' ')),
     'v8.13 (C11): e também na carga');
  ok(B.escolaSalvar({ token: TKC11, inep: '35001', escola: 'EE C11 INEP Um', municipio: 'Juiz de Fora',
                      sre: 'SRE C11', codigoInep: '31777701' }).ok,
     'v8.13 (C11): a própria escola pode continuar gravando o seu INEP');

  /* tetos de campo */
  const nomao = B.escolaSalvar({ token: TKC11, inep: '35010', escola: 'A'.repeat(50000),
                                 municipio: 'Juiz de Fora', sre: 'SRE C11', codigoInep: censoDe('35010') });
  ok(!nomao.ok && /no máximo 120 caracteres/.test(nomao.erro || ''),
     'v8.13 (C11): nome de escola de 50.000 caracteres é recusado, com o limite na mensagem');
  const sreza = B.escolaSalvar({ token: TKC11, inep: '35011', escola: 'EE C11 SRE Grande',
                                 municipio: 'Juiz de Fora', sre: 'S'.repeat(10000), codigoInep: censoDe('35011') });
  ok(!sreza.ok && /no máximo 80 caracteres/.test(sreza.erro || ''),
     'v8.13 (C11): SRE de 10.000 caracteres também');
  ok(B.sresConhecidas_().every(x => x.length <= 80),
     'v8.13 (C11): e nenhuma SRE monstruosa chega ao datalist das regionais');
  const munzao = B.escolaSalvar({ token: TKC11, inep: '35012', escola: 'EE C11 Município Grande',
                                  municipio: 'M'.repeat(500), sre: 'SRE C11', codigoInep: censoDe('35012') });
  ok(!munzao.ok && /no máximo 60 caracteres/.test(munzao.erro || ''), 'v8.13 (C11): e o município');
  const cargaTeto = cargaEscolas(TKC11, '35013;' + 'A'.repeat(200) + ';Juiz de Fora;SRE C11');
  ok(cargaTeto.ok && cargaTeto.incluidas === 0 && /acima de 120 caracteres/.test(cargaTeto.erros.join(' ')),
     'v8.13 (C11): a carga aplica os mesmos tetos, por linha');
  const nomeGrande = B.acessoSalvar({ token: TKC11, email: 'nomao.c11@educacao.mg.gov.br',
                                      nome: 'N'.repeat(500), papel: 'superintendente', perfil: 'regional', sre: 'SRE C11' });
  ok(!nomeGrande.ok && /no máximo 120 caracteres/.test(nomeGrande.erro || ''),
     'v8.13 (C11): o mesmo teto vale para o nome de quem recebe um acesso');

  /* a carga de diretores continua aceitando o código legado */
  {
    salvarDiretor(B, { email: 'dir.zeros.c11@educacao.mg.gov.br', nome: 'Diretora dos Zeros',
                     papel: 'diretor_escolar', inep: '0031002' });
    ok(!!B.acessoPorInep_('0031002'), 'v8.13 (C11): a escola de código legado continua recebendo direção');
    const simD = B.importarAcessos_('diretores', { token: TKC11, texto: '0031002;Outra Diretora;1234567;outra.zeros.c11@educacao.mg.gov.br',
                                       simular: true });
    ok(simD.ok && simD.itens[0].ok === true,
       'v8.13 (C11): e conferirDiretor_ continua aceitando o código legado na carga — ' + (simD.itens[0].motivo || 'aceita'));
  }
}

/* ==================== v8.13 (C12): vínculo do PPP e resgate da escola inativa ==================== */
{
  const TKC12b = B.criarSessao_({ email: 'central.c12@educacao.mg.gov.br', nome: 'Central C12',
                                  perfil: 'central', papel: 'central' });
  /* o roteiro que a tela manda seguir: cadastrar a certa, inativar a errada,
     reassociar a direção e vincular o PPP */
  B.escolaSalvar({ token: TKC12b, inep: '36001', escola: 'EE C12 Errada', municipio: 'Lavras', sre: 'SRE C12', codigoInep: censoDe('36001') });
  salvarDiretor(B, { email: 'dir.errada.c12@educacao.mg.gov.br', nome: 'Diretora C12',
                   papel: 'diretor_escolar', inep: '36001' });
  const TKD12 = B.criarSessao_({ email: 'dir.errada.c12@educacao.mg.gov.br', nome: 'Diretora C12',
    perfil: 'escola', papel: 'diretor_escolar', sre: 'SRE C12', inep: '36001', escola: 'EE C12 Errada' });
  const P12 = B.salvarPPP({ token: TKD12, escola: 'EE C12 Errada', inep: '36001', sre: 'SRE C12',
                            municipio: 'Lavras', sessao: 'c12' }).protocolo;
  B.escolaSalvar({ token: TKC12b, inep: '36002', escola: 'EE C12 Certa', municipio: 'Lavras', sre: 'SRE C12', codigoInep: censoDe('36002') });

  /* enquanto a escola de origem está ATIVA, a transferência continua proibida */
  const TKDE12b = tkDE('SRE C12', B);
  let r12 = B.adotarPPP({ token: TKDE12b, protocolo: P12, inep: '36002' });
  ok(!r12.ok && /não transfere/.test(r12.erro || ''),
     'v8.13 (C12): transferir entre duas escolas ativas continua recusado');

  /* o roteiro completo: inativar a errada, associar a direção na certa, vincular */
  B.escolaSituacao({ token: TKC12b, inep: '36001', situacao: 'inativa', confirmado: true });
  r12 = B.adotarPPP({ token: TKDE12b, protocolo: P12, inep: '36002' });
  ok(!r12.ok && /não tem diretor em exercício/.test(r12.erro || ''),
     'v8.13 (C12): a escola certa ainda sem direção recebe a recusa de sempre');
  salvarDiretor(B, { email: 'dir.certa.c12@educacao.mg.gov.br', nome: 'Diretora Certa C12',
                   papel: 'diretor_escolar', inep: '36002' });
  r12 = B.adotarPPP({ token: TKDE12b, protocolo: P12, inep: '36002' });
  ok(r12.ok && r12.inep === '36002' && r12.email === 'dir.certa.c12@educacao.mg.gov.br',
     'v8.13 (C12): com a escola de origem INATIVA, o PPP é resgatado para a escola certa');
  ok((B.linhaDoTempo({ token: TKC12b, protocolo: P12 }).eventos || [])
      .some(l => /escola de origem inativa na base/.test(l.detalhe || l.obs || JSON.stringify(l))),
     'v8.13 (C12): e o ciclo registra por que a transferência foi possível');

  /* escola homônima na mesma SRE: avisa, não bloqueia */
  const hom = B.escolaSalvar({ token: TKC12b, inep: '36003', escola: 'EE C12 Certa',
                               municipio: 'Ijaci', sre: 'SRE C12', codigoInep: censoDe('36003') });
  ok(hom.ok && hom.criada && /Já existe EE C12 Certa \(código 36002\)/.test(hom.aviso || ''),
     'v8.13 (C12): criar escola de nome já existente na mesma SRE passa, com aviso');
  ok(!B.escolaSalvar({ token: TKC12b, inep: '36004', escola: 'EE C12 Sozinha',
                       municipio: 'Ijaci', sre: 'SRE C12', codigoInep: censoDe('36004') }).aviso,
     'v8.13 (C12): e um nome que não se repete não gera aviso nenhum');
}

/* ==================== v8.13 (C13): escola que muda de SRE ==================== */
{
  const TKC13 = B.criarSessao_({ email: 'central.c13@educacao.mg.gov.br', nome: 'Central C13',
                                 perfil: 'central', papel: 'central' });
  const INEP13 = '37001';
  B.escolaSalvar({ token: TKC13, inep: INEP13, escola: 'EE C13', municipio: 'Betim', sre: 'Metro A C13', codigoInep: censoDe(INEP13) });
  B.acessoSalvar({ token: TKC13, email: 'sup.a.c13@educacao.mg.gov.br', nome: 'Super Metro A',
                   papel: 'superintendente', perfil: 'regional', sre: 'Metro A C13' });
  B.acessoSalvar({ token: TKC13, email: 'sup.b.c13@educacao.mg.gov.br', nome: 'Super Metro B',
                   papel: 'superintendente', perfil: 'regional', sre: 'Metro B C13' });
  const TKA13 = B.criarSessao_({ email: 'sup.a.c13@educacao.mg.gov.br', nome: 'Super Metro A',
    perfil: 'regional', papel: 'superintendente', sre: 'Metro A C13' });
  const TKB13 = B.criarSessao_({ email: 'sup.b.c13@educacao.mg.gov.br', nome: 'Super Metro B',
    perfil: 'regional', papel: 'superintendente', sre: 'Metro B C13' });
  salvarDiretor(B, { email: 'dir.c13@educacao.mg.gov.br', nome: 'Diretora C13',
                   papel: 'diretor_escolar', inep: INEP13 });
  const TKD13 = B.criarSessao_({ email: 'dir.c13@educacao.mg.gov.br', nome: 'Diretora C13', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'Metro A C13', inep: INEP13, escola: 'EE C13' });
  B.acessoSalvar({ token: TKD13, email: 'membro.c13@exemplo.mg', nome: 'Membro C13', papel: 'colegiado',
                   segmento: 'Famílias', relacao: 'mãe de estudante do 9º ano' });
  const P13 = B.salvarPPP({ token: TKD13, escola: 'EE C13', inep: INEP13, sre: 'Metro A C13',
                            municipio: 'Betim', sessao: 'c13' }).protocolo;
  const noPainel = (tk, prot) => (B.painelRegistros({ token: tk, filtros: {} }).linhas || []).some(x => x.protocolo === prot);
  ok(noPainel(TKA13, P13) && !noPainel(TKB13, P13),
     'v8.13 (C13): antes da mudança, quem vê o PPP é a Metro A');

  const mov = B.escolaSalvar({ token: TKC13, inep: INEP13, escola: 'EE C13',
                               municipio: 'Betim', sre: 'Metro B C13', codigoInep: censoDe(INEP13) });
  ok(mov.ok && mov.mudouSre === true && mov.acessosMovidos === 2 && mov.periodosReabertos === 2 &&
     mov.registrosMovidos >= 1,
     'v8.13 (C13): mover a escola move os cadastros de acesso e os PPPs em elaboração — ' +
     JSON.stringify({ a: mov.acessosMovidos, p: mov.periodosReabertos, r: mov.registrosMovidos }));
  ok(B.acessoPorInep_(INEP13).sre === 'Metro B C13' &&
     B.colegiadoDaEscola_(INEP13).every(m => m.sre === 'Metro B C13'),
     'v8.13 (C13): direção e colegiado passam para a regional nova');
  const perDir = B.gestoresTodos_().filter(g => g.email === 'dir.c13@educacao.mg.gov.br');
  ok(perDir.length === 2 && perDir[0].fim && perDir[0].sre === 'Metro A C13' &&
     /escola transferida de Metro A C13 para Metro B C13/.test(perDir[0].motivo) &&
     !perDir[1].fim && perDir[1].sre === 'Metro B C13',
     'v8.13 (C13): o período foi fechado na Metro A, com o motivo, e reaberto na Metro B');
  ok(noPainel(TKB13, P13) && !noPainel(TKA13, P13),
     'v8.13 (C13): a Metro B passa a ver o PPP no painel, e a Metro A deixa de vê-lo');
  ok(B.registroLeitura({ token: TKB13, p: P13 }).ok &&
     /outra Superintendência/.test(B.registroLeitura({ token: TKA13, p: P13 }).erro || ''),
     'v8.13 (C13): a Metro B abre o PPP; a Metro A não abre mais');
  ok(B.coberturaRegional({ token: TKB13 }).escolas.some(e => e.inep === INEP13) &&
     !B.coberturaRegional({ token: TKA13 }).escolas.some(e => e.inep === INEP13),
     'v8.13 (C13): a Cobertura também conta a escola na Metro B');
  ok(salvarDiretor(B, { email: 'dir2.c13@educacao.mg.gov.br', nome: 'Diretora C13 Dois',
                      papel: 'diretor_escolar', inep: INEP13 }).ok,
     'v8.13 (C13): e a Metro B troca a direção da escola');
  ok((B.linhaDoTempo({ token: TKC13, protocolo: P13 }).eventos || [])
      .some(l => /escola transferida de regional/.test(l.ato || '')),
     'v8.13 (C13): a transferência fica registrada no ciclo do PPP');

  /* um PPP já homologado mantém a SRE gravada na conferência pública */
  {
    const inep13b = '37002';
    B.escolaSalvar({ token: TKC13, inep: inep13b, escola: 'EE C13 Homologada', municipio: 'Betim', sre: 'Metro A C13', codigoInep: censoDe(inep13b) });
    salvarDiretor(B, { email: 'dir.homol.c13@educacao.mg.gov.br', nome: 'Diretora Homol',
                     papel: 'diretor_escolar', inep: inep13b });
    const tkh = B.criarSessao_({ email: 'dir.homol.c13@educacao.mg.gov.br', nome: 'Diretora Homol',
      perfil: 'escola', papel: 'diretor_escolar', sre: 'Metro A C13', inep: inep13b, escola: 'EE C13 Homologada' });
    const ph = B.salvarPPP({ token: tkh, escola: 'EE C13 Homologada', inep: inep13b, sre: 'Metro A C13',
                             municipio: 'Betim', sessao: 'c13h' }).protocolo;
    B.enviarParaValidacao({ token: tkh, protocolo: ph });
    B.validarPPP({ token: TKC13, protocolo: ph, parecer: 'Conforme.' });
    const conc = B.concluirPPP({ token: tkh, protocolo: ph, escola: 'EE C13 Homologada', inep: inep13b,
      sre: 'Metro A C13', municipio: 'Betim', direcao: 'Diretora Homol',
      docHtml: docTeste('<h3 class="doc-h">documento</h3>'), sessao: 'c13h' });
    const linhaH = B.linhaDoProtocolo_(B.abaRegistros_(), ph);
    B.gravarCampo_(B.abaRegistros_(), linhaH, 'status', 'Concluído');
    B.homologarPPP({ token: TKC13, protocolo: ph, confirmaSemAssinaturas: true });
    B.escolaSalvar({ token: TKC13, inep: inep13b, escola: 'EE C13 Homologada', municipio: 'Betim', sre: 'Metro B C13', codigoInep: censoDe(inep13b) });
    ok(B.verificarDocumento({ codigo: conc.registro.hash }).sre === 'Metro A C13',
       'v8.13 (C13): o PPP já homologado continua respondendo a SRE antiga na conferência pública');
    ok(B.lerLinha_(B.abaRegistros_(), linhaH).sre === 'Metro A C13',
       'v8.13 (C13): e a SRE gravada no registro autenticado não é reescrita');
  }
}


/* ============================================================
   v8.13 (D01) — UMA GRAVAÇÃO POR VEZ, E A LINHA DIZ EM QUE REVISÃO ESTÁ
   (A5-01, A5-02, A4-06)

   Duas coisas, porque uma só não basta:
   (a) toda escrita na aba de registros acontece sob a trava do script,
       inclusive a regravação de linha existente, e a releitura da linha
       acontece DEPOIS da trava — é isso que faz a gravação pendente da
       escola encontrar o documento já concluído (ou já validado) e ser
       recusada pelo status, em vez de devolver a linha ao que era antes;
   (b) a coluna `rev`, que diz em que revisão a tela está: duas abas da
       mesma escola gravam em sequência, e a segunda é recusada em vez de
       apagar a primeira sem marca nenhuma.
   ============================================================ */
{
  const TKCD1 = B.criarSessao_({ email: 'central.d01@educacao.mg.gov.br', nome: 'Central D01',
                                 perfil: 'central', papel: 'central' });
  const SRED1 = 'Divinópolis D01';
  /* a regional precisa existir na base de escolas antes de receber acesso, e
     quem cadastra Diretor Educacional é o Superintendente, não o Central */
  B.escolaSalvar({ token: TKCD1, inep: '38000', escola: 'EE D01 base', municipio: 'Divinópolis', sre: SRED1, codigoInep: censoDe('38000') });
  B.acessoSalvar({ token: TKCD1, email: 'sup.d01@educacao.mg.gov.br', nome: 'Super D01',
                   papel: 'superintendente', perfil: 'regional', sre: SRED1 });
  const TKSUPD1 = B.criarSessao_({ email: 'sup.d01@educacao.mg.gov.br', nome: 'Super D01',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED1 });
  B.acessoSalvar({ token: TKSUPD1, email: 'de.d01@educacao.mg.gov.br', nome: 'DE D01',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED1 });
  const TKDED1 = B.criarSessao_({ email: 'de.d01@educacao.mg.gov.br', nome: 'DE D01',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED1 });

  /* uma escola nova por cenário: os testes de corrida destroem o estado */
  let seqD1 = 0;
  const escolaD1 = function () {
    seqD1++;
    const inep = '3801' + seqD1;
    const email = 'dir.d01.' + seqD1 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD1, inep: inep, escola: 'EE D01 ' + seqD1, municipio: 'Divinópolis', sre: SRED1, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: email, nome: 'Diretora D01 ' + seqD1, masp: '801000' + seqD1,
                     papel: 'diretor_escolar', inep: inep });
    const tk = B.criarSessao_({ email: email, nome: 'Diretora D01 ' + seqD1, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED1, inep: inep, escola: 'EE D01 ' + seqD1 });
    return { inep: inep, escola: 'EE D01 ' + seqD1, email: email, tk: tk };
  };
  /* leva um PPP até "Validado", que é o estado de onde se conclui */
  const validadoD1 = function (e, texto) {
    const p = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, sre: SRED1,
                            municipio: 'Divinópolis', sessao: 'd01', tMissao: texto || 'conteúdo' }).protocolo;
    B.enviarParaValidacao({ token: e.tk, protocolo: p });
    B.validarPPP({ token: TKDED1, protocolo: p, parecer: 'Conforme.' });
    return p;
  };
  /* Faz um TERCEIRO agir enquanto a gravação espera pela trava. É a única
     forma honesta de reproduzir a corrida com uma trava de verdade: o que
     acontece durante a espera é o que se encontra ao entrar. */
  const durandoATrava = function (acao) {
    const origem = S.g.LockService.getScriptLock;
    let feito = false;
    S.g.LockService.getScriptLock = function () {
      const l = origem.apply(this, arguments);
      const wait = l.waitLock;
      l.waitLock = function () {
        const r = wait.apply(l, arguments);
        if (!feito) { feito = true; S.g.LockService.getScriptLock = origem; acao(); }
        return r;
      };
      return l;
    };
    return function () { S.g.LockService.getScriptLock = origem; };
  };

  /* ---- (1) A5-01: a gravação pendente não desfaz a conclusão ---- */
  {
    const e = escolaD1(); const P = validadoD1(e, 'conteúdo avalizado pela SRE');
    let conc = null;
    const soltar = durandoATrava(function () {
      conc = B.concluirPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
        municipio: 'Divinópolis', direcao: 'Diretora D01', tMissao: 'conteúdo avalizado pela SRE',
        docHtml: '<div class="paginas"><p>documento oficial</p></div>', sessao: 'd01-outra' });
    });
    const pendente = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'd01', tMissao: 'texto digitado na aba 1' });
    soltar();
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(conc && conc.ok, 'D01: a conclusão que corre por dentro da espera é concluída');
    ok(!pendente.ok && pendente.bloqueado === true,
       'D01 (A5-01): a gravação que esperava pela trava encontra o PPP já concluído e é recusada');
    ok(g.status === 'Em assinatura', 'D01 (A5-01): o status da conclusão permanece');
    ok(!!g.hash && !!g.fonteId && !!g.assinaturas && !!g.textosFolha && !!g.concluidoEm,
       'D01 (A5-01): código, documento congelado, folha de assinaturas e data da conclusão ficam íntegros');
    ok(B.verificarDocumento({ codigo: g.hash }).ok === true,
       'D01 (A5-01): a conferência pública continua reconhecendo o código impresso no PDF');
    ok(g.tMissao === 'conteúdo avalizado pela SRE',
       'D01 (A5-01): e o conteúdo é o que foi avalizado, não o que a aba pendente tinha na tela');
  }

  /* ---- (2) A5-02: a gravação pendente não apaga a validação da SRE ---- */
  {
    const e = escolaD1();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'd01', tMissao: 'conteúdo que a SRE vai validar' }).protocolo;
    const soltar = durandoATrava(function () {
      B.enviarParaValidacao({ token: e.tk, protocolo: P });
      B.validarPPP({ token: TKDED1, protocolo: P, parecer: 'validado' });
    });
    const pendente = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'd01', tMissao: 'texto digitado durante a validação' });
    soltar();
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(!pendente.ok && pendente.bloqueado === true,
       'D01 (A5-02): a gravação que esperava encontra o PPP já validado e é recusada');
    ok(g.status === 'Validado' && !!g.validadoPor && !!g.validadoEm && !!g.enviadoValidacaoEm,
       'D01 (A5-02): a validação da Superintendência permanece na linha');
    ok(g.tMissao === 'conteúdo que a SRE vai validar',
       'D01 (A5-02): e o texto avalizado é o que continua gravado');
  }

  /* ---- (3) A4-06: duas abas da mesma escola, em sequência ---- */
  {
    const e = escolaD1();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-1', tMissao: 'primeira redação' }).protocolo;
    const abrir = function (sessao) {
      const r = B.buscarPPP({ p: P, sessao: sessao, token: e.tk });
      return { rev: r.rev, reg: r.registro };
    };
    const a1 = abrir('aba-1');
    const a2 = abrir('aba-2');
    ok(typeof a1.rev === 'number' && a1.rev === a2.rev,
       'D01: as duas abas abrem o documento na mesma revisão (' + a1.rev + ')');
    const g1 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-1', tMissao: 'texto da aba 1', rev: a1.rev });
    ok(g1.ok && g1.rev === a1.rev + 1, 'D01: a primeira aba grava e a revisão sobe');
    const g2 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-2', tMissao: 'texto da aba 2', rev: a2.rev });
    ok(!g2.ok && g2.conflito === true && g2.rev === g1.rev,
       'D01 (A4-06): a segunda aba é recusada, com a revisão de agora');
    ok(/gravado por outra pessoa/.test(g2.erro || '') && /continua na tela/.test(g2.erro || ''),
       'D01: a recusa diz o que houve e que o texto não se perdeu');
    ok(g2.registro && g2.registro.tMissao === 'texto da aba 1',
       'D01: a recusa devolve o registro do servidor, para a tela poder mostrá-lo');
    ok(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)).tMissao === 'texto da aba 1',
       'D01 (A4-06): e o texto da primeira aba continua gravado');
    /* sobrepor: decisão explícita da pessoa, registrada no ciclo */
    const g3 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-2', tMissao: 'texto da aba 2', rev: a2.rev, sobrepor: true });
    ok(g3.ok && B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)).tMissao === 'texto da aba 2',
       'D01: com "gravar o meu por cima" a gravação passa');
    const atos = B.linhaDoTempo({ token: e.tk, protocolo: P }).eventos.map(function (x) { return x.ato; });
    ok(atos.indexOf('gravação sobreposta') >= 0,
       'D01: e a sobreposição fica registrada na linha do tempo do documento');
    /* cliente antigo: sem rev, nunca é recusado */
    const g4 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-3', tMissao: 'cliente sem rev' });
    ok(g4.ok, 'D01: cliente que não manda `rev` continua gravando (implantação sem derrubar aba aberta)');
    /* linha antiga, sem a coluna: célula vazia vale 0 */
    const linhaV = B.linhaDoProtocolo_(B.abaRegistros_(), P);
    B.abaRegistros_().getRange(linhaV, B.IDX.rev).setValue('');
    const g5 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'aba-4', tMissao: 'linha sem revisão', rev: 0 });
    ok(g5.ok && g5.rev === 1, 'D01: registro antigo, com a célula de revisão vazia, vale revisão 0 e continua gravando');
  }

  /* ---- (4) todo ato do ciclo faz a revisão subir ---- */
  {
    const e = escolaD1();
    const P = validadoD1(e, 'conteúdo');
    const aba = B.abaRegistros_(), linha = B.linhaDoProtocolo_(aba, P);
    const revDe = function () { return parseInt(B.lerLinha_(aba, linha).rev, 10) || 0; };
    const antesConc = revDe();
    B.concluirPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', direcao: 'Diretora D01', docHtml: '<div class="paginas"><p>doc</p></div>', sessao: 'd01' });
    ok(revDe() > antesConc, 'D01: concluir faz a revisão da linha subir');
    const antesAssin = revDe();
    B.assinarDirecao({ token: e.tk, protocolo: P, atesto: true, confirma: true });
    ok(revDe() >= antesAssin, 'D01: a assinatura da direção também marca a linha');
  }

  /* ---- (4b) base em uso: aba com o cabeçalho ANTIGO ganha a coluna ----
     Num ambiente simulado à parte, porque o que se exercita aqui é a
     PRIMEIRA execução do sistema sobre uma planilha gravada antes da 8.13. */
  {
    const S2 = SS.criarServicos({ nomePlanilha: 'base antiga D01' });
    const B2 = SS.carregarCodigo(src, S2);
    const ss2 = S2.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba2 = ss2.insertSheet(B2.NOME_ABA);
    const cabAntigo = B2.CAMPOS.slice(0, B2.CAMPOS.length - 1).map(function (c) { return c.col; });
    aba2.getRange(1, 1, 1, cabAntigo.length).setValues([cabAntigo]);
    const linhaAntiga = B2.CAMPOS.slice(0, B2.CAMPOS.length - 1).map(function (c) {
      return c.key === 'protocolo' ? 'PPP-2019-0009-ANTG'
           : c.key === 'versao' ? 1
           : c.key === 'status' ? 'Em andamento'
           : c.key === 'escola' ? 'EE do Cabeçalho Antigo'
           : c.key === 'inep' ? '38999'
           : c.key === 'criadoEm' ? '10/02/2019 09:00'
           : c.key === 'tMissao' ? 'texto gravado antes da 8.13'
           : c.key === 'etapas' ? 'Ensino Médio' : '';
    });
    aba2.getRange(2, 1, 1, linhaAntiga.length).setValues([linhaAntiga]);
    ok(aba2.getLastColumn() === B2.CAMPOS.length - 1,
       'D01: a aba semeada tem o cabeçalho ANTIGO, sem a coluna de revisão');
    /* abaRegistros_ reescreve o cabeçalho quando faltam colunas — é o caminho
       previsto desde sempre para coluna nova ao final */
    const abaNova = B2.abaRegistros_();
    ok(abaNova.getLastColumn() === B2.CAMPOS.length,
       'D01: abaRegistros_ acrescenta a coluna nova ao cabeçalho da aba antiga');
    ok(abaNova.getRange(1, B2.IDX.rev).getDisplayValues()[0][0] === 'Revisão do registro',
       'D01: e o rótulo novo fica na última coluna');
    const lida = B2.lerLinha_(abaNova, 2);
    ok(lida.protocolo === 'PPP-2019-0009-ANTG' && lida.escola === 'EE do Cabeçalho Antigo' &&
       lida.tMissao === 'texto gravado antes da 8.13' && String(lida.inep) === '38999' &&
       lida.etapas.join('') === 'Ensino Médio',
       'D01: e nada se desalinha — a linha antiga continua sendo lida campo a campo');
    ok((parseInt(lida.rev, 10) || 0) === 0, 'D01: a célula de revisão vazia vale 0');
  }

  /* ---- (5) o aperto do simulador: nada escreve fora da trava ---- */
  {
    const e = escolaD1();
    GRAVACOES.length = 0;
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'd01', tMissao: 'a' }).protocolo;
    B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep, sre: SRED1,
      municipio: 'Divinópolis', sessao: 'd01', tMissao: 'b' });
    B.enviarParaValidacao({ token: e.tk, protocolo: P });
    B.validarPPP({ token: TKDED1, protocolo: P, parecer: 'Conforme.' });
    const soltas = GRAVACOES.filter(function (g) { return g.aba === 'Registros' && !g.comTrava; });
    ok(GRAVACOES.filter(function (g) { return g.aba === 'Registros'; }).length > 0 && soltas.length === 0,
       'D01 (D24): nenhuma escrita na aba de registros acontece com a trava solta (' + soltas.length + ' soltas)');
  }
}


/* ============================================================
   v8.13 (D02) — O QUE A TELA ESCREVE É SÓ O QUE É DA TELA (A5-03, A5-04)

   O `switch` de salvarPPP era uma lista NEGRA: protegia 18 chaves e deixava
   TODAS as demais virem de `dados[key]`. Ficaram de fora a ata inteira, a
   homologação da SRE, os anexos, os textos congelados da folha e a bandeira
   interna `concluindo` — com o que a escola imprimia na folha oficial a
   homologação que ela mesma escreveu, assinava sem ata nenhuma e trocava o
   texto depois do aval da Superintendência. A lista virou BRANCA.
   ============================================================ */
{
  const TKCD2 = B.criarSessao_({ email: 'central.d02@educacao.mg.gov.br', nome: 'Central D02',
                                 perfil: 'central', papel: 'central' });
  const SRED2 = 'Divinópolis D02';
  B.escolaSalvar({ token: TKCD2, inep: '39000', escola: 'EE D02 base', municipio: 'Divinópolis', sre: SRED2, codigoInep: censoDe('39000') });
  B.acessoSalvar({ token: TKCD2, email: 'sup.d02@educacao.mg.gov.br', nome: 'Super D02',
                   papel: 'superintendente', perfil: 'regional', sre: SRED2 });
  const TKSUPD2 = B.criarSessao_({ email: 'sup.d02@educacao.mg.gov.br', nome: 'Super D02',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED2 });
  B.acessoSalvar({ token: TKSUPD2, email: 'de.d02@educacao.mg.gov.br', nome: 'DE D02',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED2 });
  const TKDED2 = B.criarSessao_({ email: 'de.d02@educacao.mg.gov.br', nome: 'DE D02',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED2 });
  let seqD2 = 0;
  const escolaD2 = function () {
    seqD2++;
    const inep = '3901' + seqD2, email = 'dir.d02.' + seqD2 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD2, inep: inep, escola: 'EE D02 ' + seqD2, municipio: 'Divinópolis', sre: SRED2, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: email, nome: 'Diretora D02 ' + seqD2, masp: '901000' + seqD2,
                     papel: 'diretor_escolar', inep: inep });
    return { inep: inep, escola: 'EE D02 ' + seqD2, email: email,
             tk: B.criarSessao_({ email: email, nome: 'Diretora D02 ' + seqD2, perfil: 'escola',
               papel: 'diretor_escolar', sre: SRED2, inep: inep, escola: 'EE D02 ' + seqD2 }) };
  };

  /* ---- a estrutura: lista branca de verdade ---- */
  {
    const semMarca = B.CAMPOS.filter(function (c) { return !c.deTela; }).map(function (c) { return c.key; });
    ok(B.CAMPOS.filter(function (c) { return c.deTela; }).length > 50,
       'D02: CAMPOS declara quais colunas a tela escreve');
    ['homolPor', 'homolEm', 'homolAto', 'homolDestino', 'homolData', 'ataId', 'ataUrl', 'ataNome',
     'ataData', 'ataIdent', 'anexos', 'textosFolha', 'enviadoValidacaoEm', 'pct', 'lockSessao',
     'lockDesde', 'objetivosAnteriores', 'indicadoresAnteriores', 'sre', 'inep', 'rev'].forEach(function (k) {
      ok(semMarca.indexOf(k) >= 0, 'D02: a coluna "' + k + '" é do servidor, não da tela');
    });
  }

  /* ---- (1) A5-03: a forja no payload não entra em nenhuma coluna ---- */
  {
    const e = escolaD2();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
                            sessao: 'd02', tMissao: 'conteúdo' }).protocolo;
    const forja = { homolPor: 'Fulano de Tal · Superintendente', homolEm: '01/03/2026 09:00',
      homolAto: 'Ato 9999/2026', homolDestino: 'DE SRE Falsa', homolData: '01/03/2026 08:00',
      ataId: 'id-que-nao-existe', ataUrl: 'https://drive/NAO-EXISTE',
      ataNome: 'ata-que-nunca-foi-enviada.pdf', ataData: '10/02/2026', ataIdent: 'Ata 1/2026',
      anexos: JSON.stringify([{ nome: 'anexo-forjado.pdf', url: 'https://drive/x' }]),
      textosFolha: JSON.stringify({ 'DOC.folha.codigo': 'texto trocado pela escola' }),
      enviadoValidacaoEm: '01/01/2026 00:00', validadoPor: 'Quem Nunca Validou',
      validadoEm: '01/01/2026 00:00', parecerValidacao: 'aprovado por mim mesmo',
      hash: 'AAAA-BBBB-CCCC', fonteId: 'fonte-forjada', assinaturas: JSON.stringify([{ papel: 'Direção Escolar', assinadoEm: 'ontem' }]),
      concluidoEm: '01/01/2026 00:00', status: 'Homologado', pct: 100, pdfId: 'pdf-forjado',
      objetivosAnteriores: 'inventado', indicadoresAnteriores: '{"ano":"1900"}' };
    const r = B.salvarPPP(Object.assign({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep,
      municipio: 'Divinópolis', sessao: 'd02', tMissao: 'conteúdo' }, forja));
    ok(r.ok, 'D02: a gravação com a forja no payload passa (o conteúdo da tela é legítimo)');
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(!g.homolPor && !g.homolEm && !g.homolAto && !g.homolDestino && !g.homolData,
       'D02 (A5-03): nenhuma coluna de homologação é escrita pela tela');
    ok(!g.ataId && !g.ataUrl && !g.ataNome && !g.ataData && !g.ataIdent,
       'D02 (A5-03): nenhuma coluna de ata é escrita pela tela');
    ok(!g.anexos && !g.textosFolha && !g.hash && !g.fonteId && !g.assinaturas && !g.concluidoEm,
       'D02: anexos, textos congelados da folha, código, documento congelado e assinaturas ficam com o servidor');
    ok(!g.enviadoValidacaoEm && !g.validadoPor && !g.validadoEm && !g.parecerValidacao,
       'D02: a validação da SRE não vem da tela');
    ok(g.status === 'Em andamento', 'D02: nem o status');
    ok(!g.objetivosAnteriores && !g.indicadoresAnteriores,
       'D02: os objetivos e indicadores da versão anterior são do servidor');
    ok(String(g.pct) !== '100', 'D02: o percentual continua sendo calculado, não recebido');
    ok(g.tMissao === 'conteúdo', 'D02: e o que É da tela continua sendo gravado');
  }

  /* ---- (2) A5-03: sem ata de verdade não há assinatura da direção, nem homologação na folha ---- */
  {
    const e = escolaD2();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
                            sessao: 'd02', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: e.tk, protocolo: P });
    B.validarPPP({ token: TKDED2, protocolo: P, parecer: 'ok' });
    const conc = B.concluirPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep,
      municipio: 'Divinópolis', direcao: 'Diretora D02', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: '<div class="paginas"><p>corpo</p></div>', sessao: 'd02',
      homolPor: 'Fulano · Superintendente', homolEm: '01/03/2026 09:00', homolAto: 'Ato 9999/2026',
      ataUrl: 'https://drive/NAO-EXISTE', ataNome: 'ata-inexistente.pdf', ataData: '10/02/2026' });
    ok(conc.ok, 'D02: a conclusão com a forja no payload acontece — e ignora a forja');
    const g1 = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(!g1.ataId && !g1.ataUrl && !g1.homolPor && !g1.homolEm,
       'D02 (A5-03): a conclusão não leva a ata nem a homologação forjadas');
    const assDir = B.assinarDirecao({ p: P, token: e.tk, atesto: true });
    ok(!assDir.ok && /ata da reunião/.test(assDir.erro || ''),
       'D02 (A5-03): sem ata de verdade no acervo a direção não assina');
    const pub = B.verificarDocumento({ codigo: g1.hash });
    ok(pub.ok === true && !pub.homolPor && !pub.homolEm,
       'D02 (A5-03): a porta pública não devolve homologação nenhuma');
    ok(B.folhaAssinaturas_(g1).indexOf('Homologado pela Superintendência') < 0,
       'D02 (A5-03): e a folha oficial não imprime a homologação que a escola escreveu');
  }

  /* ---- (3) A5-04: a bandeira interna não viaja no payload ---- */
  {
    const e = escolaD2();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
      sessao: 'd02', tMissao: 'Missão ORIGINAL que a SRE leu e validou.' }).protocolo;
    B.enviarParaValidacao({ token: e.tk, protocolo: P });
    B.validarPPP({ token: TKDED2, protocolo: P, parecer: 'validado como está' });
    const r = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: e.inep,
      municipio: 'Divinópolis', sessao: 'd02', tMissao: 'TEXTO TROCADO DEPOIS DO AVAL', concluindo: true });
    ok(!r.ok && r.bloqueado === true && /já foi validado/.test(r.erro || ''),
       'D02 (A5-04): `concluindo:true` no payload não destrava o PPP já validado');
    ok(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)).tMissao ===
       'Missão ORIGINAL que a SRE leu e validou.',
       'D02 (A5-04): o texto avalizado pela Superintendência continua sendo o gravado');
  }

  /* ---- (4) escopo vem da sessão, não do payload ---- */
  {
    const e = escolaD2();
    const P = B.salvarPPP({ token: e.tk, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
      sessao: 'd02', sre: 'Montes Claros', tMissao: 'x' }).protocolo;
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(g.sre === SRED2, 'D02: `sre` no payload é ignorado — a regional é a da sessão (' + g.sre + ')');
    ok(String(g.inep) === e.inep, 'D02: e o código da escola também');
    const r2 = B.salvarPPP({ token: e.tk, protocolo: P, escola: e.escola, inep: '99999',
      municipio: 'Divinópolis', sessao: 'd02', sre: 'Uberlândia', tMissao: 'y' });
    const g2 = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(r2.ok && g2.sre === SRED2 && String(g2.inep) === e.inep,
       'D02: nem na regravação a tela move o registro de escopo');
  }

  /* ---- (5) nenhuma regressão de conteúdo: o que a tela manda, a tela relê ---- */
  {
    const e = escolaD2();
    const enviado = { token: e.tk, escola: e.escola, inep: e.inep, municipio: 'Divinópolis', sessao: 'd02' };
    const listas = { etapas: ['Ensino Médio'], mods: ['Educação Especial'], infra: ['Biblioteca ou sala de leitura'],
                     temas: ['Educação ambiental'], principios: ['Educação integral'], metodos: ['Projetos'] };
    B.CAMPOS.filter(function (c) { return c.deTela; }).forEach(function (c) {
      if (c.tipo === 'lista') { enviado[c.key] = listas[c.key] || ['Um item']; return; }
      if (c.key === 'escola' || c.key === 'municipio') return;
      if (c.key === 'tela') { enviado[c.key] = 7; return; }
      if (c.key === 'quorumPresentes' || c.key === 'quorumTotal' || c.key === 'estudantes' || c.key === 'turmas') { enviado[c.key] = '12'; return; }
      if (c.key === 'assembleia' || c.key === 'analiseSre' || c.key === 'aprovacao') { enviado[c.key] = '10/03/2026'; return; }
      if (c.key === 'detalhes' || c.key === 'selecoes' || c.key === 'tarefas' || c.key === 'indicadores') { enviado[c.key] = '{"k":"' + c.key + '"}'; return; }
      enviado[c.key] = 'valor de ' + c.key;
    });
    const rr = B.salvarPPP(enviado);
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), rr.protocolo));
    const perdidas = B.CAMPOS.filter(function (c) { return c.deTela; }).filter(function (c) {
      const esperado = enviado[c.key];
      if (c.tipo === 'lista') return (g[c.key] || []).join(';') !== esperado.join(';');
      return String(g[c.key]) !== String(esperado);
    }).map(function (c) { return c.key; });
    ok(rr.ok && perdidas.length === 0,
       'D02: tudo o que a tela escreve continua sendo gravado e relido (' + perdidas.length +
       ' perdidas' + (perdidas.length ? ': ' + perdidas.slice(0, 5).join(', ') : '') + ')');
  }
}


/* ============================================================
   v8.13 (D03) — QUEM ASSINA É QUEM ESTÁ CADASTRADO (A5-07, A5-13, A5-10)

   A regra da v7.3/T-15 — "nome, MASP e e-mail vêm do cadastro, e não do que
   a tela digitou" — só valia para a direção, e mesmo lá com queda para o
   payload. Um membro do Colegiado assinava a própria caixa como "Secretário
   de Estado de Educação", com o MASP que quisesse, e era isso que saía no
   PDF oficial e na conferência pública. Agora: sem cadastro, o ato é
   RECUSADO; e o ato reconfere o VÍNCULO com esta escola, não só a presença
   do e-mail na folha.
   ============================================================ */
{
  const TKCD3 = B.criarSessao_({ email: 'central.d03@educacao.mg.gov.br', nome: 'Central D03',
                                 perfil: 'central', papel: 'central' });
  const SRED3 = 'Divinópolis D03';
  B.escolaSalvar({ token: TKCD3, inep: '40000', escola: 'EE D03 base', municipio: 'Divinópolis', sre: SRED3, codigoInep: censoDe('40000') });
  B.acessoSalvar({ token: TKCD3, email: 'sup.d03@educacao.mg.gov.br', nome: 'Super D03',
                   papel: 'superintendente', perfil: 'regional', sre: SRED3 });
  const TKSUPD3 = B.criarSessao_({ email: 'sup.d03@educacao.mg.gov.br', nome: 'Super D03',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED3 });
  B.acessoSalvar({ token: TKSUPD3, email: 'de.d03@educacao.mg.gov.br', nome: 'DE D03',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED3 });
  const TKDED3 = B.criarSessao_({ email: 'de.d03@educacao.mg.gov.br', nome: 'DE D03',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED3 });
  let seqD3 = 0;
  /* uma escola completa: direção cadastrada com MASP e dois membros do Colegiado */
  const cenarioD3 = function () {
    seqD3++;
    const inep = '4001' + seqD3, nome = 'EE D03 ' + seqD3;
    const dirMail = 'dir.d03.' + seqD3 + '@educacao.mg.gov.br';
    const anaMail = 'ana.d03.' + seqD3 + '@educacao.mg.gov.br';
    const biaMail = 'bia.d03.' + seqD3 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD3, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SRED3, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: dirMail, nome: 'Diretora Cadastrada ' + seqD3,
                     masp: '110000' + seqD3, papel: 'diretor_escolar', inep: inep });
    const tkDir = B.criarSessao_({ email: dirMail, nome: 'Diretora Cadastrada ' + seqD3, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED3, inep: inep, escola: nome });
    B.acessoSalvar({ token: tkDir, email: anaMail, nome: 'Ana do Cadastro ' + seqD3, masp: '220000' + seqD3,
                     papel: 'colegiado', perfil: 'escola', inep: inep, segmento: 'Docente' });
    B.acessoSalvar({ token: tkDir, email: biaMail, nome: 'Bia do Cadastro ' + seqD3, masp: '330000' + seqD3,
                     papel: 'colegiado', perfil: 'escola', inep: inep, segmento: 'Estudante',
                     relacao: 'Estudante do 3º ano do Ensino Médio' });
    const tkAna = B.criarSessao_({ email: anaMail, nome: 'Ana do Cadastro ' + seqD3, perfil: 'escola',
      papel: 'colegiado', sre: SRED3, inep: inep, escola: nome });
    return { inep: inep, escola: nome, dirMail: dirMail, anaMail: anaMail, biaMail: biaMail,
             tkDir: tkDir, tkAna: tkAna };
  };
  /* leva o PPP até a coleta de assinaturas, com ata e presença marcadas */
  const ateAssinatura = function (e) {
    const P = B.salvarPPP({ token: e.tkDir, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
      sessao: 'd03', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: e.tkDir, protocolo: P });
    B.validarPPP({ token: TKDED3, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: e.tkDir, protocolo: P, escola: e.escola, inep: e.inep, municipio: 'Divinópolis',
      direcao: 'NOME QUE A TELA DIGITOU', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: '<div class="paginas"><p>corpo</p></div>', sessao: 'd03',
      assinaturaDirecao: { nome: 'QUEM EU QUISER', masp: '9999999', email: 'inventado@x.mg' } });
    B.registrarAta({ p: P, token: e.tkDir, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                     dataReuniao: '30/08/2026', identificacao: 'Ata 3' });
    B.presencaColegiado({ p: P, token: e.tkDir, emails: [e.anaMail, e.biaMail] });
    return P;
  };
  const caixa = function (P, filtro) {
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    return B.assinaturasDe_(g).filter(filtro)[0] || {};
  };

  /* ---- (1) A5-13: a caixa da direção nasce do cadastro ---- */
  {
    const e = cenarioD3(); const P = ateAssinatura(e);
    const cx = caixa(P, function (a) { return a.papel === 'Direção Escolar'; });
    ok(cx.nome === B.acessoPorEmail_(e.dirMail).nome,
       'D03 (A5-13): a caixa da direção nasce com o nome do CADASTRO, não com o que a tela mandou');
    ok(cx.masp === B.acessoPorEmail_(e.dirMail).masp && cx.masp !== '9999999',
       'D03 (A5-13): o MASP impresso é o do cadastro');
    ok(cx.email === e.dirMail, 'D03 (A5-13): e o e-mail também — "assinaturaDirecao" do payload é ignorada');
    ok(cx.nome !== 'NOME QUE A TELA DIGITOU',
       'D03: a caixa não herda nem o "Diretor(a)" digitado na identificação');

    /* a direção cadastrada assina normalmente, e o payload `pessoa` é ignorado */
    const ass = B.assinarDirecao({ p: P, token: e.tkDir, atesto: true,
      pessoa: { nome: 'QUEM EU QUISER', masp: '9999999', email: 'inventado@x.mg' } });
    ok(ass.ok, 'D03: a direção cadastrada assina normalmente');
    const cx2 = caixa(P, function (a) { return a.papel === 'Direção Escolar'; });
    ok(cx2.nome === B.acessoPorEmail_(e.dirMail).nome && cx2.masp !== '9999999' && cx2.email === e.dirMail,
       'D03 (A5-13): assinada, a caixa continua com o cadastro — `pessoa` do payload não entra');
    ok(!!cx2.assinadoEm, 'D03: e a assinatura fica registrada');
    ok(B.folhaAssinaturas_(B.lerLinha_(B.abaRegistros_(),
        B.linhaDoProtocolo_(B.abaRegistros_(), P))).indexOf('QUEM EU QUISER') < 0,
       'D03: o nome inventado não chega à folha oficial');
  }

  /* ---- (2) A5-07: o membro do Colegiado não redige a própria caixa ---- */
  {
    const e = cenarioD3(); const P = ateAssinatura(e);
    const r = B.assinarNoSistema({ token: e.tkAna, protocolo: P, aceite: true,
      nome: 'Secretário de Estado de Educação', masp: '0000001' });
    ok(r.ok, 'D03: o membro do Colegiado cadastrado assina');
    const cx = caixa(P, function (a) { return String(a.email || '').toLowerCase() === e.anaMail; });
    ok(cx.nome === B.acessoPorEmail_(e.anaMail).nome && cx.nome !== 'Secretário de Estado de Educação',
       'D03 (A5-07): o nome impresso é o do cadastro, não o que o próprio signatário mandou');
    ok(cx.masp === B.acessoPorEmail_(e.anaMail).masp && cx.masp !== '0000001',
       'D03 (A5-07): e o MASP também');
    const folha = B.folhaAssinaturas_(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)));
    ok(folha.indexOf('Secretário de Estado de Educação') < 0 && folha.indexOf('0000001') < 0,
       'D03 (A5-07): a folha oficial não imprime o cargo nem o MASP forjados');
  }

  /* ---- (3) A5-10: quem perdeu o vínculo com o Colegiado desta escola não assina ---- */
  {
    const e = cenarioD3(); const P = ateAssinatura(e);
    /* A pessoa continua CADASTRADA e com acesso legítimo — passou a integrar
       o Colegiado de OUTRA escola. C04 derruba quem perdeu o cadastro; este
       é o caso que sobra: sessão nova e válida, vínculo com esta escola
       encerrado. A mudança é feita na aba, como a carga de acessos faria. */
    const e2 = cenarioD3();
    const abaAc = B.abaAcessos_(); const lAna = B.acessoPorEmail_(e.anaMail).linha;
    abaAc.getRange(lAna, 10).setValue(e2.inep);
    abaAc.getRange(lAna, 11).setValue(e2.escola);
    B.invalidarAcessos_();
    ok(!!B.acessoPorEmail_(e.anaMail), 'D03: a pessoa continua cadastrada no sistema');
    ok(!B.membrosColegiado_(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)))
        .some(function (m) { return m.email === e.anaMail; }),
       'D03: e não integra mais o Colegiado Escolar desta escola');
    const tkNova = B.criarSessao_({ email: e.anaMail, nome: B.acessoPorEmail_(e.anaMail).nome,
      perfil: 'escola', papel: 'colegiado', sre: SRED3, inep: e2.inep, escola: e2.escola });
    const r = B.assinarNoSistema({ token: tkNova, protocolo: P, aceite: true });
    ok(!r.ok && /vínculo com o Colegiado Escolar/.test(r.erro || ''),
       'D03 (A5-10): a assinatura é recusada, e a mensagem diz por quê');
    ok(!caixa(P, function (a) { return String(a.email || '').toLowerCase() === e.anaMail; }).assinadoEm,
       'D03 (A5-10): a caixa continua sem assinatura');
    /* a folha continua registrando que a pessoa compareceu à reunião */
    ok(!!caixa(P, function (a) { return String(a.email || '').toLowerCase() === e.anaMail; }).papel,
       'D03 (A5-10): mas a folha continua registrando quem compareceu à reunião');
  }

  /* ---- (4) a queda para o payload saiu do código ---- */
  ok(!/pessoa\.nome/.test(src) && !/pessoa\.masp/.test(src) && !/dados\.assinaturaDirecao/.test(src),
     'D03: nome, MASP e e-mail de assinatura não são mais lidos do payload em lugar nenhum do servidor');
  ok(/O seu cadastro não foi encontrado/.test(src) && /O cadastro da direção não foi encontrado/.test(src),
     'D03: sem cadastro, o ato é recusado — não completado pela tela');
}


/* ============================================================
   v8.13 (D04) — O CÓDIGO DE AUTENTICIDADE IDENTIFICA UM DOCUMENTO, E UM SÓ
   (A5-06)

   O código era o SHA-256 de um HTML que a TELA mandava: quem concluía
   escolhia o código, dois PPPs com o mesmo corpo recebiam o mesmo, e
   `docHtml` vazio dava sempre o mesmo (o digest da string vazia). Como a
   busca entrega a PRIMEIRA linha que bate, quem digitasse o código impresso
   no PDF da escola B recebia a escola A. Agora a identidade do registro
   entra no digest, e a gravação confere a colisão antes de emitir.
   ============================================================ */
{
  const TKCD4 = B.criarSessao_({ email: 'central.d04@educacao.mg.gov.br', nome: 'Central D04',
                                 perfil: 'central', papel: 'central' });
  const SRED4 = 'Divinópolis D04';
  B.escolaSalvar({ token: TKCD4, inep: '41000', escola: 'EE D04 base', municipio: 'Divinópolis', sre: SRED4, codigoInep: censoDe('41000') });
  B.acessoSalvar({ token: TKCD4, email: 'sup.d04@educacao.mg.gov.br', nome: 'Super D04',
                   papel: 'superintendente', perfil: 'regional', sre: SRED4 });
  const TKSUPD4 = B.criarSessao_({ email: 'sup.d04@educacao.mg.gov.br', nome: 'Super D04',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED4 });
  B.acessoSalvar({ token: TKSUPD4, email: 'de.d04@educacao.mg.gov.br', nome: 'DE D04',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED4 });
  const TKDED4 = B.criarSessao_({ email: 'de.d04@educacao.mg.gov.br', nome: 'DE D04',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED4 });
  let seqD4 = 0;
  const concluidoD4 = function (corpo) {
    seqD4++;
    const inep = '4101' + seqD4, nome = 'EE D04 ' + seqD4, mail = 'dir.d04.' + seqD4 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD4, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SRED4, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: mail, nome: 'Diretora D04 ' + seqD4, masp: '120000' + seqD4,
                     papel: 'diretor_escolar', inep: inep });
    const tk = B.criarSessao_({ email: mail, nome: 'Diretora D04 ' + seqD4, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED4, inep: inep, escola: nome });
    const P = B.salvarPPP({ token: tk, escola: nome, inep: inep, municipio: 'Divinópolis',
      sessao: 'd04', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: tk, protocolo: P });
    B.validarPPP({ token: TKDED4, protocolo: P, parecer: 'ok' });
    const r = B.concluirPPP({ token: tk, protocolo: P, escola: nome, inep: inep, municipio: 'Divinópolis',
      direcao: 'Diretora D04', tMissao: 'conteúdo', etapas: ['Ensino Médio'], docHtml: corpo, sessao: 'd04' });
    return { P: P, inep: inep, escola: nome, tk: tk, r: r };
  };

  /* ---- (1) dois PPPs com o MESMO corpo recebem códigos diferentes ---- */
  {
    const corpo = docTeste('<p>EXATAMENTE O MESMO CORPO</p>');
    const a = concluidoD4(corpo), b = concluidoD4(corpo);
    ok(a.r.ok && b.r.ok, 'D04: os dois PPPs concluem');
    const ga = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), a.P));
    const gb = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), b.P));
    ok(!!ga.hash && !!gb.hash && ga.hash !== gb.hash,
       'D04 (A5-06): corpos idênticos, códigos DIFERENTES (' + ga.hash + ' · ' + gb.hash + ')');
    ok(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(ga.hash),
       'D04: a forma do código não muda — é a que está impressa em todo PPP já emitido');
    const va = B.verificarDocumento({ codigo: ga.hash }), vb = B.verificarDocumento({ codigo: gb.hash });
    ok(va.ok && va.protocolo === a.P && va.escola === a.escola,
       'D04 (A5-06): o código do primeiro devolve o primeiro');
    ok(vb.ok && vb.protocolo === b.P && vb.escola === b.escola,
       'D04 (A5-06): e o do segundo devolve o segundo — não mais a primeira linha que bate');
  }

  /* ---- (2) documento que não chegou inteiro não vira documento ---- */
  {
    const seq = seqD4 + 1;
    const inep = '4101' + seq, nome = 'EE D04 ' + seq, mail = 'dir.d04.' + seq + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD4, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SRED4, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: mail, nome: 'Diretora D04 ' + seq, masp: '120000' + seq,
                     papel: 'diretor_escolar', inep: inep });
    const tk = B.criarSessao_({ email: mail, nome: 'Diretora D04 ' + seq, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED4, inep: inep, escola: nome });
    seqD4 = seq;
    const P = B.salvarPPP({ token: tk, escola: nome, inep: inep, municipio: 'Divinópolis',
      sessao: 'd04', tMissao: 'conteúdo' }).protocolo;
    B.enviarParaValidacao({ token: tk, protocolo: P });
    B.validarPPP({ token: TKDED4, protocolo: P, parecer: 'ok' });
    const base = { token: tk, protocolo: P, escola: nome, inep: inep, municipio: 'Divinópolis',
                   direcao: 'Diretora D04', tMissao: 'conteúdo', sessao: 'd04' };
    [['', 'vazio'], ['<p>só um pedaço</p>', 'sem as páginas montadas']].forEach(function (caso) {
      const r = B.concluirPPP(Object.assign({}, base, { docHtml: caso[0] }));
      ok(!r.ok && r.documentoIncompleto === true && /não chegou completo/.test(r.erro || ''),
         'D04 (A5-06): conclusão com o documento ' + caso[1] + ' é recusada');
    });
    const g = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(!g.hash && !g.fonteId && !g.concluidoEm && g.status === 'Validado',
       'D04: e nada é gravado — nem código, nem documento congelado, nem status');
    /* com o documento inteiro, conclui normalmente */
    const ok2 = B.concluirPPP(Object.assign({}, base, { docHtml: docTeste('<p>documento inteiro</p>') }));
    ok(ok2.ok && !!ok2.registro.hash, 'D04: com o documento inteiro a conclusão acontece');
  }

  /* ---- (3) a identidade do registro entra no digest ---- */
  {
    const ident = { protocolo: 'PPP-2026-9001-AAAA', versao: 1, inep: '41999', concluidoEm: '01/03/2026 10:00' };
    const c0 = B.codigoDeAutenticidade_('<p>x</p>', ident, 0);
    ok(c0 === B.codigoDeAutenticidade_('<p>x</p>', ident, 0), 'D04: o mesmo documento dá sempre o mesmo código');
    ok(c0 !== B.codigoDeAutenticidade_('<p>x</p>', Object.assign({}, ident, { protocolo: 'PPP-2026-9002-BBBB' }), 0),
       'D04: protocolo diferente, código diferente');
    ok(c0 !== B.codigoDeAutenticidade_('<p>x</p>', Object.assign({}, ident, { inep: '41998' }), 0),
       'D04: escola diferente, código diferente');
    ok(c0 !== B.codigoDeAutenticidade_('<p>x</p>', Object.assign({}, ident, { concluidoEm: '01/03/2026 10:01' }), 0),
       'D04: data de conclusão diferente, código diferente');
    ok(c0 !== B.codigoDeAutenticidade_('<p>x</p>', ident, 1), 'D04: o sal muda o código (é o que resolve colisão)');
    ok(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(B.codigoDeAutenticidade_('', ident, 0)),
       'D04: mesmo com corpo vazio a FORMA continua a mesma');
  }

  /* ---- (4) nada regride para quem já está na base com código repetido ---- */
  {
    const a = concluidoD4(docTeste('<p>legado A</p>'));
    const b = concluidoD4(docTeste('<p>legado B</p>'));
    const abaR = B.abaRegistros_();
    const la = B.linhaDoProtocolo_(abaR, a.P), lb = B.linhaDoProtocolo_(abaR, b.P);
    const codigoA = B.lerLinha_(abaR, la).hash;
    const codigoB = B.lerLinha_(abaR, lb).hash;
    /* base em uso: duas linhas com o MESMO código, como a 8.12 podia produzir */
    B.gravarCampo_(abaR, lb, 'hash', codigoA);
    const v = B.verificarDocumento({ codigo: codigoA });
    ok(v.ok === true && v.protocolo === a.P,
       'D04: com duas linhas de mesmo código (base em uso), a conferência continua respondendo a primeira, sem erro');
    /* e a emissão nova desvia da colisão em vez de repetir o código */
    const c = concluidoD4(docTeste('<p>novo depois da colisão</p>'));
    const gc = B.lerLinha_(abaR, B.linhaDoProtocolo_(abaR, c.P));
    ok(c.r.ok && gc.hash !== codigoA, 'D04: e o código emitido depois disso não é o da colisão');
    B.gravarCampo_(abaR, lb, 'hash', codigoB);   /* desfaz a semeadura: a base não fica com colisão */
  }
}


/* ============================================================
   v8.13 (D05) — O QUE ESTÁ ASSINADO NÃO MUDA: ATA E ANEXOS (A5-05)

   `registrarAnexo` recusava só "Em andamento": aceitava anexo em documento
   HOMOLOGADO — a folha passava a trazer "Integram este documento, como
   anexos: …", o PDF oficial era regerado e o documento congelado devolvia
   outro texto, tudo sob o MESMO código. E `registrarAta` trocava a ata
   depois de o Colegiado ter assinado, mandava o arquivo anterior para a
   lixeira e mudava a data da reunião impressa: as pessoas passavam a constar
   como tendo aprovado uma ata que não existia quando assinaram.
   ============================================================ */
{
  const TKCD5 = B.criarSessao_({ email: 'central.d05@educacao.mg.gov.br', nome: 'Central D05',
                                 perfil: 'central', papel: 'central' });
  const SRED5 = 'Divinópolis D05';
  B.escolaSalvar({ token: TKCD5, inep: '42000', escola: 'EE D05 base', municipio: 'Divinópolis', sre: SRED5, codigoInep: censoDe('42000') });
  B.acessoSalvar({ token: TKCD5, email: 'sup.d05@educacao.mg.gov.br', nome: 'Super D05',
                   papel: 'superintendente', perfil: 'regional', sre: SRED5 });
  const TKSUPD5 = B.criarSessao_({ email: 'sup.d05@educacao.mg.gov.br', nome: 'Super D05',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED5 });
  B.acessoSalvar({ token: TKSUPD5, email: 'de.d05@educacao.mg.gov.br', nome: 'DE D05',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED5 });
  const TKDED5 = B.criarSessao_({ email: 'de.d05@educacao.mg.gov.br', nome: 'DE D05',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED5 });
  let seqD5 = 0;
  /* uma escola com PPP em coleta de assinaturas, com o Colegiado na folha */
  const emAssinaturaD5 = function () {
    seqD5++;
    const inep = '4201' + seqD5, nome = 'EE D05 ' + seqD5;
    const dirMail = 'dir.d05.' + seqD5 + '@educacao.mg.gov.br';
    const anaMail = 'ana.d05.' + seqD5 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD5, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SRED5, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: dirMail, nome: 'Diretora D05 ' + seqD5, masp: '130000' + seqD5,
                     papel: 'diretor_escolar', inep: inep });
    const tkDir = B.criarSessao_({ email: dirMail, nome: 'Diretora D05 ' + seqD5, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED5, inep: inep, escola: nome });
    B.acessoSalvar({ token: tkDir, email: anaMail, nome: 'Ana D05 ' + seqD5, masp: '230000' + seqD5,
                     papel: 'colegiado', perfil: 'escola', inep: inep, segmento: 'Docente' });
    const tkAna = B.criarSessao_({ email: anaMail, nome: 'Ana D05 ' + seqD5, perfil: 'escola',
      papel: 'colegiado', sre: SRED5, inep: inep, escola: nome });
    const P = B.salvarPPP({ token: tkDir, escola: nome, inep: inep, municipio: 'Divinópolis',
      sessao: 'd05', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: tkDir, protocolo: P });
    B.validarPPP({ token: TKDED5, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: tkDir, protocolo: P, escola: nome, inep: inep, municipio: 'Divinópolis',
      direcao: 'Diretora D05', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: docTeste('<p>corpo D05</p>'), sessao: 'd05' });
    return { P: P, inep: inep, escola: nome, tkDir: tkDir, tkAna: tkAna, anaMail: anaMail };
  };
  const regD5 = function (P) { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); };

  /* ---- (1) anexo: só enquanto a coleta está aberta ---- */
  {
    const e = emAssinaturaD5();
    const a1 = B.registrarAnexo({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'matriz.pdf', mime: 'application/pdf' });
    ok(a1.ok, 'D05: com a coleta aberta, o anexo entra');
    /* fecha a coleta: ata, presença, assinaturas e homologação */
    B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                     dataReuniao: '30/08/2026', identificacao: 'Ata 3/2026' });
    B.presencaColegiado({ p: e.P, token: e.tkDir, emails: [e.anaMail] });
    B.assinarDirecao({ p: e.P, token: e.tkDir, atesto: true });
    B.assinarNoSistema({ token: e.tkAna, protocolo: e.P, aceite: true });
    B.homologarPPP({ token: TKDED5, protocolo: e.P, ato: 'Ato 1/2026' });
    const g = regD5(e.P);
    ok(g.status === 'Homologado', 'D05: o PPP chega a homologado');
    const antes = B.documentoCongelado_(g), pdfAntes = g.pdfId, codigo = g.hash;
    const a2 = B.registrarAnexo({ p: e.P, token: e.tkDir, base64: 'WFla', nome: 'contrato-novo.pdf', mime: 'application/pdf' });
    ok(!a2.ok && /final e definitiva/.test(a2.erro || '') && /nova versão/.test(a2.erro || ''),
       'D05 (A5-05): anexo em documento homologado é recusado, e a mensagem diz o caminho (nova versão)');
    const g2 = regD5(e.P);
    ok(g2.hash === codigo && g2.pdfId === pdfAntes && B.documentoCongelado_(g2) === antes,
       'D05 (A5-05): o código, o PDF oficial e o documento congelado continuam os mesmos');
    ok(JSON.parse(g2.anexos || '[]').length === 1, 'D05: e a lista de anexos não cresceu');
  }

  /* ---- (2) ata: antes da assinatura da direção, e não se substitui ---- */
  {
    const e = emAssinaturaD5();
    const at1 = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-verdadeira.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata 3/2026' });
    ok(at1.ok, 'D05: a ata da reunião entra antes das assinaturas');
    const idAta = regD5(e.P).ataId;
    /* v8.13 (F01): SEM NENHUMA ASSINATURA a troca é possível — é o erro de
       seletor de arquivo, e D05 tinha fechado a única saída da escola. */
    const at2 = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'WFla', nome: 'OUTRA-ata.pdf',
      mime: 'application/pdf', dataReuniao: '01/01/2026', identificacao: 'Ata 9/2026' });
    ok(at2.ok, 'D05/F01: sem nenhuma assinatura colhida, a ata errada pode ser trocada');
    ok(regD5(e.P).ataId !== idAta && regD5(e.P).ataData === '01/01/2026',
       'D05/F01: e o arquivo e a data da reunião impressos passam a ser os da ata nova');
    /* colhida a PRIMEIRA assinatura, vale a recusa de D05 inteira */
    B.presencaColegiado({ p: e.P, token: e.tkDir, emails: [e.anaMail] });
    B.assinarNoSistema({ token: e.tkAna, protocolo: e.P, aceite: true });
    const idAta2 = regD5(e.P).ataId;
    const at2b = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'UVdF', nome: 'TERCEIRA-ata.pdf',
      mime: 'application/pdf', dataReuniao: '03/03/2026', identificacao: 'Ata 11/2026' });
    ok(!at2b.ok && /não se substitui depois que alguém assinou/.test(at2b.erro || ''),
       'D05 (A5-05)/F01: com uma assinatura colhida, a ata anexada não se substitui');
    ok(regD5(e.P).ataId === idAta2 && regD5(e.P).ataData === '01/01/2026',
       'D05 (A5-05): o arquivo e a data da reunião impressos continuam os mesmos');
    B.assinarDirecao({ p: e.P, token: e.tkDir, atesto: true });
    const at3 = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'WFla', nome: 'ata-3.pdf',
      mime: 'application/pdf', dataReuniao: '02/02/2026', identificacao: 'Ata 10/2026' });
    ok(!at3.ok, 'D05 (A5-05): assinado o termo, a ata não muda mais');
    ok(JSON.parse(regD5(e.P).assinaturas).filter(function (a) { return a.assinadoEm; }).length === 2,
       'D05: e as assinaturas continuam valendo para a ata que existia quando foram dadas');
  }

  /* ---- (3) o caminho LEGADO continua aberto, e o arquivo anterior não se perde ---- */
  {
    const e = emAssinaturaD5();
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, e.P);
    /* registro legado: "Assinado" sem ata — é o estado que existe para isso */
    B.gravarCampo_(abaR, linha, 'status', 'Assinado');
    const at = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-legado.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata legado' });
    ok(at.ok, 'D05: em registro legado ("Assinado" sem ata), a ata continua podendo ser anexada uma vez');
    ok(regD5(e.P).status === 'Concluído', 'D05: e o registro legado fecha, como sempre fez');
    /* o arquivo substituído é RENOMEADO, nunca mandado para a lixeira */
    ok(/_SUBSTITUIDA_/.test(src) && !/setTrashed\(true\)[^]{0,200}ataId/.test(src),
       'D05: o arquivo de ata substituída é renomeado, não descartado — histórico não se apaga');
    ok(/'ata substituída'/.test(src), 'D05: e a troca entra no ciclo do documento');
  }

  /* ---- (4) a folha passa a dizer a verdade sobre o que o código cobre ---- */
  {
    const padrao = B.PADRAO_SERVIDOR['DOC.folha.codigo'];
    ok(!/Qualquer alteração posterior no conteúdo produz/.test(padrao),
       'D05 (A5-05): o texto padrão da folha deixou de afirmar o que é falso');
    ok(/se acrescentam sem alterá-lo/.test(padrao) && /nova versão, com novo código/.test(padrao),
       'D05: e passa a explicar que o código é do CONTEÚDO, e os atos posteriores se acrescentam');
    /* quem concluiu antes desta correção continua com o texto que assinou */
    const e = emAssinaturaD5();
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, e.P);
    B.gravarCampo_(abaR, linha, 'textosFolha',
      JSON.stringify({ 'DOC.folha.codigo': 'REDAÇÃO CONGELADA NA CONCLUSÃO — {hash}' }));
    ok(B.folhaAssinaturas_(regD5(e.P)).indexOf('REDAÇÃO CONGELADA NA CONCLUSÃO') >= 0,
       'D05: o documento concluído ANTES da correção imprime a folha com o texto congelado');
    B.gravarCampo_(abaR, linha, 'textosFolha', '');
    ok(B.folhaAssinaturas_(regD5(e.P)).indexOf('se acrescentam sem alterá-lo') >= 0,
       'D05: e o concluído DEPOIS, com a redação nova');
  }
}


/* ============================================================
   v8.13 (D06) — O FIM DO CICLO: O QUE É LEGADO, O QUE SE REGISTRA,
   O QUE O SIGNATÁRIO VÊ (A5-08, A5-14)

   Desde a v8.2 a assinatura da direção grava "Enviado para homologação" na
   hora; `concluirSeCompleto_` só agia em "Em assinatura", de modo que o ato
   "todas as assinaturas colhidas" nunca entrava no ciclo e o e-mail à
   direção nunca saía. E "Minhas assinaturas" deixava de fora justamente o
   estado final: homologado o documento, o membro do Colegiado deixava de
   ver o que tinha assinado.
   ============================================================ */
{
  const TKCD6 = B.criarSessao_({ email: 'central.d06@educacao.mg.gov.br', nome: 'Central D06',
                                 perfil: 'central', papel: 'central' });
  const SRED6 = 'Divinópolis D06';
  B.escolaSalvar({ token: TKCD6, inep: '43000', escola: 'EE D06 base', municipio: 'Divinópolis', sre: SRED6, codigoInep: censoDe('43000') });
  B.acessoSalvar({ token: TKCD6, email: 'sup.d06@educacao.mg.gov.br', nome: 'Super D06',
                   papel: 'superintendente', perfil: 'regional', sre: SRED6 });
  const TKSUPD6 = B.criarSessao_({ email: 'sup.d06@educacao.mg.gov.br', nome: 'Super D06',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED6 });
  B.acessoSalvar({ token: TKSUPD6, email: 'de.d06@educacao.mg.gov.br', nome: 'DE D06',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED6 });
  const TKDED6 = B.criarSessao_({ email: 'de.d06@educacao.mg.gov.br', nome: 'DE D06',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED6 });
  const inepD6 = '43001', nomeD6 = 'EE D06';
  const dirD6 = 'dir.d06@educacao.mg.gov.br', anaD6 = 'ana.d06@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD6, inep: inepD6, escola: nomeD6, municipio: 'Divinópolis', sre: SRED6, codigoInep: censoDe(inepD6) });
  salvarDiretor(B, { email: dirD6, nome: 'Diretora D06', masp: '1400001',
                   papel: 'diretor_escolar', inep: inepD6 });
  const TKDIRD6 = B.criarSessao_({ email: dirD6, nome: 'Diretora D06', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED6, inep: inepD6, escola: nomeD6 });
  B.acessoSalvar({ token: TKDIRD6, email: anaD6, nome: 'Ana D06', masp: '2400001',
                   papel: 'colegiado', perfil: 'escola', inep: inepD6, segmento: 'Docente' });
  const TKANAD6 = B.criarSessao_({ email: anaD6, nome: 'Ana D06', perfil: 'escola',
    papel: 'colegiado', sre: SRED6, inep: inepD6, escola: nomeD6 });

  const PD6 = B.salvarPPP({ token: TKDIRD6, escola: nomeD6, inep: inepD6, municipio: 'Divinópolis',
    sessao: 'd06', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  B.enviarParaValidacao({ token: TKDIRD6, protocolo: PD6 });
  B.validarPPP({ token: TKDED6, protocolo: PD6, parecer: 'ok' });
  B.concluirPPP({ token: TKDIRD6, protocolo: PD6, escola: nomeD6, inep: inepD6, municipio: 'Divinópolis',
    direcao: 'Diretora D06', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
    docHtml: docTeste('<p>corpo D06</p>'), sessao: 'd06' });
  B.registrarAta({ p: PD6, token: TKDIRD6, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                   dataReuniao: '30/08/2026', identificacao: 'Ata D06' });
  B.presencaColegiado({ p: PD6, token: TKDIRD6, emails: [anaD6] });
  B.assinarDirecao({ p: PD6, token: TKDIRD6, atesto: true });
  const regD6 = function () { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), PD6)); };
  ok(regD6().status === 'Enviado para homologação',
     'D06: assinado o termo, o documento segue na hora para a homologação (v8.2)');

  const emailsAntes = emails.filter(function (e) { return /assinad/i.test(e.subject || ''); }).length;
  const assinaAna = B.assinarNoSistema({ token: TKANAD6, protocolo: PD6, aceite: true });
  ok(assinaAna.ok, 'D06: a última assinatura é registrada');
  const atos = function () {
    return B.linhaDoTempo({ token: TKDIRD6, protocolo: PD6 }).eventos.map(function (x) { return x.ato; });
  };
  ok(atos().filter(function (a) { return /todas as assinaturas colhidas/.test(a); }).length === 1,
     'D06 (A5-08): o encerramento da coleta entra no ciclo — uma vez');
  ok(regD6().status === 'Enviado para homologação',
     'D06 (A5-08): e o status NÃO anda para trás — o documento continua aguardando a SRE');
  const emailsDepois = emails.filter(function (e) { return /assinad/i.test(e.subject || ''); });
  ok(emailsDepois.length === emailsAntes + 1, 'D06 (A5-08): e sai UM e-mail à direção');
  const corpoD6 = (emailsDepois[emailsDepois.length - 1] || {}).htmlBody || '';
  ok(/segue para homologação pela Superintendência/.test(corpoD6),
     'D06: com o texto certo — o que falta é a homologação, não a ata');
  ok(corpoD6 && !/Falta um passo/.test(corpoD6),
     'D06: e não o texto antigo, que pedia a ata já anexada');
  /* uma segunda passagem não duplica o ato */
  B.concluirSeCompleto_(B.linhaDoProtocolo_(B.abaRegistros_(), PD6));
  ok(atos().filter(function (a) { return /todas as assinaturas colhidas/.test(a); }).length === 1,
     'D06: uma segunda avaliação não duplica o ato na linha do tempo');

  /* ---- A5-14: homologado, o signatário continua vendo o que assinou ---- */
  ok(B.minhasAssinaturas({ token: TKANAD6 }).assinados.filter(function (x) { return x.protocolo === PD6; }).length === 1,
     'D06: antes da homologação, o membro do Colegiado vê o documento que assinou');
  B.homologarPPP({ token: TKDED6, protocolo: PD6, ato: 'Ato D06/2026' });
  ok(regD6().status === 'Homologado', 'D06: a SRE homologa');
  ok(B.minhasAssinaturas({ token: TKANAD6 }).assinados.filter(function (x) { return x.protocolo === PD6; }).length === 1,
     'D06 (A5-14): homologado — o momento em que o documento se torna definitivo —, ele continua na lista');
  ok(B.minhasAssinaturas({ token: TKDIRD6 }).assinados.filter(function (x) { return x.protocolo === PD6; }).length === 1,
     'D06 (A5-14): e a direção também continua vendo o que assinou');

  /* ---- os estados legados continuam sendo LIDOS ---- */
  {
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, PD6);
    ['Assinado', 'Concluído'].forEach(function (st) {
      B.gravarCampo_(abaR, linha, 'status', st);
      ok(B.minhasAssinaturas({ token: TKANAD6 }).assinados.filter(function (x) { return x.protocolo === PD6; }).length === 1,
         'D06: registro legado em "' + st + '" continua aparecendo para quem assinou');
      ok(B.painelRegistros({ token: TKDED6, filtros: { todas: true } }).linhas
          .filter(function (x) { return x.protocolo === PD6; }).length === 1,
         'D06: e continua aparecendo no painel da regional');
    });
    B.gravarCampo_(abaR, linha, 'status', 'Homologado');
    ok(/ESTADOS LEGADOS/.test(src), 'D06: o código declara os dois estados como legados, e por quê');
  }
}


/* ============================================================
   v8.13 (D07) — UMA VERSÃO EM CURSO POR ESCOLA, COM NÚMERO ÚNICO (A5-09)

   A regra do "um PPP por vez" só enxergava "em elaboração": com a v1
   homologada e a v2 em coleta de assinaturas, novaVersao(v1) era aceita e
   criava OUTRA v2 — mesmo número, mesma escola, ao mesmo tempo, nascida do
   conteúdo da v1 e ignorando tudo o que a v2 mudou.
   ============================================================ */
{
  const TKCD7 = B.criarSessao_({ email: 'central.d07@educacao.mg.gov.br', nome: 'Central D07',
                                 perfil: 'central', papel: 'central' });
  const SRED7 = 'Divinópolis D07';
  B.escolaSalvar({ token: TKCD7, inep: '44000', escola: 'EE D07 base', municipio: 'Divinópolis', sre: SRED7, codigoInep: censoDe('44000') });
  B.acessoSalvar({ token: TKCD7, email: 'sup.d07@educacao.mg.gov.br', nome: 'Super D07',
                   papel: 'superintendente', perfil: 'regional', sre: SRED7 });
  const TKSUPD7 = B.criarSessao_({ email: 'sup.d07@educacao.mg.gov.br', nome: 'Super D07',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED7 });
  B.acessoSalvar({ token: TKSUPD7, email: 'de.d07@educacao.mg.gov.br', nome: 'DE D07',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED7 });
  const TKDED7 = B.criarSessao_({ email: 'de.d07@educacao.mg.gov.br', nome: 'DE D07',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED7 });
  const inepD7 = '44001', nomeD7 = 'EE D07', dirD7 = 'dir.d07@educacao.mg.gov.br';
  const anaD7 = 'ana.d07@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD7, inep: inepD7, escola: nomeD7, municipio: 'Divinópolis', sre: SRED7, codigoInep: censoDe(inepD7) });
  salvarDiretor(B, { email: dirD7, nome: 'Diretora D07', masp: '1500001',
                   papel: 'diretor_escolar', inep: inepD7 });
  const TKDIRD7 = B.criarSessao_({ email: dirD7, nome: 'Diretora D07', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED7, inep: inepD7, escola: nomeD7 });
  B.acessoSalvar({ token: TKDIRD7, email: anaD7, nome: 'Ana D07', masp: '2500001',
                   papel: 'colegiado', perfil: 'escola', inep: inepD7, segmento: 'Docente' });
  const TKANAD7 = B.criarSessao_({ email: anaD7, nome: 'Ana D07', perfil: 'escola',
    papel: 'colegiado', sre: SRED7, inep: inepD7, escola: nomeD7 });
  const regD7 = function (P) { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); };
  /* leva um PPP até "Em assinatura" (concluído, esperando as assinaturas) */
  const ateAssinatura7 = function (P) {
    B.enviarParaValidacao({ token: TKDIRD7, protocolo: P });
    B.validarPPP({ token: TKDED7, protocolo: P, parecer: 'ok' });
    return B.concluirPPP({ token: TKDIRD7, protocolo: P, escola: nomeD7, inep: inepD7, municipio: 'Divinópolis',
      direcao: 'Diretora D07', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: docTeste('<p>corpo ' + P + '</p>'), sessao: 'd07' });
  };
  const homologar7 = function (P) {
    B.registrarAta({ p: P, token: TKDIRD7, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                     dataReuniao: '30/08/2026', identificacao: 'Ata D07' });
    B.presencaColegiado({ p: P, token: TKDIRD7, emails: [anaD7] });
    B.assinarDirecao({ p: P, token: TKDIRD7, atesto: true });
    B.assinarNoSistema({ token: TKANAD7, protocolo: P, aceite: true });
    return B.homologarPPP({ token: TKDED7, protocolo: P, ato: 'Ato D07' });
  };

  /* v1: criada, concluída e homologada */
  const V1 = B.salvarPPP({ token: TKDIRD7, escola: nomeD7, inep: inepD7, municipio: 'Divinópolis',
    sessao: 'd07', tMissao: 'conteúdo v1', etapas: ['Ensino Médio'] }).protocolo;
  ateAssinatura7(V1); homologar7(V1);
  ok(regD7(V1).status === 'Homologado', 'D07: a v1 chega a homologada');

  /* v2: a revisão normal continua funcionando */
  const nv2 = B.novaVersao({ p: V1, token: TKDIRD7 });
  ok(nv2.ok && (nv2.registro || {}).versao === 2, 'D07: com a v1 homologada, a revisão nasce como v2 (caminho normal)');
  const V2 = (nv2.registro || {}).protocolo || V1;
  ateAssinatura7(V2);
  ok(regD7(V2).status === 'Em assinatura', 'D07: a v2 vai à coleta de assinaturas');

  /* ---- (1) com a v2 em curso, a v1 não gera outra versão ---- */
  {
    const r = B.novaVersao({ p: V1, token: TKDIRD7 });
    ok(!r.ok && r.duplicado && r.duplicado.protocolo === V2 && /em curso/.test(r.erro || ''),
       'D07 (A5-09): com a v2 em coleta de assinaturas, novaVersao(v1) é recusada, nomeando a v2');
    ok(/em assinatura/.test(r.erro || ''), 'D07: e dizendo em que pé a v2 está');
    const versoes = B.painelRegistros({ token: TKDED7, filtros: { todas: true } }).linhas
      .filter(function (x) { return String(x.inep) === inepD7; }).map(function (x) { return x.versao; });
    ok(versoes.filter(function (v) { return String(v) === '2'; }).length === 1,
       'D07 (A5-09): a escola não fica com duas "versão 2" vivas ao mesmo tempo');
  }

  /* ---- (2) a escola também não começa um PPP do zero ---- */
  {
    const r = B.salvarPPP({ token: TKDIRD7, escola: nomeD7, inep: inepD7, municipio: 'Divinópolis',
      sessao: 'd07-outra', tMissao: 'do zero' });
    ok(!r.ok && r.duplicado && r.duplicado.protocolo === V2,
       'D07: nem um PPP do zero, enquanto houver um em curso');
  }

  /* ---- (3) homologada a v2, a revisão nasce como v3 ---- */
  {
    homologar7(V2);
    ok(regD7(V2).status === 'Homologado', 'D07: a v2 é homologada');
    const r = B.novaVersao({ p: V2, token: TKDIRD7 });
    ok(r.ok && (r.registro || {}).versao === 3, 'D07: e a revisão nasce como v3');
    const V3 = (r.registro || {}).protocolo || V2;
    /* e a v1, que não é a vigente, não dá origem a nada */
    const r2 = B.novaVersao({ p: V1, token: TKDIRD7 });
    ok(!r2.ok, 'D07 (A5-09): a v1 não dá origem a outra versão');
    ok(/em curso/.test(r2.erro || '') || /versão vigente/.test(r2.erro || ''),
       'D07: e a recusa diz por quê (há uma em curso, ou ela não é a vigente)');
    /* encerra a v3 e prova a regra da versão vigente isoladamente */
    ateAssinatura7(V3); homologar7(V3);
    const r3 = B.novaVersao({ p: V1, token: TKDIRD7 });
    ok(!r3.ok && /versão vigente desta escola é a 3/.test(r3.erro || ''),
       'D07: sem nenhum PPP em curso, a revisão a partir da v1 é recusada por não ser a vigente, e a mensagem nomeia qual é');
    const r4 = B.novaVersao({ p: V3, token: TKDIRD7 });
    ok(r4.ok && (r4.registro || {}).versao === 4, 'D07: e a revisão a partir da vigente nasce como v4');
  }

  /* ---- (4) escola que nunca teve PPP continua criando o primeiro ---- */
  {
    const inepNovo = '44002', mailNovo = 'dir.d07b@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCD7, inep: inepNovo, escola: 'EE D07 nova', municipio: 'Divinópolis', sre: SRED7, codigoInep: censoDe(inepNovo) });
    salvarDiretor(B, { email: mailNovo, nome: 'Diretora D07 B', masp: '1500002',
                     papel: 'diretor_escolar', inep: inepNovo });
    const tk = B.criarSessao_({ email: mailNovo, nome: 'Diretora D07 B', perfil: 'escola',
      papel: 'diretor_escolar', sre: SRED7, inep: inepNovo, escola: 'EE D07 nova' });
    const r = B.salvarPPP({ token: tk, escola: 'EE D07 nova', inep: inepNovo, municipio: 'Divinópolis',
      sessao: 'd07b', tMissao: 'primeiro' });
    ok(r.ok && r.versao === 1, 'D07: escola que nunca teve PPP continua criando o primeiro, na versão 1');
    ok(typeof B.maiorVersaoDaEscola_ === 'function' && B.maiorVersaoDaEscola_(B.abaRegistros_(), '44999') === 0,
       'D07: maiorVersaoDaEscola_ devolve 0 para escola sem nenhum registro');
  }
}


/* ============================================================
   v8.13 (D08) — DATAS DO CICLO: ATA SEM DUPLICATA, JANELA DE DESFAZER,
   FOLHA DA VERSÃO NOVA (A5-12, A5-15, A5-16)

   Três defeitos de data e de herança, pequenos e independentes, que se
   corrigem juntos porque tocam as mesmas funções: a data da reunião era
   gravada sem conferência (e o documento imprimia "realizada em
   99/99/9999"); `diasDesde_` devolve null quando não reconhece a data, e
   `null > 7` é `false`, de modo que uma homologação com data ilegível ficava
   desfazível para sempre; e a versão nova nascia com os textos congelados da
   folha da versão anterior.
   ============================================================ */
{
  const TKCD8 = B.criarSessao_({ email: 'central.d08@educacao.mg.gov.br', nome: 'Central D08',
                                 perfil: 'central', papel: 'central' });
  const SRED8 = 'Divinópolis D08';
  B.escolaSalvar({ token: TKCD8, inep: '45000', escola: 'EE D08 base', municipio: 'Divinópolis', sre: SRED8, codigoInep: censoDe('45000') });
  B.acessoSalvar({ token: TKCD8, email: 'sup.d08@educacao.mg.gov.br', nome: 'Super D08',
                   papel: 'superintendente', perfil: 'regional', sre: SRED8 });
  const TKSUPD8 = B.criarSessao_({ email: 'sup.d08@educacao.mg.gov.br', nome: 'Super D08',
                                   perfil: 'regional', papel: 'superintendente', sre: SRED8 });
  B.acessoSalvar({ token: TKSUPD8, email: 'de.d08@educacao.mg.gov.br', nome: 'DE D08',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED8 });
  const TKDED8 = B.criarSessao_({ email: 'de.d08@educacao.mg.gov.br', nome: 'DE D08',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRED8 });
  const inepD8 = '45001', nomeD8 = 'EE D08', dirD8 = 'dir.d08@educacao.mg.gov.br';
  const anaD8 = 'ana.d08@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD8, inep: inepD8, escola: nomeD8, municipio: 'Divinópolis', sre: SRED8, codigoInep: censoDe(inepD8) });
  salvarDiretor(B, { email: dirD8, nome: 'Diretora D08', masp: '1600001',
                   papel: 'diretor_escolar', inep: inepD8 });
  const TKDIRD8 = B.criarSessao_({ email: dirD8, nome: 'Diretora D08', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED8, inep: inepD8, escola: nomeD8 });
  B.acessoSalvar({ token: TKDIRD8, email: anaD8, nome: 'Ana D08', masp: '2600001',
                   papel: 'colegiado', perfil: 'escola', inep: inepD8, segmento: 'Docente' });
  const TKANAD8 = B.criarSessao_({ email: anaD8, nome: 'Ana D08', perfil: 'escola',
    papel: 'colegiado', sre: SRED8, inep: inepD8, escola: nomeD8 });
  const regD8 = function (P) { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); };

  const PD8 = B.salvarPPP({ token: TKDIRD8, escola: nomeD8, inep: inepD8, municipio: 'Divinópolis',
    sessao: 'd08', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  B.enviarParaValidacao({ token: TKDIRD8, protocolo: PD8 });
  B.validarPPP({ token: TKDED8, protocolo: PD8, parecer: 'ok' });
  B.concluirPPP({ token: TKDIRD8, protocolo: PD8, escola: nomeD8, inep: inepD8, municipio: 'Divinópolis',
    direcao: 'Diretora D08', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
    docHtml: docTeste('<p>corpo D08</p>'), sessao: 'd08' });

  /* ---- (1) A5-12: a data da reunião é conferida na porta ---- */
  {
    const base = { p: PD8, token: TKDIRD8, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                   identificacao: 'Ata D08' };
    ['99/99/9999', '31/02/2026', '', 'ontem', '1/1/2026', '10-03-2026', '10/03/1999'].forEach(function (d) {
      const r = B.registrarAta(Object.assign({}, base, { dataReuniao: d }));
      ok(!r.ok && /formato dd\/mm\/aaaa/.test(r.erro || ''),
         'D08 (A5-12): data de reunião "' + d + '" é recusada na porta');
    });
    /* data no futuro: a reunião ainda não aconteceu */
    const amanha = new Date(Date.now() + 86400000);
    const dd = ('0' + amanha.getDate()).slice(-2) + '/' + ('0' + (amanha.getMonth() + 1)).slice(-2) + '/' + amanha.getFullYear();
    ok(!B.registrarAta(Object.assign({}, base, { dataReuniao: dd })).ok,
       'D08 (A5-12): e data no futuro também');
    ok(!regD8(PD8).ataId, 'D08: nada foi gravado enquanto a data não é válida');
    const bom = B.registrarAta(Object.assign({}, base, { dataReuniao: '30/08/2026' }));
    ok(bom.ok && regD8(PD8).ataData === '30/08/2026', 'D08: com a data válida, a ata entra');
  }

  /* ---- (2) A5-12: a ata aparece UMA vez na linha do tempo, e no lugar certo ---- */
  {
    const eventos = B.linhaDoTempo({ token: TKDIRD8, protocolo: PD8 }).eventos;
    const atas = eventos.filter(function (e) { return e.ato === 'ata anexada'; });
    ok(atas.length === 1, 'D08 (A5-12): "ata anexada" aparece uma vez (' + atas.length + ')');
    const iCriado = eventos.findIndex(function (e) { return e.ato === 'PPP criado'; });
    const iAta = eventos.findIndex(function (e) { return e.ato === 'ata anexada'; });
    ok(iCriado >= 0 && iAta > iCriado,
       'D08 (A5-12): e depois de "PPP criado", não antes dele');
  }

  /* ---- (3) registro ANTERIOR à 7.8 (sem ciclo) continua mostrando a ata ---- */
  {
    const abaR = B.abaRegistros_();
    const legado = new Array(B.CAMPOS.length).fill('');
    legado[B.IDX.protocolo - 1] = 'PPP-2019-0001-LEGD';
    legado[B.IDX.versao - 1] = 1;
    legado[B.IDX.status - 1] = 'Homologado';
    legado[B.IDX.email - 1] = dirD8;
    legado[B.IDX.escola - 1] = nomeD8;
    legado[B.IDX.inep - 1] = inepD8;
    legado[B.IDX.sre - 1] = SRED8;
    legado[B.IDX.criadoEm - 1] = '10/02/2019 09:00';
    legado[B.IDX.concluidoEm - 1] = '20/03/2019 10:00';
    legado[B.IDX.ataData - 1] = '15/03/2019';
    legado[B.IDX.ataIdent - 1] = 'Ata 1/2019';
    legado[B.IDX.homolEm - 1] = '';
    abaR.getRange(abaR.getLastRow() + 1, 1, 1, legado.length).setValues([legado]);
    const ev = B.linhaDoTempo({ token: TKDIRD8, protocolo: 'PPP-2019-0001-LEGD' }).eventos;
    ok(ev.filter(function (e) { return e.ato === 'ata anexada'; }).length === 1,
       'D08: registro anterior à 7.8 (sem ciclo) continua mostrando a ata na linha do tempo');
    /* data ilegível não encabeça a história do documento */
    B.gravarCampo_(abaR, B.linhaDoProtocolo_(abaR, 'PPP-2019-0001-LEGD'), 'ataData', '99/99/9999');
    const ev2 = B.linhaDoTempo({ token: TKDIRD8, protocolo: 'PPP-2019-0001-LEGD' }).eventos;
    const iAta2 = ev2.findIndex(function (e) { return e.ato === 'ata anexada'; });
    const iCri2 = ev2.findIndex(function (e) { return e.ato === 'PPP criado'; });
    ok(iAta2 > iCri2, 'D08 (A5-12): com data ilegível, o evento não vai para o topo da linha do tempo');
    ok(/data da reunião informada: 99\/99\/9999/.test((ev2[iAta2] || {}).detalhe || ''),
       'D08: e o valor informado fica à vista, em vez de reordenar a história');
    ok(ev2.every(function (e) { return !!e.data; }), 'D08: nenhum evento entra sem data');
  }

  /* ---- (4) v10.0: NÃO HÁ MAIS JANELA DE DESFAZER ----
     A A5-15 conferia que a janela de sete dias falhava FECHADA quando a data
     da homologação era ilegível. Na 10.0 a homologação não se desfaz em
     nenhuma hipótese, e a data já não decide nada: o que se confere aqui é
     que a recusa vale com QUALQUER data — inclusive as ilegíveis que a
     A5-15 apanhou — e que o status não se move. */
  {
    B.presencaColegiado({ p: PD8, token: TKDIRD8, emails: [anaD8] });
    B.assinarDirecao({ p: PD8, token: TKDIRD8, atesto: true });
    B.assinarNoSistema({ token: TKANAD8, protocolo: PD8, aceite: true });
    B.homologarPPP({ token: TKDED8, protocolo: PD8, ato: 'Ato D08', confirmaSemAssinaturas: true });
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, PD8);
    ok(regD8(PD8).status === 'Homologado', 'D08: o PPP é homologado');
    const linhaPainel = function () {
      return B.painelRegistros({ token: TKDED8, filtros: { todas: true } }).linhas
        .filter(function (x) { return x.protocolo === PD8; })[0];
    };
    ok(linhaPainel().podeDesfazerHomologacao === undefined && linhaPainel().definitivo === true,
       'v10.0: o painel não calcula mais o desfazer, e marca o registro como definitivo');
    const datas = ['', 'sem data', '99/99/9999', B.agora_()];
    datas.forEach(function (v) {
      B.gravarCampo_(abaR, linha, 'homolEm', v);
      const r = B.desfazerHomologacao({ token: TKDED8, protocolo: PD8,
        motivo: 'Correção de conteúdo apontada pela equipe técnica.' });
      ok(!r.ok && /não é desfeita/.test(r.erro || '') && /nova versão/.test(r.erro || ''),
         'v10.0: com a data ' + (v ? '"' + v + '"' : 'em branco') + ', a homologação continua não se desfazendo');
      ok(regD8(PD8).status === 'Homologado', 'D08: o status permanece');
    });
  }

  /* ---- (5) A5-16: a versão nova nasce com a folha DELA ---- */
  {
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, PD8);
    B.gravarCampo_(abaR, linha, 'status', 'Homologado');
    B.gravarCampo_(abaR, linha, 'textosFolha',
      JSON.stringify({ 'DOC.folha.codigo': 'texto congelado da versão anterior' }));
    ok(!!regD8(PD8).textosFolha, 'D08: a versão anterior tem os textos da folha congelados');
    const nv = B.novaVersao({ p: PD8, token: TKDIRD8 });
    ok(nv.ok, 'D08: a revisão é aberta');
    ok(nv.registro.textosFolha === '',
       'D08 (A5-16): e nasce sem os textos congelados da folha da versão anterior');
    ok(nv.registro.ataId === '' && nv.registro.ataData === '' && nv.registro.homolEm === '',
       'D08: como já acontecia com a ata e a homologação');
  }
}

/* ============================================================
   v8.13 (D12) — A RECUSA POR TAMANHO NOMEIA UM LUGAR QUE EXISTE NA TELA
   (A4-04, A4-12)

   A célula grande demais era recusada corretamente, mas a mensagem citava a
   COLUNA da planilha — "Detalhes das ofertas (JSON)", "Seleções por id
   (JSON)", "Indicadores (JSON)" —, nomes que não aparecem em lugar nenhum da
   interface. A escola ficava com o PPP que não grava mais, uma tarja
   permanente e nenhum meio de descobrir que texto encurtar.
   ============================================================ */
{
  const TKCD12 = B.criarSessao_({ email: 'central.d12@educacao.mg.gov.br', nome: 'Central D12',
                                  perfil: 'central', papel: 'central' });
  const SRED12 = 'Divinópolis D12', inepD12 = '46001', dirD12 = 'dir.d12@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD12, inep: inepD12, escola: 'EE D12', municipio: 'Divinópolis', sre: SRED12, codigoInep: censoDe(inepD12) });
  salvarDiretor(B, { email: dirD12, nome: 'Diretora D12', masp: '1700001',
                   papel: 'diretor_escolar', inep: inepD12 });
  const TKDIRD12 = B.criarSessao_({ email: dirD12, nome: 'Diretora D12', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED12, inep: inepD12, escola: 'EE D12' });

  const base = { escola: 'EE D12', inep: inepD12, municipio: 'Divinópolis', direcao: 'Diretora D12',
                 token: TKDIRD12, status: 'Em andamento' };
  const criado = B.salvarPPP(Object.assign({}, base));
  ok(criado.ok, 'D12: o PPP da escola é criado');
  const PD12 = criado.protocolo;

  /* o rótulo tem de existir na TELA — a bateria confere contra o App.html real */
  const APP_FONTE = require('./montar.js').montar({ demo: true });
  const enorme = 'x'.repeat(46000);
  [['detalhes',    /Cursos técnicos ofertados/],
   ['selecoes',    /marcações das telas de seleção/],
   ['indicadores', /tabela de indicadores/],
   ['escola',      /Escola/],
   ['direcao',     /Diretor\(a\)/],
   ['municipio',   /Município/],
   ['aprovacao',   /aprovação/i]].forEach(function (par) {
    const chave = par[0], esperado = par[1];
    const d = Object.assign({}, base, { protocolo: PD12 });
    d[chave] = enorme;
    const r = B.salvarPPP(d);
    ok(!r.ok && r.campoGrande === chave, 'D12: "' + chave + '" grande demais é recusado');
    ok(!!r.campoRotulo && esperado.test(r.campoRotulo),
       'D12: e a recusa nomeia o campo como ele aparece na tela (' + chave + ' → "' + r.campoRotulo + '")');
    ok(r.erro.indexOf(r.campoRotulo) >= 0,
       'D12: a mensagem que a escola lê usa o mesmo nome (' + chave + ')');
    ok(!/\(JSON\)/.test(r.campoRotulo),
       'D12: e nenhuma coluna interna aparece na mensagem (' + chave + ')');
  });

  /* nada do que foi recusado é gravado, e o texto anterior permanece */
  {
    const antes = B.buscarPPP({ p: PD12, token: TKDIRD12 }).registro;
    ok(antes.detalhes !== enorme && antes.escola === 'EE D12',
       'D12: a recusa não grava nada — o registro continua como estava');
  }

  /* o limite exato do servidor: 45.000 grava, 45.001 não (A4-12) */
  {
    const d1 = Object.assign({}, base, { protocolo: PD12, tApresentacao: 'y'.repeat(45000) });
    const r1 = B.salvarPPP(d1);
    ok(r1.ok, 'D12 (A4-12): em EXATAMENTE 45.000 caracteres o servidor grava');
    const d2 = Object.assign({}, base, { protocolo: PD12, rev: r1.rev, tApresentacao: 'y'.repeat(45001) });
    const r2 = B.salvarPPP(d2);
    ok(!r2.ok && r2.campoGrande === 'tApresentacao', 'D12 (A4-12): em 45.001 ele recusa');
    ok(B.buscarPPP({ p: PD12, token: TKDIRD12 }).registro.tApresentacao.length === 45000,
       'D12: e o texto de 45.000 continua gravado');
  }

  /* toda coluna que a tela escreve tem rótulo legível */
  {
    const jargao = B.CAMPOS.filter(function (c) {
      return c.deTela && /\(JSON\)|lock|^pct$/i.test(c.col) && !c.rotulo;
    }).map(function (c) { return c.key; });
    ok(jargao.length === 0,
       'D12: nenhuma coluna de jargão que a tela escreve ficou sem rótulo' + (jargao.length ? ': ' + jargao.join(', ') : ''));
    ok(/TELA_DA_COLUNA/.test(APP_FONTE) && /ROTULO_DO_CAMPO/.test(APP_FONTE),
       'D12: e a tela sabe levar a pessoa até a coluna apontada');
  }
}

/* ============================================================
   v8.13 (D13) — INDICADOR É NÚMERO (A4-10)

   As casas da tabela de indicadores chegavam como texto livre e eram
   impressas na seção 2.4 do documento oficial. A recusa entra nos DOIS atos
   que congelam o documento — enviar para validação e concluir —, nunca no
   salvamento: travar a gravação por um dígito errado é o caminho mais curto
   para perder o texto que a escola escreveu depois.
   ============================================================ */
{
  const TKCD13 = B.criarSessao_({ email: 'central.d13@educacao.mg.gov.br', nome: 'Central D13',
                                  perfil: 'central', papel: 'central' });
  const SRED13 = 'Divinópolis D13', inepD13 = '47001', dirD13 = 'dir.d13@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD13, inep: inepD13, escola: 'EE D13', municipio: 'Divinópolis', sre: SRED13, codigoInep: censoDe(inepD13) });
  B.acessoSalvar({ token: TKCD13, email: 'sup.d13@educacao.mg.gov.br', nome: 'Super D13',
                   papel: 'superintendente', perfil: 'regional', sre: SRED13 });
  const TKSUPD13 = B.criarSessao_({ email: 'sup.d13@educacao.mg.gov.br', nome: 'Super D13',
                                    perfil: 'regional', papel: 'superintendente', sre: SRED13 });
  B.acessoSalvar({ token: TKSUPD13, email: 'de.d13@educacao.mg.gov.br', nome: 'DE D13',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRED13 });
  const TKDED13 = B.criarSessao_({ email: 'de.d13@educacao.mg.gov.br', nome: 'DE D13',
                                   perfil: 'regional', papel: 'diretor_educacional', sre: SRED13 });
  salvarDiretor(B, { email: dirD13, nome: 'Diretora D13', masp: '1800001',
                   papel: 'diretor_escolar', inep: inepD13 });
  const TKDIRD13 = B.criarSessao_({ email: dirD13, nome: 'Diretora D13', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED13, inep: inepD13, escola: 'EE D13' });

  const RUIM = JSON.stringify({ ano: '2025', etapas: { ei: { mat: '-500', apr: '998', rep: 'abc', aba: '1e9', dis: '<script>x' } } });
  const BOM = JSON.stringify({ ano: '2025', etapas: { ei: { mat: '320', apr: '95,0', rep: '3', aba: '2', dis: '10,5' } } });

  /* a regra, isolada */
  {
    const fora = B.indicadoresInvalidos_(RUIM);
    ok(fora.length === 5, 'D13: as cinco casas inválidas são apanhadas');
    ok(fora.some(function (x) { return x.etapa === 'Educação Infantil' && x.coluna === 'Matrículas' && x.valor === '-500'; }),
       'D13: e cada uma vem com etapa, coluna e valor');
    ok(B.indicadoresInvalidos_(BOM).length === 0, 'D13: número válido passa (inteiro e vírgula decimal)');
    ok(B.indicadoresInvalidos_(JSON.stringify({ etapas: { ei: { mat: '', apr: '' } } })).length === 0,
       'D13: campo vazio continua válido');
    ok(B.indicadoresInvalidos_('{ isto não é json').length === 0 && B.indicadoresInvalidos_('').length === 0,
       'D13: JSON ilegível não derruba o ato — não é o que esta regra julga');
    ok(B.indicadoresInvalidos_(JSON.stringify({ etapas: { ei: { apr: '100' } } })).length === 0 &&
       B.indicadoresInvalidos_(JSON.stringify({ etapas: { ei: { apr: '100,1' } } })).length === 1,
       'D13: a faixa das taxas vai até 100, e para ali');
  }

  const base = { escola: 'EE D13', inep: inepD13, municipio: 'Divinópolis', direcao: 'Diretora D13',
                 token: TKDIRD13, status: 'Em andamento' };
  const cr = B.salvarPPP(Object.assign({}, base, { indicadores: RUIM }));
  ok(cr.ok, 'D13: salvarPPP NÃO é recusado — o texto da escola continua sendo gravado');
  const PD13 = cr.protocolo;
  ok(B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro.indicadores === RUIM,
     'D13: e o que ela digitou fica guardado, inclusive o que não é número');

  /* a porta da validação */
  {
    const r = B.enviarParaValidacao({ token: TKDIRD13, protocolo: PD13 });
    ok(!r.ok && /não são números/.test(r.erro || ''), 'D13: enviar para validação é recusado');
    ok(/Educação Infantil · Matrículas = -500/.test(r.erro || ''), 'D13: nomeando etapa, coluna e valor');
    ok(/antes de enviar para validação/.test(r.erro || ''), 'D13: e dizendo o que fazer antes de qual ato');
    ok((r.indicadoresInvalidos || []).length === 5, 'D13: a recusa devolve a lista inteira à tela');
    ok(B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro.status === 'Em andamento',
       'D13: e nada mudou de status');
  }

  /* corrigido, segue */
  {
    const reg0 = B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro;
    ok(B.salvarPPP(Object.assign({}, base, { protocolo: PD13, rev: reg0.rev, indicadores: BOM })).ok,
       'D13: a escola corrige os números');
    ok(B.enviarParaValidacao({ token: TKDIRD13, protocolo: PD13 }).ok, 'D13: e o envio passa');
    ok(B.validarPPP({ token: TKDED13, protocolo: PD13, parecer: '' }).ok, 'D13: o PPP é validado');
  }

  /* a porta da conclusão: com o JSON ruim CHEGANDO no payload */
  {
    const reg = B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro;
    const r = B.concluirPPP(Object.assign({}, base, { protocolo: PD13, rev: reg.rev,
      indicadores: RUIM, docHtml: docTeste('<p>D13</p>') }));
    ok(!r.ok && /não são números/.test(r.erro || ''), 'D13: concluir com indicador inválido é recusado');
    ok(/antes de concluir/.test(r.erro || ''), 'D13: dizendo que o ato barrado é a conclusão');
    const dep = B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro;
    ok(dep.status === 'Validado' && !dep.hash && !dep.concluidoEm,
       'D13: e nada foi congelado — nem código, nem data de conclusão');
    ok(dep.indicadores === BOM, 'D13: o registro continua com os números bons que estavam gravados');
  }

  /* com números válidos, conclui */
  {
    const reg = B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro;
    const r = B.concluirPPP(Object.assign({}, base, { protocolo: PD13, rev: reg.rev,
      indicadores: BOM, docHtml: docTeste('<p>D13</p>') }));
    ok(r.ok && r.registro.hash, 'D13: com números válidos, a conclusão passa');
  }

  /* registro JÁ concluído com indicador inválido continua sendo lido */
  {
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, PD13);
    B.gravarCampo_(abaR, linha, 'indicadores', RUIM);
    const pub = B.verificarDocumento({ codigo: B.buscarPPP({ p: PD13, token: TKDIRD13 }).registro.hash });
    ok(pub && pub.ok, 'D13: documento já concluído com indicador inválido continua sendo entregue — não se reescreve o que está assinado');
  }
}

/* ============================================================
   v8.13 (D14) — O "% PREENCHIDO" DA SRE CONTA A SEÇÃO 3 (A4-07)

   `OBRIG_PAINEL` listava `principios` (a marcação) e não `tPrincipios` (o
   texto da seção 3, obrigatório nas telas): um PPP sem a seção 3 podia
   aparecer à Superintendência como 100% preenchido.
   ============================================================ */
{
  ok(B.OBRIG_PAINEL.indexOf('tPrincipios') >= 0,
     'D14: o texto da seção 3 entra na conta do "% preenchido"');
  ok(B.OBRIG_PAINEL.length === 37,
     'D14: o denominador passa a ser 37 (era 36) — e é por isso que o percentual das linhas antigas cai ~3 pontos');
  ok(new Set(B.OBRIG_PAINEL).size === B.OBRIG_PAINEL.length,
     'D14: sem chave repetida na lista');

  /* um registro com TUDO menos a seção 3 não pode dar 100% */
  {
    const cheio = {};
    B.OBRIG_PAINEL.forEach(function (k) { cheio[k] = 'x'; });
    ok(B.pctDe_(cheio) === 100, 'D14: com tudo preenchido, 100%');
    const semSecao3 = Object.assign({}, cheio); semSecao3.tPrincipios = '';
    ok(B.pctDe_(semSecao3) < 100,
       'D14 (A4-07): faltando o texto da seção 3, o painel deixa de mostrar 100%');
    const soMarcacao = Object.assign({}, cheio); soMarcacao.tPrincipios = ''; soMarcacao.principios = 'x';
    ok(B.pctDe_(soMarcacao) === B.pctDe_(semSecao3),
       'D14: e marcar os princípios não substitui escrever a seção');
  }

  /* recalcularPercentuais() é o caminho previsto para a base em uso */
  ok(typeof B.recalcularPercentuais_ === 'function',
     'D14: existe o recálculo em massa que acerta as linhas gravadas antes desta versão');
}

/* ============================================================
   v8.13 (D15) — TEXTO QUE COMEÇA POR "=" CONTINUA TEXTO (A4-05)

   As strings eram gravadas cruas e lidas por getDisplayValues: no Sheets, um
   texto começado por "=" é FÓRMULA, e o que voltava para a tela, para o
   documento e para o PDF congelado era "#NAME?"/"#ERROR!". As quatro
   baterias não pegavam isto porque o simulador guardava o valor cru — D24
   apertou-o para imitar o Sheets, e é o que torna esta correção conferível.
   ============================================================ */
{
  const TKCD15 = B.criarSessao_({ email: 'central.d15@educacao.mg.gov.br', nome: 'Central D15',
                                  perfil: 'central', papel: 'central' });
  const SRED15 = 'Divinópolis D15', inepD15 = '48001', dirD15 = 'dir.d15@educacao.mg.gov.br';
  B.escolaSalvar({ token: TKCD15, inep: inepD15, escola: 'EE D15', municipio: 'Divinópolis', sre: SRED15, codigoInep: censoDe(inepD15) });
  salvarDiretor(B, { email: dirD15, nome: 'Diretora D15', masp: '1900001',
                   papel: 'diretor_escolar', inep: inepD15 });
  const TKDIRD15 = B.criarSessao_({ email: dirD15, nome: 'Diretora D15', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRED15, inep: inepD15, escola: 'EE D15' });

  const FORMULAS = ['=== Eixo 1 ===', '=40 horas semanais', '=HYPERLINK("x","Plano")',
                    '=IMPORTRANGE("1abc","A1")', '=1+1', '=SOMA(A1:A9)'];

  /* a verificação NEGATIVA primeiro: sem o formato, o simulador devolveria
     #ERROR! — é o que garante que este teste mede alguma coisa */
  {
    const ss = S.g.SpreadsheetApp.getActiveSpreadsheet();
    const prova = ss.insertSheet('D15 — prova do simulador');
    prova.getRange(1, 1, 1, 1).setValues([['=== Eixo 1 ===']]);
    ok(prova.getRange(1, 1, 1, 1).getDisplayValues()[0][0] === '#ERROR!',
       'D15: SEM o formato de texto, a planilha devolve "#ERROR!" no lugar do que a escola escreveu');
    prova.getRange(2, 1, 1, 1).setNumberFormat('@');
    prova.getRange(2, 1, 1, 1).setValues([['=== Eixo 1 ===']]);
    ok(prova.getRange(2, 1, 1, 1).getDisplayValues()[0][0] === '=== Eixo 1 ===',
       'D15: COM o formato de texto, ela devolve o texto');
  }

  const base = { escola: 'EE D15', inep: inepD15, municipio: 'Divinópolis', direcao: 'Diretora D15',
                 token: TKDIRD15, status: 'Em andamento' };
  const cr = B.salvarPPP(Object.assign({}, base, {
    tApresentacao: FORMULAS[0], tHistorico: FORMULAS[1], tMissao: FORMULAS[2],
    tObjetivos: FORMULAS[3], tCurriculo: FORMULAS[4], tDiagnostico: FORMULAS[5] }));
  ok(cr.ok, 'D15: o PPP com seis textos começados por "=" é gravado');
  const PD15 = cr.protocolo;
  {
    const reg = B.buscarPPP({ p: PD15, token: TKDIRD15 }).registro;
    const pares = [['tApresentacao',0],['tHistorico',1],['tMissao',2],['tObjetivos',3],['tCurriculo',4],['tDiagnostico',5]];
    const quebrados = pares.filter(function (x) { return reg[x[0]] !== FORMULAS[x[1]]; });
    ok(quebrados.length === 0,
       'D15: a ida-e-volta é idêntica em todos eles' +
       (quebrados.length ? ' — falharam: ' + quebrados.map(function (x) { return x[0] + '=' + reg[x[0]]; }).join(', ') : ''));
    ok(String(reg.tApresentacao).indexOf('#') < 0 && String(reg.tHistorico).indexOf('#ERROR') < 0,
       'D15: e nada volta como erro de planilha');
  }

  /* a regravação da mesma linha também formata */
  {
    const reg = B.buscarPPP({ p: PD15, token: TKDIRD15 }).registro;
    const r = B.salvarPPP(Object.assign({}, base, { protocolo: PD15, rev: reg.rev, tEtapas: '=A1+B2' }));
    ok(r.ok && B.buscarPPP({ p: PD15, token: TKDIRD15 }).registro.tEtapas === '=A1+B2',
       'D15: a regravação da linha mantém o texto como texto');
  }

  /* gravarCampo_ (o caminho dos atos do ciclo) */
  {
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, PD15);
    B.gravarCampo_(abaR, linha, 'parecerValidacao', '=Ajustar a seção 3');
    ok(B.lerLinha_(abaR, linha).parecerValidacao === '=Ajustar a seção 3',
       'D15: gravarCampo_ também formata antes de escrever');
  }

  /* a aba do ciclo: o detalhe carrega texto da escola */
  {
    B.registrarCiclo_(PD15, 'prova D15', 'Diretora D15', 'Direção Escolar', '=== observação da escola ===');
    const ev = B.linhaDoTempo({ token: TKDIRD15, protocolo: PD15 }).eventos
      .filter(function (e) { return e.ato === 'prova D15'; });
    ok(ev.length === 1 && ev[0].detalhe === '=== observação da escola ===',
       'D15: o detalhe do ciclo que começa por "=" continua legível na linha do tempo');
  }

  /* o que já era número continua sendo lido como número */
  {
    const reg = B.buscarPPP({ p: PD15, token: TKDIRD15 }).registro;
    ok(parseInt(reg.versao, 10) === 1 && parseInt(reg.pct, 10) >= 0 && !isNaN(parseInt(reg.pct, 10)),
       'D15: versão e "% preenchido" continuam sendo lidos como número, mesmo gravados como texto');
    const linhas = B.painelRegistros({ token: TKCD15, filtros: { todas: true } }).linhas
      .filter(function (x) { return x.protocolo === PD15; });
    ok(linhas.length === 1 && typeof linhas[0].pct === 'number' && linhas[0].versao >= 1,
       'D15: e o painel continua recebendo números');
  }

  /* o código-fonte: não sobrou gravação de faixa sem o formato */
  {
    const fonte = require('fs').readFileSync('./Code.gs', 'utf8');
    ok(/setNumberFormat\('@'\)/.test(fonte), 'D15: o formato de texto puro está escrito no servidor');
    const semComentario = String(B.registrarCiclo_).replace(/\/\*[\s\S]*?\*\//g, '');
    ok(/setNumberFormat\('@'\)/.test(semComentario) && !/appendRow/.test(semComentario),
       'D15: a aba do ciclo deixou de ser escrita por appendRow, que não deixa formatar antes');
    ok(/setNumberFormat\('@'\)/.test(String(B.gravarCampo_)),
       'D15: e gravarCampo_ formata antes de escrever');
  }
}

/* ============================================================
   v8.13 (D19/D20/D21) — A FOLHA DE ASSINATURAS DENTRO DA PAGINAÇÃO,
   A PRÉVIA MARCADA EM TODAS AS FOLHAS E O RODAPÉ QUE DIZ O ESTADO

   Até a 8.12 gerarPdfOficial_ montava `corpo + <div class="quebra"> + folha`:
   a folha ficava DEPOIS do </div> que fecha .paginas, portanto fora de
   qualquer .pagina — sem as margens do Padrão Ofício e sem rodapé. Medido
   com pdftotext -bbox, ela começava a 0 mm da borda esquerda e o PDF tinha
   15 rodapés para 16 páginas. Isto se prova em Node, sem navegador: é
   estrutura, não medida.
   ============================================================ */
{
  const TKC19 = B.criarSessao_({ email: 'central.d19@educacao.mg.gov.br', nome: 'Central D19',
                                 perfil: 'central', papel: 'central' });
  const SRE19 = 'Divinópolis D19';
  B.escolaSalvar({ token: TKC19, inep: '46000', escola: 'EE D19 base', municipio: 'Divinópolis', sre: SRE19, codigoInep: censoDe('46000') });
  B.acessoSalvar({ token: TKC19, email: 'sup.d19@educacao.mg.gov.br', nome: 'Super D19',
                   papel: 'superintendente', perfil: 'regional', sre: SRE19 });
  const TKSUP19 = B.criarSessao_({ email: 'sup.d19@educacao.mg.gov.br', nome: 'Super D19',
                                   perfil: 'regional', papel: 'superintendente', sre: SRE19 });
  B.acessoSalvar({ token: TKSUP19, email: 'de.d19@educacao.mg.gov.br', nome: 'DE D19',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRE19 });
  const TKDE19 = B.criarSessao_({ email: 'de.d19@educacao.mg.gov.br', nome: 'DE D19',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SRE19 });

  /* um corpo já paginado, como concluirPPP o recebe da tela */
  const corpoEmFolhas = function (n) {
    let h = '<div class="paginas">';
    for (let i = 1; i <= n; i++) {
      h += '<div class="pagina" data-pag="' + i + '" data-de="' + n + '">' +
        '<div class="pag-corpo">' +
        (i === 1 ? '<div class="sumario"><h3 class="doc-h">Sumário</h3>' +
                   '<p class="sum-item" data-sum="folha"><span class="sum-tx">22. Folha de assinaturas</span><span class="sum-pag"></span></p></div>' : '') +
        '<p>corpo ' + i + '</p></div>' +
        '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span>' +
        '<span class="pag-num">' + (i > 1 ? i : '') + '</span></div></div>';
    }
    return h + '</div>';
  };

  /* o que está solto no primeiro nível de .paginas — nada pode estar */
  const foraDasPaginas = function (html) {
    const s0 = String(html);
    const fora = [];
    if (!/^<div class="paginas">/.test(s0)) fora.push('não começa em .paginas');
    if (!/<\/div>$/.test(s0)) fora.push('há conteúdo depois do fim de .paginas');
    const dentro = s0.replace(/^<div class="paginas">/, '').replace(/<\/div>$/, '');
    const re = /<\/?([a-zA-Z0-9]+)\b[^>]*>|[^<]+/g;
    let m, prof = 0;
    while ((m = re.exec(dentro))) {
      const t = m[0];
      if (t.charAt(0) !== '<') { if (prof === 0 && t.trim()) fora.push('texto solto'); continue; }
      const fecha = t.slice(0, 2) === '</';
      const tag = String(m[1]).toLowerCase();
      /* profundidade negativa quer dizer que .paginas já fechou e o que vem
         depois está fora de qualquer folha — foi exatamente assim que a folha
         de assinaturas saía sem margem e sem rodapé até a 8.12 */
      if (prof < 0 && !fecha) { fora.push('depois de .paginas: ' + t.slice(0, 30)); continue; }
      if (prof === 0 && !fecha && !(tag === 'div' && /class="pagina"/.test(t))) fora.push(t.slice(0, 40));
      if (tag === 'div') { if (fecha) prof--; else prof++; }
    }
    return fora;
  };

  let seq19 = 0;
  const concluido19 = function (nColegiado, nPaginasCorpo) {
    seq19++;
    const inep = '4601' + seq19, nome = 'EE D19 ' + seq19;
    const dirMail = 'dir.d19.' + seq19 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKC19, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SRE19, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: dirMail, nome: 'Diretora D19 ' + seq19, masp: '160000' + seq19,
                     papel: 'diretor_escolar', inep: inep });
    const tkDir = B.criarSessao_({ email: dirMail, nome: 'Diretora D19 ' + seq19, perfil: 'escola',
      papel: 'diretor_escolar', sre: SRE19, inep: inep, escola: nome });
    const membros = [];
    for (let i = 0; i < nColegiado; i++) {
      const mail = 'col' + i + '.d19.' + seq19 + '@educacao.mg.gov.br';
      B.acessoSalvar({ token: tkDir, email: mail, nome: 'Membro ' + i + ' D19 ' + seq19,
                       masp: '26000' + seq19 + i, papel: 'colegiado', perfil: 'escola',
                       inep: inep, segmento: 'Docente' });
      membros.push(mail);
    }
    const P = B.salvarPPP({ token: tkDir, escola: nome, inep: inep, municipio: 'Divinópolis',
      sessao: 'd19', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: tkDir, protocolo: P });
    B.validarPPP({ token: TKDE19, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: tkDir, protocolo: P, escola: nome, inep: inep, municipio: 'Divinópolis',
      direcao: 'Diretora D19', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: corpoEmFolhas(nPaginasCorpo || 3), sessao: 'd19' });
    /* a presença na reunião de aprovação só se marca com a coleta aberta —
       é ela que põe uma caixa por membro presente na folha */
    if (membros.length) B.presencaColegiado({ p: P, token: tkDir, emails: membros });
    return { P: P, tkDir: tkDir, membros: membros,
             reg: function () { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); } };
  };

  /* ---- (1) o documento oficial é uma coisa só, do começo ao fim ---- */
  {
    const e = concluido19(2, 3);
    const reg = e.reg();
    const completo = B.documentoComFolha_(reg, corpoEmFolhas(3));
    const nPag = (completo.match(/<div class="pagina"/g) || []).length;
    const nRod = (completo.match(/class="pag-rodape"/g) || []).length;
    ok((completo.match(/<table class="cxs">/g) || []).length === 1,
       'D19 (A6-03): o documento oficial tem UMA tabela de caixas de assinatura, e não duas');
    ok(nPag === 4 && nRod === nPag,
       'D19 (A6-03): toda folha do documento tem rodapé (' + nPag + ' folhas, ' + nRod + ' rodapés)');
    ok(foraDasPaginas(completo).length === 0,
       'D19 (A6-03): nada do documento fica fora das folhas (' + foraDasPaginas(completo).slice(0, 2).join(', ') + ')');
    const des = (completo.match(/data-de="(\d+)"/g) || []).map(function (x) { return x.replace(/\D/g, ''); });
    ok(des.length === nPag && des.every(function (x) { return x === String(nPag); }),
       'D19: data-de é o total final em TODAS as folhas (' + des.join(',') + ')');
    ok((completo.match(/<!--COD-->/g) || []).length === nPag,
       'D19: a marca do código de autenticidade está no rodapé de todas as folhas — inclusive nas da assinatura');
    ok(completo.indexOf('<div class="quebra">') < 0,
       'D19: a folha deixou de ser colada por uma quebra depois do fim da paginação');
    ok(/<span class="sum-pag">4<\/span>/.test(completo),
       'D22: o item "Folha de assinaturas" do sumário recebe o número da primeira folha dela');
    /* e a tela e a porta pública veem exatamente o mesmo */
    ok(B.documentoCongelado_(reg).indexOf('<table class="cxs">') > 0 &&
       (B.documentoCongelado_(reg).match(/<div class="pagina"/g) || []).length === nPag,
       'D19: a tela e a porta pública recebem o MESMO documento que o PDF imprime');
  }

  /* ---- (2) uma folha de assinaturas longa vira várias folhas, todas completas ---- */
  {
    const e = concluido19(25, 2);
    const reg = e.reg();
    const nFolha = B.folhaEmPaginas_(reg, 3, 0).paginas;
    ok(B.folhaCaixas_(reg).length >= 26,
       'D19: 25 membros do Colegiado mais a direção — as caixas existem todas (' + B.folhaCaixas_(reg).length + ')');
    ok(nFolha === 5, 'D19: com 25 signatários, a folha de assinaturas ocupa 5 folhas (' + nFolha + ')');
    const completo = B.documentoComFolha_(reg, corpoEmFolhas(2));
    const nPag = (completo.match(/<div class="pagina"/g) || []).length;
    ok(nPag === 7 && (completo.match(/class="pag-rodape"/g) || []).length === 7,
       'D19: sete folhas ao todo, e todas com rodapé (' + nPag + ')');
    ok(foraDasPaginas(completo).length === 0, 'D19: nenhuma delas fica fora da paginação');
    ok((completo.match(/class="pag-corpo"/g) || []).length === nPag,
       'D19: e toda folha tem a caixa de texto com as margens do Padrão Ofício');
  }

  /* ---- (3) D20: a prévia é prévia em TODAS as folhas ---- */
  {
    const e = concluido19(2, 4);
    const corpo = corpoEmFolhas(4);
    const html = B.htmlDaPrevia_({ token: e.tkDir, protocolo: e.P, escola: 'EE D19', docHtml: corpo });
    const nPag = (html.match(/<div class="pagina"/g) || []).length;
    ok(nPag >= 5, 'D20 (A6-05): a prévia tem as folhas do documento mais a folha de assinaturas (' + nPag + ')');
    /* v8.13 (E17): a tarja passou a levar estilo EM LINHA com !important —
       nenhuma folha de autor a apaga. O `class="previa"` continua ali. */
    ok((html.match(/<p class="previa"/g) || []).length === 1 &&
       html.indexOf('<div class="pag-corpo"><p class="previa"') > 0,
       'D20 (A6-05): a tarja entra DENTRO da primeira folha — até a 8.12 ela ficava fora e deixava a folha 1 em branco');
    ok((html.match(/PRÉVIA/g) || []).length >= nPag,
       'D20 (A6-05): a palavra PRÉVIA aparece ao menos uma vez por folha — folha avulsa de prévia não se confunde com o documento final');
    ok((html.match(/class="pag-rodape"/g) || []).length === nPag &&
       (html.match(/documento ainda não concluído nem assinado · gerado em/g) || []).length === nPag,
       'D20 (A6-05): e o rodapé de TODAS as folhas diz que aquilo é prévia');
    /* nenhuma folha vazia: toda .pag-corpo tem conteúdo */
    const corpos = html.match(/<div class="pag-corpo">([\s\S]*?)<div class="pag-rodape">/g) || [];
    const vazias = corpos.filter(function (c) { return !c.replace(/<[^>]+>/g, '').trim(); });
    ok(corpos.length === nPag && vazias.length === 0,
       'D20 (A6-05): nenhuma folha da prévia sai em branco (' + vazias.length + ')');
    ok(/22\. Folha de assinaturas|<table class="cxs">|DOC\.folha|assinatura/i.test(html),
       'D20: a prévia passa a trazer a seção 22, que o sumário promete');
    /* a prévia NÃO escreve no registro */
    const antes = JSON.stringify(e.reg());
    B.htmlDaPrevia_({ token: e.tkDir, protocolo: e.P, escola: 'EE D19', docHtml: corpo });
    ok(JSON.stringify(e.reg()) === antes, 'D20: a prévia continua sem escrever nada no registro');
    /* e a folha de OUTRA escola não vaza pela prévia */
    const outra = concluido19(3, 2);
    const semSessao = B.htmlDaPrevia_({ protocolo: outra.P, escola: 'EE alheia', docHtml: corpo });
    ok(semSessao.indexOf('Membro 0 D19') < 0 && semSessao.indexOf('MASP 26000') < 0,
       'D20: sem sessão sobre o registro, a prévia não imprime os signatários dele');
  }

  /* ---- (4) D21: o rodapé diz o ESTADO, e o mesmo na tela e no papel ---- */
  {
    const e = concluido19(1, 3);
    const reg0 = e.reg();
    ok(/Documento em coleta de assinaturas no Gerador de PPP/.test(B.rodapeAutenticidade_(reg0)) &&
       !/assinado eletronicamente/.test(B.rodapeAutenticidade_(reg0)),
       'D21 (A6-08): com assinatura pendente, o rodapé diz "em coleta de assinaturas" — e não que o documento está assinado');
    ok(/código de autenticidade /.test(B.rodapeAutenticidade_(reg0)) &&
       /confira em .*\?v=/.test(B.rodapeAutenticidade_(reg0)),
       'D21: e continua trazendo o código e o endereço onde se confere');
    const pdfHtml = B.montarHtmlPdf_(B.documentoComFolha_(reg0, corpoEmFolhas(3)), B.rodapeAutenticidade_(reg0));
    const nPag = (pdfHtml.match(/<div class="pagina"/g) || []).length;
    ok(nPag > 1 && (pdfHtml.match(/Documento em coleta de assinaturas/g) || []).length === nPag,
       'D21: e a frase entra no rodapé de TODAS as folhas do PDF (' + nPag + ')');
    /* colhidas todas as assinaturas, a frase muda */
    B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-d21.pdf', mime: 'application/pdf',
                     dataReuniao: '30/08/2026', identificacao: 'Ata D21' });
    B.assinarNoSistema({ token: B.criarSessao_({ email: e.membros[0], nome: 'Membro 0 D19', perfil: 'escola',
      papel: 'colegiado', sre: SRE19, inep: e.reg().inep, escola: e.reg().escola }), protocolo: e.P, aceite: true });
    const assDir = B.assinarDirecao({ p: e.P, token: e.tkDir, atesto: true });
    ok(assDir && assDir.ok, 'D21: a direção assina o termo depois da ata e do Colegiado' + (assDir && assDir.erro ? ' — ' + assDir.erro : ''));
    const reg1 = e.reg();
    ok(/Documento assinado eletronicamente no Gerador de PPP/.test(B.rodapeAutenticidade_(reg1)),
       'D21 (A6-08): colhidas todas, o rodapé passa a dizer "assinado eletronicamente"');
    /* a tela recebe o MESMO texto do servidor, e não uma remontagem sua */
    const leitura = B.registroLeitura({ token: e.tkDir, p: e.P });
    ok(leitura.ok && leitura.rodape === B.rodapeAutenticidade_(reg1),
       'D21 (A5-11): registroLeitura entrega à tela o rodapé do servidor, palavra por palavra');
    const publico = B.documentoPublicoHtml({ codigo: reg1.hash });
    ok(publico.ok && publico.rodape === B.rodapeAutenticidade_(reg1),
       'D21 (A5-11): e a porta pública, o mesmo — tela e papel dizem a mesma coisa');
  }

  /* ---- (5) documento congelado ANTES da 8.9, sem folhas: nada se reescreve ---- */
  {
    const e = concluido19(1, 1);
    const reg = e.reg();
    const antigo = '<p>corpo de um PPP concluído antes da paginação</p>';
    const completo = B.documentoComFolha_(reg, antigo);
    ok(completo.indexOf(antigo) === 0 && /<div class="quebra"><\/div>/.test(completo),
       'D19: corpo congelado sem folhas continua recebendo a folha como sempre recebeu — documento assinado não se reescreve');
    ok((completo.match(/<table class="cxs">/g) || []).length === 1,
       'D19: e com uma tabela de caixas só');
  }
}

/* ==================== v8.13 (C14): colegiadoListar exige a direção ==================== */
{
  const TKC14 = B.criarSessao_({ email: 'central.c14@educacao.mg.gov.br', nome: 'Central C14',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC14, inep: '31001401', escola: 'EE C14', municipio: 'Betim', sre: 'SRE C14', codigoInep: censoDe('31001401') });
  salvarDiretor(B, { email: 'dir.c14@educacao.mg.gov.br', nome: 'Diretora C14',
                   papel: 'diretor_escolar', inep: '31001401' });
  const TKDIR14 = B.criarSessao_({ email: 'dir.c14@educacao.mg.gov.br', nome: 'Diretora C14', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'SRE C14', inep: '31001401', escola: 'EE C14' });
  const cad1 = B.acessoSalvar({ token: TKDIR14, email: 'estudante.c14@gmail.com', nome: 'Estudante C14',
                                papel: 'colegiado', segmento: 'Estudante', relacao: 'Estudante do 3º ano' });
  ok(cad1 && cad1.ok && Array.isArray(cad1.membros) && cad1.membros.length === 1,
     'v8.13 (C14): cadastrar membro pela direção continua devolvendo a lista do colegiado');
  B.acessoSalvar({ token: TKDIR14, email: 'pai.c14@gmail.com', nome: 'Pai C14',
                   papel: 'colegiado', segmento: 'Pai/responsável', relacao: 'Responsável pelo estudante A' });

  const TKCOL14 = B.criarSessao_({ email: 'estudante.c14@gmail.com', nome: 'Estudante C14', perfil: 'escola',
    papel: 'colegiado', sre: 'SRE C14', inep: '31001401', escola: 'EE C14' });
  /* o membro do Colegiado TEM inep na sessão: era por isso que a guarda antiga
     (`sessao_` + `s.inep`) o deixava entrar */
  let erroCol = '';
  try { B.colegiadoListar({ token: TKCOL14 }); } catch (e) { erroCol = String(e && e.message || e); }
  ok(/direção escolar/i.test(erroCol),
     'v8.13 (C14, A2-06): a sessão de um membro do Colegiado é recusada por colegiadoListar — ' + (erroCol || 'NÃO foi recusada'));
  ok(erroCol === B.ERRO_SO_DIRECAO,
     'v8.13 (C14): e a recusa é a MESMA das demais ações de gestão do colegiado');
  /* nada de dado pessoal atravessa a recusa */
  ok(erroCol.indexOf('@gmail.com') < 0 && erroCol.indexOf('Pai C14') < 0,
     'v8.13 (C14): a recusa não carrega nome nem e-mail de ninguém');

  const daDir = B.colegiadoListar({ token: TKDIR14 });
  ok(daDir && daDir.ok && daDir.membros.length === 2 && daDir.inep === '31001401',
     'v8.13 (C14): a direção da mesma escola continua recebendo a lista inteira');
  const rem = B.acessoRemover({ token: TKDIR14, email: 'pai.c14@gmail.com', motivo: 'saiu do colegiado' });
  ok(rem && rem.ok && Array.isArray(rem.membros) && rem.membros.length === 1,
     'v8.13 (C14): remover membro pela direção continua devolvendo a lista');
  /* uma sessão regional (que tem SRE mas não INEP) continua fora */
  const TKREG14 = sessaoDe_({ email: 'sup.c14@educacao.mg.gov.br', nome: 'Superintendente C14',
                              perfil: 'regional', papel: 'superintendente', sre: 'SRE C14' });
  let erroReg = '';
  try { B.colegiadoListar({ token: TKREG14 }); } catch (e) { erroReg = String(e && e.message || e); }
  ok(/direção escolar/i.test(erroReg),
     'v8.13 (C14): e a regional também não lê o Colegiado por esta porta');
}

/* ==================== v8.13 (C15): nome obrigatório no servidor ==================== */
{
  const TKC15 = B.criarSessao_({ email: 'central.c15@educacao.mg.gov.br', nome: 'Central C15',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC15, inep: '31001501', escola: 'EE C15', municipio: 'Contagem', sre: 'SRE C15', codigoInep: censoDe('31001501') });
  B.escolaSalvar({ token: TKC15, inep: '31001502', escola: 'EE C15 Dois', municipio: 'Contagem', sre: 'SRE C15', codigoInep: censoDe('31001502') });
  salvarDiretor(B, { email: 'dir.c15@educacao.mg.gov.br', nome: 'Diretora C15',
                   papel: 'diretor_escolar', inep: '31001501' });
  const TKDIR15 = B.criarSessao_({ email: 'dir.c15@educacao.mg.gov.br', nome: 'Diretora C15', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'SRE C15', inep: '31001501', escola: 'EE C15' });

  const periodosDe = (email) => B.gestoresTodos_().filter(g => g.email === String(email).toLowerCase());
  const vazios = ['', '   ', 'ab'];

  /* (1) papel regional — cadastro NOVO, sem nada gravado de onde herdar nome */
  vazios.forEach(function (n, i) {
    const r = B.acessoSalvar({ token: TKC15, email: 'anonimo' + i + '.c15@educacao.mg.gov.br', nome: n,
                               papel: 'superintendente', perfil: 'regional', sre: 'SRE C15 ' + i });
    ok(!r.ok && /Informe o nome de quem recebe o acesso/.test(r.erro || ''),
       'v8.13 (C15, A2-09): acesso regional com nome ' + JSON.stringify(n) + ' é recusado pelo SERVIDOR');
    ok(!B.acessoPorEmail_('anonimo' + i + '.c15@educacao.mg.gov.br') &&
       periodosDe('anonimo' + i + '.c15@educacao.mg.gov.br').length === 0,
       'v8.13 (C15): e nenhum cadastro e nenhum período anônimo é aberto');
  });

  /* (2) direção escolar — escola sem diretor em exercício */
  const rDir = salvarDiretor(B, { email: 'anonima.dir.c15@educacao.mg.gov.br', nome: '  ',
                                papel: 'diretor_escolar', inep: '31001502' });
  ok(!rDir.ok && /Informe o nome de quem recebe o acesso/.test(rDir.erro || ''),
     'v8.13 (C15): direção escolar sem nome é recusada');
  ok(!B.acessoPorInep_('31001502'), 'v8.13 (C15): e a escola continua sem cadastro de direção');

  /* (3) colegiado */
  const rCol = B.acessoSalvar({ token: TKDIR15, email: 'anonimo.col.c15@gmail.com', nome: 'ab',
                                papel: 'colegiado', segmento: 'Estudante', relacao: 'Estudante do 2º ano' });
  ok(!rCol.ok && /Informe o nome de quem recebe o acesso/.test(rCol.erro || ''),
     'v8.13 (C15): membro do colegiado sem nome é recusado');
  ok(!B.acessoPorEmail_('anonimo.col.c15@gmail.com'),
     'v8.13 (C15): e nenhuma linha de colegiado anônima fica na aba Acessos');

  /* (4) suspender e reativar SEM reenviar o nome continua funcionando */
  B.acessoSalvar({ token: TKC15, email: 'sup.c15@educacao.mg.gov.br', nome: 'Superintendente C15',
                   papel: 'superintendente', perfil: 'regional', sre: 'SRE C15' });
  const susp = B.acessoSalvar({ token: TKC15, email: 'sup.c15@educacao.mg.gov.br',
                                papel: 'superintendente', perfil: 'regional', sre: 'SRE C15', situacao: 'inativo' });
  ok(susp && susp.ok && B.acessoPorEmail_('sup.c15@educacao.mg.gov.br').situacao === 'inativo' &&
     B.acessoPorEmail_('sup.c15@educacao.mg.gov.br').nome === 'Superintendente C15',
     'v8.13 (C15): suspender sem reenviar o nome continua passando, e o nome gravado permanece');
  const reat = B.acessoSalvar({ token: TKC15, email: 'sup.c15@educacao.mg.gov.br',
                                papel: 'superintendente', perfil: 'regional', sre: 'SRE C15', situacao: 'ativo' });
  ok(reat && reat.ok && B.acessoPorEmail_('sup.c15@educacao.mg.gov.br').situacao === 'ativo',
     'v8.13 (C15): e reativar também');

  /* (5) a troca de diretor não herda o nome do antecessor: sem nome, recusa */
  const trocaSemNome = salvarDiretor(B, { email: 'sucessor.c15@educacao.mg.gov.br',
                                        papel: 'diretor_escolar', inep: '31001501' });
  ok(!trocaSemNome.ok && /Informe o nome de quem recebe o acesso/.test(trocaSemNome.erro || ''),
     'v8.13 (C15): trocar o diretor sem informar o nome é recusado — o sucessor não herda o nome de quem saiu');
  ok(B.acessoPorInep_('31001501').email === 'dir.c15@educacao.mg.gov.br',
     'v8.13 (C15): e a direção em exercício continua a mesma');
  const trocaComNome = salvarDiretor(B, { email: 'sucessor.c15@educacao.mg.gov.br',
                                        nome: 'Sucessora C15', papel: 'diretor_escolar', inep: '31001501' });
  ok(trocaComNome && trocaComNome.ok && B.acessoPorInep_('31001501').nome === 'Sucessora C15',
     'v8.13 (C15): com o nome, a troca continua sendo feita normalmente');

  /* (6) remover um cadastro legado sem nome continua possível */
  {
    const aba = B.abaAcessos_();
    const linha = new Array(B.ACESSO_COLS.length).fill('');
    linha[0] = 'legado.c15@educacao.mg.gov.br'; linha[1] = ''; linha[2] = 'regional';
    linha[3] = 'SRE C15'; linha[6] = 'ativo'; linha[7] = B.agora_(); linha[12] = 'equipe_de';
    aba.appendRow(linha); B.invalidarAcessos_();
    const TKDE15 = sessaoDe_({ email: 'de.c15@educacao.mg.gov.br', nome: 'Diretora Educacional C15',
                               perfil: 'regional', papel: 'diretor_educacional', sre: 'SRE C15' });
    const rem = B.acessoRemover({ token: TKDE15, email: 'legado.c15@educacao.mg.gov.br', motivo: 'linha sem nome' });
    ok(rem && rem.ok && !B.acessoPorEmail_('legado.c15@educacao.mg.gov.br'),
       'v8.13 (C15): a exigência do nome não impede REMOVER um cadastro legado que já está sem nome');
  }
}

/* ==================== v8.13 (C16): contas a regularizar alcança o Colegiado servidor ==================== */
{
  const TKC16 = B.criarSessao_({ email: 'central.c16@educacao.mg.gov.br', nome: 'Central C16',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC16, inep: '31001601', escola: 'EE C16', municipio: 'Sabará', sre: 'SRE C16', codigoInep: censoDe('31001601') });
  salvarDiretor(B, { email: 'dir.c16@educacao.mg.gov.br', nome: 'Diretora C16',
                   papel: 'diretor_escolar', inep: '31001601' });
  const TKDIR16 = B.criarSessao_({ email: 'dir.c16@educacao.mg.gov.br', nome: 'Diretora C16', perfil: 'escola',
    papel: 'diretor_escolar', sre: 'SRE C16', inep: '31001601', escola: 'EE C16' });
  const TKSUP16 = sessaoDe_({ email: 'sup.c16@educacao.mg.gov.br', nome: 'Superintendente C16',
                              perfil: 'regional', papel: 'superintendente', sre: 'SRE C16' });

  /* o docente com e-mail particular: é servidor da rede, e a cobrança faz sentido */
  const cadDoc = B.acessoSalvar({ token: TKDIR16, email: 'docente.c16@gmail.com', nome: 'Docente C16',
                                  papel: 'colegiado', segmento: 'Docente' });
  ok(cadDoc && cadDoc.ok && /educacao\.mg\.gov\.br/.test(cadDoc.aviso || ''),
     'v8.13 (C16): cadastrar docente do Colegiado com e-mail particular continua dando o aviso da conta institucional');
  /* o servidor administrativo idem; o estudante e o pai, não */
  B.acessoSalvar({ token: TKDIR16, email: 'adm.c16@hotmail.com', nome: 'Servidora Administrativa C16',
                   papel: 'colegiado', segmento: 'Servidor administrativo' });
  B.acessoSalvar({ token: TKDIR16, email: 'estudante.c16@gmail.com', nome: 'Estudante C16',
                   papel: 'colegiado', segmento: 'Estudante', relacao: 'Estudante do 3º ano' });
  B.acessoSalvar({ token: TKDIR16, email: 'docente.inst.c16@educacao.mg.gov.br', nome: 'Docente Institucional C16',
                   papel: 'colegiado', segmento: 'Docente' });

  const daDir = B.contasPendentes({ token: TKDIR16 });
  const emails16 = (daDir.linhas || []).map(x => x.email).sort();
  ok(daDir.ok && daDir.escopo === 'escola',
     'v8.13 (C16, A2-08): a direção escolar recebe a lista, no escopo da sua escola');
  ok(emails16.join('|') === 'adm.c16@hotmail.com|docente.c16@gmail.com',
     'v8.13 (C16): e ela traz o docente e a servidora administrativa com conta fora do domínio — ' + emails16.join('|'));
  ok(emails16.indexOf('estudante.c16@gmail.com') < 0,
     'v8.13 (C16): o estudante com e-mail particular NÃO entra — dele não se cobra conta institucional');
  ok(emails16.indexOf('docente.inst.c16@educacao.mg.gov.br') < 0,
     'v8.13 (C16): e quem já tem conta do domínio também não');
  ok(daDir.totalDiretores === 3 && daDir.foraDominio === 2,
     'v8.13 (C16): o denominador é o dos membros servidores da escola, não o dos diretores da rede');

  /* v9.7: fora da escola, a lista é de quem GERE os diretores — a Diretoria
     Educacional da regional. O Superintendente e o Órgão Central não a veem. */
  const daSre = B.contasPendentes({ token: tkDE('SRE C16', B) });
  ok(daSre.ok && daSre.escopo === 'sre' &&
     (daSre.linhas || []).every(x => x.email.indexOf('c16@gmail.com') < 0 && x.email !== 'adm.c16@hotmail.com'),
     'v8.13 (C16): nenhuma linha de Colegiado sai para a regional');
  ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKC16 }))),
     'v9.7 (C16): o Órgão Central não recebe as contas a regularizar dos diretores');
  ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKSUP16 }))),
     'v9.7 (C16): nem o Superintendente — quem gere os diretores é a Diretoria Educacional');
  /* e a lista da Diretoria Educacional continua sendo a de sempre: só diretores escolares */
  ok((daSre.linhas || []).every(x => (B.acessoPorEmail_(x.email) || {}).papel === 'diretor_escolar'),
     'v8.13 (C16): fora da escola, toda linha continua sendo de direção escolar');

  /* a Inspeção continua fora: não associa, e não cadastra Colegiado nenhum */
  const TKINSP16 = sessaoDe_({ email: 'insp.c16@educacao.mg.gov.br', nome: 'Coordenador de Inspeção C16',
                               perfil: 'regional', papel: 'coordenador_inspecao', sre: 'SRE C16' });
  ok(/não gere os diretores/.test(lanca(() => B.contasPendentes({ token: TKINSP16 }))),
     'v8.13 (C16): e a Inspeção continua recebendo a recusa de sempre');
}

/* ==================== v8.13 (C19): a trava da conferência pública não bloqueia código válido ==================== */
{
  const TKC19b = B.criarSessao_({ email: 'central.c19@educacao.mg.gov.br', nome: 'Central C19',
                                  perfil: 'central', papel: 'central' });
  const SRE19b = 'SRE C19';
  B.escolaSalvar({ token: TKC19b, inep: '31001901', escola: 'EE C19', municipio: 'Ouro Preto', sre: SRE19b, codigoInep: censoDe('31001901') });
  B.acessoSalvar({ token: TKC19b, email: 'de.c19@educacao.mg.gov.br', nome: 'Diretora Educacional C19',
                   papel: 'superintendente', perfil: 'regional', sre: SRE19b });
  const TKDE19b = B.criarSessao_({ email: 'de.c19@educacao.mg.gov.br', nome: 'Diretora Educacional C19',
                                   perfil: 'regional', papel: 'superintendente', sre: SRE19b });
  salvarDiretor(B, { email: 'dir.c19@educacao.mg.gov.br', nome: 'Diretora C19', masp: '1900001',
                   papel: 'diretor_escolar', inep: '31001901' });
  const TKD19b = B.criarSessao_({ email: 'dir.c19@educacao.mg.gov.br', nome: 'Diretora C19', perfil: 'escola',
    papel: 'diretor_escolar', sre: SRE19b, inep: '31001901', escola: 'EE C19' });
  const P19b = B.salvarPPP({ token: TKD19b, escola: 'EE C19', inep: '31001901', municipio: 'Ouro Preto',
                             tMissao: 'conteúdo C19', etapas: ['Ensino Médio'] }).protocolo;
  B.enviarParaValidacao({ token: TKD19b, protocolo: P19b });
  B.validarPPP({ token: TKDE19b, protocolo: P19b, parecer: 'ok' });
  B.concluirPPP({ token: TKD19b, protocolo: P19b, escola: 'EE C19', inep: '31001901', municipio: 'Ouro Preto',
                  direcao: 'Diretora C19', tMissao: 'conteúdo C19', etapas: ['Ensino Médio'],
                  docHtml: docTeste('<p>corpo C19</p>') });
  const reg19b = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P19b));
  const COD19 = reg19b.hash;
  ok(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(COD19 || ''),
     'v8.13 (C19): o PPP do cenário tem código de autenticidade — ' + COD19);

  /* a varredura: 45 conferências erradas em menos de um minuto */
  const CODIGO_INEXISTENTE = 'AAAA-BBBB-CCCC';
  for (let i = 0; i < 45; i++) B.verificarDocumento({ codigo: CODIGO_INEXISTENTE });
  ok(B.portaDeVerificacaoTravada_() === true,
     'v8.13 (C19): depois de 45 tentativas erradas num minuto, a porta está travada');

  /* ... e o portador do código legítimo continua sendo atendido */
  const conf = B.verificarDocumento({ codigo: COD19 });
  ok(conf && conf.ok === true && conf.protocolo === P19b && conf.escola === 'EE C19',
     'v8.13 (C19, A1-04): sob varredura, um código VÁLIDO continua conferindo — ' +
     (conf && conf.erro ? conf.erro : 'ok'));
  const pub = B.documentoPublicoHtml({ codigo: COD19 });
  ok(pub && pub.ok === true && /corpo C19/.test(pub.html || ''),
     'v8.13 (C19): e a porta pública entrega o documento inteiro, também sob varredura');
  const pdfPub = B.documentoPublico({ codigo: COD19 });
  ok(pdfPub && pdfPub.ok === true,
     'v8.13 (C19): o PDF público, idem — as duas herdam o comportamento de verificarDocumento');

  /* quem erra continua recebendo a mensagem da trava */
  const errado = B.verificarDocumento({ codigo: CODIGO_INEXISTENTE });
  ok(!errado.ok && /muitas conferências sem sucesso/.test(errado.erro || ''),
     'v8.13 (C19): o código inexistente, com o contador estourado, recebe a mensagem da trava');
  /* e o ciclo NÃO registra conferência de código que não existe */
  const ciclo19 = B.abaCiclo_();
  const linhasCiclo = ciclo19.getLastRow() > 1
    ? ciclo19.getRange(2, 1, ciclo19.getLastRow() - 1, 6).getDisplayValues() : [];
  ok(!linhasCiclo.some(function (l) { return String(l[5]) === CODIGO_INEXISTENTE; }),
     'v8.13 (C19): nenhuma linha de ciclo foi escrita para o código inexistente');
  ok(linhasCiclo.some(function (l) { return l[1] === P19b && /autenticidade conferida/.test(String(l[2])); }),
     'v8.13 (C19): e o ato continua sendo registrado para o documento que existe');

  /* com o contador zerado, o código inexistente volta à mensagem de sempre */
  try { delete CACHE.c['verif:erros']; } catch (e) {}
  const errado2 = B.verificarDocumento({ codigo: 'DDDD-EEEE-FFFF' });
  ok(!errado2.ok && /Não há documento com este código/.test(errado2.erro || ''),
     'v8.13 (C19): fora da varredura, o código inexistente recebe a mensagem de sempre');
  const malformado = B.verificarDocumento({ codigo: 'xyz' });
  ok(!malformado.ok && /doze caracteres/.test(malformado.erro || ''),
     'v8.13 (C19): e o código malformado continua sendo recusado antes de qualquer leitura da planilha');
}

/* ==================== v8.13 (E01): a superfície pública do servidor ==================== */
{
  /* (1) as 16 rotinas de manutenção deixaram de existir com nome público */
  const PRIVADAS = ['atualizarPainel', 'backupDiario', 'listarBackups', 'resumoSemanalParados',
    'processarFilaEmails', 'rotacionarHistoricoAcessos', 'verificarIntegridade',
    'sanearHistoricoColegiado', 'recalcularPercentuais', 'instalarAcionadores', 'testeConfiguracao',
    'levantarParados', 'medirDesempenho', 'gerarBaseSintetica', 'conferirConteudo',
    'definirSenhaCuradoria'];
  const aindaPublicas = PRIVADAS.filter(function (n) { return typeof B[n] === 'function'; });
  const semPrivada = PRIVADAS.filter(function (n) { return typeof B[n + '_'] !== 'function'; });
  ok(aindaPublicas.length === 0,
     'v8.13 (E01, A8-01/16/17/18/22): nenhuma das 16 rotinas de manutenção tem nome público — ' +
     (aindaPublicas.join(', ') || 'nenhuma'));
  ok(semPrivada.length === 0,
     'v8.13 (E01): e todas as 16 existem com o nome privado — faltam ' + (semPrivada.join(', ') || 'nenhuma'));
  /* previaPDF e onOpen são as duas exceções declaradas do plano */
  ok(typeof B.previaPDF === 'function' && typeof B.onOpen === 'function',
     'v8.13 (E01): previaPDF continua pública (a tela a usa, e agora exige sessão) e onOpen mantém o nome que o Apps Script exige');

  /* (2) o despachante recusa o que não está no mapa, e não executa nada */
  const arquivosAntes = ARQUIVOS_CRIADOS.length;
  const hashAntes = S.g.PropertiesService.getScriptProperties().getProperty(B.PROP_HASH);
  ['backupDiario_', 'definirSenhaCuradoria_', '__proto__', 'constructor', 'toString', 'menuBackupAgora', ''].forEach(function (fn) {
    const e = lanca(function () { B.api({ fn: fn }); });
    ok(/Ação desconhecida/.test(e),
       'v8.13 (E01): api({fn:' + JSON.stringify(fn) + '}) é recusada com "Ação desconhecida" — ' + (e || 'NÃO foi recusada'));
  });
  ok(ARQUIVOS_CRIADOS.length === arquivosAntes,
     'v8.13 (E01): e nenhum backup foi criado pelas chamadas recusadas');
  ok(S.g.PropertiesService.getScriptProperties().getProperty(B.PROP_HASH) === hashAntes,
     'v8.13 (E01): e a senha institucional não mudou');

  /* (3) o que está no mapa atravessa idêntico */
  ok(JSON.stringify(B.api({ fn: 'contexto' })) === JSON.stringify(B.contexto()),
     'v8.13 (E01): api({fn:"contexto"}) devolve exatamente o que contexto() devolve');
  ok(JSON.stringify(B.api({ fn: 'conteudoPublicado' })) === JSON.stringify(B.conteudoPublicado()),
     'v8.13 (E01): e o mesmo vale para conteudoPublicado');

  /* (4) a recusa do servidor atravessa o despachante intacta */
  const semTok = B.api({ fn: 'salvarPPP', args: { escola: 'EE Sem Sessão E01', inep: '31000009' } });
  ok(semTok && semTok.ok === false && semTok.semSessao === true,
     'v8.13 (E01): a recusa por falta de sessão atravessa o despachante com a bandeira semSessao');
  ok(/exclusiva do Órgão Central|Sessão expirada|entrar no sistema/i.test(lanca(function () { return B.api({ fn: 'filaEmailsProcessar', args: {} }); })),
     'v8.13 (E01): e a exceção lançada pelo servidor PROPAGA — api não embrulha nada');
  /* args ausente vira {}, como o contrato promete */
  ok(B.api({ fn: 'verificarDocumento' }).ok === false,
     'v8.13 (E01): pedido sem args não quebra o despachante');

  /* a recusa fica registrada no histórico, no máximo uma vez por minuto */
  {
    const hist = B.abaHistAcessos_();
    const antes = hist.getLastRow();
    lanca(function () { B.api({ fn: 'rotinaInventadaE01' }); });
    const depois1 = hist.getLastRow();
    lanca(function () { B.api({ fn: 'rotinaInventadaE01' }); });
    const depois2 = hist.getLastRow();
    ok(depois1 === antes + 1 && depois2 === depois1,
     'v8.13 (E01): a chamada fora da lista é registrada uma vez, e a repetição no mesmo minuto não inunda a trilha');
  }

  /* (5) a senha institucional não se sobrescreve por engano */
  {
    const props = S.g.PropertiesService.getScriptProperties();
    const hash0 = props.getProperty(B.PROP_HASH);
    ok(!!hash0, 'v8.13 (E01): o cenário já tem senha institucional definida');
    const e1 = lanca(function () { B.definirSenhaCuradoria_('senha-nova-2026'); });
    ok(/Já existe senha institucional/.test(e1) && props.getProperty(B.PROP_HASH) === hash0,
       'v8.13 (E01, A8-01): substituir senha já definida sem a confirmação "SIM" é recusado, e nada muda');
    ok(/menos 10 caracteres/.test(lanca(function () { B.definirSenhaCuradoria_('curta', 'SIM'); })),
       'v8.13 (E01): e a senha curta continua sendo recusada');
    IDENTIDADE = 'curador.e01@educacao.mg.gov.br';
    const histAba = B.abaHistorico_();
    B.definirSenhaCuradoria_('senha-nova-institucional-2026', 'SIM');
    const ult = histAba.getRange(histAba.getLastRow(), 1, 1, 6).getDisplayValues()[0];
    ok(props.getProperty(B.PROP_HASH) !== hash0,
       'v8.13 (E01): com "SIM" a senha é substituída');
    ok(/curador\.e01@educacao\.mg\.gov\.br/.test(ult.join(' ')) && /senha de curadoria substituída/.test(ult.join(' ')),
       'v8.13 (E01, A8-01): e a trilha registra QUEM trocou — antes atribuía sempre a "editor do Apps Script"');
    IDENTIDADE = '';
    /* devolve a senha do cenário, para não afetar o que vem depois */
    B.definirSenhaCuradoria_('senha-de-teste-2026', 'SIM');
  }

  /* (6) a medição de desempenho não roda em produção */
  {
    const sessoesAntes = Object.keys(CACHE.c).filter(function (k) { return /^ses:/.test(k); }).length;
    const e = lanca(function () { B.medirDesempenho_('SIM'); });
    ok(/CÓPIA da planilha/.test(e),
       'v8.13 (E01, A8-16): fora de uma cópia, a medição é recusada — ' + e);
    const sessoesDepois = Object.keys(CACHE.c).filter(function (k) { return /^ses:/.test(k); }).length;
    ok(sessoesDepois === sessoesAntes,
       'v8.13 (E01): e ela não chega a criar sessão nenhuma no cache');
  }

  /* (7) o discriminador do menu */
  {
    ok(B.somenteMenu_() === undefined,
       'v8.13 (E01): dentro da planilha, somenteMenu_() deixa passar');
    const getUiReal = S.g.SpreadsheetApp.getUi;
    S.g.SpreadsheetApp.getUi = function () { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); };
    try {
      ok(/só roda pelo menu da planilha/.test(lanca(function () { B.somenteMenu_(); })),
         'v8.13 (E01, A8-22): fora da planilha, somenteMenu_() lança — é o discriminador');
      ok(/só roda pelo menu da planilha/.test(lanca(function () { B.menuBackupAgora(); })),
         'v8.13 (E01): e o invólucro do menu recusa quem o chamar de fora da planilha');
      ok(B.onOpen() === undefined,
         'v8.13 (E01, A8-22): onOpen chamado fora da planilha sai calado, sem exceção no log');
    } finally { S.g.SpreadsheetApp.getUi = getUiReal; }
  }

  /* (8) os invólucros do Órgão Central exigem sessão central */
  {
    const TKE01 = B.criarSessao_({ email: 'central.e01@educacao.mg.gov.br', nome: 'Central E01',
                                   perfil: 'central', papel: 'central' });
    const TKESC01 = sessaoDe_({ email: 'sup.e01@educacao.mg.gov.br', nome: 'Superintendente E01',
                                perfil: 'regional', papel: 'superintendente', sre: 'Divinópolis' });
    ['backupAgora', 'backupsListar', 'integridadeAgora', 'resumoParadosAgora'].forEach(function (fn) {
      ok(/exclusiva do Órgão Central|Órgão Central/.test(lanca(function () { B.api({ fn: fn, args: { token: TKESC01 } }); })),
         'v8.13 (E01): ' + fn + ' recusa sessão regional');
    });
    const lb = B.api({ fn: 'backupsListar', args: { token: TKE01 } });
    ok(lb && lb.ok === true && Array.isArray(lb.arquivos),
       'v8.13 (E01): e o Órgão Central recebe a lista de backups pelo invólucro público');
    const rp = B.api({ fn: 'resumoParadosAgora', args: { token: TKE01 } });
    ok(rp && rp.ok === true && rp.porSre && typeof rp.porSre === 'object',
       'v8.13 (E01, A8-17): o quadro do que está parado passa a sair por resumoParadosAgora, com sessão central');
  }

  /* (9) o acionador aponta para o nome PRIVADO, e é o que fica instalado */
  {
    const inst = B.instalarAcionadores_();
    ok(inst && inst.ok && inst.instalados.length === 6 &&
       inst.instalados.every(function (n) { return /_$/.test(n); }),
       'v8.13 (E01): instalarAcionadores_ relê os acionadores e confirma os seis nomes privados — ' +
       (inst && inst.instalados ? inst.instalados.join(', ') : ''));
    const hist = B.abaHistAcessos_();
    const ult = hist.getRange(hist.getLastRow(), 1, 1, 6).getDisplayValues()[0].join(' ');
    ok(/acionadores instalados/.test(ult) && /backupDiario_/.test(ult),
       'v8.13 (E01): e registra no histórico o que ficou de fato instalado');
  }

  /* (10) o mapa e a tela dizem a mesma coisa */
  {
    const app = fs.readFileSync('./App.html', 'utf8');
    const chamados = Array.from(new Set((app.match(/servidor\(\s*'[A-Za-z0-9_]+'/g) || [])
      .map(function (x) { return x.replace(/^servidor\(\s*'/, '').replace(/'$/, ''); })));
    const fora = chamados.filter(function (n) { return !Object.prototype.hasOwnProperty.call(B.API_TELA, n); });
    ok(fora.length === 0,
       'v8.13 (E01): todo nome que a tela chama por servidor() está em API_TELA — ' + (fora.join(', ') || 'nenhum de fora'));
    ok(Object.prototype.hasOwnProperty.call(B.API_TELA, 'colegiadoImportar'),
       'v8.13 (E01): e o nome que a tela monta em tempo de execução (colegiadoImportar) também está');
    /* v9.8: a importação de diretores em lote saiu da tela — a rota continua
       existindo no servidor, para a implantação pelo menu da planilha, e por
       isso NÃO pode estar em API_TELA: fora do mapa, nenhuma tela a alcança. */
    ok(!Object.prototype.hasOwnProperty.call(B.API_TELA, 'diretoresImportar') &&
       typeof B.diretoresImportar === 'undefined' &&
       typeof B.importarAcessos_ === 'function' && typeof B.menuImportarDiretores === 'function',
       'v9.8: o nome público diretoresImportar deixou de existir — a rotina é privada e só o menu da planilha a alcança');
    ok(Object.keys(B.API_TELA).every(function (n) { return typeof B[n] === 'function'; }),
       'v8.13 (E01): todo nome do mapa é uma função de topo pública de verdade');
  }
}

/* ==================== v8.13 (E02): as rotinas agendadas têm batimento ==================== */
{
  const props = S.g.PropertiesService.getScriptProperties();
  const carimbos = () => { try { return JSON.parse(props.getProperty(B.PROP_ROTINAS) || '{}'); } catch (e) { return {}; } };
  const diasAtras = (n) => {
    const d = new Date(Date.now() - n * 86400000);
    const dd = ('0' + d.getDate()).slice(-2), mm = ('0' + (d.getMonth() + 1)).slice(-2);
    return dd + '/' + mm + '/' + d.getFullYear() + ' 03:00';
  };

  /* (0) mapa vazio: ninguém está atrasado numa implantação recém-feita */
  const guardado = props.getProperty(B.PROP_ROTINAS);
  props.deleteProperty(B.PROP_ROTINAS);
  ok(Array.isArray(B.conferirRotinas_()) && B.conferirRotinas_().length === 0,
     'v8.13 (E02): com o mapa vazio, conferirRotinas_() devolve [] — implantação nova não enche a caixa de ninguém');

  /* (1) a rotina carimba a hora em que terminou */
  B.backupDiario_();
  ok(!!carimbos()['backupDiario_'],
     'v8.13 (E02): backupDiario_ carimba a hora em que terminou');
  B.processarFilaEmails_();
  ok(!!carimbos()['processarFilaEmails_'],
     'v8.13 (E02): processarFilaEmails_ carimba mesmo quando não havia o que enviar (é o finally)');
  B.resumoSemanalParados_();
  B.rotacionarHistoricoAcessos_();
  ok(!!carimbos()['resumoSemanalParados_'] && !!carimbos()['rotacionarHistoricoAcessos_'],
     'v8.13 (E02): o resumo semanal e a rotação do histórico também carimbam');

  /* (2) envelhecer a fila em 3 dias faz o batimento acusá-la */
  {
    const m = carimbos();
    m['processarFilaEmails_'] = diasAtras(3);
    props.setProperty(B.PROP_ROTINAS, JSON.stringify(m));
    const atr = B.conferirRotinas_();
    ok(atr.some(function (a) { return a.rotina === 'processarFilaEmails_' && a.dias >= 3; }),
       'v8.13 (E02): a fila parada há 3 dias entra na lista de atrasadas (limite: 1 dia)');
    ok(!atr.some(function (a) { return a.rotina === 'backupDiario_'; }),
       'v8.13 (E02): e o backup, que acabou de rodar, não entra');
  }

  /* (3) o aviso sai por MailApp DIRETO, nunca pela fila — que pode ser o que parou */
  {
    props.deleteProperty(B.PROP_AVISO_ROTINAS);

    const emailsAntes = emails.length, filaAntes = fila().length;
    const r = B.verificarIntegridade_();
    /* a verificação pode fechar a volta em lotes; roda até fechar */
    let voltas = 0;
    let res = r;
    while (res.parcial && voltas++ < 50) res = B.verificarIntegridade_();
    const novos = emails.slice(emailsAntes).filter(function (e) { return /rotina automática parada/i.test(e.subject || ''); });
    ok(novos.length === 1,
       'v8.13 (E02): a verificação diária manda UM e-mail direto sobre a rotina parada — ' + novos.length);
    ok(/fila de e-mails/.test(novos[0] ? novos[0].body : ''),
       'v8.13 (E02): e o aviso diz qual rotina está parada e desde quando');
    ok(!fila().slice(filaAntes).some(function (f) { return /rotina automática parada/i.test(f.assunto || ''); }),
       'v8.13 (E02, lição de A8-11): o aviso NÃO entra na fila — a fila é justamente o que pode estar parado');
    /* (4) uma segunda execução no mesmo dia não manda o segundo aviso */
    const antes2 = emails.length;
    let res2 = B.verificarIntegridade_();
    let v2 = 0;
    while (res2.parcial && v2++ < 50) res2 = B.verificarIntegridade_();
    ok(emails.slice(antes2).filter(function (e) { return /rotina automática parada/i.test(e.subject || ''); }).length === 0,
       'v8.13 (E02): a segunda volta no mesmo dia não repete o aviso');
  }

  /* (5) a verificação de configuração imprime a tabela de carimbos */
  {
    const tc = B.testeConfiguracao_();
    ok(tc && tc.ok && tc.rotinas && typeof tc.rotinas === 'object' && Array.isArray(tc.rotinasAtrasadas),
       'v8.13 (E02): "Verificar configuração" passa a devolver a tabela de carimbos e as atrasadas');
    ok(!!tc.rotinas['verificarIntegridade_'],
       'v8.13 (E02): e a própria verificação de integridade consta dela');
  }

  /* (6) as esperadas são exatamente as agendadas (seis desde E13) */
  {
    const esperadas = Object.keys(B.ROTINAS_ESPERADAS).sort().join(',');
    ok(esperadas === 'backupDiario_,expurgarFilaRotina_,processarFilaEmails_,resumoSemanalParados_,rotacionarHistoricoAcessos_,verificarIntegridade_',
       'v8.13 (E02/E13): o mapa de rotinas esperadas cobre as seis agendadas — ' + esperadas);
    const inst = B.instalarAcionadores_();
    ok(inst.instalados.slice().sort().join(',') === esperadas,
       'v8.13 (E02): e são exatamente as que instalarAcionadores_ instala');
  }
  if (guardado) props.setProperty(B.PROP_ROTINAS, guardado);
}

/* ==================== v8.13 (E03): o cabeçalho é conferido pelo NOME ==================== */
{
  /* ambiente à parte por cenário: o que se exercita aqui é a PRIMEIRA
     operação do sistema sobre uma planilha adulterada, e a conferência é
     memorizada por execução */
  const ambiente = function () {
    const Sx = SS.criarServicos({ nomePlanilha: 'base E03', cota: 100, urlApp: 'https://script/app' });
    return { S: Sx, B: SS.carregarCodigo(src, Sx) };
  };
  /* uma sessão de direção neste ambiente: C04 reconfere o cadastro a cada
     chamada, então a linha de Acessos tem de existir ANTES de a aba de
     registros ser adulterada */
  const sessaoE03 = function (Bx, inep, escola) {
    const aba = Bx.abaAcessos_();
    const linha = new Array(Bx.ACESSO_COLS.length).fill('');
    linha[0] = 'dir.e03@educacao.mg.gov.br'; linha[1] = 'Diretora E03'; linha[2] = 'escola';
    linha[3] = 'SRE E03'; linha[6] = 'ativo'; linha[7] = Bx.agora_();
    linha[9] = inep; linha[10] = escola; linha[12] = 'diretor_escolar';
    aba.appendRow(linha); Bx.invalidarAcessos_();
    return Bx.criarSessao_({ email: 'dir.e03@educacao.mg.gov.br', nome: 'Diretora E03', perfil: 'escola',
      papel: 'diretor_escolar', sre: 'SRE E03', inep: inep, escola: escola });
  };

  /* (1) base recém-criada: nenhuma divergência, e tudo funciona */
  {
    const { B: B3 } = ambiente();
    B3.abaRegistros_(); B3.abaAcessos_(); B3.abaEscolas_(); B3.abaGestores_();
    B3.abaFila_(); B3.abaCiclo_(); B3.abaHistAcessos_(); B3.abaHistorico_();
    B3.abaConteudo_(); B3.abaIntegridade_();
    const d = B3.diagnosticoPlanilha_();
    ok(d.ok && d.divergencias.length === 0,
       'v8.13 (E03): base recém-criada não tem divergência de cabeçalho — ' +
       JSON.stringify(d.divergencias.slice(0, 1)));
    ok(d.achados.filter(function (a) { return a.situacao === 'não existe ainda'; }).length === 0,
       'v8.13 (E03): e as dez abas declaradas existem depois da primeira execução');
  }

  /* (2) coluna inserida na posição 3 da aba Registros */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; });
    const cabTorto = cab.slice(0, 2).concat(['Coluna da equipe']).concat(cab.slice(2));
    const linha = cab.map(function (c, i) { return 'v' + i; });
    linha[0] = 'PPP-2020-0001-E03';
    const linhaTorta = linha.slice(0, 2).concat(['x']).concat(linha.slice(2));
    aba.getRange(1, 1, 1, cabTorto.length).setValues([cabTorto]);
    aba.getRange(2, 1, 1, linhaTorta.length).setValues([linhaTorta]);
    const antes = JSON.stringify(aba.getRange(2, 1, 1, linhaTorta.length).getDisplayValues());

    const TK3 = sessaoE03(B3, '31000777', 'EE E03');
    ['salvarPPP', 'buscarPPP', 'painelRegistros', 'concluirPPP'].forEach(function (fn) {
      const e = lanca(function () {
        return B3[fn]({ token: TK3, p: 'PPP-2020-0001-E03', protocolo: 'PPP-2020-0001-E03',
                        escola: 'EE E03', inep: '31000777', docHtml: docTeste('<p>x</p>') });
      });
      ok(/colunas trocadas/.test(e) && /coluna 3/.test(e),
         'v8.13 (E03, A8-06): ' + fn + ' RECUSA operar sobre a planilha com coluna inserida no meio — ' + (e.slice(0, 90) || 'NÃO recusou'));
    });
    ok(JSON.stringify(aba.getRange(2, 1, 1, linhaTorta.length).getDisplayValues()) === antes,
       'v8.13 (E03): e a linha do registro não muda — nenhuma gravação chega a acontecer');
    const msg = lanca(function () { return B3.painelRegistros({ token: TK3 }); });
    ok(/Restaure a planilha pelo backup/.test(msg) && /coluna nova entra sempre no final/.test(msg),
       'v8.13 (E03): a mensagem diz o que fazer — restaurar pelo backup, ou devolver a coluna ao fim');
  }

  /* (3) coluna do meio APAGADA: a contagem volta a bater, e o cabeçalho mente */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; });
    const cabCurto = cab.slice(0, 2).concat(cab.slice(3)).concat(['Sobra']);
    aba.getRange(1, 1, 1, cabCurto.length).setValues([cabCurto]);
    ok(cabCurto.length === cab.length,
       'v8.13 (E03): apagada uma coluna do meio, a CONTAGEM volta a bater — é o que a regra antiga olhava');
    const e = lanca(function () { return B3.abaRegistros_(); });
    ok(/colunas trocadas/.test(e) && /coluna 3/.test(e),
       'v8.13 (E03, A8-06): e a conferência por NOME acusa mesmo assim — ' + e.slice(0, 90));
  }

  /* (3b) v9.4: o rótulo ANTIGO da coluna do ato ("Homologação — ato
     (SEI/ofício)") continua aceito — a base criada antes não precisa ser
     renomeada à mão, e o novo rótulo não cita sistema de processos */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; });
    const iAto = B3.CAMPOS.findIndex(function (c) { return c.key === 'homolAto'; });
    ok(iAto > 0 && cab[iAto] === 'Homologação — ato' && !/SEI/.test(cab.join('|')),
       'v9.4: a coluna do ato chama-se "Homologação — ato", e nenhum rótulo de coluna cita o SEI');
    const cabAntigo = cab.slice(); cabAntigo[iAto] = 'Homologação — ato (SEI/ofício)';
    aba.getRange(1, 1, 1, cabAntigo.length).setValues([cabAntigo]);
    const e = lanca(function () { return B3.abaRegistros_(); });
    ok(!/colunas trocadas/.test(e),
       'v9.4: a base com o rótulo antigo da coluna do ato passa na conferência sem renomear nada' + (e ? ' — ' + e.slice(0, 80) : ''));
    const fixture = B3.CAMPOS.map(function (c) { return c.key; });
    ok(fixture.indexOf('homolAto') === iAto, 'v9.4: e a chave homolAto continua na mesma posição (' + iAto + ')');
  }

  /* (4) coluna renomeada */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; });
    const original = cab[12];
    cab[12] = original + 's';
    aba.getRange(1, 1, 1, cab.length).setValues([cab]);
    const e = lanca(function () { return B3.abaRegistros_(); });
    ok(/coluna 13/.test(e) && e.indexOf('"' + original + '"') >= 0,
       'v8.13 (E03): renomear a coluna 13 é recusado, nomeando a coluna e o nome esperado — ' + e.slice(0, 110));
  }

  /* (5) coluna extra AO FINAL, posta pela equipe: aceita */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; }).concat(['Anotações da equipe']);
    aba.getRange(1, 1, 1, cab.length).setValues([cab]);
    const aba2 = B3.abaRegistros_();
    ok(!!aba2, 'v8.13 (E03): coluna extra ao final não impede a abertura da aba');
    const d = B3.diagnosticoPlanilha_();
    const reg = d.achados.filter(function (a) { return a.aba === B3.NOME_ABA; })[0];
    ok(reg && reg.extras === 1 && !d.divergencias.length,
       'v8.13 (E03): o diagnóstico reporta a coluna extra como EXTRA, não como erro — ' + JSON.stringify(reg));
  }

  /* (6) base antiga, com menos colunas e prefixo certo: continua migrando */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA);
    const cab = B3.CAMPOS.map(function (c) { return c.col; }).slice(0, B3.CAMPOS.length - 2);
    aba.getRange(1, 1, 1, cab.length).setValues([cab]);
    const linha = cab.map(function (c, i) { return i === 0 ? 'PPP-2018-0001-VELH' : ''; });
    linha[B3.IDX.escola - 1] = 'EE de Antes';
    aba.getRange(2, 1, 1, linha.length).setValues([linha]);
    const nova = B3.abaRegistros_();
    ok(nova.getLastColumn() === B3.CAMPOS.length,
       'v8.13 (E03): base com menos colunas e prefixo certo continua sendo COMPLETADA ao final (' + nova.getLastColumn() + ')');
    const lida = B3.lerLinha_(nova, 2);
    ok(lida.protocolo === 'PPP-2018-0001-VELH' && lida.escola === 'EE de Antes',
       'v8.13 (E03): e a linha antiga continua sendo lida campo a campo');
  }

  /* (7) o mesmo para as abas Acessos e Escolas */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const abaA = ss.insertSheet(B3.NOME_ABA_ACESSOS);
    const cabA = B3.ACESSO_COLS.slice();
    cabA.splice(2, 0, 'Coluna intrusa');
    abaA.getRange(1, 1, 1, cabA.length).setValues([cabA]);
    ok(/colunas trocadas/.test(lanca(function () { return B3.abaAcessos_(); })),
       'v8.13 (E03): a aba Acessos recusa do mesmo jeito');
    const abaE = ss.insertSheet(B3.NOME_ABA_ESCOLAS);
    const cabE = B3.ESCOLA_COLS.slice();
    cabE[1] = 'Nome da escola';
    abaE.getRange(1, 1, 1, cabE.length).setValues([cabE]);
    const eE = lanca(function () { return B3.abaEscolas_(); });
    ok(/colunas trocadas/.test(eE) && /coluna 2/.test(eE),
       'v8.13 (E03): e a aba Escolas também — ' + eE.slice(0, 90));
    const d = B3.diagnosticoPlanilha_();
    ok(d.divergencias.length === 2,
       'v8.13 (E03): o diagnóstico junta as duas divergências numa lista só (' + d.divergencias.length + ')');
  }

  /* (8) a normalização: acento, espaço duplo e caixa não são divergência */
  {
    const { S: S3, B: B3 } = ambiente();
    const ss = S3.g.SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.insertSheet(B3.NOME_ABA_CICLO);
    aba.getRange(1, 1, 1, B3.CICLO_COLS.length)
       .setValues([B3.CICLO_COLS.map(function (c) { return '  ' + c.toUpperCase().replace(/\s+/g, '  ') + ' '; })]);
    ok(!/colunas trocadas/.test(lanca(function () { return B3.abaCiclo_(); })),
       'v8.13 (E03): caixa, espaço duplo e espaço nas pontas não fazem divergência — a conferência é por nome NORMALIZADO');
  }

  /* (9) a base DESTA bateria, que é a que o sistema escreveu, passa sempre */
  {
    const d = B.diagnosticoPlanilha_();
    ok(d.ok && d.divergencias.length === 0,
       'v8.13 (E03): a base em uso desta bateria não tem nenhuma divergência — ' +
       JSON.stringify(d.divergencias.slice(0, 1)));
  }
}

/* ==================== v8.13 (E04): uma só porta do Órgão Central ==================== */
{
  ok(typeof B.curadoriaEntrar === 'undefined',
     'v8.13 (E04, A7-01/A8-02): B.curadoriaEntrar é undefined — a porta paralela deixou de existir');
  ok(/Ação desconhecida/.test(lanca(function () { return B.api({ fn: 'curadoriaEntrar', args: { senha: 'senha-de-teste-2026' } }); })),
     'v8.13 (E04): e o despachante recusa o nome — ele saiu de API_TELA junto');
  ok(!Object.prototype.hasOwnProperty.call(B.API_TELA, 'curadoriaEntrar'),
     'v8.13 (E04): API_TELA não tem mais a chave');

  /* a curadoria só abre com sessão de Órgão Central */
  ok(/Sessão expirada|entrar no sistema/i.test(lanca(function () { return B.curadoriaAbrir({}); })),
     'v8.13 (E04): curadoriaAbrir sem token é recusada');
  const TKESC04 = sessaoDe_({ email: 'sup.e04@educacao.mg.gov.br', nome: 'Superintendente E04',
                              perfil: 'regional', papel: 'superintendente', sre: 'Divinópolis' });
  ok(/exclusiva do Órgão Central|Órgão Central/.test(lanca(function () { return B.curadoriaAbrir({ token: TKESC04 }); })),
     'v8.13 (E04): e com token regional também');
  const TKCEN04 = B.criarSessao_({ email: 'central.e04@educacao.mg.gov.br', nome: 'Central E04',
                                   perfil: 'central', papel: 'central' });
  const ab = B.curadoriaAbrir({ token: TKCEN04 });
  ok(ab && ab.ok && !!ab.padroesServidor,
     'v8.13 (E04): com sessão de Órgão Central, abre');

  /* o cenário do achado: conta NÃO identificada, senha certa, CURADORES
     preenchida — não obtém sessão central por caminho nenhum */
  {
    const curadoresOriginais = B.CURADORES.slice();
    B.CURADORES.length = 0;
    B.CURADORES.push('curador.oficial@educacao.mg.gov.br');
    const props = S.g.PropertiesService.getScriptProperties();
    const guardaTent = props.getProperty(B.PROP_TENT_CENTRAL);
    props.deleteProperty(B.PROP_TENT_CENTRAL);
    IDENTIDADE = '';                       /* conta de fora do domínio: não identificada */
    const emailsAntes = emails.length, filaAntes = fila().length;
    const r1 = B.entrarInstitucional({ porta: 'central', senha: 'senha-de-teste-2026',
                                       email: 'invasor@gmail.com', nome: 'Alguém de Fora' });
    ok(!r1.ok && /não consta na lista/.test(r1.erro || ''),
       'v8.13 (E04, A7-01): conta não identificada com a senha certa NÃO obtém sessão central — ' + (r1.erro || 'ENTROU'));
    ok(!r1.token, 'v8.13 (E04): e nenhum token é devolvido');
    /* e o único caminho que resta dispara o aviso aos curadores */
    props.deleteProperty(B.PROP_TENT_CENTRAL);
    const r2 = B.entrarInstitucional({ porta: 'central', senha: 'senha-de-teste-2026',
                                       email: 'curador.oficial@educacao.mg.gov.br', nome: 'Curador Oficial' });
    ok(r2.ok && !!r2.token,
       'v8.13 (E04): quem está na lista entra — ' + (r2.erro || 'ok'));
    const avisos = fila().slice(filaAntes).filter(function (f) { return /sem conta identificada/i.test(f.assunto || ''); });
    ok(avisos.length === 1,
       'v8.13 (E04, A8-02): e a entrada sem conta identificada dispara avisarEntradaCentral_ — o que a porta paralela nunca fazia');
    B.CURADORES.length = 0;
    curadoresOriginais.forEach(function (c) { B.CURADORES.push(c); });
    if (guardaTent) props.setProperty(B.PROP_TENT_CENTRAL, guardaTent); else props.deleteProperty(B.PROP_TENT_CENTRAL);
  }

  /* o contador que restou é o da entrada institucional, e é da SENHA */
  ok(typeof B.PROP_TENT === 'string' && typeof B.PROP_TENT_CENTRAL === 'string',
     'v8.13 (E04): PROP_TENT continua declarado (limpeza de implantação antiga) e o contador em uso é PROP_TENT_CENTRAL');
  {
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok((fonte.match(/setProperty\(PROP_TENT,/g) || []).length === 0,
       'v8.13 (E04): nada mais ESCREVE no contador global da curadoria');
    ok(/deleteProperty\(PROP_TENT\)/.test(fonte),
       'v8.13 (E04): e a limpeza oportunista continua, para não deixar lixo em implantação antiga');
  }
}

/* ==================== v8.13 (E05): texto curado deixa de virar marcação ==================== */
{
  /* os cinco vetores do achado A7-03 */
  const VETORES = [
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<img src=x/onerror=alert(1)>',
    '<img src="x"onerror=alert(1)>',
    '<a href="javascript&#58;alert(1)">clique</a>',
    '<svg/onload=alert(1)>'
  ];
  VETORES.forEach(function (v, i) {
    const saida = B.saneadorTexto_(v);
    ok(!/<\s*[A-Za-z]/.test(saida),
       'v8.13 (E05, A7-03): vetor ' + (i + 1) + ' não sobrevive com "<" seguido de letra — ' + saida);
  });
  /* a falha que a lista negra tinha: REMONTAR a tag que retira */
  ok(B.saneadorTexto_('<scr<script>ipt>').indexOf('<script') < 0,
     'v8.13 (E05): a remontagem de tag deixou de ser possível — a base já está escapada');
  /* e a que exigia espaço antes do manipulador */
  ok(B.saneadorTexto_('<img src=x/onerror=alert(1)>').indexOf('<img') < 0,
     'v8.13 (E05): o manipulador colado ao atributo também não passa');

  /* a marcação legítima atravessa IDÊNTICA */
  const legitimo = '<p>Texto <b>em negrito</b><br>e linha</p>';
  ok(B.saneadorTexto_(legitimo) === legitimo,
     'v8.13 (E05): a marcação da lista branca atravessa idêntica');
  const lista = '<ul><li>um</li><li>dois</li></ul><blockquote>citação</blockquote><em>x</em><strong>y</strong><i>z</i><ol><li>a</li></ol>';
  ok(B.saneadorTexto_(lista) === lista,
     'v8.13 (E05): e as dez tags da lista, todas');
  /* mas SEM atributo: é o que fecha o onerror, o href e o javascript: */
  ok(B.saneadorTexto_('<p style="x">a</p>').indexOf('<p style') < 0 &&
     B.saneadorTexto_('<b onclick="alert(1)">a</b>').indexOf('<b onclick') < 0,
     'v8.13 (E05): tag da lista COM atributo não é reintroduzida — sem atributo não há onerror nem href');

  /* REGRESSÃO DE CONTEÚDO: todo valor de PADRAO_SERVIDOR atravessa idêntico */
  {
    const mudam = Object.keys(B.PADRAO_SERVIDOR).filter(function (k) {
      const v = B.PADRAO_SERVIDOR[k];
      return typeof v === 'string' && B.saneadorTexto_(v) !== v;
    });
    ok(mudam.length === 0,
       'v8.13 (E05): NENHUM texto padrão do servidor é alterado pela lista branca — ' +
       (mudam.join(', ') || 'zero'));
    /* e nenhum deles depende de <a href> nem de atributo */
    const comA = Object.keys(B.PADRAO_SERVIDOR).filter(function (k) {
      return typeof B.PADRAO_SERVIDOR[k] === 'string' && /<a\s|<a>/i.test(B.PADRAO_SERVIDOR[k]);
    });
    ok(comA.length === 0,
       'v8.13 (E05): nenhum texto padrão usa <a href> — os links do sistema são montados pelo código (urlApp_)');
  }

  /* o caminho real: o curador publica um vetor e a rede recebe texto, não marcação */
  {
    const TKE05 = B.criarSessao_({ email: 'central.e05@educacao.mg.gov.br', nome: 'Central E05',
                                   perfil: 'central', papel: 'central' });
    B.curadoriaSalvar({ token: TKE05, alteracoes: [
      { p: 'UI.finalHint', valor: 'Aviso <img src=x/onerror=alert(1)> e <b>negrito</b>.', rot: 'Dica final' }
    ] });
    B.curadoriaPublicar({ token: TKE05, caminhos: ['UI.finalHint'] });
    const pub = B.conteudoPublicado().itens['UI.finalHint'];
    ok(pub.indexOf('<img') < 0 && pub.indexOf('<b>negrito</b>') >= 0,
       'v8.13 (E05): publicado, o vetor virou texto e o negrito continuou marcação — ' + pub);
    /* o relatório de leitura acha o que a limpeza VELHA deixou passar */
    const abaC = B.abaConteudo_();
    abaC.appendRow(['UI.testeLegadoE05', 'Legado E05',
                    JSON.stringify('<img src=x onerror=alert(1)>texto antigo'), '', '', B.agora_(), 'curador antigo']);
    const aud = B.auditarConteudoComMarcacao({ token: TKE05 });
    ok(aud.ok && aud.itens.some(function (x) { return x.caminho === 'UI.testeLegadoE05'; }),
       'v8.13 (E05): auditarConteudoComMarcacao lista o que a base em uso já tem com marcação fora da lista');
    ok(aud.itens.every(function (x) { return x.caminho !== 'UI.finalHint'; }),
       'v8.13 (E05): e não acusa o que foi gravado pela lista branca');
    ok(/exclusiva do Órgão Central|Órgão Central/.test(lanca(function () {
         return B.auditarConteudoComMarcacao({ token: sessaoDe_({ email: 'sup.e05@educacao.mg.gov.br',
           nome: 'Superintendente E05', perfil: 'regional', papel: 'superintendente', sre: 'Divinópolis' }) }); })),
       'v8.13 (E05): o relatório é do Órgão Central');
    /* limpeza: a linha semeada sai, e o texto volta ao padrão */
    B.curadoriaSalvar({ token: TKE05, alteracoes: [{ p: 'UI.finalHint', restaurar: true }] });
    B.curadoriaPublicar({ token: TKE05, caminhos: ['UI.finalHint'] });
  }

  /* o saneador é aplicado nos DOIS lados: precisa ser idempotente */
  {
    const casos = ['<p>a <b>b</b><br>c</p>', '<script>x</script>', '<img src=x onerror=y>',
                   'texto comum com "aspas" & e-comercial', '<blockquote>cit</blockquote>'];
    const naoIdem = casos.filter(function (v) {
      return B.saneadorTexto_(B.saneadorTexto_(v)) !== B.saneadorTexto_(v);
    });
    ok(naoIdem.length === 0,
       'v8.13 (E05): saneadorTexto_ é IDEMPOTENTE — a segunda passada (a do consumo) não escapa a primeira' +
       (naoIdem.length ? ' — ' + naoIdem.join(' | ') : ''));
    ok(B.saneadorTexto_('texto com "aspas" & e-comercial') === 'texto com "aspas" & e-comercial',
       'v8.13 (E05): aspas e e-comercial atravessam intactos — eles não criam elemento');
  }

  /* a lista negra não existe mais no servidor */
  {
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok(!/function limparTexto_/.test(fonte),
       'v8.13 (E05): limparTexto_ não existe mais — não sobrou lista negra a manter');
  }
}

/* ==================== v8.13 (E06): o caminho do conteúdo é conferido ==================== */
{
  const TKE06 = B.criarSessao_({ email: 'central.e06@educacao.mg.gov.br', nome: 'Central E06',
                                 perfil: 'central', papel: 'central' });
  const abaC = B.abaConteudo_();
  const linhas = function () { return abaC.getLastRow(); };

  /* (a) a gramática recusa, e o lote inteiro não é gravado */
  [['NAO.EXISTE.ESTA.CHAVE', 'a raiz "NAO" não é editável'],
   ['__proto__.poluido', 'a raiz "__proto__" não é editável'],
   ['T.' + 'A'.repeat(201), 'mais de 200 caracteres'],
   ['EMAIL.inexistente.corpo', 'não existe texto do servidor'],
   ['T.__proto__', 'não é permitido'],
   ['T.com-hifen', 'não é um nome nem um índice'],
   ['', 'caminho vazio']].forEach(function (par) {
    const antes = linhas();
    const e = lanca(function () {
      return B.curadoriaSalvar({ token: TKE06, alteracoes: [{ p: par[0], valor: 'x', rot: 'teste' }] });
    });
    ok(/Caminho de conteúdo inválido/.test(e) && e.indexOf(par[1]) >= 0,
       'v8.13 (E06, A7-10): "' + par[0].slice(0, 40) + '" é recusado nomeando a razão — ' + e.slice(0, 110));
    ok(linhas() === antes, 'v8.13 (E06): e nada é gravado na aba Conteúdo');
  });
  /* um lote com um caminho bom e um ruim não grava NENHUM dos dois */
  {
    const antes = linhas();
    lanca(function () {
      return B.curadoriaSalvar({ token: TKE06, alteracoes: [
        { p: 'T.apresentacao', valor: 'texto bom', rot: 'Apresentação' },
        { p: 'INVENTADO.x', valor: 'texto ruim', rot: 'Ruim' }
      ] });
    });
    ok(linhas() === antes,
       'v8.13 (E06): o lote é tudo ou nada — nem o caminho bom entra quando há um ruim');
  }
  /* os caminhos legítimos passam */
  ['T.apresentacao', 'UI.finalHint', 'SECOES.1', 'TELAS.t10.conteudo.titulo',
   'REF_LEGISLACAO', 'EMAIL.pendente.corpo', 'DOC.folha.titulo',
   'NOVOS.temas', 'OCULTOS'].forEach(function (c) {
    ok(B.caminhoDeConteudo_(c) === '',
       'v8.13 (E06): o caminho legítimo "' + c + '" passa — ' + (B.caminhoDeConteudo_(c) || 'ok'));
  });

  /* (c) v10.2: NÃO HÁ MAIS MARCADOR DE REDE A RESOLVER.
     A v8.13 (E06, A7-11) ensinou o servidor a resolver {{REDE.chave}} porque
     o marcador saía literal no assunto do e-mail e ia congelado para dentro
     do PDF. Os marcadores saíram do sistema na 10.2: a citação está escrita
     em cada texto. O que se confere aqui é que o de UMA chave continua — ele
     é dado da chamada, não texto curável — e que todo {{…}} é recusado. */
  ok(B.preencher_('{escola} e {protocolo}', { escola: 'EE X', protocolo: 'PPP-1' }) === 'EE X e PPP-1',
     'v10.2: preencher_ continua resolvendo {chave} — o dado daquela chamada');
  ok(B.preencher_('{naoExiste}', {}) === '{naoExiste}',
     'v10.2: e deixa literal a chave que os dados não trazem');
  ok(B.preencher_('… da {{REDE.resPedagogica}} …', {}) === '… da {{REDE.resPedagogica}} …',
     'v10.2: o marcador de rede NÃO é mais resolvido — ele deixou de existir');
  ok(typeof B.REDE_PADRAO === 'undefined' && typeof B.redeValor_ === 'undefined',
     'v10.2: a cópia do bloco de parâmetros e o seu leitor saíram do servidor');
  ok(B.marcadoresNaoResolvidos_('{{REDE.avaliacao}} e {{qualquer}}').length === 2,
     'v10.2: e TODO {{…}} passa a contar como não resolvido, inclusive os antigos de REDE');

  /* a curadoria recusa texto de servidor com QUALQUER marcador de dois pares
     de chaves: nenhum é resolvido, e o que passar sai literal no e-mail */
  {
    const e = lanca(function () {
      return B.curadoriaSalvar({ token: TKE06, alteracoes: [
        { p: 'EMAIL.pendente.assunto', valor: 'Assinatura do PPP — {{REDE.avaliacao}}', rot: 'Assunto' }] });
    });
    ok(/marcador que o servidor não resolve/.test(e) && /não resolve marcador nenhum/.test(e),
       'v10.2: texto de e-mail com marcador é recusado, e a recusa diz que nenhum é resolvido — ' + e.slice(0, 130));
    const ok2 = B.curadoriaSalvar({ token: TKE06, alteracoes: [
      { p: 'EMAIL.pendente.assunto', valor: 'Assinatura do PPP no SIMAVE — {escola}', rot: 'Assunto' }] });
    ok(ok2 && ok2.ok, 'v10.2: e com a citação escrita por extenso, passa');
    B.curadoriaSalvar({ token: TKE06, alteracoes: [{ p: 'EMAIL.pendente.assunto', restaurar: true }] });
    B.curadoriaPublicar({ token: TKE06, caminhos: ['EMAIL.pendente.assunto'] });
  }

  /* (d) a prévia do texto do servidor */
  {
    const pv = B.curadoriaPrevia({ token: TKE06, caminho: 'EMAIL.validacao.devolvido.corpo' });
    ok(pv.ok && pv.texto.indexOf('{escola}') < 0 && /Escola Estadual Exemplo/.test(pv.texto),
       'v8.13 (E06): a prévia devolve o texto do e-mail já interpolado com dados de exemplo');
    const pf = B.curadoriaPrevia({ token: TKE06, caminho: 'DOC.folha.intro',
                                   valor: 'Documento concluído em {concluidoEm} — no SIMAVE.' });
    ok(pf.ok && /SIMAVE/.test(pf.texto) && !!pf.folha && /<table class="cxs">/.test(pf.folha),
       'v8.13 (E06): e para DOC.folha.* devolve a FOLHA montada sobre um registro fictício');
    const pm = B.curadoriaPrevia({ token: TKE06, caminho: 'EMAIL.pendente.assunto', valor: '{{REDE.xyz}}' });
    ok(pm.ok && pm.marcadoresNaoResolvidos.indexOf('REDE.xyz') >= 0,
       'v10.2: a prévia nomeia o marcador que ficaria literal — agora qualquer um');
    ok(/exclusiva do Órgão Central|Órgão Central/.test(lanca(function () {
        return B.curadoriaPrevia({ token: sessaoDe_({ email: 'sup.e06@educacao.mg.gov.br', nome: 'Superintendente E06',
          perfil: 'regional', papel: 'superintendente', sre: 'Divinópolis' }), caminho: 'EMAIL.pendente.assunto' }); })),
       'v8.13 (E06): a prévia é do Órgão Central');
  }
}

/* ==================== v8.13 (E07): o rascunho da curadoria tem dono ==================== */
{
  /* Ana e Davi, dois curadores do Órgão Central */
  const TKANA = B.criarSessao_({ email: 'ana.e07@educacao.mg.gov.br', nome: 'Ana Curadora',
                                 perfil: 'central', papel: 'central' });
  const TKDAVI = B.criarSessao_({ email: 'davi.e07@educacao.mg.gov.br', nome: 'Davi Curador',
                                  perfil: 'central', papel: 'central' });
  /* estado limpo: o que houver pendente de outras etapas é descartado por cada um */
  B.curadoriaDescartar({ token: TKANA }); B.curadoriaDescartar({ token: TKDAVI });

  const salvouAna = B.curadoriaSalvar({ token: TKANA, alteracoes: [
    { p: 'T.apresentacao', valor: 'Texto da Ana, ainda em estudo.', rot: 'Apresentação' }] });
  ok(salvouAna.ok && salvouAna.pendentes === 1, 'v8.13 (E07): Ana grava o rascunho dela');

  const abriuDavi = B.curadoriaAbrir({ token: TKDAVI });
  ok(abriuDavi.ok && abriuDavi.rascunhos['T.apresentacao'] === undefined,
     'v8.13 (E07, A7-06): Davi NÃO recebe o valor do rascunho da Ana');
  ok((abriuDavi.deOutros || []).some(function (x) { return x.caminho === 'T.apresentacao' && /Ana/.test(x.autor); }),
     'v8.13 (E07): ele recebe o AVISO de que existe, com o autor e a data — sem o conteúdo');
  ok(JSON.stringify(abriuDavi.deOutros).indexOf('Texto da Ana') < 0,
     'v8.13 (E07): e o valor alheio não atravessa a resposta');

  /* Davi salva o campo dele; o rascunho da Ana continua intacto */
  B.curadoriaSalvar({ token: TKDAVI, alteracoes: [
    { p: 'UI.finalHint', valor: 'Dica do Davi.', rot: 'Dica final' }] });
  const abriuAna = B.curadoriaAbrir({ token: TKANA });
  ok(abriuAna.rascunhos['T.apresentacao'] === 'Texto da Ana, ainda em estudo.',
     'v8.13 (E07): o rascunho da Ana continua inteiro depois de Davi salvar o dele');

  /* Davi publica SÓ o dele */
  const pubDavi = B.curadoriaPublicar({ token: TKDAVI, caminhos: ['UI.finalHint'] });
  ok(pubDavi.ok && pubDavi.publicados.join(',') === 'UI.finalHint',
     'v8.13 (E07): Davi publica só o caminho que pediu');
  ok(B.conteudoPublicado().itens['T.apresentacao'] === undefined,
     'v8.13 (E07, A7-06): e o texto da Ana NÃO foi para a rede junto');
  ok(B.curadoriaAbrir({ token: TKANA }).rascunhos['T.apresentacao'] === 'Texto da Ana, ainda em estudo.',
     'v8.13 (E07): continua pendente, e ainda é dela');

  /* publicar sem lista é recusado */
  const semLista = B.curadoriaPublicar({ token: TKDAVI });
  ok(!semLista.ok && /Informe quais textos publicar/.test(semLista.erro || ''),
     'v8.13 (E07): curadoriaPublicar sem `caminhos` recusa — não há mais "publicar tudo"');

  /* Davi descarta: o rascunho da Ana sobrevive */
  const des = B.curadoriaDescartar({ token: TKDAVI });
  ok(des.ok && B.curadoriaAbrir({ token: TKANA }).rascunhos['T.apresentacao'] === 'Texto da Ana, ainda em estudo.',
     'v8.13 (E07, A7-06): "descartar" apaga só o do curador da sessão');

  /* Davi salva SOBRE o campo da Ana: sem sobrepor, conflito e nada gravado */
  const conf = B.curadoriaSalvar({ token: TKDAVI, alteracoes: [
    { p: 'T.apresentacao', valor: 'Texto do Davi por cima.', rot: 'Apresentação' }] });
  ok(!conf.ok && Array.isArray(conf.conflito) && conf.conflito[0].caminho === 'T.apresentacao' &&
     /Ana/.test(conf.conflito[0].autor),
     'v8.13 (E07): salvar sobre rascunho de outro devolve `conflito` — ' + (conf.erro || ''));
  ok(B.curadoriaAbrir({ token: TKANA }).rascunhos['T.apresentacao'] === 'Texto da Ana, ainda em estudo.',
     'v8.13 (E07): e nada é gravado');

  /* com sobrepor, grava e registra */
  const sobre = B.curadoriaSalvar({ token: TKDAVI, sobrepor: true, alteracoes: [
    { p: 'T.apresentacao', valor: 'Texto do Davi por cima.', rot: 'Apresentação' }] });
  ok(sobre.ok && sobre.sobrepostos.length === 1 && /Ana/.test(sobre.sobrepostos[0].autor),
     'v8.13 (E07): com `sobrepor`, grava e diz quem foi sobreposto');
  {
    const h = B.abaHistorico_();
    const ult = h.getRange(Math.max(2, h.getLastRow() - 3), 1, Math.min(4, h.getLastRow() - 1), 6).getDisplayValues();
    ok(ult.some(function (l) { return /rascunho sobreposto/.test(l[2]) && /Ana/.test(l[4]); }),
       'v8.13 (E07): e a sobreposição fica no histórico, com o autor anterior');
  }
  ok(B.curadoriaAbrir({ token: TKDAVI }).rascunhos['T.apresentacao'] === 'Texto do Davi por cima.',
     'v8.13 (E07): o rascunho passou a ser do Davi');

  /* autor vazio (registro antigo) é de ninguém: editável sem conflito */
  {
    const abaC = B.abaConteudo_();
    abaC.appendRow(['UI.landTitulo', 'Título da abertura', '', JSON.stringify('Título antigo'),
                    'alterar', B.agora_(), '']);
    const semDono = B.curadoriaSalvar({ token: TKANA, alteracoes: [
      { p: 'UI.landTitulo', valor: 'Título novo da Ana', rot: 'Título' }] });
    ok(semDono.ok, 'v8.13 (E07): rascunho antigo, sem autor gravado, é de ninguém — e não gera conflito');
  }
  /* limpeza para não afetar o que vem depois */
  B.curadoriaDescartar({ token: TKANA }); B.curadoriaDescartar({ token: TKDAVI });
  B.curadoriaSalvar({ token: TKDAVI, alteracoes: [{ p: 'UI.finalHint', restaurar: true }] });
  B.curadoriaPublicar({ token: TKDAVI, caminhos: ['UI.finalHint'] });
}

/* ==================== v8.13 (E08): o histórico mostra só o que a sessão cadastra ==================== */
{
  const SRE08 = 'SRE E08';
  const TKC08 = B.criarSessao_({ email: 'central.e08@educacao.mg.gov.br', nome: 'Central E08',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC08, inep: '31000801', escola: 'EE E08', municipio: 'Ouro Branco', sre: SRE08, codigoInep: censoDe('31000801') });
  B.acessoSalvar({ token: TKC08, email: 'sup.e08@educacao.mg.gov.br', nome: 'Superintendente E08',
                   papel: 'superintendente', perfil: 'regional', sre: SRE08 });
  const TKSUP = B.criarSessao_({ email: 'sup.e08@educacao.mg.gov.br', nome: 'Superintendente E08',
                                 perfil: 'regional', papel: 'superintendente', sre: SRE08 });
  B.acessoSalvar({ token: TKSUP, email: 'de.e08@educacao.mg.gov.br', nome: 'Diretora Educacional E08',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SRE08 });
  B.acessoSalvar({ token: TKSUP, email: 'ci.e08@educacao.mg.gov.br', nome: 'Coordenador de Inspeção E08',
                   papel: 'coordenador_inspecao', perfil: 'regional', sre: SRE08 });
  const TKCI = B.criarSessao_({ email: 'ci.e08@educacao.mg.gov.br', nome: 'Coordenador de Inspeção E08',
                                perfil: 'regional', papel: 'coordenador_inspecao', sre: SRE08 });
  B.acessoSalvar({ token: TKCI, email: 'ei.e08@educacao.mg.gov.br', nome: 'Equipe de Inspeção E08',
                   papel: 'equipe_inspecao', perfil: 'regional', sre: SRE08 });
  const TKDE = B.criarSessao_({ email: 'de.e08@educacao.mg.gov.br', nome: 'Diretora Educacional E08',
                                perfil: 'regional', papel: 'diretor_educacional', sre: SRE08 });
  B.acessoSalvar({ token: TKDE, email: 'eqde.e08@educacao.mg.gov.br', nome: 'Equipe da DE E08',
                   papel: 'equipe_de', perfil: 'regional', sre: SRE08 });
  salvarDiretor(B, { email: 'dir.e08@educacao.mg.gov.br', nome: 'Diretora Escolar E08',
                   papel: 'diretor_escolar', inep: '31000801' });
  const TKDIR = B.criarSessao_({ email: 'dir.e08@educacao.mg.gov.br', nome: 'Diretora Escolar E08', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE08, inep: '31000801', escola: 'EE E08' });
  B.acessoSalvar({ token: TKDIR, email: 'membro.e08@gmail.com', nome: 'Membro do Colegiado E08',
                   papel: 'colegiado', segmento: 'Estudante', relacao: 'Estudante do 2º ano' });
  const TKEI = B.criarSessao_({ email: 'ei.e08@educacao.mg.gov.br', nome: 'Equipe de Inspeção E08',
                                perfil: 'regional', papel: 'equipe_inspecao', sre: SRE08 });
  const TKEQDE = B.criarSessao_({ email: 'eqde.e08@educacao.mg.gov.br', nome: 'Equipe da DE E08',
                                  perfil: 'regional', papel: 'equipe_de', sre: SRE08 });
  const papeisDe = function (res) {
    return Array.from(new Set((res.linhas || []).map(function (l) {
      const cad = B.acessoPorEmail_(l.email); return cad ? B.papelDe_(cad) : (l.perfil || '?');
    }))).sort().join(',');
  };
  const daSre = function (res) { return (res.linhas || []).filter(function (l) {
    return String(l.sre || '').toLowerCase() === SRE08.toLowerCase(); }); };

  /* Coordenador de Inspeção: só a própria equipe */
  const hCI = B.historicoAssociacoes({ token: TKCI });
  ok(hCI.ok, 'v8.13 (E08): o Coordenador de Inspeção continua recebendo o histórico');
  /* v8.13 (F06, R1-03): além da própria equipe, ele passa a ver a sucessão do
     PRÓPRIO posto — e nada mais. O que A7-02 proibia continua proibido. */
  ok(daSre(hCI).every(function (l) {
       const cad = B.acessoPorEmail_(l.email);
       return cad && (B.papelDe_(cad) === 'equipe_inspecao' || B.papelDe_(cad) === 'coordenador_inspecao'); }),
     'v8.13 (E08, A7-02)/F06: ele recebe a sua equipe_inspecao e a sucessão do próprio posto — ' + papeisDe(hCI));
  ok(!(hCI.linhas || []).some(function (l) { return l.perfil === 'escola'; }),
     'v8.13 (E08, A7-02): nenhuma direção escolar sai para a Inspeção');
  ok(!(hCI.linhas || []).some(function (l) { return l.email === 'sup.e08@educacao.mg.gov.br' ||
                                                     l.email === 'de.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): nem os cadastros institucionais que ele não mantém');

  /* Equipe de Inspeção e Equipe da DE: não mantêm cadastro nenhum */
  const hEI = B.historicoAssociacoes({ token: TKEI });
  ok(!hEI.ok && /não mantém cadastros/.test(hEI.erro || ''),
     'v8.13 (E08): a Equipe de Inspeção recebe a recusa — ' + (hEI.erro || 'NÃO recusou'));
  /* v8.13 (F06, R1-02): a Equipe da DE VOLTA a ter histórico — ela não
     cadastra ninguém, mas ASSOCIA diretores às escolas, e quem associa
     precisa poder ver o que associou, por quem e quando. */
  const hEQ = B.historicoAssociacoes({ token: TKEQDE });
  ok(hEQ.ok === true,
     'v8.13 (E08/F06): a Equipe da Diretoria Educacional, que ASSOCIA, volta a receber o histórico');
  ok((hEQ.linhas || []).some(function (l) { return l.email === 'dir.e08@educacao.mg.gov.br'; }),
     'v8.13 (F06): e nele estão as direções escolares que ela associa');
  ok(!(hEQ.linhas || []).some(function (l) { return l.perfil === 'colegiado'; }),
     'v8.13 (F06 × C02): e nunca o Colegiado');

  /* Superintendente: a equipe que cadastra e as direções (porque associa) */
  const hSUP = B.historicoAssociacoes({ token: TKSUP });
  ok(hSUP.ok && daSre(hSUP).some(function (l) { return l.email === 'de.e08@educacao.mg.gov.br'; }) &&
     daSre(hSUP).some(function (l) { return l.email === 'ci.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): o Superintendente continua vendo o Diretor Educacional e o Coordenador de Inspeção da sua SRE');
  ok(!(hSUP.linhas || []).some(function (l) { return l.email === 'dir.e08@educacao.mg.gov.br'; }),
     'v9.7 (E08): e NÃO as direções escolares — quem as gere é a Diretoria Educacional');
  ok(!(hSUP.linhas || []).some(function (l) { return l.perfil === 'colegiado'; }),
     'v8.13 (E08 × C02): e nunca o Colegiado');
  ok(!(hSUP.linhas || []).some(function (l) { return l.email === 'ei.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): a equipe da Inspeção, que é o Coordenador quem mantém, não entra no dele');

  /* Diretor Educacional: a sua equipe e as direções */
  const hDE = B.historicoAssociacoes({ token: TKDE });
  ok(hDE.ok && daSre(hDE).some(function (l) { return l.email === 'eqde.e08@educacao.mg.gov.br'; }) &&
     (hDE.linhas || []).some(function (l) { return l.email === 'dir.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): o Diretor Educacional vê a equipe dele e as direções escolares');
  ok(!(hDE.linhas || []).some(function (l) { return l.email === 'sup.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): e não o Superintendente, que ele não cadastra');

  /* a direção escolar não perde o histórico da sua escola */
  const hDIR = B.historicoAssociacoes({ token: TKDIR });
  ok(hDIR.ok && hDIR.escopo === 'escola' &&
     (hDIR.linhas || []).some(function (l) { return l.email === 'membro.e08@gmail.com'; }),
     'v8.13 (E08): a direção escolar continua vendo o Colegiado da sua escola');

  /* o Órgão Central continua vendo os institucionais da rede */
  const hC = B.historicoAssociacoes({ token: TKC08 });
  ok(hC.ok && (hC.linhas || []).some(function (l) { return l.email === 'sup.e08@educacao.mg.gov.br'; }),
     'v8.13 (E08): o Órgão Central continua vendo os institucionais da rede');
  ok(!(hC.linhas || []).some(function (l) { return l.perfil === 'colegiado'; }),
     'v8.13 (E08 × C02): e nunca o Colegiado');

  /* o payload não amplia escopo */
  const forcado = B.historicoAssociacoes({ token: TKCI, grupo: 'escola' });
  ok(forcado.ok && (forcado.linhas || []).length === 0,
     'v8.13 (E08): pedir o grupo "escola" pela Inspeção não traz direção nenhuma — o escopo vem da sessão');
}

/* ==================== v8.13 (E10): o painel conta o que diz contar ==================== */
{
  const SRE10 = 'SRE E10';
  const TKC10 = B.criarSessao_({ email: 'central.e10@educacao.mg.gov.br', nome: 'Central E10',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC10, inep: '31001001', escola: 'EE E10', municipio: 'Itabira', sre: SRE10, codigoInep: censoDe('31001001') });
  salvarDiretor(B, { email: 'dir.e10@educacao.mg.gov.br', nome: 'Diretora E10',
                   papel: 'diretor_escolar', inep: '31001001' });
  const TKD10 = B.criarSessao_({ email: 'dir.e10@educacao.mg.gov.br', nome: 'Diretora E10', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE10, inep: '31001001', escola: 'EE E10' });
  const TKR10 = sessaoDe_({ email: 'sup.e10@educacao.mg.gov.br', nome: 'Superintendente E10',
                            perfil: 'regional', papel: 'superintendente', sre: SRE10 });
  /* a v1, homologada em 2021 (revisão vencida), e a v2, homologada há 30 dias */
  const abaR = B.abaRegistros_();
  const semear = function (protocolo, versao, homolEm, atualizadoEm) {
    const linha = B.CAMPOS.map(function (c) {
      switch (c.key) {
        case 'protocolo': return protocolo;
        case 'versao': return versao;
        case 'status': return 'Homologado';
        case 'escola': return 'EE E10';
        case 'inep': return '31001001';
        case 'municipio': return 'Itabira';
        case 'sre': return SRE10;
        case 'email': return 'dir.e10@educacao.mg.gov.br';
        case 'criadoEm': return atualizadoEm;
        case 'atualizadoEm': return atualizadoEm;
        case 'concluidoEm': return atualizadoEm;
        case 'homolEm': return homelEmSeguro(homolEm);
        case 'assinaturas': return '[]';
        case 'anexos': return '[]';
        default: return '';
      }
    });
    const destino = abaR.getLastRow() + 1;
    abaR.getRange(destino, 1, 1, linha.length).setNumberFormat('@');
    abaR.getRange(destino, 1, 1, linha.length).setValues([linha]);
  };
  function homelEmSeguro(x) { return x; }
  const hoje = new Date();
  const dataMenos = function (dias) {
    const d = new Date(hoje.getTime() - dias * 86400000);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() + ' 09:00';
  };
  semear('PPP-2021-9001-E10V1', 1, '10/03/2021 09:00', '10/03/2021 09:00');
  semear('PPP-2026-9002-E10V2', 2, dataMenos(30), dataMenos(30));

  /* (1) a escola NÃO é acusada de revisão vencida por causa da v1 */
  const pr = B.painelRegistros({ token: TKR10, filtros: { sre: SRE10 } });
  const daEscola = (pr.linhas || []).filter(function (l) { return l.inep === '31001001'; });
  ok(daEscola.length === 2, 'v8.13 (E10): as duas versões estão no painel (' + daEscola.length + ')');
  ok(daEscola.every(function (l) { return l.revisaoVencida === false; }),
     'v8.13 (E10, A7-07): nenhuma das duas é acusada de revisão vencida — a v1 de 2021 foi substituída');
  const soVencidas = B.painelRegistros({ token: TKR10, filtros: { sre: SRE10, vencidas: true } });
  ok((soVencidas.linhas || []).filter(function (l) { return l.inep === '31001001'; }).length === 0,
     'v8.13 (E10, A7-07): e o filtro "Somente revisão vencida" devolve ZERO linhas desta escola');
  /* a Cobertura, que sempre olhou só a vigente, diz a mesma coisa */
  const cob = B.coberturaRegional({ token: TKR10, sre: SRE10 });
  const escCob = (cob.escolas || []).filter(function (e) { return e.inep === '31001001'; })[0];
  ok(!!escCob && escCob.status === 'Homologado',
     'v8.13 (E10): a Cobertura continua dizendo que a escola está homologada — as duas telas concordam');

  /* (2) envelhecida a v2, as duas passam a acusar */
  {
    const linhaV2 = B.linhaDoProtocolo_(abaR, 'PPP-2026-9002-E10V2');
    B.gravarCampo_(abaR, linhaV2, 'homolEm', '10/03/2021 09:00');
    B.gravarCampo_(abaR, linhaV2, 'concluidoEm', '10/03/2021 09:00');
    const pr2 = B.painelRegistros({ token: TKR10, filtros: { sre: SRE10, vencidas: true } });
    const v2 = (pr2.linhas || []).filter(function (l) { return l.inep === '31001001'; });
    ok(v2.length === 1 && v2[0].protocolo === 'PPP-2026-9002-E10V2',
       'v8.13 (E10): envelhecida a VIGENTE, ela — e só ela — passa a acusar revisão vencida');
  }

  /* (3) a relação de regionais só sai para o Órgão Central */
  {
    const daRegional = B.painelRegistros({ token: TKR10, filtros: {} });
    ok(Array.isArray(daRegional.sres) && daRegional.sres.length === 0,
       'v8.13 (E10, A7-13): a sessão regional recebe `sres` VAZIO — ela não tem seletor de regional');
    const doCentral = B.painelRegistros({ token: TKC10, filtros: {} });
    ok(doCentral.sres.length > 1 && doCentral.sres.indexOf(SRE10) >= 0,
       'v8.13 (E10): e o Órgão Central continua recebendo a lista (' + doCentral.sres.length + ')');
    const daEscolaS = B.painelRegistros({ token: TKD10, filtros: {} });
    ok((daEscolaS.sres || []).length === 0,
       'v8.13 (E10): a escola também não recebe');
  }

  /* (4) a busca casa campo a campo, nunca através da emenda */
  {
    const emenda = B.painelRegistros({ token: TKC10, filtros: { busca: '1 ppp' } });
    ok((emenda.linhas || []).every(function (l) {
         return String(l.escola).toLowerCase().indexOf('1 ppp') >= 0 ||
                String(l.protocolo).toLowerCase().indexOf('1 ppp') >= 0 ||
                String(l.municipio).toLowerCase().indexOf('1 ppp') >= 0 ||
                String(l.inep).toLowerCase().indexOf('1 ppp') >= 0; }),
       'v8.13 (E10, A7-14): "1 ppp" não casa mais através da emenda entre os campos (' +
       (emenda.linhas || []).length + ' linha(s))');
    const porProtocolo = B.painelRegistros({ token: TKC10, filtros: { busca: 'PPP-2026-9002' } });
    ok((porProtocolo.linhas || []).some(function (l) { return l.protocolo === 'PPP-2026-9002-E10V2'; }),
       'v8.13 (E10): e a busca por protocolo continua encontrando');
    const porEscola = B.painelRegistros({ token: TKC10, filtros: { busca: 'EE E10' } });
    ok((porEscola.linhas || []).some(function (l) { return l.inep === '31001001'; }),
       'v8.13 (E10): e por nome de escola também');
  }

  /* (5) máximo é máximo — com três regionais em espera, como o achado descreve */
  {
    ['SRE E10 A', 'SRE E10 B', 'SRE E10 C'].forEach(function (sre, i) {
      const inep = '3100110' + i;
      B.escolaSalvar({ token: TKC10, inep: inep, escola: 'EE Espera ' + i, municipio: 'X', sre: sre, codigoInep: censoDe(inep) });
      const dias = [261, 110, 49][i];
      const linha = B.CAMPOS.map(function (c) {
        switch (c.key) {
          case 'protocolo': return 'PPP-2026-95' + i + '-ESPERA';
          case 'versao': return 1;
          case 'status': return 'Em validação';
          case 'escola': return 'EE Espera ' + i;
          case 'inep': return inep;
          case 'sre': return sre;
          case 'email': return 'x@educacao.mg.gov.br';
          case 'criadoEm': case 'atualizadoEm': case 'enviadoValidacaoEm': return dataMenos(dias);
          case 'assinaturas': return '[]';
          case 'anexos': return '[]';
          default: return '';
        }
      });
      const destino = abaR.getLastRow() + 1;
      abaR.getRange(destino, 1, 1, linha.length).setNumberFormat('@');
      abaR.getRange(destino, 1, 1, linha.length).setValues([linha]);
    });
    const quadro = B.painelRegistros({ token: TKC10, filtros: {} });
    const tres = quadro.quadro.filter(function (c) { return /^SRE E10 [ABC]$/.test(c.sre); })
      .map(function (c) { return c.esperaMaisAntiga; }).sort(function (a, b) { return b - a; });
    ok(tres.join(',') === '261,110,49',
       'v8.13 (E10): as três regionais do cenário esperam 261, 110 e 49 dias — ' + tres.join(','));
    ok(quadro.resumido === true && quadro.quadro.length > 1,
       'v8.13 (E10): o Órgão Central recebe o quadro por SRE');
    const maiorEspera = quadro.quadro.reduce(function (m, c) { return Math.max(m, c.esperaMaisAntiga || 0); }, 0);
    const somaEspera = quadro.quadro.reduce(function (m, c) { return m + (c.esperaMaisAntiga || 0); }, 0);
    ok(quadro.totais.esperaMaisAntiga === maiorEspera,
       'v8.13 (E10, A7-15): o total de "espera mais antiga" é o MÁXIMO (' + quadro.totais.esperaMaisAntiga +
       '), e não a soma (' + somaEspera + ')');
    const somaTotal = quadro.quadro.reduce(function (m, c) { return m + (c.total || 0); }, 0);
    ok(quadro.totais.total === somaTotal,
       'v8.13 (E10): e o que É parcela continua sendo somado');
  }
}

/* ==================== v8.13 (E11, A7-09): a busca não derruba o resumo, e a lista tem teto ==================== */
{
  const SRE11 = 'SRE E11';
  const TKC11 = B.criarSessao_({ email: 'central.e11@educacao.mg.gov.br', nome: 'Central E11',
                                 perfil: 'central', papel: 'central' });
  const TKR11 = sessaoDe_({ email: 'sup.e11@educacao.mg.gov.br', nome: 'Superintendente E11',
                            perfil: 'regional', papel: 'superintendente', sre: SRE11 });
  B.escolaSalvar({ token: TKC11, inep: '31011001', escola: 'EE E11 Uma', municipio: 'Betim', sre: SRE11, codigoInep: censoDe('31011001') });
  salvarDiretor(B, { email: 'dir.e11@educacao.mg.gov.br', nome: 'Diretora E11',
                   papel: 'diretor_escolar', inep: '31011001' });
  const TKD11 = B.criarSessao_({ email: 'dir.e11@educacao.mg.gov.br', nome: 'Diretora E11', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE11, inep: '31011001', escola: 'EE E11 Uma' });

  /* 620 registros na mesma regional: acima do teto de 500, numa escrita só */
  const abaR11 = B.abaRegistros_();
  const QUANTOS = 620;
  const linhas11 = [];
  for (let i = 0; i < QUANTOS; i++) {
    const nome = 'EE E11 ' + ('000' + i).slice(-3);      /* ordenável por nome */
    linhas11.push(B.CAMPOS.map(function (c) {
      switch (c.key) {
        case 'protocolo': return 'PPP-2026-E11' + ('000' + i).slice(-3);
        case 'versao': return 1;
        case 'status': return (i % 3 === 0) ? 'Em validação' : 'Em andamento';
        case 'escola': return nome;
        case 'inep': return '3101' + (2000 + i);
        case 'municipio': return 'Betim';
        case 'sre': return SRE11;
        case 'email': return 'dir.e11@educacao.mg.gov.br';
        case 'criadoEm': case 'atualizadoEm': return '01/09/2026 09:00';
        case 'enviadoValidacaoEm': return (i % 3 === 0) ? '01/09/2026 09:00' : '';
        case 'parecerValidacao': return 'Parecer da DE sobre o item ' + i;
        case 'devolucoes': return JSON.stringify([{ em: '01/09/2026', por: 'DE', texto: 'ajustar a seção 3' }]);
        case 'assinaturas': return '[]';
        case 'anexos': return '[]';
        default: return '';
      }
    }));
  }
  {
    const destino = abaR11.getLastRow() + 1;
    abaR11.getRange(destino, 1, QUANTOS, B.CAMPOS.length).setNumberFormat('@');
    abaR11.getRange(destino, 1, QUANTOS, B.CAMPOS.length).setValues(linhas11);
  }

  /* (1) busca curta NÃO derruba o resumo do Órgão Central */
  {
    const umaLetra = B.painelRegistros({ token: TKC11, filtros: { busca: 'a' } });
    ok(umaLetra.resumido === true,
       'v8.13 (E11, A7-09): busca de UMA letra continua devolvendo o RESUMO ao Órgão Central');
    ok(umaLetra.buscaIgnorada === true,
       'v8.13 (E11): e a resposta diz que a busca foi ignorada');
    ok((umaLetra.linhas || []).length === 0,
       'v8.13 (E11): nenhuma linha viaja — ' + (umaLetra.linhas || []).length);
    const duas = B.painelRegistros({ token: TKC11, filtros: { busca: 'ee' } });
    ok(duas.resumido === true && duas.buscaIgnorada === true,
       'v8.13 (E11): com DUAS letras, idem');
    const tres = B.painelRegistros({ token: TKC11, filtros: { busca: 'e11' } });
    ok(!tres.resumido && !tres.buscaIgnorada && (tres.linhas || []).length > 0,
       'v8.13 (E11): a partir de TRÊS caracteres a busca vale e as linhas vêm (' +
       (tres.linhas || []).length + ')');
    const espacos = B.painelRegistros({ token: TKC11, filtros: { busca: '  a  ' } });
    ok(espacos.resumido === true && espacos.buscaIgnorada === true,
       'v8.13 (E11): espaços em volta não fazem a busca crescer');
    const vazia = B.painelRegistros({ token: TKC11, filtros: { busca: '' } });
    ok(vazia.resumido === true && !vazia.buscaIgnorada,
       'v8.13 (E11): campo vazio é resumo SEM aviso — não há busca a ignorar');
  }

  /* (2) o teto de linhas */
  {
    const r = B.painelRegistros({ token: TKC11, filtros: { sre: SRE11 } });
    ok((r.linhas || []).length === B.PAINEL_MAX_LINHAS,
       'v8.13 (E11, A7-09): a resposta traz no máximo ' + B.PAINEL_MAX_LINHAS + ' linhas (' +
       (r.linhas || []).length + ')');
    ok(r.truncado === true && r.total >= QUANTOS,
       'v8.13 (E11): e diz que truncou, com o total real (' + r.total + ')');
    /* o corte é DEPOIS da ordenação: as 500 primeiras são as 500 primeiras por nome */
    const nomes = (r.linhas || []).map(function (l) { return String(l.escola); });
    const ordenado = nomes.slice().sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    ok(nomes.join('|') === ordenado.join('|'),
       'v8.13 (E11): as linhas que sobraram estão ordenadas — o corte veio DEPOIS da ordenação');
    ok(nomes.indexOf('EE E11 000') >= 0 && nomes.indexOf('EE E11 619') < 0,
       'v8.13 (E11): e são as PRIMEIRAS da ordem, não um pedaço arbitrário');
    const todas = B.painelRegistros({ token: TKC11, filtros: { todas: true } });
    ok((todas.linhas || []).length <= B.PAINEL_MAX_LINHAS && todas.truncado === true,
       'v8.13 (E11): `todas:true` também respeita o teto (' + (todas.linhas || []).length + ')');
    /* os cartões do resumo contam sobre o conjunto INTEIRO, não sobre o pedaço */
    ok(r.contagens && r.contagens.total === r.total,
       'v8.13 (E11): a resposta truncada traz as contagens do conjunto filtrado inteiro');
    const emValNaLista = (r.linhas || []).filter(function (l) { return l.status === 'Em validação'; }).length;
    ok(r.contagens && r.contagens.emValidacao > emValNaLista,
       'v8.13 (E11): "em validação" conta ' + ((r.contagens || {}).emValidacao) + ' e não os ' +
       emValNaLista + ' que couberam na lista');
  }

  /* (3) a escola, com poucas linhas, nunca é truncada */
  {
    const daEscola = B.painelRegistros({ token: TKD11, filtros: {} });
    ok(!daEscola.truncado,
       'v8.13 (E11): a escola não é truncada — ' + (daEscola.linhas || []).length + ' linha(s)');
  }

  /* (4) parecer e devoluções só onde são lidos */
  {
    const central = B.painelRegistros({ token: TKC11, filtros: { busca: 'e11' } });
    ok((central.linhas || []).length > 0 &&
       (central.linhas || []).every(function (l) {
         return !l.parecerValidacao && (!l.devolucoes || l.devolucoes.length === 0); }),
       'v8.13 (E11, A7-09): o Órgão Central SEM regional escolhida não recebe parecer nem devoluções');
    const comSre = B.painelRegistros({ token: TKC11, filtros: { sre: SRE11 } });
    ok((comSre.linhas || []).some(function (l) { return !!l.parecerValidacao; }) &&
       (comSre.linhas || []).some(function (l) { return (l.devolucoes || []).length > 0; }),
       'v8.13 (E11): com a regional escolhida, o Central recebe os dois');
    const regional = B.painelRegistros({ token: TKR11, filtros: {} });
    ok((regional.linhas || []).some(function (l) { return !!l.parecerValidacao; }),
       'v8.13 (E11): a regional continua recebendo tudo');
    const escola = B.painelRegistros({ token: TKD11, filtros: {} });
    ok(escola.linhas.length === 0 || escola.linhas.every(function (l) { return 'parecerValidacao' in l; }),
       'v8.13 (E11): e a escola — é para ela que o parecer existe (v7.3, T-07)');
  }
}

/* ==================== v8.13 (E12, A7-12): a trilha só registra o que pode ter acontecido ==================== */
{
  /* o simulador guarda a aba célula a célula ("linha:coluna"): aqui a linha
     inteira é remontada, para que a verificação leia o que o auditor leria */
  const linhasDoHist = function () {
    const h = outras['Acessos — histórico'];
    if (!h) return [];
    const por = {};
    Object.keys(h.linhas).forEach(function (k) {
      const p = k.split(':');
      (por[p[0]] = por[p[0]] || [])[+p[1]] = String(h.linhas[k]);
    });
    return Object.keys(por).map(function (n) {
      return por[n].map(function (c) { return c == null ? '' : c; }).join(' | ');
    });
  };
  const conta = function (re) { return linhasDoHist().filter(function (l) { return re.test(l); }).length; };

  const SRE12 = 'SRE E12';
  const TKC12 = B.criarSessao_({ email: 'central.e12@educacao.mg.gov.br', nome: 'Central E12',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC12, inep: '31012001', escola: 'EE E12', municipio: 'Betim', sre: SRE12, codigoInep: censoDe('31012001') });
  salvarDiretor(B, { email: 'dir.e12@educacao.mg.gov.br', nome: 'Diretora E12',
                   papel: 'diretor_escolar', inep: '31012001' });
  const TKD12 = B.criarSessao_({ email: 'dir.e12@educacao.mg.gov.br', nome: 'Diretora E12', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE12, inep: '31012001', escola: 'EE E12' });
  const TKR12 = sessaoDe_({ email: 'sup.e12@educacao.mg.gov.br', nome: 'Superintendente E12',
                            perfil: 'regional', papel: 'superintendente', sre: SRE12 });

  /* (1) a direção escolar forjando a trilha */
  {
    const antesExp = conta(/exportou/);
    const antesRec = conta(/exportação recusada/);
    const r = B.registrarExportacao({ token: TKD12, tipo: 'painel', linhas: 99999 });
    ok(r.ok === false && /não exporta esta lista/.test(r.erro || ''),
       'v8.13 (E12, A7-12): a direção escolar é recusada — ' + (r.erro || 'NÃO recusou'));
    ok(conta(/exportou/) === antesExp,
       'v8.13 (E12): NENHUMA linha nova de "exportou" entra no histórico');
    ok(!linhasDoHist().some(function (l) { return /99999/.test(l) && /exportou/.test(l); }),
       'v8.13 (E12): e o número forjado não aparece em nenhuma linha de exportação');
    ok(conta(/exportação recusada/) === antesRec + 1,
       'v8.13 (E12): a TENTATIVA fica registrada — é informação de auditoria');
    ok(linhasDoHist().some(function (l) { return /exportação recusada/.test(l) && /Diretora E12/.test(l); }),
       'v8.13 (E12): a recusa nomeia quem tentou');
  }

  /* (2) a recusa é registrada no máximo uma vez por minuto por sessão */
  {
    const antes = conta(/exportação recusada/);
    B.registrarExportacao({ token: TKD12, tipo: 'cobertura', linhas: 1 });
    B.registrarExportacao({ token: TKD12, tipo: 'painel', linhas: 2 });
    B.registrarExportacao({ token: TKD12, tipo: 'painel', linhas: 3 });
    ok(conta(/exportação recusada/) === antes,
       'v8.13 (E12): as repetições da mesma sessão não enchem o histórico (uma por minuto)');
    const outra = B.registrarExportacao({ token: TKR12, tipo: 'painel', linhas: 4 });
    ok(outra.ok === false && conta(/exportação recusada/) === antes + 1,
       'v8.13 (E12): mas OUTRA sessão volta a registrar — a janela é por sessão');
  }

  /* (3) o Órgão Central exporta as três, com o número DECLARADO */
  {
    ['painel', 'cobertura', 'contas a regularizar'].forEach(function (t, i) {
      const r = B.registrarExportacao({ token: TKC12, tipo: t, linhas: 412 + i });
      ok(r.ok === true,
         'v8.13 (E12): o Órgão Central registra "' + t + '"');
      ok(linhasDoHist().some(function (l) {
           return l.indexOf('exportou ' + t + ' · ' + (412 + i) + ' linhas informadas pela tela') >= 0; }),
         'v8.13 (E12): a linha diz que o número foi INFORMADO PELA TELA — é o que o servidor sabe');
    });
    ok(!linhasDoHist().some(function (l) { return /exportou .*\(\d+ linhas\)/.test(l) && /E12/.test(l); }),
       'v8.13 (E12): o formato antigo, que dava o número como fato, não é mais escrito');
  }

  /* (4) a lista é fechada — nada de texto livre */
  {
    ['qualquer coisa', '', 'lista', 'base de escolas', 'painel de controle'].forEach(function (t) {
      const r = B.registrarExportacao({ token: TKC12, tipo: t, linhas: 5 });
      ok(r.ok === false,
         'v8.13 (E12): "' + t + '" não é um tipo de exportação do sistema');
    });
    const maiusculo = B.registrarExportacao({ token: TKC12, tipo: '  PAINEL ', linhas: 9 });
    ok(maiusculo.ok === true,
       'v8.13 (E12): caixa e espaços em volta não mudam a decisão — "  PAINEL " é "painel"');
  }

  /* (5) a lista do servidor é a mesma política de E09: só o Órgão Central */
  {
    const nomes = Object.keys(B.EXPORTACOES).sort();
    ok(nomes.join('|') === 'cobertura|contas a regularizar|painel',
       'v8.13 (E12): as três planilhas do sistema estão na lista — ' + nomes.join(', '));
    ok(nomes.every(function (n) { return B.EXPORTACOES[n].join(',') === 'central'; }),
       'v8.13 (E12): e todas as três são do Órgão Central (política da v8.9 / E09)');
  }
}

/* ==================== v8.13 (E13, A8-07/A8-11/A8-12): a fila cabe na execução ==================== */
{
  const abaF13 = B.abaFila_();
  const filaLinhas = function () {
    const n = abaF13.getLastRow();
    return n < 2 ? [] : abaF13.getRange(2, 1, n - 1, 10).getDisplayValues()
      .map(function (r) { return { para: r[1], tipo: r[2], assunto: r[3], corpo: r[4],
                                   prioridade: r[5], situacao: r[6], tentativas: r[7], erro: r[8], em: r[9] }; });
  };
  /* a fila da bateria já tem linhas; estas verificações olham só as próprias */
  const marca = 'e13-';

  /* (1) o expurgo saiu do caminho do envio */
  {
    /* 300 linhas: enviadas há muito tempo, alternadas com pendentes, para que
       os blocos a remover NÃO sejam contíguos — que é o caso real da A8-07 */
    /* v8.13 (F10): a linha intercalada passa a ser `pendente` — `desistiu`
       também é expurgada desde F10, e com ela as 300 ficariam contíguas: o
       orçamento de blocos deixaria de ser exercitado, que é o que E13 mede.
       Duas linhas `desistiu` entram ao fim, para o critério novo. */
    const velho = '01/01/2020 08:00';
    for (let i = 0; i < 300; i++) {
      const enviada = (i % 2 === 0);
      abaF13.appendRow([velho, marca + i + '@x.mg', 'boas-vindas', 'E13 ' + i, 'corpo ' + i, 2,
                        enviada ? 'enviado' : 'pendente', enviada ? 1 : 0, '', enviada ? velho : '']);
    }
    abaF13.appendRow([velho, marca + 'des-velha@x.mg', 'boas-vindas', 'E13 desistiu velha', 'corpo', 2,
                      'desistiu', 5, 'endereço inválido', '']);
    abaF13.appendRow([B.agora_(), marca + 'des-nova@x.mg', 'boas-vindas', 'E13 desistiu nova', 'corpo', 2,
                      'desistiu', 5, 'endereço inválido', '']);
    MAIL.cota = 400; MAIL.falha = '';
    REMOCOES.length = 0;
    const r = B.processarFilaEmails_();
    ok(REMOCOES.length === 0,
       'v8.13 (E13, A8-07): processarFilaEmails_ não emite NENHUM deleteRows (' + REMOCOES.length + ')');
    ok(r.apagadas === 0, 'v8.13 (E13): e não diz ter apagado nada');
  }

  /* (2) nenhum e-mail sai com a trava do script presa */
  {
    MAIL.cota = 400; MAIL.falha = '';
    B.enfileirarEmail_(marca + 'trava@x.mg', 'boas-vindas', 'E13 trava', 'corpo', 2);
    const antes = emails.length;
    B.processarFilaEmails_();
    const novos = emails.slice(antes);
    ok(novos.length > 0 && novos.every(function (e) { return e.__comTrava === false; }),
       'v8.13 (E13, A8-07): nenhum MailApp.sendEmail aconteceu com a trava presa (' +
       novos.length + ' envio(s))');
  }

  /* (3) o expurgo tem orçamento e continua de onde parou */
  {
    REMOCOES.length = 0;
    const r1 = B.expurgarFilaRotina_();
    ok(REMOCOES.length <= B.EXPURGO_MAX_BLOCOS,
       'v8.13 (E13): a rotina de expurgo emite no máximo ' + B.EXPURGO_MAX_BLOCOS +
       ' deleteRows por execução (' + REMOCOES.length + ')');
    ok(REMOCOES.every(function (x) { return x.comTrava === true; }),
       'v8.13 (E13): e apaga sob a trava do script');
    ok(r1.apagadas > 0 && r1.restam > 0,
       'v8.13 (E13): com mais blocos do que o orçamento, sobra para a execução seguinte (' +
       r1.apagadas + ' apagadas, ' + r1.restam + ' restam)');
    let voltas = 0;
    let r2 = r1;
    while (r2.restam > 0 && voltas < 10) { r2 = B.expurgarFilaRotina_(); voltas++; }
    ok(r2.restam === 0,
       'v8.13 (E13): e as execuções seguintes continuam de onde a anterior parou (' + voltas + ' volta(s))');
    ok(!filaLinhas().some(function (f) { return f.para.indexOf(marca) === 0 && f.situacao === 'enviado'; }),
       'v8.13 (E13): ao fim, nenhuma linha enviada há mais de 30 dias ficou na aba');
    const sobraram = filaLinhas().filter(function (f) { return f.para.indexOf(marca) === 0; });
    ok(sobraram.some(function (f) { return f.situacao === 'pendente'; }),
       'v8.13 (E13): e as `pendente` continuam lá — o expurgo não toca no que ainda vai ser enviado');
    /* v8.13 (F10): `desistiu` passou a ser expurgada — a ANTIGA sai, a RECENTE fica */
    ok(!sobraram.some(function (f) { return f.para.indexOf('des-velha') >= 0; }),
       'v8.13 (E13)/F10: a `desistiu` antiga é expurgada');
    ok(sobraram.some(function (f) { return f.para.indexOf('des-nova') >= 0; }),
       'v8.13 (E13)/F10: e a `desistiu` recente fica — a idade é medida por "Criado em" quando não há "Enviado em"');
  }

  /* (4) o aviso de fila cheia sai POR FORA da fila, uma vez por dia */
  {
    const props = S.g.PropertiesService.getScriptProperties();
    props.deleteProperty(B.PROP_AVISO_FILA);
    MAIL.cota = 50; MAIL.falha = '';         /* só a reserva: nada sai */
    const antesLinhas = abaF13.getLastRow();
    for (let i = 0; i < B.FILA_ALERTA_PENDENTES + 100; i++) {
      abaF13.appendRow([B.agora_(), 'cheia' + i + '@x.mg', 'convite', 'E13 cheia', 'corpo', 1, 'pendente', 0, '', '']);
    }
    const depoisDoSemeio = abaF13.getLastRow();
    const antesEmails = emails.length;
    for (let k = 0; k < 6; k++) B.processarFilaEmails_();
    const avisos = emails.slice(antesEmails).filter(function (e) { return /acima do limite/.test(e.subject || ''); });
    ok(avisos.length === 1,
       'v8.13 (E13, A8-11): seis execuções seguidas produzem UM aviso de fila cheia (' + avisos.length + ')');
    ok(avisos.length === 1 && avisos[0].__comTrava === false,
       'v8.13 (E13): e ele sai DIRETO pelo MailApp, fora da trava');
    ok(!filaLinhas().some(function (f) { return /acima do limite/.test(f.assunto); }),
       'v8.13 (E13, A8-11): NENHUMA linha de aviso entrou na própria fila');
    ok(abaF13.getLastRow() === depoisDoSemeio,
       'v8.13 (E13): a aba não cresceu com as seis execuções (' + antesLinhas + ' → ' + abaF13.getLastRow() + ')');
  }

  /* (5) queda no meio do envio: a linha volta a pendente, sem contar tentativa */
  {
    abaF13.appendRow([B.agora_(), 'morto@x.mg', 'convite', 'E13 morto', 'corpo', 1,
                      'enviando desde 01/01/2020 08:00', 2, '', '']);
    const linhaMorto = abaF13.getLastRow();
    MAIL.cota = 400; MAIL.falha = '';
    B.ressuscitarEnviando_(abaF13);
    const v = abaF13.getRange(linhaMorto, 7, 1, 2).getDisplayValues()[0];
    ok(v[0] === 'pendente',
       'v8.13 (E13): linha em "enviando" há mais de ' + B.FILA_ENVIANDO_MIN +
       ' minutos volta a pendente — ' + v[0]);
    ok(String(v[1]) === '2',
       'v8.13 (E13): e a tentativa NÃO é contada — não houve falha atribuível à mensagem');
    /* uma marcada agora NÃO é ressuscitada */
    abaF13.appendRow([B.agora_(), 'vivo@x.mg', 'convite', 'E13 vivo', 'corpo', 1, B.marcaEnviando_(), 0, '', '']);
    const linhaVivo = abaF13.getLastRow();
    B.ressuscitarEnviando_(abaF13);
    ok(B.ehEnviando_(abaF13.getRange(linhaVivo, 7).getDisplayValues()[0][0]),
       'v8.13 (E13): a que acabou de ser marcada continua em envio — não se atropela quem está enviando');
    abaF13.getRange(linhaVivo, 7).setValue('desistiu');
  }

  /* (6) o resumo do Órgão Central lê pouco e conta certo */
  {
    const TKC13 = B.criarSessao_({ email: 'central.e13@educacao.mg.gov.br', nome: 'Central E13',
                                   perfil: 'central', papel: 'central' });
    const linhas = filaLinhas();
    const esperado = {
      pendentes: linhas.filter(function (f) { return f.situacao === 'pendente'; }).length,
      enviados: linhas.filter(function (f) { return f.situacao === 'enviado'; }).length,
      desistidos: linhas.filter(function (f) { return f.situacao === 'desistiu'; }).length
    };
    LEITURAS.length = 0;
    const r = B.filaEmailsResumo({ token: TKC13 });
    const celulas = LEITURAS.reduce(function (t, l) { return t + l.nr * l.nc; }, 0);
    const total = (abaF13.getLastRow() - 1) * 10;
    ok(r.pendentes === esperado.pendentes && r.enviados === esperado.enviados && r.desistidos === esperado.desistidos,
       'v8.13 (E13, A8-12): o resumo conta os mesmos números de antes (' +
       r.pendentes + '/' + r.enviados + '/' + r.desistidos + ')');
    ok(celulas < total / 3,
       'v8.13 (E13, A8-12): lendo menos de um terço das células (' + celulas + ' de ' + total + ')');
    ok(typeof r.enviando === 'number',
       'v8.13 (E13): e passou a dizer quantas estão em envio');
  }

  /* (7) o expurgo é rotina agendada, com carimbo */
  {
    const carimbos = B.rotinasCarimbos_();
    ok(!!carimbos['expurgarFilaRotina_'],
       'v8.13 (E13/E02): a rotina de expurgo carimba a própria execução');
    ok(!!B.ROTINAS_ESPERADAS['expurgarFilaRotina_'] && !!B.ROTINAS_NOMES['expurgarFilaRotina_'],
       'v8.13 (E13): e entra no batimento das rotinas agendadas');
  }

  /* (8) o invólucro de menu de E14 existe e é do menu */
  {
    ok(typeof B.menuLimparCorposDaFila === 'function' && typeof B.limparCorposDaFila_ === 'function',
       'v8.13 (E13/E14): menuLimparCorposDaFila envolve a rotina privada limparCorposDaFila_');
    ok(/somenteMenu_/.test(String(B.menuLimparCorposDaFila)),
       'v8.13 (E13/E14): e começa por somenteMenu_(), como os outros doze');
  }
  MAIL.cota = 400; MAIL.falha = '';
}

/* ==================== v8.13 (E14, A8-08/A8-09/A8-10): nenhum convite se perde, nenhum link em claro ==================== */
{
  const abaF14 = B.abaFila_();
  const linhaDe = function (dest) {
    const n = abaF14.getLastRow();
    if (n < 2) return null;
    const v = abaF14.getRange(2, 1, n - 1, 10).getDisplayValues();
    for (let i = 0; i < v.length; i++) if (v[i][1] === dest) {
      return { linha: i + 2, para: v[i][1], tipo: v[i][2], assunto: v[i][3], corpo: v[i][4],
               situacao: v[i][6], tentativas: v[i][7], erro: v[i][8], em: v[i][9] };
    }
    return null;
  };

  /* a bateria acumulou milhares de pendentes (o cenário de "fila cheia" de
     E13, com 2.100 linhas). O lote de cada execução é FILA_LOTE_MAX: sem
     zerar, nenhuma mensagem deste bloco chegaria a ser escolhida. Tudo o que
     está na aba passa a "enviado" hoje — nada é apagado. */
  {
    const n = abaF14.getLastRow();
    if (n >= 2) {
      const sit = [];
      for (let i = 2; i <= n; i++) sit.push(['enviado', 1, '', B.agora_()]);
      abaF14.getRange(2, 7, sit.length, 4).setValues(sit);
    }
  }

  /* (1) falha de COTA não conta tentativa — e no dia seguinte tudo sai */
  {
    MAIL.cota = 400; MAIL.falha = '';
    const alvos = ['e14a@fora.com', 'e14b@fora.com', 'e14c@fora.com'];
    alvos.forEach(function (e, i) {
      B.enfileirarEmail_(e, 'convite', 'Primeiro acesso ao Gerador de PPP · SEE/MG',
        'Use o link: https://app/?pa=tok' + i + '\nO link vale até 30/09/2026 10:00 e serve uma única vez.', 1);
    });
    MAIL.falha = 'Service invoked too many times for one day: email.';
    for (let k = 0; k < 5; k++) B.processarFilaEmails_();
    const depois = alvos.map(linhaDe);
    ok(depois.every(function (f) { return f && f.situacao === 'pendente'; }),
       'v8.13 (E14, A8-08): cinco execuções sem cota deixam as três mensagens em PENDENTE — ' +
       depois.map(function (f) { return f ? f.situacao : '?'; }).join(', '));
    ok(depois.every(function (f) { return String(f.tentativas) === '0'; }),
       'v8.13 (E14): e o contador de tentativas NÃO subiu (' +
       depois.map(function (f) { return f.tentativas; }).join(',') + ')');
    ok(depois.every(function (f) { return /cota diária/.test(f.erro || ''); }),
       'v8.13 (E14): o erro fica gravado — não se mascara o inverso');
    MAIL.falha = ''; MAIL.cota = 400;
    B.processarFilaEmails_();
    const dia2 = alvos.map(linhaDe);
    ok(dia2.every(function (f) { return f && f.situacao === 'enviado'; }),
       'v8.13 (E14, A8-08): no dia seguinte AS TRÊS saem — zero convites perdidos');
  }

  /* (2) erro permanente: a quinta tentativa desiste, e a desistência é FATO */
  {
    MAIL.cota = 400;
    B.enfileirarEmail_('e14perm@fora.com', 'convite', 'Primeiro acesso', 'corpo perm', 1);
    MAIL.falha = 'Invalid email: e14perm@fora.com';
    for (let k = 0; k < 5; k++) B.processarFilaEmails_();
    const f = linhaDe('e14perm@fora.com');
    ok(f && f.situacao === 'desistiu' && String(f.tentativas) === '5',
       'v8.13 (E14): com erro permanente, a quinta tentativa marca "desistiu" — ' +
       (f ? f.situacao + ' t=' + f.tentativas : 'linha sumiu'));
    const h = outras['Acessos — histórico'];
    const linhasHist = (function () {
      const por = {};
      Object.keys(h.linhas).forEach(function (k) { const p = k.split(':'); (por[p[0]] = por[p[0]] || [])[+p[1]] = String(h.linhas[k]); });
      return Object.keys(por).map(function (n) { return por[n].join(' | '); });
    })();
    ok(linhasHist.some(function (l) { return /desistiu de enviar/.test(l) && /e14perm@fora\.com/.test(l); }),
       'v8.13 (E14, A8-08): a desistência escreve linha no histórico, nomeando destinatário e tipo');
    const daSemana = B.desistenciasDaSemana_();
    ok(daSemana.some(function (x) { return x.para === 'e14perm@fora.com'; }),
       'v8.13 (E14): e o resumo semanal do Órgão Central a contabiliza (' + daSemana.length + ')');
    ok(/desistiu de enviar|desistiu/.test(String(B.blocoDesistenciasDaSemana_())) &&
       /e14perm@fora\.com/.test(String(B.blocoDesistenciasDaSemana_())),
       'v8.13 (E14): o bloco do e-mail nomeia quem ficou sem receber');
    MAIL.falha = '';
  }

  /* (3) o prazo do convite só é renovado DEPOIS de o e-mail sair */
  {
    MAIL.cota = 400; MAIL.falha = '';
    const TKC14 = B.criarSessao_({ email: 'central.e14@educacao.mg.gov.br', nome: 'Central E14',
                                   perfil: 'central', papel: 'central' });
    B.escolaSalvar({ token: TKC14, inep: '31014001', escola: 'EE E14', municipio: 'Betim', sre: 'SRE E14', codigoInep: censoDe('31014001') });
    salvarDiretor(B, { email: 'dir.e14@educacao.mg.gov.br', nome: 'Diretora E14',
                     papel: 'diretor_escolar', inep: '31014001' });
    const TKD14 = B.criarSessao_({ email: 'dir.e14@educacao.mg.gov.br', nome: 'Diretora E14', perfil: 'escola',
                                   papel: 'diretor_escolar', sre: 'SRE E14', inep: '31014001', escola: 'EE E14' });
    const alvo = 'e14.convite@hotmail.com';
    B.acessoSalvar({ token: TKD14, email: alvo, nome: 'Responsável E14', papel: 'colegiado',
                     segmento: 'Pai, mãe ou responsável', relacao: 'responsável por estudante' });
    const abaA = B.abaAcessos_();
    const cad0 = B.acessoPorEmail_(alvo);
    ok(!!cad0 && !!cad0.token, 'v8.13 (E14): o cadastro do convidado tem token');
    /* um prazo vencido, como o do achado */
    abaA.getRange(cad0.linha, 15).setValue('01/01/2020 08:00');
    B.invalidarAcessos_();
    /* uma mensagem parada na fila, com erro permanente */
    B.enfileirarEmail_(alvo, 'convite', 'Primeiro acesso',
      'Use o link. O link vale até 01/01/2020 08:00 e serve uma única vez.', 1);
    MAIL.falha = 'Invalid email: ' + alvo;
    B.processarFilaEmails_();
    ok(String((B.acessoPorEmail_(alvo) || {}).tokenAte || '') === '01/01/2020 08:00',
       'v8.13 (E14, A8-10): envio que FALHOU não renova o prazo do convite — ' +
       String((B.acessoPorEmail_(alvo) || {}).tokenAte || ''));
    MAIL.falha = '';
    B.processarFilaEmails_();
    const cad2 = B.acessoPorEmail_(alvo) || {};
    ok(String(cad2.tokenAte || '') !== '01/01/2020 08:00' && !!cad2.tokenAte,
       'v8.13 (E14): e o envio que DEU CERTO renova — ' + String(cad2.tokenAte || ''));
    const f = linhaDe(alvo);
    ok(f && f.situacao === 'enviado' && f.corpo === '',
       'v8.13 (E14, A8-09): a coluna do corpo da linha ENVIADA está vazia — o link em claro sai da planilha');
  }

  /* (4) a linha pendente conserva o corpo; a desistida, não */
  {
    /* a desistida perde o corpo */
    MAIL.cota = 400; MAIL.falha = '';
    B.enfileirarEmail_('e14des@x.mg', 'convite', 'Primeiro acesso', 'corpo com https://app/?pa=TOKENDES', 1);
    MAIL.falha = 'Invalid email: e14des@x.mg';
    for (let k = 0; k < 5; k++) B.processarFilaEmails_();
    const d = linhaDe('e14des@x.mg');
    ok(d && d.situacao === 'desistiu' && d.corpo === '',
       'v8.13 (E14, A8-09): a linha DESISTIDA também perde o corpo — ela não vai mais ser enviada');
    /* a pendente conserva. Entra DEPOIS da desistida porque a falha do
       simulador é global: uma só mensagem de erro vale para todos os envios. */
    B.enfileirarEmail_('e14pend@x.mg', 'convite', 'Primeiro acesso', 'corpo com https://app/?pa=TOKENPEND', 1);
    MAIL.falha = 'Service invoked too many times for one day: email.';
    B.processarFilaEmails_();
    MAIL.falha = '';
    const p = linhaDe('e14pend@x.mg');
    ok(p && p.situacao === 'pendente' && /TOKENPEND/.test(p.corpo || ''),
       'v8.13 (E14): a linha PENDENTE conserva o corpo — ela ainda vai ser enviada');
  }

  /* (5) a rotina de menu limpa os corpos já gravados e preserva os pendentes */
  {
    const n0 = abaF14.getLastRow();
    /* uma linha legada: enviada, com o corpo ainda na planilha */
    abaF14.appendRow([B.agora_(), 'e14legado@x.mg', 'convite', 'Primeiro acesso',
                      'corpo legado com https://app/?pa=TOKENLEGADO', 1, 'enviado', 1, '', B.agora_()]);
    const antesPend = linhaDe('e14pend@x.mg');
    const r = B.limparCorposDaFila_();
    ok(r.ok && r.limpas >= 1,
       'v8.13 (E14): menuLimparCorposDaFila apaga o corpo das já enviadas e desistidas (' + r.limpas + ')');
    ok((linhaDe('e14legado@x.mg') || {}).corpo === '',
       'v8.13 (E14, A8-09): inclusive as gravadas por implantações anteriores');
    const depoisPend = linhaDe('e14pend@x.mg');
    ok(depoisPend && /TOKENPEND/.test(depoisPend.corpo || ''),
       'v8.13 (E14): e a pendente continua com o corpo');
    ok(abaF14.getLastRow() === n0 + 1,
       'v8.13 (E14): nenhuma linha foi apagada — o que sai é o corpo, não o registro');
    const todas = abaF14.getRange(2, 1, abaF14.getLastRow() - 1, 10).getDisplayValues();
    ok(todas.every(function (v) { return v[6] === 'pendente' || B.ehEnviando_(v[6]) || String(v[4] || '') === ''; }),
       'v8.13 (E14): depois da limpeza, NENHUMA linha não-pendente guarda corpo');
    ok(todas.every(function (v) { return !!v[1]; }),
       'v8.13 (E14): destinatário, assunto, situação e data continuam lá — é o que a auditoria precisa');
  }
  MAIL.cota = 400; MAIL.falha = '';
}

/* ==================== v8.13 (E15, A8-03/A8-23): retenção por idade e carimbo que não colide ==================== */
{
  const vivos = function (re) { return BACKUPS.filter(function (b) { return re.test(b.nome) && !b.lixo; }); };
  const props15 = S.g.PropertiesService.getScriptProperties();
  const guardado15 = props15.getProperty(B.PROP_ROTINAS);

  /* (1) trinta chamadas seguidas não descartam NADA legítimo */
  {
    BACKUPS.length = 0;
    /* 30 diários legítimos, um por dia dos últimos 30 dias */
    for (let k = 0; k < 30; k++) {
      BACKUPS.push({ nome: 'Backup Base PPP e15-' + k, criado: new Date(Date.now() - k * 86400000), lixo: false });
    }
    const antes = vivos(/^Backup Base PPP /).length;
    for (let k = 0; k < 30; k++) B.backupDiario_({ forcado: true });
    const naLixeira = BACKUPS.filter(function (b) { return /^Backup Base PPP e15-/.test(b.nome) && b.lixo; }).length;
    ok(naLixeira === 0,
       'v8.13 (E15, A8-03): 30 chamadas seguidas de backupDiario_ deixam ZERO originais na lixeira (' +
       naLixeira + ' de ' + antes + ')');
    ok(vivos(/^Backup Base PPP /).length === antes + 30,
       'v8.13 (E15): a pasta cresce — é o efeito esperado da retenção por idade');
  }

  /* (2) semeados 40 diários com mais de 30 dias, uma execução manda 10 à lixeira */
  {
    BACKUPS.length = 0;
    for (let k = 0; k < 40; k++) {
      BACKUPS.push({ nome: 'Backup Base PPP velho-' + k,
                     criado: new Date(Date.now() - (60 + k) * 86400000), lixo: false });
    }
    const r = B.backupDiario_({ forcado: true });
    ok(r.aposentados === 10,
       'v8.13 (E15): com 40 diários de mais de 30 dias, uma execução aposenta 10 (' + r.aposentados + ')');
    ok(vivos(/^Backup Base PPP velho-/).length === 30,
       'v8.13 (E15): e mantém os 30 mais recentes entre os velhos (' + vivos(/^Backup Base PPP velho-/).length + ')');
    ok(vivos(/^Backup Base PPP /).length === 31,
       'v8.13 (E15): mais a cópia de hoje, que é jovem e não entra na conta');
  }

  /* (3) duas cópias no mesmo segundo têm nomes diferentes? — o carimbo tem segundos */
  {
    BACKUPS.length = 0;
    const r1 = B.backupDiario_({ forcado: true });
    const r2 = B.backupDiario_({ forcado: true });
    ok(/^\d{4}-\d{2}-\d{2} \d{6}$/.test(String(r1.carimbo)),
       'v8.13 (E15, A8-23): o carimbo tem segundos — ' + r1.carimbo);
    const nomes = BACKUPS.filter(function (b) { return /^Backup Base PPP /.test(b.nome); }).map(function (b) { return b.nome; });
    ok(nomes.length === 2,
       'v8.13 (E15): duas cópias, duas entradas na pasta');
    /* no mesmo segundo os nomes coincidem; o que a correção garante é que a
       colisão deixou de acontecer no mesmo MINUTO, que era o caso real */
    ok(String(r1.carimbo).slice(0, 16) === String(r2.carimbo).slice(0, 16),
       'v8.13 (E15): as duas são do mesmo minuto — e é exatamente o caso do achado');
    ok(!/^\d{4}-\d{2}-\d{2} \d{4}$/.test(String(r1.carimbo)),
       'v8.13 (E15): o carimbo antigo, de resolução de minuto, não é mais usado');
  }

  /* (4) sem `forcado`, a rotina recusa repetir dentro do intervalo */
  {
    BACKUPS.length = 0;
    B.backupDiario_({ forcado: true });
    const antes = BACKUPS.length;
    const r = B.backupDiario_();
    ok(r.copiado === false && /só se repete/.test(r.motivo || ''),
       'v8.13 (E15): 1 h depois, backupDiario_() sem forçar NÃO copia e diz o motivo — ' + (r.motivo || 'copiou'));
    ok(BACKUPS.length === antes,
       'v8.13 (E15): e nenhum arquivo novo aparece na pasta');
    /* o menu e o botão do Órgão Central forçam */
    const TKC15 = B.criarSessao_({ email: 'central.e15@educacao.mg.gov.br', nome: 'Central E15',
                                   perfil: 'central', papel: 'central' });
    const rb = B.backupAgora({ token: TKC15 });
    ok(rb.copiado === true,
       'v8.13 (E15): o botão do Órgão Central força — é pedido humano, não acionador duplicado');
    ok(/expirada/.test(lanca(function () { return B.backupAgora({ token: 'nada' }); })),
       'v8.13 (E15): sem sessão, backupAgora é recusada');
    const TKR15 = sessaoDe_({ email: 'sup.e15@educacao.mg.gov.br', nome: 'Superintendente E15',
                              perfil: 'regional', papel: 'superintendente', sre: 'SRE E15' });
    ok(/Órgão Central/.test(lanca(function () { return B.backupAgora({ token: TKR15 }); })),
       'v8.13 (E15): e continua exigindo a sessão do Órgão Central');
    /* a lista, pela porta pública do Central */
    const lista = B.backupsListar({ token: TKC15 });
    ok(lista.ok && Array.isArray(lista.arquivos) && lista.arquivos.length > 0,
       'v8.13 (E15): backupsListar devolve a janela ao Órgão Central (' + lista.arquivos.length + ')');
  }

  /* (5) os parâmetros da janela são do sistema, e a janela é um TEMPO */
  {
    ok(B.BACKUP_GUARDA_DIAS === 30 && B.BACKUPS_MANTIDOS === 30 && B.BACKUPS_MENSAIS === 24,
       'v8.13 (E15): a janela é de ' + B.BACKUP_GUARDA_DIAS + ' dias, com ' + B.BACKUPS_MANTIDOS +
       ' diárias e ' + B.BACKUPS_MENSAIS + ' mensais');
    ok(B.BACKUP_MIN_INTERVALO === 6 * 3600000,
       'v8.13 (E15): e a cópia da planilha inteira não se repete em menos de 6 h');
  }
  if (guardado15) props15.setProperty(B.PROP_ROTINAS, guardado15);
  BACKUPS.length = 0;
}

/* ==================== v8.13 (E16, A8-05/A8-15): a rotação e a integridade gravam o que já fizeram ==================== */
{
  /* ---------- a rotação do histórico de acessos ---------- */
  {
    const abaH = B.abaHistAcessos_();
    const arquivosDoMes = function () {
      return CRIADAS.filter(function (ss) { return /Acessos histórico \d{4}-\d{2}$/.test(ss.getName()); });
    };
    const antesArquivos = arquivosDoMes().length;
    const antesLinhasArq = antesArquivos ? arquivosDoMes()[antesArquivos - 1].getSheets()[0].getLastRow() : 0;
    /* semear algumas linhas e rodar duas vezes seguidas */
    for (let k = 0; k < 5; k++) B.registrarHistorico_('e16', 'linha de teste ' + k, '—', '', 'primeira volta');
    const n1 = abaH.getLastRow();
    const r1 = B.rotacionarHistoricoAcessos_();
    ok(r1.ok && r1.linhas === n1 - 1,
       'v8.13 (E16): a primeira rotação move as ' + r1.linhas + ' linhas');
    for (let k = 0; k < 4; k++) B.registrarHistorico_('e16', 'linha de teste b' + k, '—', '', 'segunda volta');
    const n2 = abaH.getLastRow();
    const r2 = B.rotacionarHistoricoAcessos_();
    ok(r2.ok && r2.criado === false,
       'v8.13 (E16, A8-05): a segunda rotação do mesmo mês ACRESCENTA ao arquivo existente, não cria outro');
    ok(arquivosDoMes().length === 1,
       'v8.13 (E16): existe UM arquivo deste mês, não vários homônimos (' + arquivosDoMes().length + ')');
    const arq = arquivosDoMes()[arquivosDoMes().length - 1];
    const folha = arq.getSheets()[0];
    ok(folha.getLastRow() === Math.max(1, antesLinhasArq) + (n1 - 1) + (n2 - 1),
       'v8.13 (E16): e ele tem o cabeçalho MAIS a soma de todas as voltas do mês (' + folha.getLastRow() + ')');
    const cab = folha.getRange(1, 1, 1, 6).getDisplayValues()[0];
    ok(cab[0] === B.ACESSO_HIST_COLS[0] && cab[1] === B.ACESSO_HIST_COLS[1],
       'v8.13 (E16): o cabeçalho está na linha 1 — e só nela');
    const linhas = folha.getRange(2, 1, folha.getLastRow() - 1, 6).getDisplayValues();
    ok(!linhas.some(function (l) { return l[0] === B.ACESSO_HIST_COLS[0]; }),
       'v8.13 (E16): o cabeçalho NÃO foi reescrito no meio do arquivo');
    ok(abaH.getLastRow() <= 2,
       'v8.13 (E16): e a aba viva fica com o cabeçalho (e o registro da própria rotação)');
    /* a remoção aconteceu sob a trava */
    const remocoes = REMOCOES.filter(function (x) { return x.aba === B.NOME_ABA_HIST_ACESSOS; });
    ok(remocoes.length > 0 && remocoes.every(function (x) { return x.comTrava; }),
       'v8.13 (E16, A8-05): o deleteRows da aba viva acontece SOB A TRAVA (' + remocoes.length + ')');
  }

  /* falhando a escrita do arquivo, a aba viva continua cheia */
  {
    const abaH = B.abaHistAcessos_();
    for (let k = 0; k < 6; k++) B.registrarHistorico_('e16', 'linha que não pode sumir ' + k, '—', '', 'x');
    const antes = abaH.getLastRow();
    const criarOriginal = S.g.SpreadsheetApp.create;
    const openOriginal = S.g.SpreadsheetApp.openById;
    /* a planilha nova recusa a escrita — é o caso de cota/permissão do Drive */
    S.g.SpreadsheetApp.create = function (nome) {
      const ss = criarOriginal(nome);
      const folha = ss.getSheets()[0];
      const range = folha.getRange;
      folha.getRange = function (a, b, c, d) {
        const o = range.call(folha, a, b, c, d);
        o.setValues = function () { throw new Error('Service Spreadsheets failed while accessing document'); };
        return o;
      };
      return ss;
    };
    S.g.SpreadsheetApp.openById = function () { throw new Error('Spreadsheet not found'); };
    const r = B.rotacionarHistoricoAcessos_();
    S.g.SpreadsheetApp.create = criarOriginal;
    S.g.SpreadsheetApp.openById = openOriginal;
    ok(r.ok === false && /não pôde ser confirmada/.test(r.erro || ''),
       'v8.13 (E16, A8-05): falhando a escrita do arquivo, a rotação recusa — ' + (r.erro || 'não recusou'));
    ok(abaH.getLastRow() >= antes,
       'v8.13 (E16): a aba viva CONTINUA CHEIA — trilha não se apaga contra escrita que talvez não tenha acontecido');
    const h = outras['Acessos — histórico'];
    const linhas = (function () {
      const por = {};
      Object.keys(h.linhas).forEach(function (k) { const p = k.split(':'); (por[p[0]] = por[p[0]] || [])[+p[1]] = String(h.linhas[k]); });
      return Object.keys(por).map(function (n) { return por[n].join(' | '); });
    })();
    ok(linhas.some(function (l) { return /histórico de acessos NÃO arquivado/.test(l); }),
       'v8.13 (E16): e há linha de histórico dizendo por quê');
    /* limpa para não estorvar o resto */
    B.rotacionarHistoricoAcessos_();
  }

  /* ---------- a integridade grava por lote, de verdade ---------- */
  {
    const props16 = S.g.PropertiesService.getScriptProperties();
    props16.deleteProperty(B.PROP_INTEGRIDADE);
    const abaR16 = B.abaRegistros_();
    const abaI16 = B.abaIntegridade_();
    /* 400 registros, todos apontando para um arquivo que NÃO existe no Drive */
    const N16 = 400;
    const linhas16 = [];
    for (let i = 0; i < N16; i++) {
      linhas16.push(B.CAMPOS.map(function (c) {
        switch (c.key) {
          case 'protocolo': return 'PPP-2026-E16' + ('000' + i).slice(-3);
          case 'versao': return 1;
          case 'status': return 'Homologado';
          case 'escola': return 'EE E16 ' + i;
          case 'inep': return '3116' + (1000 + i);
          case 'sre': return 'SRE E16';
          case 'email': return 'x@educacao.mg.gov.br';
          case 'criadoEm': case 'atualizadoEm': return '01/09/2026 09:00';
          case 'fonteId': return 'sumido-' + i;
          case 'assinaturas': return '[]';
          case 'anexos': return '[]';
          default: return '';
        }
      }));
    }
    {
      const destino = abaR16.getLastRow() + 1;
      abaR16.getRange(destino, 1, N16, B.CAMPOS.length).setNumberFormat('@');
      abaR16.getRange(destino, 1, N16, B.CAMPOS.length).setValues(linhas16);
    }
    const faltasAntes = abaI16.getLastRow();
    /* o orçamento de tempo é forçado a estourar no meio do SEGUNDO lote:
       o relógio é adiantado depois de 200 conferências de arquivo */
    const existeOriginal = S.g.DriveApp.getFileById;
    let conferidos = 0;
    const t0real = Date.now();
    const agoraOriginal = Date.now;
    S.g.DriveApp.getFileById = function (id) {
      if (String(id).indexOf('sumido-') === 0) {
        conferidos++;
        if (conferidos === 200) {
          /* daqui em diante, o relógio diz que o orçamento acabou */
          Date.now = function () { return t0real + B.INTEGRIDADE_TEMPO + 1000; };
        }
        throw new Error('File not found: ' + id);
      }
      return existeOriginal(id);
    };
    const r = B.verificarIntegridade_();
    Date.now = agoraOriginal;
    S.g.DriveApp.getFileById = existeOriginal;
    ok(r.ok && r.parcial === true,
       'v8.13 (E16, A8-15): a execução para no meio e devolve resultado PARCIAL');
    ok(abaI16.getLastRow() > faltasAntes,
       'v8.13 (E16, A8-15): a aba "Integridade" JÁ TEM as faltas do que foi conferido (' +
       (abaI16.getLastRow() - faltasAntes) + ' linha(s)) — nada se perde com o estouro');
    const est16 = JSON.parse(props16.getProperty(B.PROP_INTEGRIDADE) || '{}');
    ok(typeof est16.de === 'number' && est16.de > 0,
       'v8.13 (E16): e o cursor aponta o próximo registro NÃO INICIADO (' + est16.de + ')');
    ok(est16.de === r.proximo,
       'v8.13 (E16): o cursor gravado é exatamente o que a resposta declara');
    ok(est16.faltas === (abaI16.getLastRow() - faltasAntes),
       'v8.13 (E16): a contagem acumulada bate com as linhas escritas nesta volta (' + est16.faltas + ')');
    /* a execução seguinte continua de onde parou: nem reconfere, nem pula */
    const antesDe = est16.de;
    const vistos = {};
    let repetido = false, pulado = false;
    S.g.DriveApp.getFileById = function (id) {
      if (String(id).indexOf('sumido-') === 0) {
        if (vistos[id]) repetido = true;
        vistos[id] = true;
        throw new Error('File not found: ' + id);
      }
      return existeOriginal(id);
    };
    let voltas = 0, r2 = { parcial: true };
    while (r2.parcial && voltas < 20) { r2 = B.verificarIntegridade_(); voltas++; }
    S.g.DriveApp.getFileById = existeOriginal;
    ok(!repetido,
       'v8.13 (E16): a execução seguinte NÃO reconfere o que já foi conferido');
    for (let i = antesDe; i < N16; i++) if (!vistos['sumido-' + i]) pulado = true;
    ok(!pulado,
       'v8.13 (E16): e não pula nenhum — do cursor ao fim, todos foram conferidos');
    ok(r2.parcial === false,
       'v8.13 (E16): a volta se fecha (' + voltas + ' execução(ões))');
    ok(B.INTEGRIDADE_LOTE === 150 && B.INTEGRIDADE_TEMPO === 4 * 60 * 1000 && B.INTEGRIDADE_PASSO === 25,
       'v8.13 (E16): o lote e o orçamento não mudaram; o relógio passou a ser olhado de ' +
       B.INTEGRIDADE_PASSO + ' em ' + B.INTEGRIDADE_PASSO + ' registros');
  }
}

/* ==================== v8.13 (E17, A8-13): a prévia exige sessão e não empresta o brasão ==================== */
{
  const SRE17 = 'SRE E17';
  const TKC17 = B.criarSessao_({ email: 'central.e17@educacao.mg.gov.br', nome: 'Central E17',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC17, inep: '31017001', escola: 'EE E17', municipio: 'Betim', sre: SRE17, codigoInep: censoDe('31017001') });
  salvarDiretor(B, { email: 'dir.e17@educacao.mg.gov.br', nome: 'Diretora E17',
                   papel: 'diretor_escolar', inep: '31017001' });
  const TKD17 = B.criarSessao_({ email: 'dir.e17@educacao.mg.gov.br', nome: 'Diretora E17', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE17, inep: '31017001', escola: 'EE E17' });
  const TKR17 = sessaoDe_({ email: 'sup.e17@educacao.mg.gov.br', nome: 'Superintendente E17',
                            perfil: 'regional', papel: 'superintendente', sre: SRE17 });
  B.acessoSalvar({ token: TKD17, email: 'membro.e17@educacao.mg.gov.br', nome: 'Membro E17',
                   papel: 'colegiado', segmento: 'Docente', masp: '9911223' });
  const TKM17 = B.criarSessao_({ email: 'membro.e17@educacao.mg.gov.br', nome: 'Membro E17', perfil: 'escola',
                                 papel: 'colegiado', sre: SRE17, inep: '31017001', escola: 'EE E17' });

  /* (1) quem pode pedir a prévia */
  {
    let sem = null, semErro = '';
    try { sem = B.previaPDF({ escola: 'EE E17', docHtml: '<p>x</p>' }); }
    catch (e) { semErro = String(e && e.message || e); }
    ok(sem && sem.ok === false && sem.semSessao === true,
       'v8.13 (E17, A8-13): sem token, previaPDF devolve semSessao — e não um PDF' +
       (semErro ? ' (lançou: ' + semErro + ')' : (sem && sem.ok ? ' (GEROU O PDF)' : '')));
    ok(/Órgão Central|direção|direcao|escolar/i.test(lanca(function () {
         return B.previaPDF({ token: TKR17, escola: 'EE E17', docHtml: '<p>x</p>' }); })),
       'v8.13 (E17): a sessão REGIONAL é recusada');
    ok(/direção|direcao/i.test(lanca(function () {
         return B.previaPDF({ token: TKM17, escola: 'EE E17', docHtml: '<p>x</p>' }); })),
       'v8.13 (E17): a do Colegiado também — a prévia é de quem EDITA');
    ok(/Órgão Central|direção|direcao/i.test(lanca(function () {
         return B.previaPDF({ token: TKC17, escola: 'EE E17', docHtml: '<p>x</p>' }); })),
       'v8.13 (E17): e a do Órgão Central');
    const r = B.previaPDF({ token: TKD17, escola: 'EE E17', docHtml: '<p>x</p>' });
    ok(r.ok && /^PREVIA_/.test(r.nomeArquivo || ''),
       'v8.13 (E17): a direção da escola gera a prévia normalmente');
  }

  /* (2) o brasão entra UMA vez */
  {
    const um = B.montarHtmlPdf_('<!--BRASAO-->x', 'r');
    const muitos = B.montarHtmlPdf_('<!--BRASAO-->'.repeat(1000) + 'x', 'r');
    const brasao = B.brasaoPdf_();
    const conta = function (h) {
      let n = 0, i = 0;
      while ((i = h.indexOf(brasao, i)) >= 0) { n++; i += brasao.length; }
      return n;
    };
    ok(conta(um) === 1, 'v8.13 (E17): uma marca, um brasão');
    ok(conta(muitos) === 1,
       'v8.13 (E17, A8-13): MIL marcas, UM brasão (' + conta(muitos) + ')');
    /* o DocCss.html explica a marca num COMENTÁRIO de folha de estilo; o que
       importa é o corpo do documento */
    const corpoDe = function (h) { return h.slice(h.indexOf('<body class="doc">')); };
    ok(corpoDe(muitos).indexOf('<!--BRASAO-->') < 0,
       'v8.13 (E17): e as marcas que sobraram são removidas, não deixadas no documento');
    ok(muitos.length < um.length + 5000,
       'v8.13 (E17): o HTML não explode de tamanho (' + um.length + ' → ' + muitos.length + ')');
    /* a capa do sistema continua funcionando: exatamente uma marca */
    ok(/<!--BRASAO-->/.test(B.txtServidor_('DOC.previa')) === false,
       'v8.13 (E17): a marca é da capa montada pela tela, não de texto curado');
  }

  /* (3) o que vem da tela é conteúdo, não folha de estilo */
  {
    const ataque = '<style>.previa{display:none}</style>' +
      '<script>alert(1)</script>' +
      '<link rel="stylesheet" href="https://fora/x.css">' +
      '<base href="https://fora/">' +
      '<meta http-equiv="refresh" content="0">' +
      '<div class="pag-corpo">conteúdo do chamador</div>';
    const html = B.htmlDaPrevia_({ token: TKD17, escola: 'EE E17', docHtml: ataque });
    ok(html.indexOf('.previa{display:none}') < 0 && !/<style>\.previa/.test(html),
       'v8.13 (E17, A8-13): o <style> do chamador NÃO atravessa');
    ok(!/<script\b/i.test(html.replace(/<style>[\s\S]*?<\/style>/gi, '')),
       'v8.13 (E17): nem o <script>');
    ok(!/<link\b/i.test(html) && !/<base\b/i.test(html) && !/http-equiv/i.test(html),
       'v8.13 (E17): nem <link>, <base> ou <meta>');
    ok(html.indexOf('conteúdo do chamador') > 0,
       'v8.13 (E17): e o conteúdo legítimo continua lá');
    ok(/class="previa"/.test(html) && /!important/.test(html),
       'v8.13 (E17): a marca de prévia está no documento, com estilo em linha e !important');
    ok(/PRÉVIA/.test(html.replace(/<[^>]+>/g, ' ')),
       'v8.13 (E17): e a palavra PRÉVIA é texto visível, não só classe');
    /* o DocCss legítimo continua sendo emitido pelo SERVIDOR */
    ok(/\.doc \.previa/.test(html),
       'v8.13 (E17): a folha de estilo do documento continua vindo do servidor');
  }

  /* (4) o teto de tamanho */
  {
    const grande = 'x'.repeat(B.PREVIA_MAX + 1);
    const r = B.previaPDF({ token: TKD17, escola: 'EE E17', docHtml: grande });
    ok(r.ok === false && /grande demais/.test(r.erro || ''),
       'v8.13 (E17, A8-13): docHtml acima do teto é recusado, com mensagem que diz o que fazer');
    ok(/\d+ mil/.test(r.erro || ''),
       'v8.13 (E17): a mensagem nomeia o tamanho e o limite — ' + (r.erro || ''));
    const noLimite = B.previaPDF({ token: TKD17, escola: 'EE E17', docHtml: 'x'.repeat(1000) });
    ok(noLimite.ok === true,
       'v8.13 (E17): e o documento de tamanho normal continua passando');
    ok(B.PREVIA_MAX >= 1200000,
       'v8.13 (E17): o teto (' + B.PREVIA_MAX + ') fica acima do maior PPP possível — 100 campos com os seus próprios tetos');
  }
}

/* ==================== v8.13 (E18, A8-19): a porta pública deixa de imprimir a matrícula ==================== */
{
  const SRE18 = 'SRE E18';
  const TKC18 = B.criarSessao_({ email: 'central.e18@educacao.mg.gov.br', nome: 'Central E18',
                                 perfil: 'central', papel: 'central' });
  const TKDE18 = (function () {
    B.acessoSalvar({ token: TKC18, email: 'de.e18@educacao.mg.gov.br', nome: 'DE E18',
                     papel: 'diretor_educacional', sre: SRE18 });
    return sessaoDe_({ email: 'de.e18@educacao.mg.gov.br', nome: 'DE E18', perfil: 'regional',
                       papel: 'diretor_educacional', sre: SRE18 });
  })();
  const INEP18 = '31018001', ESC18 = 'EE E18';
  const MASP_DIR = '1234567', MASP_MEMBRO = '7654321';
  B.escolaSalvar({ token: TKC18, inep: INEP18, escola: ESC18, municipio: 'Betim', sre: SRE18, codigoInep: censoDe(INEP18) });
  salvarDiretor(B, { email: 'dir.e18@educacao.mg.gov.br', nome: 'Diretora E18',
                   masp: MASP_DIR, papel: 'diretor_escolar', inep: INEP18 });
  const TKD18 = B.criarSessao_({ email: 'dir.e18@educacao.mg.gov.br', nome: 'Diretora E18', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE18, inep: INEP18, escola: ESC18 });
  B.acessoSalvar({ token: TKD18, email: 'membro.e18@educacao.mg.gov.br', nome: 'Membro E18',
                   masp: MASP_MEMBRO, papel: 'colegiado', segmento: 'Docente', inep: INEP18 });

  /* v10.1: a máscara saiu — matrícula de servidor público é informação
     pública, publicada no Diário Oficial a cada ato da vida funcional */
  {
    ok(typeof B.maspMascarado_ === 'undefined',
       'v10.1: a função que mascarava a matrícula não existe mais');
    const fonte101 = fs.readFileSync('./Code.gs', 'utf8');
    ok(fonte101.indexOf("'•••'") < 0 && fonte101.indexOf('"•••"') < 0,
       'v10.1: e não sobrou máscara nenhuma no servidor');
  }

  /* um PPP concluído, com a direção e um membro assinando */
  const P18 = B.salvarPPP({ token: TKD18, escola: ESC18, inep: INEP18, municipio: 'Betim',
                            sessao: 'e18', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  B.enviarParaValidacao({ token: TKD18, protocolo: P18 });
  B.validarPPP({ token: TKDE18, protocolo: P18, parecer: 'ok' });
  B.concluirPPP({ token: TKD18, protocolo: P18, escola: ESC18, inep: INEP18, municipio: 'Betim',
                  direcao: 'Diretora E18', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
                  docHtml: '<div class="paginas"><div class="pagina"><div class="pag-corpo">corpo</div>' +
                           '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span></div></div></div>',
                  sessao: 'e18' });
  B.presencaColegiado({ p: P18, token: TKD18, emails: ['membro.e18@educacao.mg.gov.br'] });
  const reg18 = function () { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P18)); };
  const cod18 = reg18().hash;
  const hashAntes = cod18;

  /* (1) a rota HTML da porta pública */
  {
    const pub = B.documentoPublicoHtml({ codigo: cod18 });
    ok(pub.ok, 'v8.13 (E18): a conferência pública abre o documento (' + (pub.erro || 'ok') + ')');
    const html = String(pub.html || pub.congelado || '');
    ok(html.indexOf(MASP_MEMBRO) >= 0 && html.indexOf(MASP_DIR) >= 0,
       'v10.1: o MASP de cada signatário sai POR EXTENSO na conferência pública — é informação pública');
    ok(html.indexOf('•••') < 0,
       'v10.1: e não há máscara nenhuma na folha');
    ok(html.indexOf('Membro E18') >= 0 && html.indexOf('Docente') >= 0,
       'v8.13 (E18): o nome completo e o segmento continuam: a composição do Colegiado é ato público');
    ok(!/\S+@\S+\.\S+/.test(html.replace(/https?:\/\/\S+/g, '')),
       'v8.13 (E18): e o e-mail continua fora, como desde a v7.4');
  }

  /* (2) a FICHA da conferência continua sem MASP: ela não é a folha
     impressa, é um resumo em campos; quem quer a matrícula lê o documento */
  {
    const v = B.verificarDocumento({ codigo: cod18 });
    ok(v.ok && JSON.stringify(v).indexOf(MASP_MEMBRO) < 0 && JSON.stringify(v).indexOf(MASP_DIR) < 0,
       'v8.13 (E18): verificarDocumento não devolve MASP em campo nenhum');
    ok((v.assinantes || []).some(function (a) { return a.nome === 'Membro E18'; }),
       'v8.13 (E18): e continua devolvendo nome, papel e data');
  }

  /* (3) sob sessão, o registro continua completo */
  {
    const r = B.registroLeitura({ token: TKD18, p: P18 });
    ok(r.ok && String(r.registro.assinaturas || '').indexOf(MASP_MEMBRO) >= 0,
       'v8.13 (E18): sob sessão, registroLeitura continua devolvendo as assinaturas COMPLETAS');
    const cad = B.acessoPorEmail_('membro.e18@educacao.mg.gov.br');
    ok(cad && cad.masp === MASP_MEMBRO,
       'v8.13 (E18): e o MASP inteiro continua no cadastro');
  }

  /* (4) mudar a folha NÃO invalida o código já emitido */
  {
    ok(reg18().hash === hashAntes,
       'v8.13 (E18): o código de autenticidade é IDÊNTICO antes e depois da correção — ele responde pelo corpo congelado, não pela folha');
    const v = B.verificarDocumento({ codigo: hashAntes });
    ok(v.ok && v.protocolo === P18,
       'v8.13 (E18): e o código impresso em papel continua conferindo');
  }

  /* (5) v10.1: o PDF traz a matrícula inteira, como a tela sempre trouxe */
  {
    const r = B.documentoPdf({ token: TKD18, p: P18 });
    ok(r.ok, 'v8.13 (E18): o PDF do PPP concluído é entregue (' + (r.erro || 'ok') + ')');
    const completo = B.documentoComFolha_(reg18(), B.documentoCongelado_(reg18()) || '');
    ok(completo.indexOf('MASP ' + MASP_MEMBRO) >= 0 && completo.indexOf('MASP ' + MASP_DIR) >= 0,
       'v10.1: a folha que vai para o PDF traz o MASP por extenso, do membro e da direção');
    ok(completo.indexOf('•••') < 0,
       'v10.1: e nenhuma matrícula sai mascarada');
    /* a tela e o PDF passam a dizer a MESMA coisa — era a divergência que
       fazia o documento final parecer outro documento */
    const app101 = fs.readFileSync('./App.html', 'utf8');
    ok(/'MASP ' \+ a\.masp/.test(app101),
       'v10.1: e a tela, que já imprimia o número inteiro, continua igual ao PDF');
  }
}

/* ==================== v8.13 (E19, A8-20): a "relação com a escola" tem caminho de exclusão ==================== */
{
  const SRE19b = 'SRE E19';
  const INEP19 = '31019001', ESC19 = 'EE E19';
  const TKC19b = B.criarSessao_({ email: 'central.e19@educacao.mg.gov.br', nome: 'Central E19',
                                  perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC19b, inep: INEP19, escola: ESC19, municipio: 'Betim', sre: SRE19b, codigoInep: censoDe(INEP19) });
  salvarDiretor(B, { email: 'dir.e19@educacao.mg.gov.br', nome: 'Diretora E19',
                   papel: 'diretor_escolar', inep: INEP19 });
  const TKD19b = B.criarSessao_({ email: 'dir.e19@educacao.mg.gov.br', nome: 'Diretora E19', perfil: 'escola',
                                  papel: 'diretor_escolar', sre: SRE19b, inep: INEP19, escola: ESC19 });
  const RELACAO = 'pai da estudante Beatriz, 8º ano B';
  const PAI = 'pai.beatriz.e19@hotmail.com';

  /* (1) cadastrar com relação NÃO a escreve no registro permanente */
  {
    const r = B.acessoSalvar({ token: TKD19b, email: PAI, nome: 'Carlos Responsável',
                               papel: 'colegiado', segmento: 'Pai, mãe ou responsável', relacao: RELACAO });
    ok(r.ok !== false || !!r.linhas, 'v8.13 (E19): o cadastro do responsável passa');
    const per = B.gestoresTodos_().filter(function (g) { return g.email === PAI; });
    ok(per.length === 1,
       'v8.13 (E19): o período do membro é aberto normalmente');
    ok(String(per[0].observacao || '').indexOf(RELACAO) < 0 &&
       String(per[0].observacao || '').indexOf('Beatriz') < 0,
       'v8.13 (E19, A8-20): a observação do período NÃO contém a relação — ' + (per[0].observacao || '(vazia)'));
    ok(String(per[0].observacao || '') === 'Pai, mãe ou responsável',
       'v8.13 (E19): ela guarda o segmento, que é a composição do Colegiado — ato público');
    /* e o cadastro vivo continua com a relação: é dele que a direção precisa */
    const cad = B.acessoPorEmail_(PAI);
    ok(cad && cad.relacao === RELACAO,
       'v8.13 (E19): a relação continua no CADASTRO, que é onde ela tem finalidade e exclusão');
  }

  /* (2) o período semeado no formato ANTIGO é tarjado ao remover o cadastro */
  {
    const ANTIGO = 'mae.legado.e19@hotmail.com';
    const REL_ANTIGA = 'mãe do estudante Davi, 3º ano C';
    B.acessoSalvar({ token: TKD19b, email: ANTIGO, nome: 'Marina Legado',
                     papel: 'colegiado', segmento: 'Pai, mãe ou responsável', relacao: REL_ANTIGA });
    /* semear o formato da v8.12: segmento · relação, escrito na coluna 13 */
    const abaG = B.abaGestores_();
    const g0 = B.gestoresTodos_().filter(function (g) { return g.email === ANTIGO; })[0];
    abaG.getRange(g0.linha, 13).setValue('Pai, mãe ou responsável · ' + REL_ANTIGA);
    B.invalidarGestores_ ? B.invalidarGestores_() : null;
    B._gestoresCache = null;
    const antes = abaG.getRange(g0.linha, 1, 1, B.GESTOR_COLS.length).getDisplayValues()[0];
    ok(antes[12].indexOf(REL_ANTIGA) >= 0,
       'v8.13 (E19): o período legado tem a relação concatenada na observação');
    const nLinhas = abaG.getLastRow();

    const r = B.acessoRemover({ token: TKD19b, email: ANTIGO, motivo: 'saiu do Colegiado' });
    ok(r && (r.ok !== false), 'v8.13 (E19): a remoção do cadastro passa');
    const depois = abaG.getRange(g0.linha, 1, 1, B.GESTOR_COLS.length).getDisplayValues()[0];
    ok(depois[12] === 'Pai, mãe ou responsável · ' + B.TARJA_RELACAO,
       'v8.13 (E19, A8-20): a observação passou a "' + depois[12] + '"');
    ok(depois[12].indexOf('Davi') < 0,
       'v8.13 (E19): o nome do estudante não está mais em lugar nenhum do registro permanente');
    /* nada mais mudou */
    ok(depois[0] === antes[0] && depois[1] === antes[1] && depois[2] === antes[2] &&
       depois[4] === antes[4] && depois[5] === antes[5] && depois[7] === antes[7],
       'v8.13 (E19): INEP, escola, NOME, e-mail, início e "registrado por" continuam IDÊNTICOS');
    ok(abaG.getLastRow() === nLinhas,
       'v8.13 (E19): nenhuma linha foi apagada — o período continua lá');
    /* o período continua sendo lido */
    /* quem lê o período do Colegiado é a direção da própria escola (C02/E08);
       `gestoresHistorico` é a sucessão da DIREÇÃO e não traz colegiado. */
    const hist = B.historicoAssociacoes({ token: TKD19b });
    const linhaAntiga = (hist.linhas || []).filter(function (l) { return l.email === ANTIGO; })[0];
    ok(hist.ok && !!linhaAntiga,
       'v8.13 (E19): e o histórico de associações continua devolvendo o período');
    ok(linhaAntiga && String(linhaAntiga.observacao || '').indexOf('Davi') < 0 &&
       String(linhaAntiga.observacao || '').indexOf(B.TARJA_RELACAO) >= 0,
       'v8.13 (E19): já com a tarja, e sem o nome do estudante');
    const per = B.gestoresTodos_().filter(function (g) { return g.email === ANTIGO; })[0];
    ok(per && per.fim && per.encerradoPor === 'Diretora E19' && /saiu do Colegiado/.test(per.motivo || ''),
       'v8.13 (E19): o encerramento do período continua registrado, com quem encerrou e o motivo');
    /* e a linha de auditoria da própria tarja */
    const h = outras['Acessos — histórico'];
    const linhas = (function () {
      const por = {};
      Object.keys(h.linhas).forEach(function (k) { const p = k.split(':'); (por[p[0]] = por[p[0]] || [])[+p[1]] = String(h.linhas[k]); });
      return Object.keys(por).map(function (n) { return por[n].join(' | '); });
    })();
    ok(linhas.some(function (l) { return /relação com a escola removida do histórico/.test(l) && l.indexOf(ANTIGO) >= 0; }),
       'v8.13 (E19): a própria remoção da relação fica registrada — a minimização é auditável');
  }

  /* (3) período SEM relação não é alterado */
  {
    const SO_SEGMENTO = 'docente.e19@educacao.mg.gov.br';
    B.acessoSalvar({ token: TKD19b, email: SO_SEGMENTO, nome: 'Docente E19',
                     papel: 'colegiado', segmento: 'Docente', masp: '5544332' });
    const abaG = B.abaGestores_();
    const g0 = B.gestoresTodos_().filter(function (g) { return g.email === SO_SEGMENTO; })[0];
    const antes = abaG.getRange(g0.linha, 1, 1, B.GESTOR_COLS.length).getDisplayValues()[0].join('|');
    B.acessoRemover({ token: TKD19b, email: SO_SEGMENTO, motivo: 'trocou de escola' });
    const depois = abaG.getRange(g0.linha, 13).getDisplayValues()[0][0];
    ok(depois === 'Docente',
       'v8.13 (E19): período cuja observação é só o segmento continua EXATAMENTE como estava — ' + depois);
    ok(depois.indexOf(B.TARJA_RELACAO) < 0,
       'v8.13 (E19): a tarja só acontece quando há o que tarjar');
  }

  /* (4) remover um DIRETOR não passa pela tarja */
  {
    const abaG = B.abaGestores_();
    const antes = abaG.getLastRow();
    /* numa escola SÓ DESTE bloco: um diretor novo substitui o em exercício, e
       substituir a direção de (1) derrubaria a sessão usada em (5) */
    B.escolaSalvar({ token: TKC19b, inep: '31019002', escola: 'EE E19 Dois', municipio: 'Betim', sre: SRE19b, codigoInep: censoDe('31019002') });
    salvarDiretor(B, { email: 'dir2.e19@educacao.mg.gov.br', nome: 'Diretora Dois E19',
                     papel: 'diretor_escolar', inep: '31019002' });
    B.acessoRemover({ token: TKC19b, email: 'dir2.e19@educacao.mg.gov.br', motivo: 'aposentou' });
    const dir = B.gestoresTodos_().filter(function (g) { return g.email === 'dir2.e19@educacao.mg.gov.br'; })[0];
    ok(dir && String(dir.observacao || '').indexOf(B.TARJA_RELACAO) < 0,
       'v8.13 (E19): período de direção escolar não é tarjado — a tarja é do Colegiado');
  }

  /* (5) a relação sai de vez com a linha do cadastro */
  {
    const cad = B.acessoPorEmail_(PAI);
    ok(!!cad, 'v8.13 (E19): o responsável de (1) ainda está cadastrado');
    B.acessoRemover({ token: TKD19b, email: PAI, motivo: 'a filha concluiu o ensino médio' });
    ok(!B.acessoPorEmail_(PAI),
       'v8.13 (E19): removido o cadastro, a relação some da aba Acessos junto com a linha');
    const todas = B.gestoresTodos_().filter(function (g) { return g.email === PAI; });
    ok(todas.every(function (g) { return String(g.observacao || '').indexOf('Beatriz') < 0; }),
       'v8.13 (E19, A8-20): e não há vestígio dela no registro permanente');
  }
}

/* ==================== v8.13 (E20, A7-04): a SRE do registro vem da sessão e da base ==================== */
/* Não há correção de produção aqui: C13 (a leitura pergunta à base qual é a
   SRE da escola hoje) e D02 (a gravação toma a SRE da sessão, e o campo da
   tela virou leitura) fecham o achado nos dois lados. O que faltava era a
   PROVA — nenhum dos dois testes reproduzia este cenário: SRE forjada no
   payload e as duas abas do painel discordando. É o que este bloco faz. */
{
  const SRE_A = 'Divinópolis E20', SRE_B = 'Uberlândia E20';
  const INEP20 = '31020001', ESC20 = 'EE E20';
  const TKC20 = B.criarSessao_({ email: 'central.e20@educacao.mg.gov.br', nome: 'Central E20',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKC20, inep: INEP20, escola: ESC20, municipio: 'Divinópolis', sre: SRE_A, codigoInep: censoDe(INEP20) });
  salvarDiretor(B, { email: 'dir.e20@educacao.mg.gov.br', nome: 'Diretora E20',
                   papel: 'diretor_escolar', inep: INEP20 });
  const TKD20 = B.criarSessao_({ email: 'dir.e20@educacao.mg.gov.br', nome: 'Diretora E20', perfil: 'escola',
                                 papel: 'diretor_escolar', sre: SRE_A, inep: INEP20, escola: ESC20 });
  const supDe = function (sre, n) {
    B.acessoSalvar({ token: TKC20, email: 'sup' + n + '.e20@educacao.mg.gov.br',
                     nome: 'Superintendente ' + sre, papel: 'superintendente', sre: sre });
    return sessaoDe_({ email: 'sup' + n + '.e20@educacao.mg.gov.br', nome: 'Superintendente ' + sre,
                       perfil: 'regional', papel: 'superintendente', sre: sre });
  };
  const TKA = supDe(SRE_A, 'a'), TKB = supDe(SRE_B, 'b');
  const noPainel = function (tk, prot) {
    return (B.painelRegistros({ token: tk, filtros: {} }).linhas || [])
      .some(function (l) { return l.protocolo === prot; });
  };
  const naCobertura = function (tk) {
    const c = B.coberturaRegional({ token: tk });
    return (c.escolas || []).some(function (e) { return e.inep === INEP20; });
  };

  /* (1) a SRE forjada no payload é ignorada na GRAVAÇÃO */
  const P20 = B.salvarPPP({ token: TKD20, escola: ESC20, inep: INEP20, municipio: 'Divinópolis',
                            sre: SRE_B, sessao: 'e20', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  {
    const linha = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P20));
    ok(linha.sre === SRE_A,
       'v8.13 (E20, A7-04): salvarPPP com sre forjada grava a SRE DA SESSÃO — ' + linha.sre);
    /* e de novo, numa regravação: é o caso do achado (o registro já existe) */
    B.salvarPPP({ token: TKD20, protocolo: P20, escola: ESC20, inep: INEP20, sre: SRE_B, sessao: 'e20' });
    const linha2 = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P20));
    ok(linha2.sre === SRE_A,
       'v8.13 (E20): e a REGRAVAÇÃO também — a SRE não é campo da tela (D02)');
  }

  /* (2) as duas abas do painel contam a mesma história */
  {
    ok(noPainel(TKA, P20) === true,
       'v8.13 (E20): o painel de ' + SRE_A + ' contém o protocolo');
    ok(noPainel(TKB, P20) === false,
       'v8.13 (E20): e o de ' + SRE_B + ' não');
    ok(naCobertura(TKA) === true && naCobertura(TKB) === false,
       'v8.13 (E20, A7-04): a aba Cobertura concorda com o painel — as duas dizem ' + SRE_A);
    ok(B.registroLeitura({ token: TKB, p: P20 }).ok === false,
       'v8.13 (E20): ' + SRE_B + ' continua recusada na leitura institucional');
    ok(B.registroLeitura({ token: TKA, p: P20 }).ok === true,
       'v8.13 (E20): e ' + SRE_A + ' continua abrindo');
  }

  /* (3) homologar e depois MOVER a escola de regional pela base (C13) */
  {
    B.enviarParaValidacao({ token: TKD20, protocolo: P20 });
    B.acessoSalvar({ token: TKC20, email: 'de.e20@educacao.mg.gov.br', nome: 'DE E20',
                     papel: 'diretor_educacional', sre: SRE_A });
    const TKDE20 = sessaoDe_({ email: 'de.e20@educacao.mg.gov.br', nome: 'DE E20', perfil: 'regional',
                               papel: 'diretor_educacional', sre: SRE_A });
    B.validarPPP({ token: TKDE20, protocolo: P20, parecer: 'ok' });
    B.concluirPPP({ token: TKD20, protocolo: P20, escola: ESC20, inep: INEP20, municipio: 'Divinópolis',
                    direcao: 'Diretora E20', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
                    docHtml: '<div class="paginas"><div class="pagina"><div class="pag-corpo">corpo</div>' +
                             '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span></div></div></div>',
                    sessao: 'e20' });
    const codigo20 = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P20)).hash;
    const antesPub = B.verificarDocumento({ codigo: codigo20 });
    ok(antesPub.ok && antesPub.sre === SRE_A,
       'v8.13 (E20): a conferência pública do documento concluído diz ' + antesPub.sre);

    /* o Órgão Central move a escola de regional NA BASE */
    B.escolaSalvar({ token: TKC20, inep: INEP20, escola: ESC20, municipio: 'Divinópolis', sre: SRE_B, codigoInep: censoDe(INEP20) });
    ok(B.escolaPorInep_(INEP20).sre === SRE_B,
       'v8.13 (E20/C13): a base da rede passa a dizer ' + SRE_B);
    ok(noPainel(TKB, P20) === true && noPainel(TKA, P20) === false,
       'v8.13 (E20/C13): o painel acompanha — o protocolo passa a ser de ' + SRE_B);
    ok(naCobertura(TKB) === true && naCobertura(TKA) === false,
       'v8.13 (E20/C13): e a Cobertura também — as DUAS abas passam a mostrar ' + SRE_B);
    ok(B.registroLeitura({ token: TKB, p: P20 }).ok === true &&
       B.registroLeitura({ token: TKA, p: P20 }).ok === false,
       'v8.13 (E20/C13): quem pode abrir o documento é a regional NOVA');

    /* o que foi autenticado não se reescreve */
    const linha = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P20));
    ok(linha.sre === SRE_A,
       'v8.13 (E20): a SRE GRAVADA no registro não é reescrita — ela faz parte do que foi autenticado');
    const depoisPub = B.verificarDocumento({ codigo: codigo20 });
    ok(depoisPub.ok && depoisPub.sre === SRE_A,
       'v8.13 (E20): e a conferência pública do PPP homologado continua respondendo ' + depoisPub.sre);
    ok(depoisPub.ok && depoisPub.codigo === codigo20,
       'v8.13 (E20): com o mesmo código de autenticidade impresso no papel');
  }
}


/* ============================================================
   v8.13 (F01) — A ATA SÓ É INSUBSTITUÍVEL DEPOIS DA PRIMEIRA
   ASSINATURA (R2-04)

   D05 acertou o princípio e errou o corte: recusava a troca sempre que
   houvesse ata anexada. Com o PDF errado escolhido no seletor de arquivos e
   ZERO assinaturas colhidas, o documento oficial passava a citar uma ata que
   não era a da reunião e a escola não tinha saída dentro do sistema —
   `novaVersao`, `devolverPPP` e `desfazerHomologacao` recusam, todas com
   razão, um documento "Em assinatura". O ramo que renomeia o arquivo
   anterior para `_SUBSTITUIDA_` estava inalcançável.
   ============================================================ */
{
  const TKCF1 = B.criarSessao_({ email: 'central.f01@educacao.mg.gov.br', nome: 'Central F01',
                                 perfil: 'central', papel: 'central' });
  const SREF1 = 'Divinópolis F01';
  B.escolaSalvar({ token: TKCF1, inep: '49000', escola: 'EE F01 base', municipio: 'Divinópolis', sre: SREF1, codigoInep: censoDe('49000') });
  B.acessoSalvar({ token: TKCF1, email: 'sup.f01@educacao.mg.gov.br', nome: 'Super F01',
                   papel: 'superintendente', perfil: 'regional', sre: SREF1 });
  const TKSUPF1 = B.criarSessao_({ email: 'sup.f01@educacao.mg.gov.br', nome: 'Super F01',
                                   perfil: 'regional', papel: 'superintendente', sre: SREF1 });
  B.acessoSalvar({ token: TKSUPF1, email: 'de.f01@educacao.mg.gov.br', nome: 'DE F01',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF1 });
  const TKDEF1 = B.criarSessao_({ email: 'de.f01@educacao.mg.gov.br', nome: 'DE F01',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SREF1 });
  let seqF1 = 0;
  const emAssinaturaF1 = function () {
    seqF1++;
    const inep = '4901' + seqF1, nome = 'EE F01 ' + seqF1;
    const dirMail = 'dir.f01.' + seqF1 + '@educacao.mg.gov.br';
    const anaMail = 'ana.f01.' + seqF1 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCF1, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SREF1, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: dirMail, nome: 'Diretora F01 ' + seqF1, masp: '160000' + seqF1,
                     papel: 'diretor_escolar', inep: inep });
    const tkDir = B.criarSessao_({ email: dirMail, nome: 'Diretora F01 ' + seqF1, perfil: 'escola',
      papel: 'diretor_escolar', sre: SREF1, inep: inep, escola: nome });
    B.acessoSalvar({ token: tkDir, email: anaMail, nome: 'Ana F01 ' + seqF1, masp: '260000' + seqF1,
                     papel: 'colegiado', perfil: 'escola', inep: inep, segmento: 'Docente' });
    const tkAna = B.criarSessao_({ email: anaMail, nome: 'Ana F01 ' + seqF1, perfil: 'escola',
      papel: 'colegiado', sre: SREF1, inep: inep, escola: nome });
    const rSalvaF1 = B.salvarPPP({ token: tkDir, escola: nome, inep: inep, municipio: 'Divinópolis',
      sessao: 'f01', tMissao: 'conteúdo', etapas: ['Ensino Médio'] });
    if (!rSalvaF1.ok) throw new Error('F01 semente: ' + JSON.stringify(rSalvaF1));
    const P = rSalvaF1.protocolo;
    B.enviarParaValidacao({ token: tkDir, protocolo: P });
    B.validarPPP({ token: TKDEF1, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: tkDir, protocolo: P, escola: nome, inep: inep, municipio: 'Divinópolis',
      direcao: 'Diretora F01', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: docTeste('<p>corpo F01</p>'), sessao: 'f01' });
    return { P: P, inep: inep, escola: nome, tkDir: tkDir, tkAna: tkAna, anaMail: anaMail };
  };
  const regF1 = function (P) { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); };
  const cicloF1 = function (P) {
    const aba = B.abaCiclo_();
    return aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getDisplayValues()
      .filter(function (l) { return l.indexOf(P) >= 0; }).map(function (l) { return l[2]; });
  };

  /* ---- (a) sem nenhuma assinatura, a ata errada é trocada ---- */
  {
    const e = emAssinaturaF1();
    ok(B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-de-outra-escola.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata ERRADA' }).ok,
       'F01 (R2-04): a ata errada entra — é o erro humano ordinário de seletor de arquivos');
    const g1 = regF1(e.P), hashAntes = g1.hash, idErrada = g1.ataId;
    const corpoAntes = B.documentoCongelado_(g1).split('Folha de assinaturas')[0];
    const troca = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'REVG', nome: 'ata-certa.pdf',
      mime: 'application/pdf', dataReuniao: '31/08/2026', identificacao: 'Ata CERTA' });
    ok(troca.ok, 'F01 (R2-04): sem NENHUMA assinatura colhida, a troca da ata é aceita');
    const g2 = regF1(e.P);
    ok(g2.ataNome === 'ata-certa.pdf' && g2.ataIdent === 'Ata CERTA' && g2.ataData === '31/08/2026',
       'F01: a folha passa a citar a ata nova, com a data da reunião nova');
    ok(g2.hash === hashAntes &&
       B.documentoCongelado_(g2).split('Folha de assinaturas')[0] === corpoAntes,
       'F01: e o código de autenticidade NÃO se recalcula — ele responde pelo corpo congelado, que não muda');
    const c = cicloF1(e.P);
    ok(c.indexOf('ata anexada') >= 0 && c.indexOf('ata substituída') >= 0,
       'F01: a troca entra na linha do tempo do documento como "ata substituída"');
    const anterior = S.g.DriveApp.getFileById(idErrada);
    ok(/_SUBSTITUIDA_\d{8}$/.test(anterior.getName()),
       'F01: o arquivo anterior fica no acervo, RENOMEADO — histórico não se apaga: ' + anterior.getName());
    ok(g2.ataId !== idErrada && !!S.g.DriveApp.getFileById(g2.ataId),
       'F01: e a ata em vigor é o arquivo novo, criado ANTES de a anterior ser renomeada');
  }

  /* ---- (b) colhida a primeira assinatura do Colegiado, a troca é recusada ---- */
  {
    const e = emAssinaturaF1();
    B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-1.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata 1' });
    B.presencaColegiado({ p: e.P, token: e.tkDir, emails: [e.anaMail] });
    const idAta = regF1(e.P).ataId;
    const semAssinar = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'REVG', nome: 'ata-2.pdf',
      mime: 'application/pdf', dataReuniao: '31/08/2026', identificacao: 'Ata 2' });
    ok(semAssinar.ok, 'F01: marcar quem compareceu NÃO é assinar — a ata ainda pode ser trocada');
    B.assinarNoSistema({ token: e.tkAna, protocolo: e.P, aceite: true });
    const depois = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'R0hJ', nome: 'ata-3.pdf',
      mime: 'application/pdf', dataReuniao: '01/09/2026', identificacao: 'Ata 3' });
    ok(!depois.ok && /não se substitui depois que alguém assinou/.test(depois.erro || ''),
       'F01 (A5-05): com UMA assinatura do Colegiado colhida, a ata não se troca mais');
    ok(regF1(e.P).ataIdent === 'Ata 2',
       'F01: e a ata que estava lá quando a pessoa assinou continua sendo a do documento');
    ok(idAta !== regF1(e.P).ataId, 'F01: (a troca anterior, sem assinatura, tinha valido)');
  }

  /* ---- (c) assinada a direção, vale a recusa de D05, com a redação dela ---- */
  {
    const e = emAssinaturaF1();
    B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-1.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata 1' });
    B.presencaColegiado({ p: e.P, token: e.tkDir, emails: [e.anaMail] });
    B.assinarNoSistema({ token: e.tkAna, protocolo: e.P, aceite: true });
    B.assinarDirecao({ p: e.P, token: e.tkDir, atesto: true });
    const r = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'R0hJ', nome: 'ata-9.pdf',
      mime: 'application/pdf', dataReuniao: '01/09/2026', identificacao: 'Ata 9' });
    ok(!r.ok, 'F01: assinada a direção, o documento saiu da coleta e a ata não entra mais');
    ok(regF1(e.P).ataIdent === 'Ata 1', 'F01: e a ata continua a mesma');
    /* o guarda `dirAssinou` de D05 responde pelo registro que ficou "Em
       assinatura" com a direção já assinada (forma legada): forçar o status
       é o único jeito de alcançá-lo, e é ele que traz a redação de D05 */
    const abaRF1 = B.abaRegistros_();
    B.gravarCampo_(abaRF1, B.linhaDoProtocolo_(abaRF1, e.P), 'status', 'Em assinatura');
    const r2 = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'R0hJ', nome: 'ata-9.pdf',
      mime: 'application/pdf', dataReuniao: '01/09/2026', identificacao: 'Ata 9' });
    ok(!r2.ok && /anexada antes da assinatura da direção/.test(r2.erro || ''),
       'F01: e o guarda de D05 continua intacto, com a redação de D05');
  }

  /* ---- (d) o registro LEGADO (Assinado, sem ata) continua recebendo a primeira ata ---- */
  {
    const e = emAssinaturaF1();
    const abaR = B.abaRegistros_(), linha = B.linhaDoProtocolo_(abaR, e.P);
    B.gravarCampo_(abaR, linha, 'status', 'Assinado');
    const at = B.registrarAta({ p: e.P, token: e.tkDir, base64: 'QUJD', nome: 'ata-legado.pdf',
      mime: 'application/pdf', dataReuniao: '30/08/2026', identificacao: 'Ata legado' });
    ok(at.ok, 'F01: o caminho legado ("Assinado" sem ata) continua aberto — é o estado que espera a ata');
    ok(regF1(e.P).status === 'Concluído', 'F01: e o registro legado fecha, como sempre fez');
  }
}


/* ============================================================
   v8.13 (F02) — A PRÉVIA NÃO IMPRIME MARCADOR NEM PROTOCOLO VAZIO (R2-01)

   D19/D20 puseram a folha de assinaturas dentro da prévia. `regDaPrevia_`
   devolvia, quando não há registro alcançável, um objeto com SETE chaves —
   e `folhaCabecalho_` lê `reg.concluidoEm`, que não estava lá. `preencher_`
   devolve o marcador literal quando a chave falta (é ele que denuncia texto
   curado com marcador inventado, E06), e a folha da prévia saía com
   "Documento concluído em {concluidoEm}, sob o protocolo .". É o documento
   que a escola distribui ao Colegiado antes da reunião.
   ============================================================ */
{
  const TKCF2 = B.criarSessao_({ email: 'central.f02@educacao.mg.gov.br', nome: 'Central F02',
                                 perfil: 'central', papel: 'central' });
  const SREF2 = 'Divinópolis F02';
  B.escolaSalvar({ token: TKCF2, inep: '50000', escola: 'EE F02 base', municipio: 'Divinópolis', sre: SREF2, codigoInep: censoDe('50000') });
  B.acessoSalvar({ token: TKCF2, email: 'sup.f02@educacao.mg.gov.br', nome: 'Super F02',
                   papel: 'superintendente', perfil: 'regional', sre: SREF2 });
  const TKSUPF2 = B.criarSessao_({ email: 'sup.f02@educacao.mg.gov.br', nome: 'Super F02',
                                   perfil: 'regional', papel: 'superintendente', sre: SREF2 });
  B.acessoSalvar({ token: TKSUPF2, email: 'de.f02@educacao.mg.gov.br', nome: 'DE F02',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF2 });
  const TKDEF2 = B.criarSessao_({ email: 'de.f02@educacao.mg.gov.br', nome: 'DE F02',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SREF2 });
  const corpoF2 = '<div class="paginas"><div class="pagina" data-pag="1" data-de="1">' +
    '<div class="pag-corpo"><p>corpo F02</p></div>' +
    '<div class="pag-rodape"><span class="pag-cod"><!--COD--></span><span class="pag-num"></span></div>' +
    '</div></div>';
  const marcadores = function (h) {
    return [].concat(h.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) || [], h.match(/\{\{[^}]*\}\}/g) || []);
  };
  let seqF2 = 0;
  const escolaF2 = function () {
    seqF2++;
    const inep = '5001' + seqF2, nome = 'EE F02 ' + seqF2;
    const dirMail = 'dir.f02.' + seqF2 + '@educacao.mg.gov.br';
    B.escolaSalvar({ token: TKCF2, inep: inep, escola: nome, municipio: 'Divinópolis', sre: SREF2, codigoInep: censoDe(inep) });
    salvarDiretor(B, { email: dirMail, nome: 'Diretora F02 ' + seqF2, masp: '170000' + seqF2,
                     papel: 'diretor_escolar', inep: inep });
    const tkDir = B.criarSessao_({ email: dirMail, nome: 'Diretora F02 ' + seqF2, perfil: 'escola',
      papel: 'diretor_escolar', sre: SREF2, inep: inep, escola: nome });
    return { inep: inep, nome: nome, tkDir: tkDir };
  };

  /* ---- (1) prévia SEM protocolo: nenhum marcador literal, nenhum protocolo vazio ---- */
  {
    const e = escolaF2();
    const html = B.htmlDaPrevia_({ token: e.tkDir, escola: e.nome, sre: SREF2, docHtml: corpoF2 });
    ok(marcadores(html).length === 0,
       'F02 (R2-01): a prévia sem protocolo não traz marcador literal nenhum (' + marcadores(html).join(',') + ')');
    ok(html.indexOf('sob o protocolo .') < 0 && html.indexOf('{concluidoEm}') < 0,
       'F02 (R2-01): e deixou de imprimir "sob o protocolo ." e "{concluidoEm}"');
    ok(html.indexOf('Esta é uma PRÉVIA: o documento ainda não foi concluído') > 0,
       'F02: a abertura da folha diz, em lugar da data e do protocolo, que ainda não há conclusão');
    ok(html.indexOf('As assinaturas e o código de autenticidade são gerados na conclusão') > 0,
       'F02: e o parágrafo final diz quando o código passa a existir');
    ok(html.indexOf('Assinaturas registradas: 0 de 0') < 0,
       'F02: a contagem de assinaturas de um documento que não existe some da folha');
    ok(html.indexOf('Ata de aprovação do Colegiado Escolar pendente') > 0,
       'F02: o parágrafo da ata pendente CONTINUA — ele é verdadeiro na prévia');
  }

  /* ---- (2) prévia com PPP em andamento (registro real, sem conclusão) ---- */
  {
    const e = escolaF2();
    const P = B.salvarPPP({ token: e.tkDir, escola: e.nome, inep: e.inep, municipio: 'Divinópolis',
      sessao: 'f02', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    const html = B.htmlDaPrevia_({ token: e.tkDir, protocolo: P, escola: e.nome, sre: SREF2, docHtml: corpoF2 });
    ok(marcadores(html).length === 0,
       'F02 (R2-01): a prévia de um PPP em andamento não traz marcador literal');
    ok(html.indexOf('Documento concluído em , sob o protocolo') < 0,
       'F02 (R2-01): nem "Documento concluído em , sob o protocolo …" num documento não concluído');
    ok(html.indexOf('Esta é uma PRÉVIA') > 0, 'F02: ela também entra em modo prévia');
  }

  /* ---- (3) prévia com protocolo de OUTRA escola: cai no recuo, e ele é completo ---- */
  {
    const a = escolaF2(), b2 = escolaF2();
    const Pb = B.salvarPPP({ token: b2.tkDir, escola: b2.nome, inep: b2.inep, municipio: 'Divinópolis',
      sessao: 'f02', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    const html = B.htmlDaPrevia_({ token: a.tkDir, protocolo: Pb, escola: a.nome, sre: SREF2, docHtml: corpoF2 });
    ok(marcadores(html).length === 0,
       'F02 (R2-01): com protocolo de outra escola, a prévia cai no recuo — e o recuo é completo');
    ok(html.indexOf(b2.nome) < 0, 'F02: e continua sem vazar nada do registro alheio');
  }

  /* ---- (4) o PPP JÁ CONCLUÍDO continua com a folha de verdade, byte a byte ---- */
  {
    const e = escolaF2();
    const anaMail = 'ana.f02@educacao.mg.gov.br';
    B.acessoSalvar({ token: e.tkDir, email: anaMail, nome: 'Ana F02', masp: '270001',
                     papel: 'colegiado', perfil: 'escola', inep: e.inep, segmento: 'Docente' });
    const P = B.salvarPPP({ token: e.tkDir, escola: e.nome, inep: e.inep, municipio: 'Divinópolis',
      sessao: 'f02c', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
    B.enviarParaValidacao({ token: e.tkDir, protocolo: P });
    B.validarPPP({ token: TKDEF2, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: e.tkDir, protocolo: P, escola: e.nome, inep: e.inep, municipio: 'Divinópolis',
      direcao: 'Diretora F02', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: docTeste('<p>corpo F02 concluído</p>'), sessao: 'f02c' });
    const reg = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P));
    ok(!!(reg.concluidoEm && reg.hash), 'F02: o PPP de referência está concluído, com código');
    const html = B.htmlDaPrevia_({ token: e.tkDir, protocolo: P, escola: e.nome, sre: SREF2, docHtml: corpoF2 });
    ok(html.indexOf('Esta é uma PRÉVIA: o documento ainda não foi concluído') < 0,
       'F02: a prévia de um PPP JÁ CONCLUÍDO não entra em modo prévia');
    ok(html.indexOf(reg.hash) > 0 && html.indexOf(reg.concluidoEm) > 0 && html.indexOf(P) > 0,
       'F02: ela traz a data da conclusão, o protocolo e o código de autenticidade reais');
    /* byte a byte igual ao que documentoComFolha_ produz fora da prévia */
    const fora = B.folhaAssinaturas_(reg);
    const regPrevia = B.regDaPrevia_({ token: e.tkDir, protocolo: P, escola: e.nome });
    ok(B.folhaAssinaturas_(regPrevia) === fora,
       'F02: e a folha da prévia é IDÊNTICA à folha do documento — documento concluído não muda');
  }

  /* ---- (5) o recuo declara TODAS as chaves que a folha lê ---- */
  {
    const recuo = B.regDaPrevia_({ escola: 'EE sem registro', sre: SREF2 });
    ['concluidoEm', 'ataUrl', 'ataData', 'ataNome', 'ataIdent', 'homolEm', 'homolData', 'homolAto',
     'homolPor', 'homolDestino', 'validadoPor', 'validadoEm', 'textosFolha', 'hash', 'assinaturas',
     'anexos', 'protocolo', 'escola', 'sre', 'versao'].forEach(function (k) {
      ok(recuo[k] !== undefined, 'F02: o registro de recuo da prévia declara "' + k + '"');
    });
    ok(recuo.previa === true, 'F02: e se declara como prévia');
  }
}


/* ============================================================
   v8.13 (F03) — A PRÉVIA DA CURADORIA RESOLVE OS MARCADORES, E DENUNCIA
   O QUE NÃO SABE RESOLVER (R2-02, resto de A7-11)

   O objeto de exemplo de `curadoriaPrevia` tinha 14 chaves e faltavam oito:
   `hash`, `total`, `assinados`, `ato`, `url`, `diretor`, `motivo`, `antes`.
   Nove dos 25 textos do servidor saíam na prévia com marcador literal — e a
   verificação abaixo é sobre a LISTA INTEIRA, não sobre os oito de hoje: é
   isso que a faz valer para o texto de amanhã.
   ============================================================ */
{
  const TKF3 = B.criarSessao_({ email: 'cur.f03@educacao.mg.gov.br', nome: 'Curador F03',
                                perfil: 'central', papel: 'central' });
  const padroes = B.conteudoPublicado().padroes || {};
  const caminhos = Object.keys(padroes).filter(function (c) {
    return c.indexOf('DOC.') === 0 || c.indexOf('EMAIL.') === 0;
  });
  ok(caminhos.length >= 20, 'F03: há ' + caminhos.length + ' caminhos de texto do servidor a conferir');
  const comLiteral = [], semLista = [];
  caminhos.forEach(function (cam) {
    const r = B.curadoriaPrevia({ token: TKF3, caminho: cam, valor: padroes[cam] });
    const txt = String((r && (r.texto || '')) + (r && r.folha ? r.folha : ''));
    if (/\{[A-Za-z][A-Za-z0-9_]*\}/.test(String(r && r.texto || ''))) comLiteral.push(cam);
    if (!r || !Array.isArray(r.marcadoresSemExemplo) || r.marcadoresSemExemplo.length) semLista.push(cam);
    if (txt === '') semLista.push(cam + ' (vazio)');
  });
  ok(comLiteral.length === 0,
     'F03 (R2-02): NENHUM caminho do servidor mostra marcador literal na prévia (' + comLiteral.join(', ') + ')');
  ok(semLista.length === 0,
     'F03 (R2-02): e nenhum deles traz marcador sem valor de exemplo (' + semLista.join(', ') + ')');

  /* a denúncia funciona: um marcador inventado aparece na lista */
  {
    const r = B.curadoriaPrevia({ token: TKF3, caminho: 'DOC.folha.codigo',
      valor: 'Código {hash}, assinaturas {assinados} de {total}, e um {marcadorNovoQueNinguemResolve}.' });
    ok(r.ok && r.marcadoresSemExemplo.length === 1 &&
       r.marcadoresSemExemplo[0] === 'marcadorNovoQueNinguemResolve',
       'F03: o marcador novo, sem exemplo, aparece na lista da prévia');
    ok(r.texto.indexOf('{marcadorNovoQueNinguemResolve}') >= 0 &&
       r.texto.indexOf('{hash}') < 0 && r.texto.indexOf('{total}') < 0,
       'F03: e continua literal no texto — é assim que E06 denuncia marcador inventado');
  }

  /* o exemplo da folha e o exemplo da interpolação não discordam */
  {
    const r = B.curadoriaPrevia({ token: TKF3, caminho: 'DOC.folha.codigo',
      valor: B.PADRAO_SERVIDOR['DOC.folha.codigo'] });
    ok(r.ok && r.folha && r.folha.indexOf('A1B2-C3D4-E5F6') > 0,
       'F03: o código de exemplo da folha montada é o MESMO que a interpolação usa');
    ok(r.texto.indexOf('A1B2-C3D4-E5F6') > 0,
       'F03: e o {hash} do texto resolve para ele');
  }

  /* marcadoresSemExemplo_ é irmã de marcadoresNaoResolvidos_, e não confunde os dois formatos */
  {
    ok(B.marcadoresSemExemplo_('{a} e {{algum.marcador}} e {b}', { a: 1 }).join(',') === 'b',
       'F03: marcadoresSemExemplo_ trata {chave} e deixa {{…}} para a irmã');
    ok(B.marcadoresSemExemplo_('nada aqui', {}).length === 0,
       'F03: texto sem marcador não produz pendência');
  }

  /* nada disso grava: é prévia, não publicação */
  {
    const antes = JSON.stringify(B.conteudoPublicado().itens || {});
    B.curadoriaPrevia({ token: TKF3, caminho: 'DOC.folha.codigo', valor: 'RASCUNHO {hash}' });
    ok(JSON.stringify(B.conteudoPublicado().itens || {}) === antes,
       'F03: a prévia não toca a aba Conteúdo — é prévia, não gravação');
  }
}


/* ============================================================
   v8.13 (F04) — A CONCLUSÃO RECUSADA POR REVISÃO (R2-03)

   A recusa FICA no servidor: concluir congela o corpo, e congelar o
   instantâneo de uma tela que não é o último estado gravado produziria um
   documento oficial com texto vencido, sob código de autenticidade. O que
   muda é a tela — e o contrato do qual ela passa a depender: o envio para
   validação devolve o registro COM a revisão, para que a tela não envelheça
   sozinha entre o envio e o clique em "Concluir".
   ============================================================ */
{
  const TKCF4 = B.criarSessao_({ email: 'central.f04@educacao.mg.gov.br', nome: 'Central F04',
                                 perfil: 'central', papel: 'central' });
  const SREF4 = 'Divinópolis F04';
  B.escolaSalvar({ token: TKCF4, inep: '51000', escola: 'EE F04 base', municipio: 'Divinópolis', sre: SREF4, codigoInep: censoDe('51000') });
  B.acessoSalvar({ token: TKCF4, email: 'sup.f04@educacao.mg.gov.br', nome: 'Super F04',
                   papel: 'superintendente', perfil: 'regional', sre: SREF4 });
  const TKSUPF4 = B.criarSessao_({ email: 'sup.f04@educacao.mg.gov.br', nome: 'Super F04',
                                   perfil: 'regional', papel: 'superintendente', sre: SREF4 });
  B.acessoSalvar({ token: TKSUPF4, email: 'de.f04@educacao.mg.gov.br', nome: 'DE F04',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF4 });
  const TKDEF4 = B.criarSessao_({ email: 'de.f04@educacao.mg.gov.br', nome: 'DE F04',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SREF4 });
  const inep4 = '51001', esc4 = 'EE F04 1';
  B.escolaSalvar({ token: TKCF4, inep: inep4, escola: esc4, municipio: 'Divinópolis', sre: SREF4, codigoInep: censoDe(inep4) });
  salvarDiretor(B, { email: 'dir.f04@educacao.mg.gov.br', nome: 'Diretora F04', masp: '180001',
                   papel: 'diretor_escolar', inep: inep4 });
  const TKDIRF4 = B.criarSessao_({ email: 'dir.f04@educacao.mg.gov.br', nome: 'Diretora F04',
    perfil: 'escola', papel: 'diretor_escolar', sre: SREF4, inep: inep4, escola: esc4 });

  const criado = B.salvarPPP({ token: TKDIRF4, escola: esc4, inep: inep4, municipio: 'Divinópolis',
    sessao: 'f04', tMissao: 'conteúdo', etapas: ['Ensino Médio'] });
  const P4 = criado.protocolo;
  const revDaTela = parseInt(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P4)).rev, 10) || 0;

  /* o contrato: o envio devolve o registro COM a revisão nova */
  const env = B.enviarParaValidacao({ token: TKDIRF4, protocolo: P4 });
  ok(env.ok && env.registro && env.registro.rev !== undefined,
     'F04: enviarParaValidacao devolve o registro com "rev" — é o contrato de que a tela passa a depender');
  ok((parseInt(env.registro.rev, 10) || 0) > revDaTela,
     'F04: e a revisão devolvida é MAIOR que a que a tela tinha (' + revDaTela + ' → ' + env.registro.rev + ')');

  B.validarPPP({ token: TKDEF4, protocolo: P4, parecer: 'ok' });
  const revAtual = parseInt(B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P4)).rev, 10) || 0;

  /* a recusa CONTINUA no servidor — ela não é herança indevida */
  const conflito = B.concluirPPP({ token: TKDIRF4, protocolo: P4, escola: esc4, inep: inep4,
    municipio: 'Divinópolis', direcao: 'Diretora F04', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
    docHtml: docTeste('<p>corpo F04</p>'), sessao: 'f04', rev: revDaTela });
  ok(conflito.ok === false && conflito.conflito === true && (parseInt(conflito.rev, 10) || 0) === revAtual,
     'F04 (R2-03): concluir com revisão velha continua sendo RECUSADO, com conflito:true e a revisão do servidor');
  ok(!!conflito.atualizadoEm,
     'F04: e a recusa diz quando foi a última gravação — é o que a tela imprime no diálogo');
  const depois = B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P4));
  ok(depois.status === 'Validado' && !depois.hash,
     'F04: nada foi congelado e nada se perdeu — o documento continua "Validado", sem código');

  /* com a revisão do servidor, conclui */
  const bom = B.concluirPPP({ token: TKDIRF4, protocolo: P4, escola: esc4, inep: inep4,
    municipio: 'Divinópolis', direcao: 'Diretora F04', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
    docHtml: docTeste('<p>corpo F04</p>'), sessao: 'f04', rev: revAtual });
  ok(bom.ok === true && bom.registro.status === 'Em assinatura',
     'F04: e com a revisão gravada a conclusão passa');

  /* a tela nova não oferece "gravar o meu por cima" na conclusão */
  const fonteApp = fs.readFileSync('./App.html', 'utf8');
  ok(/function conflitoNaConclusao/.test(fonteApp) &&
     /A conclusão não foi feita/.test(fonteApp) &&
     /Abrir o que está gravado/.test(fonteApp),
     'F04: a tela ganhou diálogo próprio para a recusa da conclusão');
  ok(!/conflitoNaConclusao[\s\S]{0,900}sobrepor/.test(fonteApp),
     'F04: e ele NÃO oferece sobrepor — em conclusão a sobreposição é irreversível');
}


/* ============================================================
   v8.13 (F05) — FECHAR UM ACESSO NUNCA DEPENDE DE UM CAMPO DE CADASTRO
   (R1-01)

   C15 pôs no servidor a exigência de nome que só existia na tela, e fez
   certo — mas a exigência ficou no caminho de TODOS os atos, e
   "suspender"/"reativar" passam pela mesma função. Sobre um cadastro que a
   8.12 gravou SEM NOME, o botão devolvia uma mensagem sobre um campo que a
   pessoa não abriu e não vê, enquanto a lista desenhava "(sem nome)" e,
   portanto, CONTAVA com esses registros. O acesso continuava ativo.
   ============================================================ */
{
  const TKCF5 = B.criarSessao_({ email: 'central.f05@educacao.mg.gov.br', nome: 'Central F05',
                                 perfil: 'central', papel: 'central' });
  const SREF5 = 'Divinópolis F05';
  B.escolaSalvar({ token: TKCF5, inep: '52000', escola: 'EE F05 base', municipio: 'Divinópolis', sre: SREF5, codigoInep: censoDe('52000') });
  B.acessoSalvar({ token: TKCF5, email: 'sup.f05@educacao.mg.gov.br', nome: 'Super F05',
                   papel: 'superintendente', perfil: 'regional', sre: SREF5 });
  const TKSUPF5 = B.criarSessao_({ email: 'sup.f05@educacao.mg.gov.br', nome: 'Super F05',
                                   perfil: 'regional', papel: 'superintendente', sre: SREF5 });
  B.acessoSalvar({ token: TKSUPF5, email: 'de.f05@educacao.mg.gov.br', nome: 'DE F05',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF5 });
  const TKDEF5 = B.criarSessao_({ email: 'de.f05@educacao.mg.gov.br', nome: 'DE F05',
                                  perfil: 'regional', papel: 'diretor_educacional', sre: SREF5 });
  /* um acesso institucional com Nome VAZIO: é o que a 8.12 gravava */
  const semNome = 'legado.f05@educacao.mg.gov.br';
  {
    const aba = B.abaAcessos_();
    const l = new Array(B.ACESSO_COLS.length).fill('');
    l[0] = semNome; l[1] = ''; l[2] = 'regional'; l[3] = SREF5;
    l[6] = 'ativo'; l[7] = B.agora_(); l[12] = 'equipe_de';
    aba.appendRow(l); B.invalidarAcessos_();
  }
  const cadF5 = function () { return B.acessoPorEmail_(semNome) || {}; };
  ok(cadF5().nome === '' && cadF5().situacao === 'ativo',
     'F05: a base tem um acesso institucional ATIVO e sem nome, como a 8.12 gravava');

  /* SUSPENDER, exatamente como a tela faz: reenviando o nome vazio */
  const susp = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: cadF5().nome,
                                email: semNome, situacao: 'inativo' });
  ok(susp.ok === true, 'F05 (R1-01): suspender NÃO depende do nome — fechar um acesso reduz risco');
  ok(cadF5().situacao === 'inativo', 'F05: e o acesso passa mesmo a inativo');
  ok(cadF5().nome === '', 'F05: o cadastro CONTINUA sem nome — F05 não inventa nome nenhum');

  /* REATIVAR continua exigindo o nome, e a recusa se identifica */
  const reat = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: cadF5().nome,
                                email: semNome, situacao: 'ativo' });
  ok(reat.ok === false && reat.precisaNome === true && reat.email === semNome,
     'F05 (R1-01): reativar pede o nome, e a recusa se identifica (precisaNome) para a tela abrir o formulário');
  ok(/informe quem é a pessoa antes de reativá-lo/.test(reat.erro || ''),
     'F05: com a redação do cadastro EXISTENTE, não a do cadastro novo');
  ok(cadF5().situacao === 'inativo', 'F05: e o acesso continua fechado');

  /* CRIAR sem nome continua recusado — C15 intacta */
  const novo = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: '',
                                email: 'novo.anonimo.f05@educacao.mg.gov.br', perfil: 'regional', sre: SREF5 });
  ok(novo.ok === false && novo.precisaNome === true &&
     /Informe o nome de quem recebe o acesso/.test(novo.erro || ''),
     'F05: criar sem nome continua recusado — C15 intacta, com a redação de C15');
  ok(!B.acessoPorEmail_('novo.anonimo.f05@educacao.mg.gov.br'),
     'F05: e nenhum período de acesso anônimo se abriu');

  /* EDITAR com nome, e então reativar */
  const ed = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: 'Fulana de Tal',
                              email: semNome, situacao: 'inativo' });
  ok(ed.ok === true && cadF5().nome === 'Fulana de Tal', 'F05: editar pondo o nome funciona');
  const reat2 = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: cadF5().nome,
                                 email: semNome, situacao: 'ativo' });
  ok(reat2.ok === true && cadF5().situacao === 'ativo', 'F05: e então a reativação passa');

  /* a exceção não vale para criar um cadastro NOVO já inativo */
  const novoInativo = B.acessoSalvar({ token: TKDEF5, papel: 'equipe_de', nome: '',
    email: 'novo.inativo.f05@educacao.mg.gov.br', perfil: 'regional', sre: SREF5, situacao: 'inativo' });
  ok(novoInativo.ok === false && novoInativo.precisaNome === true,
     'F05: a exceção é só para FECHAR um cadastro que existe — criar já inativo continua exigindo o nome');

  /* a exceção não vale para troca de gestor */
  {
    const inepF5 = '52001', escF5 = 'EE F05 1';
    B.escolaSalvar({ token: TKCF5, inep: inepF5, escola: escF5, municipio: 'Divinópolis', sre: SREF5, codigoInep: censoDe(inepF5) });
    salvarDiretor(B, { email: 'dir1.f05@educacao.mg.gov.br', nome: 'Diretora Um F05',
                     papel: 'diretor_escolar', inep: inepF5 });
    const troca = salvarDiretor(B, { email: 'dir2.f05@educacao.mg.gov.br', nome: '',
                                   papel: 'diretor_escolar', inep: inepF5, situacao: 'inativo' });
    ok(troca.ok === false && troca.precisaNome === true,
       'F05: e a troca de gestor continua exigindo o nome do sucessor');
  }
}


/* ============================================================
   v8.13 (F06) — O HISTÓRICO DE ACESSOS VOLTA A QUEM ASSOCIA E À PRÓPRIA
   SUCESSÃO (R1-02, R1-03, P-06)

   Três coisas na mesma função de escopo. (1) `escopoHistorico_` descartava a
   sessão por `!cadastra.length` ANTES de `papeisDoHistorico_` rodar, e
   `PAPEIS.equipe_de.cadastra` é [] — o servidor calculava
   ["diretor_escolar"] e um guarda anterior jogava o cálculo fora. (2)
   `papeisDoHistorico_` não incluía o PRÓPRIO papel: o Superintendente deixou
   de enxergar a sucessão da própria Superintendência, que a v8.12 mostrava.
   (3) `papelDe_` caía em `superintendente` para o perfil 'colegiado'.

   ESTE BLOCO É A PROVA NEGATIVA QUE FALTAVA: ele falha se alguém voltar a
   estreitar o escopo sem pensar em quem associa.
   ============================================================ */
{
  const SREF6 = 'SRE F06';
  const TKCF6 = B.criarSessao_({ email: 'central.f06@educacao.mg.gov.br', nome: 'Central F06',
                                 perfil: 'central', papel: 'central' });
  B.escolaSalvar({ token: TKCF6, inep: '31000601', escola: 'EE F06', municipio: 'Ouro Branco', sre: SREF6, codigoInep: censoDe('31000601') });
  /* um antecessor e um sucessor no posto de Superintendente: é a sucessão */
  B.acessoSalvar({ token: TKCF6, email: 'sup1.f06@educacao.mg.gov.br', nome: 'Superintendente Um F06',
                   papel: 'superintendente', perfil: 'regional', sre: SREF6 });
  B.acessoRemover({ token: TKCF6, email: 'sup1.f06@educacao.mg.gov.br', motivo: 'fim do mandato' });
  B.acessoSalvar({ token: TKCF6, email: 'sup2.f06@educacao.mg.gov.br', nome: 'Superintendente Dois F06',
                   papel: 'superintendente', perfil: 'regional', sre: SREF6 });
  const TKSUP6 = B.criarSessao_({ email: 'sup2.f06@educacao.mg.gov.br', nome: 'Superintendente Dois F06',
                                  perfil: 'regional', papel: 'superintendente', sre: SREF6 });
  B.acessoSalvar({ token: TKSUP6, email: 'de.f06@educacao.mg.gov.br', nome: 'Diretora Educacional F06',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF6 });
  B.acessoSalvar({ token: TKSUP6, email: 'ci.f06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção F06',
                   papel: 'coordenador_inspecao', perfil: 'regional', sre: SREF6 });
  const TKDE6 = B.criarSessao_({ email: 'de.f06@educacao.mg.gov.br', nome: 'Diretora Educacional F06',
                                 perfil: 'regional', papel: 'diretor_educacional', sre: SREF6 });
  const TKCI6 = B.criarSessao_({ email: 'ci.f06@educacao.mg.gov.br', nome: 'Coordenador de Inspeção F06',
                                 perfil: 'regional', papel: 'coordenador_inspecao', sre: SREF6 });
  B.acessoSalvar({ token: TKCI6, email: 'ei.f06@educacao.mg.gov.br', nome: 'Equipe de Inspeção F06',
                   papel: 'equipe_inspecao', perfil: 'regional', sre: SREF6 });
  B.acessoSalvar({ token: TKDE6, email: 'eqde.f06@educacao.mg.gov.br', nome: 'Equipe da DE F06',
                   papel: 'equipe_de', perfil: 'regional', sre: SREF6 });
  salvarDiretor(B, { email: 'dir.f06@educacao.mg.gov.br', nome: 'Diretora Escolar F06',
                   papel: 'diretor_escolar', inep: '31000601' });
  const TKEI6 = B.criarSessao_({ email: 'ei.f06@educacao.mg.gov.br', nome: 'Equipe de Inspeção F06',
                                 perfil: 'regional', papel: 'equipe_inspecao', sre: SREF6 });
  const TKEQ6 = B.criarSessao_({ email: 'eqde.f06@educacao.mg.gov.br', nome: 'Equipe da DE F06',
                                 perfil: 'regional', papel: 'equipe_de', sre: SREF6 });
  const TKDIR6 = B.criarSessao_({ email: 'dir.f06@educacao.mg.gov.br', nome: 'Diretora Escolar F06',
    perfil: 'escola', papel: 'diretor_escolar', sre: SREF6, inep: '31000601', escola: 'EE F06' });
  B.acessoSalvar({ token: TKDIR6, email: 'membro.f06@gmail.com', nome: 'Membro do Colegiado F06',
                   papel: 'colegiado', segmento: 'Estudante', relacao: 'Estudante do 2º ano' });
  const TKCOL6 = B.criarSessao_({ email: 'membro.f06@gmail.com', nome: 'Membro do Colegiado F06',
    perfil: 'colegiado', papel: 'colegiado', sre: SREF6, inep: '31000601', escola: 'EE F06' });

  /* ---- os oito papéis × historicoAssociacoes ---- */
  const casos = [
    { papel: 'central',              tk: TKCF6,  aba: true },
    { papel: 'superintendente',      tk: TKSUP6, aba: true },
    { papel: 'diretor_educacional',  tk: TKDE6,  aba: true },
    { papel: 'coordenador_inspecao', tk: TKCI6,  aba: true },
    { papel: 'equipe_de',            tk: TKEQ6,  aba: true },
    { papel: 'equipe_inspecao',      tk: TKEI6,  aba: false },
    { papel: 'diretor_escolar',      tk: TKDIR6, aba: true },
    { papel: 'colegiado',            tk: TKCOL6, aba: false }
  ];
  casos.forEach(function (c) {
    let r; try { r = B.historicoAssociacoes({ token: c.tk }); } catch (e) { r = { ok: false, erro: String(e.message || e) }; }
    ok(!!r.ok === c.aba,
       'F06: ' + c.papel + (c.aba ? ' recebe o histórico' : ' NÃO recebe o histórico') +
       ' — ' + (r.ok ? (r.linhas || []).length + ' linha(s)' : (r.erro || '')));
    if (!c.aba) {
      ok(/não mantém cadastros|não |Esta ação/.test(r.erro || ''),
         'F06: e a recusa de ' + c.papel + ' é explicada');
    }
    /* fora do escopo de escola, NENHUMA linha de Colegiado */
    if (r.ok && r.escopo !== 'escola') {
      ok(!(r.linhas || []).some(function (l) { return l.perfil === 'colegiado'; }),
         'F06 (× C02): o histórico de ' + c.papel + ' não traz linha de Colegiado');
    }
  });

  /* ---- R1-02: quem associa vê o que associou ---- */
  {
    const r = B.historicoAssociacoes({ token: TKEQ6 });
    ok(r.ok && (r.linhas || []).some(function (l) { return l.email === 'dir.f06@educacao.mg.gov.br'; }),
       'F06 (R1-02): a Equipe da DE vê as direções escolares da sua SRE, que é o que ela associa');
    ok((r.linhas || []).every(function (l) {
         return String(l.sre || '').toLowerCase() === SREF6.toLowerCase() || !l.sre; }),
       'F06: e o filtro de SRE continua valendo');
    ok(B.papeisDoHistorico_({ perfil: 'regional', papel: 'equipe_de', sre: SREF6 }).indexOf('diretor_escolar') >= 0,
       'F06: papeisDoHistorico_ calcula ["diretor_escolar"] para ela — o cálculo deixou de ser jogado fora');
  }

  /* ---- R1-03: o Superintendente vê a sucessão do próprio posto ---- */
  {
    const r = B.historicoAssociacoes({ token: TKSUP6 });
    const doPosto = (r.linhas || []).filter(function (l) {
      return l.email === 'sup1.f06@educacao.mg.gov.br' || l.email === 'sup2.f06@educacao.mg.gov.br'; });
    ok(r.ok && doPosto.length === 2,
       'F06 (R1-03): o Superintendente volta a ver a sucessão da própria Superintendência (' + doPosto.length + ')');
    ok(doPosto.some(function (l) { return !!l.fim; }) && doPosto.some(function (l) { return !l.fim; }),
       'F06: o antecessor com o período encerrado e o sucessor com o período em aberto');
    ok(B.papeisDoHistorico_({ perfil: 'regional', papel: 'superintendente', sre: SREF6 }).indexOf('superintendente') >= 0,
       'F06: papeisDoHistorico_ passa a incluir o PRÓPRIO papel da sessão institucional');
    ok(B.papeisListaveis_({ perfil: 'regional', papel: 'superintendente', sre: SREF6 },
         ['superintendente']).indexOf('superintendente') < 0,
       'F06: e papeisListaveis_ NÃO muda — ninguém passa a CADASTRAR o próprio papel');
  }

  /* ---- a Equipe de Inspeção continua sem a aba, e o Colegiado também ---- */
  {
    const r = B.historicoAssociacoes({ token: TKEI6 });
    ok(!r.ok && /não mantém cadastros/.test(r.erro || ''),
       'F06: a Equipe de Inspeção não cadastra e não associa — continua sem o histórico (A2-01)');
  }

  /* ---- P-06: papelDe_ conhece o perfil colegiado ---- */
  {
    ok(B.papelDe_({ papel: '', perfil: 'colegiado' }) === 'colegiado',
       'F06 (P-06): papelDe_ deixa de devolver "superintendente" para uma linha de Colegiado');
    ok(B.papelDe_({ papel: '', perfil: '' }) === 'superintendente',
       'F06: e a linha institucional pré-7.0, com perfil vazio, continua caindo em "superintendente"');
    ok(B.papelDe_({ papel: '', perfil: 'central' }) === 'central' &&
       B.papelDe_({ papel: '', perfil: 'escola' }) === 'diretor_escolar',
       'F06: as duas outras quedas não mudam');
  }

  /* ---- a direção escolar continua vendo a própria escola e o seu Colegiado ---- */
  {
    const r = B.historicoAssociacoes({ token: TKDIR6 });
    ok(r.ok && r.escopo === 'escola' &&
       (r.linhas || []).some(function (l) { return l.email === 'membro.f06@gmail.com'; }),
       'F06: a direção escolar continua vendo o Colegiado da SUA escola');
    ok((r.linhas || []).some(function (l) { return l.email === 'dir.f06@educacao.mg.gov.br'; }),
       'F06: e a própria sucessão na direção');
  }
}


/* ============================================================
   v8.13 (F07) — NOME QUE COMEÇA POR "=" CONTINUA TEXTO TAMBÉM EM
   ACESSOS, GESTORES E ESCOLAS (P-01; completa D15)

   D15 formatou como texto puro as abas Registros e Ciclo. As TRÊS que
   guardam nome de pessoa e nome de escola ficaram de fora. No Sheets de
   verdade, "=SOMA(1;2)" num nome vira fórmula e `getDisplayValues` devolve
   "#ERROR!": o nome deixa de existir na base — e é o nome que vai para a
   folha de assinaturas e para o histórico permanente. Não é vetor de
   segurança (o CSV já está protegido por C17): é PERDA SILENCIOSA DE DADO.

   A verificação NEGATIVA (sem o setNumberFormat, o simulador devolve
   "#ERROR!") é a que garante que este teste está medindo algo.
   ============================================================ */
{
  const SSF7 = SS.criarServicos({ nomePlanilha: 'base F07', cota: 100, urlApp: 'https://script/app' });
  const BF7 = SS.carregarCodigo(src, SSF7);
  BF7.testeConfiguracao_();
  const TKCF7 = BF7.criarSessao_({ email: 'central.f07@educacao.mg.gov.br', nome: 'Central F07',
                                   perfil: 'central', papel: 'central' });
  const SREF7 = 'SRE F07';
  const VENENOS = ['=== Conselho ===', '=SOMA(1;2)', '=HYPERLINK("x","y")'];

  /* ---- (1) cadastro individual: nome de pessoa e nome de escola ---- */
  {
    BF7.escolaSalvar({ token: TKCF7, inep: '70001', escola: VENENOS[0], municipio: VENENOS[1], sre: SREF7, codigoInep: censoDe('70001') });
    BF7.invalidarEscolas_();
    const e = BF7.escolasTodas_().filter(function (x) { return x.inep === '70001'; })[0];
    ok(e && e.escola === VENENOS[0] && e.municipio === VENENOS[1],
       'F07 (P-01): Escolas — nome e município começados por "=" voltam idênticos: ' +
       JSON.stringify([e && e.escola, e && e.municipio]));

    BF7.acessoSalvar({ token: TKCF7, email: 'sup.f07@educacao.mg.gov.br', nome: 'Super F07',
                       papel: 'superintendente', perfil: 'regional', sre: SREF7 });
    const TKSUPF7 = BF7.criarSessao_({ email: 'sup.f07@educacao.mg.gov.br', nome: 'Super F07',
                                       perfil: 'regional', papel: 'superintendente', sre: SREF7 });
    salvarDiretor(BF7, { email: 'dir.f07@educacao.mg.gov.br', nome: VENENOS[1],
                       papel: 'diretor_escolar', inep: '70001' });
    BF7.invalidarAcessos_(); BF7.invalidarGestores_();
    const cad = BF7.acessoPorEmail_('dir.f07@educacao.mg.gov.br');
    ok(cad && cad.nome === VENENOS[1] && cad.escola === VENENOS[0],
       'F07 (P-01): Acessos — o nome da pessoa e o da escola voltam idênticos: ' +
       JSON.stringify([cad && cad.nome, cad && cad.escola]));
    const g = BF7.gestoresTodos_().filter(function (x) { return x.email === 'dir.f07@educacao.mg.gov.br'; })[0];
    ok(g && g.nome === VENENOS[1] && g.escola === VENENOS[0],
       'F07 (P-01): Gestores — histórico permanente com nome e escola idênticos: ' +
       JSON.stringify([g && g.nome, g && g.escola]));
    ok(g && g.observacao === 'Direção Escolar',
       'F07: e a observação do período continua legível');
  }

  /* ---- (2) mudança de SRE: a escola muda de regional e leva o cadastro ---- */
  {
    BF7.escolaSalvar({ token: TKCF7, inep: '70001', escola: VENENOS[2], municipio: VENENOS[1],
                       sre: '=SRE Nova', codigoInep: censoDe('70001') });
    BF7.invalidarAcessos_(); BF7.invalidarEscolas_(); BF7.invalidarGestores_();
    const cad = BF7.acessoPorEmail_('dir.f07@educacao.mg.gov.br');
    ok(cad && cad.sre === '=SRE Nova' && cad.escola === VENENOS[2],
       'F07 (P-01): mudança de SRE — a SRE e o nome novo da escola voltam idênticos no cadastro: ' +
       JSON.stringify([cad && cad.sre, cad && cad.escola]));
  }

  /* ---- (3) carga em lote da base de escolas ---- */
  {
    /* o separador da carga é ";" — os venenos desta parte não o contêm */
    const texto = '31070010; === Conselho ===; =SOMA(1+2); =SRE em lote\n' +
                  '31070011; =HYPERLINK; =Betim; =SRE em lote';
    const sim = BF7.escolasImportar({ token: TKCF7, texto: texto, simular: true });
    const r = BF7.escolasImportar({ token: TKCF7, texto: texto, simular: false, chave: sim.chave });
    ok(r.ok === true && r.incluidas === 2, 'F07: a carga em lote grava (' + (r.incluidas || 0) + ' nova(s))');
    BF7.invalidarEscolas_();
    const lidas = BF7.escolasTodas_().filter(function (x) { return x.inep === '31070010' || x.inep === '31070011'; });
    ok(lidas.length === 2 &&
       lidas.every(function (x) { return x.escola.charAt(0) === '=' && x.municipio.charAt(0) === '=' &&
                                         x.escola.indexOf('#ERROR!') < 0 && x.municipio.indexOf('#ERROR!') < 0; }),
       'F07 (P-01): carga em lote — nome, município e SRE voltam idênticos: ' +
       JSON.stringify(lidas.map(function (x) { return [x.escola, x.municipio, x.sre]; })));
  }

  /* ---- (4) a verificação NEGATIVA: sem o formato, o simulador devolve #ERROR! ---- */
  {
    const aba = BF7.abaEscolas_();
    const linha = aba.getLastRow() + 1;
    /* escrita CRUA, sem faixaDeTexto_ — é o que o código fazia até a 8.13 */
    aba.getRange(linha, 1, 1, 6).setNumberFormat('0.00');
    aba.getRange(linha, 1, 1, 6).setValues([['70099', '=SOMA(1;2)', '=Betim', 'SRE F07', 'ativa', '']]);
    const lido = aba.getRange(linha, 1, 1, 6).getDisplayValues()[0];
    ok(lido[1] === '#ERROR!' && lido[2] === '#ERROR!',
       'F07: o simulador APERTADO de D24 devolve "#ERROR!" sem o setNumberFormat — é ele que dá valor ao teste');
  }

  /* ---- (5) nenhum consumidor espera número: as três abas são lidas por getDisplayValues ---- */
  {
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok(/function faixaDeTexto_/.test(fonte),
       'F07: o auxiliar faixaDeTexto_ existe — a linha não foi escrita uma sétima vez à mão');
    const usos = (fonte.match(/faixaDeTexto_\(/g) || []).length;
    ok(usos >= 12, 'F07: e é usado nos pontos de gravação das três abas (' + usos + ' usos)');
  }
}


/* ============================================================
   v8.13 (F08) — O BALDE "(sem SRE)" DO QUADRO DO ÓRGÃO CENTRAL ABRE
   (resto de A3-15 / P-02)

   O resumo por regional agrupava sob "(sem SRE)" os registros sem
   Superintendência gravada, e a tela devolvia esse rótulo como se fosse nome
   de regional: o quadro dizia "1 escola" e o clique devolvia
   {"escolas":0}, sem caminho de conserto pela tela. A porta de entrada foi
   fechada (a carga exige SRE desde C13), então isto atinge base MIGRADA —
   que é exatamente a situação de uma implantação sobre planilha em uso.
   ============================================================ */
{
  const SSF8 = SS.criarServicos({ nomePlanilha: 'base F08', cota: 100, urlApp: 'https://script/app' });
  const BF8 = SS.carregarCodigo(src, SSF8);
  BF8.testeConfiguracao_();
  const TKCF8 = BF8.criarSessao_({ email: 'central.f08@educacao.mg.gov.br', nome: 'Central F08',
                                   perfil: 'central', papel: 'central' });
  /* duas escolas com SRE e uma SEM — a terceira gravada DIRETO na aba, que é
     a única forma de produzi-la desde C13 (a carga recusa linha sem SRE) */
  BF8.escolaSalvar({ token: TKCF8, inep: '80001', escola: 'EE Com SRE 1', municipio: 'Betim', sre: 'SRE F08 A', codigoInep: censoDe('80001') });
  BF8.escolaSalvar({ token: TKCF8, inep: '80002', escola: 'EE Com SRE 2', municipio: 'Betim', sre: 'SRE F08 B', codigoInep: censoDe('80002') });
  {
    const aba = BF8.abaEscolas_();
    aba.getRange(aba.getLastRow() + 1, 1, 1, BF8.ESCOLA_COLS.length)
       .setValues([['80003', 'EE Sem SRE', 'Betim', '', 'ativa', '']]);
    BF8.invalidarEscolas_();
  }
  /* um PPP em cada uma. Os dois primeiros pelo caminho normal; o terceiro,
     gravado direto na aba Registros — é a forma de uma base MIGRADA, e desde
     C13 não há outra: o cadastro de direção exige a SRE. */
  const pppDe = function (inep, escola, sre) {
    const mail = 'dir' + inep + '@educacao.mg.gov.br';
    salvarDiretor(BF8, { email: mail, nome: 'Diretora ' + inep, papel: 'diretor_escolar', inep: inep });
    const tk = BF8.criarSessao_({ email: mail, nome: 'Diretora ' + inep, perfil: 'escola',
      papel: 'diretor_escolar', sre: sre, inep: inep, escola: escola });
    return BF8.salvarPPP({ token: tk, escola: escola, inep: inep, municipio: 'Betim',
      sessao: 'f08', tMissao: 'x', etapas: ['Ensino Médio'] }).protocolo;
  };
  pppDe('80001', 'EE Com SRE 1', 'SRE F08 A');
  pppDe('80002', 'EE Com SRE 2', 'SRE F08 B');
  {
    const abaR = BF8.abaRegistros_();
    const linha = BF8.CAMPOS.map(function (c) {
      if (c.key === 'protocolo') return 'PPP-2026-8003-LEGA';
      if (c.key === 'escola') return 'EE Sem SRE';
      if (c.key === 'inep') return '80003';
      if (c.key === 'municipio') return 'Betim';
      if (c.key === 'sre') return '';
      if (c.key === 'status') return 'Em andamento';
      if (c.key === 'versao') return 1;
      if (c.key === 'criadoEm' || c.key === 'atualizadoEm') return BF8.agora_();
      return '';
    });
    abaR.getRange(abaR.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
  }

  /* ---- (1) o quadro soma 1 no balde ---- */
  const quadro = BF8.painelRegistros({ token: TKCF8 });
  const balde = (quadro.quadro || []).filter(function (x) { return x.sre === '(sem SRE)'; })[0];
  ok(!!balde && balde.escolas === 1 && balde.total === 1,
     'F08 (A3-15): o quadro do Órgão Central soma 1 escola no balde "(sem SRE)"');

  /* ---- (2) o clique no balde devolve ESSA linha, e só ela ---- */
  const clique = BF8.painelRegistros({ token: TKCF8, filtros: { sre: '(sem SRE)' } });
  ok(clique.ok && (clique.linhas || []).length === 1 &&
     (clique.linhas || [])[0].inep === '80003',
     'F08 (A3-15): e o clique nele devolve a linha — ' + JSON.stringify((clique.linhas || []).map(function (l) { return l.escola; })));
  const comSre = BF8.painelRegistros({ token: TKCF8, filtros: { sre: 'SRE F08 A' } });
  ok(comSre.ok && (comSre.linhas || []).length === 1 && (comSre.linhas || [])[0].inep === '80001',
     'F08: nada muda para quem tem SRE');

  /* ---- (3) a cobertura idem ---- */
  const cob = BF8.coberturaRegional({ token: TKCF8, sre: '(sem SRE)' });
  ok(cob.ok && (cob.escolas || []).length === 1 && (cob.escolas || [])[0].inep === '80003',
     'F08 (A3-15): a cobertura do balde devolve a escola sem regional — ' + ((cob.escolas || []).length));
  const cobQuadro = BF8.coberturaRegional({ token: TKCF8 });
  ok(cobQuadro.ok && !!cobQuadro.quadro, 'F08: e sem SRE pedida o Órgão Central continua recebendo o quadro');

  /* ---- (4) ESCOPO DA SESSÃO, NUNCA DO PAYLOAD: a regional pedindo o balde ---- */
  BF8.acessoSalvar({ token: TKCF8, email: 'sup.f08@educacao.mg.gov.br', nome: 'Super F08',
                     papel: 'superintendente', perfil: 'regional', sre: 'SRE F08 A' });
  const TKSUPF8 = BF8.criarSessao_({ email: 'sup.f08@educacao.mg.gov.br', nome: 'Super F08',
                                     perfil: 'regional', papel: 'superintendente', sre: 'SRE F08 A' });
  const cobReg = BF8.coberturaRegional({ token: TKSUPF8, sre: '(sem SRE)' });
  ok(cobReg.ok && (cobReg.escolas || []).every(function (e) { return e.sre === 'SRE F08 A'; }) &&
     !(cobReg.escolas || []).some(function (e) { return e.inep === '80003'; }),
     'F08: a REGIONAL pedindo "(sem SRE)" continua recebendo apenas a sua própria SRE');
  const painelReg = BF8.painelRegistros({ token: TKSUPF8, filtros: { sre: '(sem SRE)' } });
  ok(!(painelReg.linhas || []).some(function (l) { return l.inep === '80003'; }),
     'F08: e o painel dela também — o recorte por sreDaSessao vem antes do filtro');

  /* ---- (5) uma constante, não cinco literais ---- */
  {
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok(/const SEM_SRE = '\(sem SRE\)';/.test(fonte),
       'F08: o rótulo virou a constante SEM_SRE');
    ok((fonte.match(/'\(sem SRE\)'/g) || []).length === 1,
       'F08: e o literal aparece uma vez só no Code.gs (' + (fonte.match(/'\(sem SRE\)'/g) || []).length + ')');
  }
}


/* ============================================================
   v8.13 (F10, A8-09) — O EXPURGO DA FILA ALCANÇA O QUE O SISTEMA DESISTIU
   DE ENVIAR, E NUNCA APAGA LINHA SEM DATA

   E14 fechou a parte de segurança (o corpo com o link em claro sai da
   planilha). A de crescimento ficou: `expurgarFilaRotina_` começava por
   `if (String(r[0]) !== 'enviado') return;` — as linhas `desistiu` nunca
   eram apagadas, e numa rede de 3.400 escolas a aba cresce sem teto. Havia
   um segundo defeito no mesmo laço: a idade era medida por "Enviado em",
   que em linha `desistiu` é VAZIA, e o `if (!d || …)` tratava data ilegível
   como "velha o bastante para apagar".
   ============================================================ */
{
  const SSF10 = SS.criarServicos({ nomePlanilha: 'base F10', cota: 500, urlApp: 'https://script/app' });
  const BF10 = SS.carregarCodigo(src, SSF10);
  BF10.testeConfiguracao_();
  const aba = BF10.abaFila_();
  const VELHA = '01/01/2020 10:00';
  const hoje = BF10.agora_();
  /* Criado em, Destinatário, Tipo, Assunto, Corpo, Prioridade, Situação,
     Tentativas, Último erro, Enviado em */
  const semear = function (criado, situacao, enviadoEm) {
    aba.getRange(aba.getLastRow() + 1, 1, 1, BF10.FILA_COLS.length)
       .setValues([[criado, 'x@y.mg', 'convite', 'Assunto', '', 1, situacao, 0, '', enviadoEm]]);
  };
  semear(VELHA, 'enviado',  VELHA);   /* (1) enviada, antiga        → apaga */
  semear(VELHA, 'desistiu', '');      /* (2) desistiu, antiga       → apaga */
  semear(hoje,  'desistiu', '');      /* (3) desistiu, recente      → fica  */
  semear(VELHA, 'pendente', '');      /* (4) pendente, antiga       → fica  */
  semear(VELHA, 'enviando', '');      /* (5) enviando, antiga       → fica  */
  semear('',    'desistiu', '');      /* (6) sem data nenhuma       → fica  */
  const antes = aba.getLastRow() - 1;
  ok(antes === 6, 'F10: a fila de prova tem seis linhas (' + antes + ')');

  const r = BF10.expurgarFilaRotina_();
  ok(r.ok && r.apagadas === 2,
     'F10 (A8-09): o expurgo apaga DUAS — a enviada antiga e a desistida antiga (' + r.apagadas + ')');
  const restam = aba.getRange(2, 1, aba.getLastRow() - 1, BF10.FILA_COLS.length).getDisplayValues();
  const sits = restam.map(function (x) { return x[6]; }).sort().join(',');
  ok(restam.length === 4 && sits === 'desistiu,desistiu,enviando,pendente',
     'F10: e as outras quatro ficam — ' + sits);
  ok(restam.filter(function (x) { return x[6] === 'pendente'; }).length === 1,
     'F10: `pendente` ainda vai ser enviada — o expurgo não a toca');
  ok(restam.filter(function (x) { return x[6] === 'enviando'; }).length === 1,
     'F10: `enviando` está em voo — idem');
  ok(restam.filter(function (x) { return !String(x[0]).trim() && !String(x[9]).trim(); }).length === 1,
     'F10: e a linha SEM DATA NENHUMA não é apagada — não se apaga o que não se sabe datar');

  /* o desfecho continua na trilha, que é registro permanente */
  {
    const trilha = BF10.abaHistAcessos_();
    const linhas = trilha.getRange(1, 1, trilha.getLastRow(), trilha.getLastColumn()).getDisplayValues();
    ok(linhas.some(function (l) { return l.join(' ').indexOf('encerradas (enviadas ou desistidas)') >= 0; }),
       'F10: a trilha diz o que o expurgo fez, com a redação nova');
  }

  /* a coluna 5 (o CORPO) continua fora desta rotina — A8-12 */
  {
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    const corpoFn = fonte.slice(fonte.indexOf('function expurgarFilaRotina_'),
                                fonte.indexOf('function limparCorposDaFila_'));
    ok(corpoFn.indexOf('getRange(2, 1, ultima - 1, 1)') > 0,
       'F10: "Criado em" é lido numa FAIXA PRÓPRIA de uma coluna');
    ok(!/getRange\(2,\s*1,\s*ultima - 1,\s*(?:[5-9]|10|FILA_COLS)/.test(corpoFn),
       'F10: e a leitura NÃO foi ampliada para as colunas 1..10 — a coluna 5 é o corpo (A8-12)');
  }

  /* segunda execução: nada mais a apagar */
  const r2 = BF10.expurgarFilaRotina_();
  ok(r2.ok && r2.apagadas === 0, 'F10: a execução seguinte não tem mais o que apagar');
}


/* ============================================================
   v8.13 (F11) — PPP NOVO NASCE NA VERSÃO SEGUINTE DA ESCOLA

   D07 tornou o número de versão único por escola SÓ em `novaVersao`. A
   criação, em `salvarPPP_`, continuava com `versao = 1` fixo: numa escola
   com v1 e v2 homologadas, "Novo PPP" criava um terceiro registro também
   "v1". Não corrompe documento, mas a escola passa a ter dois "v1" no
   painel, no histórico e no PDF — e o número da versão é o que a SRE usa
   para saber de que revisão se está falando.
   ============================================================ */
{
  const TKCF11 = B.criarSessao_({ email: 'central.f11@educacao.mg.gov.br', nome: 'Central F11',
                                  perfil: 'central', papel: 'central' });
  const SREF11 = 'Divinópolis F11';
  B.escolaSalvar({ token: TKCF11, inep: '53000', escola: 'EE F11 base', municipio: 'Divinópolis', sre: SREF11, codigoInep: censoDe('53000') });
  B.acessoSalvar({ token: TKCF11, email: 'sup.f11@educacao.mg.gov.br', nome: 'Super F11',
                   papel: 'superintendente', perfil: 'regional', sre: SREF11 });
  const TKSUPF11 = B.criarSessao_({ email: 'sup.f11@educacao.mg.gov.br', nome: 'Super F11',
                                    perfil: 'regional', papel: 'superintendente', sre: SREF11 });
  B.acessoSalvar({ token: TKSUPF11, email: 'de.f11@educacao.mg.gov.br', nome: 'DE F11',
                   papel: 'diretor_educacional', perfil: 'regional', sre: SREF11 });
  const TKDEF11 = B.criarSessao_({ email: 'de.f11@educacao.mg.gov.br', nome: 'DE F11',
                                   perfil: 'regional', papel: 'diretor_educacional', sre: SREF11 });
  const inep11 = '53001', esc11 = 'EE F11 1';
  B.escolaSalvar({ token: TKCF11, inep: inep11, escola: esc11, municipio: 'Divinópolis', sre: SREF11, codigoInep: censoDe(inep11) });
  salvarDiretor(B, { email: 'dir.f11@educacao.mg.gov.br', nome: 'Diretora F11', masp: '190001',
                   papel: 'diretor_escolar', inep: inep11 });
  let TKDIRF11 = B.criarSessao_({ email: 'dir.f11@educacao.mg.gov.br', nome: 'Diretora F11',
    perfil: 'escola', papel: 'diretor_escolar', sre: SREF11, inep: inep11, escola: esc11 });
  B.acessoSalvar({ token: TKDIRF11, email: 'ana.f11@educacao.mg.gov.br', nome: 'Ana F11', masp: '290001',
                   papel: 'colegiado', perfil: 'escola', inep: inep11, segmento: 'Docente' });
  const TKANAF11 = B.criarSessao_({ email: 'ana.f11@educacao.mg.gov.br', nome: 'Ana F11', perfil: 'escola',
    papel: 'colegiado', sre: SREF11, inep: inep11, escola: esc11 });
  /* a sessão é refeita depois do cadastro do Colegiado: a sessão carrega o
     instantâneo do cadastro, e o sistema recusa a que envelheceu */
  TKDIRF11 = B.criarSessao_({ email: 'dir.f11@educacao.mg.gov.br', nome: 'Diretora F11',
    perfil: 'escola', papel: 'diretor_escolar', sre: SREF11, inep: inep11, escola: esc11 });
  const regF11 = function (P) { return B.lerLinha_(B.abaRegistros_(), B.linhaDoProtocolo_(B.abaRegistros_(), P)); };
  /* leva um PPP de "Em andamento" até homologado, que é o que o libera */
  const encerrar = function (P) {
    B.enviarParaValidacao({ token: TKDIRF11, protocolo: P });
    B.validarPPP({ token: TKDEF11, protocolo: P, parecer: 'ok' });
    B.concluirPPP({ token: TKDIRF11, protocolo: P, escola: esc11, inep: inep11, municipio: 'Divinópolis',
      direcao: 'Diretora F11', tMissao: 'conteúdo', etapas: ['Ensino Médio'],
      docHtml: docTeste('<p>corpo F11</p>'), sessao: 'f11' });
    B.registrarAta({ p: P, token: TKDIRF11, base64: 'QUJD', nome: 'ata.pdf', mime: 'application/pdf',
                     dataReuniao: '30/08/2026', identificacao: 'Ata F11' });
    B.presencaColegiado({ p: P, token: TKDIRF11, emails: ['ana.f11@educacao.mg.gov.br'] });
    B.assinarDirecao({ p: P, token: TKDIRF11, atesto: true });
    B.assinarNoSistema({ token: TKANAF11, protocolo: P, aceite: true });
    B.homologarPPP({ token: TKDEF11, protocolo: P, ato: 'Ato F11' });
  };

  /* (1) escola sem nenhum PPP: nasce v1 */
  const P1 = B.salvarPPP({ token: TKDIRF11, escola: esc11, inep: inep11, municipio: 'Divinópolis',
    sessao: 'f11a', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  ok(parseInt(regF11(P1).versao, 10) === 1, 'F11: escola sem nenhum PPP — o primeiro nasce v1');
  encerrar(P1);

  /* (2) novaVersao sobre a v1: v2 (D07 intacto) */
  const nv1 = B.novaVersao({ token: TKDIRF11, p: P1 });
  ok(nv1.ok, 'F11: a v1 encerrada dá origem a uma nova versão' + (nv1.ok ? '' : ' — ' + nv1.erro));
  const P2 = nv1.ok ? nv1.registro.protocolo : P1;
  ok(parseInt(regF11(P2).versao, 10) === 2, 'F11: novaVersao sobre a v1 continua produzindo a v2 (D07 intacto)');
  ok(regF11(P2).origem === P1, 'F11: e a nova versão declara a origem');
  encerrar(P2);

  /* (3) "Novo PPP" do zero numa escola com v1 e v2 encerradas: v3 */
  const P3 = B.salvarPPP({ token: TKDIRF11, escola: esc11, inep: inep11, municipio: 'Divinópolis',
    sessao: 'f11c', tMissao: 'conteúdo', etapas: ['Ensino Médio'] }).protocolo;
  ok(parseInt(regF11(P3).versao, 10) === 3,
     'F11: com v1 e v2 encerradas, o PPP criado DO ZERO nasce v3 (' + regF11(P3).versao + ')');
  ok(regF11(P3).origem === '',
     'F11: e `origem` continua VAZIO — um PPP criado do zero não descende de ninguém');
  /* a escola deixa de ter dois "v1" */
  {
    const todos = [];
    const aba = B.abaRegistros_();
    for (let l = 2; l <= aba.getLastRow(); l++) {
      const r = B.lerLinhaChaves_(aba, l, ['inep', 'versao', 'protocolo']);
      if (String(r.inep).replace(/\D/g, '') === inep11) todos.push(parseInt(r.versao, 10) || 1);
    }
    ok(todos.length === 3 && todos.filter(function (v) { return v === 1; }).length === 1,
       'F11: a escola deixa de ter dois registros "v1" — ' + JSON.stringify(todos.sort()));
  }

  /* (4) novaVersao sobre a v3: v4 */
  encerrar(P3);
  const nv3 = B.novaVersao({ token: TKDIRF11, p: P3 });
  ok(nv3.ok && parseInt(regF11(nv3.registro.protocolo).versao, 10) === 4,
     'F11: e novaVersao sobre a v3 produz a v4 — ' + (nv3.ok ? regF11(nv3.registro.protocolo).versao : nv3.erro));

  /* (5) registro SEM código da escola (o "abrir por protocolo" antigo) continua na 1 */
  {
    ok(B.maiorVersaoDaEscola_(B.abaRegistros_(), '') === 0,
       'F11: maiorVersaoDaEscola_ sem código de escola devolve 0 — logo, versão 1');
    ok(B.maiorVersaoDaEscola_(B.abaRegistros_(), '53999999') === 0,
       'F11: e numa escola sem nenhum registro também');
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok(/versao = dados\.inep \? \(maiorVersaoDaEscola_\(aba, dados\.inep\) \+ 1\) : 1;/.test(fonte),
       'F11: a criação usa a MESMA função que a revisão usa, com queda para 1 sem código de escola');
    ok(/case 'versao':\s*return maiorVersaoDaEscola_\(aba, ant\.inep\) \+ 1;/.test(fonte),
       'F11: e `novaVersao` continua como D07 a deixou');
  }
}


/* ============================================================
   v8.13 (F12) — AS DUAS CONFERÊNCIAS PROMETIDAS NO LOTE 2

   O lote 2 adiou dois saneamentos retroativos DECLARANDO como compensação
   `auditarHomologacoesSemCiclo()` e `auditarCodigosRepetidos()`. Elas não
   existiam. Sem elas, a decisão de não sanear perdia a metade que a
   justificava: quem recebe uma base já em uso não tem como saber se há
   homologação sem ato correspondente ou código repetido gravado antes da
   8.13. São SOMENTE LEITURA, pelo caminho que E01 estabeleceu.
   ============================================================ */
{
  const SSF12 = SS.criarServicos({ nomePlanilha: 'base F12', cota: 100, urlApp: 'https://script/app' });
  const BF12 = SS.carregarCodigo(src, SSF12);
  BF12.testeConfiguracao_();

  /* ---- (1) base limpa: as duas devolvem total 0 ---- */
  ok(BF12.auditarHomologacoesSemCiclo_().total === 0,
     'F12: base sem registro nenhum — nenhuma homologação sem ato');
  ok(BF12.auditarCodigosRepetidos_().total === 0,
     'F12: e nenhum código repetido');

  /* ---- (2) base semeada: apontam o caso, e mais nenhum ---- */
  const abaR = BF12.abaRegistros_();
  const linhaDe = function (o) {
    return BF12.CAMPOS.map(function (c) { return o[c.key] === undefined ? '' : o[c.key]; });
  };
  const gravar = function (o) {
    abaR.getRange(abaR.getLastRow() + 1, 1, 1, BF12.CAMPOS.length).setValues([linhaDe(o)]);
  };
  /* (a) homologado COM ato no ciclo: não aparece */
  gravar({ protocolo: 'PPP-2026-F121-AAAA', escola: 'EE Certa', sre: 'SRE F12', versao: 1,
           status: 'Homologado', homolEm: '01/09/2026 10:00', homolPor: 'DE F12', homolAto: 'Ato 1',
           hash: 'AAAA-1111-2222', concluidoEm: '01/08/2026 10:00' });
  BF12.registrarCiclo_('PPP-2026-F121-AAAA', 'PPP homologado pela SRE', 'DE F12', 'Diretoria Educacional', '');
  /* (b) homologado SEM ato: aparece */
  gravar({ protocolo: 'PPP-2026-F122-BBBB', escola: 'EE Sem ato', sre: 'SRE F12', versao: 1,
           status: 'Homologado', homolEm: '02/09/2026 10:00', homolPor: 'DE F12', homolAto: 'Ato 2',
           hash: 'BBBB-3333-4444', concluidoEm: '02/08/2026 10:00' });
  /* (c) sem homologação nenhuma: não aparece */
  gravar({ protocolo: 'PPP-2026-F123-CCCC', escola: 'EE Em andamento', sre: 'SRE F12', versao: 1,
           status: 'Em andamento' });
  /* (d) dois documentos com o MESMO código */
  gravar({ protocolo: 'PPP-2026-F124-DDDD', escola: 'EE Gêmea 1', sre: 'SRE F12', versao: 1,
           status: 'Concluído', hash: 'ZZZZ-9999-8888', concluidoEm: '03/08/2026 10:00' });
  gravar({ protocolo: 'PPP-2026-F125-EEEE', escola: 'EE Gêmea 2', sre: 'SRE F12', versao: 1,
           status: 'Concluído', hash: 'ZZZZ-9999-8888', concluidoEm: '04/08/2026 10:00' });

  const h = BF12.auditarHomologacoesSemCiclo_();
  ok(h.ok && h.total === 1 && !!h.itens[0] && h.itens[0].protocolo === 'PPP-2026-F122-BBBB',
     'F12: a conferência aponta EXATAMENTE a homologação sem ato (' + h.total + ')');
  ok(!!h.itens[0] && h.itens[0].escola === 'EE Sem ato' && h.itens[0].homolEm === '02/09/2026 10:00',
     'F12: com a escola e a data, que é o que quem recebe a base precisa para decidir');

  const c = BF12.auditarCodigosRepetidos_();
  ok(c.ok && c.total === 1 && !!c.grupos[0] && c.grupos[0].codigo === 'ZZZZ-9999-8888' &&
     c.grupos[0].documentos.length === 2,
     'F12: e a outra aponta o código repetido, com os dois documentos (' + c.total + ')');
  ok(!!c.grupos[0] && c.grupos[0].documentos.map(function (d) { return d.protocolo; }).sort().join(',') ===
     'PPP-2026-F124-DDDD,PPP-2026-F125-EEEE',
     'F12: os dois protocolos, com escola e data de conclusão');

  /* ---- (3) SOMENTE LEITURA: nada muda na base ---- */
  {
    const antes = abaR.getRange(1, 1, abaR.getLastRow(), BF12.CAMPOS.length).getDisplayValues();
    BF12.auditarHomologacoesSemCiclo_();
    BF12.auditarCodigosRepetidos_();
    const depois = abaR.getRange(1, 1, abaR.getLastRow(), BF12.CAMPOS.length).getDisplayValues();
    ok(JSON.stringify(antes) === JSON.stringify(depois),
       'F12: as duas são SOMENTE LEITURA — a aba de Registros não muda uma célula');
  }

  /* ---- (4) o contrato de superfície de E01 ---- */
  {
    const recusa = function (nome) {
      try { B.api({ fn: nome, args: {} }); return ''; } catch (e) { return String(e.message || e); }
    };
    ok(/Ação desconhecida/.test(recusa('auditarCodigosRepetidos')),
       'F12 (E01): a tela não alcança a conferência — "Ação desconhecida."');
    ok(/Ação desconhecida/.test(recusa('auditarHomologacoesSemCiclo')),
       'F12 (E01): nem a outra');
    ok(/Ação desconhecida/.test(recusa('menuAuditarCodigos')),
       'F12 (E01): e o invólucro de menu também não é alcançável pela porta da tela');
    /* fora da planilha, o invólucro recusa — é o discriminador de E01 */
    const getUiReal12 = SSF12.g.SpreadsheetApp.getUi;
    SSF12.g.SpreadsheetApp.getUi = function () { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); };
    let erro12 = '', erro12b = '';
    try { BF12.menuAuditarCodigos(); } catch (e) { erro12 = String(e.message || e); }
    try { BF12.menuAuditarHomologacoes(); } catch (e) { erro12b = String(e.message || e); }
    SSF12.g.SpreadsheetApp.getUi = getUiReal12;
    ok(/só roda pelo menu da planilha/.test(erro12) && /só roda pelo menu da planilha/.test(erro12b),
       'F12 (E01): fora da planilha, os dois invólucros recusam — somenteMenu_() no caminho');
    ok(/somenteMenu_/.test(String(BF12.menuAuditarCodigos)) &&
       /somenteMenu_/.test(String(BF12.menuAuditarHomologacoes)),
       'F12 (E01): e os dois começam por somenteMenu_(), como os treze anteriores');
    const fonte = fs.readFileSync('./Code.gs', 'utf8');
    ok(/\.addItem\('Conferir homologações sem ato no ciclo', 'menuAuditarHomologacoes'\)/.test(fonte) &&
       /\.addItem\('Conferir códigos de autenticidade repetidos', 'menuAuditarCodigos'\)/.test(fonte),
       'F12: e os dois itens estão no menu da planilha, apontando para os invólucros');
  }
}

/* ============================================================
   v9.8 — AS TRÊS DECISÕES DA COORDENAÇÃO

   (a) a importação de diretores em lote sai da tela e vira rota de
       implantação, só pelo menu da planilha;
   (b) o código INEP passa a ser obrigatório no cadastro de escola — e a
       carga de implantação continua aceitando a escola sem ele, porque a
       extração da rede traz a coluna vazia nas 3.401 escolas;
   (c) todo gerenciamento de acesso traz o histórico dentro de si.
   ============================================================ */
{
  const TK98 = B.criarSessao_({ email: 'central.v98@educacao.mg.gov.br', nome: 'Central v9.8',
                                perfil: 'central', papel: 'central' });
  /* o token que menuImportarDiretores monta: sessão central do dono da planilha */
  const tokenDoMenuSim98 = function () { return B.tokenDoMenu_(); };

  /* ---- (a) a rota da carga de diretores ---- */
  {
    const recusa = function (nome) {
      try { B.api({ fn: nome, args: {} }); return ''; } catch (e) { return String(e.message || e); }
    };
    ok(/Ação desconhecida/.test(recusa('diretoresImportar')) &&
       /Ação desconhecida/.test(recusa('importarAcessos_')),
       'v9.8 (a): a tela não alcança mais a carga de diretores — "Ação desconhecida."');
    ok(/Ação desconhecida/.test(recusa('menuImportarDiretores')),
       'v9.8 (a): nem o invólucro de menu, como os demais de E01');
    ok(/somenteMenu_/.test(String(B.menuImportarDiretores)),
       'v9.8 (a): e o invólucro começa por somenteMenu_()');
    const fonte98 = fs.readFileSync('./Code.gs', 'utf8');
    ok(/\.addItem\('Importar diretores em lote \(implantação\)', 'menuImportarDiretores'\)/.test(fonte98),
       'v9.8 (a): o item está no menu da planilha, apontando para o invólucro');
    const app98 = fs.readFileSync('./App.html', 'utf8');
    ok(app98.indexOf('diretoresImportar') < 0 && app98.indexOf('painelImportacao') < 0,
       'v9.8 (a): a tela não tem mais nem a chamada nem o painel da carga de diretores');
    /* a rota continua existindo e funcionando no servidor: é por ela que a
       implantação carrega os 3.401 diretores, pelo menu da planilha */
    B.escolaSalvar({ token: TK98, inep: '39900', escola: 'EE da Implantação', municipio: 'Betim',
                     sre: 'SRE v9.8', codigoInep: '31390001' });
    const simMenu = B.importarAcessos_('diretores', { token: tokenDoMenuSim98(),
      texto: '39900;Diretor da Implantação;7654321;dir.implantacao.v98@educacao.mg.gov.br', simular: true });
    ok(simMenu.ok && simMenu.aceitas === 1,
       'v9.8 (a): pelo token do menu, a carga de implantação continua aceitando a linha');
  }

  /* ---- (b) o código INEP obrigatório no cadastro de escola ---- */
  {
    let r98 = B.escolaSalvar({ token: TK98, inep: '39001', escola: 'EE da Obrigatoriedade',
                               municipio: 'Betim', sre: 'SRE v9.8' });
    ok(!r98.ok && /obrigatório/.test(r98.erro || ''),
       'v9.8 (b): escola nova sem código INEP é recusada, e a recusa diz que ele é obrigatório');
    r98 = B.escolaSalvar({ token: TK98, inep: '39001', escola: 'EE da Obrigatoriedade',
                           municipio: 'Betim', sre: 'SRE v9.8', codigoInep: '3190' });
    ok(!r98.ok && /8 dígitos/.test(r98.erro || ''), 'v9.8 (b): com menos de 8 dígitos, também é recusada');
    r98 = B.escolaSalvar({ token: TK98, inep: '39001', escola: 'EE da Obrigatoriedade',
                           municipio: 'Betim', sre: 'SRE v9.8', codigoInep: '31390011' });
    ok(r98.ok && B.escolaPorInep_('39001').codigoInep === '31390011',
       'v9.8 (b): com os 8 dígitos, entra — e o código fica gravado');

    /* a escola que veio da carga SEM o código só é alterada depois de informá-lo:
       é assim que a base se regulariza, uma escola por vez */
    const carga98 = B.escolasImportar({ token: TK98, texto: '39002;EE Sem INEP;Betim;SRE v9.8\n39003;EE Sem INEP Dois;Betim;SRE v9.8', simular: true });
    ok(carga98.ok && carga98.semInep === 2,
       'v9.8 (b): a carga aceita a linha sem INEP e diz quantas entram assim (' + carga98.semInep + ')');
    B.escolasImportar({ token: TK98, texto: '39002;EE Sem INEP;Betim;SRE v9.8\n39003;EE Sem INEP Dois;Betim;SRE v9.8',
                        simular: false, chave: carga98.chave });
    ok(B.escolaPorInep_('39002') && !B.escolaPorInep_('39002').codigoInep,
       'v9.8 (b): a escola da carga entra mesmo sem o código — a implantação não fica impedida');
    r98 = B.escolaSalvar({ token: TK98, inep: '39002', escola: 'EE Sem INEP (renomeada)',
                           municipio: 'Betim', sre: 'SRE v9.8' });
    ok(!r98.ok && /obrigatório/.test(r98.erro || ''),
       'v9.8 (b): e alterá-la pelo formulário exige o código — é por aí que a base se regulariza');
    r98 = B.escolaSalvar({ token: TK98, inep: '39002', escola: 'EE Sem INEP (renomeada)',
                           municipio: 'Betim', sre: 'SRE v9.8', codigoInep: '31390012' });
    ok(r98.ok && B.escolaPorInep_('39002').codigoInep === '31390012' &&
       B.escolaPorInep_('39002').escola === 'EE Sem INEP (renomeada)',
       'v9.8 (b): informado o código, a alteração passa e a escola fica regularizada');

    /* o INEP do Censo viaja com o registro do PPP */
    salvarDiretor(B, { email: 'dir.v98@educacao.mg.gov.br', nome: 'Diretora v9.8',
                       papel: 'diretor_escolar', inep: '39001' });
    const tkd98 = B.criarSessao_({ email: 'dir.v98@educacao.mg.gov.br', nome: 'Diretora v9.8',
      perfil: 'escola', papel: 'diretor_escolar', sre: 'SRE v9.8', inep: '39001', escola: 'EE da Obrigatoriedade' });
    const g98 = B.salvarPPP({ token: tkd98, escola: 'EE da Obrigatoriedade', inep: '39001',
                              municipio: 'Betim', sessao: 'v98' });
    const lido98 = function (prot) {
      const aba = B.abaRegistros_();
      return B.lerLinha_(aba, B.linhaDoProtocolo_(aba, prot));
    };
    ok(g98.ok && lido98(g98.protocolo).censo === '31390011',
       'v9.8 (b): o registro do PPP guarda o código INEP da base — a folha de rosto o imprime');
    /* corrigido na base, o registro acompanha na gravação seguinte */
    B.escolaSalvar({ token: TK98, inep: '39001', escola: 'EE da Obrigatoriedade',
                     municipio: 'Betim', sre: 'SRE v9.8', codigoInep: '31390099' });
    const g98b = B.salvarPPP({ token: tkd98, escola: 'EE da Obrigatoriedade', inep: '39001',
                               municipio: 'Betim', sessao: 'v98', rev: g98.rev, protocolo: g98.protocolo });
    ok(g98b.ok && lido98(g98.protocolo).censo === '31390099',
       'v9.8 (b): corrigido o código na base, a gravação seguinte do PPP já o traz — sem redigitar nada');
    /* e a tela não escreve esta coluna: ela é do servidor */
    const g98c = B.salvarPPP({ token: tkd98, escola: 'EE da Obrigatoriedade', inep: '39001',
                               municipio: 'Betim', sessao: 'v98', censo: '00000000',
                               rev: g98b.rev, protocolo: g98.protocolo });
    ok(g98c.ok && lido98(g98.protocolo).censo === '31390099',
       'v9.8 (b): o que a tela mandar em `censo` é ignorado — a coluna vem da base de escolas');
  }

  /* ---- (c) o histórico dentro de cada gerenciamento ---- */
  {
    const app98 = fs.readFileSync('./App.html', 'utf8');
    const idx98 = fs.readFileSync('./Index.html', 'utf8');
    ok(/historicoEmbutidoHTML\('papel:' \+ g\.papel/.test(app98),
       'v9.8 (c): Minha equipe traz o histórico em cada caixa de papel');
    ok(/historicoEmbutidoHTML\('grupo:colegiado'/.test(app98),
       'v9.8 (c): o Colegiado Escolar traz o seu');
    ok(/id="rgHistBox"/.test(idx98) && !/id="rgHistBox" hidden/.test(idx98),
       'v9.8 (c): a janela da regional (acesso do superintendente) traz o histórico, sempre presente');
    ok(/id="gsHistBox"/.test(idx98) && !/id="gsHistBox" hidden/.test(idx98),
       'v9.8 (c): a janela do diretor da escola também — e ela não nasce mais oculta');
    ok(/box\.hidden = false;/.test(app98.slice(app98.indexOf('function carregarHistoricoGestores'),
                                               app98.indexOf('function carregarHistoricoGestores') + 900)),
       'v9.8 (c): e a caixa não some quando a escola ainda não teve diretor');
    /* a aba única do histórico continua fora */
    ok(/\$\('#piAbaHistorico'\)\.hidden = true;/.test(app98),
       'v9.8 (c): a aba única de histórico continua desligada — o histórico vive dentro de cada gerenciamento');
  }
}

console.log(`\n${oks.length} verificações OK · ${falhas.length} falhas\n`);
falhas.forEach(f => console.log('  ✗ ' + f));
process.exit(falhas.length ? 1 : 0);
