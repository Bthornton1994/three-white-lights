import type { LocalAppServerPort } from '../session/localSessionServer';
import { briefFatigueFor } from '../game/sessionClient';
import type { MeetDefinition } from '../game/meetTuning';
import type { ProductionEnvelope, ProductionOpening, FacilityPort } from './contracts';
import { PRODUCTION_LIMITS } from './productionTuning';
import { utcAccountDay } from './clock';
import { sealServerValue } from '../game/progression';
import type { LiftEvidence, LiftEvidencePort, TrainingEvidenceContext, TrainingLiftEvidence, MeetLiftEvidence } from './liftEvidence';
export type { FacilityAction, FacilityResponse, FacilityPort } from './contracts';

export interface ProductionUser { readonly id: string; readonly email?: string }
export interface ProductionClient {
  readonly port: LocalAppServerPort & FacilityPort & LiftEvidencePort;
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
type AuthReply = Partial<AuthSession> & { expires_in?: number; msg?: string; error_description?: string; message?: string; id?: string; email?: string; is_anonymous?: boolean };

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The account service could not be reached. Retry when connected.';
}

function evidenceCopy(evidence: LiftEvidence): LiftEvidence {
  const config = evidence.config;
  return Object.freeze({ config: Object.freeze({ kind: config.kind, seed: config.seed, loadRatio: config.loadRatio, ...(config.feel ? { feel: config.feel } : {}), ...(config.moment ? { moment: Object.freeze({ workSetsCompleted: config.moment.workSetsCompleted, repsCompletedInSet: config.moment.repsCompletedInSet }) } : {}) }), events: Object.freeze(evidence.events.map(event => Object.freeze({ tick: event.tick, kind: event.kind }))), resolvedTick: evidence.resolvedTick });
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
  if (publishableKey.split('.').length === PRODUCTION_LIMITS.jwtSegments) {
    try {
      const claims = JSON.parse(atob(publishableKey.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/'))) as { role?: string };
      if (claims.role !== 'anon') throw new Error('Invalid public key role');
    } catch { throw new Error('Account service public key configuration is invalid.'); }
  }
  const base = url.replace(/\/$/, '');
  const request = config?.fetch ?? fetch;
  let storage: ProductionConfig['storage'] = config?.storage;
  if (storage === undefined) { try { storage = typeof localStorage === 'undefined' ? null : localStorage; } catch { storage = null; } }
  const storageKey = `twl.auth.${parsedUrl.hostname}`;
  let session: AuthSession | null = null;
  let opening: ProductionOpening | null = null;
  let openingReceivedAt = performance.now();
  let authEpoch = 0;
  let trainingContext: TrainingEvidenceContext | null = null;
  const trainingEvidence = new Map<string, TrainingLiftEvidence>();
  const meetEvidence = new Map<string, MeetLiftEvidence>();
  let refreshInFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const persistSession = () => { try { if (session) storage?.setItem(storageKey, JSON.stringify(session)); else storage?.removeItem(storageKey); } catch { /* A blocked browser store does not replace server persistence. */ } };
  const clearSession = () => { authEpoch += 1; session = null; opening = null; trainingContext = null; trainingEvidence.clear(); meetEvidence.clear(); refreshInFlight = null; persistSession(); notify(); };
  const saveSession = (reply: AuthReply) => {
    if (!reply.access_token || !reply.refresh_token || !reply.user?.id) throw new Error('The account service returned an incomplete session.');
    session = {
      access_token: reply.access_token,
      refresh_token: reply.refresh_token,
      expires_at: reply.expires_at ?? Math.floor(Date.now() / PRODUCTION_LIMITS.millisecondsPerSecond) + (reply.expires_in ?? 0),
      user: { id: reply.user.id, ...(reply.user.email ? { email: reply.user.email } : {}) },
    };
    persistSession();
  };
  const authRequest = async (path: string, body?: unknown, token?: string): Promise<AuthReply> => {
    const response = await request(`${base}/auth/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(PRODUCTION_LIMITS.authTimeoutMs),
    });
    const reply = response.status === PRODUCTION_LIMITS.noContentStatus ? {} : await response.json() as AuthReply;
    if (!response.ok) throw new Error(reply.error_description ?? reply.msg ?? reply.message ?? `Account request failed (${response.status}).`);
    return reply;
  };
  const ensureToken = async (): Promise<string> => {
    const tokenEpoch = authEpoch;
    if (!session) throw new Error('Sign in to save account progress.');
    if (session.expires_at * PRODUCTION_LIMITS.millisecondsPerSecond <= Date.now() + PRODUCTION_LIMITS.refreshBeforeExpiryMs) {
      if (!refreshInFlight) {
        const refreshToken = session.refresh_token;
        const epoch = authEpoch;
        const refreshTask: Promise<void> = authRequest('token?grant_type=refresh_token', { refresh_token: refreshToken })
          .then(reply => { if (epoch !== authEpoch) throw new Error('This account request was superseded.'); saveSession(reply); }).catch(error => { if (epoch === authEpoch) clearSession(); throw error; }).finally(() => { if (refreshInFlight === refreshTask) refreshInFlight = null; });
        refreshInFlight = refreshTask;
      }
      await refreshInFlight;
    }
    if (tokenEpoch !== authEpoch) throw new Error('This account request was superseded.');
    if (!session) throw new Error('Your session has expired. Sign in again.');
    return session.access_token;
  };
  const invoke = async <T>(command: Record<string, unknown>): Promise<T> => {
    const epoch = authEpoch;
    const token = await ensureToken();
    if (epoch !== authEpoch) throw new Error('This account request was superseded.');
    const response = await request(`${base}/functions/v1/twl-api`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(PRODUCTION_LIMITS.apiTimeoutMs),
    });
    const reply = await response.json() as ProductionEnvelope<T> & { message?: string };
    if (epoch !== authEpoch) throw new Error('This account request was superseded.');
    if (reply.opening?.wire && Number.isSafeInteger(reply.opening.revision) && Number.isSafeInteger(reply.opening.serverDay) && Number.isSafeInteger(reply.opening.serverNowMs)) {
      if (opening && reply.opening.revision < opening.revision) throw new Error('Newer account progress has already loaded.');
      const receivedAt = performance.now();
      const previousNowMs = opening ? Math.floor(opening.serverNowMs + Math.max(0, receivedAt - openingReceivedAt)) : reply.opening.serverNowMs;
      if (opening && reply.opening.revision === opening.revision && (reply.opening.serverNowMs < opening.serverNowMs || reply.opening.serverDay < utcAccountDay(previousNowMs))) throw new Error('Newer account time has already loaded.');
      opening = sealServerValue(reply.opening);
      // Preserve the monotonic UTC estimate when an accepted acknowledgement
      // was generated before its network response arrived.
      openingReceivedAt = receivedAt - Math.max(0, previousNowMs - reply.opening.serverNowMs);
    }
    if (!response.ok) {
      if (response.status === PRODUCTION_LIMITS.unauthorizedStatus) clearSession();
      throw new Error(reply.message ?? `Progress could not be saved (${response.status}).`);
    }
    if (!reply.opening?.wire || !Number.isSafeInteger(reply.opening.revision) || !Number.isSafeInteger(reply.opening.serverDay) || !Number.isSafeInteger(reply.opening.serverNowMs)) {
      throw new Error('The account service returned an invalid progression response.');
    }
    opening = sealServerValue(reply.opening);
    return sealServerValue(reply.response);
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
    get serverDay() { return opening ? utcAccountDay(Math.floor(opening.serverNowMs + Math.max(0, performance.now() - openingReceivedAt))) : null; },
    port: {
      openingSnapshot: () => requireOpening().wire,
      openingProfile: () => requireOpening().profile,
      openingFacility: () => requireOpening().facility,
      sessionBrief: (day) => ({ fatigue: briefFatigueFor(requireOpening().fatigue, day) }),
      meetBrief: (day) => ({ fatigue: briefFatigueFor(requireOpening().fatigue, day) }),
      currentServerDay: () => utcAccountDay(Math.floor(requireOpening().serverNowMs + Math.max(0, performance.now() - openingReceivedAt))),
      setTrainingEvidenceContext: context => { trainingContext = Object.freeze({ targetRpe: context.targetRpe, checkIn: Object.freeze({ sleep: context.checkIn.sleep, soreness: context.checkIn.soreness, motivation: context.checkIn.motivation }) }); },
      setTrainingLiftEvidence: (setIndex, repIndex, evidence) => { trainingEvidence.set(`${setIndex}:${repIndex}`, { setIndex, repIndex, evidence: evidenceCopy(evidence) }); },
      resetTrainingEvidence: () => { trainingContext = null; trainingEvidence.clear(); },
      setMeetLiftEvidence: (lift, ordinal, evidence) => { meetEvidence.set(`${lift}:${ordinal}`, { lift, ordinal, evidence: evidenceCopy(evidence) }); },
      resetMeetEvidence: () => { meetEvidence.clear(); },
      async recordTrainingSession(day, proposal, proposalId) {
        try { return await mutate('record-training-session', { day, proposal, context: trainingContext, evidence: [...trainingEvidence.values()].sort((a, b) => a.setIndex - b.setIndex || a.repIndex - b.repIndex) }, proposalId); }
        catch (error) { return { kind: 'refused', message: message(error) }; }
      },
      async recordMeetResult(day, meet, proposal, proposalId) {
        return mutate('record-meet-result', { day, meetId: meet.id, proposalId, proposal, evidence: [...meetEvidence.values()] }, `${meet.id}:${proposalId}`);
      },
      async chooseFederation(proposal, proposalId) {
        return mutate('choose-federation', { proposal }, proposalId);
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
      clearSession(); const epoch = authEpoch;
      const reply = await authRequest('token?grant_type=password', { email, password });
      if (epoch !== authEpoch) throw new Error('This sign-in was superseded.');
      saveSession(reply);
      try { await client.refresh(); } catch (error) { if (epoch === authEpoch) clearSession(); throw error; }
    },
    async signUp(email, password) {
      clearSession(); const epoch = authEpoch;
      const reply = await authRequest('signup', { email, password });
      if (epoch !== authEpoch) throw new Error('This sign-up was superseded.');
      if (!reply.access_token) return { confirmationRequired: true };
      saveSession(reply);
      try { await client.refresh(); } catch (error) { if (epoch === authEpoch) clearSession(); throw error; }
      return { confirmationRequired: false };
    },
    async signOut() {
      const token = session?.access_token; clearSession();
      if (token) await authRequest('logout?scope=local', {}, token);
    },
    async refresh() { if (session) await invoke({ kind: 'bootstrap' }); notify(); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async enterCareerMeet(meet) { await mutate('enter-career-meet', { meetId: meet.id }, generatedId()); },
  };
  let saved: string | null = null; try { saved = storage?.getItem(storageKey) ?? null; } catch { /* Session storage may be disabled. */ }
  if (saved) {
    try {
      const value = JSON.parse(saved) as AuthSession;
      if (typeof value.access_token !== 'string' || !value.access_token || typeof value.refresh_token !== 'string' || !value.refresh_token || typeof value.user?.id !== 'string' || !value.user.id || !Number.isSafeInteger(value.expires_at) || value.expires_at < 0) throw new Error('Invalid session');
      session = value;
      const user = await authRequest('user', undefined, await ensureToken());
      if (typeof user.id !== 'string' || !user.id || user.is_anonymous === true || !session) throw new Error('Your saved session is invalid. Sign in again.');
      session = { ...session, user: { id: user.id, ...(typeof user.email === 'string' ? { email: user.email } : {}) } }; persistSession();
      await client.refresh();
    } catch { clearSession(); }
  }
  return client;
}
