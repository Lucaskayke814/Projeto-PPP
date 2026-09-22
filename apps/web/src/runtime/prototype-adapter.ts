import '../styles/workspace.css';
import { supabase } from '../lib/supabase';
import { PppService } from '../services/ppp-service';
import type { PppDraftState } from '../state/ppp-draft';

type RegistroParaAplicar = {
  protocolo: string;
  numeroVersao: number;
  situacao: string;
  telaAtual: string;
  tarefas: Record<string, boolean>;
  respostas: Record<string, unknown>;
};

type PrototypeRuntime = {
  limparRascunho(): void;
  coletarDados(): Record<string, unknown>;
  aplicarRegistro(registro: RegistroParaAplicar): void;
  telaAtual(): string;
  indiceDaTela(chave: string): number;
  tarefas(): Record<string, boolean>;
  definirProtocolo(protocol: string, version: number): void;
  mostrarErro(message: string): void;
};

declare global {
  interface Window {
    __PPP_REFERENCE_RUNTIME__?: PrototypeRuntime;
    servidor?: (operation: string, args: unknown, success: (result: unknown) => void, failure?: (error: unknown) => void) => void;
    baixarBase64?: (base64: string, nome: string) => void;
  }
}

const estiloModoDemonstracao = document.createElement('style');
estiloModoDemonstracao.textContent = '#demoRibbon{display:none !important}';
document.head.append(estiloModoDemonstracao);
document.querySelector<HTMLElement>('#demoRibbon')?.setAttribute('hidden', '');
const runtime = window.__PPP_REFERENCE_RUNTIME__;
if (!runtime) throw new Error('O runtime da c\u00f3pia de trabalho do prot\u00f3tipo n\u00e3o foi preparado.');

const prototypeRuntime: PrototypeRuntime = runtime;
const service = new PppService();
const chaveLoginGoogleEmAndamento = 'gerador-ppp:login-google-em-andamento';
let draft: PppDraftState | null = null;
let filaDeSalvamento: Promise<void> = Promise.resolve();
const tokenPreviaParaImpressao = '__PPP_PREVIA_IMPRIMIR__';
const baixarBase64Original = window.baixarBase64;
let previaPendente: { janela: Window | null; documentoHtml: string; titulo: string } | null = null;

function message(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (/Invalid login credentials/i.test(detail)) return 'E-mail ou senha inv\u00e1lidos.';
  if (/Email not confirmed/i.test(detail)) return 'Confirme o e-mail dessa conta no Supabase antes de entrar.';
  if (/alterado por outra sess\u00e3o|another session/i.test(detail)) return 'Este PPP foi salvo em outra sess\u00e3o. Atualize a p\u00e1gina para carregar a revis\u00e3o mais recente antes de continuar.';
  if (/Auth session missing|Autentica|JWT/i.test(detail)) return 'Entre com uma conta autorizada antes de salvar o PPP.';
  if (/permission|permiss|42501/i.test(detail)) return 'Sua conta n\u00e3o possui permiss\u00e3o para acessar este PPP.';
  if (/fetch|network|networkerror|failed to fetch/i.test(detail)) return 'N\u00e3o foi poss\u00edvel conectar ao Supabase. Confira a conex\u00e3o e as vari\u00e1veis VITE_SUPABASE.';
  return detail ? `N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o: ${detail}` : 'N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o.';
}

