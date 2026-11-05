import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFeelings,
  buildGhost,
  buildRecords,
  buildStreaks,
  consistencyScore,
  evaluateGoals,
  goalAppliesToWeek,
  matchPlans,
  recordsBroken,
  targetForWeek,
} from '../src/services/stats.js';
import { addDays, isValidDate, weekStart } from '../src/utils/dates.js';

const WEEK = '2026-10-26'; // a Monday
const w = (date, activity = 'running', durationMin = 30) => ({ date, activity, durationMin, intensity: 3 });
const goal = (over = {}) => ({
  _id: 'g1',
  name: 'Goal',
  activity: 'all',
  metric: 'sessions',
  startWeek: '2026-01-05',
  archivedFromWeek: null,
  targets: [{ week: '2026-01-05', value: 2 }],
  ...over,
});

describe('dates', () => {
  it('finds the Monday of a week, including across month ends', () => {
    assert.equal(weekStart('2026-11-01'), '2026-10-26'); // Sunday
    assert.equal(weekStart('2026-10-26'), '2026-10-26'); // Monday
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  });
  it('rejects impossible dates', () => {
    assert.equal(isValidDate('2026-02-30'), false);
    assert.equal(isValidDate('26-1-1'), false);
    assert.equal(isValidDate('2028-02-29'), true);
  });
});

describe('goal evaluation', () => {
  it('counts sessions, minutes and distinct active days', () => {
    const list = [w('2026-10-26'), w('2026-10-26'), w('2026-10-28', 'yoga', 20)];
    const results = evaluateGoals(
      [
        goal({ metric: 'sessions' }),
        goal({ metric: 'minutes', targets: [{ week: '2026-01-05', value: 80 }] }),
        goal({ metric: 'activeDays' }),
        goal({ activity: 'yoga' }),
      ],
      list,
      WEEK,
      '2026-11-01',
    );
    assert.deepEqual(results.map((r) => r.actual), [3, 80, 2, 1]);
  });

  it('caps a goal at 100% so overachieving cannot hide a miss', () => {
    const results = evaluateGoals(
      [goal({ activity: 'running' }), goal({ activity: 'yoga' })],
      [w(WEEK), w(WEEK), w(WEEK), w(WEEK)],
      WEEK,
      '2026-11-01',
    );
    assert.equal(results[0].percent, 100);
    assert.equal(consistencyScore(results), 50);
  });

  it('gives no score when no goal applied', () => {
    assert.equal(consistencyScore([]), null);
  });

  it('judges past weeks against the target of that time', () => {
    const g = goal({
      targets: [
        { week: '2026-01-05', value: 2 },
        { week: '2026-10-05', value: 5 },
      ],
    });
    assert.equal(targetForWeek(g, '2026-09-28'), 2);
    assert.equal(targetForWeek(g, '2026-10-05'), 5);
    assert.equal(targetForWeek(g, '2026-10-26'), 5);
  });

  it('applies a goal only between its start and archive weeks', () => {
    const g = goal({ startWeek: '2026-03-02', archivedFromWeek: '2026-06-01' });
    assert.equal(goalAppliesToWeek(g, '2026-02-23'), false);
    assert.equal(goalAppliesToWeek(g, '2026-03-02'), true);
    assert.equal(goalAppliesToWeek(g, '2026-05-25'), true);
    assert.equal(goalAppliesToWeek(g, '2026-06-01'), false);
  });

  it('reports pace within the current week and missed for past weeks', () => {
    const g = goal({ targets: [{ week: '2026-01-05', value: 7 }] });
    const status = (today, list) => evaluateGoals([g], list, WEEK, today)[0].status;
    assert.equal(status('2026-10-27', [w('2026-10-26'), w('2026-10-27')]), 'onTrack');
    assert.equal(status('2026-10-30', [w('2026-10-26')]), 'behind');
    assert.equal(status('2026-11-05', [w('2026-10-26')]), 'missed');
  });
});

