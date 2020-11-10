const express = require("express");
const router = express.Router();
const passport = require("passport");
// Generate the Token for the user authenticated in the request
const token = require('../utils/token');

/**
 * @route   GET auth/google
 * @desc    The first step in Google authentication will involve
*           redirecting the user to google.com.  After authorization, Google
*           will redirect the user back to this application at /google/callback
 * @private
 */
router.get(
  '/google',
  getQueryParamas, //* extract query paramas to store them inside session.
  passport.authenticate('google', {
    session: false,
    scope: [
      'https://www.googleapis.com/auth/plus.login',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  })
);

/**
 * @route   GET auth/google/callback
 * @desc    If authentication fails, the user will be redirected back to the
 *          login page.  Otherwise, the primary route function function will be called,
 *          which, will redirect the user to the home page.
 * @private
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {session: false}),
  handleSocialCallback
);

/**
 * @route   GET auth/facebook
 * @desc    same logic as google
 * @private
 */
router.get(
  '/facebook',
  getQueryParamas,
  passport.authenticate('facebook', {
    session: false,
    scope: ["email"]
  })
);

/**
 * @route   GET auth/facebook
 * @desc    If authentication fails, the user will be redirected back to the
 *          login page.  Otherwise, the primary route function function will be called,
 *          which, in this example, will redirect the user to the home page.
 * @private
 */
router.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/signin' }),
  handleSocialCallback
);

module.exports = router;


function getQueryParamas (req, res, next) {
  //* expecting a query in the route with owner or user value
  // <a href='/auth/google?type=owner'>Log Google</a> 
  // <a href='/auth/facebook?type=user'>Log Google</a> 
  //? store user type inside the session.
  req.session.type = req.query.type;
  //? store the strategy inside the session.
  req.session.strategy = req.route.path.slice(1)
  next();
}

function handleSocialCallback (req, res) {

  //if(/user/ig.test(req.user.type)) return res.status(401).send("Unauthorized");

  accessToken = token.generateAccessToken(req.user);
  // redirect to client side
  // ? how do I do this for mobile?
  res.redirect(`${process.env.CLIENT}/login/success/${req.user.type}/${accessToken}`);
  //clean session
  delete req.session.type;
  delete req.session.strategy
}