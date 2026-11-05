// Pure statistics functions: plain data in, plain data out, no database access.
// Every "score" here compares a person with their own targets. Nothing compares users.

import { ACTIVITIES, ACTIVITY_LABELS } from '../constants.js';
import { addDays, diffDays, weekDates, weekStart, weekdayIndex } from '../utils/dates.js';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function groupByWeek(workouts) {
  const map = new Map();
  for (const w of workouts) {
    const key = weekStart(w.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(w);
  }
  return map;
}

export function goalAppliesToWeek(goal, week) {
  return goal.startWeek <= week && (!goal.archivedFromWeek || week < goal.archivedFromWeek);
}

export function targetForWeek(goal, week) {
  let value = goal.targets[0].value;
  for (const t of goal.targets) {
    if (t.week <= week) value = t.value;
  }
  return value;
}

export function metricValue(goal, weekWorkouts) {
  const relevant =
    goal.activity === 'all' ? weekWorkouts : weekWorkouts.filter((w) => w.activity === goal.activity);
  switch (goal.metric) {
    case 'sessions':
      return relevant.length;
    case 'minutes':
      return relevant.reduce((sum, w) => sum + w.durationMin, 0);
    case 'activeDays':
      return new Set(relevant.map((w) => w.date)).size;
    default:
      return 0;
  }
}

function goalStatus(actual, target, week, today) {
  if (actual >= target) return 'met';
  const current = weekStart(today);
  if (week < current) return 'missed';
  // Days fully or partly used so far, Monday = 1 ... Sunday = 7.
  const elapsed = week === current ? weekdayIndex(today) + 1 : 0;
  return actual >= (target * elapsed) / 7 ? 'onTrack' : 'behind';
}

export function evaluateGoals(goals, weekWorkouts, week, today) {
  return goals
    .filter((g) => goalAppliesToWeek(g, week))
    .map((g) => {
      const target = targetForWeek(g, week);
      const actual = metricValue(g, weekWorkouts);
      return {
        id: String(g._id ?? g.id),
        name: g.name,
        activity: g.activity,
        metric: g.metric,
        target,
        actual,
        // Capped at 100: beating one target can't hide missing another.
        percent: Math.min(100, Math.round((actual / target) * 100)),
        status: goalStatus(actual, target, week, today),
      };
    });
}

/** Mean of capped goal completion for a week, or null when no goal applied that week. */
export function consistencyScore(goalResults) {
  if (goalResults.length === 0) return null;
  return Math.round(goalResults.reduce((sum, g) => sum + g.percent, 0) / goalResults.length);
}

export function weekTotals(weekWorkouts) {
  return {
    sessions: weekWorkouts.length,
    minutes: weekWorkouts.reduce((s, w) => s + w.durationMin, 0),
    activeDays: new Set(weekWorkouts.map((w) => w.date)).size,
    distanceKm: Math.round(weekWorkouts.reduce((s, w) => s + (w.distanceKm || 0), 0) * 10) / 10,
    avgIntensity: weekWorkouts.length
      ? Math.round((weekWorkouts.reduce((s, w) => s + w.intensity, 0) / weekWorkouts.length) * 10) / 10
      : 0,
    activityTypes: new Set(weekWorkouts.map((w) => w.activity)).size,
    avgFeeling: weekWorkouts.some((w) => w.feeling)
      ? Math.round(
          (weekWorkouts.filter((w) => w.feeling).reduce((s, w) => s + w.feeling, 0) /
            weekWorkouts.filter((w) => w.feeling).length) *
            10,
        ) / 10
      : null,
  };
}

export function activityBreakdown(workouts) {
  const total = workouts.reduce((s, w) => s + w.durationMin, 0);
  const map = new Map();
  for (const w of workouts) {
    const row = map.get(w.activity) || { activity: w.activity, sessions: 0, minutes: 0, distanceKm: 0 };
    row.sessions += 1;
    row.minutes += w.durationMin;
    row.distanceKm += w.distanceKm || 0;
    map.set(w.activity, row);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      distanceKm: Math.round(r.distanceKm * 10) / 10,
      share: total ? Math.round((r.minutes / total) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function buildNarrative(summary, previous) {
  const { totals, goals, week, today } = summary;
  const isCurrent = week === weekStart(today);
  const parts = [];

  if (totals.sessions === 0) {
    return isCurrent
      ? 'Nothing logged yet this week. One short session gets the week started.'
      : 'No workouts were logged this week.';
  }

  parts.push(
    `${isCurrent ? 'So far you have logged' : 'You logged'} ${totals.sessions} ${
      totals.sessions === 1 ? 'session' : 'sessions'
    } across ${totals.activeDays} ${totals.activeDays === 1 ? 'day' : 'days'}, for ${totals.minutes} minutes in total.`,
  );

  if (goals.length) {
    const met = goals.filter((g) => g.status === 'met').length;
    if (met === goals.length) parts.push(`You reached all ${goals.length} of your targets.`);
    else if (met > 0) parts.push(`You reached ${met} of your ${goals.length} targets.`);
    else if (!isCurrent) parts.push(`None of your ${goals.length} targets were reached.`);
  }

  if (previous && previous.minutes > 0) {
    const change = Math.round(((totals.minutes - previous.minutes) / previous.minutes) * 100);
    if (!isCurrent && Math.abs(change) >= 5) {
      parts.push(`That is ${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} time than the week before.`);
    }
  }
  return parts.join(' ');
}

export function buildWeekSummary(workouts, goals, week, today) {
  const byWeek = groupByWeek(workouts);
  const current = byWeek.get(week) || [];
  const prevWeek = addDays(week, -7);
  const prevWorkouts = byWeek.get(prevWeek) || [];
  const goalResults = evaluateGoals(goals, current, week, today);
  const totals = weekTotals(current);
  const previous = weekTotals(prevWorkouts);

  const daily = weekDates(week).map((date) => {
    const day = current.filter((w) => w.date === date);
    return {
      date,
      minutes: day.reduce((s, w) => s + w.durationMin, 0),
      sessions: day.length,
      activities: [...new Set(day.map((w) => w.activity))],
    };
  });

  const summary = {
    week,
    today,
    totals,
    previous,
    score: consistencyScore(goalResults),
    previousScore: consistencyScore(evaluateGoals(goals, prevWorkouts, prevWeek, today)),
    goals: goalResults,
    daily,
    byActivity: activityBreakdown(current),
    workouts: [...current].sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
  summary.narrative = buildNarrative(summary, previous);
  return summary;
}

export function buildTrends(workouts, goals, today, count = 12) {
  const byWeek = groupByWeek(workouts);
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => {
    const week = addDays(current, -7 * (count - 1 - i));
    const weekWorkouts = byWeek.get(week) || [];
    const results = evaluateGoals(goals, weekWorkouts, week, today);
    const totals = weekTotals(weekWorkouts);
    return {
      week,
      partial: week === current,
      score: consistencyScore(results),
      goalsMet: results.filter((r) => r.status === 'met').length,
      goalsTotal: results.length,
      minutes: totals.minutes,
      sessions: totals.sessions,
      activityTypes: totals.activityTypes,
    };
  });
}

export function buildStreaks(workouts, goals, today) {
  const dates = [...new Set(workouts.map((w) => w.date))].filter((d) => d <= today).sort();
  let longestDays = 0;
  let run = 0;
  for (let i = 0; i < dates.length; i += 1) {
    run = i > 0 && diffDays(dates[i], dates[i - 1]) === 1 ? run + 1 : 1;
    longestDays = Math.max(longestDays, run);
  }
  // A streak stays alive through today until today has passed without a workout.
  let currentDays = 0;
  const set = new Set(dates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    currentDays += 1;
    cursor = addDays(cursor, -1);
  }

  // Goal weeks: the more forgiving streak, since rest days are part of training.
  const byWeek = groupByWeek(workouts);
  const thisWeek = weekStart(today);
  const starts = goals.map((g) => g.startWeek).sort();
  const isPerfect = (week) => {
    const results = evaluateGoals(goals, byWeek.get(week) || [], week, today);
    return results.length > 0 && results.every((r) => r.status === 'met');
  };
  let longestWeeks = 0;
  let weekRun = 0;
  if (starts.length) {
    for (let w = starts[0]; w <= thisWeek; w = addDays(w, 7)) {
      if (isPerfect(w)) {
        weekRun += 1;
        longestWeeks = Math.max(longestWeeks, weekRun);
      } else if (w !== thisWeek) {
        weekRun = 0;
      }
    }
  }
  // After the loop weekRun already includes this week if it is complete, and an unfinished
  // current week has not broken it.
  return { currentDays, longestDays, currentWeeks: weekRun, longestWeeks };
}

export function buildHeatmap(workouts, today, days = 182) {
  const from = addDays(weekStart(today), -7 * (Math.ceil(days / 7) - 1));
  const map = new Map();
  for (const w of workouts) {
    if (w.date < from || w.date > today) continue;
    const row = map.get(w.date) || { minutes: 0, sessions: 0, activities: new Set() };
    row.minutes += w.durationMin;
    row.sessions += 1;
    row.activities.add(w.activity);
    map.set(w.date, row);
  }
  const cells = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const row = map.get(d);
    cells.push({
      date: d,
      minutes: row?.minutes ?? 0,
      sessions: row?.sessions ?? 0,
      activities: row ? [...row.activities] : [],
    });
  }
  return { from, to: today, cells };
}

export function buildBalance(workouts, today) {
  const since28 = addDays(today, -27);
  const recent = workouts.filter((w) => w.date >= since28 && w.date <= today);
  const lastDone = {};
  for (const w of workouts) {
    if (!lastDone[w.activity] || w.date > lastDone[w.activity]) lastDone[w.activity] = w.date;
  }
  const breakdown = activityBreakdown(recent).map((row) => ({
    ...row,
    daysSince: diffDays(today, lastDone[row.activity]),
  }));
  const dropped = ACTIVITIES.filter(
    (a) => lastDone[a] && !recent.some((w) => w.activity === a) && diffDays(today, lastDone[a]) <= 120,
  ).map((a) => ({ activity: a, daysSince: diffDays(today, lastDone[a]) }));
  return { breakdown, dropped };
}

export function buildInsights(workouts, goals, today) {
  const insights = [];
  const label = (a) => ACTIVITY_LABELS[a] || a;
  const thisWeek = weekStart(today);
  const history = workouts.filter((w) => w.date < thisWeek);
  const byWeek = groupByWeek(workouts);

  if (history.length >= 8) {
    const counts = Array(7).fill(0);
    for (const w of history) counts[weekdayIndex(w.date)] += 1;
    const best = counts.indexOf(Math.max(...counts));
    insights.push({
      kind: 'pattern',
      title: `${WEEKDAYS[best]} is your most reliable day`,
      body: `${Math.round((counts[best] / history.length) * 100)}% of your past workouts landed on a ${WEEKDAYS[best]}.`,
    });
  }

  // Compare the last 4 finished weeks of goal results against the 4 before them.
  const scores = buildTrends(workouts, goals, addDays(thisWeek, -1), 8)
    .map((t) => t.score)
    .filter((s) => s !== null);
  if (scores.length === 8) {
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const delta = Math.round(avg(scores.slice(4)) - avg(scores.slice(0, 4)));
    if (Math.abs(delta) >= 5) {
      insights.push({
        kind: delta > 0 ? 'up' : 'down',
        title: delta > 0 ? 'Your consistency is climbing' : 'Your consistency has slipped',
        body: `Your last 4 weeks averaged ${Math.abs(delta)} points ${delta > 0 ? 'above' : 'below'} the 4 weeks before.`,
      });
    } else {
      insights.push({
        kind: 'steady',
        title: 'You are holding steady',
        body: 'Your score over the last 4 weeks is close to the 4 weeks before.',
      });
    }
  }

  const { dropped } = buildBalance(workouts, today);
  if (dropped.length) {
    const d = dropped.sort((a, b) => a.daysSince - b.daysSince)[0];
    insights.push({
      kind: 'balance',
      title: `${label(d.activity)} has dropped off`,
      body: `Your last ${label(d.activity).toLowerCase()} session was ${d.daysSince} days ago.`,
    });
  }

  // The goal most often missed over the last 6 finished weeks is the one to rethink.
  const tally = new Map();
  for (let i = 1; i <= 6; i += 1) {
    const week = addDays(thisWeek, -7 * i);
    for (const r of evaluateGoals(goals, byWeek.get(week) || [], week, today)) {
      const t = tally.get(r.id) || { name: r.name, missed: 0, total: 0 };
      t.total += 1;
      if (r.status !== 'met') t.missed += 1;
      tally.set(r.id, t);
    }
  }
  const worst = [...tally.values()]
    .filter((t) => t.total >= 3)
    .sort((a, b) => b.missed / b.total - a.missed / a.total)[0];
  if (worst && worst.missed / worst.total >= 0.5) {
    insights.push({
      kind: 'target',
      title: `"${worst.name}" is your hardest target`,
      body: `Missed in ${worst.missed} of the last ${worst.total} weeks. A smaller target you hit beats a big one you don't.`,
    });
  }

  const feelings = buildFeelings(workouts);
  const top = feelings.byActivity[0];
  if (top && feelings.byActivity.length >= 2 && top.average - feelings.average >= 0.3) {
    insights.push({
      kind: 'feeling',
      title: `${label(top.activity)} leaves you feeling best`,
      body: `You rate yourself ${top.average} / 5 after ${label(top.activity).toLowerCase()}, against ${feelings.average} on average.`,
    });
  }

  return insights;
}

export function buildAchievements(workouts, goals, today) {
  const totalMinutes = workouts.reduce((s, w) => s + w.durationMin, 0);
  const totalKm = workouts.reduce((s, w) => s + (w.distanceKm || 0), 0);
  const types = new Set(workouts.map((w) => w.activity)).size;
  const streaks = buildStreaks(workouts, goals, today);
  const byWeek = groupByWeek(workouts);
  const mostTypesInWeek = Math.max(
    0,
    ...[...byWeek.values()].map((list) => new Set(list.map((w) => w.activity)).size),
  );

  const item = (id, title, description, value, goal, group) => ({
    id,
    title,
    description,
    group,
    progress: Math.min(value, goal),
    goal,
    earned: value >= goal,
  });

  return [
    item('first', 'First entry', 'Log your first workout', workouts.length, 1, 'Volume'),
    item('w25', 'Quarter century', 'Log 25 workouts', workouts.length, 25, 'Volume'),
    item('w100', 'Centurion', 'Log 100 workouts', workouts.length, 100, 'Volume'),
    item('m1000', 'Thousand minutes', 'Reach 1,000 total minutes', totalMinutes, 1000, 'Volume'),
    item('m6000', 'Hundred hours', 'Reach 6,000 total minutes', totalMinutes, 6000, 'Volume'),
    item('km100', 'Long road', 'Cover 100 km in total', Math.floor(totalKm), 100, 'Volume'),
    item('d7', 'Full week', 'Be active 7 days in a row', streaks.longestDays, 7, 'Consistency'),
    item('wk1', 'Clean sweep', 'Reach every target in one week', streaks.longestWeeks, 1, 'Consistency'),
    item('wk4', 'Solid month', 'Reach every target 4 weeks running', streaks.longestWeeks, 4, 'Consistency'),
    item('wk12', 'Unbroken quarter', 'Reach every target 12 weeks running', streaks.longestWeeks, 12, 'Consistency'),
    item('v3', 'Mixed week', 'Do 3 activity types in one week', mostTypesInWeek, 3, 'Variety'),
    item('v5', 'All-rounder', 'Try 5 different activity types', types, 5, 'Variety'),
  ];
}

/* ---------- Personal records ---------- */

const PACE_MIN_KM = 1; // shorter runs give unreliable paces

function formatPace(minPerKm) {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`;
}

/** Best-ever marks from the log. `better` says which direction counts as an improvement. */
export function buildRecords(workouts) {
  const records = [];
  const best = (list, score) => list.reduce((top, w) => (top && score(top) >= score(w) ? top : w), null);

  const longest = best(workouts, (w) => w.durationMin);
  if (longest) {
    records.push({
      id: 'longest-session',
      title: 'Longest session',
      value: longest.durationMin,
      display: `${longest.durationMin} min`,
      date: longest.date,
      activity: longest.activity,
    });
  }

  for (const activity of ['running', 'cycling', 'walking', 'swimming']) {
    const top = best(
      workouts.filter((w) => w.activity === activity && w.distanceKm),
      (w) => w.distanceKm,
    );
    if (top) {
      records.push({
        id: `distance-${activity}`,
        title: `Longest ${ACTIVITY_LABELS[activity].toLowerCase()} distance`,
        value: top.distanceKm,
        display: `${top.distanceKm} km`,
        date: top.date,
        activity,
      });
    }
  }

  const paced = workouts.filter((w) => w.activity === 'running' && w.distanceKm >= PACE_MIN_KM);
  const fastest = best(paced, (w) => -(w.durationMin / w.distanceKm));
  if (fastest) {
    const pace = fastest.durationMin / fastest.distanceKm;
    records.push({
      id: 'fastest-run-pace',
      title: 'Fastest running pace',
      value: -pace, // stored negated so that "higher is better" holds for every record
      display: formatPace(pace),
      date: fastest.date,
      activity: 'running',
    });
  }

  let topWeek = null;
  for (const [week, list] of groupByWeek(workouts)) {
    const minutes = list.reduce((s, w) => s + w.durationMin, 0);
    if (!topWeek || minutes > topWeek.minutes) topWeek = { week, minutes };
  }
  if (topWeek) {
    records.push({
      id: 'biggest-week',
      title: 'Biggest week',
      value: topWeek.minutes,
      display: `${topWeek.minutes} min`,
      date: topWeek.week,
      activity: 'all',
    });
  }
  return records;
}

/** Records that `after` improves on, ignoring records that didn't exist before (a first entry isn't a "beat"). */
export function recordsBroken(before, after) {
  const prev = new Map(before.map((r) => [r.id, r.value]));
  return after.filter((r) => prev.has(r.id) && r.value > prev.get(r.id));
}

/* ---------- Ghost race: this week against your own recent average ---------- */

export function buildGhost(workouts, today, weeks = 4) {
  const thisWeek = weekStart(today);
  const byWeek = groupByWeek(workouts);
  const cumulative = (list, week) => {
    let running = 0;
    return weekDates(week).map((date) => {
      running += list.filter((w) => w.date === date).reduce((s, w) => s + w.durationMin, 0);
      return running;
    });
  };

  const past = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (i + 1)));
  const pastCurves = past.map((week) => cumulative(byWeek.get(week) || [], week));
  const ghost = weekDates(thisWeek).map(
    (_, day) => Math.round(pastCurves.reduce((s, curve) => s + curve[day], 0) / weeks),
  );
  const you = cumulative(byWeek.get(thisWeek) || [], thisWeek);
  const todayIndex = weekdayIndex(today);

  return {
    week: thisWeek,
    weeksCompared: weeks,
    hasHistory: pastCurves.some((curve) => curve[6] > 0),
    days: weekDates(thisWeek).map((date, i) => ({
      date,
      you: i <= todayIndex ? you[i] : null,
      ghost: ghost[i],
    })),
    youToDate: you[todayIndex],
    ghostToDate: ghost[todayIndex],
    ghostWeek: ghost[6],
  };
}

/* ---------- How workouts make you feel ---------- */

export const FEELINGS = ['Drained', 'Meh', 'Okay', 'Good', 'Buzzing'];

export function buildFeelings(workouts) {
  const rated = workouts.filter((w) => w.feeling);
  if (!rated.length) return { average: null, count: 0, byActivity: [] };
  const avg = (list) => Math.round((list.reduce((s, w) => s + w.feeling, 0) / list.length) * 10) / 10;
  const groups = new Map();
  for (const w of rated) {
    if (!groups.has(w.activity)) groups.set(w.activity, []);
    groups.get(w.activity).push(w);
  }
  return {
    average: avg(rated),
    count: rated.length,
    byActivity: [...groups]
      .filter(([, list]) => list.length >= 3)
      .map(([activity, list]) => ({ activity, average: avg(list), count: list.length }))
      .sort((a, b) => b.average - a.average),
  };
}

/* ---------- Weekly plan ---------- */

/** Marks each planned session done when a workout of the same activity is logged that day. */
export function matchPlans(plans, workouts, today) {
  const unused = new Map();
  for (const w of workouts) {
    const key = `${w.date}|${w.activity}`;
    unused.set(key, (unused.get(key) || 0) + 1);
  }
  return [...plans]
    .sort((a, b) => (a.date === b.date ? String(a._id).localeCompare(String(b._id)) : a.date < b.date ? -1 : 1))
    .map((p) => {
      const key = `${p.date}|${p.activity}`;
      let status = p.date < today ? 'missed' : 'planned';
      if (unused.get(key) > 0) {
        unused.set(key, unused.get(key) - 1);
        status = 'done';
      }
      return { ...p, status };
    });
}
