export interface BudgetDeclaration {
  readonly title: RegExp;
  readonly declared: boolean;
  readonly basisMs: number | null;
}

export interface BudgetRow {
  readonly file: string;
  readonly title: string;
  readonly status: string;
  readonly durationMs: number;
  readonly declared: boolean;
  readonly basisMs: number | null;
  readonly budgetMs: number | null;
  readonly used: number | null;
}

export interface BudgetFinding {
  readonly kind: 'STALE' | 'UNDECLARED' | 'UNMATCHED' | 'EMPTY';
  readonly row?: BudgetRow;
  readonly reason?: string;
}

export interface VitestJsonReport {
  readonly testResults?: readonly {
    readonly name: string;
    readonly assertionResults?: readonly {
      readonly title?: string;
      readonly status?: string;
      readonly duration?: number;
    }[];
  }[];
}

export function declarationsIn(source: string): readonly BudgetDeclaration[];
export function grade(report: VitestJsonReport): {
  readonly rows: readonly BudgetRow[];
  readonly findings: readonly BudgetFinding[];
  readonly declarationsSeen: number;
};
export const STALE_RATIO: number;
