// server.js - API REST vulnerable (INTENCIONAL para demostración DevSecOps)
// ⚠️  ESTE CÓDIGO CONTIENE VULNERABILIDADES INTENCIONALES - NO USAR EN PRODUCCIÓN

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb, initDb } = require('./db');
const _ = require('lodash');

const app = express();
app.use(express.json());

// ❌ VULNERABILIDAD 1: Secreto JWT hardcodeado (Gitleaks lo detectará)
const JWT_SECRET = process.env.JWT_SECRET || 'hard_coded_jwt_secret_devsecops_demo_2024';

// ❌ VULNERABILIDAD 2: API Keys expuestas en el código (Gitleaks lo detectará)
// Nota: valores ficticios para demostración académica — no son claves reales
const STRIPE_API_KEY = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc_DEMO_FAKE_KEY_DO_NOT_USE';
const AWS_ACCESS_KEY = 'AKIAIOSFODNN7DEMOKEY';
const AWS_SECRET_KEY = 'Demo+FakeAWSSecret/DO_NOT_USE/ThisIsForDevSecOpsDemo';

// ------------------------------------------------
// Endpoint raíz
// ------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    name: 'Vulnerable Demo API',
    version: '1.0.0',
    description: 'API con vulnerabilidades intencionales para pipeline DevSecOps',
    endpoints: ['/login', '/users', '/users/:id', '/search', '/health']
  });
});

// ------------------------------------------------
// Health check
// ------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    revision: process.env.RENDER_GIT_COMMIT || null
  });
});

// ------------------------------------------------
// Login - con contraseñas en texto plano en logs
// ------------------------------------------------
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // ❌ VULNERABILIDAD 3: Log de contraseñas en texto claro (Semgrep lo detectará)
  console.log(`Login attempt: username=${username} password=${password}`);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getDb();

  // ❌ VULNERABILIDAD 4: SQL Injection - concatenación directa (Semgrep lo detectará)
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  db.get(query, [], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });
});

// ------------------------------------------------
// Middleware de autenticación
// ------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ------------------------------------------------
// GET /users - lista todos los usuarios
// ------------------------------------------------
app.get('/users', authenticate, (req, res) => {
  const db = getDb();

  // ❌ VULNERABILIDAD 5: Expone información sensible sin filtrar
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows); // expone passwords en la respuesta
  });
});

// ------------------------------------------------
// GET /users/:id - obtiene usuario por ID
// ------------------------------------------------
app.get('/users/:id', authenticate, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  // ❌ VULNERABILIDAD 6: Otro SQL Injection por parámetro de URL
  const query = `SELECT * FROM users WHERE id = ${id}`;

  db.get(query, [], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ------------------------------------------------
// GET /search?q= - búsqueda de usuarios
// ------------------------------------------------

// ✅ CORRECCIÓN 8: Whitelist de transformaciones permitidas (reemplaza eval)
// eval() con input externo permite ejecución de código arbitrario.
// La solución es definir explícitamente qué transformaciones son válidas.
const ALLOWED_TRANSFORMS = {
  uppercase: (r) => ({ ...r, username: r.username.toUpperCase() }),
  lowercase: (r) => ({ ...r, username: r.username.toLowerCase() }),
  noEmail:   (r) => ({ id: r.id, username: r.username })
};

app.get('/search', authenticate, (req, res) => {
  const { q } = req.query;
  const db = getDb();

  // ❌ VULNERABILIDAD 7: SQL Injection en parámetro de búsqueda (se mantiene para el demo)
  const query = `SELECT id, username, email FROM users WHERE username LIKE '%${q}%'`;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const transform = req.query.transform;
    if (transform) {
      const fn = typeof transform === 'string' &&
        Object.prototype.hasOwnProperty.call(ALLOWED_TRANSFORMS, transform)
        ? ALLOWED_TRANSFORMS[transform] : null;
      if (!fn) {
        return res.status(400).json({
          error: 'Invalid transform',
          allowed: Object.keys(ALLOWED_TRANSFORMS)
        });
      }
      return res.json(rows.map(fn));
    }

    res.json(rows);
  });
});

// ------------------------------------------------
// POST /merge - mezcla de objetos insegura
// ------------------------------------------------
app.post('/merge', authenticate, (req, res) => {
  const base = { role: 'user', permissions: [] };

  // ❌ VULNERABILIDAD 9: Prototype pollution via lodash.merge con versión vulnerable
  const merged = _.merge(base, req.body);

  res.json(merged);
});

// ------------------------------------------------
// Inicio del servidor
// ------------------------------------------------
async function start(port = process.env.PORT || 3000) {
  await initDb();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Server running on port ${server.address().port}`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Unable to start API:', err.message);
    process.exit(1);
  });
}

module.exports = app;
module.exports.start = start;
