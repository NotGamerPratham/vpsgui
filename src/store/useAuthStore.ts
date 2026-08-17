import { create } from 'zustand';
import { UserProfile, OrganizationItem, AuditLogEvent } from '../types/auth';

const AUTH_KEY = 'vpsgui_authenticated';
const USER_KEY = 'vpsgui_auth_user';

function getStoredAuth(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

function getStoredUser(): UserProfile | null {
  try {
    const val = localStorage.getItem(USER_KEY);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return {
    id: 'usr-101',
    email: 'admin@vpsgui.dev',
    name: 'VPS Administrator',
    avatarUrl: '',
    role: 'owner',
    mfaEnabled: true,
    createdAt: new Date().toISOString(),
  };
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
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    } catch (e) {}

    set({
      isAuthenticated: true,
      user: userObj,
    });
  },

  logout: () => {
    try {
      localStorage.setItem(AUTH_KEY, 'false');
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
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
