-- Issue #10: offline expense entry. The client generates a UUID per expense
-- before it ever touches the network, so a retried sync (lost response,
-- two tabs flushing) returns the existing row instead of duplicating it.
-- Partial index: rows created before this change, or by clients that don't
-- send a client_id, are unaffected.
alter table public.expenses add column client_id uuid;

create unique index expenses_user_client_id_key
  on public.expenses (user_id, client_id)
  where client_id is not null;
