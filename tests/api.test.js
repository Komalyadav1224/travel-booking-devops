const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

beforeEach(() => store.reset());

describe('Travel Booking API', () => {
  test('health endpoint', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('UP');
  });
  test('lists destinations', async () => {
    const r = await request(app).get('/api/destinations');
    expect(r.body.length).toBeGreaterThan(0);
  });
  test('adds a destination', async () => {
    const r = await request(app).post('/api/destinations').send({ name: 'Paris', country: 'France' });
    expect(r.status).toBe(201);
    expect((await request(app).post('/api/destinations').send({})).status).toBe(400);
  });
  test('filters packages by destination', async () => {
    const r = await request(app).get('/api/packages?destinationId=1');
    expect(r.body.every((p) => p.destinationId === 1)).toBe(true);
  });
  test('creates a booking with correct total', async () => {
    const r = await request(app).post('/api/bookings').send({ packageId: 1, name: 'Ravi', email: 'ravi@example.com', travelers: 2 });
    expect(r.status).toBe(201);
    expect(r.body.totalPrice).toBe(30000);
  });
  test('rejects invalid booking', async () => {
    const r = await request(app).post('/api/bookings').send({ packageId: 1, name: 'x', email: 'bad', travelers: 0 });
    expect(r.status).toBe(400);
  });
  test('404 for unknown package', async () => {
    const r = await request(app).post('/api/bookings').send({ packageId: 999, name: 'x', email: 'a@b.co', travelers: 1 });
    expect(r.status).toBe(404);
  });
  test('cancels a booking', async () => {
    const b = await request(app).post('/api/bookings').send({ packageId: 1, name: 'x', email: 'a@b.co', travelers: 1 });
    const r = await request(app).delete(`/api/bookings/${b.body.id}`);
    expect(r.body.status).toBe('CANCELLED');
    expect((await request(app).delete('/api/bookings/999')).status).toBe(404);
  });
  test('exposes prometheus metrics', async () => {
    const r = await request(app).get('/metrics');
    expect(r.status).toBe(200);
    expect(r.text).toContain('bookings_created_total');
  });
});
