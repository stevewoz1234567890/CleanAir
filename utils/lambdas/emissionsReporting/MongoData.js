const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Formula, DebugFormulaValue, FormulaValue, PiValuesDebug, Org, Flare, Header, Job } = require('./FRTModels');

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

  /**
   * 
   * @param {*} filter 
   * @param {boolean} prodColl 
   * @returns values
   */
  async getFormulaValues(filter = {}, prodColl = true) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let collection = prodColl ? FormulaValue : DebugFormulaValue;
          let values = await collection.find(filter).select('date value -_id').sort('date').lean().exec();
          values = values.map(v => {
            if (isNaN(v.value)) {
              v.value = null;
              return v;
            }
            else if (!isNaN(v.value) && v.value !== null && v.value < 0) {
              v.value = 0;
              return v;
            }
            else return v;
          });
          return resolve(values);
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulaValues(): ")) }
      })();
    });
  }

  async updateJob(jobID, isComplete, failed, link = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const filter = { _id : jobID };
          const update = { isComplete, failed, info : { link } };
          let doc = await Job.findOneAndUpdate(filter, update);
          return resolve(doc)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getFormulas(): ")) }
      })();
    });
  }
}

module.exports = MongoData
