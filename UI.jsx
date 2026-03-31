export function StatusBadge({ status }) {
  return <span className={`badge badge-status badge-${status}`}>{status}</span>
}

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-priority badge-p-${priority}`}>{priority}</span>
}

export function ProgressBar({ value, size = 'md' }) {
  const color = value >= 100 ? 'var(--green)' : value >= 60 ? 'var(--blue)' : value >= 30 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className={`progress-wrap progress-${size}`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="progress-label">{value}%</span>
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function SkillTag({ skill }) {
  return <span className="skill-tag">{skill}</span>
}

export function EmptyState({ icon, message, sub }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p className="empty-msg">{message}</p>
      {sub && <p className="empty-sub">{sub}</p>}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" />
}
