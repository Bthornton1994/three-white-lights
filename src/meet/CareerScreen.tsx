/**
 * CareerScreen — the Career surface: GDD §2.1's federation chooser, then GDD
 * §6.1's calendar. Sprint 1b.
 *
 * ---------------------------------------------------------------------------
 * A RENDERER, LIKE ITS SIBLINGS — AND WHAT ACTUALLY CHECKS THAT
 * ---------------------------------------------------------------------------
 * Every value drawn here is meant to be a field of `useCareer`'s loop, which
 * reads the app's one connection through `progression.ts`'s accessors and the
 * pure builders in `careerSurface.ts`. What holds that in place, named rather
 * than asserted: `shellWiring.test.ts`'s career block pins the hook call, the
 * refusal draw and the choose wiring against this file's source, and
 * `tools/verify-shell-route.mjs` section 11 reads the CHOSEN federation's
 * name off every calendar row after choosing a non-default federation — a row
 * hardcoded in this file cannot change federation with the choice. That is
 * weaker than the per-row `(testID <- expression)` pairing `EmpireScreen`
 * carries, and the gap is stated rather than papered: a row drawing a
 * DIFFERENT field of the same loop would pass both. The refusal copy is the
 * server's own sentence, drawn verbatim, and the browser's refusal leg (4d)
 * asserts the drawn sentence begins with `careerServer.ts`'s own words.
 *
 * WHAT IS DELIBERATELY NOT ON THIS SCREEN: the lifter's own Total, e1RM,
 * streak or any progression number. GDD §3.2 and §6.4 put Total on meet day
 * and no other day. The qualifying figures on the calendar are the MEETS' own
 * data — the gate §6.1 says the calendar is drawn with — not the lifter's.
 *
 * WHAT IS NOT WIRED YET, by scope: entering a meet from a row. Sprint 1c owns
 * the `CareerMeet -> MeetDefinition` seam; until then an enterable row shows
 * its OPEN badge and takes no tap. GDD §10.0's locked ceiling is drawn locked
 * whatever the verdict says — `careerSurface.ts` holds that rule and the
 * argument for it.
 */

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MEET_LAYOUT } from '../game/meetTuning';
import type { CareerMeet } from '../career/calendar';
import { CAREER_COPY } from '../career/careerTuning';
import type { CareerServerPort } from '../game/careerClient';
import { MEET_PALETTE } from './meetPalette';
import { useCareer } from './useCareer';
import type { CareerCalendarRow, CareerSurfacePhase } from './careerSurface';

const L = MEET_LAYOUT;

export interface CareerScreenProps {
  /**
   * THE APP'S CONNECTION, narrowed to the career half. Required, exactly as
   * `MeetScreen`'s is and for the same reason: an optional port with a default
   * would BE a second lifter. `appCareerPort()` is the same object as the
   * session's and meet day's ports — one row behind one port.
   */
  readonly serverPort: CareerServerPort;
  /** Reports which of the two beats is up, for the shell's chrome gate. */
  readonly onPhase?: (phase: CareerSurfacePhase) => void;
  /**
   * Is this the surface the player is looking at? The shell keeps this screen
   * mounted while the player trains (`PERSISTENT_SURFACES`), so `useCareer`
   * re-reads the row when it becomes active again and the beat is re-reported
   * — the same pair of reasons `EmpireScreen` carries this prop.
   */
  readonly active?: boolean;
  /**
   * Where an enterable row's press goes (Sprint 1c). SUPPLIED BY THE ROUTER,
   * on `MeetScreen.onLeave`'s reasoning: entering a meet is a route change and
   * all routing lives in `src/shell/`. This screen hands over the row's own
   * `CareerMeet`, verbatim, and decides nothing else — which meet becomes a
   * runnable `MeetDefinition` is `careerMeet.ts`'s job, on the shell's side of
   * the call. Omitted (a harness), enterable rows draw no control at all
   * rather than a dead one.
   */
  readonly onEnterMeet?: (meet: CareerMeet) => void;
  /** Persistent platform name, when A2 identity exists. */
  readonly platformName?: string | null;
}

