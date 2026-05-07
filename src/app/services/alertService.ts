// src/app/services/alertService.ts
import { MOCK_ALERTS, DEFAULT_ALERT_RULES, type AlertItem, type AlertRuleConfig } from "../data/alertsData";

// In-memory mutable store — simulates API without a live backend
let _alerts: AlertItem[] = [...MOCK_ALERTS];
let _rules: AlertRuleConfig[] = [...DEFAULT_ALERT_RULES];

// ── Alert queries ─────────────────────────────────────────────────────────────

export function getAlerts(): AlertItem[] {
  return [..._alerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getUnreadCount(): number {
  return _alerts.filter((a) => !a.isRead).length;
}

// ── Alert mutations ───────────────────────────────────────────────────────────

export function markRead(id: string): void {
  _alerts = _alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
}

export function markAllRead(): void {
  _alerts = _alerts.map((a) => ({ ...a, isRead: true }));
}

export function clearAll(): void {
  _alerts = [];
}

// ── Alert rule queries and mutations ─────────────────────────────────────────

export function getAlertRules(): AlertRuleConfig[] {
  return [..._rules];
}

export function updateAlertRule(
  id: string,
  patch: Partial<Pick<AlertRuleConfig, "isEnabled" | "threshold">>
): void {
  _rules = _rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatAlertAge(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
