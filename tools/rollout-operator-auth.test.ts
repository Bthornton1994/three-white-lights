/// <reference path="../supabase/functions/deno.d.ts" />
import { afterEach, describe, expect, it, vi } from 'vitest';

const SERVER_KEY = 'legacy-server-key-for-test';
const OPERATOR_KEY = 'sb_secret_operator_for_test';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function verifier(secretKeys = JSON.stringify({ default: OPERATOR_KEY })) {
  let handler!: (request: Request) => Promise<Response>;
  const env: Record<string, string> = { SUPABASE_URL: 'https://project.invalid', SUPABASE_SERVICE_ROLE_KEY: SERVER_KEY, SUPABASE_ANON_KEY: 'public-test-key', SUPABASE_SECRET_KEYS: secretKeys };
  const network = vi.fn(() => { throw new Error('A rejected request must not reach the network.'); });
  vi.stubGlobal('Deno', { env: { get: (name: string) => env[name] }, serve: (value: typeof handler) => { handler = value; } });
  vi.stubGlobal('fetch', network);
  await import('../supabase/verification/live-rollout');
  return { network, send: (headers: Record<string, string>) => handler(new Request('https://edge.invalid/proof', { method: 'POST', headers, body: JSON.stringify({ kind: 'unknown' }) })) };
}

const rejectedCredentials: Record<string, string>[] = [
    {},
    { apikey: 'public-test-key' },
    { apikey: 'sb_publishable_browser' },
    { apikey: 'sb_secret_wrong' },
    { authorization: 'Bearer ordinary-user-token' },
    { authorization: `Bearer ${OPERATOR_KEY}` },
  ];
const operatorCredentials: Record<string, string>[] = [{ apikey: OPERATOR_KEY }, { authorization: `Bearer ${SERVER_KEY}` }];

describe('temporary operator verifier authority', () => {
  it.each(rejectedCredentials)('rejects non-operator credentials before any admin call (%j)', async headers => {
    const api = await verifier();
    expect((await api.send(headers)).status).toBe(401);
    expect(api.network).not.toHaveBeenCalled();
  });

  it.each(operatorCredentials)('accepts only exact server credentials and still validates the command (%j)', async headers => {
    const api = await verifier();
    expect((await api.send(headers)).status).toBe(409);
    expect(api.network).not.toHaveBeenCalled();
  });

  it('does not treat an absent default secret as an empty valid key', async () => {
    const api = await verifier('{}');
    expect((await api.send({ apikey: '' })).status).toBe(401);
    expect(api.network).not.toHaveBeenCalled();
  });
});
