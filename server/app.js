import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

const app = express();
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('This website origin is not allowed to access the API'));
  },
}));
app.use(express.json({ limit: '100kb' }));
app.get('/', (_request, response) => response.json({
  message: 'CivicFix API is running successfully',
  status: 'success',
}));
app.get('/api/health', (_request, response) => response.json({
  message: 'CivicFix backend is healthy',
  status: 'success',
}));
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/assistant', assistantRoutes);
app.use(errorMiddleware);

export default app;
