const express = require("express");
const router = express.Router();
const request = require("request");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const fs = require("fs");
const keys = require("../config/keys");

const Owner = require("../models/Owner");
const Establishment = require("../models/Establishment");
const Category = require("../models/Category");
const QrCode = require("../models/QrCode");
const Opening_hours = require("../models/Opening_hours");
const Orders = require("../models/Order");
const Shift = require("../models/Shifts");

// Generate the Token for the user authenticated in the request
const token = require('../utils/token');
const { errorGenerator } = require("../utils/curries");
const { sendConfirmationEmail } = require("../utils/utils");
const cloudinary = require("../utils/cloudinary");
const { uploadOwner } = require("../utils/multer");

Date.prototype.addHours= function(h){
  this.setHours(this.getHours()+h);
  return this;
};

router.get("/docs", (_, res) => {
  res.render("owners_docs");
});

/**
 * @route   GET /owners/params
 * @desc    Gives the params available to the client
 * @todo    Store the values in a correct DB
 * @public
 */
router.get("/params", (req, res) => {
  res.json({
    name: "owners_params",
  });
});

// @route   POST api/owners/signup
// @desc    Register user
// @access  Public

router.post("/signup", (req, res) => {

  const { e400, presetE400 } = errorGenerator(res);

  let { email, password, user_name } = req.body;

  if(!email || !password) return presetE400();

  Owner.findOne({ email }, (err, owner) => {
    if(err) return e400(err)();
    if(owner) return e400("INVALID")("Email " + email + " already exists");

    const newOwner = new Owner({
      user_name: user_name || "",
      email,
      password,
    });

    newOwner.save((err, owner) => {
      if(err) return e400(err)();
      let subject = `Welcome to Confflux!`;
      let description = 
      `We are glad to having you on this purpose to make our world a better place to live. 
      Don't forget to follow us on Linkedin, Facebook and Instagram. 

      See you there.

      Daniela.
      Confflux.
      `;

      sendConfirmationEmail({ author: "Daniela", email, subject, description });

      return res.json({
        success: true,
        owner,
      });
    });
  });
});

// @route   POST api/users/signin
// @desc    Login User / Returning JWT Token
// @access  Public
router.post("/signin", (req, res) => {
  const { e400, presetE400, e403, presetE500 } = errorGenerator(res);

  let { email, password } = req.body;
  if (!email || !password) return presetE400();

  //find user by email
  Owner.findOne( {email} ).then((owner) => {
    //Check for user
    if (!owner) return e400("WRONG_CREDENTIALS")("Owner does not exist.");

    //Check password
    bcrypt.compare(password, owner.password)
      .then((isMatch) => {

        if (!isMatch) return e403("WRONG_CREDENTIALS")();

        //Sign Token
        res.json({
          success: true,
          id_owner: owner._id,
          token: "Bearer " + token.generateAccessToken(owner),
          expiration: parseInt(process.env.TOKEN_EXPIRATION_TIME_SECONDS),
          unit: "seconds"
        });
      })
      .catch(presetE500);
  })
    .catch(presetE500);
});

// Update a password for a logged user
// @route   PUT /owners/password
// @desc    Reset a user Password
// @access  Private
router.put(
  "/password",
  passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  async (req, res) => {
    const { presetE400 } = errorGenerator(res);
    let { _id } = await req.user;
    let { password } = req.body;

    if (!password || password === "undefined") return presetE400();

    let newPassword = password;

    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newPassword, salt, (err, hash) => {
        if (err) return e400(err)();
        Owner.findByIdAndUpdate(_id, { password: hash }, function (error, raw) {
          if (error) return e400(err)();
          res.json({
            success: true,
            message: "Owner successfully updated",
            raw,
          });
        });
      });
    });
  }
);

// @route   Post /owners/forgot-password
// @desc    Check if the user exist before sending email
// @access  Public

router.post("/forgot", (req, res) => {
  const { e400, presetE400, e404 } = errorGenerator(res);
  let { email } = req.body;
  const HOST = process.env.CLIENT;

  if(!email) return presetE400();

  Owner.findOne({ email }, (err, owner) => {
    if(err) return e400(err)();
    if(owner){

      jwt.sign(
      { _id: owner._id },
      keys.secretOrKey,
      { expiresIn: "7d" },
      (err, token) => {
        if(err) return e400(err)();

        let subject = `Email recovering from Confflux!`;
        let description = 
        `Dear Owner,
        
        We are sending this email to you because, you ask us to reset your password. 
        To create a new password, open the following link.

        ${HOST}/update-password/owner/${token}
        
        See you there.

        Camilo.
        Confflux.
        `;

        sendConfirmationEmail({ author: "Camilo", email, subject, description });

        return res.json({
          success: true,
          message: "A message was sent to " + email
        })
      });
    }else{
      return e404("NOT_FOUND")("Owner not found");
    }
  });
});

