/**
 * Typed decision model for the Three White Lights development analysis layer.
 *
 * Every analyzer returns exactly one Decision. A Decision never carries prose
 * beyond a one-line summary; the measurable content is in metrics, flags and
 * evidence references. Source identity is stamped on every decision.
 */

export type Verdict = "PASS" | "REVIEW" | "FAIL" | "ABSTAIN";

export const VERDICTS: readonly Verdict[] = ["PASS", "REVIEW", "FAIL", "ABSTAIN"];

/** Precedence used to fold decisions into one run verdict. Higher wins. */
export const VERDICT_RANK: Record<Verdict, number> = {
  PASS: 0,
  ABSTAIN: 1,
  REVIEW: 2,
  FAIL: 3,
};

export type MetricValue = number | string | boolean | null;

export type EvidenceKind =
  | "file"
  | "screenshot"
  | "canvas"
  | "json"
  | "git"
  | "url"
  | "command"
  | "doc"
  | "fixture";

export interface EvidenceRef {
  kind: EvidenceKind;
  ref: string;
  sha256?: string;
  note?: string;
}

export interface SourceIdentity {
  targetSha: string;
  presentationBaseSha: string;
  mechanicsSha: string;
  /** SHA the served page declares for its mechanics, or null when not served. */
  servedSha: string | null;
  servedUrl: string | null;
}

export interface ProviderInfo {
  name: string;
  version: string;
  engine: "deterministic-rules";
  node: string;
  playwright: string | null;
  browser: string | null;
}

export interface Decision {
  schemaVersion: 1;
  id: string;
  title: string;
  verdict: Verdict;
  /** 0..1. How much the evidence supports the verdict, never a feel claim. */
  confidence: number;
  flags: string[];
  metrics: Record<string, MetricValue>;
  evidence: EvidenceRef[];
  source: SourceIdentity;
  provider: ProviderInfo;
  humanApprovalRequired: boolean;
  summary: string;
  generatedAt: string;
}

export interface CommandRecord {
  cmd: string;
  cwd: string;
  exitCode: number | null;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
}

export interface RunReport {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  overall: Verdict;
  humanApprovalRequired: true;
  source: SourceIdentity;
  provider: ProviderInfo;
  decisions: Decision[];
  blockers: string[];
  commands: CommandRecord[];
  outDir: string;
}

/* ------------------------------------------------------------------ */
/* Capture bundle: what the browser driver observed.                   */
/* ------------------------------------------------------------------ */

export type LiftId = "squat" | "bench" | "deadlift";
export const LIFT_IDS: readonly LiftId[] = ["squat", "bench", "deadlift"];

