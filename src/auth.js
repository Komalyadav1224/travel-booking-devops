const jwt = require('jsonwebtoken');

// Set JWT_SECRET in docker-compose / Kubernetes Secret for real deployments.
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.log(JSON.stringify({ level: 'warn', msg: 'JWT_SECRET not set, using insecure dev default' }));
}

const signToken = (user) => jwt.sign({ sub: user.id, name: user.name }, SECRET, { expiresIn: '2h' });

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'login required' });
  try {
    const p = jwt.verify(token, SECRET);
    req.user = { id: p.sub, name: p.name };
    return next();
  } catch (_e) {
    return res.status(401).json({ error: 'invalid or expired token, please log in again' });
  }
}

module.exports = { signToken, requireAuth };