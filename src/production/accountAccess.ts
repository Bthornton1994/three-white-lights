import type { AuthenticatedAccount } from './handler';
import { PRODUCTION_LIMITS } from './productionTuning';
import { ProductionRefusal } from './server';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Read only a fresh Auth /user response. Enrollment belongs to server-controlled app_metadata. */
export function authenticatedTwlAccount(value: unknown): AuthenticatedAccount | null {
  if (!object(value) || typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) || value.is_anonymous === true || typeof value.created_at !== 'string') return null;
  const createdAtMs = Date.parse(value.created_at);
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0) return null;
  if (!object(value.app_metadata) || value.app_metadata.twl_access !== 'closed-beta') {
    throw new ProductionRefusal('This account needs a Three White Lights beta invitation.', PRODUCTION_LIMITS.forbiddenStatus);
  }
  return { id: value.id, createdAtMs };
}
