import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { Plan } from '../models/Plan.js';
import { Workout } from '../models/Workout.js';
import { matchPlans } from '../services/stats.js';
import { addDays, diffDays, localToday, weekStart } from '../utils/dates.js';
import { objectId, planCopySchema, planSchema, weekQuerySchema } from '../validation.js';

const router = Router();
router.use(requireAuth);

const MAX_PER_WEEK = 28;
const weekRange = (week) => ({ $gte: week, $lte: addDays(week, 6) });
const toItem = ({ _id, user, __v, ...p }) => ({ id: String(_id), ...p });

router.get('/', async (req, res) => {
  const q = weekQuerySchema.parse(req.query);
  const today = q.today || localToday();
  const week = weekStart(q.week || today);
  const [plans, workouts] = await Promise.all([
    Plan.find({ user: req.user._id, date: weekRange(week) }).lean(),
    Workout.find({ user: req.user._id, date: weekRange(week) }).select('activity date').lean(),
  ]);
  const items = matchPlans(plans, workouts, today).map(toItem);
  res.json({
    week,
    items,
    summary: {
      planned: items.length,
      done: items.filter((p) => p.status === 'done').length,
      missed: items.filter((p) => p.status === 'missed').length,
    },
  });
});

router.post('/', async (req, res) => {
  const data = planSchema.parse(req.body);
  const count = await Plan.countDocuments({ user: req.user._id, date: weekRange(weekStart(data.date)) });
  if (count >= MAX_PER_WEEK) {
    throw new ApiError(400, 'PLAN_FULL', `A week can hold at most ${MAX_PER_WEEK} planned sessions.`);
  }
  const plan = await Plan.create({ ...data, durationMin: data.durationMin ?? undefined, user: req.user._id });
  res.status(201).json({ plan });
});

// Repeats one week's plan in another week, keeping each session on the same weekday.
router.post('/copy', async (req, res) => {
  const { fromWeek, toWeek } = planCopySchema.parse(req.body);
  const from = weekStart(fromWeek);
  const to = weekStart(toWeek);
  if (from === to) throw new ApiError(400, 'SAME_WEEK', 'Choose a different week to copy into.');
  if (to < weekStart(localToday())) {
    throw new ApiError(400, 'PAST_WEEK', 'You can only copy a plan into this week or a later one.');
  }
  const source = await Plan.find({ user: req.user._id, date: weekRange(from) }).lean();
  if (!source.length) throw new ApiError(400, 'EMPTY_PLAN', 'That week has nothing planned to copy.');
  const existing = await Plan.find({ user: req.user._id, date: weekRange(to) }).select('date activity').lean();

  // Skip sessions the target week already has, so copying twice doesn't double the plan.
  const shift = diffDays(to, from);
  const taken = new Set(existing.map((p) => `${p.date}|${p.activity}`));
  const fresh = source
    .map((p) => ({ ...p, date: addDays(p.date, shift) }))
    .filter((p) => !taken.has(`${p.date}|${p.activity}`));
  if (!fresh.length) throw new ApiError(400, 'ALREADY_PLANNED', 'Those sessions are already in this week’s plan.');
  if (existing.length + fresh.length > MAX_PER_WEEK) {
    throw new ApiError(400, 'PLAN_FULL', `A week can hold at most ${MAX_PER_WEEK} planned sessions.`);
  }
  await Plan.insertMany(
    fresh.map((p) => ({
      user: req.user._id,
      date: p.date,
      activity: p.activity,
      durationMin: p.durationMin,
      note: p.note,
    })),
  );
  res.status(201).json({ copied: fresh.length });
});

router.delete('/:id', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const plan = await Plan.findOneAndDelete({ _id: id, user: req.user._id });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Planned session not found.');
  res.status(204).end();
});

export default router;
