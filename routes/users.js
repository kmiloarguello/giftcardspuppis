const express = require("express");
const router = express.Router();
const request = require("request");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const fs = require("fs");

const keys = require("../config/keys");

// Generate the Token for the user authenticated in the request
const token = require('../utils/token');

const Users = require("../models/Users");
const Establishment = require("../models/Establishment");
const Visit = require("../models/Visits");
const QrCode = require("../models/QrCode");

// Utils
const { sendConfirmationEmail } = require("../utils/utils");
const { errorGenerator } = require("../utils/curries");
const cloudinary = require("../utils/cloudinary");
const { uploadUser } = require("../utils/multer");


router.get("/params", (req, res, next) => {
  res.json({
    name: "users_params",
    params: [
      {
        value: "/users/new",
        name: "New user",
        type: "POST",
        access: "Private",
      },
      {
        value: "/users/:id",
        name: "Get user by ID",
        type: "GET",
        access: "Private",
      },
      {
        value: "/users/remove:id",
        name: "Remove user by Id",
        type: "DELETE",
        access: "Private",
      },
      {
        value: "/users/register-visit",
        name: "Register visit",
        type: "POST",
        access: "Public",
      },
      {
        value: "/users/visits",
        name: "Get my visits",
        type: "GET",
        access: "Public",
      },
    ],
  });
});

router.get("/docs", (req, res) => {
  res.render("user_docs");
});

/**
 * ! Deprecated
 * @route   POST /users/new
 * @desc    Create a new user
 * @param   {String} user_code id unique identificator device
 * @public
 */
router.post("/new", (req, res) => {

  let { email, country } = req.body;

  if (!email || !country) return res.status(400).json({ error: "Missing arguments" });

  const newUser = new Users({
    email,
    country
  });

  newUser.save((err, user) => {
    if (err) return res.status(400).json(err);

    let newUser = {};

    newUser.id_person = user._id;
    newUser.status = user.status;

    res.json({
      success: true,
      user: newUser,
    });
  });
});



// @route   POST /users/signup
// @desc    Register user
// @access  Public
router.post("/signup", (req, res) => {

  const { e400, presetE400 } = errorGenerator(res);

  let { email, password } = req.body;

  if(!email || !password) return presetE400();

  Users.findOne({ email }, (err, user) => {
    if(err) return e400(err)();
    if(user) return e400("INVALID")("Email " + email + " already exists");

    const newUser = new Users({
      email,
      password,
    });

    newUser.save((err, user) => {
      if(err) return e400(err)();
      let subject = `Welcome to Confflux!`;
      let description = 
      `We are glad to having you on this purpose to make our world a better place to live. 
      Don't forget to follow us on Linkedin, Facebook and Instagram. 

      See you there.

      Oscar.
      Confflux.
      `;

      sendConfirmationEmail({ author: "Oscar", email, subject, description });

      return res.json({
        success: true,
        user,
      });
    });
  });
});


// @route   POST api/users/signin
// @desc    Login User / Returning JWT Token
// @access  Public
router.post("/signin", (req, res) => {
  
  const { e400, presetE400, e404, presetE500 } = errorGenerator(res);
  let { email, password } = req.body;

  if (!email || !password) return presetE400();

  Users.findOne({ email }, (err, user) => {
    if(err) return e400(err)();
    if(user){
      //Check password
      bcrypt.compare(password, user.password)
        .then(isMatch => {
          if (isMatch) {
            //User Matched
            const payload = {
              _id: user._id,
              email: user.email,
              type: user.type // Only for Managers
            }; // Create JWT Payload

            //Sign Token
            return res.json({
              success: true,
              id_owner: user._id,
              token: "Bearer " + token.generateAccessToken(payload),
              expiration: parseInt(process.env.TOKEN_EXPIRATION_TIME_SECONDS),
              unit: "seconds"
            });
          } else {
            return e400("INVALID")("Wrong credentials");
          }
        })
        .catch(presetE500);
    }else{
      return e404("NOT_FOUND")("User with email: "+ email +" not found");
    }
  }); 
});

/**
 * Change a password when the user is logged
 */
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
      if(err) return e400(err)();
      bcrypt.hash(newPassword, salt, (err, hash) => {
        if (err) return e400(err)();
        Users.findByIdAndUpdate(_id, { password: hash }, function (error, raw) {
          if (error) return e400(err)();
          res.json({
            success: true,
            message: "User successfully updated"
          });
        });
      });
    });
  }
);


