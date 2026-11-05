import { Router } from 'express';
import { ACTIVITY_LABELS } from '../constants.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { Goal } from '../models/Goal.js';
import { Workout } from '../models/Workout.js';
import { buildRecords, goalAppliesToWeek, metricValue, recordsBroken, targetForWeek } from '../services/stats.js';
import { addDays, weekStart } from '../utils/dates.js';
import { objectId, workoutQuerySchema, workoutSchema } from '../validation.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter(userId, q) {
  const filter = { user: userId };
  if (q.activity) filter.activity = q.activity;
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = q.from;
    if (q.to) filter.date.$lte = q.to;
  }
  if (q.q) filter.notes = { $regex: escapeRegex(q.q), $options: 'i' };
  return filter;
}

async function findOwned(req) {
  const id = objectId.parse(req.params.id);
  const workout = await Workout.findOne({ _id: id, user: req.user._id });
  if (!workout) throw new ApiError(404, 'NOT_FOUND', 'Workout not found.');
  return workout;
}

/** Names of goals this new workout pushed over their target for its week. */
async function newlyCompletedGoals(userId, workout) {
  const week = weekStart(workout.date);
  const [goals, weekWorkouts] = await Promise.all([
    Goal.find({ user: userId }).lean(),
    Workout.find({ user: userId, date: { $gte: week, $lte: addDays(week, 6) } }).lean(),
  ]);
  const before = weekWorkouts.filter((w) => !w._id.equals(workout._id));
  return goals
    .filter((g) => goalAppliesToWeek(g, week))
    .filter((g) => {
      const target = targetForWeek(g, week);
      return metricValue(g, before) < target && metricValue(g, weekWorkouts) >= target;
    })
    .map((g) => g.name);
}

router.get('/', async (req, res) => {
  const q = workoutQuerySchema.parse(req.query);
  const filter = buildFilter(req.user._id, q);
  const sort = {
    newest: { date: -1, createdAt: -1 },
    oldest: { date: 1, createdAt: 1 },
    longest: { durationMin: -1, date: -1 },
  }[q.sort];

  const [items, agg] = await Promise.all([
    Workout.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit),
    Workout.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: 1 }, minutes: { $sum: '$durationMin' } } },
    ]),
  ]);
  const total = agg[0]?.total ?? 0;
  res.json({
    items,
    total,
    totalMinutes: agg[0]?.minutes ?? 0,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
});

// Registered before '/:id' so that "export.csv" is not read as an id.
router.get('/export.csv', async (req, res) => {
  const q = workoutQuerySchema.parse(req.query);
  const rows = await Workout.find(buildFilter(req.user._id, q)).sort({ date: -1 }).lean();
  const FEEL = ['', 'Drained', 'Meh', 'Okay', 'Good', 'Buzzing'];

  const cell = (value) => {
    let s = value === undefined || value === null ? '' : String(value);
    // Stop spreadsheets from running a note such as "=SUM(...)" as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    'Date,Activity,Duration (min),Intensity (1-5),Distance (km),Feeling,Notes',
    ...rows.map((w) =>
      [w.date, ACTIVITY_LABELS[w.activity], w.durationMin, w.intensity, w.distanceKm, FEEL[w.feeling || 0], w.notes].map(cell).join(','),
    ),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fitness-consistency-workouts.csv"');
  res.send(`﻿${lines.join('\r\n')}`);
});

const RECORD_FIELDS = 'activity date durationMin distanceKm';
const clean = (data) => ({ ...data, distanceKm: data.distanceKm ?? undefined, feeling: data.feeling ?? undefined });

router.post('/', async (req, res) => {
  const data = workoutSchema.parse(req.body);
  const before = buildRecords(await Workout.find({ user: req.user._id }).select(RECORD_FIELDS).lean());
  const workout = await Workout.create({ ...clean(data), user: req.user._id });
  const after = buildRecords(await Workout.find({ user: req.user._id }).select(RECORD_FIELDS).lean());
  const goalsCompleted = await newlyCompletedGoals(req.user._id, workout);
  const records = recordsBroken(before, after).map(({ id, title, display }) => ({ id, title, display }));
  res.status(201).json({ workout, goalsCompleted, recordsBroken: records });
});

router.get('/:id', async (req, res) => {
  res.json({ workout: await findOwned(req) });
});

router.put('/:id', async (req, res) => {
  const workout = await findOwned(req);
  const data = workoutSchema.parse(req.body);
  workout.set(clean(data));
  await workout.save();
  res.json({ workout, goalsCompleted: await newlyCompletedGoals(req.user._id, workout) });
});

router.delete('/:id', async (req, res) => {
  const workout = await findOwned(req);
  await workout.deleteOne();
  res.status(204).end();
});

export default router;
