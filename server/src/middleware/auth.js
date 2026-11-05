import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { ApiError } from './errors.js';

export function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'This account no longer exists.');
  req.user = user;
  next();
}
