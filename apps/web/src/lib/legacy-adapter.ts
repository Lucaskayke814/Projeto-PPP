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
  const { data, error } = await supabase.rpc('create_ppp_draft', {
    target_school_id: schoolId,
    initial_answers: toRevisionAnswers(draft),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('O banco não retornou a versão criada.');
  return { versionId: row.version_id, protocol: row.protocol, revision: Number(row.revision_number), progressRevision: Number(row.progress_revision) };
}

export async function saveDraft(versionId: string, expectedRevision: number, draft: LegacyDraft): Promise<PersistedDraft> {
  const { data, error } = await supabase.rpc('save_ppp_draft', {
    target_version_id: versionId,
    expected_revision: expectedRevision,
    next_answers: toRevisionAnswers(draft),
    next_screen_key: screenKeyFor(draft.tela),
    next_tasks: draft.tarefas,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('O banco não retornou a revisão gravada.');
  return { versionId, protocol: draft.protocolo ?? '', revision: Number(row.revision_number), progressRevision: Number(row.progress_revision) };
}
