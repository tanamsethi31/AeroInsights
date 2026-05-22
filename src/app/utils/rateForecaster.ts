// src/app/utils/rateForecaster.ts
import {
  AIRCRAFT_DATA,
  type MacroInputs,
  type MonthlyRateForecast,
  type TypeForecast,
  type RateOutlookResult,
} from "../data/rateOutlookData";

// ── Macro signal weights ───────────────────────────────────────────────────────

const SIGNAL_PARAMS = {
  rpkGrowth: {
    effectPerUnit: 0.004,   // +0.4% rent per +1% RPK
    nbWeight: 1.0, wbWeight: 0.9,
    baselineValue: 3.0,
  },
  jetA1: {
    effectPerUnit: -0.003,  // -0.3% per +$50 above $800/t
    nbWeight: 0.8, wbWeight: 1.2,
    baselineValue: 800,
    unitStep: 50,
  },
  loadFactor: {
    effectPerUnit: 0.005,   // +0.5% per +1pp above 80%
    nbWeight: 1.0, wbWeight: 1.0,
    baselineValue: 80,
  },
  usdRate10y: {
    effectPerUnit: -0.006,  // -0.6% per +1pp
    nbWeight: 0.7, wbWeight: 1.3,
    baselineValue: 3.0,
  },
  brentCrude: {
    effectPerUnit: -0.002,  // -0.2% per +$10 above $70
    nbWeight: 0.5, wbWeight: 0.8,
    baselineValue: 70,
    unitStep: 10,
  },
} as const;

/** Sinusoidal seasonal factor: peak June (+2%), trough January (-2%) */
export function seasonalFactor(monthsAhead: number): number {
  const monthOfYear = (new Date().getMonth() + monthsAhead) % 12;
  return 1 + 0.02 * Math.sin((monthOfYear / 12) * 2 * Math.PI);
}

function computeSignalEffect(inputs: MacroInputs, isWidebody: boolean): number {
  const w = <K extends keyof typeof SIGNAL_PARAMS>(k: K) =>
    isWidebody ? SIGNAL_PARAMS[k].wbWeight : SIGNAL_PARAMS[k].nbWeight;

  const rpkEffect =
    SIGNAL_PARAMS.rpkGrowth.effectPerUnit *
    (inputs.rpkGrowth - SIGNAL_PARAMS.rpkGrowth.baselineValue) *
    w("rpkGrowth");

  const jetEffect =
    SIGNAL_PARAMS.jetA1.effectPerUnit *
    Math.max(0, (inputs.jetA1 - SIGNAL_PARAMS.jetA1.baselineValue) / SIGNAL_PARAMS.jetA1.unitStep) *
    w("jetA1");

  const lfEffect =
    SIGNAL_PARAMS.loadFactor.effectPerUnit *
    Math.max(0, inputs.loadFactor - SIGNAL_PARAMS.loadFactor.baselineValue) *
    w("loadFactor");

  const rateEffect =
    SIGNAL_PARAMS.usdRate10y.effectPerUnit *
    (inputs.usdRate10y - SIGNAL_PARAMS.usdRate10y.baselineValue) *
    w("usdRate10y");

  const brentEffect =
    SIGNAL_PARAMS.brentCrude.effectPerUnit *
    Math.max(0, (inputs.brentCrude - SIGNAL_PARAMS.brentCrude.baselineValue) / SIGNAL_PARAMS.brentCrude.unitStep) *
    w("brentCrude");

  return rpkEffect + jetEffect + lfEffect + rateEffect + brentEffect;
}

function buildMonthlyForecast(
  baseRent: number,
  nbvUSD: number,
  signalEffect: number,
  monthsAhead: number,
  prevRent: number | null,
): MonthlyRateForecast {
  const seasonal = seasonalFactor(monthsAhead);
  const rentUSD = Math.round(baseRent * (1 + signalEffect) * seasonal);
  const lrf = (rentUSD / nbvUSD) * 100;
  const p25 = Math.round(rentUSD * 0.93);
  const p75 = Math.round(rentUSD * 1.07);
  const momPct = prevRent !== null ? ((rentUSD - prevRent) / prevRent) * 100 : 0;
  const vsBaselinePct = ((rentUSD - baseRent) / baseRent) * 100;
  return { month: monthsAhead, rentUSD, lrf, p25, p75, momPct, vsBaselinePct };
}

export function forecastRates(
  inputs: MacroInputs,
  horizonMonths: number,
): RateOutlookResult {
  const types: TypeForecast[] = AIRCRAFT_DATA.map((aircraft) => {
    const isWidebody = aircraft.category === "Widebody";
    const signalEffect = computeSignalEffect(inputs, isWidebody);

    const current = buildMonthlyForecast(
      aircraft.baseRentUSD, aircraft.nbvUSD, signalEffect, 0, null,
    );

    const forecast: MonthlyRateForecast[] = [];
    let prevRent = current.rentUSD;
    for (let m = 1; m <= horizonMonths; m++) {
      const mf = buildMonthlyForecast(
        aircraft.baseRentUSD, aircraft.nbvUSD, signalEffect, m, prevRent,
      );
      forecast.push(mf);
      prevRent = mf.rentUSD;
    }

    const sparkline = forecast.map((f) => f.rentUSD);
    const outlookPct =
      ((forecast[forecast.length - 1].rentUSD - aircraft.baseRentUSD) / aircraft.baseRentUSD) * 100;

    return {
      type: aircraft.type,
      category: aircraft.category,
      current,
      forecast,
      sparkline,
      outlookPct,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    macroInputs: inputs,
    types,
  };
}
