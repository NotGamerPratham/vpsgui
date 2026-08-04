export type NodeType = 'linux' | 'windows' | 'docker_host' | 'vm' | 'k8s_cluster' | 'bare_metal' | 'raspberry_pi' | 'nas' | 'edge';
export type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance' | 'provisioning';

export interface NodeHardware {
  cpuCores: number;
  cpuModel: string;
  ramGb: number;
  swapGb: number;
  diskGb: number;
  diskType: 'NVMe' | 'SSD' | 'HDD';
  architecture: string;
  gpus?: { model: string; memoryGb: number; usagePercent: number; tempC: number }[];
}

export interface NodeOS {
  name: string;
  family: 'ubuntu' | 'debian' | 'centos' | 'alpine' | 'arch' | 'windows' | 'custom';
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
  agentStatus: 'healthy' | 'outdated' | 'unreachable';
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
