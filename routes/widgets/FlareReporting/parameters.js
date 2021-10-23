const express = require('express');
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens');
const { Parameter } = require('../../../utils/database/FRTModels');
const auth = require('../../../middleware/auth');
const { response } = require('express');
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const {
  getPiTags
} = require('../../../utils/misc/getOrgData')

const maxLimit = 50;

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

// @route POST api/widgets/flarereporting/parameters/
// @desc Create a parameters
// @access Private
router.post('/', [auth], async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    const data = req.body;
    let newParam = new Parameter(data);

    try {
      var createResponse = newParam.save();
    } catch (err) {
            return res.status(400).json({ msg:"Could not save parameter", err: error.message })
    }

    //============================================
    //Here we are making the live calculator do an update of its formulas and the tester update its formulas
    try {
      let params = {
        FunctionName: "LiveFlareDataCalculator",
        Description: "",
      };
      let response = await Lambda.updateFunctionConfiguration(params).promise();

      params = {
        FunctionName: "flareReportingFormulaTester",
        Description: "",
      };
      response = await Lambda.updateFunctionConfiguration(params).promise();
    } catch (error) {
      res.status(500).json({ data: 'Could not update caches', err: error.message });
    }
    await getPiTags({force:true});

    return res.status(200).json({msg:"success", response:createResponse});
    //======================================

  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

// @route GET api/widgets/flarereporting/parameters/
// @desc Get all the parameters from the users org
// @access Private
router.get('/', [auth], async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    const data = req.body;
    const query = {};
    if ('valueType' in req.query) {
      query.valueType = req.query.valueType;
    }
    if ('id' in req.query) {
      query._id = req.query.id;
    }
    dbRes = await Parameter.find(query);
    return res.status(200).json({ data: dbRes, meta });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

// @route PUT api/widgets/flarereporting/parameters/:id
// @desc Update a parameters
// @access Private
router.put('/:id', [auth], async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    const { id } = req.params;
    const data = req.body;
    const dbRes = await Parameter.updateOne({ _id: id }, data);
    console.log(dbRes);
    if (dbRes.n == 0)
      return res.status(404).json({ data: 'Parameters Not Found' });
    if (dbRes.nModified == 0)
      return res.status(409).json({ data: 'Parameters Not Updated' });
    if (dbRes.nModified == 1) {

      //============================================
      //Here we are making the live calculator do an update of its formulas and the tester update its formulas
      try {
        let params = {
          FunctionName: "LiveFlareDataCalculator",
          Description: "",
        };
        let response = await Lambda.updateFunctionConfiguration(params).promise();

        params = {
          FunctionName: "flareReportingFormulaTester",
          Description: "",
        };
        response = await Lambda.updateFunctionConfiguration(params).promise();
        await getPiTags({force:true});
      } catch (error) {
        res.status(500).json({ data: 'Error refreshing cache', err: error.message });
      }
      //======================================

      return res.status(200).json({ data: 'Parameters Updated', meta });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

// @route DELETE api/widgets/flarereporting/parameters/:id
// @desc delete a parameters
// @access Private
router.delete('/:id', [auth], async (req, res) => {
  try {
    const meta = await getReqMeta(req);
    const { id } = req.params;
    await Parameter.deleteOne({ _id: id });

    //============================================
    //Here we are making the live calculator do an update of its formulas and the tester update its formulas
    try {
      let params = {
        FunctionName: "LiveFlareDataCalculator",
        Description: "",
      };
      let response = await Lambda.updateFunctionConfiguration(params).promise();

      params = {
        FunctionName: "flareReportingFormulaTester",
        Description: "",
      };
      response = await Lambda.updateFunctionConfiguration(params).promise();
      await getPiTags({force:true});
    } catch (error) {
      res.status(500).json({ data: 'Error refreshing cache', err: error.message });
    }
    //======================================


    return res.status(200).json({ data: 'deleted parameters', meta });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: 'serverError', err: error.message });
  }
});

module.exports = router;
