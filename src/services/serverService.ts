import { NodeSpec, AddNodePayload } from '../types/node';
import { apiClient } from '../api/client';
import { diagnosticsService } from './diagnosticsService';

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
      if (Array.isArray(nodes) && nodes.length > 0) {
        this.saveNodes(nodes);
        return nodes;
      }
    } catch (e) {
      // Unattached state
    }
    return this.getNodes();
  }

  async createNode(payload: AddNodePayload): Promise<NodeSpec> {
    // 1. Attempt REST API POST request to central API Gateway
    try {
      const apiNode = await apiClient.post<NodeSpec>('/nodes', payload);
      if (apiNode && apiNode.id) {
        const current = this.getNodes();
        const updated = [apiNode, ...current];
        this.saveNodes(updated);
        return apiNode;
      }
    } catch (e) {
      // Backend REST agent endpoint unattached
    }

    // 2. Resolve real IP Geolocation from target IP
    const geo = await diagnosticsService.getIpInfo(payload.ipAddress);

    const isLocal =
      payload.ipAddress === '127.0.0.1' ||
      payload.ipAddress === 'localhost' ||
      (typeof window !== 'undefined' && payload.ipAddress === window.location.hostname);

    let newNode: NodeSpec;

    if (isLocal) {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0;
      const mem = typeof performance !== 'undefined' && (performance as any).memory
        ? Math.round((performance as any).memory.jsHeapSizeLimit / 1073741824)
        : 0;

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
          cpuModel: 'Local Host CPU',
          ramGb: mem,
          swapGb: 0,
          diskGb: 0,
          diskType: 'SSD',
          architecture: typeof navigator !== 'undefined' ? navigator.platform || 'x86_64' : 'x86_64',
        },
        os: {
          name: 'Local Host Environment',
          family: 'ubuntu',
          version: 'Self-Discovered',
          kernel: 'Local Kernel',
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
      // 3. Attempt direct HTTP query to vpsgui-agent running on target VPS IP (port 8080)
      let agentHardware = null;
      let agentOs = null;
      let agentActive = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`http://${payload.ipAddress}:8080/api/v1/node`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.hardware) {
            agentHardware = data.hardware;
            agentOs = data.os;
            agentActive = true;
          }
        }
      } catch (e) {
        // vpsgui-agent not responding on port 8080
      }

      newNode = {
        id: `node-${Date.now()}`,
        name: payload.name,
        alias: payload.alias,
        tags: payload.tags.length > 0 ? payload.tags : ['linux-vps'],
        type: payload.type,
        status: agentActive ? 'online' : 'offline',
        location: {
          city: geo.city || 'Target Server',
          country: geo.country || 'Linux VPS',
          countryCode: geo.countryCode || 'VPS',
          flagIcon: 'Globe',
          provider: geo.org || 'VPS Host',
        },
        hardware: agentHardware || {
          cpuCores: 0,
          cpuModel: 'Awaiting Agent Installation',
          ramGb: 0,
          swapGb: 0,
          diskGb: 0,
          diskType: 'SSD',
          architecture: 'x86_64',
        },
        os: agentOs || {
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
        agentVersion: agentActive ? 'v1.4.2' : 'unattached',
        agentStatus: agentActive ? 'healthy' : 'unreachable',
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

    // 1. Resolve real IP Geolocation for target VPS IP
    const geo = await diagnosticsService.getIpInfo(node.network.publicIp);

    // 2. Query target VPS agent endpoint http://ip:8080/api/v1/node
    let agentData: any = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://${node.network.publicIp}:8080/api/v1/node`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        agentData = await res.json();
      }
    } catch (e) {
      // Unattached agent
    }

    const updatedNode: NodeSpec = {
      ...node,
      status: agentData ? 'online' : node.status,
      agentStatus: agentData ? 'healthy' : node.agentStatus,
      location: {
        city: geo.city || node.location.city,
        country: geo.country || node.location.country,
        countryCode: geo.countryCode || node.location.countryCode,
        flagIcon: 'Globe',
        provider: geo.org || node.location.provider,
      },
      hardware: agentData?.hardware || node.hardware,
      os: agentData?.os || node.os,
      agentVersion: agentData ? 'v1.4.2' : node.agentVersion,
      updatedAt: new Date().toISOString(),
    };

    const updated = nodes.map((n) => (n.id === nodeId ? updatedNode : n));
    this.saveNodes(updated);
    return updatedNode;
  }
}

export const serverService = new ServerService();
