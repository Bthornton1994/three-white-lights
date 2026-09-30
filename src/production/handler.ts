import type { ProductionOpening } from './contracts';
import { EvidenceRefusal, canonicalJson } from './evidenceReplay';
import { PRODUCTION_LIMITS } from './productionTuning';
import { applyProductionMutation, initialProductionState, productionOpening, readProductionMutation, ProductionRefusal, type ProductionState } from './server';

export interface AuthenticatedAccount { readonly id: string; readonly createdAtMs: number }
export interface AccountReceipt { readonly payloadHash: string; readonly response: unknown }
export interface AccountRead { readonly state: ProductionState | null; readonly revision: number; readonly nowMs: number; readonly receipt?: AccountReceipt | null }
export interface AccountCommit extends AccountRead { readonly kind: 'saved' | 'duplicate' | 'conflict' | 'idempotency-conflict'; readonly response?: unknown }
export interface ProductionRepository {
  read(userId: string, requestId?: string): Promise<AccountRead>;
  initialize(userId: string, state: ProductionState): Promise<AccountRead>;
  commit(userId: string, expectedRevision: number, requestId: string, payloadHash: string, state: ProductionState, response: unknown): Promise<AccountCommit>;
}
export interface HandlerDependencies {
  readonly authenticate: (token: string) => Promise<AuthenticatedAccount | null>;
  readonly repository: ProductionRepository;
  readonly allowedOrigins: readonly string[];
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function refuse(message: string, status: number = PRODUCTION_LIMITS.invalidRequestStatus): never { throw new ProductionRefusal(message, status); }

/** Expected revision is transport concurrency state, not part of proposal identity. */
export async function commandPayloadHash(kind: string, payload: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson({ kind, payload }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(PRODUCTION_LIMITS.hexRadix).padStart(PRODUCTION_LIMITS.hexByteLength, '0')).join('');
}
function checkDepth(value: unknown, depth: number): void {
  if (depth > PRODUCTION_LIMITS.maximumJsonDepth) refuse('Progress request is nested too deeply.');
  if (Array.isArray(value)) { for (const child of value) checkDepth(child, depth + 1); }
  else if (object(value)) { for (const child of Object.values(value)) checkDepth(child, depth + 1); }
}
async function readBody(request: Request): Promise<unknown> {
  const statedLength = request.headers.get('content-length');
  if (statedLength && (!/^\d+$/.test(statedLength) || Number(statedLength) > PRODUCTION_LIMITS.maxRequestBytes)) refuse('Progress request is too large.');
  if (!request.body) refuse('A progress request is required.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > PRODUCTION_LIMITS.maxRequestBytes) { await reader.cancel(); refuse('Progress request is too large.'); } chunks.push(next.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { refuse('Progress request is not valid JSON.'); }
  checkDepth(value, 0); return value;
}
/** Receipts store acknowledgement identity, rather than a growing historic snapshot. */
function receiptResponse(value: unknown): unknown {
  if (!object(value) || !object(value.wire)) return value;
  const { wire, ...rest } = value;
  return { ...rest, wire: { appliedProposalId: typeof wire.appliedProposalId === 'string' ? wire.appliedProposalId : null } };
}
function responseFromReceipt(value: unknown, state: ProductionState, opening: ProductionOpening): unknown {
  if (!object(value)) return value;
  if (object(value.wire)) {
    const ack = typeof value.wire.appliedProposalId === 'string' ? value.wire.appliedProposalId : null;
    return { ...value, wire: productionOpening(state, opening.revision, opening.serverNowMs, ack).wire };
  }
  if ('profile' in value) return { ...value, profile: opening.profile };
  if ('state' in value) return { ...value, state: opening.facility };
  return value;
}
function requireAccount(read: AccountRead): ProductionState {
  if (!read.state || !Number.isSafeInteger(read.revision) || read.revision < 0 || !Number.isSafeInteger(read.nowMs) || read.nowMs < 0) refuse('Saved account data is unavailable.', PRODUCTION_LIMITS.unavailableStatus);
  return read.state;
}

export function createProductionHandler(dependencies: HandlerDependencies): (request: Request) => Promise<Response> {
  return async request => {
    const origin = request.headers.get('origin'); const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
    if (origin && !dependencies.allowedOrigins.includes(origin)) return new Response(JSON.stringify({ message: 'This application origin is not allowed.' }), { status: PRODUCTION_LIMITS.forbiddenStatus, headers });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS'); headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type'); headers.set('Access-Control-Max-Age', String(PRODUCTION_LIMITS.preflightMaxAgeSeconds));
    if (request.method === 'OPTIONS') return new Response(null, { status: PRODUCTION_LIMITS.noContentStatus, headers });
    const json = (status: number, value: unknown): Response => new Response(JSON.stringify(value), { status, headers });
    if (request.method !== 'POST') return json(PRODUCTION_LIMITS.methodNotAllowedStatus, { message: 'Use POST for saved account requests.' });
    let opening: ProductionOpening | undefined;
    try {
      const authorization = request.headers.get('authorization'); const match = authorization?.match(/^Bearer (\S+)$/);
      if (!match) refuse('Sign in to use a saved account.', PRODUCTION_LIMITS.unauthorizedStatus);
      const user = await dependencies.authenticate(match[1]);
      if (!user || !user.id || !Number.isSafeInteger(user.createdAtMs) || user.createdAtMs < 0) refuse('Sign in again to use this saved account.', PRODUCTION_LIMITS.unauthorizedStatus);
      const body = await readBody(request);
      const bootstrap = object(body) && body.kind === 'bootstrap' && Object.keys(body).length === 1;
      const command = bootstrap ? null : readProductionMutation(body);
      const payloadHash = command ? await commandPayloadHash(command.kind, command.payload) : null;
      let read = await dependencies.repository.read(user.id, command?.requestId);
      if (read.state === null) read = await dependencies.repository.initialize(user.id, initialProductionState(read.nowMs, user.createdAtMs));
      const state = requireAccount(read); opening = productionOpening(state, read.revision, read.nowMs);
      if (!command || !payloadHash) return json(PRODUCTION_LIMITS.okStatus, { opening, response: { kind: 'opened' } });
      if (read.receipt) {
        if (read.receipt.payloadHash !== payloadHash) return json(PRODUCTION_LIMITS.conflictStatus, { opening, message: 'This request ID was already used for different progress.' });
        return json(PRODUCTION_LIMITS.okStatus, { opening, response: responseFromReceipt(read.receipt.response, state, opening) });
      }
      if (command.expectedRevision !== read.revision) return json(PRODUCTION_LIMITS.conflictStatus, { opening, message: 'This account changed elsewhere. Review the latest saved state and retry.' });
      const applied = applyProductionMutation(state, command, read.nowMs, `${user.id}:${command.requestId}`);
      const saved = await dependencies.repository.commit(user.id, command.expectedRevision, command.requestId, payloadHash, applied.state, receiptResponse(applied.response));
      const savedState = requireAccount(saved); opening = productionOpening(savedState, saved.revision, saved.nowMs);
      if (saved.kind === 'conflict' || saved.kind === 'idempotency-conflict') return json(PRODUCTION_LIMITS.conflictStatus, { opening, message: saved.kind === 'conflict' ? 'This account changed elsewhere. Review the latest saved state and retry.' : 'This request ID was already used for different progress.' });
      const response = saved.kind === 'duplicate' ? responseFromReceipt(saved.response, savedState, opening) : applied.response;
      return json(PRODUCTION_LIMITS.okStatus, { opening, response });
    } catch (error) {
      const status = error instanceof ProductionRefusal ? error.status : error instanceof EvidenceRefusal ? PRODUCTION_LIMITS.invalidRequestStatus : PRODUCTION_LIMITS.unavailableStatus;
      const message = error instanceof ProductionRefusal || error instanceof EvidenceRefusal ? error.message : 'Saved account service is unavailable. Your progress was not acknowledged; retry the same request.';
      return json(status, { ...(opening ? { opening } : {}), message });
    }
  };
}
