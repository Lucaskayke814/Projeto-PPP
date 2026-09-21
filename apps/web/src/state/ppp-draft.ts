export type PppDraftState = {
  protocol: string | null;
  versionId: string | null;
  revision: number | null;
  screenKey: string;
  answers: Record<string, unknown>;
  tasks: Record<string, boolean>;
};

export const emptyPppDraft = (): PppDraftState => ({
  protocol: null,
  versionId: null,
  revision: null,
  screenKey: 't00',
  answers: {},
  tasks: {},
});
