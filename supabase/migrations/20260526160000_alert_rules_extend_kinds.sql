-- ─── Extend alert_rules.kind taxonomy ─────────────────────────────────────
-- Polish slice. Adds two new alert kinds without breaking existing rules:
--   • 'mr_shortfall'   — lessee with a maintenance reserve shortfall ≥ N USD
--   • 'concentration'  — single lessee exposure ≥ X % of portfolio EAD

alter table alert_rules drop constraint if exists alert_rules_kind_check;
alter table alert_rules
  add constraint alert_rules_kind_check
  check (kind in (
    'dpd_breach', 'stage_downgrade',
    'watchlist_red', 'sanctions_hit',
    'mr_shortfall', 'concentration'
  ));
