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
 * Secrets are stored on the host encrypted with AES-256-GCM. That protects the values from being
 * read out of the store, a backup, or a log — but not from root on the host, which holds the key.
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

  /** Secret metadata. Values are never included — reveal is a separate request. */
  async fetchSecrets(): Promise<{ secrets: SecretItem[]; error: string | null }> {
    try {
      const res = await apiClient.get<SecretItem[]>('/security/secrets');
      return { secrets: Array.isArray(res) ? res : [], error: null };
    } catch (e) {
      return { secrets: [], error: describeError(e) };
    }
  }

  /** Create or overwrite a secret. The value is encrypted by the agent before it touches disk. */
  async saveSecret(input: { name: string; value: string; environment?: string; type?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/security/secrets', input);
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  async deleteSecret(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/security/secrets/delete', { name });
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  /** Decrypt one secret. Deliberately a separate call so values are never fetched in bulk. */
  async revealSecret(name: string): Promise<{ success: boolean; value?: string; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; value?: string; error?: string }>('/security/secrets/reveal', { name });
    } catch (e) {
      return { success: false, error: describeError(e) };
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
