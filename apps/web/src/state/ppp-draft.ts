export type PppDraftState = {
  protocol: string | null;
  versionId: string | null;
  revision: number | null;
  status: string;
  screenKey: string;
  answers: Record<string, unknown>;
  tasks: Record<string, boolean>;
};

export const emptyPppDraft = (): PppDraftState => ({
  protocol: null,
  versionId: null,
  revision: null,
  status: 'rascunho',
  screenKey: 't02',
  answers: {},
  tasks: {},
});
