import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

/**
 * Source identity. Every run re-verifies the frozen mechanics files against
 * BOTH the pinned SHA-256 values and the authority commit itself, proves the
 * sprite art is byte-identical to the presentation reference, and confirms
 * the target's own edition constants name the same commits. Fails closed on
 * anything missing.
 */
export const sourceIdentity: Analyzer = {
  id: "source-identity",
  title: "Source identity and protected-file hashes",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { facts, baseline } = ctx;
    f.metric("targetSha", facts.targetSha);
    f.check(facts.targetSha === baseline.target.sha, "TARGET_SHA_MISMATCH");
    f.check(facts.worktree !== null, "WORKTREE_MISSING");
    if (facts.worktreeHead) {
      f.metric("worktreeHead", facts.worktreeHead);
      f.check(facts.worktreeHead === baseline.target.sha, "WORKTREE_HEAD_MISMATCH");
    }

    for (const [authorityPath, pinned] of Object.entries(baseline.mechanicsAuthority.files)) {
      const fromGit = facts.authorityHashes[authorityPath] ?? null;
      f.metric(`authority.${authorityPath}`, fromGit);
      f.check(fromGit !== null, `AUTHORITY_UNREACHABLE:${authorityPath}`);
      f.check(fromGit === pinned, `AUTHORITY_PIN_DRIFT:${authorityPath}`);
      f.ref({ kind: "git", ref: `${baseline.mechanicsAuthority.sha}:${authorityPath}`, sha256: fromGit ?? undefined });
    }

    for (const [targetPath, rule] of Object.entries(baseline.protectedFilesAtTarget)) {
      const actual = facts.fileHashes[targetPath] ?? null;
      f.metric(`target.${targetPath}`, actual);
      if (actual === null) {
        f.fail(`MECHANICS_FILE_MISSING:${targetPath}`);
        continue;
      }
      if (rule.authorityPath) {
        const pinned = baseline.mechanicsAuthority.files[rule.authorityPath] ?? null;
        const fromGit = facts.authorityHashes[rule.authorityPath] ?? null;
        f.check(actual === pinned, `MECHANICS_HASH_MISMATCH:${targetPath}`);
        f.check(fromGit !== null && actual === fromGit, `MECHANICS_DIFFERS_FROM_AUTHORITY:${targetPath}`);
      }
      if (rule.sha256) f.check(actual === rule.sha256, `PROTECTED_HASH_MISMATCH:${targetPath}`);
      f.ref({ kind: "file", ref: targetPath, sha256: actual });
    }

    const edition = facts.probe?.edition ?? null;
    if (!edition) f.fail("EDITION_MISSING");
    else {
      f.metric("edition.MECHANICS_SHA", String(edition.MECHANICS_SHA ?? ""));
      f.metric("edition.BASE_SHA", String(edition.BASE_SHA ?? ""));
      f.metric("edition.PREVIEW_BUILD", String(edition.PREVIEW_BUILD ?? ""));
      f.metric("edition.PRODUCTION_READY", Boolean(edition.PRODUCTION_READY));
      f.check(edition.MECHANICS_SHA === baseline.mechanicsAuthority.sha, "EDITION_MECHANICS_PIN_MISMATCH");
      f.check(edition.BASE_SHA === baseline.presentationReference.sha, "EDITION_BASE_PIN_MISMATCH");
      f.ref({ kind: "file", ref: baseline.editionModule });
    }

    if (facts.spriteDiffVsReference === null) f.fail("SPRITE_DIFF_UNAVAILABLE");
    else {
      f.metric("spriteFilesChangedVsReference", facts.spriteDiffVsReference.length);
      f.check(facts.spriteDiffVsReference.length === 0, "SPRITE_SHEETS_CHANGED_VS_REFERENCE");
      f.ref({ kind: "git", ref: `diff ${baseline.presentationReference.sha}..${baseline.target.sha} -- ${baseline.presentationReference.spriteRoot ?? "arcade/public/sprites"}` });
    }

    if (!facts.build) f.fail("BUILD_NOT_RUN");
    else {
      f.metric("npmCiExit", facts.build.npmCiExit);
      f.metric("buildExit", facts.build.buildExit);
      f.check(facts.build.npmCiExit === 0, "NPM_CI_FAILED");
      f.check(facts.build.buildExit === 0, "BUILD_FAILED");
    }

    const verdict = f.verdict();
    return makeDecision(
      {
        id: sourceIdentity.id,
        title: sourceIdentity.title,
        verdict,
        confidence: f.failCount() === 0 && facts.worktree ? 0.99 : 0.95,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: false,
        summary:
          verdict === "PASS"
            ? "Mechanics files match both the pinned hashes and the authority commit; sprite art is unchanged from the reference."
            : "Source identity could not be established for every protected file; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
