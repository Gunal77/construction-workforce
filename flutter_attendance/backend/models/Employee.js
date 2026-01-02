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
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      // Index is defined below, don't use index: true here
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    project_id: {
      type: String,
      ref: 'Project',
      default: null,
    },
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
// Note: email index is automatically created by unique: true in schema
employeeSchema.index({ project_id: 1 });
employeeSchema.index({ payment_type: 1 });
employeeSchema.index({ status: 1 });

// Transform to match Supabase format (convert _id to id, Decimal128 to Number)
employeeSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number for rates
    if (ret.hourly_rate) ret.hourly_rate = parseFloat(ret.hourly_rate.toString());
    if (ret.daily_rate) ret.daily_rate = parseFloat(ret.daily_rate.toString());
    if (ret.monthly_rate) ret.monthly_rate = parseFloat(ret.monthly_rate.toString());
    if (ret.contract_rate) ret.contract_rate = parseFloat(ret.contract_rate.toString());
    
    return ret;
  },
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;

