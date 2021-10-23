const axios = require('axios')
const http = require('http');
const https = require('https');
const { MongoClient,ObjectId } = require("mongodb");
require('dotenv').config();


const orgId = '5fb6b7ea6b029226f07d2677'
//const pythonURL = 'http://localhost:5001/formula'
const pythonURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/formulavalue'
let client = null

const allData = {}

const fracMapping = {
    "mol%" : 100,
    "mol" : 100,
    "ppm" : 1000000,
    "ppb" : 1000000000,
}
const chunkArray = (arr,len) => {
    var chunks = [],
      i = 0,
      n = arr.length;
    while (i < n) {
      chunks.push(arr.slice(i, (i += len)));
    }
    return chunks;
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

const connectMongo = async()=>{
    const DBURI = 'mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair.znftk.mongodb.net/test?retryWrites=true&w=majority';
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    const thisClient = new MongoClient(DBURI, options);
    
    await thisClient.connect();
    console.log('MongoDB Connected')
    client = thisClient
}

const getCollection = async (collName) => {
    const database = client.db('test');
    return database.collection(collName);
};

const getConstants = async(args={})=>{
    if(allData.constants){
      return allData.constants
    }
    const collection = await getCollection('constants')
    const res = await collection.find({}).toArray()
    const sorted = SortByName(res)
    allData.constants = sorted
    return sorted
}
const getCompounds = async(args={})=>{
    if(allData.compounds){
      return allData.compounds
    }

    const collection = await getCollection('compounds')
    const res = await collection.find({}).toArray()
    const sorted = SortByName(res)
    allData.compounds = sorted
    return sorted
}

const getSortedFormulas = async(args={})=>{
  /* 
      Gets all the formulas and sorts them based on their dependancies on other formulas,
      it does this by looping thru each formula, if a variable is 'known', then we know what that
      variables value is.   If the variable is not 'known'.... we cant determine the value.
      if all the formula variables are 'known' the formulas value can be determined.
  */

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

  return allFounds
}

const getFormulas = async(args={})=>{
    if(!allData.constants){
      await getConstants()
    }
    const constants = allData.constants
    if(!allData.compoundgroups){
      await getCompoundGroups()
    }
    const compoundGroups = allData.compoundgroups
    
    if(!allData.pitags){
      await getPiTags()
    }
    const tags = allData.pitags


    const collection = await getCollection('formulas')
    const formulas = await collection.find({org:ObjectId(orgId)}).toArray()
    for(const formula of formulas){
      const Schema = {
        name : null,
        type : null,
        id : null,
        param : null,
        unique : null,
        attr : [],
      }
      const variables = formula.newFormula ? formula.newFormula.match(/\blet .*;/gm): null
      
      if(!variables){
        formula.uiDisplay = null
        formula.variables = []
        continue
      } 
      let newFormula = formula.newFormula

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
          
          //console.log({thisSchema})
          if(thisSchema.type === 'formula'){
              let found = formulas.filter(row=>row._id.toString() === thisSchema.id.toString() )[0]
              thisSchema.param = found.name
              thisSchema.to = found.to
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
          vars.push(thisSchema)
          newFormula = newFormula.replace(thisSchema.id,`"${thisSchema.param}"`)
      }

      formula.uiDisplay = newFormula
      formula.vars = vars
    }
    
    //console.log(JSON.stringify(formulas,null,4))
    const sorted = SortByName(formulas)
    allData.formulas = sorted
    return allData.formulas
}

const getPiTags = async(args={})=>{
    if(allData.pitags){
      return allData.pitags
    }
    const flareTagsPipe = [
        {
          '$match': {
            'header': null
          }
        },
        {
          '$lookup': {
            'from': 'sensors', 
            'localField': 'sensor', 
            'foreignField': '_id', 
            'as': 'sensor'
          }
        }, 
        {
          '$unwind': {
            'path': '$sensor'
          }
        }, 
        {
          '$lookup': {
            'from': 'parameters', 
            'localField': 'parameter', 
            'foreignField': '_id', 
            'as': 'parameter'
          }
        }, 
        {
          '$unwind': {
            'path': '$parameter'
          }
        },

        // {
        //     '$lookup': {
        //       'from': 'headers', 
        //       'localField': 'header', 
        //       'foreignField': '_id', 
        //       'as': 'header'
        //     }
        //   }, 
        //   {
        //     '$unwind': {
        //       'path': '$header'
        //     }
        //   },
          {
            '$lookup': {
              'from': 'flares', 
              'localField': 'flare', 
              'foreignField': '_id', 
              'as': 'flare'
            }
          }, 
          {
            '$unwind': {
              'path': '$flare'
            }
          },
      ]
    const headerTagsPipe = [
        {
          '$match': {
            'header': {$ne: null}
          }
        },
        {
          '$lookup': {
            'from': 'sensors', 
            'localField': 'sensor', 
            'foreignField': '_id', 
            'as': 'sensor'
          }
        }, 
        {
          '$unwind': {
            'path': '$sensor'
          }
        }, 
        {
          '$lookup': {
            'from': 'parameters', 
            'localField': 'parameter', 
            'foreignField': '_id', 
            'as': 'parameter'
          }
        }, 
        {
          '$unwind': {
            'path': '$parameter'
          }
        },

        {
            '$lookup': {
              'from': 'headers', 
              'localField': 'header', 
              'foreignField': '_id', 
              'as': 'header'
            }
          }, 
          {
            '$unwind': {
              'path': '$header'
            }
          },
          {
            '$lookup': {
              'from': 'flares', 
              'localField': 'flare', 
              'foreignField': '_id', 
              'as': 'flare'
            }
          }, 
          {
            '$unwind': {
              'path': '$flare'
            }
          },
      ]
    const collection = await getCollection('pitags')
    const [headerTags,flareTags] = await Promise.all([
      collection.aggregate(headerTagsPipe).toArray(),
      collection.aggregate(flareTagsPipe).toArray()
    ])

    const tags = [...headerTags,...flareTags]
    const sorted = SortByName(tags)
    allData.pitags = sorted
    return allData.pitags

}

const getCompoundGroups = async(args={})=>{
  if(allData.compoundgroups){
    return allData.compoundgroups
  }
  if(!allData.compounds){
    await getCompounds()
  }
  const collection = await getCollection('compoundgroups')
  const groups = await collection.find({org:ObjectId(orgId)}).toArray()
  const newGroups = [...groups]
  for(const group of newGroups){
    const compounds = []
    for(const compound of group.compounds){
      const thisCompound = allData.compounds.filter(row=>row._id.toString() === compound.toString())[0]
      compounds.push(thisCompound)
    }
    group.compounds = compounds
  }


  allData.compoundgroups = newGroups
  

  return allData.compoundgroups
}

const getHeaders = async(args={})=>{
  if(allData.headers){
    return allData.headers
  }
  const pipe = [
    {
      '$lookup': {
        'from': 'flares', 
        'localField': 'flare', 
        'foreignField': '_id', 
        'as': 'flare'
      }
    }, 
    {
      '$unwind': {
        'path': '$flare'
      }
    }, 
  ]
  const collection = await getCollection('headers')
  const res = await collection.aggregate(pipe).toArray()
  const sorted = SortByName(res)
  allData.headers = sorted
  return sorted
}

const getFlares = async(args={})=>{
  if(allData.flares){
    return allData.flares
  }


  const piValueCollection =  await getCollection('pivalues')
  const flareColl = await getCollection('flares')
  const flares = await flareColl.find({org:ObjectId(orgId)}).toArray()
  const flareObjects = await Promise.all(flares.map(async (flare)=>{
      //const flare = f.toJSON()
      let startPipeline = [
          {'$sort': {'date': 1}},
          {
            '$lookup': {
              'from': 'pitags', 
              'localField': 'piTag', 
              'foreignField': '_id', 
              'as': 'tag'
            }
          }, 
          {'$unwind': {'path': '$tag'}}, 
          {'$addFields': {'flare': '$tag.flare'}},
          {'$project': {
              'date': 1, 
              '_id': 0, 
              'flare': 1
            }
          }, 
          {'$match': {'flare': flare._id}}, 
          {'$limit': 1 }
      ]
      
      const start = await piValueCollection.aggregate(startPipeline).toArray()
      let endPipeline = [
          {'$sort': {'date': -1}},
          {
            '$lookup': {
              'from': 'pitags', 
              'localField': 'piTag', 
              'foreignField': '_id', 
              'as': 'tag'
            }
          }, 
          {'$unwind': {'path': '$tag'}}, 
          {'$addFields': {'flare': '$tag.flare'}},
          {'$project': {
              'date': 1, 
              '_id': 0, 
              'flare': 1
            }
          }, 
          {'$match': {'flare': flare._id}}, 
          {'$limit': 1 }
      ]
      
      const end = await piValueCollection.aggregate(endPipeline).toArray()

      flare.start = start[0].date
      flare.end = end[0].date
      return flare
  }))

  const sorted = SortByName(flareObjects)
  allData.flares = sorted
  return allData.flares

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

const getFlareHeaders = async(flareid)=>{
  const allHeaders = await getHeaders()
  const headers = allHeaders.filter(h=>h.flare._id.toString() === flareid.toString())
  allData.headers = headers
  return headers
}

const getFlarePiTags = async(flareid) =>{
  const tags = await getPiTags()
  const flareTags = tags.filter(t=>t.flare._id.toString() === flareid.toString())
  return flareTags
}

const getNonFormulaValues = async (flareid,formulaDepends)=> {
  const flares = await getFlares()
  const headers = await getFlareHeaders(flareid)
  const compoundGroups = await getCompoundGroups()
  
  const piTags = await getPiTags()
  const constants = await getConstants()
  const compounds = await getCompounds()



  const flare = flares.filter(f=>f._id.toString() === flareid.toString())[0]
  const allData = []
  await Promise.all(formulaDepends.map(async(orgDep)=>{
      const dep = {...orgDep}
      if(dep.type === 'formula'){
          if(dep.to === 'headers'){
            headers.map(header=>{
                  const thisDep = {...orgDep}
                  thisDep.parentid = header._id.toString()
                  thisDep.value = null
                  allData.push(thisDep)
              })
          }else{
              const thisDep = {...orgDep}
              thisDep.parentid = flareid
              allData.push(thisDep)
          }
          return //dep
      } 
      
      if(dep.type === 'flare'){
          const thisDep = {...orgDep}
          thisDep.parentid = flareid
          thisDep.value = flare[dep.param]
          allData.push(thisDep)

          return //dep
      }
      
      if(dep.type === 'header'){
        headers.map(header=>{
              const thisDep = {...orgDep}
              thisDep.parentid = header._id.toString()
              thisDep.value = header[dep.param]
              allData.push(thisDep)
          })
          return //dep
      }

      if(dep.type === 'constant'){
          const found = constants.filter(c=>c._id.toString() === dep.id.toString())[0]
          const value = found.value
          headers.map(header=>{
              const thisDep = {...orgDep}
              thisDep.parentid = header._id.toString()
              thisDep.value = value
              allData.push(thisDep)
          })
          const thisDep = {...orgDep}
          thisDep.parentid = flareid
          thisDep.value = value
          allData.push(thisDep)

          //dep.value = found.value
          return //dep
      }
      
      if(dep.type === 'compound'){
          const found = compounds.filter(c=>c._id.toString() === dep.id.toString())[0]
          const value = found[dep.attr[0]]
          headers.map(header=>{
              const thisDep = {...orgDep}
              thisDep.parentid = header._id.toString()
              thisDep.value = value
              allData.push(thisDep)
          })
          const thisDep = {...orgDep}
          thisDep.parentid = flareid
          thisDep.value = value
          allData.push(thisDep)
          return 
      }
      
      if(dep.type === 'parameter' && dep.parent === 'flare'){
          const thisDep = {...orgDep}
          thisDep.parentid = flareid
          const found = piTags.filter(tag=>tag.parameter._id.toString() === dep.id.toString())
          if(found.length === 0){
              thisDep.value = null
              allData.push(thisDep)
              return
          } 
          thisDep.parentid = flareid
          thisDep.value = found[0].value.value
          allData.push(thisDep)
          return
      }

      if(dep.type === 'parameter' && dep.parent === 'header'){
          dep.value = []
          const found = piTags.filter(tag=>tag.parameter._id.toString() === dep.id.toString())
          let isPri = null
          if(dep.attr.includes('primary')) isPri = true
          if(dep.attr.includes('secondary')) isPri = false
          headers.map(header=>{
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
          const cGroup = compoundGroups.filter(row=>row.name === dep.param)[0]
          //console.log(JSON.stringify(cGroup,null,4))
          headers.map(header=>{
              const thisDep = {...orgDep}
              thisDep.parentid = header._id.toString()
              thisDep.value = []
              for(const compound of cGroup.compounds){
                  let value = null
                  for(const tag of piTags){
                      //console.log(tag)
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


class Timer {
  constructor(funcname='Function'){
      this.funcname = funcname
      this.startTime = null
      this.endTime = null
      this.time = null
  }
  start(){
      this.startTime = new Date().getTime();
  }

  stop(){
      this.endTime = new Date().getTime();
      this.duration = (this.endTime - this.startTime) /1000
      console.log(`${this.funcname} took ${this.duration} seconds.`)
  }
}

const getData =async(date)=>{
  const piValueCollection =  await getCollection('pivalues')
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
  const res = await piValueCollection.aggregate(pipeline).toArray()
  //console.log(JSON.stringify(res,null,4))
  allData.pitags.map(async(tag)=>{
      //console.log(tag)
      const found = res.filter(t=>t.piTag.toString()=== tag._id.toString())[0]
      const value = found.value
      const div = fracMapping[tag.parameter.unitOfMeasure]
      const fracValue = div ? value/div : value
      found.fracValue = fracValue
      tag.value = found
  })
}

const getFormulaValues = async (depValues,formulas)=>{
  const headers = await getFlareHeaders(allData.flareid)
  console.log('done headers')
  const flareid = allData.flareid
  //const formulas = await getSortedFormulas()
  
  for(const formula of formulas){

      if(formula.to === 'headers'){
          await Promise.all(headers.map((async(header)=>{
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
                  const flareFound = depValues.filter(row=>row.newUnique === uni && row.parentid.toString() === flareid.toString())
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
                  for(const header of headers){
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
                  const flareFound = depValues.filter(row=>row.newUnique === uni && row.parentid.toString() === flareid.toString())[0] /// 
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
      console.log(`done with ${formula.name}`)
  }
}

const main = async() =>{
    axios.defaults.httpAgent = new http.Agent({ keepAlive: true ,keepAliveMsecs:3000})
    axios.defaults.httpsAgent= new https.Agent({ keepAlive: true ,keepAliveMsecs:3000})
    const timer = new Timer()
    
    const flareid = ObjectId('5fb6fac8b496f2ae0e0e6844' )
    allData.flareid = flareid


    await connectMongo()
    await Promise.all([
        getPiTags(),
        getConstants(),
        getCompounds(),
        getCompoundGroups(),
        getFlareHeaders(flareid),
        getFlares(),
        getFlarePiTags(flareid)
        
    ])
    const formulas = await getSortedFormulas()
    console.log(formulas.length)
    const formulaDepends = await getAllFormulaDepends(formulas)
    const dateToParse = '2020-02-01'
        
    const minutesToParse = 1
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
    console.log('done getting starter data')
    
    const chunks = chunkArray(dateArray,30)
    let doneDates = 0
    /* Starting the time here.... to determine the actual time to process a time chunk */
    timer.start()
    await Promise.all(chunks.map(async(chunk)=>{
      await Promise.all(chunk.map(async(date)=>{

        const thisTimer = new Timer(date.toISOString())
        thisTimer.start()
        const data = await getData(date)
        console.log('done getting db data')
        const depValues= await getNonFormulaValues(flareid,formulaDepends)
        console.log(depValues)
        console.log(depValues.length)
        console.log('done getting getNonFormulaValues data')
        await getFormulaValues(depValues,formulas)
        const formulaDepValues = depValues.filter(row=>row.type === 'formula')
        console.log(formulaDepValues.length)

        const bulkUpdates = []
        await Promise.all(formulaDepValues.map(async(dep)=>{
          const startDate = new Date(date)
          startDate.setMinutes(startDate.getMinutes() - 1)
          const dbSchema = {
              date : date,
              start : startDate,
              org : ObjectId(orgId),
              logicId : ObjectId(dep.id),
              value : dep.value,
              flare : this.flareid,
              header : dep.to === 'headers' ? ObjectId(dep.parentid) : null
          }
          bulkUpdates.push(dbSchema)
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
  
  
          //bulkUpdates.push({updateOne:bulkSchema})
        }))
        
        
        thisTimer.stop()
        console.log(bulkUpdates.length)
        /* Uncomment below to see the  */
        //console.log(JSON.stringify(bulkUpdates,null,4))
        doneDates++

      }))
      

    }))

    // const chunks = chunkArray(dateArray,60)
    // const chunk = chunks[0]
    // const date = chunk[0]



    


    
    timer.stop()
    console.log(doneDates)
    if(client) client.close()
    
}

try {

  main()
  
} catch (error) {
  console.log(error)
  if(client) client.close()
}

