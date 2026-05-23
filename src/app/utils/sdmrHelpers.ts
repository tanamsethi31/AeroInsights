import type { MRComponent, LeaseSDMR } from "../components/portfolio/SDMRTab";

export function mrNetRefund(comp: MRComponent): number {
  if (!comp.refundable) return 0;
  return Math.min(comp.cumulativeBalance, comp.evidencedCost);
}

export function totalMRBalance(lease: LeaseSDMR): number {
  return lease.mrComponents.reduce((s, c) => s + c.cumulativeBalance, 0);
}

export function refundableMRCapped(lease: LeaseSDMR): number {
  return lease.mrComponents
    .filter((c) => c.refundable)
    .reduce((s, c) => s + mrNetRefund(c), 0);
}

export function eolCompensation(
  lease: LeaseSDMR,
  condition: "half-life" | "full-life" = "half-life",
): number {
  return lease.mrComponents.reduce((sum, comp) => {
    if (!comp.fullIntervalUnits || !comp.rateAmount) return sum;
    const target = condition === "half-life"
      ? comp.fullIntervalUnits / 2
      : comp.fullIntervalUnits;
    const shortfall = condition === "half-life"
      ? Math.max(0, target - comp.remainingUnits)
      : target - comp.remainingUnits;
    return sum + shortfall * comp.rateAmount;
  }, 0);
}
