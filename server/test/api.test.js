import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import '../src/utils/mongoPaths.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { addDays, localToday, weekStart } from '../src/utils/dates.js';

let mongod;
let app;
const today = localToday();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

let counter = 0;
async function signUp() {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: `user${counter}@example.com`, password: 'password123' })
    .expect(201);
  return res.body.token;
}
const authed = (token) => ({
  post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  put: (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});
const run = { activity: 'running', date: today, durationMin: 30, intensity: 3 };

describe('auth', () => {
  it('registers, logs in and returns the profile without a hash', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'ASHA@example.com', password: 'password123' })
      .expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'asha@example.com', password: 'password123' })
      .expect(200);
    const me = await authed(login.body.token).get('/api/auth/me').expect(200);
    assert.equal(me.body.user.email, 'asha@example.com');
    assert.equal(me.body.user.passwordHash, undefined);
  });

  it('rejects duplicate emails, bad passwords and missing tokens', async () => {
    const body = { name: 'Asha', email: 'a@example.com', password: 'password123' };
    await request(app).post('/api/auth/register').send(body).expect(201);
    const dup = await request(app).post('/api/auth/register').send(body).expect(409);
    assert.equal(dup.body.error.code, 'EMAIL_TAKEN');
    await request(app).post('/api/auth/login').send({ email: body.email, password: 'wrong-pass' }).expect(401);
    await request(app).get('/api/workouts').expect(401);
    await request(app).get('/api/workouts').set('Authorization', 'Bearer nonsense').expect(401);
  });

  it('reports field errors for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'nope', password: 'short' })
      .expect(400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['email', 'name', 'password']);
  });

  it('blocks NoSQL operator injection on login', async () => {
    await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } }).expect(400);
  });

  it('opens the demo account with data in it', async () => {
    const res = await request(app).post('/api/auth/demo').expect(200);
    assert.equal(res.body.user.isDemo, true);
    const list = await authed(res.body.token).get('/api/workouts').expect(200);
    assert.ok(list.body.total > 50);
  });
});

