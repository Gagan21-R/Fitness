import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck2,
  Compass,
  Flame,
  Lightbulb,
  Medal,
  Plus,
  Scale,
  Smile,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ActivityBars, ConsistencyChart, GhostChart, Heatmap } from '../components/Charts.jsx';
import { useTimer, useWorkoutModal } from '../components/Layout.jsx';
import { ActivityIcon, Delta, ErrorState, GoalProgress, PageSkeleton, ProgressRing } from '../components/ui.jsx';
import { activityInfo } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/context.jsx';
import { dayLetter, dayShort, greeting, localToday, minutes, plural, weekRange } from '../lib/format.js';

const INSIGHT_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  steady: Scale,
  pattern: CalendarCheck2,
  balance: Compass,
  target: Target,
  feeling: Smile,
};

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
});

function Onboarding({ data }) {
  const openWorkout = useWorkoutModal();
  return (
    <section className="card onboarding">
      <h2>Two steps to your first score</h2>
      <ol className="steps">
        <li className={data.hasGoals ? 'is-done' : ''}>
          <Target size={22} aria-hidden="true" />
          <div>
            <strong>Set a weekly target</strong>
            <p className="muted-2">Choose something you can hit on a busy week.</p>
            <Link className="btn btn-ghost" to="/goals">
              {data.hasGoals ? 'View goals' : 'Set a goal'}
            </Link>
          </div>
        </li>
        <li className={data.totalWorkouts ? 'is-done' : ''}>
          <Plus size={22} aria-hidden="true" />
          <div>
            <strong>Log a workout</strong>
            <p className="muted-2">Anything counts, including a 15-minute walk.</p>
            <button type="button" className="btn btn-ghost" onClick={() => openWorkout()}>
              Log workout
            </button>
          </div>
        </li>
      </ol>
    </section>
  );
}

function ghostHeadline(ghost) {
  if (!ghost.hasHistory) return 'Your ghost appears after a few weeks of logging';
  const diff = ghost.youToDate - ghost.ghostToDate;
  if (Math.abs(diff) < 5) return 'Neck and neck with your average self';
  return diff > 0
    ? `${diff} min ahead of your average self`
    : `${-diff} min behind your average self`;
}

function GhostRace({ ghost }) {
  return (
    <section className="card ghost-card">
      <header className="card-head">
        <div>
          <h2>Ghost race</h2>
          <p className="muted small">This week against your usual week. The only rival is you.</p>
        </div>
      </header>
      <p className="ghost-headline">{ghostHeadline(ghost)}</p>
      <GhostChart ghost={ghost} />
      {ghost.hasHistory && (
        <p className="muted small">
          A typical week of yours reaches {ghost.ghostWeek} min by Sunday.
        </p>
      )}
    </section>
  );
}

