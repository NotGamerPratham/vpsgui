import { FirewallRule, SecretItem } from '../types/security';
import { AuditLogEvent } from '../types/auth';
import { apiClient, ApiError } from '../api/client';

export interface FirewallRuleInput {
  action: 'allow' | 'deny' | 'reject' | 'limit' | 'delete';
  port?: string;
  protocol?: 'tcp' | 'udp' | 'any';
  source?: string;
  /** Required for `delete`; ufw removes rules by their number in `ufw status numbered`. */
  ruleNumber?: number;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Unauthorized — set a valid Agent Token under Settings.';
    if (e.status === 0) return `Agent unreachable: ${e.message}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Unknown error';
}

/**
 * Firewall rules and audit events come from real host sources (ufw and the systemd journal).
 *
 * `/security/secrets` remains deliberately unimplemented: the agent provides no encrypted storage,
 * and shipping a plaintext-on-disk secret store into an infrastructure tool would be worse than
 * shipping nothing. It returns an empty list so the page can explain itself.
 */
class SecurityService {
  /** Live ufw rules. The error is surfaced so an empty list is not mistaken for "no rules". */
  async fetchFirewallRules(): Promise<{ rules: FirewallRule[]; error: string | null }> {
    try {
      const res = await apiClient.get<FirewallRule[]>('/security/firewall');
      return { rules: Array.isArray(res) ? res : [], error: null };
    } catch (e) {
      return { rules: [], error: describeError(e) };
    }
  }

  /** Apply a real ufw rule change on the host. */
  async applyFirewallRule(input: FirewallRuleInput): Promise<{ success: boolean; output: string }> {
    try {
      return await apiClient.post<{ success: boolean; output: string }>(
        '/security/firewall/action',
        input,
        30000
      );
    } catch (e) {
      return { success: false, output: describeError(e) };
    }
  }

  async fetchSecrets(): Promise<SecretItem[]> {
    try {
      const res = await apiClient.get<SecretItem[]>('/security/secrets');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }

  /** SSH and sudo events from the host journal. */
  async fetchAuditLogs(): Promise<AuditLogEvent[]> {
    try {
      const res = await apiClient.get<AuditLogEvent[]>('/security/audit-logs');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }
}

export const securityService = new SecurityService();
