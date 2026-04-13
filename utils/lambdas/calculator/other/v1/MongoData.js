require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Formula, Flare, Header,
  PiTag, Compound, Constant,
  FormulaValue, PiValue,
  CompoundGroup, PiValuesDebug
} = require('./FRTModels')



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
          const piValueModel = this.DEBUG ? PiValuesDebug : PiValue; //await this.getCollection('pivalues')
          const flares = await Flare.find({ org: orgOid }).lean().exec();
          const flareObjects = await Promise.all(flares.map(flare => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  //const flare = f.toJSON()
                  let startPipeline = [
                    { '$sort': { 'date': 1 } },
                    {
                      '$lookup': {
                        'from': 'pitags',
                        'localField': 'piTag',
                        'foreignField': '_id',
                        'as': 'tag'
                      }
                    },
                    { '$unwind': { 'path': '$tag' } },
                    { '$addFields': { 'flare': '$tag.flare' } },
                    {
                      '$project': {
                        'date': 1,
                        '_id': 0,
                        'flare': 1
                      }
                    },
                    { '$match': { 'flare': flare._id } },
                    { '$limit': 1 }
                  ]

                  const start = await piValueModel.aggregate(startPipeline).exec();
                  let endPipeline = [
                    { '$sort': { 'date': -1 } },
                    {
                      '$lookup': {
                        'from': 'pitags',
                        'localField': 'piTag',
                        'foreignField': '_id',
                        'as': 'tag'
                      }
                    },
                    { '$unwind': { 'path': '$tag' } },
                    { '$addFields': { 'flare': '$tag.flare' } },
                    {
                      '$project': {
                        'date': 1,
                        '_id': 0,
                        'flare': 1
                      }
                    },
                    { '$match': { 'flare': flare._id } },
                    { '$limit': 1 }
                  ]
                  const end = await piValueModel.aggregate(endPipeline).exec();
                  flare.start = start[0].date
                  flare.end = end[0].date
                  return resolve(flare)
                }
                catch (error) {
                  if (error.hasOwnProperty('printPath')) {
                    let errObj = { printPath: "Mongo.getFlares().Loop: ", error: error.error };
                    errObj.printPath = `${errObj.printPath}${error.printPath}`
                    return reject(errObj);
                  }
                  return reject({ printPath: "Mongo.getFlares().Loop: ", error });
                }
              })();
            });
          }))
          const sorted = await this.SortByName(flareObjects);
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
                'header': { $ne: null }
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

          const formulas = await Formula.find({ org: orgOid }).lean().exec();
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
              if (params.length > 1) typeValue = params[0]
              params.shift()
              params = params.map(param => param.replace(/"/gm, '').replace(/'/gm, ''))
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
                thisSchema.param = found.parameter.name
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
  /**
   * Get the formulas sorted based on dependancies
   */
  async getSortedFormulas(orgOid) {
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
          const formulas = await this.getFormulas(orgOid)
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

          while (allFounds.length !== formulas.length) {
            /* 
                we add a limit here to make sure we dont enter an infinate loop.  this SHOULDNT occour
                due to formula validation...  but we dont want to enter an infi loop.
            */
            if (c === max) {
              console.log("LIMIT")
              break
            }
            for (const f of formulas) {
              if (knownVars.includes(f._id.toString())) continue

              let allFound = true
              for (const v of f.vars) {
                if (!knownVars.includes(v.id)) {
                  allFound = false
                }
              }
              if (allFound) {
                if (!knownVars.includes(f._id.toString())) {
                  knownVars.push(f._id.toString())
                  allFounds.push(f)
                }
              }
            }
            c++
          }
          this.allData.formulasByDependancies = allFounds;
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

  async getAllFormulasDepends(formulas = this.allData.formulas) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /* 
              This function loops thru the formulas and gets the 'newUnique' name  
              for each variable. so that we end with a unique list of values that we need to get.
          */
          async function _helper_(child, allDependants, depids, formulas) {
            if (!depids.includes(child.newUnique)) {
              allDependants.push(child)
              depids.push(child.newUnique)
            }

            if (child.type !== 'formula') return
            const formula = formulas.filter(row => row._id.toString() === child.id.toString())[0]
            for (const child of formula.vars) {
              await _helper_(child, allDependants, depids, formulas)
            }
          }

          if (this.allData.allDependants) return resolve(this.allData.allDependants);
          if (!formulas) {
            formulas = await this.getFormulas()
          }

          let allDependants = []
          const depids = []
          await Promise.all(formulas.map(async (formula) => {
            for (const child of formula.vars) {
              await _helper_(child, allDependants, depids, formulas)
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
            this.getHeaders()
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