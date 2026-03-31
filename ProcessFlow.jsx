import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const STATUS_COLORS = {
  'done': '#22c55e',
  'in-progress': '#3b82f6',
  'blocked': '#ef4444',
}

const PRIORITY_BORDER = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
}

function WorkItemNode({ data }) {
  const { item } = data
  return (
    <div style={{
      background: '#1e1e2e',
      border: `2px solid ${PRIORITY_BORDER[item.priority] || '#444'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      minWidth: '160px',
      maxWidth: '200px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
        <span style={{
          background: STATUS_COLORS[item.status] || '#666',
          color: '#fff',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>{item.status}</span>
        <span style={{ fontSize: '9px', color: '#888' }}>{item.priority}</span>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px', lineHeight: 1.3 }}>
        {item.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ flex: 1, height: '4px', background: '#333', borderRadius: '2px' }}>
          <div style={{
            width: `${item.progress}%`,
            height: '100%',
            background: item.progress >= 100 ? '#22c55e' : item.progress >= 60 ? '#3b82f6' : '#f97316',
            borderRadius: '2px',
          }} />
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{item.progress}%</span>
      </div>
      {item.assignee && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
          👤 {item.assignee.name}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { workItem: WorkItemNode }

function layoutNodes(items, deps) {
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))
  const inDegree = {}
  const adj = {}

  for (const item of items) {
    inDegree[item.id] = 0
    adj[item.id] = []
  }

  for (const dep of deps) {
    if (itemMap[dep.predecessor_id] && itemMap[dep.successor_id]) {
      adj[dep.predecessor_id].push(dep.successor_id)
      inDegree[dep.successor_id] = (inDegree[dep.successor_id] || 0) + 1
    }
  }

  const levels = {}
  items.forEach(i => { levels[i.id] = 0 })

  const queue = items.filter(i => inDegree[i.id] === 0).map(i => i.id)
  const visited = new Set(queue)
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]
    for (const next of (adj[cur] || [])) {
      levels[next] = Math.max(levels[next] || 0, (levels[cur] || 0) + 1)
      if (!visited.has(next)) { visited.add(next); queue.push(next) }
    }
  }

  const byLevel = {}
  for (const [id, level] of Object.entries(levels)) {
    if (!byLevel[level]) byLevel[level] = []
    byLevel[level].push(id)
  }

  const positions = {}
  const HGAP = 260, VGAP = 160
  for (const [level, ids] of Object.entries(byLevel)) {
    ids.forEach((id, idx) => {
      positions[id] = {
        x: parseInt(level) * HGAP,
        y: (idx - (ids.length - 1) / 2) * VGAP
      }
    })
  }
  return positions
}

export default function ProcessFlow({ items, deps }) {
  const positions = useMemo(() => layoutNodes(items, deps), [items, deps])

  const initialNodes = useMemo(() => items.map(item => ({
    id: item.id,
    type: 'workItem',
    position: positions[item.id] || { x: 0, y: 0 },
    data: { item },
  })), [items, positions])

  const initialEdges = useMemo(() => deps.map(dep => ({
    id: dep.id,
    source: dep.predecessor_id,
    target: dep.successor_id,
    label: dep.type === 'full' ? '100%' : `${dep.threshold}%`,
    labelStyle: { fill: '#94a3b8', fontSize: 10 },
    labelBgStyle: { fill: '#1e1e2e' },
    style: {
      stroke: dep.type === 'full' ? '#6366f1' : '#f97316',
      strokeWidth: 2,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: dep.type === 'full' ? '#6366f1' : '#f97316' },
    animated: dep.type === 'partial',
  })), [deps])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div style={{ width: '100%', height: '500px', background: '#0f0f1a', borderRadius: '12px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
      >
        <Background color="#2a2a3e" gap={20} />
        <Controls style={{ background: '#1e1e2e', border: '1px solid #333' }} />
        <MiniMap
          nodeColor={n => STATUS_COLORS[n.data?.item?.status] || '#666'}
          style={{ background: '#1e1e2e' }}
        />
      </ReactFlow>
      <div style={{ padding: '8px 16px', background: '#1e1e2e', borderTop: '1px solid #333', display: 'flex', gap: '16px', fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap' }}>
        <span>── Full dependency (purple)</span>
        <span>- - Partial dependency (orange)</span>
        <span style={{ color: '#22c55e' }}>● Done</span>
        <span style={{ color: '#3b82f6' }}>● In Progress</span>
        <span style={{ color: '#ef4444' }}>● Blocked</span>
      </div>
    </div>
  )
}
