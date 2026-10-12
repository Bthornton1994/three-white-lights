import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

/**
 * Standing typed result: DOCUMENT_CONTRACT_CONFLICT = REVIEW.
 *
 * The Iron & Amber reference (PR #44, and the same text inside the Session A
 * tree) declares sprites legacy debt and forbids a visual pass while a sprite
 * experience is primary. GDD §7.1 declares 16-bit sprites the base style. The
 * owner's product brief puts the sprite athlete inside the Iron & Amber
 * shell. Per AGENTS.md the analyzer surfaces the conflict and never picks a
 * side. This analyzer can never return PASS; only an owner ruling retires it.
 */
export const documentContract: Analyzer = {
  id: "document-contract-conflict",
  title: "Design-document contract conflict (standing REVIEW)",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const docs = ctx.facts.docs;
    f.review("DOCUMENT_CONTRACT_CONFLICT");
    if (!docs) f.fail("DOC_FACTS_MISSING");
    else {
      for (const d of docs.ironAmber) {
        f.metric(`ironAmber.${d.label}.present`, d.present);
        f.metric(`ironAmber.${d.label}.sha256`, d.sha256);
        f.metric(`ironAmber.${d.label}.clausesFound`, d.clausesFound.length);
        f.ref({ kind: "doc", ref: `${d.sha}:${d.path}`, sha256: d.sha256 ?? undefined, note: d.label });
        if (d.label === "target") {
          if (!d.present) f.review("IRON_AMBER_DOC_ABSENT_AT_TARGET");
          continue;
        }
        if (!d.present) f.review(`IRON_AMBER_DOC_MISSING:${d.label}`);
        else if (d.clausesMissing.length > 0) f.review(`CONTRACT_TEXT_CHANGED_RERULE:${d.label}`);
      }
      for (const g of docs.gdd) {
        f.metric(`gdd.${g.label}.present`, g.present);
        f.metric(`gdd.${g.label}.sha256`, g.sha256);
        f.ref({ kind: "doc", ref: `${g.sha}:${g.path}`, sha256: g.sha256 ?? undefined, note: `GDD §7.1 at ${g.label}` });
        if (!g.present || g.clausesMissing.length > 0) f.review(`GDD_ART_DIRECTION_CLAUSE_CHANGED:${g.label}`);
      }
    }
    f.metric("brief", ctx.intent.brief.join(" / "));
    const verdict = f.verdict() === "FAIL" ? "FAIL" : "REVIEW";
    return makeDecision(
      {
        id: documentContract.id,
        title: documentContract.title,
        verdict,
        confidence: docs ? 0.99 : 0.5,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: true,
        summary:
          "The Iron & Amber reference, GDD §7.1 and the product brief disagree about sprites as the primary art direction. Owner ruling: analyze against the brief, keep the documents unchanged, report REVIEW until the documents are reconciled.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
