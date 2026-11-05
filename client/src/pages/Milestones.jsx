import { useQuery } from '@tanstack/react-query';
import { Lock, Medal, Trophy } from 'lucide-react';
import { ActivityIcon, ErrorState, PageHeader, PageSkeleton, ProgressBar } from '../components/ui.jsx';
import { FEELINGS, activityInfo, feelingLabel } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { dateLong, localToday, weekRange } from '../lib/format.js';

const GROUPS = ['Consistency', 'Volume', 'Variety'];

function Records({ records }) {
  if (!records.length) {
    return <p className="muted-2">Log a few workouts and your personal bests will appear here.</p>;
  }
  return (
    <div className="records">
      {records.map((r) => (
        <article key={r.id} className="card record">
          <span className="record-icon" aria-hidden="true">
            <Trophy size={20} />
          </span>
          <span className="record-title">{r.title}</span>
          <strong className="record-value tabular">{r.display}</strong>
          <span className="muted small">
            {r.id === 'biggest-week' ? `Week of ${weekRange(r.date)}` : `${activityInfo(r.activity).label} · ${dateLong(r.date)}`}
          </span>
        </article>
      ))}
    </div>
  );
}

function Feelings({ feelings }) {
  if (!feelings.count) {
    return (
      <p className="muted-2">
        Rate how you feel after each workout (it's at the bottom of the log form) to see which activities lift you most.
      </p>
    );
  }
  const Icon = FEELINGS.find((f) => f.value === Math.round(feelings.average))?.icon;
  return (
    <div className="card feelings-card">
      <div className="feelings-overall">
        {Icon && <Icon size={34} aria-hidden="true" />}
        <div>
          <strong>
            {feelingLabel(feelings.average)} · {feelings.average} / 5
          </strong>
          <span className="muted small">Your average after {feelings.count} rated workouts</span>
        </div>
      </div>
      {feelings.byActivity.length > 0 ? (
        <ul className="hbars">
          {feelings.byActivity.map((f) => (
            <li key={f.activity}>
              <ActivityIcon activity={f.activity} size={16} />
              <div className="hbar-main">
                <div className="hbar-top">
                  <span>{activityInfo(f.activity).label}</span>
                  <span className="muted-2 tabular small">
                    {feelingLabel(f.average)} · {f.average} / 5
                  </span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(f.average / 5) * 100}%` }} />
                </div>
                <span className="muted small">{f.count} rated sessions</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-2 small">Rate at least 3 sessions of an activity to compare activities.</p>
      )}
    </div>
  );
}

export default function Milestones() {
  const today = localToday();
  const achievements = useQuery({
    queryKey: ['achievements', today],
    queryFn: () => api.get('/stats/achievements', { today }),
  });
  const records = useQuery({ queryKey: ['records'], queryFn: () => api.get('/stats/records') });

  if (achievements.isLoading || records.isLoading) return <PageSkeleton />;
  const error = achievements.error || records.error;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          achievements.refetch();
          records.refetch();
        }}
      />
    );
  }

  const items = achievements.data.items;
  const earned = items.filter((a) => a.earned).length;

  return (
    <div className="stack">
      <PageHeader
        title="Records & milestones"
        subtitle={`${earned} of ${items.length} milestones earned. Every record here is yours alone, with nobody to rank against.`}
      />

      <section className="stack">
        <h2 className="section-title">Personal records</h2>
        <Records records={records.data.records} />
      </section>

      <section className="stack">
        <h2 className="section-title">How workouts make you feel</h2>
        <Feelings feelings={records.data.feelings} />
      </section>

      {GROUPS.map((group) => (
        <section key={group} className="stack">
          <h2 className="section-title">{group}</h2>
          <div className="milestones">
            {items
              .filter((a) => a.group === group)
              .map((a) => (
                <article key={a.id} className={`card milestone ${a.earned ? 'is-earned' : ''}`}>
                  <span className="milestone-icon">
                    {a.earned ? <Medal size={22} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                  </span>
                  <div className="milestone-body">
                    <h3>{a.title}</h3>
                    <p className="muted-2 small">{a.description}</p>
                    {a.earned ? (
                      <span className="small earned-label">Earned</span>
                    ) : (
                      <>
                        <ProgressBar percent={Math.round((a.progress / a.goal) * 100)} />
                        <span className="muted small tabular">
                          {a.progress.toLocaleString()} of {a.goal.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
