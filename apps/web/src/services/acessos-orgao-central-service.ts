import { AcessosOrgaoCentralRepository, type AcessoInstitucional } from '../repositories/orgao-central-repository';

const papeisDoBanco: Record<string, string> = {
  central: 'leitor_rede', superintendente: 'leitor_regional', escola: 'editor_escola',
  leitor_rede: 'leitor_rede', leitor_regional: 'leitor_regional', editor_escola: 'editor_escola',
  curador_conteudo: 'curador_conteudo', administrador_acessos: 'administrador_acessos', colegiado: 'assinante_colegiado', assinante_colegiado: 'assinante_colegiado', gestor_ppp_rede: 'gestor_ppp_rede',
};

export class AcessosOrgaoCentralService {
  constructor(private readonly repository = new AcessosOrgaoCentralRepository()) {}
  listar(redeId: string): Promise<AcessoInstitucional[]> { return this.repository.listar(redeId); }
  salvar(email: string, nome: string, papelLegado: string, redeId: string, regionalId = '', escolaId = ''): Promise<void> {
    const papel = papeisDoBanco[papelLegado] ?? 'leitor_rede';
    return this.repository.salvar(email, nome, papel, redeId, regionalId, escolaId);
  }
  revogar(acesso: AcessoInstitucional, motivo: string): Promise<void> { return this.repository.revogar(acesso, motivo); }
  reativar(acesso: AcessoInstitucional): Promise<void> { return this.repository.reativar(acesso); }
  atualizar(acesso: AcessoInstitucional, email: string, nome: string, situacao: string): Promise<void> { return this.repository.atualizar(acesso, email, nome, situacao); }
  listarHistorico(redeId: string, regionalId = '', incluirCentral = false) { return this.repository.listarHistorico(redeId, regionalId, incluirCentral); }
  reenviar(acesso: AcessoInstitucional): Promise<void> { return this.repository.reenviar(acesso); }
}
