const { Parameter, Compound, PiTag, Sensor, Header, PiValue, Constant, Formula, CompoundGroup, EventRule } = require('../database/FRTModels')
const { Org } = require('../database/models')
const { MongoClient, ObjectId } = require("mongodb");
const { mongooseConnect } = require('../database/Client')
const { getPiTags, getCompoundGroups } = require('../misc/getOrgData')
const mongoose = require('mongoose');
const _ = require('lodash');
const { RemoteCredentials } = require('aws-sdk');


const DBNAME = "flare-compliance"
const DBURI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair.znftk.mongodb.net/test?retryWrites=true&w=majority"
let client = null

const connect = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI, options);
        await client.connect();
        console.log('MongoDB Connected')
        return client
        //    2   console.error(`MongoDB Error ${error.message}`)
        //         process.exit(1) 
    } catch (error) {
        console.log("Connect Error: ", err);
    }
}

const getObjectId = async (string) => {
    if (string) {
        try {
            return new ObjectId(string)
        } catch (error) {
            return null
        }
    }
    return new ObjectId()
}

const getCollection = async (collName, dbName = DBNAME) => {
    if (!client) {
        await connect()
    }
    const database = client.db(dbName);
    return database.collection(collName)
}

const moveOverParams = async () => {
    await mongooseConnect(DBURI)

    const collection = await getCollection('parameters')
    const compoundColl = await getCollection('compounds')
    const records = await collection.find({}).toArray()
    for (const record of records) {
        let valueType = record.value_type
        if (valueType.includes('_')) {
            valueType = valueType.split('_')[1]
        }
        let compID = null
        if (record.compound_id) {
            const foundCompound = await compoundColl.findOne({ _id: record.compound_id })
            const newCompound = await Compound.findOne({ name: foundCompound.name })
            compID = newCompound._id
        }

        const schema = {
            name: record.parameter,
            resolution: 1,
            unitOfMeasure: record.uom,
            valueType: valueType,
            compound: compID
        }
        const newParam = new Parameter(schema)
        try {
            const valid = await newParam.validate()
        } catch (err) {
            console.log(err.message)
        }
        await newParam.save()
        //console.log(valid)
    }

    client.close()
    mongoose.connection.close()
}

const moveOverCompounds = async () => {
    await mongooseConnect(DBURI)

    const collection = await getCollection('compounds')
    const records = await collection.find({}).toArray()
    for (const record of records) {

        const schema = {
            name: record.name,
            abbreviation: record.abbreviation,
            molecularWeight: record.mw,
            molecularWeightUom: record.mw_uom,
            netHeatingValue: record.nhv,
            lowerFlamabilityLimit: record.lfl,
            volatileOrganicCompound: record.voc,
            sulfur: record.sulfur,
            inert: record.inert,
        }
        const newCompound = new Compound(schema)
        try {
            const valid = await newCompound.validate()
        } catch (err) {
            console.log(err.message)
        }
        await newCompound.save()
        console.log(schema.name)
    }

    client.close()
    mongoose.connection.close()
}

const moveOverPiTags = async () => {
    await mongooseConnect(DBURI)

    const collection = await getCollection('pi_tags')
    const sensorColl = await getCollection('sensors')
    const paramsColl = await getCollection('parameters')
    const records = await collection.find({}).toArray()
    const orgID = ObjectId('5fb6b7ea6b029226f07d2677')
    for (const record of records) {
        let flareID = null
        let headerID = null
        let sensorID = null
        let paramID = null
        let oldHeader = null
        let newHeader = null
        const foundSensor = await sensorColl.findOne({ _id: record.parent_id })
        if (foundSensor) {
            //console.log({foundSensor})
            const newSensor = await Sensor.findOne({ name: foundSensor.name, org: orgID })
            if (newSensor) {
                sensorID = newSensor._id
                headerID = newSensor.header
                flareID = newSensor.flare
            }
            const foundParam = await paramsColl.findOne({ _id: record.param_id })
            if (foundParam) {
                const newParam = await Parameter.findOne({ name: foundParam.parameter })
                console.log({foundParam,newParam})
                paramID = newParam._id
                //console.log({foundParam,newParam})
            }
            const schema = {
                name: record.name,
                identifier: record.pi_tag,
                description: record.description,
                org: orgID,
                flare: flareID,
                header: headerID,
                sensor: sensorID,
                parameter: paramID,
                max: record.max,
                min: record.min,

            }
            const newPiTag = new PiTag(schema)
            try {
                const valid = await newPiTag.validate()
                await newPiTag.save()
            } catch (err) {
                console.log(err.message)
            }
            console.log({ schema })

        }






        // const newPiTag = new PiTag(schema)
        // try {
        //     const valid = await newPiTag.validate()
        // } catch (err) {
        //     console.log(err.message)
        // }
        // //await newPiTag.save()


    }

    client.close()
    mongoose.connection.close()
}
function gaussian(mean, stddev) {
    return function () {
        var V1
        var V2
        var S
        do {
            var U1 = Math.random()
            var U2 = Math.random()
            V1 = 2 * U1 - 1
            V2 = 2 * U2 - 1
            S = V1 * V1 + V2 * V2
        } while (S >= 1)
        if (S === 0) return 0
        return mean + stddev * (V1 * Math.sqrt(-2 * Math.log(S) / S))
    }
}

