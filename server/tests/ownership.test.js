import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { chat, getCases } from '../controllers/assistantController.js';
import { getIssuePhoto } from '../controllers/issueController.js';
import Issue from '../models/Issue.js';

test('chat case lookup always combines a requested report with the signed-in citizen id', async () => {
  const originalFind = Issue.find;
  const citizenId = new mongoose.Types.ObjectId();
  const otherCitizenIssueId = new mongoose.Types.ObjectId();
  let queryFilter;
  Issue.find = (filter) => {
    queryFilter = filter;
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean() { return Promise.resolve([]); },
    };
  };
  try {
    await assert.rejects(new Promise((resolve, reject) => chat({
      user: { _id: citizenId },
      body: {
        issueId: otherCitizenIssueId.toString(),
        message: 'What is the status?',
        history: [],
        consent: true,
      },
    }, { json: resolve }, reject)), { status: 404 });
    assert.deepEqual(queryFilter, { reportedBy: citizenId, _id: otherCitizenIssueId.toString() });
  } finally {
    Issue.find = originalFind;
  }
});

test('case dashboard only queries reports belonging to the signed-in citizen', async () => {
  const originalFind = Issue.find;
  const citizenId = new mongoose.Types.ObjectId();
  let queryFilter;
  Issue.find = (filter) => {
    queryFilter = filter;
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return Promise.resolve([]); },
    };
  };
  try {
    await new Promise((resolve, reject) => getCases(
      { user: { _id: citizenId } },
      { json: resolve },
      reject,
    ));
    assert.deepEqual(queryFilter, { reportedBy: citizenId });
  } finally {
    Issue.find = originalFind;
  }
});

test('report photo endpoint rejects a citizen who does not own the report', async () => {
  const originalFindById = Issue.findById;
  const ownerId = new mongoose.Types.ObjectId();
  const visitorId = new mongoose.Types.ObjectId();
  Issue.findById = () => ({
    select: async () => ({
      reportedBy: ownerId,
      assignedOfficer: null,
      image: '/uploads/12345678-1234-1234-1234-123456789abc.jpg',
      statusHistory: [],
    }),
  });
  try {
    await assert.rejects(new Promise((resolve, reject) => getIssuePhoto({
      user: { id: visitorId.toString(), role: 'citizen' },
      params: { id: new mongoose.Types.ObjectId().toString(), filename: '12345678-1234-1234-1234-123456789abc.jpg' },
    }, { sendFile: resolve }, reject)), { status: 403 });
  } finally {
    Issue.findById = originalFindById;
  }
});

test('public assistant gives rule-based civic help without database access when AI is unconfigured', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await new Promise((resolve, reject) => chat({
      publicAssistant: true,
      body: {
        message: 'How do I report a pothole?',
        history: [],
        consent: true,
      },
    }, { json: resolve }, reject));
    assert.equal(result.fallback, true);
    assert.match(result.reply, /Report issue/);
    assert.match(result.privacy, /No CivicFix report details were included/);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});
