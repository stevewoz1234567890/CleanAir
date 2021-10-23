const express = require("express");
const router = express.Router();
const { getRouteHash } = require("../../../utils/auth/tokens");
const auth = require("../../../middleware/auth");
const { Job, Flare } = require('../../../utils/database/FRTModels');
const { getNumOptions } = require('../../../utils/misc/getOrgData')
const { ObjectId } = require('../../../utils/database/utils');
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const { ISOStringLongToShort } = require('../../../utils/dates/dates');

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

// @route POST api/widgets/flarereporting/generatereport/
// @desc Create a download link for report file
// @access Private
router.post("/", [auth], async (req, res) => {
  /**
   the user will pass in:
   debug, start, end, rule_ids, flare_id
   
   I will get:
   org, tz, (debug)
   */
  try {
    let meta = await getReqMeta(req);
    let payload = req.body;

    /** Building the body for the data puller */
    let requiredKeys = ["start", "end", "ruleIDs", "flareID"];
    let optionalkeys = ["debug"];
    let allKeys = requiredKeys.concat(optionalkeys)
    let hasRequiredKeys = Object.keys(payload).every(key => allKeys.includes(key)); //check for extra keys
    hasRequiredKeys = (requiredKeys.every(key => Object.keys(payload).includes(key))) && hasRequiredKeys; //check for missing keys
    if (!hasRequiredKeys) {
      res.status(400).json(
        {
          msg: 'Unexpected Payload. Check your keys',
          requiredKeys,
          optionalkeys
        });
    }
    payload.org = meta.org._id.toString();
    let matchingFlare = await Flare.findOne({ _id: payload.flareID }).lean().exec();
    if (matchingFlare) {
      console.log("flare: ", matchingFlare)
      if (matchingFlare.org.toString() !== payload.org) {
        return res.status(403).json({ msg: "Unauthorized access to flare" });
      }
    } else {
      res.status(404).json({ msg: "Could not find requested flare" });
    }

    let org = await ObjectId(payload.org);
    payload.tz = meta.org.toObject().timezone;

    if ("debug" in payload) {
      if (payload.debug && !meta.isSuper) payload.debug = false;
    }
    else payload.debug = false;
    if (meta.isDebugGuest) payload.debug = true;

    /** Building the body for the Job creator */
    let jobInit = {
      type: "general-report",
      org: org,
      user: meta.userId.toString()
    }
    let jobRes = await Job.create(jobInit);
    jobID = jobRes._id.toString();
    payload.jobID = jobID;

    let reportPayload = {
      start_date: payload.start,
      end_date: payload.end,
      rule_ids: payload.ruleIDs,
      flare_id: payload.flareID,
      debug: payload.debug,
      timezone: payload.tz,
      job_id: payload.jobID,
    }
    var params = {
      FunctionName: "flareReportingReportGenerator",
      InvocationType: "Event",
      Payload: JSON.stringify(reportPayload),
    };
    await Lambda.invoke(params).promise();
    return res.status(201).json({ msg: "Generating report.", jobID })
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: "serverError", err: error.message });
  }
});

// @route POST api/widgets/flarereporting/generatereport/emissions/
// @desc Create a download link for emissions report file
// @access Private
router.post("/emissions/", [auth], async (req, res) => {
  /**
   the user will pass in:
   debug, start, end, parameters, action, reportBinSize
   
   I will get:
   org, (debug)
   */
  try {
    let meta = await getReqMeta(req);
    let payload = req.body;

    /** Building the body for the data puller */
    let requiredKeys = ["start", "end", "parameters", "action", "reportBinSize"];
    let optionalkeys = ["debug"];
    let allKeys = requiredKeys.concat(optionalkeys)
    let hasRequiredKeys = Object.keys(payload).every(key => allKeys.includes(key)); //check for extra keys
    hasRequiredKeys = (requiredKeys.every(key => Object.keys(payload).includes(key))) && hasRequiredKeys; //check for missing keys
    if (!hasRequiredKeys) {
      res.status(400).json(
        {
          msg: 'Unexpected Payload. Check your keys',
          requiredKeys,
          optionalkeys
        });
    }

    /**Check for appropriate number of parameters */
    if (payload.parameters.length < 0 || payload.parameters.length > 6) {
      return res.status(400).json(
        {
          msg: `User must pick between 1-6 parameters. User selected ${payload.parameters.length}`,
        });
    }

    payload.org = meta.org._id.toString();
    let org = await ObjectId(payload.org);
    payload.tz = meta.org.toObject().timezone;

    /**Convert dates to the expected format. */
    payload.start = await ISOStringLongToShort(payload.start);
    payload.end = await ISOStringLongToShort(payload.end);

    /**Handle/check the debug attribute */
    if ("debug" in payload) {
      if (payload.debug && !meta.isSuper) payload.debug = false;
    }
    else payload.debug = false;
    if (meta.isDebugGuest) payload.debug = true;

    /** Building the body for the Job creator */
    let jobInit = {
      type: "emissions-report",
      org: org,
      user: meta.userId.toString()
    }

    // jobID = "EMISSIONS_TEST_JOBID";
    let jobRes = await Job.create(jobInit);
    jobID = jobRes._id.toString();
    payload.jobID = jobID;

    let reportPayload = {
      start: payload.start,
      end: payload.end,
      parameters: payload.parameters,
      reportBinSize: payload.reportBinSize,
      action: payload.action,
      debug: payload.debug,
      org: payload.org,
      jobID: jobID,
    }
    var params = {
      FunctionName: "flareReportingSummationReportsGenerator",
      InvocationType: "Event",
      Payload: JSON.stringify(reportPayload),
    };
    await Lambda.invoke(params).promise();
    let returnResponse = { msg: "Generating emissions report", jobID, }
    if (meta.isSuper) returnResponse.payload = reportPayload;
    return res.status(201).json(returnResponse);
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: "serverError", err: error.message });
  }
});

// @route POST api/widgets/flarereporting/generatereport/emissions/options/
// @desc Get the options for emissions reporting
// @access Private
router.get('/emissions/options/', [auth], async (req, res) => {
  try {
    let meta = await getReqMeta(req);
    let org = meta.org._id.toString();
    const numOptions = await getNumOptions(false, true, false);
    let optionsResponse = {
      maxParametersAllowed: 6,
      actions: ["sum"],
      reportBinSizes: ["monthly", "quarterly", "annual", "semi-annual"],
      parameters: {
        tags: [],
        formulas: numOptions.formulaData.filter(f => {
          return ["VG", "VOC", "Emission"].some(s => f.name.includes(s));
        }),
      }
    };
    return res.status(200).json({ message: "options successfully pulled", options: optionsResponse });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

module.exports = router;