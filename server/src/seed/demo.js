import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Goal } from '../models/Goal.js';
import { Plan } from '../models/Plan.js';
import { User } from '../models/User.js';
import { Workout } from '../models/Workout.js';
import { addDays, diffDays, localToday, weekStart } from '../utils/dates.js';

const DEMO_EMAIL = 'demo@fitnessconsistency.local';
const WEEKS = 26;
// Bump when the demo story changes, so existing demo accounts are rebuilt with the new data.
const DEMO_VERSION = 4;

// Typical post-workout feeling (1-5) per activity, so the feelings insight has a pattern to find.
const FEEL_BASE = { yoga: 4.5, walking: 4.2, cycling: 4, swimming: 3.9, running: 3.8, strength: 3.5, hiit: 3.1 };

// Small seeded generator, so every demo reset produces the same believable story.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTES = {
  running: ['Easy pace along the lake', 'Tempo intervals, felt strong', 'Slow start, good finish', 'Morning run before class'],
  walking: ['Evening walk with music', 'Walked to campus and back'],
  cycling: ['Long weekend ride', 'Hill repeats'],
  strength: ['Upper body push day', 'Legs and core', 'Full body, added weight', 'Pull day, new deadlift best'],
  yoga: ['Slow flow to unwind', 'Hip mobility focus'],
  swimming: ['Laps at the college pool'],
  hiit: ['20-minute circuit, tough one'],
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function buildDemoData(today) {
  const rng = mulberry32(2102508569);
  const thisWeek = weekStart(today);
  const workouts = [];
  const feelRng = mulberry32(42); // separate stream: adding feelings doesn't reshuffle the workouts

  // Fixed weekly rhythm: [day offset, activity, chance it happens, base minutes].
  const rhythm = [
    [0, 'running', 0.82, 32],
    [1, 'strength', 0.85, 45],
    [2, 'yoga', 0.62, 25],
    [3, 'running', 0.72, 35],
    [4, 'strength', 0.72, 45],
    [5, 'cycling', 0.5, 60],
    [6, 'walking', 0.45, 40],
  ];

  for (let i = WEEKS - 1; i >= 0; i -= 1) {
    const week = addDays(thisWeek, -7 * i);
    const age = (WEEKS - 1 - i) / (WEEKS - 1); // 0 = oldest week, 1 = this week
    // Starts rough, builds up, dips around exams (weeks 10-11 back from the end), recovers.
    let form = 0.55 + 0.5 * age;
    if (i === 10 || i === 11) form = 0.35;
    if (i <= 1) form = 1.25;

    for (const [offset, activity, chance, minutes] of rhythm) {
      const date = addDays(week, offset);
      if (date > today || rng() > chance * form) continue;
      const durationMin = Math.max(10, Math.round((minutes * (0.8 + rng() * 0.45)) / 5) * 5);
      const pace = { running: 6.4, walking: 10.5, cycling: 3 }[activity];
      workouts.push({
        activity,
        date,
        durationMin,
        intensity: Math.min(5, Math.max(1, Math.round(2.5 + rng() * 2))),
        distanceKm: pace ? Math.round((durationMin / pace) * 10) / 10 : undefined,
        notes: rng() < 0.45 ? pick(rng, NOTES[activity]) : '',
      });
    }
    // Swimming and HIIT appear for a while and then stop, so the balance insight has something to say.
    if (i > 8 && i < 18 && rng() < 0.5) {
      workouts.push({
        activity: 'swimming',
        date: addDays(week, 5),
        durationMin: 40,
        intensity: 3,
        distanceKm: 1.2,
        notes: pick(rng, NOTES.swimming),
      });
    }
    if (i < 6 && rng() < 0.4 && addDays(week, 2) <= today) {
      workouts.push({
        activity: 'hiit',
        date: addDays(week, 2),
        durationMin: 20,
        intensity: 5,
        notes: pick(rng, NOTES.hiit),
      });
    }
  }

  for (const w of workouts) {
    if (feelRng() < 0.85) {
      w.feeling = Math.min(5, Math.max(1, Math.round(FEEL_BASE[w.activity] + (feelRng() - 0.5) * 1.6)));
    }
  }

  // A plan for this week and next, following the usual rhythm.
  const plans = [];
  for (const week of [thisWeek, addDays(thisWeek, 7)]) {
    for (const [offset, activity, , minutes] of rhythm.slice(0, 6)) {
      plans.push({
        date: addDays(week, offset),
        activity,
        durationMin: minutes >= 40 ? Math.round(minutes / 5) * 5 : 30,
        note: activity === 'cycling' ? 'Long ride if the weather holds' : '',
      });
    }
  }

  const start = addDays(thisWeek, -7 * (WEEKS - 1));
  const raised = addDays(thisWeek, -7 * 8);
  const goals = [
    { name: 'Train 4 days a week', activity: 'all', metric: 'activeDays', targets: [{ week: start, value: 3 }, { week: raised, value: 4 }] },
    { name: '150 active minutes', activity: 'all', metric: 'minutes', targets: [{ week: start, value: 150 }] },
    { name: 'Lift twice a week', activity: 'strength', metric: 'sessions', targets: [{ week: start, value: 2 }] },
    { name: 'Run twice a week', activity: 'running', metric: 'sessions', targets: [{ week: start, value: 2 }] },
    { name: 'Weekly yoga session', activity: 'yoga', metric: 'sessions', targets: [{ week: start, value: 1 }] },
  ].map((g) => ({ ...g, startWeek: start }));

  return { workouts, goals, plans };
}

export async function resetDemoData(user, today = localToday()) {
  const { workouts, goals, plans } = buildDemoData(today);
  await Promise.all([
    Workout.deleteMany({ user: user._id }),
    Goal.deleteMany({ user: user._id }),
    Plan.deleteMany({ user: user._id }),
  ]);
  await Workout.insertMany(workouts.map((w) => ({ ...w, user: user._id })));
  await Goal.insertMany(goals.map((g) => ({ ...g, user: user._id })));
  await Plan.insertMany(plans.map((p) => ({ ...p, user: user._id })));
  user.demoVersion = DEMO_VERSION;
  await user.save();
}

/** Finds or creates the demo user, and re-seeds if its data has gone stale. */
export async function ensureDemoUser() {
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    // A random password: the demo is entered through its button and can't be logged into.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    user = await User.create({ name: 'Demo Athlete', email: DEMO_EMAIL, passwordHash, isDemo: true });
    await resetDemoData(user);
    return user;
  }
  const latest = await Workout.findOne({ user: user._id }).sort({ date: -1 }).lean();
  const stale = !latest || diffDays(localToday(), latest.date) > 3;
  if (stale || user.demoVersion !== DEMO_VERSION) await resetDemoData(user);
  return user;
}
