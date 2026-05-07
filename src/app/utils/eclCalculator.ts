// src/app/utils/eclCalculator.ts

export interface ScenarioInputs {
  gdpDelta: number;        // e.g. −0.02 = −2%
  rpkDelta: number;        // e.g. −0.25 = −25%
  fuelDelta: number;       // e.g. 0.40 = +40%
  fxDelta: number;         // e.g. −0.15 = −15%
  rateDelta: number;       // e.g. 0.0075 = +75 bps
  assetValueDelta: number; // e.g. −0.10 = −10%
  pdS2Multi: number;       // e.g. 1.4
  pdS3Multi: number;       // e.g. 1.2
}

export interface StageDistribution {
  s1: number;
  s2: number;
  s3: number;
}

export const BASE_ECL = 47.2;

export const ZERO_INPUTS: ScenarioInputs = {
  gdpDelta: 0,
  rpkDelta: 0,
  fuelDelta: 0,
  fxDelta: 0,
  rateDelta: 0,
  assetValueDelta: 0,
  pdS2Multi: 1.0,
  pdS3Multi: 1.0,
};

export function computeECL(inputs: ScenarioInputs): number {
  const delta =
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2;
  return Math.max(BASE_ECL * 0.3, BASE_ECL + delta);
}

export function computeStages(ecl: number, inputs: ScenarioInputs): StageDistribution {
  const stress = Math.max(
    0,
    Math.min(0, inputs.rpkDelta) * -2 +
      (inputs.pdS3Multi - 1) * 1.5 +
      Math.min(0, inputs.assetValueDelta) * -1.5
  ) / 3;
  const s1Share = Math.max(0.05, 0.178 - stress * 0.13);
  const s3Share = Math.min(0.70, 0.365 + stress * 0.25);
  const s2Share = Math.max(0.05, 1 - s1Share - s3Share);
  return { s1: ecl * s1Share, s2: ecl * s2Share, s3: ecl * s3Share };
}
