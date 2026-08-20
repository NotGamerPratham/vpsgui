import { apiClient, ApiError } from '../api/client';

/**
 * Dashboard sign-in.
 *
 * The session lives in an HttpOnly cookie the agent sets, so nothing here ever
 * holds a credential: this module cannot read the session even if it wanted to,
 * and neither can an injected script. Every call is same-origin, so the browser
 * attaches the cookie automatically.
 */

export interface DashboardUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthStatus {
  /** False when no account exists yet and the dashboard needs first-run setup. */
  configured: boolean;
  minPasswordLength: number;
  /**
   * True when the agent answered 404 — it predates dashboard accounts entirely.
   *
   * The frontend and the agent are deployed by different steps: `git pull` plus
   * a build updates /var/www/vpsgui, while the agent runs from
   * /opt/vpsgui/agent and only `run.sh` copies it. A console newer than its
   * agent otherwise shows a login form where every request 404s, with nothing
   * on screen explaining why.
   */
  agentOutdated?: boolean;
}

export interface WhoAmI {
  /** 'session' is a signed-in person; 'token' is a script using the agent token. */
  kind: 'session' | 'token';
  user: DashboardUser | null;
}

function describe(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
    if (e.status === 0) return `Agent unreachable: ${e.message}`;
    return e.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

class AuthService {
  /** Whether any account exists. Safe to call unauthenticated. */
  async status(): Promise<AuthStatus> {
    try {
      return await apiClient.get<AuthStatus>('/auth/status');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return { configured: false, minPasswordLength: 12, agentOutdated: true };
      }
      throw e;
    }
  }

  /**
   * The current session, or null.
   *
   * A 401 here is the normal "not signed in" answer, not a failure, so it is
   * translated rather than thrown - otherwise every first page load would look
   * like an error.
   *
   * 404 is translated for the same reason: an agent too old to have `/auth`
   * routes has no session to report either. Re-throwing it would reject the
   * `Promise.all` in `refreshSession`, discarding the `agentOutdated` flag
   * `status()` just worked out and leaving the login page with no explanation
   * to show.
   */
  async me(): Promise<WhoAmI | null> {
    try {
      return await apiClient.get<WhoAmI>('/auth/me');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 429)) {
        return null;
      }
      throw e;
    }
  }

  async login(username: string, password: string): Promise<{ user?: DashboardUser; error?: string }> {
    try {
      const res = await apiClient.post<{ user: DashboardUser }>('/auth/login', { username, password });
      return { user: res.user };
    } catch (e) {
      return { error: describe(e, 'Sign-in failed') };
    }
  }

  /**
   * Create the first account. The agent only permits this while no account
   * exists and the caller holds the agent token, so the token must already be
   * saved under Settings before this will work.
   */
  async bootstrap(username: string, password: string): Promise<{ user?: DashboardUser; error?: string }> {
    try {
      const res = await apiClient.post<{ user: DashboardUser }>('/auth/bootstrap', { username, password });
      return { user: res.user };
    } catch (e) {
      return { error: describe(e, 'Could not create the account') };
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // The cookie is cleared server-side on success; a network failure here
      // still ends the local session below, so there is nothing to report.
    }
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post('/auth/password', { currentPassword, newPassword });
      return { success: true };
    } catch (e) {
      return { success: false, error: describe(e, 'Could not change the password') };
    }
  }
}

export const authService = new AuthService();