router.put("/update-password", (req,res) => {
  const { e400, presetE400 ,e404 } = errorGenerator(res);
  let { token } = req.body || req.query || req.params;
  let { password } = req.body;

  if(!token || !password) return presetE400();

  // Decode the qr code
  jwt.verify(
    token,
    process.env.OR_KEY,
    (err, response) => {
      if(err) return e400(err)("Invalid URL");

      // TODO: Make the token invalid after being used.

      if(Date.now() / 1000 <= response.exp){

        bcrypt.genSalt(10, (err, salt) => {
          if(err) return e400(err)();
          bcrypt.hash(password, salt, (err, hash) => {
            if (err) return e400(err)();

            Owner.findByIdAndUpdate(response._id, {password: hash},  (err, owner) => {
              if (err) return e400(err)();
              if (owner){
                return res.json({
                  success: true,
                  message: "Owner successfully updated"
                });
              }else{
                return e404("NOT_FOUND")("Owner not found");
              }
            });
          });
        });
      }else{
        return e400("INVALID")("Token expired");
      }
    });
});

// @route   POST /owners/uplad-photo
// @desc    Add a new profile photo
// @access  Private
router.post('/upload-photo', passport.authenticate(["jwt", "google", "facebook"], { session: false }) ,async (req, res, next) => {
  
  const { e400, presetE400 } = errorGenerator(res);
  let { _id, type } = await req.user;

  if(/user/ig.test(type)) return res.status(401).send("Unauthorized");
  
  const uploader = async (path) => await cloudinary.uploads(path,"Owners");

  uploadOwner(req,res, async (err) => {
    if(err) return e400(err)();
    if(req.file == undefined) return e400("INVALID")("There is not file to upload.");

    const file = req.file;
    const { path } = file;
    
    let newUpload = await uploader(path);
    await Owner.findByIdAndUpdate(_id, { profile_pic_url : newUpload.url } , (err) => err ? e400(err)() : "" );

    fs.unlinkSync(path);
    
    res.json({
      success: true,
      message: 'File Uploaded!',
      file: path
    });
  });
});


// @route   GET /owners/
// @desc    Return current Owner information
// @access  Private
router.get("/", passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  async (req, res) => {

    const { e400, presetE400 } = errorGenerator(res);

  
    let { _id, email, type } = await req.user;
    
    if (/user/ig.test(type)) return res.status(401).send("Unauthorized");

    Establishment.find({ id_owner: _id }, (err, establishments) => {
      if(err) return res.status(400).json({ success: false, err });

      let final_establishments = Promise.all(establishments.map(async establishment => {
        let qr_code = await QrCode.findOne({ id_establishment: establishment._id }, (err) => err ? res.status(400).json(err) : "");
        let category = await Category.findById(establishment.id_category, (err) => err ? res.status(400).json(err) : "");
        let _opening_hours = await Opening_hours.findById(establishment.id_opening_hours, (err) => err ? res.status(400).json(err) : "");
        let orders = await Orders.find({ id_establishment: establishment._id, 
          updated_at: { $gte: establishment.orders_checked_at || new Date() }}, (err) => err ? e400(err)() : "");
        let shifts = await Shift.find({ id_establishment: establishment._id, 
          updated_at: { $gte: establishment.shifts_checked_at || new Date() }}, (err) => err ? e400(err)() : "");

        let my_establishment = {};

        my_establishment._id = establishment._id;
        my_establishment.name = establishment.name;
        my_establishment.category = category ? category.name : null;
        my_establishment.isActive = establishment.isActive;
        my_establishment.description = establishment.description;
        my_establishment.current_affluences = establishment.current_affluences;
        my_establishment.max_affluences_allowed = establishment.max_affluences_allowed;
        my_establishment.shift_attention_mins = establishment.shift_attention_mins || 10;
        my_establishment.shift_schedule_max_hours = establishment.shift_schedule_max_hours;
        my_establishment.checkin_max_min = establishment.checkin_max_min;
        my_establishment.max_shifts = establishment.max_shifts;
        my_establishment.max_persons_per_slot = establishment.max_persons_per_slot;
        my_establishment.slot_size = establishment.slot_size;
        my_establishment.enableShifting = establishment.enableShifting;
        my_establishment.enable_ask_document = establishment.enable_ask_document;
        my_establishment.enableShopping = establishment.enableShopping;
        my_establishment.establishment_pics_url = establishment.establishment_pics_url || [];
        my_establishment.num_per_shift = establishment.num_per_shift || null;
        my_establishment.enable_num_people = establishment.enable_num_people || false;
        my_establishment.shifts_checked_at = establishment.shifts_checked_at || null;
        my_establishment.orders_checked_at = establishment.orders_checked_at || null;
        my_establishment.opening_hours = {
          day: _opening_hours.day,
          open_hour: _opening_hours.open_hour,
          close_hour: _opening_hours.close_hour
        };
        my_establishment.qr_code = qr_code ? qr_code.QR : "";
        my_establishment.location = {
          longitude: establishment.location.longitude,
          latitude: establishment.location.latitude,
          address: establishment.location.address,
          city: establishment.location.city,
          stateCode: establishment.location.stateCode,
          postalCode: establishment.location.postalCode,
          countryCode: establishment.location.countryCode,
          country: establishment.location.country
        };
        my_establishment.orders = orders;
        my_establishment.shifts = shifts;

        return my_establishment;
      }));

      final_establishments
        .then(async establishments => {
          
          let _establishments = establishments.filter(establishment => establishment);
          let _owner = await Owner.findById(_id, (err) => err ? e400(err)() : "");

          res.json({
            success: true,
            id_owner: _id,
            owner: {
              id: _id,
              email,
              profile_pic_url : _owner.profile_pic_url || ""
            },
            establishments: _establishments,
            token: req.get("Authorization"),
            expiration: process.env.TOKEN_EXPIRATION_TIME_SECONDS,
            unit: "seconds",

          })
        })
        .catch(err => res.status(400).json(err));

      });
  });



