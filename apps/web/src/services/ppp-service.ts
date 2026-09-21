import { PppRepository } from '../repositories/ppp-repository';
import { emptyPppDraft, type PppDraftState } from '../state/ppp-draft';

export class PppService {
  constructor(private readonly repository = new PppRepository()) {}

  async start(schoolId: string, answers: Record<string, unknown>): Promise<PppDraftState> {
    const persisted = await this.repository.create(schoolId, answers);
    return { ...emptyPppDraft(), protocol: persisted.protocol, versionId: persisted.versionId, revision: persisted.revision, answers };
  }

  async save(draft: PppDraftState): Promise<PppDraftState> {
    if (!draft.versionId || draft.revision === null) throw new Error('Nenhuma versão de PPP foi iniciada.');
    const persisted = await this.repository.save(draft.versionId, draft.revision, draft.answers, draft.screenKey, draft.tasks);
    return { ...draft, revision: persisted.revision };
  }
}
