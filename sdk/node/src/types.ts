/**
 * Types for the VPSGUI agent REST API.
 *
 * These mirror what the agent actually returns. Fields the agent cannot determine are `null` rather
 * than absent or invented - for example `smartHealth` (needs smartctl), per-process `cpuPercent` on
 * Windows, and `city`/`region` from ipinfo's country-level /lite tier.
 */

export interface VpsguiClientConfig {
  /** e.g. `https://vps.example.com/api/v1` */
  baseUrl: string;
  /** Agent token. Required for every endpoint except `health()`. */
  token?: string;
  /** Default per-request timeout in ms (default 15000). */
  timeout?: number;
}

export interface AgentInfo {
  version: string;
  shellEnabled: boolean;
  fileRoots: string[];
  platform: string;
  unimplementedFeatures: string[];
  /** Whether an ipinfo.io token is configured. Never the token itself. */
  ipinfoConfigured?: boolean;
}

/** Result of a command the agent ran. `success` is false when the command exited non-zero. */
export interface CommandResult {
  success: boolean;
  output: string;
  action?: string;
}

export interface MutationResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  swapPercent: number;
  diskPercent: number;
  netRxKbps: number;
  netTxKbps: number;
  iowaitPercent: number;
  /** null when the host exposes no thermal zone. */
  tempC: number | null;
  powerWatts: number | null;
  cpuCores: number;
  cpuModel: string;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  swapTotalBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  loadAverage: number[];
  uptimeSeconds: number;
  osName: string;
  osPlatform: string;
  osArch: string;
  hostname: string;
}

export interface ProcessItem {
  pid: number;
  user: string;
  /** null on Windows - tasklist reports no per-process CPU. */
  cpuPercent: number | null;
  memoryPercent: number;
  memoryMb: number;
  command: string;
  threads: number | null;
  state: string;
}

