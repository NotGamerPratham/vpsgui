import { FirewallRule, SecretItem } from '../types/security';
import { AuditLogEvent } from '../types/auth';
import { apiClient } from '../api/client';

/**
 * NOTE: the bundled vpsgui-agent implements none of these endpoints yet — /security/firewall,
 * /security/secrets, and /security/audit-logs all 404 — so each method resolves to an empty list
 * and the corresponding pages render their empty states. They are deliberately left as the
 * integration points for a future agent release rather than backfilled with sample data.
 *
 * For live firewall state today, run `ufw status` from the Terminal page.
 */
class SecurityService {
  async fetchFirewallRules(): Promise<FirewallRule[]> {
    try {
      const res = await apiClient.get<FirewallRule[]>('/security/firewall');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
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
