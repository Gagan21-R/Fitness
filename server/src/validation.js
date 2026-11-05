import { z } from 'zod';
import { ACTIVITIES, CONTACT_TOPICS, DISTANCE_ACTIVITIES, METRICS, TARGET_LIMITS } from './constants.js';
import { addDays, isValidDate, localToday } from './utils/dates.js';

export const dateString = z
  .string({ required_error: 'Date is required' })
  .refine(isValidDate, 'Use a valid date in YYYY-MM-DD format');

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer'),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(72),
});

const workoutFields = z.object({
  activity: z.enum(ACTIVITIES, { errorMap: () => ({ message: 'Choose an activity' }) }),
  // One day of tolerance: the server may be behind a user further east.
  date: dateString.refine((d) => d <= addDays(localToday(), 1), 'Date cannot be in the future'),
  durationMin: z.coerce
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be whole minutes')
    .min(1, 'Duration must be at least 1 minute')
    .max(600, 'Duration cannot exceed 600 minutes'),
  intensity: z.coerce.number().int().min(1, 'Intensity is 1 to 5').max(5, 'Intensity is 1 to 5').default(3),
  distanceKm: z.coerce
    .number({ invalid_type_error: 'Distance must be a number' })
    .min(0, 'Distance cannot be negative')
    .max(1000, 'Distance cannot exceed 1000 km')
    .nullish(),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').default(''),
  // How the user felt afterwards, 1 (drained) to 5 (buzzing). Optional.
  feeling: z.coerce.number().int().min(1, 'Feeling is 1 to 5').max(5, 'Feeling is 1 to 5').nullish(),
});

export const workoutSchema = workoutFields.superRefine((w, ctx) => {
  if (w.distanceKm && !DISTANCE_ACTIVITIES.includes(w.activity)) {
    ctx.addIssue({ code: 'custom', path: ['distanceKm'], message: 'Distance does not apply to this activity' });
  }
});

export const workoutQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  activity: z.enum(ACTIVITIES).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'longest']).default('newest'),
});

export const goalCreateSchema = z
  .object({
    name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(60),
    activity: z.enum(['all', ...ACTIVITIES]).default('all'),
    metric: z.enum(METRICS, { errorMap: () => ({ message: 'Choose what to measure' }) }),
    target: z.coerce
      .number({ invalid_type_error: 'Target must be a number' })
      .int('Target must be a whole number')
      .min(1, 'Target must be at least 1'),
  })
  .superRefine((g, ctx) => {
    const max = TARGET_LIMITS[g.metric];
    if (g.target > max) {
      ctx.addIssue({ code: 'custom', path: ['target'], message: `Target cannot exceed ${max} for this measure` });
    }
  });

export const goalUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60).optional(),
    target: z.coerce.number().int('Target must be a whole number').min(1, 'Target must be at least 1').optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const todaySchema = z.object({ today: dateString.optional() });
export const weekQuerySchema = z.object({ today: dateString.optional(), week: dateString.optional() });

export const contactSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email'),
  topic: z.enum(CONTACT_TOPICS, { errorMap: () => ({ message: 'Choose a topic' }) }),
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message cannot exceed 2000 characters'),
  website: z.string().max(200).optional().default(''),
});

export const planSchema = z.object({
  date: dateString.refine(
    (d) => d >= addDays(localToday(), -31) && d <= addDays(localToday(), 60),
    'Plan dates must be within the last month or the next 60 days',
  ),
  activity: z.enum(ACTIVITIES, { errorMap: () => ({ message: 'Choose an activity' }) }),
  durationMin: z.coerce
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be whole minutes')
    .min(5, 'Planned duration must be at least 5 minutes')
    .max(600, 'Duration cannot exceed 600 minutes')
    .nullish(),
  note: z.string().trim().max(120, 'Note cannot exceed 120 characters').default(''),
});

export const planCopySchema = z.object({ fromWeek: dateString, toWeek: dateString });
