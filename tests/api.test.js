const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

beforeEach(() => store.reset());

const signup = async (email = 'asha@example.com', name = 'Asha Rao') => {
  const r = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' });
  return r.body.token;
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('health, info and public data', () => {
  test('GET /health returns UP', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('UP');
  });
  test('GET /ready returns READY', async () => {
    const r = await request(app).get('/ready');
    expect(r.body.status).toBe('READY');
  });
  test('GET /api/info returns app info', async () => {
    const r = await request(app).get('/api/info');
    expect(r.body.app).toBe('travel-booking');
  });
  test('GET /api/destinations lists 4 seeded destinations', async () => {
    const r = await request(app).get('/api/destinations');
    expect(r.body).toHaveLength(4);
  });
  test('GET /api/packages can filter by destination', async () => {
    const r = await request(app).get('/api/packages?destinationId=1');
    expect(r.body).toHaveLength(2);
    expect(r.body.every((p) => p.destinationId === 1)).toBe(true);
  });
  test('GET /api/stats returns counts', async () => {
    const r = await request(app).get('/api/stats');
    expect(r.body).toEqual({ destinations: 4, packages: 5, bookings: 0 });
  });
  test('unknown route returns 404', async () => {
    const r = await request(app).get('/api/nope');
    expect(r.status).toBe(404);
  });
});

describe('auth', () => {
  test('register returns token and user without password', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'Asha@Example.com', password: 'password123' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.email).toBe('asha@example.com');
    expect(r.body.user.passwordHash).toBeUndefined();
  });
  test('register rejects weak password and bad email', async () => {
    const a = await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@b.co', password: 'short' });
    const b = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'password123' });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
  });
  test('register rejects duplicate email', async () => {
    await signup('dup@example.com');
    const r = await request(app).post('/api/auth/register').send({ name: 'B', email: 'dup@example.com', password: 'password123' });
    expect(r.status).toBe(409);
  });
  test('login works with correct password', async () => {
    await signup('login@example.com');
    const r = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });
  test('login fails with wrong password or unknown email', async () => {
    await signup('login@example.com');
    const a = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong-password' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'password123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
  });
  test('GET /api/me needs a valid token', async () => {
    const none = await request(app).get('/api/me');
    const bad = await request(app).get('/api/me').set(auth('garbage'));
    const token = await signup();
    const ok = await request(app).get('/api/me').set(auth(token));
    expect(none.status).toBe(401);
    expect(bad.status).toBe(401);
    expect(ok.body.name).toBe('Asha Rao');
  });
});

describe('bookings', () => {
  test('booking requires login', async () => {
    const r = await request(app).post('/api/bookings').send({ packageId: 1, travelers: 2 });
    expect(r.status).toBe(401);
    const list = await request(app).get('/api/bookings');
    expect(list.status).toBe(401);
  });
  test('logged-in user can book and total price is correct', async () => {
    const token = await signup();
    const r = await request(app).post('/api/bookings').set(auth(token)).send({ packageId: 1, travelers: 2 });
    expect(r.status).toBe(201);
    expect(r.body.totalPrice).toBe(30000);
    expect(r.body.status).toBe('CONFIRMED');
    expect(r.body.email).toBe('asha@example.com');
  });
  test('booking validates input and package', async () => {
    const token = await signup();
    const bad = await request(app).post('/api/bookings').set(auth(token)).send({ packageId: 1, travelers: 0 });
    const missing = await request(app).post('/api/bookings').set(auth(token)).send({ packageId: 999, travelers: 1 });
    expect(bad.status).toBe(400);
    expect(missing.status).toBe(404);
  });
  test('each user sees only their own bookings', async () => {
    const t1 = await signup('one@example.com', 'One');
    const t2 = await signup('two@example.com', 'Two');
    await request(app).post('/api/bookings').set(auth(t1)).send({ packageId: 1, travelers: 1 });
    await request(app).post('/api/bookings').set(auth(t2)).send({ packageId: 2, travelers: 1 });
    const l1 = await request(app).get('/api/bookings').set(auth(t1));
    expect(l1.body).toHaveLength(1);
    expect(l1.body[0].packageId).toBe(1);
  });
  test('user can cancel own booking but not someone else\'s', async () => {
    const t1 = await signup('one@example.com', 'One');
    const t2 = await signup('two@example.com', 'Two');
    const b = await request(app).post('/api/bookings').set(auth(t1)).send({ packageId: 1, travelers: 1 });
    const other = await request(app).delete('/api/bookings/' + b.body.id).set(auth(t2));
    expect(other.status).toBe(404);
    const own = await request(app).delete('/api/bookings/' + b.body.id).set(auth(t1));
    expect(own.status).toBe(200);
    expect(own.body.status).toBe('CANCELLED');
  });
});

describe('metrics', () => {
  test('/metrics exposes business counters', async () => {
    const token = await signup();
    await request(app).post('/api/bookings').set(auth(token)).send({ packageId: 1, travelers: 1 });
    const r = await request(app).get('/metrics');
    expect(r.text).toContain('bookings_created_total');
    expect(r.text).toContain('registrations_total');
    expect(r.text).toContain('logins_total');
  });
});