import 'dotenv/config';

const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

export const config = {
  env,
  port: Number(process.env.PORT) || 5000,
  // Empty means: run an embedded MongoDB, so the project works without installing anything.
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  enableDemo: process.env.ENABLE_DEMO !== 'false',
};
