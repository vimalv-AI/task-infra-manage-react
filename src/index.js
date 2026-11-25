require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./database/db'); // creates tables and seeds demo users
const provisioner = require('./services/provisioner');

const app = express();
const defaultOrigins = ['http://localhost:5173', 'http://infra-portal.vimalv.com'];
const envOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin = envOrigins.includes('*')
  ? '*'
  : Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => {
  console.log(`API running on http://0.0.0.0:${port}`);
  provisioner.resumePending();
});
