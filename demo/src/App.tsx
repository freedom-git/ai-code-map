import { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from 'dagre';

interface UmlNodeData {
  className: string;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  group?: string;
  [key: string]: unknown;
}

interface GraphData {
  nodes: {
    id: string;
    className: string;
    stereotype?: string;
    attributes?: string[];
    methods?: string[];
    group?: string;
  }[];
  edges: { source: string; target: string; label?: string; type?: string }[];
}

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  controller: { header: '#3b82f6', border: '#2563eb' },
  infrastructure: { header: '#f59e0b', border: '#d97706' },
  base: { header: '#6b7280', border: '#4b5563' },
};

function UmlNode({ data }: NodeProps<Node<UmlNodeData>>) {
  const colors = GROUP_COLORS[data.group ?? ''] ?? GROUP_COLORS.base;
  return (
    <div style={{
      background: '#1e293b', border: `2px solid ${colors.border}`,
      borderRadius: 6, minWidth: 280, fontFamily: 'monospace', fontSize: 12,
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.header }} />

      {/* Header */}
      <div style={{
        background: colors.header, color: '#fff', padding: '6px 12px',
        textAlign: 'center', fontWeight: 700, fontSize: 13,
      }}>
        {data.stereotype && (
          <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
            «{data.stereotype}»
          </div>
        )}
        {data.className}
      </div>

      {/* Attributes */}
      <div style={{ borderBottom: '1px solid #334155', padding: '6px 10px', color: '#94a3b8' }}>
        {(data.attributes ?? []).length === 0
          ? <div style={{ opacity: 0.4, fontStyle: 'italic' }}>—</div>
          : (data.attributes ?? []).map((a, i) => <div key={i}>+ {a}</div>)}
      </div>

      {/* Methods */}
      <div style={{ padding: '6px 10px', color: '#e2e8f0' }}>
        {(data.methods ?? []).map((m, i) => <div key={i}>+ {m}</div>)}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: colors.header }} />
    </div>
  );
}

const nodeTypes = { uml: UmlNode };

function layoutGraph(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  data.nodes.forEach((n) => {
    const methodCount = (n.methods ?? []).length;
    const attrCount = (n.attributes ?? []).length;
    const height = 50 + Math.max(attrCount, 1) * 18 + methodCount * 18;
    g.setNode(n.id, { width: 320, height });
  });
  data.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const nodes: Node[] = data.nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: 'uml',
      position: { x: pos.x - 160, y: pos.y },
      data: {
        className: n.className,
        stereotype: n.stereotype,
        attributes: n.attributes,
        methods: n.methods,
        group: n.group,
      },
    };
  });

  const EDGE_STYLES: Record<string, { stroke: string; dash?: string; marker: string }> = {
    inherits:   { stroke: '#10b981', dash: '6 3', marker: 'triangle' },
    implements: { stroke: '#10b981', dash: '4 2', marker: 'triangle' },
    call:       { stroke: '#f59e0b', marker: 'arrowclosed' },
    uses:       { stroke: '#94a3b8', dash: '4 4', marker: 'arrow' },
  };

  const edges: Edge[] = data.edges.map((e, i) => {
    const es = EDGE_STYLES[e.type ?? 'uses'] ?? EDGE_STYLES.uses;
    return {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.type === 'call',
      style: {
        stroke: es.stroke,
        strokeDasharray: es.dash,
      },
      markerEnd: {
        type: es.marker === 'triangle' ? MarkerType.ArrowClosed : MarkerType.ArrowClosed,
        color: es.stroke,
        width: 20,
        height: 20,
      },
      labelStyle: { fontSize: 11, fill: '#64748b' },
    };
  });

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
    setClicked(`${(node.data as UmlNodeData).className}`);
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
        nodeTypes={nodeTypes}
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
