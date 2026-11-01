import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['citizen', 'admin', 'officer'], default: 'citizen' },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(_document, result) {
    delete result.password;
    delete result.__v;
    return result;
  },
});

export default mongoose.model('User', userSchema);
