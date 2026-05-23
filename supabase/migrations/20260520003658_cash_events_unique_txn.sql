-- supabase/migrations/012_cash_events_unique_txn.sql
-- Add partial unique index on transaction_id for recon-sourced events
-- Partial index (WHERE transaction_id IS NOT NULL) allows multiple manual events with NULL transaction_id
create unique index if not exists cash_events_unique_recon_txn
  on cash_events (transaction_id)
  where transaction_id is not null;
