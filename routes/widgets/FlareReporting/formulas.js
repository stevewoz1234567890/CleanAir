const express = require('express')
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
const router = express.Router();
const { getRouteHash } = require('../../../utils/auth/tokens')
const { Formula } = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth')
const axios = require('axios')
const {
    getVariableValue,
    parseFormulas,
    getFormulas,
    parseIncomingFormula,
    getTreeData,
    getPiData,
    getFormulaDepends,
    getParamValue,
    getCGroupValues,
    getConstantValue,
    getFlareAttr,
    getCompoundValue,
    getAllFormulaValues,
    varNamesToIds,
    CalcFormula
} = require('../../../utils/misc/getOrgData')
const colorLogger = require('../../../utils/misc/colorLogger');
const { ObjectID } = require('mongodb');
const { composition, re } = require('mathjs');

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

const projection = {
    __v: 0,
    password: 0,
    previousPasswords: 0
}


// @route GET api/widgets/flarereporting/formulas/all
// @desc get a formula
// @access Private
router.get('/:all?', [auth], async (req, res) => {
    try {
        // console.log(req.params)
        const meta = await getReqMeta(req)
        const { page, limit, isSuper, org } = meta
        const options = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) > maxLimit ? maxLimit : parseInt(limit) : 10,
            customLabels: { meta: 'pagination' },
            projection: projection,
            sort: { createdDate: 1 }
        };

        const allowedQueryKeys = ['_id', 'name', 'to', 'dataType']
        const query = {}
        for (const key of allowedQueryKeys) {
            if (meta.query[key]) query[key] = meta.query[key]
        }
        if (!isSuper || !query.org) {
            query.org = org
        }

        if (req.params.all) {
            const data = await parseFormulas({ force: true })
            return res.status(200).json({ data, meta })
        }


        const dbRes = await Formula.paginate(query, options)
        const data = dbRes.docs
        meta.pagination = dbRes.pagination

        return res.status(200).json({ data, meta })
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
    //res.send(req.body)
});