// @route   Post /users/forgot
// @desc    Check if the user exist before sending email
// @access  Public

router.post("/forgot", (req, res) => {
  const { e400, presetE400, e404 } = errorGenerator(res);
  let { email } = req.body;
  const HOST = process.env.CLIENT;

  if(!email) return presetE400();

  Users.findOne({ email }, (err, user) => {
    if(err) return e400(err)();
    if(user){

      jwt.sign(
      { _id: user._id },
      keys.secretOrKey,
      { expiresIn: "7d" },
      (err, token) => {
        if(err) return e400(err)();

        let subject = `Email recovering from Confflux!`;
        let description = 
        `Dear user,
        
        We are sending this email to you because, you ask us to reset your password. 
        To create a new password, open the following link.

        Click on the link or copy the url and paste it on your browser.

        ${HOST}/update-password/user/${token}
        
        See you there.

        Daniel.
        Confflux.
        `;

        // <a href="${HOST}/update-password/user/${token}" target="_blank">${HOST}/update-password/user/${token}</a>
        
        sendConfirmationEmail({ author: "Daniel", email, subject, description });

        return res.json({
          success: true,
          message: "A message was sent to " + email
        })
      });
    }else{
      return e404("NOT_FOUND")("User not found");
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

            Users.findByIdAndUpdate(response._id, {password: hash},  (err, user) => {
              if (err) return e400(err)();
              if (user){
                return res.json({
                  success: true,
                  message: "User updated password"
                });
              }else{
                return e404("NOT_FOUND")("User not found");
              }
            });
          });
        });

        
      }else{
        return e400("INVALID")("Token expired");
      }
    });
});


// @route   POST /users/uplad-photo
// @desc    Add a new profile photo
// @access  Private
router.post('/upload-photo', passport.authenticate(["jwt", "google", "facebook"], { session: false }) ,async (req, res, next) => {
  
  const { e400, presetE400 } = errorGenerator(res);
  let { _id, type } = await req.user;

  if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");
  
  const uploader = async (path) => await cloudinary.uploads(path,"Users");

  uploadUser(req,res, async (err) => {
    if(err) return e400(err)();
    if(req.file == undefined) return e400("INVALID")("There is not file to upload.");

    const file = req.file;
    const { path } = file;
    
    let newUpload = await uploader(path);
    await Users.findByIdAndUpdate(_id, { profile_pic_url : newUpload.url } , (err) => err ? e400(err)() : "" );

    fs.unlinkSync(path);
    
    res.json({
      success: true,
      message: 'File Uploaded!',
      file: path
    });
  });
});

/**
 * Get the information from the current user
 * @route   GET /users/
 * @private
 */
router.get("/",  passport.authenticate(["jwt", "google", "facebook"], { session: false }), async (req, res) => {
  const { e400, presetE404 } = errorGenerator(res);
  const { _id, type } = await req.user;

  if(/owner/ig.test(type)) return res.status(401).send("Unauthorized");
  
  Users.findById(_id, (err, user) => {
    if(err) return e400(err)();
    if(user){
      res.json({
        success: true,
        id_user: _id,
        user: {
          id: _id,
          name: user.name || null,
          email: user.email,
          document: user.document
        },
        token: req.get("Authorization"),
        expiration: process.env.TOKEN_EXPIRATION_TIME_SECONDS,
        unit: "seconds"
      });
    }else{
      return presetE404("User is undefined.");
    }
  });
});


/**
 * ! Deprecated
 * @route   PUT /users/validation
 * @desc    Validate whether is a valid user
 * @param   {String} id_person id unique identificator device as Header
 * @param   {Boolean} authToken value to change as Body
 * @public
 */
router.put("/validation", (req, res) => {
  let { id_person } = req.query || req.params;

  if (!id_person) return res.status(400).json({ error: "Missing argument id_person." });

  Users.findByIdAndUpdate(id_person, req.body, (err, user) => {
    if (err) return res.status(400).json(err);
    if (user) {
      res.json({
        success: true,
        message: "User successfully updated",
        user,
      });
    } else {
      res.status(404).json({
        error: "User does not exist."
      });
    }
  });
});

/**
 * ! Deprecated
 * @route   POST /users/register-visit
 * @desc    Register one visit, scanning a qr code
 * @param   {String} id_person
 * @param   {String} id_establisment
 * @param   {Object} location i.e { "longitude": 12.123, "latitude" : 12.123, ... } (See /new-location)
 * @param   {String} date as Timeunix or Time epoch i.e 1587685431
 * @param   {String} token i.e Bearer isAsdAoAITWPZSahYWjgKweXYWOsad ...
 * @public
 *
 * // Prevenir que el usuario escanée mas de una vez
 */
