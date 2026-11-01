import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import app from '../app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('API root reports the service status', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'CivicFix API is running successfully',
    status: 'success',
  });
});

test('health endpoint reports backend readiness', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'CivicFix backend is healthy',
    status: 'success',
  });
});

test('issue routes reject unauthenticated access', async () => {
  const response = await fetch(`${baseUrl}/api/issues`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Authentication required' });
});

test('assistant and escalation endpoints reject unauthenticated access', async () => {
  const casesResponse = await fetch(`${baseUrl}/api/assistant/cases`);
  assert.equal(casesResponse.status, 401);
  assert.deepEqual(await casesResponse.json(), { message: 'Authentication required' });

  const chatResponse = await fetch(`${baseUrl}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Show my reports', consent: true }),
  });
  assert.equal(chatResponse.status, 401);
  assert.deepEqual(await chatResponse.json(), { message: 'Authentication required' });

  const escalationResponse = await fetch(`${baseUrl}/api/issues/507f1f77bcf86cd799439011/escalations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'follow-up', consent: true }),
  });
  assert.equal(escalationResponse.status, 401);
  assert.deepEqual(await escalationResponse.json(), { message: 'Authentication required' });

  const draftResponse = await fetch(`${baseUrl}/api/issues/507f1f77bcf86cd799439011/escalations/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'follow-up' }),
  });
  assert.equal(draftResponse.status, 401);

  const photoResponse = await fetch(`${baseUrl}/api/issues/507f1f77bcf86cd799439011/photos/12345678-1234-1234-1234-123456789abc.jpg`);
  assert.equal(photoResponse.status, 401);
});

test('public assistant enforces explicit AI privacy consent', async () => {
  const response = await fetch(`${baseUrl}/api/assistant/public-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How do I report a pothole?', history: [], consent: false }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Confirm the AI privacy notice before starting a chat.' });
});

test('registration and login validate empty request bodies before database access', async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(registration.status, 400);
  assert.deepEqual(await registration.json(), { message: 'Name must be between 2 and 80 characters' });

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(login.status, 400);
  assert.deepEqual(await login.json(), { message: 'Email and password are required' });
});
