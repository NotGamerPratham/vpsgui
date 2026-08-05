import { NodeSpec, AddNodePayload } from '../types/node';
import { apiClient } from '../api/client';
import { diagnosticsService } from './diagnosticsService';

const STORAGE_KEY = 'vpsgui_nodes_inventory';

class ServerService {
  getDefaultHostNode(): NodeSpec {
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';

    return {
      id: 'node-host-primary',
      name: 'vps128',
      alias: 'Primary Linux VPS Host',
      tags: ['linux-vps', 'production', 'host-system'],
      type: 'linux',
      status: 'online',
      location: {
        city: 'Local VPS',
        country: 'Linux Host',
        countryCode: 'VPS',
        flagIcon: 'Globe',
        provider: 'Primary Host System',
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

  getNodes(): NodeSpec[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load nodes from localStorage:', e);
    }
    const defaultNode = this.getDefaultHostNode();
    this.saveNodes([defaultNode]);
    return [defaultNode];
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
      if (Array.isArray(nodes) && nodes.length > 0) {
        this.saveNodes(nodes);
        return nodes;
      }
    } catch (e) {
      // Unattached state
    }
    return this.autoDiscoverHostNode();
  }

  async autoDiscoverHostNode(): Promise<NodeSpec[]> {
    const currentNodes = this.getNodes();
    const hostIp = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';

    const geo = await diagnosticsService.getIpInfo(hostIp);
    const agentData = await this.queryAgent(hostIp);

    if (agentData && agentData.hardware) {
      const hostNode: NodeSpec = {
        id: currentNodes[0]?.id || 'node-host-primary',
        name: agentData.name || currentNodes[0]?.name || 'vps128',
        alias: 'Primary Linux VPS Host',
        tags: ['linux-vps', 'production', 'host-system'],
        type: 'linux',
        status: 'online',
        location: {
          city: geo.city || agentData.location?.city || 'Local VPS',
          country: geo.country || agentData.location?.country || 'Linux Host',
          countryCode: geo.countryCode || 'VPS',
          flagIcon: 'Globe',
          provider: geo.org || agentData.location?.provider || 'Primary Host System',
        },
        hardware: {
          cpuCores: agentData.hardware.cpuCores,
          cpuModel: agentData.hardware.cpuModel || 'QEMU Virtual CPU',
          ramGb: agentData.hardware.ramGb,
          swapGb: agentData.hardware.swapGb || 0,
          diskGb: agentData.hardware.diskGb || 80,
          diskType: agentData.hardware.diskType || 'NVMe',
          architecture: agentData.hardware.architecture || 'x86_64',
        },
        os: (agentData.os as any) || {
          name: 'Ubuntu Linux VPS',
          family: 'ubuntu',
          version: 'Active Agent v1.4.2',
          kernel: 'Linux Daemon',
          uptimeSeconds: 3600,
        },
        network: {
          ipAddress: hostIp,
          publicIp: hostIp,
          hostname: agentData.name || 'vps128',
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

      const updated = [hostNode, ...currentNodes.filter((n) => n.id !== hostNode.id)];
      this.saveNodes(updated);
      return updated;
    }

    return currentNodes;
  }

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
            return nodeObj;
          }
        }
      } catch (e) {
        // Continue to next endpoint
      }
    }
    return null;
  }

  async createNode(payload: AddNodePayload): Promise<NodeSpec> {
    try {
      const apiNode = await apiClient.post<NodeSpec>('/nodes', payload);
      if (apiNode && apiNode.id) {
        const current = this.getNodes();
        const updated = [apiNode, ...current];
        this.saveNodes(updated);
        return apiNode;
      }
    } catch (e) {}

    const geo = await diagnosticsService.getIpInfo(payload.ipAddress);
    const agentData = await this.queryAgent(payload.ipAddress);

    const isLocal =
      payload.ipAddress === '127.0.0.1' ||
      payload.ipAddress === 'localhost' ||
      (typeof window !== 'undefined' && payload.ipAddress === window.location.hostname);

    let newNode: NodeSpec;

    if (agentData && agentData.hardware) {
      newNode = {
        id: `node-${Date.now()}`,
        name: payload.name,
        alias: payload.alias,
        tags: payload.tags.length > 0 ? payload.tags : ['linux-vps'],
        type: payload.type,
        status: 'online',
        location: {
          city: geo.city || 'Data Center',
          country: geo.country || 'Linux Host',
          countryCode: geo.countryCode || 'VPS',
          flagIcon: 'Globe',
          provider: geo.org || 'Cloud Provider',
        },
        hardware: {
          cpuCores: agentData.hardware.cpuCores,
          cpuModel: agentData.hardware.cpuModel || 'Linux Processor',
          ramGb: agentData.hardware.ramGb,
          swapGb: agentData.hardware.swapGb || 0,
          diskGb: agentData.hardware.diskGb || 80,
          diskType: agentData.hardware.diskType || 'NVMe',
          architecture: agentData.hardware.architecture || 'x86_64',
        },
        os: (agentData.os as any) || {
          name: 'Linux Operating System',
          family: 'ubuntu',
          version: 'Active Agent v1.4.2',
          kernel: 'Linux Daemon',
          uptimeSeconds: 100,
        },
        network: {
          ipAddress: payload.ipAddress,
          publicIp: geo.ip || payload.ipAddress,
          hostname: `${payload.name}.internal`,
          sshPort: payload.sshPort,
          bandwidthUsageGb: 0,
          monthlyLimitGb: 0,
        },
        agentVersion: 'v1.4.2',
        agentStatus: 'healthy',
        lastHeartbeat: new Date().toISOString(),
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else if (isLocal) {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0;
      const mem = typeof performance !== 'undefined' && (performance as any).memory
        ? Math.round((performance as any).memory.jsHeapSizeLimit / 1073741824)
        : 0;
      const platformStr = typeof navigator !== 'undefined' ? navigator.platform || 'x86_64' : 'x86_64';
      const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : 'Local System';

      newNode = {
        id: `node-${Date.now()}`,
        name: payload.name,
        alias: payload.alias,
        tags: payload.tags.length > 0 ? payload.tags : ['local-vps'],
        type: payload.type,
        status: 'online',
        location: {
          city: geo.city || 'Local Host',
          country: geo.country || 'Self Hosted',
          countryCode: geo.countryCode || 'LOC',
          flagIcon: 'Globe',
          provider: geo.org || 'Local Machine',
        },
        hardware: {
          cpuCores: cores,
          cpuModel: `${platformStr} Host Processor`,
          ramGb: mem,
          swapGb: 0,
          diskGb: 0,
          diskType: 'SSD',
          architecture: platformStr,
        },
        os: {
          name: userAgentStr.slice(0, 30),
          family: 'ubuntu',
          version: 'Self-Discovered',
          kernel: 'Host System',
          uptimeSeconds: Math.round(performance.now() / 1000),
        },
        network: {
          ipAddress: payload.ipAddress,
          publicIp: geo.ip || payload.ipAddress,
          hostname: `${payload.name}.vpsgui.local`,
          sshPort: payload.sshPort,
          bandwidthUsageGb: 0,
          monthlyLimitGb: 0,
        },
        agentVersion: 'v1.4.2',
        agentStatus: 'healthy',
        lastHeartbeat: new Date().toISOString(),
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      newNode = {
        id: `node-${Date.now()}`,
        name: payload.name,
        alias: payload.alias,
        tags: payload.tags.length > 0 ? payload.tags : ['linux-vps'],
        type: payload.type,
        status: 'offline',
        location: {
          city: geo.city || 'Target Server',
          country: geo.country || 'Linux VPS',
          countryCode: geo.countryCode || 'VPS',
          flagIcon: 'Globe',
          provider: geo.org || 'VPS Host',
        },
        hardware: {
          cpuCores: 0,
          cpuModel: 'Unattached Agent',
          ramGb: 0,
          swapGb: 0,
          diskGb: 0,
          diskType: 'SSD',
          architecture: 'x86_64',
        },
        os: {
          name: 'Linux VPS (Agent Not Detected)',
          family: 'ubuntu',
          version: 'Unattached',
          kernel: 'Unknown',
          uptimeSeconds: 0,
        },
        network: {
          ipAddress: payload.ipAddress,
          publicIp: payload.ipAddress,
          hostname: `${payload.name}.vpsgui.target`,
          sshPort: payload.sshPort,
          bandwidthUsageGb: 0,
          monthlyLimitGb: 0,
        },
        agentVersion: 'unattached',
        agentStatus: 'unreachable',
        lastHeartbeat: new Date().toISOString(),
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const current = this.getNodes();
    const updated = [newNode, ...current];
    this.saveNodes(updated);

    return newNode;
  }

  async verifyNodeConnection(nodeId: string): Promise<NodeSpec | null> {
    const nodes = this.getNodes();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const geo = await diagnosticsService.getIpInfo(node.network.publicIp);
    const agentData = await this.queryAgent(node.network.publicIp);

    if (agentData && agentData.hardware) {
      const updatedNode: NodeSpec = {
        ...node,
        status: 'online',
        agentStatus: 'healthy',
        location: {
          city: geo.city || node.location.city,
          country: geo.country || node.location.country,
          countryCode: geo.countryCode || node.location.countryCode,
          flagIcon: 'Globe',
          provider: geo.org || node.location.provider,
        },
        hardware: {
          cpuCores: agentData.hardware.cpuCores,
          cpuModel: agentData.hardware.cpuModel || node.hardware.cpuModel,
          ramGb: agentData.hardware.ramGb,
          swapGb: agentData.hardware.swapGb || 0,
          diskGb: agentData.hardware.diskGb || 80,
          diskType: agentData.hardware.diskType || 'NVMe',
          architecture: agentData.hardware.architecture || 'x86_64',
        },
        os: (agentData.os as any) || node.os,
        agentVersion: 'v1.4.2',
        updatedAt: new Date().toISOString(),
      };

      const updated = nodes.map((n) => (n.id === nodeId ? updatedNode : n));
      this.saveNodes(updated);
      return updatedNode;
    }

    return null;
  }
}

export const serverService = new ServerService();
