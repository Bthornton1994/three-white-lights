/** Transport and validation limits. None are lift physics or scoring inputs. */
export const PRODUCTION_LIMITS = Object.freeze({
  millisecondsPerSecond: 1_000, millisecondsPerDay: 86_400_000,
  authTimeoutMs: 15_000, apiTimeoutMs: 20_000, refreshBeforeExpiryMs: 60_000,
  onlinePresenceGapMs: 90_000, ticksPerLift: 3_600, eventsPerLift: 2_400,
  totalReplayTicks: 100_000, maxRequestBytes: 1_048_576, maxRequestIdLength: 200,
  maxStoredStateBytes: 8_388_608, schemaVersion: 1, unauthorizedStatus: 401,
  conflictStatus: 409, invalidRequestStatus: 400, unavailableStatus: 503,
  noContentStatus: 204, jwtSegments: 3, maximumMeetAttempts: 9,
  okStatus: 200, forbiddenStatus: 403, methodNotAllowedStatus: 405,
  preflightMaxAgeSeconds: 600, hexRadix: 16, hexByteLength: 2, maximumJsonDepth: 64,
} as const);
