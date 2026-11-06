import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import '../src/utils/mongoPaths.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { classifyDbError, cleanMongoUri, describeMongoUri, handler } from '../../netlify/functions/api.mjs';

// Calls the Netlify Function the way Netlify does: with a Lambda-style event.
const call = (method, path, body) =>
  handler(
    {
      httpMethod: method,
      path,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      queryStringParameters: null,
      body: body ? JSON.stringify(body) : null,
      isBase64Encoded: false,
    },
    {},
  ).then((res) => ({ ...res, json: res.body ? JSON.parse(res.body) : null }));

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('netlify connection string handling', () => {
  const good = 'mongodb+srv://fitnessapp:s3cret@gagan.example.mongodb.net/';

  it('cleans common copy-paste mistakes', () => {
    assert.equal(cleanMongoUri(`  ${good}\n`), good);
    assert.equal(cleanMongoUri(`"${good}"`), good);
    assert.equal(cleanMongoUri(`MONGO_URI=${good}`), good);
  });

  it('describes a string without revealing the password', () => {
    const info = describeMongoUri(good);
    assert.deepEqual(info, {
      startsCorrectly: true,
      username: 'fitnessapp',
      host: 'gagan.example.mongodb.net',
      hasPlaceholder: false,
      hasSpaces: false,
    });
    assert.ok(!JSON.stringify(info).includes('s3cret'));
    assert.equal(describeMongoUri('mongodb+srv://<db_username>:<db_password>@x.net/').hasPlaceholder, true);
  });

  it('names the likely cause of a connection failure', () => {
    assert.equal(classifyDbError(new Error('bad auth : authentication failed')).code, 'DB_AUTH_FAILED');
    assert.equal(classifyDbError(new Error('querySrv ENOTFOUND _mongodb._tcp.x.net')).code, 'DB_HOST_NOT_FOUND');
    assert.equal(classifyDbError(Object.assign(new Error('Invalid scheme'), { name: 'MongoParseError' })).code, 'DB_BAD_URI');
    assert.equal(classifyDbError(new Error('Server selection timed out after 8000 ms')).code, 'DB_UNREACHABLE');
  });

  it('reports a broken connection string through the API', async () => {
    process.env.MONGO_URI = 'not-a-connection-string';
    const res = await call('GET', '/api/health');
    assert.equal(res.statusCode, 503);
    assert.equal(res.json.error.code, 'DB_BAD_URI');
    assert.equal(res.json.error.connectionString.startsCorrectly, false);
    delete process.env.MONGO_URI;
  });
});

describe('netlify function', () => {
  it('explains a missing MONGO_URI instead of crashing', async () => {
    delete process.env.MONGO_URI;
    const res = await call('GET', '/api/health');
    assert.equal(res.statusCode, 500);
    assert.equal(res.json.error.code, 'MISCONFIGURED');
  });

  it('serves the API under both the original and the function path', async () => {
    process.env.MONGO_URI = mongod.getUri();
    const viaFunction = await call('GET', '/.netlify/functions/api/health');
    assert.equal(viaFunction.statusCode, 200);
    assert.equal(viaFunction.json.db, 'connected');
    const viaApi = await call('GET', '/api/health');
    assert.equal(viaApi.statusCode, 200);
  });

  it('signs up and signs in', async () => {
    const account = { name: 'Netlify User', email: 'netlify@example.test', password: 'testing-only-123' };
    const signUp = await call('POST', '/.netlify/functions/api/auth/register', account);
    assert.equal(signUp.statusCode, 201);
    assert.ok(signUp.json.token);
    const signIn = await call('POST', '/api/auth/login', { email: account.email, password: account.password });
    assert.equal(signIn.statusCode, 200);
    assert.equal(signIn.json.user.email, account.email);

    // Query strings and the sign-in token must reach the API too (the dashboard needs both).
    const dashboard = await handler(
      {
        httpMethod: 'GET',
        path: '/api/stats/dashboard',
        headers: { authorization: `Bearer ${signIn.json.token}` },
        queryStringParameters: { today: '2026-11-06' },
        body: null,
        isBase64Encoded: false,
      },
      {},
    );
    assert.equal(dashboard.statusCode, 200);
    assert.equal(JSON.parse(dashboard.body).today, '2026-11-06');
  });
});
