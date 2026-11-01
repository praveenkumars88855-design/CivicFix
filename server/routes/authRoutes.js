import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getCurrentUser,
  listUsers,
  login,
  register,
  updateUserRole,
} from '../controllers/authController.js';
import { authMiddleware, requireRoles } from '../middleware/authMiddleware.js';

const router = Router();
const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

router.post('/register', authenticationLimiter, register);
router.post('/login', authenticationLimiter, login);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/users', authMiddleware, requireRoles('admin'), listUsers);
router.patch('/users/:id/role', authMiddleware, requireRoles('admin'), updateUserRole);

export default router;
