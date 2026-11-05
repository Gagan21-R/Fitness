import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { ensureDemoUser } from '../seed/demo.js';
import { loginSchema, registerSchema } from '../validation.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a few minutes.' } },
});

router.post('/register', limiter, async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  if (await User.exists({ email })) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'That email is already registered.', {
      email: 'That email is already registered',
    });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email, isDemo: false }).select('+passwordHash');
  // Same response for unknown email and wrong password, so emails can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'BAD_CREDENTIALS', 'Incorrect email or password.');
  }
  res.json({ token: signToken(user._id), user: user.toPublic() });
});

router.post('/demo', limiter, async (_req, res) => {
  if (!config.enableDemo) throw new ApiError(404, 'NOT_FOUND', 'The demo account is turned off.');
  const user = await ensureDemoUser();
  res.json({ token: signToken(user._id), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
