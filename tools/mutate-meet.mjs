#!/usr/bin/env node
/**
 * Mutation harness for the meet-day piece.
 *
 * WHY THIS EXISTS. A test that passes is not evidence. This run has already
 * found eighteen checks that could not have failed if the thing they named were
 * deleted — a bound the unfixed behaviour already satisfied, a name-grep
 * standing in for a behaviour, a loop that ran one iteration over a blank row.
 *
 * So each mutation below DELETES OR INVERTS one behaviour this piece claims to
 * have built, and the harness records which tests go red. A mutation that turns
 * nothing red names a claim with no test behind it.
 *
 * THE APPLICATION IS ASSERTED, NOT ASSUMED. Every mutation is an exact string
 * replacement and the harness fails loudly if the search string is not found
 * EXACTLY ONCE — a regex that silently did not match reports a false pass, and
 * that has already happened twice in this run. It also re-reads the file after
 * writing and checks the mutated text is actually present.
 *
 * Usage:
 *   node tools/mutate-meet.mjs            # run every mutation
 *   node tools/mutate-meet.mjs --list     # just name them
 *   node tools/mutate-meet.mjs --only 3   # one, by index
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const onlyIndex = args.indexOf('--only') === -1 ? null : Number(args[args.indexOf('--only') + 1]);

/**
 * Each entry: what behaviour is being removed, which file, and the exact edit.
 * `claim` is the sentence the piece makes; if a mutation kills it and no test
 * notices, the claim is unbacked.
 */
