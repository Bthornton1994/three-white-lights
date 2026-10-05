import { describe, expect, it } from 'vitest';
import { createGymViewState, gymViewReduce } from './ladderView';
import { decodeFacilitySave, encodeFacilitySave, persistableGymTruthFromGymView, restoreGymViewState } from './facilityPersistence';

describe('facility schema boundaries', () => {
  it('rejects an extra placement field instead of ignoring it', () => {
    const saved = JSON.parse(encodeFacilitySave(persistableGymTruthFromGymView(createGymViewState())));
    saved.truth.facility.furniture['flat-bench'].wallet = 999;
    expect(decodeFacilitySave(JSON.stringify(saved))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });
});


function currentEnvelope() { return JSON.parse(encodeFacilitySave(persistableGymTruthFromGymView(createGymViewState()))); }
function legacyEnvelope() {
  const save = currentEnvelope();
  save.schemaVersion = 1;
  delete save.truth.facility.layoutRevision;
  delete save.truth.facility.lastLayoutEdit;
  for (const cell of Object.values(save.truth.facility.furniture) as Record<string, unknown>[]) delete cell.rotation;
  return save;
}

describe('v1 to v2 floor migration', () => {
  it('migrates exact v1 positions once while preserving the entire durable gym', () => {
    const legacy = legacyEnvelope();
    const loaded = decodeFacilitySave(JSON.stringify(legacy));
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('legacy restore failed');
    expect(loaded.envelope.schemaVersion).toBe(2);
    expect(loaded.envelope.truth.facility.layoutRevision).toBe(0);
    expect(loaded.envelope.truth.facility.lastLayoutEdit).toBe(null);
    expect(loaded.envelope.truth.facility.furniture['flat-bench']).toEqual({ x: 3, y: 0, rotation: 0 });
    expect(loaded.envelope.truth.clock).toEqual(legacy.truth.clock);
    expect(loaded.envelope.truth.management).toEqual(legacy.truth.management);
    expect(loaded.envelope.truth.week).toEqual(legacy.truth.week);
    expect(loaded.envelope.truth.living).toEqual(legacy.truth.living);
    const currentBytes = encodeFacilitySave(loaded.envelope.truth);
    const reopened = decodeFacilitySave(currentBytes);
    expect(reopened).toEqual(loaded);
    if (reopened.kind !== 'loaded') throw new Error('current restore failed');
    expect(encodeFacilitySave(reopened.envelope.truth)).toBe(currentBytes);
  });

  it.each(['rotation', 'layoutRevision', 'wallet'])('rejects an extra %s field in a v1 placement', field => {
    const legacy = legacyEnvelope();
    legacy.truth.facility.furniture['flat-bench'][field] = 0;
    expect(decodeFacilitySave(JSON.stringify(legacy))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });

  it('rejects a v1 envelope pretending to contain new revision metadata', () => {
    const legacy = legacyEnvelope();
    legacy.truth.facility.layoutRevision = 0;
    expect(decodeFacilitySave(JSON.stringify(legacy))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });

  it.each([45, -90, 360, 1.5, '90'])('rejects unsupported current rotation %s', rotation => {
    const save = currentEnvelope();
    save.truth.facility.furniture['flat-bench'].rotation = rotation;
    expect(decodeFacilitySave(JSON.stringify(save))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '0'])('rejects noninteger current revision %s', layoutRevision => {
    const save = currentEnvelope();
    save.truth.facility.layoutRevision = layoutRevision;
    expect(decodeFacilitySave(JSON.stringify(save))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });

  it('requires orientation on every current placement', () => {
    const save = currentEnvelope();
    delete save.truth.facility.furniture['flat-bench'].rotation;
    expect(decodeFacilitySave(JSON.stringify(save))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });

  it('restores rotated layout and item-only undo through saved truth', () => {
    const edited = gymViewReduce(createGymViewState(), { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'flat-bench' }, placement: { x: 3, y: 0, rotation: 90 } });
    expect(edited.lastRefusal).toBe(null);
    const loaded = decodeFacilitySave(encodeFacilitySave(persistableGymTruthFromGymView(edited)));
    if (loaded.kind !== 'loaded') throw new Error('rotated restore failed');
    const reopened = restoreGymViewState(loaded.envelope.truth);
    expect(reopened.floor).toEqual(edited.floor);
    expect(reopened.floor.lastLayoutEdit).toEqual({ target: { kind: 'furniture', item: 'flat-bench' }, previous: { x: 3, y: 0, rotation: 0 }, current: { x: 3, y: 0, rotation: 90 }, appliedRevision: 1 });
    const undone = gymViewReduce(reopened, { kind: 'floor-undo', expectedLayoutRevision: 1 });
    expect(undone.lastRefusal).toBe(null);
    expect(undone.floor.furniture['flat-bench']).toEqual({ x: 3, y: 0, rotation: 0 });
    expect(undone.floor.layoutRevision).toBe(2);
    expect(undone.managed).toBe(reopened.managed);
  });

  it('rejects revision-incoherent receipts and forbidden whole-state undo data', () => {
    const edited = gymViewReduce(createGymViewState(), { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'flat-bench' }, placement: { x: 3, y: 0, rotation: 90 } });
    const encoded = encodeFacilitySave(persistableGymTruthFromGymView(edited));
    const badRevision = JSON.parse(encoded);
    badRevision.truth.facility.lastLayoutEdit.appliedRevision = 2;
    expect(decodeFacilitySave(JSON.stringify(badRevision))).toEqual({ kind: 'refused', reason: 'incoherent' });
    const snapshot = JSON.parse(encoded);
    snapshot.truth.facility.lastLayoutEdit.wallet = { gymBucks: 99_999 };
    expect(decodeFacilitySave(JSON.stringify(snapshot))).toEqual({ kind: 'refused', reason: 'incoherent' });
  });
});
