/**
 * Merged Project Model
 * Combines: projects, clients, project_employees, supervisor_projects
 * 
 * MongoDB document-based design with embedded relationships
 */
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
    // Embedded: Client information (from clients table)
    client: {
      client_id: {
        type: String,
        ref: 'Client',
      },
      client_name: String,
      client_email: String,
      client_phone: String,
      client_address: String,
      contact_person: String,
    },
    // Embedded: Assigned employees (from project_employees)
    assigned_employees: [{
      employee_id: {
        type: String,
        ref: 'Employee',
      },
      employee_name: String,
      employee_email: String,
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
    // Embedded: Assigned supervisors (from supervisor_projects)
    assigned_supervisors: [{
      supervisor_id: {
        type: String,
        ref: 'User',
      },
      supervisor_name: String,
      supervisor_email: String,
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
    collection: 'projects',
  }
);

// Indexes
projectSchema.index({ name: 1 });
projectSchema.index({ 'client.client_id': 1 });
projectSchema.index({ 'assigned_employees.employee_id': 1 });
projectSchema.index({ 'assigned_supervisors.supervisor_id': 1 });
projectSchema.index({ start_date: 1, end_date: 1 });

// Virtual for isActive
projectSchema.virtual('isActive').get(function () {
  const now = new Date();
  if (this.start_date && now < this.start_date) return false;
  if (this.end_date && now > this.end_date) return false;
  return true;
});

// Transform to JSON
projectSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    if (ret.budget) ret.budget = parseFloat(ret.budget.toString());
    ret.isActive = doc.isActive;
    
    return ret;
  },
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

