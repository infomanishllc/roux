'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'manish';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'manishsp0m';

// ── File-based DB ─────────────────────────────────────────────────────────────
function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {}
  return { users: [] };
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function findUser(pred) {
  return readDB().users.find(pred) || null;
}

function saveUser(user) {
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === user.id);
  if (idx >= 0) db.users[idx] = user;
  else db.users.push(user);
  writeDB(db);
}

function deleteUser(id) {
  const db = readDB();
  db.users = db.users.filter(u => u.id !== id);
  writeDB(db);
}

function userPublic(u) {
  const now = new Date();
  const lastSeen = u.lastSeen ? new Date(u.lastSeen) : null;
  const isOnline = !!(u.activeSessionToken && lastSeen && (now - lastSeen) < 25000);
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isActive: u.isActive,
    isOnline,
    durationMinutes: u.durationMinutes,
    expiresAt: u.expiresAt || null,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin || null,
    lastSeen: u.lastSeen || null,
    robux: u.robux || 0
  };
}

// ── Seed admin ────────────────────────────────────────────────────────────────
async function seedAdmin() {
  const existing = findUser(u => u.username === ADMIN_USERNAME);
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    saveUser({
      id: uuidv4(),
      username: ADMIN_USERNAME,
      passwordHash: hash,
      role: 'admin',
      isActive: true,
      durationMinutes: 0,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      robux: 0,
      activeSessionToken: null,
      decorations: []
    });
    console.log(`Admin created: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Session helpers ───────────────────────────────────────────────────────────
function setSession(res, token) {
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function getSessionUser(req) {
  const token = req.cookies && req.cookies.session;
  if (!token) return null;
  const user = findUser(u => u.activeSessionToken === token);
  if (!user) return null;
  if (user.role !== 'admin' && user.expiresAt && new Date() > new Date(user.expiresAt)) return null;
  return user;
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = findUser(u => u.username === username.trim());
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });

    if (!user.isActive) return res.status(403).json({ error: 'Account is inactive' });

    if (user.role !== 'admin') {
      if (user.expiresAt && new Date() > new Date(user.expiresAt)) {
        return res.status(403).json({ error: 'Account is deactivated. Contact admin' });
      }
      if (!user.expiresAt && user.durationMinutes) {
        user.expiresAt = new Date(Date.now() + user.durationMinutes * 60 * 1000).toISOString();
      }
    }

    user.activeSessionToken = uuidv4();
    user.lastLogin = new Date().toISOString();
    saveUser(user);

    setSession(res, user.activeSessionToken);
    res.json({ success: true, user: userPublic(user) });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const token = req.cookies && req.cookies.session;
    if (token) {
      const user = findUser(u => u.activeSessionToken === token);
      if (user) { user.activeSessionToken = null; user.lastSeen = null; saveUser(user); }
    }
    res.clearCookie('session');
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });
  }
});

app.get('/api/auth/status', (req, res) => {
  try {
    const token = req.cookies && req.cookies.session;
    if (token) {
      const rawUser = findUser(u => u.activeSessionToken === token);
      if (rawUser && rawUser.role !== 'admin' && rawUser.expiresAt && new Date() > new Date(rawUser.expiresAt)) {
        return res.json({ authenticated: false, reason: 'expired' });
      }
    }
    const user = getSessionUser(req);
    if (!user) return res.json({ authenticated: false });
    user.lastSeen = new Date().toISOString();
    saveUser(user);
    res.json({ authenticated: true, user: userPublic(user) });
  } catch (e) {
    res.json({ authenticated: false });
  }
});

// Lightweight ping — just stamps lastSeen, used for online tracking
app.post('/api/auth/ping', (req, res) => {
  try {
    const user = getSessionUser(req);
    if (!user) return res.json({ ok: false });
    user.lastSeen = new Date().toISOString();
    saveUser(user);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.get('/api/auth/robux', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  res.json({ success: true, robux: user.robux || 0 });
});

app.put('/api/auth/robux', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false });
  user.robux = Math.max(0, parseInt(req.body.robux, 10) || 0);
  saveUser(user);
  res.json({ success: true, robux: user.robux });
});

app.post('/api/auth/robux/deduct', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false });
  const amount = parseInt(req.body.amount, 10) || 0;
  user.robux = Math.max(0, (user.robux || 0) - amount);
  saveUser(user);
  res.json({ success: true, robux: user.robux });
});

// ── Admin middleware ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  req.adminUser = user;
  next();
}

// ── User management ───────────────────────────────────────────────────────────
app.get('/api/users', requireAdmin, (req, res) => {
  const db = readDB();
  res.json({ users: db.users.map(userPublic) });
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, duration } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  if (findUser(u => u.username === username.trim())) return res.status(409).json({ error: 'Username already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username: username.trim(),
    passwordHash: hash,
    role: 'customer',
    isActive: true,
    durationMinutes: duration || 1440,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    robux: 0,
    activeSessionToken: null,
    decorations: []
  };
  saveUser(user);
  res.json({ success: true, user: userPublic(user) });
});

app.delete('/api/users/expired', requireAdmin, (req, res) => {
  const db = readDB();
  const now = new Date();
  const expired = db.users.filter(u => u.role !== 'admin' && u.expiresAt && new Date(u.expiresAt) < now);
  expired.forEach(u => deleteUser(u.id));
  res.json({ success: true, deletedCount: expired.length, deletedUsers: expired.map(u => ({ username: u.username })) });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  deleteUser(req.params.id);
  res.json({ success: true });
});

app.patch('/api/users/:id', requireAdmin, async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
  const user = findUser(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.passwordHash = await bcrypt.hash(password, 10);
  saveUser(user);
  res.json({ success: true });
});

app.patch('/api/users/:id/extend', requireAdmin, (req, res) => {
  const user = findUser(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const days = parseInt(req.body.days, 10) || 0;
  const hours = parseInt(req.body.hours, 10) || 0;
  const addMs = (days * 24 * 60 + hours * 60) * 60 * 1000;
  const base = user.expiresAt && new Date(user.expiresAt) > new Date() ? new Date(user.expiresAt) : new Date();
  user.expiresAt = new Date(base.getTime() + addMs).toISOString();
  user.durationMinutes = (user.durationMinutes || 0) + days * 1440 + hours * 60;
  saveUser(user);
  res.json({ success: true, message: `Extended by ${days ? days + ' day(s)' : hours + ' hour(s)'}`, newExpiry: user.expiresAt });
});

app.patch('/api/users/:id/reduce', requireAdmin, (req, res) => {
  const user = findUser(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const days = parseInt(req.body.days, 10) || 0;
  const hours = parseInt(req.body.hours, 10) || 0;
  const subMs = (days * 24 * 60 + hours * 60) * 60 * 1000;
  if (user.expiresAt) {
    user.expiresAt = new Date(Math.max(Date.now(), new Date(user.expiresAt).getTime() - subMs)).toISOString();
  }
  user.durationMinutes = Math.max(1, (user.durationMinutes || 0) - days * 1440 - hours * 60);
  saveUser(user);
  res.json({ success: true, message: `Reduced by ${days ? days + ' day(s)' : hours + ' hour(s)'}`, newExpiry: user.expiresAt, newDuration: user.durationMinutes });
});

// ── Decorations ───────────────────────────────────────────────────────────────
app.get('/api/decorations', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false });
  res.json({ success: true, decorations: user.decorations || [] });
});

app.post('/api/decorations', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false });
  user.decorations = req.body.decorations || [];
  saveUser(user);
  res.json({ success: true });
});

app.post('/api/decorations/upload', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ success: false });
  const { dataUrl } = req.body || {};
  if (!dataUrl) return res.status(400).json({ success: false, message: 'No data' });
  res.json({ success: true, url: dataUrl, public_id: uuidv4() });
});

// ── Proxy routes ──────────────────────────────────────────────────────────────
function buildQuery(req) {
  const q = req.url.indexOf('?');
  return q >= 0 ? req.url.slice(q) : '';
}

async function proxyGet(req, res, base) {
  try {
    const r = await fetch(base + buildQuery(req), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ct = r.headers.get('content-type') || 'application/json';
    res.set('Content-Type', ct).status(r.status).send(await r.text());
  } catch (e) { res.json({ data: [] }); }
}

async function proxyPost(req, res, base) {
  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify(req.body)
    });
    const ct = r.headers.get('content-type') || 'application/json';
    res.set('Content-Type', ct).status(r.status).send(await r.text());
  } catch (e) { res.json({ data: [] }); }
}

app.get('/proxy/users/*', (req, res) => proxyGet(req, res, 'https://users.roblox.com/' + req.params[0]));
app.post('/proxy/users/*', (req, res) => proxyPost(req, res, 'https://users.roblox.com/' + req.params[0]));
app.get('/proxy/thumbnails/*', (req, res) => proxyGet(req, res, 'https://thumbnails.roblox.com/' + req.params[0]));
app.get('/proxy/friends/*', (req, res) => proxyGet(req, res, 'https://friends.roblox.com/' + req.params[0]));
app.get('/proxy/economy/*', (req, res) => proxyGet(req, res, 'https://economy.roblox.com/' + req.params[0]));

// ── Stub routes ───────────────────────────────────────────────────────────────
app.all('/stub/empty-json', (req, res) => res.json({}));
app.all('/stub/user-profiles', (req, res) => res.json({ profileDetails: [] }));
app.all('/stub/locales', (req, res) => res.json({ data: [] }));
app.all('/payments-metrics/*', (req, res) => res.json({}));

// ── HTML page routes ──────────────────────────────────────────────────────────
const ROOT = __dirname;

function sendHtml(res, filePath) {
  const full = path.join(ROOT, filePath);
  if (fs.existsSync(full)) return res.sendFile(full);
  res.status(404).send('Not found');
}

app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(ROOT, 'sw.js'));
});
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(ROOT, 'sw.js'));
});
app.get('/', (req, res) => sendHtml(res, 'login.html'));
app.get('/login', (req, res) => sendHtml(res, 'login.html'));
app.get('/upgrades/robux', (req, res) => sendHtml(res, 'upgrades/robux.html'));
app.get('/my/avatar', (req, res) => sendHtml(res, 'my/avatar.html'));
app.get('/my/account', (req, res) => sendHtml(res, 'my/account.html'));
app.get('/my/settings', (req, res) => sendHtml(res, 'my/account.html'));
app.get('/pages/admin.html', (req, res) => sendHtml(res, 'pages/admin.html'));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(ROOT, { index: false }));

// ── Start ─────────────────────────────────────────────────────────────────────
seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  });
});