export interface NodeSpec {
  id: string;
  name: string;
  status: string;
  agentStatus: string;
  agentVersion: string;
  location: {
    city: string | null;
    country: string | null;
    countryCode: string | null;
    flagIcon: string;
    provider: string | null;
  };
  hardware: {
    cpuCores: number;
    cpuModel: string;
    ramGb: number;
    swapGb: number;
    diskGb: number;
    diskType: string | null;
    architecture: string;
  };
  os: { name: string; family: string; version: string; kernel: string; uptimeSeconds: number };
  network: {
    ipAddress: string;
    /** null - the agent cannot know its own NAT address; resolve it client-side. */
    publicIp: string | null;
    hostname: string;
    sshPort: number;
  };
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TopologyLayer {
  level: string;
  items: Array<{ id: string; title: string; type: string; status: string; desc: string }>;
}

export interface HealthCheck {
  id: string;
  category: string;
  name: string;
  target: string;
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  message: string;
  lastCheck: string;
}

export interface ContainerItem {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{ publicPort: number; privatePort: number; type: string }>;
  cpuPercent: number;
  memoryUsageMb: number;
  created: string | null;
}

export interface DockerImageItem {
  id: string;
  repository: string;
  tag: string;
  size: string;
  sizeMb: number;
  digest: string | null;
  created: string | null;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  isDirectory: boolean;
  size: number;
  sizeBytes: number;
  permissions: string;
  owner: string;
  group: string;
  extension?: string;
  modifiedAt: string | null;
  /** False when the agent's credential deny list blocks this path. */
  readable: boolean;
}

export interface FileReadResult {
  path: string;
  content: string;
  /** True when the file exceeded the read cap; saving it back would truncate the original. */
  truncated: boolean;
  sizeBytes: number;
  editable: boolean;
}

export interface FirewallRule {
  id: string;
  nodeId: string;
  action: 'allow' | 'deny' | 'reject' | 'limit';
  direction: 'inbound' | 'outbound';
  protocol: string;
  port: string;
  sourceIp: string;
  comment: string;
  status: 'active' | 'disabled';
}

export interface FirewallRuleInput {
  action: 'allow' | 'deny' | 'reject' | 'limit' | 'delete';
  /** A single port, an inclusive range (`6000:6010`), or a comma list (`80,443`). */
  port?: string;
  protocol?: 'tcp' | 'udp' | 'any';
  source?: string;
  /** Required for `delete` - ufw removes rules by their number in `ufw status numbered`. */
  ruleNumber?: number;
}

export interface SecretItem {
  id: string;
  name: string;
  type: string;
  environment: string;
  /** Always a fixed mask; the list endpoint never returns values. */
  maskedValue: string;
  updatedBy: string;
  updatedAt?: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  actor: { name: string; email: string; avatarUrl: string };
  action: string;
  category: string;
  target: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'failure';
  details?: string;
}

export interface SystemUser {
  id: string;
  username: string;
  uid: number;
  gid: number;
  fullName: string;
  home: string;
  shell: string;
  /** UID below 1000 and not root - a service account rather than a person. */
  isSystem: boolean;
  canLogin: boolean;
  groups: string[];
  lastLogin: string | null;
}

export interface NetworkInterfaceInfo {
  name: string;
  mac: string;
  ipv4: string;
  ipv6: string;
  type: 'ethernet' | 'wireless' | 'virtual' | 'loopback';
  rxBytes: number;
  txBytes: number;
  rxSpeedMbps: number;
  txSpeedMbps: number;
  status: 'up' | 'down';
}

export interface IpInfoResult {
  ip: string | null;
  /** null from ipinfo's /lite tier, which is country-level only. */
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  continent?: string | null;
  org: string | null;
  asn: string | null;
  /** Which provider answered, or null when none did. */
  source: string | null;
}

export interface StoragePartition {
  device: string;
  mountPoint: string;
  fsType: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  /** null - SMART needs smartctl and raw device access, which the agent does not use. */
  smartHealth: 'passed' | 'warning' | 'failing' | null;
}

export interface BackupItem {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  size: string;
  target: string;
  date: string;
  status: string;
}

export interface Deployment {
  id: string;
  path: string;
  app: string;
  branch: string;
  commit: string;
  message: string;
  committedAt: string | null;
  remote: string;
  dirtyCount: number;
  ahead: number;
  behind: number;
  status: 'clean' | 'modified' | 'behind';
}

export interface DatabaseInstance {
  name: string;
  engine: string;
  port: number;
  /** null - reporting these would require credentials the agent does not hold. */
  size: string | null;
  tables: number | null;
  keys: number | null;
  status: string;
}

export interface ProxyRule {
  id: string;
  domain: string;
  upstream: string;
  ssl: string;
  /** Certificate notAfter as ISO-8601, or '' when the vhost has no certificate. */
  expires: string;
  status: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  version: string;
  description: string;
  iconName: string;
  publisher: string;
  official: boolean;
  /** null - the agent queries no registry, so popularity metrics are not available. */
  downloadsCount: number | null;
  rating: number | null;
  tags: string[];
  image?: string;
  /** Ready-to-run command for catalog entries that are not a single container. */
  installCommand?: string;
  defaultPorts?: number[];
  defaultEnv?: Record<string, string>;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  triggerType: string;
  schedule?: string;
  stepsCount: number;
  /** The full cron command, suitable for running on demand. */
  command?: string;
  source?: string;
  steps: unknown[];
}

export interface QueueJob {
  id: string;
  title: string;
  nodeName: string;
  type: string;
  status: string;
  progressPercent: number;
  startedAt: string;
  logs?: string[];
}

export interface PackagesResult {
  packages: Array<{
    name: string;
    category: string;
    installed: boolean;
    /** null when the binary is present but reported no parseable version. */
    version: string | null;
    description: string;
  }>;
  languages: Array<{
    name: string;
    category: string;
    installed: boolean;
    version: string | null;
    binary: string;
    description: string;
  }>;
}