router.post(
  "/qr-code",
  passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  async (req, res) => {
    const { e400, presetE400, e404, presetE500 } = errorGenerator(res);
    const EXPIRATION_QR_TIME = "90d"; // 90 days

    let { type } = await req.user;
    if (/user/ig.test(type)) return res.status(401).send("Unauthorized");

    let { id_establishment } = req.body;
    if (!id_establishment) return presetE400();

    Establishment.findOne({ _id: id_establishment, isActive: true }, (err,establishment) => {
      if(err) return e400(err)();

      if(establishment){

        let qr_info = establishment._id + "_" + Date.now();

        jwt.sign(
          { qr_info },
          keys.secretOrKey,
          { expiresIn: EXPIRATION_QR_TIME },
          (err, token) => {
            if (err) return e400(err)();

            QrCode
              .find({ id_establishment: establishment._id })
              .exec((err, current_qr) => {
                if (err) return e400(err)();

                if (current_qr) {
                  const newQR = new QrCode({
                    QR: "Bearer " + token,
                    id_establishment: establishment._id
                  });

                  newQR.save((err, qr) => {
                    if (err) return e400(err)();

                    res.json({
                      success: true,
                      qr_token: "Bearer " + token,
                      qr_stored: {
                        id: qr._id,
                        id_establishemnt: qr.id_establishemnt,
                        date: qr.date
                      },
                    });
                  });
                }else{
                  return presetE500();
                }
              });
          });
      }else{
        return e404("NOT_FOUND")("Establishment not found or not active");
      }
    });
});

/**
 * ! deprecated
 * @route   GET /owners/establishment-by-id
 * @desc    Get an establishment by id
 * @public
 */
router.get("/establishment-by-id", (req, res) => {
  let { id } = req.query;

  Establishment.findOne({ _id: id })
    .exec()
    .then((establishment) => {
      Category.findOne(
        { _id: establishment.id_category },
        (err, category) => {
          let newEstablishment = {};

          // Construct the object
          newEstablishment._id = establishment._id;
          newEstablishment.name = establishment.name;
          newEstablishment.isActive = establishment.isActive;
          newEstablishment.description = establishment.description;
          newEstablishment.daysClosed = establishment.daysClosed;
          newEstablishment.startHour = establishment.startHour;
          newEstablishment.endHour = establishment.endHour;
          newEstablishment.news = establishment.news;
          newEstablishment.status = establishment.status;
          newEstablishment.people_inside = establishment.people_inside;
          newEstablishment.address = establishment.address;
          newEstablishment.category = category ? category.name : "";
          newEstablishment.establishment_pics_url = establishment.establishment_pics_url || [];
          newEstablishment.location = {
            longitude: establishment.longitude,
            latitude: establishment.latitude,
            city: establishment.location.city,
            stateCode: establishment.location.stateCode,
            postalCode: establishment.location.postalCode,
            countryCode: establishment.location.countryCode,
            country: establishment.location.country
          };

          res.json({
            success: true,
            value: newEstablishment,
          });
        }
      );
    })
    .catch((err) => res.status(400).json(err));
});

/**
 * @route   DELETE /owners/remove
 * @desc    Delete the owner based on the id
 * @param   {String} id Owner's id
 * @private
 */
router.delete(
  "/remove",
  passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  (req, res) => {
    let { id } = req.body;

    if (!id) return res.status(400).json({ error: "Missing arguments." });
    if (/user/ig.test(req.user.type)) return res.status(401).send("Unauthorized");

    Owner.findByIdAndDelete(id, (err, result) => {
      if (err) return res.status(400).json(err);

      if (result) {
        res.json({
          success: true,
          result
        });
      } else {
        res.status(404).json({
          success: false,
          message: "This owner does not exist."
        });
      }
    });
  }
);

module.exports = router;
