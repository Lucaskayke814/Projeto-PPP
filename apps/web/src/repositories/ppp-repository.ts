import { supabase } from '../lib/supabase';

export type PersistedPppDraft = {
  versionId: string;
  protocol: string;
  revision: number;
  progressRevision: number;
};

export class PppRepository {
  async create(schoolId: string, answers: Record<string, unknown>): Promise<PersistedPppDraft> {
    const { data, error } = await supabase.rpc('create_ppp_draft', { target_school_id: schoolId, initial_answers: answers });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('O Supabase não retornou a versão criada.');
    return { versionId: row.version_id, protocol: row.protocol, revision: Number(row.revision_number), progressRevision: Number(row.progress_revision) };
  }

  async save(versionId: string, expectedRevision: number, answers: Record<string, unknown>, screenKey: string, tasks: Record<string, boolean>): Promise<PersistedPppDraft> {
    const { data, error } = await supabase.rpc('save_ppp_draft', {
      target_version_id: versionId, expected_revision: expectedRevision, next_answers: answers, next_screen_key: screenKey, next_tasks: tasks,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('O Supabase não retornou a revisão salva.');
    return { versionId, protocol: '', revision: Number(row.revision_number), progressRevision: Number(row.progress_revision) };
  }
}
