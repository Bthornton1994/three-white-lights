import type { Decision, RunReport } from "../types.ts";
import { short } from "../util/hash.ts";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function badge(verdict: string): string {
  return { PASS: "✅ PASS", REVIEW: "🟡 REVIEW", FAIL: "🔴 FAIL", ABSTAIN: "⚪ ABSTAIN" }[verdict] ?? verdict;
}

export function renderDecisionRow(d: Decision): string {
  const keyMetrics = Object.entries(d.metrics)
    .filter(([k]) => !k.includes("."))
    .slice(0, 6)
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(", ");
  return `| \`${d.id}\` | ${badge(d.verdict)} | ${d.confidence.toFixed(2)} | ${d.flags.map((f) => `\`${f}\``).join(" ") || "–"} | ${keyMetrics || "–"} | ${d.humanApprovalRequired ? "yes" : "no"} |`;
}

export function renderMarkdown(report: RunReport): string {
  const lines: string[] = [];
  lines.push(`# TWL development analysis — ${report.runId}`);
  lines.push("");
  lines.push(`**Overall:** ${badge(report.overall)} · human approval required: **yes** · generated ${report.generatedAt}`);
  lines.push("");
  lines.push("| Layer | SHA |");
  lines.push("|---|---|");
  lines.push(`| Artifact under judgment (target) | \`${report.source.targetSha}\` |`);
  lines.push(`| Presentation reference | \`${report.source.presentationBaseSha}\` |`);
  lines.push(`| Mechanics authority | \`${report.source.mechanicsSha}\` |`);
  lines.push(`| Served page declares | \`${report.source.servedSha ?? "not served"}\` at ${report.source.servedUrl ?? "–"} |`);
  lines.push(`| Provider | ${report.provider.name} ${report.provider.version} (${report.provider.engine}, node ${report.provider.node}, playwright ${report.provider.playwright ?? "–"}, browser ${report.provider.browser ?? "–"}) |`);
  lines.push("");
  const matrix = report.decisions.find((d) => d.id === "attempt-matrix");
  if (matrix) {
    lines.push("## Attempt matrix");
    lines.push("");
    lines.push(`**${badge(matrix.verdict)}** — ${matrix.summary}`);
    lines.push("");
    const caseIds = Object.keys(matrix.metrics).filter((k) => k.endsWith(".heldBeforeFirstInput"));
    if (caseIds.length > 0) {
      lines.push("| Case | held before input | first press | judgment | probe | overflow | grounded | frame mismatch |");
      lines.push("|---|---|---|---|---|---|---|---|");
      for (const key of caseIds) {
        const id = key.replace(/\.heldBeforeFirstInput$/, "");
        lines.push(
          `| \`${id}\` | ${fmt(matrix.metrics[`${id}.heldBeforeFirstInput`])} | ${fmt(matrix.metrics[`${id}.firstPressAccepted`])} | ${fmt(matrix.metrics[`${id}.finalJudgment`])} | ${fmt(matrix.metrics[`${id}.probeJudgment`])} | ${fmt(matrix.metrics[`${id}.horizontalOverflow`])} | ${fmt(matrix.metrics[`${id}.grounded`])} | ${fmt(matrix.metrics[`${id}.frameMismatch`])}/${fmt(matrix.metrics[`${id}.framesCompared`])} |`,
        );
      }
      lines.push("");
    }
  }
  lines.push("## Decisions");
  lines.push("");
  lines.push("| Analyzer | Verdict | Confidence | Flags | Key metrics | Human approval |");
  lines.push("|---|---|---|---|---|---|");
  for (const d of report.decisions) lines.push(renderDecisionRow(d));
  lines.push("");
  if (report.blockers.length > 0) {
    lines.push("## Blockers");
    lines.push("");
    for (const b of report.blockers) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push("## Details");
  lines.push("");
  for (const d of report.decisions) {
    lines.push(`### ${d.id} — ${badge(d.verdict)} (confidence ${d.confidence.toFixed(2)})`);
    lines.push("");
    lines.push(d.summary);
    lines.push("");
    if (d.flags.length > 0) lines.push(`Flags: ${d.flags.map((f) => `\`${f}\``).join(", ")}`);
    lines.push("");
    const metrics = Object.entries(d.metrics);
    if (metrics.length > 0) {
      lines.push("| Metric | Value |");
      lines.push("|---|---|");
      for (const [k, v] of metrics) lines.push(`| ${k} | ${fmt(v)} |`);
      lines.push("");
    }
    if (d.evidence.length > 0) {
      lines.push("Evidence:");
      lines.push("");
      for (const e of d.evidence) lines.push(`- ${e.kind}: \`${e.ref}\`${e.sha256 ? ` (sha256 ${short(e.sha256, 12)})` : ""}${e.note ? ` — ${e.note}` : ""}`);
      lines.push("");
    }
  }
  if (report.commands.length > 0) {
    lines.push("## Commands executed");
    lines.push("");
    lines.push("| Command | cwd | exit | ms |");
    lines.push("|---|---|---|---|");
    for (const c of report.commands) lines.push(`| \`${fmt(c.cmd).slice(0, 120)}\` | ${fmt(c.cwd).slice(-60)} | ${fmt(c.exitCode)} | ${c.durationMs} |`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
