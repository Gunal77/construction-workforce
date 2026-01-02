const mongoose = require('mongoose');

const timesheetSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    staff_id: {
      type: String,
      required: true,
      ref: 'EmployeeMerged',
    },
    work_date: {
      type: Date,
      required: true,
    },
    check_in: {
      type: Date,
      required: true,
    },
    check_out: {
      type: Date,
      default: null,
    },
    total_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    overtime_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    project_id: {
      type: String,
      ref: 'ProjectMerged',
      default: null,
    },
    task_type: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Half-Day'],
      default: 'Present',
    },
    approval_status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
      default: 'Draft',
    },
    ot_approval_status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: null,
    },
    remarks: {
      type: String,
      default: null,
    },
    ot_justification: {
      type: String,
      default: null,
    },
    approved_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    ot_approved_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    ot_approved_at: {
      type: Date,
      default: null,
    },
    created_by: {
      type: String,
      ref: 'User',
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
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'timesheets',
  }
);

// Indexes
timesheetSchema.index({ staff_id: 1 });
timesheetSchema.index({ work_date: 1 });
timesheetSchema.index({ project_id: 1 });
timesheetSchema.index({ approval_status: 1 });
timesheetSchema.index({ ot_approval_status: 1 });
timesheetSchema.index({ staff_id: 1, work_date: 1 }, { unique: true });

// Transform to JSON
timesheetSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to number
    if (ret.total_hours) ret.total_hours = parseFloat(ret.total_hours.toString());
    if (ret.overtime_hours) ret.overtime_hours = parseFloat(ret.overtime_hours.toString());
    
    return ret;
  },
});

const Timesheet = mongoose.model('Timesheet', timesheetSchema);

module.exports = Timesheet;

