/**
 * Merged Leave Model
 * Combines: leave_requests, leave_balances, leave_types
 * 
 * MongoDB document-based design with embedded leave types and balances
 */
const mongoose = require('mongoose');

// Embedded schema for leave types
const leaveTypeSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
  requires_approval: {
    type: Boolean,
    default: true,
  },
  max_days_per_year: Number,
  auto_reset_annually: {
    type: Boolean,
    default: false,
  },
  created_at: Date,
}, { _id: false });

// Embedded schema for leave balances
const leaveBalanceSchema = new mongoose.Schema({
  leave_type_id: {
    type: String,
    required: true,
  },
  leave_type_code: String,
  year: {
    type: Number,
    required: true,
  },
  total_days: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  used_days: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  remaining_days: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  last_reset_date: Date,
  created_at: Date,
  updated_at: Date,
}, { _id: false });

const leaveRequestSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    employee_id: {
      type: String,
      ref: 'Employee',
      required: true,
    },
    leave_type_id: {
      type: String,
      required: true,
    },
    // Embedded leave type information
    leave_type: {
      name: String,
      code: String,
      description: String,
    },
    project_id: {
      type: String,
      ref: 'Project',
      default: null,
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
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approved_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    approved_at: Date,
    rejection_reason: String,
    mc_document_url: String,
    stand_in_employee_id: {
      type: String,
      ref: 'Employee',
      default: null,
    },
    // Metadata
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
    collection: 'leaves',
  }
);

// Separate collection for leave types (reference data)
const leaveTypeCollectionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    description: String,
    requires_approval: {
      type: Boolean,
      default: true,
    },
    max_days_per_year: Number,
    auto_reset_annually: {
      type: Boolean,
      default: false,
    },
    created_at: Date,
  },
  {
    _id: false,
    collection: 'leave_types',
  }
);

// Separate collection for leave balances (per employee per year)
const leaveBalanceCollectionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    employee_id: {
      type: String,
      ref: 'Employee',
      required: true,
    },
    leave_type_id: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    total_days: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    used_days: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    remaining_days: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    last_reset_date: Date,
    created_at: Date,
    updated_at: Date,
  },
  {
    _id: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'leave_balances',
  }
);

// Indexes for leave requests
leaveRequestSchema.index({ employee_id: 1 });
leaveRequestSchema.index({ leave_type_id: 1 });
leaveRequestSchema.index({ status: 1 });
leaveRequestSchema.index({ start_date: 1, end_date: 1 });
leaveRequestSchema.index({ created_at: 1 });

// Indexes for leave balances
leaveBalanceCollectionSchema.index({ employee_id: 1, leave_type_id: 1, year: 1 }, { unique: true });
leaveBalanceCollectionSchema.index({ employee_id: 1, year: 1 });

// Indexes for leave types
leaveTypeCollectionSchema.index({ code: 1 }, { unique: true });

// Transform to JSON
leaveRequestSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    if (ret.number_of_days) ret.number_of_days = parseFloat(ret.number_of_days.toString());
    
    return ret;
  },
});

leaveBalanceCollectionSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    if (ret.total_days) ret.total_days = parseFloat(ret.total_days.toString());
    if (ret.used_days) ret.used_days = parseFloat(ret.used_days.toString());
    if (ret.remaining_days) ret.remaining_days = parseFloat(ret.remaining_days.toString());
    
    return ret;
  },
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
const LeaveType = mongoose.model('LeaveType', leaveTypeCollectionSchema);
const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceCollectionSchema);

module.exports = {
  LeaveRequest,
  LeaveType,
  LeaveBalance,
};

