const express = require("express");
const { check, validationResult } = require("express-validator");
const router = express.Router();
const { delCookie } = require("../utils/auth/tokens");
const { User, TwoFactorToken, ResetPasswordToken } = require("../utils/database/models");
const {
  checkPassword,
  hashPassword,
  checkPwStr,
	random2FACode
} = require("../utils/auth/tokens");
const {
  sendPasswordChangedEmail,
  sendPasswordForgotEmail,
	send2FAEmail
} = require("../utils/aws/Email");

// @route POST api/passwords/forgot
// @desc Auth User and Send 2FA
// @access Public
const forgotValidator = [
  check("email", "email is missing").not().isEmpty(),
  check("email", "email is malformed").isEmail(),
];

router.post("/forgot", [forgotValidator], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors
      .array()
      .map((error) => ({ msg: error.msg, param: error.param }));
    return res.status(400).json({ validationErrors });
  }

  try {
    /* deletes any remaining older cookies  */
    await delCookie(res, "token");

    /* Get the form data */
    let { email } = req.body;

    /* If no user.... that means they didnt supply the correct emial address. */
    let user = await User.findOne({ email }).populate("defaultOrg");
    if (!user) {
      return res.status(400).json({ msg: "Invalid Email" });
    }

    // /* Send Email Notification that password was reset */
    // await sendPasswordForgotEmail(email);

    // return res.status(200).json({ msg: "forgot email sent" });


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
          msg: "2FATokenAlreadyExists",
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
        msg: "2FAEmail Sent",
        devOnly: twoFacCode,
        user: cleanUser,
      });
    }

    return res.status(200).json({ user: cleanuser });
  } catch (err) {
    console.error(err);
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
    return res.status(400).json({ msg });
  }

  /* Find the token by the user id */
  const tokenRes = await TwoFactorToken.findOne({ user: userid });
  if (!tokenRes) {
    const msg = "no2FATokenFound";
    return res.status(400).json({ msg });
  }

  if (tokenRes.token.toString() !== token.toString()) {
    const msg = "invalid 2FA Token";
    return res.status(400).json({ msg });
  }

  /* Delete the  2FAToken*/
  await TwoFactorToken.deleteOne({ user: userid });

  /* Make sure there is ever only one token per user at any one time */

  const resetPasswordCode = await random2FACode();
  await ResetPasswordToken.deleteOne({ user: userid });
  const resetPasswordObj = new ResetPasswordToken({
    user: user._id,
    token: resetPasswordCode,
  });
  await resetPasswordObj.save();

  return res.json({
    msg: "Reset password code created",
    code: resetPasswordCode,
  });
});

router.post("/reset", async (req, res) => {
  const { userId, token, password } = req.body;
  
  let user = null;
  try {
    user = await User.findOne({ _id: userId }).populate("defaultOrg");
  } catch (error) {}

  if (!user) {
    const msg = "Invalid user ID";
    return res.status(400).json({ msg });
  }

  /* Find the token by the user id */
  const resetPasswordRes = await ResetPasswordToken.findOne({ user: userId });
  if (!resetPasswordRes) {
    const msg = "No Reset Password Token Found";
    return res.status(400).json({ msg });
  }

  if (resetPasswordRes.token.toString() !== token.toString()) {
    const msg = "Invalid Reset Password Token";
    return res.status(400).json({ msg });
  }

  /* Check the password complexity */
  const { valid, failReasonse } = await checkPwStr(password);
  if (!valid) {
    return res.status(400).json({ invalid: failReasonse });
  }

  /* Delete the reset password token*/
  await ResetPasswordToken.deleteOne({ user: userId });

  user.password = await hashPassword(password);
  await user.save();

  return res.status(200).json({ msg: 'Successfully changed password.' });
});

// @route POST api/passwords/expired
// @desc Auth User and Send 2FA
// @access Public
const expiredValidator = [
  check("email", "email is missing").not().isEmpty(),
  check("email", "email is malformed").isEmail(),
  check("oldPassword", "oldPassword is missing").not().isEmpty(),
  check("newPassword", "newPassword is missing").not().isEmpty(),
];
router.post("/expired", [expiredValidator], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors
      .array()
      .map((error) => ({ msg: error.msg, param: error.param }));
    return res.status(400).json({ validationErrors });
  }

  try {
    //deletes any remaining older cookies
    await delCookie(res, "token");

    /* Get the form data */
    let { email, oldPassword, newPassword } = req.body;

    /* If no user.... that means they didnt supply the correct emial address. */
    let user = await User.findOne({ email });
    if (!user) {
      const msg = "Invalid Credentials";
      return res.status(400).json(msg);
    }
    const oldHashedPassword = user.password;

    /* Check the hashed oldPassword against the string passowrd */
    const isMatchOld = await checkPassword(oldPassword, oldHashedPassword);
    if (!isMatchOld) {
      const msg = "Invalid Credentials";
      return res.status(400).json({ msg });
    }

    /* Hash the NewPassword */
    const newHashedPassword = await hashPassword(newPassword);

    /* Make sure the new password isnt the same as the old one */
    const isMatch = await checkPassword(newPassword, oldHashedPassword);
    if (isMatch) {
      const msg = "New Password Cannot be the same as current";
      return res.status(400).json({ msg });
    }

    /* Make sure the new password isnt in the list of previously used passwords*/
    for (const prior of user.previousPasswords) {
      const priorMatch = await checkPassword(newPassword, prior);
      if (priorMatch) {
        const msg = "New Password Cannot be one that has been used in the past";
        return res.status(400).json({ msg });
      }
    }

    /* Check the newPassword complexity */
    const { valid, failReasonse } = await checkPwStr(newPassword);
    if (!valid) {
      return res.status(400).json({ invalid: failReasonse });
    }

    /* Move the old password to the array of previousPasswords */
    user.previousPasswords.push(user.password);

    /* Set the current password */
    user.password = newHashedPassword;

    /* Set the passwordChangeDate */
    user.passwordChangeDate = new Date();

    /* Set the number of password changes to 0 */
    user.countPasswordChanges = 0;

    /* Save the user to the db */
    await user.save();

    /* Send Email Notification that password was changed */
    await sendPasswordChangedEmail(email);

    return res.status(200).json({ msg: "password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }

  //$2a$10$pL/XSmOnw93I.6e9OXfpW.0vdHOnZowQaE3GBglxnD2mDn0dld2kC
});

module.exports = router;
