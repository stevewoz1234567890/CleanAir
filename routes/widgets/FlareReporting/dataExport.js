const express = require("express");
const router = express.Router();
const { getRouteHash } = require("../../../utils/auth/tokens");
const auth = require("../../../middleware/auth");
const { getNumOptions, getExportOptions } = require('../../../utils/misc/getOrgData')
const { Job, Flare, Header } = require('../../../utils/database/FRTModels');
const { ObjectId } = require('../../../utils/database/utils');

const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })


const getReqMeta = async (req) => {
  const { org, baseUrl, method, query, isSuper, isDebugGuest } = req;
  const path = req.route.path;
  const userId = req.user;
  const routeId = await getRouteHash(baseUrl, method, path);
  if (!isSuper || !query.org) {
    query.org = org;
  }
  return { org, baseUrl, method, query, isSuper, userId, routeId, path, isDebugGuest };
};

// @route POST api/widgets/flarereporting/dataexport/
// @desc Create a download link and populate table data
// @access Private
router.post("/", [auth], async (req, res) => {
  try {
    let meta = await getReqMeta(req);
    let payload = req.body;

    // console.log("META: ", meta)

    /** Building the body for the data puller */
    let requiredKeys = ["requested", "start", "end"];
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
    let org = await ObjectId(payload.org);
    payload.tz = meta.org.toObject().timezone;

    payload.format = "data-dump";
    if ("debug" in payload) {
      if (payload.debug && !meta.isSuper) payload.debug = false;
    }
    else payload.debug = false;
    if(meta.isDebugGuest) payload.debug = true;

    try {
      //Change any formulas to have the flare and header ids
      for (let request of payload.requested) {
        if (request.type === undefined) return res.status(400).json({msg: `requested item ${request.id} is missing required 'type' field`})
        if (request.type != "formula") continue;
        let parentName = request.parentName;
        let numSpaces = (parentName.match(/ /g) || []).length;
        if (numSpaces === 0) { //is presumably a flare formula
          let flare = await Flare.findOne({ name: parentName, org }).lean().exec();
          request.flare = flare._id;
          request.header = null;
        }
        else {
          let flareName = parentName.substr(0, parentName.indexOf(' ')); // Flare Name
          let headerName = parentName;
          console.log({ name: flareName, org }, { name: headerName, org })
          let flare = await Flare.findOne({ name: flareName, org }).lean().exec();
          let header = await Header.findOne({ name: headerName, org }).lean().exec();
          request.flare = flare._id;
          request.header = header._id;
        }
      }
    }
    catch (error) {
      console.log(error);
      res.status(500).json({ data: `Failed to match a parent name.`, err: error.message });
    }


    /** Building the body for the Job creator */
    let jobInit = {
      type: "data-export",
      org: org, 
      user: meta.userId.toString() //erick
    }
    let jobRes = await Job.create(jobInit);
    jobID = jobRes._id.toString();

    payload.jobID = jobID; 

    var params = {
      FunctionName: "FormattedFlareDataPuller",
      InvocationType: "Event",
      Payload: JSON.stringify(payload),
    };
    await Lambda.invoke(params).promise();

    return res.status(201).json({msg: "Generating data export file...", jobID})



    // const meta = await getReqMeta(req);
    // return res.status(200).json({ fileLink: MOCK_FILE_LINK, data: MOCK_DATA, meta });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: "serverError", err: error.message });
  }
});

// @route GET api/widgets/flarereporting/dataexport/options
// @desc Gets the pulldown options for the chart
// @access Private
router.get('/options', [auth], async (req, res) => {
  try {
    const { tags, formulaData } = await getExportOptions()
    const data = { tags: tags, formulas: formulaData }
    // console.log("tags: ",tags)
    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

module.exports = router;