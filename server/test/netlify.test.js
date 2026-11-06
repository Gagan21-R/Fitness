import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import '../src/utils/mongoPaths.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { handler } from '../../netlify/functions/api.mjs';

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
