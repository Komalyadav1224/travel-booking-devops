const path = require('path');
const express = require('express');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const store = require('./store');

const logger = pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info' });
const app = express();

// ---- Monitoring (Prometheus metrics) ----
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'], buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2], registers: [register]
});
const bookingsCreated = new client.Counter({ name: 'bookings_created_total', help: 'Bookings created', registers: [register] });

// ---- Security + Logging middleware ----
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(pinoHttp({ logger }));
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route ? req.route.path : 'other', status: res.statusCode }));
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Health / Info / Metrics ----
app.get('/health', (_req, res) => res.json({ status: 'UP' }));
app.get('/ready', (_req, res) => res.json({ status: 'READY' }));
app.get('/api/info', (_req, res) =>
  res.json({ app: 'travel-booking', version: process.env.APP_VERSION || '1.0.0', color: process.env.APP_COLOR || 'none', pod: process.env.HOSTNAME || 'local' }));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---- Destinations ----
app.get('/api/destinations', (_req, res) => res.json(store.listDestinations()));
app.post('/api/destinations', (req, res) => {
  const { name, country, description } = req.body || {};
  if (!name || !country) return res.status(400).json({ error: 'name and country are required' });
  res.status(201).json(store.addDestination({ name, country, description: description || '' }));
});

// ---- Packages ----
app.get('/api/packages', (req, res) => res.json(store.listPackages(req.query.destinationId)));

// ---- Bookings ----
app.get('/api/bookings', (_req, res) => res.json(store.listBookings()));
app.post('/api/bookings', (req, res) => {
  const { packageId, name, email, travelers } = req.body || {};
  const n = Number(travelers);
  if (!packageId || !name || !email || !/^\S+@\S+\.\S+$/.test(email) || !Number.isInteger(n) || n < 1 || n > 20)
    return res.status(400).json({ error: 'packageId, name, valid email and travelers (1-20) are required' });
  const pkg = store.getPackage(packageId);
  if (!pkg) return res.status(404).json({ error: 'package not found' });
  const booking = store.createBooking({ pkg, name, email, travelers: n });
  bookingsCreated.inc();
  req.log.info({ bookingId: booking.id }, 'booking created');
  res.status(201).json(booking);
});
app.delete('/api/bookings/:id', (req, res) => {
  const b = store.cancelBooking(req.params.id);
  if (!b) return res.status(404).json({ error: 'booking not found' });
  res.json(b);
});

app.use((_req, res) => res.status(404).json({ error: 'not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => { req.log.error(err); res.status(500).json({ error: 'internal error' }); });

module.exports = app;