const moveOverPiData = async () => {
    await mongooseConnect(DBURI)
    const pitagColl = await getCollection('pi_tags')
    const piDataColl = await getCollection('pi_data')
    const records = await piDataColl.find({ end_time: new Date('2020-03-01T00:45:00.000+00:00') }).toArray()
    const oldPiTags = await pitagColl.find().toArray()
    const newPitags = await PiTag.find()

    for (const record of records) {
        await Promise.all(record.raw.map(async (row) => {
            const value = row.value
            const rowRes = row.resolution
            const randomStdDev = Math.random()
            const standard = gaussian(value, randomStdDev)
            const isInt = Number.isInteger(parseInt(row.value))
            if (rowRes == '15') {
                let index = 15
                while (index > 0) {

                    const rando = standard()
                    const thisDate = new Date(row.date_time)
                    const newTime = thisDate.setMinutes(row.date_time.getMinutes() - index + 1)
                    const foundOld = oldPiTags.filter(pitag => pitag._id.toString() == row.pi_id.toString())[0]
                    const foundNew = newPitags.filter(pitag => pitag.name == foundOld.pi_tag.toString())
                    const newPidId = foundNew[0]._id


                    const newPiValue = new PiValue({
                        piTag: newPidId,
                        value: isInt ? rando : value,
                        date: newTime
                    })
                    await newPiValue.save()

                    //console.log({value,rando,index,newTime,newPidId,newPiValue,foundOld,foundNew})
                    index--
                }
            } else {
                const foundOld = oldPiTags.filter(pitag => pitag._id.toString() == row.pi_id.toString())[0]
                const foundNew = newPitags.filter(pitag => pitag.name == foundOld.pi_tag.toString())
                const newPidId = foundNew[0]._id
                const newPiValue = new PiValue({
                    piTag: newPidId,
                    value: value,
                    date: row.date_time
                })
                await newPiValue.save()
            }
            console.log({ row })
        }))
    }






}

const getPiDataTest = async () => {


    const start = "2020-03-01 00:01"
    const end = "2020-03-01 00:16"
    const orgId = '5fb6b7ea6b029226f07d2677'
    const populate = {
        path: "piTag",
        match: { org: orgId },
    }

    const query = {
        piTag: '5fb800df7221ab20d81945f0',
        date: {
            $gte: new Date(`${start}z`),
            $lte: new Date(`${end}z`),
        }
    }
    console.log('hit')
    const records = await PiValue.find(query).populate(populate).select('date value -_id -piTag')
    console.log(records)
}

async function build_known_vars(parameters, formulas, constants, compounds) {
    const known_vars = [];
    for (let param of parameters) {
        const name = param.parameter ? param.parameter : param.name
        known_vars.push({
            id: param._id,
            name: name,
            type: 'parameter',
            //resolution: param.resolution,
        });
    }
    for (let formula of formulas) {
        known_vars.push({
            id: formula._id,
            name: formula.name,
            type: 'formula',
        });
    }
    for (let constant of constants) {
        known_vars.push({
            id: constant._id,
            name: constant.name,
            type: 'constant',
        });
    }
    for (let compound of compounds) {
        known_vars.push({
            id: compound._id,
            name: compound.name,
            type: 'compound',
        });
    }
    return known_vars
}


