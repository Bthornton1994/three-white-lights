import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { FacilityAction, FacilityPort } from '../../production/contracts';
import type { LifterServerPort } from '../../game/lifterClient';
import { type FloorRotation, type GridPosition } from '../floor';
import type { ManagedEquipmentItem } from '../management';
import { COMPETITION_BENCH_BAY } from '../trainingStation';
import { SCENE_TUNING } from '../scene/sceneTuning';
import { buildGymSceneFrame } from '../scene/frame';
import type { ScenePoint } from '../scene/types';
import { nativeFacilityReadings, nativeItemFootprint, nativeItemName, nativeItemPlacement, nativeLayoutAction, nativeNextRotation, nativePlacementPreview, nativeSceneCamera, type NativeGymPage } from './nativeModel';
import { NATIVE_FACILITY_COPY as C, NATIVE_FACILITY_PALETTE as P, NATIVE_FACILITY_TUNING as T } from './nativeTuning';
import { NativeScene } from './NativeScene';
import type { PracticeFacilityPort } from './practiceFacility';
import { useSceneRuntime } from './useSceneRuntime';
import placeClack from '../../../assets/sound/light-clack-white.wav';

interface NativeFacilityProps {
  readonly port: FacilityPort;
  readonly practice: boolean;
  readonly practicePort?: PracticeFacilityPort;
  readonly lifterPort?: LifterServerPort;
  readonly active: boolean;
  readonly onTrain?: () => void;
  readonly onCareer?: () => void;
}

function Button({ label, onPress, disabled, primary, selected, testID }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; testID?: string }): React.ReactElement {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
  </Pressable>;
}

