# Scenarios Engine — Benchmark

**Endpoint:** `https://aeroinsights.vercel.app/api/scenarios/run`
**Generated:** 2026-05-24 10:18:13 UTC
**Samples per row:** 5 (after 1 warmup)

## Latency by path count

| Paths   | Cold wall | Cold server | Warm wall p50 | Warm wall p95 | Warm server p50 | Warm server p95 |
|---------|-----------|-------------|---------------|---------------|-----------------|-----------------|
|    1000 | 292.0 ms | 115.25 ms | 263.1 ms | 338.2 ms | 1.0 ms | 1.1 ms |
|    5000 | 166.9 ms | 1.69 ms | 170.4 ms | 410.0 ms | 1.7 ms | 2.9 ms |
|   10000 | 482.8 ms | 2.56 ms | 167.1 ms | 185.0 ms | 2.6 ms | 2.8 ms |
|   25000 | 176.0 ms | 6.46 ms | 175.2 ms | 182.8 ms | 5.3 ms | 5.3 ms |
|   50000 | 188.8 ms | 20.53 ms | 179.9 ms | 184.3 ms | 12.8 ms | 13.1 ms |
|  100000 | 202.6 ms | 32.67 ms | 190.3 ms | 195.6 ms | 24.5 ms | 24.5 ms |

_Cold = first request after deploy or 5+ min idle. Warm = function instance reused (Fluid Compute keeps recent instances warm)._

## Trigger threshold from ADR-001

> Reversal condition #1: "Monte Carlo scenarios start exceeding ~2 s client-side for real (1000+ lease) portfolios."

**Status:** Python function returns warm p95 < 1 s for every tested path count (up to 100,000 paths). Client-side equivalent never existed — the previous `computeMCRange` was a fixed-multiplier placeholder with no real path simulation. The trigger is effectively pre-empted: the engine that would have missed the 2 s ceiling under load is now never invoked.

## Math sanity check

Same input shape across all path counts. ECL converges as paths increase; p5/p95 spread narrows (CLT). Values from cold cell:

-   1000 paths: ECL=$71.02M, p5=$64.30M, p95=$78.02M
-   5000 paths: ECL=$70.74M, p5=$64.07M, p95=$77.50M
-  10000 paths: ECL=$70.74M, p5=$64.03M, p95=$77.46M
-  25000 paths: ECL=$70.79M, p5=$64.19M, p95=$77.47M
-  50000 paths: ECL=$70.79M, p5=$64.16M, p95=$77.47M
- 100000 paths: ECL=$70.78M, p5=$64.16M, p95=$77.43M
