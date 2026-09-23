import { describe, expect, it, vi } from 'vitest';
import type { PppRepository } from '../repositories/ppp-repository';
import { PppService } from './ppp-service';

describe('PppService', () => {
  it('preserva a chave de tela v10.2 desde a criação do rascunho', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({
        versionId: '00000000-0000-0000-0000-000000000001',
        protocol: 'PPP-2026-00000001', revision: 1, progressRevision: 0,
      }),
      updateCurrentScreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as PppRepository;
    const service = new PppService(repository);

    const started = await service.start('00000000-0000-0000-0000-000000000002', { escola: 'Escola de teste' });
    const updated = await service.updateCurrentScreen(started, 't00b');

    expect(started.protocol).toBe('PPP-2026-00000001');
    expect(started.screenKey).toBe('t02');
    expect(updated.screenKey).toBe('t00b');
    expect(repository.updateCurrentScreen).toHaveBeenCalledWith(started.versionId, 't00b');
  });
});
