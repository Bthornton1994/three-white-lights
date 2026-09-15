import { forwardRef } from "react";
import { FEEL, LIFT_COPY } from "../feel.ts";
import type { ArcadeMeet } from "../math/types.ts";

function lightGlyph(color: ArcadeMeet["outcomes"][number]["lights"][number]): string {
  if (color === "white") return "○";
  if (color === "red") return "●";
  return "·";
}

export const ResultsCard = forwardRef<HTMLElement, { meet: ArcadeMeet }>(function ResultsCard(
  { meet },
  ref,
) {
  return (
    <article className="results-sheet" ref={ref}>
      <header>
        <span className="fed">{FEEL.FEDERATION}</span>
        <span>{FEEL.MEET_NAME}</span>
      </header>
      <div className="results-grid">
        <span>Lifter</span>
        <strong>{FEEL.LIFTER_NAME}</strong>
        <span>Bodyweight</span>
        <strong>{FEEL.BODYWEIGHT_KG}.0 kg</strong>
        <span>Lift</span>
        <strong>{LIFT_COPY[meet.lift].name}</strong>
        {meet.outcomes.map((outcome) => (
          <AttemptLine key={outcome.attempt} outcome={outcome} />
        ))}
        <span>Best</span>
        <strong>{meet.bestKg.toFixed(1)} kg</strong>
        <span>DOTS</span>
        <strong>{meet.dots.toFixed(2)}</strong>
        <span>Implied e1RM</span>
        <strong>{meet.e1rmFromBestKg.toFixed(1)} kg</strong>
        <div className="total">
          <span>Total</span>
          <span>{meet.bombed ? "0 — bomb-out" : `${meet.totalKg.toFixed(1)} kg`}</span>
        </div>
      </div>
    </article>
  );
});

function AttemptLine({
  outcome,
}: {
  outcome: ArcadeMeet["outcomes"][number];
}) {
  const mark = outcome.made
    ? outcome.weightKg.toFixed(1)
    : `${outcome.weightKg.toFixed(1)} x`;
  return (
    <>
      <span>A{outcome.attempt}</span>
      <strong>
        {mark} {outcome.lights.map(lightGlyph).join(" ")} · RPE {outcome.impliedRpe.toFixed(1)}
      </strong>
    </>
  );
}
