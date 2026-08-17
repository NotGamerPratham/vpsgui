export interface FirewallRule {
  id: string;
  nodeId: string;
  /** 'limit' is ufw's rate-limiting action; it was missing from this union. */
  action: 'allow' | 'deny' | 'reject' | 'limit';
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  port: string;
  sourceIp: string;
  comment: string;
  status: 'active' | 'disabled';
}

export interface SshKeyItem {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string;
  type: 'ed25519' | 'rsa' | 'ecdsa';
  addedAt: string;
  lastUsedAt?: string;
  associatedNodesCount: number;
}

export interface CronJobItem {
  id: string;
  nodeId: string;
  schedule: string; // e.g. "0 2 * * *"
  command: string;
  user: string;
  description: string;
  lastRunStatus: 'success' | 'failed' | 'never';
  lastRunAt?: string;
  enabled: boolean;
}

export interface SecretItem {
  id: string;
  orgId: string;
  name: string;
  type: 'env' | 'api_key' | 'ssh_key' | 'certificate' | 'vault_secret';
  environment: 'production' | 'staging' | 'development' | 'global';
  maskedValue: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ReverseProxyRule {
  id: string;
  domain: string;
  upstreamUrl: string;
  sslEnabled: boolean;
  sslProvider: "Let's Encrypt" | 'Custom Certificate' | 'Cloudflare';
  sslExpiresAt?: string;
  autoRenew: boolean;
  status: 'active' | 'error' | 'pending';
}
