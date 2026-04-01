import { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from 'dagre';

interface GraphData {
  nodes: { id: string; label: string; group?: string }[];
  edges: { source: string; target: string; label?: string }[];
}

const GROUP_COLORS: Record<string, string> = {
  frontend: '#3b82f6',
  core: '#10b981',
  storage: '#f59e0b',
  infra: '#8b5cf6',
};

function layoutGraph(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  data.nodes.forEach((n) => g.setNode(n.id, { width: 180, height: 50 }));
  data.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const nodes: Node[] = data.nodes.map((n) => {
    const pos = g.node(n.id);
    const color = GROUP_COLORS[n.group ?? ''] ?? '#6b7280';
    return {
      id: n.id,
      position: { x: pos.x - 90, y: pos.y - 25 },
      data: { label: n.label },
      style: {
        background: color,
        color: '#fff',
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: '10px 16px',
        fontWeight: 600,
        fontSize: 14,
        minWidth: 150,
        textAlign: 'center' as const,
      },
    };
  });

  const edges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    style: { stroke: '#94a3b8' },
    labelStyle: { fontSize: 11, fill: '#64748b' },
  }));

  return { nodes, edges };
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clicked, setClicked] = useState<string | null>(null);

  useEffect(() => {
    fetch('/graph.json')
      .then((r) => r.json())
      .then((data: GraphData) => {
        const { nodes, edges } = layoutGraph(data);
        setNodes(nodes);
        setEdges(edges);
      });
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setClicked(`Clicked: ${node.data.label} (${node.id})`);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}>
      {clicked && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: '#1e293b', color: '#e2e8f0', padding: '8px 20px',
          borderRadius: 8, fontSize: 14, border: '1px solid #334155',
        }}>
          {clicked}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        colorMode="dark"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
