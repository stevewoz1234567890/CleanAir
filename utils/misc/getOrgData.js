
const {
    PiTag,
    PiValue,
    Formula,
    Parameter,
    Constant,
    Compound,
    Header,
    Flare,
    CompoundGroup,
    OrgInfo
} = require('../database/FRTModels')
const {redisGet,redisSet} = require('../redis/Client')
const {getCollection,ObjectId} = require('../database/Client')
const axios = require('axios')
const http = require('http');
const https = require('https');
const util = require('util')
const logger = require('./colorLogger')


const exp = 60
const orgId = '5fb6b7ea6b029226f07d2677'
//const pythonURL = 'http://localhost:5001/formula'
const pythonURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/formulavalue'

const chunkArray = (arr,len) => {
    var chunks = [],
      i = 0,
      n = arr.length;
    while (i < n) {
      chunks.push(arr.slice(i, (i += len)));
    }
    return chunks;
}



const fracMapping = {
    "mol%" : 100,
    "mol" : 100,
    "ppm" : 1000000,
    "ppb" : 1000000000,
}



const SortByName = (arrayOfObjects, field = 'name') => {
    if (arrayOfObjects && arrayOfObjects.length >= 1) {
      function sortByName(a, b) {
        const constantA = a[field].toUpperCase();
        const constantB = b[field].toUpperCase();
        let comparison = 0;
        if (constantA > constantB) {
          comparison = 1;
        } else if (constantA < constantB) {
          comparison = -1;
        }
        return comparison;
      }
      return arrayOfObjects.slice().sort(sortByName);
    }
    return null;
};

/**
 * get special org info objects from DB that pertain to an org
 * @param {string || ObjectId} orgID 
 * @param {string} content 
 * @returns 
 */
const getOrgInfo = async (orgID, content) => {
    let doc = await OrgInfo.findOne({org: orgID, content}).lean();
    return doc
}

const getFormulas = async(args={})=>{
    const key = `${orgId}-formulas`
    const {value,ex} = await redisGet(key)

    if(!value || args.force){
        console.log("force getting formulas")
        const res = await Formula.find({org:orgId})
        const formulas = res.map(row=>row.toJSON())
        await Promise.all(formulas.map(async(formula)=>{
            await getVariableData(formula,formulas)
        }))
        const sorted = SortByName(formulas)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getSortedFormulas = async(args={})=>{
    /* 
        Gets all the formulas and sorts them based on their dependancies on other formulas,
        it does this by looping thru each formula, if a variable is 'known', then we know what that
        variables value is.   If the variable is not 'known'.... we cant determine the value.
        if all the formula variables are 'known' the formulas value can be determined.
    */


    const key = `${orgId}-sortedFormulas`
    const thisExp = 3600
    const {value,ex} = await redisGet(key)

    if(!value || args.force){
        const formulas = args.formulas ? args.formulas : await getFormulas(args)
        const knownVars = []
        const unknowns = []
        const allFounds = []
        //const unfounds = []
        
        
        /* 
            starters is a list of raw data, meaning they are all known values.  So if a variable type is a 'starter',
            we can get its value.
        */
        const starters = [
            'parameter',
            'constant',
            'compoundGroup',
            'flare',
            'header',
            'compound'
        ]
        
        /* 
            For the first round... get all the 'starter' formulas that do not have any other formula inputs,
            basically a formula that only relys on 'starters'
        */

        for(const f of formulas){
            let allFound = true
            for(const v of f.vars){
                if(starters.includes(v.type)){
                    if(!knownVars.includes(v.id)){
                        knownVars.push(v.id)
                    }
                }else{
                    if(!unknowns.includes(v.id)){
                        unknowns.push(v.id)
                    }
                    allFound = false
                }
            }

            /* 
                If all the formula variables are known.. that means we can calculate the formula value.
                so this formulas id is now a KNOWN value... so add the actual formula to the 'allFounds' array,
                and add the formulas id to the 'knownVars' array
            
            */
            if(allFound){
                allFounds.push(f)
                if(!knownVars.includes(f._id.toString())){
                    knownVars.push(f._id.toString())
                }
            } 
            //if(!allFound) unfounds.push(f)
        }


        /* 
            Once we have all the starter formulas, while the array 'allFounds' (sorted formulas) len < formulas.length,
            (meaning once all formulas are sorted), loop thru each formula again, and see if we know the variables, 
            same concept as above....

        */
    
        const max = 100
        let c = 0
    
        while(allFounds.length !== formulas.length){
            
            /* 
                we add a limit here to make sure we dont enter an infinate loop.  this SHOULDNT occour
                due to formula validation...  but we dont want to enter an infi loop.
            */
            if(c===max){
                console.log("LIMIT")
                break
            } 


            for(const f of formulas){
                if(knownVars.includes(f._id.toString())) continue
                
                let allFound = true
                for(const v of f.vars){
                    if(!knownVars.includes(v.id)){
                        allFound = false
                    }
                }
                if(allFound){
                    if(!knownVars.includes(f._id.toString())){
                        knownVars.push(f._id.toString())
                        allFounds.push(f)
                    }
                } 
            }
            c++
        }

        /* Set the sorted formulas to redis, for faster recovery on subsequent calls. */
        await redisSet(key,JSON.stringify(allFounds),thisExp)
        return allFounds
    }

    console.log('using redis sorted formulas')
    return value
}


const getPiTags = async(args={})=>{
    const thisExp = 3600
    const key = `${orgId}-pitags`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await PiTag.find({org:orgId}).populate('parameter').populate('sensor').populate('flare').populate('header').exec();
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),thisExp)
        return sorted
    }
    return value
}

const getCompoundGroups = async(args={})=>{
    const thisExp = 3600
    const key = `${orgId}-compoundGroups`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await CompoundGroup.find({org:orgId}).populate('compounds')
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),thisExp)
        return sorted
    }
    return value
}

const getParameters = async(args={}) => {
    const res = await Parameter.find({org:orgId}).lean().exec();
    return res
}



const getConstants = async(args={})=>{
    const key = `constants`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Constant.find()
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}



