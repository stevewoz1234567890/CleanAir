const express = require('express')
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens')
const { EventRule, Formula } = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth');
const { response } = require('express');
const { meanDependencies } = require('mathjs');

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


// @route POST api/widgets/flarereporting/eventrules/
// @desc Create a eventrule
// @access Private
router.post('/', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper } = meta;
        const data = req.body;
        const checkForValueType = "formula" //data.checkForValueType;
        data.org = meta.org._id;
        if (data.checkForValue !== null) {
            switch (checkForValueType) {
                case "formula":
                    data.checkForValueType = "formulavalue";
                    break;
                case "parameter":
                    data.checkForValueType = "pivalue";
                    break;
                default:
                    data.checkForValueType = "unassigned";
                    break;
            }
        } else data.checkForValueType = "unassigned";
        if (isSuper && ("org" in meta.query.org)) {
            data.org = meta.query.org;
        }
        if (!isSuper && ('subscribers' in data)) {
            delete data.subscribers;
        }

        // console.log(data, checkForValueType)
        // return res.status(200).json({ data, meta });
        const dbRes = await EventRule.create(data);
        if (dbRes && data.checkForValue !== null) {
            if (checkForValueType === "formula") {
                const formula = await Formula.findOneAndUpdate({ _id: data.checkForValue }, { eventRule: dbRes._id.toString() });
                try {
                    if (formula.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
                    if (formula.nModified == 0) return res.status(409).json({ msg: "EventRule Not Updated" });
                    if (formula.nModified == 1) { /** success */ }
                } catch (e) { console.log("failed to update formula with eventRule") }
            }
        }
        return res.status(200).json({ data: dbRes });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route GET api/widgets/flarereporting/eventrules/
// @desc Get eventrules for that users default org
// @access Private
router.get('/', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper } = meta;
        const data = req.body;
        const query = { org: meta.org._id }
        const allowedQueryKeys = ['id', 'checkForValue', 'subscribers', 'name', 'formula'];
        for (const key of allowedQueryKeys) {
            if (key === 'id' && 'id' in meta.query) {
                query._id = meta.query.id;
                continue;
            }
            if (meta.query[key]) query[key] = meta.query[key]

        }
        if (!isSuper && ('subscribers' in data)) {
            delete data.subscribers;
        }
        console.log(query);
        dbRes = await EventRule.find(query).select('-subscribers').lean().exec();
        dbRes = dbRes.map(e => {
            e.type = "boolean";
            return e;
        });
        return res.status(200).json({ data: dbRes, meta });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route PUT api/widgets/flarereporting/eventrules/:id
// @desc Update a eventrule
// @access Private
router.put('/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const { isSuper } = meta;
        const { id } = req.params;
        const data = req.body;
        const checkForValueType = "formula"; //data.checkForValueType;
        const checkForValue = data.checkForValue;

        if (data.checkForValue !== null) {
            switch (checkForValueType) {
                case "formula":
                    data.checkForValueType = "formulavalue";
                    break;
                case "parameter":
                    data.checkForValueType = "pivalue";
                    break;
                default:
                    data.checkForValueType = "unassigned";
                    break;
            }
        } else data.checkForValueType = "unassigned";

        if (!isSuper && ('subscribers' in data)) {
            delete data.subscribers;
        }
        data.lastUpdate = Date.now()
        const orignalEventRule = await EventRule.findOne({_id:id}).lean();
        const dbRes = await EventRule.updateOne({ _id: id }, data);
        if (!isSuper && ('subscribers' in data)) {
            delete data.subscribers;
        }
        if (dbRes.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
        if (dbRes.nModified == 0) return res.status(409).json({ msg: "EventRule Not Updated" });

        if (checkForValue) {
            const formula = await Formula.findOneAndUpdate({ _id: checkForValue }, { eventRule: id });
            try {
                if (formula.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
                if (formula.nModified == 0) return res.status(409).json({ msg: "formula Not Updated" });
                if (formula.nModified == 1) return res.status(200).json({ msg: "formula Updated", meta });
            } catch (e) { console.log("failed to update formula with eventRule") }
        } else {
            const formula = await Formula.findOneAndUpdate({ _id: orignalEventRule.checkForValue.toString() }, { eventRule: null });
            try {
                if (formula.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
                if (formula.nModified == 0) return res.status(409).json({ msg: "formula Not Updated" });
                if (formula.nModified == 1) return res.status(200).json({ msg: "formula Updated", meta });
            } catch (e) { console.log("failed to update formula with eventRule") }
        }
        return res.status(200).json({ msg: "formula Updated End", meta });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});

// @route DELETE api/widgets/flarereporting/eventrules/:id
// @desc delete a eventrule
// @access Private
router.delete('/:id', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req)
        const { id } = req.params;
        await EventRule.deleteOne({ _id: id });
        return res.status(200).json({ data: "deleted eventrule", meta })
    } catch (error) {
        console.log(error)
        res.status(500).json({ data: 'serverError', err: error.message })
    }
});

//==========  Subscription actions ================//

// @route GET api/widgets/flarereporting/eventrules/subscriptions
// @desc get all your subscriptions
// @access Private
router.get('/subscriptions', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        const rules = await EventRule.find(
            { subscribers: meta.userId, org: meta.org._id },
            '-subscribers'
        ).lean().exec();
        for (let rule of rules) rule.type = "boolean";
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
        const updateRes = await EventRule.updateOne(
            { _id: id },
            { $addToSet: { subscribers: meta.userId } },
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
        const updateRes = await EventRule.updateOne({ _id: id }, { $pull: { subscribers: meta.userId } });
        if (updateRes.n == 0) return res.status(404).json({ msg: "EventRule Not Found" });
        if (updateRes.nModified == 0) return res.status(409).json({ msg: "Could not unsubscribe. Check if you were already unsubscribed" });
        if (updateRes.nModified == 1) return res.status(200).json({ msg: "Unsubscribed" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ data: 'serverError', err: error.message });
    }
});





module.exports = router;