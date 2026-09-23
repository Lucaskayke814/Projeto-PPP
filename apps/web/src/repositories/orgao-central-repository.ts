import { supabase } from '../lib/supabase';

export type FiltrosConsultaCentral = {
  busca?: string;
  situacao?: string;
  regional?: string;
  municipio?: string;
  linhas?: string;
};

export type LinhaPppCentral = {
  versaoPppId: string;
  protocolo: string;
  numeroVersao: number;
  situacao: string;
  nomeEscola: string;
  codigoInep: string;
  municipio: string;
  nomeRegional: string;
  telaAtual: string;
  atualizadoEm: string;
  totalRegistros: number;
};

export type CoberturaRegional = {
  regionalEnsinoId: string;
  codigoRegional: string;
  nomeRegional: string;
  escolasAtivas: number;
  escolasComPpp: number;
  pppsEmAndamento: number;
  pppsEmValidacao: number;
  pppsEmAssinatura: number;
  pppsHomologados: number;
};

type LinhaPppCentralRpc = {
  versao_ppp_id: string; protocolo: string; numero_versao: number; situacao: string;
  nome_escola: string; codigo_inep: string; municipio: string; nome_regional: string;
  tela_atual: string; atualizado_em: string; total_registros: number;
};

type CoberturaRegionalRpc = {
  regional_ensino_id: string; codigo_regional: string; nome_regional: string;
  escolas_ativas: number; escolas_com_ppp: number; ppps_em_andamento: number;
  ppps_em_validacao: number; ppps_em_assinatura: number; ppps_homologados: number;
};

export class OrgaoCentralRepository {
  async listarPpps(filtros: FiltrosConsultaCentral, tamanhoPagina = 100, deslocamento = 0): Promise<LinhaPppCentral[]> {
    const { data, error } = await supabase.rpc('listar_ppps_orgao_central', {
      filtros: filtros, tamanho_pagina: tamanhoPagina, deslocamento,
    });
    if (error) throw error;
    return ((data ?? []) as LinhaPppCentralRpc[]).map((linha) => ({
      versaoPppId: linha.versao_ppp_id, protocolo: linha.protocolo, numeroVersao: Number(linha.numero_versao),
      situacao: linha.situacao, nomeEscola: linha.nome_escola, codigoInep: linha.codigo_inep,
      municipio: linha.municipio, nomeRegional: linha.nome_regional, telaAtual: linha.tela_atual,
      atualizadoEm: linha.atualizado_em, totalRegistros: Number(linha.total_registros),
    }));
  }

  async obterCobertura(): Promise<CoberturaRegional[]> {
    const { data, error } = await supabase.rpc('obter_cobertura_rede_ppps');
    if (error) throw error;
    return ((data ?? []) as CoberturaRegionalRpc[]).map((linha) => ({
      regionalEnsinoId: linha.regional_ensino_id, codigoRegional: linha.codigo_regional,
      nomeRegional: linha.nome_regional, escolasAtivas: Number(linha.escolas_ativas),
      escolasComPpp: Number(linha.escolas_com_ppp), pppsEmAndamento: Number(linha.ppps_em_andamento),
      pppsEmValidacao: Number(linha.ppps_em_validacao), pppsEmAssinatura: Number(linha.ppps_em_assinatura),
      pppsHomologados: Number(linha.ppps_homologados),
    }));
  }

  async registrarExportacao(redeId: string, tipo: string, filtros: FiltrosConsultaCentral): Promise<void> {
    const { error } = await supabase.rpc('registrar_exportacao_orgao_central', {
      rede_destino_id: redeId, tipo_exportacao: tipo, filtros,
    });
    if (error) throw error;
  }

  async consultarPpp(protocolo: string): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('consultar_ppp_orgao_central', { protocolo_busca: protocolo });
    if (error) throw error;
    return (data ?? {}) as Record<string, unknown>;
  }
}

export type AcessoInstitucional = {
  id: string; origem: 'vinculo' | 'provisionamento'; nome: string; email: string; papel: string;
  regional: string; escola: string; situacao: string; criadoEm: string; ultimoReenvioEm: string;
};
export type HistoricoAcessoInstitucional = {
  nome: string; email: string; papel: string; inicio: string; fim: string; vigente: boolean;
  registradoPor: string; encerradoPor: string; motivo: string;
};

type VinculoRpc = { vinculo_id: string; nome: string; email: string; papel: string; regional: string; escola: string; ativo: boolean; criado_em: string };
type ProvisionamentoRpc = { provisionamento_id: string; nome_convidado: string; email: string; papel: string; regional: string; escola: string; situacao: string; criado_em: string; ultimo_reenvio_em: string | null };

export class AcessosOrgaoCentralRepository {
  async listar(redeId: string): Promise<AcessoInstitucional[]> {
    const [vinculos, provisionamentos] = await Promise.all([
      supabase.rpc('listar_vinculos_rede', { rede_destino_id: redeId }),
      supabase.rpc('listar_provisionamentos_acesso', { rede_destino_id: redeId }),
    ]);
    if (vinculos.error) throw vinculos.error;
    if (provisionamentos.error) throw provisionamentos.error;
    const ativos = ((vinculos.data ?? []) as VinculoRpc[]).map((item) => ({
      id: item.vinculo_id, origem: 'vinculo' as const, nome: item.nome, email: item.email, papel: item.papel,
      regional: item.regional, escola: item.escola, situacao: item.ativo ? 'ativo' : 'inativo', criadoEm: item.criado_em, ultimoReenvioEm: '',
    }));
    const pendentes = ((provisionamentos.data ?? []) as ProvisionamentoRpc[])
      .filter((item) => item.situacao !== 'utilizado')
      .map((item) => ({
        id: item.provisionamento_id, origem: 'provisionamento' as const, nome: item.nome_convidado, email: item.email, papel: item.papel,
        regional: item.regional, escola: item.escola, situacao: item.situacao, criadoEm: item.criado_em, ultimoReenvioEm: item.ultimo_reenvio_em ?? '',
      }));
    return [...ativos, ...pendentes];
  }

