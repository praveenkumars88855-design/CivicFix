import assert from 'node:assert/strict';
import test from 'node:test';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { suggestIssueDetails } from '../services/aiService.js';
import { determinePriority } from '../services/priorityService.js';
import { generateAssistantReply, generateRuleBasedReply } from '../services/geminiService.js';
import { createEscalationMessage, getEligibleEscalationStage, getEscalationThresholds } from '../services/escalationPolicy.js';
import { getDepartment } from '../utils/departmentMap.js';

test('priority scoring recognizes escalating safety language', () => {
  assert.deepEqual(determinePriority('A pothole on the road'), { level: 'Low', score: 25 });
  assert.deepEqual(determinePriority('The broken streetlight is dangerous'), { level: 'High', score: 75 });
  assert.deepEqual(determinePriority('There is a gas leak by the school'), { level: 'Critical', score: 95 });
});

test('issue suggestions map categories to departments and explain triage', () => {
  const result = suggestIssueDetails('Streetlight is out', 'A broken street light blocks the dark sidewalk.', '');
  assert.equal(result.category, 'Streetlight');
  assert.equal(result.department, 'Utilities');
  assert.equal(result.priorityLevel, 'Medium');
  assert.match(result.aiReason, /Suggested Streetlight classification/);
});

test('citizen-selected categories are preserved and departments cover common issues', () => {
  assert.equal(suggestIssueDetails('Water leak', 'A leaking pipe near the park.', 'Water').category, 'Water');
  assert.equal(getDepartment('blocked road'), 'Public Works');
  assert.equal(getDepartment('garbage collection'), 'Sanitation');
  assert.equal(getDepartment('unclassified concern'), 'General');
});

test('Mongoose schemas default new accounts and reports to safe citizen states', () => {
  const user = new User({ name: 'Civic Citizen', email: 'citizen@example.com', password: 'a-long-password' });
  const issue = new Issue({
    title: 'Broken neighborhood streetlight',
    description: 'The streetlight has been broken for several nights.',
    reportedBy: user._id,
  });
  assert.equal(user.role, 'citizen');
  assert.equal(issue.status, 'Pending');
  assert.equal(issue.priorityLevel, 'Low');
  assert.equal(issue.validateSync(), undefined);
  issue.escalationRequests.push({ stage: 'follow-up', message: 'Please review this unresolved report.' });
  issue.statusHistory.push({ status: 'Reopened', event: 'resolution-disputed', note: 'The repair did not last.' });
  assert.equal(issue.validateSync(), undefined);
});

test('Gemini assistant reports missing server-side configuration explicitly', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      generateAssistantReply({ message: 'Check my report', history: [], issues: [] }),
      { message: /gemini assistant key is not configured in server\/\.env/, status: 503 },
    );
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});

test('Gemini assistant keeps its key in a server-side header and returns model text', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousProvider = process.env.AI_PROVIDER;
  const previousFetch = globalThis.fetch;
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key');
    assert.doesNotMatch(url, /test-gemini-key/);
    const body = JSON.parse(options.body);
    assert.match(body.systemInstruction.parts[0].text, /Broken streetlight/);
    assert.doesNotMatch(body.systemInstruction.parts[0].text, /citizen@example\.com/);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Your report is pending.' }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const reply = await generateAssistantReply({
      message: 'What is the status?',
      history: [],
      issues: [{
        _id: '507f1f77bcf86cd799439011',
        title: 'Broken streetlight',
        description: 'A lamp is broken.',
        category: 'Streetlight',
        department: 'Utilities',
        status: 'Pending',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ageInDays: 2,
        eligibleStage: null,
        email: 'citizen@example.com',
      }],
    });
    assert.equal(reply, 'Your report is pending.');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});

