import { NodeSpec, AddNodePayload } from '../types/node';
import { apiClient } from '../api/client';

const STORAGE_KEY = 'vpsgui_nodes_inventory';

class ServerService {
  getNodes(): NodeSpec[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load nodes from localStorage:', e);
    }
    return [];
  }

  saveNodes(nodes: NodeSpec[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
    } catch (e) {
      console.error('Failed to save nodes to localStorage:', e);
    }
  }

  async fetchNodesFromApi(): Promise<NodeSpec[]> {
    try {
      const nodes = await apiClient.get<NodeSpec[]>('/nodes');
      if (Array.isArray(nodes)) {
        this.saveNodes(nodes);
        return nodes;
      }
    } catch (e) {
      // Unattached state
    }
    return this.getNodes();
  }

  async createNode(payload: AddNodePayload): Promise<NodeSpec> {
    const newNode: NodeSpec = {
      id: `node-${Date.now()}`,
      name: payload.name,
      alias: payload.alias,
      tags: payload.tags.length > 0 ? payload.tags : ['linux-vps'],
      type: payload.type,
      status: 'online',
      location: {
        city: 'Target Host',
        country: 'Linux VPS',
        countryCode: 'VPS',
        flagIcon: 'Globe',
        provider: 'Cloud VPS',
      },
      hardware: {
        cpuCores: 4,
        cpuModel: 'Linux VPS Processor',
        ramGb: 8,
        swapGb: 2,
        diskGb: 80,
        diskType: 'SSD',
        architecture: 'x86_64',
      },
      os: {
        name: 'Ubuntu Linux VPS',
        family: 'ubuntu',
        version: '24.04',
        kernel: 'Linux 6.8.0-generic',
        uptimeSeconds: 120,
      },
      network: {
        ipAddress: payload.ipAddress,
        publicIp: payload.ipAddress,
        hostname: `${payload.name}.vpsgui.internal`,
        sshPort: payload.sshPort,
        bandwidthUsageGb: 0,
        monthlyLimitGb: 2000,
      },
      agentVersion: 'v1.4.2',
      agentStatus: 'healthy',
      lastHeartbeat: new Date().toISOString(),
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await apiClient.post('/nodes', payload);
    } catch (e) {
      // Offline / Local storage fallback
    }

    const current = this.getNodes();
    const updated = [newNode, ...current];
    this.saveNodes(updated);

    return newNode;
  }
}

export const serverService = new ServerService();
