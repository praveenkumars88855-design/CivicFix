import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { chat, getCases } from '../controllers/assistantController.js';
import { authMiddleware, requireRoles } from '../middleware/authMiddleware.js';

const router = Router();
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many assistant requests. Please try again in 15 minutes.' },
});

router.post('/public-chat', chatLimiter, (request, _response, next) => {
  request.publicAssistant = true;
  next();
}, chat);
router.use(authMiddleware, requireRoles('citizen'));
router.get('/cases', getCases);
router.post('/chat', chatLimiter, chat);

export default router;
