const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Formula, Flare, Header,
  PiTag, Compound, Constant, DebugFormulaValue, 
  FormulaValue, PiValue, 
  CompoundGroup, PiValuesDebug, EventRule, NumericEventRule
} = require('./FRTModels');



function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

class MongoData {
  constructor(debug = false) {
    this.DEBUG = debug;
    this.connectionString = process.env.DBURI;
    this.client = null;
    this.allData = {};
    //debugColl
    //piCollection
    //productionColl  
  }

  mongooseStatus() {
    return mongoose.connection.readyState;
  }

  async initClient() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.client = await mongoose.connect(this.connectionString, {
            useNewUrlParser: true,
            useCreateIndex: true,
            useFindAndModify: false,
            useUnifiedTopology: true
          })
          console.log('Mongoose Connected')
          return resolve()
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.initClient(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.initClient(): ", error });
        }
      })();
    });
  }

  static async closeClient() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await mongoose.connection.close();
          console.log("Mongoose Connection Closed.");
          return resolve();
        } catch (error) {
          return reject(`Error closing client: ${error}`);
        }
      })();
    });
  }

  async getFlares(orgOid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.flares) {
            return resolve(this.allData.flares)
          }
          // const piValueModel = this.DEBUG ? PiValuesDebug : PiValue; //await this.getCollection('pivalues')
          const flares = await Flare.find({ org: orgOid }).lean().exec();
          const sorted = await this.SortByName(flares);
          this.allData.flares = sorted;
          return resolve(this.allData.flares);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getFlares(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getFlares(): ", error });
        }
      })();
    });
  }

  async getHeaders() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.headers) {
            return resolve(this.allData.headers)
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
          const res = await Header.aggregate(pipe).exec();
          const sorted = await this.SortByName(res);
          this.allData.headers = sorted;
          return resolve(sorted);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getHeaders(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getHeaders(): ", error });
        }
      })();
    });
  }

  async getPiTags() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.piTags) {
            return resolve(this.allData.piTags)
          }
          const flareTagsPipe = [
            {
              '$match': {
                'header': null,
                'enableStoring' : true,
                'enableCalculations' : true
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
                'header': { $ne: null },
                'enableStoring' : true,
                'enableCalculations' : true
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
          const [headerTags, flareTags] = await Promise.all([
            PiTag.aggregate(headerTagsPipe).exec(),
            PiTag.aggregate(flareTagsPipe).exec()
          ])

          const tags = [...headerTags, ...flareTags]
          const sorted = await this.SortByName(tags)
          this.allData.piTags = sorted
          return resolve(this.allData.piTags);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getPiTags(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getPiTags(): ", error });
        }
      })();
    });
  }

  async getCompounds() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.compounds) {
            return resolve(this.allData.compounds)
          }
          const res = await Compound.find({}).lean().exec();
          const sorted = await this.SortByName(res)
          this.allData.compounds = sorted
          return resolve(sorted)
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getCompounds(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getCompounds(): ", error });
        }
      })();
    });
  }

  async getConstants() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.constants) {
            return resolve(this.allData.constants)
          }
          const res = await Constant.find({}).lean().exec()
          const sorted = await this.SortByName(res)
          this.allData.constants = sorted
          return resolve(sorted)

        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getConstants(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getConstants(): ", error });
        }
      })();
    });
  }

  async getFormulas(orgOid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.formulas) {
            return resolve(this.allData.formulas);
          }

          if (!this.allData.constants) {
            await this.getConstants()
          }
          const constants = this.allData.constants
          if (!this.allData.compoundGroups) {
            await this.getCompoundGroups()
          }
          const compoundGroups = this.allData.compoundGroups

          if (!this.allData.piTags) {
            await this.getPiTags()
          }
          const tags = this.allData.piTags
          let formulaFilter = { "org": orgOid, "committed": true };
          const formulas = await Formula.find(formulaFilter).lean().exec();

          for (const formula of formulas) {
            const Schema = {
              name: null,
              type: null,
              id: null,
              param: null,
              unique: null,
              attr: [],
            }
            const variables = formula.newFormula ? formula.newFormula.match(/\blet .*;/gm) : null

            if (!variables) {
              formula.uiDisplay = null
              formula.variables = []
              continue
            }
            let newFormula = formula.newFormula

            const vars = []
            for (const variable of variables) {
              const thisSchema = { ...Schema }

              const split = variable.split("=")
              const rawValue = split[1].trim().replace(';', '')//.replace("in",'')
              const type = rawValue.match(/\w+(?=\()/gm)
              thisSchema.unique = variable
              thisSchema.newUnique = rawValue.replace(/"/gm, '').replace(/'/gm, '')
              if (!type) {
                vars.push(thisSchema)
                continue
              }

              thisSchema.type = type[0];
              thisSchema.name = split[0].replace("let ", "").trim()
              let typeValue = rawValue.match(/(?<=\().+?(?=\))/gm)[0].replace(/"/gm, '');
              let params = typeValue.split(',')
              // console.log("params: ", params)
              if (params.length > 1) typeValue = params[0]
              params.shift()
              params = params.map(param => param.replace(/"/gm, '').replace(/'/gm, ''))
              // console.log("params 2: ", params)
              thisSchema.attr = params
              thisSchema.id = typeValue

              //console.log({thisSchema})
              if (thisSchema.type === 'formula') {
                let found = formulas.filter(row => row._id.toString() === thisSchema.id.toString())[0]
                thisSchema.param = found.name
                thisSchema.to = found.to
              }
              if (thisSchema.type === 'constant') {
                let found = constants.filter(row => row._id.toString() === thisSchema.id.toString())[0]
                thisSchema.param = found.name
              }
              if (thisSchema.type === 'parameter') {
                let found = tags.filter(row => row.parameter._id.toString() === thisSchema.id.toString())[0]
                try {
                  thisSchema.param = found.parameter.name
                } catch(e){
                  console.log("found: ", found)
                  console.log("thisSchema: ", thisSchema)
                  throw e
                }
                //thisSchema.parent = found.header ? found.header._id.toString() : found.flare._id.toString()
                //thisSchema.parentName = found.header ? found.header.name : found.flare.name
                thisSchema.parent = found.header ? 'header' : 'flare'
              }
              if (thisSchema.type === 'compoundGroup') {
                let found = compoundGroups.filter(row => row._id.toString() === thisSchema.id.toString())[0]
                thisSchema.param = found.name
              }
              if (thisSchema.type === 'flare') {
                thisSchema.param = thisSchema.id
              }
              if (thisSchema.type === 'header') {
                thisSchema.param = thisSchema.id
              }
              vars.push(thisSchema)
              newFormula = newFormula.replace(thisSchema.id, `"${thisSchema.param}"`)
            }

            formula.uiDisplay = newFormula
            formula.vars = vars
          }

          //console.log(JSON.stringify(formulas,null,4))
          const sorted = await this.SortByName(formulas)
          this.allData.formulas = sorted
          return resolve(this.allData.formulas);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getFormulas(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getFormulas(): ", error });
        }
      })();
    });
  }

  async getNumericEventRules(orgOID, args={}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const rules = await NumericEventRule.find({ org: orgOID }).lean().exec();
          this.allData.numericEventRules = rules;
          return resolve(rules);
        } catch (e) { return reject(getErrorObject(e, "MongoData.getNumericEventRules()")) }
      })();
    })
  }

  async getEventRules(orgOID, args={}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.eventRules && !args.force) {
            return resolve(this.allData.eventRules)
          }
          const eventRules = await EventRule.find({ org: orgOID }).select('_id checkForValue name checkFor withValues formula resolution use checkForValueType').lean().exec();
          let ruleMap = {};
          let ruleFormulasIDs = {}; //[event rule formulas AND with value formulas]formulas that need to be seperate from bulk DB actions (i.e. the formulas ref by "withValues")
          let ruleOnlyFormulaIDs = {};
          let withValuesToEventRuleMap = {};
          let checkForValueTypesMap = {};

          for (let rule of eventRules) {
            if (rule.formula === null) continue;
            let ruleID = rule._id.toString();
            let formulaID = rule.formula.toString();
            ruleMap[ruleID] = rule;

            ruleFormulasIDs[formulaID] = true;
            ruleOnlyFormulaIDs[formulaID] = true;
            if (rule.checkForValue !== null) {
              let forValueID = rule.checkForValue.toString();
              checkForValueTypesMap[forValueID] = rule.checkForValueType;
              ruleFormulasIDs[forValueID] = true;
              if (withValuesToEventRuleMap[forValueID] === undefined) {
                withValuesToEventRuleMap[forValueID] = [];
              }
              withValuesToEventRuleMap[forValueID].push(rule);
            }
          }

          this.allData.eventRules = ruleMap;
          this.allData.checkForValueTypesMap = checkForValueTypesMap;
          this.allData.eventRuleFormulaIDs = ruleFormulasIDs; //Any ids related to a event rule (formula attr. or withValues attr.)
          this.allData.eventRuleOnlyFormulaIDs = ruleOnlyFormulaIDs;
          this.allData.withValuesToEventRuleMap = withValuesToEventRuleMap;
          return resolve(ruleMap);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getEventRules(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getEventRules(): ", error });
        }
      })();
    });
  }

  async getArrayPiData(dependency, endDate, orgOID, flareOID, headerID = null, isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (!dependency.attr.includes('eventRule_15')) return resolve(null);

          if (dependency.type === 'parameter') {
            let matchingTag = this.allData.piTags.find(tag => {
              let paramMatch = tag.parameter._id.toString() === dependency.id;

              let flareMatch = tag.flare._id.toString() === flareOID.toString();

              let headerMatch = null;
              if (headerID === null) headerMatch = tag.header === null;
              else if (tag.header == null) { headerMatch = false } //skip is null but we dont want null
              else headerMatch = tag.header._id.toString() === headerID;


              let isPriMatch = null;
              let isPri = null
              if (dependency.attr.includes('primary')) isPri = true
              if (dependency.attr.includes('secondary')) isPri = false
              if (isPri !== null) {
                isPriMatch = tag.sensor.isPrimary === isPri
              } else {isPriMatch = true}

              return (paramMatch && flareMatch && headerMatch && isPriMatch);
            });
            if (!matchingTag) return resolve(null);
            let matchingTagOID = matchingTag._id;

            let model = isDebug ? PiValuesDebug : PiValue;
            let startDate = new Date(endDate.getTime() - 14 * 60000); //gives us 15 since its inclusive
            let filter = {
              date: {
                $lte: endDate,
                $gte: startDate,
              },
              org: orgOID,
              piTag: matchingTagOID,
            }
            let result = await model.find(filter).sort('-date').select('value -_id').lean().exec();
            let vals = result.map(item => item.value);
            while (result.length < 15) {
              result.push(null);
            }
            return resolve(vals);
          }
          return resolve(null);
        } catch (error) { return reject(getErrorObject(error, "MongoData.getArrayPiData())")) }
      })();
    });
  }


  /**
 * Method for getting past data. In particular, this is for the event rule formulas where
 * we want to get the last 15 minutes of data and such to agg/avg 
 * @param {*} dependancy the dependancy schema of the formula that includes the 'value' for the current minute and it's formula 'id'
 */
  async getFormulaArrayValues(dependancy, isDebug, endDate, orgOID, flareOID, headerID = null, timespan = 15, valuesOnly = true, endMinuteProvided = true) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let model = isDebug ? DebugFormulaValue : FormulaValue;
          let filterEndDate = endMinuteProvided ? endDate : new Date(endDate.getTime() + 60000)
          let startDate = new Date(endDate.getTime() - (timespan - 1) * 60000); //gives us 15 since its inclusive
          let filter = {
            date: {
              $lt: filterEndDate,
              $gte: startDate,
            },
            org: orgOID,
            flare: flareOID,
            formula: new ObjectId(dependancy.id),
            header : null
          }
          let result = null;
          if (headerID !== null) {
            filter.header = new ObjectId(headerID.toString())
            let selectField = valuesOnly ? 'value header -_id' : 'value header _id date';
            result = await model.find(filter).sort('-date').select(selectField).lean().exec();
            // result = result.filter(item => item.header.toString() === headerID);
          }
          else {
            let selectField = valuesOnly ? 'value -_id' : 'value header _id date';
            result = await model.find(filter).sort('-date').select(selectField).lean().exec();
          }
          let vals = null;
          if (valuesOnly){
            vals = result.map(item => item.value);
            if (endMinuteProvided) vals.unshift(dependancy.value);
            while (vals.length < timespan) {
              vals.push(null);
            }
          } else {
            vals = result;
            if (endMinuteProvided) vals.unshift(dependancy.fullValue);
          }
          return resolve(vals);
        } catch (error) { return reject(getErrorObject(error, "MongoData.getArrayPiData())")) }
      })();
    });
  }


  /**
   * Get the formulas sorted based on dependancies
   */
  async getSortedFormulas(orgOid, formulasToSort = null) { //ERICK --> probably have two seperate ones.. or. if not test, check sorted fomrulas. if test, you must calc
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /* 
              Gets all the formulas and sorts them based on their dependancies on other formulas,
              it does this by looping thru each formula, if a variable is 'known', then we know what that
              variables value is.   If the variable is not 'known'.... we cant determine the value.
              if all the formula variables are 'known' the formulas value can be determined.
          */
          if (this.allData.sortedFormulas) return resolve(this.allData.sortedFormulas);
          let allFormulas = await this.getFormulas(orgOid);
          const formulas = allFormulas;
          const knownVars = []
          const knownVarsIdToOrderNumber = {};
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

          /* 
          <sortedQueueOrder>
          We are going to keep track of formulas that we can calculate concurrently
          0 can all be run concurrently.
          */
          let sortedQueueOrder = 0; 
          for (const f of formulas) {
            let allFound = true
            for (const v of f.vars) {
              if (starters.includes(v.type)) {
                if (!knownVars.includes(v.id)) {
                  knownVars.push(v.id)
                }
              } else {
                if (!unknowns.includes(v.id)) {
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
            if (allFound) {
              allFounds.push(f)
              if (!knownVars.includes(f._id.toString())) {
                f.sortedQueueOrder = sortedQueueOrder;
                knownVars.push(f._id.toString())
                knownVarsIdToOrderNumber[f._id.toString()] = sortedQueueOrder;

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


          while (allFounds.length !== formulas.length) {
            let formulaWasQueued = false;
            sortedQueueOrder++;
            /* 
                we add a limit here to make sure we dont enter an infinate loop.  this SHOULDNT occour
                due to formula validation...  but we dont want to enter an infi loop.
            */
            if (c === max) {
              console.log("Hit while loop max. this is probably inefficient and needs to be updated?")
              break;
              return reject(getErrorObject({}, "Mongo.getSortedFormulas(): While Loop Max Hit."))
            }
            for (const f of formulas) { //for each formula
              if (knownVars.includes(f._id.toString())) continue //if the formula is in knownVars, next formula

              let allFound = true
              let largestOrderedVar = null;
              for (const v of f.vars) { //for each var of formula, if not in knownVars, allFound = false
                if (!knownVars.includes(v.id)) {
                  allFound = false
                }
                else {
                  if ((largestOrderedVar === null) || (largestOrderedVar < knownVarsIdToOrderNumber[v.id]) ) {
                    largestOrderedVar = knownVarsIdToOrderNumber[v.id];
                  }
                }
              }
              if (allFound) {
                if (!knownVars.includes(f._id.toString())) {
                  formulaWasQueued = true;
                  f.sortedQueueOrder = (largestOrderedVar === sortedQueueOrder) ? ++sortedQueueOrder : sortedQueueOrder;
                  knownVars.push(f._id.toString())
                  knownVarsIdToOrderNumber[f._id.toString()] = sortedQueueOrder;
                  allFounds.push(f)
                }
              }
            }
            c++
            if (!formulaWasQueued) sortedQueueOrder--;
          }
          this.allData.formulasByDependancies = allFounds;
          // for (let x of allFounds) console.log("ORDER: ", x.sortedQueueOrder)
          return resolve(allFounds);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getSortedFormulas(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getSortedFormulas(): ", error });
        }
      })();
    });
  }



  async getAllFormulasDepends(formulasToProcess, OrgOID, allFormulas = this.allData.formulas) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /* 
              This function loops thru the formulas and gets the 'newUnique' name  
              for each variable. so that we end with a unique list of values that we need to get.
          */
          async function _helper_(child, allDependants, depids) {
            if (!depids.includes(child.newUnique)) {
              allDependants.push(child)
              depids.push(child.newUnique)
            }

            if (child.type !== 'formula') return
            const formula = allFormulas.filter(row => row._id.toString() === child.id.toString())[0]
            for (const child of formula.vars) {
              await _helper_(child, allDependants, depids)
            }
          }

          if (this.allData.allDependants) return resolve(this.allData.allDependants);
          if (!allFormulas) {
            allFormulas = await this.getFormulas(orgOID);
          }

          let allDependants = []
          const depids = []

          await Promise.all(formulasToProcess.map(async (formula) => {

            for (const child of formula.vars) {
              await _helper_(child, allDependants, depids, allFormulas)
            }
          }))
          this.allData.allDependants = allDependants;
          return resolve(allDependants)
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getAllFormulasDepends(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getAllFormulasDepends(): ", error });
        }
      })();
    });
  }

  async getCompoundGroups(orgOid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData.compoundGroups) {
            return resolve(this.allData.compoundGroups)
          }
          if (!this.allData.compounds) {
            await this.getCompounds()
          }
          const groups = await CompoundGroup.find({ org: orgOid }).lean().exec()

          // console.log("groups found", groups)
          const newGroups = [...groups]
          for (const group of newGroups) {
            const compounds = []
            for (const compound of group.compounds) {
              const thisCompound = this.allData.compounds.filter(row => row._id.toString() === compound.toString())[0]
              compounds.push(thisCompound)
            }
            group.compounds = compounds
          }
          this.allData.compoundGroups = newGroups
          return resolve(this.allData.compoundGroups)
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getcompoundGroups(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getcompoundGroups(): ", error });
        }
      })();
    });
  }

  /**
   * 
   * @param {ObjectId} flareid 
   */
  async getFlareHeaders(flareid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let allHeaders = this.allData.headers;
          if (!allHeaders) {
            await this.getHeaders();
            allHeaders = this.allData.headers;
          }
          const headers = allHeaders.filter(h => h.flare._id.toString() === flareid.toString())
          return resolve(headers);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getFlareHeaders(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getFlareHeaders(): ", error });
        }
      })();
    });
  }

  /**
   * 
   * @param {ObjectId} flareid 
   */
  async getFlarePiTags(flareid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let tags = this.allData.tags;
          if (!tags) {
            await this.getPiTags();
            tags = this.allData.tags
          }
          const flareTags = tags.filter(t => t.flare._id.toString() === flareid.toString())
          return resolve(flareTags)
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getFlarePiTags(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getFlarePiTags(): ", error });
        }
      })();
    });
  }

  async getAllData(orgOid) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.getPiTags();
          // let matchingTag = this.allData.piTags.filter(tag => tag.name == payload.p);
          // if (!matchingTag) throw `ERROR: pitag ${payload.p} not found in collection`
          //TODO DETERMINE FLARE
          await Promise.all([
            this.getConstants(),
            // this.getCompounds(),
            this.getCompoundGroups(orgOid),
            this.getFlares(orgOid),
            this.getHeaders(),
            this.getEventRules(orgOid),
            this.getNumericEventRules(orgOid),
          ]);
          return resolve();
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.getAllData(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.getAllData(): ", error });
        }
      })();
    });
  }

  async checkAllData(orgOID) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (this.allData == {}) await this.getAllData(orgOID);
          else {
            if (!this.allData.flares) await this.getFlares(orgOID);
            if (!this.allData.constants) await this.getConstants();
            if (!this.allData.headers) await this.getHeaders();
            if (!this.allData.piTags) await this.getPiTags();
            if (!this.allData.compounds) await this.getCompounds();
            if (!this.allData.compoundGroups) await this.getCompoundGroups(orgOID);
          }
          resolve();
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.checkAllData(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.checkAllData(): ", error });
        }
      })();
    });
  }

  async SortByName(arrayOfObjects, field = 'name') {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
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
            return resolve(arrayOfObjects.slice().sort(sortByName));
          }
          return resolve();
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.SortByName(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.SortByName(): ", error });
        }
      })();
    });
  }
}

module.exports = MongoData


/**
        return new Promise((resolve, reject) => {
            (async () => {
                try {

                }
                catch (error) {
                    console.log(`Error in Mongo.getConstants(): ${error.message}`);
                    console.log(`Stack Trace:\n${error.stack}`);
                    return reject(error);
                }
            })();
        });
 */