function escreverPreviaParaImpressao(janela: Window | null, documentoHtml: string, titulo: string): void {
  if (!janela) throw new Error('O navegador bloqueou a janela de prévia. Permita pop-ups para este endereço e tente novamente.');
  const estilos = Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\\n');
  janela.document.open();
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title><style>${estilos}
    @page { margin: 14mm; }
    body { background: #fff; padding: 0; }
    .doc-wrap { max-width: none; box-shadow: none; }
  </style></head><body>${documentoHtml}</body></html>`);
  janela.document.close();
  janela.focus();
  window.setTimeout(() => janela.print(), 150);
}

window.baixarBase64 = (base64: string, nome: string) => {
  if (base64 !== tokenPreviaParaImpressao) {
    baixarBase64Original?.(base64, nome);
    return;
  }
  const previa = previaPendente;
  previaPendente = null;
  if (!previa) return;
  escreverPreviaParaImpressao(previa.janela, previa.documentoHtml, previa.titulo);
};
async function schoolIdForCurrentUser(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Autentica\u00e7\u00e3o obrigat\u00f3ria');
  const { error: syncError } = await supabase.rpc('sincronizar_meu_acesso');
  if (syncError) throw syncError;
  const { data, error } = await supabase.rpc('obter_contexto_usuario');
  if (error) throw error;
  const link = data?.vinculos?.find((item: { escolaId?: string }) => item.escolaId);
  if (!link?.escolaId) throw new Error('A conta autenticada n\u00e3o possui uma escola vinculada.');
  return link.escolaId;
}

async function createDraft(): Promise<void> {
  const schoolId = await schoolIdForCurrentUser();
  prototypeRuntime.limparRascunho();
  draft = await service.start(schoolId, prototypeRuntime.coletarDados());
  prototypeRuntime.definirProtocolo(draft.protocol!, 1);
}

function fotografarFormulario(): Pick<PppDraftState, 'answers' | 'screenKey' | 'tasks'> {
  return {
    answers: prototypeRuntime.coletarDados(),
    screenKey: prototypeRuntime.telaAtual(),
    tasks: prototypeRuntime.tarefas(),
  };
}

async function saveDraft(): Promise<{ protocolo: string; versao: number; atualizadoEm: string }> {
  if (!draft) await createDraft();
  if (!draft) throw new Error('N\u00e3o foi poss\u00edvel iniciar o rascunho.');
  // O protótipo chama servidor() antes de atualizar state.tela; aguarda o fim da navegação atual.
  await Promise.resolve();
  const fotografia = fotografarFormulario();
  const proximoSalvamento = filaDeSalvamento.then(async () => {
    if (!draft) throw new Error('Nenhum rascunho de PPP est\u00e1 em edi\u00e7\u00e3o.');
    const salvo = await service.save({ ...draft, ...fotografia });
    draft = salvo;
  });
  filaDeSalvamento = proximoSalvamento.catch(() => undefined);
  await proximoSalvamento;
  return { protocolo: draft.protocol!, versao: 1, atualizadoEm: new Date().toLocaleString('pt-BR') };
}

function situacaoParaPrototipo(situacao: string): string {
  return ({ rascunho: 'Em andamento', em_assinatura: 'Em assinatura', assinado: 'Assinado', concluido: 'Concluído', enviado_homologacao: 'Enviado para homologação', homologado: 'Enviado para homologação' } as Record<string, string>)[situacao] ?? situacao;
}
async function retomarRascunho(protocol: string): Promise<boolean> {
  const found = await service.resume(protocol);
  if (!found || !found.protocol) return false;
  draft = found;
  prototypeRuntime.aplicarRegistro({
    protocolo: found.protocol,
    numeroVersao: 1,
    situacao: found.status === 'rascunho' ? 'draft' : situacaoParaPrototipo(found.status),
    telaAtual: found.screenKey,
    tarefas: found.tasks,
    respostas: found.answers,
  });
  return true;
}

let atualizacaoDeTelaAgendada = false;
function registrarTelaAposNavegacao(): void {
  if (atualizacaoDeTelaAgendada) return;
  atualizacaoDeTelaAgendada = true;
  window.setTimeout(() => {
    atualizacaoDeTelaAgendada = false;
    void (async () => {
      // O protótipo salva antes de trocar state.tela. Aguarda a fila atual e
      // registra a tela já renderizada sem criar uma revisão adicional.
      await filaDeSalvamento;
      if (!draft || draft.status !== 'rascunho') return;
      const telaAtual = prototypeRuntime.telaAtual();
      if (telaAtual === draft.screenKey) return;
      draft = await service.updateCurrentScreen(draft, telaAtual);
    })().catch((erro) => console.warn('Não foi possível registrar a tela atual do PPP.', erro));
  }, 0);
}

document.addEventListener('click', (event) => {
  const alvo = event.target instanceof Element
    ? event.target.closest('#btnNext, #btnBack, [data-ir], .mod-btn')
    : null;
  if (alvo) registrarTelaAposNavegacao();
}, true);

function iniciarLoginGoogle(): void {
  try {
    if (window.sessionStorage.getItem(chaveLoginGoogleEmAndamento)) return;
    window.sessionStorage.setItem(chaveLoginGoogleEmAndamento, '1');
  } catch { /* armazenamento indisponível */ }
  void supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/prototipo.html` } })
    .then(({ error }) => { if (error) throw error; })
    .catch((error) => { try { window.sessionStorage.removeItem(chaveLoginGoogleEmAndamento); } catch { /* armazenamento indisponível */ } prototypeRuntime.mostrarErro(message(error)); });
}

