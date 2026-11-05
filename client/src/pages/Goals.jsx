import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import {
  ActivityIcon,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  StatusBadge,
} from '../components/ui.jsx';
import { ACTIVITIES, METRICS, activityInfo, metricAmount } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { localToday, weekRange } from '../lib/format.js';

const TEMPLATES = [
  { name: 'Train 3 days a week', activity: 'all', metric: 'activeDays', target: 3 },
  { name: '150 active minutes', activity: 'all', metric: 'minutes', target: 150 },
  { name: 'Run twice a week', activity: 'running', metric: 'sessions', target: 2 },
  { name: 'Weekly yoga session', activity: 'yoga', metric: 'sessions', target: 1 },
];

function GoalForm({ goal, onClose }) {
  const editing = Boolean(goal);
  const [form, setForm] = useState({
    name: goal?.name || '',
    activity: goal?.activity || 'all',
    metric: goal?.metric || 'activeDays',
    target: goal?.target ? String(goal.target) : '3',
  });
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = localToday();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const metric = METRICS[form.metric];

  const save = useMutation({
    mutationFn: (body) =>
      editing
        ? api.patch(`/goals/${goal.id}`, { name: body.name, target: body.target }, { today })
        : api.post('/goals', body, { today }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast(editing ? 'Goal updated' : 'Goal added', 'success');
      onClose();
    },
    onError: (err) => setErrors({ ...err.fields, form: Object.keys(err.fields).length ? undefined : err.message }),
  });

  function submit(e) {
    e.preventDefault();
    const found = {};
    const target = Number(form.target);
    if (form.name.trim().length < 2) found.name = 'Name must be at least 2 characters';
    if (!Number.isInteger(target) || target < 1) found.target = 'Target must be a whole number of at least 1';
    else if (target > metric.max) found.target = `Target cannot exceed ${metric.max} for this measure`;
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ ...form, name: form.name.trim(), target });
  }

  return (
    <Modal title={editing ? 'Edit goal' : 'New weekly goal'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {!editing && (
          <div className="chips" role="group" aria-label="Start from a template">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button" className="chip" onClick={() => setForm({ ...t, target: String(t.target) })}>
                {t.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Goal name" htmlFor="g-name" error={errors.name}>
          <input id="g-name" value={form.name} maxLength={60} onChange={set('name')} placeholder="Train 3 days a week" />
        </Field>
        <div className="form-row">
          <Field label="Activity" htmlFor="g-activity">
            <select id="g-activity" value={form.activity} onChange={set('activity')} disabled={editing}>
              <option value="all">All activities</option>
              {ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Measure" htmlFor="g-metric">
            <select id="g-metric" value={form.metric} onChange={set('metric')} disabled={editing}>
              {Object.entries(METRICS).map(([id, m]) => (
                <option key={id} value={id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label={`Weekly target (${metric.unit})`}
          htmlFor="g-target"
          error={errors.target}
          hint={editing ? 'Applies from this week. Past weeks keep the target they had.' : `Up to ${metric.max}`}
        >
          <input id="g-target" type="number" inputMode="numeric" min="1" max={metric.max} value={form.target} onChange={set('target')} />
        </Field>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add goal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryStrip({ history }) {
  return (
    <div className="history" aria-label="Last 8 weeks">
      {history.map((h) => (
        <span
          key={h.week}
          className={`history-cell history-${h.status}`}
          title={`${weekRange(h.week)}: ${h.actual} of ${h.target}`}
        >
          <span className="sr-only">
            {weekRange(h.week)}: {h.actual} of {h.target}
          </span>
        </span>
      ))}
    </div>
  );
}

function GoalCard({ goal, onEdit, onArchive, onDelete }) {
  const current = goal.current;
  const percent = current ? Math.min(100, Math.round((current.actual / current.target) * 100)) : 0;
  return (
    <article className={`card goal-card ${goal.archived ? 'is-archived' : ''}`}>
      <header className="goal-card-head">
        <ActivityIcon activity={goal.activity} />
        <div>
          <h3>{goal.name}</h3>
          <span className="muted small">
            {activityInfo(goal.activity).label} · {metricAmount(goal.metric, goal.target)} a week
          </span>
        </div>
      </header>
      {current && !goal.archived && (
        <div className="goal-card-now">
          <div className="goal-row-top">
            <span className="tabular">
              <b>{current.actual}</b> of {current.target} this week
            </span>
            <StatusBadge status={current.status} />
          </div>
          <ProgressBar percent={percent} status={current.status} />
        </div>
      )}
      {goal.history.length > 0 && (
        <div className="goal-card-history">
          <div className="goal-row-top">
            <span className="muted small">Last {goal.history.length === 1 ? 'week' : `${goal.history.length} weeks`}</span>
            {goal.hitRate !== null && <span className="small tabular">{goal.hitRate}% reached</span>}
          </div>
          <HistoryStrip history={goal.history} />
        </div>
      )}
      <footer className="goal-card-actions">
        {!goal.archived && (
          <>
            <button type="button" className="icon-btn" aria-label={`Edit ${goal.name}`} title="Edit" onClick={onEdit}>
              <Pencil size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label={`Retire ${goal.name}`} title="Retire (keeps past weeks)" onClick={onArchive}>
              <Archive size={16} />
            </button>
          </>
        )}
        <button type="button" className="icon-btn" aria-label={`Delete ${goal.name}`} title="Delete" onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </footer>
    </article>
  );
}

export default function Goals() {
  const today = localToday();
  const [formGoal, setFormGoal] = useState(undefined); // undefined closed, null new, object edit
  const [toDelete, setToDelete] = useState(null);
  const [toArchive, setToArchive] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['goals', today],
    queryFn: () => api.get('/goals', { today }),
  });

  const after = (message, close) => ({
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast(message, 'success');
      close(null);
    },
    onError: (err) => {
      toast(err.message, 'error');
      close(null);
    },
  });
  const remove = useMutation({ mutationFn: (id) => api.delete(`/goals/${id}`), ...after('Goal deleted', setToDelete) });
  const archive = useMutation({
    mutationFn: (id) => api.patch(`/goals/${id}`, { archived: true }, { today }),
    ...after('Goal retired', setToArchive),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const active = data.items.filter((g) => !g.archived);
  const retired = data.items.filter((g) => g.archived);
  const card = (g) => (
    <GoalCard
      key={g.id}
      goal={g}
      onEdit={() => setFormGoal(g)}
      onArchive={() => setToArchive(g)}
      onDelete={() => setToDelete(g)}
    />
  );

  return (
    <div className="stack">
      <PageHeader
        title="Goals"
        subtitle="Weekly targets you set for yourself. Your score only ever compares you with these."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setFormGoal(null)}>
            <Plus size={16} aria-hidden="true" /> New goal
          </button>
        }
      />

      {data.items.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          body="Start small. A target you reach most weeks builds more than an ambitious one you keep missing."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setFormGoal(null)}>
              Set your first goal
            </button>
          }
        />
      )}

      {active.length > 0 && <div className="goal-grid">{active.map(card)}</div>}

      {retired.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Retired</h2>
          <div className="goal-grid">{retired.map(card)}</div>
        </section>
      )}

      {formGoal !== undefined && <GoalForm goal={formGoal} onClose={() => setFormGoal(undefined)} />}
      {toArchive && (
        <ConfirmModal
          title="Retire this goal?"
          body={`"${toArchive.name}" stops counting from this week. Past weeks keep their results.`}
          confirmLabel="Retire goal"
          busy={archive.isPending}
          onConfirm={() => archive.mutate(toArchive.id)}
          onClose={() => setToArchive(null)}
        />
      )}
      {toDelete && (
        <ConfirmModal
          title="Delete this goal?"
          body={`"${toDelete.name}" and its results are removed, which changes your past scores. To keep your history, retire it instead.`}
          confirmLabel="Delete goal"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
