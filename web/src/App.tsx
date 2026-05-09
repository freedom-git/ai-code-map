import { useEffect, useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
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

interface TraceHit {
  step: number;
  method: string;
}

interface UmlNodeData {
  className: string;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  
  group?: string;
  filePath?: string;
  traceStep?: number;
  traceMethod?: string;
  traceHits?: TraceHit[];
  traceDesc?: string;
  [key: string]: unknown;
}

interface FolderNodeData {
  label: string;
  [key: string]: unknown;
}

interface MapNode {
  id: string;
  className: string;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  group?: string;
  filePath?: string;
  folder?: string;
  x?: number;
  y?: number;
}

interface FolderDef {
  id: string;
  label: string;
  parent?: string;
  x?: number;
  y?: number;
}

interface MapData {
  nodes: MapNode[];
  edges: { source: string; target: string; label?: string; type?: string }[];
  folders?: FolderDef[];
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
  positions?: Record<string, { x: number; y: number }>;
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
  const isStart = data.traceStep === 1;
  return (
    <div style={{
      background: '#1e293b',
      border: isTraced ? '3px solid #ef4444' : `2px solid ${colors.border}`,
      borderRadius: 6, minWidth: 280, fontFamily: 'monospace', fontSize: 12,
      overflow: 'visible', position: 'relative',
      boxShadow: isTraced ? '0 0 16px rgba(239,68,68,0.4)' : undefined,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.header }} />

      {/* START badge for trace step 1 */}
      {isStart && (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          background: '#ef4444', color: '#fff', padding: '2px 12px',
          borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1,
          whiteSpace: 'nowrap', fontFamily: 'sans-serif',
          boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
        }}>
          🚀 START
        </div>
      )}

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
          // Find all trace hits that match this method
          const methodName = m.split('(')[0]?.split('.').pop()?.replace(/^[+\-#~]\s*/, '').trim();
          const hits = (data.traceHits ?? []).filter((h) => {
            const hitMethod = h.method.split('(')[0]?.split('.').pop();
            return hitMethod && methodName && methodName === hitMethod;
          });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {hits.length > 0 && (
                <span style={{
                  color: '#ef4444',
                  fontWeight: 900, fontSize: 13, fontFamily: 'sans-serif',
                  flexShrink: 0,
                }}>
                  {hits.map((h) => h.step).join(',')}
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

//  Position Persistence

type PositionMap = Record<string, { x: number; y: number }>;

async function savePositions(
  projectId: string,
  traceName: string | null,
  nodes: Node[],
): Promise<void> {
  const positions: PositionMap = {};
  for (const n of nodes) {
    positions[n.id] = { x: n.position.x, y: n.position.y };
  }
  try {
    if (traceName) {
      await fetch(`/api/save-positions/${projectId}/trace/${traceName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positions),
      });
    } else {
      await fetch(`/api/save-positions/${projectId}/map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positions),
      });
    }
  } catch { /* ignore */ }
}

function loadPositionsFromMap(mapData: MapData): PositionMap | null {
  const positions: PositionMap = {};
  let found = false;
  for (const n of mapData.nodes) {
    if (n.x != null && n.y != null) {
      positions[n.id] = { x: n.x, y: n.y };
      found = true;
    }
  }
  for (const f of mapData.folders ?? []) {
    if (f.x != null && f.y != null) {
      positions[f.id] = { x: f.x, y: f.y };
      found = true;
    }
  }
  return found ? positions : null;
}

function loadPositionsFromTrace(traceData: TraceData): PositionMap | null {
  return traceData.positions ?? null;
}

function applyPositions(nodes: Node[], saved: PositionMap): Node[] {
  return nodes.map((n) => {
    const pos = saved[n.id];
    if (pos) {
      return { ...n, position: { x: pos.x, y: pos.y } };
    }
    return n;
  });
}

function recalcFolderBounds(nodes: Node[]): Node[] {
  const padding = 50;

  const byId = new Map<string, Node>();
  for (const n of nodes) byId.set(n.id, n);

  // Group children by direct parentId
  const childrenOf = new Map<string, Node[]>();
  for (const n of nodes) {
    const parentId = (n as Node & { parentId?: string }).parentId;
    if (parentId) {
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(n);
    }
  }

  // Depth = parent-chain length, with cycle protection
  const depthOf = (n: Node): number => {
    let depth = 0;
    let current: Node | undefined = n;
    const seen = new Set<string>();
    while (current && (current as Node & { parentId?: string }).parentId) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      const pid = (current as Node & { parentId?: string }).parentId!;
      const parent = byId.get(pid);
      if (!parent) break;
      depth++;
      current = parent;
      if (depth > 100) break;
    }
    return depth;
  };

  // Process folders deepest-first so a parent reads its child folder's
  // already-recomputed size when computing its own bounds.
  const folders = nodes.filter((n) => n.type === 'folder');
  folders.sort((a, b) => depthOf(b) - depthOf(a));

  const updatedSizes = new Map<string, { width: number; height: number }>();

  for (const f of folders) {
    const children = childrenOf.get(f.id);
    if (!children || children.length === 0) continue;
    let maxRight = 0;
    let maxBottom = 0;
    for (const c of children) {
      let w: number;
      let h: number;
      if (c.type === 'folder') {
        const updated = updatedSizes.get(c.id);
        const styleW = typeof c.style?.width === 'number' ? c.style.width : 0;
        const styleH = typeof c.style?.height === 'number' ? c.style.height : 0;
        w = updated?.width ?? styleW;
        h = updated?.height ?? styleH;
      } else {
        w = c.measured?.width ?? 340;
        h = c.measured?.height ?? 150;
      }
      maxRight = Math.max(maxRight, c.position.x + w);
      maxBottom = Math.max(maxBottom, c.position.y + h);
    }
    updatedSizes.set(f.id, { width: maxRight + padding, height: maxBottom + padding });
  }

  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    const sz = updatedSizes.get(n.id);
    if (!sz) return n;
    return { ...n, style: { ...n.style, width: sz.width, height: sz.height } };
  });
}

