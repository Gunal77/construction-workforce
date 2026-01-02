/**
 * Merged Employee Model
 * Combines: employees, staffs, worker_supervisor
 * 
 * MongoDB document-based design with embedded relationships
 */
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
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
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    // Payment information
    payment_type: {
      type: String,
      enum: ['hourly', 'daily', 'monthly', 'contract'],
      default: null,
    },
    hourly_rate: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    daily_rate: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    monthly_rate: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    contract_rate: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    // Embedded: Project assignments (from project_employees)
    project_assignments: [{
      project_id: {
        type: String,
        ref: 'Project',
      },
      assigned_at: Date,
      assignment_start_date: Date,
      assignment_end_date: Date,
      status: {
        type: String,
        enum: ['active', 'revoked'],
        default: 'active',
      },
      notes: String,
    }],
    // Embedded: Supervisor relationships (from worker_supervisor)
    supervisors: [{
      supervisor_id: {
        type: String,
        ref: 'User',
      },
      assigned_at: Date,
      status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
      },
    }],
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
    collection: 'employees',
  }
);

// Indexes
employeeSchema.index({ email: 1 }, { unique: true, sparse: true });
employeeSchema.index({ 'project_assignments.project_id': 1 });
employeeSchema.index({ 'supervisors.supervisor_id': 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ payment_type: 1 });

// Transform to JSON
employeeSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number
    if (ret.hourly_rate) ret.hourly_rate = parseFloat(ret.hourly_rate.toString());
    if (ret.daily_rate) ret.daily_rate = parseFloat(ret.daily_rate.toString());
    if (ret.monthly_rate) ret.monthly_rate = parseFloat(ret.monthly_rate.toString());
    if (ret.contract_rate) ret.contract_rate = parseFloat(ret.contract_rate.toString());
    
    return ret;
  },
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;

