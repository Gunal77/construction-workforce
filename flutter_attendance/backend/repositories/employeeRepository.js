const Employee = require('../models/EmployeeMerged');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class EmployeeRepository {
  async findAll(options = {}) {
    const query = Employee.find();
    
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query.sort({ [field]: direction === 'asc' ? 1 : -1 });
    }
    
    const employees = await query.exec();
    return employees.map(emp => emp.toJSON());
  }

  async findById(id) {
    const employee = await Employee.findById(id);
    return employee ? employee.toJSON() : null;
  }

  async findByEmail(email) {
    const employee = await Employee.findOne({ email: email?.toLowerCase() });
    return employee ? employee.toJSON() : null;
  }

  async create(employeeData) {
    const id = employeeData.id || uuidv4();
    const employee = new Employee({
      _id: id,
      ...employeeData,
      email: employeeData.email?.toLowerCase(),
    });
    await employee.save();
    return employee.toJSON();
  }

  async update(id, updateData) {
    // Convert rate fields to Decimal128 if they exist
    const mongoUpdateData = { ...updateData };
    if (mongoUpdateData.hourly_rate !== undefined && mongoUpdateData.hourly_rate !== null) {
      mongoUpdateData.hourly_rate = mongoose.Types.Decimal128.fromString(mongoUpdateData.hourly_rate.toString());
    }
    if (mongoUpdateData.daily_rate !== undefined && mongoUpdateData.daily_rate !== null) {
      mongoUpdateData.daily_rate = mongoose.Types.Decimal128.fromString(mongoUpdateData.daily_rate.toString());
    }
    if (mongoUpdateData.monthly_rate !== undefined && mongoUpdateData.monthly_rate !== null) {
      mongoUpdateData.monthly_rate = mongoose.Types.Decimal128.fromString(mongoUpdateData.monthly_rate.toString());
    }
    if (mongoUpdateData.contract_rate !== undefined && mongoUpdateData.contract_rate !== null) {
      mongoUpdateData.contract_rate = mongoose.Types.Decimal128.fromString(mongoUpdateData.contract_rate.toString());
    }
    
    if (mongoUpdateData.email) {
      mongoUpdateData.email = mongoUpdateData.email.toLowerCase();
    }
    
    const employee = await Employee.findByIdAndUpdate(id, mongoUpdateData, { new: true });
    if (!employee) return null;
    return employee.toJSON();
  }

  async delete(id) {
    const result = await Employee.findByIdAndDelete(id);
    return result !== null;
  }
}

module.exports = new EmployeeRepository();
