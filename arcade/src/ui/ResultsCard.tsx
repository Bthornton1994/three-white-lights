import { forwardRef } from "react";
import { FEEL, type LiftId } from "../feel";
import type { ArcadeMeet, AttemptOutcome } from "../math/types";

type Props = {
  meet: ArcadeMeet;
};

const LIFT_ROW: LiftId[] = ["squat", "bench", "deadlift"];
const LIFT_LABEL: Record<LiftId, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
};

function attemptCell(meet: ArcadeMeet, lift: LiftId, index: 0 | 1 | 2): string {
  if (lift !== meet.lift) {
    return "—";
  }
  const row: AttemptOutcome | undefined = meet.outcomes[index];
  if (!row) {
    return "—";
  }
  return row.made ? row.weightKg.toFixed(1) : `-${row.weightKg.toFixed(1)}`;
}

function bestCell(meet: ArcadeMeet, lift: LiftId): string {
  if (lift !== meet.lift || meet.bestKg <= 0) {
    return "—";
  }
  return meet.bestKg.toFixed(1);
}

export const ResultsCard = forwardRef<HTMLElement, Props>(function ResultsCard(
  { meet },
  ref,
) {
  const date = new Date().toISOString().slice(0, 10);
  const place = meet.bombed ? "DQ" : "—";
  return (
    <article className="card-sheet" ref={ref} aria-label="Shareable results card">
      <div className="card-head">
        <span>Iron &amp; Amber Athletic</span>
        <span>{date}</span>
      </div>
      <p className="sheet-meet">
        {FEEL.MEET_NAME} · Local · Raw · Open · 83 kg
      </p>
      <p className="sheet-id">
        {FEEL.LIFTER_NAME} · Lot 12 · BWT {FEEL.BODYWEIGHT_KG}.0 · {FEEL.SEX}
      </p>
      <table className="sheet-grid">
        <thead>
          <tr>
            <th> </th>
            <th>1st</th>
            <th>2nd</th>
            <th>3rd</th>
            <th>Best</th>
          </tr>
        </thead>
        <tbody>
          {LIFT_ROW.map((lift) => (
            <tr key={lift}>
              <td>{LIFT_LABEL[lift]}</td>
              <td className={attemptCell(meet, lift, 0).startsWith("-") ? "miss" : "make"}>
                {attemptCell(meet, lift, 0)}
              </td>
              <td className={attemptCell(meet, lift, 1).startsWith("-") ? "miss" : "make"}>
                {attemptCell(meet, lift, 1)}
              </td>
              <td className={attemptCell(meet, lift, 2).startsWith("-") ? "miss" : "make"}>
                {attemptCell(meet, lift, 2)}
              </td>
              <td>{bestCell(meet, lift)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`totals${meet.bombed ? " bomb" : ""}`}>
        <div>
          <span>Total</span>
          <strong>{meet.bombed ? "—" : meet.totalKg.toFixed(1)}</strong>
        </div>
        <div>
          <span>DOTS</span>
          <strong>{meet.bombed ? "—" : meet.dots.toFixed(2)}</strong>
        </div>
        <div>
          <span>Place</span>
          <strong>{place}</strong>
        </div>
      </div>
      <div className="sheet-lights" aria-label="Referee lights by attempt">
        {meet.outcomes.map((row) => (
          <span key={row.attempt}>
            A{row.attempt}
            {row.lights.map((color, i) => (
              <i key={i} className={color} />
            ))}
          </span>
        ))}
      </div>
    </article>
  );
});
