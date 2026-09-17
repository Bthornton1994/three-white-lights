import {
  VERDICT_RANK,
  VERDICTS,
  type Decision,
  type EvidenceRef,
  type MetricValue,
  type ProviderInfo,
  type SourceIdentity,
  type Verdict,
} from "./types.ts";

export interface DecisionDraft {
  id: string;
  title: string;
  verdict: Verdict;
  confidence: number;
  flags?: string[];
  metrics?: Record<string, MetricValue>;
  evidence?: EvidenceRef[];
  humanApprovalRequired: boolean;
  summary: string;
}

export function makeDecision(
  draft: DecisionDraft,
  source: SourceIdentity,
  provider: ProviderInfo,
  generatedAt: string,
): Decision {
  const confidence = Math.max(0, Math.min(1, Number.isFinite(draft.confidence) ? draft.confidence : 0));
  return {
    schemaVersion: 1,
    id: draft.id,
    title: draft.title,
    verdict: draft.verdict,
    confidence: Math.round(confidence * 1000) / 1000,
    flags: dedupe(draft.flags ?? []),
    metrics: draft.metrics ?? {},
    evidence: draft.evidence ?? [],
    source,
    provider,
    humanApprovalRequired: draft.humanApprovalRequired,
    summary: draft.summary,
    generatedAt,
  };
}

export function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

export function worstVerdict(verdicts: readonly Verdict[]): Verdict {
  let worst: Verdict = "PASS";
  for (const v of verdicts) {
    if (VERDICT_RANK[v] > VERDICT_RANK[worst]) worst = v;
  }
  return worst;
}

/**
 * Fold a set of rule outcomes into one verdict. FAIL beats REVIEW beats
 * ABSTAIN beats PASS. An empty set is ABSTAIN, never PASS: silence is not a
 * pass.
 */
export function foldVerdicts(verdicts: readonly Verdict[]): Verdict {
  if (verdicts.length === 0) return "ABSTAIN";
  return worstVerdict(verdicts);
}

/** Accumulates rule results for one analyzer. */
export class Findings {
  readonly flags: string[] = [];
  readonly metrics: Record<string, MetricValue> = {};
  readonly evidence: EvidenceRef[] = [];
  private readonly verdicts: Verdict[] = [];

  fail(flag: string): void {
    this.flags.push(flag);
    this.verdicts.push("FAIL");
  }

  review(flag: string): void {
    this.flags.push(flag);
    this.verdicts.push("REVIEW");
  }

  abstain(flag: string): void {
    this.flags.push(flag);
    this.verdicts.push("ABSTAIN");
  }

  pass(): void {
    this.verdicts.push("PASS");
  }

  /** Records a rule outcome without a flag on pass, with a flag otherwise. */
  check(ok: boolean, flag: string, severity: "FAIL" | "REVIEW" = "FAIL"): boolean {
    if (ok) this.pass();
    else if (severity === "FAIL") this.fail(flag);
    else this.review(flag);
    return ok;
  }

  metric(name: string, value: MetricValue): void {
    this.metrics[name] = value;
  }

  ref(ref: EvidenceRef): void {
    this.evidence.push(ref);
  }

  verdict(): Verdict {
    return foldVerdicts(this.verdicts);
  }

  ruleCount(): number {
    return this.verdicts.length;
  }

  failCount(): number {
    return this.verdicts.filter((v) => v === "FAIL").length;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const SHA40 = /^[0-9a-f]{40}$/;

export function validateDecision(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof value !== "object" || value === null) {
    return [{ path: "", message: "decision must be an object" }];
  }
  const d = value as Record<string, unknown>;
  const req = (key: string, type: string): void => {
    if (typeof d[key] !== type) issues.push({ path: key, message: `expected ${type}` });
  };
  if (d.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "must be 1" });
  req("id", "string");
  req("title", "string");
  req("summary", "string");
  req("generatedAt", "string");
  req("humanApprovalRequired", "boolean");
  if (!VERDICTS.includes(d.verdict as Verdict)) issues.push({ path: "verdict", message: "not a Verdict" });
  if (typeof d.confidence !== "number" || d.confidence < 0 || d.confidence > 1) {
    issues.push({ path: "confidence", message: "must be a number in [0,1]" });
  }
  if (!Array.isArray(d.flags) || !d.flags.every((f) => typeof f === "string")) {
    issues.push({ path: "flags", message: "must be string[]" });
  }
  if (typeof d.metrics !== "object" || d.metrics === null) issues.push({ path: "metrics", message: "must be object" });
  if (!Array.isArray(d.evidence)) issues.push({ path: "evidence", message: "must be array" });
  const src = d.source as Record<string, unknown> | undefined;
  if (!src || typeof src !== "object") issues.push({ path: "source", message: "missing" });
  else {
    for (const key of ["targetSha", "presentationBaseSha", "mechanicsSha"]) {
      if (!SHA40.test(String(src[key] ?? ""))) issues.push({ path: `source.${key}`, message: "must be a 40-hex SHA" });
    }
  }
  const prov = d.provider as Record<string, unknown> | undefined;
  if (!prov || typeof prov !== "object") issues.push({ path: "provider", message: "missing" });
  else {
    if (typeof prov.name !== "string") issues.push({ path: "provider.name", message: "missing" });
    if (typeof prov.version !== "string") issues.push({ path: "provider.version", message: "missing" });
    if (prov.engine !== "deterministic-rules") issues.push({ path: "provider.engine", message: "must be deterministic-rules" });
  }
  if ((d.verdict === "ABSTAIN" || d.verdict === "FAIL" || d.verdict === "REVIEW") && Array.isArray(d.flags) && d.flags.length === 0) {
    issues.push({ path: "flags", message: `${String(d.verdict)} requires at least one flag` });
  }
  return issues;
}
