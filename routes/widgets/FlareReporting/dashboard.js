const express = require('express')
var { DateTime } = require('luxon');
require('dotenv').config();
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens')
const auth = require('../../../middleware/auth');
const {
    getPiTags,
    getFormulas,
    getFlares
} = require('../../../utils/misc/getOrgData');
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

// @route GET api/dashboard/init
// @desc get the initial charting metadata needed
// @access Private
router.get('/init', [auth], async (req, res) => {
    try {
        let x =await getReqMeta(req)
        let { org } = await getReqMeta(req);

        let pitags = await getPiTags();
        let formulas = await getFormulas();
        let flares = await getFlares();

        let dashboardInfo = org.toObject().dashboard;
        dashboardInfo.forEach((displayFlare, index, arr) => {
            arr[index].name = flares.find(f => f._id == displayFlare.flare).name;
            arr[index].data.forEach((field, fIndex, fArr) => {
                if (field.type == "pitag") {
                    fArr[fIndex].name = pitags.find(t => t._id == field.id).parameter.name
                }
                if (field.type == "formula") {
                    fArr[fIndex].name = formulas.find(t => t._id == field.id).name
                }
            });
        });

        return res.status(200).json(dashboardInfo)
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route GET api/dashboard/data
// @desc get the inital charting data
// @access Private
router.get('/data', [auth], async (req, res) => {
    try {
        let request = {};
        let { org, query, isSuper, isDebugGuest } = await getReqMeta(req);
        org = org.toObject();
        request.org = org._id.toString();
        request.tz = org.timezone;
        request.format = "dashboard-init";
        request.debug = false;
        request.requested = [];
        let now = DateTime.now().toSeconds()
        request.end = DateTime.fromSeconds(now).setZone(request.tz).toISO().substring(0, 16);
        request.start = DateTime.fromSeconds(now).setZone(request.tz).plus({ hours: -24 }).toISO().substring(0, 16);
        if ("debug" in query) {
            if ((query.debug == true || query.debug == 'true') && isSuper) request.debug = true;
        }
        if (isDebugGuest) request.debug = true;

        org.dashboard.forEach(flareGroup => {
            flareGroup.data.forEach(field => {
                let matchFound = false;
                for (let i = 0; i < request.requested.length; i++) {
                    if (field.type == "pitag") {
                        if (request.requested[i].id == field.id) matchFound = true;
                    } else {
                        if (
                            request.requested[i].id == field.id && 
                            request.requested[i].flare == field.flare &&
                            request.requested[i].header == field.header) {
                                matchFound = true;
                            }
                    }
                }
                //=====================
                if (field.type == "pitag") {
                    if (!matchFound) {
                        let { id, type } = field;
                        request.requested.push({ id, type });
                    }
                } else { //is of type formula
                    if (!matchFound) {
                        let { id, type, flare, header } = field;
                        request.requested.push({ id, type, flare, header }); 
                    }
                }
                //=====================
            })
        });

        const params = {
            FunctionName: "FormattedFlareDataPuller",
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(request),
        };
        let response = await Lambda.invoke(params).promise();
        let all = JSON.parse(response.Payload)
        let body = JSON.parse(all.body)

        return res.status(200).json(body)
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route POST api/dashboard/poll
// @desc get the inital charting data
// @access Private
/*
router.post('/poll', [auth], async (req, res) => {
    try {
        let request = {};
        let { org, isSuper } = await getReqMeta(req);
        let re = req.body;
        org = org.toObject();
        request.org = org._id.toString();
        request.tz = org.timezone;
        request.format = "dashboard-poll";
        request.debug = false;
        request.requested = [];
        let now = DateTime.now().toSeconds()
        request.end = DateTime.now().setZone(request.tz).toISO().substring(0,16);
        // request.end = DateTime.fromSeconds(now).setZone(request.tz).toISO().substring(0,16);
        // request.start = DateTime.fromSeconds(now).setZone(request.tz).plus({hours:-12}).toISO().substring(0,16);
        request.start = req.body.date;

        if ("debug" in req.body) {
            if (req.body.debug && isSuper) request.debug = true;
        }

        org.dashboard.forEach(flareGroup => {
            flareGroup.data.forEach(field => {
                let matchFound = false;
                for (let i = 0; i < request.requested.length; i++) {
                    if (request.requested[i].id == field.id) matchFound = true;
                }
                let {id,type} = field;
                if (!matchFound) request.requested.push({id, type});
            })
        });

        // const params = {
        //     FunctionName: "FormattedFlareDataPuller",
        //     InvocationType: "RequestResponse",
        //     Payload: JSON.stringify(request),
        // };
        // let response = await Lambda.invoke(params).promise();
        // let all = JSON.parse(response.Payload)
        // let body = JSON.parse(all.body)

        return res.status(200).json(request)
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});
*/


module.exports = router;