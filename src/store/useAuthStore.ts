import { create } from 'zustand';
import { UserProfile, OrganizationItem, AuditLogEvent } from '../types/auth';

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
  isAuthenticated: true,
  user: {
    id: 'usr-101',
    email: 'admin@vpsgui.dev',
    name: 'VPS Administrator',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    role: 'owner',
    mfaEnabled: true,
    createdAt: new Date().toISOString(),
  },
  organizations: [
    {
      id: 'org-vpsgui',
      name: 'VPS Host Infrastructure',
      slug: 'vps-host-infra',
      plan: 'Free Open Source',
      membersCount: 1,
      projectsCount: 1,
      nodesCount: 1,
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
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
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
  },
  auditLogs: [],

  login: (email) =>
    set({
      isAuthenticated: true,
      user: {
        id: 'usr-101',
        email,
        name: email.split('@')[0],
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        role: 'owner',
        mfaEnabled: true,
        createdAt: new Date().toISOString(),
      },
    }),

  logout: () => set({ isAuthenticated: false, user: null }),

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
