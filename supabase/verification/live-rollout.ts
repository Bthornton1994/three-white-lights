// Deploy only for a supervised rollout, then replace with the retired handler.
// This endpoint accepts the existing server key only; ordinary users cannot run it.
import { CAREER_FEDERATION_IDS, playedTraining, playedMeet, savedGame, openLocalMeet } from './fixtures.js';

const url = Deno.env.get('SUPABASE_URL')!;
const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const operatorKey = typeof secretKeys.default === 'string' && secretKeys.default.startsWith('sb_secret_') ? secretKeys.default : null;
const ORIGIN = 'http://localhost:5173';
type Json = Record<string, any>;
type Result = { status: number; body: Json; headers: Headers };
type TestUser = { id: string; email: string; password: string; token: string; refresh: string };
let running = false;

Deno.serve(async request => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://supabase.com', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const operator = adminKey && request.headers.get('authorization') === `Bearer ${adminKey}` || operatorKey !== null && request.headers.get('apikey') === operatorKey;
  if (!url || !adminKey || !publicKey || !operator) return new Response(JSON.stringify({ message: 'Operator authentication required.' }), { status: 401, headers });
  if (request.method !== 'POST' || request.headers.get('content-length') && Number(request.headers.get('content-length')) > 200) return new Response('{}', { status: 400, headers });
  const input = await request.json().catch(() => null);
  if (!input || input.kind !== 'rollout-proof' || Object.keys(input).length !== 1 || running) return new Response('{}', { status: 409, headers });
  running = true;
  const runId = crypto.randomUUID(); const emailPrefix = `twl-rollout-${runId}-`;
  const users: TestUser[] = []; const checks: string[] = [];
  let failed: string | null = null; let cleanupOk = false; let removed = 0;
  const deadline = Date.now() + 85_000;
  function requireTest(ok: unknown, name: string): asserts ok { if (!ok) throw new Error(name); checks.push(name); }
  async function http(path: string, key: string, token: string, body?: unknown, extra: Record<string, string> = {}, method = 'POST', cleanup = false): Promise<Result> {
    if (!cleanup && Date.now() >= deadline) throw new Error('proof-deadline');
    const response = await fetch(`${url}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(cleanup ? 10_000 : 8_000) });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, body: json, headers: response.headers };
  }
  async function admin(path: string, body?: unknown, method = 'POST', cleanup = false) { return http(`/auth/v1/admin/${path}`, adminKey, adminKey, body, {}, method, cleanup); }
  async function rpc(name: string, body: unknown) { const value = await http(`/rest/v1/rpc/${name}`, adminKey, adminKey, body); if (value.status !== 200) throw new Error('operator-rpc-failed'); return value.body; }
  async function account(user: TestUser) { return rpc('twl_read_account', { p_user_id: user.id, p_request_id: null }); }
  async function api(user: TestUser | null, body: unknown, origin = ORIGIN) { return http('/functions/v1/twl-api', publicKey, user?.token ?? publicKey, body, { Origin: origin }); }
  async function create(label: string, invited: boolean) {
    const email = `${emailPrefix}${label}@example.invalid`; const password = `${crypto.randomUUID()}Aa!9`;
    const created = await admin('users', { email, password, email_confirm: true, app_metadata: invited ? { twl_access: 'closed-beta' } : {}, user_metadata: { twl_rollout_run: runId, twl_access: 'closed-beta' } });
    if (created.status !== 200 && created.status !== 201 || typeof created.body.id !== 'string') throw new Error('test-account-create');
    const user: TestUser = { id: created.body.id, email, password, token: '', refresh: '' }; users.push(user);
    const signed = await http('/auth/v1/token?grant_type=password', publicKey, publicKey, { email, password });
    if (signed.status !== 200 || typeof signed.body.access_token !== 'string') throw new Error('test-account-sign-in');
    user.token = signed.body.access_token; user.refresh = signed.body.refresh_token; return user;
  }
  try {
    const a = await create('alice', true); const b = await create('bob', true); const c = await create('uninvited', false);
    const anonymous = await api(null, { kind: 'bootstrap' }); requireTest(anonymous.status === 401, 'anonymous-denied');
    const uninvited = await api(c, { kind: 'bootstrap' }); requireTest(uninvited.status === 403 && /beta invitation/.test(uninvited.body.message), 'user-metadata-cannot-invite');
    requireTest((await account(c)).state === null, 'uninvited-has-no-twl-row');
    const first = await api(a, { kind: 'bootstrap' }); requireTest(first.status === 200 && first.body.opening?.revision === 0, 'real-auth-bootstrap');
    requireTest(first.headers.get('Access-Control-Allow-Origin') === ORIGIN && first.headers.get('Cache-Control') === 'private, no-store', 'allowed-origin-and-private-cache');
    const forbidden = await api(a, { kind: 'bootstrap' }, 'https://unapproved.example.invalid'); requireTest(forbidden.status === 403 && forbidden.body.message === 'This application origin is not allowed.' && !forbidden.headers.has('Access-Control-Allow-Origin'), 'unapproved-origin-denied');
    const preflight = await http('/functions/v1/twl-api', publicKey, publicKey, undefined, { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' }, 'OPTIONS'); requireTest(preflight.status === 204 && preflight.headers.get('Access-Control-Allow-Origin') === ORIGIN, 'browser-preflight');
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']) {
      // Browser preflight sends no access token or API key.
      const response = await fetch(`${url}/functions/v1/twl-api`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' }, signal: AbortSignal.timeout(8_000) });
      requireTest(response.status === 204 && response.headers.get('Access-Control-Allow-Origin') === origin, `unauthenticated-preflight-${origin.includes('127.0.0.1') ? 'ip' : 'localhost'}-${origin.split(':').at(-1)}`);
    }
    for (const [label, token] of [['anon', publicKey], ['authenticated', a.token]] as const) {
      for (const table of ['twl_accounts', 'twl_request_receipts']) {
        const denied = await http(`/rest/v1/${table}?select=*`, publicKey, token, undefined, {}, 'GET');
        requireTest(denied.body.code === '42501' && /permission denied/.test(denied.body.message), `${label}-${table}-sql-denied`);
      }
      for (const [name, args] of [
        ['twl_read_account', { p_user_id: b.id, p_request_id: null }],
        ['twl_initialize_account', { p_user_id: b.id, p_state: {} }],
        ['twl_commit_account', { p_user_id: b.id, p_expected_revision: 0, p_request_id: 'forged', p_payload_hash: 'a'.repeat(64), p_state: {}, p_response: {} }],
      ] as const) {
        const denied = await http(`/rest/v1/rpc/${name}`, publicKey, token, args);
        requireTest(denied.body.code === '42501' && /permission denied/.test(denied.body.message), `${label}-${name}-sql-denied`);
      }
    }
    let revision = first.body.opening.revision;
    const profile = { kind: 'create-profile', requestId: 'profile', expectedRevision: revision, payload: { draft: { name: 'Rollout Alice', sex: 'female', bodyweightKgText: '67.5' }, federationId: CAREER_FEDERATION_IDS[0] } };
    const created = await api(a, profile); requireTest(created.status === 200 && created.body.opening.profile.name === 'Rollout Alice', 'create-and-save-profile'); revision = created.body.opening.revision;
    const duplicate = await api(a, profile); requireTest(duplicate.status === 200 && duplicate.body.opening.revision === revision, 'retry-does-not-save-twice');
    const collision = await api(a, { ...profile, expectedRevision: revision, payload: { ...profile.payload, draft: { ...profile.payload.draft, name: 'Forged Alice' } } }); requireTest(collision.status === 409, 'changed-payload-receipt-denied');
    const stale = await api(a, { kind: 'edit-profile-name', requestId: 'stale', expectedRevision: revision - 1, payload: { name: 'Stale Alice' } }); requireTest(stale.status === 409, 'stale-revision-denied');
    const userId = await api(a, { kind: 'bootstrap', userId: b.id }); requireTest(userId.status === 400, 'caller-account-selector-denied');
    const clock = await api(a, { kind: 'facility-action', requestId: 'clock', expectedRevision: revision, payload: { action: { kind: 'advance-clock', gapSeconds: 999999 } } }); requireTest(clock.status === 400, 'client-clock-denied');
    const stateA = await account(a); const day = created.body.opening.serverDay;
    const played = playedTraining(savedGame(stateA.state).record, day);
    const trainingBody = { kind: 'record-training-session', requestId: 'live-training', expectedRevision: revision, payload: { day, proposal: played.proposal, context: played.context, evidence: played.evidence } };
    const training = await api(a, trainingBody); requireTest(training.status === 200 && training.body.response.wire.acknowledgedProposalId === 'live-training', 'native-training-replay-and-ack'); revision = training.body.opening.revision;
    const trainingAgain = await api(a, trainingBody); requireTest(trainingAgain.status === 200 && trainingAgain.body.opening.revision === revision && trainingAgain.body.response.wire.acknowledgedProposalId === 'live-training', 'training-retry-single-award');
    const refreshed = await http('/auth/v1/token?grant_type=refresh_token', publicKey, publicKey, { refresh_token: a.refresh }); requireTest(refreshed.status === 200 && typeof refreshed.body.access_token === 'string', 'real-token-refresh'); a.token = refreshed.body.access_token;
    const newSession = await http('/auth/v1/token?grant_type=password', publicKey, publicKey, { email: a.email, password: a.password }); requireTest(newSession.status === 200 && typeof newSession.body.access_token === 'string', 'real-second-password-sign-in'); a.token = newSession.body.access_token;
    const reopened = await api(a, { kind: 'bootstrap' }); requireTest(reopened.status === 200 && reopened.body.opening.revision === revision && savedGame((await account(a)).state).record.fatigue.sessions.length === 1, 'training-persists-after-new-session');
    const concurrent = await Promise.all(['One', 'Two'].map(name => api(a, { kind: 'edit-profile-name', requestId: `parallel-${name}`, expectedRevision: revision, payload: { name: `Rollout Alice ${name}` } })));
    requireTest(concurrent.map(result => result.status).sort().join(',') === '200,409', 'live-concurrent-cas-single-winner');
    requireTest((await account(a)).revision === revision + 1, 'concurrent-single-revision');
    const aBeforeBob = JSON.stringify((await account(a)).state);
    const openB = await api(b, { kind: 'bootstrap' }); requireTest(openB.status === 200 && openB.body.opening.profile === null && openB.body.opening.revision === 0, 'second-account-starts-separate');
    const profileB = await api(b, { ...profile, payload: { ...profile.payload, draft: { name: 'Rollout Bob', sex: 'male', bodyweightKgText: '82.5' } } }); requireTest(profileB.status === 200, 'second-account-profile');
    const readB = await account(b); const meetContext = openLocalMeet(readB.state, profileB.body.opening.serverDay); const meet = playedMeet(meetContext); requireTest(meet.evidence.length === 9, 'nine-native-attempts');
    const entered = await api(b, { kind: 'enter-career-meet', requestId: 'enter', expectedRevision: profileB.body.opening.revision, payload: { meetId: meetContext.meet.id } }); requireTest(entered.status === 200, 'live-career-meet-entry');
    const meetBody = { kind: 'record-meet-result', requestId: `${meetContext.meet.id}:live-meet`, expectedRevision: entered.body.opening.revision, payload: { day: entered.body.opening.serverDay, meetId: meetContext.meet.id, proposalId: 'live-meet', proposal: meet.proposal, evidence: meet.evidence } };
    const recorded = await api(b, meetBody); requireTest(recorded.status === 200 && recorded.body.response.kind === 'recorded' && recorded.body.response.wire.acknowledgedProposalId === 'live-meet' && recorded.body.response.result.totalKg > 0, 'native-nine-attempt-meet-replay');
    const recordedAgain = await api(b, meetBody); requireTest(recordedAgain.status === 200 && recordedAgain.body.opening.revision === recorded.body.opening.revision, 'meet-retry-single-award');
    const bAgain = await api(b, { kind: 'bootstrap' }); requireTest(bAgain.status === 200 && savedGame((await account(b)).state).record.meets.length === 1, 'meet-persists-after-bootstrap');
    requireTest(JSON.stringify((await account(a)).state) === aBeforeBob, 'second-account-cannot-change-first');
    const revoke = await admin(`users/${a.id}`, { app_metadata: { twl_access: null } }, 'PUT'); requireTest(revoke.status === 200, 'server-enrollment-revoked');
    const revoked = await api(a, { kind: 'bootstrap' }); requireTest(revoked.status === 403 && /beta invitation/.test(revoked.body.message), 'existing-jwt-cannot-bypass-revocation');
  } catch (error) {
    // Report only our controlled check label; never reflect server errors or credentials.
    failed = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : 'proof-request-failed';
  } finally {
    // Always attempt every acknowledged account, even if discovery or one delete fails.
    const ids = new Set<string>(users.map(user => user.id)); let discoveryOk = false;
    try {
      const listed = await admin('users?page=1&per_page=1000', undefined, 'GET', true);
      discoveryOk = listed.status === 200 && Array.isArray(listed.body.users) && listed.body.users.length < 1000;
      if (discoveryOk) for (const user of listed.body.users) if (typeof user.id === 'string' && typeof user.email === 'string' && user.email.startsWith(emailPrefix) && user.user_metadata?.twl_rollout_run === runId) ids.add(user.id);
    } catch { /* Known accounts still get cleanup below. */ }
    const deletions = await Promise.allSettled([...ids].map(async id => {
      const deleted = await admin(`users/${id}`, undefined, 'DELETE', true);
      if (deleted.status !== 200 && deleted.status !== 404) throw new Error('cleanup-delete'); removed++;
    }));
    try {
      const check = await admin('users?page=1&per_page=1000', undefined, 'GET', true);
      cleanupOk = discoveryOk && deletions.every(result => result.status === 'fulfilled') && check.status === 200 && Array.isArray(check.body.users) && check.body.users.length < 1000 && !check.body.users.some((user: Json) => user.email?.startsWith(emailPrefix));
    } catch { cleanupOk = false; }
    if (!cleanupOk) failed ??= 'cleanup-incomplete';
    running = false;
  }
  return new Response(JSON.stringify({ runId, passed: failed === null && cleanupOk, checks, failed, cleanup: { verified: cleanupOk, usersRemoved: removed }, twlApiGatewayJwtVerification: true, origin: ORIGIN }), { status: failed === null && cleanupOk ? 200 : 500, headers });
});