function TodayPlan({ items }) {
  const openWorkout = useWorkoutModal();
  const { timer, openStart } = useTimer();
  const left = items.filter((p) => p.status !== 'done');
  return (
    <section className="card today-card">
      <header className="card-head">
        <h2>Today's plan</h2>
        <Link className="link" to="/plan">
          Open planner
        </Link>
      </header>
      {items.length ? (
        <ul className="plan-items">
          {items.map((p) => (
            <li key={p.id} className={`plan-item plan-${p.status}`}>
              <ActivityIcon activity={p.activity} size={16} />
              <div className="plan-item-main">
                <strong>{activityInfo(p.activity).label}</strong>
                <span className="muted small">
                  {p.durationMin ? `${p.durationMin} min` : 'Any length'}
                  {p.note && ` · ${p.note}`}
                </span>
              </div>
              {p.status === 'done' ? (
                <span className="plan-status plan-status-done">Done</span>
              ) : (
                <button
                  type="button"
                  className="chip plan-log"
                  onClick={() => openWorkout({ repeat: { activity: p.activity, durationMin: p.durationMin } })}
                >
                  Log it
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-2">Nothing planned for today. Plan your week to see sessions here.</p>
      )}
      <div className="today-actions">
        <button type="button" className="btn btn-primary" onClick={openStart} disabled={Boolean(timer)}>
          <Timer size={16} aria-hidden="true" /> {timer ? 'Timer running' : 'Start a live session'}
        </button>
        {items.length > 0 && (
          <span className="muted small">
            {left.length ? `${left.length} still to do` : 'All done for today'}
          </span>
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const today = localToday();
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', today],
    queryFn: () => api.get('/stats/dashboard', { today }),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { week, trends, streaks, heatmap, balance, insights, achievements } = data;
  const firstName = user.name.split(' ')[0];
  const needsSetup = !data.hasGoals || data.totalWorkouts === 0;
  const finishedScores = trends.filter((t) => !t.partial && t.score !== null);
  const average = finishedScores.length
    ? Math.round(finishedScores.reduce((s, t) => s + t.score, 0) / finishedScores.length)
    : null;

  return (
    <div className="stack">
      <motion.section className="hero card" {...rise()}>
        <div className="hero-ring">
          <ProgressRing value={week.score} label={week.score === null ? '–' : undefined} sublabel="of 100" />
        </div>
        <div className="hero-body">
          <p className="eyebrow">
            {greeting()}, {firstName} · {weekRange(week.week)}
          </p>
          <h1>
            {week.score === null
              ? 'Set a target to start scoring'
              : week.score >= 100
                ? 'Every target reached this week'
                : `This week's consistency: ${week.score}`}
          </h1>
          <p className="muted-2 hero-narrative">{week.narrative}</p>
          <div className="week-strip" aria-label="Days active this week">
            {week.daily.map((d) => (
              <div
                key={d.date}
                className={`week-day ${d.sessions ? 'is-active' : ''} ${d.date === today ? 'is-today' : ''}`}
                title={`${dayShort(d.date)}: ${d.minutes ? minutes(d.minutes) : d.date > today ? 'upcoming' : 'rest'}`}
              >
                <span className="sr-only">
                  {dayShort(d.date)}: {d.sessions ? minutes(d.minutes) : 'no workout'}
                </span>
                <span aria-hidden="true">{dayLetter(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {needsSetup && <Onboarding data={data} />}

      <motion.section className="kpis" {...rise(0.06)} aria-label="Key figures">
        <div className="card kpi">
          <span className="kpi-label">
            <Target size={16} aria-hidden="true" /> Target weeks in a row
          </span>
          <strong>{streaks.currentWeeks}</strong>
          <span className="muted small">Best {streaks.longestWeeks}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">
            <Flame size={16} aria-hidden="true" /> Day streak
          </span>
          <strong>{streaks.currentDays}</strong>
          <span className="muted small">Best {streaks.longestDays}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">
            <CalendarCheck2 size={16} aria-hidden="true" /> 11-week average
          </span>
          <strong>{average ?? '–'}</strong>
          <span className="muted small">Finished weeks only</span>
        </div>
        <Link to="/milestones" className="card kpi kpi-link">
          <span className="kpi-label">
            <Medal size={16} aria-hidden="true" /> Milestones
          </span>
          <strong>
            {achievements.earned}
            <small>/{achievements.total}</small>
          </strong>
          <span className="muted small">
            View all <ArrowRight size={12} aria-hidden="true" />
          </span>
        </Link>
      </motion.section>

      <div className="grid-2">
        <motion.div {...rise(0.08)}>
          <GhostRace ghost={data.ghost} />
        </motion.div>
        <motion.div {...rise(0.09)}>
          <TodayPlan items={data.todayPlan} />
        </motion.div>
      </div>

      <div className="grid-main">
        <motion.section className="card" {...rise(0.1)}>
          <header className="card-head">
            <h2>This week's targets</h2>
            <Link className="link" to="/goals">
              Manage
            </Link>
          </header>
          {week.goals.length ? (
            <div className="goal-list">
              {week.goals.map((g) => (
                <GoalProgress key={g.id} goal={g} />
              ))}
            </div>
          ) : (
            <p className="muted-2">No active targets. Add one to see your score here.</p>
          )}
        </motion.section>

        <motion.section className="card" {...rise(0.14)}>
          <header className="card-head">
            <div>
              <h2>Consistency, 12 weeks</h2>
              <p className="muted small">Your score each week. Dashed is this week so far.</p>
            </div>
            <Delta now={week.score ?? 0} before={week.score === null ? null : week.previousScore} />
          </header>
          <ConsistencyChart trends={trends} />
        </motion.section>
      </div>

      <motion.section className="card" {...rise(0.18)}>
        <header className="card-head">
          <h2>Six months of showing up</h2>
          <span className="muted small tabular">{plural(data.totalWorkouts, 'workout')} logged</span>
        </header>
        <Heatmap heatmap={heatmap} />
      </motion.section>

      <div className="grid-2">
        <motion.section className="card" {...rise(0.2)}>
          <header className="card-head">
            <div>
              <h2>Activity balance</h2>
              <p className="muted small">Share of your time, last 28 days</p>
            </div>
          </header>
          {balance.breakdown.length ? (
            <ActivityBars rows={balance.breakdown} showDays />
          ) : (
            <p className="muted-2">Log a workout to see how your time divides.</p>
          )}
          {balance.dropped.length > 0 && (
            <p className="dropped small muted-2">
              Not done in 28 days: {balance.dropped.map((d) => activityInfo(d.activity).label).join(', ')}
            </p>
          )}
        </motion.section>

        <motion.section className="card" {...rise(0.22)}>
          <header className="card-head">
            <h2>What your log says</h2>
          </header>
          {insights.length ? (
            <ul className="insights">
              {insights.map((i) => {
                const Icon = INSIGHT_ICONS[i.kind] || Lightbulb;
                return (
                  <li key={i.title}>
                    <span className="insight-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{i.title}</strong>
                      <p className="muted-2 small">{i.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted-2">Patterns appear here after a few weeks of logging.</p>
          )}
        </motion.section>
      </div>
    </div>
  );
}
