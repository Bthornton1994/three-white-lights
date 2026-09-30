import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createProductionHandler, type AccountRead, type AccountCommit, type ProductionRepository } from '../../src/production/handler';
import { initialProductionState, productionOpening, utcServerDay, type ProductionState } from '../../src/production/server';
import { CAREER_FEDERATION_IDS } from '../../src/career/federation';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import { playedTraining, savedGame, openLocalMeet, playedMeet } from './productionFixtures';

const ALICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORIGIN = 'https://twl.test'; const HASH = 'a'.repeat(64);
let db: PGlite;
async function scalar<T>(sql: string, args: unknown[] = []): Promise<T> { const result = await db.query<{ value: T }>(sql, args); return result.rows[0]!.value; }
const repository: ProductionRepository = {
  read: (userId, requestId) => scalar<AccountRead>('select public.twl_read_account($1::uuid, $2::text) as value', [userId, requestId ?? null]),
  initialize: (userId, state) => scalar<AccountRead>('select public.twl_initialize_account($1::uuid, $2::jsonb) as value', [userId, JSON.stringify(state)]),
  commit: (userId, revision, requestId, hash, state, response) => scalar<AccountCommit>('select public.twl_commit_account($1::uuid, $2::bigint, $3::text, $4::text, $5::jsonb, $6::jsonb) as value', [userId, revision, requestId, hash, JSON.stringify(state), JSON.stringify(response)]),
};
const handler = createProductionHandler({ repository, allowedOrigins: [ORIGIN], authenticate: async token => token === 'alice' ? { id: ALICE, createdAtMs: Date.UTC(2026, 8, 30) } : token === 'bob' ? { id: BOB, createdAtMs: Date.UTC(2026, 8, 30) } : null });
function send(body: unknown, token = 'alice', origin = ORIGIN) { return handler(new Request('https://edge.test/twl-api', { method: 'POST', headers: { authorization: `Bearer ${token}`, origin }, body: JSON.stringify(body) })); }
async function seed(userId = ALICE, offsetMs = 0): Promise<AccountRead & { state: ProductionState }> { const read = await repository.read(userId); const seeded = await repository.initialize(userId, initialProductionState(read.nowMs - offsetMs)); if (!seeded.state) throw new Error('SQL fixture was not initialized.'); return { ...seeded, state: seeded.state }; }
async function profile(token = 'alice') { const opening = await (await send({ kind: 'bootstrap' }, token)).json(); const response = await send({ kind: 'create-profile', requestId: 'profile', expectedRevision: opening.opening.revision, payload: { draft: { name: token === 'alice' ? 'Alice Iron' : 'Bob Iron', sex: 'male', bodyweightKgText: '82.5' }, federationId: CAREER_FEDERATION_IDS[0] } }, token); expect(response.status).toBe(200); return response.json(); }

beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
  await db.exec(await readFile(new URL('../../supabase/migrations/20260930193634_twl_authoritative_accounts.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users(id) values ($1::uuid),($2::uuid)', [ALICE, BOB]);
  await db.exec('set role service_role');
});
beforeEach(async () => { await db.exec('reset role; truncate public.twl_accounts cascade; set role service_role;'); });
afterAll(async () => { await db?.close(); });

