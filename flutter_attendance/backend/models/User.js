const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      required: true,
      enum: ['ADMIN', 'SUPERVISOR', 'WORKER', 'CLIENT'],
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'users',
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    // For async hooks, if next is provided, call it; otherwise just return
    if (next && typeof next === 'function') {
      return next();
    }
    return;
  }

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // For async hooks, if next is provided, call it; otherwise just return
    if (next && typeof next === 'function') {
      return next();
    }
    return;
  } catch (error) {
    // For async hooks, if next is provided, call it with error; otherwise throw
    if (next && typeof next === 'function') {
      return next(error);
    }
    throw error;
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Transform to JSON - exclude password
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never return password
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;