// @route POST api/widgets/flarereporting/formulas/
// @desc create a formula
// @access Private
router.post('/', [auth], async (req, res) => {

    try {
        const meta = await getReqMeta(req)
        const body = req.body
        const { name, formula, to, dataType } = body
        if (to == 'header') to = 'headers';
        let org = meta.org._id;
        if (meta.isSuper && req.body.org) {
            org = req.body.org
        }
        const foundFormula = await Formula.findOne({ name, org })
        if (foundFormula) {
            return res.status(400).json({ msg: "Formula name already in use" })
        }

        let newFormula = null;
        try {
            newFormula = await varNamesToIds(formula);
        } catch (error) {
            console.log("Error creating/parsing new formula");
            return res.status(400).json({ msg: "Failed to parse new formula.", error: error.message });
        }


        // let template = {
        //     name,
        //     formula,
        //     newFormula,
        //     to,
        //     dataType,
        //     org
        // }
        const obj = new Formula({ name, formula, newFormula, to, dataType, org });

        let data = null;
        try {
            data = await obj.save();

            try { //so it updates is set of formulas
                const params = {
                    FunctionName: "flareReportingFormulaTester",
                    Description: "",
                };
                let response = await Lambda.updateFunctionConfiguration(params).promise();
            } catch(error) {
                return res.status(400).json({ msg: "Formula saved, but tester not updated", "error": error.message })
            }
        } catch (error) {
            console.log("Could not save formula.");
            return res.status(400).json({ msg: error.message })
        }
        await getFormulas({ force: true });

        let msg = "formula saved and tester updated"

        try {
            params = {
                FunctionName: "flareReportingFormulaTester",
                Description: "",
            };
            response = await Lambda.updateFunctionConfiguration(params).promise();
        } catch (err){
            msg = "formula saved and tester failed to update"
        }

        // return res.status(200).json(template);
        return res.status(200).json({ msg, data, meta });
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
    //res.send(req.body)
});


// @route PUT api/widgets/flarereporting/formulas/
// @desc update a formula
// @access Private
router.put('/', [auth], async (req, res) => {

    try {
        // const io = req.app.get('socketio');
        const meta = await getReqMeta(req);
        let org = meta.org._id
        if (meta.isSuper && req.body.org) {
            org = req.body.org
        }
        const updateRequest = req.body;
        // console.log({ body });
        // const updateRequest = body.selected;
        const _id = updateRequest._id;

        /* Make sure the formula id is valid */
        const filter = { _id, org };
        const foundFormula = await Formula.findOne(filter).lean().exec();
        if (!foundFormula) {
            return res.status(400).json({ msg: "Cannot find Formula" })
        }

        let isFormulaEdited = false; // will be used to see if parsing is needed and if formula body is part of update
        let fieldsToUpdate = [];
        const permittedParams = ["name", "to", "dataType", "formula"];
        let update = {};
        update.lastUpdate = Date.now();
        for (key in updateRequest) { //make sure we only update on valid fields
            if (permittedParams.includes(key)) {
                if (updateRequest[key] !== foundFormula[key]) {
                    fieldsToUpdate.push(key);
                    if (key === "formula") {
                        isFormulaEdited = true;
                        update.newFormula = updateRequest[key];
                        continue;
                    }
                    update[key] = updateRequest[key];
                }
            }
        }

        if (fieldsToUpdate.length == 0) {
            return res.status(200).json({ msg: "No fields to update" })
        }


        /* If the name has changed, make sure the new name is unique */
        if (update.name !== undefined && update.name !== foundFormula.name) { //if has name field and is differnt from the record
            let name = update.name;
            if (foundFormula.name !== name) {
                const foundName = await Formula.findOne({ name, org }).lean().exec();
                if (foundName) {
                    return res.status(400).json({ msg: "Name Already Used" })
                }
            }
        }

        /* Convert the names to IDs */
        try {
            if (isFormulaEdited) update.newFormula = await varNamesToIds(update.newFormula, {force:true});
        } catch (error) {
            
            return res.status(400).json({ msg: "Failed to parse formula.", error: error.message });
        }

        const dbRes = await Formula.findOneAndUpdate(filter, update, { new: true, rawResult: true });
        if (dbRes.lastErrorObject.n == 0) {
            return res.status(400).json({ msg: "Formula to update not found" });
        }
        if (dbRes.lastErrorObject.updatedExisting === false) { //I'm not sure this works
            return res.status(400).json({ msg: "Formula was not updated" });
        }

        await getFormulas({ force: true });
        // const formulas = await parseFormulas();

        // io.emit("formulas", { formulas, current: dbRes });
        // return res.status(200).json({ data: dbRes, meta });
        
        let msg = `Updated fields: ${fieldsToUpdate}`;

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
        } catch(error) {
            msg = msg + " But failed to force-update live data calculator and tester"
            return res.status(500).json({ msg, data: dbRes.value, meta })
        }
        //======================================

        return res.status(200).json({ msg, data: dbRes.value, meta })
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
});

// @route DELETE api/widgets/flarereporting/formulas/:id
// @desc delete a formula
// @access Private
router.delete('/:id', [auth], async (req, res) => {
    try {
        //TODO delete data from database
        const meta = await getReqMeta(req)
        // console.log(req)
        const {id} = req.params;
        const filter = { _id: id, org: meta.org._id };
        await Formula.deleteOne(filter);

        //============================================
        let msg = "formula deleted and caches refreshed"
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
        } catch(error) {
            msg = "Formula deleted but failed to force-update live data calculator and tester"
            return res.status(500).json({ msg, data: dbRes.value, meta })
        }
        //======================================
        


        await getFormulas({ force: true });
        return res.status(200).json({
            msg, 
            meta
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'serverError', errMsg: error.message, error })
    }
});


//=========================================================================================
//=========================================================================================
//=========================================================================================

