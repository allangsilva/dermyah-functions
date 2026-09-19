const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    versionNumber: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['ANDROID', 'IOS'],
      required: true,
    },
    active: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: true,
    collection: "appVersion"
  }
);



module.exports = mongoose.model('appVersion', UserSchema);
