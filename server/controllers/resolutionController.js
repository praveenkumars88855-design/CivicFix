import Issue from '../models/Issue.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const requestResolutionReview = asyncHandler(async (request, response) => {
  const note = request.body?.note;
  if (typeof note !== 'string' || note.trim().length < 10 || note.trim().length > 1000) {
    throw httpError('Explain why the issue remains unresolved (10 to 1000 characters).', 400);
  }
  const issue = await Issue.findById(request.params.id);
  if (!issue || issue.reportedBy.toString() !== request.user.id) {
    throw httpError('Report not found in your account.', 404);
  }
  if (!['Resolved', 'Verified'].includes(issue.status)) {
    throw httpError('Only resolved reports can be reopened for review.', 400);
  }

  issue.status = 'Reopened';
  issue.resolvedAt = null;
  issue.statusHistory.push({
    status: 'Reopened',
    event: 'resolution-disputed',
    note: note.trim(),
    evidenceImage: request.file ? `/uploads/${request.file.filename}` : '',
    updatedBy: request.user._id,
  });
  await issue.save();
  response.json({ issue, message: 'Your report was reopened for review. The update and any evidence are saved in its history.' });
});
