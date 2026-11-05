import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { activityInfo } from '../lib/activities.js';
import { dateLong, dateShort, dayShort, minutes, monthShort, plural, weekRange } from '../lib/format.js';
import { ActivityIcon } from './ui.jsx';

const axis = { fontSize: 12, fill: 'var(--muted)' };

function ChartTip({ active, children }) {
  if (!active) return null;
  return <div className="chart-tip">{children}</div>;
}

export function ConsistencyChart({ trends }) {
  // The running week is drawn dashed: its score is still climbing and shouldn't read as a dip.
  const finished = trends.filter((t) => !t.partial);
  const lastFinished = finished.at(-1);
  const data = trends.map((t) => ({
    ...t,
    done: t.partial ? null : t.score,
    running: t.partial ? t.score : t.week === lastFinished?.week ? t.score : null,
  }));

  return (
    <>
      <div className="chart" role="img" aria-label="Weekly consistency score for the last 12 weeks, as a line chart. The same values are in the table that follows for screen readers.">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="week"
              tickFormatter={dateShort}
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: 'var(--line-strong)' }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              content={({ active, payload }) => {
                const t = payload?.[0]?.payload;
                return (
                  <ChartTip active={active && t}>
                    {t && (
                      <>
                        <strong>{weekRange(t.week)}</strong>
                        <span>Score {t.score ?? 'n/a'}{t.partial ? ' so far' : ''}</span>
                        <span>
                          {t.goalsMet} of {t.goalsTotal} targets reached
                        </span>
                        <span>{plural(t.sessions, 'session')}, {minutes(t.minutes)}</span>
                      </>
                    )}
                  </ChartTip>
                );
              }}
            />
            <Line
              dataKey="done"
              name="Score"
              stroke="var(--accent-strong)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--accent-strong)' }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="running"
              name="This week so far"
              stroke="var(--accent-strong)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--accent-strong)' }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Weekly consistency score</caption>
        <thead>
          <tr>
            <th>Week</th>
            <th>Score</th>
            <th>Targets reached</th>
            <th>Minutes</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((t) => (
            <tr key={t.week}>
              <td>{weekRange(t.week)}</td>
              <td>{t.score ?? 'No targets'}</td>
              <td>
                {t.goalsMet} of {t.goalsTotal}
              </td>
              <td>{t.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function DailyBars({ daily }) {
  return (
    <div className="chart" role="img" aria-label={`Minutes per day: ${daily.map((d) => `${dayShort(d.date)} ${d.minutes}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={daily} margin={{ top: 12, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" tickFormatter={dayShort} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--hover)' }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload;
              return (
                <ChartTip active={active && d}>
                  {d && (
                    <>
                      <strong>{dateLong(d.date)}</strong>
                      <span>{d.minutes ? minutes(d.minutes) : 'Rest day'}</span>
                      {d.activities.length > 0 && <span>{d.activities.map((a) => activityInfo(a).label).join(', ')}</span>}
                    </>
                  )}
                </ChartTip>
              );
            }}
          />
          <Bar dataKey="minutes" name="Minutes" fill="var(--accent-strong)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityBars({ rows, showDays = false }) {
  const max = Math.max(...rows.map((r) => r.minutes), 1);
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.activity}>
          <ActivityIcon activity={r.activity} size={16} />
          <div className="hbar-main">
            <div className="hbar-top">
              <span>{activityInfo(r.activity).label}</span>
              <span className="muted-2 tabular small">
                {minutes(r.minutes)} · {r.share}%
              </span>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(r.minutes / max) * 100}%` }} />
            </div>
            <span className="muted small">
              {plural(r.sessions, 'session')}
              {showDays && r.daysSince !== undefined && `, last ${r.daysSince === 0 ? 'today' : `${r.daysSince}d ago`}`}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const level = (m) => (m === 0 ? 0 : m < 25 ? 1 : m < 45 ? 2 : m < 70 ? 3 : 4);

export function Heatmap({ heatmap }) {
  const navigate = useNavigate();
  const [tip, setTip] = useState(null);
  const weeks = [];
  heatmap.cells.forEach((cell, i) => {
    if (i % 7 === 0) weeks.push([]);
    weeks.at(-1).push(cell);
  });
  const active = heatmap.cells.filter((c) => c.sessions > 0).length;

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <div className="heatmap" onMouseLeave={() => setTip(null)}>
          <div className="heat-days" aria-hidden="true">
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
            <span>Sun</span>
          </div>
          {weeks.map((cells, i) => {
            const first = cells[0].date;
            const showMonth = i === 0 || monthShort(first) !== monthShort(weeks[i - 1][0].date);
            return (
              <div className="heat-week" key={first}>
                <span className="heat-month" aria-hidden="true">
                  {showMonth && i < weeks.length - 1 ? monthShort(first) : ''}
                </span>
                {cells.map((c) => {
                  const text = `${dateLong(c.date)}: ${
                    c.sessions ? `${plural(c.sessions, 'session')}, ${minutes(c.minutes)}` : 'no workout'
                  }`;
                  return (
                    <button
                      key={c.date}
                      type="button"
                      className={`heat-cell heat-${level(c.minutes)}`}
                      aria-label={text}
                      onMouseEnter={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setTip({ c, x: box.left + box.width / 2, y: box.top });
                      }}
                      onFocus={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setTip({ c, x: box.left + box.width / 2, y: box.top });
                      }}
                      onBlur={() => setTip(null)}
                      onClick={() => navigate(`/weekly?week=${first}`)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="heat-foot">
        <span className="muted-2 small">{active} active days in the last 6 months. Select a day to open its week.</span>
        <span className="heat-legend small muted-2" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`heat-cell heat-${l}`} />
          ))}
          More
        </span>
      </div>
      {tip && (
        <div className="chart-tip heat-tip" style={{ left: tip.x, top: tip.y }}>
          <strong>{dateLong(tip.c.date)}</strong>
          {tip.c.sessions ? (
            <>
              <span>{plural(tip.c.sessions, 'session')}, {minutes(tip.c.minutes)}</span>
              <span>{tip.c.activities.map((a) => activityInfo(a).label).join(', ')}</span>
            </>
          ) : (
            <span>No workout</span>
          )}
        </div>
      )}
    </div>
  );
}

/** This week's running total against the average of your previous weeks: a race with your own ghost. */
export function GhostChart({ ghost }) {
  return (
    <>
      <div className="ghost-legend" aria-hidden="true">
        <span>
          <i className="ghost-swatch ghost-swatch-you" /> You, this week
        </span>
        <span>
          <i className="ghost-swatch ghost-swatch-ghost" /> Your {ghost.weeksCompared}-week average
        </span>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`Cumulative minutes this week: ${ghost.days
          .map((d) => `${dayShort(d.date)} you ${d.you ?? 'upcoming'}, average ${d.ghost}`)
          .join('; ')}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={ghost.days} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickFormatter={dayShort} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload;
                return (
                  <ChartTip active={active && d}>
                    {d && (
                      <>
                        <strong>{dateLong(d.date)}</strong>
                        <span>You: {d.you === null ? 'still to come' : `${d.you} min so far`}</span>
                        <span>Average self: {d.ghost} min</span>
                      </>
                    )}
                  </ChartTip>
                );
              }}
            />
            <Line
              dataKey="ghost"
              name="Average self"
              stroke="var(--ink-2)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--ink-2)' }}
              isAnimationActive={false}
            />
            <Line
              dataKey="you"
              name="You"
              stroke="var(--accent-strong)"
              strokeWidth={3}
              dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--accent-strong)' }}
              activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--accent-strong)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
