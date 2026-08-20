export type NodeType = 'linux' | 'windows' | 'docker_host' | 'vm' | 'k8s_cluster' | 'bare_metal' | 'raspberry_pi' | 'nas' | 'edge';
/** 'unknown' covers the window before the agent has answered - it is not a claim about the host. */
export type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance' | 'provisioning' | 'unknown';

export interface NodeHardware {
  cpuCores: number;
  cpuModel: string;
  ramGb: number;
  swapGb: number;
  diskGb: number;
  /** '' when undetermined. The agent cannot identify the physical medium, so it does not guess. */
  diskType: 'NVMe' | 'SSD' | 'HDD' | '';
  architecture: string;
  gpus?: { model: string; memoryGb: number; usagePercent: number; tempC: number }[];
}

export interface NodeOS {
  name: string;
  /**
   * Raw platform identifier as reported by the host (e.g. 'linux', 'win32', 'darwin'), or '' when
   * unknown. This was a closed enum of distro names, which the agent has no way to determine —
   * it reports the platform, not the distribution.
   */
  family: string;
  version: string;
  kernel: string;
  uptimeSeconds: number;
}

export interface NodeNetwork {
  ipAddress: string;
  publicIp: string;
  ipv6Address?: string;
  hostname: string;
  sshPort: number;
  bandwidthUsageGb: number;
  monthlyLimitGb: number;
}

export interface NodeSpec {
  id: string;
  name: string;
  alias?: string;
  tags: string[];
  type: NodeType;
  status: NodeStatus;
  location: {
    city: string;
    country: string;
    countryCode: string;
    flagIcon: string;
    provider: string;
  };
  hardware: NodeHardware;
  os: NodeOS;
  network: NodeNetwork;
  agentVersion: string;
  /** 'unknown' before the agent has been reached. */
  agentStatus: 'healthy' | 'outdated' | 'unreachable' | 'unknown';
  lastHeartbeat: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddNodePayload {
  name: string;
  alias?: string;
  type: NodeType;
  ipAddress: string;
  sshPort: number;
  authMethod: 'password' | 'ssh_key';
  sshUser: string;
  sshKeyId?: string;
  password?: string;
  tags: string[];
  autoInstallAgent: boolean;
}