describe('actual PostgreSQL account and receipt transaction', () => {
  it('reads account revision and receipt through one joined SQL statement snapshot', async () => {
    // This verifies the actual deployed routine's construction. The environment
    // has no multi-connection Postgres server; that interleaving is not claimed.
    const definition = await scalar<{ language: string; source: string }>("select jsonb_build_object('language', language.lanname, 'source', routine.prosrc) as value from pg_proc routine join pg_language language on language.oid=routine.prolang where routine.oid='public.twl_read_account(uuid,text)'::regprocedure");
    expect(definition.language).toBe('sql');
    const statements = definition.source.replace(/--[^\n]*/g, '').trim().split(';').filter(statement => statement.trim());
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/left join public\.twl_accounts/i); expect(statements[0]).toMatch(/left join public\.twl_request_receipts/i);
    const account = await seed(); await repository.commit(ALICE, 0, 'snapshot', HASH, account.state, { kind: 'saved' });
    const read = await repository.read(ALICE, 'snapshot'); expect(read.revision).toBe(1); expect(read.receipt?.response).toEqual({ kind: 'saved' });
  });

  it('enables RLS and denies browser roles both table access and every authority RPC', async () => {
    const rows = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid in ('public.twl_accounts'::regclass, 'public.twl_request_receipts'::regclass)");
    expect(rows.rows).toHaveLength(2); expect(rows.rows.every(row => row.relrowsecurity)).toBe(true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      try {
        for (const table of ['twl_accounts', 'twl_request_receipts']) { await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/); await expect(db.query(`delete from public.${table}`)).rejects.toThrow(/permission denied/); }
        await expect(repository.read(ALICE)).rejects.toThrow(/permission denied/);
        await expect(repository.initialize(ALICE, initialProductionState(Date.UTC(2026, 8, 30)))).rejects.toThrow(/permission denied/);
        await expect(repository.commit(ALICE, 0, 'x', HASH, initialProductionState(Date.UTC(2026, 8, 30)), {})).rejects.toThrow(/permission denied/);
      } finally { await db.exec('reset role; set role service_role'); }
    }
  });

  it('persists account-specific progress and never replaces an existing account during initialization', async () => {
    await profile('alice'); await profile('bob'); const a = await repository.read(ALICE); const b = await repository.read(BOB);
    expect(a.state && savedGame(a.state).profile?.name).toBe('Alice Iron'); expect(b.state && savedGame(b.state).profile?.name).toBe('Bob Iron');
    await repository.initialize(ALICE, initialProductionState(a.nowMs));
    const again = await repository.read(ALICE); expect(again.state).toEqual(a.state); expect(again.revision).toBe(a.revision);
    const edit = await send({ kind: 'edit-profile-name', requestId: 'rename', expectedRevision: a.revision, payload: { name: 'Alice Steel' } }); expect(edit.status).toBe(200);
    const changed = await repository.read(ALICE); expect(changed.state && savedGame(changed.state).profile?.name).toBe('Alice Steel'); expect((await repository.read(BOB)).state).toEqual(b.state);
  });

  it('binds receipts to payload and account, and returns current state without applying a retry again', async () => {
    const a = await seed(ALICE); const b = await seed(BOB);
    expect((await repository.commit(ALICE, 0, 'same-id', HASH, a.state, { kind: 'first' })).kind).toBe('saved');
    expect((await repository.commit(ALICE, 1, 'later', HASH, a.state, { kind: 'later' })).kind).toBe('saved');
    const duplicate = await repository.commit(ALICE, 0, 'same-id', HASH, a.state, { kind: 'fake' });
    expect(duplicate.kind).toBe('duplicate'); expect(duplicate.revision).toBe(2); expect(duplicate.response).toEqual({ kind: 'first' });
    const altered = await repository.commit(ALICE, 2, 'same-id', 'b'.repeat(64), a.state, { kind: 'other' });
    expect(altered.kind).toBe('idempotency-conflict'); expect(altered.revision).toBe(2);
    expect((await repository.commit(BOB, 0, 'same-id', HASH, b.state, { kind: 'bob' })).kind).toBe('saved');
    expect((await repository.read(BOB)).revision).toBe(1);
  });

  it('accepts one rival revision and refuses the stale write without inserting its receipt', async () => {
    const account = await seed();
    // PGlite serializes its single connection. This exercises actual CAS behavior,
    // rather than claiming a multi-connection PostgreSQL lock stress test.
    const outcomes = await Promise.all([repository.commit(ALICE, 0, 'one', HASH, account.state, {}), repository.commit(ALICE, 0, 'two', HASH, account.state, {})]);
    expect(outcomes.map(row => row.kind).sort()).toEqual(['conflict', 'saved']);
    expect((await repository.read(ALICE)).revision).toBe(1);
    expect(await scalar<number>('select count(*)::integer as value from public.twl_request_receipts')).toBe(1);
  });

  it('rolls back the account update when inserting its receipt fails', async () => {
    const account = await seed(); const proposed = { ...account.state, presenceAtMs: account.nowMs };
    await expect(repository.commit(ALICE, 0, 'invalid-hash', 'bad', proposed, {})).rejects.toThrow();
    const read = await repository.read(ALICE); expect(read.revision).toBe(0); expect(read.state).toEqual(account.state);
    expect(await scalar<number>('select count(*)::integer as value from public.twl_request_receipts')).toBe(0);
  });

  it('refuses null, future, fractional and backward persisted clocks', async () => {
    const read = await repository.read(ALICE);
    await expect(scalar('select public.twl_initialize_account($1::uuid, null) as value', [ALICE])).rejects.toThrow();
    await expect(repository.initialize(ALICE, { ...initialProductionState(read.nowMs), presenceAtMs: read.nowMs + 60_000 })).rejects.toThrow(/clock/);
    await expect(repository.initialize(ALICE, { ...initialProductionState(read.nowMs), facilityAtMs: read.nowMs - 0.5 })).rejects.toThrow(/clock/);
    const account = await seed(); await expect(repository.commit(ALICE, 0, 'backward', HASH, { ...account.state, facilityAtMs: account.state.facilityAtMs - 1 }, {})).rejects.toThrow(/clock/);
    expect((await repository.read(ALICE)).revision).toBe(0);
  });
});