describe('streaks', () => {
  it('keeps a day streak alive until today has passed', () => {
    const list = [w('2026-10-29'), w('2026-10-30'), w('2026-10-31')];
    assert.equal(buildStreaks(list, [], '2026-10-31').currentDays, 3);
    assert.equal(buildStreaks(list, [], '2026-11-01').currentDays, 3);
    assert.equal(buildStreaks(list, [], '2026-11-02').currentDays, 0);
    assert.equal(buildStreaks(list, [], '2026-11-02').longestDays, 3);
  });

  it('does not let an unfinished current week break the goal-week streak', () => {
    const g = goal({ startWeek: '2026-10-12', targets: [{ week: '2026-10-12', value: 1 }] });
    const list = [w('2026-10-12'), w('2026-10-19')];
    assert.equal(buildStreaks(list, [g], '2026-10-27').currentWeeks, 2);
    assert.equal(buildStreaks(list, [g], '2026-11-03').currentWeeks, 0);
    assert.equal(buildStreaks(list, [g], '2026-11-03').longestWeeks, 2);
  });
});

describe('personal records', () => {
  it('finds the longest session, longest distance, fastest pace and biggest week', () => {
    const list = [
      { ...w('2026-10-26', 'running', 30), distanceKm: 5 }, // 6:00 /km
      { ...w('2026-10-27', 'running', 50), distanceKm: 8 }, // 6:15 /km
      { ...w('2026-10-19', 'yoga', 70) },
      { ...w('2026-10-28', 'running', 4), distanceKm: 0.8 }, // too short to count for pace
    ];
    const byId = Object.fromEntries(buildRecords(list).map((r) => [r.id, r]));
    assert.equal(byId['longest-session'].display, '70 min');
    assert.equal(byId['distance-running'].display, '8 km');
    assert.equal(byId['fastest-run-pace'].display, '6:00 /km');
    assert.equal(byId['biggest-week'].value, 84);
  });

  it('reports only records that improved on an existing one', () => {
    const before = buildRecords([{ ...w('2026-10-26', 'running', 30), distanceKm: 5 }]);
    const after = buildRecords([
      { ...w('2026-10-26', 'running', 30), distanceKm: 5 },
      { ...w('2026-10-27', 'cycling', 45), distanceKm: 15 },
    ]);
    const ids = recordsBroken(before, after).map((r) => r.id);
    assert.deepEqual(ids.sort(), ['biggest-week', 'longest-session']); // first cycling distance is not a "beat"
  });
});

describe('ghost race', () => {
  it('compares this week, day by day, with the average of the previous four', () => {
    // 40 minutes every Monday for four weeks, so the ghost has 40 by Monday and stays there.
    const history = [1, 2, 3, 4].map((i) => w(addDays('2026-10-26', -7 * i), 'running', 40));
    const ghost = buildGhost([...history, w('2026-10-26', 'running', 25), w('2026-10-27', 'yoga', 30)], '2026-10-28');
    assert.equal(ghost.days[0].ghost, 40);
    assert.equal(ghost.days[6].ghost, 40);
    assert.deepEqual(ghost.days.map((d) => d.you).slice(0, 4), [25, 55, 55, null]);
    assert.equal(ghost.youToDate, 55);
    assert.equal(ghost.ghostToDate, 40);
    assert.equal(ghost.hasHistory, true);
  });
});

describe('feelings', () => {
  it('averages how each activity leaves you feeling', () => {
    const rate = (activity, feeling) => ({ ...w('2026-10-26', activity), feeling });
    const result = buildFeelings([
      rate('yoga', 5), rate('yoga', 5), rate('yoga', 4),
      rate('hiit', 2), rate('hiit', 3), rate('hiit', 3),
      w('2026-10-26', 'running'),
    ]);
    assert.equal(result.count, 6);
    assert.equal(result.byActivity[0].activity, 'yoga');
    assert.equal(result.byActivity[0].average, 4.7);
  });
});

describe('plan matching', () => {
  it('marks a plan done once per matching workout, and missed when its day has passed', () => {
    const plans = [
      { _id: 'a', date: '2026-10-26', activity: 'running' },
      { _id: 'b', date: '2026-10-26', activity: 'running' },
      { _id: 'c', date: '2026-10-29', activity: 'yoga' },
    ];
    const status = matchPlans(plans, [w('2026-10-26', 'running')], '2026-10-28').map((p) => p.status);
    assert.deepEqual(status, ['done', 'missed', 'planned']);
  });
});