const getCompounds = async(args={})=>{
    const key = `compounds`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Compound.find()
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getHeaders = async(args={})=>{
    const key = `${orgId}-headers`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Header.find({org:orgId}).populate('flare')
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getFlares = async(args={})=>{
    const key = `${orgId}-flares`
    const {value,ex} = await redisGet(key)
    const piValueCollection =  await getCollection('pivalues')



    if(!value || args.force){
        const flares = await Flare.find({org:orgId})
        const flareObjects = await Promise.all(flares.map(async (f)=>{
            const flare = f.toJSON()
            // let startPipeline = [
            //     {'$sort': {'date': 1}},
            //     {
            //       '$lookup': {
            //         'from': 'pitags', 
            //         'localField': 'piTag', 
            //         'foreignField': '_id', 
            //         'as': 'tag'
            //       }
            //     }, 
            //     {'$unwind': {'path': '$tag'}}, 
            //     {'$addFields': {'flare': '$tag.flare'}},
            //     {'$project': {
            //         'date': 1, 
            //         '_id': 0, 
            //         'flare': 1
            //       }
            //     }, 
            //     {'$match': {'flare': flare._id}}, 
            //     {'$limit': 1 }
            // ]
            
            // const start = await piValueCollection.aggregate(startPipeline).toArray()
            // let endPipeline = [
            //     {'$sort': {'date': -1}},
            //     {
            //       '$lookup': {
            //         'from': 'pitags', 
            //         'localField': 'piTag', 
            //         'foreignField': '_id', 
            //         'as': 'tag'
            //       }
            //     }, 
            //     {'$unwind': {'path': '$tag'}}, 
            //     {'$addFields': {'flare': '$tag.flare'}},
            //     {'$project': {
            //         'date': 1, 
            //         '_id': 0, 
            //         'flare': 1
            //       }
            //     }, 
            //     {'$match': {'flare': flare._id}}, 
            //     {'$limit': 1 }
            // ]
            
            // const end = await piValueCollection.aggregate(endPipeline).toArray()

            // flare.start = start[0].date
            // flare.end = end[0].date
            return flare
        }))

        const sorted = SortByName(flareObjects)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getTagData = async(tags,args={})=>{
    const key = `${orgId}-tagData`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const data = tags.map(tag=>{
            const flare = tag.flare ? tag.flare.name : null
            const header = tag.header ? tag.header.name : null
            const sensor = tag.sensor.name
            const param = tag.parameter.name
            const piTag = tag.name
            const primary = `${param}`
            const secondary = `${sensor} (${piTag})`
            const type = tag.parameter.valueType
            const id = tag._id
            const paramType = 'param'
            return {id,paramType,flare,header,sensor,param,piTag,type,primary,secondary}
        })
        await redisSet(key,JSON.stringify(data),exp)
        return data
    }
    return value
}

const getAllValues = async(args={})=>{

    const [formulas,tags,constants,compounds,headers,flares] = await Promise.all([
        getFormulas(args),
        getPiTags(args),
        getConstants(args),
        getCompounds(args),
        getHeaders(args),
        getFlares(args)
    ])
    
    const tagData = await getTagData(tags,args)
    const numTags = tagData.filter(tag=>tag.type=='num')
    const numFormulas = formulas.filter(formula=>formula.dataType=='num')
    const boolFormulas = formulas.filter(formula=>formula.dataType=='boolean')


    const data = {flares,headers,formulas,tags,tagData,constants,compounds,tagData,numTags,numFormulas,boolFormulas}
    return data
}

const getChartingOptions = async()=> {
    const options = await getAllValues()
    const {numTags, numFormulas, boolFormulas} = options
    const formulas = [...numFormulas, ...boolFormulas]
    const formulaData = []
    for(const formula of formulas){
        if(formula.to === 'flare'){
            for(const flare of options.flares){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: flare.name,
                    flareID : flare._id,
                    headerName: null,
                    headerID : null,
                    type: formula.dataType,
                    primary: formula.name,
                    secondary : flare.name
                })
            }
        }
        if(formula.to === 'headers'){
            for(const header of options.headers){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: header.flare.name,
                    flareID : header.flare._id,
                    headerName: header.name,
                    headerID : header.id,
                    type: formula.dataType,
                    primary: formula.name,
                    secondary : header.name
                })
            }
        }
    }
    return {numTags,formulaData}
}

const getExportOptions = async()=>{
    const options = await getAllValues()
    const {tagData,formulas} = options
    const formulaData = []
    for(const formula of formulas){
        if(formula.to === 'flare'){
            for(const flare of options.flares){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: flare.name,
                    flareID : flare._id,
                    headerName: null,
                    headerID : null,
                    type: formula.dataType,
                    primary: formula.name,
                    secondary : flare.name
                })
            }
        }
        if(formula.to === 'headers'){
            for(const header of options.headers){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: header.flare.name,
                    flareID : header.flare._id,
                    headerName: header.name,
                    headerID : header.id,
                    type: formula.dataType,
                    primary: formula.name,
                    secondary : header.name
                })
            }
        }
    }
    return {tags: tagData,formulaData}
}

const getNumOptions = async(perFlareHeader=true, withToFlare=true, withToHeader=true)=>{
    const options = await getAllValues()
    const {numTags,numFormulas} = options
    const formulaData = []
    for(const formula of numFormulas){
        if(formula.to === 'flare'){
            if (perFlareHeader && withToFlare) {
                for(const flare of options.flares){
                    formulaData.push({
                        paramType : 'formula',
                        id: formula._id,
                        name : formula.name,
                        flareName: flare.name,
                        flareID : flare._id,
                        headerName: null,
                        headerID : null,
                        type: "num",
                        primary: formula.name,
                        secondary : flare.name
                    })
                }
            } else {
                if (withToFlare) {
                    formulaData.push({
                        paramType : 'formula',
                        id: formula._id,
                        name : formula.name,
                        type: "num",
                        primary: formula.name,
                    })
                }
            }
        }
        if(formula.to === 'headers'){
            if (perFlareHeader && withToHeader) {
                for(const header of options.headers){
                    formulaData.push({
                        paramType : 'formula',
                        id: formula._id,
                        name : formula.name,
                        flareName: header.flare.name,
                        flareID : header.flare._id,
                        headerName: header.name,
                        headerID : header.id,
                        type: "num",
                        primary: formula.name,
                        secondary : header.name
                    })
                }
            } else {
                if (withToHeader) {
                    formulaData.push({
                        paramType : 'formula',
                        id: formula._id,
                        name : formula.name,
                        type: "num",
                        primary: formula.name,
                    })
                }
                
            }
        }
    }
    return {numTags,formulaData}
}




