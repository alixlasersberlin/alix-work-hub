REVOKE EXECUTE ON FUNCTION public.sync_order_deposit_to_finance(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_orders_deposit_sync() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_order_add_deposit_sync() FROM anon, authenticated, public;