const express = require('express')
require('dotenv').config();
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens');
const { Compound, Flare, Header } = require('../../../utils/database/FRTModels');
const { ObjectId } = require('../../../utils/database/utils');
const auth = require('../../../middleware/auth');
const { response } = require('express');
const {
    getNumOptions, getChartingOptions,
    getPiData
} = require('../../../utils/misc/getOrgData')
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



// @route GET api/widgets/flarereporting/charts/options
// @desc Gets the pulldown options for the chart
// @access Private
router.get('/options', [auth], async (req, res) => {
    try {
        const { numTags, formulaData } = await getChartingOptions()
        const data = { tags: numTags, formulas: formulaData }
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});


// @route POST api/charts/data/pull
// @desc get the charting data needed
// @access Private
router.post('/data/pull', [auth], async (req, res) => {
    try {
        let meta = await getReqMeta(req);
        let payload = req.body;

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
        payload.format = "charting";
        if ("debug" in payload) {
            if (payload.debug && !meta.isSuper) payload.debug = false;
        }
        else payload.debug = false;
        if(meta.isDebugGuest) payload.debug = true;


        try {
            //Change any formulas to have the flare and header ids
            for (let request of payload.requested) {
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
                    // console.log({ name: flareName, org }, { name: headerName, org })
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

        const params = {
            FunctionName: "FormattedFlareDataPuller",
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
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



// @route POST api/charts/data/fusion
// @desc Create a compound
// @access Private
router.post('/data/fusion', async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const data = req.body;
        const resolution = data.res == 'raw' ? 15 : 1440
        const fusionSchema = [
            {
                name: 'Date',
                type: 'date',
                format: '%Y-%m-%d %H:%M',
            },
        ];
        let dates = [];


        await Promise.all(data.tags.map(async (tag) => {
            const options = {
                start: data.start,
                end: data.end,
                res: resolution,
                op: "avg",
                tags: [tag.id],
                round: true,
                places: 4,
                array: true
            }

            const values = await getPiData(options)
            tag.values = values[0].values
            tag.dates = values[0].dates

            dates = [...dates, ...values[0].dates];
            return values
        }))
        const unqiueDates = Array.from(new Set(dates)).map((date) => [date]);

        for (const tag of data.tags) {
            fusionSchema.push({
                name: `${tag.primary} ${tag.secondary}`,
                type: 'number',
            });
            unqiueDates.map((date, index) => {
                date.push(tag.values[index])
            })
        }

        return res.status(200).json({ schema: fusionSchema, data: unqiueDates });

    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});


module.exports = router;