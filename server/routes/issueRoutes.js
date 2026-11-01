import { Router } from 'express';
import {
  assignIssue,
  createIssue,
  getIssueSummary,
  getIssuePhoto,
  listIssues,
  updateIssueStatus,
  verifyIssue,
} from '../controllers/issueController.js';
import { createEscalationRequest, getEscalationDraft, recordExternalReference } from '../controllers/escalationController.js';
import { requestResolutionReview } from '../controllers/resolutionController.js';
import { authMiddleware, requireRoles } from '../middleware/authMiddleware.js';
import { cleanUploadedFile, uploadIssuePhoto } from '../middleware/uploadMiddleware.js';
import { validateImageFile } from '../middleware/validateImageMiddleware.js';

const router = Router();
router.use(authMiddleware);
router.get('/', listIssues);
router.get('/summary', requireRoles('admin'), getIssueSummary);
router.get('/:id/photos/:filename', getIssuePhoto);
router.post('/', requireRoles('citizen'), uploadIssuePhoto.single('photo'), validateImageFile, createIssue);
router.patch('/:id/status', requireRoles('admin', 'officer'), updateIssueStatus);
router.patch('/:id/assign', requireRoles('admin'), assignIssue);
router.patch('/:id/verify', requireRoles('citizen'), verifyIssue);
router.post('/:id/reopen', requireRoles('citizen'), uploadIssuePhoto.single('photo'), validateImageFile, requestResolutionReview);
router.post('/:id/escalations/draft', requireRoles('citizen'), getEscalationDraft);
router.post('/:id/escalations', requireRoles('citizen'), createEscalationRequest);
router.patch('/:id/escalations/:requestId/reference', requireRoles('citizen'), recordExternalReference);
router.use(cleanUploadedFile);

export default router;
