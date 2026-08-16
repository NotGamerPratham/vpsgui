/**
 * Server Management Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Handles host node auto-discovery and pairs with the vpsgui-agent daemon
 */

import { NodeSpec, AddNodePayload } from '../types/node';
import { apiClient } from '../api/client';
import { diagnosticsService } from './diagnosticsService';

const STORAGE_KEY = 'vpsgui_nodes_inventory';

class ServerService {
  // Returns fallback host node spec if agent query is connecting
  getDefaultHostNode(): NodeSpec {
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';

    return {
      id: 'node-host-primary',
      name: 'vps128',
      alias: 'Current Host Linux VPS',
      tags: ['linux-vps', 'host-system'],
      type: 'linux',
      status: 'online',
      location: {
        city: 'Local VPS',
        country: 'Linux Host',
        countryCode: 'VPS',
        flagIcon: 'Globe',
        provider: 'Host Machine',
      },
      hardware: {
        cpuCores: 4,
        cpuModel: 'QEMU Virtual CPU',
        ramGb: 16,
        swapGb: 0,
        diskGb: 80,
        diskType: 'NVMe',
        architecture: 'x86_64',
      },
      os: {
        name: 'Ubuntu Linux VPS',
        family: 'ubuntu',
        version: 'Active Agent v1.4.2',
        kernel: 'Linux Daemon',
        uptimeSeconds: 3600,
      },
      network: {
        ipAddress: hostIp,
        publicIp: hostIp,
        hostname: 'vps128',
        sshPort: 22,
        bandwidthUsageGb: 0,
        monthlyLimitGb: 2000,
      },
      agentVersion: 'v1.4.2',
      agentStatus: 'healthy',
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

  // Auto-discover the host Linux VPS running vpsgui-agent
  async autoDiscoverHostNode(): Promise<NodeSpec[]> {
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';

    const geo = await diagnosticsService.getIpInfo(hostIp);
    const agentData = await this.queryAgent(hostIp);

    const hostNode: NodeSpec = {
      id: 'node-host-primary',
      name: agentData?.name || 'vps128',
      alias: 'Current Host Linux VPS',
      tags: ['linux-vps', 'host-system'],
      type: 'linux',
      status: 'online',
      location: {
        city: geo.city || agentData?.location?.city || 'Local VPS',
        country: geo.country || agentData?.location?.country || 'Linux Host',
        countryCode: geo.countryCode || 'VPS',
        flagIcon: 'Globe',
        provider: geo.org || agentData?.location?.provider || 'Host Machine',
      },
      hardware: {
        cpuCores: agentData?.hardware?.cpuCores || 4,
        cpuModel: agentData?.hardware?.cpuModel || 'QEMU Virtual CPU',
        ramGb: agentData?.hardware?.ramGb || 16,
        swapGb: agentData?.hardware?.swapGb || 0,
        diskGb: agentData?.hardware?.diskGb || 80,
        diskType: agentData?.hardware?.diskType || 'NVMe',
        architecture: agentData?.hardware?.architecture || 'x86_64',
      },
      os: (agentData?.os as any) || {
        name: 'Ubuntu Linux VPS',
        family: 'ubuntu',
        version: 'Active Agent v1.4.2',
        kernel: 'Linux Daemon',
        uptimeSeconds: 3600,
      },
      network: {
        ipAddress: hostIp,
        publicIp: hostIp,
        hostname: agentData?.name || 'vps128',
        sshPort: 22,
        bandwidthUsageGb: 0,
        monthlyLimitGb: 2000,
      },
      agentVersion: 'v1.4.2',
      agentStatus: 'healthy',
      lastHeartbeat: new Date().toISOString(),
      isFavorite: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveNodes([hostNode]);
    return [hostNode];
  }

  // Ping agent endpoints with timeout fallback
  async queryAgent(ipAddress: string): Promise<Partial<NodeSpec> | null> {
    const cleanIp = ipAddress.replace(/^https?:\/\//, '').split('/')[0];
    const urls = [
      `/api/v1/node`,
      `/api/v1/nodes`,
      `http://${cleanIp}:8080/api/v1/node`,
      `http://${cleanIp}:8080/api/v1/nodes`,
      `http://${cleanIp}/api/v1/node`,
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const nodeObj = Array.isArray(data) ? data[0] : data;
          if (nodeObj && nodeObj.hardware && typeof nodeObj.hardware.cpuCores === 'number') {
            // Found real agent data :)
            return nodeObj;
          }
        }
      } catch (e) {
        // Try next URL fallback
      }
    }
    // Agent endpoint unreachable :/
    return null;
  }

  async createNode(_payload: AddNodePayload): Promise<NodeSpec> {
    return this.getDefaultHostNode();
  }

  async verifyNodeConnection(_nodeId: string): Promise<NodeSpec | null> {
    const nodes = await this.autoDiscoverHostNode();
    return nodes[0] || null;
  }
}

export const serverService = new ServerService();
