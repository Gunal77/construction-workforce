const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
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
    location: {
      type: String,
      trim: true,
      default: null,
    },
    start_date: {
      type: Date,
      default: null,
    },
    end_date: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    budget: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false, // Use custom _id (UUID from Supabase)
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'projects',
  }
);

// Indexes
projectSchema.index({ name: 1 });
projectSchema.index({ location: 1 });
projectSchema.index({ start_date: 1, end_date: 1 });

// Virtual for isActive (computed property)
projectSchema.virtual('isActive').get(function () {
  const now = new Date();
  if (this.start_date && now < this.start_date) return false;
  if (this.end_date && now > this.end_date) return false;
  return true;
});

// Transform to match Supabase format (convert _id to id, Decimal128 to Number)
projectSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number for budget
    if (ret.budget) ret.budget = parseFloat(ret.budget.toString());
    
    // Add isActive virtual
    ret.isActive = doc.isActive;
    
    return ret;
  },
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

