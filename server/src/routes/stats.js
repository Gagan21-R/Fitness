import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Goal } from '../models/Goal.js';
import { Plan } from '../models/Plan.js';
import { Workout } from '../models/Workout.js';
import {
  buildAchievements,
  buildBalance,
  buildFeelings,
  buildGhost,
  buildHeatmap,
  buildInsights,
  buildRecords,
  buildStreaks,
  buildTrends,
  buildWeekSummary,
  matchPlans,
} from '../services/stats.js';
import { localToday, weekStart } from '../utils/dates.js';
import { todaySchema, weekQuerySchema } from '../validation.js';

const router = Router();
router.use(requireAuth);

const FIELDS = 'activity date durationMin intensity distanceKm notes feeling';

async function load(userId) {
  const [workouts, goals] = await Promise.all([
    Workout.find({ user: userId }).select(FIELDS).lean(),
    Goal.find({ user: userId }).lean(),
  ]);
  return { workouts, goals };
}

router.get('/dashboard', async (req, res) => {
  const today = todaySchema.parse(req.query).today || localToday();
  const [{ workouts, goals }, todayPlans] = await Promise.all([
    load(req.user._id),
    Plan.find({ user: req.user._id, date: today }).lean(),
  ]);
  const week = buildWeekSummary(workouts, goals, weekStart(today), today);
  const achievements = buildAchievements(workouts, goals, today);
  res.json({
    today,
    totalWorkouts: workouts.length,
    hasGoals: goals.length > 0,
    week: { ...week, workouts: undefined },
    trends: buildTrends(workouts, goals, today, 12),
    streaks: buildStreaks(workouts, goals, today),
    heatmap: buildHeatmap(workouts, today),
    balance: buildBalance(workouts, today),
    insights: buildInsights(workouts, goals, today),
    achievements: { earned: achievements.filter((a) => a.earned).length, total: achievements.length },
    ghost: buildGhost(workouts, today),
    todayPlan: matchPlans(todayPlans, workouts, today).map(({ _id, user, __v, ...p }) => ({ id: String(_id), ...p })),
  });
});

router.get('/week', async (req, res) => {
  const q = weekQuerySchema.parse(req.query);
  const today = q.today || localToday();
  const { workouts, goals } = await load(req.user._id);
  const week = weekStart(q.week || today);
  const summary = buildWeekSummary(workouts, goals, week, today);
  res.json({
    ...summary,
    workouts: summary.workouts.map(({ _id, ...w }) => ({ id: String(_id), ...w })),
    isCurrent: week === weekStart(today),
  });
});

router.get('/records', async (req, res) => {
  const { workouts } = await load(req.user._id);
  res.json({ records: buildRecords(workouts), feelings: buildFeelings(workouts) });
});

router.get('/achievements', async (req, res) => {
  const today = todaySchema.parse(req.query).today || localToday();
  const { workouts, goals } = await load(req.user._id);
  res.json({ items: buildAchievements(workouts, goals, today) });
});

export default router;
