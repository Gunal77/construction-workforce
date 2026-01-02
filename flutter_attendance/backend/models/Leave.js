const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    employee_id: {
      type: String,
      required: true,
      ref: 'Employee',
    },
    leave_type_id: {
      type: String,
      required: true,
      ref: 'LeaveType',
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    number_of_days: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approved_by: {
      type: String,
      ref: 'Admin',
      default: null,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    rejection_reason: {
      type: String,
      default: null,
    },
    project_id: {
      type: String,
      ref: 'Project',
      default: null,
    },
    mc_document_url: {
      type: String,
      default: null,
    },
    stand_in_employee_id: {
      type: String,
      ref: 'Employee',
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'leave_requests',
  }
);

// Indexes
leaveRequestSchema.index({ employee_id: 1, status: 1 });
leaveRequestSchema.index({ leave_type_id: 1 });
leaveRequestSchema.index({ start_date: 1, end_date: 1 });
leaveRequestSchema.index({ status: 1, created_at: -1 });
leaveRequestSchema.index({ project_id: 1 });
leaveRequestSchema.index({ stand_in_employee_id: 1 });
leaveRequestSchema.index({ created_at: -1 });

// Validation: end_date must be >= start_date
leaveRequestSchema.pre('save', function (next) {
  if (this.end_date < this.start_date) {
    return next(new Error('end_date must be greater than or equal to start_date'));
  }
  next();
});

// Transform to match Supabase format (convert _id to id, Decimal128 to Number)
leaveRequestSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number for number_of_days
    if (ret.number_of_days) ret.number_of_days = parseFloat(ret.number_of_days.toString());
    
    return ret;
  },
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

module.exports = LeaveRequest;

