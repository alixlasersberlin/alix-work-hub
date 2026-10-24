import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderBulkEmailDialog from './OrderBulkEmailDialog';
import { FunctionsHttpError } from '@supabase/supabase-js';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/hooks/useMailPermissions', () => ({ useMailPermissions: () => ({ canUseMailbox: () => true, can: () => true }) }));
const customerId = '45820f2c-6d6c-4067-9816-cc6dc4500db4';
const recipients = ['1', '2'].map(id => ({ orderId: id, customerId, orderNumber: `AB-${id}`, name: `Kunde ${id}`, email: `kunde${id}@example.com` }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Sammeltext einzeln versenden', () => {
  it('sendet jeden Auftrag getrennt und verknüpft die jeweilige Kundenakte', async () => {
    invoke.mockResolvedValue({ data: { success: true, message_id: 'saved' }, error: null });
    render(<OrderBulkEmailDialog recipients={recipients} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Ihr Auftrag {{auftrag}}' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Hallo {{kunde}}' } });
    fireEvent.click(screen.getByLabelText(/Empfänger, Text und Anhänge geprüft/));
    fireEvent.click(screen.getByRole('button', { name: 'Einzeln senden (2)' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls.map(call => call[1].body)).toEqual(recipients.map(r => ({
      order_bulk: true, order_id: r.orderId, customer_id: customerId,
       to_email: r.email, to_name: r.name, from_email: 'service@alix-lasers.com',
      subject: `Ihr Auftrag ${r.orderNumber}`, body_text: `Hallo ${r.name}`, attachments: [],
    })));
    await waitFor(() => expect(screen.getAllByText('Gesendet · in Kundenakte gespeichert')).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Verbleibende senden (0)' })).toBeDisabled();
  });
  it('stoppt nach unklarem Ergebnis ohne erneutes Senden', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Verbindung abgebrochen') });
    render(<OrderBulkEmailDialog recipients={recipients} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Auftrag' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Nachricht' } });
    fireEvent.click(screen.getByLabelText(/Empfänger, Text und Anhänge geprüft/));
    fireEvent.click(screen.getByRole('button', { name: 'Einzeln senden (2)' }));
    await screen.findByText(/Verbindung abgebrochen/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('behandelt die gemeldete 403-Versandsperre ohne Absturz oder weitere Sendungen', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response(
      JSON.stringify({ error: 'Keine Versandberechtigung' }), { status: 403 },
    )) });
    const close = vi.fn();
    render(<OrderBulkEmailDialog recipients={recipients} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Auftrag' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Nachricht' } });
    fireEvent.click(screen.getByLabelText(/Empfänger, Text und Anhänge geprüft/));
    fireEvent.click(screen.getByRole('button', { name: 'Einzeln senden (2)' }));
    await waitFor(() => expect(screen.getByText(/Keine Versandberechtigung für diesen Absender/)).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});