const moveOverFormulas = async () => {
    const formulasColl = await getCollection('formulas')
    const constantsColl = await getCollection('constants')
    const paramColl = await getCollection('parameters')
    const compoundsColl = await getCollection('compounds')

    const oldFormulas = await formulasColl.find().toArray()
    const oldParms = await paramColl.find().toArray()
    const oldConstants = await constantsColl.find().toArray()
    const oldcompounds = await compoundsColl.find().toArray()

    const newParams = await Parameter.find()
    const newConstants = await Constant.find({ org: '5fb6b7ea6b029226f07d2677' })
    const newFormulas = await Formula.find({ org: '5fb6b7ea6b029226f07d2677' })
    const newCompound = await Compound.find()


    const oldKnownVars = await build_known_vars(oldParms, oldFormulas, oldConstants, oldcompounds)
    const newKnownVars = await build_known_vars(newParams, newFormulas, newConstants, newCompound)

    //console.log(newKnownVars)

    const vars = []
    const oldVars = []
    for (formula of oldFormulas) {
        const f = formula.formula
        const foundFormula = await Formula.findOne({ org: '5fb6b7ea6b029226f07d2677', name: formula.name })
        const allVariables = []
        const variables = []
        const found = f.match(/\[(.*?)\]/g);
        if (!found) continue
        let newFormula = f
        let newTest = ''

        for (const variable of found) {
            let clean_var = variable.replace(/\[/g, '').replace(/\]/g, '');
            const attr_found = clean_var.match(/\(([^()]*)\)/g);
            if (attr_found) {
                clean_var = clean_var.replace(attr_found[0], '');
            }
            const attr = attr_found ? attr_found[0] : null
            const oldVar = oldKnownVars.filter(row => row.id == clean_var)
            if (oldVar.length === 0) continue
            const newVar = newKnownVars.filter(row => row.name == oldVar[0].name)
            newFormula = newFormula.replace(oldVar[0].id, newVar[0].id)
            if (!allVariables.includes(variable)) {
                allVariables.push(variable)
                newVar[0].attr = attr
                variables.push(newVar[0])
            }
            //console.log({oldVar,newVar})
        }


        let newFormat = newFormula
        for (const variable of variables) {
            const type = variable.name == 'allCompounds' ? 'compounds' : variable.type
            const attr = variable.attr ? variable.attr.replace('(', '').replace(')', '') : null
            const value = attr ? `${variable.id},'${attr}'` : variable.id
            const varName = _.camelCase(variable.name)
            newTest += `let ${varName} = ${type}(${value});\n`
            const regex1 = `\\[${variable.id}\\]`
            const re1 = new RegExp(regex1, 'gm');
            const regex2 = `\\[${variable.id}\\(${attr}\\)\\]`
            const re2 = new RegExp(regex2, 'gm');
            newFormat = newFormat.replace(re1, varName)
            newFormat = newFormat.replace(re2, varName)
        }

        newTest += newFormat
        // console.log(newFormula)
        console.log(newTest)
        console.log(JSON.stringify(newTest))
        console.log('')
        console.log('')
        console.log('--------------------------------')

        //console.log(newFormat)
        //console.log(variables)
        foundFormula.newFormula = newTest
        await foundFormula.save()
        // console.log(variables)
    }




    //console.log({oldVars})

}

const moveOverEventRules = async () => {
    await mongooseConnect(DBURI)

    const event_rules = await getCollection('event_rules')
    const formulas = await getCollection('formulas')
    const records = await event_rules.find({}).toArray()
    for (const record of records) {

        let old_formula = await formulas.findOne({_id:ObjectId(record.logic_id)})
        let new_formula = await Formula.findOne({name : old_formula.name})


        let new_value_formula = {_id:null};
        if (record.value_id) {
            let old_value_formula = await formulas.findOne({_id:ObjectId(record.value_id)})
            new_value_formula = await Formula.findOne({name : old_value_formula.name})
        }

        const schema = {
            name: record.name,
            resolution: 1,
            chunkSize: 15,
            sensitivity: 0,
            org: ObjectId("5fb6b7ea6b029226f07d2677"), // Husky
            formula: new_formula._id,   // new ID in new DB!
            checkFor: record.check_for,
            withValues: record.with_values, //Find new ID in new DB!
            checkForValue: new_value_formula._id,
            subscribers: []
        }


        const newEventRule = new EventRule(schema)
        try {
            const valid = await newEventRule.validate()
        } catch (err) {
            console.log(err.message)
        }
        await newEventRule.save()
        console.log(schema.name)
    }

    client.close()
    mongoose.connection.close()
}

