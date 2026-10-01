import { describe, expect, it, vi } from 'vitest';
import { authenticatedTwlAccount } from './accountAccess';
import { createProductionHandler, type ProductionRepository } from './handler';
import { initialProductionState } from './server';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CREATED_AT = '2026-09-30T00:00:00.000Z';
const enrolled = { id: ID, created_at: CREATED_AT, is_anonymous: false, app_metadata: { twl_access: 'closed-beta' } };

function fixture(user: unknown) {
  let liveUser = user;
  const read = vi.fn(async () => ({ state: initialProductionState(Date.parse(CREATED_AT)), revision: 0, nowMs: Date.parse(CREATED_AT) }));
  const repository: ProductionRepository = { read, initialize: vi.fn(), commit: vi.fn() };
  const handler = createProductionHandler({ repository, allowedOrigins: [], authenticate: async () => authenticatedTwlAccount(liveUser) });
  return { read, setUser: (next: unknown) => { liveUser = next; }, send: () => handler(new Request('https://edge.test/twl-api', { method: 'POST', headers: { Authorization: 'Bearer unchanged-token' }, body: JSON.stringify({ kind: 'bootstrap' }) })) };
}

describe('shared-project TWL enrollment at the authenticated HTTP boundary', () => {
  it('opens the enrolled identity and rechecks enrollment before every database read', async () => {
    const api = fixture(enrolled);
    expect((await api.send()).status).toBe(200);
    expect(api.read).toHaveBeenCalledWith(ID, undefined);
    api.setUser({ ...enrolled, app_metadata: {} });
    const revoked = await api.send();
    expect(revoked.status).toBe(403);
    expect((await revoked.json()).message).toMatch(/beta invitation/);
    expect(api.read).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, {}, { twl_access: 'public' }, ['closed-beta']])('denies uninvited accounts even when user_metadata claims enrollment (%j)', async app_metadata => {
    const api = fixture({ ...enrolled, app_metadata, user_metadata: { twl_access: 'closed-beta', role: 'service_role' } });
    expect((await api.send()).status).toBe(403);
    expect(api.read).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...enrolled, id: 'another-user' },
    { ...enrolled, is_anonymous: true },
    { ...enrolled, created_at: 'invalid' },
    { ...enrolled, created_at: '1969-12-31T23:59:59.000Z' },
  ])('rejects malformed and anonymous identities before touching progress (%j)', async user => {
    const api = fixture(user);
    expect((await api.send()).status).toBe(401);
    expect(api.read).not.toHaveBeenCalled();
  });
});
