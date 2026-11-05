import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { ActivityBars, DailyBars } from '../components/Charts.jsx';
import { ActivityIcon, Delta, ErrorState, GoalProgress, PageHeader, PageSkeleton, ProgressRing } from '../components/ui.jsx';
import { activityInfo, feelingLabel } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { addDays, localToday, minutes, relativeDay, weekRange, weekStart } from '../lib/format.js';

function Stat({ label, value, now, before, unit }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <Delta now={now} before={before} unit={unit} />
    </div>
  );
}

export default function Weekly() {
  const today = localToday();
  const thisWeek = weekStart(today);
  const [params, setParams] = useSearchParams();
  const requested = params.get('week');
  const week = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? weekStart(requested) : thisWeek;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['week', week, today],
    queryFn: () => api.get('/stats/week', { week, today }),
    placeholderData: keepPreviousData,
  });
  const go = (w) => setParams(w === thisWeek ? {} : { week: w });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { totals, previous } = data;

  return (
    <div className="stack">
      <PageHeader
        title="Weekly summary"
        subtitle={week === thisWeek ? 'This week so far' : 'A finished week'}
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
                disabled={week >= thisWeek}
                onClick={() => go(addDays(week, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Print
            </button>
          </>
        }
      />

      <section className="hero card">
        <div className="hero-ring">
          <ProgressRing value={data.score} label={data.score === null ? '–' : undefined} sublabel="of 100" size={150} stroke={14} />
        </div>
        <div className="hero-body">
          <p className="eyebrow">Consistency score</p>
          <p className="weekly-narrative">{data.narrative}</p>
          {data.score !== null && <Delta now={data.score} before={data.previousScore} unit=" pts" />}
          {totals.avgFeeling !== null && (
            <span className="eyebrow">
              Felt {feelingLabel(totals.avgFeeling).toLowerCase()} on average · {totals.avgFeeling} / 5
            </span>
          )}
        </div>
      </section>

      <section className="kpis" aria-label="Week totals">
        <Stat label="Sessions" value={totals.sessions} now={totals.sessions} before={previous.sessions} />
        <Stat label="Active time" value={minutes(totals.minutes)} now={totals.minutes} before={previous.minutes} unit=" min" />
        <Stat label="Active days" value={`${totals.activeDays}/7`} now={totals.activeDays} before={previous.activeDays} />
        <Stat label="Distance" value={`${totals.distanceKm} km`} now={totals.distanceKm} before={previous.distanceKm} unit=" km" />
      </section>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>Against your targets</h2>
          </header>
          {data.goals.length ? (
            <div className="goal-list">
              {data.goals.map((g) => (
                <GoalProgress key={g.id} goal={g} />
              ))}
            </div>
          ) : (
            <p className="muted-2">No targets applied to this week.</p>
          )}
        </section>
        <section className="card">
          <header className="card-head">
            <h2>Minutes by day</h2>
          </header>
          <DailyBars daily={data.daily} />
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>By activity</h2>
          </header>
          {data.byActivity.length ? <ActivityBars rows={data.byActivity} /> : <p className="muted-2">Nothing logged this week.</p>}
        </section>
        <section className="card">
          <header className="card-head">
            <h2>Sessions</h2>
          </header>
          {data.workouts.length ? (
            <ul className="mini-list">
              {data.workouts.map((w) => (
                <li key={w.id}>
                  <ActivityIcon activity={w.activity} size={16} />
                  <div>
                    <strong>{activityInfo(w.activity).label}</strong>
                    <span className="muted small">{relativeDay(w.date, today)}</span>
                  </div>
                  <span className="tabular">{minutes(w.durationMin)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-2">Nothing logged this week.</p>
          )}
        </section>
      </div>
    </div>
  );
}
