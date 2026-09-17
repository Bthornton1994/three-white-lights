/**
 * DOTS (IPF / OpenPowerlifting published coefficients).
 * score = total * 500 / (A + B*x + C*x^2 + D*x^3 + E*x^4)
 * where x is bodyweight in kilograms.
 */

export type DotsSex = "M" | "F";

const MALE = {
  A: -307.75076,
  B: 24.0900756,
  C: -0.1918759221,
  D: 0.0007391293,
  E: -0.000001093,
} as const;

const FEMALE = {
  A: -57.96288,
  B: 13.6175032,
  C: -0.1126655895,
  D: 0.0005158568,
  E: -0.0000010706,
} as const;

export function dotsCoefficient(bodyweightKg: number, sex: DotsSex): number {
  const c = sex === "F" ? FEMALE : MALE;
  const x = bodyweightKg;
  const denom = c.A + c.B * x + c.C * x ** 2 + c.D * x ** 3 + c.E * x ** 4;
  if (denom === 0) {
    return 0;
  }
  return 500 / denom;
}

export function dotsScore(
  totalKg: number,
  bodyweightKg: number,
  sex: DotsSex,
): number {
  if (totalKg <= 0 || bodyweightKg <= 0) {
    return 0;
  }
  return totalKg * dotsCoefficient(bodyweightKg, sex);
}
