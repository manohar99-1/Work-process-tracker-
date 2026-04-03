import { useState } from 'react'
import { StatusBadge, PriorityBadge, ProgressBar, Modal, SkillTag } from './UI'
import { createWorkItem, updateWorkItem, deleteWorkItem } from '../hooks/useData'
import { useAuth } from '../context/AuthContext'
import { estimateCompletion } from '../lib/dependencyEngine'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['blocked', 'in-progress', 'done']

export function WorkItemCard({ item, members, deps, allItems, onUpdate, onSelect, isSelected }) {
  const downstream = deps.filter(d => d.predecessor_id === item.id).length
  const blocking = deps.filter(d => d.successor_id === item.id).length
  const estimate = estimateCompletion(item)

  return (
    <div
      className={`work-card ${isSelected ? 'work-card-selected' : ''} priority-border-${item.priority}`}
      onClick={() => onSelect(item)}
    >
      <div className="work-card-header">
        <div className="work-card-badges">
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </div>
        <span className="work-card-id">#{item.id.slice(0, 6)}</span>
      </div>

      <h3 className="work-card-title">{item.title}</h3>
      {item.description && <p className="work-card-desc">{item.description}</p>}

      <ProgressBar value={item.progress} />

      <div className="work-card-meta">
        {item.assignee && (
          <div className="assignee-chip">
            <span className="avatar">{item.assignee.name[0]}</span>
            <span>{item.assignee.name}</span>
          </div>
        )}
        {item.required_skills?.length > 0 && (
          <div className="skills-row">
            {item.required_skills.map(s => <SkillTag key={s} skill={s} />)}
          </div>
        )}
      </div>

      <div className="work-card-footer">
        {downstream > 0 && <span className="dep-badge downstream">→ {downstream} blocking</span>}
        {blocking > 0 && <span className="dep-badge upstream">← {blocking} blocked by</span>}
        {estimate && <span className="estimate">~{estimate}</span>}
      </div>

      {item.blocked_reason && item.status === 'blocked' && (
        <div className="blocked-reason">⚠ {item.blocked_reason}</div>
      )}
    </div>
  )
}

export function WorkItemForm({ item, members, onSave, onClose }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    priority: item?.priority || 'medium',
    status: item?.status || 'blocked',
    progress: item?.progress || 0,
    required_skills: item?.required_skills?.join(', ') || '',
    assigned_to: item?.assigned_to || '',
    blocked_reason: item?.blocked_reason || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')

    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      progress: parseInt(form.progress),
      required_skills: form.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      assigned_to: form.assigned_to || null,
      blocked_reason: form.status === 'blocked' ? form.blocked_reason : null,
      created_by: profile?.id,
    }

    console.log('=== WorkItem Form Submit ===')
    console.log('Form values:', form)
    console.log('Payload to save:', payload)
    console.log('assigned_to (raw):', form.assigned_to)
    console.log('assigned_to (in payload):', payload.assigned_to)

    const { error, data } = item
      ? await updateWorkItem(item.id, payload)
      : await createWorkItem(payload)

    console.log('Save result:', { error, data })

    if (error) setError(error.message)
    else { onSave(); onClose() }
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this work item?')) return
    await deleteWorkItem(item.id)
    onSave(); onClose()
  }

  return (
    <Modal title={item ? 'Edit Work Item' : 'New Work Item'} onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit} className="form-grid">
        <div className="field full">
          <label>Title *</label>
          <input name="title" value={form.title} onChange={handle} required />
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea name="description" value={form.description} onChange={handle} rows={3} />
        </div>
        <div className="field">
          <label>Priority</label>
          <select name="priority" value={form.priority} onChange={handle}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" value={form.status} onChange={handle}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Progress: {form.progress}%</label>
          <input type="range" name="progress" min={0} max={100} value={form.progress} onChange={handle} />
        </div>
        <div className="field">
          <label>Assign To</label>
          <select name="assigned_to" value={form.assigned_to} onChange={handle}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Required Skills <span className="field-hint">(comma separated)</span></label>
          <input name="required_skills" value={form.required_skills} onChange={handle} placeholder="React, Node, Python" />
        </div>
        {form.status === 'blocked' && (
          <div className="field full">
            <label>Blocked Reason</label>
            <input name="blocked_reason" value={form.blocked_reason} onChange={handle} placeholder="Why is this blocked?" />
          </div>
        )}
        <div className="form-actions full">
          {item && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
