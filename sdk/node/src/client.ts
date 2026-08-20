import type {
  VpsguiClientConfig,
  NodeSpec,
  ContainerItem,
  DockerImageItem,
  TelemetryPoint,
  ProcessItem,
  HealthCheck,
  FileItem,
  FileReadResult,
  FirewallRule,
  FirewallRuleInput,
  SecretItem,
  AuditLogEvent,
  CatalogItem,
  AutomationWorkflow,
  QueueJob,
  StoragePartition,
  NetworkInterfaceInfo,
  IpInfoResult,
  BackupItem,
  DatabaseInstance,
  Deployment,
  ProxyRule,
  SystemUser,
  TopologyLayer,
  PackagesResult,
  AgentInfo,
  CommandResult,
  MutationResult,
} from './types';

/** Error carrying the HTTP status returned by the agent. */
export class VpsguiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'VpsguiError';
    this.status = status;
    this.endpoint = endpoint;
  }

  /** The agent token is missing, wrong, or temporarily locked out after repeated failures. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 429;
  }
}

/**
 * Official VPSGUI Node.js/TypeScript SDK.
 *
 * Every endpoint except `health()` requires the agent token, which grants root-equivalent control
 * of the host - treat it as a root password and never commit it.
 *
 * @example
 * ```ts
 * import { VpsguiClient } from 'vpsgui-sdk';
 *
 * const client = new VpsguiClient({
 *   baseUrl: 'https://vps.example.com/api/v1',
 *   token: process.env.VPSGUI_AGENT_TOKEN,
 * });
 *
 * const telemetry = await client.system.telemetry();
 * const containers = await client.docker.listContainers();
 * ```
 */
export class VpsguiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeout: number;

  readonly nodes: NodesResource;
  readonly system: SystemResource;
  readonly docker: DockerResource;
  readonly files: FilesResource;
  readonly security: SecurityResource;
  readonly network: NetworkResource;
  readonly storage: StorageResource;
  readonly backups: BackupsResource;
  readonly deployments: DeploymentsResource;
  readonly catalog: CatalogResource;
  readonly automation: AutomationResource;
  readonly queue: QueueResource;
  readonly databases: DatabasesResource;
  readonly proxy: ProxyResource;
  readonly terminal: TerminalResource;

  constructor(config: VpsguiClientConfig) {
    if (!config?.baseUrl) throw new Error('VpsguiClient requires a baseUrl');
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 15000;

    this.nodes = new NodesResource(this);
    this.system = new SystemResource(this);
    this.docker = new DockerResource(this);
    this.files = new FilesResource(this);
    this.security = new SecurityResource(this);
    this.network = new NetworkResource(this);
    this.storage = new StorageResource(this);
    this.backups = new BackupsResource(this);
    this.deployments = new DeploymentsResource(this);
    this.catalog = new CatalogResource(this);
    this.automation = new AutomationResource(this);
    this.queue = new QueueResource(this);
    this.databases = new DatabasesResource(this);
    this.proxy = new ProxyResource(this);
    this.terminal = new TerminalResource(this);
  }

  /** @internal */
  async request<T>(method: 'GET' | 'POST', endpoint: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VpsguiError(`Request timed out after ${timeoutMs ?? this.timeout}ms`, 0, endpoint);
      }
      throw new VpsguiError(error instanceof Error ? error.message : 'Network request failed', 0, endpoint);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    let parsed: unknown;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Non-JSON body (e.g. a proxy error page); fall through to the status-based message.
      }
    }

    if (!response.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new VpsguiError(detail, response.status, endpoint);
    }

    return parsed as T;
  }

  /** Liveness probe. The only endpoint that does not require a token. */
  health(): Promise<{ status: string }> {
    return this.request('GET', '/health');
  }

  /** Agent version, configured file roots, and whether optional integrations are set up. */
  info(): Promise<AgentInfo> {
    return this.request('GET', '/agent/info');
  }
}

/** @internal */
abstract class Resource {
  constructor(protected readonly client: VpsguiClient) { }
}

class NodesResource extends Resource {
  /** The host this agent runs on. */
  get(): Promise<NodeSpec> {
    return this.client.request('GET', '/node');
  }

