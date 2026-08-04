export type UserRole = 'owner' | 'admin' | 'devops' | 'developer' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  plan: 'Enterprise' | 'Team' | 'Pro' | 'Free Open Source';
  membersCount: number;
  projectsCount: number;
  nodesCount: number;
  avatarUrl: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  teams: string[];
  joinedAt: string;
  status: 'active' | 'invited' | 'disabled';
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
    avatarUrl: string;
  };
  action: string;
  category: 'auth' | 'node' | 'docker' | 'security' | 'billing' | 'api' | 'workflow';
  target: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'failure';
  details?: string;
}

export interface ActiveSession {
  id: string;
  type: 'ssh' | 'terminal' | 'browser' | 'api' | 'agent';
  deviceName: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}
