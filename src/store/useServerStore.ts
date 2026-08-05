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
  rebootNode: (id: string) => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  nodes: serverService.getNodes(),
  selectedNodeId: serverService.getNodes()[0]?.id || null,
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
    const apiNodes = await serverService.fetchNodesFromApi();
    if (apiNodes.length > 0) {
      set({
        nodes: apiNodes,
        selectedNodeId: get().selectedNodeId || apiNodes[0].id,
      });
    }
  },

  addNode: async (payload) => {
    const newNode = await serverService.createNode(payload);
    set((state) => ({
      nodes: [newNode, ...state.nodes],
      selectedNodeId: newNode.id,
    }));
    return newNode;
  },

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

  rebootNode: (id) =>
    set((state) => {
      const updatedNodes = state.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              status: 'maintenance' as const,
              os: { ...node.os, uptimeSeconds: 5 },
            }
          : node
      );
      serverService.saveNodes(updatedNodes);
      return { nodes: updatedNodes };
    }),
}));
