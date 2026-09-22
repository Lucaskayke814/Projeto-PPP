import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));

import { toRevisionAnswers } from './legacy-adapter';

describe('adapter v6.5', () => {
  it('preserva dados mutáveis sob namespaces estáveis', () => {
    const answers = toRevisionAnswers({
      tela: 3,
      dados: { escola: 'Escola Estadual Exemplo' },
      textos: { tHistorico: 'Texto da escola' },
      selecoes: { etapas: ['efai'] },
      indicadores: { ano: '2026' },
      detalhes: {},
      tarefas: { '0:0': true },
    });
    expect(answers).toMatchObject({
      legacy_contract: 'v6.5',
      school_data: { escola: 'Escola Estadual Exemplo' },
      selections: { etapas: ['efai'] },
    });
  });
});
