import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderSelectionToolbar, OrderPageCheckbox } from './OrderSelectionToolbar';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/hooks/useMailPermissions', () => ({ useMailPermissions: () => ({ canUseMailbox: () => true, can: () => true }) }));
const orders = ['a', 'b', 'c'].map(id => ({ id, customer_id: '45820f2c-6d6c-4067-9816-cc6dc4500db4', order_number: id, customers: { contact_name: id, email: `${id}@example.com` } }));
function Harness({ filtered = orders }: { filtered?: typeof orders }) {
  const [selected, setSelected] = useState(new Set(['hidden']));
  return <><OrderPageCheckbox orders={filtered.slice(0, 2)} selected={selected} onSelectionChange={setSelected} /><OrderSelectionToolbar orders={filtered} selected={selected} onSelectionChange={setSelected} /></>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Auswahl in allen Auftragslisten', () => {
  it('markiert alle gefilterten Aufträge über Seitengrenzen und sendet jeden einzeln', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Alle 3 markieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail senden (3)' }));
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Auftrag' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Nachricht' } });
    fireEvent.click(screen.getByLabelText(/Empfänger, Text und Anhänge geprüft/));
    fireEvent.click(screen.getByRole('button', { name: 'Einzeln senden (3)' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
    expect(invoke.mock.calls.map(c => c[1].body.order_id)).toEqual(['a', 'b', 'c']);
  });
  it('Seitenmarkierung schließt versteckte Aufträge vom Versand aus', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<Harness filtered={orders.slice(0, 1)} />);
    fireEvent.click(screen.getByLabelText('Seite markieren'));
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail senden (1)' }));
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Auftrag' } });
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Nachricht' } });
    fireEvent.click(screen.getByLabelText(/Empfänger, Text und Anhänge geprüft/));
    fireEvent.click(screen.getByRole('button', { name: 'Einzeln senden (1)' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke.mock.calls[0][1].body.order_id).toBe('a');
  });
});