import { useServerStore } from '../store/useServerStore';

export function useNodes() {
  const {
    nodes,
    selectedNodeId,
    searchQuery,
    setSelectedNodeId,
    setSearchQuery,
    toggleFavorite,
    addNode,
    verifyNodeConnection,
    removeNode,
    rebootNode,
  } = useServerStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;

  return {
    nodes,
    selectedNode,
    selectedNodeId,
    searchQuery,
    setSelectedNodeId,
    setSearchQuery,
    toggleFavorite,
    addNode,
    verifyNodeConnection,
    removeNode,
    rebootNode,
  };
}
