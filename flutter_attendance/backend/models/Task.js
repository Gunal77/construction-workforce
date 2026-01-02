/**
 * Task Model
 * Migrates: worker_tasks
 * 
 * MongoDB document-based design
 */
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    project_id: {
      type: String,
      ref: 'Project',
      required: true,
    },
    worker_id: {
      type: String,
      ref: 'Employee',
      required: true,
    },
    supervisor_id: {
      type: String,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'delayed'],
      default: 'pending',
    },
    due_date: Date,
    assigned_at: {
      type: Date,
      default: Date.now,
    },
    completed_at: Date,
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
    collection: 'tasks',
  }
);

// Indexes
taskSchema.index({ project_id: 1 });
taskSchema.index({ worker_id: 1 });
taskSchema.index({ supervisor_id: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ due_date: 1 });
taskSchema.index({ project_id: 1, worker_id: 1 });

// Transform to JSON
taskSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;

