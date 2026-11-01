import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createToken } from '../middleware/authMiddleware.js';

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    const error = new Error('Account details are required');
    error.status = 400;
    throw error;
  }
  const { name, email, password, phone } = request.body;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    const error = new Error('Name must be between 2 and 80 characters');
    error.status = 400;
    throw error;
  }
  if (typeof email !== 'string' || email.trim().length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    const error = new Error('Enter a valid email address');
    error.status = 400;
    throw error;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    const error = new Error('Password must be between 8 and 128 characters');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.exists({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('An account with that email already exists');
    error.status = 409;
    throw error;
  }

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const role = configuredAdminEmail && normalizedEmail === configuredAdminEmail ? 'admin' : 'citizen';
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    phone: typeof phone === 'string' ? phone.trim().slice(0, 30) : '',
    role,
  });

  response.status(201).json({ token: createToken(user), user: publicUser(user) });
});

export const login = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    const error = new Error('Email and password are required');
    error.status = 400;
    throw error;
  }
  const { email, password } = request.body;
  if (typeof email !== 'string' || email.length > 254
      || typeof password !== 'string' || password.length > 128) {
    const error = new Error('Email and password are required');
    error.status = 400;
    throw error;
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    const error = new Error('Email or password is incorrect');
    error.status = 401;
    throw error;
  }

  response.json({ token: createToken(user), user: publicUser(user) });
});

export const getCurrentUser = asyncHandler(async (request, response) => {
  response.json({ user: publicUser(request.user) });
});

export const listUsers = asyncHandler(async (_request, response) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(200);
  response.json({ users: users.map(publicUser) });
});

export const updateUserRole = asyncHandler(async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    const error = new Error('Choose a valid account role');
    error.status = 400;
    throw error;
  }
  const { role } = request.body;
  if (!['citizen', 'officer', 'admin'].includes(role)) {
    const error = new Error('Choose a valid account role');
    error.status = 400;
    throw error;
  }
  if (request.params.id === request.user.id && role !== 'admin') {
    const error = new Error('You cannot remove your own administrator access');
    error.status = 400;
    throw error;
  }
  const user = await User.findByIdAndUpdate(request.params.id, { role }, { new: true, runValidators: true });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  response.json({ user: publicUser(user) });
});
