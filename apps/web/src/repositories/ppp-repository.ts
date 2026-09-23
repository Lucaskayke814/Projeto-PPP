import { supabase } from '../lib/supabase';

export type PersistedPppDraft = {
  versionId: string;
  protocol: string;
  revision: number;
  progressRevision: number;
};

export type RetrievedPppDraft = PersistedPppDraft & {
  status: string;
  answers: Record<string, unknown>;
  screenKey: string;
  tasks: Record<string, boolean>;
};

export type ListedPpp = {
  versionId: string;
  protocol: string;
  version: number;
  status: string;
  schoolName: string;
  schoolCode: string;
  completionPercentage: number;
  completedTasks: number;
  totalTasks: number;
  updatedAt: string;
};

type ListedPppRow = {
  versao_ppp_id: string;
  protocolo: string;
  numero_versao: number;
  situacao: string;
  nome_escola: string;
  codigo_inep: string;
  percentual_preenchimento: number;
  tarefas_concluidas: number;
  tarefas_total: number;
  atualizado_em: string;
};

export class PppRepository {
  async create(schoolId: string, answers: Record<string, unknown>): Promise<PersistedPppDraft> {
    const { data, error } = await supabase.rpc('criar_rascunho_ppp', { escola_destino_id: schoolId, respostas_iniciais: answers });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('O Supabase não retornou a versão criada.');
    return { versionId: row.versao_ppp_id, protocol: row.protocolo, revision: Number(row.numero_revisao), progressRevision: Number(row.numero_revisao_progresso) };
  }

  async save(versionId: string, expectedRevision: number, answers: Record<string, unknown>, screenKey: string, tasks: Record<string, boolean>): Promise<PersistedPppDraft> {
    const { data, error } = await supabase.rpc('salvar_rascunho_ppp', {
      versao_ppp_destino_id: versionId, revisao_esperada: expectedRevision, proximas_respostas: answers, proxima_tela_atual_chave: screenKey, proximas_tarefas: tasks,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('O Supabase não retornou a revisão salva.');
    return { versionId, protocol: '', revision: Number(row.numero_revisao), progressRevision: Number(row.numero_revisao_progresso) };
  }

  async complete(versionId: string, expectedRevision: number): Promise<void> {
    const { error } = await supabase.rpc('concluir_ppp', {
      versao_ppp_destino_id: versionId,
      revisao_esperada: expectedRevision,
    });
    if (error) throw error;
  }

  async updateCurrentScreen(versionId: string, screenKey: string): Promise<void> {
    const { error } = await supabase.rpc('atualizar_tela_atual_ppp', {
      versao_ppp_destino_id: versionId,
      proxima_tela_atual_chave: screenKey,
    });
    if (error) throw error;
  }

  async findByProtocol(protocol: string): Promise<RetrievedPppDraft | null> {
    const { data, error } = await supabase.rpc('obter_ppp_por_protocolo', { protocolo_busca: protocol });
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return {
      versionId: row.versao_ppp_id,
      protocol: row.protocolo,
      revision: Number(row.numero_revisao),
      progressRevision: 0,
      status: row.situacao,
      answers: row.respostas ?? {},
      screenKey: row.tela_atual_chave,
      tasks: row.tarefas ?? {},
    };
  }

  async listForPanel(searchTerm = ''): Promise<ListedPpp[]> {
    const { data, error } = await supabase.rpc('listar_ppps_do_painel', {
      termo_busca: searchTerm,
      tamanho_pagina: 20,
      deslocamento: 0,
    });
    if (error) throw error;
    return ((data ?? []) as ListedPppRow[]).map((row) => ({
      versionId: row.versao_ppp_id,
      protocol: row.protocolo,
      version: Number(row.numero_versao),
      status: row.situacao,
      schoolName: row.nome_escola,
      schoolCode: row.codigo_inep,
      completionPercentage: Number(row.percentual_preenchimento),
      completedTasks: Number(row.tarefas_concluidas),
      totalTasks: Number(row.tarefas_total),
      updatedAt: row.atualizado_em,
    }));
  }
}
