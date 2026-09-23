import '../styles/workspace.css';
import { supabase } from '../lib/supabase';
import { PppService } from '../services/ppp-service';
import { OrgaoCentralService } from '../services/orgao-central-service';
import { AcessosOrgaoCentralService } from '../services/acessos-orgao-central-service';
import { EscolasOrgaoCentralService } from '../services/escolas-orgao-central-service';
import type { AcessoInstitucional } from '../repositories/orgao-central-repository';
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
  abrirPainelInstitucional(sessao: Record<string, unknown>): void;
  mostrarErro(message: string): void;
};

type PerfilInstitucional = 'escola' | 'regional' | 'central';

type ContextoInstitucional = {
  controleAtivo: true;
  identificado: true;
  acessoInstitucional: true;
  email: string;
  acesso: {
    perfil: PerfilInstitucional;
    papel: string;
    papelNome: string;
    nome: string;
    escola: string;
    inep: string;
    sre: string;
    censo: string;
    redeId: string;
    rede: string;
    regionalId: string;
    podeConsultarRede: boolean;
    podeGerenciarPpps: boolean;
    podeAdministrarAcessos: boolean;
    podeEditarConteudo: boolean;
  };
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
const orgaoCentralService = new OrgaoCentralService();
const acessosOrgaoCentralService = new AcessosOrgaoCentralService();
const escolasOrgaoCentralService = new EscolasOrgaoCentralService();
const acessosInstitucionaisPorEmail = new Map<string, AcessoInstitucional[]>();
let contextoInstitucionalAtual: ContextoInstitucional | null = null;
let loteImportacaoEscolasAtual = '';
let loginGoogleEmAndamento = false;
let aplicacaoDaSessao: Promise<void> | null = null;
let entradaInstitucionalAutomaticaFeita = false;
let draft: PppDraftState | null = null;
let filaDeSalvamento: Promise<void> = Promise.resolve();
const tokenPreviaParaImpressao = '__PPP_PREVIA_IMPRIMIR__';
const baixarBase64Original = window.baixarBase64;
let previaPendente: { arquivo: Blob; nomeArquivo: string } | null = null;

const estiloAutenticacaoGoogle = document.createElement('style');
estiloAutenticacaoGoogle.textContent = `
  .ppp-autenticacao-google-pendente #portas,
  .ppp-autenticacao-google-pendente #portaInst,
  .ppp-autenticacao-google-pendente #portaEscola,
  .ppp-autenticacao-google-pendente #portaPrimeiro,
  .ppp-autenticacao-google-pendente #portaSemCadastro,
  .ppp-autenticacao-google-pendente #portaIdent,
  .ppp-autenticacao-google-pendente #portaModo { display:none !important; }
`;
document.head.append(estiloAutenticacaoGoogle);

const estiloRestauracaoOAuth = document.createElement('style');
estiloRestauracaoOAuth.textContent = [
  '.ppp-restaurando-sessao #landing,',
  '.ppp-restaurando-sessao #stage { visibility: hidden !important; }',
  '.ppp-restaurando-sessao::before {',
  "  content: ''; position: fixed; z-index: 99999; left: 50%; top: 50%;",
  '  width: 30px; height: 30px; margin: -15px; border: 3px solid #d3dbe0;',
  '  border-top-color: #263d51; border-radius: 50%; animation: ppp-girar 0.75s linear infinite;',
  '}',
  '@keyframes ppp-girar { to { transform: rotate(360deg); } }',
].join('\n');
document.head.append(estiloRestauracaoOAuth);
const retornoOAuthNoFragmento = new URLSearchParams(window.location.hash.replace(/^#/, '')).has('access_token');
if (retornoOAuthNoFragmento) document.documentElement.classList.add('ppp-restaurando-sessao');

function message(error: unknown): string {
  const detail = error instanceof Error
    ? error.message
    : (typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? ''));
  if (/Invalid login credentials/i.test(detail)) return 'E-mail ou senha inv\u00e1lidos.';
  if (/Email not confirmed/i.test(detail)) return 'Confirme o e-mail dessa conta no Supabase antes de entrar.';
  if (/alterado por outra sess\u00e3o|another session/i.test(detail)) return 'Este PPP foi salvo em outra sess\u00e3o. Atualize a p\u00e1gina para carregar a revis\u00e3o mais recente antes de continuar.';
  if (/Auth session missing|Autentica|JWT/i.test(detail)) return 'Entre com uma conta autorizada antes de salvar o PPP.';
  if (/permission|permiss|42501/i.test(detail)) return 'Sua conta n\u00e3o possui permiss\u00e3o para acessar este PPP.';
  if (/fetch|network|networkerror|failed to fetch/i.test(detail)) return 'N\u00e3o foi poss\u00edvel conectar ao Supabase. Confira a conex\u00e3o e as vari\u00e1veis VITE_SUPABASE.';
  return detail ? `N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o: ${detail}` : 'N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o.';
}

function baixarArquivo(arquivo: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.baixarBase64 = (base64: string, nome: string) => {
  if (base64 !== tokenPreviaParaImpressao) {
    baixarBase64Original?.(base64, nome);
    return;
  }
  const previa = previaPendente;
  previaPendente = null;
  if (!previa) return;
  baixarArquivo(previa.arquivo, previa.nomeArquivo);
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

/**
 * Traduz o vínculo seguro do Supabase para o contrato de sessão que o
 * protótipo v10.2 já consome. A tela não recebe permissões inventadas: a
 * criação e a leitura continuam protegidas pelas RPCs e pelas políticas RLS.
 */
async function obterContextoInstitucional(): Promise<ContextoInstitucional> {
  const { data: sessionData } = await supabase.auth.getSession();
  const usuario = sessionData.session?.user;
  if (!usuario) throw new Error('Autenticacao obrigatoria');

  const { error: syncError } = await supabase.rpc('sincronizar_meu_acesso');
  if (syncError) throw syncError;

  const { data: contexto, error: contextoError } = await supabase.rpc('obter_contexto_institucional');
  if (contextoError) throw contextoError;
  if (!contexto?.perfil || !contexto?.papel) {
    throw new Error('Sua conta nao possui um acesso institucional ativo.');
  }

  const email = String(contexto.email || usuario.email || '').toLowerCase();
  const resultado: ContextoInstitucional = {
    controleAtivo: true,
    identificado: true,
    acessoInstitucional: true,
    email,
    acesso: {
      perfil: contexto.perfil as PerfilInstitucional,
      papel: String(contexto.papel),
      papelNome: String(contexto.papelNome || ''),
      nome: String(contexto.nome || usuario.user_metadata?.full_name || usuario.user_metadata?.name || email),
      escola: String(contexto.escola || ''),
      inep: String(contexto.codigoInep || ''),
      sre: String(contexto.regional || ''),
      censo: String(contexto.codigoInepCenso || ''),
      redeId: String(contexto.redeId || ''),
      rede: String(contexto.rede || ''),
      regionalId: String(contexto.regionalId || ''),
      podeConsultarRede: Boolean(contexto.podeConsultarRede),
      podeGerenciarPpps: Boolean(contexto.podeGerenciarPpps),
      podeAdministrarAcessos: Boolean(contexto.podeAdministrarAcessos),
      podeEditarConteudo: Boolean(contexto.podeEditarConteudo),
    },
  };
  contextoInstitucionalAtual = resultado;
  return resultado;
}
async function createDraft(): Promise<void> {
  const schoolId = await schoolIdForCurrentUser();
  prototypeRuntime.limparRascunho();
  draft = await service.start(schoolId, prototypeRuntime.coletarDados());
  draft = await service.updateCurrentScreen(draft, prototypeRuntime.telaAtual());
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
  return ({ rascunho: 'Em andamento', em_validacao: 'Em valida\u00e7\u00e3o', validado: 'Validado', em_assinatura: 'Em assinatura', assinado: 'Assinado', concluido: 'Concluído', enviado_homologacao: 'Enviado para homologação', homologado: 'Enviado para homologação' } as Record<string, string>)[situacao] ?? situacao;
}
async function listarRegistrosDoPainel(filtros: { busca?: string; status?: string; sre?: string; municipio?: string } = {}): Promise<unknown> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (contexto.acesso.perfil === 'central') {
    const cobertura = await orgaoCentralService.obterCobertura();
    const regional = cobertura.find((item) => item.nomeRegional === filtros.sre || item.regionalEnsinoId === filtros.sre);
    const linhas = await orgaoCentralService.listarPpps({
      busca: String(filtros.busca ?? ''),
      situacao: String(filtros.status ?? ''),
      regional: regional?.regionalEnsinoId ?? '',
      municipio: String(filtros.municipio ?? ''),
    });
    return {
      ok: true,
      sres: cobertura.map((item) => item.nomeRegional),
      linhas: linhas.map((item) => ({
        protocolo: item.protocolo, versao: item.numeroVersao, escola: item.nomeEscola,
        inep: item.codigoInep, municipio: item.municipio, sre: item.nomeRegional,
        status: situacaoParaPrototipo(item.situacao), pct: 0, assinadas: 0, totalAssin: 0, podeHomologar: contexto.acesso.podeGerenciarPpps && ['concluido','enviado_homologacao'].includes(item.situacao),
        atualizadoEm: new Date(item.atualizadoEm).toLocaleString('pt-BR'),
        editavel: false, emElaboracao: item.situacao === 'rascunho',
      })),
    };
  }
  const data = await service.listForPanel(String(filtros.busca ?? ''));
  return {
    ok: true,
    sres: [],
    linhas: data.map((item) => ({
      protocolo: item.protocol, versao: item.version, escola: item.schoolName, inep: item.schoolCode,
      status: situacaoParaPrototipo(item.status), pct: item.completionPercentage,
      assinadas: 0, totalAssin: 0, atualizadoEm: new Date(item.updatedAt).toLocaleString('pt-BR'),
      editavel: item.status === 'rascunho', emElaboracao: ['rascunho', 'em_assinatura'].includes(item.status),
    })),
  };
}

async function carregarCoberturaCentral(): Promise<unknown> {
  const cobertura = await orgaoCentralService.obterCobertura();
  const quadro = cobertura.map((item) => ({
    sre: item.nomeRegional,
    escolas: item.escolasAtivas,
    semPPP: Math.max(0, item.escolasAtivas - item.escolasComPpp),
    emAndamento: item.pppsEmAndamento,
    emValidacao: item.pppsEmValidacao,
    validado: 0,
    emAssinatura: item.pppsEmAssinatura,
    concluido: 0,
    enviadoHomologacao: 0,
    homologado: item.pppsHomologados,
  }));
  return {
    ok: true,
    quadro,
    totais: {
      escolas: quadro.reduce((total, item) => total + item.escolas, 0),
      semPPP: quadro.reduce((total, item) => total + item.semPPP, 0),
      emAndamento: quadro.reduce((total, item) => total + item.emAndamento, 0),
      emValidacao: quadro.reduce((total, item) => total + item.emValidacao, 0),
      homologado: quadro.reduce((total, item) => total + item.homologado, 0),
    },
  };
}

function acessoParaPrototipo(acesso: AcessoInstitucional): Record<string, unknown> {
  const regional = acesso.papel === 'leitor_regional';
  const escola = acesso.papel === 'editor_escola';
  const central = !regional && !escola;
  const papel = central ? 'central' : (regional ? 'superintendente' : 'diretor_escolar');
  const papelNome = acesso.papel === 'administrador_acessos' ? 'Administrador de acessos'
    : acesso.papel === 'curador_conteudo' ? 'Curador de conteudo'
    : central ? 'Orgao Central' : (regional ? 'Superintendencia Regional de Ensino' : 'Direcao Escolar');
  // Um convite pendente ainda e um acesso ativo: a pessoa somente nao concluiu
  // o primeiro login. A referencia usa "inativo" para decidir se mostra
  // "reativar"; classificar pendentes assim fazia o botao parecer inoperante.
  const inativo = acesso.situacao === 'inativo' || acesso.situacao === 'revogado';
  return { id: acesso.id, origem: acesso.origem, perfil: central ? 'central' : (regional ? 'regional' : 'escola'),
    papel, papelNome, nome: acesso.nome, email: acesso.email, sre: acesso.regional, escola: acesso.escola,
    situacao: inativo ? 'inativo' : 'ativo',
    comSenha: acesso.origem === 'vinculo',
    convite: acesso.origem === 'provisionamento' && acesso.situacao === 'pendente',
    ultimoAcesso: acesso.ultimoReenvioEm ? new Date(acesso.ultimoReenvioEm).toLocaleString('pt-BR') : '',
  };
}

async function listarAcessosDoOrgaoCentral(): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (!contexto.acesso.podeAdministrarAcessos || !contexto.acesso.redeId) throw new Error('Sem permissao para administrar acessos desta rede.');
  const acessos = await acessosOrgaoCentralService.listar(contexto.acesso.redeId);
  acessosInstitucionaisPorEmail.clear();
  for (const acesso of acessos) {
    const chave = acesso.email.toLowerCase();
    acessosInstitucionaisPorEmail.set(chave, [...(acessosInstitucionaisPorEmail.get(chave) ?? []), acesso]);
  }
  return { ok: true, acessos: acessos.map(acessoParaPrototipo) };
}

async function salvarAcessoDoOrgaoCentral(args: { email?: string; emailAnterior?: string; nome?: string; papel?: string; perfil?: string; sre?: string; inep?: string; situacao?: string }): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (!contexto.acesso.redeId) throw new Error('Rede institucional nao encontrada.');
  const email = String(args.email ?? '').trim().toLowerCase();
  const existentes = acessosInstitucionaisPorEmail.get(email) ?? [];
  const emailAnterior = String(args.emailAnterior ?? '').trim().toLowerCase();
  const acessoEmEdicao = emailAnterior ? (acessosInstitucionaisPorEmail.get(emailAnterior) ?? [])[0] : undefined;
  if (acessoEmEdicao) {
    await acessosOrgaoCentralService.atualizar(acessoEmEdicao, email, String(args.nome ?? ''), String(args.situacao ?? 'ativo'));
    return listarAcessosDoOrgaoCentral();
  }
  if (args.situacao === 'inativo') {
    await Promise.all(existentes.map((acesso) => acessosOrgaoCentralService.revogar(acesso, 'Acesso suspenso pelo Orgao Central')));
  } else {
    const vinculosInativos = existentes.filter((acesso) => acesso.origem === 'vinculo' && acesso.situacao === 'inativo');
    if (vinculosInativos.length) {
      await Promise.all(vinculosInativos.map((acesso) => acessosOrgaoCentralService.reativar(acesso)));
      return listarAcessosDoOrgaoCentral();
    }
    const cobertura = await orgaoCentralService.obterCobertura();
    const papelInformado = String(args.papel ?? '');
    const papeisRegionaisLegados = new Set(['superintendente', 'diretor_educacional', 'coordenador_inspecao', 'equipe_de', 'equipe_inspecao']);
    const acessoRegionalExistente = existentes.find((acesso) => Boolean(acesso.regional));
    const eAcessoRegional = args.perfil === 'regional'
      || papeisRegionaisLegados.has(papelInformado)
      || Boolean(acessoRegionalExistente);
    const nomeRegional = String(args.sre ?? '') || acessoRegionalExistente?.regional || (eAcessoRegional ? contexto.acesso.sre : '');
    const regional = cobertura.find((item) => item.nomeRegional === nomeRegional)
      ?? (eAcessoRegional && contexto.acesso.regionalId
        ? cobertura.find((item) => item.regionalEnsinoId === contexto.acesso.regionalId)
        : undefined);
    const papel = eAcessoRegional ? 'leitor_regional'
      : (papelInformado === 'colegiado' ? 'assinante_colegiado'
        : (papelInformado || (args.perfil === 'escola' ? 'editor_escola' : 'leitor_rede')));
    const escolas = await escolasOrgaoCentralService.listar(contexto.acesso.redeId);
    const escola = escolas.find((item) => item.codigoInep === String(args.inep ?? ''));
    if (eAcessoRegional && !regional) throw new Error('A Superintendencia Regional deste acesso nao foi encontrada. Atualize a pagina e tente novamente.');
    if (papel === 'assinante_colegiado' && !escola) throw new Error('Selecione uma escola valida para o membro do Colegiado.');
    await acessosOrgaoCentralService.salvar(email, String(args.nome ?? ''), papel, contexto.acesso.redeId, regional?.regionalEnsinoId ?? '', escola?.id ?? '');
  }
  return listarAcessosDoOrgaoCentral();
}

async function listarHistoricoDeAcessos(args: { sre?: string; central?: boolean }): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (!contexto.acesso.podeAdministrarAcessos || !contexto.acesso.redeId) throw new Error('Sem permissao para consultar o historico de acessos.');
  const central = Boolean(args.central);
  const cobertura = central ? [] : await orgaoCentralService.obterCobertura();
  const regional = cobertura.find((item) => item.nomeRegional === String(args.sre ?? ''));
  if (!central && !regional) throw new Error('Superintendencia Regional nao encontrada.');
  const acessos = await acessosOrgaoCentralService.listarHistorico(contexto.acesso.redeId, regional?.regionalEnsinoId ?? '', central);
  return {
    ok: true,
    acessos: acessos.map((acesso) => ({
      ...acesso,
      perfil: acesso.papel === 'leitor_regional' ? 'regional' : 'central',
      papel: acesso.papel === 'leitor_regional' ? 'superintendente' : 'central',
    })),
  };
}

