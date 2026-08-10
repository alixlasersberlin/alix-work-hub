CREATE TEMP TABLE _del AS SELECT da.id FROM delivery_approvals da JOIN orders o ON o.id=da.order_id WHERE lower(o.order_status) IN ('anwalt','invoiced');
DELETE FROM delivery_approval_events WHERE approval_id IN (SELECT id FROM _del);
DELETE FROM delivery_approval_tokens WHERE approval_id IN (SELECT id FROM _del);
DELETE FROM delivery_approvals WHERE id IN (SELECT id FROM _del);