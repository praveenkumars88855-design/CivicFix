import Issue from '../models/Issue.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createEscalationMessage, getEligibleEscalationStage, getEscalationThresholds } from '../services/escalationPolicy.js';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getEligibleCitizenIssue(request, stage) {
  if (!['follow-up', 'escalation'].includes(stage)) throw httpError('Choose a valid follow-up stage.', 400);
  const issue = await Issue.findById(request.params.id);
  if (!issue || issue.reportedBy.toString() !== request.user.id) {
    throw httpError('Report not found in your account.', 404);
  }
  const eligibility = getEligibleEscalationStage(issue);
  const { followUpDays, escalationDays } = getEscalationThresholds();
  const stageIsEligible = eligibility?.stage === stage
    || (stage === 'follow-up' && eligibility?.stage === 'escalation');
  if (!stageIsEligible) {
    throw httpError(`This report is not eligible for that request. Follow-up starts after ${followUpDays} days; escalation starts after ${escalationDays} days for unresolved reports.`, 400);
  }
  if (issue.escalationRequests.some((item) => item.stage === stage)) {
    throw httpError('A request for this stage has already been recorded for this report.', 409);
  }
  return { issue, eligibility, followUpDays, escalationDays };
}

export const getEscalationDraft = asyncHandler(async (request, response) => {
  const { issue, eligibility } = await getEligibleCitizenIssue(request, request.body?.stage);
  response.json({
    draft: createEscalationMessage(issue, request.body.stage, eligibility.ageInDays, eligibility.daysSinceLastUpdate),
    notice: 'Draft only. Review it carefully. CivicFix will not send it to an external authority.',
  });
});

export const createEscalationRequest = asyncHandler(async (request, response) => {
  const { stage } = request.body || {};
  if (request.body?.consent !== true) {
    throw httpError('Confirm that you want to record this request in CivicFix.', 400);
  }
  const { issue, eligibility, followUpDays, escalationDays } = await getEligibleCitizenIssue(request, stage);
  const referenceNumber = request.body.referenceNumber === undefined ? '' : request.body.referenceNumber;
  if (typeof referenceNumber !== 'string' || referenceNumber.trim().length > 100) {
    throw httpError('An official reference number must be 100 characters or fewer.', 400);
  }

  const message = createEscalationMessage(issue, stage, eligibility.ageInDays, eligibility.daysSinceLastUpdate);
  const thresholdDays = stage === 'escalation' ? escalationDays : followUpDays;
  const updatedIssue = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      reportedBy: request.user._id,
      status: { $in: ['Pending', 'AI Triaged', 'Assigned', 'In Progress', 'Reopened'] },
      createdAt: { $lte: new Date(Date.now() - thresholdDays * 86_400_000) },
      statusHistory: {
        $not: {
          $elemMatch: { updatedAt: { $gt: new Date(Date.now() - thresholdDays * 86_400_000) } },
        },
      },
      'escalationRequests.stage': { $ne: stage },
    },
    { $push: { escalationRequests: { stage, message, referenceNumber: referenceNumber.trim(), citizenConfirmedAt: new Date() } } },
    { new: true, runValidators: true },
  );
  if (!updatedIssue) {
    throw httpError('This request was already recorded or the report is no longer eligible.', 409);
  }
  response.status(201).json({
    issue: updatedIssue,
    request: updatedIssue.escalationRequests.at(-1),
    notice: 'Recorded in CivicFix for administrator/officer review. This request has not been sent to a municipal authority.',
  });
});

export const recordExternalReference = asyncHandler(async (request, response) => {
  const { referenceNumber } = request.body || {};
  if (typeof referenceNumber !== 'string' || referenceNumber.trim().length < 1 || referenceNumber.trim().length > 100) {
    throw httpError('Enter a reference number between 1 and 100 characters.', 400);
  }
  if (!mongoose.isValidObjectId(request.params.requestId)) throw httpError('Follow-up request not found.', 404);
  const issue = await Issue.findById(request.params.id);
  if (!issue || issue.reportedBy.toString() !== request.user.id) {
    throw httpError('Report not found in your account.', 404);
  }
  const followUp = issue.escalationRequests.id(request.params.requestId);
  if (!followUp) throw httpError('Follow-up request not found.', 404);
  followUp.referenceNumber = referenceNumber.trim();
  await issue.save();
  response.json({
    request: followUp,
    notice: 'Reference number recorded as provided. CivicFix has not verified or submitted the external grievance.',
  });
});