  async salvar(email: string, nome: string, papel: string, redeId: string, regionalId = '', escolaId = ''): Promise<void> {
    const { error } = await supabase.rpc('salvar_provisionamento_acesso', {
      email_destino: email, nome_destino: nome, papel_destino: papel, rede_destino_id: redeId,
      regional_destino_id: escolaId ? null : (regionalId || null), escola_destino_id: escolaId || null,
    });
    if (error) throw error;
  }

  async revogar(acesso: AcessoInstitucional, motivo: string): Promise<void> {
    const chamada = acesso.origem === 'vinculo'
      ? supabase.rpc('revogar_vinculo_rede', { vinculo_destino_id: acesso.id, motivo })
      : supabase.rpc('revogar_provisionamento_acesso', { provisionamento_destino_id: acesso.id, motivo });
    const { error } = await chamada;
    if (error) throw error;
  }

  async reativar(acesso: AcessoInstitucional): Promise<void> {
    if (acesso.origem !== 'vinculo') throw new Error('Este acesso ainda e um convite pendente.');
    const { error } = await supabase.rpc('reativar_vinculo_rede', { vinculo_destino_id: acesso.id });
    if (error) throw error;
  }

  async atualizar(acesso: AcessoInstitucional, email: string, nome: string, situacao: string): Promise<void> {
    const { error } = await supabase.rpc('atualizar_acesso_institucional', {
      origem_destino: acesso.origem, acesso_destino_id: acesso.id, email_destino: email,
      nome_destino: nome, situacao_destino: situacao,
    });
    if (error) throw error;
  }

  async listarHistorico(redeId: string, regionalId: string, incluirCentral: boolean): Promise<HistoricoAcessoInstitucional[]> {
    const { data, error } = await supabase.rpc('listar_historico_acessos_institucionais', {
      rede_destino_id: redeId, regional_destino_id: regionalId || null, incluir_central: incluirCentral,
    });
    if (error) throw error;
    return ((data ?? []) as Array<{ nome: string; email: string; papel: string; inicio: string; fim: string; vigente: boolean; registrado_por: string; encerrado_por: string; motivo: string }>).map((item) => ({
      nome: item.nome, email: item.email, papel: item.papel, inicio: item.inicio, fim: item.fim,
      vigente: item.vigente, registradoPor: item.registrado_por, encerradoPor: item.encerrado_por, motivo: item.motivo,
    }));
  }

  async reenviar(acesso: AcessoInstitucional): Promise<void> {
    if (acesso.origem !== 'provisionamento') throw new Error('O convite ja foi utilizado por esta conta.');
    const { error } = await supabase.rpc('registrar_reenvio_convite_acesso', { provisionamento_destino_id: acesso.id });
    if (error) throw error;
  }
}
export type EscolaDaRede = { id: string; codigoInep: string; codigoInepCenso: string; nome: string; municipio: string; regional: string; ativa: boolean };
type EscolaDaRedeRpc = { escola_id: string; codigo_inep: string; codigo_inep_censo: string; nome_escola: string; municipio: string; nome_regional: string; ativa: boolean };
export type LinhaImportacaoEscola = { codigoInep: string; nome: string; municipio: string; codigoRegional: string };
export type ResultadoLoteEscolas = { id: string; totalLinhas: number; linhasValidas: number; linhasComErro: number; situacao: string };

export class EscolasOrgaoCentralRepository {
  async listar(redeId: string): Promise<EscolaDaRede[]> {
    const { data, error } = await supabase.rpc('listar_escolas_rede', { rede_destino_id: redeId, tamanho_pagina: 2000, deslocamento: 0 });
    if (error) throw error;
    return ((data ?? []) as EscolaDaRedeRpc[]).map((item) => ({ id: item.escola_id, codigoInep: item.codigo_inep, codigoInepCenso: item.codigo_inep_censo, nome: item.nome_escola, municipio: item.municipio, regional: item.nome_regional, ativa: item.ativa }));
  }

  async salvar(redeId: string, codigoInep: string, nome: string, municipio: string, codigoRegional: string, ativa = true): Promise<void> {
    const { error } = await supabase.rpc('salvar_escola_rede', { rede_destino_id: redeId, codigo_inep_destino: codigoInep, nome_destino: nome, municipio_destino: municipio, codigo_regional_destino: codigoRegional, ativa_destino: ativa });
    if (error) throw error;
  }
  async validarLote(redeId: string, linhas: LinhaImportacaoEscola[]): Promise<ResultadoLoteEscolas> {
    const { data, error } = await supabase.rpc('criar_lote_importacao_escolas', { rede_destino_id: redeId, nome_arquivo_destino: 'importacao-manual.csv', linhas_destino: linhas });
    if (error) throw error;
    return { id: String(data.id), totalLinhas: Number(data.totalLinhas), linhasValidas: Number(data.linhasValidas), linhasComErro: Number(data.linhasComErro), situacao: String(data.situacao) };
  }
  async aplicarLote(id: string): Promise<number> {
    const { data, error } = await supabase.rpc('aplicar_lote_importacao_escolas', { lote_destino_id: id });
    if (error) throw error;
    return Number(data.escolasAplicadas ?? 0);
  }
}


