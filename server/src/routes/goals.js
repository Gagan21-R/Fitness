import { Router } from 'express';
import { TARGET_LIMITS } from '../constants.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { Goal } from '../models/Goal.js';
import { Workout } from '../models/Workout.js';
import { evaluateGoals, groupByWeek } from '../services/stats.js';
import { addDays, localToday, weekStart } from '../utils/dates.js';
import { goalCreateSchema, goalUpdateSchema, objectId, todaySchema } from '../validation.js';

const router = Router();
router.use(requireAuth);

async function findOwned(req) {
  const id = objectId.parse(req.params.id);
  const goal = await Goal.findOne({ _id: id, user: req.user._id });
  if (!goal) throw new ApiError(404, 'NOT_FOUND', 'Goal not found.');
  return goal;
}

router.get('/', async (req, res) => {
  const today = todaySchema.parse(req.query).today || localToday();
  const thisWeek = weekStart(today);
  const [goals, workouts] = await Promise.all([
    Goal.find({ user: req.user._id }).sort({ createdAt: 1 }),
    Workout.find({ user: req.user._id, date: { $gte: addDays(thisWeek, -7 * 7) } }).lean(),
  ]);
  const byWeek = groupByWeek(workouts);

  const items = goals.map((goal) => {
    // Last 8 weeks of this goal, oldest first, including only weeks it was active.
    const history = [];
    for (let i = 7; i >= 0; i -= 1) {
      const week = addDays(thisWeek, -7 * i);
      const [result] = evaluateGoals([goal], byWeek.get(week) || [], week, today);
      if (result) history.push({ week, actual: result.actual, target: result.target, status: result.status });
    }
    const current = history.at(-1);
    const finished = history.filter((h) => h.week !== thisWeek);
    return {
      ...goal.toJSON(),
      archived: Boolean(goal.archivedFromWeek),
      current: current?.week === thisWeek ? current : null,
      history,
      hitRate: finished.length
        ? Math.round((finished.filter((h) => h.status === 'met').length / finished.length) * 100)
        : null,
    };
  });
  res.json({ items });
});

router.post('/', async (req, res) => {
  const { target, ...data } = goalCreateSchema.parse(req.body);
  const today = todaySchema.parse(req.query).today || localToday();
  const week = weekStart(today);
  const goal = await Goal.create({
    ...data,
    user: req.user._id,
    startWeek: week,
    targets: [{ week, value: target }],
  });
  res.status(201).json({ goal });
});

router.patch('/:id', async (req, res) => {
  const goal = await findOwned(req);
  const update = goalUpdateSchema.parse(req.body);
  const today = todaySchema.parse(req.query).today || localToday();
  const week = weekStart(today);

  if (update.name) goal.name = update.name;

  if (update.target !== undefined) {
    const max = TARGET_LIMITS[goal.metric];
    if (update.target > max) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', {
        target: `Target cannot exceed ${max} for this measure`,
      });
    }
    // Takes effect this week; earlier weeks keep the target they were judged against.
    const latest = goal.targets[goal.targets.length - 1];
    if (latest.week === week) latest.value = update.target;
    else if (latest.value !== update.target) goal.targets.push({ week, value: update.target });
  }

  if (update.archived !== undefined) {
    goal.archivedFromWeek = update.archived ? week : null;
  }

  await goal.save();
  res.json({ goal });
});

router.delete('/:id', async (req, res) => {
  const goal = await findOwned(req);
  await goal.deleteOne();
  res.status(204).end();
});

export default router;