//  Layout

function layoutGraph(
  mapData: MapData,
  traceData: TraceData | null,
): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph({ compound: true }).setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  // Trace lookup — collect ALL steps per node (a node may appear multiple times)
  const traceHitsMap = new Map<string, TraceHit[]>();
  if (traceData) {
    for (const s of traceData.steps) {
      if (!traceHitsMap.has(s.nodeId)) traceHitsMap.set(s.nodeId, []);
      traceHitsMap.get(s.nodeId)!.push({ step: s.step, method: s.method });
    }
  }

  // Folder hierarchy 
  const folders = mapData.folders ?? [];
  const folderById = new Map(folders.map((f) => [f.id, f] as const));

  // Validate parent references and detect cycles. A folder whose parent
  // chain contains itself or a missing id is treated as a root for safety.
  const folderDepth = (id: string): number => {
    let depth = 0;
    let current = folderById.get(id);
    const seen = new Set<string>();
    while (current?.parent) {
      if (seen.has(current.id)) return depth;
      seen.add(current.id);
      const next = folderById.get(current.parent);
      if (!next) break;
      current = next;
      depth++;
      if (depth > 100) break;
    }
    return depth;
  };

  // parent folder id -> direct child folder ids
  const childFoldersOf = new Map<string, string[]>();
  for (const f of folders) {
    if (f.parent && folderById.has(f.parent)) {
      if (!childFoldersOf.has(f.parent)) childFoldersOf.set(f.parent, []);
      childFoldersOf.get(f.parent)!.push(f.id);
    }
  }

  // folder id -> direct class child nodes
  const classChildrenOf = new Map<string, typeof mapData.nodes>();
  for (const n of mapData.nodes) {
    if (n.folder && folderById.has(n.folder)) {
      if (!classChildrenOf.has(n.folder)) classChildrenOf.set(n.folder, []);
      classChildrenOf.get(n.folder)!.push(n);
    }
  }

  // Dagre setup: register every folder + every class, then wire compound parents.
  for (const f of folders) {
    g.setNode(f.id, { width: 1, height: 1 });
  }
  for (const f of folders) {
    if (f.parent && folderById.has(f.parent)) g.setParent(f.id, f.parent);
  }

  for (const n of mapData.nodes) {
    const methodCount = (n.methods ?? []).length;
    const attrCount = (n.attributes ?? []).length;
    const hasTrace = traceHitsMap.has(n.id);
    const height = 50 + Math.max(attrCount, 1) * 18 + methodCount * 18
      + (n.filePath ? 24 : 0) + (hasTrace ? 24 : 0);
    g.setNode(n.id, { width: 340, height });
    if (n.folder && folderById.has(n.folder)) g.setParent(n.id, n.folder);
  }

  mapData.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  // Compute absolute (Dagre-space) bounds for every folder, leaves-first.
  // A folder's children may be class nodes OR nested folder containers.
  const paddingX = 50;
  const paddingY = 40;
  const titleHeight = 36;
  type AbsBounds = { x: number; y: number; width: number; height: number };
  const folderAbs = new Map<string, AbsBounds>();

  const sortedFolders = [...folders].sort(
    (a, b) => folderDepth(b.id) - folderDepth(a.id),
  );

  for (const f of sortedFolders) {
    const classChildren = classChildrenOf.get(f.id) ?? [];
    const childFolderIds = childFoldersOf.get(f.id) ?? [];
    if (classChildren.length === 0 && childFolderIds.length === 0) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of classChildren) {
      const pos = g.node(c.id);
      minX = Math.min(minX, pos.x - pos.width / 2);
      minY = Math.min(minY, pos.y - pos.height / 2);
      maxX = Math.max(maxX, pos.x + pos.width / 2);
      maxY = Math.max(maxY, pos.y + pos.height / 2);
    }
    for (const cfId of childFolderIds) {
      const cf = folderAbs.get(cfId);
      if (!cf) continue;
      minX = Math.min(minX, cf.x);
      minY = Math.min(minY, cf.y);
      maxX = Math.max(maxX, cf.x + cf.width);
      maxY = Math.max(maxY, cf.y + cf.height);
    }

    const labelWidth = f.label.length * 8 + 60;
    const contentWidth = maxX - minX + paddingX * 2;
    const folderWidth = Math.max(contentWidth, labelWidth);
    const folderHeight = maxY - minY + paddingY * 2 + titleHeight;
    folderAbs.set(f.id, {
      x: minX - paddingX,
      y: minY - paddingY - titleHeight,
      width: folderWidth,
      height: folderHeight,
    });
  }

  const nodes: Node[] = [];

  // Emit folder containers shallowest-first so React Flow sees parents
  // before their nested folder/class children.
  const foldersForEmit = [...folders].sort(
    (a, b) => folderDepth(a.id) - folderDepth(b.id),
  );
  for (const f of foldersForEmit) {
    const abs = folderAbs.get(f.id);
    if (!abs) continue;
    const parentAbs = f.parent ? folderAbs.get(f.parent) : undefined;
    const px = parentAbs ? abs.x - parentAbs.x : abs.x;
    const py = parentAbs ? abs.y - parentAbs.y : abs.y;
    const depth = folderDepth(f.id);
    const folderIdx = folders.indexOf(f) % FOLDER_COLORS.length;
    const fc = FOLDER_COLORS[folderIdx];
    nodes.push({
      id: f.id,
      type: 'folder',
      position: { x: px, y: py },
      ...(parentAbs ? { parentId: f.parent, expandParent: true } : {}),
      zIndex: -100 + depth,
      data: { label: f.label },
      style: {
        width: abs.width,
        height: abs.height,
        background: fc.bg,
        border: `2px dashed ${fc.border}`,
        borderRadius: 12,
        padding: 0,
      },
    });
  }

  // Class nodes — position relative to their direct folder (if any).
  for (const n of mapData.nodes) {
    const pos = g.node(n.id);
    const abs = n.folder ? folderAbs.get(n.folder) : undefined;
    const x = abs ? pos.x - 170 - abs.x : pos.x - 170;
    const y = abs ? pos.y - abs.y : pos.y;
    const traceHits = traceHitsMap.get(n.id);
    nodes.push({
      id: n.id,
      type: 'uml',
      position: { x, y },
      ...(abs ? { parentId: n.folder, expandParent: true } : {}),
      data: {
        className: n.className,
        stereotype: n.stereotype,
        attributes: n.attributes,
        methods: n.methods,
        group: n.group,
        filePath: n.filePath,
        traceStep: traceHits?.[0]?.step,
        traceMethod: traceHits?.[0]?.method?.split('(')[0]?.split('.').pop(),
        traceHits: traceHits ?? [],
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

  // Trace edges (numbered call flow) — skip self-loops (same node), numbers show inline
  if (traceData) {
    for (let i = 0; i < traceData.steps.length - 1; i++) {
      const from = traceData.steps[i];
      const to = traceData.steps[i + 1];
      if (from.nodeId === to.nodeId) continue;
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
  const { fitView } = useReactFlow();
  const [activeTrace, setActiveTrace] = useState<string | null>(null);
  const [traceInfo, setTraceInfo] = useState<TraceData | null>(null);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [traceFiles, setTraceFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const skipSaveRef = useRef(false);
  const prevViewRef = useRef<{ project: string | null; trace: string | null }>({ project: null, trace: null });
  const nodesRef = useRef<Node[]>([]);
  // Tracks which project's trace state has been restored from localStorage. Used to
  // suppress the "persist trace" effect from firing with the previous project's trace
  // value during a project switch (before the trace-list effect resolves).
  const loadedProjectRef = useRef<string | null>(null);

  // Load available projects (restoring last selection from localStorage)
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: ProjectConfig[]) => {
        setProjects(data);
        if (data.length > 0) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('code-insight:lastProject') : null;
          const initial = saved && data.some(p => p.id === saved) ? saved : data[0].id;
          setActiveProject(initial);
        } else {
          setError('no-project');
        }
      })
      .catch(() => setError('no-project'));
  }, []);

  // Persist active project on change
  useEffect(() => {
    if (activeProject) localStorage.setItem('code-insight:lastProject', activeProject);
  }, [activeProject]);

  // Load traces for active project (restoring last trace for this project from localStorage)
  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    fetch(`/api/traces/${activeProject}`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (cancelled) return;
        setTraceFiles(data);
        const savedTrace = localStorage.getItem(`code-insight:lastTrace:${activeProject}`);
        setActiveTrace(savedTrace && data.includes(savedTrace) ? savedTrace : null);
        loadedProjectRef.current = activeProject;
      })
      .catch(() => {
        if (cancelled) return;
        setTraceFiles([]);
        setActiveTrace(null);
        loadedProjectRef.current = activeProject;
      });
    return () => { cancelled = true; };
  }, [activeProject]);

  // Persist active trace per-project. Skipped while a project switch is in flight
  // (loadedProjectRef won't match activeProject until the trace-list effect resolves),
  // so we never accidentally write the old project's trace under the new project's key.
  useEffect(() => {
    if (!activeProject || loadedProjectRef.current !== activeProject) return;
    const key = `code-insight:lastTrace:${activeProject}`;
    if (activeTrace) localStorage.setItem(key, activeTrace);
    else localStorage.removeItem(key);
  }, [activeProject, activeTrace]);

  // Load map + optional trace
  useEffect(() => {
    if (!activeProject) return;

    // Save positions of the previous view before switching (skip on reset)
    const prev = prevViewRef.current;
    if (!skipSaveRef.current && prev.project && nodesRef.current.length > 0) {
      savePositions(prev.project, prev.trace, nodesRef.current);
    }
    skipSaveRef.current = false;

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
        let { nodes: newNodes, edges } = layoutGraph(mapData, traceData);

        // Restore saved positions — use trace positions if available, fall back to map
        const mapPositions = loadPositionsFromMap(mapData);
        const tracePositions = activeTrace && traceData ? loadPositionsFromTrace(traceData) : null;
        if (tracePositions) {
          newNodes = applyPositions(newNodes, tracePositions);
        } else if (mapPositions) {
          newNodes = applyPositions(newNodes, mapPositions);
        }
        newNodes = recalcFolderBounds(newNodes);

        setNodes(newNodes);
        setEdges(edges);
        nodesRef.current = newNodes;

        // Track current view for next switch
        prevViewRef.current = { project: activeProject, trace: activeTrace };
      } catch {
        setError('no-map');
      }
    };
    loadData();
  }, [activeProject, activeTrace, reloadCounter]);

  const onNodeDragStop = useCallback(() => {
    // Read latest node state after drag (includes folder + child position updates)
    setNodes((current) => {
      nodesRef.current = current;
      if (activeProject) {
        savePositions(activeProject, activeTrace, current);
      }
      return current;
    });
  }, [activeProject, activeTrace, setNodes]);

  const resetTracePositions = useCallback(async () => {
    if (!activeProject || !activeTrace) return;
    try {
      await fetch(`/api/save-positions/${activeProject}/trace/${activeTrace}`, {
        method: 'DELETE',
      });
      skipSaveRef.current = true;
      setReloadCounter(c => c + 1);
    } catch { /* ignore */ }
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

  const focusNode = useCallback((nodeId: string) => {
    fitView({ nodes: [{ id: nodeId }], duration: 500, padding: 0.3 });
  }, [fitView]);

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
                cursor: 'pointer',
              }}
              onClick={() => focusNode(step.nodeId)}
            >
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

          {/* Buttons */}
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={resetTracePositions}
              style={{
                width: '100%', padding: '8px', borderRadius: 6,
                border: '1px solid #374151', background: '#1f2937',
                color: '#9ca3af', cursor: 'pointer', fontSize: 12,
              }}
            >
              ↺ Reset Positions
            </button>
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
              onChange={(e) => setActiveProject(e.target.value)}
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
          onNodeDragStop={onNodeDragStop}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
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