/** FacilityPort read cache and native controls around the shared living scene. */
export function NativeFacility({ port, practice, practicePort, lifterPort, active, onTrain, onCareer }: NativeFacilityProps): React.ReactElement {
  const [state, setState] = useState(() => port.openingFacility());
  const [page, setPage] = useState<NativeGymPage>('gym');
  const [selected, setSelected] = useState<ManagedEquipmentItem | null>(null);
  const [position, setPosition] = useState<GridPosition | null>(null);
  const [rotation, setRotation] = useState<FloorRotation>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coordinates, setCoordinates] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [pan, setPan] = useState<ScenePoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState<{ width: number; height: number }>({ width: T.SCENE_FALLBACK_WIDTH, height: T.SCENE_FALLBACK_HEIGHT });
  const [muted, setMuted] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [manualReducedMotion, setManualReducedMotion] = useState<boolean | null>(null);
  const reducedMotion = manualReducedMotion ?? systemReducedMotion;
  const feedbackSettings = useRef({ active, muted, reducedMotion });
  feedbackSettings.current = { active, muted, reducedMotion };
  const busyRef = useRef(false);
  const generation = useRef(0);
  const requestSequence = useRef(0);
  const requestRun = useRef(`${Date.now()}`);
  const failedRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const lastFeedback = useRef(0);
  const placedOpacity = useRef(new Animated.Value(1)).current;
  const audio = useAudioPlayer(placeClack);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducedMotion).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => { audio.volume = muted ? 0 : T.SOUND_VOLUME; }, [audio, muted]);
  const feedback = useCallback((commit: boolean) => {
    const settings = feedbackSettings.current;
    if (settings.muted || settings.reducedMotion || !settings.active || AppState.currentState !== 'active') return;
    const now = Date.now();
    if (now - lastFeedback.current < T.HAPTIC_MIN_GAP_MS) return;
    lastFeedback.current = now;
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
    if (commit) {
      void audio.seekTo(0).then(() => {
        const latest = feedbackSettings.current;
        if (!latest.muted && !latest.reducedMotion && latest.active && AppState.currentState === 'active') audio.play();
      }).catch(() => undefined);
      placedOpacity.setValue(0);
      Animated.timing(placedOpacity, { toValue: 1, duration: T.PREVIEW_PULSE_MS, useNativeDriver: true }).start();
    }
  }, [audio, placedOpacity]);

  const act = useCallback(async (action: FacilityAction, success?: string): Promise<boolean> => {
    if (action.kind === 'check-in' && failedRequest.current && failedRequest.current.fingerprint !== JSON.stringify(action)) return false;
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    if (action.kind !== 'check-in') { setError(''); setNotice(''); }
    const fingerprint = JSON.stringify(action);
    const prior = failedRequest.current;
    const requestId = prior?.fingerprint === fingerprint ? prior.id : `native-facility:${requestRun.current}:${++requestSequence.current}`;
    const owner = generation.current;
    try {
      const outcome = await port.facilityAction(action, requestId);
      if (owner !== generation.current) return false;
      failedRequest.current = null;
      if (outcome.kind === 'refused') {
        if (outcome.state) setState(outcome.state);
        setError(outcome.message);
        return false;
      }
      setState(outcome.state);
      if (outcome.state.lastRefusal) {
        setError(outcome.state.lastRefusal.replaceAll('-', ' '));
        return false;
      }
      if (success) { setNotice(success); feedback(true); }
      return true;
    } catch {
      if (owner === generation.current) {
        failedRequest.current = { fingerprint, id: requestId };
        setError(practice ? 'The practice action could not be completed. Try again.' : 'Your gym could not be saved. Try again to retry the same request.');
      }
      return false;
    } finally {
      if (owner === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }, [port, practice, feedback]);
  const actRef = useRef(act);
  actRef.current = act;

  useEffect(() => {
    generation.current += 1;
    setState(port.openingFacility());
    setSelected(null); setPosition(null); setError(''); setNotice('');
    busyRef.current = false; setBusy(false); failedRequest.current = null;
    return () => { generation.current += 1; };
  }, [port]);
  useEffect(() => {
    const foreground = active && AppState.currentState === 'active';
    practicePort?.setForeground(foreground);
    if (!active) return undefined;
    void actRef.current({ kind: 'check-in' });
    const listener = AppState.addEventListener('change', value => {
      practicePort?.setForeground(value === 'active');
      if (value === 'active') void actRef.current({ kind: 'check-in' });
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void actRef.current({ kind: 'check-in' });
    }, T.FACILITY_REFRESH_MS);
    return () => { clearInterval(timer); listener.remove(); practicePort?.setForeground(false); };
  }, [active, port, practicePort]);

  const runtime = useSceneRuntime(state, active, reducedMotion);
  const readings = useMemo(() => nativeFacilityReadings(state), [state]);
  const candidate = useMemo(() => nativePlacementPreview(state, selected, position, rotation), [state, selected, position, rotation]);
  const camera = useMemo(() => nativeSceneCamera(state.managed.gym.ladder.rung, box, zoom, pan), [state.managed.gym.ladder.rung, box, zoom, pan]);
  const frame = useMemo(() => buildGymSceneFrame({ context: runtime.context, sim: runtime.sim, managed: state.managed, elapsedSeconds: runtime.elapsedSeconds, tickAlpha: runtime.tickAlpha, selected, preview: page === 'build' ? candidate.preview : null, build: page === 'build', reducedMotion }, camera), [runtime.context, runtime.sim, runtime.elapsedSeconds, runtime.tickAlpha, state.managed, selected, page, candidate.preview, reducedMotion, camera]);
  const profile = lifterPort?.openingProfile();

  function select(item: ManagedEquipmentItem): void {
    const existing = nativeItemPlacement(state, item);
    setSelected(item);
    setPosition(existing?.position ?? null);
    setRotation(existing?.rotation ?? 0);
    setCameraMode(false);
    feedback(false);
  }
  async function place(): Promise<void> {
    if (!selected || !position || !candidate.valid || busyRef.current) return;
    const committed = await act(nativeLayoutAction(state, selected, position, rotation), `${nativeItemName(selected)} placed.`);
    if (committed) setPosition(null);
  }
  function cancel(): void { setPosition(null); setSelected(null); setNotice('Placement cancelled. Your layout is unchanged.'); }
  function changePage(next: NativeGymPage): void { setPage(next); setCameraMode(false); setCoordinates(false); }

  return <View style={styles.root} testID="native-facility">
    <View style={styles.heading}>
      <View style={styles.titleGroup}><Text style={styles.eyebrow}>● ● ●  THREE WHITE LIGHTS</Text><Text style={styles.title}>{page === 'build' ? 'Build your gym' : page === 'shop' ? 'Equipment shop' : page === 'staff' ? 'Your team' : readings.title}</Text></View>
      <View style={styles.wallet}><Text style={styles.bucks} testID="native-gym-bucks">{readings.bucks}</Text><Text style={styles.small}>Gym Bucks</Text></View>
    </View>
    <View style={styles.sceneSlot} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0 && (width !== box.width || height !== box.height)) setBox({ width, height });
    }}>
      <NativeScene frame={frame} build={page === 'build'} selected={selected} selectedFootprint={selected === null ? null : nativeItemFootprint(selected, rotation)} cameraMode={cameraMode} onSelect={select} onPreview={setPosition} onPan={setPan} onDragging={setDragging} />
      <View style={styles.cameraTray}>
        <Button label="−" testID="native-zoom-out" onPress={() => setZoom(value => Math.max(SCENE_TUNING.camera.minimumZoom, value - T.ZOOM_STEP))} />
        <Button label="+" testID="native-zoom-in" onPress={() => setZoom(value => Math.min(SCENE_TUNING.camera.maximumZoom, value + T.ZOOM_STEP))} />
        <Button label={cameraMode ? 'Camera on' : 'Camera'} selected={cameraMode} testID="native-camera" onPress={() => setCameraMode(value => !value)} />
        <Button label="Reset view" testID="native-camera-reset" onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); setCameraMode(false); }} />
      </View>
      {cameraMode && <Text style={styles.cameraHint}>Drag to pan. Two fingers also pan the camera.</Text>}
    </View>
    <View style={styles.activity}><Text style={styles.activityText} testID="native-gym-activity">{frame.counts.training} training · {frame.counts.waiting} waiting · {frame.counts.staff} staff</Text><Text style={styles.small}>{practice ? 'DISPOSABLE PRACTICE' : 'SAVED ACCOUNT'}</Text></View>
    <View style={styles.tabs}>{C.tabs.map(tab => <Pressable key={tab} accessibilityRole="button" accessibilityLabel={tab === 'gym' ? 'Gym' : tab === 'build' ? 'Build' : tab === 'shop' ? 'Shop' : 'Staff'} accessibilityState={{ selected: page === tab }} testID={`native-tab-${tab}`} style={[styles.tab, page === tab && styles.tabOn]} onPress={() => changePage(tab)}><Text style={[styles.tabText, page === tab && styles.tabTextOn]}>{tab.toUpperCase()}</Text></Pressable>)}</View>
    <View style={styles.drawer} testID="native-facility-drawer">
      {error !== '' && <Text style={styles.error} accessibilityRole="alert" testID="native-facility-error">{error}</Text>}
      {notice !== '' && <Animated.Text style={[styles.notice, { opacity: placedOpacity }]} accessibilityLiveRegion="polite" testID="native-facility-notice">{notice}</Animated.Text>}
      {busy && <Text style={styles.small} accessibilityLiveRegion="polite" testID="native-facility-busy">{practice ? 'Updating practice…' : 'Saving gym…'}</Text>}
      {page === 'build' ? <>
        <View style={styles.row}><Text style={styles.itemTitle} testID="native-selected-item">{selected ? nativeItemName(selected) : 'Choose equipment'}</Text><Button label={`Rotate · ${rotation}°`} testID="native-rotate" disabled={!selected || busy} onPress={() => { setRotation(nativeNextRotation(rotation)); feedback(false); }} /></View>
        <View style={styles.row}><Text style={[styles.placementMessage, candidate.valid ? styles.valid : undefined]} accessibilityLiveRegion="polite" testID="native-placement-validity">{candidate.message}</Text><Pressable accessibilityRole="button" accessibilityLabel={coordinates ? 'Hide placement coordinates' : 'Show placement coordinates'} testID="native-coordinate-toggle" onPress={() => setCoordinates(value => !value)} hitSlop={T.SMALL_GAP}><Text style={styles.coordinateLink}>{coordinates ? 'Hide coordinates' : 'Coordinates'}</Text></Pressable></View>
        <View style={styles.row}><Button label="Cancel" testID="native-place-cancel" onPress={cancel} disabled={busy} /><Button label="Place item" testID="native-place" primary disabled={busy || !candidate.valid} onPress={() => { void place(); }} /><Button label="Undo" testID="native-layout-undo" disabled={busy || !readings.canUndo} onPress={() => { void act({ kind: 'floor-undo', expectedLayoutRevision: state.floor.layoutRevision }, 'Last layout edit undone.'); }} /><Button label="Storage" testID="native-to-storage" disabled={!selected || busy || (selected !== null && nativeItemPlacement(state, selected) === null)} onPress={() => { if (selected) void act(nativeLayoutAction(state, selected, null, rotation), `${nativeItemName(selected)} returned to storage.`).then(saved => { if (saved) setPosition(null); }); }} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inventory} testID="native-equipment-inventory" scrollEnabled={!dragging}>
          {readings.inventory.map(row => <Pressable key={row.item} style={[styles.chip, selected === row.item && styles.selected]} accessibilityRole="button" accessibilityLabel={`${row.name}${row.stored ? ', in storage' : ', on floor'}`} accessibilityState={{ selected: selected === row.item }} testID={`native-inventory-${row.item}`} onPress={() => select(row.item)}><Text style={styles.buttonText}>{row.name}{row.stored ? ' · Storage' : ''}</Text></Pressable>)}
        </ScrollView>
        {coordinates && <View style={styles.row}><Text style={styles.small}>Column</Text><TextInput style={styles.input} accessibilityLabel="Placement column" testID="native-column" keyboardType="number-pad" value={String((position?.x ?? 0) + 1)} onChangeText={value => setPosition({ x: Number(value) - 1, y: position?.y ?? 0 })} /><Text style={styles.small}>Row</Text><TextInput style={styles.input} accessibilityLabel="Placement row" testID="native-row" keyboardType="number-pad" value={String((position?.y ?? 0) + 1)} onChangeText={value => setPosition({ x: position?.x ?? 0, y: Number(value) - 1 })} /></View>}
      </> : <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} scrollEnabled={!dragging} keyboardShouldPersistTaps="handled">
        {page === 'gym' && <>
          <Text style={styles.itemTitle}>{profile?.name ? `${profile.name}’s home floor` : 'Build a lifter. Enter the sport.'}</Text>
          <Text style={styles.body}>{selected ? `${nativeItemName(selected)} selected. Open Build to move or store it.` : 'Watch the queue, place your equipment, then get back to the big three.'}</Text>
          <View style={styles.row}><Button label="Train today" primary onPress={() => onTrain?.()} disabled={!onTrain} /><Button label={profile ? 'Find a meet' : 'Career'} onPress={() => onCareer?.()} disabled={!onCareer} /><Button label="Build" testID="native-build-open" onPress={() => { if (!selected) select('flat-bench'); changePage('build'); }} /></View>
          {!practice && <Text style={styles.small} testID="native-account-sport-availability">Account Training and Career are not connected in the native app yet.</Text>}
          <View style={styles.row}><Text style={styles.body}>Gym income · {readings.income}/hr</Text><Button label="Collect" testID="native-collect" disabled={busy} onPress={() => { void act({ kind: 'check-in' }, 'Current earned income checked.'); }} /></View>
          {(selected === 'flat-bench' || selected === 'power-bar' || selected === 'comp-plates') && readings.upgrades.map(upgrade => <View style={styles.card} key={upgrade.axis}><Text style={styles.itemTitle}>{upgrade.label} · {upgrade.cost} Gym Bucks</Text><Text style={styles.body}>{upgrade.refusal ?? upgrade.effect}</Text><Button label={`Fit ${upgrade.label}`} testID={`native-upgrade-${upgrade.axis}`} disabled={busy || !upgrade.available} onPress={() => { void act({ kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis: upgrade.axis }, `${upgrade.label} fitted: ${upgrade.effect}.`); }} /></View>)}
          {readings.next && <View style={styles.card}><Text style={styles.itemTitle}>{readings.next.title}</Text><Text style={styles.body}>A larger floor · {readings.next.cost} Gym Bucks</Text><Button label="Move in" testID="native-move-up" disabled={busy || !readings.next.affordable} onPress={() => { void act({ kind: 'move-up' }, 'Welcome to your new gym.'); }} /></View>}
          <Text style={styles.small}>{practice ? 'Practice resets when the app closes. It does not save an account.' : 'Only confirmed facility responses update this account’s gym.'}</Text>
        </>}
        {page === 'shop' && readings.catalog.map(row => <View style={styles.card} key={row.item}><View style={styles.row}><View style={styles.copyGroup}><Text style={styles.itemTitle}>{row.name}</Text><Text style={styles.small}>{row.locked ? `Opens in ${C.rung[row.minimum]}` : `${row.price} Gym Bucks · goes to storage`}</Text></View><Button label={row.owned ? 'Owned' : row.locked ? 'Locked' : 'Buy'} testID={`native-buy-${row.item}`} disabled={busy || row.owned || row.locked || !row.affordable} primary={!row.owned && !row.locked} onPress={() => { void act(row.family === 'barbell' ? { kind: 'buy-ladder', item: row.item as import('../ladder').LadderEquipmentItem } : { kind: 'buy-session', item: row.item as import('../sessions').SessionEquipmentItem }, `${row.name} added to storage.`); }} /></View></View>)}
        {page === 'staff' && <>
          {readings.managers.map(row => <View style={styles.card} key={row.tier}><Text style={styles.itemTitle}>{row.name}</Text><Text style={styles.body}>{row.price} to hire · {row.wage}/hr wage</Text><Text style={styles.small}>{row.capability}</Text><Button label={row.hired ? 'Hired' : row.positionOpen ? 'Hire' : 'Position filled'} testID={`native-hire-${row.tier}`} primary={row.available} disabled={busy || !row.available} onPress={() => { void act({ kind: 'hire-manager', tier: row.tier }, `${row.name} hired.`); }} /></View>)}
          {state.managed.manager && <Button label="Dismiss manager" disabled={busy} onPress={() => { void act({ kind: 'dismiss-manager' }, 'Manager dismissed.'); }} />}
          <Text style={styles.eyebrow}>EQUIPMENT CARE</Text>{readings.maintenance.map(row => <View style={styles.card} key={row.item}><View style={styles.row}><View style={styles.copyGroup}><Text style={styles.itemTitle}>{row.name}</Text><Text style={styles.small}>{row.condition}% condition</Text></View><Button label={row.ready ? 'Ready' : `Repair · ${row.price}`} testID={`native-repair-${row.item}`} disabled={busy || row.ready || !row.affordable} onPress={() => { void act({ kind: 'repair-item', item: row.item }, `${row.name} repaired.`); }} /></View></View>)}
        </>}
      </ScrollView>}
    </View>
    <View style={styles.preferences}><Pressable accessibilityRole="switch" accessibilityState={{ checked: muted }} accessibilityLabel="Mute sound and haptics" testID="native-mute" onPress={() => setMuted(value => !value)}><Text style={styles.small}>{muted ? 'Sound & haptics off' : 'Sound & haptics on'}</Text></Pressable><Pressable accessibilityRole="switch" accessibilityState={{ checked: reducedMotion }} accessibilityLabel="Reduce motion" testID="native-reduced-motion" onPress={() => setManualReducedMotion(!reducedMotion)}><Text style={styles.small}>{reducedMotion ? 'Reduced motion on' : 'Reduced motion off'}</Text></Pressable></View>
    <View style={styles.shellClearance} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ESPRESSO },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: T.PAD, paddingVertical: T.GAP, gap: T.GAP },
  titleGroup: { flex: 1 }, title: { color: P.IVORY, fontSize: T.TITLE_FONT, fontWeight: T.FONT_BOLD, letterSpacing: T.TITLE_TRACKING },
  eyebrow: { color: P.AMBER, fontSize: T.LABEL_FONT, letterSpacing: T.LETTER_SPACING, fontWeight: T.FONT_MEDIUM },
  wallet: { alignItems: 'flex-end' }, bucks: { color: P.AMBER, fontSize: T.TITLE_FONT, fontWeight: T.FONT_BOLD },
  small: { color: P.MUTED, fontSize: T.SMALL_FONT }, body: { color: P.MUTED, fontSize: T.BODY_FONT },
  placementMessage: { flex: 1, color: P.MUTED, fontSize: T.BODY_FONT }, coordinateLink: { color: P.AMBER, fontSize: T.SMALL_FONT, paddingVertical: T.SMALL_GAP },
  sceneSlot: { flex: 1, overflow: 'hidden', backgroundColor: P.ESPRESSO },
  cameraTray: { position: 'absolute', left: T.GAP, right: T.GAP, top: T.GAP, flexDirection: 'row', gap: T.SMALL_GAP },
  cameraHint: { position: 'absolute', left: T.PAD, bottom: T.PAD, color: P.IVORY, backgroundColor: P.PANEL, padding: T.GAP, fontSize: T.SMALL_FONT },
  activity: { paddingHorizontal: T.PAD, paddingVertical: T.SMALL_GAP, flexDirection: 'row', justifyContent: 'space-between', gap: T.GAP },
  activityText: { color: P.IVORY, fontSize: T.SMALL_FONT, fontWeight: T.FONT_MEDIUM },
  tabs: { flexDirection: 'row', borderTopWidth: T.BORDER, borderBottomWidth: T.BORDER, borderColor: P.PANEL_EDGE },
  tab: { flex: 1, minHeight: T.BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center' }, tabOn: { backgroundColor: P.PANEL },
  tabText: { color: P.MUTED, fontSize: T.BUTTON_FONT, fontWeight: T.FONT_BOLD, letterSpacing: T.LETTER_SPACING }, tabTextOn: { color: P.AMBER },
  drawer: { backgroundColor: P.PANEL, paddingHorizontal: T.PAD, paddingVertical: T.GAP, gap: T.SMALL_GAP },
  contentScroll: { maxHeight: T.DRAWER_MAX_HEIGHT, flexGrow: 0 }, content: { gap: T.GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: T.GAP, flexWrap: 'wrap' },
  copyGroup: { flex: 1 }, itemTitle: { flexShrink: 1, color: P.IVORY, fontSize: T.BODY_FONT, fontWeight: T.FONT_BOLD },
  button: { minHeight: T.BUTTON_HEIGHT, paddingHorizontal: T.CHIP_PAD, justifyContent: 'center', alignItems: 'center', borderWidth: T.BORDER, borderColor: P.PANEL_EDGE, borderRadius: T.BUTTON_RADIUS, backgroundColor: P.PANEL },
  buttonText: { color: P.IVORY, fontSize: T.BUTTON_FONT, fontWeight: T.FONT_MEDIUM }, primary: { backgroundColor: P.AMBER, borderColor: P.AMBER }, primaryText: { color: P.AMBER_INK },
  selected: { borderColor: P.AMBER }, disabled: { opacity: T.MUTED_OPACITY },
  inventory: { gap: T.GAP, alignItems: 'center', paddingVertical: T.SMALL_GAP },
  chip: { height: T.INVENTORY_HEIGHT, borderWidth: T.BORDER, borderColor: P.PANEL_EDGE, borderRadius: T.BUTTON_RADIUS, paddingHorizontal: T.CHIP_PAD, justifyContent: 'center' },
  input: { borderWidth: T.BORDER, borderColor: P.PANEL_EDGE, paddingHorizontal: T.GAP, color: P.IVORY, height: T.INVENTORY_HEIGHT, minWidth: T.BUTTON_HEIGHT, fontSize: T.BODY_FONT },
  card: { borderWidth: T.BORDER, borderColor: P.PANEL_EDGE, borderRadius: T.BUTTON_RADIUS, padding: T.GAP, gap: T.SMALL_GAP },
  valid: { color: P.VALID }, error: { color: P.ERROR, fontSize: T.BODY_FONT }, notice: { color: P.VALID, fontSize: T.BODY_FONT },
  preferences: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: T.PAD, paddingVertical: T.GAP, gap: T.GAP },
  shellClearance: { height: T.DRAWER_BOTTOM_SPACE },
});
