/**
 * Shared fetch stubs for service tests.
 *
 * A Response body can only be read once, so each call must produce a fresh instance —
 * `mockResolvedValue(new Response(...))` throws "Body is unusable" on the second request.
 *
 * The stubs are typed with an explicit (url, init) signature so `mock.calls[n][1]` type-checks;
 * a bare `vi.fn(async () => ...)` infers a zero-argument call tuple.
 */

import { vi } from 'vitest';

/** The subset of the fetch signature these stubs model. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** A fetch stub returning the given JSON body (a fresh Response on every call). */
export function fetchReturning(body: unknown, init: ResponseInit = {}) {
  return vi.fn<FetchLike>(async () => jsonResponse(body, init));
}

/** A fetch stub returning an empty response with the given status. */
export function fetchStatus(status: number) {
  return vi.fn<FetchLike>(async () => new Response(null, { status }));
}

/** A fetch stub that fails the way a browser does when the host is unreachable. */
export function fetchFailing(message = 'Failed to fetch') {
  return vi.fn<FetchLike>(async () => {
    throw new TypeError(message);
  });
}

/** Parse the JSON body a stub was called with, for asserting on the outgoing request. */
export function bodyOf(mock: { mock: { calls: Array<[string, RequestInit]> } }, callIndex = 0): unknown {
  const body = mock.mock.calls[callIndex]?.[1]?.body;
  if (typeof body !== 'string') throw new Error(`No string request body on call ${callIndex}`);
  return JSON.parse(body);
}

/** A fetch stub that never settles until its AbortSignal fires, mimicking a hung agent. */
export function fetchHanging() {
  return vi.fn<FetchLike>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
  );
}
