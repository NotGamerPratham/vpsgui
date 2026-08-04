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

export interface ContainerItem {
  id: string;
  nodeId: string;
  name: string;
  image: string;
  imageId: string;
  state: ContainerState;
  status: string;
  ports: PortMapping[];
  volumes: ContainerVolume[];
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxKb: number;
  networkTxKb: number;
  uptime: string;
  createdAt: string;
  command: string;
  environment: Record<string, string>;
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