describe('authenticated HTTP through the real SQL RPCs', () => {
  it('requires authenticated identity and rejects a client supplied account ID', async () => {
    expect((await send({ kind: 'bootstrap' }, 'invalid')).status).toBe(401); expect((await repository.read(ALICE)).state).toBeNull();
    const forged = await send({ kind: 'facility-action', requestId: 'x', expectedRevision: 0, userId: BOB, payload: { action: { kind: 'check-in' } } });
    expect(forged.status).toBe(400); expect((await repository.read(BOB)).state).toBeNull();
  });

  it('plays native training, earns server-time Gym Bucks, spends that same purse and retries without double credit', async () => {
    await seed(ALICE, 21 * 60_000); const read = await repository.read(ALICE); if (!read.state) throw new Error('Missing fixture account.');
    const day = utcServerDay(read.nowMs); const played = playedTraining(savedGame(read.state).record, day);
    const body = { kind: 'record-training-session', requestId: 'played-training', expectedRevision: read.revision, payload: { day, proposal: played.proposal, context: played.context, evidence: played.evidence } };
    const recorded = await send(body); expect(recorded.status).toBe(200); const first = await recorded.json();
    const purse = first.opening.facility.managed.gym.ladder.gymBucks;
    expect(purse).toBeGreaterThanOrEqual(EMPIRE_TUNING.SESSION_EQUIPMENT_COST_GYM_BUCKS.mats);
    expect(first.opening.wire.wallet.gymBucks).toBe(Math.floor(purse)); expect(first.response.wire.wallet.gymBucks).toBe(Math.floor(purse));
    expect(first.response.wire.acknowledgedProposalId).toBe('played-training');
    // Native training has no cash payout: this credit is the elapsed idle gap.
    expect(productionOpening(read.state, read.revision, first.opening.serverNowMs).facility.managed.gym.ladder.gymBucks).toBe(purse);
    const bought = await send({ kind: 'facility-action', requestId: 'buy-mats', expectedRevision: first.opening.revision, payload: { action: { kind: 'buy-session', item: 'mats' } } });
    expect(bought.status).toBe(200); const purchased = await bought.json();
    expect(purchased.response.kind).toBe('saved'); expect(purchased.opening.facility.managed.gym.sessionEquipment).toContain('mats');
    expect(purchased.opening.facility.managed.gym.ladder.gymBucks).toBeCloseTo(purse - EMPIRE_TUNING.SESSION_EQUIPMENT_COST_GYM_BUCKS.mats, 6);
    expect(purchased.opening.wire.wallet.gymBucks).toBe(Math.floor(purchased.opening.facility.managed.gym.ladder.gymBucks));
    const retry = await send(body); expect(retry.status).toBe(200); const repeated = await retry.json();
    expect(repeated.opening.revision).toBe(purchased.opening.revision); expect(repeated.response.wire.acknowledgedProposalId).toBe('played-training');
    expect(repeated.response.wire.wallet).toEqual(purchased.opening.wire.wallet); expect(repeated.opening.facility.managed.gym.sessionEquipment).toContain('mats');
    const persisted = await repository.read(ALICE); if (!persisted.state) throw new Error('Missing persisted account.');
    expect(savedGame(persisted.state).record.wallet.gymBucks).toBe(Math.floor(purchased.opening.facility.managed.gym.ladder.gymBucks));
    expect(savedGame(persisted.state).record.totalKg).toBeNull();
  });

  it('persists all nine native meet attempts and a lost acknowledgement preserves the original ID', async () => {
    const p = await profile(); const read = await repository.read(ALICE); if (!read.state) throw new Error('Missing fixture profile.');
    const day = utcServerDay(read.nowMs); const context = openLocalMeet(read.state, day);
    const entered = await send({ kind: 'enter-career-meet', requestId: 'enter', expectedRevision: p.opening.revision, payload: { meetId: context.meet.id } }); expect(entered.status).toBe(200);
    const entry = await entered.json(); const played = playedMeet(context);
    const body = { kind: 'record-meet-result', requestId: `${context.meet.id}:meet-original`, expectedRevision: entry.opening.revision, payload: { day, meetId: context.meet.id, proposalId: 'meet-original', proposal: played.proposal, evidence: played.evidence } };
    const posted = await send(body); expect(posted.status).toBe(200); const first = await posted.json();
    const retry = await send(body); expect(retry.status).toBe(200); const repeated = await retry.json();
    expect(first.response.wire.acknowledgedProposalId).toBe('meet-original'); expect(repeated.response.wire.acknowledgedProposalId).toBe('meet-original');
    expect(repeated.opening.revision).toBe(first.opening.revision); expect(repeated.opening.wire.meets).toHaveLength(1); expect(repeated.response.result.totalKg).toBe(first.response.result.totalKg);
    const receipts = await scalar<{ response: { wire: { acknowledgedProposalId: string } } }>('select jsonb_build_object(\'response\', response) as value from public.twl_request_receipts where request_id=$1', [body.requestId]);
    expect(receipts.response.wire).toEqual({ acknowledgedProposalId: 'meet-original' });
  });

  it('returns current account revision for deliberate conflict retry and binds a reused ID to its exact payload', async () => {
    const p = await profile();
    const body = { kind: 'edit-profile-name', requestId: 'rename', expectedRevision: p.opening.revision, payload: { name: 'Alice Steel' } };
    expect((await send(body)).status).toBe(200);
    const stale = await send({ ...body, requestId: 'other', payload: { name: 'Alice Next' } }); expect(stale.status).toBe(409);
    const latest = await stale.json(); expect(latest.opening.profile.name).toBe('Alice Steel');
    expect((await send({ ...body, expectedRevision: latest.opening.revision, payload: { name: 'Forged Same ID' } })).status).toBe(409);
    expect((await send({ ...body, requestId: 'other', expectedRevision: latest.opening.revision, payload: { name: 'Alice Next' } })).status).toBe(200);
    expect((await (await send(body)).json()).opening.profile.name).toBe('Alice Next');
  });

  it('bounds untrusted request size and depth and refuses unsupported origins and methods', async () => {
    expect((await send({ kind: 'bootstrap' }, 'alice', 'https://unrelated.test')).status).toBe(403);
    expect((await handler(new Request('https://edge.test', { method: 'GET' }))).status).toBe(405);
    expect((await handler(new Request('https://edge.test', { method: 'OPTIONS', headers: { origin: ORIGIN } }))).status).toBe(204);
    const headers = { authorization: 'Bearer alice', origin: ORIGIN };
    expect((await handler(new Request('https://edge.test', { method: 'POST', headers, body: '{bad' }))).status).toBe(400);
    expect((await handler(new Request('https://edge.test', { method: 'POST', headers, body: ' '.repeat(1_048_577) }))).status).toBe(400);
    expect((await handler(new Request('https://edge.test', { method: 'POST', headers, body: '['.repeat(70) + '0' + ']'.repeat(70) }))).status).toBe(400);
    expect((await repository.read(ALICE)).state).toBeNull();
  });

  it('returns an unavailable failure instead of acknowledging an unsuccessful database write', async () => {
    const account = await seed(); const failing = createProductionHandler({ authenticate: async () => ({ id: ALICE, createdAtMs: account.nowMs }), allowedOrigins: [ORIGIN], repository: { ...repository, commit: async () => { throw new Error('simulated database connection loss'); } } });
    const response = await failing(new Request('https://edge.test', { method: 'POST', headers: { authorization: 'Bearer alice', origin: ORIGIN }, body: JSON.stringify({ kind: 'facility-action', requestId: 'failed', expectedRevision: 0, payload: { action: { kind: 'check-in' } } }) }));
    expect(response.status).toBe(503); expect((await response.json()).message).toMatch(/not acknowledged/);
    expect((await repository.read(ALICE)).revision).toBe(0); expect(await scalar<number>('select count(*)::integer as value from public.twl_request_receipts')).toBe(0);
  });
});
