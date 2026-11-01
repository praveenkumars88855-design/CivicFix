import mongoose from 'mongoose';
import Issue from '../models/Issue.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { generateAssistantReply, generateRuleBasedReply } from '../services/geminiService.js';
import { getEligibleEscalationStage, getEscalationThresholds } from '../services/escalationPolicy.js';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const getCases = asyncHandler(async (request, response) => {
  const { followUpDays, escalationDays } = getEscalationThresholds();
  const issues = await Issue.find({ reportedBy: request.user._id })
    .select('title description category department status createdAt location statusHistory escalationRequests')
    .sort({ createdAt: -1 })
    .limit(200);
  const now = new Date();
  response.json({
    cases: issues.map((issue) => {
      const eligibility = getEligibleEscalationStage(issue, now);
      return {
        _id: issue._id,
        title: issue.title,
        description: issue.description,
        category: issue.category,
        department: issue.department,
        status: issue.status,
        createdAt: issue.createdAt,
        location: issue.location,
        ageInDays: Math.max(0, Math.floor((now.getTime() - issue.createdAt.getTime()) / 86_400_000)),
        eligibleStage: eligibility?.stage || null,
        daysSinceLastUpdate: eligibility?.daysSinceLastUpdate || 0,
        statusHistory: issue.statusHistory.slice(-20),
        escalationRequests: (issue.escalationRequests || []).map(({ _id, stage, requestedAt, referenceNumber }) => ({
          _id,
          stage,
          requestedAt,
          referenceNumber,
        })),
      };
    }),
    thresholds: { followUpDays, escalationDays },
    assistantConfigured: (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai'
      ? Boolean(process.env.OPENAI_API_KEY)
      : (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'gemini' && Boolean(process.env.GEMINI_API_KEY),
    providerName: (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai' ? 'OpenAI' : 'Google Gemini',
  });
});

export const chat = asyncHandler(async (request, response) => {
  const { message, issueId, consent, history } = request.body || {};
  if (!request.user && !request.publicAssistant) throw httpError('Authentication required', 401);
  if (consent !== true) throw httpError('Confirm the AI privacy notice before starting a chat.', 400);
  if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 1000) {
    throw httpError('Enter a message between 1 and 1000 characters.', 400);
  }
  if (!Array.isArray(history) || history.length > 10
      || history.some((item) => !item || !['user', 'assistant'].includes(item.role)
        || typeof item.content !== 'string' || item.content.length > 1000)) {
    throw httpError('Chat history is invalid. Start a new conversation and try again.', 400);
  }

  if (request.publicAssistant && issueId !== undefined) {
    throw httpError('Sign in to ask about private CivicFix reports.', 401);
  }
  const filter = request.user ? { reportedBy: request.user._id } : null;
  if (issueId !== undefined) {
    if (!mongoose.isValidObjectId(issueId)) throw httpError('Select a valid report.', 400);
    filter._id = issueId;
  }
  const reports = filter
    ? await Issue.find(filter)
      .select('title description category department status createdAt location statusHistory escalationRequests')
      .sort({ createdAt: -1 })
      .limit(issueId ? 1 : 30)
      .lean()
    : [];
  if (issueId && reports.length === 0) throw httpError('That report was not found in your account.', 404);

  const { followUpDays, escalationDays } = getEscalationThresholds();
  const now = new Date();
  const context = reports.map((issue) => {
    const eligibility = getEligibleEscalationStage(issue, now);
    return {
      ...issue,
      ageInDays: Math.max(0, Math.floor((now.getTime() - new Date(issue.createdAt).getTime()) / 86_400_000)),
      eligibleStage: eligibility?.stage || null,
      daysSinceLastUpdate: eligibility?.daysSinceLastUpdate || 0,
    };
  });
  let reply;
  let fallback = false;
  try {
    reply = await generateAssistantReply({
      message: message.trim(),
      history: history.map(({ role, content }) => ({ role, content: content.trim() })),
      issues: context,
    });
  } catch (error) {
    if (error.status !== 503 && error.status !== 502 && error.name !== 'AbortError' && error.name !== 'TimeoutError') throw error;
    fallback = true;
    reply = generateRuleBasedReply(message.trim(), context, { followUpDays, escalationDays });
  }
  response.json({
    reply,
    fallback,
    fallbackNotice: fallback ? 'The AI service is unavailable right now. Here is basic help using CivicFix report data.' : '',
    thresholds: { followUpDays, escalationDays },
    privacy: request.user
      ? `Your message and relevant report details (including location and update history) are sent to ${(process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai' ? 'OpenAI' : 'Google Gemini'} when its AI service is available. Your name, email, photo, and account identifiers are not sent.`
      : `Your message is sent to ${(process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai' ? 'OpenAI' : 'Google Gemini'} when its AI service is available. No CivicFix report details were included.`,
    providerName: (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai' ? 'OpenAI' : 'Google Gemini',
  });
});
