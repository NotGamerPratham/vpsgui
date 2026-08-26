/**
 * Shared pacing rules for the pages that refresh themselves.
 *
 * Extracted from ServicesPage so the two things most likely to regress - how fast a failing agent
 * is retried, and which failures must stop the loop instead of retrying it - are unit tested. The
 * components themselves cannot be tested here: the suite has no DOM renderer.
 */

/** Ceiling for the backoff applied while the agent is failing. */
export const MAX_BACKOFF_MS = 60000;

/**
 * How long to wait before the next read.
 *
 * Backs off exponentially while the agent is failing so a host that is down is not hammered every
 * few seconds by every open tab, and settles back to the base interval on the first success.
 */
export function livePollDelay(baseMs: number, consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return baseMs;
  const scaled = baseMs * 2 ** consecutiveFailures;
  // 2**failures overflows to Infinity long before a real session gets there, and Math.min would
  // happily return it; clamping keeps setTimeout from receiving a non-finite delay (which browsers
  // treat as 0 and would turn the backoff into a tight loop).
  if (!Number.isFinite(scaled)) return MAX_BACKOFF_MS;
  return Math.min(scaled, MAX_BACKOFF_MS);
}

/**
 * True for a failure that must stop the loop rather than retry it.
 *
 * The agent locks a client out after repeated failed authentication, so a poller holding a stale
 * token would re-arm that lockout every few seconds and take the page down with 429s. 401/403 mean
 * retrying cannot succeed without the operator changing the token; 429 means we are already being
 * throttled and must back all the way off.
 */
export function isHaltingStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429;
}
