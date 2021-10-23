const express = require("express");
const { check, validationResult } = require("express-validator");
const router = express.Router();
const {
  getJWT,
  setCookie,
  delCookie,
  isPwExpired,
  decrypt,
} = require("../utils/auth/tokens");
const { User, TwoFactorToken } = require("../utils/database/models");
const { checkPassword, random2FACode } = require("../utils/auth/tokens");
const { send2FAEmail } = require("../utils/aws/Email");
const {
  logLogin,
  logUserLogout,
  logError,
} = require("../utils/aws/LogModels.js");
const { putLog, createLogGroup } = require("../utils/aws/Logger.js");
const auth = require("../middleware/auth");

// @route GET api/auth
// @desc Get logged in user
// @access Private
router.get("/", auth, async (req, res) => {
  try {
    res.status(200).json(req.fullUser);
  } catch (error) {
    res.status(500).json({ err: "serverError" });
  }
});

// @route POST api/auth/login
// @desc Auth User and Send 2FA
// @access Public
const loginValidator = [
  check("email", "Please include a valid email").isEmail(),
  check("password", "Password is required").exists(),
];

router.post("/login", loginValidator, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    //log = logLogin(null, req.body.email, 400, errors.array());
    //putLog(log, 'logins');
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { email, password } = req.body;
    email = email.toLowerCase();

    //deletes any remaining older cookies
    await delCookie(res, "token");

    let user = await User.findOne({ email }).populate("defaultOrg");
    // console.log("USER: ", user.toJSON());
    /* If no user.... that means they didnt supply the correct emial address. */
    if (!user) {
      const msg = "Invalid Credentials";
      //log = logLogin(null, req.body.email, 400, msg);
      //putLog(log, 'logins');
      return res.status(400).json(msg);
    }
    // let logGroup = user.defaultOrg.logGroup;

    /* Check the hashed password against the string passowrd */
    const isMatch = await checkPassword(password, user.password);

    if (!isMatch) {
      const msg = "Invalid Credentials";
      //log = logLogin(null, req.body.email, 400, msg);
      //putLog(log, 'logins', logGroup);
      return res.status(400).json({ msg });
    }

    /* Check to see if the password is expired */
    const expired = await isPwExpired(user);
    if (expired) {
      const msg = "Password Expired";
      //log = logLogin(user._id, req.body.email, 400, msg);
      //putLog(log, 'logins', logGroup);
      return res.status(400).json({ msg });
    }
    const cleanUser = user.toJSON();
    delete cleanUser.password;
    delete cleanUser.previousPasswords;
    const twoFactorReq = cleanUser.defaultOrg.require2FA;

    /* If the payload does NOT include a 2FAToken Issue One*/
    if (twoFactorReq) {
      /* Make sure there is ever only one token per user at any one time */
      const tokenRes = await TwoFactorToken.findOne({ user: user._id });
      if (tokenRes) {
        return res.json({
          msg: "2FA token already exists",
          devOnly: tokenRes.token,
          user: cleanUser,
        });
      }
      const twoFacCode = await random2FACode();
      const twoFacObj = new TwoFactorToken({
        user: user._id,
        token: twoFacCode,
      });
      const twoFacRes = await twoFacObj.save();
      await send2FAEmail(email, twoFacCode);
      return res.json({
        msg: "2FA token email sent",
        devOnly: twoFacCode,
        user: cleanUser,
      });
    }

    /* Finally.... Issue a jwt */
    const JwtToken = await getJWT(user);

    /* Sets the JWT to a cookie so it is available in all future calls */
    await setCookie(res, "token", JwtToken);

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({ user: cleanuser });
  } catch (err) {
    console.error(err.message);
    //log = logError(user._id, req.body.email, 500, err.message);
    //putLog(log, 'errors');
    res.status(500).send("Server Error");
  }
});

router.post("/confirm", async (req, res) => {
  const { userid, token } = req.body;

  let user = null;
  try {
    user = await User.findOne({ _id: userid }).populate("defaultOrg");
  } catch (error) {}

  if (!user) {
    const msg = "invalid userid";
    //log = logLogin(user._id, req.body.email, 400, msg);
    //putLog(log, 'logins', logGroup);
    return res.status(400).json({ msg });
  }

  /* Find the token by the user id */
  const tokenRes = await TwoFactorToken.findOne({ user: userid });
  if (!tokenRes) {
    const msg = "no2FATokenFound";
    //log = logLogin(user._id, req.body.email, 400, msg);
    // putLog(log, 'logins', logGroup);
    return res.status(400).json({ msg });
  }

  if (tokenRes.token.toString() !== token.toString()) {
    const msg = "invalid 2FA Token";
    //log = logLogin(user._id, user.email, 400, msg);
    //putLog(log, 'logins', logGroup);
    return res.status(400).json({ msg });
  }

  /* Finally.... Issue a jwt */
  const JwtToken = await getJWT(user);

  /* Sets the JWT to a cookie so it is available in all future calls */
  await setCookie(res, "token", JwtToken);

  /* Delete the  2FAToken*/
  const delRes = await TwoFactorToken.deleteOne({ user: userid });

  user.lastLogin = new Date();
  await user.save();

  const msg = "Logged in";
  //log = logLogin(user._id, req.body.email, 200, msg);
  //putLog(log, 'logins', logGroup);
  return res.status(200).json({ msg });
});

router.post("/logout", async (req, res) => {
  try {
    await delCookie(res, "token");
    return res.status(200).json({ msg: "logged out" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
