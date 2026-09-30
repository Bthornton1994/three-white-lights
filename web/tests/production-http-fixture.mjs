/** Local browser integration fixture. Auth identities are explicit mocks;
 * account persistence, SQL/RLS/RPCs, handler, replay and native math are real.
 * This never connects to Supabase or listens beyond loopback. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createProductionHandler, PRODUCTION_LIMITS } from '../../supabase/functions/twl-api/domain.js';

const port = Number(process.argv[2]);
const browserPort = Number(process.argv[3]);
if (!Number.isSafeInteger(port) || port <= 0 || !Number.isSafeInteger(browserPort) || browserPort <= 0) throw new Error('Provide fixture and browser loopback ports.');
const apiOrigin = `http://127.0.0.1:${port}`;
const allowedOrigins = [`http://127.0.0.1:${browserPort}`, `http://localhost:${browserPort}`];
const users = {
  alice: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'alice@twl.test' },
  bob: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'bob@twl.test' },
};
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
await db.exec(await readFile(new URL('../../supabase/migrations/20260930193634_twl_authoritative_accounts.sql', import.meta.url), 'utf8'));
await db.query('insert into auth.users(id) values ($1::uuid),($2::uuid)', [users.alice.id, users.bob.id]);
await db.exec('set role service_role');
const scalar = async (sql, values) => (await db.query(sql, values)).rows[0].value;
const repository = {
  read: (id, requestId) => scalar('select public.twl_read_account($1::uuid,$2::text) as value', [id, requestId ?? null]),
  initialize: (id, state) => scalar('select public.twl_initialize_account($1::uuid,$2::jsonb) as value', [id, JSON.stringify(state)]),
  commit: (id, revision, requestId, hash, state, response) => scalar('select public.twl_commit_account($1::uuid,$2::bigint,$3::text,$4::text,$5::jsonb,$6::jsonb) as value', [id, revision, requestId, hash, JSON.stringify(state), JSON.stringify(response)]),
};
const userFor = authorization => authorization === 'Bearer fixture-alice' ? users.alice : authorization === 'Bearer fixture-bob' ? users.bob : null;
const createdAtMs = Date.now();
const handler = createProductionHandler({ repository, allowedOrigins, authenticate: async token => { const user = userFor(`Bearer ${token}`); return user ? { id: user.id, createdAtMs } : null; } });
const cors = origin => allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' } : {};
const json = (value, status = PRODUCTION_LIMITS.okStatus, origin = '') => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) } });
const session = key => ({ access_token: `fixture-${key}`, refresh_token: `fixture-${key}-refresh`, expires_at: Math.floor((Date.now() + PRODUCTION_LIMITS.millisecondsPerDay) / PRODUCTION_LIMITS.millisecondsPerSecond), user: users[key] });

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', apiOrigin); const origin = String(incoming.headers.origin ?? '');
    if (origin && !allowedOrigins.includes(origin)) { outgoing.writeHead(PRODUCTION_LIMITS.forbiddenStatus); outgoing.end(); return; }
    const chunks = []; let length = 0;
    for await (const chunk of incoming) { length += chunk.length; if (length > PRODUCTION_LIMITS.maxRequestBytes) { outgoing.writeHead(PRODUCTION_LIMITS.invalidRequestStatus, cors(origin)); outgoing.end(); return; } chunks.push(chunk); }
    const bytes = Buffer.concat(chunks); const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    let response;
    if (incoming.method === 'OPTIONS') response = new Response(null, { status: PRODUCTION_LIMITS.noContentStatus, headers: cors(origin) });
    else if (url.pathname === '/auth/v1/token' && incoming.method === 'POST') {
      const body = JSON.parse(bytes.toString('utf8')); const key = String(body.email ?? body.refresh_token).startsWith('bob') || String(body.refresh_token).startsWith('fixture-bob') ? 'bob' : 'alice'; response = json(session(key), PRODUCTION_LIMITS.okStatus, origin);
    } else if (url.pathname === '/auth/v1/user') { const user = userFor(headers.get('authorization')); response = json(user ?? { message: 'Fixture sign-in required' }, user ? PRODUCTION_LIMITS.okStatus : PRODUCTION_LIMITS.unauthorizedStatus, origin); }
    else if (url.pathname === '/auth/v1/logout') response = new Response(null, { status: PRODUCTION_LIMITS.noContentStatus, headers: cors(origin) });
    else if (url.pathname === '/__fixture/state') {
      const user = userFor(headers.get('authorization')); response = user ? json(await repository.read(user.id), PRODUCTION_LIMITS.okStatus, origin) : json({ message: 'Fixture sign-in required' }, PRODUCTION_LIMITS.unauthorizedStatus, origin);
    } else if (url.pathname === '/functions/v1/twl-api') {
      response = await handler(new Request(url, { method: incoming.method, headers, ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: Uint8Array.from(bytes).buffer }) }));
    } else response = json({ message: 'Unknown local fixture route' }, PRODUCTION_LIMITS.invalidRequestStatus, origin);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(PRODUCTION_LIMITS.unavailableStatus); outgoing.end(JSON.stringify({ message: 'Local fixture request failed' })); }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
console.log(JSON.stringify({ kind: 'ready', apiOrigin, allowedOrigins, auth: 'mock GoTrue fixture identities', database: 'real PostgreSQL WASM, committed migration and service-role RPCs' }));
const close = async () => { server.close(); await db.close(); process.exit(0); };
process.on('SIGTERM', close); process.on('SIGINT', close);
