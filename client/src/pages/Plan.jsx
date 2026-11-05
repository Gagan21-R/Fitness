import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, Copy, Plus, Trash2, XCircle } from 'lucide-react';
import { useWorkoutModal } from '../components/Layout.jsx';
import { ActivityIcon, ErrorState, Field, Modal, PageHeader, PageSkeleton, ProgressBar } from '../components/ui.jsx';
import { ACTIVITIES, activityInfo } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { addDays, dateLong, dateShort, dayShort, localToday, weekRange, weekStart } from '../lib/format.js';

const STATUS = {
  done: { label: 'Done', icon: CheckCircle2 },
  missed: { label: 'Missed', icon: XCircle },
  planned: { label: 'Planned', icon: Circle },
};

function PlanForm({ date, onClose }) {
  const [form, setForm] = useState({ activity: 'running', durationMin: '30', note: '' });
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  const toast = useToast();
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: (body) => api.post('/plans', body),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast(`${activityInfo(form.activity).label} planned for ${dateShort(date)}`, 'success');
      onClose();
    },
    onError: (err) => setErrors({ ...err.fields, form: Object.keys(err.fields).length ? undefined : err.message }),
  });

  function submit(e) {
    e.preventDefault();
    const found = {};
    const minutes = form.durationMin === '' ? null : Number(form.durationMin);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 5 || minutes > 600)) {
      found.durationMin = 'Use whole minutes between 5 and 600, or leave it empty';
    }
    if (form.note.length > 120) found.note = 'Note cannot exceed 120 characters';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ date, activity: form.activity, durationMin: minutes, note: form.note });
  }

  return (
    <Modal title={`Plan a session · ${dateLong(date)}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <fieldset className="field">
          <legend>Activity</legend>
          <div className="activity-grid">
            {ACTIVITIES.map(({ id, label, icon: Icon }) => (
              <label key={id} className={`activity-choice ${form.activity === id ? 'is-selected' : ''}`}>
                <input type="radio" name="plan-activity" value={id} checked={form.activity === id} onChange={() => set('activity', id)} />
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Planned minutes (optional)" htmlFor="p-duration" error={errors.durationMin}>
          <input
            id="p-duration"
            type="number"
            inputMode="numeric"
            min="5"
            max="600"
            value={form.durationMin}
            onChange={(e) => set('durationMin', e.target.value)}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="p-note" error={errors.note} hint={`${form.note.length} of 120`}>
          <input id="p-note" value={form.note} maxLength={120} placeholder="Intervals, easy pace…" onChange={(e) => set('note', e.target.value)} />
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
            {save.isPending ? 'Saving…' : 'Add to plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlanItem({ item, today, onDelete, onLog }) {
  const { icon: Icon, label } = STATUS[item.status];
  return (
    <li className={`plan-item plan-${item.status}`}>
      <ActivityIcon activity={item.activity} size={16} />
      <div className="plan-item-main">
        <strong>{activityInfo(item.activity).label}</strong>
        <span className="muted small">
          {item.durationMin ? `${item.durationMin} min` : 'Any length'}
          {item.note && ` · ${item.note}`}
        </span>
        <span className={`plan-status plan-status-${item.status}`}>
          <Icon size={13} aria-hidden="true" /> {label}
        </span>
      </div>
      <div className="plan-item-actions">
        {item.status === 'planned' && item.date === today && (
          <button type="button" className="chip plan-log" onClick={() => onLog(item)}>
            Log it
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={`Remove ${activityInfo(item.activity).label} from the plan`} onClick={() => onDelete(item)}>
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

export default function Plan() {
  const today = localToday();
  const thisWeek = weekStart(today);
  const [params, setParams] = useSearchParams();
  const requested = params.get('week');
  const week = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? weekStart(requested) : thisWeek;
  const [adding, setAdding] = useState(null);
  const openWorkout = useWorkoutModal();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plans', week, today],
    queryFn: () => api.get('/plans', { week, today }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast(err.message, 'error'),
  });
  const copy = useMutation({
    mutationFn: () => api.post('/plans/copy', { fromWeek: addDays(week, -7), toWeek: week }),
    onSuccess: ({ copied }) => {
      queryClient.invalidateQueries();
      toast(`Copied ${copied} session${copied === 1 ? '' : 's'} from last week`, 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const go = (w) => setParams(w === thisWeek ? {} : { week: w });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { summary } = data;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const toGo = summary.planned - summary.done - summary.missed;
  const percent = summary.planned ? Math.round((summary.done / summary.planned) * 100) : 0;

  return (
    <div className="stack">
      <PageHeader
        title="Weekly plan"
        subtitle="Plan your sessions ahead. Each one ticks itself off when you log a matching workout that day."
        actions={
          <>
            <div className="week-nav">
              <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => go(addDays(week, -7))}>
                <ChevronLeft size={18} />
              </button>
              <span className="tabular">{weekRange(week)}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Next week"
                disabled={week >= addDays(thisWeek, 7 * 4)}
                onClick={() => go(addDays(week, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {week >= thisWeek && (
              <button type="button" className="btn btn-ghost" onClick={() => copy.mutate()} disabled={copy.isPending}>
                <Copy size={16} aria-hidden="true" /> Copy last week
              </button>
            )}
          </>
        }
      />

      <section className="card plan-summary">
        <div className="plan-summary-figures">
          <div>
            <strong>{summary.done}</strong>
            <span>done</span>
          </div>
          <div>
            <strong>{toGo}</strong>
            <span>to go</span>
          </div>
          <div>
            <strong>{summary.missed}</strong>
            <span>missed</span>
          </div>
        </div>
        <div className="plan-summary-bar">
          <span className="small">
            {summary.planned
              ? `${summary.done} of ${summary.planned} planned sessions done (${percent}%)`
              : 'Nothing planned for this week yet. Add sessions to any day below.'}
          </span>
          <ProgressBar percent={percent} status={percent === 100 ? 'met' : undefined} />
        </div>
      </section>

      <div className="plan-board">
        {days.map((date) => {
          const items = data.items.filter((p) => p.date === date);
          const past = date < today;
          return (
            <section key={date} className={`card plan-day ${date === today ? 'is-today' : ''} ${past ? 'is-past' : ''}`}>
              <header className="plan-day-head">
                <div>
                  <h2>{dayShort(date)}</h2>
                  <span className="muted small">{dateShort(date)}</span>
                </div>
                {date === today && <span className="plan-today">Today</span>}
              </header>
              {items.length ? (
                <ul className="plan-items">
                  {items.map((item) => (
                    <PlanItem
                      key={item.id}
                      item={item}
                      today={today}
                      onDelete={(p) => remove.mutate(p.id)}
                      onLog={(p) => openWorkout({ repeat: { activity: p.activity, durationMin: p.durationMin } })}
                    />
                  ))}
                </ul>
              ) : (
                <p className="plan-empty muted small">{past ? 'Nothing was planned' : 'Rest day, or add a session'}</p>
              )}
              {!past && (
                <button type="button" className="plan-add" onClick={() => setAdding(date)}>
                  <Plus size={15} aria-hidden="true" /> Add
                </button>
              )}
            </section>
          );
        })}
      </div>

      {adding && <PlanForm date={adding} onClose={() => setAdding(null)} />}
      <p className="muted small plan-foot">
        <CalendarCheck size={14} aria-hidden="true" /> A planned session counts as done when you log the same activity
        on the same day. Duration doesn't have to match.
      </p>
    </div>
  );
}
