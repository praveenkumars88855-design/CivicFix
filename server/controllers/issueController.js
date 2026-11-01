import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { suggestIssueDetails } from '../services/aiService.js';

const allowedStatuses = ['Pending', 'AI Triaged', 'Assigned', 'In Progress', 'Reopened', 'Resolved', 'Verified'];
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseLocation(value) {
  if (!value) throw httpError('Select a valid location on the map', 400);
  let location;
  try {
    location = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw httpError('Location must be valid JSON coordinates', 400);
  }
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw httpError('Location must include valid map coordinates', 400);
  }
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw httpError('Select a valid location on the map', 400);
  }
  return {
    latitude,
    longitude,
    address: typeof location.address === 'string' ? location.address.trim().slice(0, 240) : '',
  };
}

export const listIssues = asyncHandler(async (request, response) => {
  const filter = {};
  if (request.user.role === 'citizen') filter.reportedBy = request.user._id;
  if (request.user.role === 'officer') filter.assignedOfficer = request.user._id;
  if (request.query.status && allowedStatuses.includes(request.query.status)) {
    filter.status = request.query.status;
  }

  const issues = await Issue.find(filter)
    .populate('reportedBy', 'name email')
    .populate('assignedOfficer', 'name email')
    .populate('duplicateOf', 'title')
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(200);
  response.json({ issues });
});

export const getIssuePhoto = asyncHandler(async (request, response) => {
  const issue = await Issue.findById(request.params.id).select('reportedBy assignedOfficer image statusHistory');
  if (!issue) throw httpError('Report photo not found', 404);
  const isOwner = issue.reportedBy.toString() === request.user.id;
  const isAssignedOfficer = issue.assignedOfficer?.toString() === request.user.id;
  if (!isOwner && request.user.role !== 'admin' && !isAssignedOfficer) {
    throw httpError('You do not have permission to view this report photo', 403);
  }
  const { filename } = request.params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) throw httpError('Report photo not found', 404);
  const storedPaths = [
    issue.image,
    ...issue.statusHistory.map((entry) => entry.evidenceImage),
  ];
  if (!storedPaths.includes(`/uploads/${filename}`)) throw httpError('Report photo not found', 404);

  response.sendFile(path.join(uploadDirectory, filename), (error) => {
    if (error && !response.headersSent) response.status(404).json({ message: 'Report photo is unavailable' });
  });
});

export const createIssue = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw httpError('Report details are required', 400);
  }
  const { title, description, category, location } = request.body;
  if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 120) {
    throw httpError('Title must be between 5 and 120 characters', 400);
  }
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 3000) {
    throw httpError('Description must be between 10 and 3000 characters', 400);
  }

  const validCategories = ['Road', 'Streetlight', 'Garbage', 'Water', 'Drainage', 'Traffic', 'Other'];
  if (category && !validCategories.includes(category)) throw httpError('Choose a valid issue category', 400);

  const triage = suggestIssueDetails(title.trim(), description.trim(), category || '');
  const coordinates = parseLocation(location);
  const issue = new Issue({
    title: title.trim(),
    description: description.trim(),
    ...triage,
    location: coordinates,
    image: request.file ? `/uploads/${request.file.filename}` : '',
    reportedBy: request.user._id,
    status: 'AI Triaged',
  });
  issue.statusHistory.push({
    status: issue.status,
    event: 'status-update',
    note: 'Report submitted and triaged.',
    updatedBy: request.user._id,
  });

  const nearbyDuplicate = await Issue.findOne({
    _id: { $ne: issue._id },
    category: triage.category,
    'location.latitude': { $gte: coordinates.latitude - 0.001, $lte: coordinates.latitude + 0.001 },
    'location.longitude': { $gte: coordinates.longitude - 0.001, $lte: coordinates.longitude + 0.001 },
  }).sort({ createdAt: -1 });
  if (nearbyDuplicate) {
    issue.duplicateOf = nearbyDuplicate._id;
    issue.aiReason += ' A nearby report in this category may be a duplicate.';
  }
  await issue.save();

  response.status(201).json({ issue });
});

export const updateIssueStatus = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw httpError('Choose a valid report status', 400);
  }
  const { status } = request.body;
  if (!allowedStatuses.includes(status)) throw httpError('Choose a valid report status', 400);
  const issue = await Issue.findById(request.params.id);
  if (!issue) throw httpError('Report not found', 404);

  if (request.user.role === 'officer' && issue.assignedOfficer?.toString() !== request.user.id) {
    throw httpError('You can only update reports assigned to you', 403);
  }
  if (request.user.role === 'officer' && !['In Progress', 'Resolved'].includes(status)) {
    throw httpError('Officers can move assigned reports to In Progress or Resolved', 400);
  }
  const note = request.body.note === undefined ? '' : request.body.note;
  if (typeof note !== 'string' || note.length > 1000) throw httpError('Update notes must be 1000 characters or fewer', 400);
  if (issue.status !== status || note.trim()) {
    issue.statusHistory.push({
      status,
      note: note.trim(),
      updatedBy: request.user._id,
    });
  }
  issue.status = status;
  issue.resolvedAt = status === 'Resolved' ? new Date() : null;
  await issue.save();
  response.json({ issue });
});

export const verifyIssue = asyncHandler(async (request, response) => {
  const issue = await Issue.findById(request.params.id);
  if (!issue) throw httpError('Report not found', 404);
  if (issue.reportedBy.toString() !== request.user.id) throw httpError('You can only verify your own report', 403);
  if (issue.status !== 'Resolved') throw httpError('Only resolved reports can be verified', 400);
  issue.status = 'Verified';
  issue.statusHistory.push({
    status: 'Verified',
    event: 'resolution-confirmed',
    note: 'Citizen confirmed the resolution.',
    updatedBy: request.user._id,
  });
  await issue.save();
  response.json({ issue });
});

export const assignIssue = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw httpError('Choose a valid officer account', 400);
  }
  const { officerId } = request.body;
  if (!mongoose.isValidObjectId(officerId)) throw httpError('Choose a valid officer account', 400);
  const [issue, officer] = await Promise.all([
    Issue.findById(request.params.id),
    User.findOne({ _id: officerId, role: 'officer' }),
  ]);
  if (!issue) throw httpError('Report not found', 404);
  if (!officer) throw httpError('Officer account not found', 404);
  issue.assignedOfficer = officer._id;
  issue.status = 'Assigned';
  issue.statusHistory.push({
    status: 'Assigned',
    event: 'assigned',
    note: 'Report assigned to an officer.',
    updatedBy: request.user._id,
  });
  await issue.save();
  await issue.populate('assignedOfficer', 'name email');
  response.json({ issue });
});

export const getIssueSummary = asyncHandler(async (_request, response) => {
  const [total, byStatus, byCategory, recentIssues, escalationIssues, officers] = await Promise.all([
    Issue.countDocuments(),
    Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Issue.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Issue.find().populate('reportedBy', 'name').populate('assignedOfficer', 'name')
      .sort({ priorityScore: -1, createdAt: -1 }).limit(8),
    Issue.find({ 'escalationRequests.0': { $exists: true } })
      .populate('reportedBy', 'name')
      .populate('assignedOfficer', 'name')
      .sort({ updatedAt: -1 })
      .limit(50),
    User.find({ role: 'officer' }).select('name email').sort({ name: 1 }),
  ]);
  response.json({
    total,
    statuses: Object.fromEntries(byStatus.map(({ _id, count }) => [_id, count])),
    categories: byCategory.map(({ _id, count }) => ({ name: _id, count })),
    recentIssues,
    escalationIssues,
    officers,
  });
});
