const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const { Invite, PermissionGroup, Permission } = require("../utils/database/models");
const { ObjectId } = require("../utils/database/utils");
const { getRouteHash } = require("../utils/auth/tokens");
const { sendInvite } = require("../utils/aws/Email");

const getReqMeta = async (req) => {
  const { org, baseUrl, method, query, isSuper } = req;
  const path = req.route.path;
  const userId = req.user;
  const routeId = await getRouteHash(baseUrl, method, path);
  const params = req.params;
  if (!isSuper || !query.org) {
    query.org = org;
  }
  return {
    org,
    baseUrl,
    method,
    query,
    isSuper,
    userId,
    routeId,
    path,
    params,
  };
};

/** 
 * Create an invitation for a user
*/
router.post("/", auth, async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    if (!meta.isSuper) return res.status(403).json({ msg: "User is forbidden from creating an invitation" });
    let { to, permissionGroup, force, permissions, toProd } = req.body;
    to = to.toLowerCase();

    /* Make sure there isnt an invite already created */
    const invite = await Invite.findOne({ to });
    if (invite && !force) {
      return res
        .status(400)
        .json({ msg: "invite already created for that user" });
    }

    /* Make sure the permissionGroup is a valid objectid */
    const idCheck = await ObjectId(permissionGroup);
    if (!idCheck) {
      return res.status(400).json({ msg: "invalid permissionGroup id" });
    }

    /* TODO:   We have to make sure the user can only invite to permissionGroups they are allowed to */

    /* Make sure it is a valid permission group */
    const permGrp = await PermissionGroup.findOne({ _id: permissionGroup });
    if (!permGrp) {
      return res.status(400).json({ msg: "invalid permission group" });
    }

    /* Validate individal permissions */
    for (permission of permissions) {
      let doc = await Permission.findOne({_id:permission}).lean().exec();
      if (!doc) return res.status(400).json({ msg: `permissions ${permission} does not exist` });
    }

    const inviteSchema = {
      from: meta.userId,
      to,
      org: meta.org,
      permissionGroup,
      permissions,
    };
    const newInvite = new Invite(inviteSchema);
    await newInvite.save();
    await sendInvite(to, newInvite._id, toProd);
    return res.json(newInvite);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "serverError" });
  }
});

module.exports = router;
