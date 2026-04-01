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
  filePath?: string;
  [key: string]: unknown;
}

interface FolderNodeData {
  label: string;
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
    filePath?: string;
    folder?: string;
  }[];
  edges: { source: string; target: string; label?: string; type?: string }[];
  folders?: { id: string; label: string }[];
}

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  controller: { header: '#3b82f6', border: '#2563eb' },
  infrastructure: { header: '#f59e0b', border: '#d97706' },
  base: { header: '#6b7280', border: '#4b5563' },
  service: { header: '#10b981', border: '#059669' },
  model: { header: '#8b5cf6', border: '#7c3aed' },
  repository: { header: '#14b8a6', border: '#0d9488' },
};

const FOLDER_COLORS = [
  { bg: 'rgba(59,130,246,0.08)', border: '#2563eb' },
  { bg: 'rgba(16,185,129,0.08)', border: '#059669' },
  { bg: 'rgba(245,158,11,0.08)', border: '#d97706' },
  { bg: 'rgba(139,92,246,0.08)', border: '#7c3aed' },
  { bg: 'rgba(20,184,166,0.08)', border: '#0d9488' },
];

function FolderNode({ data }: NodeProps<Node<FolderNodeData>>) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 8, left: 12,
        color: '#94a3b8', padding: '4px 12px',
        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
        whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}>
        📂 {data.label}
      </div>
    </div>
  );
}

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
        {(data.methods ?? []).map((m, i) => <div key={i}>{m}</div>)}
      </div>

      {/* File path */}
      {data.filePath && (
        <div style={{
          borderTop: '1px solid #334155', padding: '4px 10px',
          color: '#64748b', fontSize: 10, fontStyle: 'italic',
          textAlign: 'center', wordBreak: 'break-all',
        }}>
          📁 {data.filePath.split('/').pop()}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.header }} />
    </div>
  );
}

const nodeTypes = { uml: UmlNode, folder: FolderNode };

function layoutGraph(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph({ compound: true }).setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  // Group nodes by folder
  const folderMap = new Map<string, typeof data.nodes>();
  const noFolder: typeof data.nodes = [];
  for (const n of data.nodes) {
    if (n.folder) {
      if (!folderMap.has(n.folder)) folderMap.set(n.folder, []);
      folderMap.get(n.folder)!.push(n);
    } else {
      noFolder.push(n);
    }
  }

  // Register folder groups in dagre
  const folders = data.folders ?? [];
  for (const f of folders) {
    g.setNode(f.id, { width: 1, height: 1 });
  }

  // Register all class nodes
  for (const n of data.nodes) {
    const methodCount = (n.methods ?? []).length;
    const attrCount = (n.attributes ?? []).length;
    const height = 50 + Math.max(attrCount, 1) * 18 + methodCount * 18 + (n.filePath ? 24 : 0);
    g.setNode(n.id, { width: 340, height });
    if (n.folder) {
      g.setParent(n.id, n.folder);
    }
  }

  data.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const nodes: Node[] = [];

  // Create folder container nodes
  for (const f of folders) {
    const children = folderMap.get(f.id) ?? [];
    if (children.length === 0) continue;

    // Calculate bounding box from children
    const paddingX = 50;
    const paddingY = 40;
    const titleHeight = 36;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of children) {
      const pos = g.node(c.id);
      const nodeInfo = g.node(c.id);
      minX = Math.min(minX, pos.x - nodeInfo.width / 2);
      minY = Math.min(minY, pos.y - nodeInfo.height / 2);
      maxX = Math.max(maxX, pos.x + nodeInfo.width / 2);
      maxY = Math.max(maxY, pos.y + nodeInfo.height / 2);
    }

    // Ensure folder is at least as wide as the label
    const labelWidth = f.label.length * 8 + 60;
    const contentWidth = maxX - minX + paddingX * 2;
    const folderWidth = Math.max(contentWidth, labelWidth);

    const folderIdx = folders.indexOf(f) % FOLDER_COLORS.length;
    const fc = FOLDER_COLORS[folderIdx];

    nodes.push({
      id: f.id,
      type: 'folder',
      position: { x: minX - paddingX, y: minY - paddingY - titleHeight },
      zIndex: -1,
      data: { label: f.label },
      style: {
        width: Math.max(folderWidth, 400),
        height: Math.max(maxY - minY + paddingY * 2 + titleHeight, 100),
        background: fc.bg,
        border: `2px dashed ${fc.border}`,
        borderRadius: 12,
        padding: 0,
      },
    });
  }

  // Create class nodes
  for (const n of data.nodes) {
    const pos = g.node(n.id);
    const folder = folders.find((f) => f.id === n.folder);
    let x = pos.x - 170;
    let y = pos.y;

    // If in a folder, make position relative to folder container
    if (folder) {
      const children = folderMap.get(folder.id) ?? [];
      const paddingX = 50;
      const paddingY = 40;
      const titleHeight = 36;
      let minX = Infinity, minY = Infinity;
      for (const c of children) {
        const cp = g.node(c.id);
        const ci = g.node(c.id);
        minX = Math.min(minX, cp.x - ci.width / 2);
        minY = Math.min(minY, cp.y - ci.height / 2);
      }
      x = pos.x - 170 - (minX - paddingX);
      y = pos.y - (minY - paddingY - titleHeight);
    }

    nodes.push({
      id: n.id,
      type: 'uml',
      position: { x, y },
      ...(n.folder ? { parentId: n.folder, expandParent: true } : {}),
      data: {
        className: n.className,
        stereotype: n.stereotype,
        attributes: n.attributes,
        methods: n.methods,
        group: n.group,
        filePath: n.filePath,
      },
    });
  }

  // Edge styles
  const EDGE_STYLES: Record<string, {
    stroke: string; dash?: string; animated?: boolean;
    markerType?: MarkerType;
  }> = {
    inherits:    { stroke: '#10b981',               markerType: MarkerType.Arrow },
    implements:  { stroke: '#60a5fa', dash: '6 4',  markerType: MarkerType.Arrow },
    call:        { stroke: '#f59e0b',               markerType: MarkerType.ArrowClosed, animated: true },
    uses:        { stroke: '#94a3b8', dash: '6 4',  markerType: MarkerType.Arrow },
    composition: { stroke: '#e879f9',               markerType: MarkerType.ArrowClosed },
    aggregation: { stroke: '#e879f9',               markerType: MarkerType.Arrow },
  };

  const edges: Edge[] = data.edges.map((e, i) => {
    const es = EDGE_STYLES[e.type ?? 'uses'] ?? EDGE_STYLES.uses;
    return {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: es.animated ?? false,
      style: {
        stroke: es.stroke,
        strokeDasharray: es.dash,
        strokeWidth: 1.5,
      },
      markerEnd: es.markerType ? { type: es.markerType, color: es.stroke, width: 20, height: 20 } : undefined,
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
    if (node.type === 'uml') {
      setClicked(`${(node.data as UmlNodeData).className}`);
    }
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
