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

//  Types 

interface UmlNodeData {
  className: string;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  group?: string;
  filePath?: string;
  traceStep?: number;
  traceMethod?: string;
  traceDesc?: string;
  [key: string]: unknown;
}

interface FolderNodeData {
  label: string;
  [key: string]: unknown;
}

interface MapData {
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

interface TraceStep {
  step: number;
  nodeId: string;
  method: string;
  description: string;
}

interface TraceData {
  name: string;
  description: string;
  steps: TraceStep[];
}

//  Colors 

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

//  Node Components 

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
         {data.label}
      </div>
    </div>
  );
}

function UmlNode({ data }: NodeProps<Node<UmlNodeData>>) {
  const colors = GROUP_COLORS[data.group ?? ''] ?? GROUP_COLORS.base;
  const isTraced = data.traceStep != null;
  return (
    <div style={{
      background: '#1e293b',
      border: isTraced ? '3px solid #ef4444' : `2px solid ${colors.border}`,
      borderRadius: 6, minWidth: 280, fontFamily: 'monospace', fontSize: 12,
      overflow: 'hidden', position: 'relative',
      boxShadow: isTraced ? '0 0 16px rgba(239,68,68,0.4)' : undefined,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.header }} />

      {/* Header */}
      <div style={{
        background: colors.header, color: '#fff', padding: '6px 12px',
        textAlign: 'center', fontWeight: 700, fontSize: 13,
      }}>
        {data.stereotype && (
          <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
            {data.stereotype}
          </div>
        )}
        {data.className}
      </div>

      {/* Attributes */}
      <div style={{ borderBottom: '1px solid #334155', padding: '6px 10px', color: '#94a3b8' }}>
        {(data.attributes ?? []).length === 0
          ? <div style={{ opacity: 0.4, fontStyle: 'italic' }}></div>
          : (data.attributes ?? []).map((a, i) => <div key={i}>+ {a}</div>)}
      </div>

      {/* Methods */}
      <div style={{ padding: '6px 10px', color: '#e2e8f0' }}>
        {(data.methods ?? []).map((m, i) => {
          const isTarget = isTraced && data.traceMethod && m.includes(data.traceMethod);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isTarget && (
                <span style={{
                  color: '#ef4444',
                  fontWeight: 900, fontSize: 13, fontFamily: 'sans-serif',
                  flexShrink: 0,
                }}>
                  {data.traceStep}
                </span>
              )}
              <span>{m}</span>
            </div>
          );
        })}
      </div>

      {/* File path */}
      {data.filePath && (
        <div style={{
          borderTop: '1px solid #334155', padding: '4px 10px',
          color: '#64748b', fontSize: 10, fontStyle: 'italic',
          textAlign: 'center', wordBreak: 'break-all',
        }}>
           {data.filePath.split('/').pop()}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.header }} />
    </div>
  );
}

const nodeTypes = { uml: UmlNode, folder: FolderNode };

//  Layout 

