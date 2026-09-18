import { attemptMatrix } from "./attempt-matrix.ts";
import type { Analyzer } from "../types.ts";
import { designIntent } from "./design-intent.ts";
import { documentContract } from "./document-contract.ts";
import { existingTests } from "./existing-tests.ts";
import { laterAnalyzers } from "./later.ts";
import { mechanicsFrameParity } from "./mechanics-frame-parity.ts";
import { previewRegression } from "./preview-regression.ts";
import { servedIdentity } from "./served-identity.ts";
import { sourceIdentity } from "./source-identity.ts";
import { spriteGrounding } from "./sprite-grounding.ts";

export const ANALYZERS: Analyzer[] = [
  sourceIdentity,
  servedIdentity,
  existingTests,
  mechanicsFrameParity,
  attemptMatrix,
  spriteGrounding,
  designIntent,
  previewRegression,
  documentContract,
  ...laterAnalyzers,
];

export const REQUIRED_ANALYZER_IDS: string[] = ANALYZERS.map((a) => a.id);