const MUTATIONS = [
  {
    id: 'floor-ignores-the-repeat',
    claim:
      'GDD §6.3: after a miss the floor is the weight that just beat you. ' +
      'Mutation: compute the floor as the minimum INCREASE instead, so a miss ' +
      'no longer holds the floor at the missed weight.',
    file: 'src/game/meetDay.ts',
    from: '  const floorKg = context.minimumWeight;',
    to: '  const floorKg = context.minimumIncreaseWeight ?? context.minimumWeight;',
  },
  {
    id: 'floor-never-flagged-as-raised',
    claim:
      'GDD §6.3’s bite is SHOWN, not merely enforced. Mutation: never flag ' +
      'the floor as raised by a miss, so the screen prints the neutral line.',
    file: 'src/game/meetDay.ts',
    from: "  const floorRaisedByMiss = context.mayRepeatWeight && context.previousOutcome === 'no-lift';",
    to: '  const floorRaisedByMiss = false;',
  },
  {
    id: 'options-not-checked-against-the-engine',
    claim:
      'Every weight offered is re-checked against the engine that will be asked ' +
      'to accept it. Mutation: drop the check and offer the previous weight ' +
      'minus one grid step as the safe option.',
    file: 'src/game/meetDay.ts',
    from: '  if (!isCallableWeightNow(state, weightKg)) return null;',
    to: '  const offered = Math.min(weightKg, previousWeightKg);\n  if (!isCallableWeightNow(state, offered)) return null;',
  },
  {
    id: 'repeat-offered-after-a-good-lift',
    claim:
      'A repeat is legal ONLY after a miss (the non-decreasing rule). ' +
      'Mutation: offer the repeat branch unconditionally.',
    file: 'src/game/meetDay.ts',
    from: '  if (context.mayRepeatWeight) {\n    // GDD §6.3 after a miss: repeat vs increase.',
    to: '  if (true) {\n    // GDD §6.3 after a miss: repeat vs increase.',
  },
  {
    id: 'declare-bypasses-the-engine',
    claim:
      'Every weight goes through `declareAttempt` before it becomes an attempt. ' +
      'Mutation: put the weight on the bar without asking the engine, so a ' +
      'lower weight is accepted.',
    file: 'src/game/meetDay.ts',
    from: '  const declared = declareAttempt(state.meet, { weight: weightKg });\n  if (!declared.ok) {\n    return { ...state, lastError: declared.error };\n  }',
    to: '  const declared = declareAttempt(state.meet, { weight: weightKg });\n  if (!declared.ok) {\n    return { ...state, phase: \'walkout\', lastError: null };\n  }',
  },
  {
    id: 'bomb-out-becomes-a-recap',
    claim:
      'GDD §6.3: bombing out gets its own beat, not the recap. ' +
      'Mutation: send a bombed meet to the recap screen.',
    file: 'src/game/meetDay.ts',
    from: "    return { ...state, phase: bombed ? 'bombed' : 'recap', live: null, call: null };",
    to: "    return { ...state, phase: 'recap', live: null, call: null };",
  },
  {
    id: 'bomb-out-keeps-lifting',
    claim:
      'A bomb-out ENDS the meet. Mutation: keep asking for attempts after the ' +
      'engine has closed the meet.',
    file: 'src/game/meetDay.ts',
    from: "  if (meet.phase.kind === 'complete') {\n    const bombed = meet.phase.outcome.kind === 'bombed-out';",
    to: "  if (meet.phase.kind === 'complete' && meet.phase.outcome.kind !== 'bombed-out') {\n    const bombed = false;",
  },
  {
    id: 'bomb-out-erases-the-total',
    claim:
      'GDD §12.3: a bomb-out must not punish a player for showing up. ' +
      'Mutation: write this meet’s total unconditionally, so a bomb-out ' +
      'wipes the best total on record.',
    file: 'src/game/meetServer.ts',
    from: '  const nextTotalKg = isTotalPr ? totalKg : previousBestTotalKg;',
    to: '  const nextTotalKg = totalKg;',
  },
  {
    id: 'a-bomb-out-totals-zero',
    claim:
      'A bombed lifter has NO total, which is not a total of zero. ' +
      'Mutation: record zero.',
    file: 'src/game/meetServer.ts',
    from: '    totalKg,\n    bestByLift: bestByLiftKg,\n    bodyweightKg: proposal.report.bodyweightKg,',
    to: '    totalKg: totalKg ?? 0,\n    bestByLift: bestByLiftKg,\n    bodyweightKg: proposal.report.bodyweightKg,',
  },
  {
    id: 'server-trusts-the-card',
    claim:
      'The server RECOMPUTES the total by replaying the reported attempts ' +
      'through meet.ts. Mutation: skip the engine and sum the heaviest good ' +
      'attempt per lift straight off the report.',
    file: 'src/game/meetServer.ts',
    from: '    const declared = declareAttempt(state, {\n      lift: attempt.lift,\n      attemptNumber: attempt.attemptNumber,\n      weight: attempt.weightKg,\n    });\n    if (!declared.ok) {',
    to: '    const declared = declareAttempt(state, {\n      lift: attempt.lift,\n      attemptNumber: attempt.attemptNumber,\n      weight: attempt.weightKg,\n    });\n    if (false && !declared.ok) {',
  },
  {
    id: 'total-is-the-last-good-attempt',
    claim:
      'GDD §6.4: the total is the sum of the BEST successful attempt per lift. ' +
      'Mutation: sum the heaviest DECLARED attempt instead, made or missed.',
    file: 'src/game/meetServer.ts',
    from: "      lights: attempt.good ? REPLAY_GOOD : REPLAY_NO_LIFT,",
    to: '      lights: REPLAY_GOOD,',
  },
  {
    id: 'meet-moves-e1rm',
    claim:
      'GDD §2: e1RM grows from Sim mode, session by session. A meet carries it ' +
      'through untouched. Mutation: let a made attempt raise it.',
    file: 'src/game/meetServer.ts',
    from: '    bestE1rmKg: record.bestE1rmKg,',
    to: '    bestE1rmKg: {\n      squat: Math.max(record.bestE1rmKg.squat ?? 0, bestByLiftKg.squat ?? 0),\n      bench: Math.max(record.bestE1rmKg.bench ?? 0, bestByLiftKg.bench ?? 0),\n      deadlift: Math.max(record.bestE1rmKg.deadlift ?? 0, bestByLiftKg.deadlift ?? 0),\n    },',
  },
  {
    id: 'bombed-lifter-is-ranked-last',
    claim:
      'A lifter who did not total does not place. Mutation: rank them last ' +
      'instead of not at all.',
    file: 'src/game/meetServer.ts',
    from: '  if (totalKg === null) return { place: null, fieldSize };',
    to: '  if (totalKg === null) return { place: fieldSize, fieldSize };',
  },
  {
    id: 'judges-can-overturn-the-lifter',
    claim:
      'The panel’s majority always agrees with the mechanic. Mutation: let ' +
      'the dissent flip the majority on a close call.',
    file: 'src/game/meetDay.ts',
    from: '  const lights: (\'white\' | \'red\')[] = [agree, agree, agree];\n  if (splits) {',
    to: '  const lights: (\'white\' | \'red\')[] = [agree, dissent, dissent];\n  if (splits) {',
  },
  {
    id: 'no-deliberation-beat',
    claim:
      'GDD §6.2 step 4: a brief "judges deliberating" beat on close calls. ' +
      'Mutation: never deliberate.',
    file: 'src/game/meetDay.ts',
    from: '  return margin < MEET_TUNING.DELIBERATION_MARGIN;',
    to: '  return false;',
  },
  {
    id: 'deliberation-beat-is-a-tell',
    claim:
      'The deliberation band is strictly WIDER than the split band, so the beat ' +
      'carries no information about the verdict. Mutation: make them the same ' +
      'band, so a deliberation always precedes a split.',
    file: 'src/game/meetTuning.ts',
    from: '  DELIBERATION_MARGIN: 0.72,',
    to: '  DELIBERATION_MARGIN: 0.55,',
  },
  {
    id: 'judging-margin-is-a-constant',
    claim:
      'The call margin is MEASURED off the rep. Mutation: return a constant, so ' +
      'every attempt is equally arguable.',
    file: 'src/game/meetDay.ts',
    from: '  const depth = resolution.timings.find((timing) => timing.cue === \'depth\');',
    to: '  if (Number.isFinite(MEET_TUNING.SPLIT_MARGIN)) return MEET_TUNING.SPLIT_MARGIN;\n  const depth = resolution.timings.find((timing) => timing.cue === \'depth\');',
  },
  {
    id: 'every-miss-is-arguable',
    claim:
      'A bar that stalled, buried the lifter or never got the command is a ' +
      'unanimous red. Mutation: score every miss by its depth offset, so a ' +
      'stalled bar can produce a split.',
    file: 'src/game/meetDay.ts',
    from: "    if (reason !== 'no-depth' || depth === undefined) return 1;",
    to: '    if (depth === undefined) return 1;\n    if (reason === null) return 1;',
  },
  {
    id: 'a-grind-is-never-doubted',
    claim:
      'A lift that ground is doubted more than one that went up fast. ' +
      'Mutation: delete the grind term.',
    file: 'src/game/meetDay.ts',
    from: '  return clamp01(depthConfidence - MEET_TUNING.GRIND_DOUBT_WEIGHT * stallFraction);',
    to: '  return clamp01(depthConfidence);',
  },
  {
    id: 'third-attempt-is-not-held-longer',
    claim:
      'GDD §7.2 / §12.2: the third-attempt walkout is the beat this piece is ' +
      'judged on and is held longest. Mutation: hold every attempt the same.',
    file: 'src/game/meetDay.ts',
    from: '  if (attemptNumber === ATTEMPTS_PER_LIFT) total += MEET_TUNING.THIRD_ATTEMPT_WALKOUT_EXTRA_MS;',
    to: '  if (false) total += MEET_TUNING.THIRD_ATTEMPT_WALKOUT_EXTRA_MS;',
  },
  {
    id: 'bomb-risk-is-not-flagged',
    claim:
      'The attempt that decides whether the lifter bombs is flagged, warned ' +
      'about, and held longest. Mutation: never flag it.',
    file: 'src/game/meetDay.ts',
    from: '  const bombRisk = isLastAttempt && bankedKg === null;',
    to: '  const bombRisk = false;',
  },
  {
    id: 'openers-are-not-from-e1rm',
    claim:
      'GDD §6.1: opening attempts are pre-filled from the lifter’s e1RM. ' +
      'Mutation: open every lifter on the bar.',
    file: 'src/game/meetDay.ts',
    from: '    const suggested = suggestOpener(lift, bestE1rmKg[lift], meet.rules);\n    out[lift] = suggested.ok ? suggested.value : meet.rules.barAndCollarsWeight[lift];',
    to: '    out[lift] = meet.rules.barAndCollarsWeight[lift];',
  },
  {
    id: 'openers-cannot-be-overridden',
    claim:
      'GDD §6.1: "Player can override." Mutation: put the SUGGESTION on the bar ' +
      'whatever the player set.',
    file: 'src/game/meetDay.ts',
    from: '      return declareLive(state, state.openersKg[context.lift]);',
    to: '      return declareLive(state, suggestedOpeners(state.context.bestE1rmKg, state.context.meet)[context.lift]);',
  },
  {
    id: 'readiness-never-reaches-the-attempt',
    claim:
      'GDD §6.2 step 3: readiness/fatigue silently adjusts the timing window. ' +
      'Mutation: do not put the feel on the config.',
    file: 'src/game/meetDay.ts',
    from: '  return { loadRatio: live.loadRatio, seed: live.seed, feel, moment };',
    to: '  return { loadRatio: live.loadRatio, seed: live.seed, moment };',
  },
  {
    id: 'the-meet-does-not-accumulate',
    claim:
      'A third deadlift after eight attempts is a tighter window than an ' +
      'opening squat. Mutation: report every attempt as the first.',
    file: 'src/game/meetDay.ts',
    from: '    workSetsCompleted: state.attempts.length,',
    to: '    workSetsCompleted: 0,',
  },
  {
    id: 'fatigue-leaks-onto-the-state',
    claim:
      'GDD §12.3: no visible fatigue meter — no fatigue number reaches anything ' +
      'renderable. Mutation: put the burden on a rendered attempt.',
    file: 'src/game/meetDay.ts',
    from: '  return {\n    lift,\n    attemptNumber,\n    weightKg,\n    loadRatio: scrub(weightKg / e1rmKg),',
    to: '  const leaked = sessionFeel(context.fatigue, context.day);\n  return {\n    lift,\n    attemptNumber,\n    weightKg,\n    loadRatio: scrub(weightKg / e1rmKg) + (leaked.barSpeed === \'grinding\' ? 1e-9 : 0),',
  },
  {
    id: 'recap-prints-its-own-total',
    claim:
      'The recap reads its numbers off the card it hands off, and refuses when ' +
      'the server disagrees with it. Mutation: drop the refusal.',
    file: 'src/game/meetDay.ts',
    from: '  if (card.totalKg !== confirmed.totalKg) {',
    to: '  if (false) {',
  },
  {
    id: 'weigh-in-changes-the-meet',
    claim:
      'GDD §6.1: the water cut is FLAVOUR ONLY — no dieting mechanic. ' +
      'Mutation: let a tight cut cost the lifter a kilo on every opener.',
    file: 'src/game/meetDay.ts',
    from: '    const suggested = suggestOpener(lift, bestE1rmKg[lift], meet.rules);',
    to: '    const suggested = suggestOpener(lift, bestE1rmKg[lift] * 0.99, meet.rules);',
    note: 'stands in for any coupling from the weigh-in to the meet',
  },
  // -------------------------------------------------------------------------
  // S2 rework: the venue, the haptics and the sound
  // -------------------------------------------------------------------------
  {
    id: 'venue-prop-deleted',
    claim:
      'GDD §6: a competition attempt is lifted on the MEET PLATFORM, not in ' +
      'the training gym. Mutation: stop passing the venue, so AttemptView ' +
      'takes LiftStage\u2019s default and the meet happens in the gym again — ' +
      'which is exactly the state the piece shipped in last round.',
    file: 'src/meet/AttemptView.tsx',
    from: '\n          venue={MEET_TUNING.VENUE}',
    to: '',
  },
  {
    id: 'venue-set-to-the-training-gym',
    claim:
      'The venue constant names the meet hall. Mutation: point it at the ' +
      'training gym, so the prop is still passed and still wrong.',
    file: 'src/game/meetTuning.ts',
    from: "  VENUE: 'meet-platform' as GymVenue,",
    to: "  VENUE: 'training-gym' as GymVenue,",
  },
  {
    id: 'liftstage-ignores-the-venue-it-is-handed',
    claim:
      'LiftStage DRAWS the room it is given. Mutation: accept the prop and ' +
      'draw the default anyway — the failure a source scan of the CALLER ' +
      'cannot see, and a one-word edit from the code as written.',
    file: 'src/lift/LiftStage.tsx',
    from: '  const seated = SCENES[venue];',
    to: '  const seated = SCENES[DEFAULT_VENUE];',
  },
  // -------------------------------------------------------------------------
  // S2 rework: the hall the walk-out leaves standing is the hall the rep is
  // lifted in
  // -------------------------------------------------------------------------
  {
    id: 'the-crowd-sits-back-down-at-the-cut',
    claim:
      'GDD §6.2: the walk-out\u2019s only escalating channel that reaches the ' +
      'picture is spent, not thrown away. Mutation: stop handing the rise to ' +
      'LiftStage, so the crowd sits back down on the frame the bar starts ' +
      'moving \u2014 which is exactly the state the piece shipped in last round.',
    file: 'src/meet/AttemptView.tsx',
    from: '\n          crowdRisePx={crowdRisePx}',
    to: '',
  },
  {
    id: 'liftstage-accepts-the-rise-and-draws-a-seated-hall',
    claim:
      'LiftStage DRAWS the rise it is given, not just takes it. Mutation: ' +
      'memoise the prop and compose nothing onto the room \u2014 the failure a ' +
      'source scan of the CALLER cannot see, the same shape the venue mutant ' +
      'above covers one field over.',
    file: 'src/lift/LiftStage.tsx',
    from: '    () => (crowdRisePx <= 0 ? seated : { ...seated, crowdRisePx }),',
    to: '    () => (crowdRisePx <= 0 ? seated : { ...seated }),',
  },
  {
    id: 'the-rep-restates-the-tail-constant-instead-of-reading-the-sheet',
    claim:
      'The rise the rep holds is the rise the walk-out\u2019s last drawn frame ' +
      'ends on, not a constant. Mutation: return urgent ? HUSH_CROWD_RISE_PX : 0 ' +
      '\u2014 which agrees with the sheet on all six attempt shapes the shipped ' +
      'tuning can produce, and is wrong for any urgent tail under ' +
      'MIN_BRACE_WINDOW_MS.',
    file: 'src/meet/walkout.ts',
    from:
      '  const sequence = buildWalkout(request);\n' +
      '  return walkoutFrameAt(sequence, sequence.beatMs).crowdRisePx;',
    to: '  return request.urgent ? T.HUSH_CROWD_RISE_PX : 0;',
  },
  {
    id: 'the-two-screens-build-two-different-beats',
    claim:
      'Both sides of the cut ask ONE request constructor. Mutation: give the ' +
      'walk-out its own inline request, so the beat the sheet plays and the ' +
      'beat the rep reads its hall off can drift apart.',
    file: 'src/meet/WalkoutView.tsx',
    from: '    () => buildWalkout(walkoutRequestFor(attempt, barAndCollarsKg, loadRatio)),',
    to: '    () => buildWalkout({ loadRatio, plateCount, urgent, beatMs: attempt.walkoutMs }),',
  },
  {
    id: 'the-hold-goes-quiet-and-nothing-notices',
    claim:
      'The wait for the lights is swept for held frame across every shape ' +
      'deliberationMs can be asked for. Mutation: lower MIN_BRACE_WINDOW_MS so ' +
      'two more shapes brace \u2014 a change no test in the tree noticed before ' +
      'the sweep existed.',
    file: 'src/game/meetTuning.ts',
    from: '    MIN_BRACE_WINDOW_MS: 600,',
    to: '    MIN_BRACE_WINDOW_MS: 500,',
  },
  {
    id: 'verdict-screen-fires-no-light-beat',
    claim:
      'The three-white-lights reveal is felt and heard, one lamp at a time. ' +
      'Mutation: keep the whole table and the whole routing, and simply stop ' +
      'the screen calling it — the shape the piece was in when every pattern ' +
      'existed and nothing played one.',
    file: 'src/meet/VerdictView.tsx',
    from: "    const timer = setTimeout(() => playBeat({ kind: 'light', light }), at);",
    to: '    const timer = setTimeout(() => undefined, at);',
  },
  {
    id: 'walkout-screen-fires-no-plate-beat',
    claim:
      'The bar LOADS: one thud and one rattle per landing. Mutation: stop the ' +
      'walkout screen firing them.',
    file: 'src/meet/WalkoutView.tsx',
    from: "    playBeat({ kind: 'bar-plate' });",
    to: '    return;',
  },
  {
    id: 'the-bar-load-goes-back-on-a-queue-of-timers',
    claim:
      'The bar load is a function of the CLOCK, so a blocked main thread makes ' +
      'it skip rather than replay every tick it missed. Mutation: put it back ' +
      'on one setTimeout per disc — the exact shape Chromium delivered as five ' +
      '180ms rattles inside 139ms for a single paint.',
    file: 'src/meet/WalkoutView.tsx',
    from:
      '  const platesLoaded = useHallStep(plateStep, barLoadMs(plateCount), holdAtMs ?? null);\n' +
      '  React.useEffect(() => {\n' +
      '    if (platesLoaded <= 0) return;\n' +
      "    playBeat({ kind: 'bar-plate' });\n" +
      '  }, [platesLoaded]);',
    to:
      '  void plateStep;\n' +
      '  const [platesLoaded, setPlatesLoaded] = React.useState(0);\n' +
      '  React.useEffect(() => {\n' +
      '    const timers: ReturnType<typeof setTimeout>[] = [];\n' +
      '    for (let i = 0; i < plateCount; i += 1) {\n' +
      '      timers.push(\n' +
      '        setTimeout(() => {\n' +
      '          setPlatesLoaded(i + 1);\n' +
      "          playBeat({ kind: 'bar-plate' });\n" +
      '        }, i * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS),\n' +
      '      );\n' +
      '    }\n' +
      '    return () => {\n' +
      '      for (const timer of timers) clearTimeout(timer);\n' +
      '    };\n' +
      '  }, [plateCount, attempt.lift, attempt.attemptNumber]);',
  },
  {
    id: 'two-arrivals-in-one-frame-are-heard-twice',
    claim:
      'Discs arriving closer together than the ear separates them are ONE ' +
      'clatter. Mutation: set the merge window to zero, so a catch-up that ' +
      'stops a millisecond short of the next disc hits again a millisecond later.',
    file: 'src/game/meetTuning.ts',
    from: '  BAR_LOAD_RATTLE_MERGE_MS: 24,',
    to: '  BAR_LOAD_RATTLE_MERGE_MS: 0,',
  },
  {
    id: 'sound-muted',
    claim:
      'GDD §12.2 judges this beat on \u201cpacing AND sound\u201d. Mutation: mute the ' +
      'mix. Every cue renders silent and every committed .wav stops matching ' +
      'its recipe.',
    file: 'src/game/meetTuning.ts',
    from: '  MASTER_GAIN: 0.8,',
    to: '  MASTER_GAIN: 0,',
  },
  {
    id: 'a-cue-recipe-changed-without-regenerating-the-asset',
    claim:
      'The shipped .wav files ARE the output of MEET_SOUND. Mutation: retune ' +
      'one cue and leave the asset alone, which is what a playtest pass that ' +
      'forgot to run tools/sound.mjs would do.',
    file: 'src/game/meetTuning.ts',
    from: '    BAR_RATTLE: Object.freeze({\n      durationMs: 180,',
    to: '    BAR_RATTLE: Object.freeze({\n      durationMs: 240,',
  },
  {
    id: 'the-hall-cheers-a-no-lift',
    claim:
      'GDD §6.3: a no-lift gets SILENCE, not a fail buzzer, and a real hall ' +
      'goes quiet. Mutation: play the crowd on a miss as well as a make.',
    file: 'src/game/meetDay.ts',
    from: "      return beat.good ? 'CROWD_CHEER' : null;",
    to: "      return 'CROWD_CHEER';",
  },
  {
    id: 'the-join-drops-the-sound',
    claim:
      'One call per moment fires the haptic AND the cue. Mutation: keep the ' +
      'haptic and drop the sound — a silent app whose whole audio system is ' +
      'still present, tested and unreachable.',
    file: 'src/meet/meetFeedback.ts',
    from: '  playCue(soundForBeat(beat));',
    to: '',
  },
  {
    id: 'haptic-bar-plate-deleted',
    claim:
      'MEET_TUNING.HAPTICS.BAR_PLATE is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    BAR_PLATE: hapticPattern({ style: 'rigid', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-walkout-call-deleted',
    claim:
      'MEET_TUNING.HAPTICS.WALKOUT_CALL is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    WALKOUT_CALL: hapticPattern({ style: 'soft', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-walkout-call-urgent-deleted',
    claim:
      'MEET_TUNING.HAPTICS.WALKOUT_CALL_URGENT is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    WALKOUT_CALL_URGENT: hapticPattern(\n      { style: 'heavy', delayMs: 0 },\n      { style: 'medium', delayMs: 90 },\n    ),",
    to: '',
  },
  {
    id: 'haptic-deliberation-deleted',
    claim:
      'MEET_TUNING.HAPTICS.DELIBERATION is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    DELIBERATION: hapticPattern({ style: 'soft', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-light-white-deleted',
    claim:
      'MEET_TUNING.HAPTICS.LIGHT_WHITE is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    LIGHT_WHITE: hapticPattern({ style: 'rigid', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-light-red-deleted',
    claim:
      'MEET_TUNING.HAPTICS.LIGHT_RED is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    LIGHT_RED: hapticPattern({ style: 'heavy', delayMs: 0 }, { style: 'soft', delayMs: 70 }),",
    to: '',
  },
  {
    id: 'haptic-verdict-good-deleted',
    claim:
      'MEET_TUNING.HAPTICS.VERDICT_GOOD is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    VERDICT_GOOD: hapticPattern({ style: 'success', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-verdict-no-lift-deleted',
    claim:
      'MEET_TUNING.HAPTICS.VERDICT_NO_LIFT is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    VERDICT_NO_LIFT: hapticPattern({ style: 'warning', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-bomb-out-deleted',
    claim:
      'MEET_TUNING.HAPTICS.BOMB_OUT is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    BOMB_OUT: hapticPattern({ style: 'soft', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-floor-raised-deleted',
    claim:
      'MEET_TUNING.HAPTICS.FLOOR_RAISED is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    FLOOR_RAISED: hapticPattern({ style: 'warning', delayMs: 0 }),",
    to: '',
  },
  {
    id: 'haptic-attempt-declared-deleted',
    claim:
      'MEET_TUNING.HAPTICS.ATTEMPT_DECLARED is played on a real meet-day beat. ' +
      'Mutation: delete the entry, so that beat is silent in the hand.',
    file: 'src/game/meetTuning.ts',
    from: "    ATTEMPT_DECLARED: hapticPattern({ style: 'rigid', delayMs: 0 }, { style: 'light', delayMs: 80 }),",
    to: '',
  },
];
function run(cmd, cmdArgs) {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** Which test names went red, read off vitest's own output. */
function redTests(output) {
  const names = new Set();
  for (const line of output.split('\n')) {
    const match = /^\s*(?:FAIL|×)\s+(.*)$/.exec(line);
    if (match !== null) names.add(match[1].replace(/\s+\d+ms$/, '').trim());
  }
  return [...names];
}

function counts(output) {
  const match = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(output);
  if (match === null) return { failed: null, passed: null };
  return { failed: Number(match[1] ?? 0), passed: Number(match[2]) };
}

const selected = MUTATIONS.filter((_m, index) => onlyIndex === null || index === onlyIndex);

if (listOnly) {
  MUTATIONS.forEach((m, index) => console.log(`${String(index).padStart(2)}  ${m.id}\n    ${m.claim}`));
  process.exit(0);
}

console.log('=== BASELINE ===');
const baseline = run('npx', ['vitest', 'run']);
console.log(counts(baseline.out).passed === null ? baseline.out.slice(-2000) : `baseline: ${JSON.stringify(counts(baseline.out))}`);
if (!baseline.ok) {
  console.error('baseline is not green; refusing to mutate');
  process.exit(1);
}

const results = [];
for (const mutation of selected) {
  const file = path.join(ROOT, mutation.file);
  const original = readFileSync(file, 'utf8');

  // ASSERT THE MUTATION APPLIES. A search string that matches zero times (or
  // more than once) is a mutation that silently did nothing and would report a
  // false "no test caught this".
  const occurrences = original.split(mutation.from).length - 1;
  if (occurrences !== 1) {
    console.error(`\n!! ${mutation.id}: search string occurs ${occurrences} times in ${mutation.file}, expected exactly 1`);
    results.push({ id: mutation.id, applied: false, red: [] });
    continue;
  }
  const mutated = original.replace(mutation.from, mutation.to);
  writeFileSync(file, mutated);

  // ...and verify what is on disk really is the mutation. The text must be
  // present AND the file must actually have changed — a mutation whose
  // replacement happens to contain its own search string (an insertion rather
  // than a swap) is still a real mutation, so "no longer contains `from`" is
  // the wrong check and used to report a false "did not apply".
  const onDisk = readFileSync(file, 'utf8');
  const reallyApplied = onDisk.includes(mutation.to) && onDisk !== original;
  if (!reallyApplied) {
    writeFileSync(file, original);
    console.error(`\n!! ${mutation.id}: file on disk does not contain the mutation`);
    results.push({ id: mutation.id, applied: false, red: [] });
    continue;
  }

  const typecheck = run('npx', ['tsc', '--noEmit']);
  const suite = run('npx', ['vitest', 'run']);
  writeFileSync(file, original);

  const red = redTests(suite.out);
  const tally = counts(suite.out);
  results.push({
    id: mutation.id,
    claim: mutation.claim,
    applied: true,
    typeError: !typecheck.ok,
    tally,
    red,
  });

  console.log(`\n=== ${mutation.id} ===`);
  console.log(mutation.claim);
  console.log(`  typecheck: ${typecheck.ok ? 'clean' : 'FAILS (counts as caught)'}`);
  console.log(`  suite: ${JSON.stringify(tally)}`);
  for (const name of red.slice(0, 12)) console.log(`    RED  ${name}`);
  if (red.length > 12) console.log(`    ... and ${red.length - 12} more`);
  if (red.length === 0 && typecheck.ok) console.log('    !! NOTHING CAUGHT THIS');
}

console.log('\n=== SUMMARY ===');
let uncaught = 0;
for (const result of results) {
  if (!result.applied) {
    console.log(`SKIPPED (did not apply)  ${result.id}`);
    uncaught += 1;
    continue;
  }
  const caught = result.typeError || result.red.length > 0;
  if (!caught) uncaught += 1;
  console.log(
    `${caught ? 'CAUGHT ' : 'MISSED '} ${result.id.padEnd(36)} ` +
      `${result.typeError ? 'tsc' : `${result.red.length} test(s) red, ${result.tally.failed ?? '?'} failures`}`,
  );
}
console.log(`\n${results.length - uncaught}/${results.length} mutations caught`);
process.exit(uncaught === 0 ? 0 : 1);
