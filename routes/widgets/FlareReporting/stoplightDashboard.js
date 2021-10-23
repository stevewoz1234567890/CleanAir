require('dotenv').config();

const express = require('express')
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens')
const auth = require('../../../middleware/auth');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })


// var { DateTime } = require('luxon');
// const AWS = require('aws-sdk')
// const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const { getOrgInfo } = require('../../../utils/misc/getOrgData');
const maxLimit = 50

const getReqMeta = async (req) => {
    const { org, baseUrl, method, query, isSuper, isDebugGuest } = req
    const path = req.route.path
    const userId = req.user
    const routeId = await getRouteHash(baseUrl, method, path)
    if (!isSuper || !query.org) {
        query.org = org
    }
    return { org, baseUrl, method, query, isSuper, userId, routeId, path, isDebugGuest }
}

//'../../../utils/auth/tokens'
const initFilePath = path.join(__dirname, '..', '..', '..', 'utils', 'temp', 'stoplightDashboard', 'init.json');
const statusFilePath = path.join(__dirname, '..', '..', '..', 'utils', 'temp', 'stoplightDashboard', 'status.json');


// @route GET api/stoplightDashboard/init
// @desc get the initial data for building the table/chart
// @access Private
router.get('/init', [auth], async (req, res) => {
    try {
        let { org } = await getReqMeta(req);
        const dashboardInfo = await getOrgInfo(org._id.toString(), "stoplightDashboard");
        // const initFileString = dashboardInfo.data.instanceInfo;  //await fs.readFile(initFilePath, 'utf8');
        return res.status(200).json({ data: dashboardInfo.data.instanceInfo })
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route GET api/stoplightDashboard/status
// @desc get the stoplight colors for the dashboard
// @access Private
router.get('/status', [auth], async (req, res) => {
    try {
        let { org } = await getReqMeta(req);
        // const statusFileString = await fs.readFile(statusFilePath, 'utf8');
        let requestPayload = { org: org._id.toString() }
        var params = {
            FunctionName: "flareReportingStoplightDashboardStatus",
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(requestPayload),
        };
        let response = await Lambda.invoke(params).promise();
        response = JSON.parse(response.Payload);
        console.log(response);
        return res.status(200).json({ data: response.body.data })
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

module.exports = router;