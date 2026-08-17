/**
 * Server Management Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Handles host node auto-discovery and pairs with the vpsgui-agent daemon
 */

import { NodeSpec, AddNodePayload } from '../types/node';
import { apiClient, ApiError } from '../api/client';
import { diagnosticsService } from './diagnosticsService';

const STORAGE_KEY = 'vpsgui_nodes_inventory';

class ServerService {
  /**
   * Placeholder node used before the agent has answered.
   *
   * Every hardware and OS figure is zero/empty rather than invented. The previous version returned
   * a plausible-looking machine — "vps128", 4 cores, 16 GB RAM, 80 GB NVMe, "QEMU Virtual CPU",
   * "Ubuntu Linux VPS" — which the dashboard then displayed as though it were the real host. On a
   * 16-core / 32 GB machine it silently reported 4 cores and 16 GB.
   */
  getDefaultHostNode(): NodeSpec {
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';

    return {
      id: 'node-host-primary',
      name: hostIp,
      alias: 'Awaiting agent',
      tags: ['host-system'],
      type: 'linux',
      status: 'unknown',
      location: {
        city: '',
        country: '',
        countryCode: '',
        flagIcon: 'Globe',
        provider: '',
      },
      hardware: {
        cpuCores: 0,
        cpuModel: '',
        ramGb: 0,
        swapGb: 0,
        diskGb: 0,
        diskType: '',
        architecture: '',
      },
      os: {
        name: '',
        family: '',
        version: '',
        kernel: '',
        uptimeSeconds: 0,
      },
      network: {
        ipAddress: hostIp,
        publicIp: hostIp,
        hostname: hostIp,
        sshPort: 22,
        bandwidthUsageGb: 0,
        monthlyLimitGb: 0,
      },
      agentVersion: '',
      agentStatus: 'unknown',
      lastHeartbeat: new Date().toISOString(),
      isFavorite: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Load nodes inventory locked to single active host Linux VPS
  getNodes(): NodeSpec[] {
    const defaultNode = this.getDefaultHostNode();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Lock to single current host node
          return [parsed[0]];
        }
      }
    } catch (e) {
      // Fall back to default host node
      console.warn('Failed to load nodes from localStorage:', e);
    }
    this.saveNodes([defaultNode]);
    return [defaultNode];
  }

  saveNodes(nodes: NodeSpec[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes.slice(0, 1)));
    } catch (e) {
      // Storage quota error or browser restricted mode
      console.error('Failed to save nodes to localStorage:', e);
    }
  }

  async fetchNodesFromApi(): Promise<NodeSpec[]> {
    return this.autoDiscoverHostNode();
  }

  /**
   * Discover the host running vpsgui-agent.
   *
   * Reports exactly what the agent returns. When the agent is unreachable it returns the
   * awaiting-agent placeholder rather than filling the gaps with invented specs — a dashboard that
   * confidently states "4 cores / 16 GB" for a machine it never reached is worse than a blank one.
   */
  async autoDiscoverHostNode(): Promise<NodeSpec[]> {
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';
    const agentData = await this.queryAgent(hostIp);

    if (!agentData?.hardware) {
      const placeholder = this.getDefaultHostNode();
      this.saveNodes([placeholder]);
      return [placeholder];
    }

    // Geolocation is a best-effort enrichment of the public IP and must never substitute for
    // agent-reported facts.
    const geo = await diagnosticsService.getIpInfo(agentData.network?.publicIp || undefined);

    const hostNode: NodeSpec = {
      id: 'node-host-primary',
      name: agentData.name || hostIp,
      alias: 'Host system',
      tags: agentData.tags?.length ? agentData.tags : ['host-system'],
      type: 'linux',
      status: 'online',
      location: {
        city: geo.city || '',
        country: geo.country || '',
        countryCode: geo.countryCode || '',
        flagIcon: 'Globe',
        provider: geo.org || '',
      },
      hardware: {
        cpuCores: agentData.hardware.cpuCores ?? 0,
        cpuModel: agentData.hardware.cpuModel ?? '',
        ramGb: agentData.hardware.ramGb ?? 0,
        swapGb: agentData.hardware.swapGb ?? 0,
        diskGb: agentData.hardware.diskGb ?? 0,
        // The agent cannot determine the physical disk type; empty rather than a guessed "NVMe".
        diskType: agentData.hardware.diskType ?? '',
        architecture: agentData.hardware.architecture ?? '',
      },
      os: agentData.os ?? { name: '', family: '', version: '', kernel: '', uptimeSeconds: 0 },
      network: {
        ipAddress: agentData.network?.ipAddress || hostIp,
        publicIp: agentData.network?.publicIp || geo.ip || hostIp,
        hostname: agentData.network?.hostname || agentData.name || hostIp,
        sshPort: agentData.network?.sshPort ?? 22,
        bandwidthUsageGb: 0,
        monthlyLimitGb: 0,
      },
      agentVersion: agentData.agentVersion || '',
      agentStatus: 'healthy',
      lastHeartbeat: new Date().toISOString(),
      isFavorite: true,
      createdAt: agentData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveNodes([hostNode]);
    return [hostNode];
  }

  /**
   * Fetch the node payload from the agent.
   *
   * Goes through apiClient so the agent token is attached — /node now requires authentication, and
   * a bare fetch() would 401 and silently fall back to placeholder hardware.
   */
  async queryAgent(_ipAddress?: string): Promise<Partial<NodeSpec> | null> {
    for (const endpoint of ['/node', '/nodes']) {
      try {
        const data = await apiClient.get<unknown>(endpoint, 5000);
        const nodeObj = (Array.isArray(data) ? data[0] : data) as Partial<NodeSpec> | undefined;
        if (nodeObj?.hardware && typeof nodeObj.hardware.cpuCores === 'number') {
          return nodeObj;
        }
      } catch (e) {
        // Try the next endpoint; a 401 here means no agent token is configured yet.
      }
    }
    return null;
  }

  /**
   * Not supported.
   *
   * VPSGUI manages exactly one host — the machine running the agent — and getNodes()/saveNodes()
   * both truncate the inventory to a single entry. This used to return the default host node while
   * ignoring the payload entirely, so "add node" appeared to succeed, showed a node with the wrong
   * name, and then silently lost it on the next reload.
   */
  async createNode(_payload: AddNodePayload): Promise<never> {
    throw new Error(
      'Adding additional nodes is not supported: VPSGUI manages the single host running the agent. ' +
        'Deploy a separate VPSGUI instance on each host.'
    );
  }

  async verifyNodeConnection(_nodeId: string): Promise<NodeSpec | null> {
    const nodes = await this.autoDiscoverHostNode();
    return nodes[0] || null;
  }

  /** Issue a real reboot on the host via the agent's shell endpoint. */
  async rebootNode(): Promise<{ success: boolean; message: string }> {
    try {
      // `systemctl reboot` returns before the host goes down; a dropped connection mid-request is
      // itself a sign the reboot took effect, so treat a network error as a likely success.
      const res = await apiClient.post<{ success: boolean; output: string }>(
        '/terminal/exec',
        { command: 'systemctl reboot' },
        10000
      );
      return res?.success
        ? { success: true, message: 'Reboot issued. The host will be unreachable while it restarts.' }
        : { success: false, message: res?.output || 'Reboot command failed' };
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        return { success: true, message: 'Connection dropped — the host is most likely rebooting.' };
      }
      return {
        success: false,
        message:
          e instanceof ApiError && e.status === 401
            ? 'Unauthorized — set a valid Agent Token under Settings.'
            : e instanceof Error
            ? e.message
            : 'Reboot failed',
      };
    }
  }
}

export const serverService = new ServerService();
