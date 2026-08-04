import { FirewallRule, SecretItem } from '../types/security';
import { AuditLogEvent } from '../types/auth';
import { apiClient } from '../api/client';

class SecurityService {
  async fetchFirewallRules(): Promise<FirewallRule[]> {
    try {
      return await apiClient.get<FirewallRule[]>('/security/firewall');
    } catch (e) {
      return [];
    }
  }

  async fetchSecrets(): Promise<SecretItem[]> {
    try {
      return await apiClient.get<SecretItem[]>('/security/secrets');
    } catch (e) {
      return [];
    }
  }

  async fetchAuditLogs(): Promise<AuditLogEvent[]> {
    try {
      return await apiClient.get<AuditLogEvent[]>('/security/audit-logs');
    } catch (e) {
      return [];
    }
  }
}

export const securityService = new SecurityService();
