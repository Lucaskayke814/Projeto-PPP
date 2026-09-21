/* Adaptador opcional para o HTML v6.5.
 * Ative criando supabase-config.js a partir do arquivo .example, sem service_role.
 * O payload legado é preservado em JSONB para que o formulário possa evoluir.
 */
(function (global) {
  const config = global.GERADOR_PPP_SUPABASE || {};
  const statusLegado = {
    draft: 'Em andamento', signature_collection: 'Em assinatura', signed: 'Assinado',
    completed: 'Concluído', sent_for_homologation: 'Enviado para homologação', homologated: 'Homologado'
  };
  let clientPromise;

  function ativo() { return Boolean(config.url && config.anonKey); }
  async function client() {
    if (!ativo()) throw new Error('Supabase não configurado neste ambiente.');
    if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(config.url, config.anonKey));
    return clientPromise;
  }
  function erro(error) { throw new Error(error && error.message ? error.message : String(error)); }
  function json(value, fallback) {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value || ''); } catch (_) { return fallback; }
  }
  function tela(chave) {
    const match = /^t(\d+)$/.exec(chave || '');
    return match ? Number(match[1]) : 0;
  }
  function dataHora(value) {
    return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
  }
  function respostasLegadas(payload) {
    const copia = Object.assign({}, payload || {});
    delete copia.sessao; delete copia.docHtml; delete copia.ignorarDuplicado;
    return { legacy_contract: 'v6.5', legacy_payload: copia };
  }
  function registro(row) {
    const respostas = row.respostas || {};
    const legado = Object.assign({}, respostas.legacy_payload || respostas);
    legado.protocolo = row.protocolo;
    legado.versao = row.numero_versao;
    legado.status = statusLegado[row.situacao] || row.situacao;
    legado.tela = tela(row.tela_atual);
    legado.tarefas = legado.tarefas || JSON.stringify(row.tarefas || {});
    legado.atualizadoEm = dataHora(row.atualizado_em);
    legado.versaoId = row.versao_id;
    legado.numeroRevisao = Number(row.numero_revisao);
    return legado;
  }
  async function usuarioAtual() {
    const c = await client();
    const { data, error } = await c.auth.getUser();
    if (error) erro(error);
    return data.user;
  }
  async function contexto() {
    const c = await client();
    const user = await usuarioAtual();
    if (!user) return { email: '', admin: false, controleAtivo: false, acessoInstitucional: true };
    const { data, error } = await c.rpc('obter_contexto_usuario');
    if (error) erro(error);
    const vinculos = (data && data.vinculos) || [];
    const central = vinculos.some(v => ['central_viewer', 'content_curator', 'access_admin'].includes(v.papel));
    const regional = vinculos.find(v => v.papel === 'regional_viewer');
    return {
      email: (data && data.email) || user.email || '', admin: central, curadoria: vinculos.some(v => v.papel === 'content_curator'),
      curador: vinculos.some(v => v.papel === 'content_curator'), controleAtivo: central || Boolean(regional),
      acessoInstitucional: true, perfil: central ? 'central' : (regional ? 'regional' : 'escola'),
      sre: (regional && regional.regional) || '', nome: (data && data.nome) || user.email || ''
    };
  }
  async function entrar(args) {
    const c = await client();
    const { error } = await c.auth.signInWithPassword({ email: String(args.email || '').trim(), password: String(args.senha || '') });
    if (error) return { ok: false, erro: 'Não foi possível autenticar com esse e-mail e senha.' };
    const dados = await contexto();
    if (!dados.controleAtivo) return { ok: false, erro: 'Este usuário não possui acesso institucional.' };
    return { ok: true, token: 'sessao-supabase', perfil: dados.perfil, sre: dados.sre, nome: dados.nome };
  }
  async function salvar(args) {
    const c = await client();
    if (!await usuarioAtual()) return { ok: false, erro: 'Entre com uma conta autorizada antes de salvar.' };
    const tarefas = json(args.tarefas, {});
    const respostas = respostasLegadas(args);
    let existente = null;
    if (args.protocolo) {
      const { data, error } = await c.rpc('obter_ppp_por_protocolo', { protocolo_busca: args.protocolo });
      if (error) erro(error);
      existente = data && data[0];
    }
    if (existente) {
      const { data, error } = await c.rpc('save_ppp_draft', {
        target_version_id: existente.versao_id, expected_revision: Number(existente.numero_revisao),
        next_answers: respostas, next_screen_key: 't' + String(Number(args.tela) || 0).padStart(2, '0'), next_tasks: tarefas
      });
      if (error) return { ok: false, erro: error.message };
      const salvo = data && data[0];
      return { ok: true, protocolo: existente.protocolo, versao: existente.numero_versao,
        versaoId: existente.versao_id, numeroRevisao: Number(salvo.revision_number), atualizadoEm: dataHora(new Date().toISOString()) };
    }
    const { data: escolas, error: erroEscola } = await c.from('escolas').select('id').eq('inep', String(args.inep || '')).limit(2);
    if (erroEscola) return { ok: false, erro: erroEscola.message };
    if (!escolas || escolas.length !== 1) return { ok: false, erro: 'Não foi encontrada uma escola autorizada com este código INEP. Peça o provisionamento da escola e do seu vínculo.' };
    const { data, error } = await c.rpc('create_ppp_draft', { target_school_id: escolas[0].id, initial_answers: respostas });
    if (error) return { ok: false, erro: error.message };
    const criado = data && data[0];
    return { ok: true, protocolo: criado.protocol, versao: 1, versaoId: criado.version_id,
      numeroRevisao: Number(criado.revision_number), atualizadoEm: dataHora(new Date().toISOString()) };
  }
  async function buscar(args) {
    const c = await client();
    const { data, error } = await c.rpc('obter_ppp_por_protocolo', { protocolo_busca: args.p });
    if (error) return { ok: false, erro: error.message };
    if (!data || !data[0]) return { ok: false, erro: 'PPP não encontrado ou sem acesso para sua conta.' };
    return { ok: true, registro: registro(data[0]) };
  }
  async function painel(args) {
    const c = await client();
    const f = (args && args.filtros) || {};
    const situacoes = Object.fromEntries(Object.entries(statusLegado).map(([chave, rotulo]) => [rotulo, chave]));
    const { data, error } = await c.rpc('listar_painel_ppp', { filtros: {
      regional: f.sre || '', situacao: situacoes[f.status] || '', somente_vencidos: Boolean(f.vencidas), busca: f.busca || ''
    }});
    if (error) return { ok: false, erro: error.message };
    const linhas = (data || []).map(x => ({ protocolo: x.protocolo, versao: x.numero_versao, escola: x.escola, inep: x.inep,
      municipio: x.municipio, sre: x.regional, status: statusLegado[x.situacao] || x.situacao,
      pct: x.percentual_preenchimento, assinadas: x.assinaturas_realizadas, totalAssin: x.assinaturas_previstas,
      ressalvas: x.ressalvas, ata: x.ata_registrada, revisaoVencida: x.revisao_vencida,
      homolData: dataHora(x.homologado_em), atualizadoEm: dataHora(x.atualizado_em), pdfUrl: '' }));
    const ctx = await contexto();
    return { ok: true, perfil: ctx.perfil, sre: ctx.sre, nome: ctx.nome, linhas, sres: [...new Set(linhas.map(x => x.sre).filter(Boolean))] };
  }
  async function conteudo() {
    const c = await client();
    const { data, error } = await c.rpc('obter_conteudo_institucional_ativo');
    if (error || !data || !data[0]) return { versao: 0, itens: {}, padroes: {} };
    const pacote = data[0].conteudo || {};
    return { versao: data[0].versao, itens: pacote.itens || {}, padroes: pacote.padroes || {} };
  }
  const handlers = { contexto, entrarInstitucional: entrar, salvarPPP: salvar, buscarPPP: buscar, registroLeitura: buscar, painelRegistros: painel, conteudoPublicado: conteudo };
  global.GeradorPPPSupabase = {
    ativo, suporta: function (operacao) { return ativo() && Boolean(handlers[operacao]); },
    chamar: async function (operacao, argumentos) { return handlers[operacao](argumentos || {}); },
    sair: async function () { const c = await client(); return c.auth.signOut(); }
  };
})(window);
