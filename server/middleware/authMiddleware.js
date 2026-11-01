import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from './asyncHandler.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export const authMiddleware = asyncHandler(async (request, _response, next) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  const secret = getJwtSecret();
  let payload;
  try {
    payload = jwt.verify(authorization.slice(7), secret, { algorithms: ['HS256'] });
  } catch {
    const error = new Error('Invalid or expired session. Please sign in again.');
    error.status = 401;
    throw error;
  }

  const user = await User.findById(payload.sub).select('-password');
  if (!user) {
    const error = new Error('This account no longer exists');
    error.status = 401;
    throw error;
  }

  request.user = user;
  next();
});

export function requireRoles(...roles) {
  return (request, _response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      const error = new Error('You do not have permission to perform this action');
      error.status = 403;
      return next(error);
    }
    return next();
  };
}

export function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    getJwtSecret(),
    { expiresIn: '7d', algorithm: 'HS256' },
  );
}
