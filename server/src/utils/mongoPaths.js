import os from 'node:os';
import path from 'node:path';

// mongod can't start from a deep project folder on Windows (260-character path limit), so the
// embedded database's binary and data live under the home folder. Import before mongodb-memory-server.
const base = path.join(os.homedir(), '.fitness-consistency');

process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(base, 'bin');

export const dataDir = process.env.MONGO_DATA_DIR || path.join(base, 'data');
