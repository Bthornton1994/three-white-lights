import { authenticatedTwlAccount, createProductionHandler, PRODUCTION_LIMITS } from './domain.js';

type ProductionRepository = Parameters<typeof createProductionHandler>[0]['repository'];
type AccountRead = Awaited<ReturnType<ProductionRepository['read']>>;
type AccountCommit = Awaited<ReturnType<ProductionRepository['commit']>>;
const url = Deno.env.get('SUPABASE_URL');
function defaultKey(name: string): string | undefined {
  const raw = Deno.env.get(name); if (!raw) return undefined;
  const keys: unknown = JSON.parse(raw);
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Saved account key configuration is invalid.');
  const value = (keys as Record<string, unknown>).default;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
const publicKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !publicKey || !serviceKey) throw new Error('Saved account service configuration is missing.');
const apiUrl = url; const authKey = publicKey; const serverKey = serviceKey;
// The reviewed release has one pinned frontend origin. Operator configuration
// adds exact local/preview origins; no subdomain pattern or wildcard is accepted.
const hostedOrigin = 'https://three-white-lights-iron-amber.bthornton9415.chatgpt.site';
const origins = [hostedOrigin, ...(Deno.env.get('TWL_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean)];

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // Modern secret keys belong only in apikey; treating one as a JWT is rejected.
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: serverKey, ...(serverKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${serverKey}` }), 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(PRODUCTION_LIMITS.apiTimeoutMs) });
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
    // existence, identity and current TWL enrollment in this shared project.
    // Client-editable user_metadata and cached JWT claims cannot grant access.
    const response = await fetch(`${apiUrl}/auth/v1/user`, { headers: { apikey: authKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(PRODUCTION_LIMITS.authTimeoutMs) });
    if (response.status === PRODUCTION_LIMITS.unauthorizedStatus || response.status === PRODUCTION_LIMITS.forbiddenStatus) return null;
    if (!response.ok) throw new Error('Account authentication service is unavailable.');
    return authenticatedTwlAccount(await response.json());
  },
}));
