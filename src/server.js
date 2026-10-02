const app = require('./app');
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(JSON.stringify({ level: 'info', msg: `Travel Booking listening on ${port}` })));
// Graceful shutdown (important for rolling / blue-green deployments)
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => server.close(() => process.exit(0))));
