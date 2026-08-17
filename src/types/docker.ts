export type ContainerState = 'running' | 'paused' | 'restarting' | 'stopped' | 'exited' | 'dead';

export interface PortMapping {
  privatePort: number;
  publicPort: number;
  type: 'tcp' | 'udp';
}

export interface ContainerVolume {
  hostPath: string;
  containerPath: string;
  mode: 'ro' | 'rw';
}

/**
 * Shape returned by the agent's GET /docker/containers.
 *
 * Fields the agent does not (yet) collect are optional rather than required: declaring them as
 * required made TypeScript vouch for values that were always `undefined` at runtime, which is how
 * "undefined MB" and similar strings reached the UI.
 */
export interface ContainerItem {
  id: string;
  name: string;
  image: string;
  state: ContainerState;
  status: string;
  ports: PortMapping[];
  cpuPercent: number;
  memoryUsageMb: number;
  /** ISO-8601, or null when docker's CreatedAt could not be parsed. */
  created: string | null;

  // Not currently reported by the agent.
  nodeId?: string;
  imageId?: string;
  volumes?: ContainerVolume[];
  memoryLimitMb?: number;
  networkRxKb?: number;
  networkTxKb?: number;
  uptime?: string;
  command?: string;
  environment?: Record<string, string>;
}

/** Shape returned by the agent's GET /docker/images. */
export interface DockerImageItem {
  id: string;
  repository: string;
  tag: string;
  /** Human-readable size as docker reports it (e.g. "142MB"). */
  size: string;
  sizeMb: number;
  digest: string | null;
  /** ISO-8601, or null when docker's CreatedAt could not be parsed. */
  created: string | null;

  // Not currently reported by the agent.
  nodeId?: string;
  containersCount?: number;
}

export interface DockerNetworkItem {
  id: string;
  nodeId: string;
  name: string;
  driver: 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
  scope: string;
  subnet: string;
  gateway: string;
  containersConnected: number;
}

export interface DockerVolumeItem {
  name: string;
  nodeId: string;
  driver: string;
  mountpoint: string;
  sizeMb: number;
  created: string;
  inUse: boolean;
}

export interface DockerComposeStack {
  id: string;
  nodeId: string;
  name: string;
  status: 'active' | 'updating' | 'stopped' | 'error';
  containersCount: number;
  services: string[];
  composeFile: string;
  lastDeployed: string;
}
