import { describe, it, expect, afterEach, vi } from 'vitest';

import { authService } from '../src/services/authService';
import { useAuthStore } from '../src/store/useAuthStore';
import { fetchFailing, fetchReturning, fetchStatus, jsonResponse } from './helpers/fetchMock';
import type { FetchLike } from './helpers/fetchMock';

/**
 * Sign-in against the agent.
 *
 * The case worth protecting is the stale agent: the console and the agent are
 * deployed by different steps, so a host can easily end up serving a console
 * that knows about `/auth/*` to an agent that does not. Without the 404
 * translation below, that renders a login form where every submission fails
 * with nothing on screen explaining why.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authService.status', () => {
  it('reports the account state from the agent', async () => {
    vi.stubGlobal('fetch', fetchReturning({ configured: true, minPasswordLength: 14 }));

    const status = await authService.status();
    expect(status.configured).toBe(true);
    expect(status.minPasswordLength).toBe(14);
    expect(status.agentOutdated).toBeUndefined();
  });

  it('translates a 404 into "the agent predates accounts" rather than throwing', async () => {
    vi.stubGlobal('fetch', fetchStatus(404));

    const status = await authService.status();
    expect(status.agentOutdated).toBe(true);
    // Nobody can sign in, and nobody should be invited to try.
    expect(status.configured).toBe(false);
  });

  it('still throws when the agent is unreachable, which is a different problem', async () => {
    vi.stubGlobal('fetch', fetchFailing());
    await expect(authService.status()).rejects.toThrow();
  });
});

describe('authService.me', () => {
  it('returns the session when there is one', async () => {
    vi.stubGlobal(
      'fetch',
      fetchReturning({ kind: 'session', user: { id: '1', username: 'admin', role: 'admin' } }),
    );

    const who = await authService.me();
    expect(who?.kind).toBe('session');
    expect(who?.user?.username).toBe('admin');
  });

  it('treats 401 as "not signed in", not an error', async () => {
    // Every first page load hits this path; throwing would make a normal
    // signed-out visit look like a failure.
    vi.stubGlobal('fetch', fetchStatus(401));
    await expect(authService.me()).resolves.toBeNull();
  });

  it('treats a lockout as not signed in too', async () => {
    vi.stubGlobal('fetch', fetchStatus(429));
    await expect(authService.me()).resolves.toBeNull();
  });
});

describe('authService.login', () => {
  it('returns the user on success', async () => {
    vi.stubGlobal('fetch', fetchReturning({ user: { id: '1', username: 'admin', role: 'admin' } }));

    const result = await authService.login('admin', 'correct-horse-battery');
    expect(result.user?.username).toBe('admin');
    expect(result.error).toBeUndefined();
  });

  it('turns a lockout into advice instead of a raw 429', async () => {
    vi.stubGlobal('fetch', fetchStatus(429));

    const result = await authService.login('admin', 'wrong');
    expect(result.user).toBeUndefined();
    expect(result.error).toMatch(/too many attempts/i);
  });

  it('surfaces the agent being unreachable as such', async () => {
    vi.stubGlobal('fetch', fetchFailing('Failed to fetch'));

    const result = await authService.login('admin', 'whatever');
    expect(result.error).toMatch(/unreachable/i);
  });

  it('passes the agent-supplied message through for a rejected password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () =>
        jsonResponse({ error: 'Invalid username or password' }, { status: 401 }),
      ),
    );

    const result = await authService.login('admin', 'wrong');
    expect(result.error).toBe('Invalid username or password');
  });

  it('never resolves with both a user and an error', async () => {
    vi.stubGlobal('fetch', fetchStatus(401));
    const result = await authService.login('admin', 'wrong');
    expect(Boolean(result.user) && Boolean(result.error)).toBe(false);
  });
});

describe('authService.logout', () => {
  it('does not throw when the agent is already gone', async () => {
    // The cookie is cleared server-side on success; a network failure here must
    // still let the client end its own session.
    vi.stubGlobal('fetch', fetchFailing());
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});

describe('useAuthStore.refreshSession', () => {
  it('carries the stale-agent flag through to the UI', async () => {
    // /auth/status and /auth/me are both requested; a 404 on either means the
    // agent has no auth routes at all.
    vi.stubGlobal('fetch', fetchStatus(404));

    await useAuthStore.getState().refreshSession();

    const state = useAuthStore.getState();
    expect(state.agentOutdated).toBe(true);
    expect(state.checking).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('leaves the flag clear when the agent simply has no account yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async (url: string) =>
        url.includes('/auth/me')
          ? new Response(null, { status: 401 })
          : jsonResponse({ configured: false, minPasswordLength: 12 }),
      ),
    );

    await useAuthStore.getState().refreshSession();

    const state = useAuthStore.getState();
    expect(state.agentOutdated).toBe(false);
    expect(state.configured).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('marks an authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async (url: string) =>
        url.includes('/auth/me')
          ? jsonResponse({ kind: 'session', user: { id: '1', username: 'admin', role: 'admin' } })
          : jsonResponse({ configured: true, minPasswordLength: 12 }),
      ),
    );

    await useAuthStore.getState().refreshSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.name).toBe('admin');
    expect(state.user?.role).toBe('admin');
    expect(state.agentOutdated).toBe(false);
  });
});
