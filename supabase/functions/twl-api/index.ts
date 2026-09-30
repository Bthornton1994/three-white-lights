import { createProductionHandler, PRODUCTION_LIMITS } from './domain.js';

type ProductionRepository = Parameters<typeof createProductionHandler>[0]['repository'];
type AccountRead = Awaited<ReturnType<ProductionRepository['read']>>;
type AccountCommit = Awaited<ReturnType<ProductionRepository['commit']>>;
const url = Deno.env.get('SUPABASE_URL');
const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !publicKey || !serviceKey) throw new Error('Saved account service configuration is missing.');
const apiUrl = url; const authKey = publicKey; const serverKey = serviceKey;
const origins = (Deno.env.get('TWL_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(PRODUCTION_LIMITS.apiTimeoutMs) });
  if (!response.ok) throw new Error('Saved account database request failed.');
  return await response.json() as T;
}
const repository: ProductionRepository = {
  read: (userId, requestId) => rpc<AccountRead>('twl_read_account', { p_user_id: userId, p_request_id: requestId ?? null }),
  initialize: (userId, state) => rpc<AccountRead>('twl_initialize_account', { p_user_id: userId, p_state: state }),
  commit: (userId, expectedRevision, requestId, payloadHash, state, response) => rpc<AccountCommit>('twl_commit_account', { p_user_id: userId, p_expected_revision: expectedRevision, p_request_id: requestId, p_payload_hash: payloadHash, p_state: state, p_response: response }),
};
Deno.serve(createProductionHandler({
  allowedOrigins: origins,
  repository,
  authenticate: async token => {
    // The gateway verifies JWTs too. This live Auth lookup establishes account
    // existence and identity; client metadata is never used for authorization.
    const response = await fetch(`${apiUrl}/auth/v1/user`, { headers: { apikey: authKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(PRODUCTION_LIMITS.authTimeoutMs) });
    if (response.status === PRODUCTION_LIMITS.unauthorizedStatus || response.status === PRODUCTION_LIMITS.forbiddenStatus) return null;
    if (!response.ok) throw new Error('Account authentication service is unavailable.');
    const user = await response.json() as { id?: unknown; created_at?: unknown; is_anonymous?: unknown };
    if (typeof user.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || user.is_anonymous === true || typeof user.created_at !== 'string') return null;
    const createdAtMs = Date.parse(user.created_at);
    if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0) return null;
    return { id: user.id, createdAtMs };
  },
}));
