// Supervised operator action only. Retire this temporary endpoint after enrollment.
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const defaultKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const operatorKey = typeof defaultKey === 'string' && defaultKey.startsWith('sb_secret_') ? defaultKey : null;
Deno.serve(async request => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://supabase.com', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const operator = serviceKey && request.headers.get('authorization') === `Bearer ${serviceKey}` || operatorKey !== null && request.headers.get('apikey') === operatorKey;
  if (!operator || !url || !serviceKey) return new Response('{}', { status: 401, headers });
  if (request.method !== 'POST') return new Response('{}', { status: 405, headers });
  const input = await request.json().catch(() => null);
  if (!input || input.kind !== 'enroll' || Object.keys(input).sort().join(',') !== 'emailSha256,kind,userId' || typeof input.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId) || typeof input.emailSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.emailSha256)) return new Response('{}', { status: 400, headers });
  async function admin(method: string, body?: unknown) {
    const response = await fetch(`${url}/auth/v1/admin/users/${input.userId}`, { method, headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error('Enrollment service request failed.');
    return response.json();
  }
  try {
    const user = await admin('GET');
    if (typeof user.email !== 'string' || !user.email_confirmed_at || user.is_anonymous) return new Response('{}', { status: 409, headers });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.email.toLowerCase()));
    const emailHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (emailHash !== input.emailSha256) return new Response('{}', { status: 409, headers });
    const before = user.app_metadata ?? {};
    // Auth merges supplied metadata keys. Do not replay a stale shared-app snapshot.
    await admin('PUT', { app_metadata: { twl_access: 'closed-beta' } });
    const saved = await admin('GET');
    const preserved = Object.entries(before).every(([key, value]) => key === 'twl_access' || JSON.stringify(saved.app_metadata?.[key]) === JSON.stringify(value));
    const enrolled = saved.app_metadata?.twl_access === 'closed-beta' && preserved;
    return new Response(JSON.stringify({ enrolled, existingMetadataPreserved: preserved }), { status: enrolled ? 200 : 500, headers });
  } catch { return new Response(JSON.stringify({ enrolled: false, message: 'Enrollment could not be verified.' }), { status: 503, headers }); }
});
