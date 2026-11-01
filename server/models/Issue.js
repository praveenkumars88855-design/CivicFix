import mongoose from 'mongoose';

const issueStatuses = ['Pending', 'AI Triaged', 'Assigned', 'In Progress', 'Reopened', 'Resolved', 'Verified'];

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, default: 'Other' },
    subcategory: { type: String, default: '' },
    image: { type: String, default: '' },
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      address: { type: String, default: '' },
    },
    severity: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
    },
    department: { type: String, default: 'General' },
    status: {
      type: String,
      enum: issueStatuses,
      default: 'Pending',
    },
    aiReason: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
    resolvedAt: { type: Date, default: null },
    statusHistory: [{
      status: { type: String, enum: issueStatuses, required: true },
      event: { type: String, enum: ['status-update', 'resolution-disputed', 'resolution-confirmed', 'assigned'], default: 'status-update' },
      note: { type: String, default: '', maxlength: 1000 },
      evidenceImage: { type: String, default: '' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date, default: Date.now },
    }],
    escalationRequests: [{
      stage: { type: String, enum: ['follow-up', 'escalation'], required: true },
      requestedAt: { type: Date, default: Date.now },
      message: { type: String, required: true, maxlength: 6000 },
      citizenConfirmedAt: { type: Date, default: Date.now },
      submissionStatus: { type: String, enum: ['recorded-in-app', 'submitted-externally'], default: 'recorded-in-app' },
      referenceNumber: { type: String, default: '', maxlength: 100 },
    }],
  },
  { timestamps: true },
);

issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ status: 1, priorityScore: -1, createdAt: -1 });

export default mongoose.model('Issue', issueSchema);