const getVariableData = async(formula, formulas=null)=>{
    const [tags,constants,compoundGroups,compounds] = await Promise.all([
        getPiTags(), //{force:true}
        getConstants(),
        getCompoundGroups(),
        getCompounds()
    ])
    if(!formulas){
        formulas = await getFormulas()
    }
    
    const Schema = {
        name : null,
        type : null,
        id : null,
        param : null,
        unique : null,
        attr : [],
        
    }
    let newFormula = formula.newFormula
    
    
    const variables = formula.newFormula ? formula.newFormula.match(/\blet .*;/gm): null


    if(!variables){
        formula.uiDisplay = null
        formula.variables = []
        return
    } 
    
    const vars = []
    for(const variable of variables){
        const thisSchema = {...Schema}
        const split = variable.split("=")
        const rawValue = split[1].trim().replace(';','')//.replace("in",'')
        const type = rawValue.match(/\w+(?=\()/gm)
        thisSchema.unique = variable
        thisSchema.newUnique = rawValue.replace(/"/gm, '').replace(/'/gm, '')
        if(!type){
            vars.push(thisSchema)
            continue
        }
        
        thisSchema.type = type[0];
        thisSchema.name = split[0].replace("let ","").trim()
        let typeValue = rawValue.match(/(?<=\().+?(?=\))/gm)[0].replace(/"/gm, '');
        let params = typeValue.split(',')
        if(params.length > 1) typeValue = params[0]
        params.shift()
        params = params.map(param=>param.replace(/"/gm, '').replace(/'/gm, ''))
        thisSchema.attr = params
        thisSchema.id = typeValue
        // if (thisSchema.id === "5fb7f09b2d14ea1cd8a8371b") console.log("WATER: ", thisSchema)
        // console.log(thisSchema)
        if(thisSchema.type === 'formula'){
            try {
                let found = formulas.filter(row=>row._id.toString() === thisSchema.id.toString() )[0]
                thisSchema.param = found.name
                thisSchema.to = found.to

            } catch (err) {
                console.log("HERE: ", thisSchema)
                throw err
            }
            
        }
        if(thisSchema.type === 'constant'){
            let found = constants.filter(row=>row._id.toString() === thisSchema.id.toString() )[0]
            thisSchema.param = found.name
        }
        if(thisSchema.type === 'parameter'){
            let found = tags.filter(row=>row.parameter._id.toString() === thisSchema.id.toString() )[0]
            thisSchema.param = found.parameter.name
            //thisSchema.parent = found.header ? found.header._id.toString() : found.flare._id.toString()
            //thisSchema.parentName = found.header ? found.header.name : found.flare.name
            thisSchema.parent = found.header ? 'header' : 'flare'
        }
        if(thisSchema.type === 'compoundGroup'){
            let found = compoundGroups.filter(row=>row._id.toString() === thisSchema.id.toString() )[0]
            thisSchema.param = found.name
        }
        if(thisSchema.type === 'flare'){
            thisSchema.param = thisSchema.id
        }
        if(thisSchema.type === 'header'){
            thisSchema.param = thisSchema.id
        }
        if(thisSchema.type === 'compound'){
            let found = compounds.filter(row=>row._id.toString() === thisSchema.id.toString() )[0]
            thisSchema.param = found.name
        }
        vars.push(thisSchema)
        newFormula = newFormula.replace(thisSchema.id,`"${thisSchema.param}"`)
    }

    formula.uiDisplay = newFormula
    formula.vars = vars


}

const parseFormulas = async(args={})=>{
    
    const formulas = await getFormulas({force:true})
    // for(const formula of formulas){
    //     await getVariableData(formula)
    // }
    // console.log(formulas)
    return formulas
}


const varNamesToIds = async(formula,args={})=>{
    const [formulas,tags,constants,compounds,headers,flares,compoundGroups] = await Promise.all([
        getFormulas(args),
        getPiTags(args),
        getConstants(args),
        getCompounds(args),
        getHeaders(args),
        getFlares(args),
        getCompoundGroups(),
    ])
    const Schema = {
        name : null,
        type : null,
        id : null,
        param : null,
        attr : []
    }
    



    let newFormula = formula
    const variables = formula.match(/\blet .*;/gm)
    const vars = []
    if (variables === null) return newFormula;
    for(const variable of variables){
        const thisSchema = {...Schema}
        const split = variable.split("=")
        const rawValue = split[1].trim().replace(';','')//.replace("in",'')
        const type = rawValue.match(/\w+(?=\()/gm)
        if(!type){

            vars.push(thisSchema)
            continue
        }
        thisSchema.type = type[0];
        thisSchema.name = split[0].replace("let ","").trim()
        let typeValue = rawValue.match(/(?<=\().+?(?=\))/gm)[0].replace(/"/gm, '');
        let params = typeValue.split(',')
        if(params.length > 1) typeValue = params[0]
        params.shift()
        params = params.map(param=>param.replace(/"/gm, '').replace(/'/gm, ''))
        //params = params.map(param=>param.replace(/"/gm, '').replace(/'/gm, ''))
        thisSchema.attr = params
        thisSchema.param = typeValue
        
        try {
          if(thisSchema.type === 'formula'){
              // console.log({thisSchema})
              let found = formulas.filter(row=>row.name === thisSchema.param )[0]
              thisSchema.id = found._id.toString()
          }
          if(thisSchema.type === 'constant'){
              let found = constants.filter(row=>row.name === thisSchema.param )[0]
              thisSchema.id = found._id.toString()
          }
          if(thisSchema.type === 'parameter'){
              // console.log(thisSchema)
              let found = tags.filter(row=>row.parameter.name === thisSchema.param )[0]
              // console.log(found)
              thisSchema.id = found.parameter._id.toString()
          }
          if(thisSchema.type === 'compoundGroup'){
              
              let found = compoundGroups.filter(row=>row.name === thisSchema.param )[0]
              thisSchema.id = found._id.toString()
          }
          if(thisSchema.type === 'flare'){
              thisSchema.id = thisSchema.param
          }
          if(thisSchema.type === 'header'){
              thisSchema.id = thisSchema.param
          }
          if(thisSchema.type === 'compound'){
              // console.log({thisSchema})
              let found = compounds.filter(row=>row.name === thisSchema.param )[0]
              // console.log({found})
              thisSchema.id = found._id.toString()
          }
        }
        catch (error) {
          console.log("failed to process: ", thisSchema, error.message, error.stack)
          throw error;
        }
        vars.push(thisSchema)
        newFormula = newFormula.replace(`"${thisSchema.param}"`,thisSchema.id)
    }
    // console.log({vars})

    return newFormula
}

const parseIncomingFormula = async(body,args={})=>{

    const targetFormula = body.edited? body.edited : body.selected.uiDisplay
    const cleanFormula = await varNamesToIds(targetFormula)
    return cleanFormula
}


const getPiData = async(args={}) =>{
    console.log(args)
    const valuesColl = await getCollection('pivalues')
    const resolution = args.res? args.res : 15
    const operator = args.op ? `$${args.op}` : '$avg'
    const fromDate = new Date(`${args.start}z`)
    const toDate = new Date(`${args.end}z`)
    const tags = args.tags.map(tag=>ObjectId(tag))
    const org = ObjectId(orgId)

    const group = {
        _id: {
            $toDate: {
                $subtract: [
                { $toLong: "$start" },
                { $mod: [ { $toLong: "$start" }, 1000 * 60 * resolution ] }
                ]
            }
        },
        value: {[operator]: '$value'},
        //date :  {$last: "$date"},
        date :  {$last: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } }},
    }
    
    if(args.count) group.count = { $sum: 1 }
    if(args.values) group.values = {$push: "$value"}



    const match = {piTag: null, org, start: {$gte: fromDate, $lt: toDate}}

    const addFields = {value: { $round: [ "$value", args.places ] } }

    const pipeline = [
        {$match : match}, 
        {$group : group},
        {$sort: {_id: 1}},
        {$addFields: addFields}, 
        {$project: {'_id': 0, 'end' : 0}},
        //{ $limit: 5},
    ]




    const data = await Promise.all(tags.map(async(tag)=>{
        match.piTag = tag
        pipeline[0]= {$match : match}
        const res = await valuesColl.aggregate(pipeline).toArray();

        if(args.array){
            const values = res.map(row=>row.value)
            const dates = res.map(row=>row.date)
            return {_id:tag,values,dates}
        }
        
        return {_id:tag,data:res}
    }))
    return data


}



const getFormulaDepends = async(formula, formulas=null)=>{
    const comps = await getCompoundGroups()
    const tags = await getPiTags()
    if(!formulas){
        formulas = await getFormulas()
    }
    //const formulas = await parseFormulas()
    let allDependants = []
    const depids = []
    for(const child of formula.vars){
        await _helper_(child, allDependants, depids,formulas)
    }
    return allDependants
}


const getParamValue = async(args,tags)=>{
    const valuesColl = await getCollection('pivalues')

    for(const tag of tags){
        if(tag.parameter._id.toString() !== args.param.toString()) continue
        if(tag.flare._id.toString() !== args.flare.toString()) continue
        //if(args.header){
            if(args.header && tag.header && tag.header._id.toString() !== args.header.toString()) continue
        //}
        
        if(args.variable.attr.includes('max')){
            args.variable.sensorCems = tag.sensor.cemsInstalled
            return tag.max
        }
        
        if(tag.sensor.cemsInstalled && tag.sensor.isPrimary !== args.primary) continue
        args.variable.sensorCems = tag.sensor.cemsInstalled
        const res = await valuesColl.findOne({
            start : args.date,
            piTag : ObjectId(tag._id),
            org: ObjectId(orgId)
        })
        //console.log({res,tag})
        const div = fracMapping[tag.parameter.unitOfMeasure]
        const fracValue = div ? res.value/div : res.value
        return fracValue
    }
}

const getCGroupValues = async(args={})=>{


    const valuesColl = await getCollection('pivalues')
    const groups = await getCompoundGroups()
    const tags = await getPiTags()
    const compounds = groups.filter(row=>row.name === args.groupName)[0].compounds
    const values = []

    for(const compound of compounds){
        for(const tag of tags){
            if(!tag.parameter.compound) continue
            if(tag.parameter.compound.toString() !== compound._id.toString()) continue
            if(tag.flare._id.toString() !== args.flare.toString()) continue
            if(args.header){
                if(tag.header._id.toString() !== args.header.toString()) continue
            }
            
            if(args.valueMod.includes('netHeatingValue')){
                values.push({
                    value:compound.netHeatingValue,
                    compound:compound.name,
                })
                break
            }

            if(tag.sensor.isPrimary !== args.primary) continue
            


            const res = await valuesColl.findOne({
                date : args.date,
                piTag : ObjectId(tag._id),
                org: ObjectId(orgId)
            })
            if(args.valueMod.includes('fractional')){
                const div = fracMapping[tag.parameter.unitOfMeasure]
                const fracValue = res.value/div
                values.push({
                    //rawValue:res.value,
                    //fracValue,
                    compound:compound.name,
                    value : fracValue,
                    //comp : compound
                    //uom:tag.parameter.unitOfMeasure
                })
            }
            
            break
        }
    }



    await Promise.all(compounds.map(async (compound)=>{
        

        
        

    }))
    if(values.length === 0) return null
    return values
}

const getConstantValue = async(id)=>{
    const constants = await getConstants()
    const found = constants.filter(c=>c._id.toString() === id.toString())[0]
    return found.value
}

const getFlareAttr = async(id,attr)=>{
    const flares = await getFlares()
    const flare = flares.filter(f=>f._id.toString() === id.toString())[0]
    return flare[attr]
}

const getHeaderAttr = async(id,attr)=>{
    const headers = await getHeaders()
    const header = headers.filter(h=>h._id.toString() === id.toString())[0]
    return header[attr]
}

const getCompoundValue = async(args={})=>{
    const compounds = await getCompounds()
    const compound = compounds.filter(c=>c._id.toString() === args.id.toString())[0]
    if(args.attr.includes('molecularWeight')) return compound.molecularWeight
    //console.log({compound})
}

const getAllFormulaDepends = async(formulas=null)=>{
    

    /* 
        This function loops thru the formulas and gets the 'newUnique' name  
        for each variable. so that we end with a unique list of values that we need to get.
    */


    async function _helper_(child, allDependants, depids,formulas) {
        if (!depids.includes(child.newUnique)) {
            allDependants.push(child)
            depids.push(child.newUnique)
        }
    
        if (child.type !== 'formula') return
        const formula = formulas.filter(row=>row._id.toString() === child.id.toString())[0]
        for (const child of formula.vars) {
            await _helper_(child, allDependants, depids,formulas)
        }
    }
    
    if(!formulas){
        formulas = await getFormulas()
    }

    let allDependants = []
    const depids = []
    await Promise.all(formulas.map(async(formula)=>{
        for(const child of formula.vars){
            await _helper_(child, allDependants, depids,formulas)
        }
    }))
    

    return allDependants
}


const getNonFormulaValues = async(deps,args={}) =>{
    const tags = await getPiTags()
    const flareid = args.flareid
    const headerid = args.headerid ? args.headerid : null
    const date = args.date
    const retDeps = []
    await Promise.all(deps.map(async(that)=>{
        
        const dep = {...that}
        if(dep.type === 'formula') return
        if(!headerid && dep.parent === 'header') return
        dep.isPri = false
        if(dep.attr.includes('primary')) dep.isPri = true
        if(dep.attr.includes('secondary')) dep.isPri = false
        if(dep.type === 'parameter'){
            const options = {
                param : dep.id,
                header : headerid,
                flare : flareid,
                primary: dep.isPri,
                date : date,
                variable : dep
            }
            dep.value = await getParamValue(options,tags)
        }
        if(dep.type === 'compoundGroup'){
            if(!headerid) return
            const options = {
                param : dep.id,
                header : headerid,
                flare : flareid,
                primary: dep.isPri,
                date : date,
                groupName: dep.param,
                valueMod : dep.attr
            }
            dep.value = await getCGroupValues(options)
            
        }
        if(dep.type === 'flare'){
            dep.value = await getFlareAttr(flareid,dep.id)
            dep.parent = flareid
        }
        if(dep.type === 'header'){
            if(!headerid) return
            dep.value = await getHeaderAttr(headerid,dep.id)
        }
        if(dep.type === 'constant'){
            dep.value = await getConstantValue(dep.id)
        }
        if(dep.type === 'compound'){
            dep.value = await getCompoundValue({id:dep.id,attr:dep.attr})
        }
        retDeps.push(dep)
        //console.log(priSec)
    }))
    return retDeps
}

const getHeaderValues = async(formulas,depValues,header)=>{
    const url = 'http://localhost:5001/formula'
    const formulaValues = {}
    const formulaIds = []
    const limit = 100
    let count = 0

    while(true){
        if(count === limit){
            console.log('LIMIT')
            //console.log(formulaIds)
            return formulaValues
        }

        if(formulaIds.length === formulas.length){
            return formulaValues
        }
        for(const formula of formulas){
            if(formulaIds.includes(formula._id.toString())) continue
            const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm,'');
            const unqiues = formula.vars.map(v=>v.unique)
            const schema = {
                formula : expression,
                variables : null
            }
            
            for(const d of depValues){
                if(unqiues.includes(d.unique) ){
                    
                    if(d.type === 'formula' && formulaValues.hasOwnProperty(d.id.toString())){
                        //console.log("formulaValueFound")
                        //schema.variables[d.name] = d.value
                        d.value = formulaValues[d.id]
                        //continue
                    }
    
                    
                    if(!d.value){
                        continue
                        //schema.variables[d.name] = null
                    }else{
                        if(!schema.variables) schema.variables = {}
                        if(d.type === 'compoundGroup'){
                            schema.variables[d.name] = d.value.map(v=>v.value)
                        }else{
                            schema.variables[d.name] = d.value
                        }   
                        
                    }
                }
            }
    
            if(schema.variables){

                let allFound = true
                for(const t of formula.vars){
                    if(!schema.variables.hasOwnProperty(t.name)){
                        allFound = false
                    }
                }
                if(allFound){
                    try {
                        
                        const finalRes = await axios.post(url,schema)
                        const finalResValue = finalRes.data.value
                        // console.log({f:formula.name,n:header.name,schema,finalResValue})

                        formulaValues[formula._id.toString()] = finalResValue
                        formulaIds.push(formula._id.toString())
                    } catch (error) {

                        console.log("ERROR")
                        console.log(error.response.data)
                        console.log({formula,unqiues,schema,allFound})
                    }


                }else{
                    console.log("NOTALLFOUND")
                    console.log({f:formula.name,unqiues,schema,allFound,h:header.name})
                }
                
            }
        }
        count++
    }


    return formulaValues
}



const getFlareNonFormulaValues = async(flareid,deps,date)=>{
    const options = {flareid,headerid:null,date}
    const depValues  = await getNonFormulaValues(deps,options)
    return depValues
}


const getAllFormulaValues = async(args={})=>{
    try {
        // const dtValues = [
        //     {date:'2020-02-01',time:"00:01"},
        //     {date:'2020-02-01',time:"00:02"},
        //     {date:'2020-02-01',time:"00:03"},
        //     {date:'2020-02-01',time:"00:04"},
        //     {date:'2020-02-01',time:"00:05"},
        //     {date:'2020-02-01',time:"00:06"},
        //     {date:'2020-02-01',time:"00:07"},
        //     {date:'2020-02-01',time:"00:08"},
        //     {date:'2020-02-01',time:"00:09"},
        //     {date:'2020-02-01',time:"00:10"},
        // ]
        // await Promise.all(dtValues.map(async(kv)=>{

        // }))
        // for(const kv of dtValues){

        // }
        const test = new CalcFormula()
        await test.main()


    } catch (error) {
        console.log("ERROR")
        if(error.response && error.response.data){
            console.log(error.response.data)
            console.log(error.response.config)
        }else{
            console.log(error)
        }
        
    }
}

const getFlareHeaders = async(flareid)=>{
    const allHeaders = await getHeaders()
    const headers = allHeaders.filter(h=>h.flare._id.toString() === flareid.toString())
    return headers
}


class CalcFormula{
    constructor(date,time,flareid){
        this.rawDate = date? date :'2020-05-01'
        this.rawTime = time ? time : '15:00'
        //this.flareid = ObjectId('5fb6fac8b496f2ae0e0e6844') //FCC
        this.flareid = flareid? ObjectId(flareid) : ObjectId('5fb6fac8b496f2ae0e0e6844' )//LIU
        //this.flareid = flareid? ObjectId(flareid) : ObjectId('5fb6f872b496f2ae0e0e6843' )//LIU
        this.date = new Date(`${this.rawDate} ${this.rawTime}z`)
        
    }
    async main(){
        axios.defaults.httpAgent = new http.Agent({ keepAlive: true ,keepAliveMsecs:3000})
        axios.defaults.httpsAgent= new https.Agent({ keepAlive: true ,keepAliveMsecs:3000})
        axios.defaults.proxy = "http://localhost:5000"
        await this.init()


        /* For testing purposes, this creates an array of date times */
        const dateToParse = '2020-02-01'
        
        const minutesToParse = 120
        let newDate = new Date(`${dateToParse} 00:00z`)
        let thismin = 0
        const dateArray = []
        while(true){
            if(thismin === minutesToParse) break
            const thisDate = new Date(newDate)
            thisDate.setMinutes(thismin)
            dateArray.push(thisDate)
            thismin++
        }

        const chunks = chunkArray(dateArray,60)

        await Promise.all(chunks.map(async(chunk)=>{
            await Promise.all(chunk.map(async(date)=>{
                await this.getData(date)
    
                
                //console.log('done getting data',date)
                const depValues = await this.getNonFormulaValues(this.piTags)
                //console.log(depValues)
                
                //console.log('done getNonFormulaValues',date)
                await this.getFormulaValues(depValues)
                // console.log('done formula data',date)
                
                const formulaDepValues = depValues.filter(row=>row.type === 'formula')
                //console.log(formulaDepValues)
                const bulkUpdates = []
                
                
                await Promise.all(formulaDepValues.map(async(dep)=>{
                    const startDate = new Date(date)
                    startDate.setMinutes(startDate.getMinutes() - 1)
                    const dbSchema = {
                        date : date,
                        start : startDate,
                        org : ObjectId(orgId),
                        logicId : ObjectId(dep.id),
                        //created : new Date(),
                        value : dep.value,
                        flare : this.flareid,
                        header : dep.to === 'headers' ? ObjectId(dep.parentid) : null
                    }
                    const query = {
                        logicId : dbSchema.logicId,
                        date : dbSchema.date,
                        org : dbSchema.org,
                        flare : dbSchema.flare,
                        header : dbSchema.header,
                    }
                    const onInsert = {created : new Date()}
                    const bulkSchema = {
                        filter : query,
                        update : {$set:dbSchema,$setOnInsert:onInsert},
                        upsert: true
                    }
    
    
                    bulkUpdates.push({updateOne:bulkSchema})
                }))
                await this.formulasColl.bulkWrite(bulkUpdates)
                // console.log('done writing data',date)
                
                //console.log(JSON.stringify(formulaDepValues,null,4))
    
            }))
        }))


        // for (const chunk of chunks){
        //     console.log(chunk)

        // }







    }


    async init(){
        /* 
            Gets all the required inital data, this entire process should take on avg 5-7ms from cache
        */


        [
            this.formulas,this.headers,
            this.piTags,this.constants,
            this.piValuesColl,this.formulasColl,this.compoundGroups,
            this.flares,this.compounds,this.data
        ] = await Promise.all([
            getSortedFormulas(),
            getFlareHeaders(this.flareid),
            this.getFlarePiTags(),
            getConstants(),
            getCollection('pivalues'),
            getCollection('formulaValues'),
            getCompoundGroups(),
            getFlares(),
            getCompounds(),
            
        ]);
        console.log('Done getting init Data')
        
        this.formulaDepends = await getAllFormulaDepends(this.formulas)

    }


    async getFormulaValues(depValues){
        for(const formula of this.formulas){

            if(formula.to === 'headers'){

                await Promise.all(this.headers.map((async(header)=>{
                    const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm,'');
                    const unqiues = formula.vars.map(v=>v.newUnique)
                    //const ids = formula.vars.map(v=>v.id)
                    const schema = {
                        formula : expression,
                        variables : {},
                        unqiues,
                        formulaName : formula.name,
                        formulaId : formula._id,
                        parentName : header.name,
                        parentid : header._id,
    
                    }
                    await Promise.all(unqiues.map(async(uni)=>{
                        const headerFound = depValues.filter(row=>row.newUnique === uni && row.parentid === header._id.toString())
                        const flareFound = depValues.filter(row=>row.newUnique === uni && row.parentid.toString() === this.flareid.toString())
                        const fVar = formula.vars.filter(row=>row.newUnique === uni)[0]
                        
                        /* Turn the variable name in the formula to an array formula {} */
                        if(headerFound.length === 0){
                            schema.variables[fVar.name] = null
                        }else if(headerFound.length === 1){

                            if(headerFound[0].type === 'compoundGroup'){
                                const replace = fVar.name;
                                const re = new RegExp(replace,"gm");
                                schema.formula = schema.formula.replace(re,`{${fVar.name}}`)
                                if(headerFound[0].value.length === 0){
                                    schema.variables[fVar.name] = null
                                }else{
                                    schema.variables[fVar.name] = headerFound[0].value.map(v=>v.value)
                                }
                            }else{
                                schema.variables[fVar.name] = headerFound[0].value
                            }
                        }else{
                            const replace = fVar.name;
                            const re = new RegExp(replace,"gm");
                            schema.formula = schema.formula.replace(re,`{${fVar.name}}`)
                            schema.variables[fVar.name] = headerFound[0].value//.map(v=>v.value)
                        }

                        if(flareFound.length > 0 ){
                            schema.variables[fVar.name] = flareFound[0].value
                        }
                    }))

                    const finalRes = await axios.post(pythonURL,schema)
                    let finalResValue = null
                    if(pythonURL.includes('amazonaws')){
                        finalResValue = JSON.parse(finalRes.data.body).value
                    }else{
                        finalResValue = finalRes.data.value
                    }

                    schema.value = finalResValue
                    const targetFormulaDeps = depValues.filter(row=>row.id.toString() === formula._id.toString() && row.parentid === header._id.toString())
                    for(const tdep of targetFormulaDeps){
                        tdep.value = schema.value
                    }
                })))

            }else{
                const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm,'');
                const unqiues = formula.vars.map(v=>v.newUnique)
                const schema = {
                    formula : expression,
                    variables : {},
                    unqiues,
                    formulaName : formula.name,
                    formulaId : formula._id,
                }
                
                await Promise.all(unqiues.map(async(uni)=>{
                    const fVar = formula.vars.filter(row=>row.newUnique === uni)[0]
                    
                    if(fVar.to === 'headers'){
                        const headerValues = []
                        for(const header of this.headers){
                            const headerFound = depValues.filter(row=>row.newUnique === uni && row.parentid === header._id.toString())[0]
                            if(headerFound){
                                headerValues.push(headerFound.value)
                            }else{
                                headerValues.push(null)
                            }
                        }
                        if(headerValues.length === 0){
                            schema.variables[fVar.name] = null
                        }else if(headerValues.length === 1){
                            schema.formula = schema.formula.replace(fVar.name,`{${fVar.name}}`)
                            schema.variables[fVar.name] = headerValues
                        }else{
                            schema.formula = schema.formula.replace(fVar.name,`{${fVar.name}}`)
                            schema.variables[fVar.name] = headerValues
                        }
                    }else{
                        const flareFound = depValues.filter(row=>row.newUnique === uni && row.parentid.toString() === this.flareid.toString())[0] /// 
                        schema.variables[fVar.name] = flareFound.value
                    }
                }))

                const targetFormulaDeps = depValues.filter(row=>row.id.toString() === formula._id.toString())
                const finalRes = await axios.post(pythonURL,schema)
                let finalResValue = null
                if(pythonURL.includes('amazonaws')){
                    finalResValue = JSON.parse(finalRes.data.body).value
                }else{
                    finalResValue = finalRes.data.value
                }
                schema.value = finalResValue
                for(const tdep of targetFormulaDeps){
                    tdep.value = schema.value
                }
            }
        }
    }

    async getNonFormulaValues () {
        const flare = this.flares.filter(f=>f._id.toString() === this.flareid.toString())[0]
        const allData = []
        await Promise.all(this.formulaDepends.map(async(orgDep)=>{
            const dep = {...orgDep}
            if(dep.type === 'formula'){
                if(dep.to === 'headers'){
                    this.headers.map(header=>{
                        const thisDep = {...orgDep}
                        thisDep.parentid = header._id.toString()
                        thisDep.value = null
                        allData.push(thisDep)
                    })
                }else{
                    const thisDep = {...orgDep}
                    thisDep.parentid = this.flareid
                    allData.push(thisDep)
                }
                return //dep
            } 
            
            if(dep.type === 'flare'){
                const thisDep = {...orgDep}
                thisDep.parentid = this.flareid
                thisDep.value = flare[dep.param]
                allData.push(thisDep)

                return //dep
            }
            
            if(dep.type === 'header'){
                this.headers.map(header=>{
                    const thisDep = {...orgDep}
                    thisDep.parentid = header._id.toString()
                    thisDep.value = header[dep.param]
                    allData.push(thisDep)
                })
                return //dep
            }

            if(dep.type === 'constant'){
                const found = this.constants.filter(c=>c._id.toString() === dep.id.toString())[0]
                const value = found.value
                this.headers.map(header=>{
                    const thisDep = {...orgDep}
                    thisDep.parentid = header._id.toString()
                    thisDep.value = value
                    allData.push(thisDep)
                })
                const thisDep = {...orgDep}
                thisDep.parentid = this.flareid
                thisDep.value = value
                allData.push(thisDep)

                //dep.value = found.value
                return //dep
            }
            
            if(dep.type === 'compound'){
                const found = this.compounds.filter(c=>c._id.toString() === dep.id.toString())[0]
                const value = found[dep.attr[0]]
                this.headers.map(header=>{
                    const thisDep = {...orgDep}
                    thisDep.parentid = header._id.toString()
                    thisDep.value = value
                    allData.push(thisDep)
                })
                const thisDep = {...orgDep}
                thisDep.parentid = this.flareid
                thisDep.value = value
                allData.push(thisDep)
                return 
            }
            
            if(dep.type === 'parameter' && dep.parent === 'flare'){
                const thisDep = {...orgDep}
                thisDep.parentid = this.flareid
                const found = this.piTags.filter(tag=>tag.parameter._id.toString() === dep.id.toString())
                if(found.length === 0){
                    thisDep.value = null
                    allData.push(thisDep)
                    return
                } 
                thisDep.parentid = this.flareid
                thisDep.value = found[0].value.value
                allData.push(thisDep)
                return
            }

            if(dep.type === 'parameter' && dep.parent === 'header'){
                dep.value = []
                const found = this.piTags.filter(tag=>tag.parameter._id.toString() === dep.id.toString())
                let isPri = null
                if(dep.attr.includes('primary')) isPri = true
                if(dep.attr.includes('secondary')) isPri = false
                this.headers.map(header=>{
                    const thisDep = {...orgDep}
                    thisDep.parentid = header._id.toString()
                    for(const tag of found){
                        if(tag.header._id.toString() !== header._id.toString()) continue
                        if(isPri !== null && tag.sensor.isPrimary !== isPri) continue
                        if(dep.attr.includes('max')){
                            thisDep.value = tag.max
                            allData.push(thisDep)
                            return
                        }
                        if(dep.attr.includes('min')){
                            thisDep.value = tag.min
                            allData.push(thisDep)
                            return
                        }
                        thisDep.value = tag.value.value
                        allData.push(thisDep)
                        return
                    }
                    thisDep.value = null
                    allData.push(thisDep)
                })
                return dep
            }

            if(dep.type === 'compoundGroup'){
                dep.value = []
                const cGroup = this.compoundGroups.filter(row=>row.name === dep.param)[0]
                
                this.headers.map(header=>{
                    const thisDep = {...orgDep}
                    thisDep.parentid = header._id.toString()
                    thisDep.value = []
                    for(const compound of cGroup.compounds){
                        let value = null
                        for(const tag of this.piTags){
                            if(!tag.parameter.compound) continue
                            if(tag.parameter.compound.toString() !== compound._id.toString()) continue
                            if(tag.header._id.toString() !== header._id.toString()) continue

                            if(dep.attr.includes('netHeatingValue')){
                                if(tag.sensor.isPrimary === true){
                                    value ={value:compound.netHeatingValue,compound:compound.name}
                                    break
                                }
                            }
                            if(dep.attr.includes('primary')){
                                if(tag.sensor.isPrimary === true){
                                    value ={id:header._id.toString(),value:tag.value.fracValue,compound:compound.name}
                                    value ={id:header._id.toString(),value:tag.value.fracValue,compound:compound.name}
                                    break
                                }
                            }
                            if(dep.attr.includes('secondary')){
                                if(tag.sensor.isPrimary === false){
                                    value ={id:header._id.toString(),value:tag.value.fracValue,compound:compound.name}
                                    break
                                }
                            }
                        }
                        if(!value) continue
                        thisDep.value.push(value)
                    }
                    allData.push(thisDep)



                })
                return
            }
        }))

        
        return allData
    }

    async getData(date){
        
        /* Gets ALL the data for the given date, basically one value for each tag */
        const pipeline = [
            {
              $match: {
                date: date, 
                org: new ObjectId(orgId)
              }
            },
            {
                $project: {
                    _id: 0, 
                    piTag: 1, 
                    value: 1
                }
            }
          ]
        const res = await this.piValuesColl.aggregate(pipeline).toArray()
        
        this.piTags.map(async(tag)=>{
            const found = res.filter(t=>t.piTag._id.toString()=== tag._id.toString())[0]
            const value = found.value
            const div = fracMapping[tag.parameter.unitOfMeasure]
            const fracValue = div ? value/div : value
            found.fracValue = fracValue
            tag.value = found
        })
    }

    async getFlarePiTags(){
        const tags = await getPiTags()
        const flareTags = tags.filter(t=>t.flare._id.toString() === this.flareid.toString())
        return flareTags
    }

    async getCompoundValue (id,attr){
        const compound = this.compounds.filter(c=>c._id.toString() === id.toString())[0]
        if(attr === 'molecularWeight') return compound.molecularWeight
    }
    async getFlareAttr (id,attr) {
        const flare = this.flares.filter(f=>f._id.toString() === id.toString())[0]
        return flare[attr]
    }
    async getHeaderAttr  (id,attr){
        const header = this.headers.filter(h=>h._id.toString() === id.toString())[0]
        return header[attr]
    }
    async getConstantValue (id){
        const found = this.constants.filter(c=>c._id.toString() === id.toString())[0]
        return found.value
    }

    async getCGroupValues(args={}) {
        args.groupName = 'All'
        args.attr = 'fractional'
        args.header = '5fb6fc4ded5c61ae6c9c0fdf'
        args.primary = true
        const compounds = this.compoundGroups.filter(row=>row.name === args.groupName)[0].compounds
        const compoundTags = this.piTags.filter(tag=>tag.parameter.compound !== null)
        
        const values = []
        // console.log(compoundTags)
        
        await Promise.all(compounds.map(compound=>{
            for(const tag of compoundTags){
                
                
                if(tag.parameter.compound.toString() !== compound._id.toString()) continue
                if(args.attr === 'netHeatingValue'){
                    values.push({
                        value:compound.netHeatingValue,
                        compound:compound.name,
                    })
                    return
                }

                if(tag.flare._id.toString() !== this.flareid.toString()) continue
                
                
                if(args.header){
                    if(tag.header._id.toString() !== args.header.toString()) continue
                }
                

                if(tag.sensor.isPrimary !== args.primary) continue
                // console.log(tag)
                if(args.attr === 'fractional'){
                    const div = fracMapping[tag.parameter.unitOfMeasure]
                    const fracValue = tag.value.value/div
                    values.push({
                        compound:compound.name,
                        value : fracValue,
                    })
                }
                
                return
            }
    
            
            
    
        }))
        // console.log(values)
    
    

        if(values.length === 0) return null
        return values
    }



}





module.exports = {
    parseIncomingFormula,
    getAllValues,getNumOptions, getExportOptions, getChartingOptions,
    getPiTags,getCompoundGroups,parseFormulas,
    getFormulas,getFlares,
    getPiData,getFormulaDepends,
    getParamValue,getCGroupValues,
    getConstantValue,getFlareAttr,getCompoundValue,getAllFormulaValues,
    varNamesToIds,
    CalcFormula, getOrgInfo
}