import { useState, useMemo } from 'react'
import { useWorkItems, useDependencies, updateProgressWithCascade, updateWorkItem } from '../hooks/useData'
import { StatusBadge, PriorityBadge, ProgressBar, Spinner, Modal } from '../components/UI'
import { getBlockers, getDownstream, estimateCompletion } from '../lib/dependencyEngine'
import { useAuth } from '../context/AuthContext'

export default function MemberDashboard() {
  const { profile, signOut } = useAuth()
  const { items, loading: itemsLoading, refetch: refetchItems } = useWorkItems()
  const { deps, loading: depsLoading, refetch: refetchDeps } = useDependencies()

  const [selectedItem, setSelectedItem] = useState(null)
  const [progressEdit, setProgressEdit] = useState(null)
  const [blockModal, setBlockModal] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [cascadeInfo, setCascadeInfo] = useState(null)

  const refetch = () => { refetchItems(); refetchDeps() }

  const myItems = useMemo(
    () => items.filter(i => i.assigned_to === profile?.id),
    [items, profile]
  )

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))

  async function saveProgress(item, newProgress) {
    setSaving(true)
    const { cascades, error } = await updateProgressWithCascade(item.id, newProgress, items, deps)
    setSaving(false)
    if (!error) {
      if (cascades?.length > 0) {
        setCascadeInfo({
          item: item.title,
          unblocked: cascades.filter(c => c.newStatus === 'in-progress').map(c => itemMap[c.id]?.title).filter(Boolean)
        })
      }
      setProgressEdit(null)
      refetch()
    }
  }

  async function markBlocked(item) {
    setSaving(true)
    await updateWorkItem(item.id, { status: 'blocked', blocked_reason: blockReason })
    setSaving(false)
    setBlockModal(null)
    setBlockReason('')
    refetch()
  }

  if (itemsLoading || depsLoading) return <div className="page-center"><Spinner /></div>

  return (
    <div className="member-layout">
      <header className="member-header">
        <div className="member-header-brand">
          <span className="brand-dot" />
          <span className="brand-name">NestUp</span>
        </div>
        <div className="member-header-user">
          <span className="avatar">{profile?.name?.[0]}</span>
          <div>
            <div className="user-name">{profile?.name}</div>
            <div className="user-role">Member</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="member-content">
        <div className="member-main">
          <div className="section-header">
            <h2>My Tasks <span className="count-badge">{myItems.length}</span></h2>
            <div className="member-stats">
              <span className="mstat"><span className="mstat-dot done" />Done: {myItems.filter(i => i.status === 'done').length}</span>
              <span className="mstat"><span className="mstat-dot active" />Active: {myItems.filter(i => i.status === 'in-progress').length}</span>
              <span className="mstat"><span className="mstat-dot blocked" />Blocked: {myItems.filter(i => i.status === 'blocked').length}</span>
            </div>
          </div>

          {myItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">○</span>
              <p className="empty-msg">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="member-items">
              {myItems.map(item => {
                const blockers = getBlockers(item.id, deps, items).filter(b => b.isBlocking)
                const downstream = getDownstream(item.id, deps, items)
                const estimate = estimateCompletion(item)
                const isEditing = progressEdit?.id === item.id

                return (
                  <div
                    key={item.id}
                    className={`member-card priority-border-${item.priority} ${selectedItem?.id === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedItem(s => s?.id === item.id ? null : item)}
                  >
                    <div className="member-card-header">
                      <div className="badges-row">
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} />
                      </div>
                      {downstream.length > 0 && (
                        <span className="impact-badge">⚡ Blocking {downstream.length}</span>
                      )}
                    </div>

                    <h3 className="member-card-title">{item.title}</h3>
                    {item.description && <p className="member-card-desc">{item.description}</p>}

                    <ProgressBar value={item.progress} />

                    {item.required_skills?.length > 0 && (
                      <div className="skills-row" onClick={e => e.stopPropagation()}>
                        {item.required_skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
                      </div>
                    )}

                    {blockers.length > 0 && (
                      <div className="blockers-list">
                        {blockers.map(b => (
                          <div key={b.id} className="blocker-chip">
                            ⛔ Waiting on <strong>{b.title}</strong> ({b.dep.type === 'full' ? '100%' : `${b.dep.threshold}%`} needed, at {b.progress}%)
                          </div>
                        ))}
                      </div>
                    )}

                    {item.blocked_reason && (
                      <div className="blocked-reason">⚠ {item.blocked_reason}</div>
                    )}

                    {estimate && <div className="estimate-row">~{estimate}</div>}

                    {/* Expand: actions */}
                    {selectedItem?.id === item.id && (
                      <div className="member-actions" onClick={e => e.stopPropagation()}>
                        {!isEditing ? (
                          <button className="btn btn-primary btn-sm" onClick={() => setProgressEdit({ ...item, newProgress: item.progress })}>
                            Update Progress
                          </button>
                        ) : (
                          <div className="progress-edit">
                            <label>Progress: {progressEdit.newProgress}%</label>
                            <input
                              type="range" min={0} max={100}
                              value={progressEdit.newProgress}
                              onChange={e => setProgressEdit(p => ({ ...p, newProgress: parseInt(e.target.value) }))}
                            />
                            <div className="progress-edit-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setProgressEdit(null)}>Cancel</button>
                              <button className="btn btn-primary btn-sm" disabled={saving}
                                onClick={() => saveProgress(item, progressEdit.newProgress)}>
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}

                        {item.status !== 'blocked' && (
                          <button className="btn btn-warning btn-sm" onClick={() => { setBlockModal(item); setBlockReason('') }}>
                            Mark Blocked
                          </button>
                        )}

                        {downstream.length > 0 && (
                          <div className="downstream-list">
                            <p className="downstream-label">Your progress affects:</p>
                            {downstream.map(d => (
                              <div key={d.id} className="downstream-chip">
                                <span className="dep-item-title">{d.title}</span>
                                <StatusBadge status={d.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {blockModal && (
        <Modal title="Mark as Blocked" onClose={() => setBlockModal(null)}>
          <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>
            Marking <strong>{blockModal.title}</strong> as blocked. Please provide a reason.
          </p>
          <div className="field">
            <label>Reason *</label>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              rows={3}
              placeholder="Why is this task blocked?"
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setBlockModal(null)}>Cancel</button>
            <button className="btn btn-warning" disabled={!blockReason || saving} onClick={() => markBlocked(blockModal)}>
              {saving ? 'Saving...' : 'Confirm Blocked'}
            </button>
          </div>
        </Modal>
      )}

      {cascadeInfo && (
        <Modal title="✅ Progress Saved" onClose={() => setCascadeInfo(null)}>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
            Progress updated for <strong>{cascadeInfo.item}</strong>.
          </p>
          {cascadeInfo.unblocked.length > 0 && (
            <>
              <p style={{ color: '#22c55e', marginBottom: '0.5rem' }}>
                🎉 {cascadeInfo.unblocked.length} item(s) automatically unblocked:
              </p>
              {cascadeInfo.unblocked.map((title, i) => (
                <div key={i} className="cascade-item">✓ {title}</div>
              ))}
            </>
          )}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setCascadeInfo(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