test('escalation policy uses configurable thresholds for unresolved reports only', () => {
  const oldFollowUp = process.env.FOLLOW_UP_DAYS;
  const oldEscalation = process.env.ESCALATION_DAYS;
  process.env.FOLLOW_UP_DAYS = '15';
  process.env.ESCALATION_DAYS = '30';
  try {
    assert.deepEqual(getEscalationThresholds(), { followUpDays: 15, escalationDays: 30 });
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const issue = { status: 'Pending', createdAt };
    assert.equal(getEligibleEscalationStage(issue, new Date('2026-01-14T23:59:59.999Z')), null);
    assert.equal(getEligibleEscalationStage(issue, new Date('2026-01-16T00:00:00.000Z')).stage, 'follow-up');
    assert.equal(getEligibleEscalationStage(issue, new Date('2026-01-16T00:00:00.000Z')).daysSinceLastUpdate, 15);
    assert.equal(getEligibleEscalationStage(issue, new Date('2026-01-31T00:00:00.000Z')).stage, 'escalation');
    assert.equal(getEligibleEscalationStage(issue, new Date('2026-01-31T00:00:00.000Z')).daysSinceLastUpdate, 30);
    assert.equal(getEligibleEscalationStage({
      ...issue,
      statusHistory: [{ updatedAt: new Date('2026-01-28T00:00:00.000Z') }],
    }, new Date('2026-01-31T00:00:00.000Z')), null);
    assert.equal(getEligibleEscalationStage({ ...issue, status: 'Resolved' }, new Date('2026-02-10T00:00:00.000Z')), null);
  } finally {
    if (oldFollowUp === undefined) delete process.env.FOLLOW_UP_DAYS;
    else process.env.FOLLOW_UP_DAYS = oldFollowUp;
    if (oldEscalation === undefined) delete process.env.ESCALATION_DAYS;
    else process.env.ESCALATION_DAYS = oldEscalation;
  }
});

test('escalation thresholds reject invalid timing and generated requests are transparent', () => {
  const oldFollowUp = process.env.FOLLOW_UP_DAYS;
  const oldEscalation = process.env.ESCALATION_DAYS;
  process.env.FOLLOW_UP_DAYS = '30';
  process.env.ESCALATION_DAYS = '30';
  try {
    assert.throws(() => getEscalationThresholds(), /must be greater than/);
  } finally {
    if (oldFollowUp === undefined) delete process.env.FOLLOW_UP_DAYS;
    else process.env.FOLLOW_UP_DAYS = oldFollowUp;
    if (oldEscalation === undefined) delete process.env.ESCALATION_DAYS;
    else process.env.ESCALATION_DAYS = oldEscalation;
  }

  const message = createEscalationMessage({
    _id: '507f1f77bcf86cd799439011',
    title: 'Broken streetlight',
    description: 'The lights are broken',
    category: 'Streetlight',
    department: 'Utilities',
    status: 'Pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }, 'escalation', 30);
  assert.match(message, /higher-level follow-up/);
  assert.match(message, /has not submitted this letter to an external authority/);
  assert.match(message, /Issue details: The lights are broken/);
  assert.match(message, /Days since latest recorded status update: 30/);
});

test('basic assistant replies use actual case context when the AI provider is unavailable', () => {
  const issue = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Blocked drain',
    category: 'Drainage',
    department: 'Public Works',
    status: 'Reopened',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ageInDays: 30,
    daysSinceLastUpdate: 30,
    eligibleStage: 'escalation',
    statusHistory: [{ note: 'Citizen says blockage remains.' }],
  };
  const thresholds = { followUpDays: 15, escalationDays: 30 };
  assert.match(generateRuleBasedReply('What is the status of my complaint?', [issue], thresholds), /507f1f77bcf86cd799439011/);
  assert.match(generateRuleBasedReply('Is my report delayed?', [issue], thresholds), /eligible for an escalation/);
  assert.match(generateRuleBasedReply('How do I report a pothole?', [], thresholds), /Report issue/);
  assert.match(generateRuleBasedReply('Tamil Nadu helpline', [], thresholds), /1100/);
});
