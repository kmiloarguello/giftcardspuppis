const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const SALT_WORK_FACTOR = process.env.SALT_WORK_FACTOR || 10;

// Create Schema
const OwnerSchema = new Schema({
  user_validation: { type: Boolean, default: false },
  user_name: String,
  profile_pic_url: String,
  email: { type: String, required : true, unique : true},
  locale:{type:String, default: 'es'},
  password: String,
  googleID: String,
  type: { type: String, default: "owner" },
  facebookId: String
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

OwnerSchema.pre('save', function (next) {
  const owner = this;

  if (!owner.isModified('password')) {
    next();
  } else {
    bcrypt.genSalt(SALT_WORK_FACTOR) //a mayor salt, más segura y demorá más!.
      .then(salt => {
        return bcrypt.hash(owner.password, salt)
          .then(hash => {
            owner.password = hash; //* <== password hiper segura!
            next();
          })
      })
      .catch(error => next(error))
  }
});

//-----Place model-----//
module.exports = Owner = mongoose.model('Owner', OwnerSchema);
