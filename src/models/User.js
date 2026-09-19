const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
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
    collection: "users"
  }
);



module.exports = mongoose.model('users', UserSchema);
