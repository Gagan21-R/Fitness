import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Circle, Clock, TrendingDown, TrendingUp, X, XCircle } from 'lucide-react';
import { activityInfo, metricAmount } from '../lib/activities.js';

export function ActivityIcon({ activity, size = 18 }) {
  const Icon = activityInfo(activity).icon;
  return (
    <span className="activity-icon" aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

const STATUS = {
  met: { label: 'Reached', icon: CheckCircle2 },
  onTrack: { label: 'On pace', icon: Clock },
  behind: { label: 'Behind pace', icon: AlertTriangle },
  missed: { label: 'Missed', icon: XCircle },
};

export function StatusBadge({ status }) {
  const { label, icon: Icon } = STATUS[status] || { label: status, icon: Circle };
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={14} aria-hidden="true" /> {label}
    </span>
  );
}

export function ProgressRing({ value, size = 180, stroke = 16, label, sublabel }) {
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label ?? pct} ${sublabel ?? ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <motion.circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? circumference * (1 - pct / 100) : circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong style={{ fontSize: size * 0.27 }}>{label ?? `${pct}`}</strong>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ percent, status }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={`bar-fill ${status === 'met' ? 'bar-met' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function GoalProgress({ goal }) {
  return (
    <div className="goal-row">
      <ActivityIcon activity={goal.activity} />
      <div className="goal-row-main">
        <div className="goal-row-top">
          <span className="goal-row-name">{goal.name}</span>
          <StatusBadge status={goal.status} />
        </div>
        <ProgressBar percent={goal.percent} status={goal.status} />
        <span className="muted small tabular">
          {goal.actual} of {metricAmount(goal.metric, goal.target)}
        </span>
      </div>
    </div>
  );
}

export function Delta({ now, before, unit = '' }) {
  if (before === null || before === undefined) return null;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return <span className="delta muted">Same as last week</span>;
  const up = diff > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="delta">
      <Icon size={14} aria-hidden="true" /> {up ? '+' : '−'}
      {Math.abs(diff)}
      {unit} vs last week
    </span>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className="field-message" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, busy }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted-2">{body}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Skeleton({ height = 160, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height }} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <Skeleton height={220} />
      <div className="grid-2">
        <Skeleton height={260} />
        <Skeleton height={260} />
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state card" role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <h3>That didn't load</h3>
      <p className="muted-2">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="state card">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <h3>{title}</h3>
      <p className="muted-2">{body}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>
          {/* The last word is set in serif italic, part of the mixed-typeface look. */}
          {title.includes(' ') && `${title.slice(0, title.lastIndexOf(' '))} `}
          <span className="accent-word">{title.slice(title.lastIndexOf(' ') + 1)}</span>
        </h1>
        {subtitle && <p className="muted-2">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
