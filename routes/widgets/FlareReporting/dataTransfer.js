const express = require("express");
const router = express.Router();
const { getRouteHash } = require("../../../utils/auth/tokens");
const auth = require("../../../middleware/auth");

const MOCK_FILE_LINK = "https://flare-reporting.s3.amazonaws.com/dummyFiles/dummy_template.xlsx";

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

// @route POST api/widgets/flarereporting/datatransfer/
// @desc Create a download link
// @access Private
router.post("/", [auth], async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    return res.status(200).json({ fileLink: MOCK_FILE_LINK, meta });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: "serverError", err: error.message });
  }
});

module.exports = router;