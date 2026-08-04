// ─── Node Types ───────────────────────────────────────────────

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

// ─── Docker Types ─────────────────────────────────────────────

export type ContainerState = 'running' | 'paused' | 'restarting' | 'stopped' | 'exited' | 'dead';

export interface PortMapping {
  privatePort: number;
  publicPort: number;
  type: 'tcp' | 'udp';
}

export interface ContainerItem {
  id: string;
  nodeId: string;
  name: string;
  image: string;
  imageId: string;
  state: ContainerState;
  status: string;
  ports: PortMapping[];
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxKb: number;
  networkTxKb: number;
  uptime: string;
  createdAt: string;
  command: string;
}

export interface DockerImageItem {
  id: string;
  nodeId: string;
  repository: string;
  tag: string;
  sizeMb: number;
  created: string;
  containersCount: number;
  digest: string;
}

// ─── Monitoring Types ─────────────────────────────────────────

export interface TelemetryPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  swapPercent: number;
  diskPercent: number;
  netRxKbps: number;
  netTxKbps: number;
  iowaitPercent: number;
  gpuPercent?: number;
  tempC?: number;
  powerWatts?: number;
}

export interface ProcessItem {
  pid: number;
  user: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryMb: number;
  command: string;
  threads: number;
  state: string;
}

export interface HealthStatusMatrix {
  id: string;
  category: 'node' | 'service' | 'database' | 'container' | 'certificate' | 'backup' | 'domain';
  name: string;
  target: string;
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  message: string;
  lastCheck: string;
}

// ─── File System Types ────────────────────────────────────────

export interface FileItem {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory' | 'symlink';
  extension?: string;
  permissions: string;
  owner: string;
  group: string;
  modifiedAt: string;
  content?: string;
}

// ─── Security Types ───────────────────────────────────────────

export interface FirewallRule {
  id: string;
  nodeId: string;
  action: 'allow' | 'deny' | 'reject';
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  port: string;
  sourceIp: string;
  comment: string;
  status: 'active' | 'disabled';
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

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  actor: { name: string; email: string; avatarUrl: string };
  action: string;
  category: 'auth' | 'node' | 'docker' | 'security' | 'billing' | 'api' | 'workflow';
  target: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'failure';
  details?: string;
}

// ─── Catalog Types ────────────────────────────────────────────

export type CatalogCategory = 'applications' | 'docker_images' | 'vm_images' | 'operating_systems' | 'plugins' | 'stacks' | 'templates';

export interface CatalogItem {
  id: string;
  name: string;
  category: CatalogCategory;
  version: string;
  description: string;
  iconName: string;
  publisher: string;
  official: boolean;
  downloadsCount: number;
  rating: number;
  tags: string[];
}

// ─── Workflow Types ───────────────────────────────────────────

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'failed';
  triggerType: 'cron' | 'event' | 'webhook' | 'manual';
  schedule?: string;
  stepsCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed';
}

export interface QueueJob {
  id: string;
  title: string;
  nodeName: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progressPercent: number;
  startedAt: string;
  durationSeconds?: number;
}

// ─── Infrastructure Types ─────────────────────────────────────

export interface StoragePartition {
  device: string;
  mountPoint: string;
  fsType: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usage: number;
  smart: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  mac: string;
  ipv4: string;
  type: string;
  rx: string;
  tx: string;
  status: string;
}

export interface BackupItem {
  id: string;
  name: string;
  size: string;
  target: string;
  date: string;
  status: string;
}

export interface DatabaseInstance {
  name: string;
  engine: string;
  size: string;
  tables?: number;
  keys?: number;
  status: string;
}

export interface DeploymentItem {
  id: string;
  app: string;
  branch: string;
  commit: string;
  status: string;
  duration: string;
  time: string;
}

export interface ProxyRule {
  id: string;
  domain: string;
  upstream: string;
  ssl: string;
  expires: string;
  status: string;
}

// ─── Client Config ────────────────────────────────────────────

export interface VpsguiClientConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
}
