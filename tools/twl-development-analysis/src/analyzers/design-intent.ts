import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Beat, Decision } from "../types.ts";
import { PLAY_SCREENS, ratio, stageBeats } from "./common.ts";

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Design intent. Checks the served build against the encoded product brief:
 * Iron & Amber tokens and type, the sprite athlete on a canvas (not a still),
 * nearest-neighbour rendering at an integer scale, full-stage responsive
 * composition without giant gutters, no DEPTH gauge, no timing lane, no
 * two-tap copy, three lights, an honest HUD, and no horizontal overflow.
 */
export const designIntent: Analyzer = {
  id: "design-intent",
  title: "Design intent: Iron & Amber shell with a grounded sprite athlete",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { bundle, intent } = ctx;
    const beats = bundle.beats;
    f.metric("beats", beats.length);
    f.check(beats.length > 0, "NO_BEATS_CAPTURED");
    const viewportsSeen = new Set(beats.map((b) => b.viewport));
    for (const v of intent.viewports) f.check(viewportsSeen.has(v.name), `VIEWPORT_MISSING:${v.name}`);

    const titles = beats.filter((b) => b.label === "title");
    f.check(titles.length > 0, "TITLE_BEAT_MISSING");
    for (const t of titles) {
      f.check(norm(t.dom.heading) === norm(intent.ironAmber.titleHeading), `TITLE_HEADING_MISMATCH:${t.viewport}`);
      for (const [token, expected] of Object.entries(intent.ironAmber.tokens)) {
        const actual = t.dom.rootTokens[token] ?? "";
        f.metric(`${t.viewport}.token.${token}`, actual);
        f.check(norm(actual) === norm(expected), `IRON_AMBER_TOKEN_MISMATCH:${t.viewport}:${token}`);
      }
      f.metric(`${t.viewport}.displayFontLoaded`, t.dom.displayFontLoaded);
      f.check(t.dom.displayFontLoaded === true, `DISPLAY_FONT_NOT_LOADED:${t.viewport}`, "REVIEW");
      f.ref({ kind: "screenshot", ref: t.screenshot ?? t.id, note: `${t.viewport} title` });
    }

    let depthGauge = 0;
    let timingLane = 0;
    let illustrated = 0;
    let twoTapPrompt = 0;
    let overflow = 0;
    for (const b of beats) {
      if (b.dom.hasDepthGauge) depthGauge += 1;
      if (b.dom.hasTimingLane) timingLane += 1;
      if (b.dom.hasIllustratedStill) illustrated += 1;
      const p = norm(b.dom.prompt);
      if (p && intent.forbiddenPromptFragments.some((frag) => p.includes(frag.toLowerCase()))) twoTapPrompt += 1;
      if (b.dom.scrollWidth > b.dom.innerWidth) overflow += 1;
    }
    for (const t of bundle.traces) {
      for (const s of t.samples) {
        if (s.dom.hasDepthGauge) depthGauge += 1;
        if (s.dom.hasTimingLane) timingLane += 1;
        if (s.dom.hasIllustratedStill) illustrated += 1;
      }
    }
    f.metric("depthGaugeSightings", depthGauge);
    f.metric("timingLaneSightings", timingLane);
    f.metric("illustratedStillSightings", illustrated);
    f.metric("twoTapPromptSightings", twoTapPrompt);
    f.metric("beatsWithHorizontalOverflow", overflow);
    f.check(depthGauge === 0, "DEPTH_GAUGE_PRESENT");
    f.check(timingLane === 0, "TIMING_LANE_PRESENT");
    f.check(illustrated === 0, "ILLUSTRATED_STILL_PRESENT");
    f.check(twoTapPrompt === 0, "TWO_TAP_PROMPT");
    f.check(overflow === 0, "HORIZONTAL_OVERFLOW");

    const stage = stageBeats(ctx);
    let notCanvas = 0;
    let notPixelated = 0;
    let nonInteger = 0;
    let phoneSmall = 0;
    let deskShort = 0;
    let deskGutter = 0;
    let wrapNarrow = 0;
    let lightsWrong = 0;
    let hudMissing = 0;
    let minPhoneFraction = 1;
    let minDeskHeightFraction = 1;
    let maxDeskGutter = 0;
    const perBeat = (b: Beat): void => {
      const d = b.dom;
      if (!d.hasSpriteStage || d.canvasCssWidth === null || d.canvasAttrWidth === null) {
        notCanvas += 1;
        return;
      }
      if (d.stageImgCount > 0) notCanvas += 1;
      if (d.canvasImageRendering !== "pixelated") notPixelated += 1;
      const scale = d.canvasCssWidth / d.canvasAttrWidth;
      if (!intent.stage.integerScales.some((s) => Math.abs(scale - s) < 0.01)) nonInteger += 1;
      const wFrac = d.canvasCssWidth / d.innerWidth;
      const hFrac = (d.canvasCssHeight ?? 0) / d.innerHeight;
      if (b.viewport === "phone") {
        minPhoneFraction = Math.min(minPhoneFraction, wFrac);
        if (wFrac < intent.stage.phoneMinStageWidthFraction) phoneSmall += 1;
      } else {
        minDeskHeightFraction = Math.min(minDeskHeightFraction, hFrac);
        const gutter = 1 - wFrac;
        maxDeskGutter = Math.max(maxDeskGutter, gutter);
        if (hFrac < intent.stage.desktopMinStageHeightFraction) deskShort += 1;
        if (gutter > intent.stage.desktopGutterReviewFraction) deskGutter += 1;
      }
      if (d.wrapBox && d.wrapBox.width < d.innerWidth - 2) wrapNarrow += 1;
      if (PLAY_SCREENS.has(d.screen ?? "") && d.lightCount !== 3) lightsWrong += 1;
      if (PLAY_SCREENS.has(d.screen ?? "")) {
        const hud = d.hudText ?? "";
        if (!/attempt\s*\d/i.test(hud) || !/kg/i.test(hud)) hudMissing += 1;
      }
    };
    for (const b of stage) perBeat(b);
    f.metric("stageBeats", stage.length);
    f.metric("stageBeatsNotCanvas", notCanvas);
    f.metric("stageBeatsNotPixelated", notPixelated);
    f.metric("stageBeatsNonIntegerScale", nonInteger);
    f.metric("phoneMinStageWidthFraction", Math.round(minPhoneFraction * 1000) / 1000);
    f.metric("desktopMinStageHeightFraction", Math.round(minDeskHeightFraction * 1000) / 1000);
    f.metric("desktopMaxGutterFraction", Math.round(maxDeskGutter * 1000) / 1000);
    f.metric("stageWrapNarrowerThanViewport", wrapNarrow);
    f.metric("playBeatsWithoutThreeLights", lightsWrong);
    f.metric("playBeatsWithoutHud", hudMissing);
    f.check(stage.length > 0, "NO_STAGE_BEATS");
    f.check(notCanvas === 0, "ATHLETE_NOT_CANVAS");
    f.check(notPixelated === 0, "NOT_NEAREST_NEIGHBOR");
    f.check(nonInteger === 0, "NON_INTEGER_SCALE");
    f.check(phoneSmall === 0, "PHONE_STAGE_TOO_SMALL");
    f.check(deskShort === 0, "DESKTOP_STAGE_TOO_SHORT");
    f.check(deskGutter === 0, "DESKTOP_GUTTERS_WIDE", "REVIEW");
    f.check(wrapNarrow === 0, "STAGE_WRAP_NOT_FULL_WIDTH", "REVIEW");
    f.check(lightsWrong === 0, "LIGHTS_COUNT");
    f.check(hudMissing === 0, "HUD_MISSING");

    const labels = new Set(beats.filter((b) => b.viewport === "phone").map((b) => b.label));
    const wanted = ["title", "lift", "attempts", "walkout", "brace", "judging", "outcome", "results"];
    const missing = wanted.filter((l) => !labels.has(l));
    f.metric("phoneFlowMissingBeats", missing.join(",") || "none");
    f.check(missing.length === 0, "FLOW_INCOMPLETE", "REVIEW");

    const banner = beats.find((b) => b.dom.editionBanner)?.dom.editionBanner ?? null;
    f.metric("editionBanner", banner);
    f.check(!(banner && /DO_NOT_MERGE/i.test(banner)), "CANDIDATE_BANNER_RENDERED", "REVIEW");
    const legacy = beats.find((b) => b.dom.legacySprites !== null)?.dom.legacySprites ?? null;
    f.metric("legacySpritesAttr", legacy);
    const errors = bundle.notes.filter((n) => /pageerror|console\.error/.test(n));
    f.metric("pageErrors", errors.length);
    f.check(errors.length === 0, "PAGE_ERRORS", "REVIEW");
    f.metric("liftsPlayed", Array.from(new Set(bundle.traces.map((t) => t.lift))).join(","));
    f.check(ratio(bundle.traces.length, 1) >= 3, "FEWER_THAN_THREE_LIFTS_PLAYED", "REVIEW");

    const verdict = f.verdict();
    return makeDecision(
      {
        id: designIntent.id,
        title: designIntent.title,
        verdict,
        confidence: stage.length > 0 ? 0.8 : 0.3,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: true,
        summary:
          verdict === "PASS"
            ? "Every measurable brief expectation holds; craft and feel still need a human."
            : "The served build departs from the brief or needs a human look; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
