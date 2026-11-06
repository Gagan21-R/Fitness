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

async function init() {
  // Function settings in the Netlify UI don't include NODE_ENV, so default to production.
  process.env.NODE_ENV ||= 'production';
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
    await mongoose.connect(config.mongoUri, { dbName: 'fitness_consistency', serverSelectionTimeoutMS: 8000 });
  }
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
    console.error(err);
    return json(503, {
      code: 'DB_UNAVAILABLE',
      message: 'The server could not reach its database. Check MONGO_URI and the Atlas network access list.',
    });
  }
}