// @route PUT api/widgets/flarereporting/formulas/commit
// @desc commit a formula
// @access Private
router.put('/commit', [auth], async (req, res) => {
    try {
        const meta = await getReqMeta(req);
        let org = meta.org._id;
        if (meta.isSuper && req.body.org) {
            org = req.body.org
        }
        const _id = req.body._id;

        const dbRes = await Formula.findOneAndUpdate({ _id, org }, { committed: true }, { new: true, rawResult: true });
        if (dbRes.lastErrorObject.n == 0) {
            return res.status(400).json({ msg: "formula to commit not found" });
        }
        if (dbRes.lastErrorObject.updatedExisting === false) { //I'm not sure this works
            return res.status(400).json({ msg: "formula was not commited" });
        }
        await getFormulas({ force: true });

        //Logic for updating the live data calculator to start using these new formulas
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
        

        return res.status(200).json({ msg: "successfully commited", data: dbRes.value })
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
});

// @route POST api/widgets/flarereporting/formulas/test
// @desc test a formula
// @access Private
router.post('/test', [auth], async (req, res) => {
    try {
        let meta = await getReqMeta(req);
        let payload = req.body;

        let requiredKeys = ["flareID", "debug", "formula", "date"];
        let optionalkeys = ["debug", "headerID", "to"];
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
        if (payload.formula.name == null) payload.formula.name = "test";

        if (payload.formula.isNewFormula) {
            if (payload.formula.id !== null) return res.status(400).json({ msg: "'id' should be 'null' when 'isNewFormula' is 'true'" });
            if (payload.formula.logic == null) return res.status(400).json({ msg: "'logic' should not be 'null' when 'isNewFormula' is 'true'" });
            if (payload.formula.to == null) return res.status(400).json({ msg: "'to' should not be 'null' when 'isNewFormula' is 'true'" });
            try {
                payload.formula.logic = await varNamesToIds(payload.formula.logic);
            } catch (error) {
                return res.status(500).json({ msg: "Failed to parse formula.", error: error.message });
            }
        }

        meta.org = meta.org.toObject();
        payload.o = meta.org._id.toString();
        payload.tz = meta.org.timezone;
        payload.specialEvent = "testFormula";
        if ("debug" in payload) {
            if (payload.debug && !meta.isSuper) payload.debug = false;
        }
        else payload.debug = false;
        payload.d = payload.debug;
        if (meta.isDebugGuest) payload.d = true;
        delete payload.debug;

        const params = {
            FunctionName: "flareReportingFormulaTester",
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        };
        let response = await Lambda.invoke(params).promise();
        let all = JSON.parse(response.Payload)
        return res.status(200).json(all)
    }
    catch (error) {
        if (error.response) {
            return res.status(500).json({ msg: error.response.data.text, err: error.response.data.text })
        }
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
})


//=========================================================================================
//=========================================================================================
//=========================================================================================
// Below is older stuff that I don't think is being used at all anymore. It should be
// removed and cleaned up. But since there may be something potenitally useful/important
// here, it's being left in the short term. 
// It does need to be looked at closely though before determining it should be removed.

// THIS DOSENT REALLY GO HERE>>>>>>  TEMP FOR TESTING
// @route GET api/widgets/flarereporting/formulas/test
// @desc test a formula
// @access Private
router.post('/treedata', async (req, res) => {
    try {


        await getFormulaDepends()
        const data = await getPiData(req.body)
        return res.status(200).json(data)
    } catch (error) {
        if (error.response) {
            console.log('ERROR', error.response.data)
            return res.status(500).json({ msg: error.response.data.text, err: error.response.data.text })
        }
        res.status(500).json({ msg: 'serverError', err: error.message })
    }
})


router.post('/pythontest', async (req, res) => {
    try {
        const pythonURL = 'http://localhost:5001/formula'
        const finalRes = await axios.post(pythonURL, req.body)
        const finalResValue = finalRes.data
        return res.status(200).json(finalResValue)
        return finalRes
    } catch (error) {
        if (error.response && error.response.data) {
            console.log(error.response.data)
        } else {
            console.log(error)
        }
        return res.status(500).json({})
    }

})




// @route POST api/widgets/flarereporting/formulas/test
// @desc test a formula
// @access Private
// router.post('/test',async(req,res)=>{
//     try {
//         //await getConstantValue('5f2895cab7c8ca03bd931305')

//         const {formula,flare,header,date,time} = req.body


//         //console.log(req.body)
//         await getAllFormulaValues()
//         return res.status(200).json({})
//         const url = 'http://localhost:5001/formula'
//         const formulaId = ObjectID(formula)
//         const flareId = ObjectID(flare)
//         const headerId = ObjectID(header)
//         const Tdate = date ? date :'2020-02-01'
//         const Ttime = time ? time : '15:00'
//         // const resolution = 15
//         const formulas = await parseFormulas()
//         const Tformula = formulas.filter(f=>f._id == formulaId)[0]
//         console.log(formula)
//         const deps = await getFormulaDepends(Tformula)
//         console.log({deps})


//         for(const variable of deps){
//             if(variable.type === 'parameter'){
//                 const options = {
//                     param : variable.id,
//                     header : headerId,
//                     flare : flareId,
//                     primary: true,
//                     date : new Date(`${Tdate} ${Ttime}z`)
//                 }
//                 variable.value = await getParamValue(options)
//             }
//             if(variable.type === 'flare'){
//                 variable.value = await getFlareAttr(flareId,variable.id)
//             }
//             if(variable.type === 'compound'){
//                 variable.value = await getCompoundValue()
//             }
//             if(variable.type === 'compoundGroup'){
//                 const options = {
//                     param : variable.id,
//                     header : headerId,
//                     flare : flareId,
//                     primary: true,
//                     date : new Date(`${Tdate} ${Ttime}z`),
//                     groupName: variable.param,
//                     valueMod : variable.attr[0]
//                 }
//                 console.log({options})
//                 variable.value = await getCGroupValues(options)

//             }
//             if(variable.type === 'constant'){
//                 variable.value = await getConstantValue(variable.id)
//             }
//         }
//         //console.log(deps)
//         //return res.status(200).json({})
//         for(const variable of deps){
//             if(variable.type === 'formula'){
//                 const target = formulas.filter(f=>f._id == ObjectID(variable.id))[0]
//                 console.log(target)
//                 const expression = target.newFormula.match(/^=.*/gm)[0];
//                 const varNames = target.vars.map(v=>v.name)
//                 console.log(varNames)
//                 const schema = {
//                     formula : expression,
//                     variables : {}
//                 }
//                 for(const d of deps){
//                     if(d.value && varNames.includes(d.name) ){
//                         schema.variables[d.name] = d.value
//                     }
//                 }
//                 //console.log({schema})
//                 //console.log(JSON.stringify(schema))

//                 const response = await axios.post(url,schema)
//                 const resValue = response.data

//                 variable.value = resValue.value
//                 console.log({target,expression,schema,resValue})
//             }
//         }
//         console.log({deps})

//         const finalFormula =  Tformula.newFormula.match(/^=((.*)\s*)*/gm)[0];
//         const varNames = Tformula.vars.map(v=>v.name)
//         const schema = {
//             formula : finalFormula,
//             variables : {}
//         }
//         for(const d of deps){
//             if(d.value && varNames.includes(d.name) ){
//                 if(d.type === 'compoundGroup'){
//                     schema.variables[d.name] = d.value.map(v=>v.value)
//                 }else{
//                     schema.variables[d.name] = d.value
//                 }

//             }
//         }
//         console.log({varNames,schema})

//         console.log(deps)
//         //return res.status(200).json({})

//         const finalRes = await axios.post(url,schema)
//         const finalResValue = finalRes.data


//         console.log({finalResValue})


//         //await getCGroupValues()


//         //const formula = await parseIncomingFormula(req.body)
//         //console.log({formula})
//         //const meta = await getReqMeta(req)
//         //formula.expression = formula.formula.match(/^=.*/gm)[0];
//         //console.log({formula})
//         // const inputdata = {
//         //     formula : formula.expression,
//         //     variables : {}
//         // }
//         // for(const v of formula.variables){
//         //     try {
//         //         inputdata.variables[v.name] = await getVariableValue(v)
//         //     } catch (error) {
//         //         throw error
//         //     }

//         // }
//         // console.log({inputdata})

//         // const url = 'http://localhost:5001/formula'
//         // const data = {...req.body}
//         // const response = await axios.post(url,data)
//         // const resValue = response.data
//         // data.value = resValue.value


//         // //console.log(data)
//         // //const data = null
//         // //res.io.emit("test", "users");
//         schema.value = finalResValue.value
//         console.log(schema)
//         return res.status(200).json({value:schema.value,variables:schema.variables})
//     } catch (error) {
//         if(error.response){
//             console.log('ERROR',error.response.data)
//             return res.status(500).json({msg:error.response.data.text,err:error.response.data.text})
//         }
//         res.status(500).json({msg:'serverError',err:error.message})
//     }
// })



module.exports = router;