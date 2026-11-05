// `npm run seed` rebuilds the demo account. Stop the dev server first when using the
// embedded database, since only one process can open its data folder at a time.
import { connectDb, disconnectDb } from '../db.js';
import { ensureDemoUser, resetDemoData } from './demo.js';

await connectDb();
const user = await ensureDemoUser();
await resetDemoData(user);
console.log(`Demo data ready for ${user.email}`);
await disconnectDb();
