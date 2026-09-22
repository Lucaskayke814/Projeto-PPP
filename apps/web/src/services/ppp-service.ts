import { PppRepository, type RetrievedPppDraft } from '../repositories/ppp-repository';
import { emptyPppDraft, type PppDraftState } from '../state/ppp-draft';

export class PppService {
  constructor(private readonly repository = new PppRepository()) {}

  async start(schoolId: string, answers: Record<string, unknown>): Promise<PppDraftState> {
    const persisted = await this.repository.create(schoolId, answers);
    return { ...emptyPppDraft(), protocol: persisted.protocol, versionId: persisted.versionId, revision: persisted.revision, answers };
  }

  async save(draft: PppDraftState): Promise<PppDraftState> {
    if (!draft.versionId || draft.revision === null) throw new Error('Nenhuma versÃ£o de PPP foi iniciada.');
    const persisted = await this.repository.save(draft.versionId, draft.revision, draft.answers, draft.screenKey, draft.tasks);
    return { ...draft, revision: persisted.revision };
  }

  async complete(draft: PppDraftState): Promise<PppDraftState> {
    if (!draft.versionId || draft.revision === null) throw new Error('Nenhuma versão de PPP foi iniciada.');
    await this.repository.complete(draft.versionId, draft.revision);
    return { ...draft, status: 'em_assinatura' };
  }

  async updateCurrentScreen(draft: PppDraftState, screenKey: string): Promise<PppDraftState> {
    if (!draft.versionId) throw new Error('Nenhuma versão de PPP foi iniciada.');
    await this.repository.updateCurrentScreen(draft.versionId, screenKey);
    return { ...draft, screenKey };
  }

  async resume(protocol: string): Promise<PppDraftState | null> {
    const persisted: RetrievedPppDraft | null = await this.repository.findByProtocol(protocol);
    if (!persisted) return null;
    return {
      protocol: persisted.protocol,
      versionId: persisted.versionId,
      revision: persisted.revision,
      status: persisted.status,
      screenKey: persisted.screenKey,
      answers: persisted.answers,
      tasks: persisted.tasks,
    };
  }
}
