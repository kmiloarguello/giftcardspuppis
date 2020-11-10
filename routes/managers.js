const express = require("express");
const router = express.Router();
const request = require("request");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");

const keys = require("../config/keys");

const Manager = require("../models/Manager");
const Establishment = require("../models/Establishment");
const QrCode = require("../models/QrCode");

router.get("/docs", (req,res) => {
  res.render("managers_docs")
});


/**
 * @route   GET /managers/params
 * @desc    Gives the params available to the client
 * @todo    Store the values in a correct DB
 * @public
 */
router.get("/params", (req, res, next) => {
  res.json({
    name: "managers_params",
  });
});

// @route   POST api/managers/signup
// @desc    Register user
// @access  Public
router.post("/signup", (req, res) => {
  // const {
  //   errors,
  //   isValid
  // } = validateRegisterInput(req.body);

  //Check validation
  //   if (!isValid) {
  //     return res.status(400).json(errors);
  //   }

  Manager.findOne({ email: req.body.email }).then((user) => {
    if (user) {
      console.error("Email already exists");
      return res.json({
        success: false,
        error: "Email already exists",
      });
    } else {
      const newUser = new Manager({
        userName: req.body.user_name || "",
        email: req.body.email,
        password: req.body.password,
      });
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then((user) =>
              res.json({
                success: true,
                user,
              })
            )
            .catch((err) => console.log(err));
        });
      });
    }
  });
});

// @route   POST api/users/signin
// @desc    Login User / Returning JWT Token
// @access  Public
router.post("/signin", (req, res) => {
  // console.log('SIGNIN');
  // const {
  //   errors,
  //   isValid
  // } = validateLoginInput(req.body);

  //Check validation
  //   if (!isValid) {
  //     console.log('errors: ', errors);
  //     return res.status(400).json(errors);
  //   }

  const email = req.body.email;
  const password = req.body.password;

  //find user by email
  Manager.findOne({
    email,
  }).then((user) => {
    //Check for user
    if (!user) {
      return res.json({ success: false, error: "Email not found" });
    }

    //Check password
    bcrypt.compare(password, user.password).then((isMatch) => {
      if (isMatch) {
        //User Matched
        const payload = {
          id: user.id,
          name: user.userName,
          email: user.email,
          isSuperUser: true // Only for Managers
        }; // Create JWT Payload

        const expiresInSeconds = process.env.TOKEN_EXPIRATION_TIME_SECONDS;

        //Sign Token
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: expiresInSeconds,
          },
          (err, token) => {
            if (err) return res.status(400).json(err);

            res.json({
              success: true,
              id_manager: user._id,
              token: "Bearer " + token,
              expiration: expiresInSeconds,
              unit: "seconds"
            });
          }
        );
      } else {
        return res.json({
          success: false,
          error: "Wrong credentials",
        });
      }
    });
  });
});

// @route   GET /managers/
// @desc    Return current User
// @access  Private
router.get("/",
  passport.authenticate(["jwt", "google", "facebook"], { session: false }),
  (req, res) => {

    // TODO: Change to handle the service as Different user privilegies
    if (!req.user.isSuperUser) return res.status(401).send("Unauthorized");

    let { _id, email } = req.user;

    // Find all the establishments by the current user
    Establishment.find({ id_manager: _id }, (err, establishments) => {
      if (err) return res.status(400).json(err);

      if (establishments && establishments.length > 0) {

        // TODO: Fix with id_establishment instead id_manager
        // Find all the QR codes by the current user
        QrCode.find({ id_manager: _id }, (err, qrcodes) => {
          if (err) return res.status(400).json(err);

          if(qrcodes.length > 0){
            res.json({
              success: true,
              email
            });

            // If there aren't qrcodes
          }else{

            res.json({
              success: true,
              email
            });

          }
        });

        // If there aren't establishments
      } else {
        res.json({
          success: true,
          email,
        });
      }
    });
  }
);


module.exports = router;
