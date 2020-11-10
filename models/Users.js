const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const SALT_WORK_FACTOR = process.env.SALT_WORK_FACTOR || 10;

// Create Schema
const UsersSchema = new Schema({
  name : String,
  email: { type: String, required: true, unique: true},
  password: String,
  profile_pic_url: String,
  googleID: String,
  facebookID: String,
  document: String,
  authToken: { type: String, default: "None" },
  country: String,
  status: { type: String, default: "healthy" },
  type: { type: String, default: "user" },
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

UsersSchema.pre('save', function (next) {
  const user = this;

  if (!user.isModified('password')) { 
    next();
  } else {
    bcrypt.genSalt(SALT_WORK_FACTOR) //a mayor salt, más segura y demorá más!.
      .then(salt => {
        return bcrypt.hash(user.password, salt)
          .then(hash => {
            user.password = hash; //* <== password hiper segura!
            next();
          })
      })
      .catch(error => next(error))
  }
});


//-----User model-----//
module.exports = Users = mongoose.model('Users', UsersSchema);
