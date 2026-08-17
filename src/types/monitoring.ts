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
  /** null when the host exposes no thermal zone — the agent reports null rather than a fake 0. */
  tempC?: number | null;
  /** null: no power telemetry source is implemented. */
  powerWatts?: number | null;

  // Host facts the agent bundles with each sample.
  cpuCores?: number;
  cpuModel?: string;
  memoryTotalBytes?: number;
  memoryUsedBytes?: number;
  memoryFreeBytes?: number;
  swapTotalBytes?: number;
  diskTotalBytes?: number;
  diskUsedBytes?: number;
  loadAverage?: number[];
  uptimeSeconds?: number;
  osName?: string;
  osPlatform?: string;
  osArch?: string;
  hostname?: string;
}

export interface ProcessItem {
  pid: number;
  user: string;
  /** null on Windows: tasklist does not report per-process CPU. */
  cpuPercent: number | null;
  memoryPercent: number;
  memoryMb: number;
  command: string;
  /** null when the platform does not report a thread count. */
  threads: number | null;
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
