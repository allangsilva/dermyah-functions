const mongoose = require('mongoose');

const UserBackupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    admin: {
      type: Boolean,
      required: true,
      default: false
    },
    email: {
      type: String,
      required: true,
    },
    config: {
      type: Object,
      required: true,
    },
    password: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
    collection: "usersBackup"
  }
);



module.exports = mongoose.model('usersBackup', UserBackupSchema);
