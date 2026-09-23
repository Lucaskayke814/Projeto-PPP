import { OrgaoCentralRepository, type CoberturaRegional, type FiltrosConsultaCentral, type LinhaPppCentral } from '../repositories/orgao-central-repository';

const situacoesDoBanco: Record<string, string> = {
  'Em andamento': 'rascunho',
  'Em validacao': 'em_validacao',
  'Validado': 'validado',
  'Em assinatura': 'em_assinatura',
  'Assinado': 'assinado',
  'Concluido': 'concluido',
  'Enviado para homologacao': 'enviado_homologacao',
  'Homologado': 'homologado',
};

export class OrgaoCentralService {
  constructor(private readonly repository = new OrgaoCentralRepository()) {}

  async listarPpps(filtros: FiltrosConsultaCentral): Promise<LinhaPppCentral[]> {
    const situacao = filtros.situacao ? situacoesDoBanco[normalizar(filtros.situacao)] ?? filtros.situacao : '';
    return this.repository.listarPpps({ ...filtros, situacao });
  }

  obterCobertura(): Promise<CoberturaRegional[]> {
    return this.repository.obterCobertura();
  }

  registrarExportacao(redeId: string, tipo: string, filtros: FiltrosConsultaCentral): Promise<void> {
    return this.repository.registrarExportacao(redeId, tipo, filtros);
  }

  consultarPpp(protocolo: string): Promise<Record<string, unknown>> {
    return this.repository.consultarPpp(protocolo);
  }
}

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
