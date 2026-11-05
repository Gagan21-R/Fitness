import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { Message } from '../models/Message.js';
import { contactSchema } from '../validation.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many messages. Please try again in a few minutes.' } },
});

router.post('/', limiter, async (req, res) => {
  const { website, ...data } = contactSchema.parse(req.body);
  // `website` is a hidden field only bots fill in: they get the same reply, but nothing is saved.
  if (!website) await Message.create(data);
  res.status(201).json({ ok: true });
});

export default router;