function mostrarLoginObrigatorio(): void {
  const portas = document.querySelector<HTMLElement>('#portas');
  if (portas) portas.hidden = true;
  iniciarLoginGoogle();
}
function liberarPortasAposLogin(): void {
  document.querySelector('#loginGoogleObrigatorio')?.remove();
  document.querySelector<HTMLElement>('#portas')!.hidden = false;
}

function mostrarAcessoTeste(): void { mostrarLoginObrigatorio(); }

window.servidor = (operation, args, success, failure) => {
  const janelaPrevia = operation === 'previaPDF' ? window.open('', '_blank') : null;
  const run = async () => {
    if (operation === 'salvarPPP') return success({ ok: true, ...(await saveDraft()) });
    if (operation === 'previaPDF') {
      const documentoHtml = String((args as { docHtml?: unknown })?.docHtml ?? '');
      if (!documentoHtml) throw new Error('O conteúdo da prévia não foi gerado pelo formulário.');
      const salvo = await saveDraft();
      previaPendente = {
        janela: janelaPrevia,
        documentoHtml,
        titulo: `Prévia do PPP ${salvo.protocolo}`,
      };
      return success({ ok: true, base64: tokenPreviaParaImpressao, nomeArquivo: `${salvo.protocolo}-previa.pdf` });
    }
    if (operation === 'concluirPPP') {
      await saveDraft();
      if (!draft) throw new Error('Nenhum rascunho de PPP está em edição.');
      draft = await service.complete(draft);
      const assinatura = (args as { assinaturaDirecao?: { nome?: string; masp?: string; email?: string } })?.assinaturaDirecao ?? {};
      return success({ ok: true, registro: {
        protocolo: draft.protocol, versao: 1, status: 'Em assinatura',
        ...draft.answers,
        tarefas: JSON.stringify(draft.tasks),
        tela: prototypeRuntime.indiceDaTela(draft.screenKey),
        concluidoEm: new Date().toLocaleString('pt-BR'),
        assinaturas: JSON.stringify([{
          papel: 'Direção Escolar', segmento: 'Direção', nome: assinatura.nome ?? '',
          masp: assinatura.masp ?? '', email: assinatura.email ?? '', token: '', assinadoEm: '',
        }]),
      } });
    }    if (operation === 'buscarPPP') {
      const protocol = String((args as { p?: string })?.p ?? '');
      const found = await service.resume(protocol);
      if (!found) return success({ ok: false, erro: 'Protocolo n\u00e3o encontrado.' });
      draft = found;
      return success({ ok: true, registro: {
        protocolo: found.protocol, versao: 1, status: 'Em andamento',
        ...found.answers, tarefas: JSON.stringify(found.tasks), tela: prototypeRuntime.indiceDaTela(found.screenKey),
      } });
    }
    return success({ ok: false, erro: `Opera\u00e7\u00e3o ${operation} ainda n\u00e3o foi migrada para o Supabase.` });
  };
  void run().catch((error) => {
    if (janelaPrevia && !janelaPrevia.closed) janelaPrevia.close();
    console.error(error);
    if (failure) failure(error); else prototypeRuntime.mostrarErro(message(error));
  });
};

async function abrirProtocoloDigitado(): Promise<void> {
  const campo = document.querySelector<HTMLInputElement>('#inpProto');
  const protocolo = campo?.value.trim() ?? '';
  if (!protocolo) { prototypeRuntime.mostrarErro('Informe o número do protocolo.'); return; }
  const encontrado = await retomarRascunho(protocolo);
  if (!encontrado) { prototypeRuntime.mostrarErro('Protocolo não encontrado ou indisponível para esta conta.'); return; }
  const landing = document.querySelector<HTMLElement>('#landing');
  if (landing) landing.hidden = true;
}

document.addEventListener('click', (event) => {
  const buscar = event.target instanceof Element ? event.target.closest('#btnBuscar') : null;
  if (!buscar) return;
  event.preventDefault(); event.stopImmediatePropagation();
  void abrirProtocoloDigitado().catch((erro) => prototypeRuntime.mostrarErro(message(erro)));
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || document.activeElement?.id !== 'inpProto') return;
  event.preventDefault(); event.stopImmediatePropagation();
  void abrirProtocoloDigitado().catch((erro) => prototypeRuntime.mostrarErro(message(erro)));
}, true);
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('#btnNovo') : null;
  if (!target) return;
  event.preventDefault(); event.stopImmediatePropagation();
  void supabase.auth.getSession().then(({ data }) => {
    if (!data.session) { mostrarLoginObrigatorio(); return false; }
    return createDraft().then(() => true);
  }).then((started) => {
    if (!started) return;
    const landing = document.querySelector<HTMLElement>('#landing');
    if (landing) landing.hidden = true;
  }).catch((error) => prototypeRuntime.mostrarErro(message(error)));
}, true);

