const express = require("express");
const { check, validationResult } = require("express-validator");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  User,
  Invite,
  Org,
  Permission,
  TwoFactorToken, PermissionGroup
} = require("../utils/database/models");
const { ObjectId } = require("../utils/database/utils");
const {
  hashPassword,
  delCookie,
  checkPwStr,
  getRouteHash,
  random2FACode,
} = require("../utils/auth/tokens");
const { send2FAEmail } = require("../utils/aws/Email");
const {
  logPermissionChange,
  logGroupChange,
  logError,
} = require("../utils/aws/LogModels.js");

const getReqMeta = async (req) => {
  const { org, baseUrl, method, query, isSuper } = req;
  const path = req.route.path;
  const userId = req.user;
  const routeId = await getRouteHash(baseUrl, method, path);
  if (!isSuper || !query.org) {
    query.org = org;
  }
  return { org, baseUrl, method, query, isSuper, userId, routeId, path };
};

// @route POST api/users
// @desc Register a user
// @access Public
const postValidator = [
  check("name", "Name is required").not().isEmpty(),
  check("id", "Missing ID").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("password", "Missing Password").not().isEmpty(),
];

/** 
 * Creates a user from an invitation
*/
router.post("/", postValidator, async (req, res) => {
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

    let { email, password, id, name } = req.body;
    email = email.toLowerCase();

    /* Check to make sure the user doesnt already exsist */
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: `${email} is already registered` });
    }

    /* Find their invitation */
    const inviteRes = await Invite.findOne({ to: email }).lean().exec();
    if (!inviteRes) {
      return res.status(400).json({ msg: `No invitation found for ${email}` });
    }

    /* If their inviation id !== the inviation id provided during sign up.... reject */
    if (id !== inviteRes._id.toString()) {
      return res.status(400).json({ msg: "Invalid Invitation ID" });
    }

    /* If the invitation has already been accepted */
    if (inviteRes.accepted) {
      return res.status(400).json({ msg: `This invitation has already been accepted` });
    }

    /* Check the password complexity */
    const { valid, failReasons } = await checkPwStr(password);
    var reasonsListed = "";
    try {
      for (let reason in failReasons) {
        reasonsListed += `${failReasons[reason]}`
        break; //only list one for now... we'll come back to this
      }
    } catch (e) { }

    if (!valid) {
      return res.status(400).json({ invalid: failReasons, msg: `Password does not meet security requirement: ${reasonsListed}` });
    }

    /* Hash the password */
    const hashpw = await hashPassword(password);

    // inviteRes.permissionGroup
    /**
     check if invite permission group is an array or not. in any case, convert to array
     for each group, get group, append permisions to list of permissions
     append invitaiton permissions to group permissions and set as permissions for users
     */

    let allPermissions = inviteRes.permissions.slice();
    if (!Array.isArray(inviteRes.permissionGroup)) inviteRes.permissionGroup = [inviteRes.permissionGroup];
    for (const group of inviteRes.permissionGroup) {
      let doc = await PermissionGroup.findOne({_id:group}).lean().exec();
      if (!doc) return res.status(400).json({ msg: `permissionGroup ${group} does not exist` });
      allPermissions.push(...doc.permissions);
    }


    /* Create the new user */
    const newuser = new User({
      email,
      password: hashpw,
      name,
      defaultOrg: inviteRes.org,
      orgs: [inviteRes.org],
      permissionGroups: [inviteRes.permissionGroup],
      permissions: allPermissions,
    });
    await newuser.save();

    /* Update the invitation object */
    inviteRes.accepted = true;
    inviteRes.acceptDate = new Date();
    inviteRes.newUserId = newuser._id;
    await inviteRes.save();

    /** Temporarily commenting this. The user should have to fully log in and at that point the 2fa should be
     * invoked. We can come back to this later. But in the current flow, it does cause some confusion to the
     * user because they are redirected and forced to log in anyway, yet they already have a 2FA in their inbox.
     * After some time we want to just remove this
    */
    // /* Make sure there is ever only one token per user at any one time */
    // const tokenRes = await TwoFactorToken.findOne({ user: newuser._id });
    // if (tokenRes) {
    //   return res.json({ msg: "2FATokenAlreadyExists" });
    // }

    // /* Issue a new 2FA and Email */
    // const twoFacCode = await random2FACode();
    // const twoFacObj = new TwoFactorToken({
    //   user: newuser._id,
    //   token: twoFacCode,
    // });
    // const twoFacRes = await twoFacObj.save();
    // await send2FAEmail(email, twoFacCode);

    return res.json({
      msg: "2FAEmail Sent",
      devOnly: twoFacCode,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
  //res.send(req.body)
});

// @route GET api/users
// @desc Get a user
// @access Private
router.get("/", [auth], async (req, res) => {
  try {
    const { id } = req.params;
    const { user, routeHash } = req;

    res.json({ id, user, routeHash });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
  //res.send(req.body)
});

router.get("/:id/forceout", [auth], async (req, res) => {
  try {
    const { id } = req.params;
    let dbUser = null;
    try {
      dbUser = await User.findOne({ _id: id });
    } catch (error) { }
    if (!dbUser) {
      res.status(400).json({ msg: "user not found" });
    }
    dbUser.forceLogout = true;
    await dbUser.save();
    return res.status(200).json({ msg: "complete" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
});

router.get("/:id/permissions", [auth], async (req, res) => {
  try {
    const { params, method, baseUrl, route } = req;
    const { path } = route;
    const routeHash = await getRouteHash(baseUrl, method, path);

    let dbUser = null;
    try {
      dbUser = await User.findOne({ _id: params.id }).populate("permissions");
    } catch (error) { }
    if (!dbUser) {
      res.status(400).json({ msg: "user not found" });
    }
    const permissions = dbUser.permissions;
    res.status(200).json(permissions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
});

router.put("/:id/permissions", [auth], async (req, res) => {
  try {
    const { params, method, baseUrl, route, body } = req;
    const { path } = route;
    const routeHash = await getRouteHash(baseUrl, method, path);

    let dbUser = null;
    try {
      dbUser = await User.findOne({ _id: params.id });
    } catch (error) { }
    if (!dbUser) {
      res.status(400).json({ msg: "user not found" });
    }
    const oldperms = dbUser.permissions.map((perm) => perm.toString());
    dbUser.permissions = [...new Set([...oldperms, ...body])];
    const dbres = await dbUser.save();
    log = logPermissionChange(
      dbUser._id,
      dbUser.email,
      200,
      "permission updated",
      oldperms,
      db.User.permissions
    );
    putLog(log, "general", dbUser.defaultOrg.logGroup);
    res.status(200).json({ msg: "updated" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
});

router.put("/changeorg", [auth], async (req, res) => {
  try {
    const changeToOrg = req.body.orgID;
    const userOrgs = req.fullUser.orgs;
    if (!req.isSuper && !userOrgs.includes(changeToOrg)) {
      return res.status(401).json({ msg: "Unauthorized target org" });
    }

    const user = await User.findByIdAndUpdate(req.user, {
      defaultOrg: changeToOrg,
    });
    res.status(200).json({ msg: "Org Changed" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "serverError", err: error.message });
  }
});

module.exports = router;
