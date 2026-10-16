const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-api-test-'));
process.env.DB_PATH = path.join(directory, 'nested', 'users.db');
const { start } = require('../server');
const { getDb, initDb } = require('../db');
let server;
let baseUrl;
let token;

before(async () => {
  server = await start(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await new Promise((resolve, reject) => getDb().close((err) => err ? reject(err) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

test('first login succeeds with a new database and seeded users', async () => {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.username, 'admin');
  assert.ok(body.token);
  token = body.token;
  assert.ok(fs.existsSync(process.env.DB_PATH));
});

test('health reports readiness', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('protected endpoints require authentication', async () => {
  assert.equal((await fetch(`${baseUrl}/users`)).status, 401);
});

test('initializing twice does not duplicate demo users', async () => {
  await initDb();
  const response = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).length, 2);
});

test('user lookup and search transformations work', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const user = await fetch(`${baseUrl}/users/1`, { headers });
  assert.equal(user.status, 200);
  assert.equal((await user.json()).username, 'admin');
  const search = await fetch(`${baseUrl}/search?q=ali&transform=uppercase`, { headers });
  assert.equal(search.status, 200);
  assert.equal((await search.json())[0].username, 'ALICE');
});

test('inherited and unknown transformation names return 400', async () => {
  for (const transform of ['unknown', 'constructor', '__proto__', 'toString']) {
    const response = await fetch(`${baseUrl}/search?q=ali&transform=${transform}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 400, transform);
    assert.equal((await response.json()).error, 'Invalid transform');
  }
});
