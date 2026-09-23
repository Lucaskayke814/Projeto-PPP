import { EscolasOrgaoCentralRepository, type EscolaDaRede, type LinhaImportacaoEscola, type ResultadoLoteEscolas } from '../repositories/orgao-central-repository';
export class EscolasOrgaoCentralService {
  constructor(private readonly repository = new EscolasOrgaoCentralRepository()) {}
  listar(redeId: string): Promise<EscolaDaRede[]> { return this.repository.listar(redeId); }
  salvar(redeId: string, codigoInep: string, nome: string, municipio: string, codigoRegional: string, ativa = true): Promise<void> { return this.repository.salvar(redeId,codigoInep,nome,municipio,codigoRegional,ativa); }
  validarLote(redeId: string, linhas: LinhaImportacaoEscola[]): Promise<ResultadoLoteEscolas> { return this.repository.validarLote(redeId,linhas); }
  aplicarLote(id: string): Promise<number> { return this.repository.aplicarLote(id); }
}
