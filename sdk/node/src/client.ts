import type {
  VpsguiClientConfig,
  NodeSpec,
  AddNodePayload,
  ContainerItem,
  DockerImageItem,
  TelemetryPoint,
  ProcessItem,
  HealthStatusMatrix,
  FileItem,
  FirewallRule,
  SecretItem,
  AuditLogEvent,
  CatalogItem,
  AutomationWorkflow,
  QueueJob,
  StoragePartition,
  NetworkInterfaceInfo,
  BackupItem,
  DatabaseInstance,
  DeploymentItem,
  ProxyRule,
} from './types';

/**
 * Official VPSGUI Node.js/TypeScript SDK Client.
 *
 * @example
 * ```ts
 * import { VpsguiClient } from '@vpsgui/sdk';
 *
 * const client = new VpsguiClient({
 *   baseUrl: 'https://your-vps-ip/api/v1',
 *   token: 'your-jwt-token',
 * });
 *
 * const nodes = await client.nodes.list();
 * const containers = await client.docker.listContainers();
 * const telemetry = await client.system.telemetry();
 * ```
 */
export class VpsguiClient {
  private baseUrl: string;
  private token?: string;
  private timeout: number;

  public readonly nodes: NodesResource;
  public readonly docker: DockerResource;
  public readonly system: SystemResource;
  public readonly files: FilesResource;
  public readonly security: SecurityResource;
  public readonly catalog: CatalogResource;
  public readonly automation: AutomationResource;
  public readonly queue: QueueResource;
  public readonly storage: StorageResource;
  public readonly network: NetworkResource;
  public readonly backups: BackupsResource;
  public readonly databases: DatabasesResource;
  public readonly deployments: DeploymentsResource;
  public readonly proxy: ProxyResource;
  public readonly health: HealthResource;

  constructor(config: VpsguiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 30000;

    this.nodes = new NodesResource(this);
    this.docker = new DockerResource(this);
    this.system = new SystemResource(this);
    this.files = new FilesResource(this);
    this.security = new SecurityResource(this);
    this.catalog = new CatalogResource(this);
    this.automation = new AutomationResource(this);
    this.queue = new QueueResource(this);
    this.storage = new StorageResource(this);
    this.network = new NetworkResource(this);
    this.backups = new BackupsResource(this);
    this.databases = new DatabasesResource(this);
    this.deployments = new DeploymentsResource(this);
    this.proxy = new ProxyResource(this);
    this.health = new HealthResource(this);
  }

  /** Update the auth token at runtime. */
  setToken(token: string): void {
    this.token = token;
  }

  /** Internal fetch wrapper with auth headers and error handling. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new VpsguiApiError(response.status, response.statusText, errorBody);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ─── API Error ────────────────────────────────────────────────

export class VpsguiApiError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly body: string;

  constructor(statusCode: number, statusText: string, body: string) {
    super(`VPSGUI API Error ${statusCode}: ${statusText}`);
    this.name = 'VpsguiApiError';
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.body = body;
  }
}

// ─── Resource Classes ─────────────────────────────────────────

class NodesResource {
  constructor(private client: VpsguiClient) {}

  /** List all connected VPS nodes. */
  async list(): Promise<NodeSpec[]> {
    return this.client.request<NodeSpec[]>('GET', '/nodes');
  }

  /** Get a single node by ID. */
  async get(nodeId: string): Promise<NodeSpec> {
    return this.client.request<NodeSpec>('GET', `/nodes/${nodeId}`);
  }

  /** Register a new node. */
  async create(payload: AddNodePayload): Promise<NodeSpec> {
    return this.client.request<NodeSpec>('POST', '/nodes', payload);
  }

  /** Delete a node by ID. */
  async delete(nodeId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/nodes/${nodeId}`);
  }

  /** Reboot a node. */
  async reboot(nodeId: string): Promise<void> {
    return this.client.request<void>('POST', `/nodes/${nodeId}/reboot`);
  }
}

class DockerResource {
  constructor(private client: VpsguiClient) {}

  /** List all Docker containers on the host. */
  async listContainers(): Promise<ContainerItem[]> {
    return this.client.request<ContainerItem[]>('GET', '/docker/containers');
  }

  /** List all Docker images on the host. */
  async listImages(): Promise<DockerImageItem[]> {
    return this.client.request<DockerImageItem[]>('GET', '/docker/images');
  }

  /** Start a container by ID. */
  async startContainer(containerId: string): Promise<void> {
    return this.client.request<void>('POST', `/docker/containers/${containerId}/start`);
  }

  /** Stop a container by ID. */
  async stopContainer(containerId: string): Promise<void> {
    return this.client.request<void>('POST', `/docker/containers/${containerId}/stop`);
  }

  /** Restart a container by ID. */
  async restartContainer(containerId: string): Promise<void> {
    return this.client.request<void>('POST', `/docker/containers/${containerId}/restart`);
  }

  /** Delete a container by ID. */
  async deleteContainer(containerId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/docker/containers/${containerId}`);
  }

  /** Fetch logs from a container. */
  async containerLogs(containerId: string, lines: number = 100): Promise<string> {
    return this.client.request<string>('GET', `/docker/containers/${containerId}/logs?lines=${lines}`);
  }
}

