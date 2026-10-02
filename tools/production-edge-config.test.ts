/// <reference path="../supabase/functions/deno.d.ts" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialProductionState } from '../src/production/server';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function wrapper(modern: boolean) {
  let handler!: (request: Request) => Promise<Response>;
  const env: Record<string, string> = { SUPABASE_URL: 'https://project.invalid', SUPABASE_ANON_KEY: 'legacy-public-test', SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-test', TWL_ALLOWED_ORIGINS: 'https://twl.test' };
  if (modern) { env.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({ default: 'sb_publishable_test' }); env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_test' }); }
  const network = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_at: '2026-09-30T00:00:00Z', is_anonymous: false, app_metadata: { twl_access: 'closed-beta' } });
    if (url.endsWith('/rest/v1/rpc/twl_read_account')) return Response.json({ state: initialProductionState(Date.UTC(2026, 8, 30)), revision: 0, nowMs: Date.UTC(2026, 8, 30) });
    throw new Error('Unexpected network path.');
  });
  vi.stubGlobal('Deno', { env: { get: (name: string) => env[name] }, serve: (value: typeof handler) => { handler = value; } });
  vi.stubGlobal('fetch', network);
  await import('../supabase/functions/twl-api/index');
  const result = await handler(new Request('https://edge.invalid/twl-api', { method: 'POST', headers: { Authorization: 'Bearer user-session-jwt', Origin: 'https://twl.test' }, body: JSON.stringify({ kind: 'bootstrap' }) }));
  return { result, network };
}

describe('deployed wrapper uses current keys without changing user identity', () => {
  it.each([true, false])('authenticates the user and keeps privileged credentials on RPCs (modern=%s)', async modern => {
    const api = await wrapper(modern); expect(api.result.status).toBe(200);
    expect(api.network).toHaveBeenCalledTimes(2);
    const auth = new Headers(api.network.mock.calls[0]![1].headers);
    expect(auth.get('apikey')).toBe(modern ? 'sb_publishable_test' : 'legacy-public-test');
    expect(auth.get('authorization')).toBe('Bearer user-session-jwt');
    const database = new Headers(api.network.mock.calls[1]![1].headers);
    expect(database.get('apikey')).toBe(modern ? 'sb_secret_test' : 'legacy-service-test');
    expect(database.get('authorization')).toBe(modern ? null : 'Bearer legacy-service-test');
    expect(JSON.parse(api.network.mock.calls[1]![1].body as string).p_user_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});