function layoutGraph(
  mapData: MapData,
  traceData: TraceData | null,
): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph({ compound: true }).setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  // Build trace lookup
  const traceStepMap = new Map<string, TraceStep>();
  if (traceData) {
    for (const s of traceData.steps) {
      traceStepMap.set(s.nodeId, s);
    }
  }

  // Group nodes by folder
  const folderMap = new Map<string, typeof mapData.nodes>();
  for (const n of mapData.nodes) {
    if (n.folder) {
      if (!folderMap.has(n.folder)) folderMap.set(n.folder, []);
      folderMap.get(n.folder)!.push(n);
    }
  }

  const folders = mapData.folders ?? [];
  for (const f of folders) {
    g.setNode(f.id, { width: 1, height: 1 });
  }

  for (const n of mapData.nodes) {
    const methodCount = (n.methods ?? []).length;
    const attrCount = (n.attributes ?? []).length;
    const hasTrace = traceStepMap.has(n.id);
    const height = 50 + Math.max(attrCount, 1) * 18 + methodCount * 18
      + (n.filePath ? 24 : 0) + (hasTrace ? 24 : 0);
    g.setNode(n.id, { width: 340, height });
    if (n.folder) g.setParent(n.id, n.folder);
  }

  mapData.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const nodes: Node[] = [];

  // Folder containers
  for (const f of folders) {
    const children = folderMap.get(f.id) ?? [];
    if (children.length === 0) continue;
    const paddingX = 50;
    const paddingY = 40;
    const titleHeight = 36;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of children) {
      const pos = g.node(c.id);
      minX = Math.min(minX, pos.x - pos.width / 2);
      minY = Math.min(minY, pos.y - pos.height / 2);
      maxX = Math.max(maxX, pos.x + pos.width / 2);
      maxY = Math.max(maxY, pos.y + pos.height / 2);
    }
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

  // Class nodes
  for (const n of mapData.nodes) {
    const pos = g.node(n.id);
    const folder = folders.find((f) => f.id === n.folder);
    let x = pos.x - 170;
    let y = pos.y;
    if (folder) {
      const children = folderMap.get(folder.id) ?? [];
      const paddingX = 50;
      const paddingY = 40;
      const titleHeight = 36;
      let minX = Infinity, minY = Infinity;
      for (const c of children) {
        const cp = g.node(c.id);
        minX = Math.min(minX, cp.x - cp.width / 2);
        minY = Math.min(minY, cp.y - cp.height / 2);
      }
      x = pos.x - 170 - (minX - paddingX);
      y = pos.y - (minY - paddingY - titleHeight);
    }
    const traceStep = traceStepMap.get(n.id);
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
        traceStep: traceStep?.step,
        traceMethod: traceStep?.method?.split('(')[0]?.split('.').pop(),
      },
    });
  }

  //  Edges 

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

  // Map edges (structural)
  const edges: Edge[] = mapData.edges.map((e, i) => {
    const es = EDGE_STYLES[e.type ?? 'uses'] ?? EDGE_STYLES.uses;
    return {
      id: `map-e-${i}`,
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

  // Trace edges (numbered call flow)
  if (traceData) {
    for (let i = 0; i < traceData.steps.length - 1; i++) {
      const from = traceData.steps[i];
      const to = traceData.steps[i + 1];
      edges.push({
        id: `trace-e-${i}`,
        source: from.nodeId,
        target: to.nodeId,
        label: `${to.step}. ${to.method}`,
        animated: true,
        zIndex: 10,
        style: {
          stroke: '#ef4444',
          strokeWidth: 3,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444', width: 24, height: 24 },
        labelStyle: { fontSize: 11, fill: '#fca5a5', fontWeight: 600 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 8,
      });
    }
  }

  return { nodes, edges };
}

//  App 

interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  description?: string;
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeTrace, setActiveTrace] = useState<string | null>(null);
  const [traceInfo, setTraceInfo] = useState<TraceData | null>(null);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [traceFiles, setTraceFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);

  // Load available projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: ProjectConfig[]) => {
        setProjects(data);
        if (data.length > 0) {
          setActiveProject(data[0].id);
        } else {
          setError('no-project');
        }
      })
      .catch(() => setError('no-project'));
  }, []);

  // Load traces for active project
  useEffect(() => {
    if (!activeProject) return;
    fetch(`/api/traces/${activeProject}`)
      .then(r => r.json())
      .then((data: string[]) => setTraceFiles(data))
      .catch(() => setTraceFiles([]));
  }, [activeProject]);

  // Load map + optional trace
  useEffect(() => {
    if (!activeProject) return;
    const loadData = async () => {
      try {
        const mapRes = await fetch(`/projects/${activeProject}/map.json`);
        if (!mapRes.ok) { setError('no-map'); return; }
        const mapData: MapData = await mapRes.json();

        let traceData: TraceData | null = null;
        if (activeTrace) {
          try {
            const traceRes = await fetch(`/projects/${activeProject}/traces/${activeTrace}.json`);
            traceData = await traceRes.json();
            setTraceInfo(traceData);
          } catch {
            setTraceInfo(null);
          }
        } else {
          setTraceInfo(null);
        }

        setError(null);
        const { nodes, edges } = layoutGraph(mapData, traceData);
        setNodes(nodes);
        setEdges(edges);
      } catch {
        setError('no-map');
      }
    };
    loadData();
  }, [activeProject, activeTrace]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'uml') {
      const d = node.data as UmlNodeData;
      setClicked(d.traceStep
        ? `Step ${d.traceStep}: ${d.className}`
        : d.className,
      );
    }
  }, []);

  const sidebarWidth = traceInfo ? 320 : 0;

  // No project found — show setup instructions
  if (error === 'no-project') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#e2e8f0', fontFamily: 'sans-serif',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>No project found</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Create a project folder in <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>projects/</code> with a <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>project.json</code> file.
          </p>
          <pre style={{
            background: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'left',
            fontSize: 13, color: '#94a3b8', marginTop: 16, border: '1px solid #334155',
          }}>{`projects/my-repo/
  project.json    ← { "name": "my-repo", "repoPath": "C:\\\\..." }
  map.json        ← generated by AI agent
  traces/         ← generated by AI agent`}</pre>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 16 }}>
            See <a href="https://github.com/freedom-git/ai-code-map" target="_blank" style={{ color: '#3b82f6' }}>README</a> for details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', display: 'flex' }}>

      {/* Left sidebar — trace steps */}
      {traceInfo && (
        <div style={{
          width: sidebarWidth, minWidth: sidebarWidth, height: '100vh',
          background: '#111827', borderRight: '1px solid #1f2937',
          overflowY: 'auto', padding: 0, flexShrink: 0,
        }}>
          {/* Trace header */}
          <div style={{
            padding: '16px 16px 12px', borderBottom: '1px solid #1f2937',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
              🔍 {traceInfo.name}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
              {traceInfo.description}
            </div>
          </div>

          {/* Steps list */}
          <div style={{ padding: '8px 0' }}>
            {traceInfo.steps.map((step) => (
              <div key={step.step} style={{
                display: 'flex', gap: 10, padding: '10px 16px',
                borderBottom: '1px solid #1f2937',
                cursor: 'default',
              }}>
                {/* Step number */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: '#ef4444', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 13, fontFamily: 'sans-serif',
                }}>
                  {step.step}
                </div>
                {/* Step info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                    fontFamily: 'monospace',
                  }}>
                    {step.method}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#9ca3af', marginTop: 2, lineHeight: 1.3,
                  }}>
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Close button */}
          <div style={{ padding: '12px 16px' }}>
            <button
              onClick={() => setActiveTrace(null)}
              style={{
                width: '100%', padding: '8px', borderRadius: 6,
                border: '1px solid #374151', background: '#1f2937',
                color: '#9ca3af', cursor: 'pointer', fontSize: 12,
              }}
            >
              ← Back to Map
            </button>
          </div>
        </div>
      )}

      {/* Right side — graph */}
      <div style={{ flex: 1, height: '100vh', position: 'relative' }}>

        {/* Project selector + mode switcher — top right */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 20,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {projects.length > 1 && (
            <select
              value={activeProject ?? ''}
              onChange={(e) => { setActiveProject(e.target.value); setActiveTrace(null); }}
              style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid #334155',
                background: '#1e293b', color: '#e2e8f0', fontSize: 12, cursor: 'pointer',
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setActiveTrace(null)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
              background: activeTrace === null ? '#3b82f6' : '#1e293b',
              color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            🗺️ Map
          </button>
          {traceFiles.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTrace(t)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
                background: activeTrace === t ? '#ef4444' : '#1e293b',
                color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              🔍 {t}
            </button>
          ))}
        </div>

        {/* Click toast */}
        {clicked && !traceInfo && (
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
    </div>
  );
}