class SystemResource {
  constructor(private client: VpsguiClient) {}

  /** Get recent system telemetry data points. */
  async telemetry(): Promise<TelemetryPoint[]> {
    return this.client.request<TelemetryPoint[]>('GET', '/system/telemetry');
  }

  /** Get top running processes. */
  async processes(): Promise<ProcessItem[]> {
    return this.client.request<ProcessItem[]>('GET', '/system/processes');
  }
}

class FilesResource {
  constructor(private client: VpsguiClient) {}

  /** List files in a directory. */
  async list(path: string = '/etc'): Promise<FileItem[]> {
    return this.client.request<FileItem[]>('GET', `/files?path=${encodeURIComponent(path)}`);
  }

  /** Read a file's content. */
  async read(filePath: string): Promise<FileItem> {
    return this.client.request<FileItem>('GET', `/files/read?path=${encodeURIComponent(filePath)}`);
  }
}

class SecurityResource {
  constructor(private client: VpsguiClient) {}

  /** List firewall rules. */
  async listFirewallRules(): Promise<FirewallRule[]> {
    return this.client.request<FirewallRule[]>('GET', '/security/firewall');
  }

  /** List encrypted secrets. */
  async listSecrets(): Promise<SecretItem[]> {
    return this.client.request<SecretItem[]>('GET', '/security/secrets');
  }

  /** List audit log events. */
  async listAuditLogs(): Promise<AuditLogEvent[]> {
    return this.client.request<AuditLogEvent[]>('GET', '/security/audit-logs');
  }

  /** List SSH keys. */
  async listSshKeys(): Promise<{ id: string; name: string; fingerprint: string; type: string }[]> {
    return this.client.request('GET', '/security/ssh-keys');
  }
}

class CatalogResource {
  constructor(private client: VpsguiClient) {}

  /** List available catalog items (apps, stacks, templates). */
  async list(): Promise<CatalogItem[]> {
    return this.client.request<CatalogItem[]>('GET', '/catalog');
  }

  /** Deploy a catalog item by ID. */
  async deploy(itemId: string, config?: Record<string, unknown>): Promise<void> {
    return this.client.request<void>('POST', `/catalog/${itemId}/deploy`, config);
  }
}

class AutomationResource {
  constructor(private client: VpsguiClient) {}

  /** List automation workflows. */
  async list(): Promise<AutomationWorkflow[]> {
    return this.client.request<AutomationWorkflow[]>('GET', '/automation/workflows');
  }

  /** Trigger a workflow by ID. */
  async trigger(workflowId: string): Promise<void> {
    return this.client.request<void>('POST', `/automation/workflows/${workflowId}/run`);
  }
}

class QueueResource {
  constructor(private client: VpsguiClient) {}

  /** List background job queue entries. */
  async list(): Promise<QueueJob[]> {
    return this.client.request<QueueJob[]>('GET', '/queue/jobs');
  }
}

class StorageResource {
  constructor(private client: VpsguiClient) {}

  /** List disk partitions and usage. */
  async listPartitions(): Promise<StoragePartition[]> {
    return this.client.request<StoragePartition[]>('GET', '/storage/partitions');
  }
}

class NetworkResource {
  constructor(private client: VpsguiClient) {}

  /** List network interfaces. */
  async listInterfaces(): Promise<NetworkInterfaceInfo[]> {
    return this.client.request<NetworkInterfaceInfo[]>('GET', '/network/interfaces');
  }
}

class BackupsResource {
  constructor(private client: VpsguiClient) {}

  /** List backup snapshots. */
  async list(): Promise<BackupItem[]> {
    return this.client.request<BackupItem[]>('GET', '/backups');
  }

  /** Trigger a new backup. */
  async create(config?: Record<string, unknown>): Promise<void> {
    return this.client.request<void>('POST', '/backups', config);
  }

  /** Restore from a backup. */
  async restore(backupId: string): Promise<void> {
    return this.client.request<void>('POST', `/backups/${backupId}/restore`);
  }
}

class DatabasesResource {
  constructor(private client: VpsguiClient) {}

  /** List database instances. */
  async list(): Promise<DatabaseInstance[]> {
    return this.client.request<DatabaseInstance[]>('GET', '/databases');
  }
}

class DeploymentsResource {
  constructor(private client: VpsguiClient) {}

  /** List deployment history. */
  async list(): Promise<DeploymentItem[]> {
    return this.client.request<DeploymentItem[]>('GET', '/deployments');
  }
}

class ProxyResource {
  constructor(private client: VpsguiClient) {}

  /** List reverse proxy rules. */
  async list(): Promise<ProxyRule[]> {
    return this.client.request<ProxyRule[]>('GET', '/proxy/rules');
  }
}

class HealthResource {
  constructor(private client: VpsguiClient) {}

  /** Get infrastructure health matrix. */
  async matrix(): Promise<HealthStatusMatrix[]> {
    return this.client.request<HealthStatusMatrix[]>('GET', '/health/matrix');
  }
}
