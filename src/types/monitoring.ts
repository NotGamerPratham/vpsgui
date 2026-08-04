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
  ppid?: number;
}

export interface StoragePartition {
  device: string;
  mountPoint: string;
  fsType: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usagePercent: number;
  smartHealth: 'passed' | 'warning' | 'failing';
}

export interface NetworkInterface {
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
