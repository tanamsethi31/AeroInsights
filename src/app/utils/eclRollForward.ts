export interface EclRow {
  id:       string;
  lessee:   string;
  aircraft: string;
  ead:      number;
  pd12m:    number;
  lgd:      number;
  ecl12m:   number;
  eclLT:    number;
  stage:    "1" | "2" | "3";
}

export interface RollForwardLine {
  label:  string;
  stage1: number;
  stage2: number;
  stage3: number;
  total:  number;
}

export function computeRollForward(
  previousRows: EclRow[],
  currentRows:  EclRow[],
): RollForwardLine[] {
  const prevMap = new Map(previousRows.map(r => [r.id, r]));
  const currMap = new Map(currentRows.map(r => [r.id, r]));

  const stageBucket = (rows: EclRow[]) =>
    rows.reduce((acc, r) => {
      if (r.stage === "1") acc.s1 += r.eclLT;
      else if (r.stage === "2") acc.s2 += r.eclLT;
      else acc.s3 += r.eclLT;
      return acc;
    }, { s1: 0, s2: 0, s3: 0 });

  const opening = stageBucket(previousRows);
  const closing = stageBucket(currentRows);

  // New originations — in current but not in previous, always allocated to S1
  const newOrig = { s1: 0, s2: 0, s3: 0 };
  for (const r of currentRows) {
    if (!prevMap.has(r.id)) newOrig.s1 += r.eclLT;
  }

  // SICR Stage 1 → 2
  const sicrS1S2 = { s1: 0, s2: 0, s3: 0 };
  // SICR Stage 2 → 3
  const sicrS2S3 = { s1: 0, s2: 0, s3: 0 };
  for (const curr of currentRows) {
    const prev = prevMap.get(curr.id);
    if (!prev) continue;
    if (prev.stage === "1" && curr.stage === "2") {
      sicrS1S2.s1 -= prev.eclLT;
      sicrS1S2.s2 += curr.eclLT;
    } else if (prev.stage === "2" && curr.stage === "3") {
      sicrS2S3.s2 -= prev.eclLT;
      sicrS2S3.s3 += curr.eclLT;
    }
  }

  // Derecognition — in previous but not in current, negative in their original stage
  const derecog = { s1: 0, s2: 0, s3: 0 };
  for (const r of previousRows) {
    if (!currMap.has(r.id)) {
      if (r.stage === "1") derecog.s1 -= r.eclLT;
      else if (r.stage === "2") derecog.s2 -= r.eclLT;
      else derecog.s3 -= r.eclLT;
    }
  }

  // Model / FX / other — balancing item so closing = opening + all movements
  const knownMovements = [newOrig, sicrS1S2, sicrS2S3, derecog];
  const sumKnown = knownMovements.reduce(
    (acc, m) => ({ s1: acc.s1 + m.s1, s2: acc.s2 + m.s2, s3: acc.s3 + m.s3 }),
    { s1: 0, s2: 0, s3: 0 }
  );
  const modelFx = {
    s1: closing.s1 - opening.s1 - sumKnown.s1,
    s2: closing.s2 - opening.s2 - sumKnown.s2,
    s3: closing.s3 - opening.s3 - sumKnown.s3,
  };

  const toLine = (label: string, v: { s1: number; s2: number; s3: number }): RollForwardLine => ({
    label, stage1: v.s1, stage2: v.s2, stage3: v.s3, total: v.s1 + v.s2 + v.s3,
  });

  return [
    toLine("Opening ECL balance",           opening),
    toLine("New originations (Stage 1)",    newOrig),
    toLine("SICR transfers — Stage 1 → 2", sicrS1S2),
    toLine("SICR transfers — Stage 2 → 3", sicrS2S3),
    toLine("Derecognition / repayments",    derecog),
    toLine("Model / FX / other movements", modelFx),
    toLine("Closing ECL balance",           closing),
  ];
}