async function removerAcessoDoOrgaoCentral(email: string, motivo: string): Promise<Record<string, unknown>> {
  const acessos = acessosInstitucionaisPorEmail.get(email.toLowerCase()) ?? [];
  if (!acessos.length) throw new Error('Acesso nao encontrado. Atualize a lista e tente novamente.');
  await Promise.all(acessos.map((acesso) => acessosOrgaoCentralService.revogar(acesso, motivo)));
  return listarAcessosDoOrgaoCentral();
}


async function listarEscolasDoOrgaoCentral(): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (!contexto.acesso.redeId) throw new Error('Rede institucional nao encontrada.');
  const escolas = await escolasOrgaoCentralService.listar(contexto.acesso.redeId);
  return { ok: true, sres: [...new Set(escolas.map((escola) => escola.regional))], escolas: escolas.map((escola) => ({
    id: escola.id, inep: escola.codigoInep, codigoInep: escola.codigoInepCenso, escola: escola.nome,
    municipio: escola.municipio, sre: escola.regional, situacao: escola.ativa ? 'ativa' : 'inativa',
  })) };
}

async function salvarEscolaDoOrgaoCentral(args: { codigoInep?: string; escola?: string; municipio?: string; sre?: string; ativa?: boolean }): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  const cobertura = await orgaoCentralService.obterCobertura();
  const regional = cobertura.find((item) => item.nomeRegional === String(args.sre ?? ''));
  if (!regional || !contexto.acesso.redeId) throw new Error('Selecione uma regional existente para a escola.');
  await escolasOrgaoCentralService.salvar(contexto.acesso.redeId, String(args.codigoInep ?? ''), String(args.escola ?? ''), String(args.municipio ?? ''), regional.codigoRegional, args.ativa ?? true);
  return listarEscolasDoOrgaoCentral();
}