router.post("/checkin-qr", (req, res) => {
  let {
    id_person, // String
    // id_establishment, // String
    location, // Object
    date,
    token,
  } = req.body;

  if (!id_person || !location || !date || !token) {
    return res.status(400).json({ error: "Missing data" })
  }

  // let token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];

  // THis user exists
  Users.findOne({ _id: id_person }, (err, user) => {
    if (err) return res.status(400).json(err);

    if (user) {

      jwt.verify(
        token.split(" ")[1],
        keys.secretOrKey,
        (err, response) => {
          if (err) return res.status(403).json(err);

          let input_date = (date || Date.now()).toString();

          // Sometimes the date value cames as 13 length, we have to changed removin last 3 items
          if (input_date.length === 13)
            input_date = input_date.slice(0, -3);

          // If the code is not expired
          if (input_date < response.exp) {

            if (!new RegExp("_", "ig").test(response.qr_info)) return res.status(400).json({ error: "Wrong QR code " });

            let qr_id_establishment = response.qr_info.split("_")[0];
            let qr_date = response.qr_info.split("_")[1];

            QrCode.findOne(
              { id_establishment: qr_id_establishment },
              (err, qr) => {
                if (err) return res.status(400).json(err);

                if (qr) {
                  let newVisit = new Visit({
                    id_person,
                    id_establishment: qr_id_establishment,
                    location_GPS: [
                      location.longitude,
                      location.latitude,
                    ],
                    date_in: date || Date.now(),
                  });

                  newVisit.save((err, _) => {
                    if (err) return res.status(400).json(err);

                    res.json({
                      success: true,
                      message: "Visit registered correctly",
                      // locationA: {
                      //   longitude: _location.longitude,
                      //   latitude: _location.latitude,
                      // },
                      locationB: {
                        longitude: location.longitude,
                        latitude: location.latitude,
                      },
                      // distance: calculateDistance(
                      //   _location.latitude,
                      //   _location.longitude,
                      //   location.latitude,
                      //   location.longitude
                      // ),
                      // unit: "km",
                      date_in: date,
                    });
                  });
                } else {
                  return res.json({
                    success: false,
                    error: "The qr code could not be found.",
                  });
                }
              }
            );
          } else {
            return res.status(403).json({
              date_input: input_date,
              date_res: response.exp,
              error: "Code expired",
            });
          }

        }
      );
    } else {
      return res.status(403).json({ error: "User does not exists." });
    }
  });
});

/**
 * ! Deprecated
 * @route   GET /users/visits
 * @desc    Get all my visits
 * @param   {String} id_person
 * @public
 */
router.get("/visits", async (req, res) => {
  let { id_person } = req.body;

  Visit.find({ id_person })
    .exec()
    .then((visits) => {
      // Iteration for all the visits found
      let _visits = Promise.all(
        visits.map(async (visit) => {
          let _myVisit = {};

          // Promise for each iteration getting establishment and location
          let establishment = await Establishment.findOne({
            _id: visit.id_establishment,
          }).exec();

          // Constructing the response json
          _myVisit.id = visit._id;
          _myVisit.location_visit = {
            longitude: visit.location_GPS[0],
            latitude: visit.location_GPS[1],
          };
          _myVisit.date = visit.date_in;
          _myVisit.establishment = {
            name: establishment.name,
            longitude: establishment.longitude,
            latitude: establishment.latitude,
            city: establishment.location.city,
            stateCode: establishment.location.stateCode,
            postalCode: establishment.location.postalCode,
            countryCode: establishment.location.countryCode,
            country: establishment.location.country
          };

          return _myVisit;
        })
      );

      return _visits;
    })
    // Sending back the response
    .then((visits) => {
      res.json({
        success: true,
        total: visits.length,
        values: visits,
      });
    })
    .catch((err) => res.status(400).json(err));
});

/**
 * ! Deprecated
 * @route    DELETE /users/remove
 * @desc     Delete an user based on its id
 * @param    {String} id user Id
 * @private
 */
router.delete("/remove", (req, res, next) => {
  Users.deleteOne({ _id: req.body.id_person }, (err, result) => {
    if (err) return res.status(400).json(err);
    res.json({
      success: true,
      result,
    });
  });
});

module.exports = router;
