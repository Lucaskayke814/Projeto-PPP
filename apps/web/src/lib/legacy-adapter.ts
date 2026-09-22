import { supabase } from './supabase';

export type LegacyDraft = {
  protocolo?: string;
  tela: number;
  dados: Record<string, unknown>;
  textos: Record<string, string>;
  selecoes: Record<string, string[]>;
  indicadores: unknown;
  detalhes: unknown;
  tarefas: Record<string, boolean>;
};

export type PersistedDraft = {
  versionId: string;
  protocol: string;
  revision: number;
  progressRevision: number;
};

const screenKeyFor = (screen: number) => `t${String(screen).padStart(2, '0')}`;

/**
 * Converte o contrato do HTML v6.5 em um objeto versionado. O HTML continua
 * responsável por sua interface; a fonte de verdade deixa de ser o DOM.
 */
export function toRevisionAnswers(draft: LegacyDraft): Record<string, unknown> {
  return {
    legacy_contract: 'v6.5',
    school_data: draft.dados,
    text_answers: draft.textos,
    selections: draft.selecoes,
    indicators: draft.indicadores,
    modality_details: draft.detalhes,
  };
}

export async function createDraft(schoolId: string, draft: LegacyDraft): Promise<PersistedDraft> {
  const { data, error } = await supabase.rpc('criar_rascunho_ppp', {
    escola_destino_id: schoolId,
    respostas_iniciais: toRevisionAnswers(draft),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('O banco não retornou a versão criada.');
  return { versionId: row.versao_ppp_id, protocol: row.protocolo, revision: Number(row.numero_revisao), progressRevision: Number(row.numero_revisao_progresso) };
}

export async function saveDraft(versionId: string, expectedRevision: number, draft: LegacyDraft): Promise<PersistedDraft> {
  const { data, error } = await supabase.rpc('salvar_rascunho_ppp', {
    versao_ppp_destino_id: versionId,
    revisao_esperada: expectedRevision,
    proximas_respostas: toRevisionAnswers(draft),
    proxima_tela_atual_chave: screenKeyFor(draft.tela),
    proximas_tarefas: draft.tarefas,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('O banco não retornou a revisão gravada.');
  return { versionId, protocol: draft.protocolo ?? '', revision: Number(row.numero_revisao), progressRevision: Number(row.numero_revisao_progresso) };
}
