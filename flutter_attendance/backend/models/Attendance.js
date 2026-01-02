const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
      ref: 'User',
    },
    check_in_time: {
      type: Date,
      required: true,
    },
    check_out_time: {
      type: Date,
      default: null,
    },
    image_url: {
      type: String,
      default: null,
    },
    latitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    longitude: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    checkout_image_url: {
      type: String,
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
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'attendance_logs',
  }
);

// Indexes
attendanceSchema.index({ user_id: 1, check_out_time: 1 });
attendanceSchema.index({ check_in_time: 1 });
attendanceSchema.index({ check_out_time: 1 });

// Transform to match Supabase format (convert _id to id, Decimal128 to Number)
attendanceSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert Decimal128 to Number for coordinates
    if (ret.latitude) ret.latitude = parseFloat(ret.latitude.toString());
    if (ret.longitude) ret.longitude = parseFloat(ret.longitude.toString());
    if (ret.checkout_latitude) ret.checkout_latitude = parseFloat(ret.checkout_latitude.toString());
    if (ret.checkout_longitude) ret.checkout_longitude = parseFloat(ret.checkout_longitude.toString());
    
    return ret;
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;

