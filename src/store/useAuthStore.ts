import { create } from 'zustand';
import { UserProfile, UserRole, OrganizationItem, AuditLogEvent } from '../types/auth';
import { AGENT_TOKEN_STORAGE_KEY } from '../api/client';
import { authService } from '../services/authService';

/**
 * Dashboard session state.
 *
 * This was a localStorage flag: anyone could set `vpsgui_authenticated` in
 * devtools and reach every page. It now mirrors a real server-side session —
 * the agent verifies a scrypt password hash from its 0600 `users.db` and sets
 * an HttpOnly, SameSite=Strict cookie.
 *
 * Nothing in this file can read that cookie, which is the point: an injected
 * script cannot steal the session either. `isAuthenticated` is only a cache of
 * what the agent last said, and the agent re-checks on every single request, so
 * tampering with it here buys an attacker a rendered shell and no data.
 *
 * The agent token remains separate and remains root-equivalent.
 */

interface AuthState {
  isAuthenticated: boolean;
  /** True until the first /auth/me answers, so protected routes do not flash. */
  checking: boolean;
  /** False when no account exists yet and first-run setup is needed. */
  configured: boolean;
  user: UserProfile | null;
  organizations: OrganizationItem[];
  currentOrg: OrganizationItem | null;
  auditLogs: AuditLogEvent[];

  // Actions
  refreshSession: () => Promise<void>;
  /** Resolves to an error message, or null on success. */
  login: (username: string, password: string) => Promise<string | null>;
  bootstrap: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  setCurrentOrg: (org: OrganizationItem) => void;
  addAuditLog: (log: Omit<AuditLogEvent, 'id' | 'timestamp'>) => void;
}

const HOST_ORG: OrganizationItem = {
  id: 'org-vpsgui',
  name: 'VPS Host Infrastructure',
  slug: 'vps-host-infra',
  plan: 'Free Open Source',
  membersCount: 1,
  projectsCount: 1,
  nodesCount: 1,
  avatarUrl: '',
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  checking: true,
  configured: true,
  user: null,
  organizations: [HOST_ORG],
  currentOrg: HOST_ORG,
  auditLogs: [],

  refreshSession: async () => {
    try {
      const [status, who] = await Promise.all([
        authService.status().catch(() => ({ configured: true, minPasswordLength: 12 })),
        authService.me(),
      ]);

      set({
        checking: false,
        configured: status.configured,
        // A token-authenticated caller is a script, not a signed-in person, so
        // it does not get a dashboard session.
        isAuthenticated: who?.kind === 'session',
        user:
          who?.kind === 'session' && who.user
            ? {
              id: who.user.id,
              email: who.user.username,
              name: who.user.username,
              avatarUrl: '',
              // The agent stores a free-form role string; narrow it to the
              // roles the UI knows and fall back rather than casting blindly.
              role: (['owner', 'admin', 'devops', 'developer', 'viewer'] as const).includes(
                who.user.role as UserRole,
              )
                ? (who.user.role as UserRole)
                : 'viewer',
              // No MFA exists anywhere in this codebase; claiming otherwise
              // would be cosmetic.
              mfaEnabled: false,
              createdAt: new Date().toISOString(),
            }
            : null,
      });
    } catch (e) {
      // Agent unreachable. Staying signed out is the safe answer - it re-checks
      // every request anyway, so pretending otherwise would only render pages
      // that cannot load any data.
      set({ checking: false, isAuthenticated: false, user: null });
    }
  },

  login: async (username, password) => {
    const { user, error } = await authService.login(username, password);
    if (error || !user) return error || 'Sign-in failed';
    await useAuthStore.getState().refreshSession();
    return null;
  },

  bootstrap: async (username, password) => {
    const { user, error } = await authService.bootstrap(username, password);
    if (error || !user) return error || 'Could not create the account';
    await useAuthStore.getState().refreshSession();
    return null;
  },

  logout: async () => {
    await authService.logout();
    try {
      // The agent token grants root-equivalent control of the host. Leaving it
      // behind means the next person at this browser inherits that access.
      localStorage.removeItem(AGENT_TOKEN_STORAGE_KEY);
    } catch (e) {
      // Storage unavailable; in-memory state is still cleared below.
    }
    set({ isAuthenticated: false, user: null, checking: false });
  },

  setCurrentOrg: (org) => set({ currentOrg: org }),

  addAuditLog: (logData) =>
    set((state) => ({
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...logData,
        },
        ...state.auditLogs,
      ],
    })),
}));
