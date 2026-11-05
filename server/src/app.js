import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import goalRoutes from './routes/goals.js';
import planRoutes from './routes/plans.js';
import statsRoutes from './routes/stats.js';
import workoutRoutes from './routes/workouts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (config.env === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api', notFound);

  // In production, Express also serves the built React app.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