function linhasDaImportacao(texto: string): { codigoInep: string; nome: string; municipio: string; codigoRegional: string }[] {
  return texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha) => {
    const campos = linha.split(linha.includes(';') ? ';' : (linha.includes('\t') ? '\t' : ',')).map((campo) => campo.trim());
    const primeiro = campos[0] ?? ''; const quinto = campos[4] ?? '';
    return { codigoInep: /^\d{8}$/.test(quinto) ? quinto : primeiro, nome: campos[1] ?? '', municipio: campos[2] ?? '', codigoRegional: campos[3] ?? '' };
  });
}

async function importarEscolasDoOrgaoCentral(args: { texto?: string; simular?: boolean; chave?: string }): Promise<Record<string, unknown>> {
  const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
  if (!contexto.acesso.redeId) throw new Error('Rede institucional nao encontrada.');
  if (args.simular) {
    const resultado = await escolasOrgaoCentralService.validarLote(contexto.acesso.redeId, linhasDaImportacao(String(args.texto ?? '')));
    loteImportacaoEscolasAtual = resultado.id;
    return { ok: true, chave: resultado.id, total: resultado.totalLinhas, incluidas: resultado.linhasValidas, atualizadas: 0, totalErros: resultado.linhasComErro, erros: [], semInep: 0 };
  }
  const lote = String(args.chave ?? loteImportacaoEscolasAtual);
  if (!lote) throw new Error('Simule a importacao antes de aplicar o lote.');
  const aplicadas = await escolasOrgaoCentralService.aplicarLote(lote);
  loteImportacaoEscolasAtual = '';
  return { ok: true, incluidas: aplicadas, atualizadas: 0, totalErros: 0, erros: [] };
}

