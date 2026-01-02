const mongoose = require('mongoose');

const monthlySummarySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    employee_id: {
      type: String,
      required: true,
      ref: 'EmployeeMerged',
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2100,
    },
    // Summary Metrics
    total_working_days: {
      type: Number,
      default: 0,
    },
    total_worked_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    total_ot_hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    approved_leaves: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    absent_days: {
      type: Number,
      default: 0,
    },
    // Project-wise breakdown (stored as JSON array)
    project_breakdown: {
      type: [{
        project_id: String,
        project_name: String,
        days_worked: Number,
        total_hours: mongoose.Schema.Types.Decimal128,
        ot_hours: mongoose.Schema.Types.Decimal128,
      }],
      default: [],
    },
    // Status workflow: DRAFT -> SIGNED_BY_STAFF -> APPROVED/REJECTED
    status: {
      type: String,
      enum: ['DRAFT', 'SIGNED_BY_STAFF', 'APPROVED', 'REJECTED'],
      default: 'DRAFT',
    },
    // Staff Sign-off
    staff_signature: {
      type: String, // Base64 encoded signature image
      default: null,
    },
    staff_signed_at: {
      type: Date,
      default: null,
    },
    staff_signed_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    // Admin Approval
    admin_signature: {
      type: String, // Base64 encoded signature image
      default: null,
    },
    admin_approved_at: {
      type: Date,
      default: null,
    },
    admin_approved_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    admin_remarks: {
      type: String,
      default: null,
    },
    // Financial fields (admin-only)
    subtotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    payment_type: {
      type: String,
      enum: ['hourly', 'daily', 'monthly', 'contract'],
      default: null,
    },
    tax_percentage: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    tax_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    total_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    invoice_number: {
      type: String,
      default: null,
    },
    // Audit Trail
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
    collection: 'monthly_summaries',
  }
);

// Indexes
monthlySummarySchema.index({ employee_id: 1 });
monthlySummarySchema.index({ month: 1, year: 1 });
monthlySummarySchema.index({ status: 1 });
monthlySummarySchema.index({ employee_id: 1, month: 1, year: 1 }, { unique: true });
monthlySummarySchema.index({ invoice_number: 1 });
monthlySummarySchema.index({ month: 1, year: 1, invoice_number: 1 });

// Transform to JSON
monthlySummarySchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to number
    if (ret.total_worked_hours) ret.total_worked_hours = parseFloat(ret.total_worked_hours.toString());
    if (ret.total_ot_hours) ret.total_ot_hours = parseFloat(ret.total_ot_hours.toString());
    if (ret.approved_leaves) ret.approved_leaves = parseFloat(ret.approved_leaves.toString());
    if (ret.subtotal) ret.subtotal = parseFloat(ret.subtotal.toString());
    if (ret.tax_percentage) ret.tax_percentage = parseFloat(ret.tax_percentage.toString());
    if (ret.tax_amount) ret.tax_amount = parseFloat(ret.tax_amount.toString());
    if (ret.total_amount) ret.total_amount = parseFloat(ret.total_amount.toString());
    
    // Convert project_breakdown Decimal128 fields
    if (ret.project_breakdown && Array.isArray(ret.project_breakdown)) {
      ret.project_breakdown = ret.project_breakdown.map(proj => ({
        ...proj,
        total_hours: proj.total_hours ? parseFloat(proj.total_hours.toString()) : 0,
        ot_hours: proj.ot_hours ? parseFloat(proj.ot_hours.toString()) : 0,
      }));
    }
    
    return ret;
  },
});

const MonthlySummary = mongoose.model('MonthlySummary', monthlySummarySchema);

module.exports = MonthlySummary;

