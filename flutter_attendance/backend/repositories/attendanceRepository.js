const Attendance = require('../models/AttendanceMerged');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class AttendanceRepository {
  async findById(id) {
    const attendance = await Attendance.findById(id);
    return attendance ? attendance.toJSON() : null;
  }

  async findByUserId(userId, options = {}) {
    const query = Attendance.find({ user_id: userId });
    
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      query.sort({ [field]: direction === 'asc' ? 1 : -1 });
    } else {
      query.sort({ check_in_time: -1 });
    }
    
    if (options.limit) {
      query.limit(options.limit);
    }
    
    const records = await query.exec();
    return records.map(record => record.toJSON());
  }

  async findActiveByUserId(userId) {
    const attendance = await Attendance.findOne({
      user_id: userId,
      check_out_time: null,
    }).sort({ check_in_time: -1 });
    return attendance ? attendance.toJSON() : null;
  }

  async create(attendanceData) {
    const id = attendanceData.id || uuidv4();
    const attendance = new Attendance({
      _id: id,
      ...attendanceData,
      latitude: attendanceData.latitude ? mongoose.Types.Decimal128.fromString(attendanceData.latitude.toString()) : null,
      longitude: attendanceData.longitude ? mongoose.Types.Decimal128.fromString(attendanceData.longitude.toString()) : null,
      checkout_latitude: attendanceData.checkout_latitude ? mongoose.Types.Decimal128.fromString(attendanceData.checkout_latitude.toString()) : null,
      checkout_longitude: attendanceData.checkout_longitude ? mongoose.Types.Decimal128.fromString(attendanceData.checkout_longitude.toString()) : null,
    });
    await attendance.save();
    return attendance.toJSON();
  }

  async update(id, updateData) {
    // Convert coordinate fields to Decimal128 if they exist
    const mongoUpdateData = { ...updateData };
    if (mongoUpdateData.latitude !== undefined && mongoUpdateData.latitude !== null) {
      mongoUpdateData.latitude = mongoose.Types.Decimal128.fromString(mongoUpdateData.latitude.toString());
    }
    if (mongoUpdateData.longitude !== undefined && mongoUpdateData.longitude !== null) {
      mongoUpdateData.longitude = mongoose.Types.Decimal128.fromString(mongoUpdateData.longitude.toString());
    }
    if (mongoUpdateData.checkout_latitude !== undefined && mongoUpdateData.checkout_latitude !== null) {
      mongoUpdateData.checkout_latitude = mongoose.Types.Decimal128.fromString(mongoUpdateData.checkout_latitude.toString());
    }
    if (mongoUpdateData.checkout_longitude !== undefined && mongoUpdateData.checkout_longitude !== null) {
      mongoUpdateData.checkout_longitude = mongoose.Types.Decimal128.fromString(mongoUpdateData.checkout_longitude.toString());
    }
    
    const attendance = await Attendance.findByIdAndUpdate(id, mongoUpdateData, { new: true });
    if (!attendance) return null;
    return attendance.toJSON();
  }

  async findAll(filters = {}) {
    const query = {};
    
    if (filters.userId) {
      query.user_id = filters.userId;
    }
    if (filters.startDate) {
      query.check_in_time = { ...query.check_in_time, $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      query.check_in_time = { ...query.check_in_time, $lte: new Date(filters.endDate) };
    }
    
    const attendances = await Attendance.find(query)
      .sort({ check_in_time: -1 })
      .limit(filters.limit || 100);
    
    return attendances.map(att => att.toJSON());
  }
}

module.exports = new AttendanceRepository();
