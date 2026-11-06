// Runs the Express API as a Netlify Function. netlify.toml sends every /api/* request here.
// The function is reused between requests while it stays warm, so the app and the database
// connection are created once, not on every call.
import mongoose from 'mongoose';
import serverless from 'serverless-http';

let ready = null;

function json(statusCode, error) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error }),
  };
}

/**
 * Undoes the usual copy-paste accidents when pasting a connection string into a dashboard:
 * surrounding spaces or line breaks, wrapping quotes, or the whole "MONGO_URI=..." line.
 */
export function cleanMongoUri(raw) {
  let uri = String(raw ?? '').trim();
  uri = uri.replace(/^MONGO_URI\s*=\s*/i, '').trim();
  uri = uri.replace(/^(['"`])(.*)\1$/s, '$2').trim();
  return uri;
}

/** Non-secret facts about the connection string, so a bad paste can be spotted without seeing the password. */
export function describeMongoUri(uri) {
  const match = /^(mongodb(?:\+srv)?):\/\/([^:@/]*)(?::[^@/]*)?@([^/?]+)/.exec(uri);
  return {
    startsCorrectly: /^mongodb(\+srv)?:\/\//.test(uri),
    username: match?.[2] || null,
    host: match?.[3] || null,
    hasPlaceholder: /<[^>]*>/.test(uri),
    hasSpaces: /\s/.test(uri),
  };
}

/** Turns a MongoDB connection error into a code and a plain-language fix. Never includes the password. */
export function classifyDbError(err) {
  const text = `${err?.name || ''} ${err?.message || ''} ${err?.cause?.message || ''}`;
  if (/bad auth|authentication failed|auth failed|AuthenticationFailed/i.test(text)) {
    return {
      code: 'DB_AUTH_FAILED',
      message: 'MongoDB Atlas rejected the username or password in MONGO_URI. Reset the database user’s password in Atlas, put the new one in MONGO_URI, then redeploy.',
    };
  }
  if (/ENOTFOUND|querySrv|ENODATA|EBADNAME|ESERVFAIL/i.test(text)) {
    return {
      code: 'DB_HOST_NOT_FOUND',
      message: 'The cluster address in MONGO_URI could not be found. Recopy the part after "@" from Atlas (Connect → Drivers), then redeploy.',
    };
  }
  if (/MongoParseError|Invalid scheme|Invalid connection string|URI must|Password contains|Username contains|unescaped/i.test(text)) {
    return {
      code: 'DB_BAD_URI',
      message: 'MONGO_URI is not a valid connection string. It must start with mongodb+srv:// and contain no spaces, quotes or <placeholders>.',
    };
  }
  return {
    code: 'DB_UNREACHABLE',
    message: 'The server could not reach the database in time. Check that 0.0.0.0/0 is Active under Network Access in Atlas, then redeploy.',
  };
}

async function init() {
  // Function settings in the Netlify UI don't include NODE_ENV, so default to production.
  process.env.NODE_ENV ||= 'production';
  process.env.MONGO_URI = cleanMongoUri(process.env.MONGO_URI);
  if (!process.env.MONGO_URI) {
    const err = new Error('MONGO_URI is not set');
    err.code = 'MISCONFIGURED';
    throw err;
  }
  const [{ createApp }, { config }] = await Promise.all([
    import('../../server/src/app.js'),
    import('../../server/src/config.js'),
  ]);
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        dbName: 'fitness_consistency',
        serverSelectionTimeoutMS: 8000,
      });
    } catch (err) {
      await mongoose.disconnect().catch(() => {});
      err.isDbError = true;
      throw err;
    }
  }
  void config; // loaded for its checks (for example JWT_SECRET in production)
  return serverless(createApp(), {
    // Netlify may hand over the function's own path; the app expects the /api path it was called with.
    request(req) {
      req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '/api');
      // serverless-http has already read the body into a Buffer, so Express's JSON parser
      // would find nothing left to read. Parse it here and mark it done (`_body`), the flag
      // Express's parser checks before reading.
      if (Buffer.isBuffer(req.body)) {
        const isJson = /application\/json/i.test(req.headers['content-type'] || '');
        let parsed;
        if (isJson && req.body.length) {
          try {
            parsed = JSON.parse(req.body.toString('utf8'));
          } catch {
            parsed = undefined; // invalid JSON: validation then reports the missing fields
          }
        }
        req.body = parsed;
        req._body = true;
      }
    },
  });
}

export async function handler(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    ready ??= init();
    const app = await ready;
    return await app(event, context);
  } catch (err) {
    ready = null; // try again from scratch on the next request
    if (err.code === 'MISCONFIGURED') {
      return json(500, {
        code: 'MISCONFIGURED',
        message: 'The server is missing its database settings. Set MONGO_URI and JWT_SECRET in Netlify, then redeploy.',
      });
    }
    if (/JWT_SECRET/.test(err.message)) {
      return json(500, {
        code: 'MISCONFIGURED',
        message: 'The server is missing JWT_SECRET. Set it in Netlify, then redeploy.',
      });
    }
    console.error('Database connection failed:', err?.name, err?.message);
    const { code, message } = classifyDbError(err);
    return json(503, { code, message, connectionString: describeMongoUri(process.env.MONGO_URI || '') });
  }
}
