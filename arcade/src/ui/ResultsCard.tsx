import { forwardRef } from "react";
import { FEEL } from "../feel";
import type { ArcadeMeet } from "../math/types";

type Props = {
  meet: ArcadeMeet;
};

export const ResultsCard = forwardRef<HTMLElement, Props>(function ResultsCard(
  { meet },
  ref,
) {
  const date = new Date().toISOString().slice(0, 10);
  return (
    <article className="card-sheet" ref={ref} aria-label="Shareable results card">
      <div className="card-head">
        <span>{FEEL.FEDERATION}</span>
        <span>{date}</span>
      </div>
      <h2 className="card-title">{FEEL.TITLE}</h2>
      <p>
        {FEEL.MEET_NAME} · {FEEL.LIFTER_NAME} · {FEEL.BODYWEIGHT_KG}.0 kg · {FEEL.SEX}
      </p>
      <table className="sheet-grid">
        <thead>
          <tr>
            <th>Lift</th>
            <th>Att</th>
            <th>Kg</th>
            <th>RPE</th>
            <th>Lights</th>
          </tr>
        </thead>
        <tbody>
          {meet.outcomes.map((row) => (
            <tr key={row.attempt} className={row.made ? "make" : "miss"}>
              <td>{meet.lift}</td>
              <td>{row.attempt}</td>
              <td>{row.made ? row.weightKg.toFixed(1) : `-${row.weightKg.toFixed(1)}`}</td>
              <td>{row.impliedRpe.toFixed(1)}</td>
              <td>{row.lights.map((c) => (c === "white" ? "W" : "R")).join(" ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`totals${meet.bombed ? " bomb" : ""}`}>
        <div>
          <span>Best</span>
          <strong>{meet.bestKg.toFixed(1)}</strong>
        </div>
        <div>
          <span>DOTS</span>
          <strong>{meet.dots.toFixed(2)}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>{meet.score}</strong>
        </div>
      </div>
      <p className="hint">
        e1RM from best single uses Epley: {meet.e1rmFromBestKg.toFixed(1)} kg.
        {meet.bombed
          ? " Bomb-out: no successful attempt, total zero."
          : " Total is the best successful attempt."}
      </p>
    </article>
  );
});
