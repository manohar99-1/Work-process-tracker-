import { useState, useMemo } from 'react'
import { useWorkItems, useDependencies, useMembers } from '../hooks/useData'
import { WorkItemCard, WorkItemForm } from '../components/WorkItem'
import { DependencyPanel } from '../components/DependencyPanel'
import { StatusBadge, PriorityBadge, ProgressBar, Spinner, EmptyState } from '../components/UI'
import { detectOverload, findBottlenecks } from '../lib/dependencyEngine'
import { useAuth } from '../context/AuthContext'
import ProcessFlow from '../components/ProcessFlow'

const VIEWS = ['Board', 'List', 'Flow']
const FILTERS = ['all', 'blocked', 'in-progress', 'done']

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const { items, loading: itemsLoading, refetch: refetchItems } = useWorkItems()
  const { deps, loading: depsLoading, refetch: refetchDeps } = useDependencies()
  const members = useMembers()

  const [view, setView] = useState('Board')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const refetch = () => { refetchItems(); refetchDeps() }

  const filtered = useMemo(() => items.filter(i => {
    if (filter !== 'all' && i.status !== filter) return false
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, filter, search])

  const overload = useMemo(() => detectOverload(items), [items])
  const bottlenecks = useMemo(() => findBottlenecks(deps, items), [deps, items])

  const stats = useMemo(() => ({
    total: items.length,
    done: items.filter(i => i.status === 'done').length,
    blocked: items.filter(i => i.status === 'blocked').length,
    inProgress: items.filter(i => i.status === 'in-progress').length,
  }), [items])

  const memberWorkload = useMemo(() => {
    return members.map(m => {
      const assigned = items.filter(i => i.assigned_to === m.id)
      const active = assigned.filter(i => i.status !== 'done')
      return { ...m, total: assigned.length, active: active.length, isOverloaded: overload[m.id] > 3 }
    }).filter(m => m.total > 0)
  }, [members, items, overload])

  if (itemsLoading || depsLoading) return <div className="page-center"><Spinner /></div>

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <span>NestUp</span>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">Workspace</span>
          {VIEWS.map(v => (
            <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'Board' ? '⊞' : v === 'List' ? '☰' : '⬡'} {v}
            </button>
          ))}
        </nav>

        <div className="sidebar-stats">
          <span className="nav-label">Overview</span>
          <div className="stat-row"><span>Total</span><span className="stat-val">{stats.total}</span></div>
          <div className="stat-row"><span>Done</span><span className="stat-val green">{stats.done}</span></div>
          <div className="stat-row"><span>Active</span><span className="stat-val blue">{stats.inProgress}</span></div>
          <div className="stat-row"><span>Blocked</span><span className="stat-val red">{stats.blocked}</span></div>
        </div>

        <div className="sidebar-section">
          <span className="nav-label">Members</span>
          {memberWorkload.map(m => (
            <div key={m.id} className="member-row">
              <span className="avatar sm">{m.name[0]}</span>
              <span className="member-name">{m.name}</span>
              <span className={`member-load ${m.isOverloaded ? 'overloaded' : ''}`}>
                {m.active} {m.isOverloaded ? '⚠' : ''}
              </span>
            </div>
          ))}
        </div>

        {bottlenecks.length > 0 && (
          <div className="sidebar-section">
            <span className="nav-label">⚠ Bottlenecks</span>
            {bottlenecks.slice(0, 3).map(b => (
              <div key={b.id} className="bottleneck-row" onClick={() => setSelectedItem(b)}>
                <span className="bottleneck-title">{b.title}</span>
                <span className="bottleneck-count">{b.blockingCount} waiting</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{profile?.name?.[0]}</span>
            <div>
              <div className="user-name">{profile?.name}</div>
              <div className="user-role">Admin</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="main-header">
          <div>
            <h1>Work Items</h1>
            <p className="main-subtitle">Track tasks, dependencies, and team progress</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
            + New Work Item
          </button>
        </div>

        {/* Filters */}
        <div className="toolbar">
          <div className="filter-tabs">
            {FILTERS.map(f => (
              <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.replace('-', ' ')}
                <span className="filter-count">{f === 'all' ? items.length : items.filter(i => i.status === f).length}</span>
              </button>
            ))}
          </div>
          <input
            className="search-input"
            placeholder="Search work items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Content area */}
        <div className={`content-area ${selectedItem ? 'has-detail' : ''}`}>
          <div className="items-area">
            {view === 'Flow' ? (
              <ProcessFlow items={items} deps={deps} />
            ) : view === 'Board' ? (
              <div className="board-columns">
                {['blocked', 'in-progress', 'done'].map(status => (
                  <div key={status} className="board-column">
                    <div className="column-header">
                      <StatusBadge status={status} />
                      <span className="column-count">{filtered.filter(i => i.status === status).length}</span>
                    </div>
                    <div className="column-items">
                      {filtered.filter(i => i.status === status).length === 0 ? (
                        <EmptyState icon="○" message="No items" />
                      ) : (
                        filtered.filter(i => i.status === status).map(item => (
                          <WorkItemCard
                            key={item.id}
                            item={item}
                            members={members}
                            deps={deps}
                            allItems={items}
                            onUpdate={refetch}
                            onSelect={setSelectedItem}
                            isSelected={selectedItem?.id === item.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="list-view">
                {filtered.length === 0 ? (
                  <EmptyState icon="○" message="No work items found" sub="Create one or adjust filters" />
                ) : (
                  filtered.map(item => (
                    <div key={item.id} className={`list-row ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                      <div className="list-row-left">
                        <PriorityBadge priority={item.priority} />
                        <span className="list-title">{item.title}</span>
                      </div>
                      <div className="list-row-right">
                        <ProgressBar value={item.progress} size="sm" />
                        <StatusBadge status={item.status} />
                        {item.assignee && <span className="assignee-chip sm"><span className="avatar sm">{item.assignee.name[0]}</span></span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedItem && (
            <div className="detail-panel">
              <div className="detail-header">
                <h3>{selectedItem.title}</h3>
                <div className="detail-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(selectedItem); setShowForm(true) }}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedItem(null)}>✕</button>
                </div>
              </div>

              <div className="detail-body">
                <div className="detail-badges">
                  <PriorityBadge priority={selectedItem.priority} />
                  <StatusBadge status={selectedItem.status} />
                </div>

                {selectedItem.description && <p className="detail-desc">{selectedItem.description}</p>}

                <div className="detail-section">
                  <label>Progress</label>
                  <ProgressBar value={selectedItem.progress} />
                </div>

                {selectedItem.assignee && (
                  <div className="detail-section">
                    <label>Assigned To</label>
                    <div className="assignee-chip">
                      <span className="avatar">{selectedItem.assignee.name[0]}</span>
                      <div>
                        <div>{selectedItem.assignee.name}</div>
                        <div className="user-role">{selectedItem.assignee.email}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.required_skills?.length > 0 && (
                  <div className="detail-section">
                    <label>Required Skills</label>
                    <div className="skills-row">
                      {selectedItem.required_skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
                    </div>
                  </div>
                )}

                {selectedItem.blocked_reason && (
                  <div className="detail-section">
                    <div className="blocked-reason">⚠ {selectedItem.blocked_reason}</div>
                  </div>
                )}

                <div className="detail-section">
                  <label>Dependencies</label>
                  <DependencyPanel
                    item={selectedItem}
                    allItems={items}
                    deps={deps}
                    onUpdate={refetch}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Forms */}
      {showForm && (
        <WorkItemForm
          item={editItem}
          members={members}
          onSave={refetch}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
