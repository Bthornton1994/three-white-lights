/**
 * LifterScreen — Create Your Lifter, then the My Lifter card.
 *
 * A renderer. Identity writes go through `useLifter` to the server port.
 * Total and e1RM are drawn from the card facts, never computed here.
 */

import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CAREER_COPY, LIFTER_IDENTITY } from '../career/careerTuning';
import type { LifterServerPort } from '../game/lifterClient';
import { MEET_LAYOUT } from '../game/meetTuning';
import { formatWeight } from '../game/resultCard';
import { MEET_PALETTE } from './meetPalette';
import { useLifter } from './useLifter';
import type { LifterSurfacePhase } from './lifterSurface';

const L = MEET_LAYOUT;

export interface LifterScreenProps {
  readonly serverPort: LifterServerPort;
  readonly onPhase?: (phase: LifterSurfacePhase) => void;
  readonly active?: boolean;
}

export function LifterScreen({
  serverPort,
  onPhase,
  active = true,
}: LifterScreenProps): React.ReactElement {
  const loop = useLifter(serverPort, active);

  useEffect(() => {
    if (!active) return;
    onPhase?.(loop.phase);
  }, [onPhase, active, loop.phase]);

  if (loop.phase === 'creating') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        testID="lifter-screen"
      >
        <ScrollView
          contentContainerStyle={styles.create}
          keyboardShouldPersistTaps="handled"
          testID="lifter-create"
        >
          <Text style={styles.title} testID="lifter-create-title">
            {CAREER_COPY.LIFTER_CREATE_TITLE}
          </Text>
          <Text style={styles.lead}>{CAREER_COPY.LIFTER_CREATE_LEAD}</Text>
          {loop.refusal === null ? null : (
            <Text style={styles.refusal} testID="lifter-refusal">
              {loop.refusal}
            </Text>
          )}

          <Text style={styles.label}>{CAREER_COPY.LIFTER_NAME_LABEL}</Text>
          <TextInput
            style={styles.input}
            value={loop.nameDraft}
            onChangeText={loop.setNameDraft}
            maxLength={LIFTER_IDENTITY.NAME_MAX_CHARS}
            autoCorrect={false}
            autoCapitalize="characters"
            testID="lifter-name-input"
            accessibilityLabel={CAREER_COPY.LIFTER_NAME_LABEL}
          />
          <Text style={styles.hint}>{CAREER_COPY.LIFTER_NAME_HINT}</Text>

          <Text style={styles.label}>{CAREER_COPY.LIFTER_SEX_LABEL}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.choice, loop.sexDraft === 'male' ? styles.choiceOn : null]}
              onPress={() => loop.setSexDraft('male')}
              testID="lifter-sex-male"
              accessibilityRole="button"
              accessibilityLabel={CAREER_COPY.LIFTER_SEX_MALE}
            >
              <Text style={styles.choiceLabel}>{CAREER_COPY.LIFTER_SEX_MALE}</Text>
            </Pressable>
            <Pressable
              style={[styles.choice, loop.sexDraft === 'female' ? styles.choiceOn : null]}
              onPress={() => loop.setSexDraft('female')}
              testID="lifter-sex-female"
              accessibilityRole="button"
              accessibilityLabel={CAREER_COPY.LIFTER_SEX_FEMALE}
            >
              <Text style={styles.choiceLabel}>{CAREER_COPY.LIFTER_SEX_FEMALE}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>{CAREER_COPY.LIFTER_BODYWEIGHT_LABEL}</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.weightInput]}
              value={loop.bodyweightDraft}
              onChangeText={loop.setBodyweightDraft}
              keyboardType="decimal-pad"
              testID="lifter-bodyweight-input"
              accessibilityLabel={CAREER_COPY.LIFTER_BODYWEIGHT_LABEL}
            />
            <Text style={styles.unit}>{CAREER_COPY.LIFTER_BODYWEIGHT_UNIT}</Text>
          </View>

          <Text style={styles.label}>{CAREER_COPY.LIFTER_FEDERATION_LABEL}</Text>
          <View style={styles.cards}>
            {loop.options.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.card, loop.federationDraft === option.id ? styles.choiceOn : null]}
                onPress={() => loop.setFederationDraft(option.id)}
                testID={`lifter-fed-${option.id}`}
                accessibilityRole="button"
                accessibilityLabel={option.name}
              >
                <Text style={styles.cardName}>{option.name}</Text>
                <Text style={styles.cardRuleset}>{option.rulesetText}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.action}
            onPress={loop.create}
            disabled={loop.inFlight}
            testID="lifter-create-action"
            accessibilityRole="button"
            accessibilityLabel={CAREER_COPY.LIFTER_CREATE_ACTION}
          >
            <Text style={styles.actionLabel}>
              {loop.inFlight ? CAREER_COPY.LIFTER_CREATE_PENDING : CAREER_COPY.LIFTER_CREATE_ACTION}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const card = loop.card;
  const editing = loop.phase === 'editing-name' || loop.phase === 'editing-bodyweight';

  return (
    <View style={styles.root} testID="lifter-screen">
      <ScrollView contentContainerStyle={styles.cardPage} testID="lifter-card">
        <Text style={styles.title} testID="lifter-card-title">
          {CAREER_COPY.LIFTER_CARD_TITLE}
        </Text>
        <Text style={styles.lead}>{CAREER_COPY.LIFTER_CARD_LEAD}</Text>
        {loop.refusal === null ? null : (
          <Text style={styles.refusal} testID="lifter-refusal">
            {loop.refusal}
          </Text>
        )}

        {card === null ? null : (
          <>
            {loop.phase === 'editing-name' ? (
              <TextInput
                style={styles.input}
                value={loop.nameDraft}
                onChangeText={loop.setNameDraft}
                maxLength={LIFTER_IDENTITY.NAME_MAX_CHARS}
                autoCorrect={false}
                testID="lifter-name-input"
              />
            ) : (
              <Text style={styles.headline} testID="lifter-name">
                {card.name}
              </Text>
            )}
            <Text style={styles.meta} testID="lifter-sex">
              {card.sexLabel}
            </Text>
            {loop.phase === 'editing-bodyweight' ? (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.weightInput]}
                  value={loop.bodyweightDraft}
                  onChangeText={loop.setBodyweightDraft}
                  keyboardType="decimal-pad"
                  testID="lifter-bodyweight-input"
                />
                <Text style={styles.unit}>{CAREER_COPY.LIFTER_BODYWEIGHT_UNIT}</Text>
              </View>
            ) : (
              <Text style={styles.meta} testID="lifter-bodyweight">
                {formatWeight(card.bodyweightKg)} {CAREER_COPY.LIFTER_BODYWEIGHT_UNIT}
              </Text>
            )}
            <Text style={styles.meta} testID="lifter-federation">
              {card.federationName}
            </Text>
            <Text style={styles.meta} testID="lifter-ruleset">
              {CAREER_COPY.LIFTER_RULESET_LABEL} {card.rulesetText}
            </Text>
            <Text style={styles.statLabel}>{CAREER_COPY.LIFTER_TOTAL_LABEL}</Text>
            <Text style={styles.statValue} testID="lifter-total">
              {card.totalKg === null
                ? CAREER_COPY.LIFTER_TOTAL_UNESTABLISHED
                : `${formatWeight(card.totalKg)} ${CAREER_COPY.LIFTER_BODYWEIGHT_UNIT}`}
            </Text>
            <Text style={styles.statLabel}>{CAREER_COPY.LIFTER_E1RM_LABEL}</Text>
            <Text style={styles.meta} testID="lifter-e1rm">
              {`${card.e1rmKg.squat === null ? CAREER_COPY.LIFTER_TOTAL_UNESTABLISHED : formatWeight(card.e1rmKg.squat)} / ${card.e1rmKg.bench === null ? CAREER_COPY.LIFTER_TOTAL_UNESTABLISHED : formatWeight(card.e1rmKg.bench)} / ${card.e1rmKg.deadlift === null ? CAREER_COPY.LIFTER_TOTAL_UNESTABLISHED : formatWeight(card.e1rmKg.deadlift)}`}
            </Text>
            <Text style={styles.hint}>{CAREER_COPY.LIFTER_FEDERATION_LOCKED}</Text>
          </>
        )}

        {editing ? (
          <View style={styles.row}>
            <Pressable style={styles.action} onPress={loop.saveEdit} testID="lifter-save-edits">
              <Text style={styles.actionLabel}>{CAREER_COPY.LIFTER_SAVE_EDITS}</Text>
            </Pressable>
            <Pressable style={styles.choice} onPress={loop.cancelEdit} testID="lifter-cancel-edits">
              <Text style={styles.choiceLabel}>{CAREER_COPY.LIFTER_CANCEL_EDITS}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable style={styles.choice} onPress={loop.beginEditName} testID="lifter-edit-name">
              <Text style={styles.choiceLabel}>{CAREER_COPY.LIFTER_EDIT_NAME}</Text>
            </Pressable>
            <Pressable
              style={styles.choice}
              onPress={loop.beginEditBodyweight}
              testID="lifter-edit-bodyweight"
            >
              <Text style={styles.choiceLabel}>{CAREER_COPY.LIFTER_EDIT_BODYWEIGHT}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MEET_PALETTE.BACKDROP,
  },
  create: {
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.CAREER_PAD_TOP,
    paddingBottom: L.LIFTER_KEYBOARD_CLEARANCE,
    gap: L.ROW_GAP,
  },
  cardPage: {
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.CAREER_PAD_TOP,
    paddingBottom: L.CAREER_FOOT_CLEARANCE,
    gap: L.ROW_GAP,
  },
  title: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  headline: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
  },
  lead: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.BODY_FONT,
  },
  label: {
    marginTop: L.ROW_GAP,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
    fontWeight: '700',
  },
  hint: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  input: {
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.PANEL_EDGE,
    backgroundColor: MEET_PALETTE.PANEL,
    borderRadius: L.STEPPER_RADIUS,
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.CAREER_ROW_PAD_V,
  },
  weightInput: {
    flex: 1,
  },
  unit: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.UNIT_FONT,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: L.CARD_GAP,
    alignItems: 'center',
  },
  choice: {
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderRadius: L.CARD_RADIUS,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.CAREER_ROW_PAD_V,
  },
  choiceOn: {
    borderColor: MEET_PALETTE.WALKOUT_URGENT,
  },
  choiceLabel: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
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
  action: {
    marginTop: L.SECTION_GAP,
    alignSelf: 'stretch',
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderRadius: L.CARD_RADIUS,
    paddingHorizontal: L.CARD_PAD,
    paddingVertical: L.CAREER_ROW_PAD_V,
    alignItems: 'center',
  },
  actionLabel: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  refusal: {
    color: MEET_PALETTE.MISS,
    fontSize: L.HINT_FONT,
  },
  meta: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.BODY_FONT,
  },
  statLabel: {
    marginTop: L.ROW_GAP,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
    fontWeight: '700',
  },
  statValue: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
  },
});
