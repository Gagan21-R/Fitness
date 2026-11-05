import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, Square, Timer as TimerIcon, X } from 'lucide-react';
import { ACTIVITIES, activityInfo } from '../lib/activities.js';
import { Modal } from './ui.jsx';

// A live session stopwatch. Its state lives in localStorage, so it survives a page refresh
// or closing the tab mid-workout. Elapsed time is always worked out from timestamps, never
// counted tick by tick, so a sleeping laptop can't make it drift.
const KEY = 'fc_timer';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

function save(timer) {
  try {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the timer still works, it just won't survive a refresh.
  }
}

export function elapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  return (timer.pausedAt ?? now) - timer.startedAt - timer.pausedTotal;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function useWorkoutTimer() {
  const [timer, setTimer] = useState(load);
  const [, setTick] = useState(0);

  useEffect(() => save(timer), [timer]);

  // Re-render once a second while running, so the clock moves.
  useEffect(() => {
    if (!timer || timer.pausedAt) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const start = useCallback((activity) => {
    setTimer({ activity, startedAt: Date.now(), pausedAt: null, pausedTotal: 0 });
  }, []);
  const pause = useCallback(() => setTimer((t) => (t && !t.pausedAt ? { ...t, pausedAt: Date.now() } : t)), []);
  const resume = useCallback(
    () =>
      setTimer((t) => (t && t.pausedAt ? { ...t, pausedTotal: t.pausedTotal + Date.now() - t.pausedAt, pausedAt: null } : t)),
    [],
  );
  const clear = useCallback(() => setTimer(null), []);

  return { timer, start, pause, resume, clear };
}

export function StartTimerModal({ onStart, onClose }) {
  const [activity, setActivity] = useState('running');
  return (
    <Modal title="Start a session" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onStart(activity);
        }}
      >
        <fieldset className="field">
          <legend>What are you doing?</legend>
          <div className="activity-grid">
            {ACTIVITIES.map(({ id, label, icon: Icon }) => (
              <label key={id} className={`activity-choice ${activity === id ? 'is-selected' : ''}`}>
                <input type="radio" name="timer-activity" value={id} checked={activity === id} onChange={() => setActivity(id)} />
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted-2 small">
          The timer keeps running if you close or refresh the page. Stop it when you finish and the log form opens with
          the time filled in.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            <Play size={16} aria-hidden="true" /> Start timer
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TimerPill({ timer, onPause, onResume, onStop, onDiscard }) {
  const { label, icon: Icon } = activityInfo(timer.activity);
  const paused = Boolean(timer.pausedAt);
  return (
    <div className={`timer-pill ${paused ? 'is-paused' : ''}`} role="region" aria-label="Workout timer">
      <span className="timer-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="timer-main">
        <span className="timer-label">{paused ? `${label} · paused` : label}</span>
        <strong className="timer-clock tabular" aria-live="off">
          {formatClock(elapsedMs(timer))}
        </strong>
      </div>
      {paused ? (
        <button type="button" className="icon-btn" onClick={onResume} aria-label="Resume timer" title="Resume">
          <Play size={18} />
        </button>
      ) : (
        <button type="button" className="icon-btn" onClick={onPause} aria-label="Pause timer" title="Pause">
          <Pause size={18} />
        </button>
      )}
      <button type="button" className="timer-stop" onClick={onStop} aria-label="Stop timer and log workout">
        <Square size={14} aria-hidden="true" /> Stop &amp; log
      </button>
      <button type="button" className="icon-btn" onClick={onDiscard} aria-label="Discard timer" title="Discard">
        <X size={16} />
      </button>
    </div>
  );
}

export { TimerIcon };