describe('workouts', () => {
  it('supports create, read, update and delete', async () => {
    const api = authed(await signUp());
    const created = await api.post('/api/workouts').send(run).expect(201);
    const { id } = created.body.workout;
    await api.get(`/api/workouts/${id}`).expect(200);
    const updated = await api.put(`/api/workouts/${id}`).send({ ...run, durationMin: 45 }).expect(200);
    assert.equal(updated.body.workout.durationMin, 45);
    await api.delete(`/api/workouts/${id}`).expect(204);
    await api.get(`/api/workouts/${id}`).expect(404);
  });

  it('validates input', async () => {
    const api = authed(await signUp());
    const bad = async (patch, field) => {
      const res = await api.post('/api/workouts').send({ ...run, ...patch }).expect(400);
      assert.ok(res.body.error.fields[field], `expected an error on ${field}`);
    };
    await bad({ activity: 'teleporting' }, 'activity');
    await bad({ durationMin: 0 }, 'durationMin');
    await bad({ durationMin: 601 }, 'durationMin');
    await bad({ date: '2026-02-30' }, 'date');
    await bad({ date: '2999-01-01' }, 'date');
    await bad({ intensity: 9 }, 'intensity');
    await bad({ activity: 'yoga', distanceKm: 5 }, 'distanceKm');
    await api.get('/api/workouts/not-an-id').expect(400);
  });

  it("keeps each user's workouts private", async () => {
    const alice = authed(await signUp());
    const bob = authed(await signUp());
    const { body } = await alice.post('/api/workouts').send(run).expect(201);
    await bob.get(`/api/workouts/${body.workout.id}`).expect(404);
    await bob.delete(`/api/workouts/${body.workout.id}`).expect(404);
    assert.equal((await bob.get('/api/workouts').expect(200)).body.total, 0);
  });

  it('filters, searches and paginates', async () => {
    const api = authed(await signUp());
    for (let i = 0; i < 5; i += 1) await api.post('/api/workouts').send(run).expect(201);
    await api.post('/api/workouts').send({ ...run, activity: 'yoga', notes: 'Hip (mobility) flow' }).expect(201);
    assert.equal((await api.get('/api/workouts?activity=yoga')).body.total, 1);
    assert.equal((await api.get('/api/workouts?q=(mobility)')).body.total, 1);
    const page = await api.get('/api/workouts?limit=4&page=2');
    assert.equal(page.body.items.length, 2);
    assert.equal(page.body.pages, 2);
  });

  it('exports CSV with escaping and formula protection', async () => {
    const api = authed(await signUp());
    await api.post('/api/workouts').send({ ...run, notes: '=HYPERLINK("x"), risky' }).expect(201);
    const res = await api.get('/api/workouts/export.csv').expect(200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.ok(res.text.includes(`"'=HYPERLINK(""x""), risky"`));
  });
});

describe('goals and statistics', () => {
  it('announces a goal when a workout completes it, and only once', async () => {
    const api = authed(await signUp());
    await api.post(`/api/goals?today=${today}`).send({ name: 'Run twice', activity: 'running', metric: 'sessions', target: 2 }).expect(201);
    const first = await api.post('/api/workouts').send(run).expect(201);
    assert.deepEqual(first.body.goalsCompleted, []);
    const second = await api.post('/api/workouts').send(run).expect(201);
    assert.deepEqual(second.body.goalsCompleted, ['Run twice']);
    const third = await api.post('/api/workouts').send(run).expect(201);
    assert.deepEqual(third.body.goalsCompleted, []);
  });

  it('computes the weekly summary and score against personal targets', async () => {
    const api = authed(await signUp());
    await api.post(`/api/goals?today=${today}`).send({ name: 'Two runs', activity: 'running', metric: 'sessions', target: 2 }).expect(201);
    await api.post(`/api/goals?today=${today}`).send({ name: 'Yoga', activity: 'yoga', metric: 'sessions', target: 1 }).expect(201);
    await api.post('/api/workouts').send(run).expect(201);
    const res = await api.get(`/api/stats/week?today=${today}`).expect(200);
    assert.equal(res.body.week, weekStart(today));
    assert.equal(res.body.totals.minutes, 30);
    assert.equal(res.body.score, 25); // (50 + 0) / 2
    assert.equal(res.body.daily.length, 7);
    assert.ok(res.body.narrative.length > 0);
  });

  it('validates goal limits and archives goals', async () => {
    const api = authed(await signUp());
    await api.post('/api/goals').send({ name: 'Too many', metric: 'activeDays', target: 8 }).expect(400);
    const { body } = await api.post(`/api/goals?today=${today}`).send({ name: 'Days', metric: 'activeDays', target: 3 }).expect(201);
    await api.patch(`/api/goals/${body.goal.id}`).send({ target: 99 }).expect(400);
    const edited = await api.patch(`/api/goals/${body.goal.id}?today=${today}`).send({ target: 5 }).expect(200);
    assert.equal(edited.body.goal.target, 5);
    assert.equal(edited.body.goal.targets.length, 1); // same week: replaced, not stacked
    await api.patch(`/api/goals/${body.goal.id}?today=${today}`).send({ archived: true }).expect(200);
    const list = await api.get(`/api/goals?today=${today}`).expect(200);
    assert.equal(list.body.items[0].archived, true);
    await api.delete(`/api/goals/${body.goal.id}`).expect(204);
  });

  it('returns a complete dashboard for an empty account', async () => {
    const api = authed(await signUp());
    const res = await api.get(`/api/stats/dashboard?today=${today}`).expect(200);
    assert.equal(res.body.totalWorkouts, 0);
    assert.equal(res.body.week.score, null);
    assert.equal(res.body.trends.length, 12);
    assert.ok(res.body.heatmap.cells.length > 150);
  });
});

describe('new features', () => {
  it('stores how a workout felt and rejects invalid ratings', async () => {
    const api = authed(await signUp());
    const { body } = await api.post('/api/workouts').send({ ...run, feeling: 4 }).expect(201);
    assert.equal(body.workout.feeling, 4);
    await api.post('/api/workouts').send({ ...run, feeling: 9 }).expect(400);
  });

  it('announces a beaten personal record', async () => {
    const api = authed(await signUp());
    const first = await api.post('/api/workouts').send({ ...run, durationMin: 30, distanceKm: 5 }).expect(201);
    assert.deepEqual(first.body.recordsBroken, []);
    const second = await api.post('/api/workouts').send({ ...run, durationMin: 45, distanceKm: 8 }).expect(201);
    const titles = second.body.recordsBroken.map((r) => r.title);
    assert.ok(titles.includes('Longest session'));
    assert.ok(titles.includes('Longest running distance'));
    const records = await api.get('/api/stats/records').expect(200);
    assert.ok(records.body.records.length >= 3);
  });

  it('plans sessions, ticks them off from the log, copies and deletes them', async () => {
    const api = authed(await signUp());
    const week = weekStart(today);
    const { body } = await api.post('/api/plans').send({ date: today, activity: 'running', durationMin: 30 }).expect(201);
    await api.post('/api/plans').send({ date: today, activity: 'yoga' }).expect(201);
    await api.post('/api/plans').send({ date: '2999-01-01', activity: 'yoga' }).expect(400);
    await api.post('/api/workouts').send(run).expect(201);

    const plan = await api.get(`/api/plans?week=${week}&today=${today}`).expect(200);
    assert.deepEqual(plan.body.summary, { planned: 2, done: 1, missed: 0 });

    const copied = await api.post('/api/plans/copy').send({ fromWeek: week, toWeek: addDays(week, 7) }).expect(201);
    assert.equal(copied.body.copied, 2);
    // Copying again adds nothing: those sessions are already planned.
    await api.post('/api/plans/copy').send({ fromWeek: week, toWeek: addDays(week, 7) }).expect(400);
    const next = await api.get(`/api/plans?week=${addDays(week, 7)}&today=${today}`).expect(200);
    assert.equal(next.body.items.length, 2);
    await api.post('/api/plans/copy').send({ fromWeek: week, toWeek: addDays(week, -7) }).expect(400);

    const dash = await api.get(`/api/stats/dashboard?today=${today}`).expect(200);
    assert.equal(dash.body.todayPlan.length, 2);
    assert.equal(dash.body.ghost.days.length, 7);

    await api.delete(`/api/plans/${body.plan.id}`).expect(204);
    await api.delete(`/api/plans/${body.plan.id}`).expect(404);
  });

  it("keeps each user's plans private", async () => {
    const alice = authed(await signUp());
    const bob = authed(await signUp());
    const { body } = await alice.post('/api/plans').send({ date: today, activity: 'running' }).expect(201);
    await bob.delete(`/api/plans/${body.plan.id}`).expect(404);
    assert.equal((await bob.get('/api/plans').expect(200)).body.items.length, 0);
  });
});

describe('contact form', () => {
  const message = { name: 'Asha', email: 'asha@example.com', topic: 'feedback', message: 'Love the weekly summary page.' };

  it('stores a valid message', async () => {
    await request(app).post('/api/contact').send(message).expect(201);
    const saved = await mongoose.model('Message').find().lean();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].topic, 'feedback');
  });

  it('rejects invalid fields', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'A', email: 'nope', topic: 'spam', message: 'short' })
      .expect(400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['email', 'message', 'name', 'topic']);
  });

  it('accepts but discards messages that fill the hidden bot field', async () => {
    await request(app).post('/api/contact').send({ ...message, website: 'http://spam.example' }).expect(201);
    assert.equal(await mongoose.model('Message').countDocuments(), 0);
  });
});

describe('api errors', () => {
  it('answers unknown routes and malformed JSON in the standard shape', async () => {
    const missing = await request(app).get('/api/nope').expect(404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');
    const bad = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json')
      .expect(400);
    assert.equal(bad.body.error.code, 'BAD_JSON');
  });
});