const getVariableData = async (formulaObj) => {
    const formula = formulaObj.newFormula
    console.log(formula)
    // if(formulaObj.name == 'Header NHVvg'){
    //     return [{
    //         varName : 'compounds',
    //         type : 'compounds',
    //         typeValue : null,
    //         attr: 'fractional'
    //     }]
    // }
    const variables = formula.match(/\blet .*;/gm);
    const schemas = []
    for (const variable of variables) {
        const split = variable.split("=")
        const varName = split[0].replace("let ", "").trim()
        const rawValue = split[1].trim().replace(';', '')

        let type = rawValue.match(/\w+(?=\()/gm);
        let typeValue = null
        if (type) type = type[0]
        typeValue = rawValue.match(/(?<=\().+?(?=\))/gm)[0].replace(/"/gm, '');
        const attrSplit = typeValue.split(',')
        let attr = attrSplit.length == 2 ? attrSplit[1].replace(/'/gm, '').replace(/"/gm, '') : null
        typeValue = attrSplit[0]
        const schema = { varName, type, typeValue, attr }
        console.log(schema)
        schemas.push(schema)
    }

    return schemas
}


// const getFormulaDepends = async (args)=>{

//     let allData = []
//     while(true){
//         const base = await Formula.findOne(args)
//         let formulaFound = false
//         const varData =  await getVariableData(base.newFormula)
//         allData = [...allData,...varData]

//         if(!formulaFound){
//             break
//         }
//     }
//     console.log(allData)


// }

const getFormulaDepends = async (args) => {
    const formula = await Formula.findOne(args)
    let allDependants = []
    const depids = []
    const children = await getVariableData(formula)
    for (const child of children) {
        await _helper_(child, allDependants, depids)
    }
    console.log(allDependants)

}
async function _helper_(child, allDependants, depids) {
    const tempId = child.attr ? `${child.typeValue}${child.attr}` : child.typeValue
    if (!depids.includes(tempId)) {
        allDependants.push(child)
        depids.push(tempId)
    }

    if (child.type !== 'formula') return
    const formula = await Formula.findOne({ org: '5fb6b7ea6b029226f07d2677', _id: ObjectId(child.typeValue) })
    const children = await getVariableData(formula)
    for (const child of children) {
        await _helper_(child, allDependants, depids)
    }
}


const getPiValues = async () => {
    const res = PiValue
}


const getCompounds = async () => {
    const org = '5fb6b7ea6b029226f07d2677'
    //const groupName = 'All'
    //const group = await CompoundGroup.findOne({name:groupName}).populate('compounds')
    const tags = await getPiTags()
    const groups = await getCompoundGroups()

    console.log(groups)
    // await Promise.all(group.compounds.map(async (compound)=>{

    //     console.log(compound)
    // }))

}

const createCompoundGroup = async () => {
    const groupName = 'All'
    const org = '5fb6b7ea6b029226f07d2677'
    const compounds = await Compound.find()

    const group = new CompoundGroup({
        name: groupName,
        compounds: compounds.map(comp => comp._id),
        org
    })
    const res = await group.save()
    console.log(compounds)
    console.log(res)
}



const main = async () => {
    // const args = {org:'5fb6b7ea6b029226f07d2677',name:'Flare NHVcz'}
    // await mongooseConnect(DBURI)
    // await getCompounds(args)
    // await moveOverPiTags();
    // await moveOverParams();
    await moveOverEventRules();
    if (client) client.close();
    mongoose.connection.close();
    console.log("done");
}

main()


// async function myfunc() { //DELETES
//     coll = await getCollection('eventrules', 'test');
//     let x = await coll.deleteMany({},
//         function (error, result) {
//             console.log("result: ", result)
//             client.close()
//             mongoose.connection.close()
//             console.log("Done")
//         }
//     );

// }

// myfunc()