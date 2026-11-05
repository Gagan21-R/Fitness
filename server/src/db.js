import fs from 'node:fs';
import mongoose from 'mongoose';
import { config } from './config.js';
import { dataDir } from './utils/mongoPaths.js';

let embedded = null;

async function startEmbedded() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(dataDir, { recursive: true });
  // wiredTiger plus a fixed dbPath makes this a real on-disk database: data survives restarts.
  embedded = await MongoMemoryServer.create({
    instance: { dbPath: dataDir, storageEngine: 'wiredTiger', dbName: 'fitness_consistency' },
  });
  return embedded.getUri();
}

export async function connectDb() {
  const uri = config.mongoUri || (await startEmbedded());
  await mongoose.connect(uri, { dbName: 'fitness_consistency' });
  console.log(`MongoDB connected (${config.mongoUri ? 'MONGO_URI' : `embedded, data in ${dataDir}`})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (embedded) await embedded.stop({ doCleanup: false });
  embedded = null;
}
