import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { ACTIVITIES, FEELINGS, INTENSITIES, activityInfo } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { localToday } from '../lib/format.js';
import { Field, Modal } from './ui.jsx';

const PRESETS = [15, 30, 45, 60, 90];

function validate(form, today) {
  const errors = {};
  const duration = Number(form.durationMin);
  if (!form.activity) errors.activity = 'Choose an activity';
  if (!form.date) errors.date = 'Date is required';
  else if (form.date > today) errors.date = 'Date cannot be in the future';
  if (!form.durationMin) errors.durationMin = 'Duration is required';
  else if (!Number.isInteger(duration)) errors.durationMin = 'Duration must be whole minutes';
  else if (duration < 1 || duration > 600) errors.durationMin = 'Duration must be between 1 and 600 minutes';
  if (form.distanceKm !== '' && (Number(form.distanceKm) < 0 || Number(form.distanceKm) > 1000 || Number.isNaN(Number(form.distanceKm)))) {
    errors.distanceKm = 'Distance must be between 0 and 1000 km';
  }
  if (form.notes.length > 500) errors.notes = 'Notes cannot exceed 500 characters';
  return errors;
}

export default function WorkoutModal({ workout, repeat, fromTimer = false, onSaved, onClose }) {
  const today = localToday();
  const source = workout || repeat;
  const [form, setForm] = useState({
    activity: source?.activity || '',
    date: workout?.date || today,
    durationMin: source?.durationMin ? String(source.durationMin) : '30',
    intensity: source?.intensity || 3,
    distanceKm: source?.distanceKm ? String(source.distanceKm) : '',
    notes: workout?.notes || '',
    feeling: workout?.feeling || null,
  });
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  const toast = useToast();
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const showDistance = activityInfo(form.activity).distance;

  const save = useMutation({
    mutationFn: (body) => (workout ? api.put(`/workouts/${workout.id}`, body) : api.post('/workouts', body)),
    onSuccess: ({ goalsCompleted = [], recordsBroken = [] }) => {
      queryClient.invalidateQueries();
      if (goalsCompleted.length || recordsBroken.length) {
        confetti({
          particleCount: recordsBroken.length ? 160 : 110,
          spread: recordsBroken.length ? 100 : 75,
          origin: { y: 0.65 },
          colors: ['#c8f031', '#d6c8ff', '#6d4fd8', '#f4e1a6', '#3ddbb5'],
          disableForReducedMotion: true,
        });
      }
      for (const r of recordsBroken) toast(`New personal record! ${r.title}: ${r.display}`, 'success');
      if (goalsCompleted.length) toast(`Target reached: ${goalsCompleted.join(', ')}`, 'success');
      if (!goalsCompleted.length && !recordsBroken.length) {
        toast(workout ? 'Workout updated' : 'Workout logged', 'success');
      }
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setErrors({ ...err.fields, form: Object.keys(err.fields).length ? undefined : err.message });
    },
  });

  function submit(e) {
    e.preventDefault();
    const found = validate(form, today);
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({
      activity: form.activity,
      date: form.date,
      durationMin: Number(form.durationMin),
      intensity: form.intensity,
      distanceKm: showDistance && form.distanceKm !== '' ? Number(form.distanceKm) : null,
      notes: form.notes,
      feeling: form.feeling,
    });
  }

  return (
    <Modal title={workout ? 'Edit workout' : fromTimer ? 'Log your timed session' : 'Log a workout'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        <fieldset className={`field ${errors.activity ? 'field-error' : ''}`}>
          <legend>Activity</legend>
          <div className="activity-grid">
            {ACTIVITIES.map(({ id, label, icon: Icon }) => (
              <label key={id} className={`activity-choice ${form.activity === id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="activity"
                  value={id}
                  checked={form.activity === id}
                  onChange={() => set('activity', id)}
                />
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {errors.activity && (
            <span className="field-message" role="alert">
              {errors.activity}
            </span>
          )}
        </fieldset>

        <div className="form-row">
          <Field label="Date" htmlFor="w-date" error={errors.date}>
            <input id="w-date" type="date" value={form.date} max={today} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="w-duration" error={errors.durationMin}>
            <input
              id="w-duration"
              type="number"
              inputMode="numeric"
              min="1"
              max="600"
              value={form.durationMin}
              onChange={(e) => set('durationMin', e.target.value)}
            />
          </Field>
        </div>
        <div className="chips" role="group" aria-label="Duration presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${Number(form.durationMin) === p ? 'is-selected' : ''}`}
              onClick={() => set('durationMin', String(p))}
            >
              {p} min
            </button>
          ))}
        </div>

        <fieldset className="field">
          <legend>Intensity</legend>
          <div className="segments">
            {INTENSITIES.map((label, i) => (
              <label key={label} className={`segment ${form.intensity === i + 1 ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="intensity"
                  checked={form.intensity === i + 1}
                  onChange={() => set('intensity', i + 1)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {showDistance && (
          <Field label="Distance in km (optional)" htmlFor="w-distance" error={errors.distanceKm}>
            <input
              id="w-distance"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={form.distanceKm}
              onChange={(e) => set('distanceKm', e.target.value)}
            />
          </Field>
        )}

        <fieldset className="field">
          <legend>How do you feel now? (optional)</legend>
          <div className="segments feelings">
            {FEELINGS.map(({ value, label, icon: Icon }) => (
              <label key={value} className={`segment ${form.feeling === value ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="feeling"
                  checked={form.feeling === value}
                  onChange={() => set('feeling', value)}
                  onClick={() => form.feeling === value && set('feeling', null)}
                />
                <Icon size={18} aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Notes (optional)"
          htmlFor="w-notes"
          error={errors.notes}
          hint={`${form.notes.length} of 500 characters`}
        >
          <textarea
            id="w-notes"
            rows={2}
            value={form.notes}
            placeholder="How did it feel?"
            onChange={(e) => set('notes', e.target.value)}
          />
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
            {save.isPending ? 'Saving…' : workout ? 'Save changes' : 'Log workout'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
