import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('CivicFix server failed to start: set JWT_SECRET to a private value of at least 32 characters.');
  process.exitCode = 1;
} else {
  try {
    await connectDB();
    app.listen(port, () => console.log(`CivicFix server running on port ${port}`));
  } catch (error) {
    console.error('CivicFix server failed to start:', error.message);
    process.exitCode = 1;
  }
}
