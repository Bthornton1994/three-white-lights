import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductionClient, type ProductionClient, type ProductionConfig } from '../../src/production/client';
import { initialProductionState, applyProductionMutation, productionOpening, utcServerDay } from '../../src/production/server';
import { PRODUCTION_LIMITS } from '../../src/production/productionTuning';
import { CAREER_FEDERATION_IDS } from '../../src/career/federation';
import { asProposalId } from '../../src/game/progression';
import { playedTraining, playedMeet, openLocalMeet, savedGame } from './productionFixtures';

const NOW = Date.now(); const DAY = utcServerDay(NOW); const URL = 'https://project.test';
const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const BOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function stateFor(name: string) { return applyProductionMutation(initialProductionState(NOW), { kind: 'create-profile', requestId: 'profile', expectedRevision: 0, payload: { draft: { name, sex: 'male', bodyweightKgText: '82.5' }, federationId: CAREER_FEDERATION_IDS[0] } }, NOW, name).state; }
const aliceState = stateFor('Alice Iron'); const bobState = stateFor('Bob Iron');
interface Call { path: string; token: string; body: Record<string, unknown>; headers: Headers }
function reply(value: unknown, status: number = PRODUCTION_LIMITS.okStatus) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function auth(user = 'alice') { return { access_token: `${user}-token`, refresh_token: `${user}-refresh`, expires_at: Math.floor((Date.now() + PRODUCTION_LIMITS.millisecondsPerDay) / PRODUCTION_LIMITS.millisecondsPerSecond), user: { id: user === 'alice' ? ALICE : BOB, email: `${user}@twl.test` } }; }
function mockBackend(override?: (call: Call) => Response | Promise<Response> | undefined) {
  const calls: Call[] = [];
  const request: typeof fetch = async (input, init) => {
    const path = String(input); const headers = new Headers(init?.headers); const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    const call = { path, headers, token: headers.get('authorization') ?? '', body }; calls.push(call);
    const intercepted = override?.(call); if (intercepted) return intercepted;
    if (path.includes('token?grant_type=password')) return reply(auth(String(body.email).startsWith('bob') ? 'bob' : 'alice'));
    if (path.includes('token?grant_type=refresh_token')) return reply(auth(String(body.refresh_token).startsWith('bob') ? 'bob' : 'alice'));
    if (path.endsWith('/auth/v1/user')) return reply({ id: call.token.includes('bob') ? BOB : ALICE, email: call.token.includes('bob') ? 'bob@twl.test' : 'alice@twl.test' });
    if (path.includes('logout')) return new Response(null, { status: PRODUCTION_LIMITS.noContentStatus });
    return reply({ opening: productionOpening(call.token.includes('bob') ? bobState : aliceState, 1, NOW), response: { kind: 'opened' } });
  };
  return { calls, request };
}
async function clientFor(request: typeof fetch, storage: ProductionConfig['storage'] = null): Promise<ProductionClient> { const client = await createProductionClient({ url: URL, publishableKey: 'sb_publishable_fixture', fetch: request, storage }); if (!client) throw new Error('Fixture client is unavailable.'); return client; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
afterEach(() => { vi.restoreAllMocks(); });

describe('GoTrue client and account save lifecycle', () => {
  it('requires configuration and refuses public server secrets before making any request', async () => {
    const mock = mockBackend(); expect(await createProductionClient({ url: '', publishableKey: '', fetch: mock.request })).toBeNull();
    await expect(createProductionClient({ url: URL, publishableKey: 'sb_secret_fixture', fetch: mock.request })).rejects.toThrow(/server secret/);
    await expect(createProductionClient({ url: URL, publishableKey: `header.${btoa(JSON.stringify({ role: 'service_role' }))}.sig`, fetch: mock.request })).rejects.toThrow(/public key/);
    await expect(createProductionClient({ url: 'http://unrelated.test', publishableKey: 'sb_publishable_fixture', fetch: mock.request })).rejects.toThrow(/HTTPS/);
    expect(mock.calls).toHaveLength(0);
  });

  it('uses the public apikey and user bearer token, accepts 204 logout and clears protected opening state', async () => {
    const mock = mockBackend(); const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password');
    expect(client.user?.id).toBe(ALICE); expect(client.port.openingProfile()?.name).toBe('Alice Iron');
    const bootstrap = mock.calls.find(call => call.body.kind === 'bootstrap')!;
    expect(bootstrap.headers.get('apikey')).toBe('sb_publishable_fixture'); expect(bootstrap.token).toBe('Bearer alice-token');
    expect(Object.isFrozen(client.port.openingSnapshot())).toBe(true); expect(Object.isFrozen(client.port.openingSnapshot().bestE1rmKg)).toBe(true);
    await client.signOut(); expect(client.user).toBeNull(); expect(() => client.port.openingSnapshot()).toThrow(/not loaded/);
  });

  it('verifies restored identity through Auth and leaves sign-in usable after corrupt or expired browser storage', async () => {
    const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    values.set('twl.auth.project.test', JSON.stringify({ ...auth(), user: { id: BOB, email: 'spoofed@twl.test' } }));
    const mock = mockBackend(); const restored = await clientFor(mock.request, storage); expect(restored.user?.id).toBe(ALICE); expect(restored.user?.email).toBe('alice@twl.test');
    expect(mock.calls.some(call => call.path.endsWith('/auth/v1/user'))).toBe(true);
    values.set('twl.auth.project.test', '{corrupt'); const retryable = await clientFor(mock.request, storage); expect(retryable.user).toBeNull();
    await retryable.signIn('bob@twl.test', 'fixture-password'); expect(retryable.user?.id).toBe(BOB);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    const privateClient = await clientFor(mock.request, blocked); await privateClient.signIn('alice@twl.test', 'fixture-password'); expect(privateClient.user?.id).toBe(ALICE);
  });

  it('keeps Meet and Career transport failures throwable for deliberate retry and retains exact immutable lift evidence', async () => {
    const mock = mockBackend(call => typeof call.body.kind === 'string' && call.body.kind !== 'bootstrap' ? reply({ message: 'Save service unavailable' }, 503) : undefined);
    const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password');
    const played = playedTraining(savedGame(aliceState).record, DAY); const first = played.evidence[0]!;
    const event = { ...first.evidence.events[0]! }; const moment = { workSetsCompleted: 0, repsCompletedInSet: 0 }; const config = { ...first.evidence.config, moment };
    const context = { checkIn: { sleep: 'ok' as 'ok' | 'poor', soreness: 'normal' as const, motivation: 'steady' as const }, targetRpe: 8 };
    client.port.setTrainingEvidenceContext(context); client.port.setTrainingLiftEvidence(0, 0, { config, events: [event], resolvedTick: first.evidence.resolvedTick });
    const capturedRatio = config.loadRatio; const capturedTick = event.tick; config.loadRatio = 0; moment.workSetsCompleted = 99; event.tick = 99; context.checkIn.sleep = 'poor'; context.targetRpe = 10;
    const response = await client.port.recordTrainingSession(DAY, played.proposal, asProposalId('same-training')); expect(response.kind).toBe('refused');
    await client.port.recordTrainingSession(DAY, played.proposal, asProposalId('same-training'));
    const saves = mock.calls.filter(call => call.body.kind === 'record-training-session'); expect(saves).toHaveLength(2); expect(saves[0]!.body).toEqual(saves[1]!.body);
    const payload = saves[0]!.body.payload as { context: typeof context; evidence: typeof played.evidence };
    expect(payload.context.targetRpe).toBe(8); expect(payload.context.checkIn.sleep).toBe('ok'); expect(payload.evidence[0]!.evidence.config.loadRatio).toBe(capturedRatio); expect(payload.evidence[0]!.evidence.config.moment?.workSetsCompleted).toBe(0); expect(payload.evidence[0]!.evidence.events[0]!.tick).toBe(capturedTick);
    const meetContext = openLocalMeet(aliceState, DAY); const meet = playedMeet(meetContext); const attempt = meet.evidence[0]!;
    client.port.setMeetLiftEvidence(attempt.lift, attempt.ordinal, attempt.evidence);
    await expect(client.port.recordMeetResult(DAY, meetContext.meet, meet.proposal, asProposalId('meet-original'))).rejects.toThrow(/unavailable/);
    await expect(client.port.recordMeetResult(DAY, meetContext.meet, meet.proposal, asProposalId('meet-original'))).rejects.toThrow(/unavailable/);
    const meetSaves = mock.calls.filter(call => call.body.kind === 'record-meet-result'); expect(meetSaves[0]!.body).toEqual(meetSaves[1]!.body); expect(meetSaves[0]!.body.requestId).toBe(`${meetContext.meet.id}:meet-original`);
    await expect(client.port.chooseFederation({ kind: 'choose-federation', report: { federationId: CAREER_FEDERATION_IDS[0]! } }, asProposalId('federation-original'))).rejects.toThrow(/unavailable/);
  });

  it('cannot revive a signed-out session during the token-acquisition microtask', async () => {
    const mock = mockBackend(); const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password');
    const count = mock.calls.filter(call => call.body.kind === 'bootstrap').length;
    const old = client.refresh().catch(error => error); await client.signOut();
    expect((await old).message).toMatch(/superseded/); expect(client.user).toBeNull(); expect(mock.calls.filter(call => call.body.kind === 'bootstrap')).toHaveLength(count);
  });

  it('discards late opening responses from the previous account after a new sign-in', async () => {
    const arrived = deferred<void>(); const oldReply = deferred<Response>(); let blocked = false;
    const mock = mockBackend(call => blocked && call.body.kind === 'bootstrap' && call.token.includes('alice') ? (arrived.resolve(), oldReply.promise) : undefined);
    const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password'); blocked = true;
    const old = client.refresh().catch(error => error); await arrived.promise;
    await client.signOut(); await client.signIn('bob@twl.test', 'fixture-password');
    oldReply.resolve(reply({ opening: productionOpening(aliceState, 99, NOW), response: { kind: 'opened' } }));
    expect((await old).message).toMatch(/superseded/); expect(client.user?.id).toBe(BOB); expect(client.port.openingProfile()?.name).toBe('Bob Iron');
  });

  it('does not let an old token refresh block or erase the new account', async () => {
    const arrived = deferred<void>(); const oldReply = deferred<Response>(); let blockRefresh = false;
    const mock = mockBackend(call => blockRefresh && call.path.includes('grant_type=refresh_token') && call.body.refresh_token === 'alice-refresh' ? (arrived.resolve(), oldReply.promise) : undefined);
    const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password'); blockRefresh = true;
    vi.spyOn(Date, 'now').mockReturnValue(NOW + PRODUCTION_LIMITS.millisecondsPerDay);
    const old = client.refresh().catch(error => error); await arrived.promise;
    await client.signIn('bob@twl.test', 'fixture-password'); expect(client.user?.id).toBe(BOB);
    oldReply.resolve(reply(auth('alice'))); expect((await old).message).toMatch(/superseded/);
    expect(client.user?.id).toBe(BOB); expect(client.port.openingProfile()?.name).toBe('Bob Iron');
  });

  it('updates conflict revision for deliberate retry and refuses older successful openings', async () => {
    let phase = 'initial'; const mock = mockBackend(call => {
      if (call.body.kind === 'facility-action') return reply({ opening: productionOpening(aliceState, 2, NOW), message: 'Account changed elsewhere' }, 409);
      if (call.body.kind === 'bootstrap' && phase === 'old') return reply({ opening: productionOpening(aliceState, 1, NOW), response: { kind: 'opened' } });
      return undefined;
    });
    const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password');
    expect((await client.port.facilityAction({ kind: 'check-in' }, 'check-in')).kind).toBe('refused');
    await client.port.facilityAction({ kind: 'check-in' }, 'check-in');
    const saves = mock.calls.filter(call => call.body.kind === 'facility-action'); expect(saves[0]!.body.expectedRevision).toBe(1); expect(saves[1]!.body.expectedRevision).toBe(2);
    phase = 'old'; await expect(client.refresh()).rejects.toThrow(/Newer account progress/);
  });

  it('refuses a late same-revision bootstrap across UTC three AM and keeps newer acknowledgements from rolling the day back', async () => {
    const before = Date.UTC(2026, 8, 30, 2, 59, 59); const after = before + 2_000;
    const state = initialProductionState(before); let phase = 'after'; let monotonic = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
    const mock = mockBackend(call => call.body.kind === 'bootstrap' ? reply({ opening: productionOpening(state, phase === 'ack' ? 8 : 7, phase === 'after' ? after : before), response: { kind: 'opened' } }) : undefined);
    const client = await clientFor(mock.request); await client.signIn('alice@twl.test', 'fixture-password');
    const currentDay = client.port.currentServerDay(); phase = 'late'; monotonic = 1_000;
    await expect(client.refresh()).rejects.toThrow(/Newer account time/);
    expect(client.port.currentServerDay()).toBe(currentDay); expect(client.serverDay).toBe(currentDay);
    phase = 'ack'; monotonic = 2_000; await client.refresh();
    expect(client.port.currentServerDay()).toBe(currentDay); expect(client.serverDay).toBe(currentDay);
  });
});
