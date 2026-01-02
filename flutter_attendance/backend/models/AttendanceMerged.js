/**
 * Merged Attendance Model
 * Combines: attendance_logs, timesheets
 * 
 * MongoDB document-based design
 */
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    // User/Employee reference
    user_id: {
      type: String,
      ref: 'User',
      required: true,
    },
    staff_id: {
      type: String,
      ref: 'Employee',
      default: null,
    },
    // Date and time information
    work_date: {
      type: Date,
      required: true,
    },
    check_in_time: {
      type: Date,
      required: true,
    },
    check_in: {
      type: Date,
      default: null,
    },
    check_out_time: {
      type: Date,
      default: null,
    },
    check_out: {
      type: Date,
      default: null,
    },
    // Hours calculation
    total_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    overtime_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    // Location data
    latitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    longitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    checkout_latitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    checkout_longitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    // Image URLs
    image_url: {
      type: String,
      default: null,
    },
    checkout_image_url: {
      type: String,
      default: null,
    },
    // Project reference (from timesheets)
    project_id: {
      type: String,
      ref: 'Project',
      default: null,
    },
    // Timesheet-specific fields
    task_type: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Half-Day', 'pending'],
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
    collection: 'attendance',
  }
);

// Indexes
attendanceSchema.index({ user_id: 1 });
attendanceSchema.index({ staff_id: 1 });
attendanceSchema.index({ work_date: 1 });
attendanceSchema.index({ check_in_time: 1 });
attendanceSchema.index({ project_id: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ approval_status: 1 });
attendanceSchema.index({ user_id: 1, work_date: 1 }, { unique: true });

// Transform to JSON
attendanceSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number
    if (ret.total_hours) ret.total_hours = parseFloat(ret.total_hours.toString());
    if (ret.overtime_hours) ret.overtime_hours = parseFloat(ret.overtime_hours.toString());
    if (ret.latitude) ret.latitude = parseFloat(ret.latitude.toString());
    if (ret.longitude) ret.longitude = parseFloat(ret.longitude.toString());
    if (ret.checkout_latitude) ret.checkout_latitude = parseFloat(ret.checkout_latitude.toString());
    if (ret.checkout_longitude) ret.checkout_longitude = parseFloat(ret.checkout_longitude.toString());
    
    return ret;
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;

