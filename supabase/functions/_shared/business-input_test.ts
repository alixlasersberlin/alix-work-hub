import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { selectedTenantIds, allActiveTenantsAssigned, TicketAiInput, TicketSyncInput } from './business-input.ts';
Deno.test('Selected companies never expand assigned company scope', () => {
  assertEquals(selectedTenantIds(['de'], 'at'), null);
  assertEquals(selectedTenantIds(['de'], null), ['de']);
  assertEquals(selectedTenantIds([], null), null);
  assertEquals(selectedTenantIds(['de','at'], 'de'), ['de']);
});
Deno.test('Ticket operations reject manipulated identities and modes', () => {
  assertEquals(TicketAiInput.safeParse({ticket_id:'a),id.not.is.null'}).success, false);
  assertEquals(TicketSyncInput.safeParse({ticket_id:'11111111-1111-4111-8111-111111111111',action:'delete'}).success, false);
});
Deno.test('Global finance aggregates require every actual active company assignment',()=>{
  assertEquals(allActiveTenantsAssigned(['de'],['de','at']),false);
  assertEquals(allActiveTenantsAssigned(['de','at'],['de','at']),true);
  assertEquals(allActiveTenantsAssigned(['de'],[]),false);
});