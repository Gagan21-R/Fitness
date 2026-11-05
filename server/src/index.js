import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';

await connectDb();

const server = createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
