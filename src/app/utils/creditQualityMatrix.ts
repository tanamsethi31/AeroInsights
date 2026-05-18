import type { EclRow } from "./eclRollForward";

export interface CreditQualityRow {
  grade:        string;
  s1Ead:        number;
  s2Ead:        number;
  s3Ead:        number;
  totalEad:     number;
  pctPortfolio: number;
}

const GRADE_ORDER = [
  "A / A−",
  "BBB",
  "BB / BB−",
  "B+",
  "B / B−",
  "CCC and below",
  "Unrated",
] as const;

function toBucket(rating: string | null | undefined): string {
  if (!rating || rating === "—") return "Unrated";
  const r = rating.trim().toUpperCase();
  if (/^A[+-]?$/.test(r))             return "A / A−";
  if (/^BBB[+-]?$/.test(r))           return "BBB";
  if (/^BB[+-]?$/.test(r))            return "BB / BB−";
  if (r === "B+")                      return "B+";
  if (r === "B" || r === "B-")        return "B / B−";
  if (/^(CCC|CC|C|D)[+-]?$/.test(r)) return "CCC and below";
  return "Unrated";
}

export function computeCreditQualityMatrix(
  eclRows: EclRow[],
  lessees: Array<{ name: string; credit_rating: string | null }>,
): CreditQualityRow[] {
  const ratingMap = new Map(lessees.map(l => [l.name.toLowerCase(), l.credit_rating]));
  const totalEad  = eclRows.reduce((s, r) => s + r.ead, 0);
  const buckets   = new Map<string, { s1: number; s2: number; s3: number }>();

  for (const r of eclRows) {
    const grade = toBucket(ratingMap.get(r.lessee.toLowerCase()));
    const b = buckets.get(grade) ?? { s1: 0, s2: 0, s3: 0 };
    if (r.stage === "1") b.s1 += r.ead;
    else if (r.stage === "2") b.s2 += r.ead;
    else b.s3 += r.ead;
    buckets.set(grade, b);
  }

  const result: CreditQualityRow[] = [];
  for (const grade of GRADE_ORDER) {
    const b = buckets.get(grade);
    if (!b) continue;
    const t = b.s1 + b.s2 + b.s3;
    if (t === 0) continue;
    result.push({
      grade,
      s1Ead:        b.s1,
      s2Ead:        b.s2,
      s3Ead:        b.s3,
      totalEad:     t,
      pctPortfolio: totalEad > 0 ? (t / totalEad) * 100 : 0,
    });
  }
  return result;
}