  /** VPSGUI manages a single host, so this always returns exactly one entry. */
  list(): Promise<NodeSpec[]> {
    return this.client.request('GET', '/nodes');
  }

  /** Derived topology: the host, its containers, and detected database engines. */
  topology(): Promise<TopologyLayer[]> {
    return this.client.request('GET', '/topology');
  }

  /** Computed health checks (memory, disk, load, failed units, Docker). */
  health(): Promise<HealthCheck[]> {
    return this.client.request('GET', '/health/matrix');
  }
}

class SystemResource extends Resource {
  telemetry(): Promise<TelemetryPoint> {
    return this.client.request('GET', '/system/telemetry');
  }

  processes(): Promise<ProcessItem[]> {
    return this.client.request('GET', '/system/processes');
  }

  services(): Promise<Array<{ id: string; name: string; alias: string; status: string; enabled: boolean | null }>> {
    return this.client.request('GET', '/system/services');
  }

  /** `systemctl <action> <name>` on the host. */
  serviceAction(name: string, action: 'start' | 'stop' | 'restart' | 'reload'): Promise<CommandResult> {
    return this.client.request('POST', '/system/services/action', { name, action }, 60000);
  }

  packages(): Promise<PackagesResult> {
    return this.client.request('GET', '/system/packages');
  }

  /** `apt-get install -y <packageName>`. Can take minutes. */
  installPackage(packageName: string): Promise<CommandResult> {
    return this.client.request('POST', '/system/packages/install', { packageName }, 300000);
  }

  /** Host accounts from /etc/passwd. */
  users(): Promise<SystemUser[]> {
    return this.client.request('GET', '/users');
  }
}

class DockerResource extends Resource {
  listContainers(): Promise<ContainerItem[]> {
    return this.client.request('GET', '/docker/containers');
  }

  listImages(): Promise<DockerImageItem[]> {
    return this.client.request('GET', '/docker/images');
  }

  containerAction(id: string, action: 'start' | 'stop' | 'restart' | 'remove'): Promise<CommandResult> {
    return this.client.request('POST', '/docker/containers/action', { id, action }, 60000);
  }

  /** `docker rmi`. Without `force`, Docker refuses while a container still references the image. */
  removeImage(id: string, force = false): Promise<CommandResult> {
    return this.client.request('POST', '/docker/images/action', { id, action: 'remove', force }, 60000);
  }
}

class FilesResource extends Resource {
  /** Directory entries. Contents are NOT included - use `read` for that. */
  list(path: string): Promise<FileItem[]> {
    return this.client.request('GET', `/files?path=${encodeURIComponent(path)}`);
  }

  /** Full file contents. `truncated` is true when the file exceeded the agent's read cap. */
  read(path: string): Promise<FileReadResult> {
    return this.client.request('GET', `/files/read?path=${encodeURIComponent(path)}`);
  }

  write(path: string, content: string): Promise<MutationResult> {
    return this.client.request('POST', '/files/write', { path, content });
  }

  mkdir(path: string): Promise<MutationResult> {
    return this.client.request('POST', '/files/mkdir', { path });
  }

  /** Without `recursive` the agent refuses to remove a non-empty directory. */
  delete(path: string, recursive = false): Promise<MutationResult> {
    return this.client.request('POST', '/files/delete', { path, recursive });
  }

  rename(from: string, to: string): Promise<MutationResult> {
    return this.client.request('POST', '/files/rename', { from, to });
  }
}

class SecurityResource extends Resource {
  firewallRules(): Promise<FirewallRule[]> {
    return this.client.request('GET', '/security/firewall');
  }

  /** Applies a real ufw rule change. */
  applyFirewallRule(input: FirewallRuleInput): Promise<CommandResult> {
    return this.client.request('POST', '/security/firewall/action', input, 30000);
  }

  sshKeys(): Promise<Array<{ id: string; user: string; label: string; algorithm: string; fingerprint: string; path: string }>> {
    return this.client.request('GET', '/security/ssh-keys');
  }

