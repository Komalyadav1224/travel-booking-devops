const path = require('path');
const express = require('express');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const bcrypt = require('bcryptjs');
const store = require('./store');
const { signToken, requireAuth } = require('./auth');

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
const registrationsTotal = new client.Counter({ name: 'registrations_total', help: 'Users registered', registers: [register] });
const loginsTotal = new client.Counter({ name: 'logins_total', help: 'Login attempts', labelNames: ['result'], registers: [register] });
loginsTotal.labels('success');
loginsTotal.labels('failure');

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
app.get('/api/stats', (_req, res) => res.json(store.counts()));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---- Auth ----
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const { password } = body;
    if (!name || !EMAIL_RE.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 72)
      return res.status(400).json({ error: 'name, valid email and password (8-72 characters) are required' });
    if (store.findUserByEmail(email)) return res.status(409).json({ error: 'email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = store.createUser({ name: name.slice(0, 60), email, passwordHash });
    registrationsTotal.inc();
    req.log.info({ userId: user.id }, 'user registered');
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) { return next(e); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const user = store.findUserByEmail(email);
    const ok = user && typeof body.password === 'string' && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) {
      loginsTotal.inc({ result: 'failure' });
      req.log.warn({ email }, 'login failed');
      return res.status(401).json({ error: 'invalid email or password' });
    }
    loginsTotal.inc({ result: 'success' });
    req.log.info({ userId: user.id }, 'login success');
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) { return next(e); }
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = store.findUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'user not found, please log in again' });
  return res.json(publicUser(user));
});

// ---- Destinations ----
app.get('/api/destinations', (_req, res) => res.json(store.listDestinations()));
app.post('/api/destinations', requireAuth, (req, res) => {
  const { name, country, description } = req.body || {};
  if (!name || !country) return res.status(400).json({ error: 'name and country are required' });
  return res.status(201).json(store.addDestination({ name, country, description: description || '' }));
});

// ---- Packages ----
app.get('/api/packages', (req, res) => res.json(store.listPackages(req.query.destinationId)));

// ---- Bookings (login required, each user sees only their own) ----
app.get('/api/bookings', requireAuth, (req, res) => res.json(store.listBookings(req.user.id)));
app.post('/api/bookings', requireAuth, (req, res) => {
  const { packageId, travelers } = req.body || {};
  const n = Number(travelers);
  if (!packageId || !Number.isInteger(n) || n < 1 || n > 20)
    return res.status(400).json({ error: 'packageId and travelers (1-20) are required' });
  const pkg = store.getPackage(packageId);
  if (!pkg) return res.status(404).json({ error: 'package not found' });
  const user = store.findUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'user not found, please log in again' });
  const booking = store.createBooking({ pkg, user, travelers: n });
  bookingsCreated.inc();
  req.log.info({ bookingId: booking.id, userId: user.id }, 'booking created');
  return res.status(201).json(booking);
});
app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const b = store.cancelBooking(req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'booking not found' });
  return res.json(b);
});

app.use((_req, res) => res.status(404).json({ error: 'not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => { req.log.error(err); res.status(500).json({ error: 'internal error' }); });

module.exports = app;