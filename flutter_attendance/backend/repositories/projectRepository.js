const Project = require('../models/ProjectMerged');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class ProjectRepository {
  async findAll(options = {}) {
    const query = Project.find();
    
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query.sort({ [field]: direction === 'asc' ? 1 : -1 });
    }
    
    const projects = await query.exec();
    return projects.map(proj => proj.toJSON());
  }

  async findById(id) {
    const project = await Project.findById(id);
    return project ? project.toJSON() : null;
  }

  async create(projectData) {
    const id = projectData.id || uuidv4();
    const project = new Project({
      _id: id,
      ...projectData,
    });
    await project.save();
    return project.toJSON();
  }

  async update(id, updateData) {
    // Convert budget to Decimal128 if it exists
    const mongoUpdateData = { ...updateData };
    if (mongoUpdateData.budget !== undefined && mongoUpdateData.budget !== null) {
      mongoUpdateData.budget = mongoose.Types.Decimal128.fromString(mongoUpdateData.budget.toString());
    }
    
    const project = await Project.findByIdAndUpdate(id, mongoUpdateData, { new: true });
    if (!project) return null;
    return project.toJSON();
  }

  async delete(id) {
    const result = await Project.findByIdAndDelete(id);
    return result !== null;
  }
}

module.exports = new ProjectRepository();