export interface Viewport {
  name: "phone" | "desktop";
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DomSample {
  screen: string | null;
  liftKind: string | null;
  visualShell: string | null;
  legacySprites: string | null;
  sportSource: string | null;
  presentationBase: string | null;
  previewBuild: string | null;
  editionBanner: string | null;
  hasSpriteStage: boolean;
  phase: string | null;
  barHeight: number | null;
  depth: number | null;
  strain: number | null;
  grind: number | null;
  animFrame: string | null;
  animPose: string | null;
  contactX: number | null;
  contactY: number | null;
  worldY: number | null;
  destY: number | null;
  commandPress: boolean | null;
  commandLockout: boolean | null;
  prompt: string | null;
  held: boolean | null;
  lightCount: number;
  lightColors: string[];
  hasDepthGauge: boolean;
  hasIllustratedStill: boolean;
  hasTimingLane: boolean;
  hudText: string | null;
  heading: string | null;
  canvasCssWidth: number | null;
  canvasCssHeight: number | null;
  canvasAttrWidth: number | null;
  canvasAttrHeight: number | null;
  canvasImageRendering: string | null;
  canvasBox: Box | null;
  wrapBox: Box | null;
  stageImgCount: number;
  scrollWidth: number;
  scrollY: number;
  innerWidth: number;
  innerHeight: number;
  displayFontLoaded: boolean | null;
  rootTokens: Record<string, string>;
  bodyBackground: string | null;
}

export interface Beat {
  id: string;
  viewport: Viewport["name"];
  lift: LiftId | null;
  label: string;
  frame: number | null;
  dom: DomSample;
  screenshot: string | null;
  canvasPng: string | null;
}

export interface TraceSample {
  frame: number;
  dom: DomSample;
}

export interface PlannedInput {
  frame: number;
  kind: "press" | "release";
}

export interface Trace {
  id: string;
  viewport: Viewport["name"];
  lift: LiftId;
  attempt: number;
  inputPlan: PlannedInput[];
  samples: TraceSample[];
  endScreen: string | null;
  framesRun: number;
}

export interface ServedFacts {
  url: string;
  indexSha256: string;
  scriptPath: string | null;
  scriptSha256: string | null;
  cssPath: string | null;
  cssSha256: string | null;
  scriptContainsMechanicsSha: boolean;
  scriptContainsBaseSha: boolean;
  spriteHashes: Record<string, string>;
}

export interface CaptureBundle {
  schemaVersion: 1;
  capturedAt: string;
  targetSha: string;
  served: ServedFacts | null;
  viewports: Viewport[];
  beats: Beat[];
  traces: Trace[];
  evidenceDir: string;
  browser: { playwright: string | null; version: string | null } | null;
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Worktree facts: what static inspection and the mechanics probe saw. */
/* ------------------------------------------------------------------ */

export interface FrameAnchor {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  boxW: number;
  boxH: number;
  contactX: number;
  contactY: number;
}

export interface StageSpec {
  width: number;
  height: number;
  contactX: number;
  contactY: number;
}

export interface MeasuredFrame {
  sheet: string;
  index: number;
  path: string;
  sha256: string;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  footCenterX: number | null;
  opaque: number;
  semiTransparent: number;
  colors: number;
}

export interface ProbeFrame {
  frame: number;
  tick: number;
  screen: string;
  phase: string;
  depth: number;
  barHeight: number;
  sheetIndex: number;
  frameSrc: string;
  pose: string;
  prompt: string;
  press: boolean;
  lockout: boolean;
  held: boolean;
}

export interface ProbeTrace {
  lift: LiftId;
  attempt: number;
  style: string;
  config: { kind: string; loadRatio: number; seed: number };
  weightKg: number;
  e1rmKg: number;
  script: { tick: number; kind: "press" | "release" }[];
  inputPlan: PlannedInput[];
  frames: ProbeFrame[];
  endScreen: string;
  outcome: string | null;
  made: boolean | null;
  walkoutMs: number;
  judgingMs: number;
  effort: string | null;
}

export interface OracleSample {
  kind: string;
  phase: string;
  depth: number;
  barHeight: number;
}

export interface ProbeFacts {
  tickMs: number;
  frameDtMs: number;
  legalDepthSquat: number | null;
  stage: StageSpec | null;
  anchors: Record<string, FrameAnchor[]> | null;
  edition: Record<string, unknown> | null;
  traces: ProbeTrace[];
  errors: string[];
}

export interface DocClauseFacts {
  label: string;
  sha: string;
  path: string;
  present: boolean;
  sha256: string | null;
  clausesFound: string[];
  clausesMissing: string[];
}

export interface DocFacts {
  ironAmber: DocClauseFacts[];
  gdd: DocClauseFacts[];
}

export interface CommittedEvidenceEntry {
  name: string;
  json: Record<string, unknown> | null;
  png: string | null;
  pngSha256: string | null;
}

export interface CommittedEvidence {
  dir: string;
  entries: CommittedEvidenceEntry[];
  readme: string | null;
}

export interface ReferenceFacts {
  sha: string;
  bundlePath: string | null;
  captured: boolean;
  beats: Beat[];
  rootTokens: Record<string, string>;
  spriteHashes: Record<string, string>;
  notes: string[];
}

export interface BuildFacts {
  npmCiExit: number | null;
  buildExit: number | null;
  distAssets: Record<string, string>;
}

export interface TestFacts {
  ran: boolean;
  records: CommandRecord[];
}

export interface WorktreeFacts {
  schemaVersion: 1;
  targetSha: string;
  worktree: string | null;
  fileHashes: Record<string, string | null>;
  authorityHashes: Record<string, string | null>;
  spriteDiffVsReference: string[] | null;
  measured: MeasuredFrame[] | null;
  platformPng: { path: string; sha256: string; width: number; height: number } | null;
  probe: ProbeFacts | null;
  oracle: { samples: OracleSample[]; expected: { index: number; accepted: number[] }[] } | null;
  docs: DocFacts | null;
  committedEvidence: CommittedEvidence | null;
  reference: ReferenceFacts | null;
  build: BuildFacts | null;
  tests: TestFacts | null;
}

/* ------------------------------------------------------------------ */
/* Analyzer plumbing.                                                  */
/* ------------------------------------------------------------------ */

export interface AnalyzerContext {
  bundle: CaptureBundle;
  facts: WorktreeFacts;
  baseline: BaselineConfig;
  intent: IntentConfig;
  source: SourceIdentity;
  provider: ProviderInfo;
  /** Resolves evidence paths recorded in bundle/facts to absolute paths. */
  resolvePath: (ref: string) => string;
  /** Ordered list of analyzer ids that this run promised to execute. */
  now: () => string;
}

export interface Analyzer {
  id: string;
  title: string;
  run: (ctx: AnalyzerContext) => Promise<Decision>;
}

/* ------------------------------------------------------------------ */
/* Config file shapes.                                                 */
/* ------------------------------------------------------------------ */

export interface ShaRef {
  pr: number;
  branch: string;
  sha: string;
  app?: string;
  status?: string;
  spriteRoot?: string;
  files?: Record<string, string>;
}

export interface DocReadFrom {
  label: string;
  sha: string;
}

export interface BaselineConfig {
  schemaVersion: 1;
  target: ShaRef;
  presentationReference: ShaRef;
  mechanicsAuthority: ShaRef & { files: Record<string, string> };
  protectedFilesAtTarget: Record<string, { authorityPath?: string; sha256?: string }>;
  editionModule: string;
  anchorsModule: string;
  committedEvidenceDir: string;
  documents: {
    ironAmberReference: { path: string; readFrom: DocReadFrom[]; conflictingClauses: string[] };
    gdd: { path: string; readFrom: DocReadFrom[]; clauses: string[] };
  };
}

export interface IntentConfig {
  schemaVersion: 1;
  brief: string[];
  viewports: Viewport[];
  visualShell: string;
  ironAmber: {
    tokens: Record<string, string>;
    displayFontFamily: string;
    titleHeading: string;
  };
  forbiddenDom: Record<string, string[]>;
  forbiddenPromptFragments: string[];
  stage: {
    width: number;
    height: number;
    contactY: number;
    contactYTolerancePx: number;
    integerScales: number[];
    phoneMinStageWidthFraction: number;
    desktopMinStageHeightFraction: number;
    desktopGutterReviewFraction: number;
    canvasPixelMismatchMaxFraction: number;
    minDistinctFramesPerLift: number;
    maxFrameJumpWithinPhase: number;
    footDriftReviewPx: number;
  };
  regression: {
    chromeBeatsMeanDiffMax: number;
    playBeatsMeanDiffMax: number;
    referenceTitleMeanDiffMax: number;
  };
  parity: {
    maxFrameMismatchFraction: number;
    renderLagToleranceFrames: number;
  };
}
