import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:promote -- user@example.com');
  process.exitCode = 1;
} else {
  try {
    await connectDB();
    const user = await User.findOneAndUpdate(
      { email },
      { role: 'admin' },
      { new: true, runValidators: true },
    );
    if (!user) {
      console.error('No account found for that email. Register the account before promoting it.');
      process.exitCode = 1;
    } else {
      console.log(`Administrator access granted to ${user.email}.`);
    }
  } catch (error) {
    console.error('Could not promote the account:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
