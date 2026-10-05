/** Supervised operator transport/check bounds. These do not tune game mechanics. */
export const ROLLOUT_LIMITS = Object.freeze({
  okStatus: 200, createdStatus: 201, noContentStatus: 204,
  invalidRequestStatus: 400, unauthorizedStatus: 401, forbiddenStatus: 403,
  notFoundStatus: 404, methodNotAllowedStatus: 405, conflictStatus: 409,
  goneStatus: 410, internalErrorStatus: 500, unavailableStatus: 503,
  requestTimeoutMs: 8_000, cleanupTimeoutMs: 10_000, proofDeadlineMs: 85_000,
  proofBodyMaxBytes: 200, userPageSize: 1_000, hashHexLength: 64,
  hexRadix: 16, hexByteLength: 2, maximumMeetAttempts: 9,
  forgedGapSeconds: 999_999,
} as const);
