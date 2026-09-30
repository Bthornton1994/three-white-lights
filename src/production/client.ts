import type { LocalAppServerPort } from '../session/localSessionServer';
import { briefFatigueFor } from '../game/sessionClient';
import type { MeetDefinition } from '../game/meetTuning';
import type { ProductionEnvelope, ProductionOpening, FacilityPort } from './contracts';
export type { FacilityAction, FacilityResponse, FacilityPort } from './contracts';

export interface ProductionUser { readonly id: string; readonly email?: string }
export interface ProductionClient {
  readonly port: LocalAppServerPort & FacilityPort;
  readonly user: ProductionUser | null;
  readonly serverDay: number | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  subscribe(listener: () => void): () => void;
  enterCareerMeet(meet: MeetDefinition): Promise<void>;
}

export interface ProductionConfig {
  readonly url: string;
  readonly publishableKey: string;
  readonly fetch?: typeof fetch;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}
interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: ProductionUser;
}
type AuthReply = Partial<AuthSession> & { expires_in?: number; msg?: string; error_description?: string; message?: string };

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The account service could not be reached. Retry when connected.';
}

/** Missing configuration exposes account unavailability; it never creates a local account. */
export async function createProductionClient(config?: ProductionConfig): Promise<ProductionClient | null> {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = config?.url ?? env?.VITE_SUPABASE_URL;
  const publishableKey = config?.publishableKey ?? env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
    throw new Error('Account service configuration requires HTTPS.');
  }
  if (publishableKey.startsWith('sb_secret_')) throw new Error('A server secret cannot be used in the browser.');
  const base = url.replace(/\/$/, '');
  const request = config?.fetch ?? fetch;
  const storage = config?.storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : config.storage;
  const storageKey = `twl.auth.${parsedUrl.hostname}`;
  let session: AuthSession | null = null;
  let opening: ProductionOpening | null = null;
  let refreshInFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const clearSession = () => { session = null; opening = null; storage?.removeItem(storageKey); notify(); };
  const saveSession = (reply: AuthReply) => {
    if (!reply.access_token || !reply.refresh_token || !reply.user?.id) throw new Error('The account service returned an incomplete session.');
    session = {
      access_token: reply.access_token,
      refresh_token: reply.refresh_token,
      expires_at: reply.expires_at ?? Math.floor(Date.now() / 1000) + (reply.expires_in ?? 0),
      user: { id: reply.user.id, ...(reply.user.email ? { email: reply.user.email } : {}) },
    };
    storage?.setItem(storageKey, JSON.stringify(session));
  };
  const authRequest = async (path: string, body?: unknown, token?: string): Promise<AuthReply> => {
    const response = await request(`${base}/auth/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    const reply = await response.json() as AuthReply;
    if (!response.ok) throw new Error(reply.error_description ?? reply.msg ?? reply.message ?? `Account request failed (${response.status}).`);
    return reply;
  };
  const ensureToken = async (): Promise<string> => {
    if (!session) throw new Error('Sign in to save account progress.');
    if (session.expires_at * 1000 <= Date.now() + 60_000) {
      if (!refreshInFlight) {
        const refreshToken = session.refresh_token;
        refreshInFlight = authRequest('token?grant_type=refresh_token', { refresh_token: refreshToken })
          .then(saveSession).catch(error => { clearSession(); throw error; }).finally(() => { refreshInFlight = null; });
      }
      await refreshInFlight;
    }
    if (!session) throw new Error('Your session has expired. Sign in again.');
    return session.access_token;
  };
  const invoke = async <T>(command: Record<string, unknown>): Promise<T> => {
    const token = await ensureToken();
    const response = await request(`${base}/functions/v1/twl-api`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(20_000),
    });
    const reply = await response.json() as ProductionEnvelope<T> & { message?: string };
    if (!response.ok) {
      if (response.status === 401) clearSession();
      throw new Error(reply.message ?? `Progress could not be saved (${response.status}).`);
    }
    if (!reply.opening?.wire || !Number.isSafeInteger(reply.opening.revision) || !Number.isSafeInteger(reply.opening.serverDay)) {
      throw new Error('The account service returned an invalid progression response.');
    }
    opening = reply.opening;
    return reply.response;
  };
  const requireOpening = () => {
    if (!session || !opening) throw new Error('Account progress has not loaded. Sign in and retry.');
    return opening;
  };
  const mutate = async <T>(kind: string, payload: Record<string, unknown>, requestId: string): Promise<T> => {
    const revision = requireOpening().revision;
    return invoke<T>({ kind, payload, requestId, expectedRevision: revision });
  };
  const generatedId = () => crypto.randomUUID();
  const client: ProductionClient = {
    get user() { return session?.user ?? null; },
    get serverDay() { return opening?.serverDay ?? null; },
    port: {
      openingSnapshot: () => requireOpening().wire,
      openingProfile: () => requireOpening().profile,
      openingFacility: () => requireOpening().facility,
      sessionBrief: (day) => ({ fatigue: briefFatigueFor(requireOpening().fatigue, day) }),
      meetBrief: (day) => ({ fatigue: briefFatigueFor(requireOpening().fatigue, day) }),
      async recordTrainingSession(day, proposal, proposalId) {
        try { return await mutate('record-training-session', { day, proposal }, proposalId); }
        catch (error) { return { kind: 'refused', message: message(error) }; }
      },
      async recordMeetResult(day, meet, proposal, proposalId) {
        try { return await mutate('record-meet-result', { day, meetId: meet.id, proposal }, `${meet.id}:${proposalId}`); }
        catch (error) { return { kind: 'refused', error: { code: 'BAD_DAY', message: message(error) } }; }
      },
      async chooseFederation(proposal, proposalId) {
        try { return await mutate('choose-federation', { proposal }, proposalId); }
        catch (error) { return { kind: 'refused', error: { code: 'UNKNOWN_FEDERATION', message: message(error) } }; }
      },
      async createProfile(draft, federationId) {
        try { const reply = await mutate<Awaited<ReturnType<LocalAppServerPort['createProfile']>>>('create-profile', { draft, federationId }, generatedId()); notify(); return reply; }
        catch (error) { return { kind: 'refused', code: 'PROFILE_CORRUPT', detail: message(error) }; }
      },
      async editProfileName(name) {
        try { const reply = await mutate<Awaited<ReturnType<LocalAppServerPort['editProfileName']>>>('edit-profile-name', { name }, generatedId()); notify(); return reply; }
        catch (error) { return { kind: 'refused', code: 'PROFILE_CORRUPT', detail: message(error) }; }
      },
      async editProfileBodyweight(bodyweightKgText) {
        try { const reply = await mutate<Awaited<ReturnType<LocalAppServerPort['editProfileBodyweight']>>>('edit-profile-bodyweight', { bodyweightKgText }, generatedId()); notify(); return reply; }
        catch (error) { return { kind: 'refused', code: 'PROFILE_CORRUPT', detail: message(error) }; }
      },
      async facilityAction(action, requestId) {
        try { return await mutate('facility-action', { action }, requestId); }
        catch (error) { return { kind: 'refused', message: message(error), ...(opening ? { state: opening.facility } : {}) }; }
      },
    },
    async signIn(email, password) {
      saveSession(await authRequest('token?grant_type=password', { email, password }));
      try { await client.refresh(); } catch (error) { clearSession(); throw error; }
    },
    async signUp(email, password) {
      const reply = await authRequest('signup', { email, password });
      if (!reply.access_token) return { confirmationRequired: true };
      saveSession(reply);
      try { await client.refresh(); } catch (error) { clearSession(); throw error; }
      return { confirmationRequired: false };
    },
    async signOut() {
      try { if (session) await authRequest('logout?scope=local', {}, await ensureToken()); }
      finally { clearSession(); }
    },
    async refresh() { if (session) await invoke({ kind: 'bootstrap' }); notify(); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async enterCareerMeet(meet) { await mutate('enter-career-meet', { meetId: meet.id }, generatedId()); },
  };
  const saved = storage?.getItem(storageKey);
  if (saved) {
    try {
      const value = JSON.parse(saved) as AuthSession;
      if (!value.access_token || !value.refresh_token || !value.user?.id || !Number.isFinite(value.expires_at)) throw new Error('Invalid session');
      session = value;
      await client.refresh();
    } catch (error) { clearSession(); throw new Error(message(error)); }
  }
  return client;
}
