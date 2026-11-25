import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ roles: ['Super Admin'], reads: vi.fn(), invoke: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ roles: mocks.roles }) }));
vi.mock('@/components/infinity/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: (table: string) => {
    mocks.reads(table);
    const query = { select: () => query, eq: () => query, order: () => query,
      range: async () => ({ error: null, data: table === 'ph_products' ? [{ id: 'device', name: 'Hifu Pro', active_com: false, alix_product_id: 'hub' }]
        : table === 'ph_lang_sync_map' ? [{ product_id: 'device', remote_product_id: 'remote', verified_at: '2026-11-25' }]
        : table === 'ph_product_channels' ? [{ product_id: 'device', hold: true, remote_snapshot: {} }] : [] }) };
    return query;
  },
} }));

import ComAbschaltpruefung from './ComAbschaltpruefung';

describe('protected public COM verification flow', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.roles = ['Super Admin']; });
  afterEach(cleanup);
  it('reads authorized inventory and manually checks without issuing a shutdown', async () => {
    mocks.invoke.mockResolvedValue({ error: null, data: { ok: true, card_check: {
      state: 'visible', message: 'Card present', product_id: 'device', remote_product_id: 'remote',
      checked_at: '2026-11-25T05:06:00Z', attempts: 3, card_count: 15, matched_urls: [], recorded: true,
    } } });
    render(<MemoryRouter><ComAbschaltpruefung /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt prüfen' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'com', action: 'verify_com' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Jetzt prüfen' }).hasAttribute('disabled')).toBe(false));
    expect(mocks.reads).toHaveBeenCalledWith('ph_sync_log');
  });
  it('does not load internal verification data for other roles', async () => {
    mocks.roles = ['Admin'];
    render(<MemoryRouter><ComAbschaltpruefung /></MemoryRouter>);
    await waitFor(() => expect(mocks.reads).not.toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});