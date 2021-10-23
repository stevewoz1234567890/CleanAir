const express = require("express");
const router = express.Router();
const { getRouteHash } = require("../../../utils/auth/tokens");
const auth = require("../../../middleware/auth");
const { Job } = require('../../../utils/database/FRTModels');


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

// @route GET api/widgets/flarereporting/dataexport/options
// @desc Gets job
// @access Private
const TEST_IDS = ["EMISSIONS_TEST_JOBID"];
router.get('/', [auth], async (req, res) => {
    try {
        let meta = await getReqMeta(req);
        let org = meta.org._id.toString();
        let _id = meta.query.id;
        if (TEST_IDS.includes(_id)) {
            switch (_id) {
                case ("EMISSIONS_TEST_JOBID"):
                    return res.status(200).json({job:{isComplete : true, failed : false, info : { link : "https://flare-reporting.s3.amazonaws.com/templates/emissionsReportTemplate.xlsx" }}});
                default: 
                    throw new Error("Unmatched test ID")
            }
        }
        let job = await Job.findOne({org, _id}).lean().exec()
        return res.status(200).json({job});
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

module.exports = router;