  /** SSH and sudo events from the host journal. */
  auditLogs(): Promise<AuditLogEvent[]> {
    return this.client.request('GET', '/security/audit-logs');
  }

  /** Secret metadata. Values are never included - use `revealSecret`. */
  listSecrets(): Promise<SecretItem[]> {
    return this.client.request('GET', '/security/secrets');
  }

  /** Create or overwrite a secret. The agent encrypts the value before it touches disk. */
  saveSecret(input: { name: string; value: string; environment?: string; type?: string }): Promise<MutationResult> {
    return this.client.request('POST', '/security/secrets', input);
  }

  deleteSecret(name: string): Promise<MutationResult> {
    return this.client.request('POST', '/security/secrets/delete', { name });
  }

  /** Decrypt one secret. Deliberately separate so values are never fetched in bulk. */
  revealSecret(name: string): Promise<{ success: boolean; name?: string; value?: string; error?: string }> {
    return this.client.request('POST', '/security/secrets/reveal', { name });
  }
}

class NetworkResource extends Resource {
  interfaces(): Promise<NetworkInterfaceInfo[]> {
    return this.client.request('GET', '/network/interfaces');
  }

  /** Geolocate an address. Omit `ip` to look up the host's own public address. */
  ipInfo(ip?: string): Promise<IpInfoResult> {
    return this.client.request('GET', `/network/ip-info${ip ? `?ip=${encodeURIComponent(ip)}` : ''}`);
  }
}

class StorageResource extends Resource {
  partitions(): Promise<StoragePartition[]> {
    return this.client.request('GET', '/storage/partitions');
  }
}

class BackupsResource extends Resource {
  list(): Promise<BackupItem[]> {
    return this.client.request('GET', '/backups');
  }

  /** Creates a tar.gz of `sourcePath`. Large trees can take minutes. */
  create(sourcePath: string, label?: string): Promise<MutationResult & { name?: string; path?: string }> {
    return this.client.request('POST', '/backups/create', { sourcePath, label }, 600000);
  }

  delete(name: string): Promise<MutationResult> {
    return this.client.request('POST', '/backups/delete', { name });
  }

  /** Extracts an archive into `destination`. Existing files may be overwritten. */
  restore(name: string, destination: string): Promise<MutationResult & { restoredTo?: string }> {
    return this.client.request('POST', '/backups/restore', { name, destination }, 600000);
  }
}

class DeploymentsResource extends Resource {
  /** Git checkouts found on the host. */
  list(): Promise<Deployment[]> {
    return this.client.request('GET', '/deployments', undefined, 30000);
  }

  /** `git pull --ff-only`, accepted only for a path `list()` already reported. */
  pull(path: string): Promise<CommandResult> {
    return this.client.request('POST', '/deployments/pull', { path }, 120000);
  }
}

class CatalogResource extends Resource {
  list(): Promise<CatalogItem[]> {
    return this.client.request('GET', '/catalog');
  }
}

class AutomationResource extends Resource {
  /** cron entries from /etc/crontab, /etc/cron.d and root's crontab. */
  workflows(): Promise<AutomationWorkflow[]> {
    return this.client.request('GET', '/automation/workflows');
  }
}

class QueueResource extends Resource {
  /** systemd timers. */
  jobs(): Promise<QueueJob[]> {
    return this.client.request('GET', '/queue/jobs');
  }
}

class DatabasesResource extends Resource {
  /** Engines detected from listening TCP ports. */
  list(): Promise<DatabaseInstance[]> {
    return this.client.request('GET', '/databases');
  }
}

class ProxyResource extends Resource {
  /** Reverse-proxy rules parsed from the live nginx configuration. */
  rules(): Promise<ProxyRule[]> {
    return this.client.request('GET', '/proxy/rules');
  }
}

class TerminalResource extends Resource {
  /**
   * Run a shell command on the host.
   *
   * This is arbitrary remote code execution by design, gated by the agent token. It can be disabled
   * server-side with `AGENT_ENABLE_SHELL=0`, in which case this returns HTTP 403.
   */
  exec(command: string): Promise<CommandResult & { command: string }> {
    return this.client.request('POST', '/terminal/exec', { command }, 20000);
  }
}
