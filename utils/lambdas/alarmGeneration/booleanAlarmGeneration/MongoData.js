// require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { User, EventRule, Event, Formula, PiValue, DebugFormulaValue, FormulaValue, PiValuesDebug, Org, Flare, Header } = require('./FRTModels');

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

Number.isInteger = Number.isInteger || function (value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value;
};

class MongoData {
  constructor() {
    this.connectionString = process.env.DBURI;
    this.client = null;
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
        catch (error) { return reject(getErrorObject(error, "Mongo.initClient(): ")) }
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

  async getFlaresMap() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let flaresMap = {};
          const flares = await Flare.find({}).lean().exec()
          for (let flare of flares) {
            flaresMap[flare._id.toString()] = flare;
          }
          return resolve(flaresMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }
  
  async getHeadersMap() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let headersMap = {};
          const headers = await Header.find({}).lean().exec()
          for (let header of headers) {
            headersMap[header._id.toString()] = header;
          }
          return resolve(headersMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }
  
  async getUsers() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let usersMap = {};
          const users = await User.find({}).lean().exec()
          for (let user of users) {
            usersMap[user._id.toString()] = user;
          }
          return resolve(usersMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }

  //returns map
  async getOrgs() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let orgsMap = {};
          const orgs = await Org.find({}).select('timezone').lean().exec()
          for (let org of orgs) {
            orgsMap[org._id.toString()] = org;
          }
          return resolve(orgsMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }

  //returns map
  async getFormulas(eventRules = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let filter = {};
          if (eventRules) {
            let formulaOIDs = eventRules.map(r => r.formula);
            filter = {
              '_id': {
                $in: formulaOIDs
              }
            }
          }
          let formulasMap = {};
          const formulas = await Formula.find(filter).select('to').lean().exec()
          for (let formula of formulas) {
            formulasMap[formula._id.toString()] = formula;
          }
          return resolve(formulasMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }
  
  async getEvent(eventID) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const event = await Event.findOne({_id:eventID}).lean().exec();
          return resolve(event)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getEventRules(): ")) }
      })();
    });
  }

  async getEventRules() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const rules = await EventRule.find({}).lean().exec()
          const rulesWithSubscribers = rules.filter(r => {
            if (r.subscribers) {
              return r.subscribers.length > 0;
            }
            return false;
          })
          const sorted = await this.SortByName(rulesWithSubscribers)
          return resolve(sorted)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getEventRules(): ")) }
      })();
    });
  }

  async getEvents(rules, flares, headers, formulasMap, maxMinutesAgo=30) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let numEvents = 0;
          var eventsMap = {};
          const dateLimit = new Date(Date.now() - (maxMinutesAgo * 60000)); //thirty minutes ago
          for (const rule of rules) {
            let to = formulasMap[rule.formula.toString()].to;
            let orgID = rule.org.toString();
            let ruleID = rule._id.toString();
            if (eventsMap[orgID] === undefined) eventsMap[orgID] = {};
            if (eventsMap[orgID][ruleID] === undefined) eventsMap[orgID][ruleID] = [];
            let orgFlares = flares.filter(f=>f.org.toString() === orgID);
            let orgHeaders = headers.filter(h=>h.org.toString() === orgID); 
            for (const flare of orgFlares) {
              let filter = {
                flare : flare._id,
                header : null,
                eventRule : rule._id,
                start: {
                  $gte: dateLimit
                }
              }
              if (to === 'flare'){
                const events = await Event.find(filter).sort('-end').limit(1).lean().exec();
                if (events.length > 0) {
                  events[0].flare = events[0].flare ? events[0].flare.toString() : null;
                  eventsMap[orgID][ruleID].push(events[0]);
                  numEvents++;
                }
                
              } else if (to === 'headers') {
                let flareHeaders = orgHeaders.filter(h=>h.flare.toString() === flare._id.toString());
                for (const header of flareHeaders) {
                  filter.header = header._id;
                  const events = await Event.find(filter).sort('-end').limit(1).lean().exec();
                  if (events.length > 0) {
                    events[0].flare = events[0].flare ? events[0].flare.toString() : null;
                    events[0].header = events[0].header ? events[0].header.toString() : null;
                    eventsMap[orgID][ruleID].push(events[0]);
                    numEvents++;
                  }
                }
                
              }
            }

          }
          if (numEvents === 0) { return resolve(null); }
          return resolve(eventsMap)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getEvents(): ")) }
      })();
    });
  }

  /**
   * 
   * @param {*} chunks 
   * @param {*} version 
   * @param {*} prodColl 
   * @returns ({ values, info })
   */
  async getFormulaValues(chunks, version, prodColl = true) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (version === undefined) throw new Error("variable 'version' is undefined")
          let filter = {};
          let IDs = chunks.map(c => {
            if (version === 1) {
              return c.formulaValue.toString();
            } else if (version === 2) {
              return c.collectionID.toString()
            } else throw new Error(`variable 'version' is an unexpected value: ${version}`)
          });
          filter = {
            '_id': {
              $in: IDs
            }
          }
          let collection = prodColl ? FormulaValue : DebugFormulaValue;
          let values = await collection.find(filter).sort('date').lean().exec();
          values = values.map(v => {
            if (v.value === null) return "null";
            else return v.value;
          });
          let numericValues = values.filter(v => (!isNaN(v) && v !== true && v !== false));
          numericValues.map(n => {
            if (Number.isInteger(n)) return n;
            return n.toFixed(4);
          })
          if (numericValues.length === 0) return resolve({ values, info: null })
          values = values.map(n => {
            if (Number(n) === n && n % 1 !== 0) return n.toFixed(4);
            return n;
          })
          let returnInfo = {
            values,
            info: { //toFixed(15)
              average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
              min: Math.min(...numericValues),
              max: Math.max(...numericValues)
            }
          }
          if (!Number.isInteger(returnInfo.info.average)) {
            returnInfo.info.average = returnInfo.info.average.toFixed(4);
          }
          if (!Number.isInteger(returnInfo.info.min)) {
            returnInfo.info.min = returnInfo.info.min.toFixed(4);
          }
          if (!Number.isInteger(returnInfo.info.max)) {
            returnInfo.info.max = returnInfo.info.max.toFixed(4);
          }
          return resolve(returnInfo)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulaValues(): ")) }
      })();
    });
  }

  /**
   * 
   * @param {*} chunks 
   * @param {*} version 
   * @param {*} prodColl 
   * @returns ({ values , info})
   */
  async getPiValues(chunks, version, prodColl = true) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (version === undefined) throw new Error("variable 'version' is undefined")
          let filter = {};
          let IDs = chunks.map(c => {
            if (version === 1) {
              return c.piValue.toString();
            } else if (version === 2) {
              return c.collectionID.toString()
            } else throw new Error(`variable 'version' is an unexpected value: ${version}`)
          });
          filter = {
            '_id': {
              $in: IDs
            }
          }
          let collection = prodColl ? PiValue : PiValuesDebug;
          let values = await collection.find(filter).sort('date').lean().exec();
          values = values.map(v => {
            if (v.value === null) return "null";
            else return v.value;
          });
          let numericValues = values.filter(v => (!isNaN(v) && v !== true && v !== false));
          if (numericValues.length === 0) return resolve({ values, info: null });
          values = values.map(n => {
            if (Number(n) === n && n % 1 !== 0) return n.toFixed(4);
            return n;
          })
          let returnInfo = {
            values,
            info: {
              average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
              min: Math.min(...numericValues),
              max: Math.max(...numericValues)
            }
          }
          if (!Number.isInteger(returnInfo.info.average)) {
            returnInfo.info.average = returnInfo.info.average.toFixed(4);
          }
          if (!Number.isInteger(returnInfo.info.min)) {
            returnInfo.info.min = returnInfo.info.min.toFixed(4);
          }
          if (!Number.isInteger(returnInfo.info.max)) {
            returnInfo.info.max = returnInfo.info.max.toFixed(4);
          }
          return resolve(returnInfo)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getPiValues(): ")) }
      })();
    });
  }

  async bulkWriteOnUsers(ops) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let res = await User.bulkWrite(ops);
          return resolve(res);
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.bulkWriteOnUsers(): ")) }
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
        catch (error) { return reject(getErrorObject(error, "Mongo.SortByName():")) }
      })();
    });
  }
}

module.exports = MongoData
