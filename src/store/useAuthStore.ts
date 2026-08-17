import { create } from 'zustand';
import { UserProfile, OrganizationItem, AuditLogEvent } from '../types/auth';
import { AGENT_TOKEN_STORAGE_KEY } from '../api/client';

/**
 * LOCAL PROFILE GATE — NOT AN AUTHENTICATION BOUNDARY.
 *
 * VPSGUI ships no user backend: this store only remembers which local profile is active so the UI
 * has a name to display, and it keeps unauthenticated visitors off the dashboard routes. Anyone
 * with access to the browser can flip the flag in devtools.
 *
 * The real credential is the agent token (Settings -> Agent Token), which the agent verifies on
 * every privileged request. Protect the deployment with HTTPS plus a network-level control
 * (firewall, VPN, or nginx auth) — never rely on this gate.
 */

const AUTH_KEY = 'vpsgui_authenticated';
const USER_KEY = 'vpsgui_auth_user';

function getStoredAuth(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * The stored profile, or null.
 *
 * Returns null when nothing is stored. It previously fabricated an "owner"-role VPS Administrator
 * on every miss, so signed-out sessions still rendered an authenticated-looking identity.
 */
function getStoredUser(): UserProfile | null {
  if (!getStoredAuth()) return null;
  try {
    const val = localStorage.getItem(USER_KEY);
    if (!val) return null;
    const parsed = JSON.parse(val);
    return parsed && typeof parsed.email === 'string' ? (parsed as UserProfile) : null;
  } catch (e) {
    return null;
  }
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  organizations: OrganizationItem[];
  currentOrg: OrganizationItem | null;
  auditLogs: AuditLogEvent[];

  // Actions
  login: (email: string) => void;
  logout: () => void;
  setCurrentOrg: (org: OrganizationItem) => void;
  addAuditLog: (log: Omit<AuditLogEvent, 'id' | 'timestamp'>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: getStoredAuth(),
  user: getStoredUser(),
  organizations: [
    {
      id: 'org-vpsgui',
      name: 'VPS Host Infrastructure',
      slug: 'vps-host-infra',
      plan: 'Free Open Source',
      membersCount: 1,
      projectsCount: 1,
      nodesCount: 1,
      avatarUrl: '',
    },
  ],
  currentOrg: {
    id: 'org-vpsgui',
    name: 'VPS Host Infrastructure',
    slug: 'vps-host-infra',
    plan: 'Free Open Source',
    membersCount: 1,
    projectsCount: 1,
    nodesCount: 1,
    avatarUrl: '',
  },
  auditLogs: [],

  login: (email) => {
    const userObj: UserProfile = {
      id: `usr-${Date.now()}`,
      email,
      name: email.split('@')[0],
      avatarUrl: '',
      role: 'owner',
      // No MFA is implemented anywhere in this codebase; claiming it was enabled was cosmetic.
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    } catch (e) {
      // Storage unavailable (private mode); the session stays in memory only.
    }

    set({
      isAuthenticated: true,
      user: userObj,
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(USER_KEY);
      // The agent token grants root-equivalent control of the host. Leaving it in localStorage
      // after sign-out means the next person at this browser inherits that access.
      localStorage.removeItem(AGENT_TOKEN_STORAGE_KEY);
    } catch (e) {
      // Storage unavailable; in-memory state is still cleared below.
    }
    set({ isAuthenticated: false, user: null });
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
