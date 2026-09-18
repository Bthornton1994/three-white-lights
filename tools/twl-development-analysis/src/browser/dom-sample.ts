/**
 * The in-page reader. Serialised into the browser by Playwright, so it must be
 * self-contained: no imports, no closures over Node values. It reads the DOM
 * the target renders and nothing else.
 */
export interface DomReadArgs {
  tokenNames: string[];
  forbidden: Record<string, string[]>;
  displayFont: string;
}

export function readDomInPage(args: DomReadArgs) {
  const q = (sel: string): Element | null => document.querySelector(sel);
  const num = (v: string | null): number | null => (v === null || v === "" ? null : Number(v));
  const bool = (v: string | null): boolean | null => (v === null ? null : v === "true");
  const attr = (el: Element | null, name: string): string | null => (el ? el.getAttribute(name) : null);
  const rect = (el: Element | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100 };
  };
  const main = q("main.arcade-root");
  const stage = q('[data-sprite-stage="true"]');
  const canvas =
    (q("canvas.sprite-world") as HTMLCanvasElement | null) ??
    (q("canvas.stage-canvas") as HTMLCanvasElement | null);
  const cs = canvas ? getComputedStyle(canvas) : null;
  const rootStyle = getComputedStyle(document.documentElement);
  const tokens: Record<string, string> = {};
  for (const t of args.tokenNames) tokens[t] = rootStyle.getPropertyValue(t).trim();
  const lightsRoot = stage ?? document;
  const lights = Array.from(lightsRoot.querySelectorAll(".light"));
  const anyOf = (sels: string[]): boolean => sels.some((s) => document.querySelector(s) !== null);
  const hud = q(".hud");
  const heading = q("h1") ?? q("h2");
  const pad = q(".hold-pad");
  const prompt = q(".sport-prompt");
  const stageImgs = stage ? stage.querySelectorAll("img").length : 0;
  // document.fonts.check() is true when no matching face exists at all, so it
  // cannot distinguish "loaded" from "never registered". Count real faces.
  let fontLoaded: boolean | null = null;
  try {
    let faces = 0;
    let loaded = 0;
    document.fonts.forEach((face) => {
      if (face.family.replace(/["']/g, "").toLowerCase() === args.displayFont.toLowerCase()) {
        faces += 1;
        if (face.status === "loaded") loaded += 1;
      }
    });
    fontLoaded = faces > 0 && loaded > 0;
  } catch {
    fontLoaded = null;
  }
  return {
    screen: attr(main, "data-screen"),
    liftKind: attr(main, "data-lift-kind"),
    visualShell: attr(main, "data-visual-shell"),
    legacySprites: attr(main, "data-legacy-sprites"),
    sportSource: attr(main, "data-sport-source"),
    presentationBase: attr(main, "data-presentation-base"),
    previewBuild: attr(main, "data-preview-build"),
    editionBanner: (q("[data-edition-banner]")?.textContent ?? null),
    hasSpriteStage: stage !== null,
    phase: attr(stage, "data-lift-phase") || null,
    barHeight: num(attr(stage, "data-bar-height")),
    depth: num(attr(stage, "data-lift-depth")),
    strain: num(attr(stage, "data-strain")),
    grind: num(attr(stage, "data-grind")),
    animFrame: attr(stage, "data-anim-frame"),
    animPose: attr(stage, "data-anim-pose"),
    contactX: num(attr(stage, "data-contact-x")),
    contactY: num(attr(stage, "data-contact-y")),
    worldY: num(attr(stage, "data-world-y")),
    destY: num(attr(stage, "data-dest-y")),
    commandPress: bool(attr(stage, "data-command-press")),
    commandLockout: bool(attr(stage, "data-command-lockout")),
    prompt: prompt ? (prompt.getAttribute("data-prompt") ?? prompt.textContent) : null,
    held: bool(attr(pad, "data-held")),
    lightCount: lights.length,
    lightColors: lights.map((l) => (l.classList.contains("white") ? "white" : l.classList.contains("red") ? "red" : "off")),
    hasDepthGauge: anyOf(args.forbidden.depthGauge ?? []),
    hasIllustratedStill: anyOf(args.forbidden.illustratedStill ?? []),
    hasTimingLane: anyOf(args.forbidden.timingLane ?? []),
    hudText: hud ? (hud.textContent ?? "").replace(/\s+/g, " ").trim() : null,
    heading: heading ? (heading.textContent ?? "").trim() : null,
    canvasCssWidth: canvas ? Math.round(canvas.getBoundingClientRect().width * 100) / 100 : null,
    canvasCssHeight: canvas ? Math.round(canvas.getBoundingClientRect().height * 100) / 100 : null,
    canvasAttrWidth: canvas ? canvas.width : null,
    canvasAttrHeight: canvas ? canvas.height : null,
    canvasImageRendering: cs ? cs.imageRendering : null,
    canvasBox: rect(canvas),
    wrapBox: rect(stage),
    stageImgCount: stageImgs,
    scrollWidth: document.documentElement.scrollWidth,
    scrollY: Math.round(window.scrollY),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    displayFontLoaded: fontLoaded,
    rootTokens: tokens,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  };
}
