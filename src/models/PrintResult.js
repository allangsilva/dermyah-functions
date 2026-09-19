const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    classification: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
    collection: "print"
  }
);



module.exports = mongoose.model('print', UserSchema);
