import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

/**
 * Served identity. Rejects stale previews and mismatched served SHAs: the
 * bundle the browser received must be the fresh build from this run, must
 * carry both commit pins, and every rendered screen must declare the same
 * mechanics and presentation-base SHAs the run was configured with.
 */
export const servedIdentity: Analyzer = {
  id: "served-identity",
  title: "Served build identity and stale-preview rejection",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { bundle, facts, baseline, intent } = ctx;
    const served = bundle.served;
    if (!served) {
      f.fail("SERVED_FACTS_MISSING");
    } else {
      f.metric("servedUrl", served.url);
      f.metric("servedScriptSha256", served.scriptSha256);
      f.ref({ kind: "url", ref: served.url, sha256: served.indexSha256, note: "index.html" });
      const fresh = served.scriptPath ? (facts.build?.distAssets[served.scriptPath.replace(/^\//, "")] ?? null) : null;
      f.metric("freshBuildScriptSha256", fresh);
      f.check(served.scriptSha256 !== null, "SERVED_SCRIPT_MISSING");
      f.check(fresh !== null, "FRESH_BUILD_ASSET_MISSING");
      f.check(fresh !== null && served.scriptSha256 === fresh, "STALE_PREVIEW");
      f.check(served.scriptContainsMechanicsSha, "SERVED_BUNDLE_LACKS_MECHANICS_PIN");
      f.check(served.scriptContainsBaseSha, "SERVED_BUNDLE_LACKS_BASE_PIN");
      let spriteMismatch = 0;
      let spriteChecked = 0;
      let refMismatch = 0;
      for (const [p, hash] of Object.entries(served.spriteHashes)) {
        spriteChecked += 1;
        const onDisk = facts.fileHashes[`arcade/public${p}`] ?? null;
        if (onDisk !== hash) spriteMismatch += 1;
        const ref = facts.reference?.spriteHashes[p] ?? null;
        if (ref !== null && ref !== hash) refMismatch += 1;
      }
      f.metric("servedSpritesChecked", spriteChecked);
      f.metric("servedSpritesDifferFromWorktree", spriteMismatch);
      f.metric("servedSpritesDifferFromReference", refMismatch);
      f.check(spriteChecked > 0, "SERVED_SPRITES_UNCHECKED");
      f.check(spriteMismatch === 0, "SERVED_SPRITE_MISMATCH");
      f.check(refMismatch === 0, "SERVED_SPRITE_DIFFERS_FROM_REFERENCE");
    }

    let beats = 0;
    let shaMissing = 0;
    let shaMismatch = 0;
    let shellMismatch = 0;
    for (const b of bundle.beats) {
      beats += 1;
      if (!b.dom.sportSource || !b.dom.presentationBase) shaMissing += 1;
      else if (b.dom.sportSource !== baseline.mechanicsAuthority.sha || b.dom.presentationBase !== baseline.presentationReference.sha) shaMismatch += 1;
      if (b.dom.visualShell !== intent.visualShell) shellMismatch += 1;
    }
    f.metric("beats", beats);
    f.metric("beatsMissingServedSha", shaMissing);
    f.metric("beatsWithMismatchedServedSha", shaMismatch);
    f.metric("beatsWithWrongVisualShell", shellMismatch);
    f.check(beats > 0, "NO_BEATS_CAPTURED");
    f.check(shaMissing === 0, "SERVED_SHA_MISSING");
    f.check(shaMismatch === 0, "SERVED_SHA_MISMATCH");
    f.check(shellMismatch === 0, "VISUAL_SHELL_MISMATCH");
    const previewBuild = bundle.beats[0]?.dom.previewBuild ?? null;
    f.metric("previewBuild", previewBuild);

    const provenance = served?.provenance ?? null;
    const port = served?.port ?? provenance?.port ?? null;
    f.metric("servedPort", port);
    if (port !== null) f.check(![8080, 8081].includes(Number(port)), "PRIOR_SERVER_REUSE");
    if (served?.url) f.check(!/:8080(?:\/|$)/.test(served.url) && !/:8081(?:\/|$)/.test(served.url), "PRIOR_SERVER_REUSE");
    if (bundle.attemptsPerLift === 3) f.check(provenance !== null, "PROVENANCE_MISSING");
    if (provenance) {
      f.metric("provenance.targetSha", provenance.targetSha);
      f.metric("provenance.port", provenance.port);
      f.check(provenance.targetSha === baseline.target.sha, "PROVENANCE_TARGET_SHA_MISMATCH");
      f.check(![8080, 8081].includes(provenance.port), "PRIOR_SERVER_REUSE");
      if (provenance.distScriptSha256 && served?.scriptSha256) {
        f.check(provenance.distScriptSha256 === served.scriptSha256, "PROVENANCE_SCRIPT_MISMATCH");
      }
      f.ref({ kind: "url", ref: `${served?.url ?? ""}/__provenance.json`, note: "analysis-server provenance" });
    }

    const verdict = f.verdict();
    return makeDecision(
      {
        id: servedIdentity.id,
        title: servedIdentity.title,
        verdict,
        confidence: served && beats > 0 ? 0.98 : 0.9,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: false,
        summary:
          verdict === "PASS"
            ? "The served page is this run's fresh build and every screen declares the configured mechanics and base SHAs."
            : "The served build could not be tied to the configured sources; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
