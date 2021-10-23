const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Formula, EventRule, Org, Flare, Header, Job, OrgInfo, VisibleEmission, Event, NumericEventRule, DailyNumericData, PiTag } = require('./FRTModels');

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
  constructor(IS_DEV_LOCAL_ENV) {
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
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

  async getFlares(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const flares = await Flare.find(filter).lean().exec()
          return resolve(flares)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFlares(): ")) }
      })();
    });
  }

  async getHeaders(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const headers = await Header.find(filter).lean().exec()
          return resolve(headers)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getHeaders(): ")) }
      })();
    });
  }

  async getOrgs(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const orgs = await Org.find(filter).select('timezone').lean().exec()
          return resolve(orgs)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getOrgs(): ")) }
      })();
    });
  }

  async getFormulas(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let formulas = await Formula.find(filter).select('name to org decimalPlaces').lean().exec()
          return resolve(formulas)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }

  async getEventRules(filter = {},findOne=false) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let rules = null;
          if (findOne) rules = await EventRule.findOne(filter).lean().exec();
          else rules = await EventRule.find(filter).lean().exec();
          return resolve(rules)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getEventRules(): ")) }
      })();
    });
  }

  async getNumericEventRules(filter = {},findOne=false) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (findOne) var rules = await NumericEventRule.findOne(filter).lean().exec();
          else var rules = await NumericEventRule.find(filter).lean().exec();
          return resolve(rules)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getNumericEventRules(): ")) }
      })();
    });
  }

  async bulkUpdateDailyNumData(bulkOps) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // console.log("bulkOps: ", util.inspect(bulkOps,{ depth: null}))
          let res = await DailyNumericData.bulkWrite(bulkOps);
          return resolve(res)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.bulkUpdateDailyNumData(): ")) }
      })();
    });
  }

  async getDailyNumericData(filter = {},findOne=false) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (findOne) var data = await DailyNumericData.findOne(filter).lean().exec();
          else var data = await DailyNumericData.find(filter).lean().exec();
          return resolve(data)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getNumericEventRules(): ")) }
      })();
    });
  }

  async getOrgInfo(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let info = await OrgInfo.find(filter).lean().exec()
          return resolve(info)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }

  async getVisibleEmissionsEvents(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let data = await VisibleEmission.find(filter).lean().exec()
          return resolve(data)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }

  async getEvents(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let data = await Event.find(filter).select('start end').lean().exec()
          return resolve(data)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }

  async getPitags(filter = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let data = await PiTag.find(filter).populate('parameter').lean().exec()
          return resolve(data)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }


  // async updateJob(jobID, isComplete, failed, link = null) {
  //   return new Promise((resolve, reject) => {
  //     (async () => {
  //       try {
  //         const filter = { _id : jobID };
  //         const update = { isComplete, failed, info : { link } };
  //         let doc = await Job.findOneAndUpdate(filter, update);
  //         return resolve(doc)
  //       }
  //       catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
  //     })();
  //   });
  // }
}

module.exports = MongoData
