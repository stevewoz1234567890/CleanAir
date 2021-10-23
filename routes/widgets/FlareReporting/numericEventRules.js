const express = require('express')
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens')
const { NumericEventRule, Formula, PiTag } = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth');
const { getNumOptions } = require('../../../utils/misc/getOrgData');
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })

const maxLimit = 50

const getReqMeta = async (req) => {
    const { org, baseUrl, method, query, isSuper, params } = req
    const path = req.route.path
    const userId = req.user
    const routeId = await getRouteHash(baseUrl, method, path)
    if (!isSuper || !query.org) {
        query.org = org
    }
    return { org, baseUrl, method, query, isSuper, userId, routeId, path, params }
}

const PARAMS = {
    resolution: [1, 15],
    parameterType: ["pitag", "formula"],
    use: ["alarming"],
    actionPeriod: ["day", "month", "year"],
    actionPeriodAction: ["rolling", "to-date"],
    actionOperation: ["sum"],
    actionInequality: [">", ">=", "<", "<=", "="],
    EXPECTED: ["name", "resolution", "parameter", "parameterType", "use", "actionPeriodLength", "actionPeriod", "actionPeriodAction", "actionOperation", "actionInequality", "actionValue"],
}

// @route POST api/widgets/flarereporting/numeric-event-rules/
// @desc Create a eventrule
// @access Private
router.post('/', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper, org } = meta;
        let { name, resolution, parameter, parameterType,
            use, actionPeriodLength, actionPeriod, actionPeriodAction, actionOperation, actionInequality,
            actionValue, } = req.body; //only keep the inputs that we know are valid
        if (!Array.isArray(use)) use = [];

        const regex = new RegExp(/ /gm);
        actionOperation = actionOperation.replace(regex, "_");
        actionPeriod = actionPeriod.replace(regex, "_");

        //validation     
        if (!PARAMS.resolution.includes(resolution)) return res.status(400).json({ msg: "Unexpected value for 'resolution'" });
        if (!PARAMS.parameterType.includes(parameterType)) return res.status(400).json({ msg: "Unexpected value for 'parameterType'" });
        const unmatchedUse = use.some(u => !PARAMS.use.includes(u))
        if (unmatchedUse) return res.status(400).json({ msg: "Unexpected value for 'use'" });
        if (!PARAMS.actionPeriod.includes(actionPeriod)) return res.status(400).json({ msg: "Unexpected value for 'actionPeriod'" });
        if (!PARAMS.actionPeriodAction.includes(actionPeriodAction)) return res.status(400).json({ msg: "Unexpected value for 'actionPeriodAction'" });
        if (!PARAMS.actionOperation.includes(actionOperation)) return res.status(400).json({ msg: "Unexpected value for 'actionOperation'" });
        if (!PARAMS.actionInequality.includes(actionInequality)) return res.status(400).json({ msg: "Unexpected value for 'actionInequality'" });
        if (typeof actionValue !== 'number') return res.status(400).json({ msg: "Unexpected value for 'actionValue'" });
        if (typeof actionPeriodLength !== 'number') return res.status(400).json({ msg: "Unexpected value for 'actionPeriodLength'" });
        const existingRules = await NumericEventRule.find({ org: org._id.toString() }).select('name').lean().exec();
        if (existingRules.some(r => r.name === name)) return res.status(400).json({ msg: "An numeric event already exists for that name" });

        const newEventRule = {
            name, resolution, org: org._id.toString(),
            parameter, parameterType, use,
            actionPeriodLength, actionPeriod, actionPeriodAction, actionOperation, actionInequality,
            actionValue, subscribers: [],
        }
        let createdRule = await NumericEventRule.create(newEventRule);
        createdRule = createdRule.toObject();
        createdRule.type = "numeric";

        //Updating the parameter so it has the relationship of that num. event rule being related to it
        if (createdRule.parameterType === "formula") {
            const formula = await Formula.findOneAndUpdate({ _id: parameter }, { $push: { numericEventRules: createdRule._id }, lastUpdate: Date.now() });
            try {
                if (formula.n === 0) return res.status(404).json({ msg: "Formula Not Found" });
                if (formula.nModified === 0) return res.status(409).json({ msg: "Formula Not Updated" });
                if (formula.nModified === 1) { /** success */ }
            } catch (e) { console.log("failed to update formula with eventRule") }
        } else if (createdRule.parameterType === "pitag") {
            const pitag = await PiTag.findOneAndUpdate({ _id: parameter }, { $push: { numericEventRules: createdRule._id }, lastUpdate: Date.now() });
            try {
                if (pitag.n === 0) return res.status(404).json({ msg: "Pitag Not Found" });
                if (pitag.nModified === 0) return res.status(409).json({ msg: "Pitag Not Updated" });
                if (pitag.nModified === 1) { /** success */ }
            } catch (e) { console.log("failed to update formula with eventRule") }
        } else { return res.status(400).json({ msg: "field 'parameterType' is missing" }); }

        try { //so it updates is set of rules
            let lambdaParams = {
                FunctionName: "flareReportingDataToSQS",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
            lambdaParams = {
                FunctionName: "liveNumericEventProcessor",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
        } catch (error) {
            return res.status(400).json({ msg: "Rule saved, but not propogated", "error": error.message })
        }

        return res.status(200).json({ data: createdRule });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route GET api/widgets/flarereporting/numeric-event-rules/
// @desc Get eventrules for that users default org
// @access Private
router.get('/', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper } = meta;
        const query = { org: meta.org._id }
        const allowedQueryKeys = ['id', 'name'];
        for (const key of allowedQueryKeys) {
            if (meta.query[key]) query[key] = meta.query[key]
        }
        const regex = new RegExp(/ /gm);
        let eventRules = await NumericEventRule.find(query).select('-subscribers -createdDate -lastUpdated').lean().exec();
        eventRules = eventRules.map(r => {
            r.actionPeriod = r.actionPeriod.replace(regex, "_");
            r.type = "numeric";
            r.use = r.use ?? [];
            return r;
        });
        return res.status(200).json({ data: eventRules });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route PUT api/widgets/flarereporting/numeric-event-rules/:id
// @desc Update a eventrule
// @access Private
router.put('/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper } = meta;
        const { id } = req.params;
        let updatedFields = { lastUpdate: Date.now() };
        for (let param of PARAMS.EXPECTED) {
            if (req.body[param] !== undefined) updatedFields[param] = req.body[param];
        }
        const regex = new RegExp(/ /gm);
        if (updatedFields.use !== undefined && !Array.isArray(updatedFields.use)) updatedFields.use = [];
        if (updatedFields.actionOperation) updatedFields.actionOperation = updatedFields.actionOperation.replace(regex, "_");
        if (updatedFields.actionPeriod) updatedFields.actionPeriod = updatedFields.actionPeriod.replace(regex, "_");

        //validation
        if (updatedFields.resolution && !PARAMS.resolution.includes(updatedFields.resolution)) return res.status(400).json({ msg: "Unexpected value for 'resolution'" });
        if (updatedFields.parameterType && !PARAMS.parameterType.includes(updatedFields.parameterType)) return res.status(400).json({ msg: "Unexpected value for 'parameterType'" });
        if (updatedFields.use) {
            const unmatchedUse = updatedFields.use.some(u => !PARAMS.use.includes(u))
            if (unmatchedUse) return res.status(400).json({ msg: "Unexpected value for 'use'" });
        }
        if (updatedFields.actionPeriod && !PARAMS.actionPeriod.includes(updatedFields.actionPeriod)) return res.status(400).json({ msg: "Unexpected value for 'actionPeriod'" });
        if (updatedFields.actionPeriodAction && !PARAMS.actionPeriodAction.includes(updatedFields.actionPeriodAction)) return res.status(400).json({ msg: "Unexpected value for 'actionPeriodAction'" });
        if (updatedFields.actionOperation && !PARAMS.actionOperation.includes(updatedFields.actionOperation)) return res.status(400).json({ msg: "Unexpected value for 'actionOperation'" });
        if (updatedFields.actionInequality && !PARAMS.actionInequality.includes(updatedFields.actionInequality)) return res.status(400).json({ msg: "Unexpected value for 'actionInequality'" });
        if (updatedFields.actionValue && typeof updatedFields.actionValue !== 'number') return res.status(400).json({ msg: "Unexpected value for 'actionValue'" });
        if (updatedFields.actionPeriodLength && typeof updatedFields.actionPeriodLength !== 'number') return res.status(400).json({ msg: "Unexpected value for 'actionPeriodLength'" });
        const existingRules = await NumericEventRule.find({ org: meta.org._id.toString() }).select('name').lean().exec();
        if (existingRules.some(r => r.name === updatedFields.name && r._id.toString() !== id)) return res.status(400).json({ msg: "An numeric event already exists for that name" });
        if (updatedFields.parameter) {
            let matchingRule = await NumericEventRule.findOne({ _id: id }).lean().exec();
            if (!updatedFields.parameterType) return res.status(400).json({ msg: "Missing field 'parameterType'" });
            /**
            - remove numericEventRule from parameter (formulas, pitags)
            - add numericEventRules to parameter (formula, pitag)
             */
            let response = null;
            if (matchingRule.parameterType === "formula") response = await Formula.updateOne({ _id: matchingRule.parameter }, { $pull: { numericEventRules: id } });
            if (matchingRule.parameterType === "pitag") response = await PiTag.updateOne({ _id: matchingRule.parameter }, { $pull: { numericEventRules: id } });
            if (response.n === 0) return res.status(404).json({ msg: "Parameter Not Found" });
            if (response.nModified === 0) return res.status(409).json({ msg: "Parameter Not Updated" });

            //Updating the parameter so it has the relationship of that num. event rule being related to it
            if (updatedFields.parameterType === "formula") {
                const formula = await Formula.findOneAndUpdate({ _id: updatedFields.parameter }, { $push: { numericEventRules: matchingRule._id }, lastUpdate: Date.now() });
                try {
                    if (formula.n === 0) return res.status(404).json({ msg: "Formula Not Found" });
                    if (formula.nModified === 0) return res.status(409).json({ msg: "Formula Not Updated" });
                    if (formula.nModified === 1) { /** success */ }
                } catch (e) { console.log("failed to update formula with eventRule") }
            } else if (updatedFields.parameterType === "pitag") {
                const pitag = await PiTag.findOneAndUpdate({ _id: updatedFields.parameter }, { $push: { numericEventRules: matchingRule._id }, lastUpdate: Date.now() });
                try {
                    if (pitag.n === 0) return res.status(404).json({ msg: "Pitag Not Found" });
                    if (pitag.nModified === 0) return res.status(409).json({ msg: "Pitag Not Updated" });
                    if (pitag.nModified === 1) { /** success */ }
                } catch (e) { console.log("failed to update formula with eventRule") }
            } else { return res.status(400).json({ msg: "field 'parameterType' is missing" }); }
        }

        const dbRes = await NumericEventRule.updateOne({ _id: id }, updatedFields);
        if (dbRes.n === 0) return res.status(404).json({ msg: "EventRule Not Found" });
        if (dbRes.nModified === 0) return res.status(409).json({ msg: "EventRule Not Updated" });
        const updatedEvent = NumericEventRule.findOne({ _id: id }).select('-subscribers -createdDate -lastUpdated').lean().exec();

        try { //so it updates is set of rules
            let lambdaParams = {
                FunctionName: "flareReportingDataToSQS",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
            lambdaParams = {
                FunctionName: "liveNumericEventProcessor",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
        } catch (error) {
            return res.status(400).json({ msg: "Rule saved, but not propogated", "error": error.message })
        }

        return res.status(200).json({ msg: "formula Updated", data: updatedEvent });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route DELETE api/widgets/flarereporting/numeric-event-rules/:id
// @desc delete a eventrule
// @access Private
router.delete('/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req)
        const { id } = req.params;
        await Formula.updateMany(
            {},
            { $pull: { numericEventRules: id } }
        );
        await PiTag.updateMany(
            {},
            { $pull: { numericEventRules: id } }
        );
        await NumericEventRule.deleteOne({ _id: id });

        try { //so it updates is set of rules
            let lambdaParams = {
                FunctionName: "flareReportingDataToSQS",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
            lambdaParams = {
                FunctionName: "liveNumericEventProcessor",
                Description: "",
            };
            await Lambda.updateFunctionConfiguration(lambdaParams).promise();
        } catch (error) {
            return res.status(400).json({ msg: "Rule saved, but not propogated", "error": error.message })
        }

        return res.status(200).json({ msg: "rule deleted" })
    } catch (error) {
        console.log(error)
        res.status(500).json({ data: 'serverError', err: error.message })
    }
});

//================================================================
// @route GET api/widgets/flarereporting/numeric-event-rules/options/
// @desc Get eventrules options 
// @access Private
router.get('/options/', [auth], async (req, res) => {
    try {
        let numOptions = await getNumOptions(false, true, true);
        const regex = new RegExp(/_/gm);
        let actionPeriods = PARAMS.actionPeriod.map(p => {
            return p.replace(regex, " ");
        });
        const options = {
            resolution: PARAMS.resolution,
            use: PARAMS.use,
            actionPeriod: actionPeriods,
            actionPeriodAction: PARAMS.actionPeriodAction,
            actionOperation: PARAMS.actionOperation,
            actionInequality: PARAMS.actionInequality,
            parameters: { formulaData: numOptions.formulaData, numericPitags: numOptions.numTags },
        }
        return res.status(200).json({ data: options });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});


//==========  Subscription actions ================//

// @route GET api/widgets/flarereporting/eventrules/subscriptions
// @desc get all your subscriptions
// @access Private
router.get('/subscriptions', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        let rules = await NumericEventRule.find(
            { subscribers: meta.userId.toString(), org: meta.org._id.toString() },
            '-subscribers'
        ).lean().exec();
        for (let rule of rules) rule.type = "numeric";
        return res.status(200).json({ data: rules });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});


// @route PUT api/widgets/flarereporting/eventrules/subscribe/:id
// @desc subscribe to an event rule (can only subscribe self, use root put to manipulate all subs)
// @access Private
router.put('/subscribe/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { id } = req.params;
        const updateRes = await NumericEventRule.updateOne(
            { _id: id },
            { $addToSet: { subscribers: meta.userId.toString() } },
        );
        if (updateRes.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
        if (updateRes.nModified == 0) return res.status(409).json({ msg: "Could not subscribe. Check if you are already subscribed" });
        if (updateRes.nModified == 1) return res.status(200).json({ msg: "Subscribed" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route PUT api/widgets/flarereporting/eventrules/unsubscribe/:id
// @desc unsubscribe to an event rule (can only unsubscribe self)
// @access Private
router.put('/unsubscribe/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { id } = req.params;
        const updateRes = await NumericEventRule.updateOne({ _id: id }, { $pull: { subscribers: meta.userId } });
        if (updateRes.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
        if (updateRes.nModified == 0) return res.status(409).json({ msg: "Could not unsubscribe. Check if you were already unsubscribed" });
        if (updateRes.nModified == 1) return res.status(200).json({ msg: "Unsubscribed" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});


module.exports = router;