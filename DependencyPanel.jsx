import { useState } from 'react'
import { addDependency, removeDependency } from '../hooks/useData'
import { getBlockers, getDownstream } from '../lib/dependencyEngine'
import { Modal, StatusBadge, ProgressBar } from './UI'

export function DependencyPanel({ item, allItems, deps, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ predecessorId: '', type: 'full', threshold: 100 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const blockers = getBlockers(item.id, deps, allItems)
  const downstream = getDownstream(item.id, deps, allItems)

  // Direct predecessors and successors
  const inDeps = deps.filter(d => d.successor_id === item.id)
  const outDeps = deps.filter(d => d.predecessor_id === item.id)
  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]))

  // Items available to add as predecessors (not already linked, not self)
  const available = allItems.filter(i =>
    i.id !== item.id &&
    !inDeps.find(d => d.predecessor_id === i.id) &&
    !outDeps.find(d => d.successor_id === i.id)
  )

  async function addDep(e) {
    e.preventDefault()
    if (!form.predecessorId) return
    setLoading(true); setError('')

    const { error } = await addDependency(
      form.predecessorId,
      item.id,
      form.type,
      parseInt(form.threshold),
      deps
    )

    if (error) setError(error.message)
    else { setShowAdd(false); setForm({ predecessorId: '', type: 'full', threshold: 100 }); onUpdate() }
    setLoading(false)
  }

  async function removeDep(depId) {
    if (!confirm('Remove this dependency?')) return
    await removeDependency(depId)
    onUpdate()
  }

  return (
    <div className="dep-panel">
      <div className="dep-section">
        <div className="dep-section-header">
          <h4>Blocked By <span className="dep-count">{inDeps.length}</span></h4>
          <button className="btn btn-xs btn-ghost" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>

        {inDeps.length === 0 ? (
          <p className="dep-empty">No incoming dependencies</p>
        ) : (
          inDeps.map(dep => {
            const pred = itemMap[dep.predecessor_id]
            if (!pred) return null
            const met = dep.type === 'full' ? pred.progress >= 100 : pred.progress >= dep.threshold
            return (
              <div key={dep.id} className={`dep-item ${met ? 'dep-met' : 'dep-unmet'}`}>
                <div className="dep-item-info">
                  <span className="dep-item-title">{pred.title}</span>
                  <StatusBadge status={pred.status} />
                  <span className="dep-type-badge">
                    {dep.type === 'full' ? '100% required' : `${dep.threshold}% required`}
                  </span>
                </div>
                <ProgressBar value={pred.progress} size="sm" />
                <div className="dep-item-actions">
                  <span className={`dep-status-dot ${met ? 'met' : 'unmet'}`}>
                    {met ? '✓ Met' : '✗ Blocking'}
                  </span>
                  <button className="btn btn-xs btn-danger" onClick={() => removeDep(dep.id)}>Remove</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="dep-section">
        <div className="dep-section-header">
          <h4>Blocking <span className="dep-count">{outDeps.length}</span></h4>
        </div>

        {outDeps.length === 0 ? (
          <p className="dep-empty">Not blocking any items</p>
        ) : (
          outDeps.map(dep => {
            const succ = itemMap[dep.successor_id]
            if (!succ) return null
            return (
              <div key={dep.id} className="dep-item">
                <div className="dep-item-info">
                  <span className="dep-item-title">{succ.title}</span>
                  <StatusBadge status={succ.status} />
                  <span className="dep-type-badge">
                    {dep.type === 'full' ? '100% required' : `${dep.threshold}% required`}
                  </span>
                </div>
                <ProgressBar value={succ.progress} size="sm" />
              </div>
            )
          })
        )}
      </div>

      {downstream.length > 0 && (
        <div className="dep-section">
          <h4>All Downstream <span className="dep-count">{downstream.length}</span></h4>
          <p className="dep-hint">Items transitively blocked by this item</p>
          {downstream.map(d => (
            <div key={d.id} className="dep-item dep-item-sm">
              <span className="dep-item-title">{d.title}</span>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Dependency" onClose={() => { setShowAdd(false); setError('') }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            You're adding a predecessor to <strong>{item.title}</strong>. This item will wait for the selected item.
          </div>
          <form onSubmit={addDep} className="form-grid">
            <div className="field full">
              <label>Predecessor (must complete first)</label>
              <select value={form.predecessorId} onChange={e => setForm(f => ({ ...f, predecessorId: e.target.value }))} required>
                <option value="">Select a work item...</option>
                {available.map(i => (
                  <option key={i.id} value={i.id}>{i.title} ({i.progress}%)</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Dependency Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, threshold: e.target.value === 'full' ? 100 : 50 }))}>
                <option value="full">Full (100% required)</option>
                <option value="partial">Partial (custom %)</option>
              </select>
            </div>
            {form.type === 'partial' && (
              <div className="field">
                <label>Threshold: {form.threshold}%</label>
                <input type="range" min={1} max={99} value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: parseInt(e.target.value) }))} />
                <p className="field-hint">Successor can start when predecessor reaches {form.threshold}%</p>
              </div>
            )}
            <div className="form-actions full">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Checking...' : 'Add Dependency'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