async function aplicarSessaoAutenticada(): Promise<void> {
  try { window.sessionStorage.removeItem(chaveLoginGoogleEmAndamento); } catch { /* armazenamento indisponível */ }
  const { error } = await supabase.rpc('sincronizar_meu_acesso');
  if (error) throw error;
  liberarPortasAposLogin();
  const parametros = new URLSearchParams(window.location.search);
  // Atualizar a página nunca reabre automaticamente o último PPP. A retomada
  // direta existe apenas para links explícitos, que carregam ?retomar=PROTOCOLO.
  const protocol = parametros.get('retomar');
  if (!protocol) return;
  if (await retomarRascunho(protocol)) {
    const landing = document.querySelector<HTMLElement>('#landing');
    if (landing) landing.hidden = true;
    if (parametros.has('retomar')) { window.history.replaceState({}, '', window.location.pathname); }
  }
}

supabase.auth.onAuthStateChange((_evento, sessao) => { if (sessao) void aplicarSessaoAutenticada(); });
void supabase.auth.getSession()
  .then(({ data }) => data.session ? aplicarSessaoAutenticada() : mostrarLoginObrigatorio())
  .catch((error) => console.warn('Não foi possível iniciar a sessão.', error));
function habilitarSugestoesTemporariasDeProtocolo(): void {
  const campo = document.querySelector<HTMLInputElement>('#inpProto');
  if (!campo) return;
  const painel = document.createElement('div');
  painel.id = 'sugestoesProtocolosTeste'; painel.hidden = true;
  campo.parentElement?.after(painel);
  const mostrarStatus = (texto: string) => { painel.innerHTML = `<div class="sugestao-status">${texto}</div>`; painel.hidden = false; };
  let temporizador: number | undefined;
  let pagina = 1;
  const buscarSugestoes = () => {
    window.clearTimeout(temporizador); mostrarStatus('Buscando PPPs disponíveis...');
    temporizador = window.setTimeout(() => {
      void supabase.rpc('listar_protocolos_para_teste', { termo_busca: campo.value, pagina }).then(async ({ data, error }) => {
        if (error) { console.warn('Não foi possível buscar sugestões de protocolo.', error); mostrarStatus('Não foi possível consultar os PPPs agora.'); return; }
        const itens = data ?? [];
        if (!itens.length) {
          const { data: contexto } = await supabase.rpc('obter_contexto_usuario');
          const possuiEscola = Boolean(contexto?.vinculos?.some((v: { escolaId?: string }) => v.escolaId));
          mostrarStatus(possuiEscola ? 'Nenhum PPP corresponde ao que foi digitado.' : 'Sua conta Google ainda não possui uma escola vinculada.');
          return;
        }
        painel.replaceChildren(...itens.map((item: { protocolo: string; nome_escola: string; situacao: string }) => {
          const opcao = document.createElement('button');
          opcao.type = 'button'; opcao.className = 'sugestao-protocolo-teste';
          const protocolo = document.createElement('b'); protocolo.textContent = item.protocolo;
          const descricao = document.createElement('span'); descricao.textContent = `${item.nome_escola} · ${item.situacao}`;
          opcao.append(protocolo, descricao);
          opcao.addEventListener('mousedown', (evento) => { evento.preventDefault(); campo.value = item.protocolo; painel.hidden = true; campo.focus(); });
          return opcao;
        }));
        if (itens.length === 10 || pagina > 1) { const nav=document.createElement('div'); nav.className='sugestao-status'; const anterior=document.createElement('button'); anterior.type='button'; anterior.textContent='← Anterior'; anterior.disabled=pagina===1; const proxima=document.createElement('button'); proxima.type='button'; proxima.textContent='Próxima →'; proxima.style.marginLeft='10px'; anterior.onclick=()=>{pagina--;buscarSugestoes();}; proxima.onclick=()=>{pagina++;buscarSugestoes();}; nav.append(anterior,proxima); painel.append(nav); }
        painel.hidden = false;
      });
    }, 180);
  };
  campo.addEventListener('input', () => { pagina = 1; if (!campo.value.trim()) { painel.hidden = true; painel.replaceChildren(); return; } buscarSugestoes(); });
  campo.addEventListener('blur', () => window.setTimeout(() => { painel.hidden = true; }, 180));
}

habilitarSugestoesTemporariasDeProtocolo();