function arquivoDoDataUrl(valor: string): Blob {
  const partes = valor.match(/^data:([^;,]+);base64,(.*)$/);
  if (!partes) throw new Error('Arquivo de ata invalido.');
  const bytes = Uint8Array.from(atob(partes[2]), (caractere) => caractere.charCodeAt(0));
  return new Blob([bytes], { type: partes[1] });
}
async function hashDoArquivo(arquivo: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function extensaoDaAta(nome: string, tipo: string): string {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf','jpg','jpeg','png','docx'].includes(extensao)) return extensao;
  return ({ 'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx' } as Record<string,string>)[tipo] ?? 'pdf';
}

async function consultarPppParaLeitura(protocolo: string): Promise<Record<string, unknown>> {
  const consulta = await orgaoCentralService.consultarPpp(protocolo);
  if (consulta.ok !== true) return consulta;
  const respostas = (consulta.respostas ?? {}) as Record<string, unknown>;
  const progresso = (consulta.progresso ?? {}) as { telaAtual?: string; tarefas?: Record<string, boolean> };
  const escola = (consulta.escola ?? {}) as { nome?: string };
  const eventos = Array.isArray(consulta.eventos) ? consulta.eventos as Record<string, unknown>[] : [];
  return {
    ok: true,
    registro: {
      protocolo: String(consulta.protocolo ?? protocolo),
      versao: Number(consulta.numeroVersao ?? 1),
      status: situacaoParaPrototipo(String(consulta.situacao ?? 'rascunho')),
      escola: escola.nome ?? '',
      ...respostas,
      tarefas: JSON.stringify(progresso.tarefas ?? {}),
      tela: prototypeRuntime.indiceDaTela(String(progresso.telaAtual ?? 't00')),
      atualizadoEm: String(consulta.atualizadoEm ?? ''),
    },
    eventos,
    arquivos: Array.isArray(consulta.arquivos) ? consulta.arquivos : [],
  };
}

async function linhaDoTempoDoPpp(protocolo: string): Promise<Record<string, unknown>> {
  const consulta = await orgaoCentralService.consultarPpp(protocolo);
  if (consulta.ok !== true) return consulta;
  const escola = (consulta.escola ?? {}) as { nome?: string };
  const eventos = Array.isArray(consulta.eventos) ? consulta.eventos as Record<string, unknown>[] : [];
  return {
    ok: true,
    protocolo: String(consulta.protocolo ?? protocolo),
    versao: Number(consulta.numeroVersao ?? 1),
    escola: escola.nome ?? '',
    status: situacaoParaPrototipo(String(consulta.situacao ?? 'rascunho')),
    eventos: eventos.map((evento) => ({
      data: evento.ocorridoEm ? new Date(String(evento.ocorridoEm)).toLocaleString('pt-BR') : '',
      ato: String(evento.tipo ?? ''),
      detalhe: String(evento.descricao ?? ''),
      autor: String(evento.responsavel ?? ''),
      papel: '',
    })),
  };
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
  if (loginGoogleEmAndamento) return;
  loginGoogleEmAndamento = true;
  void supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}` } })
    .then(({ error }) => { if (error) throw error; })
    .catch((error) => { loginGoogleEmAndamento = false; prototypeRuntime.mostrarErro(message(error)); });
}

function mostrarLoginObrigatorio(): void {
  document.documentElement.classList.add('ppp-autenticacao-google-pendente');
  const portas = document.querySelector<HTMLElement>('#portas');
  if (portas) portas.hidden = true;
  iniciarLoginGoogle();
}
function liberarPortasAposLogin(): void {
  document.documentElement.classList.remove('ppp-autenticacao-google-pendente');
  document.querySelector('#loginGoogleObrigatorio')?.remove();
}

function mostrarAcessoTeste(): void { mostrarLoginObrigatorio(); }

// A referência v10.2 ainda contém as portas de e-mail e senha do Apps Script.
// No cliente web, qualquer tentativa de entrar por uma porta institucional
// começa pelo Google OAuth antes que o tratador legado possa abrir esse formulário.
document.addEventListener('click', (event) => {
  const porta = event.target instanceof Element ? event.target.closest('[data-porta]') : null;
  if (!porta) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  mostrarLoginObrigatorio();
}, true);

document.addEventListener('click', (event) => {
  const entradaLegada = event.target instanceof Element ? event.target.closest('#btnEntrarInst, #btnDefinirSenha') : null;
  if (!entradaLegada) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  mostrarLoginObrigatorio();
}, true);

window.servidor = (operation, args, success, failure) => {
  const run = async () => {
    if (operation === 'contexto') {
      const { data: sessao } = await supabase.auth.getSession();
      // Na abertura ainda não h? login. O protótipo deve exibir suas portas
      // de acesso normalmente; o Google ? solicitado após a escolha do papel.
      if (!sessao.session) {
        return success({
          controleAtivo: true,
          identificado: false,
          acessoInstitucional: false,
          email: '',
          acesso: null,
        });
      }
      return success(await obterContextoInstitucional());
    }
    if (operation === 'conteudoPublicado') {
      const { data, error } = await supabase.rpc('obter_conteudo_institucional_publicado');
      if (error) throw error;
      return success(data ?? { ok: true, itens: {}, versao: 0, padroes: {} });
    }
    if (operation === 'entrarInstitucional') {
      const contexto = await obterContextoInstitucional();
      return success({
        ok: true, token: 'sessao-supabase', perfil: contexto.acesso.perfil, papel: contexto.acesso.papel,
        papelNome: contexto.acesso.papelNome, nome: contexto.acesso.nome, email: contexto.email,
        escola: contexto.acesso.escola, inep: contexto.acesso.inep, sre: contexto.acesso.sre,
        censo: contexto.acesso.censo, podeValidar: contexto.acesso.podeGerenciarPpps, podeAssociar: contexto.acesso.podeAdministrarAcessos, soLeitura: !contexto.acesso.podeEditarConteudo && !contexto.acesso.podeAdministrarAcessos, cadastra: [],
      });
    }
    if (operation === 'painelRegistros') {
      const filtros = (args as { filtros?: { busca?: string; status?: string; sre?: string; municipio?: string } })?.filtros ?? {};
      return success(await listarRegistrosDoPainel(filtros));
    }
    if (operation === 'escolaSalvar') return success(await salvarEscolaDoOrgaoCentral({ codigoInep: (args as { codigoInep?: string }).codigoInep, escola: (args as { escola?: string }).escola, municipio: (args as { municipio?: string }).municipio, sre: (args as { sre?: string }).sre }));
    if (operation === 'escolaSituacao') {
      const codigo = String((args as { inep?: string }).inep ?? ''); const lista = await listarEscolasDoOrgaoCentral() as { escolas?: { inep?: string; codigoInep?: string; escola?: string; municipio?: string; sre?: string }[] };
      const escola = lista.escolas?.find((item) => item.inep === codigo); if (!escola) throw new Error('Escola nao encontrada.');
      return success(await salvarEscolaDoOrgaoCentral({ codigoInep: escola.codigoInep, escola: escola.escola, municipio: escola.municipio, sre: escola.sre, ativa: (args as { situacao?: string }).situacao !== 'inativa' }));
    }
    if (operation === 'escolasImportar') return success(await importarEscolasDoOrgaoCentral(args as { texto?: string; simular?: boolean; chave?: string }));
    if (operation === 'escolasListar') return success(await listarEscolasDoOrgaoCentral());
    if (operation === 'curadoriaAbrir') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (!contexto.acesso.redeId) throw new Error('Rede institucional nao encontrada.');
      const { data, error } = await supabase.rpc('abrir_curadoria_conteudo', { rede_destino_id: contexto.acesso.redeId });
      if (error) throw error; return success({ ...data, autor: contexto.acesso.nome });
    }
    if (operation === 'curadoriaSalvar') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      const alteracoes = (args as { alteracoes?: unknown }).alteracoes ?? [];
      const { data, error } = await supabase.rpc('salvar_rascunhos_curadoria', { rede_destino_id: contexto.acesso.redeId, alteracoes });
      if (error) throw error; return success({ ok: true, pendentes: Number(data ?? 0) });
    }
    if (operation === 'curadoriaPublicar') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      const caminhos = (args as { caminhos?: string[] }).caminhos ?? null;
      const { data, error } = await supabase.rpc('publicar_conteudo_institucional', { rede_destino_id: contexto.acesso.redeId, caminhos });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'curadoriaDescartar') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      const { data, error } = await supabase.rpc('descartar_rascunhos_curadoria', { rede_destino_id: contexto.acesso.redeId, caminhos: null });
      if (error) throw error; return success({ ok: true, pendentes: 0, removidos: Number(data ?? 0) });
    }
    if (operation === 'acessosListar') return success(await listarAcessosDoOrgaoCentral());
    if (operation === 'acessoSalvar') return success(await salvarAcessoDoOrgaoCentral(args as { email?: string; emailAnterior?: string; nome?: string; papel?: string; perfil?: string; sre?: string; inep?: string; situacao?: string }));
    if (operation === 'acessosHistorico') return success(await listarHistoricoDeAcessos(args as { sre?: string; central?: boolean }));
    if (operation === 'acessoRemover') return success(await removerAcessoDoOrgaoCentral(String((args as { email?: string }).email ?? ''), String((args as { motivo?: string }).motivo ?? '')));
    if (operation === 'reenviarConvite') {
      const email = String((args as { email?: string }).email ?? '').toLowerCase();
      const acesso = (acessosInstitucionaisPorEmail.get(email) ?? []).find((item) => item.origem === 'provisionamento');
      if (!acesso) throw new Error('Convite pendente nao encontrado.');
      await acessosOrgaoCentralService.reenviar(acesso);
      return success({ ok: true });
    }
    if (operation === 'coberturaRegional') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (contexto.acesso.perfil !== 'central') return success({ ok: false, erro: 'A cobertura de rede esta disponivel somente ao Orgao Central.' });
      return success(await carregarCoberturaCentral());
    }
    if (operation === 'registrarExportacao') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (contexto.acesso.perfil !== 'central' || !contexto.acesso.redeId) return success({ ok: false, erro: 'Sem permissao para registrar esta exportacao.' });
      const tipo = String((args as { tipo?: string })?.tipo ?? 'painel');
      const linhas = Number((args as { linhas?: number })?.linhas ?? 0);
      await orgaoCentralService.registrarExportacao(contexto.acesso.redeId, tipo, { linhas: String(linhas) });
      return success({ ok: true });
    }
    if (operation === 'registroLeitura') {
      const protocolo = String((args as { p?: string }).p ?? '');
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (contexto.acesso.perfil === 'central') return success(await consultarPppParaLeitura(protocolo));
      const encontrado = await service.resume(protocolo);
      if (!encontrado) return success({ ok: false, erro: 'Protocolo nao encontrado.' });
      return success({ ok: true, registro: { protocolo: encontrado.protocol, versao: 1, status: situacaoParaPrototipo(encontrado.status), ...encontrado.answers, tarefas: JSON.stringify(encontrado.tasks), tela: prototypeRuntime.indiceDaTela(encontrado.screenKey) } });
    }
    if (operation === 'linhaDoTempo') {
      const protocolo = String((args as { protocolo?: string }).protocolo ?? '');
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (contexto.acesso.perfil !== 'central') return success({ ok: false, erro: 'A linha do tempo esta disponivel somente para consulta institucional.' });
      return success(await linhaDoTempoDoPpp(protocolo));
    }
    if (operation === 'enviarParaValidacao') {
      const { data, error } = await supabase.rpc('enviar_ppp_para_validacao', { protocolo_busca: String((args as { protocolo?: string }).protocolo ?? '') });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'validarPPP') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (!contexto.acesso.podeGerenciarPpps) return success({ ok: false, erro: 'Sem permissao para validar PPPs.' });
      const dados = args as { protocolo?: string; parecer?: string };
      const { data, error } = await supabase.rpc('validar_ppp_rede', { protocolo_busca: String(dados.protocolo ?? ''), parecer: String(dados.parecer ?? '') });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'devolverPPP') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (!contexto.acesso.podeGerenciarPpps) return success({ ok: false, erro: 'Sem permissao para devolver PPPs.' });
      const dados = args as { protocolo?: string; parecer?: string };
      const { data, error } = await supabase.rpc('devolver_ppp_para_correcao', { protocolo_busca: String(dados.protocolo ?? ''), parecer: String(dados.parecer ?? '') });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'colegiadoDaFolha') {
      const { data, error } = await supabase.rpc('listar_colegiado_da_folha', { protocolo_busca: String((args as { p?: string }).p ?? '') });
      if (error) throw error; return success(data ?? { ok: false, membros: [] });
    }
    if (operation === 'presencaColegiado') {
      const dados = args as { p?: string; emails?: string[] };
      const { data, error } = await supabase.rpc('registrar_presenca_colegiado', { protocolo_busca: String(dados.p ?? ''), emails_presentes: dados.emails ?? [] });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'assinarNoSistema') {
      const dados = args as { protocolo?: string; aceite?: boolean };
      const { data, error } = await supabase.rpc('assinar_ppp_como_colegiado', { protocolo_busca: String(dados.protocolo ?? ''), aceite: Boolean(dados.aceite) });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'registrarAta') {
      const dados = args as { p?: string; base64?: string; nome?: string; dataReuniao?: string; identificacao?: string };
      const encontrado = await service.resume(String(dados.p ?? ''));
      if (!encontrado?.versionId) throw new Error('PPP nao encontrado para registrar a ata.');
      const arquivo = arquivoDoDataUrl(String(dados.base64 ?? ''));
      const extensao = extensaoDaAta(String(dados.nome ?? ''), arquivo.type);
      const caminho = 'atas/' + encontrado.versionId + '/' + crypto.randomUUID() + '.' + extensao;
      const { error: erroEnvio } = await supabase.storage.from('ppp-private').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
      if (erroEnvio) throw erroEnvio;
      const dataSql = String(dados.dataReuniao ?? '').split('/').reverse().join('-');
      const { data, error } = await supabase.rpc('registrar_ata_ppp', { versao_ppp_destino_id: encontrado.versionId, caminho_storage_destino: caminho, nome_original_destino: String(dados.nome ?? 'ata'), tipo_mime_destino: arquivo.type, tamanho_bytes_destino: arquivo.size, hash_sha256_destino: await hashDoArquivo(arquivo), data_reuniao_destino: dataSql, identificacao_destino: String(dados.identificacao ?? '') });
      if (error) { await supabase.storage.from('ppp-private').remove([caminho]); throw error; }
      return success({ ...data, registro: { protocolo: encontrado.protocol, versao: 1, status: situacaoParaPrototipo(encontrado.status), ...encontrado.answers, tarefas: JSON.stringify(encontrado.tasks), tela: prototypeRuntime.indiceDaTela(encontrado.screenKey), ataNome: String(dados.nome ?? ''), ataData: String(dados.dataReuniao ?? ''), ataIdent: String(dados.identificacao ?? '') } });
    }
    if (operation === 'assinarDirecao') {
      const dados = args as { p?: string; atesto?: boolean };
      const { data, error } = await supabase.rpc('assinar_direcao_ppp', { protocolo_busca: String(dados.p ?? ''), atesto: Boolean(dados.atesto) });
      if (error) throw error;
      if (data?.ok !== true) return success(data ?? { ok: false });
      const encontrado = await service.resume(String(dados.p ?? ''));
      if (!encontrado) return success(data);
      draft = encontrado;
      return success({ ...data, registro: { protocolo: encontrado.protocol, versao: 1, status: situacaoParaPrototipo(encontrado.status), ...encontrado.answers, tarefas: JSON.stringify(encontrado.tasks), tela: prototypeRuntime.indiceDaTela(encontrado.screenKey) } });
    }
    if (operation === 'homologarPPP') {
      const contexto = contextoInstitucionalAtual ?? await obterContextoInstitucional();
      if (!contexto.acesso.podeGerenciarPpps) return success({ ok: false, erro: 'Sem permissao para homologar PPPs.' });
      const dados = args as { protocolo?: string; confirmaSemAssinaturas?: boolean };
      const { data, error } = await supabase.rpc('homologar_ppp_rede', { protocolo_busca: String(dados.protocolo ?? ''), confirmar_sem_assinaturas: Boolean(dados.confirmaSemAssinaturas) });
      if (error) throw error; return success(data ?? { ok: false });
    }
    if (operation === 'salvarPPP') return success({ ok: true, ...(await saveDraft()) });
    if (operation === 'previaPDF') {
      const documentoHtml = String((args as { docHtml?: unknown })?.docHtml ?? '');
      if (!documentoHtml) throw new Error('O conteúdo da prévia não foi gerado pelo formulário.');
      const salvo = await saveDraft();
      if (!draft?.versionId) throw new Error('Não foi possível identificar a versão do PPP para gerar a prévia.');
      const { PdfPreviewService } = await import('../services/pdf-preview-service');
      const pdfPreviewService = new PdfPreviewService();
      const previa = await pdfPreviewService.gerarEArmazenar(draft.versionId, salvo.protocolo, documentoHtml);
      previaPendente = {
        arquivo: previa.arquivo,
        nomeArquivo: previa.nomeArquivo,
      };
      return success({ ok: true, base64: tokenPreviaParaImpressao, nomeArquivo: previa.nomeArquivo });
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
    console.error(error);
    const detalhe = message(error);
    // O HTML de referência traduz falhas do login em uma frase genérica.
    // Para a operação de entrada, devolvemos o detalhe j? sanitizado no
    // contrato esperado pelo próprio protótipo.
    if (operation === 'entrarInstitucional') {
      success({ ok: false, erro: detalhe });
      return;
    }
    if (failure) {
      failure(error);
      window.setTimeout(() => prototypeRuntime.mostrarErro(detalhe), 0);
      return;
    }
    prototypeRuntime.mostrarErro(detalhe);
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
  const target = event.target instanceof Element ? event.target.closest('#btnNovo, #piNovo') : null;
  if (!target) return;
  event.preventDefault(); event.stopImmediatePropagation();
  void supabase.auth.getSession().then(({ data }) => {
    if (!data.session) { mostrarLoginObrigatorio(); return false; }
    return createDraft().then(() => {
      const abrirNoItinerario = (window as unknown as { abrirNoItinerario?: (registro: unknown, protocolo: string) => void }).abrirNoItinerario;
      if (!abrirNoItinerario) throw new Error('O percurso v10.2 não foi inicializado. Atualize a página e tente novamente.');
      abrirNoItinerario(null, '');
      return true;
    });
  }).then((started) => {
    if (!started) return;
    const landing = document.querySelector<HTMLElement>('#landing');
    if (landing) landing.hidden = true;
  }).catch((error) => prototypeRuntime.mostrarErro(message(error)));
}, true);

function limparParametrosDeRetornoOAuth(): void {
  const url = new URL(window.location.href);
  ['code', 'error', 'error_code', 'error_description'].forEach((nome) => url.searchParams.delete(nome));
  // Tokens OAuth nunca devem permanecer no histórico, na URL copiada ou em
  // referências enviadas a outros recursos da página.
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

async function restaurarSessaoDoRetornoOAuth() {
  const parametros = new URLSearchParams(window.location.search);
  const erro = parametros.get('error_description') || parametros.get('error');
  if (erro) {
    limparParametrosDeRetornoOAuth();
    throw new Error(erro);
  }

  const codigo = parametros.get('code');
  if (codigo) {
    // Fluxo PKCE: o Google devolve um código temporário na query string.
    const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) throw error;
    limparParametrosDeRetornoOAuth();
    return data.session;
  }

  // Fluxo implícito: a configuração atual do provedor devolve os tokens no
  // fragmento. O fragmento não ? enviado ao servidor e precisa ser consumido
  // explicitamente pelo cliente antes de ser removido da URL.
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = fragmento.get('access_token');
  const refreshToken = fragmento.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    limparParametrosDeRetornoOAuth();
    return data.session;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function entrarAutomaticamenteNoPapelAutorizado(): Promise<void> {
  if (entradaInstitucionalAutomaticaFeita) return;
  entradaInstitucionalAutomaticaFeita = true;

  const contexto = await obterContextoInstitucional();
  const abrirPainel = () => prototypeRuntime.abrirPainelInstitucional({
    token: 'sessao-supabase',
    perfil: contexto.acesso.perfil,
    papel: contexto.acesso.papel,
    papelNome: contexto.acesso.papelNome,
    nome: contexto.acesso.nome,
    email: contexto.email,
    escola: contexto.acesso.escola,
    inep: contexto.acesso.inep,
    sre: contexto.acesso.sre,
    censo: contexto.acesso.censo,
    podeValidar: false,
    podeAssociar: false,
    soLeitura: false,
    cadastra: [],
  });

  // bootstrap() do arquivo de referência ? registrado antes deste módulo.
  // Esperar seu término impede que a antessala original substitua o painel.
  if (document.readyState === 'loading') {
    await new Promise<void>((resolve) => window.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
  }
  window.setTimeout(() => {
    abrirPainel();
    document.documentElement.classList.remove('ppp-restaurando-sessao');
  }, 0);
}

async function aplicarSessaoAutenticada(): Promise<void> {
  if (aplicacaoDaSessao) return aplicacaoDaSessao;
  aplicacaoDaSessao = (async () => {
    loginGoogleEmAndamento = false;
    const { error } = await supabase.rpc('sincronizar_meu_acesso');
    if (error) throw error;
    liberarPortasAposLogin();
    const parametros = new URLSearchParams(window.location.search);
    // Atualizar a página nunca reabre automaticamente o ?ltimo PPP. A retomada
    // direta existe apenas para links explícitos, que carregam ?retomar=PROTOCOLO.
    const protocol = parametros.get('retomar');
    if (protocol && await retomarRascunho(protocol)) {
      const landing = document.querySelector<HTMLElement>('#landing');
      if (landing) landing.hidden = true;
      if (parametros.has('retomar')) window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    await entrarAutomaticamenteNoPapelAutorizado();
  })();
  try { await aplicacaoDaSessao; } finally { aplicacaoDaSessao = null; }
}

supabase.auth.onAuthStateChange((_evento, sessao) => { if (sessao) void aplicarSessaoAutenticada(); });
void restaurarSessaoDoRetornoOAuth()
  .then((sessao) => {
    if (sessao) return aplicarSessaoAutenticada();
    // Sem sessão, a tela inicial continua no fluxo visual original. O login
    // s? ? iniciado quando a pessoa escolhe Direção, Colegiado ou outra porta.
    liberarPortasAposLogin();
  })
  .catch((error) => {
    loginGoogleEmAndamento = false;
    document.documentElement.classList.remove('ppp-restaurando-sessao');
    liberarPortasAposLogin();
    prototypeRuntime.mostrarErro(message(error));
  });

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
