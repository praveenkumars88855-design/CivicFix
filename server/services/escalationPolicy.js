const unresolvedStatuses = ['Pending', 'AI Triaged', 'Assigned', 'In Progress', 'Reopened'];

function readDays(environmentName, fallback) {
  const value = process.env[environmentName];
  if (value === undefined || value === '') return fallback;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error(`${environmentName} must be a whole number between 1 and 365`);
  }
  return days;
}

export function getEscalationThresholds() {
  const followUpDays = readDays('FOLLOW_UP_DAYS', 15);
  const escalationDays = readDays('ESCALATION_DAYS', 30);
  if (escalationDays <= followUpDays) {
    throw new Error('ESCALATION_DAYS must be greater than FOLLOW_UP_DAYS');
  }
  return { followUpDays, escalationDays };
}

export function getEligibleEscalationStage(issue, now = new Date()) {
  if (!unresolvedStatuses.includes(issue.status)) return null;
  const { followUpDays, escalationDays } = getEscalationThresholds();
  const ageInDays = Math.max(0, Math.floor((now.getTime() - new Date(issue.createdAt).getTime()) / 86_400_000));
  const latestUpdate = issue.statusHistory?.at(-1);
  const latestUpdateAt = latestUpdate?.updatedAt || issue.createdAt;
  const daysSinceLastUpdate = Math.max(0, Math.floor((now.getTime() - new Date(latestUpdateAt).getTime()) / 86_400_000));
  if (ageInDays >= escalationDays && daysSinceLastUpdate >= escalationDays) {
    return { stage: 'escalation', ageInDays, daysSinceLastUpdate, latestUpdateAt };
  }
  if (ageInDays >= followUpDays && daysSinceLastUpdate >= followUpDays) {
    return { stage: 'follow-up', ageInDays, daysSinceLastUpdate, latestUpdateAt };
  }
  return null;
}

export function createEscalationMessage(issue, stage, ageInDays, daysSinceLastUpdate = ageInDays) {
  const action = stage === 'escalation'
    ? 'Please review this unresolved report as a higher-level follow-up.'
    : 'Please review this report and provide a status update.';
  return [
    `Subject: ${stage === 'escalation' ? 'Escalation request' : 'Follow-up request'} for CivicFix report ${issue._id}`,
    '',
    'Dear Sir/Madam,',
    '',
    `I am writing to request an update regarding CivicFix report ${issue._id}, concerning "${issue.title}".`,
    '',
    `Issue details: ${issue.description}`,
    `Category: ${issue.category}`,
    `Responsible department recorded by CivicFix: ${issue.department}`,
    `Reported on: ${new Date(issue.createdAt).toLocaleDateString('en-IN', { timeZone: 'UTC' })} (${ageInDays} days ago)`,
    `Location: ${issue.location?.address || 'Address not provided'}${issue.location?.latitude != null ? ` (${issue.location.latitude}, ${issue.location.longitude})` : ''}`,
    `Current CivicFix status: ${issue.status}`,
    '',
    'Previous updates and follow-up history:',
    ...(issue.statusHistory || []).slice(-10).map((update) => (
      `- ${new Date(update.updatedAt).toLocaleDateString('en-IN', { timeZone: 'UTC' })}: ${update.status}${update.note ? ` — ${update.note.slice(0, 180)}` : ''}`
    )),
    ...(issue.escalationRequests || []).map((request) => (
      `- ${new Date(request.requestedAt).toLocaleDateString('en-IN', { timeZone: 'UTC' })}: CivicFix ${request.stage} request recorded`
    )),
    `Days since latest recorded status update: ${daysSinceLastUpdate}`,
    '',
    action,
    'Please let me know the appropriate next steps. Thank you for your time.',
    '',
    'Sincerely,',
    'CivicFix citizen',
    '',
    'Draft only. CivicFix has not submitted this letter to an external authority.',
  ].join('\n');
}
