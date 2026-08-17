import { create } from 'zustand';
import { NodeSpec, AddNodePayload } from '../types/node';
import { serverService } from '../services/serverService';

interface ServerState {
  nodes: NodeSpec[];
  selectedNodeId: string | null;
  searchQuery: string;
  selectedTypeFilter: string | null;
  selectedStatusFilter: string | null;

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: string | null) => void;
  setStatusFilter: (status: string | null) => void;
  toggleFavorite: (id: string) => void;
  fetchNodesFromApi: () => Promise<void>;
  addNode: (payload: AddNodePayload) => Promise<NodeSpec>;
  verifyNodeConnection: (id: string) => Promise<boolean>;
  removeNode: (id: string) => void;
  rebootNode: (id: string) => Promise<{ success: boolean; message: string }>;
}

// Read the persisted inventory once. Calling getNodes() per field re-parsed localStorage and could
// re-persist the defaults twice on first load.
const initialNodes = serverService.getNodes();

export const useServerStore = create<ServerState>((set, get) => ({
  nodes: initialNodes,
  selectedNodeId: initialNodes[0]?.id ?? null,
  searchQuery: '',
  selectedTypeFilter: null,
  selectedStatusFilter: null,

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTypeFilter: (type) => set({ selectedTypeFilter: type }),
  setStatusFilter: (status) => set({ selectedStatusFilter: status }),

  toggleFavorite: (id) =>
    set((state) => {
      const updatedNodes = state.nodes.map((node) =>
        node.id === id ? { ...node, isFavorite: !node.isFavorite } : node
      );
      serverService.saveNodes(updatedNodes);
      return { nodes: updatedNodes };
    }),

  fetchNodesFromApi: async () => {
    const apiNodes = await serverService.autoDiscoverHostNode();
    if (apiNodes.length > 0) {
      set({
        nodes: apiNodes,
        selectedNodeId: get().selectedNodeId || apiNodes[0].id,
      });
    }
  },

  /**
   * Not supported — see serverService.createNode.
   *
   * This used to optimistically prepend the returned node, but saveNodes() truncates the inventory
   * to one entry, so the "added" node disappeared on the next load. It now surfaces the real
   * limitation instead of half-working.
   */
  addNode: async (payload) => serverService.createNode(payload),

  verifyNodeConnection: async (id) => {
    const updated = await serverService.verifyNodeConnection(id);
    if (updated) {
      set({ nodes: serverService.getNodes() });
      return true;
    }
    return false;
  },

  removeNode: (id) =>
    set((state) => {
      const updatedNodes = state.nodes.filter((node) => node.id !== id);
      serverService.saveNodes(updatedNodes);
      return {
        nodes: updatedNodes,
        selectedNodeId: state.selectedNodeId === id ? (updatedNodes[0]?.id || null) : state.selectedNodeId,
      };
    }),

  /**
   * Reboot the host for real, via the agent.
   *
   * This previously only rewrote local state — status to 'maintenance', uptime to 5 seconds — so
   * the UI reported a reboot that never happened and the fake uptime persisted to localStorage.
   * Callers must confirm with the user first; this issues an actual `systemctl reboot`.
   */
  rebootNode: async (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return { success: false, message: 'Unknown node' };

    const result = await serverService.rebootNode();
    if (result.success) {
      // The host is going down; mark it so until the next successful telemetry poll.
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, status: 'maintenance' as const } : n)),
      }));
    }
    return result;
  },
}));
