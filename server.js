import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@waynepoon.me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wayne2026';

// Ensure data dir exists
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'wp-cms-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// ── Auth helpers ───────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.redirect('/admin/login');
}

function requireAuthApi(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Static files ───────────────────────────────────────────────

app.use(express.static(join(__dirname, 'public')));

// ── Admin routes ───────────────────────────────────────────────

app.get('/admin/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/admin');
  res.sendFile(join(__dirname, 'admin', 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'admin', 'index.html'));
});

app.use('/admin', express.static(join(__dirname, 'admin')));

// ── Auth API ───────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── Content API ────────────────────────────────────────────────

const contentFile = join(dataDir, 'content.json');

// Public: fetch all content (used by the public site)
app.get('/api/content', (req, res) => {
  const content = readJSON(contentFile);
  content ? res.json(content) : res.status(404).json({ error: 'Content not found' });
});

// Protected: save content
app.post('/api/content', requireAuthApi, (req, res) => {
  const ok = writeJSON(contentFile, req.body);
  ok
    ? res.json({ success: true })
    : res.status(500).json({ error: 'Failed to save content' });
});

// ── Visitor counter ────────────────────────────────────────────

const visitorsFile = join(dataDir, 'visitors.json');

app.get('/api/visitors', (req, res) => {
  const data = readJSON(visitorsFile) || { total: 0 };
  if (!req.session.counted) {
    req.session.counted = true;
    data.total += 1;
    writeJSON(visitorsFile, data);
  }
  res.json(data);
});

app.post('/api/visitors/reset', requireAuthApi, (_req, res) => {
  writeJSON(visitorsFile, { total: 0 });
  res.json({ success: true, total: 0 });
});

// ── Fallback ───────────────────────────────────────────────────

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── Helpers ────────────────────────────────────────────────────

function readJSON(filePath) {
  try {
    if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf8'));
    return null;
  } catch (err) {
    console.error('Error reading', filePath, err.message);
    return null;
  }
}

function writeJSON(filePath, data) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing', filePath, err.message);
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`Wayne Poon site running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