export function CareerScreen({
  serverPort,
  onPhase,
  active = true,
  onEnterMeet,
  platformName = null,
}: CareerScreenProps): React.ReactElement {
  const loop = useCareer(serverPort, active);

  useEffect(() => {
    if (!active) return;
    onPhase?.(loop.phase);
  }, [onPhase, active, loop.phase]);

  if (loop.phase === 'choosing') {
    return (
      <View style={styles.root} testID="career-screen">
        <View style={styles.choosing} testID="career-choosing">
          <Text style={styles.title} testID="career-title">
            {CAREER_COPY.CHOOSE_TITLE}
          </Text>
          <Text style={styles.lead}>{CAREER_COPY.CHOOSE_LEAD}</Text>
          {loop.refusal === null ? null : (
            <Text style={styles.refusal} testID="career-refusal">
              {loop.refusal}
            </Text>
          )}
          <View style={styles.cards}>
            {loop.options.map((option) => (
              <Pressable
                key={option.id}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={option.name}
                disabled={loop.inFlight}
                onPress={() => loop.choose(option.id)}
                testID={`career-fed-${option.id}`}
              >
                <Text style={styles.cardName}>{option.name}</Text>
                <Text style={styles.cardRuleset}>{option.rulesetText}</Text>
              </Pressable>
            ))}
          </View>
          {loop.inFlight ? (
            <Text style={styles.pending} testID="career-pending">
              {CAREER_COPY.CHOOSE_PENDING}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="career-screen">
      <ScrollView contentContainerStyle={styles.calendar} testID="career-calendar">
        <Text style={styles.title} testID="career-title">
          {CAREER_COPY.CALENDAR_TITLE}
        </Text>
        {platformName === null || platformName.length === 0 ? null : (
          <Text style={styles.lead} testID="career-lifter-name">
            {platformName}
          </Text>
        )}
        <Text style={styles.lead}>{CAREER_COPY.CALENDAR_LEAD}</Text>
        {(loop.rows ?? []).map((row) => (
          <CalendarRow key={row.tier} row={row} onEnterMeet={onEnterMeet} />
        ))}
      </ScrollView>
    </View>
  );
}

function CalendarRow({
  row,
  onEnterMeet,
}: {
  readonly row: CareerCalendarRow;
  readonly onEnterMeet?: ((meet: CareerMeet) => void) | undefined;
}): React.ReactElement {
  return (
    <View
      style={[styles.row, row.locked ? styles.rowLocked : null]}
      testID={`career-row-${row.tier}`}
    >
      <View style={styles.rowHead}>
        <Text style={styles.rowTier}>{row.tierLabel}</Text>
        {row.badge === null ? null : (
          <Text
            style={row.locked ? styles.badgeLocked : styles.badgeOpen}
            testID={`career-row-${row.tier}-badge`}
          >
            {row.badge}
          </Text>
        )}
      </View>
      <Text style={styles.rowName}>{row.meetName}</Text>
      <Text style={styles.rowDate} testID={`career-row-${row.tier}-date`}>
        {row.dateIso}
      </Text>
      <Text style={styles.rowQualifying} testID={`career-row-${row.tier}-qualifying`}>
        {row.qualifyingLine}
      </Text>
      {row.detail === null ? null : (
        <Text style={styles.rowDetail} testID={`career-row-${row.tier}-detail`}>
          {row.detail}
        </Text>
      )}
      {row.enterable && onEnterMeet !== undefined ? (
        <Pressable
          style={styles.enter}
          accessibilityRole="button"
          accessibilityLabel={CAREER_COPY.ENTER_MEET_LABEL}
          accessibilityHint={CAREER_COPY.ENTER_MEET_HINT}
          onPress={() => onEnterMeet(row.meet)}
          testID={`career-enter-${row.tier}`}
        >
          <Text style={styles.enterLabel}>{CAREER_COPY.ENTER_MEET_LABEL}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MEET_PALETTE.ESPRESSO,
  },
  choosing: {
    flex: 1,
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.CAREER_PAD_TOP,
  },
  calendar: {
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.CAREER_PAD_TOP,
    paddingBottom: L.CAREER_FOOT_CLEARANCE,
    gap: L.CAREER_ROW_GAP,
  },
  title: {
    color: MEET_PALETTE.AMBER,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  lead: {
    marginTop: L.ROW_GAP,
    marginBottom: L.ROW_GAP,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.BODY_FONT,
  },
  refusal: {
    marginBottom: L.ROW_GAP,
    color: MEET_PALETTE.MISS,
    fontSize: L.HINT_FONT,
  },
  cards: {
    gap: L.CAREER_ROW_GAP,
  },
  card: {
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderRadius: L.CARD_RADIUS,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.CAREER_ROW_PAD_V,
  },
  cardName: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
  },
  cardRuleset: {
    marginTop: L.DIVIDER_HEIGHT,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  pending: {
    marginTop: L.ROW_GAP,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  row: {
    borderWidth: L.DIVIDER_HEIGHT,
    borderColor: MEET_PALETTE.PANEL_EDGE,
    backgroundColor: MEET_PALETTE.PANEL,
    borderRadius: L.CARD_RADIUS,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.CAREER_ROW_PAD_V,
  },
  rowLocked: {
    borderColor: MEET_PALETTE.CARD_BOLD_EDGE,
    backgroundColor: MEET_PALETTE.CARD_BOLD,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTier: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  badgeOpen: {
    color: MEET_PALETTE.GOOD,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  badgeLocked: {
    color: MEET_PALETTE.WALKOUT_URGENT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  rowName: {
    marginTop: L.DIVIDER_HEIGHT,
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
  },
  rowDate: {
    marginTop: L.DIVIDER_HEIGHT,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  rowQualifying: {
    marginTop: L.DIVIDER_HEIGHT,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  rowDetail: {
    marginTop: L.ROW_GAP,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  // The enter control reuses the chooser card's confirm-shaped tokens: it is
  // the row's one press target, drawn inside the row so a thumb reads row and
  // control as one meet.
  enter: {
    marginTop: L.ROW_GAP,
    alignSelf: 'flex-start',
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderRadius: L.CARD_RADIUS,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.DIVIDER_HEIGHT,
  },
  enterLabel: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
});
